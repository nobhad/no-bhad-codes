/**
 * ===============================================
 * SCHEDULER SERVICE
 * ===============================================
 * @file server/services/scheduler-service.ts
 *
 * Handles scheduled tasks for invoice generation,
 * payment reminders, and recurring invoices using node-cron.
 */

import { invoiceService, type InvoiceService } from './invoice-service.js';
import { emailService, processEmailRetryQueue } from './email-service.js';
import { getDatabase, Database } from '../database/init.js';
import { softDeleteService } from './soft-delete-service.js';
import { escalateAllProjects, EscalationResult } from './priority-escalation-service.js';
import { paymentScheduleService } from './payment-schedule-service.js';
import { logger } from './logger.js';
import { getBaseUrl, getAdminUrl, getPortalUrl } from '../config/environment.js';
import { BUSINESS_INFO } from '../config/business.js';
import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from '../config/email-styles.js';

/**
 * Lightweight cron scheduler using setTimeout instead of node-cron.
 * node-cron v4's heartbeat mechanism has a bug that blocks the event loop
 * with cascading "missed execution" warnings on startup.
 * This replacement parses standard cron expressions and schedules callbacks
 * using setTimeout, which is simpler and avoids the heartbeat issue.
 */
interface SimpleTask {
  start(): void;
  stop(): void;
}

function parseCronExpression(expression: string): { minute: number; hour: number; isHourly: boolean } {
  const parts = expression.split(' ');
  // Format: minute hour day-of-month month day-of-week
  const minute = parseInt(parts[0], 10);
  const hourPart = parts[1];
  const isHourly = hourPart === '*';
  const hour = isHourly ? 0 : parseInt(hourPart, 10);
  return { minute, hour, isHourly };
}

