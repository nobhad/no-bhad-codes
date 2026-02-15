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
import { softDeleteService } from './soft-delete-service.js';
import { escalateAllProjects, EscalationResult } from './priority-escalation-service.js';

// Database helper type

type Database = any;

interface SchedulerConfig {
  enableReminders: boolean;
  enableContractReminders: boolean;
  enableWelcomeSequences: boolean;
  enableScheduledInvoices: boolean;
  enableRecurringInvoices: boolean;
  enableSoftDeleteCleanup: boolean;
  enableAnalyticsCleanup: boolean;
  enablePriorityEscalation: boolean;
  enableApprovalReminders: boolean;
  reminderCheckInterval: string; // cron expression
  invoiceGenerationTime: string; // cron expression
  softDeleteCleanupTime: string; // cron expression
  analyticsCleanupTime: string; // cron expression
  priorityEscalationTime: string; // cron expression
  analyticsRetentionDays: number; // days to keep analytics data
  approvalReminderIntervals: number[]; // days after request to send reminders (e.g., [1, 3, 7])
  approvalStallThresholdDays: number; // days without response before admin notification
}

const DEFAULT_CONFIG: SchedulerConfig = {
  enableReminders: true,
  enableContractReminders: true,
  enableWelcomeSequences: true,
  enableScheduledInvoices: true,
  enableRecurringInvoices: true,
  enableSoftDeleteCleanup: true,
  enableAnalyticsCleanup: true,
  enablePriorityEscalation: true,
  enableApprovalReminders: true,
  reminderCheckInterval: '0 * * * *', // Every hour at :00
  invoiceGenerationTime: '0 1 * * *', // Daily at 1:00 AM
  softDeleteCleanupTime: '0 2 * * *', // Daily at 2:00 AM
  analyticsCleanupTime: '0 3 * * *', // Daily at 3:00 AM
  priorityEscalationTime: '0 6 * * *', // Daily at 6:00 AM
  analyticsRetentionDays: 365, // Keep analytics data for 1 year
  approvalReminderIntervals: [1, 3, 7], // Send reminders at 1, 3, and 7 days
  approvalStallThresholdDays: 7 // Notify admin after 7 days without response
};

interface WelcomeEmail {
  id: number;
  clientId: number;
  emailType: 'welcome' | 'getting_started' | 'tips' | 'check_in';
  scheduledDate: string;
  sentAt: string | null;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
}

interface ContractReminder {
  id: number;
  projectId: number;
  reminderType: 'initial' | 'followup_3' | 'followup_7' | 'final_14';
  scheduledDate: string;
  sentAt: string | null;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  createdAt: string;
}

export class SchedulerService {
  private static instance: SchedulerService;
  private invoiceService: InvoiceService;
  private db: Database;
  private config: SchedulerConfig;
  private reminderJob: ScheduledTask | null = null;
  private invoiceGenerationJob: ScheduledTask | null = null;
  private softDeleteCleanupJob: ScheduledTask | null = null;
  private analyticsCleanupJob: ScheduledTask | null = null;
  private priorityEscalationJob: ScheduledTask | null = null;
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

    // Schedule soft delete cleanup (permanent deletion of items past 30-day retention)
    if (this.config.enableSoftDeleteCleanup) {
      this.scheduleSoftDeleteCleanup();
    }

    // Schedule analytics data cleanup (delete old page_views and interaction_events)
    if (this.config.enableAnalyticsCleanup) {
      this.scheduleAnalyticsCleanup();
    }

