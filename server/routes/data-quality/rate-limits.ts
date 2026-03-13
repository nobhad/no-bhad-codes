/**
 * ===============================================
 * DATA QUALITY — RATE LIMITS
 * ===============================================
 * Rate limiting administration: stats, block,
 * and unblock IP addresses.
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { blockIP, unblockIP, getRateLimitStats } from '../../middleware/rate-limiter.js';
import { errorResponseWithPayload, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

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
router.get('/rate-limits/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getRateLimitStats();
  sendSuccess(res, stats);
}));

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
router.post('/rate-limits/block', asyncHandler(async (req: Request, res: Response) => {
  const { ip, reason, expiresAt, adminEmail } = req.body;

  if (!ip || !reason) {
    errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
      message: 'ip and reason are required'
    });
    return;
  }

  await blockIP(ip, reason, adminEmail || 'admin', expiresAt ? new Date(expiresAt) : undefined);

  sendSuccess(res, undefined, `IP ${ip} has been blocked`);
}));

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
router.post('/rate-limits/unblock', asyncHandler(async (req: Request, res: Response) => {
  const { ip } = req.body;

  if (!ip) {
    errorResponseWithPayload(res, 'Validation error', 400, ErrorCodes.VALIDATION_ERROR, {
      message: 'ip is required'
    });
    return;
  }

  await unblockIP(ip);

  sendSuccess(res, undefined, `IP ${ip} has been unblocked`);
}));

export default router;
