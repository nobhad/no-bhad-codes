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

export type AsyncTaskHandler = (payload: unknown) => Promise<void>;

interface AsyncTaskRow {
  id: number;
  task_type: string;
  payload: string;
  attempts: number;
  max_attempts: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 30;
const BACKOFF_MAX_SECONDS = 60 * 60;
const DEFAULT_BATCH_SIZE = 25;

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
    const candidate = await db.get<AsyncTaskRow>(
      `SELECT id, task_type, payload, attempts, max_attempts
         FROM async_tasks
        WHERE status = 'pending'
          AND next_attempt_at <= datetime('now')
        ORDER BY next_attempt_at ASC
        LIMIT 1`
    );

    if (!candidate) break;

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
      failed += 1;
      dead += 1;
      continue;
    }

    try {
      await handler(parsedPayload);
      await db.run(
        `UPDATE async_tasks
            SET status = 'completed',
                completed_at = datetime('now'),
                last_error = NULL
          WHERE id = ?`,
        [candidate.id]
      );
      processed += 1;
    } catch (err) {
      const attemptsUsed = candidate.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      const isDead = attemptsUsed >= candidate.max_attempts;

      if (isDead) {
        await db.run(
          `UPDATE async_tasks
              SET status = 'dead',
                  last_error = ?,
                  completed_at = datetime('now')
            WHERE id = ?`,
          [message, candidate.id]
        );
        await logger.error('[AsyncTasks] Dead-lettered: retries exhausted', {
          category: 'ASYNC_TASKS',
          metadata: {
            id: candidate.id,
            taskType: candidate.task_type,
            attempts: attemptsUsed,
            lastError: message
          }
        });
        dead += 1;
      } else {
        await db.run(
          `UPDATE async_tasks
              SET status = 'pending',
                  last_error = ?,
                  next_attempt_at = datetime('now', ?)
            WHERE id = ?`,
          [message, `+${backoffSeconds(attemptsUsed)} seconds`, candidate.id]
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
