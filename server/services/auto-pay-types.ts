/**
 * ===============================================
 * AUTO-PAY TYPES
 * ===============================================
 * @file server/services/auto-pay-types.ts
 *
 * Type definitions for auto-pay and saved payment methods.
 */

// ============================================
// Saved Payment Methods
// ============================================

export interface SavedPaymentMethod {
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

export interface SavedPaymentMethodRow {
  id: number;
  client_id: number;
  stripe_payment_method_id: string;
  type: string;
  brand: string | null;
  last_four: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: number;
  created_at: string;
}

// ============================================
// Auto-Pay
// ============================================

export interface AutoPayAttemptRow {
  id: number;
  client_id: number;
  invoice_id: number;
  payment_method_id: number;
  attempt_number: number;
  status: string;
  stripe_intent_id: string | null;
  failure_reason: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoPayResult {
  charged: number;
  failed: number;
  retried: number;
  skipped: number;
}

// ============================================
// Constants
// ============================================

/** Maximum retry attempts before marking as exhausted */
export const MAX_AUTO_PAY_RETRIES = 3;

/** Hours between retry attempts: [1st retry, 2nd retry, 3rd retry] */
export const RETRY_DELAY_HOURS = [24, 48, 72];
