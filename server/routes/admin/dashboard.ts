import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cacheService } from '../../services/cache-service.js';
import { emailService } from '../../services/email-service.js';
import { errorTracker } from '../../services/error-tracking.js';
import { auditLogger } from '../../services/audit-logger.js';
import { projectService } from '../../services/project-service.js';
import { dashboardService } from '../../services/dashboard-service.js';
import { errorResponse, errorResponseWithPayload, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';

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

      sendSuccess(res, systemStatus);
    } catch (error) {
      logger.error('Error getting system status:', {
        error: error instanceof Error ? error : undefined
      });

      errorTracker.captureException(error as Error, {
        tags: { component: 'admin-status' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' }
      });

      errorResponseWithPayload(res, 'Failed to retrieve system status', 500, ErrorCodes.INTERNAL_ERROR, {
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

      sendSuccess(res, {
        data: logs,
        count: logs.length
      });
    } catch (error) {
      logger.error('Error fetching audit log:', {
        error: error instanceof Error ? error : undefined
      });
      errorTracker.captureException(error as Error, {
        tags: { component: 'admin-audit' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' }
      });
      errorResponse(res, 'Failed to retrieve audit log', 500, ErrorCodes.AUDIT_LOG_ERROR);
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
      const counts = await dashboardService.getSidebarCounts();
      sendSuccess(res, counts);
    } catch (error) {
      logger.error('Error fetching sidebar counts:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to fetch sidebar counts', 500, ErrorCodes.INTERNAL_ERROR);
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

      // Calculate stats for the GlobalTasksTable
      const today = new Date().toISOString().split('T')[0];
      const stats = {
        total: tasks.length,
        pending: tasks.filter((t: { status: string }) => t.status === 'pending').length,
        inProgress: tasks.filter((t: { status: string }) => t.status === 'in_progress').length,
        completed: tasks.filter((t: { status: string }) => t.status === 'completed').length,
        overdue: tasks.filter((t: { status: string; dueDate?: string }) =>
          t.dueDate && t.dueDate < today && t.status !== 'completed'
        ).length
      };

      sendSuccess(res, {
        tasks,
        stats
      });
    } catch (error) {
      logger.error('Error fetching global tasks:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to fetch tasks', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get admin dashboard data
 *     description: Aggregated dashboard data including attention items, metrics, activity, and projects
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *       403:
 *         description: Admin access required
 */
router.get(
  '/dashboard',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    try {
      const dashboard = await dashboardService.getFullDashboard();

      // Upcoming tasks
      const upcomingTasks = await projectService.getAllTasks({
        status: 'pending,in_progress',
        limit: 10
      });

      sendSuccess(res, {
        ...dashboard,
        upcomingTasks: upcomingTasks.map((t) => ({
          id: String(t.id),
          title: t.title,
          projectName: t.projectName || 'Unknown Project',
          priority: t.priority || 'medium',
          status: t.status || 'pending',
          dueDate: t.dueDate
        }))
      });
    } catch (error) {
      logger.error('Error fetching dashboard data:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to fetch dashboard data', 500, ErrorCodes.INTERNAL_ERROR);
    }
  })
);

export default router;
