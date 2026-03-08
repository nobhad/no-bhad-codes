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
import { errorResponse, sanitizeErrorMessage, sendSuccess } from '../utils/api-response.js';
import { validateRequest, ValidationSchema } from '../middleware/validation.js';

const router = express.Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const WORKFLOW_NAME_MAX_LENGTH = 200;
const WORKFLOW_DESCRIPTION_MAX_LENGTH = 2000;
const ENTITY_TYPE_VALUES = ['proposal', 'invoice', 'contract', 'deliverable', 'project'];
const WORKFLOW_TYPE_VALUES = ['sequential', 'parallel', 'any_one'];
const APPROVER_TYPE_MAX_LENGTH = 50;
const APPROVER_VALUE_MAX_LENGTH = 200;
const AUTO_APPROVE_MAX_HOURS = 720;
const STEP_ORDER_MAX = 100;
const COMMENT_MAX_LENGTH = 5000;
const REASON_MAX_LENGTH = 2000;
const NOTES_MAX_LENGTH = 5000;

const ApprovalValidationSchemas = {
  createWorkflow: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: WORKFLOW_NAME_MAX_LENGTH }
    ],
    entity_type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: ENTITY_TYPE_VALUES }
    ],
    workflow_type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: WORKFLOW_TYPE_VALUES }
    ],
    description: { type: 'string' as const, maxLength: WORKFLOW_DESCRIPTION_MAX_LENGTH },
    is_default: { type: 'boolean' as const }
  } as ValidationSchema,

  addStep: {
    step_order: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1, max: STEP_ORDER_MAX }
    ],
    approver_type: [
      { type: 'required' as const },
      { type: 'string' as const, maxLength: APPROVER_TYPE_MAX_LENGTH }
    ],
    approver_value: [
      { type: 'required' as const },
      { type: 'string' as const, maxLength: APPROVER_VALUE_MAX_LENGTH }
    ],
    is_optional: { type: 'boolean' as const },
    auto_approve_after_hours: { type: 'number' as const, min: 1, max: AUTO_APPROVE_MAX_HOURS }
  } as ValidationSchema,

  startWorkflow: {
    entity_type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: ENTITY_TYPE_VALUES }
    ],
    entity_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    workflow_definition_id: { type: 'number' as const, min: 1 },
    notes: { type: 'string' as const, maxLength: NOTES_MAX_LENGTH }
  } as ValidationSchema,

  approveRequest: {
    comment: { type: 'string' as const, maxLength: COMMENT_MAX_LENGTH }
  } as ValidationSchema,

  rejectRequest: {
    reason: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: REASON_MAX_LENGTH }
    ]
  } as ValidationSchema,

  cancelWorkflow: {
    reason: { type: 'string' as const, maxLength: REASON_MAX_LENGTH }
  } as ValidationSchema
};

// =====================================================
// WORKFLOW DEFINITIONS
// =====================================================

/**
 * @swagger
 * /api/approvals/workflows:
 *   get:
 *     tags: [Approvals]
 *     summary: Get all workflow definitions
 *     description: Returns all approval workflow definitions, optionally filtered by entity type.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [proposal, invoice, contract, deliverable, project]
 *         description: Filter by entity type
 *     responses:
 *       200:
 *         description: List of workflow definitions
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/workflows',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.query.entityType as EntityType | undefined;
    const workflows = await approvalService.getWorkflowDefinitions(entityType);
    sendSuccess(res, { workflows });
  })
);

/**
 * @swagger
 * /api/approvals/workflows/{id}:
 *   get:
 *     tags: [Approvals]
 *     summary: Get a specific workflow definition
 *     description: Returns a workflow definition with its steps.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Workflow definition ID
 *     responses:
 *       200:
 *         description: Workflow definition with steps
 *       404:
 *         description: Workflow not found
 */
router.get(
  '/workflows/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid workflow ID', 400, 'VALIDATION_ERROR');
    }

    const workflow = await approvalService.getWorkflowDefinition(id);
    if (!workflow) {
      return errorResponse(res, 'Workflow not found', 404);
    }

    const steps = await approvalService.getWorkflowSteps(id);
    sendSuccess(res, { workflow, steps });
  })
);

/**
 * @swagger
 * /api/approvals/workflows:
 *   post:
 *     tags: [Approvals]
 *     summary: Create a new workflow definition
 *     description: Creates a new approval workflow definition with specified entity and workflow types.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, entity_type, workflow_type]
 *             properties:
 *               name:
 *                 type: string
 *               entity_type:
 *                 type: string
 *                 enum: [proposal, invoice, contract, deliverable, project]
 *               workflow_type:
 *                 type: string
 *                 enum: [sequential, parallel, any_one]
 *               description:
 *                 type: string
 *               is_default:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Workflow created
 *       400:
 *         description: Validation error
 */
