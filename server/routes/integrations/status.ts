/**
 * Integration status & health routes.
 *
 * GET /status - Get integration statuses
 * GET /health - Health check
 */

import { Router } from 'express';
import { Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { checkIntegrationHealth } from '../../services/integrations/index.js';
import { getDatabase } from '../../database/init.js';
import { sendSuccess } from '../../utils/api-response.js';
import { INTEGRATION_STATUS_COLUMNS, checkRuntimeConfiguration } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/integrations/status:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get integration statuses
 *     description: Retrieve status of all configured integrations. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Integration statuses
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    const statuses = await db.all(
      `SELECT ${INTEGRATION_STATUS_COLUMNS} FROM integration_status ORDER BY integration_type LIMIT 100`
    );

    // Enhance with runtime checks
    const enhanced = statuses.map((status: Record<string, unknown>) => ({
      ...status,
      runtime_configured: checkRuntimeConfiguration(status.integration_type as string)
    }));

    sendSuccess(res, { integrations: enhanced });
  })
);

/**
 * @swagger
 * /api/integrations/health:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Check integration health
 *     description: Run lightweight health checks on all integrations. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Health check report
 */
router.get(
  '/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const report = await checkIntegrationHealth();
    sendSuccess(res, report);
  })
);

export default router;
