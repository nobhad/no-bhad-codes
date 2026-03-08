/**
 * ===============================================
 * CLIENT CORE ROUTES
 * ===============================================
 * @file server/routes/clients/core.ts
 *
 * Admin client list, tags & segmentation, and single
 * client CRUD endpoints (create, read, update, delete,
 * projects, send-invite).
 */

import {
  logger,
  express,
  bcrypt,
  crypto,
  authenticateToken,
  requireAdmin,
  type AuthenticatedRequest,
  asyncHandler,
  getDatabase,
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes,
  validateRequest,
  cache,
  invalidateCache,
  QueryCache,
  emailService,
  auditLogger,
  getString,
  getNumber,
  softDeleteService,
  clientService,
  ClientValidationSchemas
} from './helpers.js';
import { BUSINESS_INFO } from '../../config/business.js';

const router = express.Router();

// =====================================================
// ADMIN CLIENT ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/clients:
 *   get:
 *     tags: [Clients]
 *     summary: Get all clients (admin only)
 *     description: Get all clients (admin only).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
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
          FROM active_clients c
          LEFT JOIN active_projects p ON c.id = p.client_id
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

    sendSuccess(res, { clients });
  })
);

// =====================================================
// TAGS & SEGMENTATION (static routes before /:id)
// =====================================================

