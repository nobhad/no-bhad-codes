/**
 * ===============================================
 * LEAD ROUTES — PIPELINE
 * ===============================================
 * Pipeline stages, kanban view, stats, and stage moves.
 */

import express from 'express';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../../middleware/auth.js';
import { leadService } from '../../../services/lead-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../../utils/api-response.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/leads/pipeline/stages:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/pipeline/stages
 *     description: Get all pipeline stages.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/pipeline/stages',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stages = await leadService.getPipelineStages();
    sendSuccess(res, { stages });
  })
);

/**
 * @swagger
 * /api/admin/leads/pipeline:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/pipeline
 *     description: Get pipeline view for kanban display.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const pipeline = await leadService.getPipelineView();
    sendSuccess(res, pipeline);
  })
);

/**
 * @swagger
 * /api/admin/leads/pipeline/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/pipeline/stats
 *     description: Get pipeline statistics.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/pipeline/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stats = await leadService.getPipelineStats();
    sendSuccess(res, { stats });
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/move-stage:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/:id/move-stage
 *     description: Move a lead to a different pipeline stage.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/:id/move-stage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { stageId } = req.body;

    if (!stageId) {
      return errorResponse(res, 'stageId is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    await leadService.moveToStage(projectId, stageId);
    sendSuccess(res, undefined, 'Lead moved to stage');
  })
);

export default router;
