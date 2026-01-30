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
              notification_messages, notification_status, notification_invoices, notification_weekly,
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
 */
router.put(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return res.status(403).json({ error: 'Access denied', code: 'ACCESS_DENIED' });
    }

    const { messages, status, invoices, weekly } = req.body;
    const db = getDatabase();

    await db.run(
      `UPDATE clients SET
         notification_messages = ?,
         notification_status = ?,
         notification_invoices = ?,
         notification_weekly = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [messages ? 1 : 0, status ? 1 : 0, invoices ? 1 : 0, weekly ? 1 : 0, req.user!.id]
    );

    res.json({ success: true, message: 'Notification preferences updated' });
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
        return await db.all(`
          SELECT
            c.id, c.email, c.company_name, c.contact_name, c.phone,
            c.status, c.client_type, c.created_at, c.updated_at,
            c.invitation_sent_at, c.invitation_expires_at,
            COUNT(p.id) as project_count
          FROM clients c
          LEFT JOIN projects p ON c.id = p.client_id
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);
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
          WHERE c.id = ?
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

    // Get client's projects
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
          WHERE client_id = ?
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
      WHERE client_id = ?
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
    const invitationLink = `${baseUrl}/client/set-password.html?token=${invitationToken}`;

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


// Delete client (admin only)
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients', 'projects']),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const clientId = parseInt(req.params.id);
    const db = getDatabase();

    const client = await db.get('SELECT id FROM clients WHERE id = ?', [clientId]);

    if (!client) {
      return res.status(404).json({
        error: 'Client not found',
        code: 'CLIENT_NOT_FOUND'
      });
    }

    await db.run('DELETE FROM clients WHERE id = ?', [clientId]);

    res.json({
      message: 'Client deleted successfully'
    });
  })
);

export { router as clientsRouter };
export default router;
