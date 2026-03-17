/**
 * ===============================================
 * PAYMENT SCHEDULE SERVICE
 * ===============================================
 * @file server/services/payment-schedule-service.ts
 *
 * Service for managing payment schedule installments.
 * Supports flexible payment splits (50/50, quarterly, custom).
 */

import { getDatabase } from '../database/init.js';
import {
  INSTALLMENT_COLUMNS_WITH_JOINS,
  toPaymentInstallment,
  type PaymentInstallment,
  type PaymentInstallmentRow
} from '../database/entities/payment-schedule.js';
import type { PaymentInstallmentStatus, PaymentMethod } from '../config/constants.js';
import { logger } from './logger.js';
import { workflowTriggerService } from './workflow-trigger-service.js';

// =====================================================
// TYPES
// =====================================================

export interface CreateInstallmentData {
  installmentNumber: number;
  label?: string;
  amount: number;
  dueDate: string;
  notes?: string;
}

export interface PaymentSplit {
  label?: string;
  percent: number;
  offsetDays: number;
}

export interface MarkPaidData {
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
}

export interface PaymentSummary {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  installmentCount: number;
  paidCount: number;
  overdueCount: number;
}

// =====================================================
// JOIN CLAUSE
// =====================================================

const JOINS = `
  FROM payment_schedule_installments psi
  LEFT JOIN projects p ON psi.project_id = p.id
  LEFT JOIN clients c ON psi.client_id = c.id
`.replace(/\s+/g, ' ').trim();

// =====================================================
// SERVICE
// =====================================================

class PaymentScheduleService {

  // -----------------------------------------------
  // SCHEDULE CREATION
  // -----------------------------------------------

  async createSchedule(
    projectId: number,
    clientId: number,
    installments: CreateInstallmentData[],
    contractId?: number
  ): Promise<PaymentInstallment[]> {
    const db = getDatabase();
    const created: PaymentInstallment[] = [];

    for (const inst of installments) {
      const result = await db.run(
        `INSERT INTO payment_schedule_installments
          (project_id, client_id, contract_id, installment_number, label, amount, due_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId,
          clientId,
          contractId || null,
          inst.installmentNumber,
          inst.label || null,
          inst.amount,
          inst.dueDate,
          inst.notes || null
        ]
      );

      const row = await db.get(
        `SELECT ${INSTALLMENT_COLUMNS_WITH_JOINS} ${JOINS} WHERE psi.id = ?`,
        [result.lastID]
      );
      if (row) {
        created.push(toPaymentInstallment(row as unknown as PaymentInstallmentRow));
      }
    }

    await logger.info(`Created ${created.length} installments for project ${projectId}`, {
      category: 'PAYMENT_SCHEDULE'
    });

    return created;
  }

  async createFromSplit(
    projectId: number,
    clientId: number,
    totalAmount: number,
    splits: PaymentSplit[],
    startDate: string,
    contractId?: number
  ): Promise<PaymentInstallment[]> {
    const installments: CreateInstallmentData[] = splits.map((split, index) => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + split.offsetDays);

      return {
        installmentNumber: index + 1,
        label: split.label || `Payment ${index + 1}`,
        amount: Math.round((totalAmount * split.percent) / 100 * 100) / 100,
        dueDate: dueDate.toISOString().split('T')[0]
      };
    });

    return this.createSchedule(projectId, clientId, installments, contractId);
  }

  // -----------------------------------------------
  // QUERIES
  // -----------------------------------------------

  async getByProject(projectId: number): Promise<PaymentInstallment[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${INSTALLMENT_COLUMNS_WITH_JOINS} ${JOINS}
       WHERE psi.project_id = ? ORDER BY psi.installment_number`,
      [projectId]
    );
    return (rows as unknown as PaymentInstallmentRow[]).map(toPaymentInstallment);
  }

  async getByClient(clientId: number): Promise<PaymentInstallment[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${INSTALLMENT_COLUMNS_WITH_JOINS} ${JOINS}
       WHERE psi.client_id = ? ORDER BY psi.due_date`,
      [clientId]
    );
    return (rows as unknown as PaymentInstallmentRow[]).map(toPaymentInstallment);
  }

  async getInstallment(id: number): Promise<PaymentInstallment | null> {
    const db = getDatabase();
    const row = await db.get(
      `SELECT ${INSTALLMENT_COLUMNS_WITH_JOINS} ${JOINS} WHERE psi.id = ?`,
      [id]
    );
    if (!row) return null;
    return toPaymentInstallment(row as unknown as PaymentInstallmentRow);
  }

  async getOverdue(): Promise<PaymentInstallment[]> {
    const db = getDatabase();
    const rows = await db.all(
      `SELECT ${INSTALLMENT_COLUMNS_WITH_JOINS} ${JOINS}
       WHERE psi.status = 'pending' AND psi.due_date < date('now')
       ORDER BY psi.due_date`
    );
    return (rows as unknown as PaymentInstallmentRow[]).map(toPaymentInstallment);
  }

  // -----------------------------------------------
  // MUTATIONS
  // -----------------------------------------------

  async markPaid(id: number, data: MarkPaidData): Promise<PaymentInstallment> {
    const db = getDatabase();
    await db.run(
      `UPDATE payment_schedule_installments SET
        status = 'paid',
        paid_date = ?,
        paid_amount = ?,
        payment_method = ?,
        payment_reference = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.paidDate || new Date().toISOString().split('T')[0],
        data.paidAmount || null,
        data.paymentMethod || null,
        data.paymentReference || null,
        id
      ]
    );

