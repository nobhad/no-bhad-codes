/**
 * ===============================================
 * INVOICE GENERATION SERVICE
 * ===============================================
 * @file server/services/invoice-service.ts
 *
 * Handles invoice generation, management, and PDF creation.
 */

import { getDatabase } from '../database/init.js';

interface Database {
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
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
      data.businessName || 'No Bhad Codes',
      data.businessContact || 'Noelle Bhaduri',
      data.businessEmail || 'nobhaduri@gmail.com',
      data.businessWebsite || 'nobhad.codes',
      data.venmoHandle || '@nobhad',
      data.paypalEmail || 'nobhaduri@gmail.com',
      data.servicesTitle || null,
      data.servicesDescription || null,
      data.deliverables ? JSON.stringify(data.deliverables) : null,
      data.features || null,
      data.billToName || null,
      data.billToEmail || null,
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

    return rows.map((row) => this.mapRowToInvoice(row));
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

    return rows.map((row) => this.mapRowToInvoice(row));
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
    const params: any[] = [status];

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
      paidDate,
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

    const params: any[] = [];

    if (clientId) {
      sql += ' WHERE client_id = ?';
      params.push(clientId);
    }

    const row = await this.db.get(sql, params);

    return {
      totalInvoices: row.total_invoices || 0,
      totalAmount: row.total_amount || 0,
      totalPaid: row.total_paid || 0,
      totalOutstanding: row.total_outstanding || 0,
      overdue: row.overdue || 0,
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
      terms: 'Payment due within 30 days. 50% upfront, 50% on completion.',
    });
  }

  /**
   * Generate line items from intake data
   */
  private generateLineItemsFromIntake(intake: any): InvoiceLineItem[] {
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
            amount: baseAmount * 0.7,
          },
          {
            description: 'Content Management System Setup',
            quantity: 1,
            rate: baseAmount * 0.2,
            amount: baseAmount * 0.2,
          },
          {
            description: 'SEO Optimization & Testing',
            quantity: 1,
            rate: baseAmount * 0.1,
            amount: baseAmount * 0.1,
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
            amount: baseAmount * 0.6,
          },
          {
            description: 'Database Design & Setup',
            quantity: 1,
            rate: baseAmount * 0.2,
            amount: baseAmount * 0.2,
          },
          {
            description: 'API Development',
            quantity: 1,
            rate: baseAmount * 0.1,
            amount: baseAmount * 0.1,
          },
          {
            description: 'Testing & Deployment',
            quantity: 1,
            rate: baseAmount * 0.1,
            amount: baseAmount * 0.1,
          }
        );
        break;

      case 'e-commerce':
        lineItems.push(
          {
            description: 'E-commerce Platform Development',
            quantity: 1,
            rate: baseAmount * 0.5,
            amount: baseAmount * 0.5,
          },
          {
            description: 'Payment Integration',
            quantity: 1,
            rate: baseAmount * 0.2,
            amount: baseAmount * 0.2,
          },
          {
            description: 'Product Catalog Setup',
            quantity: 1,
            rate: baseAmount * 0.2,
            amount: baseAmount * 0.2,
          },
          {
            description: 'Security & Testing',
            quantity: 1,
            rate: baseAmount * 0.1,
            amount: baseAmount * 0.1,
          }
        );
        break;

      case 'browser extension':
        lineItems.push(
          {
            description: 'Browser Extension Development',
            quantity: 1,
            rate: baseAmount * 0.8,
            amount: baseAmount * 0.8,
          },
          {
            description: 'Cross-browser Compatibility',
            quantity: 1,
            rate: baseAmount * 0.1,
            amount: baseAmount * 0.1,
          },
          {
            description: 'Store Submission & Review',
            quantity: 1,
            rate: baseAmount * 0.1,
            amount: baseAmount * 0.1,
          }
        );
        break;

      default:
        lineItems.push(
          {
            description: `${projectType} Development`,
            quantity: 1,
            rate: baseAmount * 0.8,
            amount: baseAmount * 0.8,
          },
          {
            description: 'Testing & Deployment',
            quantity: 1,
            rate: baseAmount * 0.2,
            amount: baseAmount * 0.2,
          }
        );
    }

    return lineItems;
  }

  /**
   * Map database row to Invoice object
   */
  private mapRowToInvoice(row: any): Invoice {
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      projectId: row.project_id,
      clientId: row.client_id,
      amountTotal: parseFloat(row.amount_total),
      amountPaid: parseFloat(row.amount_paid || 0),
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
      businessName: row.business_name || 'No Bhad Codes',
      businessContact: row.business_contact || 'Noelle Bhaduri',
      businessEmail: row.business_email || 'nobhaduri@gmail.com',
      businessWebsite: row.business_website || 'nobhad.codes',
      // Payment methods
      venmoHandle: row.venmo_handle || '@nobhad',
      paypalEmail: row.paypal_email || 'nobhaduri@gmail.com',
      // Services fields
      servicesTitle: row.services_title,
      servicesDescription: row.services_description,
      deliverables: row.deliverables ? JSON.parse(row.deliverables) : [],
      features: row.features,
      // Bill To overrides
      billToName: row.bill_to_name,
      billToEmail: row.bill_to_email,
    };
  }
}
