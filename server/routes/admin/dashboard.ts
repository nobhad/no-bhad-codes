import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { cacheService } from '../../services/cache-service.js';
import { emailService } from '../../services/email-service.js';
import { errorTracker } from '../../services/error-tracking.js';
import { auditLogger } from '../../services/audit-logger.js';
import { getDatabase } from '../../database/init.js';
import { projectService } from '../../services/project-service.js';
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
      const db = getDatabase();

      // Get new leads count (pending intake + new contact submissions)
      const leadsCount = await db.get(`
        SELECT
          (SELECT COUNT(*) FROM active_projects WHERE status = 'pending') +
          (SELECT COUNT(*) FROM contact_submissions WHERE status = 'new') as count
      `);

      // Get unread messages count (from all threads)
      // Note: Uses unified messages table with context_type after migration 085
      const messagesCount = await db.get(`
        SELECT COUNT(*) as count
        FROM active_messages
        WHERE context_type = 'general'
          AND read_at IS NULL
          AND sender_type != 'admin'
      `);

      sendSuccess(res, {
        leads: leadsCount?.count || 0,
        messages: messagesCount?.count || 0
      });
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
      const db = getDatabase();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Attention items
      const overdueInvoices = await db.get(`
        SELECT COUNT(*) as count FROM active_invoices
        WHERE due_date < date('now') AND status != 'paid'
      `);

      const pendingContracts = await db.get(`
        SELECT COUNT(*) as count FROM active_projects
        WHERE contract_signed_at IS NULL
        AND status NOT IN ('completed', 'cancelled')
      `);

      const newLeadsThisWeek = await db.get(`
        SELECT COUNT(*) as count FROM contact_submissions
        WHERE created_at >= datetime('now', '-7 days')
      `);

      const unreadMessages = await db.get(`
        SELECT COUNT(*) as count FROM active_messages
        WHERE read_at IS NULL AND sender_type != 'admin'
      `);

      // Snapshot metrics
      const activeProjects = await db.get(`
        SELECT COUNT(*) as count FROM active_projects
        WHERE status IN ('active', 'in-progress', 'in_progress')
      `);

      const totalClients = await db.get(`
        SELECT COUNT(*) as count FROM active_clients
      `);

      const revenueMTD = await db.get(`
        SELECT COALESCE(SUM(amount_paid), 0) as total FROM active_invoices
        WHERE strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now')
        AND status = 'paid'
      `);

      const leadsStats = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
        FROM contact_submissions
      `);

      // Recent activity (from client_activities table)
      const recentActivity = await db.all(`
        SELECT
          'activity' || id as id,
          activity_type as type,
          title as description,
          created_at as timestamp,
          'client' as entityType,
          COALESCE(client_id, '') as entityId
        FROM client_activities
        ORDER BY created_at DESC
        LIMIT 10
      `);

      // Active projects list
      const activeProjectsList = await db.all(`
        SELECT
          p.id,
          p.project_name as name,
          COALESCE(c.company_name, c.contact_name, '') as client,
          p.client_id,
          p.status,
          COALESCE(p.progress, 0) as progress,
          p.estimated_end_date as dueDate
        FROM active_projects p
        LEFT JOIN active_clients c ON p.client_id = c.id
        WHERE p.status IN ('active', 'in-progress', 'in_progress')
        ORDER BY p.estimated_end_date ASC NULLS LAST
        LIMIT 5
      `);

      // Upcoming tasks
      const upcomingTasks = await projectService.getAllTasks({
        status: 'pending,in_progress',
        limit: 10
      });

      const totalLeads = Number(leadsStats?.total) || 0;
      const convertedLeads = Number(leadsStats?.converted) || 0;
      const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

      sendSuccess(res, {
        attention: {
          overdueInvoices: overdueInvoices?.count || 0,
          pendingContracts: pendingContracts?.count || 0,
          newLeadsThisWeek: newLeadsThisWeek?.count || 0,
          unreadMessages: unreadMessages?.count || 0
        },
        snapshot: {
          activeProjects: activeProjects?.count || 0,
          totalClients: totalClients?.count || 0,
          revenueMTD: revenueMTD?.total || 0,
          conversionRate
        },
        recentActivity: recentActivity || [],
        activeProjects: activeProjectsList || [],
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
