/**
 * ===============================================
 * SCHEDULER SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/scheduler-service.test.ts
 *
 * Unit tests for cron-based scheduler service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock node-cron
const mockCronSchedule = vi.fn();
const mockCronStop = vi.fn();
vi.mock('node-cron', () => ({
  default: {
    schedule: mockCronSchedule.mockReturnValue({ stop: mockCronStop })
  }
}));

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
}));

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

// Mock invoice service
const mockInvoiceService = {
  getInstance: vi.fn(),
  processScheduledInvoices: vi.fn(),
  processRecurringInvoices: vi.fn(),
  processReminders: vi.fn(),
  checkAndMarkOverdue: vi.fn(),
  getInvoiceById: vi.fn(),
  skipReminder: vi.fn(),
  markReminderSent: vi.fn(),
  markReminderFailed: vi.fn()
};

vi.mock('../../../server/services/invoice-service', () => ({
  InvoiceService: {
    getInstance: () => mockInvoiceService
  }
}));

// Mock email service
const mockEmailService = {
  sendEmail: vi.fn()
};

vi.mock('../../../server/services/email-service', () => ({
  emailService: mockEmailService
}));

// Mock soft delete service
const mockSoftDeleteService = {
  permanentlyDeleteExpired: vi.fn()
};

vi.mock('../../../server/services/soft-delete-service', () => ({
  softDeleteService: mockSoftDeleteService
}));

// Mock priority escalation service
const mockEscalateAllProjects = vi.fn();

vi.mock('../../../server/services/priority-escalation-service', () => ({
  escalateAllProjects: mockEscalateAllProjects
}));

describe('Scheduler Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));

    // Reset all mocks
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockCronSchedule.mockClear();
    mockCronStop.mockClear();
    mockInvoiceService.processScheduledInvoices.mockReset();
    mockInvoiceService.processRecurringInvoices.mockReset();
    mockInvoiceService.processReminders.mockReset();
    mockInvoiceService.checkAndMarkOverdue.mockReset();
    mockInvoiceService.getInvoiceById.mockReset();
    mockEmailService.sendEmail.mockReset();
    mockSoftDeleteService.permanentlyDeleteExpired.mockReset();
    mockEscalateAllProjects.mockReset();

    // Default mock implementations
    mockInvoiceService.processScheduledInvoices.mockResolvedValue(0);
    mockInvoiceService.processRecurringInvoices.mockResolvedValue(0);
    mockInvoiceService.processReminders.mockResolvedValue([]);
    mockInvoiceService.checkAndMarkOverdue.mockResolvedValue(0);
    mockSoftDeleteService.permanentlyDeleteExpired.mockResolvedValue({
      deleted: { total: 0, clients: 0, projects: 0, invoices: 0, leads: 0, proposals: 0 },
      errors: []
    });
    mockEscalateAllProjects.mockResolvedValue({ updatedCount: 0, escalatedTasks: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  describe('getInstance', () => {
    it('returns singleton instance', async () => {
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const instance1 = SchedulerService.getInstance();
      const instance2 = SchedulerService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('start', () => {
    it('schedules all enabled jobs', async () => {
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      scheduler.start();

      // Should schedule multiple cron jobs
      expect(mockCronSchedule).toHaveBeenCalled();

      scheduler.stop();
    });

    it('does not start if already running', async () => {
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      scheduler.start();
      const initialCallCount = mockCronSchedule.mock.calls.length;

      scheduler.start(); // Call again

      expect(mockCronSchedule.mock.calls.length).toBe(initialCallCount);

      scheduler.stop();
    });
  });

  describe('stop', () => {
    it('stops all running jobs', async () => {
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      scheduler.start();
      scheduler.stop();

      expect(mockCronStop).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns scheduler status', async () => {
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      scheduler.start();

      const status = scheduler.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.config).toBeDefined();
      expect(status.jobs.reminders).toBe(true);

      scheduler.stop();
    });
  });

  describe('checkOverdueInvoices', () => {
    it('calls invoice service to mark overdue', async () => {
      mockInvoiceService.checkAndMarkOverdue.mockResolvedValue(5);
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.checkOverdueInvoices();

      expect(count).toBe(5);
      expect(mockInvoiceService.checkAndMarkOverdue).toHaveBeenCalled();
    });
  });

  describe('processReminders', () => {
    it('processes invoice reminders and sends emails', async () => {
      mockInvoiceService.processReminders.mockResolvedValue([
        { id: 1, invoiceId: 10, reminderType: 'upcoming' }
      ]);
      mockInvoiceService.getInvoiceById.mockResolvedValue({
        id: 10,
        invoiceNumber: 'INV-010',
        clientId: 5,
        amountTotal: 1000,
        amountPaid: 0,
        dueDate: '2026-02-15'
      });
      mockDb.get.mockResolvedValue({
        email: 'client@test.com',
        contact_name: 'Test Client'
      });
      mockDb.all.mockResolvedValue([]); // No contract reminders
      mockEmailService.sendEmail.mockResolvedValue(true);
      mockInvoiceService.markReminderSent.mockResolvedValue(undefined);

      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.processReminders();

      expect(count).toBeGreaterThan(0);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@test.com'
        })
      );
    });

    it('skips reminders when client has no email', async () => {
      mockInvoiceService.processReminders.mockResolvedValue([
        { id: 1, invoiceId: 10, reminderType: 'upcoming' }
      ]);
      mockInvoiceService.getInvoiceById.mockResolvedValue({
        id: 10,
        invoiceNumber: 'INV-010',
        clientId: 5,
        amountTotal: 1000
      });
      mockDb.get.mockResolvedValue(null); // No client found
      mockDb.all.mockResolvedValue([]);
      mockInvoiceService.skipReminder.mockResolvedValue(undefined);

      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      await scheduler.processReminders();

      expect(mockInvoiceService.skipReminder).toHaveBeenCalledWith(1);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('processScheduledInvoices', () => {
    it('calls invoice service to process scheduled invoices', async () => {
      mockInvoiceService.processScheduledInvoices.mockResolvedValue(3);
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.processScheduledInvoices();

      expect(count).toBe(3);
      expect(mockInvoiceService.processScheduledInvoices).toHaveBeenCalled();
    });
  });

  describe('processRecurringInvoices', () => {
    it('calls invoice service to process recurring invoices', async () => {
      mockInvoiceService.processRecurringInvoices.mockResolvedValue(2);
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.processRecurringInvoices();

      expect(count).toBe(2);
      expect(mockInvoiceService.processRecurringInvoices).toHaveBeenCalled();
    });
  });

  describe('cleanupAnalyticsData', () => {
    it('deletes old page views and interaction events', async () => {
      mockDb.run.mockResolvedValue({ changes: 100 });
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const result = await scheduler.cleanupAnalyticsData();

      expect(result.pageViews).toBe(100);
      expect(result.interactionEvents).toBe(100);
      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });
  });

  describe('processPriorityEscalation', () => {
    it('calls escalation service', async () => {
      mockEscalateAllProjects.mockResolvedValue({
        updatedCount: 5,
        escalatedTasks: [
          { taskId: 1, projectId: 1, oldPriority: 'low', newPriority: 'medium', daysUntilDue: 2 }
        ]
      });
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const result = await scheduler.processPriorityEscalation();

      expect(result.updatedCount).toBe(5);
      expect(result.escalatedTasks).toHaveLength(1);
    });
  });

  describe('scheduleContractReminders', () => {
    it('schedules reminders at 0, 3, 7, and 14 days', async () => {
      mockDb.run.mockResolvedValue({});
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      await scheduler.scheduleContractReminders(1);

      // Should delete existing pending reminders
      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM contract_reminders WHERE project_id = ? AND status = ?',
        [1, 'pending']
      );

      // Should insert 4 reminders
      const insertCalls = mockDb.run.mock.calls.filter(
        call => call[0].includes('INSERT INTO contract_reminders')
      );
      expect(insertCalls).toHaveLength(4);
    });
  });

  describe('cancelContractReminders', () => {
    it('marks pending reminders as skipped', async () => {
      mockDb.run.mockResolvedValue({});
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      await scheduler.cancelContractReminders(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE contract_reminders SET status = ?'),
        ['skipped', 1, 'pending']
      );
    });
  });

  describe('startWelcomeSequence', () => {
    it('creates welcome sequence emails for new client', async () => {
      mockDb.get.mockResolvedValue({ welcome_sequence_started_at: null });
      mockDb.all.mockResolvedValue([
        { email_type: 'welcome', days_after_signup: 0 },
        { email_type: 'getting_started', days_after_signup: 1 },
        { email_type: 'tips', days_after_signup: 3 },
        { email_type: 'check_in', days_after_signup: 7 }
      ]);
      mockDb.run.mockResolvedValue({});

      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      await scheduler.startWelcomeSequence(1);

      // Should insert emails for each template
      const insertCalls = mockDb.run.mock.calls.filter(
        call => call[0].includes('INSERT INTO welcome_sequence_emails')
      );
      expect(insertCalls).toHaveLength(4);

      // Should mark sequence as started
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE clients SET welcome_sequence_started_at'),
        expect.any(Array)
      );
    });

    it('does not restart if sequence already started', async () => {
      mockDb.get.mockResolvedValue({
        welcome_sequence_started_at: '2026-01-01T00:00:00Z'
      });

      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      await scheduler.startWelcomeSequence(1);

      // Should only call get, not insert any emails
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('cancelWelcomeSequence', () => {
    it('marks pending welcome emails as skipped', async () => {
      mockDb.run.mockResolvedValue({});
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      await scheduler.cancelWelcomeSequence(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE welcome_sequence_emails SET status = ?'),
        ['skipped', 1, 'pending']
      );
    });
  });

  describe('processContractReminders', () => {
    it('sends contract reminder emails', async () => {
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          project_id: 10,
          project_name: 'Test Project',
          contract_signature_token: 'token123',
          email: 'client@test.com',
          contact_name: 'Test Client',
          reminder_type: 'initial'
        }
      ]);
      mockDb.run.mockResolvedValue({});
      mockEmailService.sendEmail.mockResolvedValue(true);

      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.processContractReminders();

      expect(count).toBe(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'client@test.com',
          subject: expect.stringContaining('Contract Ready for Signature')
        })
      );
    });
  });

  describe('processApprovalReminders', () => {
    it('sends approval reminder emails at configured intervals', async () => {
      mockDb.all.mockResolvedValue([
        {
          request_id: 1,
          approver_email: 'approver@test.com',
          reminder_count: 0,
          reminder_sent_at: null,
          request_created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          instance_id: 1,
          entity_type: 'invoice',
          entity_id: 5,
          workflow_name: 'Invoice Approval'
        }
      ]);
      mockDb.run.mockResolvedValue({});
      mockEmailService.sendEmail.mockResolvedValue(true);

      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.processApprovalReminders();

      expect(count).toBe(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('triggerInvoiceGeneration', () => {
    it('manually triggers invoice generation', async () => {
      mockInvoiceService.processScheduledInvoices.mockResolvedValue(2);
      mockInvoiceService.processRecurringInvoices.mockResolvedValue(3);
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const result = await scheduler.triggerInvoiceGeneration();

      expect(result).toEqual({ scheduled: 2, recurring: 3 });
    });
  });

  describe('triggerPriorityEscalation', () => {
    it('manually triggers priority escalation', async () => {
      mockEscalateAllProjects.mockResolvedValue({ updatedCount: 2, escalatedTasks: [] });
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const result = await scheduler.triggerPriorityEscalation();

      expect(result.updatedCount).toBe(2);
    });
  });

  describe('triggerReminderProcessing', () => {
    it('manually triggers reminder processing', async () => {
      mockInvoiceService.processReminders.mockResolvedValue([]);
      mockDb.all.mockResolvedValue([]);
      vi.resetModules();
      const { SchedulerService } = await import('../../../server/services/scheduler-service');

      const scheduler = SchedulerService.getInstance();
      const count = await scheduler.triggerReminderProcessing();

      expect(count).toBe(0);
    });
  });
});
