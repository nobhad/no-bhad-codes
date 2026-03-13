/**
 * ===============================================
 * ADMIN TIME ENTRIES ROUTES
 * ===============================================
 * @file server/routes/admin/time-entries.ts
 *
 * Admin-specific time tracking endpoints for the TimeTrackingPanel.
 * Provides global time entry management across all projects.
 *
 * Schema (after migration 070):
 *   time_entries: id, project_id, task_id, user_id, description,
 *                 hours, date, billable, hourly_rate, created_at, updated_at
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { softDeleteService } from '../../services/soft-delete-service.js';
import { projectService } from '../../services/project-service.js';

const router = express.Router();

/**
 * GET /api/admin/time-entries - Get all time entries across projects
 */
router.get(
  '/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, range } = req.query;

    // Calculate date range
    let startDate: string | undefined;
    const now = new Date();

    switch (range) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    }

    const entries = await projectService.getAdminTimeEntries({
      projectId: projectId ? String(projectId) : undefined,
      startDate
    });

    // Calculate stats
    const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
    const billableEntries = entries.filter((e) => e.is_billable);
    const billableHours = billableEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
    const totalValue = billableEntries.reduce(
      (sum, e) => sum + (e.hours || 0) * (e.hourlyRate || 0),
      0
    );

    sendSuccess(res, {
      entries,
      stats: {
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        billedHours: 0,
        unbilledHours: Math.round(billableHours * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100
      }
    });
  })
);

/**
 * POST /api/admin/time-entries/start - Start a timer
 * Creates a time entry with 0 hours; use created_at as the start reference.
 */
router.post(
  '/time-entries/start',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, taskId, description } = req.body;

    try {
      const result = await projectService.startTimer({
        projectId,
        taskId: taskId || null,
        description,
        adminEmail: req.user?.email || ''
      });

      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
      }
      throw error;
    }
  })
);

/**
 * POST /api/admin/time-entries/:entryId/stop - Stop a timer
 * Calculates elapsed time from created_at to now.
 */
router.post(
  '/time-entries/:entryId/stop',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entryId = parseInt(req.params.entryId, 10);

    if (isNaN(entryId) || entryId <= 0) {
      return errorResponse(res, 'Invalid entry ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const updated = await projectService.stopTimer(entryId);
      sendSuccess(res, { entry: updated });
    } catch (error) {
      if (error instanceof Error && error.message === 'Active timer not found') {
        return errorResponse(res, 'Active timer not found', 404, ErrorCodes.NOT_FOUND);
      }
      throw error;
    }
  })
);

/**
 * POST /api/admin/time-entries - Create a manual time entry
 */
router.post(
  '/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, taskId, description, hours, date, billable, hourlyRate } = req.body;

    if (!projectId) {
      return errorResponse(res, 'Project ID is required', 400, ErrorCodes.MISSING_PROJECT);
    }

    if (!hours || hours <= 0) {
      return errorResponse(res, 'Hours must be greater than 0', 400, ErrorCodes.INVALID_HOURS);
    }

    const entry = await projectService.createAdminTimeEntry({
      projectId,
      taskId: taskId || null,
      description,
      hours,
      date,
      billable,
      hourlyRate,
      adminEmail: req.user?.email || ''
    });

    sendSuccess(res, { entry });
  })
);

/**
 * DELETE /api/admin/time-entries/:entryId - Delete a time entry
 */
router.delete(
  '/time-entries/:entryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entryId = parseInt(req.params.entryId, 10);

    if (isNaN(entryId) || entryId <= 0) {
      return errorResponse(res, 'Invalid entry ID', 400, ErrorCodes.INVALID_ID);
    }

    const exists = await projectService.timeEntryExists(entryId);
    if (!exists) {
      return errorResponse(res, 'Time entry not found', 404, ErrorCodes.NOT_FOUND);
    }

    const adminEmail = req.user?.email || 'admin';
    await softDeleteService.softDelete('time_entry', entryId, adminEmail);

    sendSuccess(res);
  })
);

export default router;
