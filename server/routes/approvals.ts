/**
 * ===============================================
 * APPROVAL WORKFLOW ROUTES
 * ===============================================
 * @file server/routes/approvals.ts
 *
 * API endpoints for managing approval workflows
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { approvalService, EntityType, WorkflowType } from '../services/approval-service.js';
import { getDatabase } from '../database/init.js';
import { errorResponse } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// WORKFLOW DEFINITIONS
// =====================================================

/**
 * Get all workflow definitions
 */
router.get(
  '/workflows',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.query.entityType as EntityType | undefined;
    const workflows = await approvalService.getWorkflowDefinitions(entityType);
    res.json({ workflows });
  })
);

/**
 * Get a specific workflow definition with steps
 */
router.get(
  '/workflows/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid workflow ID', 400);
    }

    const workflow = await approvalService.getWorkflowDefinition(id);
    if (!workflow) {
      return errorResponse(res, 'Workflow not found', 404);
    }

    const steps = await approvalService.getWorkflowSteps(id);
    res.json({ workflow, steps });
  })
);

/**
 * Create a new workflow definition
 */
router.post(
  '/workflows',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, entity_type, workflow_type, is_default } = req.body;

    if (!name || !entity_type || !workflow_type) {
      return errorResponse(res, 'Name, entity_type, and workflow_type are required', 400);
    }

    const validEntityTypes: EntityType[] = ['proposal', 'invoice', 'contract', 'deliverable', 'project'];
    const validWorkflowTypes: WorkflowType[] = ['sequential', 'parallel', 'any_one'];

    if (!validEntityTypes.includes(entity_type)) {
      return errorResponse(res, `Invalid entity_type. Must be one of: ${validEntityTypes.join(', ')}`, 400);
    }

    if (!validWorkflowTypes.includes(workflow_type)) {
      return errorResponse(res, `Invalid workflow_type. Must be one of: ${validWorkflowTypes.join(', ')}`, 400);
    }

    const workflow = await approvalService.createWorkflowDefinition({
      name,
      description,
      entity_type,
      workflow_type,
      is_default
    });

    res.status(201).json({
      success: true,
      message: 'Workflow created',
      workflow
    });
  })
);

/**
 * Add a step to a workflow definition
 */
router.post(
  '/workflows/:id/steps',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const workflowId = parseInt(req.params.id);
    if (isNaN(workflowId)) {
      return errorResponse(res, 'Invalid workflow ID', 400);
    }

    const { step_order, approver_type, approver_value, is_optional, auto_approve_after_hours } = req.body;

    if (!step_order || !approver_type || !approver_value) {
      return errorResponse(res, 'step_order, approver_type, and approver_value are required', 400);
    }

    const step = await approvalService.addWorkflowStep({
      workflow_definition_id: workflowId,
      step_order,
      approver_type,
      approver_value,
      is_optional,
      auto_approve_after_hours
    });

    res.status(201).json({
      success: true,
      message: 'Step added',
      step
    });
  })
);

// =====================================================
// WORKFLOW INSTANCES
// =====================================================

/**
 * Start an approval workflow for an entity
 */
router.post(
  '/start',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { entity_type, entity_id, workflow_definition_id, notes } = req.body;

    if (!entity_type || !entity_id) {
      return errorResponse(res, 'entity_type and entity_id are required', 400);
    }

    const initiatedBy = req.user?.email || 'unknown';

    try {
      const instance = await approvalService.startWorkflow(
        entity_type,
        entity_id,
        initiatedBy,
        workflow_definition_id,
        notes
      );

      res.status(201).json({
        success: true,
        message: 'Approval workflow started',
        instance
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start workflow';
      return errorResponse(res, message, 400);
    }
  })
);

/**
 * Get active workflows (admin dashboard)
 */
router.get(
  '/active',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const workflows = await approvalService.getActiveWorkflows();
    res.json({ workflows });
  })
);

/**
 * Get pending approvals for current user
 */
router.get(
  '/pending',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const email = req.user?.email;
    if (!email) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const approvals = await approvalService.getPendingApprovalsForUser(email);
    res.json({ approvals });
  })
);

/**
 * Get workflow instance for an entity
 */
router.get(
  '/entity/:entityType/:entityId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { entityType, entityId } = req.params;
    const id = parseInt(entityId);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid entity ID', 400);
    }

    const instance = await approvalService.getEntityWorkflow(entityType as EntityType, id);
    if (!instance) {
      return res.json({ instance: null, requests: [], history: [] });
    }

    const requests = await approvalService.getApprovalRequests(instance.id);
    const history = await approvalService.getApprovalHistory(instance.id);

    res.json({ instance, requests, history });
  })
);

/**
 * Get workflow instance by ID
 */
router.get(
  '/instance/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid instance ID', 400);
    }

    const instance = await approvalService.getWorkflowInstance(id);
    if (!instance) {
      return errorResponse(res, 'Workflow instance not found', 404);
    }

    const requests = await approvalService.getApprovalRequests(id);
    const history = await approvalService.getApprovalHistory(id);

    res.json({ instance, requests, history });
  })
);

// =====================================================
// APPROVAL ACTIONS
// =====================================================

/**
 * Approve a request
 */
router.post(
  '/requests/:id/approve',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    const { comment } = req.body;
    const approverEmail = req.user?.email || 'unknown';

    if (req.user?.type !== 'admin') {
      const db = getDatabase();
      const request = await db.get(
        'SELECT approver_email FROM approval_requests WHERE id = ? AND status = ?',
        [requestId, 'pending']
      ) as { approver_email?: string } | undefined;

      if (!request || request.approver_email !== approverEmail) {
        return errorResponse(res, 'Access denied', 403);
      }
    }

    try {
      const instance = await approvalService.approve(requestId, approverEmail, comment);
      res.json({
        success: true,
        message: 'Approved',
        instance
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve';
      return errorResponse(res, message, 400);
    }
  })
);

/**
 * Reject a request
 */
router.post(
  '/requests/:id/reject',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    const { reason } = req.body;
    if (!reason) {
      return errorResponse(res, 'Reason is required when rejecting', 400);
    }

    const approverEmail = req.user?.email || 'unknown';

    if (req.user?.type !== 'admin') {
      const db = getDatabase();
      const request = await db.get(
        'SELECT approver_email FROM approval_requests WHERE id = ? AND status = ?',
        [requestId, 'pending']
      ) as { approver_email?: string } | undefined;

      if (!request || request.approver_email !== approverEmail) {
        return errorResponse(res, 'Access denied', 403);
      }
    }

    try {
      const instance = await approvalService.reject(requestId, approverEmail, reason);
      res.json({
        success: true,
        message: 'Rejected',
        instance
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject';
      return errorResponse(res, message, 400);
    }
  })
);

/**
 * Cancel a workflow
 */
router.post(
  '/instance/:id/cancel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const instanceId = parseInt(req.params.id);
    if (isNaN(instanceId)) {
      return errorResponse(res, 'Invalid instance ID', 400);
    }

    const { reason } = req.body;
    const cancelledBy = req.user?.email || 'admin';

    try {
      const instance = await approvalService.cancelWorkflow(instanceId, cancelledBy, reason);
      res.json({
        success: true,
        message: 'Workflow cancelled',
        instance
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel workflow';
      return errorResponse(res, message, 400);
    }
  })
);

export { router as approvalsRouter };
export default router;
