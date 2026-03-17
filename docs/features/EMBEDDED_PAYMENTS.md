# Embedded Stripe Payments

**Status:** Complete
**Last Updated:** 2026-03-17

## Overview

Embedded Stripe payments allow clients to pay invoices and installments directly within the portal using Stripe Elements — no redirect to Stripe Checkout. Processing fees are transparently added and shown to the client before payment.

## Architecture

### Components

- `StripeProvider.tsx` — Loads Stripe.js SDK, wraps children in `<Elements>` provider
- `StripePaymentForm.tsx` — Creates PaymentIntent on mount, shows fee breakdown, renders `<PaymentElement>`, confirms payment
- `DepositPaymentStep.tsx` — Agreement flow step that embeds the payment form

### Data Flow

1. Client clicks "Pay" on an invoice or agreement deposit step
2. `StripePaymentForm` mounts, calls `POST /api/payments/create-intent`
3. Server calculates processing fee, creates Stripe PaymentIntent, returns `clientSecret`
4. Client sees fee breakdown (subtotal, processing fee, total) and enters card details
5. On submit, Stripe.js confirms payment client-side
6. Stripe sends `payment_intent.succeeded` webhook to `POST /api/payments/webhook`
7. Server marks invoice/installment as paid, emits `invoice.paid` workflow event

### Processing Fee

- **Rate:** 2.9% + $0.30 per transaction (configurable in `server/config/constants.ts`)
- **Formula:** `total = (base + fixedFee) / (1 - percentFee)` — ensures business receives full base amount
- **Display:** Fee breakdown shown before payment with clear notice that processing fees are the client's responsibility
- **Frontend mirror:** `src/constants/payments.ts`

### Database Tables

- `clients.stripe_customer_id` — Cached Stripe Customer ID
- `client_payment_methods` — Saved payment methods (for future auto-pay)
- `stripe_payment_intents` — Tracks PaymentIntents (amount, status, invoice/installment link)

### API Endpoints

- `POST /api/payments/create-intent` — Create PaymentIntent (requireClient)
- `POST /api/payments/webhook` — Stripe webhook (signature verification, no JWT)

### Environment Variables

- `STRIPE_SECRET_KEY` — Server-side Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Webhook signature verification secret
- `VITE_STRIPE_PUBLISHABLE_KEY` — Client-side Stripe publishable key

## Key Files

- `server/services/stripe-payment-service.ts` — PaymentIntent creation, customer management, webhook handlers
- `server/services/stripe-payment-types.ts` — TypeScript interfaces
- `server/routes/payments/client.ts` — Client-facing route
- `server/routes/payments/webhook.ts` — Webhook route
- `server/config/constants.ts` — Fee constants and calculation
- `src/react/features/portal/payments/StripePaymentForm.tsx` — React payment form
- `src/react/features/portal/payments/StripeProvider.tsx` — Stripe Elements wrapper
- `src/constants/payments.ts` — Frontend fee constants
- `server/database/migrations/119_stripe_embedded_payments.sql` — Schema

## Change Log

### 2026-03-17 — Initial Implementation

- Created embedded Stripe Elements payment flow
- Added processing fee calculation (2.9% + $0.30)
- Fee breakdown and responsibility notice shown to clients
- PaymentIntent webhook handling with invoice/installment auto-marking
- CSP updated for Stripe domains (js.stripe.com, api.stripe.com)
