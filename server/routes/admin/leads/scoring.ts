/**
 * ===============================================
 * LEAD ROUTES — SCORING
 * ===============================================
 * Lead scoring rules CRUD, calculate, and recalculate-all.
 */

import express from 'express';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../../middleware/auth.js';
import { leadService } from '../../../services/lead-service.js';
import { invalidateCache } from '../../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../../utils/api-response.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/leads/scoring-rules:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/scoring-rules
 *     description: Get all lead scoring rules.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/scoring-rules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const rules = await leadService.getScoringRules(includeInactive);
    sendSuccess(res, { rules });
  })
);

/**
 * @swagger
 * /api/admin/leads/scoring-rules:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/scoring-rules
 *     description: Create a new lead scoring rule.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/leads/scoring-rules',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, fieldName, operator, thresholdValue, points, isActive } = req.body;

    if (!name || !fieldName || !operator || thresholdValue === undefined || points === undefined) {
      return errorResponse(
        res,
        'Name, fieldName, operator, thresholdValue, and points are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const rule = await leadService.createScoringRule({
      name,
      description,
      fieldName,
      operator,
      thresholdValue,
      points,
      isActive
    });

    sendCreated(res, { rule });
  })
);

/**
 * @swagger
 * /api/admin/leads/scoring-rules/{id}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: PUT /api/admin/leads/scoring-rules/:id
 *     description: Update a lead scoring rule.
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
router.put(
  '/leads/scoring-rules/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const ruleId = parseInt(req.params.id, 10);
    if (isNaN(ruleId) || ruleId <= 0) {
      return errorResponse(res, 'Invalid rule ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const rule = await leadService.updateScoringRule(ruleId, req.body);
    sendSuccess(res, { rule });
  })
);

/**
 * @swagger
 * /api/admin/leads/scoring-rules/{id}:
 *   delete:
 *     tags:
 *       - Admin
 *     summary: DELETE /api/admin/leads/scoring-rules/:id
 *     description: Delete a lead scoring rule.
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
router.delete(
  '/leads/scoring-rules/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const ruleId = parseInt(req.params.id, 10);
    if (isNaN(ruleId) || ruleId <= 0) {
      return errorResponse(res, 'Invalid rule ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await leadService.deleteScoringRule(ruleId);
    sendSuccess(res, undefined, 'Scoring rule deleted');
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/calculate-score:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/:id/calculate-score
 *     description: Calculate score for a specific lead.
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
  '/leads/:id/calculate-score',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const result = await leadService.calculateLeadScore(projectId);
    sendSuccess(res, result);
  })
);

/**
 * @swagger
 * /api/admin/leads/recalculate-all:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/recalculate-all
 *     description: Recalculate scores for all leads.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/recalculate-all',
  authenticateToken,
  requireAdmin,
  invalidateCache(['leads']),
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const count = await leadService.updateAllLeadScores();
    sendSuccess(res, { count }, `Recalculated scores for ${count} leads`);
  })
);

export default router;
