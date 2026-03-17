/**
 * ===============================================
 * STRIPE PROVIDER
 * ===============================================
 * @file src/react/features/portal/payments/StripeProvider.tsx
 *
 * Loads Stripe.js and wraps children in Elements provider.
 * Reads the publishable key from VITE_STRIPE_PUBLISHABLE_KEY.
 */

import * as React from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise && STRIPE_PUBLISHABLE_KEY) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise || Promise.resolve(null);
}

interface StripeProviderProps {
  clientSecret: string;
  children: React.ReactNode;
}

export function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  if (!STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="form-error-message">
        Stripe is not configured. Please contact support.
      </div>
    );
  }

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: 'var(--app-color-primary)',
            fontFamily: 'inherit'
          }
        }
      }}
    >
      {children}
    </Elements>
  );
}
