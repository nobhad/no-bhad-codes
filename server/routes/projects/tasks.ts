import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  canAccessProject,
  canAccessTask,
  canAccessChecklistItem
} from '../../utils/access-control.js';
import { projectService } from '../../services/project-service.js';
import { invalidateCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { ProjectTask } from '../../services/project/types.js';

// Convert camelCase ProjectTask → snake_case ProjectTaskResponse for API
function serializeTask(task: ProjectTask): Record<string, unknown> {
  return {
    id: task.id,
    project_id: task.projectId,
    milestone_id: task.milestoneId ?? null,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigned_to: task.assignedTo,
    due_date: task.dueDate,
    estimated_hours: task.estimatedHours,
    actual_hours: task.actualHours,
    sort_order: task.sortOrder,
    parent_task_id: task.parentTaskId,
    completed_at: task.completedAt,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    subtasks: task.subtasks?.map(serializeTask),
    dependencies: task.dependencies,
    checklist_items: task.checklistItems
  };
}

const router = express.Router();

// ===================================
// TASK MANAGEMENT ENDPOINTS
// ===================================

// Get tasks for a project
router.get(
  '/:id/tasks',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const exists = await projectService.projectExists(projectId);
    if (!exists) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const { status, assignedTo, milestoneId, includeSubtasks } = req.query;

    type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
    const validStatuses: TaskStatus[] = [
      'pending',
      'in_progress',
      'completed',
      'cancelled',
      'blocked'
    ];
    const statusFilter =
      status && validStatuses.includes(status as TaskStatus) ? (status as TaskStatus) : undefined;

    const tasks = await projectService.getTasks(projectId, {
      status: statusFilter,
      assignedTo: assignedTo as string | undefined,
      milestoneId: milestoneId ? parseInt(milestoneId as string) : undefined,
      includeSubtasks: includeSubtasks === 'true'
    });

    sendSuccess(res, { tasks: tasks.map(serializeTask) });
  })
);

// Create task
router.post(
  '/:id/tasks',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const exists = await projectService.projectExists(projectId);
    if (!exists) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const task = await projectService.createTask(projectId, req.body);
    sendCreated(res, { task: serializeTask(task) }, 'Task created successfully');
  })
);

// Get single task
router.get(
  '/tasks/:taskId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const task = await projectService.getTask(taskId);

    if (!task) {
      return errorResponse(res, 'Task not found', 404, ErrorCodes.TASK_NOT_FOUND);
    }

    if (!(await canAccessTask(req, taskId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    sendSuccess(res, { task: serializeTask(task) });
  })
);

// Update task
router.put(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const task = await projectService.updateTask(taskId, req.body);
    sendSuccess(res, { task: serializeTask(task) }, 'Task updated successfully');
  })
);

// Delete task
router.delete(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await projectService.deleteTask(taskId);
    sendSuccess(res, undefined, 'Task deleted successfully');
  })
);

// Complete task
router.post(
  '/tasks/:taskId/complete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const task = await projectService.completeTask(taskId);
    sendSuccess(res, { task: serializeTask(task) }, 'Task completed successfully');
  })
);

// Move task
router.post(
  '/tasks/:taskId/move',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { position, milestoneId } = req.body;

    await projectService.moveTask(taskId, position, milestoneId);
    sendSuccess(res, undefined, 'Task moved successfully');
  })
);

// ===================================
// TASK DEPENDENCIES ENDPOINTS
// ===================================

// Add dependency
router.post(
  '/tasks/:taskId/dependencies',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { dependsOnTaskId, type } = req.body;

    if (!dependsOnTaskId) {
      return errorResponse(res, 'dependsOnTaskId is required', 400, ErrorCodes.MISSING_DEPENDENCY);
    }

    const dependency = await projectService.addDependency(taskId, dependsOnTaskId, type);
    sendCreated(res, { dependency }, 'Dependency added successfully');
  })
);

// Remove dependency
router.delete(
  '/tasks/:taskId/dependencies/:dependsOnTaskId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    const dependsOnTaskId = parseInt(req.params.dependsOnTaskId, 10);
    if (isNaN(taskId) || taskId <= 0 || isNaN(dependsOnTaskId) || dependsOnTaskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await projectService.removeDependency(taskId, dependsOnTaskId);
    sendSuccess(res, undefined, 'Dependency removed successfully');
  })
);

// Get blocked tasks for a project
router.get(
  '/:id/tasks/blocked',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const tasks = await projectService.getBlockedTasks(projectId);
    sendSuccess(res, { tasks: tasks.map(serializeTask) });
  })
);

// ===================================
// TASK COMMENTS ENDPOINTS
// ===================================

// Get comments for a task
router.get(
  '/tasks/:taskId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessTask(req, taskId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const comments = await projectService.getTaskComments(taskId);
    sendSuccess(res, { comments });
  })
);

// Add comment to task
router.post(
  '/tasks/:taskId/comments',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    const { content } = req.body;

    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessTask(req, taskId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    if (!content) {
      return errorResponse(res, 'Comment content is required', 400, ErrorCodes.MISSING_CONTENT);
    }

    const comment = await projectService.addTaskComment(taskId, req.user!.email, content);
    sendCreated(res, { comment }, 'Comment added successfully');
  })
);

// Delete comment
router.delete(
  '/tasks/comments/:commentId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId) || commentId <= 0) {
      return errorResponse(res, 'Invalid comment ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await projectService.deleteTaskComment(commentId);
    sendSuccess(res, undefined, 'Comment deleted successfully');
  })
);

// ===================================
// TASK CHECKLIST ENDPOINTS
// ===================================

// Add checklist item
router.post(
  '/tasks/:taskId/checklist',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId) || taskId <= 0) {
      return errorResponse(res, 'Invalid task ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { content } = req.body;

    if (!content) {
      return errorResponse(res, 'Checklist item content is required', 400, ErrorCodes.MISSING_CONTENT);
    }

    const item = await projectService.addChecklistItem(taskId, content);
    sendCreated(res, { item }, 'Checklist item added successfully');
  })
);

// Toggle checklist item
router.post(
  '/tasks/checklist/:itemId/toggle',
  authenticateToken,
  invalidateCache(['projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId) || itemId <= 0) {
      return errorResponse(res, 'Invalid checklist item ID', 400, ErrorCodes.INVALID_ID);
    }

    if (!(await canAccessChecklistItem(req, itemId))) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const item = await projectService.toggleChecklistItem(itemId);
    sendSuccess(res, { item }, 'Checklist item toggled');
  })
);

// Delete checklist item
router.delete(
  '/tasks/checklist/:itemId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['projects']),
  asyncHandler(async (req: express.Request, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);
    if (isNaN(itemId) || itemId <= 0) {
      return errorResponse(res, 'Invalid checklist item ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await projectService.deleteChecklistItem(itemId);
    sendSuccess(res, undefined, 'Checklist item deleted successfully');
  })
);

export default router;
