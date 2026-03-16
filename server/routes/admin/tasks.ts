/**
 * ===============================================
 * ADMIN TASKS ROUTES
 * ===============================================
 * @file server/routes/admin/tasks.ts
 *
 * Admin global task management endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { projectService } from '../../services/project-service.js';
import { validateRequest, ValidationSchemas } from '../../middleware/validation.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

const router = express.Router();

/**
 * POST /api/admin/tasks - Create a new task
 */
router.post(
  '/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, title, description, priority, dueDate, milestoneId } = req.body;

    if (!projectId || !title) {
      return errorResponse(res, 'projectId and title are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    const task = await projectService.createTask(parsedProjectId, {
      title,
      description,
      priority,
      dueDate,
      milestoneId: milestoneId ? parseInt(milestoneId, 10) : undefined
    });

    sendCreated(res, { task }, 'Task created');
  })
);

/**
 * POST /api/admin/tasks/bulk-delete - Bulk delete tasks
 */
router.post(
  '/tasks/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return errorResponse(res, 'taskIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const MAX_BATCH_SIZE = 100;
    if (taskIds.length > MAX_BATCH_SIZE) {
      return errorResponse(res, `Cannot delete more than ${MAX_BATCH_SIZE} tasks at once`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validIds = taskIds
      .map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
      .filter((id: number) => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      return sendSuccess(res, { deleted: 0 });
    }

    const adminEmail = req.user?.email || 'admin';
    const result = await softDeleteService.bulkSoftDelete('task', validIds, adminEmail);

    sendSuccess(res, { deleted: result.deleted });
  })
);

/**
 * PUT /api/admin/tasks/:taskId - Update a task
 */
router.put(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  validateRequest(ValidationSchemas.task),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    const { title, description, status, priority, dueDate, assignedTo } = req.body;

    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.INVALID_ID);
    }

    if (title === undefined && description === undefined && status === undefined &&
        priority === undefined && dueDate === undefined && assignedTo === undefined) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.NO_FIELDS);
    }

    const updatedTask = await projectService.updateTaskAdmin(taskId, {
      title, description, status, priority, dueDate, assignedTo
    });

    sendSuccess(res, { task: updatedTask });
  })
);

export default router;
