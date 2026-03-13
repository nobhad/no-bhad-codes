import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, isUserAdmin } from '../../utils/access-control.js';
import { userService } from '../../services/user-service.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

// Add project update (admin only)
router.post(
  '/:id/updates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { title, description, update_type = 'general', author = 'Admin' } = req.body;

    if (!title) {
      return errorResponse(res, 'Update title is required', 400, ErrorCodes.MISSING_TITLE);
    }

    if (!(await projectService.projectExists(projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const validUpdateTypes = ['progress', 'milestone', 'issue', 'resolution', 'general'];
    if (!validUpdateTypes.includes(update_type)) {
      return errorResponse(res, 'Invalid update type', 400, ErrorCodes.INVALID_UPDATE_TYPE);
    }

    // Look up user ID for author
    const authorUserId = await userService.getUserIdByEmailOrName(author);

    const newUpdate = await projectService.addProjectUpdate({
      projectId,
      title,
      description: description || null,
      updateType: update_type,
      authorUserId
    });

    sendCreated(res, { update: newUpdate }, 'Project update added successfully');
  })
);

// Get project dashboard data
router.get(
  '/:id/dashboard',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!(await projectService.projectExists(projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    const isAdmin = await isUserAdmin(req);
    const dashboardData = await projectService.getProjectDashboard(
      projectId,
      isAdmin,
      req.user!.id
    );

    if (!dashboardData) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.PROJECT_NOT_FOUND);
    }

    sendSuccess(res, dashboardData);
  })
);

export { router as activityRouter };
export default router;
