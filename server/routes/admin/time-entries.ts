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
import { getDatabase } from '../../database/init.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

// Matches the actual time_entries schema after migration 070
const TIME_ENTRY_COLUMNS = `
  id, project_id, task_id, user_id, description, hours, date,
  billable, hourly_rate, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

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

    let whereClause = 'WHERE te.deleted_at IS NULL';
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
        pt.title as taskName,
        COALESCE(u.display_name, u.email, 'Admin') as userName,
        te.description,
        te.hours,
        ROUND(te.hours * 60) as duration_minutes,
        te.date,
        te.billable as is_billable,
        te.hourly_rate as hourlyRate,
        te.created_at as createdAt
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      LEFT JOIN project_tasks pt ON te.task_id = pt.id
      LEFT JOIN users u ON te.user_id = u.id
      ${whereClause}
      ORDER BY te.date DESC, te.created_at DESC
    `, params);

    // Calculate stats
    const totalHours = entries.reduce((sum: number, e: { hours: number }) => sum + (e.hours || 0), 0);
    const billableEntries = entries.filter((e: { is_billable: number }) => e.is_billable);
    const billableHours = billableEntries.reduce((sum: number, e: { hours: number }) => sum + (e.hours || 0), 0);
    const totalValue = billableEntries.reduce(
      (sum: number, e: { hours: number; hourlyRate: number }) => sum + (e.hours || 0) * (e.hourlyRate || 0),
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
    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id, project_name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    // Look up user_id from the admin's email
    const user = await db.get('SELECT id FROM users WHERE email = ?', [req.user?.email]);

    const result = await db.run(`
      INSERT INTO time_entries (
        project_id, task_id, user_id, description, date, hours, billable, created_at, updated_at
      ) VALUES (?, ?, ?, ?, date('now'), 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      projectId,
      taskId || null,
      user?.id || null,
      description || ''
    ]);

    sendSuccess(res, {
      entryId: result.lastID,
      projectName: project.project_name
    });
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

    if (isNaN(entryId)) {
      return errorResponse(res, 'Invalid entry ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Get the entry — use created_at as timer start reference
    const entry = await db.get('SELECT created_at FROM time_entries WHERE id = ? AND hours = 0', [entryId]);
    if (!entry) {
      return errorResponse(res, 'Active timer not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Calculate hours from created_at to now
    const startTime = new Date(entry.created_at);
    const endTime = new Date();
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    await db.run(`
      UPDATE time_entries
      SET hours = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [Math.round(hours * 100) / 100, entryId]);

    const updated = await db.get(`SELECT ${TIME_ENTRY_COLUMNS} FROM time_entries WHERE id = ?`, [entryId]);

    sendSuccess(res, { entry: updated });
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

    const db = getDatabase();

    // Look up user_id from the admin's email
    const user = await db.get('SELECT id FROM users WHERE email = ?', [req.user?.email]);

    const result = await db.run(`
      INSERT INTO time_entries (
        project_id, task_id, user_id, description, date, hours, billable, hourly_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      projectId,
      taskId || null,
      user?.id || null,
      description || '',
      date || new Date().toISOString().split('T')[0],
      hours,
      billable ? 1 : 0,
      hourlyRate || null
    ]);

    const entry = await db.get(`SELECT ${TIME_ENTRY_COLUMNS} FROM time_entries WHERE id = ?`, [result.lastID]);

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

    if (isNaN(entryId)) {
      return errorResponse(res, 'Invalid entry ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    const existing = await db.get('SELECT id FROM time_entries WHERE id = ? AND deleted_at IS NULL', [entryId]);
    if (!existing) {
      return errorResponse(res, 'Time entry not found', 404, ErrorCodes.NOT_FOUND);
    }

    const adminEmail = req.user?.email || 'admin';
    await softDeleteService.softDelete('time_entry', entryId, adminEmail);

    sendSuccess(res);
  })
);

export default router;
