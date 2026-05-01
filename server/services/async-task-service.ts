/**
 * ===============================================
 * ASYNC TASK OUTBOX
 * ===============================================
 * @file server/services/async-task-service.ts
 *
 * Durable queue for follow-up work enqueued inside a DB transaction.
 * Replaces fire-and-forget `setTimeout()` patterns so failures are
 * retryable instead of silently dropped.
 */

import { getDatabase, type TransactionContext } from '../database/init.js';
import { logger } from './logger.js';
import { errorTracker } from './error-tracking.js';
import { runWithRequestContext } from '../observability/request-context.js';
import { parseRow } from '../database/row-validator.js';
import {
  asyncTaskClaimRowSchema,
  type AsyncTaskClaimRow
} from '../database/row-schemas.js';

/**
 * Emit a dead-letter alert to Sentry so ops sees the event without
 * tailing logs. Warning level — a dead-letter usually means ops
 * attention, not a server bug per se.
 */
function alertDeadLetter(
  kind: 'no_handler' | 'payload_parse_error' | 'retries_exhausted',
  taskId: number,
  taskType: string,
  detail: Record<string, unknown>
): void {
  errorTracker.captureMessage(
    `Async task dead-lettered (${kind}): ${taskType}#${taskId}`,
    'warning',
    {
      tags: {
        resilience_event: 'async_task_dead',
        dead_letter_kind: kind,
        task_type: taskType
      },
      extra: { taskId, ...detail }
    }
  );
}

export type AsyncTaskHandler = (payload: unknown) => Promise<void>;

const DEFAULT_MAX_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 30;
const BACKOFF_MAX_SECONDS = 60 * 60;
const DEFAULT_BATCH_SIZE = 25;

/**
 * Retention windows for the async_tasks outbox. Tasks that ran to
 * completion are cheap to keep but accumulate PII (payload snapshots of
 * intake forms, error strings containing client emails) — shorter
 * window. Dead-lettered tasks are kept longer because someone will
 * want to inspect them.
 */
const COMPLETED_RETENTION_DAYS = 30;
const DEAD_RETENTION_DAYS = 90;

/**
 * Redact common PII / secret patterns from error messages before they
 * land in async_tasks.last_error. Narrow on purpose — noisy redaction
 * makes errors unreadable. Covers the categories we've actually seen
 * leak: email addresses from failed notifications, bearer/JWT/Stripe
 * secrets from misconfigured callers.
 */
