/**
 * ===============================================
 * INVOICE REPORTING SERVICE
 * ===============================================
 * @file server/services/invoice/reporting-service.ts
 *
 * Reporting and analytics utilities for invoices.
 */

import type { Invoice, InvoiceAgingBucket, InvoiceAgingReport, InvoiceRow } from '../../types/invoice-types.js';

type SqlValue = string | number | boolean | null;

type Database = any;

type MapRowToInvoice = (row: InvoiceRow) => Invoice;

export class InvoiceReportingService {
  private db: Database;
  private mapRowToInvoice: MapRowToInvoice;

  constructor(db: Database, deps: { mapRowToInvoice: MapRowToInvoice }) {
    this.db = db;
    this.mapRowToInvoice = deps.mapRowToInvoice;
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
   * Generate an accounts receivable aging report
   */
  async getAgingReport(clientId?: number): Promise<InvoiceAgingReport> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

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
