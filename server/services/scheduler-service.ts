/**
 * ===============================================
 * SCHEDULER SERVICE
 * ===============================================
 * @file server/services/scheduler-service.ts
 *
 * Handles scheduled tasks for invoice generation,
 * payment reminders, and recurring invoices using node-cron.
 */

import cron, { ScheduledTask } from 'node-cron';
import { InvoiceService } from './invoice-service.js';
import { emailService } from './email-service.js';
import { getDatabase } from '../database/init.js';

// Database helper type

type Database = any;

interface SchedulerConfig {
  enableReminders: boolean;
  enableScheduledInvoices: boolean;
  enableRecurringInvoices: boolean;
  reminderCheckInterval: string; // cron expression
  invoiceGenerationTime: string; // cron expression
}

const DEFAULT_CONFIG: SchedulerConfig = {
  enableReminders: true,
  enableScheduledInvoices: true,
  enableRecurringInvoices: true,
  reminderCheckInterval: '0 * * * *', // Every hour at :00
  invoiceGenerationTime: '0 1 * * *' // Daily at 1:00 AM
};

export class SchedulerService {
  private static instance: SchedulerService;
  private invoiceService: InvoiceService;
  private db: Database;
  private config: SchedulerConfig;
  private reminderJob: ScheduledTask | null = null;
  private invoiceGenerationJob: ScheduledTask | null = null;
  private isRunning = false;

  private constructor(config: Partial<SchedulerConfig> = {}) {
    this.invoiceService = InvoiceService.getInstance();
    this.db = getDatabase();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(config?: Partial<SchedulerConfig>): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService(config);
    }
    return SchedulerService.instance;
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting scheduler service...');

    // Schedule reminder checks
    if (this.config.enableReminders) {
      this.scheduleReminderCheck();
    }

    // Schedule invoice generation (scheduled + recurring)
    if (this.config.enableScheduledInvoices || this.config.enableRecurringInvoices) {
      this.scheduleInvoiceGeneration();
    }

    this.isRunning = true;
    console.log('[Scheduler] Scheduler service started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log('[Scheduler] Stopping scheduler service...');

    if (this.reminderJob) {
      this.reminderJob.stop();
      this.reminderJob = null;
    }

    if (this.invoiceGenerationJob) {
      this.invoiceGenerationJob.stop();
      this.invoiceGenerationJob = null;
    }

    this.isRunning = false;
    console.log('[Scheduler] Scheduler service stopped');
  }

  /**
   * Schedule reminder checks (runs hourly by default)
   */
  private scheduleReminderCheck(): void {
    console.log(`[Scheduler] Scheduling reminder checks: ${this.config.reminderCheckInterval}`);

    this.reminderJob = cron.schedule(this.config.reminderCheckInterval, async () => {
      try {
        await this.processReminders();
      } catch (error) {
        console.error('[Scheduler] Error processing reminders:', error);
      }
    });
  }

  /**
   * Schedule invoice generation (runs daily by default)
   */
  private scheduleInvoiceGeneration(): void {
    console.log(`[Scheduler] Scheduling invoice generation: ${this.config.invoiceGenerationTime}`);

    this.invoiceGenerationJob = cron.schedule(this.config.invoiceGenerationTime, async () => {
      try {
        // Check and mark overdue invoices first
        await this.checkOverdueInvoices();

        if (this.config.enableScheduledInvoices) {
          await this.processScheduledInvoices();
        }
        if (this.config.enableRecurringInvoices) {
          await this.processRecurringInvoices();
        }
      } catch (error) {
        console.error('[Scheduler] Error generating invoices:', error);
      }
    });
  }

  /**
   * Check and mark overdue invoices
   */
  async checkOverdueInvoices(): Promise<number> {
    console.log('[Scheduler] Checking for overdue invoices...');
    const count = await this.invoiceService.checkAndMarkOverdue();
    if (count > 0) {
      console.log(`[Scheduler] Marked ${count} invoices as overdue`);
    }
    return count;
  }

  /**
   * Process due reminders and send emails
   */
  async processReminders(): Promise<number> {
    console.log('[Scheduler] Processing due reminders...');

    const dueReminders = await this.invoiceService.processReminders();
    let sentCount = 0;

    for (const reminder of dueReminders) {
      try {
        // Get invoice and client details
        const invoice = await this.invoiceService.getInvoiceById(reminder.invoiceId);

        // Get client email from database
        const client = await this.db.get(
          'SELECT email, contact_name FROM clients WHERE id = ?',
          [invoice.clientId]
        );

        if (!client || !client.email) {
          console.warn(`[Scheduler] No email for client ${invoice.clientId}, skipping reminder`);
          await this.invoiceService.skipReminder(reminder.id);
          continue;
        }

        // Send reminder email
        const portalUrl = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:3000/client/portal'}?invoice=${invoice.id}`;

        await this.sendReminderEmail({
          email: client.email,
          clientName: client.contact_name || 'Valued Client',
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amountTotal - (invoice.amountPaid || 0),
          dueDate: invoice.dueDate || '',
          reminderType: reminder.reminderType,
          portalUrl
        });

        // Mark reminder as sent
        await this.invoiceService.markReminderSent(reminder.id);
        sentCount++;

        console.log(`[Scheduler] Sent ${reminder.reminderType} reminder for invoice ${invoice.invoiceNumber}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to send reminder ${reminder.id}:`, error);
        await this.invoiceService.markReminderFailed(reminder.id);
      }
    }

    console.log(`[Scheduler] Processed ${dueReminders.length} reminders, sent ${sentCount}`);
    return sentCount;
  }

