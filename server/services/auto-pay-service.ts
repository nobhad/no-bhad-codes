/**
 * ===============================================
 * AUTO-PAY SERVICE
 * ===============================================
 * @file server/services/auto-pay-service.ts
 *
 * Manages automatic payment collection:
 * - Saved payment method CRUD
 * - Auto-pay enrollment
 * - Automatic invoice charging via Stripe
 * - Retry logic for failed charges
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import { calculateAmountWithProcessingFee } from '../config/constants.js';
import type {
  SavedPaymentMethod,
  SavedPaymentMethodRow,
  AutoPayAttemptRow,
  AutoPayResult
} from './auto-pay-types.js';
import { MAX_AUTO_PAY_RETRIES, RETRY_DELAY_HOURS } from './auto-pay-types.js';

// ============================================
// Constants
// ============================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2023-10-16';

// ============================================
// Stripe Helpers
// ============================================

function requireStripeKey(): string {
  if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.startsWith('sk_')) {
    throw new Error('Stripe is not configured');
  }
  return STRIPE_SECRET_KEY;
}

async function stripeRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  params?: URLSearchParams
): Promise<Record<string, unknown>> {
  const key = requireStripeKey();
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION
    }
  };

  if (params && method === 'POST') {
    options.body = params.toString();
  }

  const url = method === 'GET' && params
    ? `${STRIPE_API_BASE}${endpoint}?${params.toString()}`
    : `${STRIPE_API_BASE}${endpoint}`;

  const response = await fetch(url, options);
  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new Error(`Stripe API error: ${error?.message || response.statusText}`);
  }

  return data;
}

// ============================================
// Row Mapper
// ============================================

function mapPaymentMethodRow(row: SavedPaymentMethodRow): SavedPaymentMethod {
  return {
    id: row.id,
    clientId: row.client_id,
    stripePaymentMethodId: row.stripe_payment_method_id,
    type: row.type,
    brand: row.brand,
    lastFour: row.last_four,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    isDefault: row.is_default === 1,
    createdAt: row.created_at
  };
}

// ============================================
// Payment Method Management
// ============================================

/**
 * List saved payment methods for a client.
 */
async function listPaymentMethods(clientId: number): Promise<SavedPaymentMethod[]> {
  const db = getDatabase();
  const rows = (await db.all(
    'SELECT * FROM client_payment_methods WHERE client_id = ? ORDER BY is_default DESC, created_at DESC',
    [clientId]
  )) as SavedPaymentMethodRow[];
  return rows.map(mapPaymentMethodRow);
}

/**
 * Save a payment method from Stripe (after client adds card via SetupIntent).
 * Fetches method details from Stripe and stores locally.
 */
