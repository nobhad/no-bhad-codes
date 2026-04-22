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

/**
 * Enqueue a task inside an active transaction, so the task row is
 * committed atomically with the work that scheduled it. If the
 * transaction rolls back, the task disappears with it.
 */
export async function enqueueAsyncTask(
  ctx: Pick<TransactionContext, 'run'>,
  taskType: string,
  payload: unknown,
  options: { maxAttempts?: number; delaySeconds?: number } = {}
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delay = Math.max(0, options.delaySeconds ?? 0);

  await ctx.run(
    `INSERT INTO async_tasks (task_type, payload, max_attempts, next_attempt_at)
     VALUES (?, ?, ?, datetime('now', ?))`,
    [taskType, JSON.stringify(payload ?? null), maxAttempts, `+${delay} seconds`]
  );
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
}> {
  const db = getDatabase();
  let processed = 0;
  let failed = 0;

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
      await db.run(
        `UPDATE async_tasks
            SET status = 'dead',
                last_error = ?,
                completed_at = datetime('now')
          WHERE id = ?`,
        [`No handler registered for task type: ${candidate.task_type}`, candidate.id]
      );
      failed += 1;
      continue;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(candidate.payload);
    } catch (parseErr) {
      await db.run(
        `UPDATE async_tasks
            SET status = 'dead',
                last_error = ?,
                completed_at = datetime('now')
          WHERE id = ?`,
        [`Payload parse error: ${(parseErr as Error).message}`, candidate.id]
      );
      failed += 1;
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
        await logger.error('[AsyncTasks] Task exhausted retries', {
          category: 'ASYNC_TASKS',
          metadata: { id: candidate.id, taskType: candidate.task_type, attempts: attemptsUsed }
        });
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

  return { processed, failed };
}
