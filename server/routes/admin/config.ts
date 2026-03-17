/**
 * ===============================================
 * ADMIN CONFIG ROUTES
 * ===============================================
 * @file server/routes/admin/config.ts
 *
 * Admin endpoints for managing tier-milestone and default-task
 * configuration via JSON import/export.
 */

import express, { Response } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// =====================================================
// TIER MILESTONE CONFIG
// =====================================================

/**
 * GET /api/admin/config/tier-milestones
 * Export the current tier-milestone configuration
 */
router.get(
  '/config/tier-milestones',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      // For runtime export, import the actual config
      const { TIER_MILESTONES } = await import('../../config/tier-milestones.js');
      sendSuccess(res, {
        config: TIER_MILESTONES,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[AdminConfig] Failed to export tier-milestones config:', {
        error: error instanceof Error ? error : undefined
      });
      return errorResponse(res, 'Failed to export tier milestones config', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * GET /api/admin/config/default-tasks
 * Export the current default-tasks.json
 */
router.get(
  '/config/default-tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const jsonPath = resolve(__dirname, '../../config/default-tasks.json');
      const data = JSON.parse(await readFile(jsonPath, 'utf-8'));
      sendSuccess(res, {
        config: data,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[AdminConfig] Failed to export default-tasks config:', {
        error: error instanceof Error ? error : undefined
      });
      return errorResponse(res, 'Failed to export default tasks config', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * POST /api/admin/config/default-tasks
 * Import/update default-tasks.json from JSON payload
 */
router.post(
  '/config/default-tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return errorResponse(res, 'config object is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate structure: should be Record<string, Record<string, Array>>
    for (const [projectType, milestones] of Object.entries(config)) {
      if (typeof milestones !== 'object' || milestones === null) {
        return errorResponse(
          res,
          `Invalid structure for project type "${projectType}"`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      for (const [milestoneTitle, tasks] of Object.entries(milestones as Record<string, unknown>)) {
        if (!Array.isArray(tasks)) {
          return errorResponse(
            res,
            `Tasks for "${projectType}.${milestoneTitle}" must be an array`,
            400,
            ErrorCodes.VALIDATION_ERROR
          );
        }
      }
    }

    try {
      const jsonPath = resolve(__dirname, '../../config/default-tasks.json');

      // Backup current file
      const backupPath = resolve(__dirname, `../../config/default-tasks.backup-${Date.now()}.json`);
      try {
        const currentData = await readFile(jsonPath, 'utf-8');
        await writeFile(backupPath, currentData);
      } catch {
        // No existing file to backup
      }

      // Write new config
      await writeFile(jsonPath, JSON.stringify(config, null, 2));

      logger.info('[AdminConfig] Updated default-tasks.json', {
        category: 'admin',
        metadata: { updatedBy: req.user?.email }
      });

      sendSuccess(res, { updated: true, backupPath }, 'Config file updated. Note: Server restart required for changes to take effect.');
    } catch (error) {
      logger.error('[AdminConfig] Failed to update default-tasks config:', {
        error: error instanceof Error ? error : undefined
      });
      return errorResponse(res, 'Failed to update default tasks config', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * GET /api/admin/config/tier-tasks
 * Export the current tier-tasks.json
 */
router.get(
  '/config/tier-tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const jsonPath = resolve(__dirname, '../../config/tier-tasks.json');
      const data = JSON.parse(await readFile(jsonPath, 'utf-8'));
      sendSuccess(res, {
        config: data,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[AdminConfig] Failed to export tier-tasks config:', {
        error: error instanceof Error ? error : undefined
      });
      return errorResponse(res, 'Failed to export tier tasks config', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * POST /api/admin/config/tier-tasks
 * Import/update tier-tasks.json from JSON payload
 */
router.post(
  '/config/tier-tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return errorResponse(res, 'config object is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate structure: Record<string, Record<string, Record<string, Array>>>
    for (const [projectType, tiers] of Object.entries(config)) {
      if (typeof tiers !== 'object' || tiers === null) {
        return errorResponse(
          res,
          `Invalid structure for project type "${projectType}"`,
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
      for (const [tier, milestones] of Object.entries(tiers as Record<string, unknown>)) {
        if (typeof milestones !== 'object' || milestones === null) {
          return errorResponse(
            res,
            `Invalid structure for "${projectType}.${tier}"`,
            400,
            ErrorCodes.VALIDATION_ERROR
          );
        }
        for (const [milestoneTitle, tasks] of Object.entries(milestones as Record<string, unknown>)) {
          if (!Array.isArray(tasks)) {
            return errorResponse(
              res,
              `Tasks for "${projectType}.${tier}.${milestoneTitle}" must be an array`,
              400,
              ErrorCodes.VALIDATION_ERROR
            );
          }
        }
      }
    }

    try {
      const jsonPath = resolve(__dirname, '../../config/tier-tasks.json');

      // Backup current file
      const backupPath = resolve(__dirname, `../../config/tier-tasks.backup-${Date.now()}.json`);
      try {
        const currentData = await readFile(jsonPath, 'utf-8');
        await writeFile(backupPath, currentData);
      } catch {
        // No existing file to backup
      }

      // Write new config
      await writeFile(jsonPath, JSON.stringify(config, null, 2));

      logger.info('[AdminConfig] Updated tier-tasks.json', {
        category: 'admin',
        metadata: { updatedBy: req.user?.email }
      });

      sendSuccess(res, { updated: true, backupPath }, 'Config file updated. Note: Server restart required for changes to take effect.');
    } catch (error) {
      logger.error('[AdminConfig] Failed to update tier-tasks config:', {
        error: error instanceof Error ? error : undefined
      });
      return errorResponse(res, 'Failed to update tier tasks config', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

export default router;
