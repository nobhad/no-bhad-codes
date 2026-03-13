/**
 * Shared constants and helpers for integration sub-routers.
 */

import {
  isStripeConfigured,
  isGoogleCalendarConfigured
} from '../../services/integrations/index.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
export const INTEGRATION_STATUS_COLUMNS = `
  id, integration_type, is_configured, is_active, configuration,
  last_activity_at, error_message, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const INVOICE_COLUMNS = `
  id, client_id, project_id, invoice_number, description, status,
  amount_subtotal, amount_tax, amount_total, amount_paid, tax_rate,
  payment_method, payment_reference, paid_date, issued_date, due_date,
  notes, line_items, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export function checkRuntimeConfiguration(type: string): boolean {
  switch (type) {
  case 'stripe':
    return isStripeConfigured();
  case 'google_calendar':
    return isGoogleCalendarConfigured();
  case 'slack':
  case 'discord':
    return true; // Configured per-webhook
  case 'zapier':
    return true; // Uses existing webhook system
  default:
    return false;
  }
}
