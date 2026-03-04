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
  toSnakeCaseInvoice,
  toSnakeCaseCredit,
  toSnakeCaseDeposit,
  toSnakeCasePaymentPlan,
  toSnakeCaseScheduledInvoice,
  toSnakeCaseRecurringInvoice,
  toSnakeCaseReminder
} from './helpers.js';

// Export core routes
export { coreRouter } from './core.js';

// Export deposit and credit routes
export { depositsRouter } from './deposits.js';
export { creditsRouter } from './credits.js';
export { paymentPlansRouter } from './payment-plans.js';
export { scheduledRouter } from './scheduled.js';
export { recurringRouter } from './recurring.js';
export { remindersRouter } from './reminders.js';
export { clientRoutesRouter } from './client-routes.js';
export { batchRouter } from './batch.js';
export { agingRouter } from './aging.js';

// Export main invoices router
export { default as invoicesRouter } from '../invoices.js';

// Future: As more routes are extracted, they will be re-exported here
// and the main invoices.ts will gradually shrink
