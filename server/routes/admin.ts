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
          p.project_name,
          p.description,
          p.status,
          p.project_type,
          p.budget_range,
          p.timeline,
          p.features,
          p.created_at,
          c.contact_name,
          c.company_name,
          c.email,
          c.phone
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        ORDER BY p.created_at DESC
      `);

      // Get stats
      const stats = await db.get(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status IN ('active', 'in-progress', 'in-review') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
        FROM projects
      `);

      res.json({
        success: true,
        leads,
        stats: {
          total: stats?.total || 0,
          pending: stats?.pending || 0,
          active: stats?.active || 0,
          completed: stats?.completed || 0
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
      const { status } = req.body;

      const validStatuses = ['pending', 'active', 'in-progress', 'in-review', 'completed', 'on-hold', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
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

      await db.run(
        'UPDATE projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id]
      );

      res.json({
        success: true,
        message: 'Lead status updated successfully',
        previousStatus: project.status,
        newStatus: status
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

      // Update project status to active
      if (typeof id === 'string') {
        await db.run('UPDATE projects SET status = ? WHERE id = ?', ['active', id]);
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

      if (lead.status === 'active' || lead.status === 'in-progress' || lead.status === 'in-review' || lead.status === 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Lead is already activated'
        });
      }

      // Update project status to active and set start_date
      await db.run('UPDATE projects SET status = ?, start_date = date(\'now\'), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
        'active',
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
    'simple-site': 'Simple Website',
    'business-site': 'Business Website',
    portfolio: 'Portfolio Website',
    ecommerce: 'E-commerce Store',
    'web-app': 'Web Application',
    'browser-extension': 'Browser Extension',
    other: 'Custom Project'
  };

  const typeName = typeNames[projectType] || 'Web Project';
  const identifier = clientData.company_name || clientData.contact_name || 'Client';

  return `${identifier} - ${typeName}`;
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

  const timestamp = Date.now();
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  const filename = `admin_project_${projectId}_${safeProjectName}_${timestamp}.json`;
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
      'Project Details.json',
      relativePath,
      fileSize,
      'application/json',
      'document',
      'Project details created by admin',
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

export { router as adminRouter };
export default router;
