import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { queryStats } from '../../services/query-stats.js';
import { errorResponse } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

/**
 * GET /api/admin/bundle-stats
 * Get bundle size statistics from dist folder
 */
router.get(
  '/bundle-stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const fs = await import('fs');
    const path = await import('path');

    const distPath = path.join(process.cwd(), 'dist', 'assets');

    try {
      const files = fs.readdirSync(distPath);

      let totalJs = 0;
      let totalCss = 0;
      const jsFiles: { name: string; size: number }[] = [];
      const cssFiles: { name: string; size: number }[] = [];

      for (const file of files) {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);

        if (file.endsWith('.js')) {
          totalJs += stats.size;
          jsFiles.push({ name: file, size: stats.size });
        } else if (file.endsWith('.css')) {
          totalCss += stats.size;
          cssFiles.push({ name: file, size: stats.size });
        }
      }

      // Sort by size descending
      jsFiles.sort((a, b) => b.size - a.size);
      cssFiles.sort((a, b) => b.size - a.size);

      res.json({
        total: totalJs + totalCss,
        js: totalJs,
        css: totalCss,
        totalFormatted: formatBytes(totalJs + totalCss),
        jsFormatted: formatBytes(totalJs),
        cssFormatted: formatBytes(totalCss),
        jsFiles: jsFiles.slice(0, 10).map(f => ({ ...f, sizeFormatted: formatBytes(f.size) })),
        cssFiles: cssFiles.slice(0, 5).map(f => ({ ...f, sizeFormatted: formatBytes(f.size) }))
      });
    } catch (error) {
      logger.error('Error reading bundle stats:', { error: error instanceof Error ? error : undefined });
      errorResponse(res, 'Failed to read bundle stats', 500, 'INTERNAL_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/admin/query-stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get database query performance statistics
 *     description: Returns query execution times, slow query logs, and performance metrics
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Query statistics retrieved successfully
 */
router.get(
  '/query-stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const stats = queryStats.getStats();

    res.json({
      success: true,
      data: {
        ...stats,
        threshold: queryStats.getThreshold(),
        summary: {
          totalQueries: stats.totalQueries,
          slowQueries: stats.slowQueries,
          slowQueryPercentage: stats.totalQueries > 0
            ? `${((stats.slowQueries / stats.totalQueries) * 100).toFixed(2)}%`
            : '0%',
          avgExecutionTime: `${stats.avgExecutionTime}ms`,
          maxExecutionTime: `${stats.maxExecutionTime}ms`
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/admin/query-stats/reset:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Reset query statistics
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/query-stats/reset',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    queryStats.reset();

    res.json({
      success: true,
      message: 'Query statistics reset successfully'
    });
  })
);

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default router;
