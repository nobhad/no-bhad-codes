import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cacheService } from '../../services/cache-service.js';
import { errorTracker } from '../../services/error-tracking.js';
import { errorResponse } from '../../utils/api-response.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/cache/stats:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get cache statistics
 *     description: Get detailed Redis cache statistics and performance metrics
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/cache/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!cacheService.isAvailable()) {
      return errorResponse(res, 'Cache service not available', 503, 'CACHE_UNAVAILABLE');
    }

    try {
      const stats = await cacheService.getStats();
      res.json({
        cache: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      errorResponse(res, 'Failed to retrieve cache statistics', 500, 'CACHE_STATS_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/admin/cache/clear:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Clear cache
 *     description: Clear all cached data (use with caution)
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/cache/clear',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!cacheService.isAvailable()) {
      return errorResponse(res, 'Cache service not available', 503, 'CACHE_UNAVAILABLE');
    }

    try {
      const cleared = await cacheService.clear();

      if (cleared) {
        // Log the cache clear action
        errorTracker.captureMessage('Admin cleared cache', 'info', {
          tags: { component: 'admin-cache' },
          user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' }
        });

        res.json({
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString()
        });
      } else {
        errorResponse(res, 'Failed to clear cache', 500, 'CACHE_CLEAR_FAILED');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      errorResponse(res, 'Failed to clear cache', 500, 'CACHE_CLEAR_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/admin/cache/invalidate:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Invalidate cache by tag or pattern
 *     description: Invalidate specific cache entries by tag or pattern
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tag:
 *                 type: string
 *                 example: "clients"
 *               pattern:
 *                 type: string
 *                 example: "client:*"
 */
router.post(
  '/cache/invalidate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { tag, pattern } = req.body;

    if (!tag && !pattern) {
      return errorResponse(res, 'Either tag or pattern is required', 400, 'MISSING_PARAMETERS');
    }

    if (!cacheService.isAvailable()) {
      return errorResponse(res, 'Cache service not available', 503, 'CACHE_UNAVAILABLE');
    }

    try {
      let count = 0;

      if (tag) {
        count = await cacheService.invalidateByTag(tag);
      } else if (pattern) {
        count = await cacheService.invalidateByPattern(pattern);
      }

      // Log the cache invalidation action
      errorTracker.captureMessage('Admin invalidated cache', 'info', {
        tags: { component: 'admin-cache' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { tag, pattern, invalidatedCount: count }
      });

      res.json({
        message: `Invalidated ${count} cache entries`,
        count,
        tag,
        pattern,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error invalidating cache:', error);
      errorResponse(res, 'Failed to invalidate cache', 500, 'CACHE_INVALIDATE_ERROR');
    }
  })
);

export default router;
