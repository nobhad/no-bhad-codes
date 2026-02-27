/**
 * ===============================================
 * INVOICE ENTITY SCHEMAS
 * ===============================================
 * @file server/database/entities/invoice.ts
 *
 * Entity schemas and mappers for invoice-related data types.
 * Types are imported from server/types/invoice-types.ts
 */

import { defineSchema, definePartialSchema, createMapper } from '../entity-mapper.js';
import type { DatabaseRow } from '../init.js';
import type {
  Invoice,
  InvoiceRow,
  PaymentTermsPreset,
  PaymentTermsPresetRow,
  InvoicePayment,
  InvoicePaymentRow,
  PaymentPlanTemplate,
  PaymentPlanTemplateRow,
  ScheduledInvoice,
  ScheduledInvoiceRow,
  RecurringInvoice,
  RecurringInvoiceRow,
  InvoiceReminder,
  InvoiceReminderRow,
  InvoiceCredit,
  InvoiceCreditRow,
  InvoiceStatus,
  InvoiceType,
  DiscountType,
  LateFeeType,
  ReminderType,
} from '../../types/invoice-types.js';

// Re-export types for convenience
export type {
  Invoice,
  InvoiceRow,
  PaymentTermsPreset,
  PaymentTermsPresetRow,
  InvoicePayment,
  InvoicePaymentRow,
  PaymentPlanTemplate,
  PaymentPlanTemplateRow,
  ScheduledInvoice,
  ScheduledInvoiceRow,
  RecurringInvoice,
  RecurringInvoiceRow,
  InvoiceReminder,
  InvoiceReminderRow,
  InvoiceCredit,
  InvoiceCreditRow,
  InvoiceStatus,
  InvoiceType,
  DiscountType,
  LateFeeType,
  ReminderType,
};

// Extend DatabaseRow for proper typing
export interface TypedInvoiceRow extends InvoiceRow, DatabaseRow {}
export interface TypedPaymentTermsPresetRow extends PaymentTermsPresetRow, DatabaseRow {}
export interface TypedInvoicePaymentRow extends InvoicePaymentRow, DatabaseRow {}
export interface TypedPaymentPlanTemplateRow extends PaymentPlanTemplateRow, DatabaseRow {}
export interface TypedScheduledInvoiceRow extends ScheduledInvoiceRow, DatabaseRow {}
export interface TypedRecurringInvoiceRow extends RecurringInvoiceRow, DatabaseRow {}
export interface TypedInvoiceReminderRow extends InvoiceReminderRow, DatabaseRow {}
export interface TypedInvoiceCreditRow extends InvoiceCreditRow, DatabaseRow {}

// =====================================================
// ENTITY SCHEMAS
// =====================================================

