/**
 * ===============================================
 * ADMIN PERFORMANCE ROUTES
 * ===============================================
 * @file server/routes/admin/performance.ts
 *
 * Performance metrics endpoint for the admin dashboard.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { performanceService } from '../../services/performance-service.js';

const router = express.Router();

/**
 * GET /api/admin/performance - Get performance metrics
 * Accepts ?period=week|month|quarter|year (defaults to month)
 */
router.get(
  '/performance',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const periodParam = (req.query.period as string) || 'month';
      const data = await performanceService.getPerformanceMetrics(periodParam);
      sendSuccess(res, data);
    } catch (error) {
      console.error('[Performance Error]', error);
      return errorResponse(res, 'Failed to load performance data', 500, ErrorCodes.PERFORMANCE_ERROR);
    }
  })
);

export default router;
