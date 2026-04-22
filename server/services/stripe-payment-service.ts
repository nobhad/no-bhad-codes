/**
 * ===============================================
 * STRIPE PAYMENT SERVICE
 * ===============================================
 * @file server/services/stripe-payment-service.ts
 *
 * Manages embedded Stripe Elements payment flow:
 * - Customer creation/retrieval
 * - PaymentIntent creation for invoices and installments
 * - Payment success/failure handling
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import { calculateAmountWithProcessingFee } from '../config/constants.js';
import type {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  ClientRow,
  PayableInvoiceRow,
  PayableInstallmentRow,
  StripePaymentIntentRow
} from './stripe-payment-types.js';

// ============================================
// Constants
// ============================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2023-10-16';
const DEFAULT_CURRENCY = 'usd';

// ============================================
// Helpers
// ============================================

function requireStripeKey(): string {
  if (!STRIPE_SECRET_KEY || !STRIPE_SECRET_KEY.startsWith('sk_')) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return STRIPE_SECRET_KEY;
}

async function stripePost(
  endpoint: string,
  params: URLSearchParams
): Promise<Record<string, unknown>> {
  const key = requireStripeKey();
  const response = await fetch(`${STRIPE_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION
    },
    body: params.toString()
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new Error(`Stripe API error: ${error?.message || response.statusText}`);
  }

  return data;
}

// ============================================
// Customer Management
// ============================================

/**
 * Get or create a Stripe Customer for a client.
 * Caches the stripe_customer_id on the clients table.
 */
async function getOrCreateCustomer(clientId: number): Promise<string> {
  const db = getDatabase();

  const client = (await db.get(
    'SELECT id, email, contact_name, company_name, stripe_customer_id FROM clients WHERE id = ?',
    [clientId]
  )) as ClientRow | undefined;

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  // Return existing Stripe customer if we have one
  if (client.stripe_customer_id) {
    return client.stripe_customer_id;
  }

  // Create a new Stripe customer
  const params = new URLSearchParams();
  params.append('email', client.email);
  if (client.contact_name) {
    params.append('name', client.contact_name);
  }
  params.append('metadata[client_id]', String(clientId));

  const customer = await stripePost('/customers', params);
  const customerId = customer.id as string;

  // Cache on clients table
  await db.run(
    'UPDATE clients SET stripe_customer_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [customerId, clientId]
  );

  logger.info('Created Stripe customer', {
    category: 'payments',
    metadata: { clientId, customerId }
  });

  return customerId;
}

// ============================================
// PaymentIntent
// ============================================

/**
 * Create a PaymentIntent for an invoice or installment.
 * Returns the clientSecret needed by Stripe Elements on the frontend.
 */
async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const { clientId, invoiceId, installmentId } = params;
  const db = getDatabase();

  // Resolve amount from invoice or installment
  let amountCents: number;
  const currency = DEFAULT_CURRENCY;

  if (invoiceId) {
    const invoice = (await db.get(
      'SELECT id, total_amount, status, client_id FROM invoices WHERE id = ?',
      [invoiceId]
    )) as PayableInvoiceRow | undefined;

    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
    if (invoice.client_id !== clientId) throw new Error('Invoice does not belong to this client');
    if (['paid', 'cancelled', 'void'].includes(invoice.status)) {
      throw new Error(`Invoice is already ${invoice.status}`);
    }

    amountCents = Math.round(invoice.total_amount * 100);
  } else if (installmentId) {
    const installment = (await db.get(
      'SELECT id, amount, status, client_id, project_id FROM payment_schedule WHERE id = ?',
      [installmentId]
    )) as PayableInstallmentRow | undefined;

    if (!installment) throw new Error(`Installment ${installmentId} not found`);
    if (installment.client_id !== clientId) throw new Error('Installment does not belong to this client');
    if (installment.status === 'paid') throw new Error('Installment is already paid');

    amountCents = Math.round(installment.amount * 100);
  } else {
    throw new Error('Either invoiceId or installmentId is required');
  }

  if (amountCents <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  // Add processing fee — client is responsible for Stripe fees
  const { totalCents, feeCents } = calculateAmountWithProcessingFee(amountCents);

  // Get or create Stripe customer
  const customerId = await getOrCreateCustomer(clientId);

  // Create PaymentIntent via Stripe API (charges total including fee)
  const stripeParams = new URLSearchParams();
  stripeParams.append('amount', String(totalCents));
  stripeParams.append('currency', currency);
  stripeParams.append('customer', customerId);
  stripeParams.append('automatic_payment_methods[enabled]', 'true');
  stripeParams.append('metadata[client_id]', String(clientId));
  stripeParams.append('metadata[base_amount_cents]', String(amountCents));
  stripeParams.append('metadata[processing_fee_cents]', String(feeCents));

  if (invoiceId) {
    stripeParams.append('metadata[invoice_id]', String(invoiceId));
  }
  if (installmentId) {
    stripeParams.append('metadata[installment_id]', String(installmentId));
  }

  const intent = await stripePost('/payment_intents', stripeParams);
  const intentId = intent.id as string;
  const clientSecret = intent.client_secret as string;

  // Record in our database (store the total charged amount)
  await db.run(
    `INSERT INTO stripe_payment_intents
     (stripe_intent_id, client_id, invoice_id, installment_id, amount_cents, currency, status, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'requires_payment_method', ?, datetime('now'), datetime('now'))`,
    [
      intentId,
      clientId,
      invoiceId || null,
      installmentId || null,
      totalCents,
      currency,
      JSON.stringify({ customerId, baseCents: amountCents, feeCents })
    ]
  );

  logger.info('Created PaymentIntent', {
    category: 'payments',
    metadata: { clientId, invoiceId, installmentId, intentId, baseCents: amountCents, feeCents, totalCents }
  });

  return {
    clientSecret,
    paymentIntentId: intentId,
    amount: totalCents,
    baseAmount: amountCents,
    processingFee: feeCents,
    currency
  };
}

