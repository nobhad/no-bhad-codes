/**
 * ===============================================
 * API TYPES — INVOICES
 * ===============================================
 */

// Invoice API Types
// ============================================

/**
 * Invoice status values
 */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'partial'
  | 'viewed';

/**
 * Invoice type values
 */
export type InvoiceType = 'standard' | 'deposit';

/**
 * Invoice response (matches server API response)
 */
export interface InvoiceResponse {
  id: number;
  project_id: number;
  client_id?: number;
  invoice_number: string;
  amount_total: number | string; // Can be number or string from API
  amount_paid?: number | string; // Can be number or string from API
  status: InvoiceStatus | string; // Allow string for flexibility
  due_date: string;
  paid_date?: string;
  created_at: string;
  updated_at?: string;
  // Deposit invoice fields
  invoice_type?: InvoiceType | string;
  deposit_for_project_id?: number;
  deposit_percentage?: number;
  // Line items
  line_items?: InvoiceLineItem[];
  notes?: string;
  terms?: string;
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/**
 * Invoice credit response
 */
export interface InvoiceCreditResponse {
  id: number;
  invoice_id: number;
  deposit_invoice_id: number;
  deposit_invoice_number?: string;
  amount: number;
  applied_at: string;
  applied_by?: string;
}

/**
 * Deposit summary response
 */
export interface DepositSummaryResponse {
  invoice_id: number;
  invoice_number: string;
  total_amount: number;
  amount_applied: number;
  available_amount: number;
  paid_date?: string;
}


// ============================================
// Payment Plan API Types
// ============================================

/**
 * Payment plan trigger types
 */
export type PaymentTrigger = 'upfront' | 'midpoint' | 'completion' | 'milestone' | 'date';

/**
 * Individual payment within a plan
 */
export interface PaymentPlanPayment {
  percentage: number;
  trigger: PaymentTrigger;
  label?: string;
  milestoneId?: number;
  milestoneIndex?: number;
  daysAfterStart?: number;
}

/**
 * Payment plan template
 */
export interface PaymentPlanTemplate {
  id: number;
  name: string;
  description?: string;
  payments: PaymentPlanPayment[];
  isDefault: boolean;
  createdAt: string;
}

/**
 * Payment plan template response (snake_case for API)
 */
export interface PaymentPlanTemplateResponse {
  id: number;
  name: string;
  description?: string;
  payments: PaymentPlanPayment[];
  is_default: boolean;
  created_at: string;
}

// ============================================
// Scheduled Invoice API Types
// ============================================

/**
 * Scheduled invoice trigger types
 */
export type ScheduledInvoiceTrigger = 'date' | 'milestone_complete';

/**
 * Scheduled invoice status
 */
export type ScheduledInvoiceStatus = 'pending' | 'generated' | 'cancelled';

/**
 * Scheduled invoice
 */
export interface ScheduledInvoice {
  id: number;
  projectId: number;
  clientId: number;
  scheduledDate: string;
  triggerType: ScheduledInvoiceTrigger;
  triggerMilestoneId?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  status: ScheduledInvoiceStatus;
  generatedInvoiceId?: number;
  createdAt: string;
}

/**
 * Scheduled invoice response (snake_case for API)
 */
export interface ScheduledInvoiceResponse {
  id: number;
  project_id: number;
  client_id: number;
  scheduled_date: string;
  trigger_type: ScheduledInvoiceTrigger;
  trigger_milestone_id?: number;
  line_items: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  status: ScheduledInvoiceStatus;
  generated_invoice_id?: number;
  created_at: string;
}

// ============================================
// Recurring Invoice API Types
// ============================================

/**
 * Recurring invoice frequency
 */
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly';

/**
 * Recurring invoice
 */
export interface RecurringInvoice {
  id: number;
  projectId: number;
  clientId: number;
  frequency: RecurringFrequency;
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

/**
 * Recurring invoice response (snake_case for API)
 */
export interface RecurringInvoiceResponse {
  id: number;
  project_id: number;
  client_id: number;
  frequency: RecurringFrequency;
  day_of_month?: number;
  day_of_week?: number;
  line_items: InvoiceLineItem[];
  notes?: string;
  terms?: string;
  start_date: string;
  end_date?: string;
  next_generation_date: string;
  last_generated_at?: string;
  is_active: boolean;
  created_at: string;
}

// ============================================
// Invoice Reminder API Types
// ============================================

/**
 * Invoice reminder types
 */
export type ReminderType =
  | 'upcoming'
  | 'due'
  | 'overdue_3'
  | 'overdue_7'
  | 'overdue_14'
  | 'overdue_30';

/**
 * Invoice reminder status
 */
export type ReminderStatus = 'pending' | 'sent' | 'skipped' | 'failed';

/**
 * Invoice reminder
 */
export interface InvoiceReminder {
  id: number;
  invoiceId: number;
  reminderType: ReminderType;
  scheduledDate: string;
  sentAt?: string;
  status: ReminderStatus;
  createdAt: string;
}

/**
 * Invoice reminder response (snake_case for API)
 */
export interface InvoiceReminderResponse {
  id: number;
  invoice_id: number;
  reminder_type: ReminderType;
  scheduled_date: string;
  sent_at?: string;
  status: ReminderStatus;
  created_at: string;
}
