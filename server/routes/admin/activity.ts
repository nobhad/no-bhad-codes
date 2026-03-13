import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { activityService } from '../../services/activity-service.js';

const router = express.Router();

/**
 * GET /api/admin/recent-activity - Get consolidated recent activity feed
 *
 * Returns recent activity across all entity types:
 * - Leads (new inquiries)
 * - Invoices (sent, paid, overdue)
 * - Messages (new messages)
 * - Document requests (requested, uploaded, reviewed)
 * - Contracts (sent, signed)
 * - Project updates
 * - File uploads
 */
router.get(
  '/recent-activity',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const recentActivity = await activityService.getRecentActivity();
    sendSuccess(res, { recentActivity });
  })
);

export default router;
