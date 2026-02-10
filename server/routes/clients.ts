/**
 * ===============================================
 * CLIENT ROUTES
 * ===============================================
 * Client management endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache, QueryCache } from '../middleware/cache.js';
import { auditLogger } from '../services/audit-logger.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { notDeleted } from '../database/query-helpers.js';
import { softDeleteService } from '../services/soft-delete-service.js';
import { notificationPreferencesService } from '../services/notification-preferences-service.js';

const router = express.Router();

// =====================================================
// CURRENT CLIENT ENDPOINTS (/me)
// =====================================================

/**
 * GET /me - Get current client's profile
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const db = getDatabase();
    const client = await db.get(
      `SELECT id, email, company_name, contact_name, phone, status, client_type,
              billing_company, billing_address, billing_address2, billing_city,
              billing_state, billing_zip, billing_country,
              created_at, updated_at
       FROM clients WHERE id = ?`,
      [req.user!.id]
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'CLIENT_NOT_FOUND' });
    }

    res.json({ success: true, client });
  })
);

/**
 * PUT /me - Update current client's profile
 */
router.put(
  '/me',
  authenticateToken,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const { contact_name, company_name, phone } = req.body;
    const db = getDatabase();

    await db.run(
      `UPDATE clients SET contact_name = ?, company_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [contact_name || null, company_name || null, phone || null, req.user!.id]
    );

    const updatedClient = await db.get(
      'SELECT id, email, company_name, contact_name, phone, client_type FROM clients WHERE id = ?',
      [req.user!.id]
    );

    await auditLogger.logUpdate('client', String(req.user!.id), req.user!.email,
      { contact_name: req.body.original_contact_name, company_name: req.body.original_company_name },
      { contact_name, company_name, phone },
      req
    );

    res.json({ success: true, message: 'Profile updated successfully', client: updatedClient });
  })
);

/**
 * PUT /me/password - Change current client's password
 */
router.put(
  '/me/password',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: 'Current and new passwords are required', code: 'MISSING_FIELDS' });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' });
    }

    const db = getDatabase();
    const client = await db.get('SELECT password_hash FROM clients WHERE id = ?', [req.user!.id]);

    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'CLIENT_NOT_FOUND' });
    }

    // Verify current password
    const passwordHash = getString(client, 'password_hash');
    const validPassword = await bcrypt.compare(currentPassword, passwordHash);
    if (!validPassword) {
      return res
        .status(401)
        .json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.run(
      'UPDATE clients SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, req.user!.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  })
);

/**
 * PUT /me/notifications - Update notification preferences
 * Uses notification_preferences table (consolidated from legacy clients columns)
 */
router.put(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const { messages, status, invoices, weekly } = req.body;

    // Map legacy field names to new notification_preferences columns
    await notificationPreferencesService.updatePreferences(req.user!.id, 'client', {
      notify_new_message: messages,
      notify_project_update: status,
      notify_invoice_created: invoices,
      email_frequency: weekly ? 'weekly_digest' : 'immediate'
    });

    res.json({ success: true, message: 'Notification preferences updated' });
  })
);

/**
 * GET /me/notifications - Get notification preferences
 */
router.get(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const prefs = await notificationPreferencesService.getPreferences(req.user!.id, 'client');

    // Map to legacy field names for backward compatibility
    res.json({
      success: true,
      notifications: {
        messages: prefs.notify_new_message,
        status: prefs.notify_project_update,
        invoices: prefs.notify_invoice_created,
        weekly: prefs.email_frequency === 'weekly_digest'
      },
      // Also include full preferences for clients that want more options
      fullPreferences: prefs
    });
  })
);

/**
 * PUT /me/billing - Update billing information
 */
router.put(
  '/me/billing',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const { company, address, address2, city, state, zip, country } = req.body;
    const db = getDatabase();

    await db.run(
      `UPDATE clients SET
         billing_company = ?,
         billing_address = ?,
         billing_address2 = ?,
         billing_city = ?,
         billing_state = ?,
         billing_zip = ?,
         billing_country = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        company || null,
        address || null,
        address2 || null,
        city || null,
        state || null,
        zip || null,
        country || null,
        req.user!.id
      ]
    );

    res.json({ success: true, message: 'Billing information updated' });
  })
);

/**
 * GET /me/dashboard - Get client dashboard stats and recent activity
 */
