import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getSchedulerService } from '../../services/scheduler-service.js';
import { backfillMilestones } from '../../services/milestone-generator.js';
import { backfillMilestoneTasks } from '../../services/task-generator.js';
import { logger } from '../../services/logger.js';
import { getDatabase } from '../../database/init.js';

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
    const db = getDatabase();

    // Get workflow triggers as "workflows"
    const triggers = await db.all(`
      SELECT
        wt.id,
        wt.name,
        wt.description,
        wt.event_type as trigger,
        CASE WHEN wt.is_active = 1 THEN 'active' ELSE 'inactive' END as status,
        (SELECT MAX(created_at) FROM workflow_trigger_logs WHERE trigger_id = wt.id) as lastRun,
        (SELECT COUNT(*) FROM workflow_trigger_logs WHERE trigger_id = wt.id) as runCount,
        COALESCE(
          (SELECT ROUND(100.0 * SUM(CASE WHEN action_result = 'success' THEN 1 ELSE 0 END) / COUNT(*))
           FROM workflow_trigger_logs WHERE trigger_id = wt.id),
          100
        ) as successRate,
        1 as steps,
        wt.created_at as createdAt,
        wt.updated_at as updatedAt
      FROM workflow_triggers wt
      ORDER BY wt.created_at DESC
    `);

    // Calculate stats
    const stats = {
      total: triggers.length,
      active: triggers.filter((t: { status: string }) => t.status === 'active').length,
      inactive: triggers.filter((t: { status: string }) => t.status === 'inactive').length,
      totalRuns: triggers.reduce((sum: number, t: { runCount: number }) => sum + (t.runCount || 0), 0),
      avgSuccessRate: triggers.length > 0
        ? Math.round(triggers.reduce((sum: number, t: { successRate: number }) => sum + (t.successRate || 0), 0) / triggers.length)
        : 0,
    };

    res.json({ workflows: triggers, stats });
  })
);

/**
 * POST /api/admin/workflows/bulk-delete - Bulk delete workflow triggers
 */
router.post(
  '/workflows/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { workflowIds } = req.body;

    if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return res.status(400).json({ success: false, error: 'workflowIds array is required' });
    }

    const db = getDatabase();
    let deleted = 0;

    for (const workflowId of workflowIds) {
      const id = typeof workflowId === 'string' ? parseInt(workflowId, 10) : workflowId;
      if (isNaN(id)) continue;

      const result = await db.run('DELETE FROM workflow_triggers WHERE id = ?', [id]);
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    res.json({ success: true, deleted });
  })
);

/**
 * POST /api/admin/workflows/bulk-status - Bulk update workflow trigger status
 */
router.post(
  '/workflows/bulk-status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { workflowIds, status } = req.body;

    if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
      return res.status(400).json({ success: false, error: 'workflowIds array is required' });
    }

    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be "active" or "inactive"' });
    }

    const db = getDatabase();
    const isActive = status === 'active' ? 1 : 0;
    let updated = 0;

    for (const workflowId of workflowIds) {
      const id = typeof workflowId === 'string' ? parseInt(workflowId, 10) : workflowId;
      if (isNaN(id)) continue;

      const result = await db.run(
        "UPDATE workflow_triggers SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
        [isActive, id]
      );
      if (result.changes && result.changes > 0) {
        updated++;
      }
    }

    res.json({ success: true, updated });
  })
);

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
      overdueMarked: overdueCount,
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
    logger.info('[Admin] Starting milestone backfill...');

    const result = await backfillMilestones();

    res.json({
      success: true,
      message: `Backfill complete: ${result.milestonesCreated} milestones and ${result.tasksCreated} tasks created for ${result.projectsProcessed} projects`,
      data: {
        projectsProcessed: result.projectsProcessed,
        milestonesCreated: result.milestonesCreated,
        tasksCreated: result.tasksCreated,
        errors: result.errors,
      },
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
    logger.info('[Admin] Starting task backfill...');

    const result = await backfillMilestoneTasks();

    res.json({
      success: true,
      message: `Backfill complete: ${result.tasksCreated} tasks created for ${result.milestonesProcessed} milestones`,
      data: {
        milestonesProcessed: result.milestonesProcessed,
        tasksCreated: result.tasksCreated,
        errors: result.errors,
      },
    });
  })
);

export default router;