    const installment = await this.getInstallment(id);
    if (!installment) throw new Error('Installment not found');

    await logger.info(`Marked installment ${id} as paid`, { category: 'PAYMENT_SCHEDULE' });
    return installment;
  }

  async updateInstallment(
    id: number,
    data: Partial<{
      label: string;
      amount: number;
      dueDate: string;
      status: PaymentInstallmentStatus;
      notes: string;
    }>
  ): Promise<PaymentInstallment> {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (data.label !== undefined) { updates.push('label = ?'); values.push(data.label); }
    if (data.amount !== undefined) { updates.push('amount = ?'); values.push(data.amount); }
    if (data.dueDate !== undefined) { updates.push('due_date = ?'); values.push(data.dueDate); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }
    if (data.notes !== undefined) { updates.push('notes = ?'); values.push(data.notes); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      await db.run(
        `UPDATE payment_schedule_installments SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const installment = await this.getInstallment(id);
    if (!installment) throw new Error('Installment not found');
    return installment;
  }

  async deleteInstallment(id: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM payment_schedule_installments WHERE id = ?', [id]);
  }

  // -----------------------------------------------
  // SUMMARY & BATCH OPERATIONS
  // -----------------------------------------------

  async getClientSummary(clientId: number): Promise<PaymentSummary> {
    const db = getDatabase();
    const rows = await db.all(
      'SELECT status, amount, paid_amount FROM payment_schedule_installments WHERE client_id = ?',
      [clientId]
    );

    const installments = rows as unknown as { status: string; amount: number; paid_amount: number | null }[];

    const summary: PaymentSummary = {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      installmentCount: installments.length,
      paidCount: 0,
      overdueCount: 0
    };

    for (const inst of installments) {
      const amount = Number(inst.amount) || 0;
      summary.totalAmount += amount;

      if (inst.status === 'paid') {
        summary.paidAmount += Number(inst.paid_amount) || amount;
        summary.paidCount++;
      } else if (inst.status === 'overdue') {
        summary.overdueAmount += amount;
        summary.overdueCount++;
      } else if (inst.status === 'pending') {
        summary.pendingAmount += amount;
      }
    }

    return summary;
  }

  async checkAndUpdateOverdue(): Promise<number> {
    const db = getDatabase();
    const result = await db.run(
      `UPDATE payment_schedule_installments
       SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'pending' AND due_date < date('now')`
    );
    const count = result.changes || 0;
    if (count > 0) {
      await logger.info(`Updated ${count} installments to overdue`, { category: 'PAYMENT_SCHEDULE' });
    }
    return count;
  }

  // -----------------------------------------------
  // INSTALLMENT → INVOICE CASCADE
  // -----------------------------------------------

  /**
   * Auto-generate draft invoices for payment schedule installments
   * that are due within 3 days and don't already have a linked invoice.
   * Runs daily via scheduler.
   */
  async generateDueInvoices(): Promise<{ generated: number; skipped: number }> {
    const db = getDatabase();

    // Find installments due within 3 days that have no linked invoice yet
    const dueInstallments = await db.all(`
      SELECT
        psi.id, psi.project_id, psi.client_id, psi.installment_number,
        psi.label, psi.amount, psi.due_date, psi.status,
        p.project_name
      FROM payment_schedule_installments psi
      LEFT JOIN projects p ON p.id = psi.project_id
      WHERE psi.status IN ('pending', 'overdue')
        AND psi.due_date <= date('now', '+3 days')
        AND psi.amount > 0
        AND NOT EXISTS (
          SELECT 1 FROM invoices inv
          WHERE inv.project_id = psi.project_id
            AND inv.deleted_at IS NULL
            AND abs(inv.amount_total - psi.amount) < 0.01
            AND inv.notes LIKE '%installment_id:' || psi.id || '%'
        )
    `) as Array<{
      id: number; project_id: number; client_id: number;
      installment_number: number; label: string | null;
      amount: number; due_date: string; status: string;
      project_name: string | null;
    }>;

    let generated = 0;
    let skipped = 0;

    // Lazy-import invoice service to avoid circular dependency
    const { invoiceService } = await import('./invoice-service.js');

    for (const inst of dueInstallments) {
      try {
        const description = inst.label || `Payment #${inst.installment_number}`;

        const invoice = await invoiceService.createInvoice({
          projectId: inst.project_id,
          clientId: inst.client_id,
          lineItems: [{
            description,
            quantity: 1,
            rate: inst.amount,
            amount: inst.amount
          }],
          dueDate: inst.due_date,
          notes: `Auto-generated from payment schedule (installment_id:${inst.id})`
        });

        await workflowTriggerService.emit('invoice.created', {
          entityId: invoice.id,
          triggeredBy: 'installment-auto',
          projectId: inst.project_id,
          clientId: inst.client_id
        });

        generated++;
        await logger.info(
          `Auto-generated invoice #${invoice.invoiceNumber} from installment ${inst.id} (${description}: $${inst.amount})`,
          { category: 'PAYMENT_SCHEDULE' }
        );
      } catch (error) {
        skipped++;
        await logger.error(
          `Failed to generate invoice for installment ${inst.id}`,
          { error: error instanceof Error ? error : undefined, category: 'PAYMENT_SCHEDULE' }
        );
      }
    }

    return { generated, skipped };
  }
}

export const paymentScheduleService = new PaymentScheduleService();
export default paymentScheduleService;
