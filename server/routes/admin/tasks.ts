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
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';
import { validateRequest, ValidationSchemas } from '../../middleware/validation.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

const PROJECT_TASK_COLUMNS = `
  id, project_id, milestone_id, title, description, status, priority, assigned_to,
  due_date, estimated_hours, actual_hours, sort_order, parent_task_id,
  created_at, updated_at, completed_at
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

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

    const db = getDatabase();

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      values.push(dueDate);
    }
    if (assignedTo !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assignedTo);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.NO_FIELDS);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(taskId);

    await db.run(
      `UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedTask = await db.get(`SELECT ${PROJECT_TASK_COLUMNS} FROM project_tasks WHERE id = ?`, [taskId]);

    sendSuccess(res, { task: updatedTask });
  })
);

export default router;
