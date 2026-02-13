/**
 * ===============================================
 * WORKFLOW TRIGGER SERVICE TESTS
 * ===============================================
 * @file tests/unit/services/workflow-trigger-service.test.ts
 *
 * Unit tests for workflow trigger/automation service.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn(),
  get: vi.fn(),
  all: vi.fn()
}));

vi.mock('../../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

// Mock email service
vi.mock('../../../server/services/email-service', () => ({
  emailService: {
    sendEmail: vi.fn()
  }
}));

// Mock user service
vi.mock('../../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1)
  }
}));

// Mock fetch globally for webhook tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Workflow Trigger Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T12:00:00Z'));
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('emit', () => {
    it('logs the event to system_events table', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([]); // No triggers

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        invoiceNumber: 'INV-001',
        triggeredBy: 'admin@test.com'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_events'),
        expect.arrayContaining(['invoice.created', 'invoice', 1])
      );
    });

    it('executes matching triggers', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          name: 'Test Trigger',
          event_type: 'invoice.created',
          conditions: null,
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'test', message: 'Invoice created' }),
          is_active: true,
          priority: 0
        }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        triggeredBy: 'admin@test.com'
      });

      // Should log trigger execution
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflow_trigger_logs'),
        expect.any(Array)
      );
    });

    it('skips triggers when conditions do not match', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          name: 'Condition Trigger',
          event_type: 'invoice.created',
          conditions: JSON.stringify({ status: 'paid' }),
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'test', message: 'Test' }),
          is_active: true,
          priority: 0
        }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        status: 'draft' // Does not match 'paid'
      });

      // Should log as skipped
      const logCalls = mockDb.run.mock.calls.filter(
        call => call[0].includes('workflow_trigger_logs')
      );
      expect(logCalls.length).toBeGreaterThan(0);
      expect(logCalls[logCalls.length - 1][1]).toContain('skipped');
    });

    it('calls registered listeners', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const listener = vi.fn();
      workflowTriggerService.on('invoice.created', listener);

      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        triggeredBy: 'admin@test.com'
      });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: 1 })
      );

      // Cleanup
      workflowTriggerService.off('invoice.created', listener);
    });
  });

  describe('on/off', () => {
    it('registers and removes listeners', async () => {
      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const listener = vi.fn();
      workflowTriggerService.on('project.created', listener);

      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([]);

      await workflowTriggerService.emit('project.created', { entityId: 1 });
      expect(listener).toHaveBeenCalledTimes(1);

      workflowTriggerService.off('project.created', listener);

      await workflowTriggerService.emit('project.created', { entityId: 2 });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });
  });

  describe('getTriggers', () => {
    it('returns all triggers when no event type specified', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, name: 'Trigger 1', event_type: 'invoice.created' },
        { id: 2, name: 'Trigger 2', event_type: 'project.created' }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const triggers = await workflowTriggerService.getTriggers();
      expect(triggers).toHaveLength(2);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM workflow_triggers ORDER BY')
      );
    });

    it('filters triggers by event type', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, name: 'Trigger 1', event_type: 'invoice.created' }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const triggers = await workflowTriggerService.getTriggers('invoice.created');
      expect(triggers).toHaveLength(1);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE event_type = ?'),
        ['invoice.created']
      );
    });
  });

  describe('createTrigger', () => {
    it('creates a new trigger with default values', async () => {
      mockDb.run.mockResolvedValue({ lastID: 1 });
      mockDb.get.mockResolvedValue({
        id: 1,
        name: 'New Trigger',
        event_type: 'invoice.paid',
        action_type: 'notify',
        action_config: { channel: 'sales', message: 'Invoice paid!' },
        is_active: true,
        priority: 0
      });

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const trigger = await workflowTriggerService.createTrigger({
        name: 'New Trigger',
        event_type: 'invoice.paid',
        action_type: 'notify',
        action_config: { channel: 'sales', message: 'Invoice paid!' }
      });

      expect(trigger.name).toBe('New Trigger');
      expect(trigger.is_active).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflow_triggers'),
        expect.arrayContaining(['New Trigger', 'invoice.paid', 'notify'])
      );
    });

    it('creates a trigger with conditions', async () => {
      mockDb.run.mockResolvedValue({ lastID: 1 });
      mockDb.get.mockResolvedValue({
        id: 1,
        name: 'Conditional Trigger',
        conditions: { status: 'overdue' }
      });

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.createTrigger({
        name: 'Conditional Trigger',
        event_type: 'invoice.created',
        action_type: 'send_email',
        action_config: { template: 'overdue_notice' },
        conditions: { status: 'overdue' }
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO workflow_triggers'),
        expect.arrayContaining([JSON.stringify({ status: 'overdue' })])
      );
    });
  });

  describe('updateTrigger', () => {
    it('updates trigger fields', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.get.mockResolvedValue({
        id: 1,
        name: 'Updated Trigger',
        is_active: false,
        priority: 10
      });

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const trigger = await workflowTriggerService.updateTrigger(1, {
        name: 'Updated Trigger',
        is_active: false,
        priority: 10
      });

      expect(trigger?.name).toBe('Updated Trigger');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE workflow_triggers SET'),
        expect.arrayContaining(['Updated Trigger', false, 10, 1])
      );
    });

    it('returns trigger without update if no fields provided', async () => {
      mockDb.get.mockResolvedValue({ id: 1, name: 'Original' });

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const trigger = await workflowTriggerService.updateTrigger(1, {});

      expect(trigger?.name).toBe('Original');
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });

  describe('deleteTrigger', () => {
    it('deletes trigger by id', async () => {
      mockDb.run.mockResolvedValue({});

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.deleteTrigger(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        'DELETE FROM workflow_triggers WHERE id = ?',
        [1]
      );
    });
  });

  describe('toggleTrigger', () => {
    it('toggles trigger active state', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.get.mockResolvedValue({ id: 1, is_active: false });

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.toggleTrigger(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('SET is_active = NOT is_active'),
        [1]
      );
    });
  });

  describe('getEventTypes', () => {
    it('returns list of all event types', async () => {
      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const eventTypes = workflowTriggerService.getEventTypes();

      expect(eventTypes).toContain('invoice.created');
      expect(eventTypes).toContain('invoice.paid');
      expect(eventTypes).toContain('project.created');
      expect(eventTypes).toContain('contract.signed');
      expect(eventTypes).toContain('deliverable.approved');
      expect(eventTypes.length).toBeGreaterThan(20);
    });
  });

  describe('getActionTypes', () => {
    it('returns available action types with descriptions', async () => {
      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const actionTypes = workflowTriggerService.getActionTypes();

      expect(actionTypes).toContainEqual(
        expect.objectContaining({ type: 'send_email' })
      );
      expect(actionTypes).toContainEqual(
        expect.objectContaining({ type: 'webhook' })
      );
      expect(actionTypes).toContainEqual(
        expect.objectContaining({ type: 'notify' })
      );
    });
  });

  describe('getTriggerLogs', () => {
    it('returns logs for specific trigger', async () => {
      mockDb.all.mockResolvedValue([
        { id: 1, trigger_id: 5, event_type: 'invoice.paid', action_result: 'success' }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      const logs = await workflowTriggerService.getTriggerLogs(5, 50);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE l.trigger_id = ?'),
        [5, 50]
      );
    });

    it('returns all logs when no trigger id specified', async () => {
      mockDb.all.mockResolvedValue([]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.getTriggerLogs(undefined, 100);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY l.created_at DESC'),
        [100]
      );
    });
  });

  describe('getSystemEvents', () => {
    it('filters by event type', async () => {
      mockDb.all.mockResolvedValue([]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.getSystemEvents('invoice.paid', 50);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE event_type = ?'),
        ['invoice.paid', 50]
      );
    });

    it('returns all events when no type specified', async () => {
      mockDb.all.mockResolvedValue([]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.getSystemEvents(undefined, 100);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM system_events ORDER BY created_at DESC LIMIT ?'),
        [100]
      );
    });
  });

  describe('condition evaluation', () => {
    it('evaluates equality conditions', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          name: 'Status Check',
          event_type: 'invoice.created',
          conditions: JSON.stringify({ status: 'sent' }),
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'test', message: 'Test' }),
          is_active: true,
          priority: 0
        }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      // Should execute - status matches
      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        status: 'sent'
      });

      const successLogCalls = mockDb.run.mock.calls.filter(
        call => call[0].includes('workflow_trigger_logs') && call[1]?.includes('success')
      );
      expect(successLogCalls.length).toBeGreaterThan(0);
    });

    it('evaluates greater than conditions', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          name: 'Amount Check',
          event_type: 'invoice.created',
          conditions: JSON.stringify({ amount_gt: 1000 }),
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'test', message: 'Large invoice!' }),
          is_active: true,
          priority: 0
        }
      ]);

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      // Should execute - amount > 1000
      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        amount: 2000
      });

      const successLogCalls = mockDb.run.mock.calls.filter(
        call => call[0].includes('workflow_trigger_logs') && call[1]?.includes('success')
      );
      expect(successLogCalls.length).toBeGreaterThan(0);
    });
  });

  describe('webhook action', () => {
    it('calls external webhook with event data', async () => {
      mockDb.run.mockResolvedValue({});
      mockDb.all.mockResolvedValue([
        {
          id: 1,
          name: 'Webhook Trigger',
          event_type: 'invoice.paid',
          conditions: null,
          action_type: 'webhook',
          action_config: JSON.stringify({
            url: 'https://example.com/webhook',
            method: 'POST',
            headers: { 'X-Custom': 'header' }
          }),
          is_active: true,
          priority: 0
        }
      ]);

      mockFetch.mockResolvedValue({ status: 200 });

      const { workflowTriggerService } = await import('../../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.paid', {
        entityId: 1,
        amount: 500
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'header'
          })
        })
      );
    });
  });
});
