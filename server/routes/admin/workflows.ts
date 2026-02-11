import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getSchedulerService } from '../../services/scheduler-service.js';
import { backfillMilestones } from '../../services/milestone-generator.js';
import { backfillMilestoneTasks } from '../../services/task-generator.js';

const router = express.Router();

/**
 * POST /api/admin/run-scheduler - Manually trigger scheduler jobs (reminders + invoice generation)
 */
router.post(
  '/run-scheduler',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const scheduler = getSchedulerService();

    const overdueCount = await scheduler.checkOverdueInvoices();
    const remindersSent = await scheduler.triggerReminderProcessing();
    const { scheduled, recurring } = await scheduler.triggerInvoiceGeneration();

    res.json({
      message: 'Scheduler run completed',
      reminders: remindersSent,
      scheduledInvoices: scheduled,
      recurringInvoices: recurring,
      overdueMarked: overdueCount
    });
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
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    console.log('[Admin] Starting milestone backfill...');

    const result = await backfillMilestones();

    res.json({
      success: true,
      message: `Backfill complete: ${result.milestonesCreated} milestones and ${result.tasksCreated} tasks created for ${result.projectsProcessed} projects`,
      data: {
        projectsProcessed: result.projectsProcessed,
        milestonesCreated: result.milestonesCreated,
        tasksCreated: result.tasksCreated,
        errors: result.errors
      }
    });
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
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    console.log('[Admin] Starting task backfill...');

    const result = await backfillMilestoneTasks();

    res.json({
      success: true,
      message: `Backfill complete: ${result.tasksCreated} tasks created for ${result.milestonesProcessed} milestones`,
      data: {
        milestonesProcessed: result.milestonesProcessed,
        tasksCreated: result.tasksCreated,
        errors: result.errors
      }
    });
  })
);

export default router;
