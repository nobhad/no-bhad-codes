/**
 * ===============================================
 * ADMIN — AUDIT CHAIN VERIFICATION
 * ===============================================
 * @file server/routes/admin/audit-chain.ts
 *
 * GET /api/admin/audit-chain/verify
 *
 * Walks the audit_logs hash chain from oldest to newest and reports
 * any rows whose stored hash or prev_hash can't be reproduced from
 * the row's current contents. A non-zero `breaks` array means someone
 * (or something) mutated a historical row — either a direct DB edit,
 * a deletion, or a bug in the writer.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { verifyAuditChain } from '../../services/audit-logger.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/audit-chain/verify:
 *   get:
 *     tags: [Admin]
 *     summary: Verify the audit_logs hash chain
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chain totals + list of any tamper-evidence breaks.
 */
router.get(
  '/audit-chain/verify',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const result = await verifyAuditChain();

    if (result.breaks.length > 0) {
      logger.error('[AuditChain] Integrity break detected', {
        category: 'SECURITY',
        metadata: {
          total: result.total,
          verified: result.verified,
          breakCount: result.breaks.length,
          firstBreakId: result.breaks[0]?.id,
          firstBreakKind: result.breaks[0]?.kind
        }
      });
    }

    sendSuccess(res, result);
  })
);

export default router;