  /**
   * Process scheduled invoices
   */
  async processScheduledInvoices(): Promise<number> {
    console.log('[Scheduler] Processing scheduled invoices...');
    const count = await this.invoiceService.processScheduledInvoices();
    console.log(`[Scheduler] Generated ${count} scheduled invoices`);
    return count;
  }

  /**
   * Process recurring invoices
   */
  async processRecurringInvoices(): Promise<number> {
    console.log('[Scheduler] Processing recurring invoices...');
    const count = await this.invoiceService.processRecurringInvoices();
    console.log(`[Scheduler] Generated ${count} recurring invoices`);
    return count;
  }

  /**
   * Send a payment reminder email
   */
  private async sendReminderEmail(data: {
    email: string;
    clientName: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    reminderType: string;
    portalUrl: string;
  }): Promise<void> {
    const { email, clientName, invoiceNumber, amount, dueDate, reminderType, portalUrl } = data;

    // Determine email subject and message based on reminder type
    let subject: string;
    let message: string;
    let urgency = '';

    switch (reminderType) {
    case 'upcoming':
      subject = `Payment Reminder: Invoice #${invoiceNumber} Due Soon`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is due on ${dueDate}.`;
      break;
    case 'due':
      subject = `Payment Due Today: Invoice #${invoiceNumber}`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is due today.`;
      urgency = 'Please submit payment today to avoid late fees.';
      break;
    case 'overdue_3':
      subject = `Payment Overdue: Invoice #${invoiceNumber}`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is now 3 days overdue.`;
      urgency = 'Please submit payment as soon as possible.';
      break;
    case 'overdue_7':
      subject = `URGENT: Payment Overdue - Invoice #${invoiceNumber}`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is now 7 days overdue.`;
      urgency = 'Immediate payment is required to avoid service interruption.';
      break;
    case 'overdue_14':
      subject = `FINAL NOTICE: Invoice #${invoiceNumber} Overdue`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is now 14 days overdue.`;
      urgency = 'This is a final reminder before collection action may be taken.';
      break;
    case 'overdue_30':
      subject = `COLLECTION NOTICE: Invoice #${invoiceNumber}`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is now 30 days overdue.`;
      urgency = 'Please contact us immediately to discuss payment arrangements.';
      break;
    default:
      subject = `Payment Reminder: Invoice #${invoiceNumber}`;
      message = `Your invoice #${invoiceNumber} for $${amount.toFixed(2)} is pending payment.`;
    }

    await emailService.sendEmail({
      to: email,
      subject,
      text: `
Hi ${clientName},

${message}
${urgency ? `\n${urgency}\n` : ''}
View and pay your invoice here: ${portalUrl}

If you have already submitted payment, please disregard this message.

Best regards,
No Bhad Codes Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${reminderType.includes('overdue') ? '#dc3545' : '#00ff41'}; color: ${reminderType.includes('overdue') ? '#fff' : '#000'}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .amount { font-size: 24px; font-weight: bold; color: #333; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; }
    .urgency { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${subject}</h2>
    </div>
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>${message}</p>
      ${urgency ? `<div class="urgency"><strong>${urgency}</strong></div>` : ''}
      <div class="amount">Amount Due: $${amount.toFixed(2)}</div>
      <p>Due Date: ${dueDate || 'Upon Receipt'}</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button">View Invoice & Pay</a>
      </p>
      <p><small>If you have already submitted payment, please disregard this message.</small></p>
    </div>
    <div class="footer">
      <p>Best regards,<br>No Bhad Codes Team</p>
    </div>
  </div>
</body>
</html>
      `
    });
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
    jobs: { reminders: boolean; invoiceGeneration: boolean };
    } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      jobs: {
        reminders: this.reminderJob !== null,
        invoiceGeneration: this.invoiceGenerationJob !== null
      }
    };
  }

  /**
   * Manually trigger reminder processing (for testing/admin use)
   */
  async triggerReminderProcessing(): Promise<number> {
    return this.processReminders();
  }

  /**
   * Manually trigger invoice generation (for testing/admin use)
   */
  async triggerInvoiceGeneration(): Promise<{ scheduled: number; recurring: number }> {
    const scheduled = this.config.enableScheduledInvoices
      ? await this.processScheduledInvoices()
      : 0;
    const recurring = this.config.enableRecurringInvoices
      ? await this.processRecurringInvoices()
      : 0;

    return { scheduled, recurring };
  }
}

// Export singleton getter
export const getSchedulerService = (config?: Partial<SchedulerConfig>): SchedulerService => {
  return SchedulerService.getInstance(config);
};