router.get(
  '/me/dashboard',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    const clientId = req.user!.id;

    // Get active projects count
    const projectsResult = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE client_id = ? AND status IN ('planning', 'in-progress', 'review')`,
      [clientId]
    );
    const activeProjects = projectsResult?.count || 0;

    // Get pending invoices count (sent, viewed, partial, overdue)
    const invoicesResult = await db.get(
      `SELECT COUNT(*) as count FROM invoices
       WHERE client_id = ? AND status IN ('sent', 'viewed', 'partial', 'overdue')`,
      [clientId]
    );
    const pendingInvoices = invoicesResult?.count || 0;

    // Get unread messages count
    const messagesResult = await db.get(
      `SELECT COUNT(*) as count FROM messages m
       JOIN message_threads t ON m.thread_id = t.id
       WHERE t.client_id = ? AND m.read_at IS NULL AND m.sender_type = 'admin'`,
      [clientId]
    );
    const unreadMessages = messagesResult?.count || 0;

    // Get recent activity (last 10 items)
    const recentActivity = await db.all(
      `SELECT * FROM (
        -- Project updates
        SELECT
          'project_update' as type,
          pu.title as title,
          p.project_name as context,
          pu.created_at as date
        FROM project_updates pu
        JOIN projects p ON pu.project_id = p.id
        WHERE p.client_id = ?

        UNION ALL

        -- Messages received
        SELECT
          'message' as type,
          'New message received' as title,
          t.subject as context,
          m.created_at as date
        FROM messages m
        JOIN message_threads t ON m.thread_id = t.id
        WHERE t.client_id = ? AND m.sender_type = 'admin'

        UNION ALL

        -- Invoices
        SELECT
          'invoice' as type,
          CASE
            WHEN status = 'sent' THEN 'Invoice sent'
            WHEN status = 'paid' THEN 'Invoice paid'
            ELSE 'Invoice updated'
          END as title,
          invoice_number as context,
          updated_at as date
        FROM invoices
        WHERE client_id = ?

        UNION ALL

        -- Files uploaded
        SELECT
          'file' as type,
          'File uploaded' as title,
          original_filename as context,
          created_at as date
        FROM project_files pf
        JOIN projects p ON pf.project_id = p.id
        WHERE p.client_id = ?
      )
      ORDER BY date DESC
      LIMIT 10`,
      [clientId, clientId, clientId, clientId]
    );

    res.json({
      stats: {
        activeProjects,
        pendingInvoices,
        unreadMessages
      },
      recentActivity: recentActivity.map((item: Record<string, unknown>) => ({
        type: item.type,
        title: item.title,
        context: item.context,
        date: item.date
      }))
    });
  })
);

// =====================================================
// ADMIN CLIENT ENDPOINTS
// =====================================================

// Get all clients (admin only)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  cache({
    ttl: 300, // 5 minutes
    tags: ['clients', 'projects'],
    keyGenerator: (_req) => 'clients:all'
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const clients = await QueryCache.getOrSet(
      'clients:all:with_projects',
      async () => {
        // Get base client data with project count and health score
        // Filter out soft-deleted clients and projects
        const clientRows = await db.all(`
          SELECT
            c.id, c.email, c.company_name, c.contact_name, c.phone,
            c.status, c.client_type, c.created_at, c.updated_at,
            c.invitation_sent_at, c.invitation_expires_at,
            c.health_score, c.health_status,
            COUNT(p.id) as project_count
          FROM clients c
          LEFT JOIN projects p ON c.id = p.client_id AND ${notDeleted('p')}
          WHERE ${notDeleted('c')}
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);

        // Get tags for all clients in one query
        const tagRows = await db.all(`
          SELECT ct.client_id, t.id, t.name, t.color
          FROM client_tags ct
          JOIN tags t ON ct.tag_id = t.id
          ORDER BY t.name
        `);

        // Group tags by client_id
        const tagsByClient = new Map<number, Array<{ id: number; name: string; color: string }>>();
        for (const row of tagRows) {
          const r = row as Record<string, unknown>;
          const clientId = r.client_id as number;
          if (!tagsByClient.has(clientId)) {
            tagsByClient.set(clientId, []);
          }
          tagsByClient.get(clientId)!.push({
            id: r.id as number,
            name: r.name as string,
            color: (r.color as string) || '#6b7280'
          });
        }

        // Merge tags into client objects
        return clientRows.map((client) => {
          const c = client as Record<string, unknown>;
          return {
            ...c,
            tags: tagsByClient.get(c.id as number) || []
          };
        });
      },
      {
        ttl: 300,
        tags: ['clients', 'projects']
      }
    );

    res.json({ clients });
  })
);

