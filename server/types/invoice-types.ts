/**
 * ===============================================
 * INVOICE TYPE DEFINITIONS
 * ===============================================
 * @file server/types/invoice-types.ts
 *
 * Centralized type definitions for invoicing system.
 * Extracted from invoice-service.ts for reusability.
 */

// =====================================================
// LINE ITEMS
// =====================================================

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
}

// =====================================================
// PAYMENT TERMS
// =====================================================

export interface PaymentTermsPreset {
  id: number;
  name: string;
  daysUntilDue: number;
  description?: string;
  lateFeeRate?: number;
  lateFeeType: 'none' | 'flat' | 'percentage' | 'daily_percentage';
  lateFeeFlatAmount?: number;
  gracePeriodDays: number;
  isDefault: boolean;
  createdAt: string;
}

export interface PaymentTermsPresetRow {
  id: number;
  name: string;
  days_until_due: number;
  description?: string;
  late_fee_rate?: number;
  late_fee_type: string;
  late_fee_flat_amount?: number;
  grace_period_days: number;
  is_default: number;
  created_at: string;
}

// =====================================================
// PAYMENTS
// =====================================================

export interface InvoicePayment {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  paymentDate: string;
  notes?: string;
  createdAt: string;
}

export interface InvoicePaymentRow {
  id: number;
  invoice_id: number;
  amount: string | number;
  payment_method: string;
  payment_reference?: string;
  payment_date: string;
  notes?: string;
  created_at: string;
}

// =====================================================
// AGING REPORTS
// =====================================================

export interface InvoiceAgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  count: number;
  totalAmount: number;
  invoices: Invoice[];
}

export interface InvoiceAgingReport {
  generatedAt: string;
  totalOutstanding: number;
  buckets: InvoiceAgingBucket[];
}

// =====================================================
// PAYMENT PLANS
// =====================================================

export interface PaymentPlanPayment {
  percentage: number;
  trigger: 'upfront' | 'midpoint' | 'completion' | 'milestone' | 'date';
  label?: string;
  milestoneId?: number;
  milestoneIndex?: number;
  daysAfterStart?: number;
}

export interface PaymentPlanTemplate {
  id: number;
  name: string;
  description?: string;
  payments: PaymentPlanPayment[];
  isDefault: boolean;
  createdAt: string;
}

export interface PaymentPlanTemplateRow {
  id: number;
  name: string;
  description?: string;
  payments: string;
  is_default: number;
  created_at: string;
}

// =====================================================
// SCHEDULED INVOICES
// =====================================================

export interface ScheduledInvoiceData {
  projectId: number;
  clientId: number;
  scheduledDate: string;
  triggerType?: 'date' | 'milestone_complete';
  triggerMilestoneId?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
}

export interface ScheduledInvoice {
  id: number;
  projectId: number;
  clientId: number;
  scheduledDate: string;
  triggerType: 'date' | 'milestone_complete';
  triggerMilestoneId?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  status: 'pending' | 'generated' | 'cancelled';
  generatedInvoiceId?: number;
  createdAt: string;
}

export interface ScheduledInvoiceRow {
  id: number;
  project_id: number;
  client_id: number;
  scheduled_date: string;
  trigger_type: string;
  trigger_milestone_id?: number;
  line_items: string;
  notes?: string;
  terms?: string;
  status: string;
  generated_invoice_id?: number;
  created_at: string;
}

// =====================================================
// RECURRING INVOICES
// =====================================================

export interface RecurringInvoiceData {
  projectId: number;
  clientId: number;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  startDate: string;
  endDate?: string;
}

