/**
 * ===============================================
 * ADMIN ROUTES
 * ===============================================
 * @file server/routes/admin.ts
 *
 * Admin-only endpoints for system monitoring and management
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { cacheService } from '../services/cache-service.js';
import { emailService } from '../services/email-service.js';
import { errorTracker } from '../services/error-tracking.js';

const router = express.Router();

/**
 * @swagger
 * /api/admin/system-status:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get system status
 *     description: Get comprehensive system health status including cache, email, and database
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     cache:
 *                       type: object
 *                     email:
 *                       type: object
 *                     database:
 *                       type: object
 *       403:
 *         description: Admin access required
 */
router.get('/system-status', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const timestamp = new Date().toISOString();

    try {
      // Get cache statistics
      const cacheStats = await cacheService.getStats();
      const cacheConnected = await cacheService.testConnection();

      // Get email service status
      const emailStatus = emailService.getStatus();

      // Basic system info
      const systemStatus = {
        status: 'healthy',
        timestamp,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
          cache: {
            connected: cacheConnected,
            available: cacheService.isAvailable(),
            stats: cacheStats
          },
          email: {
            initialized: emailStatus.initialized,
            queueSize: emailStatus.queueSize,
            templatesLoaded: emailStatus.templatesLoaded,
            isProcessingQueue: emailStatus.isProcessingQueue
          },
          database: {
            connected: true, // We'll assume it's connected if we got this far
            type: 'sqlite'
          }
        }
      };

      res.json(systemStatus);
    } catch (error) {
      console.error('Error getting system status:', error);
      
      errorTracker.captureException(error as Error, {
        tags: { component: 'admin-status' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' }
      });

      res.status(500).json({
        status: 'error',
        timestamp,
        error: 'Failed to retrieve system status'
      });
    }
  })
);

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
router.get('/cache/stats', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!cacheService.isAvailable()) {
      return res.status(503).json({
        error: 'Cache service not available',
        code: 'CACHE_UNAVAILABLE'
      });
    }

    try {
      const stats = await cacheService.getStats();
      res.json({
        cache: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve cache statistics',
        code: 'CACHE_STATS_ERROR'
      });
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
router.post('/cache/clear', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (!cacheService.isAvailable()) {
      return res.status(503).json({
        error: 'Cache service not available',
        code: 'CACHE_UNAVAILABLE'
      });
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
        res.status(500).json({
          error: 'Failed to clear cache',
          code: 'CACHE_CLEAR_FAILED'
        });
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        code: 'CACHE_CLEAR_ERROR'
      });
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
router.post('/cache/invalidate', 
  authenticateToken, 
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { tag, pattern } = req.body;

    if (!tag && !pattern) {
      return res.status(400).json({
        error: 'Either tag or pattern is required',
        code: 'MISSING_PARAMETERS'
      });
    }

    if (!cacheService.isAvailable()) {
      return res.status(503).json({
        error: 'Cache service not available',
        code: 'CACHE_UNAVAILABLE'
      });
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
      res.status(500).json({
        error: 'Failed to invalidate cache',
        code: 'CACHE_INVALIDATE_ERROR'
      });
    }
  })
);

export { router as adminRouter };
export default router;