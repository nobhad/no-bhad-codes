/**
 * ===============================================
 * LEAD ROUTES — TASKS
 * ===============================================
 * Lead task CRUD, complete, overdue, and upcoming.
 */

import express from 'express';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../../middleware/auth.js';
import { leadService } from '../../../services/lead-service.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../../utils/api-response.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/leads/{id}/tasks:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/:id/tasks
 *     description: Get tasks for a specific lead.
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
 *         description: Success
 */
router.get(
  '/leads/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const tasks = await leadService.getTasks(projectId);
    sendSuccess(res, { tasks });
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/tasks:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/:id/tasks
 *     description: Create a task for a specific lead.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/leads/:id/tasks',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { title, description, taskType, dueDate, dueTime, assignedTo, priority, reminderAt } =
      req.body;

    if (!title) {
      return errorResponse(res, 'Title is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const task = await leadService.createTask(projectId, {
      title,
      description,
      taskType,
      dueDate,
      dueTime,
      assignedTo,
      priority,
      reminderAt
    });

    sendCreated(res, { task });
  })
);

/**
 * @swagger
 * /api/admin/leads/tasks/{taskId}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: PUT /api/admin/leads/tasks/:taskId
 *     description: Update a lead task.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/leads/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const task = await leadService.updateTask(taskId, req.body);
    sendSuccess(res, { task });
  })
);

/**
 * @swagger
 * /api/admin/leads/tasks/{taskId}/complete:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/tasks/:taskId/complete
 *     description: Mark a lead task as complete.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/tasks/:taskId/complete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const task = await leadService.completeTask(taskId, req.user?.email);
    sendSuccess(res, { task });
  })
);

/**
 * @swagger
 * /api/admin/leads/tasks/overdue:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/tasks/overdue
 *     description: Get all overdue lead tasks.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/tasks/overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const tasks = await leadService.getOverdueTasks();
    sendSuccess(res, { tasks });
  })
);

/**
 * @swagger
 * /api/admin/leads/tasks/upcoming:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/tasks/upcoming
 *     description: Get upcoming lead tasks.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/tasks/upcoming',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const daysParam = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const days = isNaN(daysParam) || daysParam < 1 || daysParam > 365 ? 7 : daysParam;
    const tasks = await leadService.getUpcomingTasks(days);
    sendSuccess(res, { tasks });
  })
);

export default router;