// Get single client (admin or own profile)
router.get(
  '/:id',
  authenticateToken,
  cache({
    ttl: 600, // 10 minutes
    tags: (req) => [`client:${req.params.id}`, 'projects'],
    keyGenerator: (req) => `client:${req.params.id}:details`
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);

    // Check if user can access this client
    if (req.user!.type === 'client' && req.user!.id !== clientId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const db = getDatabase();

    const client = await QueryCache.getOrSet(
      `client:${clientId}:profile`,
      async () => {
        return await db.get(
          `
          SELECT
            c.id, c.email, c.company_name, c.contact_name, c.phone,
            c.status, c.client_type, c.created_at, c.updated_at
          FROM clients c
          WHERE c.id = ? AND ${notDeleted('c')}
        `,
          [clientId]
        );
      },
      {
        ttl: 600,
        tags: [`client:${clientId}`]
      }
    );

    if (!client) {
      return res.status(404).json({
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    // Get client's projects (filter out soft-deleted)
    const projects = await QueryCache.getOrSet(
      `client:${clientId}:projects`,
      async () => {
        return await db.all(
          `
          SELECT
            id, project_name as name, description, status, priority, start_date,
            estimated_end_date as due_date, actual_end_date as completed_at,
            budget_range as budget, created_at, updated_at
          FROM projects
          WHERE client_id = ? AND ${notDeleted()}
          ORDER BY created_at DESC
        `,
          [clientId]
        );
      },
      {
        ttl: 300,
        tags: [`client:${clientId}`, 'projects']
      }
    );

    res.json({
      client,
      projects
    });
  })
);

// Create new client (admin only)
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password, company_name, contact_name, phone, client_type, status } = req.body;

    // Validate required fields - only email is required
    // Password is optional (client can be invited to set password later)
    if (!email) {
      return res.status(400).json({
        error: 'Email is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      });
    }

    // Validate password strength if provided
    if (password && password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
        code: 'WEAK_PASSWORD'
      });
    }

    const db = getDatabase();

    // Check if email already exists
    const existingClient = await db.get('SELECT id FROM clients WHERE email = ?', [
      email.toLowerCase()
    ]);

    if (existingClient) {
      return res.status(409).json({
        error: 'Email already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Hash password if provided, otherwise empty string (pending invite)
    const saltRounds = 12;
    const password_hash = password ? await bcrypt.hash(password, saltRounds) : '';

    // Insert new client - status defaults to 'pending' if no password provided
    const clientStatus = password ? (status || 'active') : 'pending';
    const result = await db.run(
      `
    INSERT INTO clients (email, password_hash, company_name, contact_name, phone, client_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
      [
        email.toLowerCase(),
        password_hash,
        company_name || null,
        contact_name || null,
        phone || null,
        client_type || 'business',
        clientStatus
      ]
    );

    // Get the created client
    const newClient = await db.get(
      `
    SELECT id, email, company_name, contact_name, phone, status, client_type, created_at
    FROM clients WHERE id = ?
  `,
      [result.lastID]
    );

    if (!newClient) {
      return res.status(500).json({
        error: 'Client created but could not retrieve details',
        code: 'CLIENT_CREATION_ERROR'
      });
    }

    // Send welcome email
    try {
      // Note: Login URL no longer includes email in query string for privacy
      // Client will enter email on the login page (portal login is now on home page)
      const portalUrl = process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL;
      const supportEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL;

      const newClientEmail = getString(newClient, 'email');
      const newClientContactName = getString(newClient, 'contact_name');
      const newClientCompanyName = getString(newClient, 'company_name');
      const newClientId = getNumber(newClient, 'id');

      if (!portalUrl || !supportEmail) {
        console.warn('CLIENT_PORTAL_URL or SUPPORT_EMAIL not configured, skipping welcome email');
      } else {
        await emailService.sendWelcomeEmail(newClientEmail, {
          name: newClientContactName || 'Client',
          companyName: newClientCompanyName,
          loginUrl: portalUrl,
          supportEmail: supportEmail
        });
      }

      // Send admin notification
      await emailService.sendAdminNotification({
        subject: 'New Client Registration',
        intakeId: newClientId.toString(),
        clientName: newClientContactName || 'Unknown',
        companyName: newClientCompanyName || 'Unknown Company',
        projectType: 'New Registration',
        budget: 'TBD',
        timeline: 'New Client'
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue with response - don't fail client creation due to email issues
    }

    res.status(201).json({
      message: 'Client created successfully',
      client: newClient
    });
  })
);

// Update client (admin or own profile)
router.put(
  '/:id',
  authenticateToken,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);

    // Check if user can update this client
    if (req.user!.type === 'client' && req.user!.id !== clientId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    const { email, company_name, contact_name, phone, status } = req.body;
    const db = getDatabase();

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number)[] = [];

    // Only admins can change email (login identifier)
    if (email !== undefined && req.user!.type === 'admin') {
      const trimmed = String(email).trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'Email cannot be empty', code: 'INVALID_EMAIL' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return res.status(400).json({ error: 'Invalid email format', code: 'INVALID_EMAIL' });
      }
      const normalized = trimmed.toLowerCase();
      const existing = await db.get('SELECT id FROM clients WHERE email = ? AND id != ?', [normalized, clientId]);
      if (existing) {
        return res.status(409).json({ error: 'Email already in use by another client', code: 'EMAIL_EXISTS' });
      }
      updates.push('email = ?');
      values.push(normalized);
    }

    if (company_name !== undefined) {
      updates.push('company_name = ?');
      values.push(company_name);
    }
    if (contact_name !== undefined) {
      updates.push('contact_name = ?');
      values.push(contact_name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }

    // Only admins can change status
    if (status !== undefined && req.user!.type === 'admin') {
      if (!['active', 'inactive', 'pending'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status value',
          code: 'INVALID_STATUS'
        });
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_UPDATES'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(clientId);

    await db.run(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated client
    const updatedClient = await db.get(
      `SELECT id, email, company_name, contact_name, phone, status, client_type, created_at, updated_at
       FROM clients WHERE id = ?`,
      [clientId]
    );

    res.json({
      message: 'Client updated successfully',
      client: updatedClient
    });
  })
);

// Get client's projects (admin only)
router.get(
  '/:id/projects',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const db = getDatabase();

    const projects = await db.all(
      `
      SELECT
        id, project_name, description, status, priority, start_date,
        estimated_end_date, actual_end_date, budget_range, created_at, updated_at
      FROM projects
      WHERE client_id = ? AND ${notDeleted()}
      ORDER BY created_at DESC
      `,
      [clientId]
    );

    res.json({ projects });
  })
);

// Send invitation to client (admin only)
router.post(
  '/:id/send-invite',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const db = getDatabase();

    // Get client details
    const client = await db.get(
      'SELECT id, email, contact_name, company_name, status, invitation_sent_at FROM clients WHERE id = ?',
      [clientId]
    );

    if (!client) {
      return res.status(404).json({
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    const clientEmail = getString(client, 'email');
    const clientName = getString(client, 'contact_name');

    // Generate invitation token (valid for 7 days)
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Update client with invitation token
    await db.run(
      `UPDATE clients
       SET invitation_token = ?, invitation_expires_at = ?, invitation_sent_at = CURRENT_TIMESTAMP, status = 'pending'
       WHERE id = ?`,
      [invitationToken, expiresAt, clientId]
    );

    // Build invitation link
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const invitationUrl = new URL('/client/set-password.html', baseUrl);
    invitationUrl.searchParams.set('token', invitationToken);
    if (clientEmail) {
      invitationUrl.searchParams.set('email', clientEmail);
    }
    const invitationLink = invitationUrl.toString();

    // Send invitation email
    try {
      await emailService.sendEmail({
        to: clientEmail,
        subject: 'Welcome to No Bhad Codes - Set Up Your Client Portal',
        text: `
Hello ${clientName || 'there'},

You've been invited to access the No Bhad Codes client portal.

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
    .button { display: inline-block; padding: 12px 30px; background-color: #7ff709; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to No Bhad Codes</h1>
    </div>
    <p>Hello ${clientName || 'there'},</p>
    <p>You've been invited to access the No Bhad Codes client portal.</p>
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
      await auditLogger.log({
        action: 'client_invited',
        entityType: 'client',
        entityId: String(clientId),
        entityName: clientEmail,
        userId: req.user?.id || 0,
        userEmail: req.user?.email || 'admin',
        userType: 'admin',
        metadata: { clientName },
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('user-agent') || 'unknown'
      });

      res.json({
        success: true,
        message: 'Invitation sent successfully',
        clientId,
        email: clientEmail
      });
    } catch (emailError) {
      console.error('[Clients] Failed to send invitation email:', emailError);
      res.status(500).json({
        error: 'Failed to send invitation email',
        code: 'EMAIL_FAILED'
      });
    }
  })
);


// Delete client (admin only) - soft delete with 30-day recovery
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients', 'projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteClient(clientId, deletedBy);

    if (!result.success) {
      return res.status(404).json({
        error: result.message,
        code: 'CLIENT_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: result.message,
      affectedItems: result.affectedItems
    });
  })
);

// =====================================================
// CRM ENHANCEMENT ENDPOINTS
// =====================================================

import { clientService } from '../services/client-service.js';

// =====================================================
// CONTACT MANAGEMENT
// =====================================================

/**
 * GET /clients/:id/contacts - Get all contacts for a client
 */
router.get(
  '/:id/contacts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const contacts = await clientService.getContacts(clientId);
    res.json({ success: true, contacts });
  })
);

