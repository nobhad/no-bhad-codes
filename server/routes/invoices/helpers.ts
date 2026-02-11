/**
 * ===============================================
 * INVOICE ROUTE HELPERS
 * ===============================================
 * @file server/routes/invoices/helpers.ts
 *
 * Shared helpers, transformers, and types for invoice routes
 */

import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  InvoiceService,
  Invoice,
  InvoiceCredit,
  DepositSummary,
  PaymentPlanTemplate,
  ScheduledInvoice,
  RecurringInvoice,
  InvoiceReminder
} from '../../services/invoice-service.js';

/**
 * Get singleton InvoiceService instance
 */
export function getInvoiceService(): InvoiceService {
  return InvoiceService.getInstance();
}

/**
 * Check if user can access an invoice
 */
export function canAccessInvoice(req: AuthenticatedRequest, invoice: Invoice): boolean {
  if (req.user?.type === 'admin') {
    return true;
  }
  return req.user?.id === invoice.clientId;
}

/**
 * Transform Invoice object to snake_case for frontend compatibility
 */
export function toSnakeCaseInvoice(invoice: Invoice): Record<string, unknown> {
  return {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    project_id: invoice.projectId,
    client_id: invoice.clientId,
    amount_total: invoice.amountTotal,
    amount_paid: invoice.amountPaid || 0,
    currency: invoice.currency,
    status: invoice.status,
    due_date: invoice.dueDate,
    issued_date: invoice.issuedDate,
    paid_date: invoice.paidDate,
    payment_method: invoice.paymentMethod,
    payment_reference: invoice.paymentReference,
    line_items: invoice.lineItems,
    notes: invoice.notes,
    terms: invoice.terms,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
    client_name: invoice.clientName,
    project_name: invoice.projectName,
    business_name: invoice.businessName,
    business_email: invoice.businessEmail,
    venmo_handle: invoice.venmoHandle,
    paypal_email: invoice.paypalEmail,
    services_title: invoice.servicesTitle,
    services_description: invoice.servicesDescription,
    deliverables: invoice.deliverables,
    bill_to_name: invoice.billToName,
    bill_to_email: invoice.billToEmail,
    invoice_type: invoice.invoiceType,
    deposit_for_project_id: invoice.depositForProjectId,
    deposit_percentage: invoice.depositPercentage,
    subtotal: invoice.subtotal,
    tax_rate: invoice.taxRate,
    tax_amount: invoice.taxAmount,
    discount_type: invoice.discountType,
    discount_value: invoice.discountValue,
    discount_amount: invoice.discountAmount,
    late_fee_rate: invoice.lateFeeRate,
    late_fee_type: invoice.lateFeeType,
    late_fee_amount: invoice.lateFeeAmount,
    late_fee_applied_at: invoice.lateFeeAppliedAt,
    payment_terms_id: invoice.paymentTermsId,
    payment_terms_name: invoice.paymentTermsName,
    internal_notes: invoice.internalNotes,
    invoice_prefix: invoice.invoicePrefix,
    invoice_sequence: invoice.invoiceSequence
  };
}

/**
 * Transform InvoiceCredit to snake_case for frontend
 */
export function toSnakeCaseCredit(credit: InvoiceCredit): Record<string, unknown> {
  return {
    id: credit.id,
    invoice_id: credit.invoiceId,
    deposit_invoice_id: credit.depositInvoiceId,
    deposit_invoice_number: credit.depositInvoiceNumber,
    amount: credit.amount,
    applied_at: credit.appliedAt,
    applied_by: credit.appliedBy
  };
}

/**
 * Transform DepositSummary to snake_case for frontend
 */
export function toSnakeCaseDeposit(deposit: DepositSummary): Record<string, unknown> {
  return {
    invoice_id: deposit.invoiceId,
    invoice_number: deposit.invoiceNumber,
    total_amount: deposit.totalAmount,
    amount_applied: deposit.amountApplied,
    available_amount: deposit.availableAmount,
    paid_date: deposit.paidDate
  };
}

/**
 * Transform PaymentPlanTemplate to snake_case for frontend
 */
export function toSnakeCasePaymentPlan(plan: PaymentPlanTemplate): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    payments: plan.payments,
    is_default: plan.isDefault,
    created_at: plan.createdAt
  };
}

/**
 * Transform ScheduledInvoice to snake_case for frontend
 */
export function toSnakeCaseScheduledInvoice(scheduled: ScheduledInvoice): Record<string, unknown> {
  return {
    id: scheduled.id,
    project_id: scheduled.projectId,
    client_id: scheduled.clientId,
    scheduled_date: scheduled.scheduledDate,
    trigger_type: scheduled.triggerType,
    trigger_milestone_id: scheduled.triggerMilestoneId,
    line_items: scheduled.lineItems,
    notes: scheduled.notes,
    terms: scheduled.terms,
    status: scheduled.status,
    generated_invoice_id: scheduled.generatedInvoiceId,
    created_at: scheduled.createdAt
  };
}

/**
 * Transform RecurringInvoice to snake_case for frontend
 */
export function toSnakeCaseRecurringInvoice(recurring: RecurringInvoice): Record<string, unknown> {
  return {
    id: recurring.id,
    project_id: recurring.projectId,
    client_id: recurring.clientId,
    frequency: recurring.frequency,
    day_of_month: recurring.dayOfMonth,
    day_of_week: recurring.dayOfWeek,
    line_items: recurring.lineItems,
    notes: recurring.notes,
    terms: recurring.terms,
    start_date: recurring.startDate,
    end_date: recurring.endDate,
    next_generation_date: recurring.nextGenerationDate,
    last_generated_at: recurring.lastGeneratedAt,
    is_active: recurring.isActive,
    created_at: recurring.createdAt
  };
}

/**
 * Transform InvoiceReminder to snake_case for frontend
 */
export function toSnakeCaseReminder(reminder: InvoiceReminder): Record<string, unknown> {
  return {
    id: reminder.id,
    invoice_id: reminder.invoiceId,
    reminder_type: reminder.reminderType,
    scheduled_date: reminder.scheduledDate,
    sent_at: reminder.sentAt,
    status: reminder.status,
    created_at: reminder.createdAt
  };
}
