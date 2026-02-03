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
import { workflowTriggerService, EventType, ActionType } from '../services/workflow-trigger-service.js';

const router = express.Router();

// =====================================================
// TRIGGER MANAGEMENT
// =====================================================

/**
 * Get all triggers
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const eventType = req.query.eventType as EventType | undefined;
    const triggers = await workflowTriggerService.getTriggers(eventType);
    res.json({ triggers });
  })
);

/**
 * Get available event types and action types
 */
router.get(
  '/options',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    res.json({
      eventTypes: workflowTriggerService.getEventTypes(),
      actionTypes: workflowTriggerService.getActionTypes()
    });
  })
);

/**
 * Get a specific trigger
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const trigger = await workflowTriggerService.getTrigger(id);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({ trigger });
  })
);

/**
 * Create a new trigger
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, event_type, conditions, action_type, action_config, is_active, priority } = req.body;

    if (!name || !event_type || !action_type || !action_config) {
      return res.status(400).json({ error: 'name, event_type, action_type, and action_config are required' });
    }

    const trigger = await workflowTriggerService.createTrigger({
      name,
      description,
      event_type,
      conditions,
      action_type,
      action_config,
      is_active,
      priority
    });

    res.status(201).json({
      success: true,
      message: 'Trigger created',
      trigger
    });
  })
);

/**
 * Update a trigger
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const trigger = await workflowTriggerService.updateTrigger(id, req.body);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({
      success: true,
      message: 'Trigger updated',
      trigger
    });
  })
);

/**
 * Delete a trigger
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    await workflowTriggerService.deleteTrigger(id);
    res.json({
      success: true,
      message: 'Trigger deleted'
    });
  })
);

/**
 * Toggle trigger active state
 */
router.post(
  '/:id/toggle',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid trigger ID' });
    }

    const trigger = await workflowTriggerService.toggleTrigger(id);
    if (!trigger) {
      return res.status(404).json({ error: 'Trigger not found' });
    }

    res.json({
      success: true,
      message: `Trigger ${trigger.is_active ? 'activated' : 'deactivated'}`,
      trigger
    });
  })
);

// =====================================================
// LOGS AND EVENTS
// =====================================================

/**
 * Get trigger execution logs
 */
router.get(
  '/logs/executions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const triggerId = req.query.triggerId ? parseInt(req.query.triggerId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const logs = await workflowTriggerService.getTriggerLogs(triggerId, limit);
    res.json({ logs });
  })
);

/**
 * Get system events
 */
router.get(
  '/logs/events',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const eventType = req.query.eventType as EventType | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    const events = await workflowTriggerService.getSystemEvents(eventType, limit);
    res.json({ events });
  })
);

/**
 * Test emit an event (for debugging)
 */
router.post(
  '/test-emit',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { event_type, context } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    await workflowTriggerService.emit(event_type as EventType, {
      ...context,
      triggeredBy: req.user?.email || 'admin',
      isTest: true
    });

    res.json({
      success: true,
      message: `Event ${event_type} emitted`
    });
  })
);

export { router as triggersRouter };
export default router;