    // Schedule priority escalation (auto-escalate task priorities based on due date)
    if (this.config.enablePriorityEscalation) {
      this.schedulePriorityEscalation();
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

    if (this.softDeleteCleanupJob) {
      this.softDeleteCleanupJob.stop();
      this.softDeleteCleanupJob = null;
    }

    if (this.analyticsCleanupJob) {
      this.analyticsCleanupJob.stop();
      this.analyticsCleanupJob = null;
    }

    if (this.priorityEscalationJob) {
      this.priorityEscalationJob.stop();
      this.priorityEscalationJob = null;
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
   * Schedule soft delete cleanup (runs daily at 2 AM by default)
   * Permanently deletes items that have been in the trash for more than 30 days
   */
  private scheduleSoftDeleteCleanup(): void {
    console.log(`[Scheduler] Scheduling soft delete cleanup: ${this.config.softDeleteCleanupTime}`);

    this.softDeleteCleanupJob = cron.schedule(this.config.softDeleteCleanupTime, async () => {
      try {
        console.log('[Scheduler] Running soft delete cleanup...');
        const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

        if (deleted.total > 0) {
          console.log(`[Scheduler] Permanently deleted ${deleted.total} items (clients: ${deleted.clients}, projects: ${deleted.projects}, invoices: ${deleted.invoices}, leads: ${deleted.leads}, proposals: ${deleted.proposals})`);
        }

        if (errors.length > 0) {
          console.error('[Scheduler] Soft delete cleanup errors:', errors);
        }
      } catch (error) {
        console.error('[Scheduler] Error during soft delete cleanup:', error);
      }
    });
  }

  /**
   * Schedule analytics data cleanup (runs daily at 3 AM by default)
   * Deletes page_views and interaction_events older than retention period
   */
  private scheduleAnalyticsCleanup(): void {
    console.log(`[Scheduler] Scheduling analytics cleanup: ${this.config.analyticsCleanupTime}`);

    this.analyticsCleanupJob = cron.schedule(this.config.analyticsCleanupTime, async () => {
      try {
        console.log('[Scheduler] Running analytics data cleanup...');
        const deleted = await this.cleanupAnalyticsData();

        if (deleted.pageViews > 0 || deleted.interactionEvents > 0) {
          console.log(`[Scheduler] Cleaned up analytics data: ${deleted.pageViews} page views, ${deleted.interactionEvents} interaction events`);
        }
      } catch (error) {
        console.error('[Scheduler] Error during analytics cleanup:', error);
      }
    });
  }

  /**
   * Schedule priority escalation (runs daily at 6 AM by default)
   * Escalates task priorities based on due date proximity
   */
  private schedulePriorityEscalation(): void {
    console.log(`[Scheduler] Scheduling priority escalation: ${this.config.priorityEscalationTime}`);

    this.priorityEscalationJob = cron.schedule(this.config.priorityEscalationTime, async () => {
      try {
        console.log('[Scheduler] Running priority escalation...');
        const result = await this.processPriorityEscalation();

        if (result.updatedCount > 0) {
          console.log(`[Scheduler] Escalated ${result.updatedCount} task priorities`);
        }
      } catch (error) {
        console.error('[Scheduler] Error during priority escalation:', error);
      }
    });
  }

  /**
   * Process priority escalation for all projects
   * Escalates task priorities based on due date proximity
   */
  async processPriorityEscalation(): Promise<EscalationResult> {
    console.log('[Scheduler] Processing priority escalation...');
    const result = await escalateAllProjects();

    if (result.updatedCount > 0) {
      console.log(`[Scheduler] Escalated priorities for ${result.updatedCount} tasks`);
      for (const task of result.escalatedTasks) {
        console.log(`  - Task ${task.taskId}: ${task.oldPriority} → ${task.newPriority} (${task.daysUntilDue} days until due)`);
      }
    }

    return result;
  }

  /**
   * Clean up old analytics data
   * Deletes page_views and interaction_events older than retention period
   */
  async cleanupAnalyticsData(): Promise<{ pageViews: number; interactionEvents: number }> {
    const retentionDays = this.config.analyticsRetentionDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffISO = cutoffDate.toISOString();

    // Delete old page views
    const pageViewsResult = await this.db.run(
      'DELETE FROM page_views WHERE created_at < ?',
      [cutoffISO]
    );

    // Delete old interaction events
    const interactionEventsResult = await this.db.run(
      'DELETE FROM interaction_events WHERE created_at < ?',
      [cutoffISO]
    );

    return {
      pageViews: pageViewsResult?.changes || 0,
      interactionEvents: interactionEventsResult?.changes || 0
    };
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
   * Process due reminders and send emails (invoices + contracts)
   */
  async processReminders(): Promise<number> {
    console.log('[Scheduler] Processing due reminders...');

    let totalSent = 0;

    // Process invoice reminders
    const dueReminders = await this.invoiceService.processReminders();

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
        totalSent++;

        console.log(`[Scheduler] Sent ${reminder.reminderType} reminder for invoice ${invoice.invoiceNumber}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to send reminder ${reminder.id}:`, error);
        await this.invoiceService.markReminderFailed(reminder.id);
      }
    }

    // Process contract reminders
    if (this.config.enableContractReminders) {
      const contractSent = await this.processContractReminders();
      totalSent += contractSent;
    }

    // Process welcome sequences
    if (this.config.enableWelcomeSequences) {
      const welcomeSent = await this.processWelcomeSequences();
      totalSent += welcomeSent;
    }

    // Process approval reminders
    if (this.config.enableApprovalReminders) {
      const approvalSent = await this.processApprovalReminders();
      totalSent += approvalSent;
    }

    console.log(`[Scheduler] Processed reminders, total sent: ${totalSent}`);
    return totalSent;
  }

  /**
   * Process due contract reminders and send emails
   */
  async processContractReminders(): Promise<number> {
    console.log('[Scheduler] Processing contract reminders...');

    const today = new Date().toISOString().split('T')[0];
    let sentCount = 0;

    // Get due contract reminders for projects that haven't been signed yet
    // Note: signature_token is now on the contracts table (migrated in 074)
    const sql = `
      SELECT r.*, p.project_name, con.signature_token, c.email, c.contact_name
      FROM contract_reminders r
      JOIN projects p ON r.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN contracts con ON con.project_id = p.id
      WHERE r.status = 'pending'
        AND r.scheduled_date <= ?
        AND con.signed_at IS NULL
        AND con.signature_token IS NOT NULL
        AND p.contract_reminders_enabled = TRUE
    `;

    const dueReminders = await this.db.all(sql, [today]);

    for (const reminder of dueReminders) {
      try {
        if (!reminder.email) {
          console.warn(`[Scheduler] No email for project ${reminder.project_id}, skipping contract reminder`);
          await this.markContractReminderSkipped(reminder.id);
          continue;
        }

        // Build the signing URL (signature_token comes from contracts table)
        const signingUrl = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:3000'}/contract/sign/${reminder.signature_token}`;

        await this.sendContractReminderEmail({
          email: reminder.email,
          clientName: reminder.contact_name || 'Valued Client',
          projectName: reminder.project_name,
          reminderType: reminder.reminder_type,
          signingUrl
        });

        await this.markContractReminderSent(reminder.id);
        sentCount++;

        // Log to audit trail
        await this.db.run(
          `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
           VALUES (?, 'reminder_sent', ?, ?)`,
          [reminder.project_id, 'system', JSON.stringify({ reminderType: reminder.reminder_type })]
        );

        console.log(`[Scheduler] Sent ${reminder.reminder_type} contract reminder for project ${reminder.project_name}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to send contract reminder ${reminder.id}:`, error);
        await this.markContractReminderFailed(reminder.id);
      }
    }

    console.log(`[Scheduler] Processed ${dueReminders.length} contract reminders, sent ${sentCount}`);
    return sentCount;
  }

  /**
   * Schedule contract reminders when a signature request is sent
   */
  async scheduleContractReminders(projectId: number): Promise<void> {
    const today = new Date();

    // Clear any existing pending reminders for this project
    await this.db.run(
      'DELETE FROM contract_reminders WHERE project_id = ? AND status = ?',
      [projectId, 'pending']
    );

    // Schedule reminders at: 0 days (initial), 3 days, 7 days, 14 days
    const reminderSchedule: Array<{ type: string; daysFromNow: number }> = [
      { type: 'initial', daysFromNow: 0 },
      { type: 'followup_3', daysFromNow: 3 },
      { type: 'followup_7', daysFromNow: 7 },
      { type: 'final_14', daysFromNow: 14 }
    ];

    for (const reminder of reminderSchedule) {
      const scheduledDate = new Date(today);
      scheduledDate.setDate(scheduledDate.getDate() + reminder.daysFromNow);

      await this.db.run(
        'INSERT INTO contract_reminders (project_id, reminder_type, scheduled_date) VALUES (?, ?, ?)',
        [projectId, reminder.type, scheduledDate.toISOString().split('T')[0]]
      );
    }

    console.log(`[Scheduler] Scheduled contract reminders for project ${projectId}`);
  }

  /**
   * Cancel contract reminders when contract is signed
   */
  async cancelContractReminders(projectId: number): Promise<void> {
    await this.db.run(
      'UPDATE contract_reminders SET status = ? WHERE project_id = ? AND status = ?',
      ['skipped', projectId, 'pending']
    );
    console.log(`[Scheduler] Cancelled contract reminders for project ${projectId}`);
  }

  /**
   * Mark a contract reminder as sent
   */
  private async markContractReminderSent(reminderId: number): Promise<void> {
    await this.db.run(
      'UPDATE contract_reminders SET status = ?, sent_at = ? WHERE id = ?',
      ['sent', new Date().toISOString(), reminderId]
    );
  }

  /**
   * Mark a contract reminder as skipped
   */
  private async markContractReminderSkipped(reminderId: number): Promise<void> {
    await this.db.run(
      'UPDATE contract_reminders SET status = ? WHERE id = ?',
      ['skipped', reminderId]
    );
  }

  /**
   * Mark a contract reminder as failed
   */
  private async markContractReminderFailed(reminderId: number): Promise<void> {
    await this.db.run(
      'UPDATE contract_reminders SET status = ? WHERE id = ?',
      ['failed', reminderId]
    );
  }

  /**
   * Send a contract reminder email
   */
  private async sendContractReminderEmail(data: {
    email: string;
    clientName: string;
    projectName: string;
    reminderType: string;
    signingUrl: string;
  }): Promise<void> {
    const { email, clientName, projectName, reminderType, signingUrl } = data;

    let subject: string;
    let message: string;
    let urgency = '';

    switch (reminderType) {
    case 'initial':
      subject = `Contract Ready for Signature: ${projectName}`;
      message = `Your contract for "${projectName}" is ready for your signature.`;
      break;
    case 'followup_3':
      subject = `Reminder: Contract Awaiting Signature - ${projectName}`;
      message = `This is a friendly reminder that your contract for "${projectName}" is still awaiting your signature.`;
      urgency = 'Please sign at your earliest convenience so we can get started on your project.';
      break;
    case 'followup_7':
      subject = `Action Required: Contract Signature Needed - ${projectName}`;
      message = `Your contract for "${projectName}" has been awaiting your signature for 7 days.`;
      urgency = 'Please review and sign the contract to proceed with your project.';
      break;
    case 'final_14':
      subject = `Final Reminder: Contract Signature Required - ${projectName}`;
      message = `This is a final reminder that your contract for "${projectName}" needs to be signed.`;
      urgency = 'The signature link will expire soon. Please sign today to avoid delays.';
      break;
    default:
      subject = `Contract Awaiting Signature: ${projectName}`;
      message = `Your contract for "${projectName}" is ready for your signature.`;
    }

    await emailService.sendEmail({
      to: email,
      subject,
      text: `
Hi ${clientName},

${message}
${urgency ? `\n${urgency}\n` : ''}
Sign your contract here: ${signingUrl}

If you have any questions about the contract, please don't hesitate to reach out.

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
    .header { background: #00ff41; color: #000; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .project-name { font-size: 20px; font-weight: bold; color: #333; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .urgency { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Contract Ready for Signature</h2>
    </div>
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>${message}</p>
      ${urgency ? `<div class="urgency"><strong>${urgency}</strong></div>` : ''}
      <div class="project-name">Project: ${projectName}</div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${signingUrl}" class="button">Sign Contract</a>
      </p>
      <p><small>If you have any questions about the contract, please don't hesitate to reach out.</small></p>
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

  // ===================================
  // WELCOME SEQUENCE METHODS
  // ===================================

  /**
   * Process due welcome sequence emails
   */
  async processWelcomeSequences(): Promise<number> {
    console.log('[Scheduler] Processing welcome sequences...');

    const today = new Date().toISOString().split('T')[0];
    let sentCount = 0;

    // Get due welcome emails for active clients
    const sql = `
      SELECT w.*, c.email, c.contact_name, c.company_name
      FROM welcome_sequence_emails w
      JOIN clients c ON w.client_id = c.id
      WHERE w.status = 'pending'
        AND w.scheduled_date <= ?
        AND c.status IN ('active', 'pending')
    `;

    const dueEmails = await this.db.all(sql, [today]);

    for (const email of dueEmails) {
      try {
        if (!email.email) {
          console.warn(`[Scheduler] No email for client ${email.client_id}, skipping welcome email`);
          await this.markWelcomeEmailSkipped(email.id);
          continue;
        }

        const portalUrl = process.env.CLIENT_PORTAL_URL || 'http://localhost:3000/client/portal';

        await this.sendWelcomeEmail({
          email: email.email,
          clientName: email.contact_name || 'Valued Client',
          companyName: email.company_name,
          emailType: email.email_type,
          portalUrl
        });

        await this.markWelcomeEmailSent(email.id);
        sentCount++;

        console.log(`[Scheduler] Sent ${email.email_type} welcome email to ${email.email}`);
      } catch (error) {
        console.error(`[Scheduler] Failed to send welcome email ${email.id}:`, error);
        await this.markWelcomeEmailFailed(email.id);
      }
    }

    // Check if any clients have completed their sequence
    await this.checkWelcomeSequenceCompletion();

    console.log(`[Scheduler] Processed ${dueEmails.length} welcome emails, sent ${sentCount}`);
    return sentCount;
  }

  /**
   * Start welcome sequence for a client (called when client account is activated)
   */
  async startWelcomeSequence(clientId: number): Promise<void> {
    const today = new Date();

    // Check if sequence already started
    const client = await this.db.get(
      'SELECT welcome_sequence_started_at FROM clients WHERE id = ?',
      [clientId]
    );

    if (client?.welcome_sequence_started_at) {
      console.log(`[Scheduler] Welcome sequence already started for client ${clientId}`);
      return;
    }

    // Get active welcome sequence templates
    const templates = await this.db.all(
      'SELECT * FROM welcome_sequence_templates WHERE is_active = TRUE ORDER BY sort_order'
    );

    // Schedule each email
    for (const template of templates) {
      const scheduledDate = new Date(today);
      scheduledDate.setDate(scheduledDate.getDate() + template.days_after_signup);

      await this.db.run(
        'INSERT INTO welcome_sequence_emails (client_id, email_type, scheduled_date) VALUES (?, ?, ?)',
        [clientId, template.email_type, scheduledDate.toISOString().split('T')[0]]
      );
    }

    // Mark sequence as started
    await this.db.run(
      'UPDATE clients SET welcome_sequence_started_at = ? WHERE id = ?',
      [today.toISOString(), clientId]
    );

    console.log(`[Scheduler] Started welcome sequence for client ${clientId} with ${templates.length} emails`);
  }

  /**
   * Cancel welcome sequence (e.g., if client is deactivated)
   */
  async cancelWelcomeSequence(clientId: number): Promise<void> {
    await this.db.run(
      'UPDATE welcome_sequence_emails SET status = ? WHERE client_id = ? AND status = ?',
      ['skipped', clientId, 'pending']
    );
    console.log(`[Scheduler] Cancelled welcome sequence for client ${clientId}`);
  }

  /**
   * Check if clients have completed their welcome sequence
   */
  private async checkWelcomeSequenceCompletion(): Promise<void> {
    // Find clients with all emails sent/skipped
    const sql = `
      UPDATE clients SET welcome_sequence_completed = TRUE
      WHERE id IN (
        SELECT c.id FROM clients c
        WHERE c.welcome_sequence_started_at IS NOT NULL
          AND c.welcome_sequence_completed = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM welcome_sequence_emails w
            WHERE w.client_id = c.id AND w.status = 'pending'
          )
      )
    `;
    await this.db.run(sql);
  }

  private async markWelcomeEmailSent(emailId: number): Promise<void> {
    await this.db.run(
      'UPDATE welcome_sequence_emails SET status = ?, sent_at = ? WHERE id = ?',
      ['sent', new Date().toISOString(), emailId]
    );
  }

  private async markWelcomeEmailSkipped(emailId: number): Promise<void> {
    await this.db.run(
      'UPDATE welcome_sequence_emails SET status = ? WHERE id = ?',
      ['skipped', emailId]
    );
  }

  private async markWelcomeEmailFailed(emailId: number): Promise<void> {
    await this.db.run(
      'UPDATE welcome_sequence_emails SET status = ? WHERE id = ?',
      ['failed', emailId]
    );
  }

  /**
   * Send a welcome sequence email
   */
  private async sendWelcomeEmail(data: {
    email: string;
    clientName: string;
    companyName?: string;
    emailType: string;
    portalUrl: string;
  }): Promise<void> {
    const { email, clientName, companyName, emailType, portalUrl } = data;

    let subject: string;
    let heading: string;
    let message: string;
    let ctaText: string;
    let ctaUrl: string;

    switch (emailType) {
    case 'welcome':
      subject = 'Welcome to No Bhad Codes!';
      heading = 'Welcome Aboard!';
      message = `We're thrilled to have ${companyName ? companyName : 'you'} as a client. Your client portal is now ready and waiting for you.`;
      ctaText = 'Visit Your Portal';
      ctaUrl = portalUrl;
      break;

    case 'getting_started':
      subject = 'Getting Started with Your Client Portal';
      heading = 'Quick Portal Tour';
      message = `Here's a quick overview of what you can do in your client portal:
        <ul style="text-align: left; margin: 15px auto; max-width: 400px;">
          <li><strong>Dashboard</strong> - See your project status at a glance</li>
          <li><strong>Messages</strong> - Communicate directly with your project team</li>
          <li><strong>Files</strong> - Access and upload project documents</li>
          <li><strong>Invoices</strong> - View and download invoices</li>
        </ul>`;
      ctaText = 'Explore Your Portal';
      ctaUrl = portalUrl;
      break;

    case 'tips':
      subject = 'Tips for Working Together';
      heading = 'Let\'s Make This Project Amazing';
      message = `A few tips for a smooth project experience:
        <ul style="text-align: left; margin: 15px auto; max-width: 400px;">
          <li><strong>Respond to messages promptly</strong> - This helps keep the project on track</li>
          <li><strong>Upload files to the portal</strong> - Keeps everything organized in one place</li>
          <li><strong>Review deliverables carefully</strong> - Your feedback is valuable</li>
          <li><strong>Ask questions!</strong> - No question is too small</li>
        </ul>`;
      ctaText = 'Go to Portal';
      ctaUrl = portalUrl;
      break;

    case 'check_in':
      subject = 'How\'s Everything Going?';
      heading = 'Quick Check-In';
      message = 'It\'s been a week since you set up your portal. We wanted to check in and make sure everything is going smoothly. If you have any questions or need help with anything, don\'t hesitate to reach out through the messaging system in your portal.';
      ctaText = 'Send Us a Message';
      ctaUrl = `${portalUrl}#messages`;
      break;

    default:
      subject = 'A Message from No Bhad Codes';
      heading = 'Hello!';
      message = 'We wanted to reach out and see how things are going.';
      ctaText = 'Visit Portal';
      ctaUrl = portalUrl;
    }

    await emailService.sendEmail({
      to: email,
      subject,
      text: `
Hi ${clientName},

${heading}

${message.replace(/<[^>]*>/g, '')}

${ctaUrl}

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
    .header { background: #00ff41; color: #000; padding: 20px; text-align: center; }
    .content { padding: 30px; background: #f9f9f9; text-align: center; }
    .button { display: inline-block; padding: 14px 28px; background: #00ff41; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
    ul { list-style: none; padding: 0; }
    li { padding: 8px 0; border-bottom: 1px solid #eee; }
    li:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${heading}</h1>
    </div>
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>${message}</p>
      <a href="${ctaUrl}" class="button">${ctaText}</a>
    </div>
    <div class="footer">
      <p>Best regards,<br>No Bhad Codes Team</p>
      <p style="font-size: 12px; color: #999;">You're receiving this because you have an account with No Bhad Codes.</p>
    </div>
  </div>
</body>
</html>
      `
    });
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

  // ===================================
  // APPROVAL REMINDER METHODS
  // ===================================

  /**
   * Process pending approval reminders
   * Sends reminders at configured intervals (1, 3, 7 days by default)
   * Notifies admin of stalled approvals (after 7 days by default)
   */
  async processApprovalReminders(): Promise<number> {
    console.log('[Scheduler] Processing approval reminders...');

    let sentCount = 0;
    const now = new Date();
    const intervals = this.config.approvalReminderIntervals;
    const stallThreshold = this.config.approvalStallThresholdDays;

    // Get pending approval requests with workflow and entity info
    const sql = `
      SELECT
        ar.id as request_id,
        ar.approver_email,
        ar.reminder_count,
        ar.reminder_sent_at,
        ar.created_at as request_created_at,
        wi.id as instance_id,
        wi.entity_type,
        wi.entity_id,
        wd.name as workflow_name
      FROM approval_requests ar
      JOIN approval_workflow_instances wi ON ar.workflow_instance_id = wi.id
      JOIN approval_workflow_definitions wd ON wi.workflow_definition_id = wd.id
      WHERE ar.status = 'pending'
        AND wi.status IN ('pending', 'in_progress')
    `;

    const pendingRequests = await this.db.all(sql);

    for (const request of pendingRequests) {
      try {
        const requestAge = Math.floor(
          (now.getTime() - new Date(request.request_created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        const lastReminderAge = request.reminder_sent_at
          ? Math.floor(
            (now.getTime() - new Date(request.reminder_sent_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          : requestAge;

        // Check if we should send a reminder based on intervals
        const nextReminderIndex = request.reminder_count;
        const shouldSendReminder = nextReminderIndex < intervals.length
          && requestAge >= intervals[nextReminderIndex]
          && lastReminderAge >= 1; // Don't send more than one reminder per day

        if (shouldSendReminder) {
          await this.sendApprovalReminderEmail({
            email: request.approver_email,
            entityType: request.entity_type,
            entityId: request.entity_id,
            workflowName: request.workflow_name,
            reminderCount: request.reminder_count + 1,
            daysWaiting: requestAge
          });

          // Update reminder tracking
          await this.db.run(
            'UPDATE approval_requests SET reminder_sent_at = ?, reminder_count = reminder_count + 1 WHERE id = ?',
            [now.toISOString(), request.request_id]
          );

          sentCount++;
          console.log(`[Scheduler] Sent approval reminder #${request.reminder_count + 1} to ${request.approver_email} for ${request.entity_type} #${request.entity_id}`);
        }

        // Check if stalled and notify admin
        if (requestAge >= stallThreshold && request.reminder_count >= intervals.length) {
          // Only notify once when crossing threshold
          const lastNotifyAge = request.reminder_sent_at
            ? Math.floor((now.getTime() - new Date(request.reminder_sent_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          if (lastNotifyAge >= 1) {
            await this.sendStalledApprovalAdminNotification({
              entityType: request.entity_type,
              entityId: request.entity_id,
              workflowName: request.workflow_name,
              approverEmail: request.approver_email,
              daysStalled: requestAge
            });

            // Update to prevent repeated notifications
            await this.db.run(
              'UPDATE approval_requests SET reminder_sent_at = ? WHERE id = ?',
              [now.toISOString(), request.request_id]
            );

            console.log(`[Scheduler] Sent stalled approval notification for ${request.entity_type} #${request.entity_id}`);
          }
        }
      } catch (error) {
        console.error(`[Scheduler] Error processing approval reminder for request ${request.request_id}:`, error);
      }
    }

    console.log(`[Scheduler] Processed approval reminders, sent ${sentCount}`);
    return sentCount;
  }

  /**
   * Send an approval reminder email
   */
  private async sendApprovalReminderEmail(data: {
    email: string;
    entityType: string;
    entityId: number;
    workflowName: string;
    reminderCount: number;
    daysWaiting: number;
  }): Promise<void> {
    const { email, entityType, entityId, workflowName, reminderCount, daysWaiting } = data;

    const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    const portalUrl = process.env.CLIENT_PORTAL_URL || 'http://localhost:3000';

    let subject: string;
    let urgency = '';

    if (reminderCount === 1) {
      subject = `Reminder: ${entityLabel} Awaiting Your Approval`;
    } else if (reminderCount === 2) {
      subject = `Second Reminder: ${entityLabel} Still Awaiting Approval`;
      urgency = 'This item has been waiting for your approval for several days.';
    } else {
      subject = `Urgent: ${entityLabel} Requires Immediate Approval`;
      urgency = `This item has been pending for ${daysWaiting} days and requires immediate attention.`;
    }

    await emailService.sendEmail({
      to: email,
      subject,
      text: `
Hi,

This is a reminder that a ${entityLabel.toLowerCase()} is awaiting your approval.

Workflow: ${workflowName}
${entityLabel}: #${entityId}
Waiting: ${daysWaiting} day${daysWaiting !== 1 ? 's' : ''}

${urgency ? `\n${urgency}\n` : ''}
Please log in to the portal to review and approve or reject this item.

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
    .header { background: ${reminderCount >= 3 ? '#dc3545' : '#00ff41'}; color: ${reminderCount >= 3 ? '#fff' : '#000'}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .info-box { background: #fff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #00ff41; }
    .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .urgency { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Approval Reminder</h2>
    </div>
    <div class="content">
      <p>Hi,</p>
      <p>This is a reminder that a ${entityLabel.toLowerCase()} is awaiting your approval.</p>
      <div class="info-box">
        <p><strong>Workflow:</strong> ${workflowName}</p>
        <p><strong>${entityLabel}:</strong> #${entityId}</p>
        <p><strong>Waiting:</strong> ${daysWaiting} day${daysWaiting !== 1 ? 's' : ''}</p>
      </div>
      ${urgency ? `<div class="urgency"><strong>${urgency}</strong></div>` : ''}
      <p style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button">Review & Approve</a>
      </p>
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
   * Send admin notification for stalled approvals
   */
  private async sendStalledApprovalAdminNotification(data: {
    entityType: string;
    entityId: number;
    workflowName: string;
    approverEmail: string;
    daysStalled: number;
  }): Promise<void> {
    const { entityType, entityId, workflowName, approverEmail, daysStalled } = data;

    const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL;
    const adminUrl = process.env.ADMIN_URL || 'http://localhost:3000/admin';

    if (!adminEmail) {
      console.warn('[Scheduler] No admin email configured for stalled approval notification');
      return;
    }

    await emailService.sendEmail({
      to: adminEmail,
      subject: `[Alert] Stalled Approval: ${entityLabel} #${entityId}`,
      text: `
STALLED APPROVAL ALERT

A ${entityLabel.toLowerCase()} approval has been stalled for ${daysStalled} days.

Details:
- Workflow: ${workflowName}
- ${entityLabel}: #${entityId}
- Awaiting approval from: ${approverEmail}
- Days stalled: ${daysStalled}

Action Required:
Please review this item and consider:
- Following up with the approver directly
- Reassigning the approval to another person
- Taking manual action if urgent

Admin Dashboard: ${adminUrl}

This is an automated alert from the approval system.
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc3545; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .alert-box { background: #fff; padding: 15px; border-radius: 8px; margin: 15px 0; border: 2px solid #dc3545; }
    .action-box { background: #e7f5ff; border-left: 4px solid #0066cc; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Stalled Approval Alert</h2>
    </div>
    <div class="content">
      <p>A ${entityLabel.toLowerCase()} approval has been stalled for <strong>${daysStalled} days</strong>.</p>
      <div class="alert-box">
        <p><strong>Workflow:</strong> ${workflowName}</p>
        <p><strong>${entityLabel}:</strong> #${entityId}</p>
        <p><strong>Awaiting approval from:</strong> ${approverEmail}</p>
        <p><strong>Days stalled:</strong> ${daysStalled}</p>
      </div>
      <div class="action-box">
        <p><strong>Action Required:</strong></p>
        <ul>
          <li>Follow up with the approver directly</li>
          <li>Reassign the approval to another person</li>
          <li>Take manual action if urgent</li>
        </ul>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${adminUrl}" class="button">Go to Admin Dashboard</a>
      </p>
    </div>
    <div class="footer">
      <p>This is an automated alert from the approval system.</p>
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
    jobs: {
      reminders: boolean;
      invoiceGeneration: boolean;
      softDeleteCleanup: boolean;
      analyticsCleanup: boolean;
      priorityEscalation: boolean;
    };
    } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      jobs: {
        reminders: this.reminderJob !== null,
        invoiceGeneration: this.invoiceGenerationJob !== null,
        softDeleteCleanup: this.softDeleteCleanupJob !== null,
        analyticsCleanup: this.analyticsCleanupJob !== null,
        priorityEscalation: this.priorityEscalationJob !== null
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

  /**
   * Manually trigger priority escalation (for testing/admin use)
   */
  async triggerPriorityEscalation(): Promise<EscalationResult> {
    return this.processPriorityEscalation();
  }
}

// Export singleton getter
export const getSchedulerService = (config?: Partial<SchedulerConfig>): SchedulerService => {
  return SchedulerService.getInstance(config);
};
