/**
 * Payment intent → Stripe webhook flow, end-to-end against the real
 * Express app. We seed an outstanding invoice and a matching
 * stripe_payment_intents row, forge a `payment_intent.succeeded` event
 * signed with the test webhook secret, and POST it at the webhook
 * route. The handler must:
 *
 *   - flip the invoice to 'paid' inside one transaction with a matching
 *     invoice_payments row,
 *   - mark the stripe_payment_intents row succeeded,
 *   - record the event id in webhook_processed_events for idempotency,
 *   - and on a replay (Stripe retry of the same event.id) short-circuit
 *     without inserting a duplicate payment row.
 *
 * The Stripe SDK is never called — verifyWebhookSignature is pure
 * HMAC-SHA256 against process.env.STRIPE_WEBHOOK_SECRET, which the
 * harness sets to a known test value. handlePaymentSuccess only reads
 * from the local DB.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  setupTestDb,
  seedClient,
  seedProject,
  seedInvoice,
  seedStripePaymentIntent,
  signStripeWebhook,
  type TestDbHandle
} from './helpers';

let dbHandle: TestDbHandle;

beforeEach(async () => {
  dbHandle = await setupTestDb();
});

afterEach(async () => {
  await dbHandle.cleanup();
});

interface PaymentFixture {
  clientId: number;
  invoiceId: number;
  stripeIntentId: string;
  amountCents: number;
}

async function seedPaidableInvoice(): Promise<PaymentFixture> {
  const clientId = await seedClient();
  const projectId = await seedProject(clientId);
  const amountCents = 12500;
  const invoiceId = await seedInvoice(clientId, projectId, {
    amount_total: amountCents / 100,
    status: 'sent'
  });
  const stripeIntentId = await seedStripePaymentIntent({
    clientId,
    invoiceId,
    amountCents
  });
  return { clientId, invoiceId, stripeIntentId, amountCents };
}

function buildSucceededEvent(stripeIntentId: string, eventId: string) {
  return {
    id: eventId,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: stripeIntentId,
        object: 'payment_intent',
        amount: 12500,
        currency: 'usd',
        status: 'succeeded'
      }
    }
  };
}

describe('Payment intent + Stripe webhook flow', () => {
  it('signed payment_intent.succeeded marks invoice paid and records the payment', async () => {
    const { invoiceId, stripeIntentId, amountCents } = await seedPaidableInvoice();
    const eventId = 'evt_test_succeeded_001';
    const payload = JSON.stringify(buildSucceededEvent(stripeIntentId, eventId));
    const signature = signStripeWebhook(payload);

    const { app } = await import('../../server/app.js');
    const { getDatabase } = await import('../../server/database/init.js');

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body?.data?.received).toBe(true);

    const db = getDatabase();

    const intent = await db.get<{ status: string }>(
      'SELECT status FROM stripe_payment_intents WHERE stripe_intent_id = ?',
      [stripeIntentId]
    );
    expect(intent?.status).toBe('succeeded');

    const invoice = await db.get<{
      status: string;
      paid_at: string | null;
      stripe_payment_intent_id: string | null;
      payment_method: string | null;
    }>(
      'SELECT status, paid_at, stripe_payment_intent_id, payment_method FROM invoices WHERE id = ?',
      [invoiceId]
    );
    expect(invoice?.status).toBe('paid');
    expect(invoice?.paid_at).toBeTruthy();
    expect(invoice?.stripe_payment_intent_id).toBe(stripeIntentId);
    expect(invoice?.payment_method).toBe('stripe');

    const payments = await db.all<{
      amount: number;
      payment_method: string;
      stripe_payment_intent_id: string | null;
      status: string;
    }>(
      `SELECT amount, payment_method, stripe_payment_intent_id, status
         FROM invoice_payments WHERE invoice_id = ?`,
      [invoiceId]
    );
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      payment_method: 'stripe',
      stripe_payment_intent_id: stripeIntentId,
      status: 'succeeded'
    });
    expect(Number(payments[0].amount)).toBe(amountCents / 100);

    const claim = await db.get<{ event_id: string }>(
      'SELECT event_id FROM webhook_processed_events WHERE event_id = ?',
      [eventId]
    );
    expect(claim?.event_id).toBe(eventId);
  });

  it('replay of the same event.id is idempotent (no duplicate payment row)', async () => {
    const { invoiceId, stripeIntentId } = await seedPaidableInvoice();
    const eventId = 'evt_test_succeeded_replay_001';
    const payload = JSON.stringify(buildSucceededEvent(stripeIntentId, eventId));
    const signature = signStripeWebhook(payload);

    const { app } = await import('../../server/app.js');
    const { getDatabase } = await import('../../server/database/init.js');

    const first = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
    expect(first.status).toBe(200);
    expect(first.body?.data?.alreadyProcessed).toBeUndefined();

    // Stripe retries the same event id on transient failures (or an
    // operator can replay it from the dashboard). The outer claim layer
    // must short-circuit before handlePaymentSuccess runs again.
    const replay = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signStripeWebhook(payload))
      .send(payload);
    expect(replay.status).toBe(200);
    expect(replay.body?.data?.alreadyProcessed).toBe(true);

    const db = getDatabase();

    const payments = await db.all<{ id: number }>(
      'SELECT id FROM invoice_payments WHERE invoice_id = ? AND status = ?',
      [invoiceId, 'succeeded']
    );
    expect(payments).toHaveLength(1);

    const intents = await db.all<{ status: string }>(
      'SELECT status FROM stripe_payment_intents WHERE stripe_intent_id = ?',
      [stripeIntentId]
    );
    expect(intents).toHaveLength(1);
    expect(intents[0].status).toBe('succeeded');
  });

  it('rejects an unsigned webhook with 400 and a forged signature with 401', async () => {
    const { stripeIntentId } = await seedPaidableInvoice();
    const payload = JSON.stringify(
      buildSucceededEvent(stripeIntentId, 'evt_test_badsig_001')
    );

    const { app } = await import('../../server/app.js');

    const noSig = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(payload);
    expect(noSig.status).toBe(400);

    const forged = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set(
        'stripe-signature',
        `t=${Math.floor(Date.now() / 1000)},v1=deadbeefdeadbeefdeadbeefdeadbeef`
      )
      .send(payload);
    expect(forged.status).toBe(401);
  });
});
