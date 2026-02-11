import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';

const router = express.Router();

// ===================================
// PROJECT TAGS ENDPOINTS
// ===================================

// Get tags for a project
router.get(
  '/:id/tags',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const tags = await projectService.getProjectTags(projectId);
    res.json({ tags });
  })
);

// Add tag to project
router.post(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    await projectService.addTagToProject(projectId, tagId);
    res.status(201).json({ message: 'Tag added to project successfully' });
  })
);

// Remove tag from project
router.delete(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);

    await projectService.removeTagFromProject(projectId, tagId);
    res.json({ message: 'Tag removed from project successfully' });
  })
);

export default router;
