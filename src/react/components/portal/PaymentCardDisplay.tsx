/**
 * ===============================================
 * PAYMENT CARD DISPLAY
 * ===============================================
 * @file src/react/components/portal/PaymentCardDisplay.tsx
 *
 * Shared component for rendering a saved payment card's
 * brand and last-four digits with optional expiration.
 * Extracts BRAND_LABELS and formatExpiration from
 * AutoPaySettings for reuse across the codebase.
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';

// ============================================
// CONSTANTS (exported for reuse)
// ============================================

export const BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay'
};

// ============================================
// HELPERS (exported for reuse)
// ============================================

/**
 * Resolve a Stripe card brand key to its display label.
 */
export function getBrandLabel(brand: string | null | undefined): string {
  if (!brand) return 'Card';
  return BRAND_LABELS[brand.toLowerCase()] ?? brand;
}

/**
 * Format card expiration month/year into MM/YY.
 */
export function formatExpiration(
  month: number | null | undefined,
  year: number | null | undefined
): string {
  if (month === null || month === undefined || year === null || year === undefined) return '--';
  const paddedMonth = String(month).padStart(2, '0');
  const shortYear = String(year).slice(-2);
  return `${paddedMonth}/${shortYear}`;
}

// ============================================
// COMPONENT
// ============================================

export interface PaymentCardDisplayProps {
  /** Stripe card brand key (e.g. "visa", "mastercard") */
  brand: string | null | undefined;
  /** Last four digits of the card */
  lastFour: string | null | undefined;
  /** Expiration month (1-12) */
  expMonth?: number | null;
  /** Expiration year (e.g. 2027) */
  expYear?: number | null;
  /** Whether to show the expiry line */
  showExpiry?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Renders a payment card summary: brand, last four, and optional expiry.
 */
export function PaymentCardDisplay({
  brand,
  lastFour,
  expMonth,
  expYear,
  showExpiry = false,
  className
}: PaymentCardDisplayProps) {
  return (
    <span className={cn('payment-card-display', className)}>
      <span className="font-semibold">{getBrandLabel(brand)}</span>
      {' '}ending in {lastFour ?? '----'}
      {showExpiry && (
        <span className="text-muted text-sm">
          {' '}(exp {formatExpiration(expMonth, expYear)})
        </span>
      )}
    </span>
  );
}
