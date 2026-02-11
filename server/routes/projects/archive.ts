import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';

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
    const projectId = parseInt(req.params.id);
    await projectService.archiveProject(projectId);
    res.json({ message: 'Project archived successfully' });
  })
);

// Unarchive project
router.post(
  '/:id/unarchive',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const projectId = parseInt(req.params.id);
    await projectService.unarchiveProject(projectId);
    res.json({ message: 'Project unarchived successfully' });
  })
);

export default router;
