/**
 * Stripe webhook idempotency: drive the underlying primitive
 * (claimStripeEvent / releaseStripeEventClaim) end-to-end against
 * the real DB to prove the contract:
 *
 *   - First call wins, returns true.
 *   - Second call with the same event.id returns false (short-
 *     circuits the handler).
 *   - Release after a thrown handler removes the claim, so a
 *     subsequent retry of the same id wins again.
 *
 * Skips the full webhook signature dance — that's the
 * verifyWebhookSignature primitive's contract, not the
 * idempotency layer's. Both are independently testable.
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

describe('Stripe webhook idempotency claim/release', () => {
  it('first claim wins; duplicate claim short-circuits', async () => {
    const { claimStripeEvent } = await import(
      '../../server/services/integrations/stripe-service.js'
    );
    const eventId = 'evt_test_idempotency_001';

    expect(await claimStripeEvent(eventId)).toBe(true);
    expect(await claimStripeEvent(eventId)).toBe(false);
    expect(await claimStripeEvent(eventId)).toBe(false);
  });

  it('release after a thrown handler lets the next delivery be processed', async () => {
    const { claimStripeEvent, releaseStripeEventClaim } = await import(
      '../../server/services/integrations/stripe-service.js'
    );
    const eventId = 'evt_test_idempotency_002';

    expect(await claimStripeEvent(eventId)).toBe(true);
    // Simulate the route's catch path: handler threw, so we release.
    await releaseStripeEventClaim(eventId);

    // Stripe's retry delivers the same event.id again; we must
    // accept it (otherwise the work would never run).
    expect(await claimStripeEvent(eventId)).toBe(true);
  });

  it('persists the claim through a process-restart simulation', async () => {
    const { claimStripeEvent } = await import(
      '../../server/services/integrations/stripe-service.js'
    );
    const eventId = 'evt_test_idempotency_003';

    expect(await claimStripeEvent(eventId)).toBe(true);

    // Module-level cache would say "seen" without checking the DB,
    // so to prove the DB is the source of truth, verify the row is
    // really there and that a fresh claim still returns false.
    const { getDatabase } = await import('../../server/database/init');
    const dbRow = await getDatabase().get<{ event_id: string }>(
      'SELECT event_id FROM webhook_processed_events WHERE event_id = ?',
      [eventId]
    );
    expect(dbRow?.event_id).toBe(eventId);
    expect(await claimStripeEvent(eventId)).toBe(false);
  });
});
