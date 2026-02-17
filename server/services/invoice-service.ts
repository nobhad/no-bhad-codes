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
import { logger } from './logger.js';
import { settingsService } from './settings-service.js';
import { InvoicePaymentService } from './invoice/payment-service.js';
import { InvoiceRecurringService } from './invoice/recurring-service.js';
import { InvoiceReportingService } from './invoice/reporting-service.js';
import type {
  InvoiceLineItem,
  PaymentTermsPreset,
  PaymentTermsPresetRow,
  InvoicePayment,
  InvoiceAgingReport,
  PaymentPlanPayment,
  PaymentPlanTemplate,
  PaymentPlanTemplateRow,
  ScheduledInvoiceData,
  ScheduledInvoice,
  RecurringInvoiceData,
  RecurringInvoice,
  InvoiceReminder,
  Invoice,
  InvoiceRow,
  InvoiceCredit,
  InvoiceCreditRow,
  DepositSummary,
  InvoiceCreateData
} from '../types/invoice-types.js';

export type {
  InvoiceLineItem,
  PaymentTermsPreset,
  InvoicePayment,
  InvoiceAgingBucket,
  InvoiceAgingReport,
  PaymentPlanPayment,
  PaymentPlanTemplate,
  ScheduledInvoiceData,
  ScheduledInvoice,
  RecurringInvoiceData,
  RecurringInvoice,
  InvoiceReminder,
  Invoice,
  InvoiceCredit,
  DepositSummary,
  InvoiceCreateData
} from '../types/invoice-types.js';

// Type definitions for database operations
type SqlValue = string | number | boolean | null;

// Use actual database interface from init.js - we'll cast as needed

type Database = any;

interface IntakeRecord {
  id: number;
  project_type?: string;
  budget_range?: string;
  project_description?: string;
  project_id?: number;
  client_id?: number;
}

export class InvoiceService {
  private static instance: InvoiceService;
  private db: Database;
  private paymentService: InvoicePaymentService;
  private recurringService: InvoiceRecurringService;
  private reportingService: InvoiceReportingService;

