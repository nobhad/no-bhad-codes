import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getSchedulerService } from '../../services/scheduler-service.js';
import { backfillMilestones } from '../../services/milestone-generator.js';
import { backfillMilestoneTasks } from '../../services/task-generator.js';
import { logger } from '../../services/logger.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { invalidateCache } from '../../middleware/cache.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

/**
 * GET /api/admin/workflows - Get all automation workflows
 * Returns workflow automations for the admin workflows React component
 */
router.get(
  '/workflows',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const { workflows, stats } = await workflowTriggerService.getAdminWorkflowListing();
    sendSuccess(res, { workflows, stats });
  })
);

/**
 * POST /api/admin/workflows/bulk-delete - Bulk delete workflow triggers
 */
router.post(
  '/workflows/bulk-delete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['workflows']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { workflowIds } = req.body;

    if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return errorResponse(res, 'workflowIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const deleted = await workflowTriggerService.bulkDeleteTriggers(workflowIds);
    sendSuccess(res, { deleted });
  })
);

/**
 * POST /api/admin/workflows/bulk-status - Bulk update workflow trigger status
 */
router.post(
  '/workflows/bulk-status',
  authenticateToken,
  requireAdmin,
  invalidateCache(['workflows']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { workflowIds, status } = req.body;

    if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return errorResponse(res, 'workflowIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return errorResponse(res, 'status must be "active" or "inactive"', 400, ErrorCodes.INVALID_STATUS);
    }

    const updated = await workflowTriggerService.bulkUpdateTriggerStatus(workflowIds, status);
    sendSuccess(res, { updated });
  })
);

/**
 * POST /api/admin/run-scheduler - Manually trigger scheduler jobs (reminders + invoice generation)
 */
router.post(
  '/run-scheduler',
  authenticateToken,
  requireAdmin,
  invalidateCache(['workflows']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const scheduler = getSchedulerService();

    const overdueCount = await scheduler.checkOverdueInvoices();
    const remindersSent = await scheduler.triggerReminderProcessing();
    const { scheduled, recurring } = await scheduler.triggerInvoiceGeneration();

    sendSuccess(res, {
      reminders: remindersSent,
      scheduledInvoices: scheduled,
      recurringInvoices: recurring,
      overdueMarked: overdueCount
    }, 'Scheduler run completed');
  })
);

/**
 * POST /api/admin/milestones/backfill - Backfill milestones for existing projects
 *
 * Generates default milestones and tasks for all active projects that don't have any.
 * Useful for initial setup or migration.
 */
router.post(
  '/milestones/backfill',
  authenticateToken,
  requireAdmin,
  invalidateCache(['workflows']),
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    logger.info('[Admin] Starting milestone backfill...');

    const result = await backfillMilestones();

    sendSuccess(res, {
      projectsProcessed: result.projectsProcessed,
      milestonesCreated: result.milestonesCreated,
      tasksCreated: result.tasksCreated,
      errors: result.errors
    }, `Backfill complete: ${result.milestonesCreated} milestones and ${result.tasksCreated} tasks created for ${result.projectsProcessed} projects`);
  })
);

/**
 * POST /api/admin/tasks/backfill - Backfill tasks for existing milestones
 *
 * Generates default tasks for all milestones that don't have any.
 * Useful when milestones exist but tasks weren't auto-generated.
 */
router.post(
  '/tasks/backfill',
  authenticateToken,
  requireAdmin,
  invalidateCache(['workflows']),
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    logger.info('[Admin] Starting task backfill...');

    const result = await backfillMilestoneTasks();

    sendSuccess(res, {
      milestonesProcessed: result.milestonesProcessed,
      tasksCreated: result.tasksCreated,
      errors: result.errors
    }, `Backfill complete: ${result.tasksCreated} tasks created for ${result.milestonesProcessed} milestones`);
  })
);

export default router;
