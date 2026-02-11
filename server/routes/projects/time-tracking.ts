import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject } from '../../middleware/access-control.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// TIME TRACKING ENDPOINTS
// ===================================

// Get time entries for a project
router.get(
  '/:id/time-entries',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const { startDate, endDate, userName, taskId } = req.query;

    const entries = await projectService.getTimeEntries(projectId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      userName: userName as string | undefined,
      taskId: taskId ? parseInt(taskId as string) : undefined
    });

    // Transform to frontend format (hours -> duration_minutes, billable -> is_billable)
    const transformedEntries = entries.map((entry) => ({
      ...entry,
      duration_minutes: Math.round((entry.hours || 0) * 60),
      is_billable: entry.billable === true,
      hourly_rate: entry.hourlyRate || null,
      user_email: entry.userName || 'admin',
      user_name: entry.userName || 'Admin'
    }));

    res.json({ entries: transformedEntries });
  })
);

// Log time entry
router.post(
  '/:id/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    // Support both frontend format (duration_minutes, is_billable) and legacy format (hours, billable)
    const {
      userName,
      hours,
      duration_minutes,
      date,
      description,
      is_billable,
      billable,
      hourly_rate,
      hourlyRate,
      task_id,
      taskId
    } = req.body;

    // Calculate hours from duration_minutes if provided, otherwise use hours
    const calculatedHours = duration_minutes ? duration_minutes / 60 : hours;

    // Use authenticated user if userName not provided
    const effectiveUserName = userName || req.user?.email || 'admin';

    if (!calculatedHours || !date) {
      return errorResponse(res, 'hours (or duration_minutes) and date are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    // Normalize the data for the service
    const normalizedData = {
      userName: effectiveUserName,
      hours: calculatedHours,
      date,
      description: description || null,
      billable: is_billable !== undefined ? is_billable : (billable !== undefined ? billable : true),
      hourlyRate: hourly_rate || hourlyRate || null,
      taskId: task_id || taskId || null
    };

    const entry = await projectService.logTime(projectId, normalizedData);
    res.status(201).json({ message: 'Time logged successfully', entry });
  })
);

// Update time entry
router.put(
  '/:id/time-entries/:entryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const entryId = parseInt(req.params.entryId);

    // Support both frontend format and legacy format
    const {
      hours,
      duration_minutes,
      date,
      description,
      is_billable,
      billable,
      hourly_rate,
      hourlyRate,
      task_id,
      taskId
    } = req.body;

    // Calculate hours from duration_minutes if provided
    const calculatedHours = duration_minutes !== undefined ? duration_minutes / 60 : hours;

    // Normalize the data for the service
    const normalizedData: Record<string, unknown> = {};
    if (calculatedHours !== undefined) normalizedData.hours = calculatedHours;
    if (date !== undefined) normalizedData.date = date;
    if (description !== undefined) normalizedData.description = description;
    if (is_billable !== undefined) normalizedData.billable = is_billable;
    else if (billable !== undefined) normalizedData.billable = billable;
    if (hourly_rate !== undefined) normalizedData.hourlyRate = hourly_rate;
    else if (hourlyRate !== undefined) normalizedData.hourlyRate = hourlyRate;
    if (task_id !== undefined) normalizedData.taskId = task_id;
    else if (taskId !== undefined) normalizedData.taskId = taskId;

    const entry = await projectService.updateTimeEntry(entryId, normalizedData);
    res.json({ message: 'Time entry updated successfully', entry });
  })
);

// Delete time entry
router.delete(
  '/:id/time-entries/:entryId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const entryId = parseInt(req.params.entryId);
    await projectService.deleteTimeEntry(entryId);
    res.json({ message: 'Time entry deleted successfully' });
  })
);

// Get project time statistics
router.get(
  '/:id/time-stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const stats = await projectService.getProjectTimeStats(projectId);
    res.json({ stats });
  })
);

// Get team time report
router.get(
  '/reports/team-time',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 'startDate and endDate are required', 400, 'MISSING_DATE_RANGE');
    }

    const report = await projectService.getTeamTimeReport(
      startDate as string,
      endDate as string
    );
    res.json({ report });
  })
);

export default router;
