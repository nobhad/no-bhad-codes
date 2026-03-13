/**
 * ===============================================
 * ADMIN ANALYTICS ROUTES
 * ===============================================
 * @file server/routes/admin/analytics.ts
 *
 * Analytics dashboard data endpoint.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { analyticsService } from '../../services/analytics-service.js';

const router = express.Router();

/** Convert range query param to number of days */
function rangeToDays(range: string): number {
  const rangeMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  return rangeMap[range] || 30;
}

/**
 * GET /api/admin/analytics - Get analytics data
 * Returns KPIs, charts, and source breakdown for the analytics dashboard
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const daysBack = rangeToDays(req.query.range as string);
      const data = await analyticsService.getAdminKPIAnalytics(daysBack);
      sendSuccess(res, data);
    } catch (error) {
      console.error('[Analytics Error]', error);
      return errorResponse(res, 'Failed to load analytics data', 500, ErrorCodes.ANALYTICS_ERROR);
    }
  })
);

export default router;