  private constructor() {
    this.db = getDatabase();
    this.paymentService = new InvoicePaymentService(this.db, {
      getInvoiceById: this.getInvoiceById.bind(this),
      updateInvoiceStatus: this.updateInvoiceStatus.bind(this)
    });
    this.recurringService = new InvoiceRecurringService(this.db, {
      createInvoice: async (data) => this.createInvoice(data),
      getInvoiceById: async (id) => this.getInvoiceById(id)
    });
    this.reportingService = new InvoiceReportingService(this.db, {
      mapRowToInvoice: this.mapRowToInvoice.bind(this)
    });
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
        currency, status, due_date, issued_date, notes, terms, subtotal
      ) VALUES (?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      invoiceNumber,
      data.projectId,
      data.clientId,
      amountTotal,
      data.currency || 'USD',
      dueDate,
      issuedDate,
      data.notes || null,
      data.terms || 'Payment due within 14 days of receipt.',
      amountTotal
    ]);

    const invoiceId = result.lastID!;

    // Save line items to invoice_line_items table
    await this.saveLineItems(invoiceId, data.lineItems);

    return this.getInvoiceById(invoiceId);
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

    const invoice = this.mapRowToInvoice(row);
    invoice.lineItems = await this.getLineItems(id);
    return invoice;
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

    const invoice = this.mapRowToInvoice(row);
    invoice.lineItems = await this.getLineItems(invoice.id!);
    return invoice;
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
    const invoices = rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));

    // Batch fetch line items (eliminates N+1 query)
    await this.attachLineItemsToInvoices(invoices);

    return invoices;
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
    const invoices = rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));

    // Batch fetch line items (eliminates N+1 query)
    await this.attachLineItemsToInvoices(invoices);

    return invoices;
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
      updates.push('amount_total = ?', 'subtotal = ?');
      params.push(amountTotal, amountTotal);
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

    if (updates.length === 0) {
      return currentInvoice;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    await this.db.run(sql, params);

    // Update line items in table if they were changed
    if (data.lineItems && data.lineItems.length > 0) {
      await this.saveLineItems(id, data.lineItems);
    }

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
    return this.paymentService.markInvoiceAsPaid(id, paymentData);
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
    return this.reportingService.getInvoiceStats(clientId);
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
   * Note: lineItems are loaded separately via getLineItems() for full invoice data
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
      lineItems: [], // Loaded separately via getLineItems()
      notes: row.notes,
      terms: row.terms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined client/project display names (from JOINed queries)
      clientName: row.company_name || row.contact_name,
      clientEmail: row.client_email,
      projectName: row.project_name,
      // Business info from constant (no longer stored per-invoice)
      businessName: BUSINESS_INFO.name,
      businessContact: BUSINESS_INFO.contact,
      businessEmail: BUSINESS_INFO.email,
      businessWebsite: BUSINESS_INFO.website,
      venmoHandle: BUSINESS_INFO.venmoHandle,
      paypalEmail: BUSINESS_INFO.paypalEmail,
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
      // Advanced features - Internal notes
      internalNotes: row.internal_notes,
      // Advanced features - Invoice number customization
      invoicePrefix: row.invoice_prefix,
      invoiceSequence: row.invoice_sequence
    };
  }

  // ============================================
  // LINE ITEMS TABLE METHODS (Phase 3.2)
  // ============================================

  /**
   * Get line items from the invoice_line_items table
   */
  async getLineItems(invoiceId: number): Promise<InvoiceLineItem[]> {
    const rows = await this.db.all(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ? ORDER BY sort_order ASC',
      [invoiceId]
    );

    return rows.map((row: Record<string, unknown>) => ({
      description: row.description as string,
      quantity: typeof row.quantity === 'string' ? parseFloat(row.quantity) : (row.quantity as number),
      rate: typeof row.unit_price === 'string' ? parseFloat(row.unit_price) : (row.unit_price as number),
      amount: typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount as number),
      taxRate: row.tax_rate ? (typeof row.tax_rate === 'string' ? parseFloat(row.tax_rate) : row.tax_rate as number) : undefined,
      taxAmount: row.tax_amount ? (typeof row.tax_amount === 'string' ? parseFloat(row.tax_amount) : row.tax_amount as number) : undefined,
      discountType: row.discount_type as 'percentage' | 'fixed' | undefined,
      discountValue: row.discount_value ? (typeof row.discount_value === 'string' ? parseFloat(row.discount_value) : row.discount_value as number) : undefined,
      discountAmount: row.discount_amount ? (typeof row.discount_amount === 'string' ? parseFloat(row.discount_amount) : row.discount_amount as number) : undefined
    }));
  }

  /**
   * Get line items for multiple invoices in a single query (batch fetch)
   * This eliminates N+1 query problem when fetching invoices with line items
   */
  async getLineItemsForInvoices(invoiceIds: number[]): Promise<Map<number, InvoiceLineItem[]>> {
    if (invoiceIds.length === 0) {
      return new Map();
    }

    const placeholders = invoiceIds.map(() => '?').join(',');
    const rows = await this.db.all(
      `SELECT * FROM invoice_line_items WHERE invoice_id IN (${placeholders}) ORDER BY invoice_id, sort_order ASC`,
      invoiceIds
    );

    // Group line items by invoice_id
    const lineItemsMap = new Map<number, InvoiceLineItem[]>();

    for (const row of rows as Record<string, unknown>[]) {
      const invoiceId = row.invoice_id as number;
      const lineItem: InvoiceLineItem = {
        description: row.description as string,
        quantity: typeof row.quantity === 'string' ? parseFloat(row.quantity) : (row.quantity as number),
        rate: typeof row.unit_price === 'string' ? parseFloat(row.unit_price) : (row.unit_price as number),
        amount: typeof row.amount === 'string' ? parseFloat(row.amount) : (row.amount as number),
        taxRate: row.tax_rate ? (typeof row.tax_rate === 'string' ? parseFloat(row.tax_rate) : row.tax_rate as number) : undefined,
        taxAmount: row.tax_amount ? (typeof row.tax_amount === 'string' ? parseFloat(row.tax_amount) : row.tax_amount as number) : undefined,
        discountType: row.discount_type as 'percentage' | 'fixed' | undefined,
        discountValue: row.discount_value ? (typeof row.discount_value === 'string' ? parseFloat(row.discount_value) : row.discount_value as number) : undefined,
        discountAmount: row.discount_amount ? (typeof row.discount_amount === 'string' ? parseFloat(row.discount_amount) : row.discount_amount as number) : undefined
      };

      if (!lineItemsMap.has(invoiceId)) {
        lineItemsMap.set(invoiceId, []);
      }
      lineItemsMap.get(invoiceId)!.push(lineItem);
    }

    return lineItemsMap;
  }

  /**
   * Attach line items to invoices using batch fetch
   */
  private async attachLineItemsToInvoices(invoices: Invoice[]): Promise<void> {
    if (invoices.length === 0) return;

    const invoiceIds = invoices.map(inv => inv.id!).filter(id => id != null);
    const lineItemsMap = await this.getLineItemsForInvoices(invoiceIds);

    for (const invoice of invoices) {
      invoice.lineItems = lineItemsMap.get(invoice.id!) || [];
    }
  }

  /**
   * Save line items to the invoice_line_items table
   */
  async saveLineItems(invoiceId: number, lineItems: InvoiceLineItem[]): Promise<void> {
    // Delete existing line items for this invoice
    await this.db.run(
      'DELETE FROM invoice_line_items WHERE invoice_id = ?',
      [invoiceId]
    );

    // Insert new line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      await this.db.run(
        `INSERT INTO invoice_line_items (
          invoice_id, description, quantity, unit_price, amount,
          tax_rate, tax_amount, discount_type, discount_value, discount_amount,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          item.description,
          item.quantity,
          item.rate,
          item.amount,
          item.taxRate ?? null,
          item.taxAmount ?? null,
          item.discountType ?? null,
          item.discountValue ?? null,
          item.discountAmount ?? null,
          i
        ]
      );
    }
  }

  /**
   * Get business info from settings service
   * Falls back to BUSINESS_INFO constant if settings not available
   */
  async getBusinessInfoFromSettings(): Promise<{
    name: string;
    contact: string;
    email: string;
    website: string;
    venmoHandle: string;
    paypalEmail: string;
  }> {
    try {
      const [businessInfo, paymentSettings] = await Promise.all([
        settingsService.getBusinessInfo(),
        settingsService.getPaymentSettings()
      ]);

      return {
        name: businessInfo.name || BUSINESS_INFO.name,
        contact: businessInfo.contact || BUSINESS_INFO.contact,
        email: businessInfo.email || BUSINESS_INFO.email,
        website: businessInfo.website || BUSINESS_INFO.website,
        venmoHandle: paymentSettings.venmoHandle || BUSINESS_INFO.venmoHandle,
        paypalEmail: paymentSettings.paypalEmail || BUSINESS_INFO.paypalEmail
      };
    } catch {
      // Fall back to constants if settings table doesn't exist yet
      return {
        name: BUSINESS_INFO.name,
        contact: BUSINESS_INFO.contact,
        email: BUSINESS_INFO.email,
        website: BUSINESS_INFO.website,
        venmoHandle: BUSINESS_INFO.venmoHandle,
        paypalEmail: BUSINESS_INFO.paypalEmail
      };
    }
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
        currency, status, due_date, issued_date, notes, terms,
        invoice_type, deposit_for_project_id, deposit_percentage, subtotal
      ) VALUES (?, ?, ?, ?, 0, 'USD', 'draft', ?, ?, ?, ?, 'deposit', ?, ?, ?)
    `;

    const result = await this.db.run(sql, [
      invoiceNumber,
      projectId,
      clientId,
      amount,
      dueDate,
      issuedDate,
      percentage ? `Deposit (${percentage}% of project total)` : 'Project Deposit',
      'Payment due within 14 days. This deposit secures your project slot.',
      projectId,
      percentage || null,
      amount
    ]);

    const invoiceId = result.lastID!;

    // Save line items to invoice_line_items table
    await this.saveLineItems(invoiceId, lineItems);

    return this.getInvoiceById(invoiceId);
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
    const invoices = rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));

    // Batch fetch line items (eliminates N+1 query)
    await this.attachLineItemsToInvoices(invoices);

    return invoices;
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
    return this.recurringService.scheduleInvoice(data);
  }

  /**
   * Get all scheduled invoices, optionally filtered by project
   */
  async getScheduledInvoices(projectId?: number): Promise<ScheduledInvoice[]> {
    return this.recurringService.getScheduledInvoices(projectId);
  }

  /**
   * Cancel a scheduled invoice
   */
  async cancelScheduledInvoice(id: number): Promise<void> {
    await this.recurringService.cancelScheduledInvoice(id);
  }

  /**
   * Process due scheduled invoices and generate actual invoices
   */
  async processScheduledInvoices(): Promise<number> {
    return this.recurringService.processScheduledInvoices();
  }

  // ============================================
  // RECURRING INVOICE METHODS
  // ============================================

  /**
   * Create a recurring invoice pattern
   */
  async createRecurringInvoice(data: RecurringInvoiceData): Promise<RecurringInvoice> {
    return this.recurringService.createRecurringInvoice(data);
  }

  /**
   * Get all recurring invoices, optionally filtered by project
   */
  async getRecurringInvoices(projectId?: number): Promise<RecurringInvoice[]> {
    return this.recurringService.getRecurringInvoices(projectId);
  }

  /**
   * Update a recurring invoice pattern
   */
  async updateRecurringInvoice(id: number, data: Partial<RecurringInvoiceData>): Promise<RecurringInvoice> {
    return this.recurringService.updateRecurringInvoice(id, data);
  }

  /**
   * Pause a recurring invoice
   */
  async pauseRecurringInvoice(id: number): Promise<void> {
    await this.recurringService.pauseRecurringInvoice(id);
  }

  /**
   * Resume a paused recurring invoice
   */
  async resumeRecurringInvoice(id: number): Promise<void> {
    await this.recurringService.resumeRecurringInvoice(id);
  }

  /**
   * Delete a recurring invoice pattern
   */
  async deleteRecurringInvoice(id: number): Promise<void> {
    await this.recurringService.deleteRecurringInvoice(id);
  }

  /**
   * Process due recurring invoices and generate actual invoices
   */
  async processRecurringInvoices(): Promise<number> {
    return this.recurringService.processRecurringInvoices();
  }

  // ============================================
  // PAYMENT REMINDER METHODS
  // ============================================

  /**
   * Schedule reminders for an invoice when it's sent
   */
  async scheduleReminders(invoiceId: number): Promise<void> {
    await this.recurringService.scheduleReminders(invoiceId);
  }

  /**
   * Get all reminders for an invoice
   */
  async getInvoiceReminders(invoiceId: number): Promise<InvoiceReminder[]> {
    return this.recurringService.getInvoiceReminders(invoiceId);
  }

  /**
   * Mark a reminder as sent
   */
  async markReminderSent(reminderId: number): Promise<void> {
    await this.recurringService.markReminderSent(reminderId);
  }

  /**
   * Skip a reminder (won't be sent)
   */
  async skipReminder(reminderId: number): Promise<void> {
    await this.recurringService.skipReminder(reminderId);
  }

  /**
   * Process due reminders and return count of reminders ready to send
   */
  async processReminders(): Promise<InvoiceReminder[]> {
    return this.recurringService.processReminders();
  }

  /**
   * Mark a reminder as failed
   */
  async markReminderFailed(reminderId: number): Promise<void> {
    await this.recurringService.markReminderFailed(reminderId);
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
        currency, status, due_date, issued_date, notes, terms,
        invoice_type, subtotal
      ) VALUES (?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, 'standard', ?)
    `;

    const result = await this.db.run(sql, [
      invoiceNumber,
      original.projectId,
      original.clientId,
      original.amountTotal,
      original.currency,
      dueDate,
      issuedDate,
      original.notes ? `Copy of ${original.invoiceNumber}: ${original.notes}` : `Copy of ${original.invoiceNumber}`,
      original.terms,
      original.amountTotal
    ]);

    const invoiceId = result.lastID!;

    // Copy line items to new invoice
    await this.saveLineItems(invoiceId, original.lineItems);

    return this.getInvoiceById(invoiceId);
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
    return this.paymentService.recordPayment(id, amount, paymentMethod, paymentReference);
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

    // Batch fetch line items (eliminates N+1 query)
    await this.attachLineItemsToInvoices(invoices);

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
    const invoices = rows.map((row: InvoiceRow) => this.mapRowToInvoice(row));

    // Batch fetch line items (eliminates N+1 query)
    await this.attachLineItemsToInvoices(invoices);

    return invoices;
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
        due_date = ?,
        late_fee_rate = ?,
        late_fee_type = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        termsId,
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
        logger.error(`[InvoiceService] Failed to apply late fee to invoice ${row.id}`, { error: error instanceof Error ? error : undefined });
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
    return this.paymentService.recordPaymentWithHistory(
      invoiceId,
      amount,
      paymentMethod,
      paymentReference,
      notes
    );
  }

  /**
   * Get payment history for an invoice
   */
  async getPaymentHistory(invoiceId: number): Promise<InvoicePayment[]> {
    return this.paymentService.getPaymentHistory(invoiceId);
  }

  /**
   * Get all payments across all invoices (for reports)
   */
  async getAllPayments(dateFrom?: string, dateTo?: string): Promise<InvoicePayment[]> {
    return this.paymentService.getAllPayments(dateFrom, dateTo);
  }

  // ============================================
  // INVOICE AGING REPORT (A/R AGING)
  // ============================================

  /**
   * Generate an accounts receivable aging report
   */
  async getAgingReport(clientId?: number): Promise<InvoiceAgingReport> {
    return this.reportingService.getAgingReport(clientId);
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
        currency, status, due_date, issued_date, notes, terms, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?)
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
      data.notes || null,
      data.terms || 'Payment due within 14 days of receipt.',
      amountTotal
    ]);

    const invoiceId = result.lastID!;

    // Save line items to invoice_line_items table
    await this.saveLineItems(invoiceId, data.lineItems);

    return this.getInvoiceById(invoiceId);
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
    return this.reportingService.getComprehensiveStats(dateFrom, dateTo);
  }
}
