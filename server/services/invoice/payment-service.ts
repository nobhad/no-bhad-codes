/**
 * ===============================================
 * INVOICE PAYMENT SERVICE
 * ===============================================
 * @file server/services/invoice/payment-service.ts
 *
 * Handles payment processing and payment history.
 */

import type { Invoice, InvoicePayment, InvoicePaymentRow } from '../../types/invoice-types.js';
import { receiptService } from '../receipt-service.js';

type SqlValue = string | number | boolean | null;

type Database = any;

type UpdateInvoiceStatus = (
  id: number,
  status: Invoice['status'],
  paymentData?: {
    amountPaid?: number;
    paymentMethod?: string;
    paymentReference?: string;
    paidDate?: string;
  }
) => Promise<Invoice>;

type GetInvoiceById = (id: number) => Promise<Invoice>;

export class InvoicePaymentService {
  private db: Database;
  private getInvoiceById: GetInvoiceById;
  private updateInvoiceStatus: UpdateInvoiceStatus;

  constructor(db: Database, deps: { getInvoiceById: GetInvoiceById; updateInvoiceStatus: UpdateInvoiceStatus }) {
    this.db = db;
    this.getInvoiceById = deps.getInvoiceById;
    this.updateInvoiceStatus = deps.updateInvoiceStatus;
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

    if (remaining <= 0.01) {
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

  /**
   * Record a payment and add it to payment history
   * Also auto-generates a receipt for the payment
   */
  async recordPaymentWithHistory(
    invoiceId: number,
    amount: number,
    paymentMethod: string,
    paymentReference?: string,
    notes?: string
  ): Promise<{ invoice: Invoice; payment: InvoicePayment; receipt?: { id: number; receiptNumber: string } }> {
    const paymentDate = new Date().toISOString().split('T')[0];

    const invoice = await this.recordPayment(invoiceId, amount, paymentMethod, paymentReference);

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

    // Auto-generate receipt for this payment
    let receipt: { id: number; receiptNumber: string } | undefined;
    try {
      const receiptRecord = await receiptService.createReceipt(
        invoiceId,
        payment.id,
        amount,
        {
          paymentMethod,
          paymentReference,
          paymentDate
        }
      );
      receipt = {
        id: receiptRecord.id,
        receiptNumber: receiptRecord.receiptNumber
      };
      console.log(`[PaymentService] Receipt ${receiptRecord.receiptNumber} generated for payment ${payment.id}`);
    } catch (receiptError) {
      console.error('[PaymentService] Failed to generate receipt:', receiptError);
      // Don't fail the payment if receipt generation fails
    }

    return { invoice, payment, receipt };
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
      sql += ` WHERE ${  conditions.join(' AND ')}`;
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
}
