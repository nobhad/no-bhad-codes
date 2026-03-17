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
    <div className="stripe-payment-form__breakdown" style={{
      borderRadius: 6,
      border: '1px solid var(--app-color-border)',
      padding: '0.75rem 1rem',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span>Subtotal</span>
        <span>{formatCentsAsDollars(baseAmount, currency)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.9rem', color: 'var(--app-color-text-muted)' }}>
        <span>Processing fee</span>
        <span>{formatCentsAsDollars(processingFee, currency)}</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--app-color-border)',
        paddingTop: '0.5rem',
        marginTop: '0.25rem',
        fontWeight: 600
      }}>
        <span>Total</span>
        <span style={{ color: 'var(--app-color-primary)' }}>
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
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'flex-start',
      padding: '0.6rem 0.75rem',
      borderRadius: 6,
      backgroundColor: 'var(--app-color-bg-muted, #f5f5f5)',
      fontSize: '0.8rem',
      color: 'var(--app-color-text-muted)',
      marginBottom: '1rem',
      lineHeight: 1.45
    }}>
      <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
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
      <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <CheckCircle size={48} style={{ color: 'var(--app-color-success)', margin: '0 auto 1rem' }} />
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
        <div className="form-error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={!stripe || state === 'processing'}
        style={{ width: '100%', marginTop: '1rem' }}
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
      <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Initializing payment...</p>
      </div>
    );
  }

  if (error || !intentData) {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '2rem' }}>
        <AlertCircle size={24} style={{ color: 'var(--app-color-danger)', margin: '0 auto' }} />
        <p className="form-error-message" style={{ marginTop: '0.5rem' }}>
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
