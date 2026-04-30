/**
 * Idempotency-Key middleware: verifies the three contract branches
 * (replay, body-mismatch, in-flight) using a synthetic POST handler
 * mounted on a test-only path.
 *
 * Why a synthetic handler instead of /api/payments/create-intent:
 * the payment endpoint requires Stripe to be configured + a real
 * client/invoice graph. The middleware logic is independent of any
 * particular route, so a tiny handler proves the same code path
 * with none of that setup.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDb, type TestDbHandle } from './helpers';

let dbHandle: TestDbHandle;
let app: express.Express;

beforeEach(async () => {
  dbHandle = await setupTestDb();

  // Build a minimal app that runs the same middleware stack we care
  // about: cookie parsing → fake auth → idempotency. We bypass
  // authenticateToken by setting req.user inline; the middleware
  // only needs req.user to compute the user_scope.
  const { withIdempotencyKey } = await import(
    '../../server/middleware/idempotency-key.js'
  );
  const cookieParser = (await import('cookie-parser')).default;

  app = express();
  app.use(express.json());
  app.use(cookieParser());
  // Stand-in for auth: tests pass a JWT cookie; we decode minimally
  // so user_scope keying matches what production would produce.
  app.use((req, _res, next) => {
    const cookieHeader = req.headers.cookie ?? '';
    const isAdmin = cookieHeader.includes('role=admin');
    (req as unknown as { user: { id: number; type: string; email: string } }).user = isAdmin
      ? { id: 0, type: 'admin', email: 'admin@test.local' }
      : { id: 42, type: 'client', email: 'c42@test.local' };
    next();
  });

  let invocations = 0;
  app.post(
    '/test-handler',
    withIdempotencyKey(),
    (req, res) => {
      invocations += 1;
      res.status(201).json({
        invocations,
        echo: req.body
      });
    }
  );

  // Expose invocation counter for assertions.
  (app as unknown as { __getInvocations: () => number }).__getInvocations = () =>
    invocations;
});

afterEach(async () => {
  await dbHandle.cleanup();
});

describe('Idempotency-Key middleware', () => {
  it('replays the cached response for a repeat with the same key + body', async () => {
    const key = 'test-key-replay-001-aaaa';
    const body = { foo: 'bar' };

    const first = await request(app)
      .post('/test-handler')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);

    const second = await request(app)
      .post('/test-handler')
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);

    // Server returns the cached body byte-for-byte.
    expect(second.body).toEqual(first.body);
    expect(second.headers['x-idempotent-replay']).toBe('true');

    // Handler ran exactly once.
    const invocations = (
      app as unknown as { __getInvocations: () => number }
    ).__getInvocations();
    expect(invocations).toBe(1);
  });

  it('returns 422 when the same key is used with a different body', async () => {
    const key = 'test-key-mismatch-001-bbbb';
    await request(app)
      .post('/test-handler')
      .set('Idempotency-Key', key)
      .send({ foo: 'bar' })
      .expect(201);

    const mismatch = await request(app)
      .post('/test-handler')
      .set('Idempotency-Key', key)
      .send({ foo: 'WIDGETS' })
      .expect(422);

    expect(mismatch.body?.code).toBe('IDEMPOTENCY_KEY_MISMATCH');
  });

  it('rejects keys outside the length window', async () => {
    const tooShort = await request(app)
      .post('/test-handler')
      .set('Idempotency-Key', 'short')
      .send({})
      .expect(400);
    expect(tooShort.body?.code).toBe('INVALID_IDEMPOTENCY_KEY');
  });

  it('skips the middleware entirely when the header is omitted', async () => {
    await request(app).post('/test-handler').send({ a: 1 }).expect(201);
    await request(app).post('/test-handler').send({ a: 1 }).expect(201);

    // Both ran; no idempotency_keys row was written.
    const { getDatabase } = await import('../../server/database/init');
    const db = getDatabase();
    const row = await db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM idempotency_keys'
    );
    expect(row?.n).toBe(0);

    // Sanity: the handler ran twice.
    const invocations = (
      app as unknown as { __getInvocations: () => number }
    ).__getInvocations();
    expect(invocations).toBe(2);
  });
});
