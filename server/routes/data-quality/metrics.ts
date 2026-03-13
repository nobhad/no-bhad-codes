/**
 * ===============================================
 * DATA QUALITY — METRICS
 * ===============================================
 * Data quality metrics retrieval, calculation,
 * and history endpoints.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDuplicateStats } from '../../services/duplicate-detection-service.js';
import { dataQualityService } from '../../services/data-quality-service.js';
import { sendSuccess } from '../../utils/api-response.js';

const router = Router();

/**
 * @swagger
 * /api/data-quality/metrics:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get data quality metrics
 *     description: Retrieve current data quality statistics. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Quality metrics
 */
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await getDuplicateStats();
  sendSuccess(res, metrics);
}));

/**
 * @swagger
 * /api/data-quality/metrics/calculate:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Calculate and store quality metrics
 *     description: Trigger data quality calculation and persist results. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics calculated and stored
 */
router.post('/metrics/calculate', asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await getDuplicateStats();
  const today = new Date().toISOString().split('T')[0];

  // Store metrics
  await dataQualityService.storeMetrics({
    metricDate: today,
    totalRecords: metrics.totalChecks,
    duplicateCount: metrics.duplicatesFound,
    qualityScore: metrics.averageMatchScore * 100,
    detailsJson: JSON.stringify(metrics)
  });

  sendSuccess(res, metrics, 'Data quality metrics calculated and stored');
}));

/**
 * @swagger
 * /api/data-quality/metrics/history:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get quality metrics history
 *     description: Retrieve historical data quality metrics. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Metrics history
 */
router.get('/metrics/history', asyncHandler(async (req: Request, res: Response) => {
  const daysParam = req.query.days;
  const days = typeof daysParam === 'string' ? Number(daysParam) : 30;

  const history = await dataQualityService.getMetricsHistory(days);

  sendSuccess(res, { history });
}));

export default router;
