/**
 * ===============================================
 * EMAIL DEDUPE
 * ===============================================
 * @file server/services/email-dedupe.ts
 *
 * Small helper for the async_tasks outbox: wrap an email send with a
 * stable key so a retried task doesn't re-send the same notification
 * after a crash between "email sent" and "task marked completed".
 *
 * Dedupe keys are caller-supplied and should be deterministic for the
 * notification being sent (e.g. `intake.admin-notification:${projectId}`).
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

const DEDUPE_RETENTION_DAYS = 30;

/**
 * Run `send` only if we haven't already recorded `dedupeKey` as sent.
 *
 * Flow:
 *   1. INSERT OR IGNORE the key. If `changes === 0`, another run
 *      already claimed this key — skip the send.
 *   2. Otherwise run the send. On failure, DELETE the key so a retry
 *      can try again; on success, leave it in place.
 *
 * The insert-then-send ordering means a crash AFTER the key was
 * inserted but BEFORE send completes will suppress the send on retry.
 * That's the correct trade-off here: a missed notification is
 * recoverable (the operator sees it in the outbox / logs), a duplicate
 * notification to a client is harder to take back.
 */
export async function sendEmailWithDedupe<T>(
  dedupeKey: string,
  send: () => Promise<T>
): Promise<{ sent: boolean; result: T | null }> {
  if (!dedupeKey) {
    const result = await send();
    return { sent: true, result };
  }

  const db = getDatabase();
  const claim = await db.run(
    `INSERT OR IGNORE INTO email_dedupe (dedupe_key, sent_at)
     VALUES (?, datetime('now'))`,
    [dedupeKey]
  );

  if (!claim.changes) {
    logger.info(`[EmailDedupe] Skipping send — key already recorded: ${dedupeKey}`);
    return { sent: false, result: null };
  }

  try {
    const result = await send();
    return { sent: true, result };
  } catch (err) {
    await db.run('DELETE FROM email_dedupe WHERE dedupe_key = ?', [dedupeKey]);
    throw err;
  }
}

/**
 * Housekeeping: drop dedupe rows older than the retention window.
 * Called from the scheduler — the table is otherwise append-only.
 */
export async function pruneEmailDedupe(): Promise<number> {
  const db = getDatabase();
  const result = await db.run(
    'DELETE FROM email_dedupe WHERE sent_at < datetime(\'now\', ?)',
    [`-${DEDUPE_RETENTION_DAYS} days`]
  );
  return result.changes ?? 0;
}
