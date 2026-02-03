/**
 * ===============================================
 * APPROVAL WORKFLOW SERVICE
 * ===============================================
 * Handles generic approval workflows for any entity
 * Supports sequential, parallel, and any-one approval patterns
 */

import { getDatabase } from '../database/init.js';

// ============================================
// Types
// ============================================

export type EntityType = 'proposal' | 'invoice' | 'contract' | 'deliverable' | 'project';
export type WorkflowType = 'sequential' | 'parallel' | 'any_one';
export type WorkflowStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

interface WorkflowDefinition {
  id: number;
  name: string;
  description: string | null;
  entity_type: EntityType;
  workflow_type: WorkflowType;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkflowStep {
  id: number;
  workflow_definition_id: number;
  step_order: number;
  approver_type: 'user' | 'role' | 'client';
  approver_value: string;
  is_optional: boolean;
  auto_approve_after_hours: number | null;
  created_at: string;
}

interface WorkflowInstance {
  id: number;
  workflow_definition_id: number;
  entity_type: EntityType;
  entity_id: number;
  status: WorkflowStatus;
  current_step: number;
  initiated_by: string;
  initiated_at: string;
  completed_at: string | null;
  notes: string | null;
}

interface ApprovalRequest {
  id: number;
  workflow_instance_id: number;
  step_id: number;
  approver_email: string;
  status: ApprovalStatus;
  decision_at: string | null;
  decision_comment: string | null;
  reminder_sent_at: string | null;
  reminder_count: number;
  created_at: string;
}

// ============================================
// Approval Service Class
// ============================================

class ApprovalService {
  // ============================================
  // WORKFLOW DEFINITION MANAGEMENT
  // ============================================

  /**
   * Get all workflow definitions
   */
  async getWorkflowDefinitions(entityType?: EntityType): Promise<WorkflowDefinition[]> {
    const db = getDatabase();
    if (entityType) {
      return db.all(
        'SELECT * FROM approval_workflow_definitions WHERE entity_type = ? ORDER BY is_default DESC, name',
        [entityType]
      ) as unknown as Promise<WorkflowDefinition[]>;
    }
    return db.all('SELECT * FROM approval_workflow_definitions ORDER BY entity_type, is_default DESC, name') as unknown as Promise<WorkflowDefinition[]>;
  }

  /**
   * Get default workflow for an entity type
   */
  async getDefaultWorkflow(entityType: EntityType): Promise<WorkflowDefinition | null> {
    const db = getDatabase();
    const result = await db.get(
      'SELECT * FROM approval_workflow_definitions WHERE entity_type = ? AND is_default = TRUE AND is_active = TRUE',
      [entityType]
    );
    return (result as unknown as WorkflowDefinition) || null;
  }

  /**
   * Get workflow definition by ID
   */
  async getWorkflowDefinition(id: number): Promise<WorkflowDefinition | null> {
    const db = getDatabase();
    const result = await db.get('SELECT * FROM approval_workflow_definitions WHERE id = ?', [id]);
    return (result as unknown as WorkflowDefinition) || null;
  }

