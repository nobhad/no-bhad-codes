import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, sendSuccess } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// PROJECT ARCHIVE ENDPOINTS
// ===================================

// Archive project
router.post(
  '/:id/archive',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }
    await projectService.archiveProject(projectId);
    sendSuccess(res, undefined, 'Project archived successfully');
  })
);

// Unarchive project
router.post(
  '/:id/unarchive',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }
    await projectService.unarchiveProject(projectId);
    sendSuccess(res, undefined, 'Project unarchived successfully');
  })
);

export default router;
