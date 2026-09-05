/**
 * The connection pool opens several SQLite connections against one file.
 * WAL lets readers run alongside a writer, but only one writer may hold
 * the write lock at a time — so two pool slots writing at once is normal,
 * expected contention, not an error.
 *
 * SQLite's own answer to that is the busy handler: wait for the lock, then
 * retry. Without one it gives up instantly with SQLITE_BUSY, which is what
 * CI kept hitting — a loaded runner overlaps writes that a fast local
 * machine happens to serialize.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb, type TestDbHandle } from './helpers';

let dbHandle: TestDbHandle;

beforeEach(async () => {
  dbHandle = await setupTestDb();
});

afterEach(async () => {
  await dbHandle.cleanup();
});

/**
 * How long the transaction under test sits on the write lock. It has to clear
 * node-sqlite3's 1000ms default busy timeout, because that default is the bug:
 * under it every writer already waits and succeeds, so a shorter hold passes
 * against an unfixed pool and proves nothing.
 */
const LOCK_HOLD_MS = 2500;
/** Grace period for BEGIN + the first write to actually take the lock. */
const LOCK_SETTLE_MS = 100;

async function insertClient(
  run: (sql: string, params: unknown[]) => Promise<{ lastID?: number }>,
  email: string
) {
  return run(
    `INSERT INTO clients (
       email, contact_name, status, client_type, password_hash,
       created_at, updated_at
     ) VALUES (?, ?, 'active', 'individual', 'x', datetime('now'), datetime('now'))`,
    [email, 'Pool Contention']
  );
}

describe('Database connection pool under write contention', () => {
  it('a second connection waits for an open transaction instead of failing with SQLITE_BUSY', async () => {
    const { getDatabase } = await import('../../server/database/init.js');
    const db = getDatabase();

    let releaseLock!: () => void;
    const lockHeld = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Connection 1 takes the write lock and sits on it.
    const transaction = db.transaction(async (ctx) => {
      await insertClient(ctx.run, 'holder@test.local');
      await lockHeld;
      return 'committed';
    });

    await new Promise((resolve) => setTimeout(resolve, LOCK_SETTLE_MS));

    // Connection 2 writes while that lock is still held.
    const contendingWrite = insertClient(db.run.bind(db), 'contender@test.local');
    setTimeout(releaseLock, LOCK_HOLD_MS);

    const result = await contendingWrite;
    expect(result.lastID).toBeGreaterThan(0);
    await expect(transaction).resolves.toBe('committed');

    const rows = await db.all<{ email: string }>(
      `SELECT email FROM clients WHERE contact_name = 'Pool Contention' ORDER BY email`
    );
    expect(rows.map((r) => r.email)).toEqual(['contender@test.local', 'holder@test.local']);
  });
});
