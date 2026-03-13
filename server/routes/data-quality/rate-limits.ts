/**
 * ===============================================
 * DATA QUALITY — RATE LIMITS
 * ===============================================
 * Rate limiting administration: stats, block,
 * and unblock IP addresses.
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../services/logger.js';
import { blockIP, unblockIP, getRateLimitStats } from '../../middleware/rate-limiter.js';
import { errorResponseWithPayload, sendSuccess, sanitizeErrorMessage, ErrorCodes } from '../../utils/api-response.js';

const router = Router();

/**
 * @swagger
 * /api/data-quality/rate-limits/stats:
 *   get:
 *     tags:
 *       - Data Quality
 *     summary: Get rate limit statistics
 *     description: Retrieve rate limiting statistics and blocked IPs. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Rate limit stats
 */
router.get('/rate-limits/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getRateLimitStats();
    sendSuccess(res, stats);
  } catch (error) {
    await logger.error('Rate limit stats error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to fetch rate limit stats', 500, ErrorCodes.INTERNAL_ERROR, {
      message: sanitizeErrorMessage(error, 'Failed to fetch rate limit statistics')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/rate-limits/block:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Block an IP address
 *     description: Manually block an IP address from accessing the API. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *               - reason
 *             properties:
 *               ip:
 *                 type: string
 *               reason:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: IP blocked
 *       400:
 *         description: ip and reason required
 */
router.post('/rate-limits/block', async (req: Request, res: Response) => {
  try {
    const { ip, reason, expiresAt, adminEmail } = req.body;

    if (!ip || !reason) {
      errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
        message: 'ip and reason are required'
      });
      return;
    }

    await blockIP(ip, reason, adminEmail || 'admin', expiresAt ? new Date(expiresAt) : undefined);

    sendSuccess(res, undefined, `IP ${ip} has been blocked`);
  } catch (error) {
    await logger.error('IP block error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to block IP', 500, ErrorCodes.INTERNAL_ERROR, {
      message: sanitizeErrorMessage(error, 'Failed to block IP address')
    });
  }
});

/**
 * @swagger
 * /api/data-quality/rate-limits/unblock:
 *   post:
 *     tags:
 *       - Data Quality
 *     summary: Unblock an IP address
 *     description: Remove an IP block. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *             properties:
 *               ip:
 *                 type: string
 *     responses:
 *       200:
 *         description: IP unblocked
 *       400:
 *         description: ip is required
 */
router.post('/rate-limits/unblock', async (req: Request, res: Response) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
        message: 'ip is required'
      });
      return;
    }

    await unblockIP(ip);

    sendSuccess(res, undefined, `IP ${ip} has been unblocked`);
  } catch (error) {
    await logger.error('IP unblock error:', {
      error: error instanceof Error ? error : undefined,
      category: 'DATA_QUALITY'
    });
    errorResponseWithPayload(res, 'Failed to unblock IP', 500, ErrorCodes.INTERNAL_ERROR, {
      message: sanitizeErrorMessage(error, 'Failed to unblock IP address')
    });
  }
});

export default router;
