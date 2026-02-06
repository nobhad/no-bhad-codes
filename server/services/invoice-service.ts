/**
 * ===============================================
 * INVOICE GENERATION SERVICE
 * ===============================================
 * @file server/services/invoice-service.ts
 *
 * Handles invoice generation, management, and PDF creation.
 */

import { getDatabase } from '../database/init.js';
import { BUSINESS_INFO } from '../config/business.js';

// Type definitions for database operations
type SqlValue = string | number | boolean | null;

// Use actual database interface from init.js - we'll cast as needed

type Database = any;

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  // Advanced features
  taxRate?: number;       // Per-line tax rate (percentage)
  taxAmount?: number;     // Calculated tax amount for this line
  discountType?: 'percentage' | 'fixed';
  discountValue?: number; // Discount percentage or fixed amount
  discountAmount?: number; // Calculated discount for this line
}

/** Payment terms preset */
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

/** Database row type for payment terms presets */
interface PaymentTermsPresetRow {
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

/** Invoice payment record */
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

/** Database row type for invoice payments */
interface InvoicePaymentRow {
  id: number;
  invoice_id: number;
  amount: string | number;
  payment_method: string;
  payment_reference?: string;
  payment_date: string;
  notes?: string;
  created_at: string;
}

/** Invoice aging bucket */
export interface InvoiceAgingBucket {
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  count: number;
  totalAmount: number;
  invoices: Invoice[];
}

/** Invoice aging report */
export interface InvoiceAgingReport {
  generatedAt: string;
  totalOutstanding: number;
  buckets: InvoiceAgingBucket[];
}

/** Database row type for intake records */
interface IntakeRecord {
  id: number;
  project_type?: string;
  budget_range?: string;
  project_description?: string;
  project_id?: number;
  client_id?: number;
}

/** Database row type for invoice records */
interface InvoiceRow {
  id: number;
  invoice_number: string;
  project_id: number;
  client_id: number;
  amount_total: string | number;
  amount_paid?: string | number;
  currency: string;
  status: Invoice['status'];
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
  // Deposit invoice fields
  invoice_type?: 'standard' | 'deposit';
  deposit_for_project_id?: number;
  deposit_percentage?: string | number;
  // Joined fields from client/project tables
  company_name?: string;
  contact_name?: string;
  client_email?: string;
  project_name?: string;
  project_description?: string;
  // Advanced features - Tax
  subtotal?: string | number;
  tax_rate?: string | number;
  tax_amount?: string | number;
  // Advanced features - Discount
  discount_type?: string;
  discount_value?: string | number;
  discount_amount?: string | number;
  // Advanced features - Late fees
  late_fee_rate?: string | number;
  late_fee_type?: string;
  late_fee_amount?: string | number;
  late_fee_applied_at?: string;
  // Advanced features - Payment terms
  payment_terms_id?: number;
  payment_terms_name?: string;
  // Advanced features - Internal notes
  internal_notes?: string;
  // Advanced features - Invoice number customization
  invoice_prefix?: string;
  invoice_sequence?: number;
}

/** Database row type for invoice credit records */
interface InvoiceCreditRow {
  id: number;
  invoice_id: number;
  deposit_invoice_id: number;
  amount: string | number;
  applied_at: string;
  applied_by?: string;
  deposit_invoice_number?: string;
}

/** Payment plan payment definition */
interface PaymentPlanPayment {
  percentage: number;
  trigger: 'upfront' | 'midpoint' | 'completion' | 'milestone' | 'date';
  label?: string;
  milestoneId?: number;
  milestoneIndex?: number;
  daysAfterStart?: number;
}

/** Payment plan template */
export interface PaymentPlanTemplate {
  id: number;
  name: string;
  description?: string;
  payments: PaymentPlanPayment[];
  isDefault: boolean;
  createdAt: string;
}

/** Database row type for payment plan templates */
interface PaymentPlanTemplateRow {
  id: number;
  name: string;
  description?: string;
  payments: string; // JSON string
  is_default: number;
  created_at: string;
}

/** Scheduled invoice data for creation */
interface ScheduledInvoiceData {
  projectId: number;
  clientId: number;
  scheduledDate: string;
  triggerType?: 'date' | 'milestone_complete';
  triggerMilestoneId?: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  terms?: string;
}

/** Scheduled invoice */
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

/** Database row type for scheduled invoices */
interface ScheduledInvoiceRow {
  id: number;
  project_id: number;
  client_id: number;
  scheduled_date: string;
  trigger_type: string;
  trigger_milestone_id?: number;
  line_items: string; // JSON string
  notes?: string;
  terms?: string;
  status: string;
  generated_invoice_id?: number;
  created_at: string;
}

/** Recurring invoice data for creation */
interface RecurringInvoiceData {
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

/** Recurring invoice */
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

/** Database row type for recurring invoices */
interface RecurringInvoiceRow {
  id: number;
  project_id: number;
  client_id: number;
  frequency: string;
  day_of_month?: number;
  day_of_week?: number;
  line_items: string; // JSON string
  notes?: string;
  terms?: string;
  start_date: string;
  end_date?: string;
  next_generation_date: string;
  last_generated_at?: string;
  is_active: number;
  created_at: string;
}

/** Invoice reminder */
export interface InvoiceReminder {
  id: number;
  invoiceId: number;
  reminderType: 'upcoming' | 'due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30';
  scheduledDate: string;
  sentAt?: string;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  createdAt: string;
}

/** Database row type for invoice reminders */
interface InvoiceReminderRow {
  id: number;
  invoice_id: number;
  reminder_type: string;
  scheduled_date: string;
  sent_at?: string;
  status: string;
  created_at: string;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  projectId: number;
  clientId: number;
  amountTotal: number;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
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
  // Custom business info fields
  businessName?: string;
  businessContact?: string;
  businessEmail?: string;
  businessWebsite?: string;
  // Payment method fields
  venmoHandle?: string;
  paypalEmail?: string;
  // Services/project fields
  servicesTitle?: string;
  servicesDescription?: string;
  deliverables?: string[]; // Array of bullet points
  features?: string; // Comma-separated or text
  // Bill To override fields
  billToName?: string;
  billToEmail?: string;
  // Deposit invoice fields
  invoiceType: 'standard' | 'deposit';
  depositForProjectId?: number;
  depositPercentage?: number;
  // Advanced features - Tax
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  // Advanced features - Discount
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  // Advanced features - Late fees
  lateFeeRate?: number;
  lateFeeType?: 'none' | 'flat' | 'percentage' | 'daily_percentage';
  lateFeeAmount?: number;
  lateFeeAppliedAt?: string;
  // Advanced features - Payment terms
  paymentTermsId?: number;
  paymentTermsName?: string;
  // Advanced features - Internal notes
  internalNotes?: string;
  // Advanced features - Invoice number customization
  invoicePrefix?: string;
  invoiceSequence?: number;
}

export interface InvoiceCredit {
  id: number;
  invoiceId: number;
  depositInvoiceId: number;
  depositInvoiceNumber?: string;
  amount: number;
  appliedAt: string;
  appliedBy?: string;
}

export interface DepositSummary {
  invoiceId: number;
  invoiceNumber: string;
  totalAmount: number;
  amountApplied: number;
  availableAmount: number;
  paidDate?: string;
}

export interface InvoiceCreateData {
  projectId: number;
  clientId: number;
  lineItems: InvoiceLineItem[];
  dueDate?: string;
  notes?: string;
  terms?: string;
  currency?: string;
  // Custom business info
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
}

export class InvoiceService {
  private static instance: InvoiceService;
  private db: Database;

  private constructor() {
    this.db = getDatabase();
  }

  static getInstance(): InvoiceService {
    if (!InvoiceService.instance) {
      InvoiceService.instance = new InvoiceService();
    }
    return InvoiceService.instance;
  }

  /**
   * Generate a unique invoice number
   */
  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    return `INV-${year}${month}-${timestamp}`;
  }

  /**
   * Calculate total amount from line items
   */
  private calculateTotal(lineItems: InvoiceLineItem[]): number {
    return lineItems.reduce((total, item) => total + item.amount, 0);
  }

  /**
   * Create a new invoice
   */
  async createInvoice(data: InvoiceCreateData): Promise<Invoice> {
    const invoiceNumber = this.generateInvoiceNumber();
    const amountTotal = this.calculateTotal(data.lineItems);
    const issuedDate = new Date().toISOString().split('T')[0];

    // Default due date to 30 days from now if not provided
    const dueDate =
      data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sql = `
      INSERT INTO invoices (
        invoice_number, project_id, client_id, amount_total, amount_paid,
        currency, status, due_date, issued_date, line_items, notes, terms,
        business_name, business_contact, business_email, business_website,
        venmo_handle, paypal_email, services_title, services_description,
        deliverables, features, bill_to_name, bill_to_email
      ) VALUES (?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      invoiceNumber,
      data.projectId,
      data.clientId,
      amountTotal,
      data.currency || 'USD',
      dueDate,
      issuedDate,
      JSON.stringify(data.lineItems),
      data.notes || null,
      data.terms || 'Payment due within 14 days of receipt.',
      data.businessName || BUSINESS_INFO.name,
      data.businessContact || BUSINESS_INFO.contact,
      data.businessEmail || BUSINESS_INFO.email,
      data.businessWebsite || BUSINESS_INFO.website,
      data.venmoHandle || BUSINESS_INFO.venmoHandle,
      data.paypalEmail || BUSINESS_INFO.paypalEmail,
      data.servicesTitle || null,
      data.servicesDescription || null,
      data.deliverables ? JSON.stringify(data.deliverables) : null,
      data.features || null,
      data.billToName || null,
      data.billToEmail || null
    ]);

    return this.getInvoiceById(result.lastID!);
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: number): Promise<Invoice> {
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.id = ?
    `;

    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Invoice with ID ${id} not found`);
    }

    return this.mapRowToInvoice(row);
  }

  /**
   * Get invoice by invoice number
   */
  async getInvoiceByNumber(invoiceNumber: string): Promise<Invoice> {
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.invoice_number = ?
    `;

    const row = await this.db.get(sql, [invoiceNumber]);

    if (!row) {
      throw new Error(`Invoice with number ${invoiceNumber} not found`);
    }

    return this.mapRowToInvoice(row);
  }

