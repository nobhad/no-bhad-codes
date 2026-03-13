/**
 * ===============================================
 * DATA QUALITY — ERRORS
 * ===============================================
 * Validation error log retrieval.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { dataQualityService } from '../../services/data-quality-service.js';
import { sendSuccess } from '../../utils/api-response.js';

const router = Router();

/**
 * @swagger
 * /api/data-quality/validation-errors:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get validation error logs
 *     description: Retrieve validation error log entries. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: errorType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Validation error logs
 */
router.get('/validation-errors', asyncHandler(async (req: Request, res: Response) => {
  const limitParam = req.query.limit;
  const errorTypeParam = req.query.errorType;

  const errors = await dataQualityService.getValidationErrors({
    errorType: typeof errorTypeParam === 'string' ? errorTypeParam : undefined,
    limit: typeof limitParam === 'string' ? Number(limitParam) : 100
  });

  sendSuccess(res, { errors });
}));

export default router;