/**
 * POST /clients/:id/contacts - Create a new contact for a client
 */
router.post(
  '/:id/contacts',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const { firstName, lastName, email, phone, title, department, role, isPrimary, notes } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'First name and last name are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const contact = await clientService.createContact(clientId, {
      firstName,
      lastName,
      email,
      phone,
      title,
      department,
      role,
      isPrimary,
      notes
    });

    res.status(201).json({ success: true, contact });
  })
);

/**
 * PUT /clients/contacts/:contactId - Update a contact
 */
router.put(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId);
    const contact = await clientService.updateContact(contactId, req.body);
    res.json({ success: true, contact });
  })
);

/**
 * DELETE /clients/contacts/:contactId - Delete a contact
 */
router.delete(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId);
    await clientService.deleteContact(contactId);
    res.json({ success: true, message: 'Contact deleted successfully' });
  })
);

/**
 * POST /clients/:id/contacts/:contactId/set-primary - Set primary contact
 */
router.post(
  '/:id/contacts/:contactId/set-primary',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const contactId = parseInt(req.params.contactId);
    await clientService.setPrimaryContact(clientId, contactId);
    res.json({ success: true, message: 'Primary contact updated' });
  })
);

// =====================================================
// ACTIVITY TIMELINE
// =====================================================

