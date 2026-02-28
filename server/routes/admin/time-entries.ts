/**
 * ===============================================
 * ADMIN TIME ENTRIES ROUTES
 * ===============================================
 * @file server/routes/admin/time-entries.ts
 *
 * Admin-specific time tracking endpoints for the TimeTrackingPanel.
 * Provides global time entry management across all projects.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import { errorResponse } from '../../utils/api-response.js';
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
    const db = getDatabase();

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

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (projectId) {
      whereClause += ' AND te.project_id = ?';
      params.push(String(projectId));
    }

    if (startDate) {
      whereClause += ' AND te.date >= ?';
      params.push(startDate);
    }

    const entries = await db.all(`
      SELECT
        te.id,
        te.project_id as projectId,
        p.project_name as projectName,
        te.task_id as taskId,
        t.title as taskName,
        te.user_name as userName,
        te.description,
        te.hours,
        ROUND(te.hours * 60) as duration_minutes,
        te.date,
        te.billable as is_billable,
        te.hourly_rate as hourlyRate,
        te.billed,
        te.created_at as createdAt
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      LEFT JOIN tasks t ON te.task_id = t.id
      ${whereClause}
      ORDER BY te.date DESC, te.created_at DESC
    `, params);

    // Calculate stats
    const totalHours = entries.reduce((sum: number, e: { hours: number }) => sum + (e.hours || 0), 0);
    const billableEntries = entries.filter((e: { is_billable: boolean }) => e.is_billable);
    const billableHours = billableEntries.reduce((sum: number, e: { hours: number }) => sum + (e.hours || 0), 0);
    const billedHours = entries
      .filter((e: { billed: boolean }) => e.billed)
      .reduce((sum: number, e: { hours: number }) => sum + (e.hours || 0), 0);
    const unbilledHours = billableHours - billedHours;
    const totalValue = billableEntries.reduce(
      (sum: number, e: { hours: number; hourlyRate: number }) => sum + (e.hours || 0) * (e.hourlyRate || 0),
      0
    );

    res.json({
      entries,
      stats: {
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        billedHours: Math.round(billedHours * 100) / 100,
        unbilledHours: Math.round(unbilledHours * 100) / 100,
        totalValue: Math.round(totalValue * 100) / 100,
      }
    });
  })
);

/**
 * POST /api/admin/time-entries/start - Start a timer
 */
router.post(
  '/time-entries/start',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, taskId, description } = req.body;
    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id, project_name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Create a new time entry with start time
    const result = await db.run(`
      INSERT INTO time_entries (
        project_id, task_id, user_name, description, date, hours, billable, start_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, date('now'), 0, 1, datetime('now'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      projectId,
      taskId || null,
      req.user?.email || 'Admin',
      description || '',
    ]);

    res.json({
      success: true,
      entryId: result.lastID,
      projectName: project.project_name,
    });
  })
);

/**
 * POST /api/admin/time-entries/:entryId/stop - Stop a timer
 */
router.post(
  '/time-entries/:entryId/stop',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entryId = parseInt(req.params.entryId);

    if (isNaN(entryId)) {
      return errorResponse(res, 'Invalid entry ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Get the entry with start time
    const entry = await db.get('SELECT start_time FROM time_entries WHERE id = ?', [entryId]);
    if (!entry) {
      return errorResponse(res, 'Time entry not found', 404, 'NOT_FOUND');
    }

    // Calculate hours from start_time to now
    const startTime = new Date(entry.start_time);
    const endTime = new Date();
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    await db.run(`
      UPDATE time_entries
      SET hours = ?, end_time = datetime('now'), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [Math.round(hours * 100) / 100, entryId]);

    const updated = await db.get('SELECT * FROM time_entries WHERE id = ?', [entryId]);

    res.json({ success: true, entry: updated });
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
      return errorResponse(res, 'Project ID is required', 400, 'MISSING_PROJECT');
    }

    if (!hours || hours <= 0) {
      return errorResponse(res, 'Hours must be greater than 0', 400, 'INVALID_HOURS');
    }

    const db = getDatabase();

    const result = await db.run(`
      INSERT INTO time_entries (
        project_id, task_id, user_name, description, date, hours, billable, hourly_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      projectId,
      taskId || null,
      req.user?.email || 'Admin',
      description || '',
      date || new Date().toISOString().split('T')[0],
      hours,
      billable ? 1 : 0,
      hourlyRate || null,
    ]);

    const entry = await db.get('SELECT * FROM time_entries WHERE id = ?', [result.lastID]);

    res.json({ success: true, entry });
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
    const entryId = parseInt(req.params.entryId);

    if (isNaN(entryId)) {
      return errorResponse(res, 'Invalid entry ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    const existing = await db.get('SELECT id FROM time_entries WHERE id = ?', [entryId]);
    if (!existing) {
      return errorResponse(res, 'Time entry not found', 404, 'NOT_FOUND');
    }

    await db.run('DELETE FROM time_entries WHERE id = ?', [entryId]);

    res.json({ success: true });
  })
);

export default router;
