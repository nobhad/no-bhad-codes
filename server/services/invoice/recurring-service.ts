/**
 * ===============================================
 * INVOICE RECURRING SERVICE
 * ===============================================
 * @file server/services/invoice/recurring-service.ts
 *
 * Handles scheduled, recurring, and reminder automation.
 */

import type {
  Invoice,
  InvoiceCreateData,
  InvoiceLineItem,
  ScheduledInvoiceData,
  ScheduledInvoice,
  ScheduledInvoiceRow,
  RecurringInvoiceData,
  RecurringInvoice,
  RecurringInvoiceRow,
  InvoiceReminder,
  InvoiceReminderRow
} from '../../types/invoice-types.js';

type SqlValue = string | number | boolean | null;


type Database = any;

type CreateInvoice = (data: InvoiceCreateData) => Promise<Invoice>;

type GetInvoiceById = (id: number) => Promise<Invoice>;

export class InvoiceRecurringService {
  private db: Database;
  private createInvoice: CreateInvoice;
  private getInvoiceById: GetInvoiceById;

  constructor(db: Database, deps: { createInvoice: CreateInvoice; getInvoiceById: GetInvoiceById }) {
    this.db = db;
    this.createInvoice = deps.createInvoice;
    this.getInvoiceById = deps.getInvoiceById;
  }

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
   * Create a recurring invoice pattern
   */
  async createRecurringInvoice(data: RecurringInvoiceData): Promise<RecurringInvoice> {
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
   * Uses batch operations and transactions to avoid N+1 queries
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

    if (dueRecurring.length === 0) {
      return 0;
    }

    // Process all recurring invoices and collect results
    const successfulRecurring: Array<{ id: number; nextDate: string }> = [];
    const failedIds: number[] = [];

    for (const recurring of dueRecurring) {
      try {
        await this.createInvoice({
          projectId: recurring.project_id,
          clientId: recurring.client_id,
          lineItems: JSON.parse(recurring.line_items),
          notes: recurring.notes,
          terms: recurring.terms
        });

        const nextDate = this.calculateNextGenerationDate(
          recurring.next_generation_date,
          recurring.frequency,
          recurring.day_of_month,
          recurring.day_of_week
        );

        successfulRecurring.push({ id: recurring.id, nextDate });
      } catch (error) {
        console.error(`[InvoiceService] Failed to generate recurring invoice ${recurring.id}:`, error);
        failedIds.push(recurring.id);
      }
    }

    // Batch update all successful recurring invoices in a single transaction
    if (successfulRecurring.length > 0) {

      await this.db.transaction(async (ctx: any) => {
        // Build CASE WHEN statement for batch update
        const ids = successfulRecurring.map(r => r.id);
        const caseWhen = successfulRecurring
          .map(r => `WHEN id = ${r.id} THEN '${r.nextDate}'`)
          .join(' ');

        await ctx.run(
          `UPDATE recurring_invoices
           SET last_generated_at = CURRENT_TIMESTAMP,
               next_generation_date = CASE ${caseWhen} END
           WHERE id IN (${ids.join(',')})`
        );
      });
    }

    return successfulRecurring.length;
  }

  /**
   * Schedule reminders for an invoice when it's sent
   * Uses batch INSERT to avoid N+1 queries (6 reminders in one statement)
   */
  async scheduleReminders(invoiceId: number): Promise<void> {
    const invoice = await this.getInvoiceById(invoiceId);

    if (!invoice.dueDate) {
      console.warn(`[InvoiceService] Cannot schedule reminders for invoice ${invoiceId} without due date`);
      return;
    }

    const dueDate = new Date(invoice.dueDate);
    const now = new Date();
    const reminderSchedule: Array<{ type: string; daysFromDue: number }> = [
      { type: 'upcoming', daysFromDue: -3 },
      { type: 'due', daysFromDue: 0 },
      { type: 'overdue_3', daysFromDue: 3 },
      { type: 'overdue_7', daysFromDue: 7 },
      { type: 'overdue_14', daysFromDue: 14 },
      { type: 'overdue_30', daysFromDue: 30 }
    ];

    // Collect all valid reminders that are in the future
    const remindersToInsert: Array<{ type: string; scheduledDate: string }> = [];

    for (const reminder of reminderSchedule) {
      const scheduledDate = new Date(dueDate);
      scheduledDate.setDate(scheduledDate.getDate() + reminder.daysFromDue);

      if (scheduledDate >= now) {
        remindersToInsert.push({
          type: reminder.type,
          scheduledDate: scheduledDate.toISOString().split('T')[0]
        });
      }
    }

    // Batch insert all reminders in a single statement
    if (remindersToInsert.length > 0) {
      const valuePlaceholders = remindersToInsert.map(() => '(?, ?, ?)').join(', ');
      const params: (number | string)[] = [];

      for (const reminder of remindersToInsert) {
        params.push(invoiceId, reminder.type, reminder.scheduledDate);
      }

      await this.db.run(
        `INSERT INTO invoice_reminders (invoice_id, reminder_type, scheduled_date) VALUES ${valuePlaceholders}`,
        params
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
      reminderType: row.reminder_type as InvoiceReminder['reminderType'],
      scheduledDate: row.scheduled_date,
      sentAt: row.sent_at,
      status: row.status as InvoiceReminder['status'],
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
   * Process due reminders and return reminders ready to send
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
      reminderType: row.reminder_type as InvoiceReminder['reminderType'],
      scheduledDate: row.scheduled_date,
      sentAt: row.sent_at,
      status: row.status as InvoiceReminder['status'],
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

  private async getScheduledInvoiceById(id: number): Promise<ScheduledInvoice> {
    const sql = 'SELECT * FROM scheduled_invoices WHERE id = ?';
    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Scheduled invoice with ID ${id} not found`);
    }

    return this.mapScheduledInvoiceRow(row);
  }

  private mapScheduledInvoiceRow(row: ScheduledInvoiceRow): ScheduledInvoice {
    return {
      id: row.id,
      projectId: row.project_id,
      clientId: row.client_id,
      scheduledDate: row.scheduled_date,
      triggerType: row.trigger_type as ScheduledInvoice['triggerType'],
      triggerMilestoneId: row.trigger_milestone_id,
      lineItems: JSON.parse(row.line_items),
      notes: row.notes,
      terms: row.terms,
      status: row.status as ScheduledInvoice['status'],
      generatedInvoiceId: row.generated_invoice_id,
      createdAt: row.created_at
    };
  }

  private async getRecurringInvoiceById(id: number): Promise<RecurringInvoice> {
    const sql = 'SELECT * FROM recurring_invoices WHERE id = ?';
    const row = await this.db.get(sql, [id]);

    if (!row) {
      throw new Error(`Recurring invoice with ID ${id} not found`);
    }

    return this.mapRecurringInvoiceRow(row);
  }

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
        const currentDay = next.getDay();
        const diff = dayOfWeek - currentDay;
        next.setDate(next.getDate() + (diff >= 0 ? diff : diff + 7));
      }
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth !== undefined && dayOfMonth !== null) {
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

  private mapRecurringInvoiceRow(row: RecurringInvoiceRow): RecurringInvoice {
    return {
      id: row.id,
      projectId: row.project_id,
      clientId: row.client_id,
      frequency: row.frequency as RecurringInvoice['frequency'],
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
}