export interface RecurringInvoice {
  id: number;
  projectId: number;
  clientId: number;
  frequency: 'weekly' | 'monthly' | 'quarterly';
  dayOfMonth?: number;
  dayOfWeek?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  startDate: string;
  endDate?: string;
  nextGenerationDate: string;
  lastGeneratedAt?: string;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringInvoiceRow {
  id: number;
  project_id: number;
  client_id: number;
  frequency: string;
  day_of_month?: number;
  day_of_week?: number;
  line_items: string;
  notes?: string;
  terms?: string;
  start_date: string;
  end_date?: string;
  next_generation_date: string;
  last_generated_at?: string;
  is_active: number;
  created_at: string;
}

// =====================================================
// REMINDERS
// =====================================================

export type ReminderType = 'upcoming' | 'due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30';

export interface InvoiceReminder {
  id: number;
  invoiceId: number;
  reminderType: ReminderType;
  scheduledDate: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  createdAt: string;
}

export interface InvoiceReminderRow {
  id: number;
  invoice_id: number;
  reminder_type: string;
  scheduled_date: string;
  sent_at?: string;
  status: string;
  created_at: string;
}

// =====================================================
// CORE INVOICE
// =====================================================

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceType = 'standard' | 'deposit';
export type DiscountType = 'percentage' | 'fixed';
export type LateFeeType = 'none' | 'flat' | 'percentage' | 'daily_percentage';

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  projectId: number;
  clientId: number;
  amountTotal: number;
  amountPaid: number;
  currency: string;
  status: InvoiceStatus;
  dueDate?: string;
  issuedDate?: string;
  paidDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  createdAt?: string;
  updatedAt?: string;
  // Joined display names
  clientName?: string;
  projectName?: string;
  // Business info
  businessName?: string;
  businessContact?: string;
  businessEmail?: string;
  businessWebsite?: string;
  venmoHandle?: string;
  paypalEmail?: string;
  // Services fields
  servicesTitle?: string;
  servicesDescription?: string;
  deliverables?: string[];
  features?: string;
  // Bill To overrides
  billToName?: string;
  billToEmail?: string;
  // Deposit fields
  invoiceType: InvoiceType;
  depositForProjectId?: number;
  depositPercentage?: number;
  // Tax
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  // Discount
  discountType?: DiscountType;
  discountValue?: number;
  discountAmount?: number;
  // Late fees
  lateFeeRate?: number;
  lateFeeType?: LateFeeType;
  lateFeeAmount?: number;
  lateFeeAppliedAt?: string;
  // Payment terms
  paymentTermsId?: number;
  paymentTermsName?: string;
  // Internal
  internalNotes?: string;
  invoicePrefix?: string;
  invoiceSequence?: number;
}

export interface InvoiceRow {
  id: number;
  invoice_number: string;
  project_id: number;
  client_id: number;
  amount_total: string | number;
  amount_paid?: string | number;
  currency: string;
  status: InvoiceStatus;
  due_date?: string;
  issued_date?: string;
  paid_date?: string;
  payment_method?: string;
  payment_reference?: string;
  line_items: string;
  notes?: string;
  terms?: string;
  created_at?: string;
  updated_at?: string;
  business_name?: string;
  business_contact?: string;
  business_email?: string;
  business_website?: string;
  venmo_handle?: string;
  paypal_email?: string;
  services_title?: string;
  services_description?: string;
  deliverables?: string;
  features?: string;
  bill_to_name?: string;
  bill_to_email?: string;
  invoice_type?: InvoiceType;
  deposit_for_project_id?: number;
  deposit_percentage?: string | number;
  company_name?: string;
  contact_name?: string;
  client_email?: string;
  project_name?: string;
  project_description?: string;
  subtotal?: string | number;
  tax_rate?: string | number;
  tax_amount?: string | number;
  discount_type?: string;
  discount_value?: string | number;
  discount_amount?: string | number;
  late_fee_rate?: string | number;
  late_fee_type?: string;
  late_fee_amount?: string | number;
  late_fee_applied_at?: string;
  payment_terms_id?: number;
  payment_terms_name?: string;
  internal_notes?: string;
  invoice_prefix?: string;
  invoice_sequence?: number;
}

// =====================================================
// CREDITS & DEPOSITS
// =====================================================

export interface InvoiceCredit {
  id: number;
  invoiceId: number;
  depositInvoiceId: number;
  depositInvoiceNumber?: string;
  amount: number;
  appliedAt: string;
  appliedBy?: string;
}

export interface InvoiceCreditRow {
  id: number;
  invoice_id: number;
  deposit_invoice_id: number;
  amount: string | number;
  applied_at: string;
  applied_by?: string;
  deposit_invoice_number?: string;
}

export interface DepositSummary {
  invoiceId: number;
  invoiceNumber: string;
  totalAmount: number;
  amountApplied: number;
  availableAmount: number;
  paidDate?: string;
}

// =====================================================
// CREATE DATA
// =====================================================

export interface InvoiceCreateData {
  projectId: number;
  clientId: number;
  lineItems: InvoiceLineItem[];
  dueDate?: string;
  notes?: string;
  terms?: string;
  currency?: string;
  businessName?: string;
  businessContact?: string;
  businessEmail?: string;
  businessWebsite?: string;
  venmoHandle?: string;
  paypalEmail?: string;
  servicesTitle?: string;
  servicesDescription?: string;
  deliverables?: string[];
  features?: string;
  billToName?: string;
  billToEmail?: string;
}
