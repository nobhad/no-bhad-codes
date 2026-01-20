/**
 * ===============================================
 * CLIENT ROUTES
 * ===============================================
 * Client management endpoints
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { emailService } from '../services/email-service.js';
import { cache, invalidateCache, QueryCache } from '../middleware/cache.js';
import { auditLogger } from '../services/audit-logger.js';

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
    const validPassword = await bcrypt.compare(currentPassword, client.password_hash);
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

      if (!portalUrl || !supportEmail) {
        console.warn('CLIENT_PORTAL_URL or SUPPORT_EMAIL not configured, skipping welcome email');
      } else {
        await emailService.sendWelcomeEmail(newClient.email, {
          name: newClient.contact_name || 'Client',
          companyName: newClient.company_name,
          loginUrl: portalUrl,
          supportEmail: supportEmail
        });
      }

      // Send admin notification
      await emailService.sendAdminNotification({
        subject: 'New Client Registration',
        intakeId: newClient.id.toString(),
        clientName: newClient.contact_name || 'Unknown',
        companyName: newClient.company_name || 'Unknown Company',
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

    const { company_name, contact_name, phone, status } = req.body;
    const db = getDatabase();

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number)[] = [];

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

    values.push(clientId);

    await db.run(
      `
    UPDATE clients 
    SET ${updates.join(', ')}
    WHERE id = ?
  `,
      values
    );

    // Get updated client
    const updatedClient = await db.get(
      `
    SELECT id, email, company_name, contact_name, phone, status, client_type, created_at, updated_at
    FROM clients WHERE id = ?
  `,
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
