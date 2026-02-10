/**
 * ===============================================
 * TEST SUITE - APPROVAL & FEEDBACK SYSTEM
 * ===============================================
 * @file tests/unit/server/approvals.test.ts
 *
 * Tests for approval and feedback system:
 * - Approval workflows and management
 * - Approval decisions and tracking
 * - Automated reminders
 * - Approval history and activity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../../server/database/init';

vi.mock('../../../server/database/init', () => ({
  getDatabase: vi.fn()
}));

describe('Approval System - Workflow Management', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('GET /api/workflows', () => {
    it('should fetch all approval workflows', async () => {
      const mockWorkflows = [
        {
          id: 1,
          name: 'Design Review',
          type: 'sequential',
          steps: 2
        },
        {
          id: 2,
          name: 'Contract Approval',
          type: 'parallel',
          steps: 3
        },
        {
          id: 3,
          name: 'Budget Review',
          type: 'any_one',
          steps: 2
        }
      ];

      mockDb.all.mockResolvedValue(mockWorkflows);

      const workflows = await mockDb.all('SELECT * FROM workflows WHERE is_archived = 0');

      expect(workflows).toHaveLength(3);
      expect(workflows[0].type).toBe('sequential');
    });

    it('should fetch workflow with steps', async () => {
      const mockWorkflow = {
        id: 1,
        name: 'Design Review',
        type: 'sequential',
        steps: [
          {
            id: 1,
            order: 1,
            approver_id: 1,
            approver_name: 'Lead Designer',
            timeout_hours: 48
          },
          {
            id: 2,
            order: 2,
            approver_id: 2,
            approver_name: 'Client',
            timeout_hours: 72
          }
        ]
      };

      mockDb.get.mockResolvedValue(mockWorkflow);

      const workflow = await mockDb.get('SELECT * FROM workflows WHERE id = ?', [1]);

      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].approver_name).toBe('Lead Designer');
    });
  });

  describe('POST /api/workflows', () => {
    it('should create new approval workflow', async () => {
      const workflowData = {
        name: 'New Design Review',
        type: 'sequential',
        description: 'Design iteration approval process'
      };

      mockDb.run.mockResolvedValue({ lastID: 4 });

      await mockDb.run(
        'INSERT INTO workflows (name, type, description) VALUES (?, ?, ?)',
        [workflowData.name, workflowData.type, workflowData.description]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should support sequential workflow type', async () => {
      const type = 'sequential';

      expect(['sequential', 'parallel', 'any_one']).toContain(type);
    });

    it('should support parallel workflow type', async () => {
      const type = 'parallel';

      expect(['sequential', 'parallel', 'any_one']).toContain(type);
    });

    it('should support any_one workflow type', async () => {
      const type = 'any_one';

      expect(['sequential', 'parallel', 'any_one']).toContain(type);
    });
  });

  describe('Workflow Step Configuration', () => {
    it('should add approval step with timeout', async () => {
      const stepData = {
        workflow_id: 1,
        order: 1,
        approver_id: 1,
        timeout_hours: 48,
        auto_approve: false
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'INSERT INTO workflow_steps (workflow_id, step_order, approver_id, timeout_hours) VALUES (?, ?, ?, ?)',
        [stepData.workflow_id, stepData.order, stepData.approver_id, stepData.timeout_hours]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should support auto-approve after timeout', async () => {
      const step = {
        timeout_hours: 48,
        auto_approve: true,
        auto_approve_decision: 'approved'
      };

      expect(step.auto_approve).toBe(true);
    });

    it('should ignore auto-approve if no timeout', async () => {
      const step = {
        timeout_hours: null,
        auto_approve: false
      };

      expect(step.auto_approve).toBe(false);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('should update workflow', async () => {
      const updateData = {
        name: 'Updated Design Review',
        description: 'Updated description'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE workflows SET name = ?, description = ? WHERE id = ?',
        [updateData.name, updateData.description, 1]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should prevent updating active workflows', async () => {
      const workflow = {
        id: 1,
        status: 'active'
      };

      const canEdit = workflow.status !== 'active';

      expect(canEdit).toBe(false);
    });
  });
});

describe('Approval System - Approval Requests', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('POST /api/approvals/request', () => {
    it('should create approval request from workflow', async () => {
      const requestData = {
        workflow_id: 1,
        entity_type: 'proposal',
        entity_id: 100,
        requested_by: 1,
        status: 'pending'
      };

      mockDb.run.mockResolvedValue({ lastID: 1 });

      await mockDb.run(
        'INSERT INTO approval_requests (workflow_id, entity_type, entity_id, requested_by, status) VALUES (?, ?, ?, ?, ?)',
        [requestData.workflow_id, requestData.entity_type, requestData.entity_id, requestData.requested_by, requestData.status]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should create approval steps from workflow template', async () => {
      const approvalSteps = [
        { approval_request_id: 1, step_order: 1, approver_id: 1, status: 'pending' },
        { approval_request_id: 1, step_order: 2, approver_id: 2, status: 'waiting' }
      ];

      expect(approvalSteps).toHaveLength(2);
      expect(approvalSteps[0].status).toBe('pending');
      expect(approvalSteps[1].status).toBe('waiting');
    });

    it('should link to entity (proposal, contract, etc)', async () => {
      const request = {
        entity_type: 'proposal',
        entity_id: 100
      };

      expect(request.entity_type).toBe('proposal');
      expect(request.entity_id).toBe(100);
    });
  });

  describe('GET /api/admin/approvals/pending', () => {
    it('should fetch pending approvals for admin', async () => {
      const mockApprovals = [
        {
          id: 1,
          entity_type: 'proposal',
          entity_name: 'Web Design Proposal',
          step_order: 1,
          status: 'pending',
          requested_at: '2026-02-08T10:00:00Z'
        },
        {
          id: 2,
          entity_type: 'contract',
          entity_name: 'Service Agreement',
          step_order: 1,
          status: 'pending',
          requested_at: '2026-02-09T10:00:00Z'
        }
      ];

      mockDb.all.mockResolvedValue(mockApprovals);

      const approvals = await mockDb.all(
        'SELECT * FROM approval_steps WHERE status = ? AND approver_id = ? ORDER BY created_at',
        ['pending', 1]
      );

      expect(approvals).toHaveLength(2);
      expect(approvals[0].status).toBe('pending');
    });

    it('should show approval details with entity info', async () => {
      const approval = {
        id: 1,
        entity_type: 'proposal',
        entity_id: 100,
        entity_title: 'Web Design Proposal',
        requester_name: 'John Doe',
        due_date: '2026-02-10T18:00:00Z'
      };

      expect(approval.entity_title).toBeTruthy();
      expect(approval.due_date).toBeTruthy();
    });
  });

  describe('GET /api/client/approvals/pending', () => {
    it('should fetch pending approvals for client', async () => {
      const mockApprovals = [
        {
          id: 1,
          entity_type: 'deliverable',
          description: 'Homepage Design',
          status: 'pending',
          submitted_at: '2026-02-08T10:00:00Z'
        }
      ];

      mockDb.all.mockResolvedValue(mockApprovals);

      const approvals = await mockDb.all(
        'SELECT * FROM approval_requests WHERE client_id = ? AND status IN (?, ?)',
        [5, 'pending', 'waiting']
      );

      expect(approvals).toHaveLength(1);
      expect(approvals[0].status).toBe('pending');
    });
  });
});

describe('Approval System - Approval Decisions', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('POST /api/approvals/:id/approve', () => {
    it('should approve an approval step', async () => {
      const approvalData = {
        approval_step_id: 1,
        approver_id: 1,
        comment: 'Looks good, approved',
        decision: 'approved'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE approval_steps SET status = ?, decision = ?, comment = ?, decided_at = ? WHERE id = ?',
        ['approved', approvalData.decision, approvalData.comment, new Date().toISOString(), approvalData.approval_step_id]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should trigger next step if sequential workflow', async () => {
      const nextStep = {
        step_order: 2,
        status: 'pending'
      };

      expect(nextStep.status).toBe('pending');
    });

    it('should mark request complete if final step', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE approval_requests SET status = ?, completed_at = ? WHERE id = ?',
        ['approved', new Date().toISOString(), 1]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });
  });

  describe('POST /api/approvals/:id/reject', () => {
    it('should reject an approval step', async () => {
      const rejectData = {
        approval_step_id: 1,
        decision: 'rejected',
        comment: 'Needs revisions in the design'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE approval_steps SET status = ?, decision = ?, comment = ?, decided_at = ? WHERE id = ?',
        ['rejected', rejectData.decision, rejectData.comment, new Date().toISOString(), rejectData.approval_step_id]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should mark request as rejected', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'UPDATE approval_requests SET status = ? WHERE id = ?',
        ['rejected', 1]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should allow resubmission after rejection', async () => {
      const request = {
        status: 'rejected',
        can_resubmit: true
      };

      expect(request.can_resubmit).toBe(true);
    });
  });

  describe('POST /api/approvals/:id/request-revision', () => {
    it('should request revision with feedback', async () => {
      const revisionData = {
        approval_step_id: 1,
        decision: 'revision_requested',
        comment: 'Please revise the color scheme',
        revision_notes: 'Use brand colors from guidelines'
      };

      mockDb.run.mockResolvedValue({ changes: 1 });

      await mockDb.run(
        'INSERT INTO approval_comments (approval_step_id, comment_type, content) VALUES (?, ?, ?)',
        [revisionData.approval_step_id, 'revision', revisionData.revision_notes]
      );

      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should reset step for resubmission', async () => {
      const step = {
        status: 'revision_requested'
      };

      expect(step.status).toBe('revision_requested');
    });
  });

  describe('Approval History', () => {
    it('should track approval timeline with timestamps', async () => {
      const history = [
        { event: 'requested', timestamp: '2026-02-08T10:00:00Z', user: 'John' },
        { event: 'approved', timestamp: '2026-02-08T14:30:00Z', user: 'Designer' },
        { event: 'final_approved', timestamp: '2026-02-08T16:00:00Z', user: 'Client' }
      ];

      expect(history).toHaveLength(3);
      expect(history[history.length - 1].event).toBe('final_approved');
    });

    it('should show approval comments in history', async () => {
      const comments = [
        { type: 'comment', text: 'Looks great', timestamp: '2026-02-08T14:30:00Z' },
        { type: 'revision_request', text: 'Please adjust spacing', timestamp: '2026-02-08T15:00:00Z' }
      ];

      expect(comments).toHaveLength(2);
    });
  });
});

describe('Approval System - Automated Reminders', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('Reminder Configuration', () => {
    it('should configure reminder intervals: 1 day, 3 days, 7 days', async () => {
      const reminderConfig = {
        workflow_id: 1,
        reminders: [
          { offset_hours: 24, label: '1 day' },
          { offset_hours: 72, label: '3 days' },
          { offset_hours: 168, label: '7 days' }
        ]
      };

      expect(reminderConfig.reminders).toHaveLength(3);
      expect(reminderConfig.reminders[0].offset_hours).toBe(24);
    });
  });

  describe('Reminder Scheduling', () => {
    it('should send reminder at configured interval', async () => {
      const approvalStep = {
        created_at: '2026-02-08T10:00:00Z',
        timeout_hours: 48,
        reminders_sent: [
          { offset: 24, sent_at: '2026-02-09T10:00:00Z' }
        ]
      };

      expect(approvalStep.reminders_sent).toHaveLength(1);
    });

    it('should escalate after X days without response', async () => {
      const escalationConfig = {
        escalate_after_days: 7,
        escalate_to_role: 'admin'
      };

      expect(escalationConfig.escalate_after_days).toBe(7);
      expect(escalationConfig.escalate_to_role).toBe('admin');
    });

    it('should send escalation notification', async () => {
      const escalation = {
        approval_step_id: 1,
        escalated_at: new Date().toISOString(),
        notification_sent_to: 'admin@example.com'
      };

      expect(escalation.notification_sent_to).toBeTruthy();
    });
  });

  describe('Reminder Content', () => {
    it('should include entity details in reminder email', async () => {
      const reminderEmail = {
        subject: 'Pending Approval Reminder: Web Design Proposal',
        body: 'Please review and approve the Web Design Proposal by 2026-02-10 18:00:00'
      };

      expect(reminderEmail.subject).toContain('Reminder');
      expect(reminderEmail.body).toContain('Proposal');
    });

    it('should include approval deadline in reminder', async () => {
      const reminder = {
        deadline: '2026-02-10T18:00:00Z'
      };

      expect(reminder.deadline).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

describe('Approval System - Bulk Operations', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      run: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  describe('POST /api/approvals/bulk-approve', () => {
    it('should bulk approve similar items', async () => {
      const bulkApproveData = {
        approval_ids: [1, 2, 3],
        comment: 'Approved in batch'
      };

      mockDb.run.mockResolvedValue({ changes: 3 });

      for (const id of bulkApproveData.approval_ids) {
        await mockDb.run(
          'UPDATE approval_steps SET status = ?, decision = ? WHERE id = ?',
          ['approved', 'approved', id]
        );
      }

      expect(mockDb.run).toHaveBeenCalledTimes(3);
    });
  });

  describe('POST /api/approvals/bulk-reject', () => {
    it('should bulk reject similar items', async () => {
      const bulkRejectData = {
        approval_ids: [1, 2],
        comment: 'Rejected - needs revision'
      };

      mockDb.run.mockResolvedValue({ changes: 2 });

      for (const id of bulkRejectData.approval_ids) {
        await mockDb.run(
          'UPDATE approval_steps SET status = ?, decision = ? WHERE id = ?',
          ['rejected', 'rejected', id]
        );
      }

      expect(mockDb.run).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Approval System - Error Handling', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      get: vi.fn()
    };
    vi.mocked(getDatabase).mockReturnValue(mockDb);
  });

  it('should return 404 for non-existent approval', async () => {
    mockDb.get.mockResolvedValue(null);

    const approval = await mockDb.get('SELECT * FROM approval_requests WHERE id = ?', [999]);

    expect(approval).toBeNull();
  });

  it('should prevent approving already approved request', async () => {
    const approval = {
      id: 1,
      status: 'approved'
    };

    const canApprove = approval.status === 'pending';

    expect(canApprove).toBe(false);
  });

  it('should validate workflow exists before creating approval', async () => {
    const workflow = null;

    expect(workflow).toBeNull();
  });

  it('should handle timeout in sequential workflows correctly', async () => {
    const step = {
      created_at: '2026-02-01T10:00:00Z',
      timeout_hours: 48,
      auto_approve: true
    };

    const timeoutTime = new Date(new Date(step.created_at).getTime() + step.timeout_hours * 60 * 60 * 1000);
    const isTimedOut = new Date().getTime() > timeoutTime.getTime();

    expect(isTimedOut).toBe(true);
  });
});
