/**
 * ===============================================
 * WORKFLOW TRIGGER ROUTES
 * ===============================================
 * @file server/routes/triggers.ts
 *
 * API endpoints for managing workflow triggers
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import {
  workflowTriggerService,
  EventType,
  ActionType
} from '../services/workflow-trigger-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// TRIGGER MANAGEMENT
// =====================================================

/**
 * @swagger
 * /api/triggers:
 *   get:
 *     tags:
 *       - Triggers
 *     summary: List all workflow triggers
 *     description: Retrieve all workflow triggers with optional event type filter. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *     responses:
 *       200:
 *         description: List of triggers
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const eventType = req.query.eventType as EventType | undefined;
    const triggers = await workflowTriggerService.getTriggers(eventType);
    sendSuccess(res, { triggers });
  })
);

/**
 * @swagger
 * /api/triggers/options:
 *   get:
 *     tags:
 *       - Triggers
 *     summary: Get trigger event and action types
 *     description: Retrieve available event types and action types for trigger configuration. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Event types and action types
 */
router.get(
  '/options',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    sendSuccess(res, {
      eventTypes: workflowTriggerService.getEventTypes(),
      actionTypes: workflowTriggerService.getActionTypes()
    });
  })
);

/**
 * @swagger
 * /api/triggers/{id}:
 *   get:
 *     tags:
 *       - Triggers
 *     summary: Get a trigger by ID
 *     description: Retrieve a specific workflow trigger. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trigger details
 *       404:
 *         description: Trigger not found
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid trigger ID', 400, ErrorCodes.INVALID_TRIGGER_ID);
    }

    const trigger = await workflowTriggerService.getTrigger(id);
    if (!trigger) {
      return errorResponse(res, 'Trigger not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    sendSuccess(res, { trigger });
  })
);

/**
 * @swagger
 * /api/triggers:
 *   post:
 *     tags:
 *       - Triggers
 *     summary: Create a workflow trigger
 *     description: Create a new automated workflow trigger. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - event_type
 *               - action_type
 *               - action_config
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               event_type:
 *                 type: string
 *               conditions:
 *                 type: object
 *               action_type:
 *                 type: string
 *               action_config:
 *                 type: object
 *               is_active:
 *                 type: boolean
 *               priority:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Trigger created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const {
      name,
      description,
      event_type,
      conditions,
      action_type,
      action_config,
      is_active,
      priority
    } = req.body;

    if (!name || !event_type || !action_type || !action_config) {
      return errorResponse(
        res,
        'name, event_type, action_type, and action_config are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate field types and lengths
    const TRIGGER_NAME_MAX_LENGTH = 200;
    const TRIGGER_DESC_MAX_LENGTH = 1000;
    if (typeof name !== 'string' || name.length > TRIGGER_NAME_MAX_LENGTH) {
      return errorResponse(res, `name must be a string of max ${TRIGGER_NAME_MAX_LENGTH} characters`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (typeof event_type !== 'string' || typeof action_type !== 'string') {
      return errorResponse(res, 'event_type and action_type must be strings', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (typeof action_config !== 'object' || action_config === null || Array.isArray(action_config)) {
      return errorResponse(res, 'action_config must be a non-null object', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > TRIGGER_DESC_MAX_LENGTH)) {
      return errorResponse(res, `description must be a string of max ${TRIGGER_DESC_MAX_LENGTH} characters`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (conditions !== undefined && (typeof conditions !== 'object' || conditions === null)) {
      return errorResponse(res, 'conditions must be an object', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (priority !== undefined && (typeof priority !== 'number' || priority < 0 || priority > 100)) {
      return errorResponse(res, 'priority must be a number between 0 and 100', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate event_type and action_type are known values
    const validEventTypes = workflowTriggerService.getEventTypes();
    const validActionTypeNames = workflowTriggerService.getActionTypes().map(a => a.type as string);
    if (!(validEventTypes as string[]).includes(event_type)) {
      return errorResponse(res, `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (!validActionTypeNames.includes(action_type)) {
      return errorResponse(res, `Invalid action_type. Must be one of: ${validActionTypeNames.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const trigger = await workflowTriggerService.createTrigger({
      name,
      description,
      event_type: event_type as EventType,
      conditions,
      action_type: action_type as ActionType,
      action_config,
      is_active,
      priority
    });

    sendSuccess(res, { trigger }, 'Trigger created', 201);
  })
);

/**
 * @swagger
 * /api/triggers/{id}:
 *   put:
 *     tags:
 *       - Triggers
 *     summary: Update a workflow trigger
 *     description: Update an existing workflow trigger. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trigger updated
 *       404:
 *         description: Trigger not found
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid trigger ID', 400, ErrorCodes.INVALID_TRIGGER_ID);
    }

    const trigger = await workflowTriggerService.updateTrigger(id, req.body);
    if (!trigger) {
      return errorResponse(res, 'Trigger not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    sendSuccess(res, { trigger }, 'Trigger updated');
  })
);

/**
 * @swagger
 * /api/triggers/{id}:
 *   delete:
 *     tags:
 *       - Triggers
 *     summary: Delete a workflow trigger
 *     description: Delete a workflow trigger by ID. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trigger deleted
 *       400:
 *         description: Invalid trigger ID
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid trigger ID', 400, ErrorCodes.INVALID_TRIGGER_ID);
    }

    await workflowTriggerService.deleteTrigger(id);
    sendSuccess(res, undefined, 'Trigger deleted');
  })
);

/**
 * @swagger
 * /api/triggers/{id}/toggle:
 *   post:
 *     tags:
 *       - Triggers
 *     summary: Toggle trigger active state
 *     description: Activate or deactivate a workflow trigger. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trigger toggled
 *       404:
 *         description: Trigger not found
 */