/**
 * GET /clients/:id/activities - Get activity timeline for a client
 */
router.get(
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const { type, startDate, endDate, limit, offset } = req.query;

    const activities = await clientService.getActivityTimeline(clientId, {
      activityType: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    res.json({ success: true, activities });
  })
);

/**
 * POST /clients/:id/activities - Log an activity for a client
 */
router.post(
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const { activityType, title, description, metadata } = req.body;

    if (!activityType || !title) {
      return res.status(400).json({
        error: 'Activity type and title are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const activity = await clientService.logActivity(clientId, {
      activityType,
      title,
      description,
      metadata,
      createdBy: req.user?.email || 'admin'
    });

    res.status(201).json({ success: true, activity });
  })
);

/**
 * GET /clients/activities/recent - Get recent activities across all clients
 */
router.get(
  '/activities/recent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await clientService.getRecentActivities(limit);
    // Transform to snake_case for API response
    const apiActivities = activities.map(a => ({
      id: a.id,
      client_id: a.clientId,
      activity_type: a.activityType,
      title: a.title,
      description: a.description,
      metadata: a.metadata,
      created_by: a.createdBy,
      created_at: a.createdAt,
      client_name: a.clientName,
      company_name: a.companyName
    }));
    res.json({ success: true, activities: apiActivities });
  })
);

// =====================================================
// NOTES
// =====================================================

/** Transform ClientNote to snake_case for API response */
function toApiNote(n: { id: number; clientId: number; author: string; content: string; isPinned: boolean; createdAt: string; updatedAt: string }) {
  return {
    id: n.id,
    client_id: n.clientId,
    content: n.content,
    is_pinned: n.isPinned,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    created_by: n.author
  };
}