  /**
   * Create a new workflow definition
   */
  async createWorkflowDefinition(data: {
    name: string;
    description?: string;
    entity_type: EntityType;
    workflow_type: WorkflowType;
    is_default?: boolean;
  }): Promise<WorkflowDefinition> {
    const db = getDatabase();

    // If setting as default, unset other defaults for this entity type
    if (data.is_default) {
      await db.run(
        'UPDATE approval_workflow_definitions SET is_default = FALSE WHERE entity_type = ?',
        [data.entity_type]
      );
    }

    const result = await db.run(
      `INSERT INTO approval_workflow_definitions (name, description, entity_type, workflow_type, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [data.name, data.description || null, data.entity_type, data.workflow_type, data.is_default || false]
    );

    return this.getWorkflowDefinition(result.lastID!) as Promise<WorkflowDefinition>;
  }

  /**
   * Get steps for a workflow definition
   */
  async getWorkflowSteps(definitionId: number): Promise<WorkflowStep[]> {
    const db = getDatabase();
    return db.all(
      'SELECT * FROM approval_workflow_steps WHERE workflow_definition_id = ? ORDER BY step_order',
      [definitionId]
    ) as unknown as Promise<WorkflowStep[]>;
  }

  /**
   * Add a step to a workflow definition
   */
  async addWorkflowStep(data: {
    workflow_definition_id: number;
    step_order: number;
    approver_type: 'user' | 'role' | 'client';
    approver_value: string;
    is_optional?: boolean;
    auto_approve_after_hours?: number;
  }): Promise<WorkflowStep> {
    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO approval_workflow_steps
       (workflow_definition_id, step_order, approver_type, approver_value, is_optional, auto_approve_after_hours)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.workflow_definition_id,
        data.step_order,
        data.approver_type,
        data.approver_value,
        data.is_optional || false,
        data.auto_approve_after_hours || null
      ]
    );
    const step = await db.get('SELECT * FROM approval_workflow_steps WHERE id = ?', [result.lastID]);
    return step as unknown as WorkflowStep;
  }

  // ============================================
  // WORKFLOW INSTANCE MANAGEMENT
  // ============================================

  /**
   * Start an approval workflow for an entity
   */
  async startWorkflow(
    entityType: EntityType,
    entityId: number,
    initiatedBy: string,
    workflowDefinitionId?: number,
    notes?: string
  ): Promise<WorkflowInstance> {
    const db = getDatabase();

    // Get workflow definition
    let definition: WorkflowDefinition | null;
    if (workflowDefinitionId) {
      definition = await this.getWorkflowDefinition(workflowDefinitionId);
    } else {
      definition = await this.getDefaultWorkflow(entityType);
    }

    if (!definition) {
      throw new Error(`No workflow definition found for entity type: ${entityType}`);
    }

    // Create workflow instance
    const result = await db.run(
      `INSERT INTO approval_workflow_instances
       (workflow_definition_id, entity_type, entity_id, status, initiated_by, notes)
       VALUES (?, ?, ?, 'in_progress', ?, ?)`,
      [definition.id, entityType, entityId, initiatedBy, notes || null]
    );

    const instance = await this.getWorkflowInstance(result.lastID!) as WorkflowInstance;

    // Log initiation
    await this.logHistory(instance.id, 'initiated', initiatedBy, null, notes);

    // Create initial approval requests based on workflow type
    const steps = await this.getWorkflowSteps(definition.id);
    if (steps.length > 0) {
      if (definition.workflow_type === 'sequential') {
        // Only create request for first step
        await this.createApprovalRequest(instance.id, steps[0]);
      } else {
        // Create requests for all steps (parallel or any_one)
        for (const step of steps) {
          await this.createApprovalRequest(instance.id, step);
        }
      }
    }

    return instance;
  }

  /**
   * Get workflow instance by ID
   */
  async getWorkflowInstance(id: number): Promise<WorkflowInstance | null> {
    const db = getDatabase();
    const result = await db.get('SELECT * FROM approval_workflow_instances WHERE id = ?', [id]);
    return (result as unknown as WorkflowInstance) || null;
  }

  /**
   * Get workflow instance for an entity
   */
  async getEntityWorkflow(entityType: EntityType, entityId: number): Promise<WorkflowInstance | null> {
    const db = getDatabase();
    const result = await db.get(
      'SELECT * FROM approval_workflow_instances WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT 1',
      [entityType, entityId]
    );
    return (result as unknown as WorkflowInstance) || null;
  }

  /**
   * Get all active workflows (for admin dashboard)
   */
  async getActiveWorkflows(): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT wi.*, wd.name as workflow_name, wd.workflow_type
       FROM approval_workflow_instances wi
       JOIN approval_workflow_definitions wd ON wi.workflow_definition_id = wd.id
       WHERE wi.status IN ('pending', 'in_progress')
       ORDER BY wi.initiated_at DESC`
    );
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovalsForUser(email: string): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      `SELECT ar.*, wi.entity_type, wi.entity_id, wd.name as workflow_name
       FROM approval_requests ar
       JOIN approval_workflow_instances wi ON ar.workflow_instance_id = wi.id
       JOIN approval_workflow_definitions wd ON wi.workflow_definition_id = wd.id
       WHERE ar.approver_email = ? AND ar.status = 'pending' AND wi.status = 'in_progress'
       ORDER BY ar.created_at ASC`,
      [email]
    );
  }

