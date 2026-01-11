/**
 * ===============================================
 * ADMIN ROUTES
 * ===============================================
 * @file server/routes/admin.ts
 *
 * Admin-only endpoints for system monitoring and management
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { cacheService } from '../services/cache-service.js';
import { emailService } from '../services/email-service.js';
import { errorTracker } from '../services/error-tracking.js';
import { getDatabase } from '../database/init.js';

/**
 * Generate a random temporary password
 */
function generateTempPassword(): string {
  // Generate a readable password: 3 words separated by dashes + 2 numbers
  const adjectives = ['Quick', 'Bright', 'Swift', 'Bold', 'Fresh', 'Smart', 'Cool', 'Calm'];
  const nouns = ['Tiger', 'Eagle', 'Wolf', 'Hawk', 'Bear', 'Fox', 'Lion', 'Deer'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const nums = Math.floor(Math.random() * 90 + 10); // 10-99
  return `${adj}${noun}${nums}`;
}

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
            stats: cacheStats,
          },
          email: {
            initialized: emailStatus.initialized,
            queueSize: emailStatus.queueSize,
            templatesLoaded: emailStatus.templatesLoaded,
            isProcessingQueue: emailStatus.isProcessingQueue,
          },
          database: {
            connected: true, // We'll assume it's connected if we got this far
            type: 'sqlite',
          },
        },
      };

      res.json(systemStatus);
    } catch (error) {
      console.error('Error getting system status:', error);

      errorTracker.captureException(error as Error, {
        tags: { component: 'admin-status' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
      });

      res.status(500).json({
        status: 'error',
        timestamp,
        error: 'Failed to retrieve system status',
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
        code: 'CACHE_UNAVAILABLE',
      });
    }

    try {
      const stats = await cacheService.getStats();
      res.json({
        cache: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve cache statistics',
        code: 'CACHE_STATS_ERROR',
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
        code: 'CACHE_UNAVAILABLE',
      });
    }

    try {
      const cleared = await cacheService.clear();

      if (cleared) {
        // Log the cache clear action
        errorTracker.captureMessage('Admin cleared cache', 'info', {
          tags: { component: 'admin-cache' },
          user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        });

        res.json({
          message: 'Cache cleared successfully',
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          error: 'Failed to clear cache',
          code: 'CACHE_CLEAR_FAILED',
        });
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        code: 'CACHE_CLEAR_ERROR',
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
        code: 'MISSING_PARAMETERS',
      });
    }

    if (!cacheService.isAvailable()) {
      return res.status(503).json({
        error: 'Cache service not available',
        code: 'CACHE_UNAVAILABLE',
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
        extra: { tag, pattern, invalidatedCount: count },
      });

      res.json({
        message: `Invalidated ${count} cache entries`,
        count,
        tag,
        pattern,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error invalidating cache:', error);
      res.status(500).json({
        error: 'Failed to invalidate cache',
        code: 'CACHE_INVALIDATE_ERROR',
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
          SUM(CASE WHEN status IN ('active', 'in_progress') THEN 1 ELSE 0 END) as active,
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
          completed: stats?.completed || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch leads',
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
          archived: stats?.archived || 0,
        },
      });
    } catch (error) {
      console.error('Error fetching contact submissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch contact submissions',
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
          error: 'Invalid status value',
        });
      }

      const db = getDatabase();

      let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
      const values: any[] = [status];

      if (status === 'read') {
        updateFields += ', read_at = CURRENT_TIMESTAMP';
      } else if (status === 'replied') {
        updateFields += ', replied_at = CURRENT_TIMESTAMP';
      }

      values.push(id);

      await db.run(`UPDATE contact_submissions SET ${updateFields} WHERE id = ?`, values);

      res.json({
        success: true,
        message: 'Status updated successfully',
      });
    } catch (error) {
      console.error('Error updating contact submission status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update status',
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
          error: 'Lead not found',
        });
      }

      if (!lead.email) {
        return res.status(400).json({
          success: false,
          error: 'Lead does not have an email address',
        });
      }

      // Check if client already exists
      let clientId = lead.client_id;
      const existingClient = await db.get(
        'SELECT id, invitation_token FROM clients WHERE email = ?',
        [lead.email]
      );

      // Generate invitation token (valid for 7 days)
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (existingClient) {
        // Update existing client with new invitation token
        clientId = existingClient.id;
        await db.run(
          `
          UPDATE clients
          SET invitation_token = ?, invitation_expires_at = ?, invitation_sent_at = CURRENT_TIMESTAMP, status = 'pending'
          WHERE id = ?
        `,
          [invitationToken, expiresAt, clientId]
        );
      } else {
        // Create new client with pending status (no password yet)
        const result = await db.run(
          `
          INSERT INTO clients (email, password_hash, contact_name, company_name, phone, status, invitation_token, invitation_expires_at, invitation_sent_at)
          VALUES (?, '', ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)
        `,
          [lead.email, lead.contact_name, lead.company_name, lead.phone, invitationToken, expiresAt]
        );
        clientId = result.lastID;

        // Update project to link to new client
        await db.run('UPDATE projects SET client_id = ? WHERE id = ?', [clientId, id]);
      }

      // Update project status to active
      await db.run('UPDATE projects SET status = ? WHERE id = ?', ['active', id]);

      // Build invitation link
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const invitationLink = `${baseUrl}/client/set-password.html?token=${invitationToken}`;

      // Send invitation email
      const emailResult = await emailService.sendEmail({
        to: lead.email,
        subject: 'Welcome to No Bhad Codes - Set Up Your Client Portal',
        text: `
Hello ${lead.contact_name || 'there'},

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
    <p>Hello ${lead.contact_name || 'there'},</p>
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
        `,
      });

      // Log the invitation
      errorTracker.captureMessage('Admin sent client invitation', 'info', {
        tags: { component: 'admin-invite' },
        user: { id: req.user?.id?.toString() || '', email: req.user?.email || '' },
        extra: { leadId: id, clientEmail: lead.email },
      });

      res.json({
        success: true,
        message: 'Invitation sent successfully',
        clientId,
        email: lead.email,
        emailResult,
      });
    } catch (error) {
      console.error('Error inviting lead:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send invitation',
      });
    }
  })
);

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
        cssFiles: cssFiles.slice(0, 5).map(f => ({ ...f, sizeFormatted: formatBytes(f.size) })),
      });
    } catch (error) {
      console.error('Error reading bundle stats:', error);
      res.status(500).json({ error: 'Failed to read bundle stats' });
    }
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
