-- Migration 137: Align invoices/invoice_payments schema with Stripe handlers
--
-- The embedded-payment success handler (server/services/stripe-payment-service.ts
-- handlePaymentSuccess) and the checkout-session payment writer
-- (server/services/integrations/stripe-service.ts) both write columns that
-- never existed in the schema. As a result every successful Stripe webhook
-- has been throwing "no such column" inside the transaction, the handler
-- catches and re-throws so the route returns 500, Stripe retries forever,
-- and the invoice never flips to 'paid'. The analytics insights query in
-- server/services/analytics/insights.ts also reads invoices.paid_at, which
-- has been a hidden error path the same way.
--
-- This migration adds the columns the handlers expect, with sensible
-- defaults / backfills so legacy rows stay correct:
--
--   invoices.paid_at                       (timestamp the invoice flipped paid)
--   invoices.stripe_payment_intent_id      (latest succeeded intent for lookup)
--   invoice_payments.status                (succeeded / failed / refunded)
--   invoice_payments.paid_at               (timestamp of the payment)
--   invoice_payments.stripe_payment_intent_id
--   invoice_payments.stripe_checkout_session_id
--
-- All columns are nullable except invoice_payments.status, which defaults
-- to 'succeeded' — the legacy insertion path (recordPaymentWithHistory)
-- only fired after a confirmed payment, so backfilling existing rows as
-- 'succeeded' matches reality.

ALTER TABLE invoices ADD COLUMN paid_at DATETIME;
ALTER TABLE invoices ADD COLUMN stripe_payment_intent_id TEXT;

ALTER TABLE invoice_payments ADD COLUMN status TEXT NOT NULL DEFAULT 'succeeded';
ALTER TABLE invoice_payments ADD COLUMN paid_at DATETIME;
ALTER TABLE invoice_payments ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE invoice_payments ADD COLUMN stripe_checkout_session_id TEXT;

-- Backfill paid_at on legacy invoice_payments rows from created_at so
-- analytics that look at payment timing keep working without a NULL gap.
UPDATE invoice_payments
   SET paid_at = created_at
 WHERE paid_at IS NULL;

-- Backfill paid_at on already-paid invoices from paid_date (DATE) so the
-- new TIMESTAMP column is populated for historical rows.
UPDATE invoices
   SET paid_at = paid_date
 WHERE status = 'paid'
   AND paid_at IS NULL
   AND paid_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_intent
  ON invoices(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_stripe_intent
  ON invoice_payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_stripe_session
  ON invoice_payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_status
  ON invoice_payments(status);
