/**
 * ===============================================
 * INTEGRATION STATUS SERVICE
 * ===============================================
 * @file server/services/integration-status-service.ts
 *
 * Database operations for integration status queries.
 * Extracted from server/routes/integrations/status.ts
 * and server/routes/integrations/stripe.ts.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// COLUMN LISTS
// =====================================================

const INTEGRATION_STATUS_COLUMNS = `
  id, integration_type, is_configured, is_active, configuration,
  last_activity_at, error_message, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const INVOICE_COLUMNS = `
  id, client_id, project_id, invoice_number, description, status,
  amount_subtotal, amount_tax, amount_total, amount_paid, tax_rate,
  payment_method, payment_reference, paid_date, issued_date, due_date,
  notes, line_items, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// TYPES
// =====================================================

export interface IntegrationStatusRow {
  id: number;
  integration_type: string;
  is_configured: number;
  is_active: number;
  configuration: string | null;
  last_activity_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRow {
  id: number;
  total_amount: number;
  invoice_number: string;
  [key: string]: unknown;
}

// =====================================================
// SERVICE
// =====================================================

class IntegrationStatusService {
  /**
   * Get all integration statuses ordered by type
   */
  async getAllIntegrationStatuses(): Promise<Record<string, unknown>[]> {
    const db = getDatabase();
    const statuses = await db.all(
      `SELECT ${INTEGRATION_STATUS_COLUMNS} FROM integration_status ORDER BY integration_type LIMIT 100`
    );
    return statuses as Record<string, unknown>[];
  }

  /**
   * Get an invoice by ID for payment link creation
   */
  async getInvoiceForPaymentLink(invoiceId: number): Promise<InvoiceRow | null> {
    const db = getDatabase();
    const invoice = await db.get(
      `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = ?`,
      [invoiceId]
    );
    return (invoice as InvoiceRow) ?? null;
  }
}

export const integrationStatusService = new IntegrationStatusService();
