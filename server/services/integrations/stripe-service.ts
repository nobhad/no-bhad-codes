/**
 * ===============================================
 * STRIPE PAYMENT INTEGRATION SERVICE
 * ===============================================
 * @file server/services/integrations/stripe-service.ts
 *
 * Provides Stripe payment link generation and
 * webhook handling for invoice payments.
 *
 * SETUP REQUIRED:
 * 1. Set STRIPE_SECRET_KEY in environment variables
 * 2. Set STRIPE_WEBHOOK_SECRET for webhook verification
 * 3. Configure webhook endpoint in Stripe Dashboard
 */

import { getDatabase } from '../../database/init';

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_API_VERSION = '2023-10-16';
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

// Payment link configuration
export interface PaymentLinkConfig {
  invoiceId: number;
  amount: number; // in cents
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

// Payment link response
export interface PaymentLinkResponse {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
}

// Stripe webhook event
export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
  created: number;
}

// Invoice payment record
export interface InvoicePayment {
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paidAt?: string;
  metadata?: Record<string, unknown>;
}

// Database invoice row type
interface InvoiceRow {
  id: number;
  invoice_number: string;
  client_id: number;
  client_name?: string;
  client_email?: string;
  total_amount: number;
  status: string;
}

// Database payment link row type
interface PaymentLinkRow {
  id: number;
  invoice_id: number;
  stripe_session_id: string;
  payment_url: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return Boolean(STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith('sk_'));
}

/**
 * Create a Stripe Checkout Session for invoice payment
 */
export async function createPaymentLink(config: PaymentLinkConfig): Promise<PaymentLinkResponse | null> {
  if (!isStripeConfigured()) {
    console.warn('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    return null;
  }

  const db = getDatabase();

  // Get invoice details
  const invoice = await db.get(
    'SELECT i.*, c.name as client_name, c.email as client_email FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ?',
    [config.invoiceId]
  ) as InvoiceRow | undefined;

  if (!invoice) {
    throw new Error(`Invoice ${config.invoiceId} not found`);
  }

  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  try {
    // Create Checkout Session via Stripe API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('payment_method_types[]', 'card');
    params.append('line_items[0][price_data][currency]', config.currency || 'usd');
    params.append('line_items[0][price_data][product_data][name]', config.description || `Invoice #${invoice.invoice_number}`);
    params.append('line_items[0][price_data][unit_amount]', String(config.amount));
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', config.successUrl || `${baseUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', config.cancelUrl || `${baseUrl}/payment-cancelled`);

    if (config.customerEmail || invoice.client_email) {
      params.append('customer_email', config.customerEmail || invoice.client_email || '');
    }

    // Add metadata for webhook handling
    params.append('metadata[invoice_id]', String(config.invoiceId));
    params.append('metadata[invoice_number]', invoice.invoice_number || '');
    params.append('metadata[client_id]', String(invoice.client_id));

    if (config.metadata) {
      for (const [key, value] of Object.entries(config.metadata)) {
        params.append(`metadata[${key}]`, value);
      }
    }

    const response = await fetch(`${STRIPE_API_BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION
      },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API error: ${error.error?.message || response.statusText}`);
    }

    const session = await response.json();

    // Store payment link in database
    await db.run(
      `UPDATE invoices
       SET stripe_checkout_session_id = ?, stripe_payment_url = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [session.id, session.url, config.invoiceId]
    );

    // Log the payment link creation
    await db.run(
      `INSERT INTO invoice_payment_links (invoice_id, stripe_session_id, payment_url, amount, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))`,
      [config.invoiceId, session.id, session.url, config.amount, config.currency || 'usd']
    );

    return {
      id: session.id,
      url: session.url,
      amount: config.amount,
      currency: config.currency || 'usd',
      status: session.status,
      created: session.created
    };
  } catch (error) {
    console.error('Failed to create Stripe payment link:', error);
    throw error;
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('Stripe webhook secret not configured');
    return false;
  }

  try {
    // Parse the signature header
    const elements = signature.split(',');
    const signatureMap: Record<string, string> = {};

    for (const element of elements) {
      const [key, value] = element.split('=');
      signatureMap[key] = value;
    }

    const timestamp = signatureMap['t'];
    const v1Signature = signatureMap['v1'];

    if (!timestamp || !v1Signature) {
      return false;
    }

    // Check timestamp is within tolerance (5 minutes)
    const timestampSeconds = parseInt(timestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(currentSeconds - timestampSeconds) > 300) {
      console.warn('Stripe webhook timestamp outside tolerance');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
      .update(signedPayload)
      .digest('hex');

    // Compare signatures (timing-safe)
    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return false;
  }
}

/**
 * Handle Stripe webhook event
 */
export async function handleWebhookEvent(event: StripeWebhookEvent): Promise<void> {
  const db = getDatabase();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const metadata = (session as { metadata?: { invoice_id?: string } }).metadata;
      const invoiceId = metadata?.invoice_id;

      if (invoiceId) {
        const sessionData = session as { payment_intent?: string; amount_total?: number; id?: string };
        // Update invoice status to paid
        await db.run(
          `UPDATE invoices
           SET status = 'paid', paid_at = datetime('now'), payment_method = 'stripe',
               stripe_payment_intent_id = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [sessionData.payment_intent || '', invoiceId]
        );

        // Record the payment
        await recordPayment({
          invoiceId: parseInt(invoiceId, 10),
          amount: ((sessionData.amount_total as number) || 0) / 100, // Convert from cents
          paymentMethod: 'stripe',
          stripePaymentIntentId: sessionData.payment_intent || '',
          stripeCheckoutSessionId: sessionData.id || '',
          status: 'succeeded',
          paidAt: new Date().toISOString()
        });

        // Update payment link status
        await db.run(
          `UPDATE invoice_payment_links SET status = 'completed', completed_at = datetime('now') WHERE stripe_session_id = ?`,
          [sessionData.id || '']
        );

        console.log(`Invoice ${invoiceId} marked as paid via Stripe`);
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      const metadata = (session as { metadata?: { invoice_id?: string } }).metadata;
      const invoiceId = metadata?.invoice_id;

      if (invoiceId) {
        const sessionData = session as { id?: string };
        // Update payment link status
        await db.run(
          `UPDATE invoice_payment_links SET status = 'expired' WHERE stripe_session_id = ?`,
          [sessionData.id || '']
        );
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      const metadata = (paymentIntent as { metadata?: { invoice_id?: string } }).metadata;
      const invoiceId = metadata?.invoice_id;

      if (invoiceId) {
        const piData = paymentIntent as { id?: string; last_payment_error?: { message?: string } };
        // Log failed payment attempt
        await db.run(
          `INSERT INTO invoice_payment_attempts (invoice_id, stripe_payment_intent_id, status, error_message, created_at)
           VALUES (?, ?, 'failed', ?, datetime('now'))`,
          [invoiceId, piData.id || '', piData.last_payment_error?.message || 'Payment failed']
        );
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as { payment_intent?: string; amount_refunded?: number; amount?: number };
      const paymentIntentId = charge.payment_intent;

      if (paymentIntentId) {
        // Find invoice by payment intent and update status
        const invoice = await db.get(
          'SELECT id FROM invoices WHERE stripe_payment_intent_id = ?',
          [paymentIntentId]
        ) as { id: number } | undefined;

        if (invoice) {
          const refundAmount = ((charge.amount_refunded as number) || 0) / 100;
          const totalAmount = ((charge.amount as number) || 0) / 100;

          // Update invoice status based on refund amount
          const newStatus = refundAmount >= totalAmount ? 'refunded' : 'partial_refund';

          await db.run(
            `UPDATE invoices SET status = ?, refund_amount = ?, updated_at = datetime('now') WHERE id = ?`,
            [newStatus, refundAmount, invoice.id]
          );
        }
      }
      break;
    }

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }
}