/**
 * GET /clients/:id/notes - Get notes for a client
 */
router.get(
  '/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const notes = await clientService.getNotes(clientId);
    res.json({ notes: notes.map(toApiNote) });
  })
);

/**
 * POST /clients/:id/notes - Add note to a client
 */
router.post(
  '/:id/notes',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        error: 'Note content is required',
        code: 'MISSING_CONTENT'
      });
    }

    const note = await clientService.addNote(clientId, req.user?.email || 'admin', content.trim());
    res.status(201).json({ note: toApiNote(note) });
  })
);

/**
 * PUT /clients/notes/:noteId - Update a note (e.g. is_pinned)
 */
router.put(
  '/notes/:noteId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId);
    const { is_pinned } = req.body;

    if (typeof is_pinned !== 'boolean') {
      return res.status(400).json({
        error: 'is_pinned must be a boolean',
        code: 'INVALID_INPUT'
      });
    }

    const note = await clientService.updateNote(noteId, { isPinned: is_pinned });
    res.json({ note: toApiNote(note) });
  })
);

/**
 * DELETE /clients/notes/:noteId - Delete a note
 */
router.delete(
  '/notes/:noteId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId);
    await clientService.deleteNote(noteId);
    res.json({ message: 'Note deleted' });
  })
);

// =====================================================
// CUSTOM FIELDS
// =====================================================

/**
 * GET /clients/custom-fields - Get all custom field definitions
 */
router.get(
  '/custom-fields',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const fields = await clientService.getCustomFields(includeInactive);
    res.json({ success: true, fields });
  })
);

/**
 * POST /clients/custom-fields - Create a custom field definition
 */
router.post(
  '/custom-fields',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { fieldName, fieldLabel, fieldType, options, isRequired, placeholder, defaultValue, displayOrder } = req.body;

    if (!fieldName || !fieldLabel || !fieldType) {
      return res.status(400).json({
        error: 'Field name, label, and type are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const field = await clientService.createCustomField({
      fieldName,
      fieldLabel,
      fieldType,
      options,
      isRequired,
      placeholder,
      defaultValue,
      displayOrder
    });

    res.status(201).json({ success: true, field });
  })
);

/**
 * PUT /clients/custom-fields/:fieldId - Update a custom field definition
 */
router.put(
  '/custom-fields/:fieldId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fieldId = parseInt(req.params.fieldId);
    const field = await clientService.updateCustomField(fieldId, req.body);
    res.json({ success: true, field });
  })
);

/**
 * DELETE /clients/custom-fields/:fieldId - Delete a custom field (marks as inactive)
 */
router.delete(
  '/custom-fields/:fieldId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const fieldId = parseInt(req.params.fieldId);
    await clientService.deleteCustomField(fieldId);
    res.json({ success: true, message: 'Custom field deactivated' });
  })
);

/**
 * GET /clients/:id/custom-fields - Get custom field values for a client
 */
router.get(
  '/:id/custom-fields',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const values = await clientService.getClientCustomFields(clientId);
    res.json({ success: true, values });
  })
);

/**
 * PUT /clients/:id/custom-fields - Set custom field values for a client
 */
router.put(
  '/:id/custom-fields',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const { values } = req.body;

    if (!Array.isArray(values)) {
      return res.status(400).json({
        error: 'Values must be an array of { fieldId, value } objects',
        code: 'INVALID_FORMAT'
      });
    }

    await clientService.setClientCustomFields(clientId, values);
    res.json({ success: true, message: 'Custom field values updated' });
  })
);

// =====================================================
// TAGS & SEGMENTATION
// =====================================================

/**
 * GET /clients/tags - Get all tags
 */
router.get(
  '/tags',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagType = req.query.type as string;
    const tags = await clientService.getTags(tagType);
    res.json({ success: true, tags });
  })
);

/**
 * POST /clients/tags - Create a new tag
 */
router.post(
  '/tags',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, color, description, tagType } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Tag name is required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    const tag = await clientService.createTag({ name, color, description, tagType });
    res.status(201).json({ success: true, tag });
  })
);

/**
 * PUT /clients/tags/:tagId - Update a tag
 */
