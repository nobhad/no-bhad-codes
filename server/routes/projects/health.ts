import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';
import { sendSuccess } from '../../utils/api-response.js';

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
    sendSuccess(res, { health });
  })
);

// Get project burndown
router.get(
  '/:id/burndown',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const burndown = await projectService.getProjectBurndown(projectId);
    sendSuccess(res, { burndown });
  })
);

// Get project velocity
router.get(
  '/:id/velocity',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.id);
    const velocity = await projectService.getProjectVelocity(projectId);
    sendSuccess(res, { velocity });
  })
);

export default router;