function getNextRunTime(expression: string): Date {
  const { minute, hour, isHourly } = parseCronExpression(expression);
  const now = new Date();
  const next = new Date(now);

  if (isHourly) {
    // Runs at :minute every hour
    next.setMinutes(minute, 0, 0);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
  } else {
    // Runs at hour:minute daily
    next.setHours(hour, minute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

function createSimpleTask(expression: string, callback: () => Promise<void>): SimpleTask {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const scheduleNext = () => {
    if (!running) return;
    const next = getNextRunTime(expression);
    const delay = next.getTime() - Date.now();
    timer = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        logger.error('[Scheduler] Task execution error:', {
          error: error instanceof Error ? error : undefined
        });
      }
      scheduleNext();
    }, delay);
  };

  return {
    start() {
      running = true;
      scheduleNext();
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
}

interface SchedulerConfig {
  enableReminders: boolean;
  enableContractReminders: boolean;
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

// Database query result interfaces for type safety
interface ClientRow {
  email: string;
  contact_name: string | null;
}

interface ContractReminderRow {
  id: number;
  project_id: number;
  reminder_type: string;
  email: string | null;
  contact_name: string | null;
  project_name: string;
  signature_token: string;
}

interface ApprovalRequestRow {
  request_id: number;
  entity_type: string;
  entity_id: number;
  workflow_name: string;
  approver_email: string;
  reminder_count: number;
  reminder_sent_at: string | null;
  request_created_at: string;
}

export class SchedulerService {
  private static instance: SchedulerService;
  private invoiceService: InvoiceService;
  private config: SchedulerConfig;
  private reminderJob: SimpleTask | null = null;
  private invoiceGenerationJob: SimpleTask | null = null;
  private softDeleteCleanupJob: SimpleTask | null = null;
  private analyticsCleanupJob: SimpleTask | null = null;
  private priorityEscalationJob: SimpleTask | null = null;
  private sequenceProcessingJob: SimpleTask | null = null;
  private meetingReminderJob: SimpleTask | null = null;
  private automationScheduledJob: SimpleTask | null = null;
  private retainerBillingJob: SimpleTask | null = null;
  private retainerUsageAlertJob: SimpleTask | null = null;
  private isRunning = false;

  private constructor(config: Partial<SchedulerConfig> = {}) {
    this.invoiceService = invoiceService;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getDb(): Database {
    return getDatabase();
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
      logger.info('[Scheduler] Already running');
      return;
    }

    logger.info('[Scheduler] Starting scheduler service...');

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

    // Schedule email sequence queue processing (every 30 minutes)
    this.scheduleSequenceProcessing();

    // Schedule meeting reminders (daily at 9:00 AM)
    this.scheduleMeetingReminders();

    // Schedule automation wait-step processing (every 5 minutes)
    this.scheduleAutomationProcessing();

    // Schedule retainer billing (daily at 7:00 AM) and usage alerts (daily at 8:00 AM)
    this.scheduleRetainerBilling();
    this.scheduleRetainerUsageAlerts();

    // Start all scheduled jobs
    const jobs = [
      this.reminderJob,
      this.invoiceGenerationJob,
      this.softDeleteCleanupJob,
      this.analyticsCleanupJob,
      this.priorityEscalationJob,
      this.sequenceProcessingJob,
      this.meetingReminderJob,
      this.automationScheduledJob,
      this.retainerBillingJob,
      this.retainerUsageAlertJob
    ].filter(Boolean);

    for (const job of jobs) {
      job!.start();
    }

    this.isRunning = true;
    logger.info(`[Scheduler] Scheduler service started with ${jobs.length} cron jobs`);
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    logger.info('[Scheduler] Stopping scheduler service...');

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

    if (this.sequenceProcessingJob) {
      this.sequenceProcessingJob.stop();
      this.sequenceProcessingJob = null;
    }

    if (this.meetingReminderJob) {
      this.meetingReminderJob.stop();
      this.meetingReminderJob = null;
    }

    if (this.automationScheduledJob) {
      this.automationScheduledJob.stop();
      this.automationScheduledJob = null;
    }

    if (this.retainerBillingJob) {
      this.retainerBillingJob.stop();
      this.retainerBillingJob = null;
    }

    if (this.retainerUsageAlertJob) {
      this.retainerUsageAlertJob.stop();
      this.retainerUsageAlertJob = null;
    }

    this.isRunning = false;
    logger.info('[Scheduler] Scheduler service stopped');
  }

  /**
   * Schedule reminder checks (runs hourly by default)
   */
  private scheduleReminderCheck(): void {
    logger.info(`[Scheduler] Scheduling reminder checks: ${this.config.reminderCheckInterval}`);

    this.reminderJob = createSimpleTask(this.config.reminderCheckInterval, async () => {
      try {
        await this.processReminders();
      } catch (error) {
        logger.error('[Scheduler] Error processing reminders:', {
          error: error instanceof Error ? error : undefined
        });
      }

      // Process email retry queue on each hourly tick
      try {
        const retryResult = await processEmailRetryQueue();
        if (retryResult.retried > 0 || retryResult.failed > 0) {
          logger.info(
            `[Scheduler] Email retry queue: ${retryResult.retried} retried, ${retryResult.failed} failed, ${retryResult.remaining} remaining`
          );
        }
      } catch (error) {
        logger.error('[Scheduler] Error processing email retry queue:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule invoice generation (runs daily by default)
   */
  private scheduleInvoiceGeneration(): void {
    logger.info(`[Scheduler] Scheduling invoice generation: ${this.config.invoiceGenerationTime}`);

    this.invoiceGenerationJob = createSimpleTask(this.config.invoiceGenerationTime, async () => {
      try {
        // Check and mark overdue invoices first
        await this.checkOverdueInvoices();

        // Check and mark overdue payment schedule installments
        const overdueInstallments = await paymentScheduleService.checkAndUpdateOverdue();
        if (overdueInstallments > 0) {
          logger.info(`[Scheduler] Marked ${overdueInstallments} installments as overdue`);
        }

        // Auto-generate invoices from due payment schedule installments
        const installmentInvoices = await paymentScheduleService.generateDueInvoices();
        if (installmentInvoices.generated > 0) {
          logger.info(`[Scheduler] Generated ${installmentInvoices.generated} invoices from payment schedule installments`);
        }

        if (this.config.enableScheduledInvoices) {
          await this.processScheduledInvoices();
        }
        if (this.config.enableRecurringInvoices) {
          await this.processRecurringInvoices();
        }
      } catch (error) {
        logger.error('[Scheduler] Error generating invoices:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule soft delete cleanup (runs daily at 2 AM by default)
   * Permanently deletes items that have been in the trash for more than 30 days
   */
  private scheduleSoftDeleteCleanup(): void {
    logger.info(`[Scheduler] Scheduling soft delete cleanup: ${this.config.softDeleteCleanupTime}`);

    this.softDeleteCleanupJob = createSimpleTask(this.config.softDeleteCleanupTime, async () => {
      try {
        logger.info('[Scheduler] Running soft delete cleanup...');
        const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

        if (deleted.total > 0) {
          logger.info(
            `[Scheduler] Permanently deleted ${deleted.total} items (clients: ${deleted.clients}, projects: ${deleted.projects}, invoices: ${deleted.invoices}, leads: ${deleted.leads}, proposals: ${deleted.proposals})`
          );
        }

        if (errors.length > 0) {
          logger.error('[Scheduler] Soft delete cleanup errors:', { metadata: { errors } });
        }
      } catch (error) {
        logger.error('[Scheduler] Error during soft delete cleanup:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule analytics data cleanup (runs daily at 3 AM by default)
   * Deletes page_views and interaction_events older than retention period
   */
  private scheduleAnalyticsCleanup(): void {
    logger.info(`[Scheduler] Scheduling analytics cleanup: ${this.config.analyticsCleanupTime}`);

    this.analyticsCleanupJob = createSimpleTask(this.config.analyticsCleanupTime, async () => {
      try {
        logger.info('[Scheduler] Running analytics data cleanup...');
        const deleted = await this.cleanupAnalyticsData();

        if (deleted.pageViews > 0 || deleted.interactionEvents > 0) {
          logger.info(
            `[Scheduler] Cleaned up analytics data: ${deleted.pageViews} page views, ${deleted.interactionEvents} interaction events`
          );
        }
      } catch (error) {
        logger.error('[Scheduler] Error during analytics cleanup:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule priority escalation (runs daily at 6 AM by default)
   * Escalates task priorities based on due date proximity
   */
  private schedulePriorityEscalation(): void {
    logger.info(
      `[Scheduler] Scheduling priority escalation: ${this.config.priorityEscalationTime}`
    );

    this.priorityEscalationJob = createSimpleTask(this.config.priorityEscalationTime, async () => {
      try {
        logger.info('[Scheduler] Running priority escalation...');
        const result = await this.processPriorityEscalation();

        if (result.updatedCount > 0) {
          logger.info(`[Scheduler] Escalated ${result.updatedCount} task priorities`);
        }
      } catch (error) {
        logger.error('[Scheduler] Error during priority escalation:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule email sequence queue processing — every 30 minutes
   */
  private scheduleSequenceProcessing(): void {
    const SEQUENCE_CRON = '*/30 * * * *'; // Every 30 minutes
    logger.info(`[Scheduler] Scheduling sequence processing: ${SEQUENCE_CRON}`);

    this.sequenceProcessingJob = createSimpleTask(SEQUENCE_CRON, async () => {
      try {
        const { sequenceService } = await import('./sequence-service.js');
        const result = await sequenceService.processQueue();

        if (result.sent > 0 || result.failed > 0 || result.completed > 0) {
          logger.info(
            `[Scheduler] Sequences: sent=${result.sent}, failed=${result.failed}, stopped=${result.stopped}, completed=${result.completed}`
          );
        }
      } catch (error) {
        logger.error('[Scheduler] Error during sequence processing:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule meeting reminders — daily at 9:00 AM
   */
  private scheduleMeetingReminders(): void {
    const MEETING_REMINDER_CRON = '0 9 * * *'; // 9:00 AM daily
    logger.info(`[Scheduler] Scheduling meeting reminders: ${MEETING_REMINDER_CRON}`);

    this.meetingReminderJob = createSimpleTask(MEETING_REMINDER_CRON, async () => {
      try {
        const { meetingRequestService } = await import('./meeting-request-service.js');
        const sent = await meetingRequestService.sendUpcomingReminders();

        if (sent > 0) {
          logger.info(`[Scheduler] Meeting reminders sent: ${sent}`);
        }
      } catch (error) {
        logger.error('[Scheduler] Error during meeting reminders:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule retainer auto-invoicing — daily at 7:00 AM
   */
  private scheduleRetainerBilling(): void {
    const RETAINER_BILLING_CRON = '0 7 * * *';
    logger.info(`[Scheduler] Scheduling retainer billing: ${RETAINER_BILLING_CRON}`);

    this.retainerBillingJob = createSimpleTask(RETAINER_BILLING_CRON, async () => {
      try {
        const { retainerService } = await import('./retainer-service.js');
        const result = await retainerService.processMonthlyBilling();

        if (result.invoiced > 0 || result.errors.length > 0) {
          logger.info(
            `[Scheduler] Retainer billing: invoiced=${result.invoiced}, skipped=${result.skipped}, errors=${result.errors.length}`
          );
        }
      } catch (error) {
        logger.error('[Scheduler] Error during retainer billing:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule retainer usage alerts — daily at 8:00 AM
   */
  private scheduleRetainerUsageAlerts(): void {
    const RETAINER_ALERTS_CRON = '0 8 * * *';
    logger.info(`[Scheduler] Scheduling retainer usage alerts: ${RETAINER_ALERTS_CRON}`);

    this.retainerUsageAlertJob = createSimpleTask(RETAINER_ALERTS_CRON, async () => {
      try {
        const { retainerService } = await import('./retainer-service.js');
        const result = await retainerService.sendUsageAlerts();

        if (result.sent > 0) {
          logger.info(`[Scheduler] Retainer usage alerts sent: ${result.sent}`);
        }
      } catch (error) {
        logger.error('[Scheduler] Error during retainer usage alerts:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Schedule custom automation wait-step processing — every 5 minutes
   */
  private scheduleAutomationProcessing(): void {
    const AUTOMATION_CRON = '*/5 * * * *'; // Every 5 minutes
    logger.info(`[Scheduler] Scheduling automation processing: ${AUTOMATION_CRON}`);

    this.automationScheduledJob = createSimpleTask(AUTOMATION_CRON, async () => {
      try {
        const { automationEngine } = await import('./automation-engine.js');
        const result = await automationEngine.processScheduledActions();

        if (result.executed > 0 || result.failed > 0) {
          logger.info(
            `[Scheduler] Automation scheduled actions: executed=${result.executed}, failed=${result.failed}`
          );
        }
      } catch (error) {
        logger.error('[Scheduler] Error during automation processing:', {
          error: error instanceof Error ? error : undefined
        });
      }
    });
  }

  /**
   * Process priority escalation for all projects
   * Escalates task priorities based on due date proximity
   */
  async processPriorityEscalation(): Promise<EscalationResult> {
    logger.info('[Scheduler] Processing priority escalation...');
    const result = await escalateAllProjects();

    if (result.updatedCount > 0) {
      logger.info(`[Scheduler] Escalated priorities for ${result.updatedCount} tasks`);
      for (const task of result.escalatedTasks) {
        logger.info(
          `[Scheduler]   - Task ${task.taskId}: ${task.oldPriority} → ${task.newPriority} (${task.daysUntilDue} days until due)`
        );
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
    const pageViewsResult = await this.getDb().run('DELETE FROM page_views WHERE created_at < ?', [
      cutoffISO
    ]);

    // Delete old interaction events
    const interactionEventsResult = await this.getDb().run(
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
    logger.info('[Scheduler] Checking for overdue invoices...');
    const count = await this.invoiceService.checkAndMarkOverdue();
    if (count > 0) {
      logger.info(`[Scheduler] Marked ${count} invoices as overdue`);
    }
    return count;
  }

  /**
   * Process due reminders and send emails (invoices + contracts)
   */
  async processReminders(): Promise<number> {
    logger.info('[Scheduler] Processing due reminders...');

    let totalSent = 0;

    // Process invoice reminders
    const dueReminders = await this.invoiceService.processReminders();

    for (const reminder of dueReminders) {
      try {
        // Get invoice and client details
        const invoice = await this.invoiceService.getInvoiceById(reminder.invoiceId);

        // Get client email from database
        const client = (await this.getDb().get('SELECT email, contact_name FROM clients WHERE id = ?', [
          invoice.clientId
        ])) as ClientRow | undefined;

        if (!client || !client.email) {
          logger.warn(`[Scheduler] No email for client ${invoice.clientId}, skipping reminder`);
          await this.invoiceService.skipReminder(reminder.id);
          continue;
        }

        // Send reminder email
        const portalUrl = `${getPortalUrl()}?invoice=${invoice.id}`;

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

        logger.info(
          `[Scheduler] Sent ${reminder.reminderType} reminder for invoice ${invoice.invoiceNumber}`
        );
      } catch (error) {
        logger.error(`[Scheduler] Failed to send reminder ${reminder.id}:`, {
          error: error instanceof Error ? error : undefined
        });
        await this.invoiceService.markReminderFailed(reminder.id);
      }
    }

    // Process contract reminders
    if (this.config.enableContractReminders) {
      const contractSent = await this.processContractReminders();
      totalSent += contractSent;
    }

    // Process approval reminders
    if (this.config.enableApprovalReminders) {
      const approvalSent = await this.processApprovalReminders();
      totalSent += approvalSent;
    }

    logger.info(`[Scheduler] Processed reminders, total sent: ${totalSent}`);
    return totalSent;
  }

  /**
   * Process due contract reminders and send emails
   */
  async processContractReminders(): Promise<number> {
    logger.info('[Scheduler] Processing contract reminders...');

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

    const dueReminders = (await this.getDb().all(sql, [today])) as unknown as ContractReminderRow[];

    for (const reminder of dueReminders) {
      try {
        if (!reminder.email) {
          logger.warn(
            `[Scheduler] No email for project ${reminder.project_id}, skipping contract reminder`
          );
          await this.markContractReminderSkipped(reminder.id);
          continue;
        }

        // Build the signing URL (signature_token comes from contracts table)
        const signingUrl = `${getBaseUrl()}/contract/sign/${reminder.signature_token}`;

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
        await this.getDb().run(
          `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
           VALUES (?, 'reminder_sent', ?, ?)`,
          [reminder.project_id, 'system', JSON.stringify({ reminderType: reminder.reminder_type })]
        );

        logger.info(
          `[Scheduler] Sent ${reminder.reminder_type} contract reminder for project ${reminder.project_name}`
        );
      } catch (error) {
        logger.error(`[Scheduler] Failed to send contract reminder ${reminder.id}:`, {
          error: error instanceof Error ? error : undefined
        });
        await this.markContractReminderFailed(reminder.id);
      }
    }

    logger.info(
      `[Scheduler] Processed ${dueReminders.length} contract reminders, sent ${sentCount}`
    );
    return sentCount;
  }

  /**
   * Schedule contract reminders when a signature request is sent
   */
  async scheduleContractReminders(projectId: number): Promise<void> {
    const today = new Date();

    // Clear any existing pending reminders for this project
    await this.getDb().run('DELETE FROM contract_reminders WHERE project_id = ? AND status = ?', [
      projectId,
      'pending'
    ]);

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

      await this.getDb().run(
        'INSERT INTO contract_reminders (project_id, reminder_type, scheduled_date) VALUES (?, ?, ?)',
        [projectId, reminder.type, scheduledDate.toISOString().split('T')[0]]
      );
    }

    logger.info(`[Scheduler] Scheduled contract reminders for project ${projectId}`);
  }

  /**
   * Cancel contract reminders when contract is signed
   */
  async cancelContractReminders(projectId: number): Promise<void> {
    await this.getDb().run(
      'UPDATE contract_reminders SET status = ? WHERE project_id = ? AND status = ?',
      ['skipped', projectId, 'pending']
    );
    logger.info(`[Scheduler] Cancelled contract reminders for project ${projectId}`);
  }

  /**
   * Mark a contract reminder as sent
   */
  private async markContractReminderSent(reminderId: number): Promise<void> {
    await this.getDb().run('UPDATE contract_reminders SET status = ?, sent_at = ? WHERE id = ?', [
      'sent',
      new Date().toISOString(),
      reminderId
    ]);
  }

  /**
   * Mark a contract reminder as skipped
   */
  private async markContractReminderSkipped(reminderId: number): Promise<void> {
    await this.getDb().run('UPDATE contract_reminders SET status = ? WHERE id = ?', [
      'skipped',
      reminderId
    ]);
  }

  /**
   * Mark a contract reminder as failed
   */
  private async markContractReminderFailed(reminderId: number): Promise<void> {
    await this.getDb().run('UPDATE contract_reminders SET status = ? WHERE id = ?', [
      'failed',
      reminderId
    ]);
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
${BUSINESS_INFO.name} Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${EMAIL_COLORS.brandAccentAlt}; color: ${EMAIL_COLORS.buttonPrimaryText}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: ${EMAIL_COLORS.contentBg}; }
    .project-name { font-size: 20px; font-weight: bold; color: ${EMAIL_COLORS.bodyText}; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.buttonPrimaryBg}; color: ${EMAIL_COLORS.buttonPrimaryText}; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .urgency { background: ${EMAIL_COLORS.highlightBg}; border-left: 4px solid ${EMAIL_COLORS.highlightBorder}; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: ${EMAIL_TYPOGRAPHY.footerFontSize}; color: ${EMAIL_COLORS.bodyTextMuted}; }
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
      <p>Best regards,<br>${BUSINESS_INFO.name} Team</p>
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
    logger.info('[Scheduler] Processing scheduled invoices...');
    const count = await this.invoiceService.processScheduledInvoices();
    logger.info(`[Scheduler] Generated ${count} scheduled invoices`);
    return count;
  }

  /**
   * Process recurring invoices
   */
  async processRecurringInvoices(): Promise<number> {
    logger.info('[Scheduler] Processing recurring invoices...');
    const count = await this.invoiceService.processRecurringInvoices();
    logger.info(`[Scheduler] Generated ${count} recurring invoices`);
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
${BUSINESS_INFO.name} Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${reminderType.includes('overdue') ? EMAIL_COLORS.danger : EMAIL_COLORS.brandAccentAlt}; color: ${reminderType.includes('overdue') ? EMAIL_COLORS.headerText : EMAIL_COLORS.buttonPrimaryText}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: ${EMAIL_COLORS.contentBg}; }
    .amount { font-size: 24px; font-weight: bold; color: ${EMAIL_COLORS.bodyText}; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.buttonPrimaryBg}; color: ${EMAIL_COLORS.buttonPrimaryText}; text-decoration: none; border-radius: 4px; }
    .urgency { background: ${EMAIL_COLORS.highlightBg}; border-left: 4px solid ${EMAIL_COLORS.highlightBorder}; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: ${EMAIL_TYPOGRAPHY.footerFontSize}; color: ${EMAIL_COLORS.bodyTextMuted}; }
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
      <p>Best regards,<br>${BUSINESS_INFO.name} Team</p>
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
    logger.info('[Scheduler] Processing approval reminders...');

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

    const pendingRequests = (await this.getDb().all(sql)) as unknown as ApprovalRequestRow[];

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
        const shouldSendReminder =
          nextReminderIndex < intervals.length &&
          requestAge >= intervals[nextReminderIndex] &&
          lastReminderAge >= 1; // Don't send more than one reminder per day

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
          await this.getDb().run(
            'UPDATE approval_requests SET reminder_sent_at = ?, reminder_count = reminder_count + 1 WHERE id = ?',
            [now.toISOString(), request.request_id]
          );

          sentCount++;
          logger.info(
            `[Scheduler] Sent approval reminder #${request.reminder_count + 1} to ${request.approver_email} for ${request.entity_type} #${request.entity_id}`
          );
        }

        // Check if stalled and notify admin
        if (requestAge >= stallThreshold && request.reminder_count >= intervals.length) {
          // Only notify once when crossing threshold
          const lastNotifyAge = request.reminder_sent_at
            ? Math.floor(
              (now.getTime() - new Date(request.reminder_sent_at).getTime()) /
                  (1000 * 60 * 60 * 24)
            )
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
            await this.getDb().run('UPDATE approval_requests SET reminder_sent_at = ? WHERE id = ?', [
              now.toISOString(),
              request.request_id
            ]);

            logger.info(
              `[Scheduler] Sent stalled approval notification for ${request.entity_type} #${request.entity_id}`
            );
          }
        }
      } catch (error) {
        logger.error(
          `[Scheduler] Error processing approval reminder for request ${request.request_id}:`,
          { error: error instanceof Error ? error : undefined }
        );
      }
    }

    logger.info(`[Scheduler] Processed approval reminders, sent ${sentCount}`);
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
    const portalUrl = getPortalUrl();

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
${BUSINESS_INFO.name} Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${reminderCount >= 3 ? EMAIL_COLORS.danger : EMAIL_COLORS.brandAccentAlt}; color: ${reminderCount >= 3 ? EMAIL_COLORS.headerText : EMAIL_COLORS.buttonPrimaryText}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: ${EMAIL_COLORS.contentBg}; }
    .info-box { background: ${EMAIL_COLORS.cardBg}; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${EMAIL_COLORS.brandAccentAlt}; }
    .button { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.buttonPrimaryBg}; color: ${EMAIL_COLORS.buttonPrimaryText}; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .urgency { background: ${EMAIL_COLORS.highlightBg}; border-left: 4px solid ${EMAIL_COLORS.highlightBorder}; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: ${EMAIL_TYPOGRAPHY.footerFontSize}; color: ${EMAIL_COLORS.bodyTextMuted}; }
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
      <p>Best regards,<br>${BUSINESS_INFO.name} Team</p>
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
    const adminUrl = getAdminUrl();

    if (!adminEmail) {
      logger.warn('[Scheduler] No admin email configured for stalled approval notification');
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
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${EMAIL_COLORS.danger}; color: ${EMAIL_COLORS.headerText}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: ${EMAIL_COLORS.contentBg}; }
    .alert-box { background: ${EMAIL_COLORS.cardBg}; padding: 15px; border-radius: 8px; margin: 15px 0; border: 2px solid ${EMAIL_COLORS.danger}; }
    .action-box { background: ${EMAIL_COLORS.infoBg}; border-left: 4px solid ${EMAIL_COLORS.infoBorder}; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.link}; color: ${EMAIL_COLORS.headerText}; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .footer { padding: 20px; text-align: center; font-size: ${EMAIL_TYPOGRAPHY.footerFontSize}; color: ${EMAIL_COLORS.bodyTextMuted}; }
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
