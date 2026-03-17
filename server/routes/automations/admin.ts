/**
 * ===============================================
 * CUSTOM AUTOMATIONS ADMIN ROUTES
 * ===============================================
 * @file server/routes/automations/admin.ts
 *
 * Admin endpoints for managing custom automations.
 *
 * Automation CRUD:
 * GET    /                          — List all automations with run stats
 * POST   /                          — Create automation with actions
 * GET    /:id                       — Get automation with full actions
 * PUT    /:id                       — Update automation metadata
 * DELETE /:id                       — Delete automation
 * PUT    /:id/activate              — Activate automation
 * PUT    /:id/deactivate            — Deactivate automation
 *
 * Actions:
 * POST   /:id/actions               — Add action to automation
 * PUT    /:id/actions/reorder        — Reorder actions
 * PUT    /:id/actions/:actionId      — Update action
 * DELETE /:id/actions/:actionId      — Delete action
 *
 * Execution:
 * GET    /:id/runs                   — Execution history
 * GET    /runs/:runId/logs           — Per-action logs for a run
 * POST   /:id/dry-run               — Dry run with sample context
 * POST   /:id/run-now               — Manual trigger
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';
import { automationEngine } from '../../services/automation-engine.js';

const router = Router();

// ============================================
// Automation CRUD
// ============================================

/**
 * GET /api/automations
 * List all automations with action counts and run statistics.
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const automations = await automationEngine.list();
    sendSuccess(res, { automations });
  })
);

/**
 * POST /api/automations
 * Create a new automation with actions.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { name, description, triggerEvent, triggerConditions, stopOnError, maxRunsPerEntity, actions } = req.body;

    if (!name || !triggerEvent) {
      errorResponse(res, 'name and triggerEvent are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      errorResponse(res, 'At least one action is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const automationId = await automationEngine.create({
      name,
      description,
      triggerEvent,
      triggerConditions,
      stopOnError,
      maxRunsPerEntity,
      actions
    });

    sendCreated(res, { automationId }, 'Automation created');
  })
);

/**
 * GET /api/automations/:id
 * Get a single automation with full actions and run stats.
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const automation = await automationEngine.getById(automationId);

    if (!automation) {
      errorResponse(res, 'Automation not found', 404, ErrorCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, { automation });
  })
);

/**
 * PUT /api/automations/:id
 * Update automation metadata (not actions).
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const { name, description, triggerEvent, triggerConditions, stopOnError, maxRunsPerEntity } = req.body;

    await automationEngine.update(automationId, {
      name,
      description,
      triggerEvent,
      triggerConditions,
      stopOnError,
      maxRunsPerEntity
    });

    sendSuccess(res, undefined, 'Automation updated');
  })
);

/**
 * DELETE /api/automations/:id
 * Delete an automation (stops active runs first).
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    await automationEngine.deleteAutomation(automationId);
    sendSuccess(res, undefined, 'Automation deleted');
  })
);

/**
 * PUT /api/automations/:id/activate
 * Activate an automation.
 */
router.put(
  '/:id/activate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    await automationEngine.activate(automationId);
    sendSuccess(res, undefined, 'Automation activated');
  })
);

/**
 * PUT /api/automations/:id/deactivate
 * Deactivate an automation.
 */
router.put(
  '/:id/deactivate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    await automationEngine.deactivate(automationId);
    sendSuccess(res, undefined, 'Automation deactivated');
  })
);

// ============================================
// Actions
// ============================================

/**
 * POST /api/automations/:id/actions
 * Add an action to an automation.
 */
router.post(
  '/:id/actions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const { actionType, actionConfig, condition } = req.body;

    if (!actionType || !actionConfig) {
      errorResponse(res, 'actionType and actionConfig are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const actionId = await automationEngine.addAction(automationId, {
      actionType,
      actionConfig,
      condition
    });

    sendCreated(res, { actionId }, 'Action added');
  })
);

/**
 * PUT /api/automations/:id/actions/reorder
 * Reorder actions within an automation.
 * NOTE: Must be registered before /:id/actions/:actionId to avoid
 * matching "reorder" as an actionId parameter.
 */
router.put(
  '/:id/actions/reorder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const { actionIds } = req.body;

    if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
      errorResponse(res, 'actionIds array is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    await automationEngine.reorderActions(automationId, actionIds);
    sendSuccess(res, undefined, 'Actions reordered');
  })
);

/**
 * PUT /api/automations/:id/actions/:actionId
 * Update an action.
 */
router.put(
  '/:id/actions/:actionId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const actionId = Number(req.params.actionId);
    const { actionType, actionConfig, condition } = req.body;

    await automationEngine.updateAction(actionId, {
      actionType,
      actionConfig,
      condition
    });

    sendSuccess(res, undefined, 'Action updated');
  })
);

/**
 * DELETE /api/automations/:id/actions/:actionId
 * Delete an action.
 */
router.delete(
  '/:id/actions/:actionId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const actionId = Number(req.params.actionId);
    await automationEngine.deleteAction(actionId);
    sendSuccess(res, undefined, 'Action deleted');
  })
);

// ============================================
// Execution
// ============================================

/**
 * GET /api/automations/:id/runs
 * Get execution history for an automation.
 */
router.get(
  '/:id/runs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const runs = await automationEngine.getRuns(automationId, limit);
    sendSuccess(res, { runs });
  })
);

/**
 * GET /api/automations/runs/:runId/logs
 * Get per-action logs for a specific run.
 */
router.get(
  '/runs/:runId/logs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const runId = Number(req.params.runId);
    const logs = await automationEngine.getRunLogs(runId);
    sendSuccess(res, { logs });
  })
);

/**
 * POST /api/automations/:id/dry-run
 * Dry run an automation with sample context (no side effects).
 */
router.post(
  '/:id/dry-run',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const { sampleContext } = req.body;

    if (!sampleContext || typeof sampleContext !== 'object') {
      errorResponse(res, 'sampleContext object is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const result = await automationEngine.dryRun(automationId, sampleContext);
    sendSuccess(res, { result });
  })
);

/**
 * POST /api/automations/:id/run-now
 * Manually trigger an automation with optional context.
 */
router.post(
  '/:id/run-now',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const automationId = Number(req.params.id);
    const { entityType, entityId, context } = req.body;

    const runContext = context || {};

    const runId = await automationEngine.executeAutomation(
      automationId,
      runContext,
      entityType,
      entityId ? Number(entityId) : undefined
    );

    sendSuccess(res, { runId }, 'Automation executed');
  })
);

export default router;