router.put(
  '/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagId = parseInt(req.params.tagId);
    const tag = await clientService.updateTag(tagId, req.body);
    res.json({ success: true, tag });
  })
);

/**
 * DELETE /clients/tags/:tagId - Delete a tag
 */
router.delete(
  '/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagId = parseInt(req.params.tagId);
    await clientService.deleteTag(tagId);
    res.json({ success: true, message: 'Tag deleted successfully' });
  })
);

/**
 * GET /clients/:id/tags - Get tags for a client
 */
router.get(
  '/:id/tags',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const tags = await clientService.getClientTags(clientId);
    res.json({ success: true, tags });
  })
);

/**
 * POST /clients/:id/tags/:tagId - Add a tag to a client
 */
router.post(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);
    await clientService.addTagToClient(clientId, tagId);
    res.json({ success: true, message: 'Tag added to client' });
  })
);

/**
 * DELETE /clients/:id/tags/:tagId - Remove a tag from a client
 */
router.delete(
  '/:id/tags/:tagId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const tagId = parseInt(req.params.tagId);
    await clientService.removeTagFromClient(clientId, tagId);
    res.json({ success: true, message: 'Tag removed from client' });
  })
);

/**
 * GET /clients/by-tag/:tagId - Get all clients with a specific tag
 */
router.get(
  '/by-tag/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagId = parseInt(req.params.tagId);
    const clients = await clientService.getClientsByTag(tagId);
    res.json({ success: true, clients });
  })
);

// =====================================================
// HEALTH SCORING
// =====================================================

/**
 * GET /clients/:id/health - Get health score for a client
 */
router.get(
  '/:id/health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const health = await clientService.calculateHealthScore(clientId);
    res.json({ success: true, health });
  })
);

/**
 * POST /clients/:id/health/recalculate - Recalculate health score for a client
 */
router.post(
  '/:id/health/recalculate',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const health = await clientService.updateHealthStatus(clientId);
    res.json({ success: true, health });
  })
);

/**
 * GET /clients/at-risk - Get all at-risk clients
 */
router.get(
  '/at-risk',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clients = await clientService.getAtRiskClients();
    res.json({ success: true, clients });
  })
);

/**
 * GET /clients/:id/stats - Get comprehensive stats for a client
 */
router.get(
  '/:id/stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const stats = await clientService.getClientStats(clientId);
    res.json({ success: true, stats });
  })
);

// =====================================================
// CRM FIELDS
// =====================================================

/**
 * PUT /clients/:id/crm - Update CRM-specific fields for a client
 */
router.put(
  '/:id/crm',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    await clientService.updateCRMFields(clientId, req.body);
    res.json({ success: true, message: 'CRM fields updated' });
  })
);

/**
 * GET /clients/follow-up - Get clients due for follow-up
 */
router.get(
  '/follow-up',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clients = await clientService.getClientsForFollowUp();
    res.json({ success: true, clients });
  })
);

// =====================================================
// NOTIFICATION PREFERENCES & TIMELINE
// =====================================================

import { timelineService } from '../services/timeline-service.js';

/**
 * GET /me/timeline - Get current client's activity timeline
 */
router.get(
  '/me/timeline',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    const { events, total } = await timelineService.getClientTimeline(req.user!.id, {
      projectId,
      limit,
      offset
    });

    res.json({ success: true, events, total, limit, offset });
  })
);

/**
 * GET /me/timeline/summary - Get recent activity summary for dashboard
 */
router.get(
  '/me/timeline/summary',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const summary = await timelineService.getRecentActivitySummary(req.user!.id, days);

    res.json({ success: true, ...summary });
  })
);

/**
 * GET /me/notifications - Get current client's notification preferences
 */
router.get(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const preferences = await notificationPreferencesService.getPreferences(req.user!.id, 'client');
    res.json({ success: true, preferences });
  })
);

/**
 * PUT /me/notifications - Update current client's notification preferences
 */
router.put(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const preferences = await notificationPreferencesService.updatePreferences(
      req.user!.id,
      'client',
      req.body
    );

    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences
    });
  })
);

/**
 * GET /me/notifications/history - Get notification history for current client
 */
router.get(
  '/me/notifications/history',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const history = await notificationPreferencesService.getNotificationHistory(req.user!.id, 'client', limit);

    res.json({ success: true, history });
  })
);

export { router as clientsRouter };
export default router;
