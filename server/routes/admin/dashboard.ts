import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cacheService } from '../../services/cache-service.js';
import { emailService } from '../../services/email-service.js';
import { errorTracker } from '../../services/error-tracking.js';
import { auditLogger } from '../../services/audit-logger.js';
import { getDatabase } from '../../database/init.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';

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
router.get(
  '/system-status',
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

      errorResponseWithPayload(res, 'Failed to retrieve system status', 500, 'INTERNAL_ERROR', {
        status: 'error',
        timestamp
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/audit-log:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get audit log
 *     description: Export audit logs with optional filters and pagination
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action (e.g. create, update, delete, login)
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *         description: Filter by entity type (e.g. client, project, invoice)
 *       - in: query
 *         name: userEmail
 *         schema:
 *           type: string
 *         description: Filter by user email
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter (ISO 8601)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Max records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get(
  '/audit-log',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { action, entityType, userEmail, startDate, endDate, limit, offset } = req.query;
      const logs = await auditLogger.query({
        ...(action && { action: String(action) }),
        ...(entityType && { entityType: String(entityType) }),
        ...(userEmail && { userEmail: String(userEmail) }),
        ...(startDate && { startDate: String(startDate) }),
        ...(endDate && { endDate: String(endDate) }),
        limit: limit ? Math.min(parseInt(String(limit), 10) || 100, 500) : 100,
        offset: offset ? Math.max(0, parseInt(String(offset), 10) || 0) : 0
      });

      res.json({
        success: true,
        data: logs,
        count: logs.length
      });
    } catch (error) {
      console.error('Error fetching audit log:', error);
      errorTracker.captureException(error as Error, {
        tags: { component: 'admin-audit' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' }
      });
      errorResponse(res, 'Failed to retrieve audit log', 500, 'AUDIT_LOG_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/admin/sidebar-counts:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get sidebar notification counts
 *     description: Get counts for leads and unread messages for sidebar badges
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sidebar counts retrieved successfully
 */
router.get(
  '/sidebar-counts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    try {
      const db = getDatabase();

      // Get new leads count (pending intake + new contact submissions)
      const leadsCount = await db.get(`
        SELECT
          (SELECT COUNT(*) FROM projects WHERE status = 'pending') +
          (SELECT COUNT(*) FROM contact_submissions WHERE status = 'new') as count
      `);

      // Get unread messages count (from all threads)
      // Note: Uses unified messages table with context_type after migration 085
      const messagesCount = await db.get(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE context_type = 'general'
          AND read_at IS NULL
          AND sender_type != 'admin'
      `);

      res.json({
        success: true,
        leads: leadsCount?.count || 0,
        messages: messagesCount?.count || 0
      });
    } catch (error) {
      console.error('Error fetching sidebar counts:', error);
      errorResponse(res, 'Failed to fetch sidebar counts', 500, 'INTERNAL_ERROR');
    }
  })
);

/**
 * @swagger
 * /api/admin/tasks:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all tasks across all projects
 *     description: Returns tasks from all active projects, ordered by priority and due date
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, blocked, cancelled]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Max number of tasks to return
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get(
  '/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { status, priority, limit } = req.query;

      const tasks = await projectService.getAllTasks({
        status: status ? String(status) : undefined,
        priority: priority ? String(priority) : undefined,
        limit: limit ? Math.min(parseInt(String(limit), 10) || 100, 500) : 100
      });

      res.json({
        success: true,
        tasks,
        count: tasks.length
      });
    } catch (error) {
      console.error('Error fetching global tasks:', error);
      errorResponse(res, 'Failed to fetch tasks', 500, 'INTERNAL_ERROR');
    }
  })
);

export default router;