async function savePaymentMethod(clientId: number, stripePaymentMethodId: string): Promise<SavedPaymentMethod> {
  const db = getDatabase();

  // Fetch payment method details from Stripe
  const pm = await stripeRequest(`/payment_methods/${stripePaymentMethodId}`);
  const card = pm.card as { brand?: string; last4?: string; exp_month?: number; exp_year?: number } | undefined;

  // Check if already saved
  const existing = (await db.get(
    'SELECT id FROM client_payment_methods WHERE client_id = ? AND stripe_payment_method_id = ?',
    [clientId, stripePaymentMethodId]
  )) as { id: number } | undefined;

  if (existing) {
    const row = (await db.get(
      'SELECT * FROM client_payment_methods WHERE id = ?',
      [existing.id]
    )) as SavedPaymentMethodRow;
    return mapPaymentMethodRow(row);
  }

  // Check if this is the first method (make it default)
  const count = (await db.get(
    'SELECT COUNT(*) as count FROM client_payment_methods WHERE client_id = ?',
    [clientId]
  )) as { count: number };
  const isDefault = count.count === 0 ? 1 : 0;

  const result = await db.run(
    `INSERT INTO client_payment_methods
     (client_id, stripe_payment_method_id, type, brand, last_four, exp_month, exp_year, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      clientId,
      stripePaymentMethodId,
      (pm.type as string) || 'card',
      card?.brand || null,
      card?.last4 || null,
      card?.exp_month || null,
      card?.exp_year || null,
      isDefault
    ]
  );

  // If default, also update client's auto_pay_default_method_id
  if (isDefault) {
    await db.run(
      'UPDATE clients SET auto_pay_default_method_id = ? WHERE id = ?',
      [result.lastID, clientId]
    );
  }

  logger.info('Saved payment method', {
    category: 'payments',
    metadata: { clientId, paymentMethodId: result.lastID, brand: card?.brand, lastFour: card?.last4 }
  });

  const row = (await db.get(
    'SELECT * FROM client_payment_methods WHERE id = ?',
    [result.lastID]
  )) as SavedPaymentMethodRow;
  return mapPaymentMethodRow(row);
}

/**
 * Set a payment method as the default for a client.
 */
async function setDefaultPaymentMethod(clientId: number, paymentMethodId: number): Promise<void> {
  const db = getDatabase();

  // Unset all defaults for this client
  await db.run(
    'UPDATE client_payment_methods SET is_default = 0 WHERE client_id = ?',
    [clientId]
  );

  // Set the new default
  await db.run(
    'UPDATE client_payment_methods SET is_default = 1 WHERE id = ? AND client_id = ?',
    [paymentMethodId, clientId]
  );

  // Update client record
  await db.run(
    'UPDATE clients SET auto_pay_default_method_id = ? WHERE id = ?',
    [paymentMethodId, clientId]
  );
}

/**
 * Remove a saved payment method.
 */
async function removePaymentMethod(clientId: number, paymentMethodId: number): Promise<void> {
  const db = getDatabase();

  const method = (await db.get(
    'SELECT * FROM client_payment_methods WHERE id = ? AND client_id = ?',
    [paymentMethodId, clientId]
  )) as SavedPaymentMethodRow | undefined;

  if (!method) throw new Error('Payment method not found');

  // Detach from Stripe customer
  try {
    await stripeRequest(`/payment_methods/${method.stripe_payment_method_id}/detach`, 'POST', new URLSearchParams());
  } catch {
    // May already be detached — continue
  }

  await db.run('DELETE FROM client_payment_methods WHERE id = ?', [paymentMethodId]);

  // If it was the default, clear auto_pay_default_method_id
  if (method.is_default) {
    // Set next available as default, or clear
    const next = (await db.get(
      'SELECT id FROM client_payment_methods WHERE client_id = ? ORDER BY created_at DESC LIMIT 1',
      [clientId]
    )) as { id: number } | undefined;

    await db.run(
      'UPDATE clients SET auto_pay_default_method_id = ? WHERE id = ?',
      [next?.id || null, clientId]
    );

    if (next) {
      await db.run(
        'UPDATE client_payment_methods SET is_default = 1 WHERE id = ?',
        [next.id]
      );
    }
  }

  logger.info('Removed payment method', {
    category: 'payments',
    metadata: { clientId, paymentMethodId }
  });
}

// ============================================
// Auto-Pay Enrollment
// ============================================

/**
 * Enable/disable auto-pay for a client.
 */
async function setAutoPay(clientId: number, enabled: boolean): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE clients SET auto_pay_enabled = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [enabled ? 1 : 0, clientId]
  );

  logger.info(`Auto-pay ${enabled ? 'enabled' : 'disabled'}`, {
    category: 'payments',
    metadata: { clientId }
  });
}

/**
 * Get auto-pay status for a client.
 */
async function getAutoPayStatus(clientId: number): Promise<{
  enabled: boolean;
  defaultMethod: SavedPaymentMethod | null;
  methodCount: number;
}> {
  const db = getDatabase();

  const client = (await db.get(
    'SELECT auto_pay_enabled, auto_pay_default_method_id FROM clients WHERE id = ?',
    [clientId]
  )) as { auto_pay_enabled: number; auto_pay_default_method_id: number | null } | undefined;

  if (!client) throw new Error('Client not found');

  let defaultMethod: SavedPaymentMethod | null = null;
  if (client.auto_pay_default_method_id) {
    const row = (await db.get(
      'SELECT * FROM client_payment_methods WHERE id = ?',
      [client.auto_pay_default_method_id]
    )) as SavedPaymentMethodRow | undefined;
    if (row) defaultMethod = mapPaymentMethodRow(row);
  }

  const count = (await db.get(
    'SELECT COUNT(*) as count FROM client_payment_methods WHERE client_id = ?',
    [clientId]
  )) as { count: number };

  return {
    enabled: client.auto_pay_enabled === 1,
    defaultMethod,
    methodCount: count.count
  };
}

// ============================================
// Auto-Pay Processing (Cron)
// ============================================

/**
 * Create a Stripe SetupIntent so a client can save a card without charging.
 */
async function createSetupIntent(clientId: number): Promise<{ clientSecret: string }> {
  // Get or create Stripe customer
  const { stripePaymentService } = await import('./stripe-payment-service.js');
  const customerId = await stripePaymentService.getOrCreateCustomer(clientId);

  const params = new URLSearchParams();
  params.append('customer', customerId);
  params.append('automatic_payment_methods[enabled]', 'true');
  params.append('metadata[client_id]', String(clientId));

  const intent = await stripeRequest('/setup_intents', 'POST', params);
  return { clientSecret: intent.client_secret as string };
}

/**
 * Charge a single invoice using a saved payment method.
 * Used by both auto-pay cron and manual retry.
 */
async function chargeInvoice(
  invoiceId: number,
  clientId: number,
  paymentMethodId: number
): Promise<{ success: boolean; intentId?: string; error?: string }> {
  const db = getDatabase();

  const method = (await db.get(
    'SELECT * FROM client_payment_methods WHERE id = ? AND client_id = ?',
    [paymentMethodId, clientId]
  )) as SavedPaymentMethodRow | undefined;

  if (!method) return { success: false, error: 'Payment method not found' };

  const invoice = (await db.get(
    'SELECT id, total_amount, status FROM invoices WHERE id = ? AND deleted_at IS NULL',
    [invoiceId]
  )) as { id: number; total_amount: number; status: string } | undefined;

  if (!invoice) return { success: false, error: 'Invoice not found' };
  if (['paid', 'cancelled', 'void'].includes(invoice.status)) {
    return { success: false, error: `Invoice is already ${invoice.status}` };
  }

  const amountCents = Math.round(invoice.total_amount * 100);
  if (amountCents <= 0) return { success: false, error: 'Amount must be positive' };

  const { totalCents, feeCents } = calculateAmountWithProcessingFee(amountCents);

  // Get Stripe customer
  const { stripePaymentService } = await import('./stripe-payment-service.js');
  const customerId = await stripePaymentService.getOrCreateCustomer(clientId);

  try {
    // Create and confirm PaymentIntent in one step (off-session)
    const params = new URLSearchParams();
    params.append('amount', String(totalCents));
    params.append('currency', 'usd');
    params.append('customer', customerId);
    params.append('payment_method', method.stripe_payment_method_id);
    params.append('off_session', 'true');
    params.append('confirm', 'true');
    params.append('metadata[client_id]', String(clientId));
    params.append('metadata[invoice_id]', String(invoiceId));
    params.append('metadata[auto_pay]', 'true');
    params.append('metadata[base_amount_cents]', String(amountCents));
    params.append('metadata[processing_fee_cents]', String(feeCents));

    const intent = await stripeRequest('/payment_intents', 'POST', params);
    const intentId = intent.id as string;
    const status = intent.status as string;

    // Record in our database
    await db.run(
      `INSERT INTO stripe_payment_intents
       (stripe_intent_id, client_id, invoice_id, amount_cents, currency, status, payment_method_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'usd', ?, ?, ?, datetime('now'), datetime('now'))`,
      [intentId, clientId, invoiceId, totalCents, status, paymentMethodId,
        JSON.stringify({ customerId, baseCents: amountCents, feeCents, autoPay: true })]
    );

    if (status === 'succeeded') {
      // Mark invoice as paid immediately
      await stripePaymentService.handlePaymentSuccess(intentId);
      return { success: true, intentId };
    }

    // Payment requires additional action or is processing
    return { success: false, intentId, error: `Payment status: ${status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Process auto-pay for all due invoices.
 * Called by the scheduler cron job.
 */
async function processAutoPay(): Promise<AutoPayResult> {
  const db = getDatabase();
  let charged = 0;
  let failed = 0;
  let retried = 0;
  let skipped = 0;

  // 1. Find clients with auto-pay enabled and a default payment method
  const clients = (await db.all(
    `SELECT c.id, c.auto_pay_default_method_id
     FROM clients c
     WHERE c.auto_pay_enabled = 1
       AND c.auto_pay_default_method_id IS NOT NULL
       AND c.deleted_at IS NULL`
  )) as Array<{ id: number; auto_pay_default_method_id: number }>;

  for (const client of clients) {
    // 2. Find unpaid invoices for this client
    const invoices = (await db.all(
      `SELECT i.id, i.total_amount
       FROM invoices i
       JOIN projects p ON i.project_id = p.id
       WHERE p.client_id = ?
         AND i.status IN ('sent', 'overdue')
         AND i.deleted_at IS NULL
         AND i.due_date <= date('now')
         AND i.id NOT IN (
           SELECT invoice_id FROM auto_pay_attempts
           WHERE status IN ('processing', 'succeeded')
         )
       ORDER BY i.due_date ASC`,
      [client.id]
    )) as Array<{ id: number; total_amount: number }>;

    for (const invoice of invoices) {
      // Check if we already have exhausted attempts
      const existing = (await db.get(
        'SELECT id, attempt_number, status FROM auto_pay_attempts WHERE invoice_id = ? ORDER BY created_at DESC LIMIT 1',
        [invoice.id]
      )) as AutoPayAttemptRow | undefined;

      if (existing?.status === 'exhausted' || existing?.status === 'succeeded') {
        skipped++;
        continue;
      }

      const attemptNumber = existing ? existing.attempt_number + 1 : 1;

      if (attemptNumber > MAX_AUTO_PAY_RETRIES) {
        // Mark as exhausted
        if (existing) {
          await db.run(
            'UPDATE auto_pay_attempts SET status = \'exhausted\', updated_at = datetime(\'now\') WHERE id = ?',
            [existing.id]
          );
        }
        skipped++;
        continue;
      }

      // 3. Attempt charge
      const result = await chargeInvoice(invoice.id, client.id, client.auto_pay_default_method_id);

      // Record attempt
      const nextRetryHours = RETRY_DELAY_HOURS[attemptNumber - 1] || RETRY_DELAY_HOURS[RETRY_DELAY_HOURS.length - 1];
      const nextRetryAt = result.success ? null : new Date(Date.now() + nextRetryHours * 60 * 60 * 1000).toISOString();

      await db.run(
        `INSERT INTO auto_pay_attempts
         (client_id, invoice_id, payment_method_id, attempt_number, status, stripe_intent_id, failure_reason, next_retry_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          client.id,
          invoice.id,
          client.auto_pay_default_method_id,
          attemptNumber,
          result.success ? 'succeeded' : 'failed',
          result.intentId || null,
          result.error || null,
          nextRetryAt
        ]
      );

      if (result.success) {
        charged++;
        logger.info('Auto-pay charge succeeded', {
          category: 'payments',
          metadata: { clientId: client.id, invoiceId: invoice.id, intentId: result.intentId }
        });
      } else {
        failed++;
        if (attemptNumber > 1) retried++;
        logger.warn('Auto-pay charge failed', {
          category: 'payments',
          metadata: { clientId: client.id, invoiceId: invoice.id, error: result.error, attempt: attemptNumber }
        });

        // Send failure notification to client
        try {
          const { emailService } = await import('./email-service.js');
          const { BUSINESS_INFO } = await import('../config/business.js');

          const clientRow = (await db.get(
            'SELECT email, COALESCE(contact_name, company_name) as name FROM clients WHERE id = ?',
            [client.id]
          )) as { email: string; name: string } | undefined;

          if (clientRow) {
            await emailService.sendEmail({
              to: clientRow.email,
              subject: `Payment failed for invoice - ${BUSINESS_INFO.name}`,
              text: `Hi ${clientRow.name},\n\nWe were unable to process your automatic payment. ${attemptNumber < MAX_AUTO_PAY_RETRIES ? `We'll retry in ${nextRetryHours} hours.` : 'Please update your payment method.'}\n\nBest regards,\n${BUSINESS_INFO.name}`,
              html: `<p>Hi ${clientRow.name},</p><p>We were unable to process your automatic payment.</p><p>${attemptNumber < MAX_AUTO_PAY_RETRIES ? `We'll retry in ${nextRetryHours} hours.` : 'Please update your payment method in your portal.'}</p><p>Best regards,<br>${BUSINESS_INFO.name}</p>`
            });
          }
        } catch {
          // Non-critical
        }
      }
    }
  }

  if (charged > 0 || failed > 0) {
    logger.info('Auto-pay processing complete', {
      category: 'payments',
      metadata: { charged, failed, retried, skipped }
    });
  }

  return { charged, failed, retried, skipped };
}

/**
 * Process retry queue — retries failed auto-pay attempts whose next_retry_at has passed.
 * Called by the scheduler cron job (every hour).
 */
async function processRetryQueue(): Promise<{ retried: number; succeeded: number; failed: number }> {
  const db = getDatabase();
  let retriedCount = 0;
  let succeeded = 0;
  let failedCount = 0;

  const pendingRetries = (await db.all(
    `SELECT apa.*, c.auto_pay_default_method_id
     FROM auto_pay_attempts apa
     JOIN clients c ON apa.client_id = c.id
     WHERE apa.status = 'failed'
       AND apa.next_retry_at IS NOT NULL
       AND apa.next_retry_at <= datetime('now')
       AND apa.attempt_number < ?
     ORDER BY apa.next_retry_at ASC
     LIMIT 50`,
    [MAX_AUTO_PAY_RETRIES]
  )) as Array<AutoPayAttemptRow & { auto_pay_default_method_id: number }>;

  for (const attempt of pendingRetries) {
    const methodId = attempt.auto_pay_default_method_id || attempt.payment_method_id;
    const result = await chargeInvoice(attempt.invoice_id, attempt.client_id, methodId);
    retriedCount++;

    const nextAttempt = attempt.attempt_number + 1;
    const nextRetryHours = RETRY_DELAY_HOURS[nextAttempt - 1] || RETRY_DELAY_HOURS[RETRY_DELAY_HOURS.length - 1];
    const nextRetryAt = result.success ? null : new Date(Date.now() + nextRetryHours * 60 * 60 * 1000).toISOString();
    const newStatus = result.success ? 'succeeded' : (nextAttempt >= MAX_AUTO_PAY_RETRIES ? 'exhausted' : 'failed');

    await db.run(
      `INSERT INTO auto_pay_attempts
       (client_id, invoice_id, payment_method_id, attempt_number, status, stripe_intent_id, failure_reason, next_retry_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        attempt.client_id,
        attempt.invoice_id,
        methodId,
        nextAttempt,
        newStatus,
        result.intentId || null,
        result.error || null,
        nextRetryAt
      ]
    );

    if (result.success) succeeded++;
    else failedCount++;
  }

  return { retried: retriedCount, succeeded, failed: failedCount };
}

// ============================================
// Singleton Export
// ============================================

export const autoPayService = {
  listPaymentMethods,
  savePaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  setAutoPay,
  getAutoPayStatus,
  createSetupIntent,
  chargeInvoice,
  processAutoPay,
  processRetryQueue
};