  /**
   * Get all invoices for a client
   */
  async getClientInvoices(clientId: number): Promise<Invoice[]> {
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.client_id = ?
      ORDER BY i.created_at DESC
    `;

    const rows = await this.db.all(sql, [clientId]);

    return rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));
  }

  /**
   * Get all invoices for a project
   */
  async getProjectInvoices(projectId: number): Promise<Invoice[]> {
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.project_id = ?
      ORDER BY i.created_at DESC
    `;

    const rows = await this.db.all(sql, [projectId]);

    return rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(
    id: number,
    status: Invoice['status'],
    paymentData?: {
      amountPaid?: number;
      paymentMethod?: string;
      paymentReference?: string;
      paidDate?: string;
    }
  ): Promise<Invoice> {
    let sql = 'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: SqlValue[] = [status];

    if (paymentData) {
      if (paymentData.amountPaid !== undefined) {
        sql += ', amount_paid = ?';
        params.push(paymentData.amountPaid);
      }
      if (paymentData.paymentMethod) {
        sql += ', payment_method = ?';
        params.push(paymentData.paymentMethod);
      }
      if (paymentData.paymentReference) {
        sql += ', payment_reference = ?';
        params.push(paymentData.paymentReference);
      }
      if (paymentData.paidDate) {
        sql += ', paid_date = ?';
        params.push(paymentData.paidDate);
      }
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await this.db.run(sql, params);

    return this.getInvoiceById(id);
  }

  /**
   * Send invoice (update status to 'sent')
   */
  async sendInvoice(id: number): Promise<Invoice> {
    return this.updateInvoiceStatus(id, 'sent');
  }

  /**
   * Update invoice (only draft invoices can be fully edited)
   */
  async updateInvoice(id: number, data: Partial<InvoiceCreateData>): Promise<Invoice> {
    // Get current invoice to check status
    const currentInvoice = await this.getInvoiceById(id);

    if (currentInvoice.status !== 'draft') {
      throw new Error('Only draft invoices can be edited');
    }

    const updates: string[] = [];
    const params: SqlValue[] = [];

    if (data.lineItems && data.lineItems.length > 0) {
      const amountTotal = this.calculateTotal(data.lineItems);
      updates.push('line_items = ?', 'amount_total = ?');
      params.push(JSON.stringify(data.lineItems), amountTotal);
    }

    if (data.dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(data.dueDate);
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    if (data.terms !== undefined) {
      updates.push('terms = ?');
      params.push(data.terms);
    }

    if (data.billToName !== undefined) {
      updates.push('bill_to_name = ?');
      params.push(data.billToName);
    }

    if (data.billToEmail !== undefined) {
      updates.push('bill_to_email = ?');
      params.push(data.billToEmail);
    }

    if (data.servicesTitle !== undefined) {
      updates.push('services_title = ?');
      params.push(data.servicesTitle);
    }

    if (data.servicesDescription !== undefined) {
      updates.push('services_description = ?');
      params.push(data.servicesDescription);
    }

    if (data.deliverables !== undefined) {
      updates.push('deliverables = ?');
      params.push(data.deliverables ? JSON.stringify(data.deliverables) : null);
    }

    if (updates.length === 0) {
      return currentInvoice;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    await this.db.run(sql, params);

    return this.getInvoiceById(id);
  }

  /**
   * Mark invoice as paid
   */
  async markInvoiceAsPaid(
    id: number,
    paymentData: {
      amountPaid: number;
      paymentMethod: string;
      paymentReference?: string;
    }
  ): Promise<Invoice> {
    const paidDate = new Date().toISOString().split('T')[0];

    return this.updateInvoiceStatus(id, 'paid', {
      ...paymentData,
      paidDate
    });
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(clientId?: number): Promise<{
    totalInvoices: number;
    totalAmount: number;
    totalPaid: number;
    totalOutstanding: number;
    overdue: number;
  }> {
    let sql = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(amount_total) as total_amount,
        SUM(amount_paid) as total_paid,
        SUM(amount_total - amount_paid) as total_outstanding,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue
      FROM invoices
    `;

    const params: SqlValue[] = [];

    if (clientId) {
      sql += ' WHERE client_id = ?';
      params.push(clientId);
    }

    const row = await this.db.get(sql, params);

    return {
      totalInvoices: row?.total_invoices || 0,
      totalAmount: row?.total_amount || 0,
      totalPaid: row?.total_paid || 0,
      totalOutstanding: row?.total_outstanding || 0,
      overdue: row?.overdue || 0
    };
  }

  /**
   * Auto-generate invoice from project intake
   */
  async generateInvoiceFromIntake(intakeId: number): Promise<Invoice> {
    // First, get the intake data
    const intakeSql = `
      SELECT ci.*, p.id as project_id, c.id as client_id
      FROM client_intakes ci
      LEFT JOIN projects p ON ci.project_id = p.id
      LEFT JOIN clients c ON ci.client_id = c.id
      WHERE ci.id = ?
    `;

    const intake = await this.db.get(intakeSql, [intakeId]);

    if (!intake) {
      throw new Error(`Intake with ID ${intakeId} not found`);
    }

    if (!intake.project_id || !intake.client_id) {
      throw new Error('Intake must be converted to project and client first');
    }

    // Generate line items based on project type and budget
    const lineItems = this.generateLineItemsFromIntake(intake);

    // Create the invoice
    return this.createInvoice({
      projectId: intake.project_id,
      clientId: intake.client_id,
      lineItems,
      notes: `Generated from intake: ${intake.project_description}`,
      terms: 'Payment due within 30 days. 50% upfront, 50% on completion.'
    });
  }

  /**
   * Generate line items from intake data
   */
  private generateLineItemsFromIntake(intake: IntakeRecord): InvoiceLineItem[] {
    const lineItems: InvoiceLineItem[] = [];
    const projectType = intake.project_type || 'website';
    const budgetRange = intake.budget_range || '5k-10k';

    // Parse budget range to get estimate
    const budgetMatch = budgetRange.match(/(\d+)k?-?(\d+)?k?/);
    let baseAmount = 5000; // Default

    if (budgetMatch) {
      const min = parseInt(budgetMatch[1]) * (budgetMatch[1].length <= 2 ? 1000 : 1);
      const max = budgetMatch[2]
        ? parseInt(budgetMatch[2]) * (budgetMatch[2].length <= 2 ? 1000 : 1)
        : min;
      baseAmount = Math.floor((min + max) / 2);
    }

    // Generate line items based on project type
    switch (projectType.toLowerCase()) {
    case 'website':
    case 'business site':
      lineItems.push(
        {
          description: 'Website Design & Development',
          quantity: 1,
          rate: baseAmount * 0.7,
          amount: baseAmount * 0.7
        },
        {
          description: 'Content Management System Setup',
          quantity: 1,
          rate: baseAmount * 0.2,
          amount: baseAmount * 0.2
        },
        {
          description: 'SEO Optimization & Testing',
          quantity: 1,
          rate: baseAmount * 0.1,
          amount: baseAmount * 0.1
        }
      );
      break;

    case 'web app':
    case 'application':
      lineItems.push(
        {
          description: 'Application Development',
          quantity: 1,
          rate: baseAmount * 0.6,
          amount: baseAmount * 0.6
        },
        {
          description: 'Database Design & Setup',
          quantity: 1,
          rate: baseAmount * 0.2,
          amount: baseAmount * 0.2
        },
        {
          description: 'API Development',
          quantity: 1,
          rate: baseAmount * 0.1,
          amount: baseAmount * 0.1
        },
        {
          description: 'Testing & Deployment',
          quantity: 1,
          rate: baseAmount * 0.1,
          amount: baseAmount * 0.1
        }
      );
      break;

    case 'e-commerce':
      lineItems.push(
        {
          description: 'E-commerce Platform Development',
          quantity: 1,
          rate: baseAmount * 0.5,
          amount: baseAmount * 0.5
        },
        {
          description: 'Payment Integration',
          quantity: 1,
          rate: baseAmount * 0.2,
          amount: baseAmount * 0.2
        },
        {
          description: 'Product Catalog Setup',
          quantity: 1,
          rate: baseAmount * 0.2,
          amount: baseAmount * 0.2
        },
        {
          description: 'Security & Testing',
          quantity: 1,
          rate: baseAmount * 0.1,
          amount: baseAmount * 0.1
        }
      );
      break;

    case 'browser extension':
      lineItems.push(
        {
          description: 'Browser Extension Development',
          quantity: 1,
          rate: baseAmount * 0.8,
          amount: baseAmount * 0.8
        },
        {
          description: 'Cross-browser Compatibility',
          quantity: 1,
          rate: baseAmount * 0.1,
          amount: baseAmount * 0.1
        },
        {
          description: 'Store Submission & Review',
          quantity: 1,
          rate: baseAmount * 0.1,
          amount: baseAmount * 0.1
        }
      );
      break;

    default:
      lineItems.push(
        {
          description: `${projectType} Development`,
          quantity: 1,
          rate: baseAmount * 0.8,
          amount: baseAmount * 0.8
        },
        {
          description: 'Testing & Deployment',
          quantity: 1,
          rate: baseAmount * 0.2,
          amount: baseAmount * 0.2
        }
      );
    }

    return lineItems;
  }

  /**
   * Map database row to Invoice object
   */
  private mapRowToInvoice(row: InvoiceRow): Invoice {
    // Helper to parse optional numeric fields
    const parseNum = (val: string | number | undefined): number | undefined => {
      if (val === undefined || val === null) return undefined;
      return typeof val === 'string' ? parseFloat(val) : val;
    };

    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      projectId: row.project_id,
      clientId: row.client_id,
      amountTotal: typeof row.amount_total === 'string' ? parseFloat(row.amount_total) : row.amount_total,
      amountPaid: typeof row.amount_paid === 'string' ? parseFloat(row.amount_paid) : (row.amount_paid || 0),
      currency: row.currency,
      status: row.status,
      dueDate: row.due_date,
      issuedDate: row.issued_date,
      paidDate: row.paid_date,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      lineItems: JSON.parse(row.line_items || '[]'),
      notes: row.notes,
      terms: row.terms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Custom business info
      businessName: row.business_name || BUSINESS_INFO.name,
      businessContact: row.business_contact || BUSINESS_INFO.contact,
      businessEmail: row.business_email || BUSINESS_INFO.email,
      businessWebsite: row.business_website || BUSINESS_INFO.website,
      // Payment methods
      venmoHandle: row.venmo_handle || BUSINESS_INFO.venmoHandle,
      paypalEmail: row.paypal_email || BUSINESS_INFO.paypalEmail,
      // Services fields
      servicesTitle: row.services_title,
      servicesDescription: row.services_description,
      deliverables: row.deliverables ? JSON.parse(row.deliverables) : [],
      features: row.features,
      // Bill To overrides
      billToName: row.bill_to_name,
      billToEmail: row.bill_to_email,
      // Deposit invoice fields
      invoiceType: row.invoice_type || 'standard',
      depositForProjectId: row.deposit_for_project_id,
      depositPercentage: row.deposit_percentage
        ? (typeof row.deposit_percentage === 'string' ? parseFloat(row.deposit_percentage) : row.deposit_percentage)
        : undefined,
      // Advanced features - Tax
      subtotal: parseNum(row.subtotal),
      taxRate: parseNum(row.tax_rate),
      taxAmount: parseNum(row.tax_amount),
      // Advanced features - Discount
      discountType: row.discount_type as 'percentage' | 'fixed' | undefined,
      discountValue: parseNum(row.discount_value),
      discountAmount: parseNum(row.discount_amount),
      // Advanced features - Late fees
      lateFeeRate: parseNum(row.late_fee_rate),
      lateFeeType: row.late_fee_type as 'none' | 'flat' | 'percentage' | 'daily_percentage' | undefined,
      lateFeeAmount: parseNum(row.late_fee_amount),
      lateFeeAppliedAt: row.late_fee_applied_at,
      // Advanced features - Payment terms
      paymentTermsId: row.payment_terms_id,
      paymentTermsName: row.payment_terms_name,
      // Advanced features - Internal notes
      internalNotes: row.internal_notes,
      // Advanced features - Invoice number customization
      invoicePrefix: row.invoice_prefix,
      invoiceSequence: row.invoice_sequence
    };
  }

  /**
   * Create a deposit invoice for a project
   */
  async createDepositInvoice(
    projectId: number,
    clientId: number,
    amount: number,
    percentage?: number,
    description?: string
  ): Promise<Invoice> {
    const invoiceNumber = this.generateInvoiceNumber();
    const issuedDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const lineItems: InvoiceLineItem[] = [{
      description: description || 'Project Deposit',
      quantity: 1,
      rate: amount,
      amount: amount
    }];

    const sql = `
      INSERT INTO invoices (
        invoice_number, project_id, client_id, amount_total, amount_paid,
        currency, status, due_date, issued_date, line_items, notes, terms,
        business_name, business_contact, business_email, business_website,
        venmo_handle, paypal_email, invoice_type, deposit_for_project_id, deposit_percentage
      ) VALUES (?, ?, ?, ?, 0, 'USD', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'deposit', ?, ?)
    `;

    const result = await this.db.run(sql, [
      invoiceNumber,
      projectId,
      clientId,
      amount,
      dueDate,
      issuedDate,
      JSON.stringify(lineItems),
      percentage ? `Deposit (${percentage}% of project total)` : 'Project Deposit',
      'Payment due within 14 days. This deposit secures your project slot.',
      BUSINESS_INFO.name,
      BUSINESS_INFO.contact,
      BUSINESS_INFO.email,
      BUSINESS_INFO.website,
      BUSINESS_INFO.venmoHandle,
      BUSINESS_INFO.paypalEmail,
      projectId,
      percentage || null
    ]);

    return this.getInvoiceById(result.lastID!);
  }

  /**
   * Get available deposits for a project (paid but not fully applied)
   */
  async getAvailableDeposits(projectId: number): Promise<DepositSummary[]> {
    // Get all paid deposit invoices for this project
    const depositsSql = `
      SELECT i.id, i.invoice_number, i.amount_total, i.paid_date
      FROM invoices i
      WHERE i.deposit_for_project_id = ?
        AND i.invoice_type = 'deposit'
        AND i.status = 'paid'
    `;

    const deposits = await this.db.all(depositsSql, [projectId]);

    if (!deposits || deposits.length === 0) {
      return [];
    }

    // For each deposit, calculate how much has been applied as credits
    const summaries: DepositSummary[] = [];

    for (const deposit of deposits) {
      const appliedSql = `
        SELECT COALESCE(SUM(amount), 0) as total_applied
        FROM invoice_credits
        WHERE deposit_invoice_id = ?
      `;
      const appliedResult = await this.db.get(appliedSql, [deposit.id]);
      const totalApplied = appliedResult?.total_applied || 0;
      const totalAmount = typeof deposit.amount_total === 'string'
        ? parseFloat(deposit.amount_total)
        : deposit.amount_total;
      const availableAmount = totalAmount - totalApplied;

      if (availableAmount > 0) {
        summaries.push({
          invoiceId: deposit.id,
          invoiceNumber: deposit.invoice_number,
          totalAmount,
          amountApplied: totalApplied,
          availableAmount,
          paidDate: deposit.paid_date
        });
      }
    }

    return summaries;
  }

  /**
   * Apply deposit credit to an invoice
   */
  async applyDepositCredit(
    invoiceId: number,
    depositInvoiceId: number,
    amount: number,
    appliedBy?: string
  ): Promise<InvoiceCredit> {
    // Verify the deposit invoice exists and has available credit
    const depositInvoice = await this.getInvoiceById(depositInvoiceId);
    if (depositInvoice.invoiceType !== 'deposit' || depositInvoice.status !== 'paid') {
      throw new Error('Invalid deposit invoice or deposit not paid');
    }

    // Get available amount for this deposit
    const appliedSql = `
      SELECT COALESCE(SUM(amount), 0) as total_applied
      FROM invoice_credits
      WHERE deposit_invoice_id = ?
    `;
    const appliedResult = await this.db.get(appliedSql, [depositInvoiceId]);
    const totalApplied = appliedResult?.total_applied || 0;
    const availableAmount = depositInvoice.amountTotal - totalApplied;

    if (amount > availableAmount) {
      throw new Error(`Insufficient deposit credit. Available: $${availableAmount.toFixed(2)}`);
    }

    // Verify the target invoice exists
    const targetInvoice = await this.getInvoiceById(invoiceId);
    if (targetInvoice.invoiceType === 'deposit') {
      throw new Error('Cannot apply credit to a deposit invoice');
    }

    // Insert the credit record
    const insertSql = `
      INSERT INTO invoice_credits (invoice_id, deposit_invoice_id, amount, applied_by)
      VALUES (?, ?, ?, ?)
    `;
    const result = await this.db.run(insertSql, [invoiceId, depositInvoiceId, amount, appliedBy || null]);

    // Update the target invoice's amount_paid
    const updateSql = `
      UPDATE invoices
      SET amount_paid = amount_paid + ?,
          status = CASE
            WHEN amount_paid + ? >= amount_total THEN 'paid'
            WHEN amount_paid + ? > 0 THEN 'partial'
            ELSE status
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(updateSql, [amount, amount, amount, invoiceId]);

    return {
      id: result.lastID!,
      invoiceId,
      depositInvoiceId,
      depositInvoiceNumber: depositInvoice.invoiceNumber,
      amount,
      appliedAt: new Date().toISOString(),
      appliedBy
    };
  }

  /**
   * Get credits applied to an invoice
   */
  async getInvoiceCredits(invoiceId: number): Promise<InvoiceCredit[]> {
    const sql = `
      SELECT ic.*, i.invoice_number as deposit_invoice_number
      FROM invoice_credits ic
      JOIN invoices i ON ic.deposit_invoice_id = i.id
      WHERE ic.invoice_id = ?
      ORDER BY ic.applied_at ASC
    `;

    const rows: InvoiceCreditRow[] = await this.db.all(sql, [invoiceId]);

    return rows.map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      depositInvoiceId: row.deposit_invoice_id,
      depositInvoiceNumber: row.deposit_invoice_number,
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
      appliedAt: row.applied_at,
      appliedBy: row.applied_by
    }));
  }

  /**
   * Get total credits applied to an invoice
   */
  async getTotalCredits(invoiceId: number): Promise<number> {
    const sql = `
      SELECT COALESCE(SUM(amount), 0) as total_credits
      FROM invoice_credits
      WHERE invoice_id = ?
    `;
    const result = await this.db.get(sql, [invoiceId]);
    return result?.total_credits || 0;
  }

  // ============================================
  // PAYMENT PLAN TEMPLATE METHODS
  // ============================================

  /**
   * Create a new payment plan template
   */
  async createPaymentPlanTemplate(data: {
    name: string;
    description?: string;
    payments: PaymentPlanPayment[];
    isDefault?: boolean;
  }): Promise<PaymentPlanTemplate> {
    const sql = `
      INSERT INTO payment_plan_templates (name, description, payments, is_default)
      VALUES (?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      data.name,
      data.description || null,
      JSON.stringify(data.payments),
      data.isDefault ? 1 : 0
    ]);

    return this.getPaymentPlanTemplate(result.lastID!);
  }

  /**
   * Get all payment plan templates
   */
  async getPaymentPlanTemplates(): Promise<PaymentPlanTemplate[]> {
    const sql = 'SELECT * FROM payment_plan_templates ORDER BY is_default DESC, name ASC';
    const rows = await this.db.all(sql);

    return rows.map((row: PaymentPlanTemplateRow) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      payments: JSON.parse(row.payments),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at
    }));
  }

  /**
   * Get a single payment plan template by ID
   */
  async getPaymentPlanTemplate(id: number): Promise<PaymentPlanTemplate> {
    const sql = 'SELECT * FROM payment_plan_templates WHERE id = ?';
    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Payment plan template with ID ${id} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      payments: JSON.parse(row.payments),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at
    };
  }

  /**
   * Delete a payment plan template
   */
  async deletePaymentPlanTemplate(id: number): Promise<void> {
    const sql = 'DELETE FROM payment_plan_templates WHERE id = ?';
    await this.db.run(sql, [id]);
  }

  /**
   * Generate invoices from a payment plan template
   */
  async generateInvoicesFromTemplate(
    projectId: number,
    clientId: number,
    templateId: number,
    totalAmount: number
  ): Promise<Invoice[]> {
    const template = await this.getPaymentPlanTemplate(templateId);
    const invoices: Invoice[] = [];

    for (const payment of template.payments) {
      const amount = (totalAmount * payment.percentage) / 100;
      const lineItems: InvoiceLineItem[] = [{
        description: payment.label || `Payment (${payment.percentage}%)`,
        quantity: 1,
        rate: amount,
        amount: amount
      }];

      // Determine due date based on trigger
      let dueDate: string | undefined;
      const today = new Date();

      switch (payment.trigger) {
      case 'upfront':
        dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'midpoint':
        dueDate = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'completion':
        dueDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const invoice = await this.createInvoice({
        projectId,
        clientId,
        lineItems,
        dueDate,
        notes: `Generated from payment plan: ${template.name}`,
        terms: 'Payment due by the date specified above.'
      });

      // Link invoice to payment plan
      await this.db.run(
        'UPDATE invoices SET payment_plan_id = ? WHERE id = ?',
        [templateId, invoice.id]
      );

      invoices.push(invoice);
    }

    return invoices;
  }

  // ============================================
  // MILESTONE-LINKED INVOICE METHODS
  // ============================================

  /**
   * Create an invoice linked to a milestone
   */
  async createMilestoneInvoice(milestoneId: number, data: InvoiceCreateData): Promise<Invoice> {
    const invoice = await this.createInvoice(data);

    // Link invoice to milestone
    await this.db.run(
      'UPDATE invoices SET milestone_id = ? WHERE id = ?',
      [milestoneId, invoice.id]
    );

    return this.getInvoiceById(invoice.id!);
  }

  /**
   * Get all invoices linked to a milestone
   */
  async getInvoicesByMilestone(milestoneId: number): Promise<Invoice[]> {
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.milestone_id = ?
      ORDER BY i.created_at DESC
    `;

    const rows = await this.db.all(sql, [milestoneId]);
    return rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));
  }

