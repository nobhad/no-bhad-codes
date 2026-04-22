/**
 * ===============================================
 * DB ROW SCHEMAS (ZOD)
 * ===============================================
 * @file server/database/row-schemas.ts
 *
 * Zod schemas for DB rows at hot boundaries — tables where silent
 * schema drift would produce wrong financial numbers, break security
 * gates, or stall the async outbox.
 *
 * Seed set covers the tables recently re-engineered for correctness:
 *   async_tasks            durable outbox
 *   webhook_processed_events  Stripe idempotency
 *   stripe_payment_intents    payment write path
 *   clients (lockout slice)   auth brute-force protection
 *
 * Extend as new hot paths land; do not inflate by adding schemas for
 * every cold table — the value is in failing loudly where it matters.
 */

import { z } from 'zod';

// Helpers — SQLite returns 0/1 for booleans and null for absent dates.
const sqliteBool = z.union([z.literal(0), z.literal(1)]);
const nullableString = z.string().nullable();
const isoish = z.string();

export const asyncTaskRowSchema = z.object({
  id: z.number().int(),
  task_type: z.string(),
  payload: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'dead']),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  last_error: nullableString.optional(),
  next_attempt_at: isoish,
  created_at: isoish.optional(),
  started_at: nullableString.optional(),
  completed_at: nullableString.optional(),
  dedupe_key: nullableString.optional()
});
export type AsyncTaskRow = z.infer<typeof asyncTaskRowSchema>;

/**
 * Only the columns the async-task worker actually reads when claiming
 * the next row. Keeping this narrow avoids coupling the worker to
 * schema changes in unrelated columns.
 */
export const asyncTaskClaimRowSchema = asyncTaskRowSchema.pick({
  id: true,
  task_type: true,
  payload: true,
  attempts: true,
  max_attempts: true
});
export type AsyncTaskClaimRow = z.infer<typeof asyncTaskClaimRowSchema>;

export const webhookProcessedEventRowSchema = z.object({
  event_id: z.string(),
  source: z.string(),
  processed_at: isoish
});
export type WebhookProcessedEventRow = z.infer<typeof webhookProcessedEventRowSchema>;

/**
 * Narrow slice of stripe_payment_intents used by handlePaymentSuccess.
 * Renamed with the Lookup suffix to avoid clashing with the fuller
 * StripePaymentIntentRow interface in services/stripe-payment-types —
 * that one covers all columns for general CRUD, this one only
 * validates what the payment-success path needs.
 */
export const stripePaymentIntentLookupRowSchema = z.object({
  id: z.number().int(),
  client_id: z.number().int().nullable(),
  invoice_id: z.number().int().nullable(),
  installment_id: z.number().int().nullable(),
  amount_cents: z.number().int()
});
export type StripePaymentIntentLookupRow = z.infer<typeof stripePaymentIntentLookupRowSchema>;

/**
 * Lockout slice of the clients row — returned by
 * recordClientFailedAttempt after the atomic increment, so the login
 * handler can decide whether to surface "locked" or "invalid" to the
 * user. We only validate the fields that gate that decision; a
 * broader client schema can layer on top later.
 */
export const clientLockoutRowSchema = z.object({
  failed_login_attempts: z.number().int().nonnegative(),
  locked_until: nullableString.optional()
});
export type ClientLockoutRow = z.infer<typeof clientLockoutRowSchema>;

/**
 * Single-row SELECT of a system_settings value. The table stores
 * everything as strings and we cast per call site, so the Zod layer
 * only asserts that setting_value is a string — further parsing
 * (parseInt, JSON.parse) stays where it was.
 */
export const systemSettingValueRowSchema = z.object({
  setting_value: z.string()
});
export type SystemSettingValueRow = z.infer<typeof systemSettingValueRowSchema>;

// Re-export the bool helper in case a future schema needs it.
export { sqliteBool };
