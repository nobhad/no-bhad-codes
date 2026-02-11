import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';

const router = express.Router();

// ===================================
// PROJECT HEALTH ENDPOINTS
// ===================================

// Get project health
router.get(
  '/:id/health',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const health = await projectService.calculateProjectHealth(projectId);
    res.json({ health });
  })
);

// Get project burndown
router.get(
  '/:id/burndown',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const burndown = await projectService.getProjectBurndown(projectId);
    res.json({ burndown });
  })
);

// Get project velocity
router.get(
  '/:id/velocity',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const velocity = await projectService.getProjectVelocity(projectId);
    res.json({ velocity });
  })
);

export default router;