  /**
   * Link an existing invoice to a milestone
   */
  async linkInvoiceToMilestone(invoiceId: number, milestoneId: number): Promise<Invoice> {
    await this.db.run(
      'UPDATE invoices SET milestone_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [milestoneId, invoiceId]
    );

    return this.getInvoiceById(invoiceId);
  }

  // ============================================
  // INVOICE SCHEDULING METHODS
  // ============================================

  /**
   * Schedule an invoice for future generation
   */
  async scheduleInvoice(data: ScheduledInvoiceData): Promise<ScheduledInvoice> {
    const sql = `
      INSERT INTO scheduled_invoices (
        project_id, client_id, scheduled_date, trigger_type,
        trigger_milestone_id, line_items, notes, terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      data.projectId,
      data.clientId,
      data.scheduledDate,
      data.triggerType || 'date',
      data.triggerMilestoneId || null,
      JSON.stringify(data.lineItems),
      data.notes || null,
      data.terms || null
    ]);

    return this.getScheduledInvoiceById(result.lastID!);
  }

  /**
   * Get a scheduled invoice by ID
   */
  private async getScheduledInvoiceById(id: number): Promise<ScheduledInvoice> {
    const sql = 'SELECT * FROM scheduled_invoices WHERE id = ?';
    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Scheduled invoice with ID ${id} not found`);
    }