// ============================================
// Webhook Handlers
// ============================================

/**
 * Handle a successful payment — marks invoice/installment as paid.
 */
async function handlePaymentSuccess(stripeIntentId: string): Promise<void> {
  const db = getDatabase();

  const record = (await db.get(
    'SELECT id, client_id, invoice_id, installment_id, amount_cents FROM stripe_payment_intents WHERE stripe_intent_id = ?',
    [stripeIntentId]
  )) as StripePaymentIntentRow | undefined;

  if (!record) {
    logger.warn('PaymentIntent not found in local DB', {
      category: 'payments',
      metadata: { stripeIntentId }
    });
    return;
  }

  // All financial writes land in one transaction so a crash between
  // "invoice marked paid" and "payment row inserted" can't leave the
  // invoice flagged paid with no corresponding payment record (or the
  // reverse). Failure rolls everything back and Stripe will retry,
  // where the outer idempotency layer kicks in.
  await db.transaction(async (ctx) => {
    await ctx.run(
      'UPDATE stripe_payment_intents SET status = \'succeeded\', updated_at = datetime(\'now\') WHERE stripe_intent_id = ?',
      [stripeIntentId]
    );

    if (record.invoice_id) {
      await ctx.run(
        `UPDATE invoices
         SET status = 'paid', paid_at = datetime('now'), payment_method = 'stripe',
             stripe_payment_intent_id = ?, updated_at = datetime('now')
         WHERE id = ? AND status != 'paid'`,
        [stripeIntentId, record.invoice_id]
      );

      // Defence-in-depth against duplicate delivery: even if the outer webhook
      // idempotency layer fails, we won't insert two succeeded payments for
      // the same PaymentIntent.
      await ctx.run(
        `INSERT INTO invoice_payments
           (invoice_id, amount, payment_method, stripe_payment_intent_id, status, paid_at, created_at)
         SELECT ?, ?, 'stripe', ?, 'succeeded', datetime('now'), datetime('now')
         WHERE NOT EXISTS (
           SELECT 1 FROM invoice_payments
           WHERE stripe_payment_intent_id = ? AND status = 'succeeded'
         )`,
        [
          record.invoice_id,
          record.amount_cents / 100,
          stripeIntentId,
          stripeIntentId
        ]
      );
    }

    if (record.installment_id) {
      await ctx.run(
        `UPDATE payment_schedule
         SET status = 'paid', paid_date = date('now'), payment_method = 'stripe',
             payment_reference = ?, updated_at = datetime('now')
         WHERE id = ? AND status != 'paid'`,
        [stripeIntentId, record.installment_id]
      );
    }
  });

  if (record.invoice_id) {
    logger.info('Invoice marked paid via embedded Stripe payment', {
      category: 'payments',
      metadata: { invoiceId: record.invoice_id, stripeIntentId }
    });
  }
  if (record.installment_id) {
    logger.info('Installment marked paid via embedded Stripe payment', {
      category: 'payments',
      metadata: { installmentId: record.installment_id, stripeIntentId }
    });
  }

  // Emit workflow event for invoice.paid
  try {
    const { workflowTriggerService } = await import('./workflow-trigger-service.js');
    if (record.invoice_id) {
      await workflowTriggerService.emit('invoice.paid', {
        entityId: record.invoice_id,
        triggeredBy: 'stripe-embedded-payment'
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Handle a failed payment.
 */
async function handlePaymentFailure(stripeIntentId: string, reason: string): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE stripe_payment_intents SET status = \'canceled\', failure_reason = ?, updated_at = datetime(\'now\') WHERE stripe_intent_id = ?',
    [reason, stripeIntentId]
  );

  logger.warn('PaymentIntent failed', {
    category: 'payments',
    metadata: { stripeIntentId, reason }
  });
}

// ============================================
// Singleton Export
// ============================================

export const stripePaymentService = {
  getOrCreateCustomer,
  createPaymentIntent,
  handlePaymentSuccess,
  handlePaymentFailure
};
