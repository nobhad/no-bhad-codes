/**
 * ===============================================
 * PAYMENT CONSTANTS (FRONTEND)
 * ===============================================
 * @file src/constants/payments.ts
 *
 * Stripe processing fee configuration.
 * Mirrors server/config/constants.ts — keep in sync.
 */

/** Stripe processing fee percentage (2.9%) */
export const STRIPE_PROCESSING_FEE_PERCENT = 0.029;

/** Stripe per-transaction fixed fee in cents ($0.30) */
export const STRIPE_PROCESSING_FEE_FIXED_CENTS = 30;

/**
 * Calculate the total amount including Stripe processing fees.
 * The client pays this total so the business receives the full base amount.
 *
 * Formula: total = (base + fixedFee) / (1 - percentFee)
 */
export function calculateAmountWithProcessingFee(baseCents: number): {
  totalCents: number;
  feeCents: number;
  baseCents: number;
} {
  const total = Math.ceil(
    (baseCents + STRIPE_PROCESSING_FEE_FIXED_CENTS) / (1 - STRIPE_PROCESSING_FEE_PERCENT)
  );
  return {
    totalCents: total,
    feeCents: total - baseCents,
    baseCents
  };
}

/**
 * Format cents as a human-readable dollar string.
 */
export function formatCentsAsDollars(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(cents / 100);
}