const PII_REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '<email>'],
  [/\b(?:sk|pk|whsec|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g, '<secret>'],
  [/\bBearer\s+[A-Za-z0-9._-]{8,}/g, 'Bearer <token>'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt>']
];

function redactErrorMessage(message: string): string {
  let out = message;
  for (const [pattern, replacement] of PII_REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out.length > 1000 ? `${out.slice(0, 1000)  }…` : out;
}

const handlers = new Map<string, AsyncTaskHandler>();

/**
 * Register a handler for a task type. Handlers run from the scheduler
 * and must be idempotent — a task may be retried after a partial failure.
 */
export function registerAsyncTaskHandler(
  taskType: string,
  handler: AsyncTaskHandler
): void {
  handlers.set(taskType, handler);
}

export interface EnqueueAsyncTaskOptions {
  maxAttempts?: number;
  delaySeconds?: number;
  /**
   * Semantic dedupe key. If provided, any concurrently-pending or
   * currently-running task with the same key is kept and this call
   * becomes a no-op — which is what you want for "admin notification
   * for project 42": one in flight is enough, duplicates are noise.
   *
   * Once a task reaches completed/failed/dead, its key frees up so a
   * later legitimate enqueue (e.g. the project was resubmitted) isn't
   * blocked by historical rows.
   */
  dedupeKey?: string;
}

/**
 * Enqueue a task inside an active transaction, so the task row is
 * committed atomically with the work that scheduled it. If the
 * transaction rolls back, the task disappears with it.
 *
 * Returns `true` if a new row was inserted, `false` if a dedupe key
 * was provided and an active duplicate already exists.
 */
export async function enqueueAsyncTask(
  ctx: Pick<TransactionContext, 'run'>,
  taskType: string,
  payload: unknown,
  options: EnqueueAsyncTaskOptions = {}
): Promise<boolean> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delay = Math.max(0, options.delaySeconds ?? 0);
  const dedupeKey = options.dedupeKey?.trim() || null;

  // The partial unique index on (dedupe_key) WHERE status IN
  // ('pending','running') makes INSERT OR IGNORE the atomic
  // "insert-if-no-active-duplicate" primitive. `changes` tells us
  // which path we took without a separate SELECT.
  const result = await ctx.run(
    `INSERT OR IGNORE INTO async_tasks
       (task_type, payload, max_attempts, next_attempt_at, dedupe_key)
     VALUES (?, ?, ?, datetime('now', ?), ?)`,
    [
      taskType,
      JSON.stringify(payload ?? null),
      maxAttempts,
      `+${delay} seconds`,
      dedupeKey
    ]
  );

  return (result.changes ?? 0) > 0;
}

function backoffSeconds(attempt: number): number {
  const exp = Math.min(BACKOFF_MAX_SECONDS, BACKOFF_BASE_SECONDS * 2 ** (attempt - 1));
  return Math.floor(exp);
}

/**
 * Claim and execute up to `batchSize` ready tasks. Safe to call
 * concurrently: claim uses a conditional UPDATE so two workers can't
 * run the same row.
 */
export async function drainAsyncTasks(batchSize = DEFAULT_BATCH_SIZE): Promise<{
  processed: number;
  failed: number;
  dead: number;
}> {
  const db = getDatabase();
  let processed = 0;
  let failed = 0;
  let dead = 0;

  for (let i = 0; i < batchSize; i++) {
    const rawCandidate = await db.get(
      `SELECT id, task_type, payload, attempts, max_attempts
         FROM async_tasks
        WHERE status = 'pending'
          AND next_attempt_at <= datetime('now')
        ORDER BY next_attempt_at ASC
        LIMIT 1`
    );

    if (!rawCandidate) break;

    const candidate: AsyncTaskClaimRow | null = parseRow(
      asyncTaskClaimRowSchema,
      rawCandidate,
      { op: 'async_tasks.claim' }
    );
    if (!candidate) {
      // Validation already logged; skip this row and move on so a
      // single drifted column can't stall the whole drain.
      continue;
    }

    const claim = await db.run(
      `UPDATE async_tasks
          SET status = 'running',
              attempts = attempts + 1,
              started_at = datetime('now')
        WHERE id = ? AND status = 'pending'`,
      [candidate.id]
    );

    if (!claim.changes) continue; // another worker got it

    const handler = handlers.get(candidate.task_type);
    if (!handler) {
      const reason = `No handler registered for task type: ${candidate.task_type}`;
      await db.run(
        `UPDATE async_tasks
            SET status = 'dead',
                last_error = ?,
                completed_at = datetime('now')
          WHERE id = ?`,
        [reason, candidate.id]
      );
      await logger.error('[AsyncTasks] Dead-lettered: no handler', {
        category: 'ASYNC_TASKS',
        metadata: { id: candidate.id, taskType: candidate.task_type }
      });
      alertDeadLetter('no_handler', candidate.id, candidate.task_type, {});
      failed += 1;
      dead += 1;
      continue;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(candidate.payload);
    } catch (parseErr) {
      const reason = `Payload parse error: ${(parseErr as Error).message}`;
      await db.run(
        `UPDATE async_tasks
            SET status = 'dead',
                last_error = ?,
                completed_at = datetime('now')
          WHERE id = ?`,
        [reason, candidate.id]
      );
      await logger.error('[AsyncTasks] Dead-lettered: payload parse error', {
        category: 'ASYNC_TASKS',
        metadata: { id: candidate.id, taskType: candidate.task_type, reason }
      });
      alertDeadLetter('payload_parse_error', candidate.id, candidate.task_type, { reason });
      failed += 1;
      dead += 1;
      continue;
    }

    try {
      // Run handler in its own ALS scope so logs emitted during the
      // handler are attributable to the specific task (grep by
      // requestId=task-<id>) rather than appearing context-less as
      // scheduler-internal chatter.
      await runWithRequestContext(
        {
          requestId: `task-${candidate.id}`,
          method: 'ASYNC_TASK',
          path: candidate.task_type,
          userId: null,
          userType: 'system'
        },
        () => handler(parsedPayload)
      );
      // Clear payload on completion — most task payloads snapshot user
      // intake data (name, email, phone). The task is done; keeping
      // the PII around buys us nothing but a retention headache.
      await db.run(
        `UPDATE async_tasks
            SET status = 'completed',
                completed_at = datetime('now'),
                last_error = NULL,
                payload = NULL
          WHERE id = ?`,
        [candidate.id]
      );
      processed += 1;
    } catch (err) {
      const attemptsUsed = candidate.attempts + 1;
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = redactErrorMessage(rawMessage);
      const isDead = attemptsUsed >= candidate.max_attempts;

      if (isDead) {
        // Dead row is kept for ops inspection but the payload is
        // dropped — if a handler needed to re-run from it, it wouldn't
        // be retried anyway.
        await db.run(
          `UPDATE async_tasks
              SET status = 'dead',
                  last_error = ?,
                  completed_at = datetime('now'),
                  payload = NULL
            WHERE id = ?`,
          [safeMessage, candidate.id]
        );
        await logger.error('[AsyncTasks] Dead-lettered: retries exhausted', {
          category: 'ASYNC_TASKS',
          metadata: {
            id: candidate.id,
            taskType: candidate.task_type,
            attempts: attemptsUsed,
            lastError: safeMessage
          }
        });
        alertDeadLetter('retries_exhausted', candidate.id, candidate.task_type, {
          attempts: attemptsUsed,
          lastError: safeMessage
        });
        dead += 1;
      } else {
        await db.run(
          `UPDATE async_tasks
              SET status = 'pending',
                  last_error = ?,
                  next_attempt_at = datetime('now', ?)
            WHERE id = ?`,
          [safeMessage, `+${backoffSeconds(attemptsUsed)} seconds`, candidate.id]
        );
      }
      failed += 1;
    }
  }

  return { processed, failed, dead };
}

export interface AsyncTaskStatusCounts {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  dead: number;
}

/**
 * Count tasks grouped by status. Intended for an ops dashboard or
 * admin health endpoint; a non-zero `dead` count means human attention
 * is needed.
 */
export async function getAsyncTaskCounts(): Promise<AsyncTaskStatusCounts> {
  const db = getDatabase();
  const rows = await db.all<{ status: string; n: number }>(
    'SELECT status, COUNT(*) AS n FROM async_tasks GROUP BY status'
  );
  const counts: AsyncTaskStatusCounts = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    dead: 0
  };
  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as keyof AsyncTaskStatusCounts] = row.n;
    }
  }
  return counts;
}

