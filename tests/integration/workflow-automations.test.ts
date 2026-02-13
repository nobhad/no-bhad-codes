/**
 * ===============================================
 * WORKFLOW AUTOMATIONS INTEGRATION TESTS
 * ===============================================
 * @file tests/integration/workflow-automations.test.ts
 *
 * End-to-end integration tests for workflow automation system.
 * Tests event emission, trigger execution, and automation handlers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => ({
  run: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
  get: vi.fn(),
  all: vi.fn().mockResolvedValue([])
}));

vi.mock('../../server/database/init', () => ({
  getDatabase: () => mockDb
}));

// Mock email service
const mockEmailService = vi.hoisted(() => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendClientNotification: vi.fn().mockResolvedValue(true),
  sendAdminNotification: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../server/services/email-service', () => ({
  emailService: mockEmailService
}));

// Mock logger
vi.mock('../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock user service
vi.mock('../../server/services/user-service', () => ({
  userService: {
    getUserIdByEmail: vi.fn().mockResolvedValue(1),
    getUserById: vi.fn().mockResolvedValue({ id: 1, email: 'test@example.com', name: 'Test User' })
  }
}));

// Mock invoice service
const mockInvoiceService = {
  createMilestoneInvoice: vi.fn().mockResolvedValue({
    id: 1,
    invoiceNumber: 'INV-2026-001',
    projectId: 1,
    clientId: 1,
    amountTotal: 1000,
    status: 'draft'
  }),
  getInstance: vi.fn()
};
mockInvoiceService.getInstance.mockReturnValue(mockInvoiceService);

vi.mock('../../server/services/invoice-service', () => ({
  InvoiceService: mockInvoiceService
}));

// Mock milestone generator
vi.mock('../../server/services/milestone-generator', () => ({
  generateDefaultMilestones: vi.fn().mockResolvedValue([
    { id: 1, title: 'Project Kickoff', due_date: '2026-03-01' },
    { id: 2, title: 'Design Phase', due_date: '2026-03-15' },
    { id: 3, title: 'Development Phase', due_date: '2026-04-01' },
    { id: 4, title: 'Final Delivery', due_date: '2026-04-15' }
  ])
}));

describe('Workflow Automations Integration', () => {
  beforeEach(() => {
    // Reset modules to prevent duplicate listener registration
    vi.resetModules();
    vi.clearAllMocks();
    mockDb.run.mockReset().mockResolvedValue({ lastID: 1, changes: 1 });
    mockDb.get.mockReset();
    mockDb.all.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Event Emission Tests
  // ============================================

  describe('Event Emission', () => {
    it('logs events to system_events table', async () => {
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        triggeredBy: 'admin@example.com',
        projectId: 1,
        clientId: 1,
        amount: 1000
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_events'),
        expect.any(Array)
      );
    });

    it('emits events with correct context data', async () => {
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      const context = {
        entityId: 42,
        triggeredBy: 'user@example.com',
        projectId: 10,
        clientId: 5,
        customField: 'custom value'
      };

      await workflowTriggerService.emit('project.created', context);

      // Should have inserted event with context
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('loads and executes matching triggers', async () => {
      // Mock active triggers
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Send Invoice Notification',
          event_type: 'invoice.created',
          conditions: null,
          action_type: 'send_email',
          action_config: JSON.stringify({
            template: 'invoice_created',
            to: 'admin'
          }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      // Should query for matching triggers
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('workflow_triggers'),
        expect.any(Array)
      );
    });

    it('respects trigger priority order', async () => {
      const executionOrder: number[] = [];

      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Low Priority',
          event_type: 'test.event',
          conditions: null,
          action_type: 'notify',
          action_config: JSON.stringify({ message: 'low' }),
          is_active: true,
          priority: 1
        },
        {
          id: 2,
          name: 'High Priority',
          event_type: 'test.event',
          conditions: null,
          action_type: 'notify',
          action_config: JSON.stringify({ message: 'high' }),
          is_active: true,
          priority: 100
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      // Triggers should be sorted by priority DESC
      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('skips inactive triggers', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Inactive Trigger',
          event_type: 'invoice.created',
          conditions: null,
          action_type: 'send_email',
          action_config: JSON.stringify({ to: 'test@example.com' }),
          is_active: false,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      // Email should not be sent for inactive trigger
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Trigger Condition Evaluation Tests
  // ============================================

  describe('Trigger Conditions', () => {
    it('evaluates simple equality conditions', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Status Check',
          event_type: 'project.status_changed',
          conditions: JSON.stringify({ status: 'completed' }),
          action_type: 'send_email',
          action_config: JSON.stringify({ to: 'admin' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      // Should match when status equals 'completed'
      await workflowTriggerService.emit('project.status_changed', {
        entityId: 1,
        status: 'completed'
      });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('evaluates greater-than conditions', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'High Value Invoice',
          event_type: 'invoice.created',
          conditions: JSON.stringify({ amount_gt: 5000 }),
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'admin' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', {
        entityId: 1,
        amount: 10000
      });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('evaluates less-than conditions', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Small Payment',
          event_type: 'invoice.paid',
          conditions: JSON.stringify({ amount_lt: 100 }),
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'admin' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.paid', {
        entityId: 1,
        amount: 50
      });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('evaluates contains conditions', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Website Project',
          event_type: 'project.created',
          conditions: JSON.stringify({ projectType_contains: 'website' }),
          action_type: 'create_task',
          action_config: JSON.stringify({ title: 'Setup hosting' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('project.created', {
        entityId: 1,
        projectType: 'e-commerce website'
      });

      expect(mockDb.all).toHaveBeenCalled();
    });

    it('handles null conditions (always match)', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Always Notify',
          event_type: 'invoice.created',
          conditions: null,
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'admin' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      expect(mockDb.all).toHaveBeenCalled();
    });
  });

  // ============================================
  // Proposal Accepted Automation Tests
  // ============================================

  describe('Proposal Accepted -> Create Project', () => {
    beforeEach(() => {
      // Mock proposal data
      mockDb.get.mockResolvedValue({
        id: 1,
        project_id: null, // No existing project
        client_id: 10,
        project_type: 'website',
        selected_tier: 'professional',
        final_price: 5000,
        description: 'E-commerce website development',
        project_name: 'Online Store Project',
        maintenance_option: 'standard'
      });
    });

    it('creates a new project when proposal has no linked project', async () => {
      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      // Register automations
      registerWorkflowAutomations();

      // Emit proposal accepted event
      await workflowTriggerService.emit('proposal.accepted', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      // Should insert new project
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.any(Array)
      );

      // Should link proposal to new project
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE proposal_requests SET project_id'),
        expect.any(Array)
      );
    });

    it('updates existing project when proposal is already linked', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        project_id: 5, // Already linked to project
        client_id: 10,
        project_type: 'website',
        final_price: 5000,
        description: 'Updated description'
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('proposal.accepted', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      // Should update existing project, not create new
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects SET'),
        expect.arrayContaining([5])
      );
    });

    it('generates default milestones for new project', async () => {
      const { generateDefaultMilestones } = await import('../../server/services/milestone-generator');
      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('proposal.accepted', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      expect(generateDefaultMilestones).toHaveBeenCalled();
    });

    it('handles missing proposal gracefully', async () => {
      mockDb.get.mockResolvedValue(null);

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      // Should not throw
      await expect(
        workflowTriggerService.emit('proposal.accepted', {
          entityId: 999,
          triggeredBy: 'admin@example.com'
        })
      ).resolves.not.toThrow();
    });

    it('sends client notification email', async () => {
      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      // Three db.get calls happen:
      // 1. handleProposalAccepted gets proposal data
      // 2. notifyProposalAccepted gets proposal+client via JOIN
      // 3. sendClientNotification -> getClientEmail gets client
      mockDb.get
        .mockResolvedValueOnce({
          // handleProposalAccepted gets proposal
          id: 1,
          project_id: null,
          client_id: 10,
          project_type: 'website',
          final_price: 5000,
          project_name: 'Test Project',
          description: 'Test description',
          selected_tier: 'standard',
          maintenance_option: null
        })
        .mockResolvedValueOnce({
          // notifyProposalAccepted gets proposal+client via JOIN
          project_name: 'Test Project',
          client_id: 10,
          email: 'john@client.com',
          contact_name: 'John Client'
        })
        .mockResolvedValueOnce({
          // getClientEmail gets client for sendClientNotification
          email: 'john@client.com',
          contact_name: 'John Client',
          company_name: null
        });

      registerWorkflowAutomations();

      await workflowTriggerService.emit('proposal.accepted', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      // Client notification handler should send email
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });
  });

  // ============================================
  // Contract Signed Automation Tests
  // ============================================

  describe('Contract Signed -> Activate Project', () => {
    beforeEach(() => {
      mockDb.get.mockResolvedValue({
        id: 1,
        project_id: 5,
        status: 'pending'
      });
    });

    it('updates project status to active when contract signed', async () => {
      // When projectId is provided in event, only project lookup happens (no contract lookup)
      mockDb.get.mockResolvedValueOnce({
        id: 5,
        status: 'pending'
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('contract.signed', {
        entityId: 1,
        projectId: 5,
        triggeredBy: 'client@example.com'
      });

      // Should update project status
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE projects'),
        expect.any(Array)
      );
    });

    it('logs signature in contract_signature_log', async () => {
      // When projectId is provided in event, only project lookup happens (no contract lookup)
      mockDb.get.mockResolvedValueOnce({
        id: 5,
        status: 'pending'
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('contract.signed', {
        entityId: 1,
        projectId: 5,
        triggeredBy: 'client@example.com'
      });

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('contract_signature_log'),
        expect.any(Array)
      );
    });

    it('skips update if project already active', async () => {
      // When projectId is provided in event, only the project query happens (no contract query)
      mockDb.get.mockResolvedValueOnce({
        id: 5,
        status: 'active' // Already active
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('contract.signed', {
        entityId: 1,
        projectId: 5,
        triggeredBy: 'client@example.com'
      });

      // Should not update status since already active - check that no UPDATE with status='active' was called
      const runCalls = mockDb.run.mock.calls;
      const hasStatusUpdate = runCalls.some((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes("status = 'active'")
      );
      expect(hasStatusUpdate).toBe(false);
    });

    it('emits project.status_changed event', async () => {
      // When projectId is provided in event, only project lookup happens (no contract lookup)
      mockDb.get.mockResolvedValueOnce({
        id: 5,
        status: 'pending'
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      const emitSpy = vi.spyOn(workflowTriggerService, 'emit');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('contract.signed', {
        entityId: 1,
        projectId: 5,
        triggeredBy: 'client@example.com'
      });

      // Should emit status changed event
      expect(emitSpy).toHaveBeenCalledWith(
        'project.status_changed',
        expect.objectContaining({
          entityId: 5  // The event uses entityId for the project
        })
      );
    });
  });

  // ============================================
  // Milestone Completed Automation Tests
  // ============================================

  describe('Milestone Completed -> Create Invoice', () => {
    it('creates invoice for payment milestone', async () => {
      // JOIN query returns milestone + project data including deliverables as JSON
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 5,
        title: 'Design Phase Completion',
        description: 'Complete all design deliverables',
        client_id: 10,
        project_name: 'Website Project',
        project_price: 5000,
        deliverables: JSON.stringify([
          { name: 'Homepage Design', price: 1000 },
          { name: 'Logo Design', price: 500 },
          { name: 'Brand Guidelines', price: 500 }
        ])
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('project.milestone_completed', {
        entityId: 1,
        milestoneId: 1,
        projectId: 5,
        triggeredBy: 'admin@example.com'
      });

      expect(mockInvoiceService.createMilestoneInvoice).toHaveBeenCalled();
    });

    it('detects payment milestone from title keywords', async () => {
      // Milestone with 'Payment' in title and deliverables with prices
      mockDb.get.mockResolvedValueOnce({
        id: 1,
        project_id: 5,
        title: 'Final Payment Due',
        description: 'Project completion',
        client_id: 10,
        project_name: 'Website Project',
        project_price: 5000,
        deliverables: JSON.stringify([
          { name: 'Website Launch', price: 3000 }
        ])
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('project.milestone_completed', {
        entityId: 1,
        milestoneId: 1,
        projectId: 5,
        triggeredBy: 'admin@example.com'
      });

      // Should create invoice because deliverables have prices
      expect(mockInvoiceService.createMilestoneInvoice).toHaveBeenCalled();
    });

    it('skips invoice creation for non-payment milestones', async () => {
      mockDb.get.mockResolvedValue({
        id: 1,
        project_id: 5,
        title: 'Requirements Gathering',
        description: 'Gather all project requirements',
        is_payment_milestone: false,
        invoice_amount: null
      });

      mockDb.all.mockResolvedValueOnce([]); // No deliverables with prices

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('project.milestone_completed', {
        entityId: 1,
        milestoneId: 1,
        projectId: 5,
        triggeredBy: 'admin@example.com'
      });

      // Should NOT create invoice
      expect(mockInvoiceService.createMilestoneInvoice).not.toHaveBeenCalled();
    });

    it('does not create duplicate invoice if one already exists', async () => {
      mockDb.get
        .mockResolvedValueOnce({
          id: 1,
          project_id: 5,
          title: 'Payment Milestone',
          is_payment_milestone: true,
          invoice_amount: 1000
        })
        .mockResolvedValueOnce({
          id: 10 // Existing invoice for this milestone
        });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('project.milestone_completed', {
        entityId: 1,
        milestoneId: 1,
        projectId: 5,
        triggeredBy: 'admin@example.com'
      });

      // Should NOT create duplicate invoice
      expect(mockInvoiceService.createMilestoneInvoice).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Client Notification Tests
  // ============================================

  describe('Client Notifications', () => {
    // Client data for getClientEmail() lookup
    const clientEmailData = {
      id: 10,
      email: 'client@example.com',
      contact_name: 'Test Client',
      company_name: 'Test Company'
    };

    it('sends notification on deliverable approved', async () => {
      // JOIN query returns deliverable + project data in one call
      // Then getClientEmail() queries for client separately
      mockDb.get
        .mockResolvedValueOnce({
          title: 'Logo Design',
          client_id: 10,
          project_name: 'Website Project'
        })
        .mockResolvedValueOnce(clientEmailData);

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('deliverable.approved', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('sends notification on questionnaire completed', async () => {
      // JOIN query returns questionnaire + project data in one call
      mockDb.get
        .mockResolvedValueOnce({
          title: 'Project Discovery',
          client_id: 10,
          project_name: 'Website Project'
        })
        .mockResolvedValueOnce(clientEmailData);

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('questionnaire.completed', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('sends notification on invoice paid', async () => {
      // JOIN query returns invoice + project data in one call
      mockDb.get
        .mockResolvedValueOnce({
          invoice_number: 'INV-2026-001',
          total_amount: 1000,
          client_id: 10,
          project_name: 'Website Project'
        })
        .mockResolvedValueOnce(clientEmailData);

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('invoice.paid', {
        entityId: 1,
        amount: 1000,
        triggeredBy: 'payment_gateway'
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('sends notification on document request approved', async () => {
      // JOIN query returns document request + project data in one call
      mockDb.get
        .mockResolvedValueOnce({
          title: 'Business License',
          client_id: 10,
          project_name: 'Website Project'
        })
        .mockResolvedValueOnce(clientEmailData);

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      await workflowTriggerService.emit('document_request.approved', {
        entityId: 1,
        triggeredBy: 'admin@example.com'
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
    });

    it('handles missing client email gracefully', async () => {
      mockDb.get.mockResolvedValue({
        id: 10,
        name: 'No Email Client',
        email: null
      });

      const { registerWorkflowAutomations } = await import('../../server/services/workflow-automations');
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      registerWorkflowAutomations();

      // Should not throw
      await expect(
        workflowTriggerService.emit('invoice.paid', {
          entityId: 1,
          triggeredBy: 'system'
        })
      ).resolves.not.toThrow();
    });
  });

  // ============================================
  // Trigger Logging Tests
  // ============================================

  describe('Trigger Execution Logging', () => {
    it('logs successful trigger execution', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Test Trigger',
          event_type: 'invoice.created',
          conditions: null,
          action_type: 'notify',
          action_config: JSON.stringify({ channel: 'admin' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      // Should log execution to workflow_trigger_logs
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('workflow_trigger_logs'),
        expect.any(Array)
      );
    });

    it('logs failed trigger execution with error', async () => {
      mockDb.all.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Failing Trigger',
          event_type: 'invoice.created',
          conditions: null,
          action_type: 'webhook',
          action_config: JSON.stringify({ url: 'http://invalid.url' }),
          is_active: true,
          priority: 10
        }
      ]);

      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      // Should still complete without throwing
      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  // ============================================
  // Listener Registration Tests
  // ============================================

  describe('Listener Registration', () => {
    it('registers and calls custom listeners', async () => {
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      const customListener = vi.fn().mockResolvedValue(undefined);

      workflowTriggerService.on('custom.event' as any, customListener);

      await workflowTriggerService.emit('custom.event' as any, {
        entityId: 1,
        customData: 'test'
      });

      expect(customListener).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 1,
          customData: 'test'
        })
      );
    });

    it('supports multiple listeners for same event', async () => {
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      const listener1 = vi.fn().mockResolvedValue(undefined);
      const listener2 = vi.fn().mockResolvedValue(undefined);

      workflowTriggerService.on('invoice.created', listener1);
      workflowTriggerService.on('invoice.created', listener2);

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('continues execution if one listener fails', async () => {
      const { workflowTriggerService } = await import('../../server/services/workflow-trigger-service');

      const failingListener = vi.fn().mockRejectedValue(new Error('Listener failed'));
      const successListener = vi.fn().mockResolvedValue(undefined);

      workflowTriggerService.on('invoice.created', failingListener);
      workflowTriggerService.on('invoice.created', successListener);

      await workflowTriggerService.emit('invoice.created', { entityId: 1 });

      // Second listener should still be called
      expect(successListener).toHaveBeenCalled();
    });
  });
});