/**
 * @swagger
 * /api/clients/tags:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/tags - Get all tags
 *     description: GET /clients/tags - Get all tags.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/tags',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagType = req.query.type as string;
    const tags = await clientService.getTags(tagType);
    sendSuccess(res, { tags });
  })
);

/**
 * @swagger
 * /api/clients/tags:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/tags - Create a new tag
 *     description: POST /clients/tags - Create a new tag.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/tags',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, color, description, tagType } = req.body;

    if (!name) {
      return errorResponse(res, 'Tag name is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const tag = await clientService.createTag({ name, color, description, tagType });
    sendCreated(res, { tag });
  })
);

/**
 * @swagger
 * /api/clients/tags/{tagId}:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /clients/tags/:tagId - Update a tag
 *     description: PUT /clients/tags/:tagId - Update a tag.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const tag = await clientService.updateTag(tagId, req.body);
    sendSuccess(res, { tag });
  })
);

/**
 * @swagger
 * /api/clients/tags/{tagId}:
 *   delete:
 *     tags: [Clients]
 *     summary: DELETE /clients/tags/:tagId - Delete a tag
 *     description: DELETE /clients/tags/:tagId - Delete a tag.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/tags/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    await clientService.deleteTag(tagId);
    sendSuccess(res, undefined, 'Tag deleted successfully');
  })
);

/**
 * @swagger
 * /api/clients/by-tag/{tagId}:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/by-tag/:tagId - Get all clients with a specific tag
 *     description: GET /clients/by-tag/:tagId - Get all clients with a specific tag.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/by-tag/:tagId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const tagId = parseInt(req.params.tagId, 10);
    if (isNaN(tagId) || tagId <= 0) {
      return errorResponse(res, 'Invalid tag ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const clients = await clientService.getClientsByTag(tagId);
    sendSuccess(res, { clients });
  })
);

// =====================================================
// SINGLE CLIENT ENDPOINTS (/:id routes)
// =====================================================

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     tags: [Clients]
 *     summary: Get single client (admin or own profile)
 *     description: Get single client (admin or own profile).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:id',
  authenticateToken,
  cache({
    ttl: 600, // 10 minutes
    tags: (req) => [`client:${req.params.id}`, 'projects'],
    keyGenerator: (req) => `client:${req.params.id}:details`
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if user can access this client
    if (req.user!.type === 'client' && req.user!.id !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
          FROM active_clients c
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
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
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
          FROM active_projects
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

    sendSuccess(res, {
      client,
      projects
    });
  })
);

/**
 * @swagger
 * /api/clients:
 *   post:
 *     tags: [Clients]
 *     summary: Create new client (admin only)
 *     description: Create new client (admin only).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(ClientValidationSchemas.create),
  invalidateCache(['clients']),
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const { email, password, company_name, contact_name, phone, client_type, status } = req.body;

    // Validate required fields - only email is required
    // Password is optional (client can be invited to set password later)
    if (!email) {
      return errorResponse(res, 'Email is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', 400, ErrorCodes.INVALID_EMAIL);
    }

    // Validate password strength if provided
    if (password && password.length < 8) {
      return errorResponse(
        res,
        'Password must be at least 8 characters long',
        400,
        ErrorCodes.WEAK_PASSWORD
      );
    }

    const db = getDatabase();

    // Check if email already exists
    const existingClient = await db.get('SELECT id FROM active_clients WHERE email = ?', [
      email.toLowerCase()
    ]);

    if (existingClient) {
      return errorResponse(res, 'Email already registered', 409, ErrorCodes.EMAIL_EXISTS);
    }

    // Hash password if provided, otherwise empty string (pending invite)
    const saltRounds = 12;
    const password_hash = password ? await bcrypt.hash(password, saltRounds) : '';

    // Insert new client - status defaults to 'pending' if no password provided
    const clientStatus = password ? status || 'active' : 'pending';
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
    FROM active_clients WHERE id = ?
  `,
      [result.lastID]
    );

    if (!newClient) {
      return errorResponse(
        res,
        'Client created but could not retrieve details',
        500,
        'CLIENT_CREATION_ERROR'
      );
    }

    // Send welcome email only if client is active (has password set)
    // Pending clients will receive an invitation email instead
    try {
      const newClientEmail = getString(newClient, 'email');
      const newClientContactName = getString(newClient, 'contact_name');
      const newClientCompanyName = getString(newClient, 'company_name');
      const newClientId = getNumber(newClient, 'id');
      const newClientStatus = getString(newClient, 'status');

      // Only send welcome email to active clients (those created with a password)
      // Pending clients should receive an invitation email via the send-invite endpoint
      if (newClientStatus === 'active') {
        const portalUrl = process.env.CLIENT_PORTAL_URL || process.env.FRONTEND_URL;
        const supportEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL;

        if (!portalUrl || !supportEmail) {
          await logger.warn(
            'CLIENT_PORTAL_URL or SUPPORT_EMAIL not configured, skipping welcome email',
            { category: 'CLIENTS' }
          );
        } else {
          await emailService.sendWelcomeEmail(newClientEmail, {
            name: newClientContactName || 'Client',
            companyName: newClientCompanyName,
            loginUrl: portalUrl,
            supportEmail: supportEmail
          });
        }
      } else {
        await logger.info(
          `[Clients] Skipping welcome email for pending client ${newClientId} - account not yet activated`,
          { category: 'CLIENTS' }
        );
      }

      // Send admin notification (always send to admin regardless of client status)
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
      await logger.error('Failed to send welcome email:', {
        error: emailError instanceof Error ? emailError : undefined,
        category: 'CLIENTS'
      });
      // Continue with response - don't fail client creation due to email issues
    }

    sendCreated(res, { client: newClient }, 'Client created successfully');
  })
);

/**
 * @swagger
 * /api/clients/{id}:
 *   put:
 *     tags: [Clients]
 *     summary: Update client (admin or own profile)
 *     description: Update client (admin or own profile).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/:id',
  authenticateToken,
  validateRequest(ClientValidationSchemas.update),
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check if user can update this client
    if (req.user!.type === 'client' && req.user!.id !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
        return errorResponse(res, 'Email cannot be empty', 400, ErrorCodes.INVALID_EMAIL);
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return errorResponse(res, 'Invalid email format', 400, ErrorCodes.INVALID_EMAIL);
      }
      const normalized = trimmed.toLowerCase();
      const existing = await db.get('SELECT id FROM active_clients WHERE email = ? AND id != ?', [
        normalized,
        clientId
      ]);
      if (existing) {
        return errorResponse(res, 'Email already in use by another client', 409, ErrorCodes.EMAIL_EXISTS);
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
        return errorResponse(res, 'Invalid status value', 400, ErrorCodes.INVALID_STATUS);
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No valid fields to update', 400, ErrorCodes.NO_UPDATES);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(clientId);

    await db.run(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, values);

    // Get updated client
    const updatedClient = await db.get(
      `SELECT id, email, company_name, contact_name, phone, status, client_type, created_at, updated_at
       FROM active_clients WHERE id = ?`,
      [clientId]
    );

    sendSuccess(res, { client: updatedClient }, 'Client updated successfully');
  })
);

/**
 * @swagger
 * /api/clients/{id}/projects:
 *   get:
 *     tags: [Clients]
 *     summary: Get client's projects (admin only)
 *     description: Get client's projects (admin only).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/:id/projects',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();

    const projects = await db.all(
      `
      SELECT
        id, project_name, description, status, priority, start_date,
        estimated_end_date, actual_end_date, budget_range, created_at, updated_at
      FROM active_projects
      WHERE client_id = ?
      ORDER BY created_at DESC
      `,
      [clientId]
    );

    sendSuccess(res, { projects });
  })
);

/**
 * @swagger
 * /api/clients/{id}/send-invite:
 *   post:
 *     tags: [Clients]
 *     summary: Send invitation to client (admin only)
 *     description: Send invitation to client (admin only).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/send-invite',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();

    // Get client details
    const client = await db.get(
      'SELECT id, email, contact_name, company_name, status, invitation_sent_at FROM active_clients WHERE id = ?',
      [clientId]
    );

    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
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
        subject: `Welcome to ${BUSINESS_INFO.name} - Set Up Your Client Portal`,
        text: `
Hello ${clientName || 'there'},

You've been invited to access the ${BUSINESS_INFO.name} client portal.

Click the link below to set your password and access your dashboard:
${invitationLink}

This link will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
${BUSINESS_INFO.name} Team
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
      <h1>Welcome to ${BUSINESS_INFO.name}</h1>
    </div>
    <p>Hello ${clientName || 'there'},</p>
    <p>You've been invited to access the ${BUSINESS_INFO.name} client portal.</p>
    <p>Click the button below to set your password and access your dashboard:</p>
    <p style="text-align: center;">
      <a href="${invitationLink}" class="button">Set Up Your Account</a>
    </p>
    <p>Or copy and paste this link:</p>
    <p style="word-break: break-all; color: #666;">${invitationLink}</p>
    <p><strong>This link will expire in 7 days.</strong></p>
    <div class="footer">
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>${BUSINESS_INFO.name} Team</p>
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

      sendSuccess(res, { clientId, email: clientEmail }, 'Invitation sent successfully');
    } catch (emailError) {
      await logger.error('[Clients] Failed to send invitation email:', {
        error: emailError instanceof Error ? emailError : undefined,
        category: 'CLIENTS'
      });
      errorResponse(res, 'Failed to send invitation email', 500, ErrorCodes.EMAIL_FAILED);
    }
  })
);

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     tags: [Clients]
 *     summary: Delete client (admin only) - soft delete with 30-day recovery
 *     description: Delete client (admin only) - soft delete with 30-day recovery.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients', 'projects']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteClient(clientId, deletedBy);

    if (!result.success) {
      return errorResponse(res, result.message || 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    sendSuccess(res, { affectedItems: result.affectedItems }, result.message);
  })
);

export { router as coreRouter };
export default router;
