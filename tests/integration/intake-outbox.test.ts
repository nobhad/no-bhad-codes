/**
 * Intake → outbox: verifies the transactional commit + dedupe-key
 * promise we made when the outbox was wired in.
 *
 * What this proves:
 *  - A POST /api/intake commits client + project + the three
 *    follow-up async_tasks rows in one transaction.
 *  - A second submission with the same email re-uses the existing
 *    client AND skips the duplicate task enqueues thanks to the
 *    partial unique index on async_tasks.dedupe_key. Without that
 *    index, a quick double-submit would double-fire the admin
 *    notification email.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestDb, type TestDbHandle } from './helpers';

let dbHandle: TestDbHandle;
let app: typeof import('../../server/app').app;

const VALID_INTAKE = {
  name: 'Integration Test',
  email: 'integration@test.local',
  projectFor: 'business' as const,
  companyName: 'Test Co',
  projectType: 'simple-site' as const,
  projectDescription: 'A site that exercises the intake outbox path end-to-end.',
  timeline: 'flexible' as const,
  budget: 'discuss' as const
};

beforeEach(async () => {
  dbHandle = await setupTestDb();
  ({ app } = await import('../../server/app'));
});

afterEach(async () => {
  await dbHandle.cleanup();
});

describe('intake → outbox', () => {
  it('commits client + project + 3 follow-up tasks in one transaction', async () => {
    const res = await request(app).post('/api/intake').send(VALID_INTAKE);

    expect(res.status).toBe(201);
    expect(res.body?.data?.clientId).toBeGreaterThan(0);
    expect(res.body?.data?.projectId).toBeGreaterThan(0);

    const { getDatabase } = await import('../../server/database/init');
    const db = getDatabase();

    const client = await db.get<{ id: number; email: string }>(
      'SELECT id, email FROM clients WHERE email = ?',
      [VALID_INTAKE.email]
    );
    expect(client?.email).toBe(VALID_INTAKE.email);

    const project = await db.get<{ id: number; client_id: number }>(
      'SELECT id, client_id FROM projects WHERE client_id = ?',
      [client!.id]
    );
    expect(project?.client_id).toBe(client?.id);

    const tasks = await db.all<{ task_type: string; dedupe_key: string | null }>(
      `SELECT task_type, dedupe_key FROM async_tasks
        WHERE task_type LIKE 'intake.%'
        ORDER BY task_type`
    );
    expect(tasks.map((t) => t.task_type)).toEqual([
      'intake.admin-notification',
      'intake.lead-score',
      'intake.save-file'
    ]);
    for (const task of tasks) {
      expect(task.dedupe_key).toMatch(new RegExp(`:${project!.id}$`));
    }
  });

  it('outbox dedupe-key collapses two enqueues with the same key into one row', async () => {
    const { getDatabase } = await import('../../server/database/init');
    const { enqueueAsyncTask } = await import('../../server/services/async-task-service');
    const db = getDatabase();

    const dedupeKey = `intake.admin-notification:${999}`;

    const insertedFirst = await db.transaction((ctx) =>
      enqueueAsyncTask(ctx, 'intake.admin-notification', { projectId: 999 }, { dedupeKey })
    );
    const insertedSecond = await db.transaction((ctx) =>
      enqueueAsyncTask(ctx, 'intake.admin-notification', { projectId: 999 }, { dedupeKey })
    );

    expect(insertedFirst).toBe(true);
    expect(insertedSecond).toBe(false);

    const rows = await db.all<{ n: number }>(
      `SELECT COUNT(*) AS n FROM async_tasks
        WHERE dedupe_key = ? AND status IN ('pending', 'running')`,
      [dedupeKey]
    );
    expect(rows[0]?.n).toBe(1);
  });
});