export const paymentTermsPresetSchema = defineSchema<PaymentTermsPreset>({
  id: 'number',
  name: 'string',
  daysUntilDue: { column: 'days_until_due', type: 'number' },
  description: 'string?',
  lateFeeRate: { column: 'late_fee_rate', type: 'float?' },
  lateFeeType: {
    column: 'late_fee_type',
    type: 'string',
    transform: (v) => v as PaymentTermsPreset['lateFeeType'],
  },
  lateFeeFlatAmount: { column: 'late_fee_flat_amount', type: 'float?' },
  gracePeriodDays: { column: 'grace_period_days', type: 'number' },
  isDefault: { column: 'is_default', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const invoicePaymentSchema = defineSchema<InvoicePayment>({
  id: 'number',
  invoiceId: { column: 'invoice_id', type: 'number' },
  amount: { column: 'amount', type: 'float' },
  paymentMethod: { column: 'payment_method', type: 'string' },
  paymentReference: { column: 'payment_reference', type: 'string?' },
  paymentDate: { column: 'payment_date', type: 'string' },
  notes: 'string?',
  createdAt: { column: 'created_at', type: 'string' },
});

export const paymentPlanTemplateSchema = defineSchema<PaymentPlanTemplate>({
  id: 'number',
  name: 'string',
  description: 'string?',
  payments: { column: 'payments', type: 'json', default: [] },
  isDefault: { column: 'is_default', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const scheduledInvoiceSchema = defineSchema<ScheduledInvoice>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  scheduledDate: { column: 'scheduled_date', type: 'string' },
  triggerType: {
    column: 'trigger_type',
    type: 'string',
    transform: (v) => v as ScheduledInvoice['triggerType'],
  },
  triggerMilestoneId: { column: 'trigger_milestone_id', type: 'number?' },
  lineItems: { column: 'line_items', type: 'json', default: [] },
  notes: 'string?',
  terms: 'string?',
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as ScheduledInvoice['status'],
  },
  generatedInvoiceId: { column: 'generated_invoice_id', type: 'number?' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const recurringInvoiceSchema = defineSchema<RecurringInvoice>({
  id: 'number',
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  frequency: {
    column: 'frequency',
    type: 'string',
    transform: (v) => v as RecurringInvoice['frequency'],
  },
  dayOfMonth: { column: 'day_of_month', type: 'number?' },
  dayOfWeek: { column: 'day_of_week', type: 'number?' },
  lineItems: { column: 'line_items', type: 'json', default: [] },
  notes: 'string?',
  terms: 'string?',
  startDate: { column: 'start_date', type: 'string' },
  endDate: { column: 'end_date', type: 'string?' },
  nextGenerationDate: { column: 'next_generation_date', type: 'string' },
  lastGeneratedAt: { column: 'last_generated_at', type: 'string?' },
  isActive: { column: 'is_active', type: 'boolean' },
  createdAt: { column: 'created_at', type: 'string' },
});

export const invoiceReminderSchema = defineSchema<InvoiceReminder>({
  id: 'number',
  invoiceId: { column: 'invoice_id', type: 'number' },
  reminderType: {
    column: 'reminder_type',
    type: 'string',
    transform: (v) => v as ReminderType,
  },
  scheduledDate: { column: 'scheduled_date', type: 'string' },
  sentAt: { column: 'sent_at', type: 'string?' },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as InvoiceReminder['status'],
  },
  createdAt: { column: 'created_at', type: 'string' },
});

export const invoiceCreditSchema = defineSchema<InvoiceCredit>({
  id: 'number',
  invoiceId: { column: 'invoice_id', type: 'number' },
  depositInvoiceId: { column: 'deposit_invoice_id', type: 'number' },
  depositInvoiceNumber: { column: 'deposit_invoice_number', type: 'string?' },
  amount: { column: 'amount', type: 'float' },
  appliedAt: { column: 'applied_at', type: 'string' },
  appliedBy: { column: 'applied_by', type: 'string?' },
});

// Invoice has many optional fields and joined data
export const invoiceSchema = definePartialSchema<Invoice>()({
  id: 'number?',
  invoiceNumber: { column: 'invoice_number', type: 'string' },
  projectId: { column: 'project_id', type: 'number' },
  clientId: { column: 'client_id', type: 'number' },
  amountTotal: { column: 'amount_total', type: 'float' },
  amountPaid: { column: 'amount_paid', type: 'float', default: 0 },
  currency: { column: 'currency', type: 'string', default: 'USD' },
  status: {
    column: 'status',
    type: 'string',
    transform: (v) => v as InvoiceStatus,
  },
  dueDate: { column: 'due_date', type: 'string?' },
  issuedDate: { column: 'issued_date', type: 'string?' },
  paidDate: { column: 'paid_date', type: 'string?' },
  paymentMethod: { column: 'payment_method', type: 'string?' },
  paymentReference: { column: 'payment_reference', type: 'string?' },
  notes: 'string?',
  terms: 'string?',
  createdAt: { column: 'created_at', type: 'string?' },
  updatedAt: { column: 'updated_at', type: 'string?' },
  // Joined fields
  clientName: { column: 'company_name', type: 'string?' },
  clientEmail: { column: 'client_email', type: 'string?' },
  projectName: { column: 'project_name', type: 'string?' },
  // Deposit fields
  invoiceType: {
    column: 'invoice_type',
    type: 'string',
    default: 'standard',
    transform: (v) => (v as InvoiceType) || 'standard',
  },
  depositForProjectId: { column: 'deposit_for_project_id', type: 'number?' },
  depositPercentage: { column: 'deposit_percentage', type: 'float?' },
  // Tax
  subtotal: { column: 'subtotal', type: 'float?' },
  taxRate: { column: 'tax_rate', type: 'float?' },
  taxAmount: { column: 'tax_amount', type: 'float?' },
  // Discount
  discountType: {
    column: 'discount_type',
    type: 'string?',
    transform: (v) => v as DiscountType | undefined,
  },
  discountValue: { column: 'discount_value', type: 'float?' },
  discountAmount: { column: 'discount_amount', type: 'float?' },
  // Late fees
  lateFeeRate: { column: 'late_fee_rate', type: 'float?' },
  lateFeeType: {
    column: 'late_fee_type',
    type: 'string?',
    transform: (v) => v as LateFeeType | undefined,
  },
  lateFeeAmount: { column: 'late_fee_amount', type: 'float?' },
  lateFeeAppliedAt: { column: 'late_fee_applied_at', type: 'string?' },
  // Payment terms
  paymentTermsId: { column: 'payment_terms_id', type: 'number?' },
  // Internal
  internalNotes: { column: 'internal_notes', type: 'string?' },
  invoicePrefix: { column: 'invoice_prefix', type: 'string?' },
  invoiceSequence: { column: 'invoice_sequence', type: 'number?' },
});

// =====================================================
// MAPPER FUNCTIONS
// =====================================================

export const toPaymentTermsPreset = createMapper<TypedPaymentTermsPresetRow, PaymentTermsPreset>(
  paymentTermsPresetSchema
);
export const toInvoicePayment = createMapper<TypedInvoicePaymentRow, InvoicePayment>(
  invoicePaymentSchema
);
export const toPaymentPlanTemplate = createMapper<TypedPaymentPlanTemplateRow, PaymentPlanTemplate>(
  paymentPlanTemplateSchema
);
export const toScheduledInvoice = createMapper<TypedScheduledInvoiceRow, ScheduledInvoice>(
  scheduledInvoiceSchema
);
export const toRecurringInvoice = createMapper<TypedRecurringInvoiceRow, RecurringInvoice>(
  recurringInvoiceSchema
);
export const toInvoiceReminder = createMapper<TypedInvoiceReminderRow, InvoiceReminder>(
  invoiceReminderSchema
);
export const toInvoiceCredit = createMapper<TypedInvoiceCreditRow, InvoiceCredit>(
  invoiceCreditSchema
);

/**
 * Map an InvoiceRow to Invoice.
 * Note: lineItems needs to be fetched and parsed separately.
 */
export function toInvoice(row: TypedInvoiceRow): Omit<Invoice, 'lineItems'> {
  type BaseInvoice = Omit<
    Invoice,
    | 'lineItems'
    | 'businessName'
    | 'businessContact'
    | 'businessEmail'
    | 'businessWebsite'
    | 'venmoHandle'
    | 'paypalEmail'
  >;
  return createMapper<TypedInvoiceRow, BaseInvoice>(
    invoiceSchema as ReturnType<typeof defineSchema<BaseInvoice>>
  )(row);
}
