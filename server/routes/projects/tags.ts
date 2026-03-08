import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// PROJECT TAGS ENDPOINTS
// ===================================

// Get tags for a project
router.get(
  '/:id/tags',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const tags = await projectService.getProjectTags(projectId);
    sendSuccess(res, { tags });
  })
);

// Add tag to project
router.post(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid project or tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await projectService.addTagToProject(projectId, tagId);
    sendCreated(res, undefined, 'Tag added to project successfully');
  })
);

// Remove tag from project
router.delete(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(projectId) || projectId <= 0 || isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid project or tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await projectService.removeTagFromProject(projectId, tagId);
    sendSuccess(res, undefined, 'Tag removed from project successfully');
  })
);

export default router;