/**
 * Record a payment for an invoice
 */
async function recordPayment(payment: InvoicePayment): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT INTO invoice_payments (invoice_id, amount, payment_method, stripe_payment_intent_id, stripe_checkout_session_id, status, paid_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      payment.invoiceId,
      payment.amount,
      payment.paymentMethod,
      payment.stripePaymentIntentId || null,
      payment.stripeCheckoutSessionId || null,
      payment.status,
      payment.paidAt || null
    ]
  );
}

/**
 * Get payment link for invoice
 */
export async function getPaymentLink(invoiceId: number): Promise<PaymentLinkResponse | null> {
  const db = getDatabase();

  const link = await db.get(
    `SELECT * FROM invoice_payment_links WHERE invoice_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [invoiceId]
  ) as PaymentLinkRow | undefined;

  if (!link) {
    return null;
  }

  return {
    id: link.stripe_session_id,
    url: link.payment_url,
    amount: link.amount,
    currency: link.currency,
    status: link.status,
    created: new Date(link.created_at).getTime() / 1000
  };
}

/**
 * Expire a payment link
 */
export async function expirePaymentLink(invoiceId: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    `UPDATE invoice_payment_links SET status = 'cancelled' WHERE invoice_id = ? AND status = 'active'`,
    [invoiceId]
  );
}

/**
 * Get Stripe configuration status
 */
export function getStripeStatus(): {
  configured: boolean;
  mode: 'live' | 'test' | 'not_configured';
  webhookConfigured: boolean;
} {
  if (!STRIPE_SECRET_KEY) {
    return {
      configured: false,
      mode: 'not_configured',
      webhookConfigured: false
    };
  }

  return {
    configured: true,
    mode: STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test',
    webhookConfigured: Boolean(STRIPE_WEBHOOK_SECRET)
  };
}

/**
 * Generate invoice payment URL (for email/sharing)
 */
export async function getOrCreatePaymentUrl(invoiceId: number): Promise<string | null> {
  // Check for existing active payment link
  const existingLink = await getPaymentLink(invoiceId);
  if (existingLink) {
    return existingLink.url;
  }

  // Get invoice to create new link
  const db = getDatabase();
  const invoice = await db.get('SELECT * FROM invoices WHERE id = ?', [invoiceId]) as InvoiceRow | undefined;

  if (!invoice) {
    return null;
  }

  // Only create payment links for sent/pending invoices
  if (!['sent', 'pending', 'overdue'].includes(invoice.status)) {
    return null;
  }

  // Create new payment link
  const link = await createPaymentLink({
    invoiceId,
    amount: Math.round(invoice.total_amount * 100), // Convert to cents
    description: `Invoice #${invoice.invoice_number}`,
    customerEmail: invoice.client_email || undefined
  });

  return link?.url ?? null;
}

export default {
  isStripeConfigured,
  createPaymentLink,
  verifyWebhookSignature,
  handleWebhookEvent,
  getPaymentLink,
  expirePaymentLink,
  getStripeStatus,
  getOrCreatePaymentUrl
};