router.post(
  '/workflows',
  authenticateToken,
  requireAdmin,
  validateRequest(ApprovalValidationSchemas.createWorkflow, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, entity_type, workflow_type, is_default } = req.body;

    const validEntityTypes: EntityType[] = [
      'proposal',
      'invoice',
      'contract',
      'deliverable',
      'project'
    ];
    const validWorkflowTypes: WorkflowType[] = ['sequential', 'parallel', 'any_one'];

    if (!validEntityTypes.includes(entity_type)) {
      return errorResponse(
        res,
        `Invalid entity_type. Must be one of: ${validEntityTypes.join(', ')}`,
        400
      );
    }

    if (!validWorkflowTypes.includes(workflow_type)) {
      return errorResponse(
        res,
        `Invalid workflow_type. Must be one of: ${validWorkflowTypes.join(', ')}`,
        400
      );
    }

    const workflow = await approvalService.createWorkflowDefinition({
      name,
      description,
      entity_type,
      workflow_type,
      is_default
    });

    sendSuccess(res, { workflow }, 'Workflow created', 201);
  })
);

/**
 * @swagger
 * /api/approvals/workflows/{id}/steps:
 *   post:
 *     tags: [Approvals]
 *     summary: Add a step to a workflow definition
 *     description: Adds an approval step to an existing workflow definition.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Workflow definition ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [step_order, approver_type, approver_value]
 *             properties:
 *               step_order:
 *                 type: integer
 *               approver_type:
 *                 type: string
 *               approver_value:
 *                 type: string
 *               is_optional:
 *                 type: boolean
 *               auto_approve_after_hours:
 *                 type: number
 *     responses:
 *       201:
 *         description: Step added
 *       400:
 *         description: Validation error
 */
router.post(
  '/workflows/:id/steps',
  authenticateToken,
  requireAdmin,
  validateRequest(ApprovalValidationSchemas.addStep, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const workflowId = parseInt(req.params.id, 10);
    if (isNaN(workflowId) || workflowId <= 0) {
      return errorResponse(res, 'Invalid workflow ID', 400, 'VALIDATION_ERROR');
    }

    const { step_order, approver_type, approver_value, is_optional, auto_approve_after_hours } =
      req.body;

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

    sendSuccess(res, { step }, 'Step added', 201);
  })
);

// =====================================================
// WORKFLOW INSTANCES
// =====================================================

/**
 * @swagger
 * /api/approvals/start:
 *   post:
 *     tags: [Approvals]
 *     summary: Start an approval workflow
 *     description: Initiates an approval workflow for a specific entity.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entity_type, entity_id]
 *             properties:
 *               entity_type:
 *                 type: string
 *                 enum: [proposal, invoice, contract, deliverable, project]
 *               entity_id:
 *                 type: integer
 *               workflow_definition_id:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Approval workflow started
 *       400:
 *         description: Failed to start workflow
 */
router.post(
  '/start',
  authenticateToken,
  validateRequest(ApprovalValidationSchemas.startWorkflow),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { entity_type, entity_id, workflow_definition_id, notes } = req.body;

    const initiatedBy = req.user?.email || 'unknown';

    try {
      const instance = await approvalService.startWorkflow(
        entity_type,
        entity_id,
        initiatedBy,
        workflow_definition_id,
        notes
      );

      sendSuccess(res, { instance }, 'Approval workflow started', 201);
    } catch (error) {
      return errorResponse(res, sanitizeErrorMessage(error, 'Failed to start workflow'), 400);
    }
  })
);

/**
 * @swagger
 * /api/approvals/active:
 *   get:
 *     tags: [Approvals]
 *     summary: Get active workflows
 *     description: Returns all currently active approval workflows for the admin dashboard.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of active workflows
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/active',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const workflows = await approvalService.getActiveWorkflows();
    sendSuccess(res, { workflows });
  })
);

/**
 * @swagger
 * /api/approvals/pending:
 *   get:
 *     tags: [Approvals]
 *     summary: Get pending approvals for current user
 *     description: Returns all pending approval requests assigned to the authenticated user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending approvals
 *       401:
 *         description: Not authenticated
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
    sendSuccess(res, { approvals });
  })
);

/**
 * @swagger
 * /api/approvals/entity/{entityType}/{entityId}:
 *   get:
 *     tags: [Approvals]
 *     summary: Get workflow instance for an entity
 *     description: Returns the approval workflow instance, requests, and history for a specific entity.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entity ID
 *     responses:
 *       200:
 *         description: Workflow instance with requests and history
 *       400:
 *         description: Invalid entity ID
 */
router.get(
  '/entity/:entityType/:entityId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { entityType, entityId } = req.params;
    const id = parseInt(entityId, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid entity ID', 400, 'VALIDATION_ERROR');
    }

    const instance = await approvalService.getEntityWorkflow(entityType as EntityType, id);
    if (!instance) {
      return sendSuccess(res, { instance: null, requests: [], history: [] });
    }

    const requests = await approvalService.getApprovalRequests(instance.id);
    const history = await approvalService.getApprovalHistory(instance.id);

    sendSuccess(res, { instance, requests, history });
  })
);

