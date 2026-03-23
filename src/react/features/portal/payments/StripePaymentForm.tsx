/**
 * ===============================================
 * STRIPE PAYMENT FORM
 * ===============================================
 * @file src/react/features/portal/payments/StripePaymentForm.tsx
 *
 * Embedded Stripe PaymentElement form.
 * Creates a PaymentIntent on mount (with processing fee),
 * renders fee breakdown + Stripe card form,
 * and confirms payment on submit.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Loader2, CreditCard, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { usePortalFetch } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { formatCentsAsDollars } from '../../../../constants/payments';
import { StripeProvider } from './StripeProvider';
import type { StripePaymentFormProps, PaymentIntentResult } from './types';

type PaymentState = 'loading' | 'ready' | 'processing' | 'success' | 'error';

// ============================================
// Fee Breakdown Component
// ============================================

interface FeeBreakdownProps {
  baseAmount: number;
  processingFee: number;
  totalAmount: number;
  currency: string;
}

function FeeBreakdown({ baseAmount, processingFee, totalAmount, currency }: FeeBreakdownProps) {
  return (
    <div className="stripe-payment-form__breakdown portal-card mb-2 py-1 px-3">
      <div className="layout-row-between mb-1">
        <span>Subtotal</span>
        <span>{formatCentsAsDollars(baseAmount, currency)}</span>
      </div>
      <div className="layout-row-between mb-1 text-sm text-muted">
        <span>Processing fee</span>
        <span>{formatCentsAsDollars(processingFee, currency)}</span>
      </div>
      <div className="layout-row-between border-top font-semibold" style={{ paddingTop: 'var(--space-1)', marginTop: 'var(--space-0-5)' }}>
        <span>Total</span>
        <span className="text-accent">
          {formatCentsAsDollars(totalAmount, currency)}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Processing Fee Notice
// ============================================

function ProcessingFeeNotice() {
  return (
    <div className="layout-row-top text-xs text-muted mb-2" style={{ padding: 'var(--space-1) var(--space-1-5)', backgroundColor: 'var(--color-bg-raised)', lineHeight: 1.45 }}>
      <Info size={14} className="shrink-0" style={{ marginTop: 'var(--space-0-25)' }} />
      <span>
        A processing fee is added to cover card payment costs. This fee is
        non-refundable and is the responsibility of the client.
      </span>
    </div>
  );
}

// ============================================
// Inner Form (inside Stripe Elements provider)
// ============================================

function PaymentFormInner({
  onSuccess,
  onError,
  totalCents,
  baseCents,
  feeCents,
  currency = 'usd'
}: {
  onSuccess?: () => void;
  onError?: (message: string) => void;
  totalCents: number;
  baseCents: number;
  feeCents: number;
  currency?: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [state, setState] = useState<PaymentState>('ready');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setState('processing');
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href
      },
      redirect: 'if_required'
    });

    if (error) {
      const message = error.message || 'Payment failed. Please try again.';
      setErrorMessage(message);
      setState('error');
      onError?.(message);
    } else {
      setState('success');
      onSuccess?.();
    }
  }, [stripe, elements, onSuccess, onError]);

  if (state === 'success') {
    return (
      <div className="portal-card text-center p-4">
        <CheckCircle size={48} className="text-success" style={{ margin: '0 auto var(--space-2)' }} />
        <h3>Payment Successful</h3>
        <p className="text-muted">
          Your payment of {formatCentsAsDollars(totalCents, currency)} has been processed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      {/* Fee breakdown */}
      <FeeBreakdown
        baseAmount={baseCents}
        processingFee={feeCents}
        totalAmount={totalCents}
        currency={currency}
      />

      {/* Processing fee notice */}
      <ProcessingFeeNotice />

      {/* Stripe PaymentElement */}
      <div className="stripe-payment-form__element">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="form-error-message layout-row gap-1 mt-2">
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary btn-full mt-2"
        disabled={!stripe || state === 'processing'}
      >
        {state === 'processing' ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard size={16} />
            Pay {formatCentsAsDollars(totalCents, currency)}
          </>
        )}
      </button>
    </form>
  );
}

// ============================================
// Main Exported Component
// ============================================

/**
 * Creates PaymentIntent on mount (including processing fee),
 * then renders the fee breakdown + Stripe payment form.
 */
export function StripePaymentForm({
  invoiceId,
  installmentId,
  amountCents: _amountCentsHint,
  currency = 'usd',
  onSuccess,
  onError,
  getAuthToken
}: StripePaymentFormProps) {
  const [intentData, setIntentData] = useState<PaymentIntentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { portalFetch } = usePortalFetch({ getAuthToken });

  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      try {
        const result = await portalFetch<PaymentIntentResult>(
          API_ENDPOINTS.PAYMENTS_CREATE_INTENT,
          {
            method: 'POST',
            body: { invoiceId, installmentId }
          }
        );

        if (!cancelled) {
          setIntentData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to initialize payment';
          setError(message);
          setLoading(false);
          onError?.(message);
        }
      }
    }

    createIntent();
    return () => { cancelled = true; };
  }, [invoiceId, installmentId, portalFetch, onError]);

  if (loading) {
    return (
      <div className="portal-card text-center p-4">
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
        <p className="text-muted mt-1">Initializing payment...</p>
      </div>
    );
  }

  if (error || !intentData) {
    return (
      <div className="portal-card text-center p-4">
        <AlertCircle size={24} className="text-danger" style={{ margin: '0 auto' }} />
        <p className="form-error-message mt-1">
          {error || 'Unable to initialize payment'}
        </p>
      </div>
    );
  }

  return (
    <StripeProvider clientSecret={intentData.clientSecret}>
      <PaymentFormInner
        onSuccess={onSuccess}
        onError={onError}
        totalCents={intentData.amount}
        baseCents={intentData.baseAmount}
        feeCents={intentData.processingFee}
        currency={currency}
      />
    </StripeProvider>
  );
}
