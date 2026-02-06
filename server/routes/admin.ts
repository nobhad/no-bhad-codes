/**
 * ===============================================
 * ADMIN ROUTES
 * ===============================================
 * @file server/routes/admin.ts
 *
 * Admin-only endpoints for system monitoring and management
 */

import express from 'express';
import crypto from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { cacheService } from '../services/cache-service.js';
import { emailService } from '../services/email-service.js';
import { errorTracker } from '../services/error-tracking.js';
import { queryStats } from '../services/query-stats.js';
import { getDatabase } from '../database/init.js';
import { getUploadsSubdir, getRelativePath, UPLOAD_DIRS } from '../config/uploads.js';
import { auditLogger } from '../services/audit-logger.js';
import { getSchedulerService } from '../services/scheduler-service.js';
import { softDeleteService, SoftDeleteEntityType } from '../services/soft-delete-service.js';

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
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit log',
        code: 'AUDIT_LOG_ERROR'
      });
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
      const messagesCount = await db.get(`
        SELECT COUNT(*) as count
        FROM general_messages
        WHERE is_read = 0 AND sender_type != 'admin'
      `);

      res.json({
        success: true,
        leads: leadsCount?.count || 0,
        messages: messagesCount?.count || 0
      });
    } catch (error) {
      console.error('Error fetching sidebar counts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sidebar counts'
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
router.get(
  '/cache/stats',
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
router.post(
  '/cache/clear',
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
router.post(
  '/cache/invalidate',
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

/**
 * POST /api/admin/test-email - Send a test email to admin
 */
router.post(
  '/test-email',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const adminEmail = process.env.ADMIN_EMAIL || req.user?.email;
    if (!adminEmail) {
      return res.status(400).json({
        error: 'Admin email not configured. Set ADMIN_EMAIL in environment.',
        code: 'ADMIN_EMAIL_NOT_CONFIGURED'
      });
    }

    const result = await emailService.sendEmail({
      to: adminEmail,
      subject: 'No Bhad Codes - Test Email',
      text: 'This is a test email from the admin dashboard. Email service is working correctly.',
      html: '<p>This is a test email from the admin dashboard.</p><p>Email service is working correctly.</p>'
    });

    if (!result.success) {
      return res.status(500).json({
        error: result.message || 'Failed to send test email',
        code: 'TEST_EMAIL_FAILED'
      });
    }

    res.json({
      message: 'Test email sent successfully',
      to: adminEmail
    });
  })
);

/**
 * POST /api/admin/run-scheduler - Manually trigger scheduler jobs (reminders + invoice generation)
 */
router.post(
  '/run-scheduler',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const scheduler = getSchedulerService();

    const overdueCount = await scheduler.checkOverdueInvoices();
    const remindersSent = await scheduler.triggerReminderProcessing();
    const { scheduled, recurring } = await scheduler.triggerInvoiceGeneration();

    res.json({
      message: 'Scheduler run completed',
      reminders: remindersSent,
      scheduledInvoices: scheduled,
      recurringInvoices: recurring,
      overdueMarked: overdueCount
    });
  })
);

/**
 * @swagger
 * /api/admin/leads:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all intake form submissions (leads)
 *     description: Retrieve all projects with associated client information
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Leads retrieved successfully
 */
router.get(
  '/leads',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const db = getDatabase();

      // Get all projects with client info
      const leads = await db.all(`
        SELECT
          p.id,
          p.client_id,
          p.project_name,
          p.description,
          p.status,
          p.project_type,
          p.budget_range,
          p.timeline,
          p.created_at,
          p.start_date,
          p.estimated_end_date as end_date,
          p.price,
          p.preview_url,
          p.notes,
          p.repository_url as repo_url,
          p.production_url,
          p.deposit_amount,
          p.contract_signed_at as contract_signed_date,
          p.progress,
          c.contact_name,
          c.company_name,
          c.email,
          c.phone
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        ORDER BY p.created_at DESC
      `);

      // Get stats - using simplified lead statuses
      const stats = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
          SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
        FROM projects
      `);

      res.json({
        success: true,
        leads,
        stats: {
          total: stats?.total || 0,
          new: stats?.new || 0,
          inProgress: stats?.inProgress || 0,
          converted: stats?.converted || 0
        }
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch leads'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/contact-submissions:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Get all contact form submissions
 *     description: Retrieve all contact form submissions with optional filtering
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Contact submissions retrieved successfully
 */
router.get(
  '/contact-submissions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const db = getDatabase();

      // Get all contact submissions
      const submissions = await db.all(`
        SELECT
          id,
          name,
          email,
          subject,
          message,
          status,
          message_id,
          created_at,
          read_at,
          replied_at
        FROM contact_submissions
        ORDER BY created_at DESC
      `);

      // Get stats
      const stats = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
          SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
          SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
        FROM contact_submissions
      `);

      res.json({
        success: true,
        submissions,
        stats: {
          total: stats?.total || 0,
          new: stats?.new || 0,
          read: stats?.read || 0,
          replied: stats?.replied || 0,
          archived: stats?.archived || 0
        }
      });
    } catch (error) {
      console.error('Error fetching contact submissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch contact submissions'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/contact-submissions/{id}/status:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update contact submission status
 *     description: Mark a contact submission as read, replied, or archived
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/contact-submissions/:id/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['new', 'read', 'replied', 'archived'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status value'
        });
      }

      const db = getDatabase();

      let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
      const values: (string | number)[] = [status];

      if (status === 'read') {
        updateFields += ', read_at = CURRENT_TIMESTAMP';
      } else if (status === 'replied') {
        updateFields += ', replied_at = CURRENT_TIMESTAMP';
      }

      values.push(id);

      await db.run(`UPDATE contact_submissions SET ${updateFields} WHERE id = ?`, values);

      res.json({
        success: true,
        message: 'Status updated successfully'
      });
    } catch (error) {
      console.error('Error updating contact submission status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update status'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/contact-submissions/{id}/convert-to-client:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Convert contact submission to client
 *     description: Creates a new client from a contact submission and optionally sends invitation
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/contact-submissions/:id/convert-to-client',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { sendInvitation = false } = req.body;

      const db = getDatabase();

      // Get the contact submission
      const contact = await db.get(
        'SELECT * FROM contact_submissions WHERE id = ?',
        [id]
      );

      if (!contact) {
        return res.status(404).json({
          success: false,
          error: 'Contact submission not found'
        });
      }

      // Check if already converted
      if (contact.client_id) {
        return res.status(400).json({
          success: false,
          error: 'This contact has already been converted to a client'
        });
      }

      // Check if client with this email already exists
      const existingClient = await db.get(
        'SELECT id, contact_name, email FROM clients WHERE LOWER(email) = LOWER(?)',
        [contact.email as string]
      ) as { id: number; contact_name: string; email: string } | undefined;

      let clientId: number;

      if (existingClient) {
        // Link to existing client
        clientId = existingClient.id as number;
      } else {
        // Create new client with pending status
        const invitationToken = sendInvitation ? crypto.randomUUID() : null;
        const expiresAt = sendInvitation
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const result = await db.run(
          `INSERT INTO clients (
            email, password_hash, contact_name, company_name, phone,
            status, client_type, invitation_token, invitation_expires_at,
            invitation_sent_at, created_at, updated_at
          ) VALUES (
            LOWER(?), '', ?, ?, ?, 'pending', 'business', ?, ?,
            ${sendInvitation ? 'CURRENT_TIMESTAMP' : 'NULL'},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            contact.email as string,
            contact.name as string,
            null, // company_name - not available from contact form
            null, // phone - not available from contact form
            invitationToken,
            expiresAt
          ]
        );

        clientId = result.lastID!;

        // Send invitation email if requested
        if (sendInvitation && invitationToken) {
          const baseUrl = process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:4000';
          const inviteLink = `${baseUrl}/client/set-password.html?token=${invitationToken}`;

          try {
            await emailService.sendEmail({
              to: contact.email as string,
              subject: 'Welcome to No Bhad Codes - Set Up Your Client Portal',
              html: `
                <h2>Welcome, ${contact.name}!</h2>
                <p>You've been invited to set up your client portal account.</p>
                <p>Click the link below to create your password and access your portal:</p>
                <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #e07a5f; color: white; text-decoration: none; border-radius: 4px;">Set Up Your Account</a></p>
                <p>This link will expire in 7 days.</p>
                <p>If you didn't expect this email, please ignore it.</p>
              `,
              text: `Welcome, ${contact.name}!\n\nYou've been invited to set up your client portal account.\n\nVisit this link to create your password: ${inviteLink}\n\nThis link will expire in 7 days.`
            });
          } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
            // Don't fail the conversion if email fails
          }
        }
      }

      // Update contact submission with client_id and converted_at
      await db.run(
        `UPDATE contact_submissions
         SET client_id = ?, converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [clientId, id]
      );

      res.json({
        success: true,
        message: existingClient
          ? 'Contact linked to existing client'
          : 'Contact converted to client successfully',
        clientId,
        isExisting: !!existingClient,
        invitationSent: sendInvitation && !existingClient
      });
    } catch (error) {
      console.error('Error converting contact to client:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to convert contact to client'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/status:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update lead/project status
 *     description: Update the status of an intake submission (project)
 *     security:
 *       - BearerAuth: []
 */
router.put(
  '/leads/:id/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const { status: rawStatus, cancelled_by, cancellation_reason } = req.body;

      // Normalize: trim, lowercase, accept legacy/label forms (spaces, underscores)
      let normalized =
        typeof rawStatus === 'string'
          ? rawStatus.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
          : '';
      if (normalized === 'in-progress' || normalized === 'inprogress') normalized = 'in-progress';
      if (normalized === 'on-hold' || normalized === 'onhold') normalized = 'on-hold';
      const status = normalized;

      // Lead pipeline statuses (must match frontend LEAD_STATUS_OPTIONS and GET /leads stats)
      const validStatuses = ['new', 'contacted', 'qualified', 'in-progress', 'converted', 'lost', 'on-hold', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: status
            ? `Invalid status "${status}". Must be one of: ${validStatuses.join(', ')}`
            : 'Missing or invalid status in request body'
        });
      }

      // Validate cancelled_by when status is 'cancelled'
      if (status === 'cancelled') {
        const validCancelledBy = ['admin', 'client'];
        if (!cancelled_by || !validCancelledBy.includes(cancelled_by)) {
          return res.status(400).json({
            success: false,
            error: 'When cancelling, must specify cancelled_by as "admin" or "client"'
          });
        }
      }

      const db = getDatabase();

      // Check if project exists
      const project = await db.get('SELECT id, status FROM projects WHERE id = ?', [id]);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      // Update status and cancellation fields (clear them if not cancelling)
      if (status === 'cancelled') {
        await db.run(
          'UPDATE projects SET status = ?, cancelled_by = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, cancelled_by, cancellation_reason || null, id]
        );
      } else {
        await db.run(
          'UPDATE projects SET status = ?, cancelled_by = NULL, cancellation_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, id]
        );
      }

      res.json({
        success: true,
        message: 'Lead status updated successfully',
        previousStatus: project.status,
        newStatus: status,
        cancelledBy: status === 'cancelled' ? cancelled_by : null,
        cancellationReason: status === 'cancelled' ? cancellation_reason : null
      });
    } catch (error) {
      console.error('Error updating lead status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update lead status'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/invite:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Invite a lead to the client portal
 *     description: Creates a client account and sends invitation email with magic link
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/leads/:id/invite',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const db = getDatabase();

      // Get the lead/project
      const lead = await db.get(
        `
        SELECT
          p.id,
          p.project_name,
          p.description,
          p.project_type,
          p.budget_range,
          p.timeline,
          p.features,
          p.client_id,
          c.email,
          c.contact_name,
          c.company_name,
          c.phone
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.id = ?
      `,
        [id]
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
      }

      const leadEmail = typeof lead.email === 'string' ? lead.email : null;
      const leadContactName = typeof lead.contact_name === 'string' ? lead.contact_name : null;
      const leadCompanyName = typeof lead.company_name === 'string' ? lead.company_name : null;
      const leadPhone = typeof lead.phone === 'string' ? lead.phone : null;

      if (!leadEmail) {
        return res.status(400).json({
          success: false,
          error: 'Lead does not have an email address'
        });
      }

      // Check if client already exists
      let clientId = typeof lead.client_id === 'number' ? lead.client_id : null;
      const existingClient = await db.get(
        'SELECT id, invitation_token FROM clients WHERE email = ?',
        [leadEmail]
      );

      // Generate invitation token (valid for 7 days)
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (existingClient) {
        // Update existing client with new invitation token
        const existingClientId = typeof existingClient.id === 'number' ? existingClient.id : null;
        if (existingClientId) {
          clientId = existingClientId;
          await db.run(
            `
            UPDATE clients
            SET invitation_token = ?, invitation_expires_at = ?, invitation_sent_at = CURRENT_TIMESTAMP, status = 'pending'
            WHERE id = ?
          `,
            [invitationToken, expiresAt, clientId]
          );
        }
      } else {
        // Create new client with pending status (no password yet)
        const result = await db.run(
          `
          INSERT INTO clients (email, password_hash, contact_name, company_name, phone, status, invitation_token, invitation_expires_at, invitation_sent_at)
          VALUES (?, '', ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)
        `,
          [leadEmail, leadContactName, leadCompanyName, leadPhone, invitationToken, expiresAt]
        );
        clientId = result.lastID || null;

        // Update project to link to new client
        if (clientId && typeof id === 'string') {
          await db.run('UPDATE projects SET client_id = ? WHERE id = ?', [clientId, id]);
        }
      }

      // Update lead status to converted (lead is now a project)
      if (typeof id === 'string') {
        await db.run('UPDATE projects SET status = ? WHERE id = ?', ['converted', id]);
      }

      // Build invitation link
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const invitationLink = `${baseUrl}/client/set-password.html?token=${invitationToken}`;

      // Send invitation email
      const emailResult = await emailService.sendEmail({
        to: leadEmail,
        subject: 'Welcome to No Bhad Codes - Set Up Your Client Portal',
        text: `
Hello ${leadContactName || 'there'},

You've been invited to access the No Bhad Codes client portal for your project.

Click the link below to set your password and access your dashboard:
${invitationLink}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
No Bhad Codes Team
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .button { display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to No Bhad Codes</h1>
    </div>
    <p>Hello ${leadContactName || 'there'},</p>
    <p>You've been invited to access the No Bhad Codes client portal for your project.</p>
    <p>Click the button below to set your password and access your dashboard:</p>
    <p style="text-align: center;">
      <a href="${invitationLink}" class="button">Set Up Your Account</a>
    </p>
    <p>Or copy and paste this link:</p>
    <p style="word-break: break-all; color: #666;">${invitationLink}</p>
    <p><strong>This link will expire in 7 days.</strong></p>
    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>No Bhad Codes Team</p>
    </div>
  </div>
</body>
</html>
        `
      });

      // Log the invitation
      errorTracker.captureMessage('Admin sent client invitation', 'info', {
        tags: { component: 'admin-invite' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { leadId: id, clientEmail: leadEmail }
      });

      res.json({
        success: true,
        message: 'Invitation sent successfully',
        clientId,
        email: leadEmail,
        emailResult
      });
    } catch (error) {
      console.error('Error inviting lead:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send invitation'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/activate:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Activate a lead as a project
 *     description: Converts a pending lead to an active project without sending invitation
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/leads/:id/activate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const { id } = req.params;
      const db = getDatabase();

      // Get the lead/project
      const lead = await db.get('SELECT id, status, project_name FROM projects WHERE id = ?', [id]);

      if (!lead) {
        return res.status(404).json({
          success: false,
          error: 'Lead not found'
        });
      }

      if (lead.status === 'converted') {
        return res.status(400).json({
          success: false,
          error: 'Lead is already converted'
        });
      }

      // Update lead status to converted and set start_date
      await db.run('UPDATE projects SET status = ?, start_date = date(\'now\'), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'converted',
        id
      ]);

      // Log the activation
      errorTracker.captureMessage('Admin activated lead as project', 'info', {
        tags: { component: 'admin-leads' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { leadId: id, projectName: lead.project_name }
      });

      res.json({
        success: true,
        message: 'Lead activated as project successfully',
        projectId: id
      });
    } catch (error) {
      console.error('Error activating lead:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to activate lead'
      });
    }
  })
);

/**
 * @swagger
 * /api/admin/projects:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create a new project manually
 *     description: Admin can create a project for an existing or new client, saves project details as JSON file
 *     security:
 *       - BearerAuth: []
 */
router.post(
  '/projects',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { newClient, clientId, projectType, description, budget, timeline, notes } = req.body;

    // Validate required project fields
    if (!projectType || !description || !budget || !timeline) {
      return res.status(400).json({
        error: 'Project type, description, budget, and timeline are required'
      });
    }

    // Validate client - must have either newClient or clientId
    if (!newClient && !clientId) {
      return res.status(400).json({
        error: 'Either newClient data or clientId is required'
      });
    }

    const db = getDatabase();
    let finalClientId: number;
    let clientData: { contact_name: string; company_name: string | null; email: string };

    try {
      // Create or validate client
      if (newClient) {
        // Validate new client fields
        if (!newClient.name || !newClient.email) {
          return res.status(400).json({
            error: 'Client name and email are required'
          });
        }

        // Check for existing client with same email
        const existing = await db.get(
          'SELECT id FROM clients WHERE LOWER(email) = LOWER(?)',
          [newClient.email]
        );
        if (existing) {
          return res.status(409).json({
            error: 'Client with this email already exists'
          });
        }

        // Create client
        const result = await db.run(
          `INSERT INTO clients (company_name, contact_name, email, phone, password_hash, status, client_type, created_at, updated_at)
           VALUES (?, ?, LOWER(?), ?, '', 'pending', 'business', datetime('now'), datetime('now'))`,
          [newClient.company || null, newClient.name, newClient.email, newClient.phone || null]
        );
        finalClientId = result.lastID!;

        clientData = {
          contact_name: newClient.name,
          company_name: newClient.company || null,
          email: newClient.email.toLowerCase()
        };

        console.log(`[AdminProjects] Created new client: ${finalClientId}`);
      } else {
        // Validate existing client
        const client = await db.get(
          'SELECT id, contact_name, company_name, email FROM clients WHERE id = ?',
          [clientId]
        );
        if (!client) {
          return res.status(404).json({
            error: 'Client not found'
          });
        }
        finalClientId = clientId;
        clientData = {
          contact_name: (client as { contact_name: string }).contact_name || '',
          company_name: (client as { company_name: string | null }).company_name,
          email: (client as { email: string }).email
        };
      }

      // Generate project name
      const projectName = generateAdminProjectName(projectType, clientData);

      // Create project
      const projectResult = await db.run(
        `INSERT INTO projects (
          client_id, project_name, description, status, project_type,
          budget_range, timeline, additional_info, created_at, updated_at
        ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [finalClientId, projectName, description, projectType, budget, timeline, notes || null]
      );
      const projectId = projectResult.lastID!;

      console.log(`[AdminProjects] Created project: ${projectId} - ${projectName}`);

      // Save project data as JSON file (like intake form)
      try {
        await saveAdminProjectAsFile({
          clientName: clientData.contact_name,
          clientEmail: clientData.email,
          companyName: clientData.company_name,
          projectType,
          description,
          budget,
          timeline,
          notes: notes || null
        }, projectId, projectName);
      } catch (fileError) {
        console.error('[AdminProjects] Failed to save project file:', fileError);
        // Non-critical error - don't fail the whole request
      }

      // Create initial project update
      await db.run(
        `INSERT INTO project_updates (
          project_id, title, description, update_type, author, created_at
        ) VALUES (?, ?, ?, 'general', 'admin', datetime('now'))`,
        [
          projectId,
          'Project Created',
          'Project was manually created by admin.'
        ]
      );

      // Log the action
      errorTracker.captureMessage('Admin created project manually', 'info', {
        tags: { component: 'admin-projects' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { projectId, projectName, clientId: finalClientId }
      });

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        projectId,
        projectName,
        clientId: finalClientId
      });
    } catch (error) {
      console.error('[AdminProjects] Error creating project:', error);
      res.status(500).json({
        error: 'Failed to create project'
      });
    }
  })
);

