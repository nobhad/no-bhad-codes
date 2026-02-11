/**
 * ===============================================
 * INVOICE ROUTES INDEX
 * ===============================================
 * @file server/routes/invoices/index.ts
 *
 * Re-exports from invoice sub-modules.
 * The main invoices.ts still handles all routes for now.
 * This file exports shared utilities used by invoices.ts.
 */

// Export PDF generation function and types for use by main invoices.ts
export { generateInvoicePdf } from './pdf.js';
export type { InvoicePdfData } from './pdf.js';

// Export helpers for use by main invoices.ts
export {
  getInvoiceService,
  canAccessInvoice,
  toSnakeCaseInvoice,
  toSnakeCaseCredit,
  toSnakeCaseDeposit,
  toSnakeCasePaymentPlan,
  toSnakeCaseScheduledInvoice,
  toSnakeCaseRecurringInvoice,
  toSnakeCaseReminder
} from './helpers.js';

// Future: As more routes are extracted, they will be re-exported here
// and the main invoices.ts will gradually shrink