  // ============================================
  // APPROVAL ACTIONS
  // ============================================

  /**
   * Approve a request
   */
  async approve(requestId: number, approverEmail: string, comment?: string): Promise<WorkflowInstance> {
    const db = getDatabase();

    // Get request and verify
    const requestRow = await db.get('SELECT * FROM approval_requests WHERE id = ?', [requestId]);
    if (!requestRow) throw new Error('Approval request not found');
    const request = requestRow as unknown as ApprovalRequest;
    if (request.status !== 'pending') throw new Error('Request already processed');

    // Update request
    await db.run(
      `UPDATE approval_requests
       SET status = 'approved', decision_at = CURRENT_TIMESTAMP, decision_comment = ?
       WHERE id = ?`,
      [comment || null, requestId]
    );

    // Log history
    await this.logHistory(request.workflow_instance_id, 'approved', approverEmail, request.step_id, comment);

    // Check if workflow should advance
    return this.advanceWorkflow(request.workflow_instance_id);
  }

  /**
   * Reject a request
   */
  async reject(requestId: number, approverEmail: string, reason: string): Promise<WorkflowInstance> {
    const db = getDatabase();

    // Get request and verify
    const requestRow = await db.get('SELECT * FROM approval_requests WHERE id = ?', [requestId]);
    if (!requestRow) throw new Error('Approval request not found');
    const request = requestRow as unknown as ApprovalRequest;
    if (request.status !== 'pending') throw new Error('Request already processed');

    // Update request
    await db.run(
      `UPDATE approval_requests
       SET status = 'rejected', decision_at = CURRENT_TIMESTAMP, decision_comment = ?
       WHERE id = ?`,
      [reason, requestId]
    );

    // Update workflow to rejected
    await db.run(
      `UPDATE approval_workflow_instances
       SET status = 'rejected', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [request.workflow_instance_id]
    );

    // Log history
    await this.logHistory(request.workflow_instance_id, 'rejected', approverEmail, request.step_id, reason);

    return this.getWorkflowInstance(request.workflow_instance_id) as Promise<WorkflowInstance>;
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(instanceId: number, cancelledBy: string, reason?: string): Promise<WorkflowInstance> {
    const db = getDatabase();

    // Update all pending requests to skipped
    await db.run(
      `UPDATE approval_requests SET status = 'skipped' WHERE workflow_instance_id = ? AND status = 'pending'`,
      [instanceId]
    );

    // Update workflow status
    await db.run(
      `UPDATE approval_workflow_instances
       SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP, notes = ?
       WHERE id = ?`,
      [reason || null, instanceId]
    );

    // Log history
    await this.logHistory(instanceId, 'cancelled', cancelledBy, null, reason);

    return this.getWorkflowInstance(instanceId) as Promise<WorkflowInstance>;
  }

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  /**
   * Create approval request for a step
   */
  private async createApprovalRequest(instanceId: number, step: WorkflowStep): Promise<void> {
    const db = getDatabase();

    // Resolve approver email based on type
    let approverEmail = step.approver_value;
    if (step.approver_type === 'role') {
      // For role-based, we'd need to look up users with that role
      // For now, use a placeholder that can be resolved later
      approverEmail = `role:${step.approver_value}`;
    }

    await db.run(
      `INSERT INTO approval_requests (workflow_instance_id, step_id, approver_email)
       VALUES (?, ?, ?)`,
      [instanceId, step.id, approverEmail]
    );
  }

  /**
   * Advance workflow after an approval
   */
  private async advanceWorkflow(instanceId: number): Promise<WorkflowInstance> {
    const db = getDatabase();
    const instance = await this.getWorkflowInstance(instanceId) as WorkflowInstance;
    const definition = await this.getWorkflowDefinition(instance.workflow_definition_id) as WorkflowDefinition;
    const steps = await this.getWorkflowSteps(definition.id);
    const requests = await db.all(
      'SELECT * FROM approval_requests WHERE workflow_instance_id = ?',
      [instanceId]
    ) as unknown as ApprovalRequest[];

    // Check workflow type logic
    if (definition.workflow_type === 'any_one') {
      // If any request is approved, workflow is approved
      const hasApproval = requests.some(r => r.status === 'approved');
      if (hasApproval) {
        await db.run(
          `UPDATE approval_workflow_instances SET status = 'approved', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [instanceId]
        );
        // Skip remaining pending requests
        await db.run(
          `UPDATE approval_requests SET status = 'skipped' WHERE workflow_instance_id = ? AND status = 'pending'`,
          [instanceId]
        );
      }
    } else if (definition.workflow_type === 'parallel') {
      // All non-optional must be approved
      const pendingRequired = requests.filter(r => {
        const step = steps.find(s => s.id === r.step_id);
        return r.status === 'pending' && step && !step.is_optional;
      });
      const allApproved = requests.every(r => {
        const step = steps.find(s => s.id === r.step_id);
        return r.status === 'approved' || (step && step.is_optional && r.status !== 'rejected');
      });

      if (pendingRequired.length === 0 && allApproved) {
        await db.run(
          `UPDATE approval_workflow_instances SET status = 'approved', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [instanceId]
        );
      }
    } else {
      // Sequential - advance to next step
      const currentStepRequest = requests.find(r => {
        const step = steps.find(s => s.id === r.step_id);
        return step && step.step_order === instance.current_step;
      });

      if (currentStepRequest && currentStepRequest.status === 'approved') {
        const nextStep = steps.find(s => s.step_order === instance.current_step + 1);
        if (nextStep) {
          // Advance to next step
          await db.run(
            `UPDATE approval_workflow_instances SET current_step = ? WHERE id = ?`,
            [nextStep.step_order, instanceId]
          );
          await this.createApprovalRequest(instanceId, nextStep);
        } else {
          // All steps complete
          await db.run(
            `UPDATE approval_workflow_instances SET status = 'approved', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [instanceId]
          );
        }
      }
    }

    return this.getWorkflowInstance(instanceId) as Promise<WorkflowInstance>;
  }

  /**
   * Log approval history
   */
  private async logHistory(
    instanceId: number,
    action: string,
    actorEmail: string,
    stepId: number | null,
    comment?: string
  ): Promise<void> {
    const db = getDatabase();
    await db.run(
      `INSERT INTO approval_history (workflow_instance_id, action, actor_email, step_id, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [instanceId, action, actorEmail, stepId, comment || null]
    );
  }

  /**
   * Get approval history for a workflow instance
   */
  async getApprovalHistory(instanceId: number): Promise<any[]> {
    const db = getDatabase();
    return db.all(
      'SELECT * FROM approval_history WHERE workflow_instance_id = ? ORDER BY created_at DESC',
      [instanceId]
    );
  }

  /**
   * Get approval requests for a workflow instance
   */
  async getApprovalRequests(instanceId: number): Promise<ApprovalRequest[]> {
    const db = getDatabase();
    return db.all(
      'SELECT * FROM approval_requests WHERE workflow_instance_id = ? ORDER BY created_at',
      [instanceId]
    ) as unknown as Promise<ApprovalRequest[]>;
  }
}

// Export singleton instance
export const approvalService = new ApprovalService();