/**
 * Generate project name for admin-created projects
 */
function generateAdminProjectName(
  projectType: string,
  clientData: { contact_name: string; company_name: string | null }
): string {
  const typeNames: Record<string, string> = {
    'simple-site': 'Simple Site',
    'business-site': 'Business Site',
    portfolio: 'Portfolio Site',
    'e-commerce': 'E-commerce Store',
    ecommerce: 'E-commerce Store', // Legacy support
    'web-app': 'Web App',
    'browser-extension': 'Browser Extension',
    other: 'Custom Project'
  };

  const typeName = typeNames[projectType] || 'Web Project';
  const identifier = clientData.company_name || clientData.contact_name || 'Client';

  return `${identifier} ${typeName}`;
}

/**
 * Save admin-created project as JSON file
 */
interface AdminProjectData {
  clientName: string;
  clientEmail: string;
  companyName: string | null;
  projectType: string;
  description: string;
  budget: string;
  timeline: string;
  notes: string | null;
}

async function saveAdminProjectAsFile(
  data: AdminProjectData,
  projectId: number,
  projectName: string
): Promise<void> {
  const db = getDatabase();
  const uploadsDir = getUploadsSubdir(UPLOAD_DIRS.INTAKE);

  const document = {
    submittedAt: new Date().toISOString(),
    projectId,
    projectName,
    createdBy: 'admin',
    clientInfo: {
      name: data.clientName,
      email: data.clientEmail,
      companyName: data.companyName
    },
    projectDetails: {
      type: data.projectType,
      description: data.description,
      timeline: data.timeline,
      budget: data.budget
    },
    additionalInfo: data.notes
  };

  // Generate descriptive filename with NoBhadCodes branding
  // Use company name if available, otherwise client name
  const clientOrCompany = data.companyName || data.clientName;
  const safeClientName = clientOrCompany
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `nobhadcodes_intake_${safeClientName}_${dateStr}.json`;
  const filePath = join(uploadsDir, filename);
  const relativePath = getRelativePath(UPLOAD_DIRS.INTAKE, filename);

  writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');
  const fileSize = Buffer.byteLength(JSON.stringify(document, null, 2), 'utf-8');

  await db.run(
    `INSERT INTO files (
      project_id, filename, original_filename, file_path,
      file_size, mime_type, file_type, description, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      projectId,
      filename,
      filename, // Use descriptive filename for downloads
      relativePath,
      fileSize,
      'application/json',
      'document',
      'Project intake form',
      'admin'
    ]
  );

  console.log(`[AdminProjects] Saved project file: ${relativePath}`);
}

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
      console.error('Error reading bundle stats:', error);
      res.status(500).json({ error: 'Failed to read bundle stats' });
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

// =====================================================
// LEAD MANAGEMENT ENHANCEMENT ENDPOINTS
// =====================================================

import { leadService } from '../services/lead-service.js';

// =====================================================
// LEAD SCORING
// =====================================================

/**
 * GET /api/admin/leads/scoring-rules - Get all scoring rules
 */
router.get(
  '/leads/scoring-rules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const rules = await leadService.getScoringRules(includeInactive);
    res.json({ success: true, rules });
  })
);

/**
 * POST /api/admin/leads/scoring-rules - Create scoring rule
 */
router.post(
  '/leads/scoring-rules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, fieldName, operator, thresholdValue, points, isActive } = req.body;

    if (!name || !fieldName || !operator || thresholdValue === undefined || points === undefined) {
      return res.status(400).json({
        error: 'Name, fieldName, operator, thresholdValue, and points are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const rule = await leadService.createScoringRule({
      name,
      description,
      fieldName,
      operator,
      thresholdValue,
      points,
      isActive
    });

    res.status(201).json({ success: true, rule });
  })
);

/**
 * PUT /api/admin/leads/scoring-rules/:id - Update scoring rule
 */
router.put(
  '/leads/scoring-rules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const ruleId = parseInt(req.params.id);
    const rule = await leadService.updateScoringRule(ruleId, req.body);
    res.json({ success: true, rule });
  })
);

/**
 * DELETE /api/admin/leads/scoring-rules/:id - Delete scoring rule
 */
router.delete(
  '/leads/scoring-rules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const ruleId = parseInt(req.params.id);
    await leadService.deleteScoringRule(ruleId);
    res.json({ success: true, message: 'Scoring rule deleted' });
  })
);

/**
 * POST /api/admin/leads/:id/calculate-score - Calculate score for a lead
 */
router.post(
  '/leads/:id/calculate-score',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const result = await leadService.calculateLeadScore(projectId);
    res.json({ success: true, ...result });
  })
);

/**
 * POST /api/admin/leads/recalculate-all - Recalculate all lead scores
 */
router.post(
  '/leads/recalculate-all',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const count = await leadService.updateAllLeadScores();
    res.json({ success: true, message: `Recalculated scores for ${count} leads` });
  })
);

// =====================================================
// PIPELINE MANAGEMENT
// =====================================================

/**
 * GET /api/admin/leads/pipeline/stages - Get pipeline stages
 */
router.get(
  '/leads/pipeline/stages',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const stages = await leadService.getPipelineStages();
    res.json({ success: true, stages });
  })
);

/**
 * GET /api/admin/leads/pipeline - Get pipeline view (kanban)
 */
router.get(
  '/leads/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const pipeline = await leadService.getPipelineView();
    res.json({ success: true, ...pipeline });
  })
);

/**
 * GET /api/admin/leads/pipeline/stats - Get pipeline statistics
 */
router.get(
  '/leads/pipeline/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const stats = await leadService.getPipelineStats();
    res.json({ success: true, stats });
  })
);

/**
 * POST /api/admin/leads/:id/move-stage - Move lead to stage
 */
router.post(
  '/leads/:id/move-stage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { stageId } = req.body;

    if (!stageId) {
      return res.status(400).json({
        error: 'stageId is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    await leadService.moveToStage(projectId, stageId);
    res.json({ success: true, message: 'Lead moved to stage' });
  })
);

// =====================================================
// TASK MANAGEMENT
// =====================================================

/**
 * GET /api/admin/leads/:id/tasks - Get tasks for a lead
 */
router.get(
  '/leads/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const tasks = await leadService.getTasks(projectId);
    res.json({ success: true, tasks });
  })
);

/**
 * POST /api/admin/leads/:id/tasks - Create task for a lead
 */
router.post(
  '/leads/:id/tasks',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { title, description, taskType, dueDate, dueTime, assignedTo, priority, reminderAt } = req.body;

    if (!title) {
      return res.status(400).json({
        error: 'Title is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const task = await leadService.createTask(projectId, {
      title,
      description,
      taskType,
      dueDate,
      dueTime,
      assignedTo,
      priority,
      reminderAt
    });

    res.status(201).json({ success: true, task });
  })
);

/**
 * PUT /api/admin/leads/tasks/:taskId - Update a task
 */
router.put(
  '/leads/tasks/:taskId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await leadService.updateTask(taskId, req.body);
    res.json({ success: true, task });
  })
);

/**
 * POST /api/admin/leads/tasks/:taskId/complete - Complete a task
 */
router.post(
  '/leads/tasks/:taskId/complete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const taskId = parseInt(req.params.taskId);
    const task = await leadService.completeTask(taskId, req.user?.email);
    res.json({ success: true, task });
  })
);

/**
 * GET /api/admin/leads/tasks/overdue - Get overdue tasks
 */
router.get(
  '/leads/tasks/overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tasks = await leadService.getOverdueTasks();
    res.json({ success: true, tasks });
  })
);

/**
 * GET /api/admin/leads/tasks/upcoming - Get upcoming tasks
 */
router.get(
  '/leads/tasks/upcoming',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const tasks = await leadService.getUpcomingTasks(days);
    res.json({ success: true, tasks });
  })
);

// =====================================================
// NOTES
// =====================================================

/**
 * GET /api/admin/leads/:id/notes - Get notes for a lead
 */
router.get(
  '/leads/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const notes = await leadService.getNotes(projectId);
    res.json({ success: true, notes });
  })
);

/**
 * POST /api/admin/leads/:id/notes - Add note to a lead
 */
router.post(
  '/leads/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const note = await leadService.addNote(projectId, req.user?.email || 'admin', content);
    res.status(201).json({ success: true, note });
  })
);

/**
 * POST /api/admin/leads/notes/:noteId/toggle-pin - Pin/unpin a note
 */
router.post(
  '/leads/notes/:noteId/toggle-pin',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId);
    const note = await leadService.togglePinNote(noteId);
    res.json({ success: true, note });
  })
);

/**
 * DELETE /api/admin/leads/notes/:noteId - Delete a note
 */
router.delete(
  '/leads/notes/:noteId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId);
    await leadService.deleteNote(noteId);
    res.json({ success: true, message: 'Note deleted' });
  })
);

// =====================================================
// LEAD SOURCES
// =====================================================

/**
 * GET /api/admin/leads/sources - Get lead sources
 */
router.get(
  '/leads/sources',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const sources = await leadService.getLeadSources(includeInactive);
    res.json({ success: true, sources });
  })
);

/**
 * POST /api/admin/leads/:id/source - Set lead source
 */
router.post(
  '/leads/:id/source',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { sourceId } = req.body;

    if (!sourceId) {
      return res.status(400).json({
        error: 'sourceId is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    await leadService.setLeadSource(projectId, sourceId);
    res.json({ success: true, message: 'Lead source updated' });
  })
);

// =====================================================
// ASSIGNMENT
// =====================================================

/**
 * POST /api/admin/leads/:id/assign - Assign a lead
 */
router.post(
  '/leads/:id/assign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const { assignee } = req.body;

    if (!assignee) {
      return res.status(400).json({
        error: 'assignee is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    await leadService.assignLead(projectId, assignee);
    res.json({ success: true, message: 'Lead assigned' });
  })
);

/**
 * GET /api/admin/leads/my-leads - Get leads assigned to current user
 */
router.get(
  '/leads/my-leads',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const leads = await leadService.getMyLeads(req.user?.email || '');
    res.json({ success: true, leads });
  })
);

/**
 * GET /api/admin/leads/unassigned - Get unassigned leads
 */
router.get(
  '/leads/unassigned',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const leads = await leadService.getUnassignedLeads();
    res.json({ success: true, leads });
  })
);

// =====================================================
// DUPLICATE DETECTION
// =====================================================

/**
 * GET /api/admin/leads/:id/duplicates - Find duplicates for a lead
 */
router.get(
  '/leads/:id/duplicates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id);
    const duplicates = await leadService.findDuplicates(projectId);
    res.json({ success: true, duplicates });
  })
);

/**
 * GET /api/admin/leads/duplicates - Get all pending duplicates
 */
router.get(
  '/leads/duplicates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const duplicates = await leadService.getAllPendingDuplicates();
    res.json({ success: true, duplicates });
  })
);

/**
 * POST /api/admin/leads/duplicates/:id/resolve - Resolve duplicate
 */
router.post(
  '/leads/duplicates/:id/resolve',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const duplicateId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status || !['merged', 'not_duplicate', 'dismissed'].includes(status)) {
      return res.status(400).json({
        error: 'Valid status is required (merged, not_duplicate, dismissed)',
        code: 'INVALID_STATUS'
      });
    }

    await leadService.resolveDuplicate(duplicateId, status, req.user?.email || 'admin');
    res.json({ success: true, message: 'Duplicate resolved' });
  })
);

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * POST /api/admin/leads/bulk/status - Bulk update status
 */
router.post(
  '/leads/bulk/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, status } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !status) {
      return res.status(400).json({
        error: 'projectIds array and status are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const count = await leadService.bulkUpdateStatus(projectIds, status);
    res.json({ success: true, message: `Updated ${count} leads` });
  })
);

/**
 * POST /api/admin/leads/bulk/assign - Bulk assign
 */
router.post(
  '/leads/bulk/assign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, assignee } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !assignee) {
      return res.status(400).json({
        error: 'projectIds array and assignee are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const count = await leadService.bulkAssign(projectIds, assignee);
    res.json({ success: true, message: `Assigned ${count} leads` });
  })
);

/**
 * POST /api/admin/leads/bulk/move-stage - Bulk move to stage
 */
router.post(
  '/leads/bulk/move-stage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, stageId } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !stageId) {
      return res.status(400).json({
        error: 'projectIds array and stageId are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const count = await leadService.bulkMoveToStage(projectIds, stageId);
    res.json({ success: true, message: `Moved ${count} leads` });
  })
);

// =====================================================
// ANALYTICS
// =====================================================

/**
 * GET /api/admin/leads/analytics - Get lead analytics
 */
router.get(
  '/leads/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const analytics = await leadService.getLeadAnalytics();
    res.json({ success: true, analytics });
  })
);

/**
 * GET /api/admin/leads/conversion-funnel - Get conversion funnel
 */
router.get(
  '/leads/conversion-funnel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const funnel = await leadService.getConversionFunnel();
    res.json({ success: true, funnel });
  })
);

/**
 * GET /api/admin/leads/source-performance - Get source performance
 */
router.get(
  '/leads/source-performance',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const sources = await leadService.getSourcePerformance();
    res.json({ success: true, sources });
  })
);

// ============================================
// DELETED ITEMS MANAGEMENT (30-DAY RECOVERY)
// ============================================

/**
 * GET /api/admin/deleted-items - List all deleted items
 * Optional query param: ?type=client|project|invoice|lead|proposal
 */
router.get(
  '/deleted-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.query.type as SoftDeleteEntityType | undefined;

    // Validate type if provided
    if (entityType && !['client', 'project', 'invoice', 'lead', 'proposal'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity type',
        code: 'INVALID_TYPE'
      });
    }

    const items = await softDeleteService.getDeletedItems(entityType);
    res.json({ success: true, items });
  })
);

/**
 * GET /api/admin/deleted-items/stats - Get counts of deleted items by type
 */
router.get(
  '/deleted-items/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const stats = await softDeleteService.getDeletedItemStats();
    res.json({ success: true, stats });
  })
);

/**
 * POST /api/admin/deleted-items/:type/:id/restore - Restore a deleted item
 */
router.post(
  '/deleted-items/:type/:id/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.params.type as SoftDeleteEntityType;
    const entityId = parseInt(req.params.id);

    // Validate type
    if (!['client', 'project', 'invoice', 'lead', 'proposal'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity type',
        code: 'INVALID_TYPE'
      });
    }

    if (isNaN(entityId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity ID',
        code: 'INVALID_ID'
      });
    }

    const result = await softDeleteService.restore(entityType, entityId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  })
);

/**
 * DELETE /api/admin/deleted-items/:type/:id/permanent - Permanently delete an item
 * This bypasses the 30-day recovery period
 */
router.delete(
  '/deleted-items/:type/:id/permanent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const entityType = req.params.type as SoftDeleteEntityType;
    const entityId = parseInt(req.params.id);

    // Validate type
    if (!['client', 'project', 'invoice', 'lead', 'proposal'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity type',
        code: 'INVALID_TYPE'
      });
    }

    if (isNaN(entityId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity ID',
        code: 'INVALID_ID'
      });
    }

    const result = await softDeleteService.forceDelete(entityType, entityId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.message,
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  })
);

/**
 * POST /api/admin/deleted-items/cleanup - Manually trigger cleanup of expired items
 * Items older than 30 days will be permanently deleted
 */
router.post(
  '/deleted-items/cleanup',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { deleted, errors } = await softDeleteService.permanentlyDeleteExpired();

    res.json({
      success: errors.length === 0,
      message: `Cleanup complete. Permanently deleted ${deleted.total} items.`,
      deleted,
      errors: errors.length > 0 ? errors : undefined
    });
  })
);

// =====================================================
// DELETED ITEMS MANAGEMENT
// =====================================================

/**
 * GET /api/admin/deleted-items - List all soft-deleted items
 * Optional query param: type (client, project, invoice, lead, proposal)
 */
router.get(
  '/deleted-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const typeParam = req.query.type as string | undefined;
    const entityType = typeParam as SoftDeleteEntityType | undefined;

    // Validate entity type if provided
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (entityType && !validTypes.includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        code: 'INVALID_TYPE',
        validTypes
      });
    }

    const [items, stats] = await Promise.all([
      softDeleteService.getDeletedItems(entityType),
      softDeleteService.getDeletedItemStats()
    ]);

    // Transform to match frontend expected format
    const transformedItems = items.map(item => ({
      id: item.id,
      type: item.entityType,
      name: item.name,
      deleted_at: item.deletedAt,
      deleted_by: item.deletedBy,
      days_until_permanent: item.daysUntilPermanent
    }));

    res.json({
      items: transformedItems,
      stats
    });
  })
);

/**
 * GET /api/admin/deleted-items/stats - Get counts by entity type
 */
router.get(
  '/deleted-items/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const stats = await softDeleteService.getDeletedItemStats();
    res.json(stats);
  })
);

/**
 * POST /api/admin/deleted-items/:type/:id/restore - Restore a soft-deleted item
 */
router.post(
  '/deleted-items/:type/:id/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { type, id } = req.params;
    const entityId = parseInt(id, 10);

    // Validate entity type
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (!validTypes.includes(type as SoftDeleteEntityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        code: 'INVALID_TYPE',
        validTypes
      });
    }

    if (isNaN(entityId) || entityId <= 0) {
      return res.status(400).json({
        error: 'Invalid entity ID',
        code: 'INVALID_ID'
      });
    }

    const result = await softDeleteService.restore(type as SoftDeleteEntityType, entityId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        code: 'RESTORE_FAILED'
      });
    }
  })
);

/**
 * DELETE /api/admin/deleted-items/:type/:id/permanent - Permanently delete an item
 */
router.delete(
  '/deleted-items/:type/:id/permanent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { type, id } = req.params;
    const entityId = parseInt(id, 10);

    // Validate entity type
    const validTypes: SoftDeleteEntityType[] = ['client', 'project', 'invoice', 'lead', 'proposal'];
    if (!validTypes.includes(type as SoftDeleteEntityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        code: 'INVALID_TYPE',
        validTypes
      });
    }

    if (isNaN(entityId) || entityId <= 0) {
      return res.status(400).json({
        error: 'Invalid entity ID',
        code: 'INVALID_ID'
      });
    }

    const result = await softDeleteService.forceDelete(type as SoftDeleteEntityType, entityId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        code: 'DELETE_FAILED'
      });
    }
  })
);

export { router as adminRouter };
export default router;
