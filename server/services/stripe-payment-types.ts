/**
 * ===============================================
 * STRIPE PAYMENT TYPES
 * ===============================================
 * @file server/services/stripe-payment-types.ts
 *
 * Type definitions for embedded Stripe payment flow.
 */

// ============================================
// Payment Intent Types
// ============================================

export interface CreatePaymentIntentParams {
  clientId: number;
  invoiceId?: number;
  installmentId?: number;
}

export interface PaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  /** Total charged (base + processing fee) in cents */
  amount: number;
  /** Base amount before fee in cents */
  baseAmount: number;
  /** Processing fee in cents */
  processingFee: number;
  currency: string;
}

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'requires_capture';

// ============================================
// Customer Types
// ============================================

export interface StripeCustomer {
  id: string;
  email: string;
  name: string;
}

// ============================================
// Payment Method Types
// ============================================

export interface ClientPaymentMethod {
  id: number;
  clientId: number;
  stripePaymentMethodId: string;
  type: string;
  brand: string | null;
  lastFour: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
}

// ============================================
// Payment Intent DB Row
// ============================================

export interface StripePaymentIntentRow {
  id: number;
  stripe_intent_id: string;
  client_id: number;
  invoice_id: number | null;
  installment_id: number | null;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method_id: number | null;
  failure_reason: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Invoice/Installment DB Row (minimal)
// ============================================

export interface PayableInvoiceRow {
  id: number;
  total_amount: number;
  status: string;
  client_id: number;
  currency?: string;
}

export interface PayableInstallmentRow {
  id: number;
  amount: number;
  status: string;
  client_id: number;
  project_id: number;
}

// ============================================
// Client DB Row (minimal)
// ============================================

export interface ClientRow {
  id: number;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  stripe_customer_id: string | null;
}