router.post(
  '/:id/toggle',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid trigger ID', 400, ErrorCodes.INVALID_TRIGGER_ID);
    }

    const trigger = await workflowTriggerService.toggleTrigger(id);
    if (!trigger) {
      return errorResponse(res, 'Trigger not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    sendSuccess(res, { trigger }, `Trigger ${trigger.is_active ? 'activated' : 'deactivated'}`);
  })
);

// =====================================================
// LOGS AND EVENTS
// =====================================================

/**
 * @swagger
 * /api/triggers/logs/executions:
 *   get:
 *     tags:
 *       - Triggers
 *     summary: Get trigger execution logs
 *     description: Retrieve execution logs for workflow triggers. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: triggerId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Execution logs
 */
router.get(
  '/logs/executions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const triggerId = req.query.triggerId ? parseInt(req.query.triggerId as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const logs = await workflowTriggerService.getTriggerLogs(triggerId, limit);
    sendSuccess(res, { logs });
  })
);

/**
 * @swagger
 * /api/triggers/logs/events:
 *   get:
 *     tags:
 *       - Triggers
 *     summary: Get system events
 *     description: Retrieve system events that can trigger workflows. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: System events
 */
router.get(
  '/logs/events',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const eventType = req.query.eventType as EventType | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const events = await workflowTriggerService.getSystemEvents(eventType, limit);
    sendSuccess(res, { events });
  })
);

/**
 * @swagger
 * /api/triggers/test-emit:
 *   post:
 *     tags:
 *       - Triggers
 *     summary: Test emit a workflow event
 *     description: Emit a test event for debugging trigger workflows. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_type
 *             properties:
 *               event_type:
 *                 type: string
 *               context:
 *                 type: object
 *     responses:
 *       200:
 *         description: Event emitted
 *       400:
 *         description: event_type is required
 */
router.post(
  '/test-emit',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { event_type, context } = req.body;

    if (!event_type) {
      return errorResponse(res, 'event_type is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await workflowTriggerService.emit(event_type as EventType, {
      ...context,
      triggeredBy: req.user?.email || 'admin',
      isTest: true
    });

    sendSuccess(res, undefined, `Event ${event_type} emitted`);
  })
);

export { router as triggersRouter };
export default router;
