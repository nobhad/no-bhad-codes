/**
 * ===============================================
 * ADMIN — SQLITE BACKUPS
 * ===============================================
 * @file server/routes/admin/backups.ts
 *
 * GET  /api/admin/backups     — list backups on disk
 * POST /api/admin/backups/run — trigger a backup immediately (ad-hoc)
 *
 * Both admin-only. The trigger endpoint runs the same code the
 * scheduler runs at 3:30 AM — useful before a risky operation you
 * want a fresh snapshot for.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  authenticateToken,
  requireAdmin,
  AuthenticatedRequest
} from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { listBackups, runDailyBackup, getBackupDir } from '../../services/backup-service.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

router.get(
  '/backups',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const files = await listBackups();
    sendSuccess(res, {
      directory: getBackupDir(),
      count: files.length,
      backups: files
    });
  })
);

router.post(
  '/backups/run',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const result = await runDailyBackup();
    logger.info('[Admin] Manual backup triggered', {
      category: 'BACKUP',
      metadata: { ...result }
    });
    sendSuccess(
      res,
      {
        file: result.file,
        bytes: result.bytes,
        prunedCount: result.prunedCount,
        durationMs: result.durationMs
      },
      'Backup complete'
    );
  })
);

export default router;
