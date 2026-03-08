/**
 * ===============================================
 * UNIT TESTS - APPROVAL SERVICE
 * ===============================================
 * @file tests/unit/services/approval-service.test.ts
 *
 * Tests for the approval workflow service including:
 * - Workflow definition management (CRUD)
 * - Workflow step management
 * - Workflow instance lifecycle (start, approve, reject, cancel)
 * - Sequential, parallel, and any_one workflow advancement
 * - History and approval request retrieval
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
const mockDb = {
  get: vi.fn(),
  all: vi.fn(),
  run: vi.fn(),
  transaction: vi.fn()
};

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn(() => mockDb)
}));

vi.mock('../../../server/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Import after mocks
import { approvalService } from '../../../server/services/approval-service';

// ============================================
// FIXTURES
// ============================================

const mockDefinition = {
  id: 1,
  name: 'Proposal Approval',
  description: 'Standard proposal approval',
  entity_type: 'proposal',
  workflow_type: 'sequential',
  is_active: true,
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

const mockStep1 = {
  id: 10,
  workflow_definition_id: 1,
  step_order: 1,
  approver_type: 'user',
  approver_value: 'manager@example.com',
  is_optional: false,
  auto_approve_after_hours: null,
  created_at: '2026-01-01T00:00:00Z'
};

const mockStep2 = {
  id: 11,
  workflow_definition_id: 1,
  step_order: 2,
  approver_type: 'user',
  approver_value: 'director@example.com',
  is_optional: false,
  auto_approve_after_hours: null,
  created_at: '2026-01-01T00:00:00Z'
};

const mockInstance = {
  id: 100,
  workflow_definition_id: 1,
  entity_type: 'proposal',
  entity_id: 50,
  status: 'in_progress',
  current_step: 1,
  initiated_by: 'user@example.com',
  initiated_at: '2026-01-01T00:00:00Z',
  completed_at: null,
  notes: null
};

const mockApprovalRequest = {
  id: 200,
  workflow_instance_id: 100,
  step_id: 10,
  approver_email: 'manager@example.com',
  status: 'pending',
  decision_at: null,
  decision_comment: null,
  reminder_sent_at: null,
  reminder_count: 0,
  created_at: '2026-01-01T00:00:00Z'
};

// ============================================
// TESTS
// ============================================

describe('ApprovalService', () => {
  beforeEach(() => {
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  // ============================================
  // getWorkflowDefinitions
  // ============================================

  describe('getWorkflowDefinitions', () => {
    it('returns all definitions when no entityType provided', async () => {
      mockDb.all.mockResolvedValueOnce([mockDefinition]);

      const results = await approvalService.getWorkflowDefinitions();

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Proposal Approval');
      expect(mockDb.all).toHaveBeenCalledOnce();
      // Should NOT pass a parameter (no WHERE clause)
      expect(mockDb.all.mock.calls[0]).toHaveLength(1);
    });

    it('filters by entityType when provided', async () => {
      mockDb.all.mockResolvedValueOnce([mockDefinition]);

      const results = await approvalService.getWorkflowDefinitions('proposal');

      expect(results).toHaveLength(1);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('entity_type = ?');
      expect(params).toEqual(['proposal']);
    });

    it('returns empty array when no definitions exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const results = await approvalService.getWorkflowDefinitions();

      expect(results).toHaveLength(0);
    });
  });

  // ============================================
  // getDefaultWorkflow
  // ============================================

  describe('getDefaultWorkflow', () => {
    it('returns the default workflow for an entity type', async () => {
      mockDb.get.mockResolvedValueOnce(mockDefinition);

      const result = await approvalService.getDefaultWorkflow('proposal');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Proposal Approval');
      const [query, params] = mockDb.get.mock.calls[0];
      expect(query).toContain('entity_type = ?');
      expect(query).toContain('is_default = TRUE');
      expect(params).toEqual(['proposal']);
    });

    it('returns null when no default workflow exists', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await approvalService.getDefaultWorkflow('invoice');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getWorkflowDefinition
  // ============================================

  describe('getWorkflowDefinition', () => {
    it('returns workflow definition by id', async () => {
      mockDb.get.mockResolvedValueOnce(mockDefinition);

      const result = await approvalService.getWorkflowDefinition(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
    });

    it('returns null when definition not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await approvalService.getWorkflowDefinition(999);

      expect(result).toBeNull();
    });
  });

  // ============================================
  // createWorkflowDefinition
  // ============================================

  describe('createWorkflowDefinition', () => {
    it('creates a workflow definition without is_default', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 1 });
      mockDb.get.mockResolvedValueOnce(mockDefinition);

      const result = await approvalService.createWorkflowDefinition({
        name: 'Proposal Approval',
        entity_type: 'proposal',
        workflow_type: 'sequential'
      });

      expect(result.id).toBe(1);
      expect(mockDb.run).toHaveBeenCalledOnce();
      // Should NOT unset other defaults
      const firstRunCall = mockDb.run.mock.calls[0];
      expect(firstRunCall[0]).toContain('INSERT INTO');
    });

    it('unsets other defaults before setting is_default = true', async () => {
      mockDb.run.mockResolvedValueOnce({}); // unset defaults
      mockDb.run.mockResolvedValueOnce({ lastID: 2 }); // insert
      mockDb.get.mockResolvedValueOnce({ ...mockDefinition, id: 2 });

      await approvalService.createWorkflowDefinition({
        name: 'New Default',
        entity_type: 'proposal',
        workflow_type: 'parallel',
        is_default: true
      });

      expect(mockDb.run).toHaveBeenCalledTimes(2);
      const [firstQuery, firstParams] = mockDb.run.mock.calls[0];
      expect(firstQuery).toContain('is_default = FALSE');
      expect(firstParams).toEqual(['proposal']);
    });

    it('passes description as null when not provided', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 3 });
      mockDb.get.mockResolvedValueOnce(mockDefinition);

      await approvalService.createWorkflowDefinition({
        name: 'No Desc',
        entity_type: 'contract',
        workflow_type: 'any_one'
      });

      const [, params] = mockDb.run.mock.calls[0];
      expect(params[1]).toBeNull(); // description
    });
  });

  // ============================================
  // getWorkflowSteps
  // ============================================

  describe('getWorkflowSteps', () => {
    it('returns steps ordered by step_order', async () => {
      mockDb.all.mockResolvedValueOnce([mockStep1, mockStep2]);

      const steps = await approvalService.getWorkflowSteps(1);

      expect(steps).toHaveLength(2);
      expect(steps[0].step_order).toBe(1);
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('workflow_definition_id = ?');
      expect(params).toEqual([1]);
    });

    it('returns empty array when no steps', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const steps = await approvalService.getWorkflowSteps(999);

      expect(steps).toHaveLength(0);
    });
  });

  // ============================================
  // addWorkflowStep
  // ============================================

  describe('addWorkflowStep', () => {
    it('adds a step and returns it', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 10 });
      mockDb.get.mockResolvedValueOnce(mockStep1);

      const step = await approvalService.addWorkflowStep({
        workflow_definition_id: 1,
        step_order: 1,
        approver_type: 'user',
        approver_value: 'manager@example.com'
      });

      expect(step.id).toBe(10);
      const [, params] = mockDb.run.mock.calls[0];
      expect(params[2]).toBe('user');
      expect(params[3]).toBe('manager@example.com');
      expect(params[4]).toBe(false); // is_optional default
      expect(params[5]).toBeNull(); // auto_approve_after_hours default
    });

    it('adds a role-based step', async () => {
      mockDb.run.mockResolvedValueOnce({ lastID: 11 });
      mockDb.get.mockResolvedValueOnce({ ...mockStep1, id: 11, approver_type: 'role' });

      const step = await approvalService.addWorkflowStep({
        workflow_definition_id: 1,
        step_order: 2,
        approver_type: 'role',
        approver_value: 'admin',
        is_optional: true,
        auto_approve_after_hours: 48
      });

      expect(step.id).toBe(11);
      const [, params] = mockDb.run.mock.calls[0];
      expect(params[4]).toBe(true);
      expect(params[5]).toBe(48);
    });
  });

  // ============================================
  // startWorkflow
  // ============================================

  describe('startWorkflow', () => {
    it('starts a sequential workflow using default definition', async () => {
      // getDefaultWorkflow
      mockDb.get.mockResolvedValueOnce(mockDefinition);
      // db.run: INSERT instance
      mockDb.run.mockResolvedValueOnce({ lastID: 100 });
      // getWorkflowInstance
      mockDb.get.mockResolvedValueOnce(mockInstance);
      // logHistory
      mockDb.run.mockResolvedValueOnce({});
      // getWorkflowSteps
      mockDb.all.mockResolvedValueOnce([mockStep1, mockStep2]);
      // createApprovalRequest for step 1 only (sequential)
      mockDb.run.mockResolvedValueOnce({});

      const instance = await approvalService.startWorkflow('proposal', 50, 'user@example.com');

      expect(instance.id).toBe(100);
      expect(instance.status).toBe('in_progress');
      // Only one approval request created (step 1 of sequential)
      const runCalls = mockDb.run.mock.calls;
      const insertRequestCalls = runCalls.filter(([q]) => q.includes('INSERT INTO approval_requests'));
      expect(insertRequestCalls).toHaveLength(1);
    });

    it('starts a parallel workflow creating requests for ALL steps', async () => {
      const parallelDefinition = { ...mockDefinition, workflow_type: 'parallel' };

      mockDb.get.mockResolvedValueOnce(parallelDefinition);
      mockDb.run.mockResolvedValueOnce({ lastID: 101 });
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, id: 101 });
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.all.mockResolvedValueOnce([mockStep1, mockStep2]);
      mockDb.run.mockResolvedValueOnce({}); // request for step1
      mockDb.run.mockResolvedValueOnce({}); // request for step2

      await approvalService.startWorkflow('proposal', 51, 'user@example.com');

      const runCalls = mockDb.run.mock.calls;
      const insertRequestCalls = runCalls.filter(([q]) => q.includes('INSERT INTO approval_requests'));
      expect(insertRequestCalls).toHaveLength(2);
    });

    it('starts an any_one workflow creating requests for ALL steps', async () => {
      const anyOneDefinition = { ...mockDefinition, workflow_type: 'any_one' };

      mockDb.get.mockResolvedValueOnce(anyOneDefinition);
      mockDb.run.mockResolvedValueOnce({ lastID: 102 });
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, id: 102 });
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.all.mockResolvedValueOnce([mockStep1, mockStep2]);
      mockDb.run.mockResolvedValueOnce({}); // request for step1
      mockDb.run.mockResolvedValueOnce({}); // request for step2

      await approvalService.startWorkflow('proposal', 52, 'user@example.com');

      const runCalls = mockDb.run.mock.calls;
      const insertRequestCalls = runCalls.filter(([q]) => q.includes('INSERT INTO approval_requests'));
      expect(insertRequestCalls).toHaveLength(2);
    });

    it('starts a workflow with no steps successfully', async () => {
      mockDb.get.mockResolvedValueOnce(mockDefinition);
      mockDb.run.mockResolvedValueOnce({ lastID: 103 });
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, id: 103 });
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.all.mockResolvedValueOnce([]); // no steps

      const instance = await approvalService.startWorkflow('proposal', 53, 'user@example.com');

      expect(instance.id).toBe(103);
      // No approval requests created
      const runCalls = mockDb.run.mock.calls;
      const insertRequestCalls = runCalls.filter(([q]) => q.includes('INSERT INTO approval_requests'));
      expect(insertRequestCalls).toHaveLength(0);
    });

    it('uses a provided workflowDefinitionId instead of default', async () => {
      mockDb.get.mockResolvedValueOnce(mockDefinition); // getWorkflowDefinition(5)
      mockDb.run.mockResolvedValueOnce({ lastID: 104 });
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, id: 104 });
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.all.mockResolvedValueOnce([mockStep1]);
      mockDb.run.mockResolvedValueOnce({}); // request for step1

      await approvalService.startWorkflow('proposal', 54, 'user@example.com', 5);

      // First db.get call should be getWorkflowDefinition, not getDefaultWorkflow
      const [firstGetQuery, firstGetParams] = mockDb.get.mock.calls[0];
      expect(firstGetQuery).toContain('WHERE id = ?');
      expect(firstGetParams).toEqual([5]);
    });

    it('throws when no workflow definition found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined); // no default

      await expect(
        approvalService.startWorkflow('proposal', 55, 'user@example.com')
      ).rejects.toThrow('No workflow definition found for entity type: proposal');
    });

    it('creates role-based approval request with role: prefix', async () => {
      const roleStep = {
        ...mockStep1,
        approver_type: 'role',
        approver_value: 'admin'
      };

      mockDb.get.mockResolvedValueOnce(mockDefinition);
      mockDb.run.mockResolvedValueOnce({ lastID: 105 });
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, id: 105 });
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.all.mockResolvedValueOnce([roleStep]);
      mockDb.run.mockResolvedValueOnce({}); // approval request insert

      await approvalService.startWorkflow('proposal', 56, 'user@example.com');

      const insertRequestCall = mockDb.run.mock.calls.find(([q]) =>
        q.includes('INSERT INTO approval_requests')
      );
      expect(insertRequestCall).toBeDefined();
      expect(insertRequestCall![1][2]).toBe('role:admin');
    });

    it('includes notes in instance creation and history', async () => {
      mockDb.get.mockResolvedValueOnce(mockDefinition);
      mockDb.run.mockResolvedValueOnce({ lastID: 106 });
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, id: 106, notes: 'Rush this one' });
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.all.mockResolvedValueOnce([]);

      const instance = await approvalService.startWorkflow(
        'proposal', 57, 'user@example.com', undefined, 'Rush this one'
      );

      expect(instance.notes).toBe('Rush this one');
      const insertInstanceCall = mockDb.run.mock.calls[0];
      expect(insertInstanceCall[1]).toContain('Rush this one');
    });
  });

  // ============================================
  // getWorkflowInstance
  // ============================================

  describe('getWorkflowInstance', () => {
    it('returns a workflow instance by id', async () => {
      mockDb.get.mockResolvedValueOnce(mockInstance);

      const result = await approvalService.getWorkflowInstance(100);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(100);
    });

    it('returns null when not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await approvalService.getWorkflowInstance(999);

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getEntityWorkflow
  // ============================================

  describe('getEntityWorkflow', () => {
    it('returns the most recent workflow instance for an entity', async () => {
      mockDb.get.mockResolvedValueOnce(mockInstance);

      const result = await approvalService.getEntityWorkflow('proposal', 50);

      expect(result).not.toBeNull();
      expect(result!.entity_id).toBe(50);
      const [query, params] = mockDb.get.mock.calls[0];
      expect(query).toContain('entity_type = ?');
      expect(query).toContain('entity_id = ?');
      expect(query).toContain('ORDER BY id DESC LIMIT 1');
      expect(params).toEqual(['proposal', 50]);
    });

    it('returns null when no workflow exists for entity', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      const result = await approvalService.getEntityWorkflow('invoice', 999);

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getActiveWorkflows
  // ============================================

  describe('getActiveWorkflows', () => {
    it('returns active and in_progress workflows', async () => {
      mockDb.all.mockResolvedValueOnce([
        { ...mockInstance, workflow_name: 'Proposal Approval', workflow_type: 'sequential' }
      ]);

      const results = await approvalService.getActiveWorkflows();

      expect(results).toHaveLength(1);
      expect(results[0].workflow_name).toBe('Proposal Approval');
      const [query] = mockDb.all.mock.calls[0];
      expect(query).toContain("status IN ('pending', 'in_progress')");
    });
  });

  // ============================================
  // getPendingApprovalsForUser
  // ============================================

  describe('getPendingApprovalsForUser', () => {
    it('returns pending approvals for a given email', async () => {
      mockDb.all.mockResolvedValueOnce([
        { ...mockApprovalRequest, entity_type: 'proposal', entity_id: 50, workflow_name: 'Proposal Approval' }
      ]);

      const results = await approvalService.getPendingApprovalsForUser('manager@example.com');

      expect(results).toHaveLength(1);
      expect(results[0].approver_email).toBe('manager@example.com');
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain("ar.status = 'pending'");
      expect(params).toEqual(['manager@example.com']);
    });

    it('returns empty array when no pending approvals', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const results = await approvalService.getPendingApprovalsForUser('nobody@example.com');

      expect(results).toHaveLength(0);
    });
  });

  // ============================================
  // approve
  // ============================================

  describe('approve', () => {
    it('throws when approval request not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      await expect(
        approvalService.approve(999, 'manager@example.com')
      ).rejects.toThrow('Approval request not found');
    });

    it('throws when request is already processed', async () => {
      mockDb.get.mockResolvedValueOnce({ ...mockApprovalRequest, status: 'approved' });

      await expect(
        approvalService.approve(200, 'manager@example.com')
      ).rejects.toThrow('Request already processed');
    });

    it('approves a request and advances a sequential workflow to next step', async () => {
      // get approval request
      mockDb.get.mockResolvedValueOnce(mockApprovalRequest);
      // UPDATE approval_requests (set approved)
      mockDb.run.mockResolvedValueOnce({});
      // logHistory
      mockDb.run.mockResolvedValueOnce({});
      // advanceWorkflow: getWorkflowInstance
      mockDb.get.mockResolvedValueOnce(mockInstance);
      // advanceWorkflow: getWorkflowDefinition
      mockDb.get.mockResolvedValueOnce(mockDefinition);
      // advanceWorkflow: getWorkflowSteps
      mockDb.all.mockResolvedValueOnce([mockStep1, mockStep2]);
      // advanceWorkflow: get all requests for instance
      mockDb.all.mockResolvedValueOnce([{ ...mockApprovalRequest, status: 'approved' }]);
      // Sequential: update current_step
      mockDb.run.mockResolvedValueOnce({});
      // createApprovalRequest for step2
      mockDb.run.mockResolvedValueOnce({});
      // final getWorkflowInstance
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, current_step: 2 });

      const result = await approvalService.approve(200, 'manager@example.com', 'LGTM');

      expect(result.current_step).toBe(2);
      const updateRequestCall = mockDb.run.mock.calls[0];
      expect(updateRequestCall[0]).toContain("status = 'approved'");
      expect(updateRequestCall[1]).toEqual(['LGTM', 200]);
    });

    it('approves and marks workflow complete when last sequential step is approved', async () => {
      // Single-step workflow, step 1 is the last
      const singleStepDefinition = { ...mockDefinition, workflow_type: 'sequential' };

      mockDb.get.mockResolvedValueOnce(mockApprovalRequest);
      mockDb.run.mockResolvedValueOnce({}); // update request
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.get.mockResolvedValueOnce(mockInstance);
      mockDb.get.mockResolvedValueOnce(singleStepDefinition);
      mockDb.all.mockResolvedValueOnce([mockStep1]); // only 1 step
      mockDb.all.mockResolvedValueOnce([{ ...mockApprovalRequest, status: 'approved' }]);
      // No next step — should update status to approved
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, status: 'approved', completed_at: '2026-01-02T00:00:00Z' });

      const result = await approvalService.approve(200, 'manager@example.com');

      expect(result.status).toBe('approved');
      const completeCall = mockDb.run.mock.calls.find(([q]) =>
        q.includes("status = 'approved'") && q.includes('approval_workflow_instances')
      );
      expect(completeCall).toBeDefined();
    });

    it('approves in any_one workflow and skips remaining requests', async () => {
      const anyOneDefinition = { ...mockDefinition, workflow_type: 'any_one' };

      mockDb.get.mockResolvedValueOnce(mockApprovalRequest);
      mockDb.run.mockResolvedValueOnce({}); // update request
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, workflow_definition_id: 1 });
      mockDb.get.mockResolvedValueOnce(anyOneDefinition);
      mockDb.all.mockResolvedValueOnce([mockStep1, mockStep2]);
      mockDb.all.mockResolvedValueOnce([
        { ...mockApprovalRequest, status: 'approved' },
        { ...mockApprovalRequest, id: 201, step_id: 11, status: 'pending' }
      ]);
      mockDb.run.mockResolvedValueOnce({}); // mark instance approved
      mockDb.run.mockResolvedValueOnce({}); // skip pending requests
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, status: 'approved' });

      const result = await approvalService.approve(200, 'manager@example.com');

      expect(result.status).toBe('approved');

      // Verify "skip remaining" run call
      const skipCall = mockDb.run.mock.calls.find(([q]) =>
        q.includes("status = 'skipped'") && q.includes('approval_requests')
      );
      expect(skipCall).toBeDefined();
    });

    it('approves in parallel workflow and marks complete when all required approved', async () => {
      const parallelDefinition = { ...mockDefinition, workflow_type: 'parallel' };
      const step1 = { ...mockStep1, is_optional: false };
      const step2 = { ...mockStep2, is_optional: false };

      mockDb.get.mockResolvedValueOnce(mockApprovalRequest);
      mockDb.run.mockResolvedValueOnce({}); // update request
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.get.mockResolvedValueOnce(mockInstance);
      mockDb.get.mockResolvedValueOnce(parallelDefinition);
      mockDb.all.mockResolvedValueOnce([step1, step2]);
      mockDb.all.mockResolvedValueOnce([
        { ...mockApprovalRequest, step_id: 10, status: 'approved' },
        { ...mockApprovalRequest, id: 201, step_id: 11, status: 'approved' }
      ]);
      // Both approved — workflow complete
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, status: 'approved' });

      const result = await approvalService.approve(200, 'manager@example.com');

      expect(result.status).toBe('approved');
    });

    it('does not complete parallel workflow when required requests are still pending', async () => {
      const parallelDefinition = { ...mockDefinition, workflow_type: 'parallel' };
      const step1 = { ...mockStep1, is_optional: false };
      const step2 = { ...mockStep2, is_optional: false };

      mockDb.get.mockResolvedValueOnce(mockApprovalRequest);
      mockDb.run.mockResolvedValueOnce({}); // update request
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.get.mockResolvedValueOnce(mockInstance);
      mockDb.get.mockResolvedValueOnce(parallelDefinition);
      mockDb.all.mockResolvedValueOnce([step1, step2]);
      mockDb.all.mockResolvedValueOnce([
        { ...mockApprovalRequest, step_id: 10, status: 'approved' },
        { ...mockApprovalRequest, id: 201, step_id: 11, status: 'pending' } // still pending
      ]);
      // No status update should happen
      mockDb.get.mockResolvedValueOnce(mockInstance); // final getWorkflowInstance

      const result = await approvalService.approve(200, 'manager@example.com');

      expect(result.status).toBe('in_progress');
      // No "approved" instance update
      const approveInstanceCall = mockDb.run.mock.calls.find(([q]) =>
        q.includes("status = 'approved'") && q.includes('approval_workflow_instances')
      );
      expect(approveInstanceCall).toBeUndefined();
    });
  });

  // ============================================
  // reject
  // ============================================

  describe('reject', () => {
    it('throws when approval request not found', async () => {
      mockDb.get.mockResolvedValueOnce(undefined);

      await expect(
        approvalService.reject(999, 'manager@example.com', 'Not acceptable')
      ).rejects.toThrow('Approval request not found');
    });

    it('throws when request is already processed', async () => {
      mockDb.get.mockResolvedValueOnce({ ...mockApprovalRequest, status: 'rejected' });

      await expect(
        approvalService.reject(200, 'manager@example.com', 'No')
      ).rejects.toThrow('Request already processed');
    });

    it('rejects a request and marks the workflow as rejected', async () => {
      mockDb.get.mockResolvedValueOnce(mockApprovalRequest);
      mockDb.run.mockResolvedValueOnce({}); // update approval_requests
      mockDb.run.mockResolvedValueOnce({}); // update workflow_instances
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, status: 'rejected', completed_at: '2026-01-02T00:00:00Z' });

      const result = await approvalService.reject(200, 'manager@example.com', 'Budget too high');

      expect(result.status).toBe('rejected');

      const updateRequestCall = mockDb.run.mock.calls[0];
      expect(updateRequestCall[0]).toContain("status = 'rejected'");
      expect(updateRequestCall[1]).toEqual(['Budget too high', 200]);

      const updateInstanceCall = mockDb.run.mock.calls[1];
      expect(updateInstanceCall[0]).toContain('approval_workflow_instances');
      expect(updateInstanceCall[0]).toContain("status = 'rejected'");
    });
  });

  // ============================================
  // cancelWorkflow
  // ============================================

  describe('cancelWorkflow', () => {
    it('cancels a workflow and skips pending requests', async () => {
      mockDb.run.mockResolvedValueOnce({}); // skip pending requests
      mockDb.run.mockResolvedValueOnce({}); // update workflow status
      mockDb.run.mockResolvedValueOnce({}); // logHistory
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, status: 'cancelled', completed_at: '2026-01-02T00:00:00Z' });

      const result = await approvalService.cancelWorkflow(100, 'admin@example.com', 'No longer needed');

      expect(result.status).toBe('cancelled');

      const skipCall = mockDb.run.mock.calls[0];
      expect(skipCall[0]).toContain("status = 'skipped'");
      expect(skipCall[1]).toEqual([100]);

      const updateCall = mockDb.run.mock.calls[1];
      expect(updateCall[0]).toContain("status = 'cancelled'");
      expect(updateCall[1]).toContain('No longer needed');
    });

    it('cancels without a reason (reason is optional)', async () => {
      mockDb.run.mockResolvedValueOnce({});
      mockDb.run.mockResolvedValueOnce({});
      mockDb.run.mockResolvedValueOnce({});
      mockDb.get.mockResolvedValueOnce({ ...mockInstance, status: 'cancelled' });

      const result = await approvalService.cancelWorkflow(100, 'admin@example.com');

      expect(result.status).toBe('cancelled');
      const updateCall = mockDb.run.mock.calls[1];
      expect(updateCall[1][0]).toBeNull(); // reason is null
    });
  });

  // ============================================
  // getApprovalHistory
  // ============================================

  describe('getApprovalHistory', () => {
    it('returns history for a workflow instance ordered by created_at DESC', async () => {
      const historyRow = {
        id: 300,
        workflow_instance_id: 100,
        action: 'initiated',
        actor_email: 'user@example.com',
        step_id: null,
        comment: null,
        created_at: '2026-01-01T00:00:00Z'
      };
      mockDb.all.mockResolvedValueOnce([historyRow]);

      const history = await approvalService.getApprovalHistory(100);

      expect(history).toHaveLength(1);
      expect(history[0].action).toBe('initiated');
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('ORDER BY created_at DESC');
      expect(params).toEqual([100]);
    });
  });

  // ============================================
  // getApprovalRequests
  // ============================================

  describe('getApprovalRequests', () => {
    it('returns approval requests for a workflow instance', async () => {
      mockDb.all.mockResolvedValueOnce([mockApprovalRequest]);

      const requests = await approvalService.getApprovalRequests(100);

      expect(requests).toHaveLength(1);
      expect(requests[0].approver_email).toBe('manager@example.com');
      const [query, params] = mockDb.all.mock.calls[0];
      expect(query).toContain('workflow_instance_id = ?');
      expect(params).toEqual([100]);
    });

    it('returns empty array when no requests exist', async () => {
      mockDb.all.mockResolvedValueOnce([]);

      const requests = await approvalService.getApprovalRequests(999);

      expect(requests).toHaveLength(0);
    });
  });
});