    return this.mapScheduledInvoiceRow(row);
  }

  /**
   * Get all scheduled invoices, optionally filtered by project
   */
  async getScheduledInvoices(projectId?: number): Promise<ScheduledInvoice[]> {
    let sql = 'SELECT * FROM scheduled_invoices WHERE status = \'pending\'';
    const params: SqlValue[] = [];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY scheduled_date ASC';

    const rows = await this.db.all(sql, params);
    return rows.map((row: ScheduledInvoiceRow) => this.mapScheduledInvoiceRow(row));
  }

  /**
   * Cancel a scheduled invoice
   */
  async cancelScheduledInvoice(id: number): Promise<void> {
    await this.db.run(
      'UPDATE scheduled_invoices SET status = ? WHERE id = ?',
      ['cancelled', id]
    );
  }

  /**
   * Process due scheduled invoices and generate actual invoices
   */
  async processScheduledInvoices(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      SELECT * FROM scheduled_invoices
      WHERE status = 'pending'
        AND trigger_type = 'date'
        AND scheduled_date <= ?
    `;

    const dueInvoices = await this.db.all(sql, [today]);
    let generatedCount = 0;

    for (const scheduled of dueInvoices) {
      try {
        const invoice = await this.createInvoice({
          projectId: scheduled.project_id,
          clientId: scheduled.client_id,
          lineItems: JSON.parse(scheduled.line_items),
          notes: scheduled.notes,
          terms: scheduled.terms
        });

        await this.db.run(
          'UPDATE scheduled_invoices SET status = ?, generated_invoice_id = ? WHERE id = ?',
          ['generated', invoice.id, scheduled.id]
        );

        generatedCount++;
      } catch (error) {
        console.error(`[InvoiceService] Failed to generate scheduled invoice ${scheduled.id}:`, error);
      }
    }

    return generatedCount;
  }

  /**
   * Map a scheduled invoice database row to object
   */
  private mapScheduledInvoiceRow(row: ScheduledInvoiceRow): ScheduledInvoice {
    return {
      id: row.id,
      projectId: row.project_id,
      clientId: row.client_id,
      scheduledDate: row.scheduled_date,
      triggerType: row.trigger_type as 'date' | 'milestone_complete',
      triggerMilestoneId: row.trigger_milestone_id,
      lineItems: JSON.parse(row.line_items),
      notes: row.notes,
      terms: row.terms,
      status: row.status as 'pending' | 'generated' | 'cancelled',
      generatedInvoiceId: row.generated_invoice_id,
      createdAt: row.created_at
    };
  }

  // ============================================
  // RECURRING INVOICE METHODS
  // ============================================

  /**
   * Create a recurring invoice pattern
   */
  async createRecurringInvoice(data: RecurringInvoiceData): Promise<RecurringInvoice> {
    // Calculate the next generation date based on frequency
    const nextDate = this.calculateNextGenerationDate(
      data.startDate,
      data.frequency,
      data.dayOfMonth,
      data.dayOfWeek
    );

    const sql = `
      INSERT INTO recurring_invoices (
        project_id, client_id, frequency, day_of_month, day_of_week,
        line_items, notes, terms, start_date, end_date, next_generation_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      data.projectId,
      data.clientId,
      data.frequency,
      data.dayOfMonth || null,
      data.dayOfWeek || null,
      JSON.stringify(data.lineItems),
      data.notes || null,
      data.terms || null,
      data.startDate,
      data.endDate || null,
      nextDate
    ]);

    return this.getRecurringInvoiceById(result.lastID!);
  }

  /**
   * Get a recurring invoice by ID
   */
  private async getRecurringInvoiceById(id: number): Promise<RecurringInvoice> {
    const sql = 'SELECT * FROM recurring_invoices WHERE id = ?';
    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Recurring invoice with ID ${id} not found`);
    }

    return this.mapRecurringInvoiceRow(row);
  }

  /**
   * Get all recurring invoices, optionally filtered by project
   */
  async getRecurringInvoices(projectId?: number): Promise<RecurringInvoice[]> {
    let sql = 'SELECT * FROM recurring_invoices';
    const params: SqlValue[] = [];

    if (projectId) {
      sql += ' WHERE project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY next_generation_date ASC';

    const rows = await this.db.all(sql, params);
    return rows.map((row: RecurringInvoiceRow) => this.mapRecurringInvoiceRow(row));
  }

  /**
   * Update a recurring invoice pattern
   */
  async updateRecurringInvoice(id: number, data: Partial<RecurringInvoiceData>): Promise<RecurringInvoice> {
    const updates: string[] = [];
    const params: SqlValue[] = [];

    if (data.frequency !== undefined) {
      updates.push('frequency = ?');
      params.push(data.frequency);
    }
    if (data.dayOfMonth !== undefined) {
      updates.push('day_of_month = ?');
      params.push(data.dayOfMonth);
    }
    if (data.dayOfWeek !== undefined) {
      updates.push('day_of_week = ?');
      params.push(data.dayOfWeek);
    }
    if (data.lineItems !== undefined) {
      updates.push('line_items = ?');
      params.push(JSON.stringify(data.lineItems));
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }
    if (data.terms !== undefined) {
      updates.push('terms = ?');
      params.push(data.terms);
    }
    if (data.endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(data.endDate);
    }

    if (updates.length === 0) {
      return this.getRecurringInvoiceById(id);
    }

    params.push(id);
    const sql = `UPDATE recurring_invoices SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.run(sql, params);

    return this.getRecurringInvoiceById(id);
  }

  /**
   * Pause a recurring invoice
   */
  async pauseRecurringInvoice(id: number): Promise<void> {
    await this.db.run(
      'UPDATE recurring_invoices SET is_active = 0 WHERE id = ?',
      [id]
    );
  }

  /**
   * Resume a paused recurring invoice
   */
  async resumeRecurringInvoice(id: number): Promise<void> {
    const recurring = await this.getRecurringInvoiceById(id);

    // Recalculate next generation date from today
    const nextDate = this.calculateNextGenerationDate(
      new Date().toISOString().split('T')[0],
      recurring.frequency,
      recurring.dayOfMonth,
      recurring.dayOfWeek
    );

    await this.db.run(
      'UPDATE recurring_invoices SET is_active = 1, next_generation_date = ? WHERE id = ?',
      [nextDate, id]
    );
  }

  /**
   * Delete a recurring invoice pattern
   */
  async deleteRecurringInvoice(id: number): Promise<void> {
    await this.db.run('DELETE FROM recurring_invoices WHERE id = ?', [id]);
  }

  /**
   * Process due recurring invoices and generate actual invoices
   */
  async processRecurringInvoices(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      SELECT * FROM recurring_invoices
      WHERE is_active = 1
        AND next_generation_date <= ?
        AND (end_date IS NULL OR end_date >= ?)
    `;

    const dueRecurring = await this.db.all(sql, [today, today]);
    let generatedCount = 0;

    for (const recurring of dueRecurring) {
      try {
        // Generate the invoice
        await this.createInvoice({
          projectId: recurring.project_id,
          clientId: recurring.client_id,
          lineItems: JSON.parse(recurring.line_items),
          notes: recurring.notes,
          terms: recurring.terms
        });

        // Calculate next generation date
        const nextDate = this.calculateNextGenerationDate(
          recurring.next_generation_date,
          recurring.frequency,
          recurring.day_of_month,
          recurring.day_of_week
        );

        // Update the recurring invoice
        await this.db.run(
          'UPDATE recurring_invoices SET last_generated_at = CURRENT_TIMESTAMP, next_generation_date = ? WHERE id = ?',
          [nextDate, recurring.id]
        );

        generatedCount++;
      } catch (error) {
        console.error(`[InvoiceService] Failed to generate recurring invoice ${recurring.id}:`, error);
      }
    }

    return generatedCount;
  }

  /**
   * Calculate the next generation date based on frequency
   */
  private calculateNextGenerationDate(
    fromDate: string,
    frequency: string,
    dayOfMonth?: number,
    dayOfWeek?: number
  ): string {
    const from = new Date(fromDate);
    const next = new Date(from);

    switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      if (dayOfWeek !== undefined && dayOfWeek !== null) {
        // Adjust to the specified day of week
        const currentDay = next.getDay();
        const diff = dayOfWeek - currentDay;
        next.setDate(next.getDate() + (diff >= 0 ? diff : diff + 7));
      }
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth !== undefined && dayOfMonth !== null) {
        // Set to specified day, handling month-end edge cases
        const targetDay = Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
        next.setDate(targetDay);
      }
      break;

    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonth !== undefined && dayOfMonth !== null) {
        const targetDay = Math.min(dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
        next.setDate(targetDay);
      }
      break;

    default:
      next.setMonth(next.getMonth() + 1);
    }

    return next.toISOString().split('T')[0];
  }

  /**
   * Map a recurring invoice database row to object
   */
  private mapRecurringInvoiceRow(row: RecurringInvoiceRow): RecurringInvoice {
    return {
      id: row.id,
      projectId: row.project_id,
      clientId: row.client_id,
      frequency: row.frequency as 'weekly' | 'monthly' | 'quarterly',
      dayOfMonth: row.day_of_month,
      dayOfWeek: row.day_of_week,
      lineItems: JSON.parse(row.line_items),
      notes: row.notes,
      terms: row.terms,
      startDate: row.start_date,
      endDate: row.end_date,
      nextGenerationDate: row.next_generation_date,
      lastGeneratedAt: row.last_generated_at,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at
    };
  }

  // ============================================
  // PAYMENT REMINDER METHODS
  // ============================================

  /**
   * Schedule reminders for an invoice when it's sent
   */
  async scheduleReminders(invoiceId: number): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (!invoice.dueDate) {
      console.warn(`[InvoiceService] Cannot schedule reminders for invoice ${invoiceId} without due date`);
      return;
    }

    const dueDate = new Date(invoice.dueDate);
    const reminderSchedule: Array<{ type: string; daysFromDue: number }> = [
      { type: 'upcoming', daysFromDue: -3 },
      { type: 'due', daysFromDue: 0 },
      { type: 'overdue_3', daysFromDue: 3 },
      { type: 'overdue_7', daysFromDue: 7 },
      { type: 'overdue_14', daysFromDue: 14 },
      { type: 'overdue_30', daysFromDue: 30 }
    ];

    for (const reminder of reminderSchedule) {
      const scheduledDate = new Date(dueDate);
      scheduledDate.setDate(scheduledDate.getDate() + reminder.daysFromDue);

      // Skip reminders in the past
      if (scheduledDate < new Date()) {
        continue;
      }

      await this.db.run(
        'INSERT INTO invoice_reminders (invoice_id, reminder_type, scheduled_date) VALUES (?, ?, ?)',
        [invoiceId, reminder.type, scheduledDate.toISOString().split('T')[0]]
      );
    }
  }

  /**
   * Get all reminders for an invoice
   */
  async getInvoiceReminders(invoiceId: number): Promise<InvoiceReminder[]> {
    const sql = 'SELECT * FROM invoice_reminders WHERE invoice_id = ? ORDER BY scheduled_date ASC';
    const rows = await this.db.all(sql, [invoiceId]);

    return rows.map((row: InvoiceReminderRow) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      reminderType: row.reminder_type as 'upcoming' | 'due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30',
      scheduledDate: row.scheduled_date,
      sentAt: row.sent_at,
      status: row.status as 'pending' | 'sent' | 'skipped' | 'failed',
      createdAt: row.created_at
    }));
  }

  /**
   * Mark a reminder as sent
   */
  async markReminderSent(reminderId: number): Promise<void> {
    await this.db.run(
      'UPDATE invoice_reminders SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['sent', reminderId]
    );
  }

  /**
   * Skip a reminder (won't be sent)
   */
  async skipReminder(reminderId: number): Promise<void> {
    await this.db.run(
      'UPDATE invoice_reminders SET status = ? WHERE id = ?',
      ['skipped', reminderId]
    );
  }

  /**
   * Process due reminders and return count of reminders ready to send
   */
  async processReminders(): Promise<InvoiceReminder[]> {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      SELECT r.*, i.status as invoice_status
      FROM invoice_reminders r
      JOIN invoices i ON r.invoice_id = i.id
      WHERE r.status = 'pending'
        AND r.scheduled_date <= ?
        AND i.status NOT IN ('paid', 'cancelled')
    `;

    const dueReminders = await this.db.all(sql, [today]);

    return dueReminders.map((row: InvoiceReminderRow) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      reminderType: row.reminder_type as 'upcoming' | 'due' | 'overdue_3' | 'overdue_7' | 'overdue_14' | 'overdue_30',
      scheduledDate: row.scheduled_date,
      sentAt: row.sent_at,
      status: row.status as 'pending' | 'sent' | 'skipped' | 'failed',
      createdAt: row.created_at
    }));
  }

  /**
   * Mark a reminder as failed
   */
  async markReminderFailed(reminderId: number): Promise<void> {
    await this.db.run(
      'UPDATE invoice_reminders SET status = ? WHERE id = ?',
      ['failed', reminderId]
    );
  }

  // ============================================
  // DELETE / VOID INVOICE
  // ============================================

  /**
   * Delete a draft invoice or void a sent invoice
   * - Draft/Cancelled invoices are permanently deleted
   * - Sent/Viewed/Partial/Overdue invoices are marked as 'cancelled' (void)
   * - Paid invoices cannot be deleted or voided
   */
  async deleteOrVoidInvoice(id: number): Promise<{ action: 'deleted' | 'voided' }> {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status === 'paid') {
      throw new Error('Paid invoices cannot be deleted or voided');
    }

    // Draft and cancelled invoices can be permanently deleted
    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      // Delete related records first
      await this.db.run('DELETE FROM invoice_reminders WHERE invoice_id = ?', [id]);
      await this.db.run('DELETE FROM invoice_credits WHERE invoice_id = ?', [id]);
      await this.db.run('DELETE FROM invoices WHERE id = ?', [id]);
      return { action: 'deleted' };
    }

    // Sent/Viewed/Partial/Overdue invoices are voided (soft delete)
    await this.db.run(
      'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['cancelled', id]
    );

    // Cancel pending reminders
    await this.db.run(
      'UPDATE invoice_reminders SET status = ? WHERE invoice_id = ? AND status = ?',
      ['skipped', id, 'pending']
    );

    return { action: 'voided' };
  }

  // ============================================
  // DUPLICATE / CLONE INVOICE
  // ============================================

  /**
   * Duplicate an existing invoice (creates a new draft copy)
   */
  async duplicateInvoice(id: number): Promise<Invoice> {
    const original = await this.getInvoiceById(id);

    const invoiceNumber = this.generateInvoiceNumber();
    const issuedDate = new Date().toISOString().split('T')[0];

    // Calculate new due date (same days from issue as original, or 30 days default)
    let dueDate: string;
    if (original.dueDate && original.issuedDate) {
      const originalDueDays = Math.ceil(
        (new Date(original.dueDate).getTime() - new Date(original.issuedDate).getTime()) / (24 * 60 * 60 * 1000)
      );
      dueDate = new Date(Date.now() + originalDueDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    } else {
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const sql = `
      INSERT INTO invoices (
        invoice_number, project_id, client_id, amount_total, amount_paid,
        currency, status, due_date, issued_date, line_items, notes, terms,
        business_name, business_contact, business_email, business_website,
        venmo_handle, paypal_email, services_title, services_description,
        deliverables, features, bill_to_name, bill_to_email, invoice_type
      ) VALUES (?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      invoiceNumber,
      original.projectId,
      original.clientId,
      original.amountTotal,
      original.currency,
      dueDate,
      issuedDate,
      JSON.stringify(original.lineItems),
      original.notes ? `Copy of ${original.invoiceNumber}: ${original.notes}` : `Copy of ${original.invoiceNumber}`,
      original.terms,
      original.businessName,
      original.businessContact,
      original.businessEmail,
      original.businessWebsite,
      original.venmoHandle,
      original.paypalEmail,
      original.servicesTitle,
      original.servicesDescription,
      original.deliverables ? JSON.stringify(original.deliverables) : null,
      original.features,
      original.billToName,
      original.billToEmail,
      'standard' // Duplicates are always standard invoices
    ]);

    return this.getInvoiceById(result.lastID!);
  }

  // ============================================
  // RECORD PARTIAL PAYMENT
  // ============================================

  /**
   * Record a partial or full payment on an invoice
   */
  async recordPayment(
    id: number,
    amount: number,
    paymentMethod: string,
    paymentReference?: string
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceById(id);

    if (invoice.status === 'paid') {
      throw new Error('Invoice is already fully paid');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('Cannot record payment on a cancelled invoice');
    }

    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const newAmountPaid = invoice.amountPaid + amount;
    const remaining = invoice.amountTotal - newAmountPaid;

    let newStatus: Invoice['status'];
    let paidDate: string | null = null;

    if (remaining <= 0.01) { // Allow small floating point tolerance
      newStatus = 'paid';
      paidDate = new Date().toISOString().split('T')[0];
    } else {
      newStatus = 'partial';
    }

    await this.db.run(
      `UPDATE invoices SET
        amount_paid = ?,
        status = ?,
        payment_method = ?,
        payment_reference = ?,
        paid_date = COALESCE(?, paid_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [newAmountPaid, newStatus, paymentMethod, paymentReference || null, paidDate, id]
    );

    // If fully paid, skip remaining reminders
    if (newStatus === 'paid') {
      await this.db.run(
        'UPDATE invoice_reminders SET status = ? WHERE invoice_id = ? AND status = ?',
        ['skipped', id, 'pending']
      );
    }

    return this.getInvoiceById(id);
  }

  // ============================================
  // AUTO-MARK OVERDUE
  // ============================================

  /**
   * Check and mark invoices as overdue
   * Returns count of invoices marked as overdue
   */
  async checkAndMarkOverdue(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    const result = await this.db.run(
      `UPDATE invoices
       SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
       WHERE status IN ('sent', 'viewed', 'partial')
         AND due_date < ?
         AND due_date IS NOT NULL`,
      [today]
    );

    return result.changes || 0;
  }

  // ============================================
  // INVOICE SEARCH WITH FILTERS
  // ============================================

  /**
   * Search invoices with filters and pagination
   */
  async searchInvoices(filters: {
    clientId?: number;
    projectId?: number;
    status?: Invoice['status'] | Invoice['status'][];
    invoiceType?: 'standard' | 'deposit';
    search?: string; // Search in invoice number, notes
    dateFrom?: string;
    dateTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: Invoice[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: SqlValue[] = [];

    if (filters.clientId) {
      conditions.push('i.client_id = ?');
      params.push(filters.clientId);
    }

    if (filters.projectId) {
      conditions.push('i.project_id = ?');
      params.push(filters.projectId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(`i.status IN (${filters.status.map(() => '?').join(',')})`);
        params.push(...filters.status);
      } else {
        conditions.push('i.status = ?');
        params.push(filters.status);
      }
    }

    if (filters.invoiceType) {
      conditions.push('i.invoice_type = ?');
      params.push(filters.invoiceType);
    }

    if (filters.search) {
      conditions.push('(i.invoice_number LIKE ? OR i.notes LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.dateFrom) {
      conditions.push('i.issued_date >= ?');
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push('i.issued_date <= ?');
      params.push(filters.dateTo);
    }

    if (filters.dueDateFrom) {
      conditions.push('i.due_date >= ?');
      params.push(filters.dueDateFrom);
    }

    if (filters.dueDateTo) {
      conditions.push('i.due_date <= ?');
      params.push(filters.dueDateTo);
    }

    if (filters.minAmount !== undefined) {
      conditions.push('i.amount_total >= ?');
      params.push(filters.minAmount);
    }

    if (filters.maxAmount !== undefined) {
      conditions.push('i.amount_total <= ?');
      params.push(filters.maxAmount);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM invoices i WHERE ${whereClause}`;
    const countResult = await this.db.get(countSql, params);
    const total = countResult?.total || 0;

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await this.db.all(sql, [...params, limit, offset]);
    const invoices = rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));

    return { invoices, total };
  }

  // ============================================
  // GET ALL INVOICES (FOR ADMIN)
  // ============================================

  /**
   * Get all invoices with optional pagination
   */
  async getAllInvoices(limit = 100, offset = 0): Promise<Invoice[]> {
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await this.db.all(sql, [limit, offset]);
    return rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));
  }

  // ============================================
  // PAYMENT TERMS PRESETS
  // ============================================

  /**
   * Get all payment terms presets
   */
  async getPaymentTermsPresets(): Promise<PaymentTermsPreset[]> {
    const sql = 'SELECT * FROM payment_terms_presets ORDER BY days_until_due ASC';
    const rows = await this.db.all(sql);

    return rows.map((row: PaymentTermsPresetRow) => ({
      id: row.id,
      name: row.name,
      daysUntilDue: row.days_until_due,
      description: row.description,
      lateFeeRate: row.late_fee_rate,
      lateFeeType: (row.late_fee_type || 'none') as PaymentTermsPreset['lateFeeType'],
      lateFeeFlatAmount: row.late_fee_flat_amount,
      gracePeriodDays: row.grace_period_days || 0,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at
    }));
  }

  /**
   * Get a single payment terms preset
   */
  async getPaymentTermsPreset(id: number): Promise<PaymentTermsPreset> {
    const sql = 'SELECT * FROM payment_terms_presets WHERE id = ?';
    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Payment terms preset with ID ${id} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      daysUntilDue: row.days_until_due,
      description: row.description,
      lateFeeRate: row.late_fee_rate,
      lateFeeType: (row.late_fee_type || 'none') as PaymentTermsPreset['lateFeeType'],
      lateFeeFlatAmount: row.late_fee_flat_amount,
      gracePeriodDays: row.grace_period_days || 0,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at
    };
  }

  /**
   * Create a custom payment terms preset
   */
  async createPaymentTermsPreset(data: {
    name: string;
    daysUntilDue: number;
    description?: string;
    lateFeeRate?: number;
    lateFeeType?: 'none' | 'flat' | 'percentage' | 'daily_percentage';
    lateFeeFlatAmount?: number;
    gracePeriodDays?: number;
    isDefault?: boolean;
  }): Promise<PaymentTermsPreset> {
    const sql = `
      INSERT INTO payment_terms_presets (
        name, days_until_due, description, late_fee_rate,
        late_fee_type, late_fee_flat_amount, grace_period_days, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      data.name,
      data.daysUntilDue,
      data.description || null,
      data.lateFeeRate || null,
      data.lateFeeType || 'none',
      data.lateFeeFlatAmount || null,
      data.gracePeriodDays || 0,
      data.isDefault ? 1 : 0
    ]);

    return this.getPaymentTermsPreset(result.lastID!);
  }

  /**
   * Apply payment terms to an invoice
   */
  async applyPaymentTerms(invoiceId: number, termsId: number): Promise<Invoice> {
    const terms = await this.getPaymentTermsPreset(termsId);
    const invoice = await this.getInvoiceById(invoiceId);

    // Calculate due date based on issued date and terms
    const issuedDate = new Date(invoice.issuedDate || new Date().toISOString().split('T')[0]);
    const dueDate = new Date(issuedDate);
    dueDate.setDate(dueDate.getDate() + terms.daysUntilDue);

    await this.db.run(
      `UPDATE invoices SET
        payment_terms_id = ?,
        payment_terms_name = ?,
        due_date = ?,
        late_fee_rate = ?,
        late_fee_type = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        termsId,
        terms.name,
        dueDate.toISOString().split('T')[0],
        terms.lateFeeRate || 0,
        terms.lateFeeType || 'none',
        invoiceId
      ]
    );

    return this.getInvoiceById(invoiceId);
  }

  // ============================================
  // TAX AND DISCOUNT CALCULATIONS
  // ============================================

  /**
   * Calculate invoice totals with tax and discounts
   */
  calculateInvoiceTotals(
    lineItems: InvoiceLineItem[],
    taxRate = 0,
    discountType?: 'percentage' | 'fixed',
    discountValue = 0
  ): { subtotal: number; taxAmount: number; discountAmount: number; total: number } {
    // Calculate subtotal from line items (including per-line tax/discount if present)
    let subtotal = 0;
    let lineTax = 0;
    let lineDiscount = 0;

    for (const item of lineItems) {
      subtotal += item.amount;

      // Per-line tax
      if (item.taxRate && item.taxRate > 0) {
        const itemTax = item.amount * (item.taxRate / 100);
        lineTax += itemTax;
      }

      // Per-line discount
      if (item.discountValue && item.discountValue > 0) {
        const itemDiscount = item.discountType === 'percentage'
          ? item.amount * (item.discountValue / 100)
          : item.discountValue;
        lineDiscount += itemDiscount;
      }
    }

    // Invoice-level discount
    let invoiceDiscount = 0;
    if (discountType && discountValue > 0) {
      invoiceDiscount = discountType === 'percentage'
        ? subtotal * (discountValue / 100)
        : discountValue;
    }

    const totalDiscount = lineDiscount + invoiceDiscount;

    // Invoice-level tax (on discounted subtotal)
    const taxableAmount = subtotal - totalDiscount;
    const invoiceTax = taxRate > 0 ? taxableAmount * (taxRate / 100) : 0;

    const totalTax = lineTax + invoiceTax;
    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      taxAmount: totalTax,
      discountAmount: totalDiscount,
      total: Math.max(0, total) // Ensure non-negative
    };
  }

  /**
   * Update invoice with tax and discount
   */
  async updateInvoiceTaxAndDiscount(
    invoiceId: number,
    taxRate?: number,
    discountType?: 'percentage' | 'fixed',
    discountValue?: number
  ): Promise<Invoice> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can have tax/discount modified');
    }

    const totals = this.calculateInvoiceTotals(
      invoice.lineItems,
      taxRate ?? invoice.taxRate ?? 0,
      discountType ?? invoice.discountType,
      discountValue ?? invoice.discountValue ?? 0
    );

    await this.db.run(
      `UPDATE invoices SET
        subtotal = ?,
        tax_rate = ?,
        tax_amount = ?,
        discount_type = ?,
        discount_value = ?,
        discount_amount = ?,
        amount_total = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        totals.subtotal,
        taxRate ?? invoice.taxRate ?? 0,
        totals.taxAmount,
        discountType ?? invoice.discountType ?? null,
        discountValue ?? invoice.discountValue ?? 0,
        totals.discountAmount,
        totals.total,
        invoiceId
      ]
    );

    return this.getInvoiceById(invoiceId);
  }

  // ============================================
  // LATE FEE HANDLING
  // ============================================

  /**
   * Calculate late fee for an overdue invoice
   */
  calculateLateFee(invoice: Invoice): number {
    if (!invoice.dueDate || invoice.status === 'paid' || invoice.status === 'cancelled') {
      return 0;
    }

    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

    if (daysOverdue <= 0) {
      return 0; // Not overdue
    }

    const outstanding = invoice.amountTotal - invoice.amountPaid;
    const feeRate = invoice.lateFeeRate || 0;
    const feeType = invoice.lateFeeType || 'none';

    switch (feeType) {
    case 'flat':
      return feeRate; // Flat fee amount
    case 'percentage':
      return outstanding * (feeRate / 100);
    case 'daily_percentage':
      return outstanding * (feeRate / 100) * daysOverdue;
    default:
      return 0;
    }
  }

  /**
   * Apply late fee to an overdue invoice
   */
  async applyLateFee(invoiceId: number): Promise<Invoice> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (invoice.lateFeeAppliedAt) {
      throw new Error('Late fee has already been applied to this invoice');
    }

    const lateFee = this.calculateLateFee(invoice);

    if (lateFee <= 0) {
      throw new Error('No late fee applicable for this invoice');
    }

    const newTotal = invoice.amountTotal + lateFee;

    await this.db.run(
      `UPDATE invoices SET
        late_fee_amount = ?,
        late_fee_applied_at = CURRENT_TIMESTAMP,
        amount_total = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [lateFee, newTotal, invoiceId]
    );

    return this.getInvoiceById(invoiceId);
  }

  /**
   * Auto-apply late fees to all eligible overdue invoices
   * Returns count of invoices with late fees applied
   */
  async processLateFees(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];

    // Get overdue invoices with late fee settings but no fee applied yet
    const sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.status = 'overdue'
        AND i.late_fee_type != 'none'
        AND i.late_fee_rate > 0
        AND i.late_fee_applied_at IS NULL
        AND i.due_date < ?
    `;

    const rows = await this.db.all(sql, [today]);
    let appliedCount = 0;

    for (const row of rows) {
      try {
        const invoice = this.mapRowToInvoice(row);
        const lateFee = this.calculateLateFee(invoice);

        if (lateFee > 0) {
          await this.applyLateFee(invoice.id!);
          appliedCount++;
        }
      } catch (error) {
        console.error(`[InvoiceService] Failed to apply late fee to invoice ${row.id}:`, error);
      }
    }

    return appliedCount;
  }

  // ============================================
  // PAYMENT HISTORY TRACKING
  // ============================================

  /**
   * Record a payment and add it to payment history
   */
  async recordPaymentWithHistory(
    invoiceId: number,
    amount: number,
    paymentMethod: string,
    paymentReference?: string,
    notes?: string
  ): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
    const paymentDate = new Date().toISOString().split('T')[0];

    // Record the payment using existing method
    const invoice = await this.recordPayment(invoiceId, amount, paymentMethod, paymentReference);

    // Add to payment history
    const sql = `
      INSERT INTO invoice_payments (
        invoice_id, amount, payment_method, payment_reference, payment_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      invoiceId,
      amount,
      paymentMethod,
      paymentReference || null,
      paymentDate,
      notes || null
    ]);

    const payment: InvoicePayment = {
      id: result.lastID!,
      invoiceId,
      amount,
      paymentMethod,
      paymentReference,
      paymentDate,
      notes,
      createdAt: new Date().toISOString()
    };

    return { invoice, payment };
  }

  /**
   * Get payment history for an invoice
   */
  async getPaymentHistory(invoiceId: number): Promise<InvoicePayment[]> {
    const sql = `
      SELECT * FROM invoice_payments
      WHERE invoice_id = ?
      ORDER BY payment_date DESC, created_at DESC
    `;

    const rows = await this.db.all(sql, [invoiceId]);

    return rows.map((row: InvoicePaymentRow) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentDate: row.payment_date,
      notes: row.notes,
      createdAt: row.created_at
    }));
  }

  /**
   * Get all payments across all invoices (for reports)
   */
  async getAllPayments(dateFrom?: string, dateTo?: string): Promise<InvoicePayment[]> {
    let sql = 'SELECT * FROM invoice_payments';
    const params: SqlValue[] = [];

    const conditions: string[] = [];
    if (dateFrom) {
      conditions.push('payment_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('payment_date <= ?');
      params.push(dateTo);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY payment_date DESC, created_at DESC';

    const rows = await this.db.all(sql, params);

    return rows.map((row: InvoicePaymentRow) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentDate: row.payment_date,
      notes: row.notes,
      createdAt: row.created_at
    }));
  }

  // ============================================
  // INVOICE AGING REPORT (A/R AGING)
  // ============================================

  /**
   * Generate an accounts receivable aging report
   */
  async getAgingReport(clientId?: number): Promise<InvoiceAgingReport> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get all outstanding invoices
    let sql = `
      SELECT i.*, c.company_name, c.contact_name, c.email as client_email,
             p.project_name, p.description as project_description
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      JOIN projects p ON i.project_id = p.id
      WHERE i.status IN ('sent', 'viewed', 'partial', 'overdue')
        AND i.amount_total > i.amount_paid
    `;

    const params: SqlValue[] = [];

    if (clientId) {
      sql += ' AND i.client_id = ?';
      params.push(clientId);
    }

    sql += ' ORDER BY i.due_date ASC';

    const rows = await this.db.all(sql, params);
    const invoices = rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));

    // Initialize aging buckets
    const buckets: Map<InvoiceAgingBucket['bucket'], InvoiceAgingBucket> = new Map([
      ['current', { bucket: 'current', count: 0, totalAmount: 0, invoices: [] }],
      ['1-30', { bucket: '1-30', count: 0, totalAmount: 0, invoices: [] }],
      ['31-60', { bucket: '31-60', count: 0, totalAmount: 0, invoices: [] }],
      ['61-90', { bucket: '61-90', count: 0, totalAmount: 0, invoices: [] }],
      ['90+', { bucket: '90+', count: 0, totalAmount: 0, invoices: [] }]
    ]);

    let totalOutstanding = 0;

    for (const invoice of invoices) {
      const outstanding = invoice.amountTotal - invoice.amountPaid;
      totalOutstanding += outstanding;

      // Determine aging bucket based on due date
      let bucket: InvoiceAgingBucket['bucket'] = 'current';

      if (invoice.dueDate) {
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));

        if (daysOverdue <= 0) {
          bucket = 'current';
        } else if (daysOverdue <= 30) {
          bucket = '1-30';
        } else if (daysOverdue <= 60) {
          bucket = '31-60';
        } else if (daysOverdue <= 90) {
          bucket = '61-90';
        } else {
          bucket = '90+';
        }
      }

      const bucketData = buckets.get(bucket)!;
      bucketData.count++;
      bucketData.totalAmount += outstanding;
      bucketData.invoices.push(invoice);
    }

    return {
      generatedAt: todayStr,
      totalOutstanding,
      buckets: Array.from(buckets.values())
    };
  }

  // ============================================
  // INVOICE NUMBER CUSTOMIZATION
  // ============================================

  /**
   * Generate a customized invoice number with prefix
   */
  async generateCustomInvoiceNumber(prefix?: string): Promise<{ number: string; sequence: number }> {
    const usePrefix = prefix || 'INV';

    // Get the next sequence number for this prefix
    const sql = `
      SELECT MAX(invoice_sequence) as max_seq
      FROM invoices
      WHERE invoice_prefix = ?
    `;

    const result = await this.db.get(sql, [usePrefix]);
    const nextSeq = (result?.max_seq || 0) + 1;

    // Format: PREFIX-YYYYMM-####
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const seqStr = String(nextSeq).padStart(4, '0');

    return {
      number: `${usePrefix}-${year}${month}-${seqStr}`,
      sequence: nextSeq
    };
  }

  /**
   * Create invoice with custom number prefix
   */
  async createInvoiceWithCustomNumber(data: InvoiceCreateData & { prefix?: string }): Promise<Invoice> {
    const { number, sequence } = await this.generateCustomInvoiceNumber(data.prefix);
    const amountTotal = this.calculateTotal(data.lineItems);
    const issuedDate = new Date().toISOString().split('T')[0];
    const dueDate =
      data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const sql = `
      INSERT INTO invoices (
        invoice_number, invoice_prefix, invoice_sequence,
        project_id, client_id, amount_total, amount_paid,
        currency, status, due_date, issued_date, line_items, notes, terms,
        business_name, business_contact, business_email, business_website,
        venmo_handle, paypal_email, services_title, services_description,
        deliverables, features, bill_to_name, bill_to_email, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      number,
      data.prefix || 'INV',
      sequence,
      data.projectId,
      data.clientId,
      amountTotal,
      data.currency || 'USD',
      dueDate,
      issuedDate,
      JSON.stringify(data.lineItems),
      data.notes || null,
      data.terms || 'Payment due within 14 days of receipt.',
      data.businessName || BUSINESS_INFO.name,
      data.businessContact || BUSINESS_INFO.contact,
      data.businessEmail || BUSINESS_INFO.email,
      data.businessWebsite || BUSINESS_INFO.website,
      data.venmoHandle || BUSINESS_INFO.venmoHandle,
      data.paypalEmail || BUSINESS_INFO.paypalEmail,
      data.servicesTitle || null,
      data.servicesDescription || null,
      data.deliverables ? JSON.stringify(data.deliverables) : null,
      data.features || null,
      data.billToName || null,
      data.billToEmail || null,
      amountTotal
    ]);

    return this.getInvoiceById(result.lastID!);
  }

  // ============================================
  // INTERNAL NOTES
  // ============================================

  /**
   * Update internal notes on an invoice (not visible to client)
   */
  async updateInternalNotes(invoiceId: number, internalNotes: string): Promise<Invoice> {
    await this.db.run(
      'UPDATE invoices SET internal_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [internalNotes, invoiceId]
    );

    return this.getInvoiceById(invoiceId);
  }

  // ============================================
  // INVOICE SUMMARY STATISTICS
  // ============================================

  /**
   * Get comprehensive invoice statistics
   */
  async getComprehensiveStats(dateFrom?: string, dateTo?: string): Promise<{
    totalInvoices: number;
    totalRevenue: number;
    totalOutstanding: number;
    totalOverdue: number;
    averageInvoiceAmount: number;
    averageDaysToPayment: number;
    statusBreakdown: Record<Invoice['status'], number>;
    monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  }> {
    const conditions: string[] = [];
    const params: SqlValue[] = [];

    if (dateFrom) {
      conditions.push('issued_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('issued_date <= ?');
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Basic stats
    const basicSql = `
      SELECT
        COUNT(*) as total_invoices,
        SUM(amount_total) as total_amount,
        SUM(amount_paid) as total_paid,
        SUM(CASE WHEN status = 'overdue' THEN amount_total - amount_paid ELSE 0 END) as total_overdue,
        AVG(amount_total) as avg_amount,
        AVG(CASE WHEN status = 'paid' AND paid_date IS NOT NULL AND issued_date IS NOT NULL
            THEN julianday(paid_date) - julianday(issued_date)
            ELSE NULL END) as avg_days_to_payment
      FROM invoices
      ${whereClause}
    `;

    const basicStats = await this.db.get(basicSql, params);

    // Status breakdown
    const statusSql = `
      SELECT status, COUNT(*) as count
      FROM invoices
      ${whereClause}
      GROUP BY status
    `;

    const statusRows = await this.db.all(statusSql, params);
    const statusBreakdown: Record<Invoice['status'], number> = {
      draft: 0,
      sent: 0,
      viewed: 0,
      partial: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0
    };

    for (const row of statusRows) {
      statusBreakdown[row.status as Invoice['status']] = row.count;
    }

    // Monthly revenue
    const monthlySql = `
      SELECT
        strftime('%Y-%m', issued_date) as month,
        SUM(amount_paid) as revenue,
        COUNT(*) as count
      FROM invoices
      ${whereClause}
      GROUP BY strftime('%Y-%m', issued_date)
      ORDER BY month DESC
      LIMIT 12
    `;

    const monthlyRows = await this.db.all(monthlySql, params);
    const monthlyRevenue = monthlyRows.map((row: { month: string; revenue: number; count: number }) => ({
      month: row.month,
      revenue: row.revenue || 0,
      count: row.count
    }));

    return {
      totalInvoices: basicStats?.total_invoices || 0,
      totalRevenue: basicStats?.total_paid || 0,
      totalOutstanding: (basicStats?.total_amount || 0) - (basicStats?.total_paid || 0),
      totalOverdue: basicStats?.total_overdue || 0,
      averageInvoiceAmount: basicStats?.avg_amount || 0,
      averageDaysToPayment: basicStats?.avg_days_to_payment || 0,
      statusBreakdown,
      monthlyRevenue
    };
  }
}