/**
 * @swagger
 * /api/approvals/instance/{id}:
 *   get:
 *     tags: [Approvals]
 *     summary: Get workflow instance by ID
 *     description: Returns a specific workflow instance with its approval requests and history.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Workflow instance ID
 *     responses:
 *       200:
 *         description: Workflow instance with requests and history
 *       404:
 *         description: Workflow instance not found
 */
router.get(
  '/instance/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid instance ID', 400, 'VALIDATION_ERROR');
    }

    const instance = await approvalService.getWorkflowInstance(id);
    if (!instance) {
      return errorResponse(res, 'Workflow instance not found', 404);
    }

    const requests = await approvalService.getApprovalRequests(id);
    const history = await approvalService.getApprovalHistory(id);

    sendSuccess(res, { instance, requests, history });
  })
);

// =====================================================
// APPROVAL ACTIONS
// =====================================================

/**
 * @swagger
 * /api/approvals/requests/{id}/approve:
 *   post:
 *     tags: [Approvals]
 *     summary: Approve a request
 *     description: Approves a pending approval request with an optional comment.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Approval request ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request approved
 *       400:
 *         description: Failed to approve
 *       403:
 *         description: Access denied
 */
router.post(
  '/requests/:id/approve',
  authenticateToken,
  validateRequest(ApprovalValidationSchemas.approveRequest, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const { comment } = req.body;
    const approverEmail = req.user?.email || 'unknown';

    if (req.user?.type !== 'admin') {
      const db = getDatabase();
      const request = (await db.get(
        'SELECT approver_email FROM approval_requests WHERE id = ? AND status = ?',
        [requestId, 'pending']
      )) as { approver_email?: string } | undefined;

      if (!request || request.approver_email !== approverEmail) {
        return errorResponse(res, 'Access denied', 403);
      }
    }

    try {
      const instance = await approvalService.approve(requestId, approverEmail, comment);
      sendSuccess(res, { instance }, 'Approved');
    } catch (error) {
      return errorResponse(res, sanitizeErrorMessage(error, 'Failed to approve'), 400);
    }
  })
);

/**
 * @swagger
 * /api/approvals/requests/{id}/reject:
 *   post:
 *     tags: [Approvals]
 *     summary: Reject a request
 *     description: Rejects a pending approval request with a required reason.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Approval request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Request rejected
 *       400:
 *         description: Failed to reject
 *       403:
 *         description: Access denied
 */
router.post(
  '/requests/:id/reject',
  authenticateToken,
  validateRequest(ApprovalValidationSchemas.rejectRequest),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requestId = parseInt(req.params.id, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const { reason } = req.body;
    if (!reason) {
      return errorResponse(res, 'Reason is required when rejecting', 400);
    }

    const approverEmail = req.user?.email || 'unknown';

    if (req.user?.type !== 'admin') {
      const db = getDatabase();
      const request = (await db.get(
        'SELECT approver_email FROM approval_requests WHERE id = ? AND status = ?',
        [requestId, 'pending']
      )) as { approver_email?: string } | undefined;

      if (!request || request.approver_email !== approverEmail) {
        return errorResponse(res, 'Access denied', 403);
      }
    }

    try {
      const instance = await approvalService.reject(requestId, approverEmail, reason);
      sendSuccess(res, { instance }, 'Rejected');
    } catch (error) {
      return errorResponse(res, sanitizeErrorMessage(error, 'Failed to reject'), 400);
    }
  })
);

/**
 * @swagger
 * /api/approvals/instance/{id}/cancel:
 *   post:
 *     tags: [Approvals]
 *     summary: Cancel a workflow
 *     description: Cancels an active approval workflow with an optional reason.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Workflow instance ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workflow cancelled
 *       400:
 *         description: Failed to cancel workflow
 */
router.post(
  '/instance/:id/cancel',
  authenticateToken,
  requireAdmin,
  validateRequest(ApprovalValidationSchemas.cancelWorkflow, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const instanceId = parseInt(req.params.id, 10);
    if (isNaN(instanceId) || instanceId <= 0) {
      return errorResponse(res, 'Invalid instance ID', 400, 'VALIDATION_ERROR');
    }

    const { reason } = req.body;
    const cancelledBy = req.user?.email || 'admin';

    try {
      const instance = await approvalService.cancelWorkflow(instanceId, cancelledBy, reason);
      sendSuccess(res, { instance }, 'Workflow cancelled');
    } catch (error) {
      return errorResponse(res, sanitizeErrorMessage(error, 'Failed to cancel workflow'), 400);
    }
  })
);

export { router as approvalsRouter };
export default router;