export interface AsyncTaskListItem {
  id: number;
  task_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  created_at: string;
  completed_at: string | null;
}

export type AsyncTaskStatus = keyof AsyncTaskStatusCounts;

export async function listAsyncTasks(
  status: AsyncTaskStatus,
  limit = 50
): Promise<AsyncTaskListItem[]> {
  const db = getDatabase();
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  return db.all<AsyncTaskListItem>(
    `SELECT id, task_type, status, attempts, max_attempts, last_error,
            next_attempt_at, created_at, completed_at
       FROM async_tasks
      WHERE status = ?
      ORDER BY COALESCE(completed_at, next_attempt_at) DESC
      LIMIT ?`,
    [status, safeLimit]
  );
}

/**
 * Purge completed / dead-lettered rows past their retention window.
 *
 * Completed tasks are purged after 30 days; dead-lettered after 90.
 * Pending/running rows are never touched here — they're still live
 * work and the drain loop owns their lifecycle.
 *
 * Payload is already NULLed on completion/dead transitions so PII
 * doesn't sit in the DB past the handler; this is the second cleanup
 * tier that drops the row metadata entirely.
 */
export async function purgeOldAsyncTasks(): Promise<{
  completedDeleted: number;
  deadDeleted: number;
}> {
  const db = getDatabase();

  const completedResult = await db.run(
    `DELETE FROM async_tasks
      WHERE status = 'completed'
        AND completed_at IS NOT NULL
        AND completed_at < datetime('now', ?)`,
    [`-${COMPLETED_RETENTION_DAYS} days`]
  );

  const deadResult = await db.run(
    `DELETE FROM async_tasks
      WHERE status = 'dead'
        AND completed_at IS NOT NULL
        AND completed_at < datetime('now', ?)`,
    [`-${DEAD_RETENTION_DAYS} days`]
  );

  return {
    completedDeleted: completedResult.changes ?? 0,
    deadDeleted: deadResult.changes ?? 0
  };
}
