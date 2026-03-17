/**
 * ===============================================
 * PAYMENT TYPES
 * ===============================================
 * @file src/react/features/portal/payments/types.ts
 */

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

export interface StripePaymentFormProps {
  invoiceId?: number;
  installmentId?: number;
  /** Amount in cents for display */
  amountCents: number;
  currency?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
  getAuthToken?: () => string | null;
}
