/**
 * ===============================================
 * ADMIN — SCHEMA DRIFT CHECK
 * ===============================================
 * @file server/routes/admin/schema-drift.ts
 *
 * GET /api/admin/schema-drift
 *
 * Runs the same check that guards startup, on demand. Returns the
 * drift report without mutating the stored baseline, so ops can poke
 * at production without accidentally rebaselining over real drift.
 *
 * The check is read-only: captures current sqlite_master state,
 * compares to the stored snapshot, returns added/removed/modified
 * objects. Use the ACCEPT_SCHEMA_DRIFT=true env var at boot to
 * accept drift as the new baseline.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';
import { detectSchemaDrift } from '../../database/schema-drift.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

router.get(
  '/schema-drift',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const report = await detectSchemaDrift(getDatabase());

    if (!report.ok) {
      logger.error('[SchemaDrift] Drift detected (admin check)', {
        category: 'SCHEMA_DRIFT',
        metadata: {
          added: report.added.length,
          removed: report.removed.length,
          modified: report.modified.length
        }
      });
    }

    sendSuccess(res, report);
  })
);

export default router;
