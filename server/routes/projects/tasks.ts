import express, { Response } from 'express';
import { getDatabase } from '../../database/init.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, canAccessTask, canAccessChecklistItem } from '../../middleware/access-control.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, sendSuccess, sendCreated } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// TASK MANAGEMENT ENDPOINTS
// ===================================

// Get tasks for a project
router.get(
  '/:id/tasks',
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

    const { status, assignedTo, milestoneId, includeSubtasks } = req.query;

    type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
    const validStatuses: TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];
    const statusFilter = status && validStatuses.includes(status as TaskStatus)
      ? status as TaskStatus
      : undefined;

    const tasks = await projectService.getTasks(projectId, {
      status: statusFilter,
      assignedTo: assignedTo as string | undefined,
      milestoneId: milestoneId ? parseInt(milestoneId as string) : undefined,
      includeSubtasks: includeSubtasks === 'true'
    });

    sendSuccess(res, { tasks });
  })
);

// Create task
router.post(
  '/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const db = getDatabase();

    const project = await db.get('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const task = await projectService.createTask(projectId, req.body);
    sendCreated(res, { task }, 'Task created successfully');
  })
);

// Get single task
router.get(
  '/tasks/:taskId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await projectService.getTask(taskId);

    if (!task) {
      return errorResponse(res, 'Task not found', 404, 'TASK_NOT_FOUND');
    }

    if (!(await canAccessTask(req, taskId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    sendSuccess(res, { task });
  })
);

// Update task
router.put(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await projectService.updateTask(taskId, req.body);
    sendSuccess(res, { task }, 'Task updated successfully');
  })
);

// Delete task
router.delete(
  '/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    await projectService.deleteTask(taskId);
    sendSuccess(res, undefined, 'Task deleted successfully');
  })
);

// Complete task
router.post(
  '/tasks/:taskId/complete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await projectService.completeTask(taskId);
    sendSuccess(res, { task }, 'Task completed successfully');
  })
);

// Move task
router.post(
  '/tasks/:taskId/move',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
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
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const { dependsOnTaskId, type } = req.body;

    if (!dependsOnTaskId) {
      return errorResponse(res, 'dependsOnTaskId is required', 400, 'MISSING_DEPENDENCY');
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
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const dependsOnTaskId = parseInt(req.params.dependsOnTaskId);

    await projectService.removeDependency(taskId, dependsOnTaskId);
    sendSuccess(res, undefined, 'Dependency removed successfully');
  })
);

// Get blocked tasks for a project
router.get(
  '/:id/tasks/blocked',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const tasks = await projectService.getBlockedTasks(projectId);
    sendSuccess(res, { tasks });
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
    const taskId = parseInt(req.params.taskId);
    if (isNaN(taskId)) {
      return errorResponse(res, 'Invalid task ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessTask(req, taskId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    const comments = await projectService.getTaskComments(taskId);
    sendSuccess(res, { comments });
  })
);

// Add comment to task
router.post(
  '/tasks/:taskId/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const { content } = req.body;

    if (isNaN(taskId)) {
      return errorResponse(res, 'Invalid task ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessTask(req, taskId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    if (!content) {
      return errorResponse(res, 'Comment content is required', 400, 'MISSING_CONTENT');
    }

    const comment = await projectService.addTaskComment(
      taskId,
      req.user!.email,
      content
    );
    sendCreated(res, { comment }, 'Comment added successfully');
  })
);

// Delete comment
router.delete(
  '/tasks/comments/:commentId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const commentId = parseInt(req.params.commentId);
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
  asyncHandler(async (req: express.Request, res: Response) => {
    const taskId = parseInt(req.params.taskId);
    const { content } = req.body;

    if (!content) {
      return errorResponse(res, 'Checklist item content is required', 400, 'MISSING_CONTENT');
    }

    const item = await projectService.addChecklistItem(taskId, content);
    sendCreated(res, { item }, 'Checklist item added successfully');
  })
);

// Toggle checklist item
router.post(
  '/tasks/checklist/:itemId/toggle',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) {
      return errorResponse(res, 'Invalid checklist item ID', 400, 'INVALID_ID');
    }

    if (!(await canAccessChecklistItem(req, itemId))) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
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
  asyncHandler(async (req: express.Request, res: Response) => {
    const itemId = parseInt(req.params.itemId);
    await projectService.deleteChecklistItem(itemId);
    sendSuccess(res, undefined, 'Checklist item deleted successfully');
  })
);

export default router;
