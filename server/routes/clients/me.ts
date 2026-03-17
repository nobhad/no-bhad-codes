/**
 * ===============================================
 * CLIENT "ME" ROUTES
 * ===============================================
 * @file server/routes/clients/me.ts
 *
 * Current client /me endpoints: profile, password, notifications,
 * billing, dashboard, and client contact management (/me/contacts).
 */

import {
  express,
  bcrypt,
  authenticateToken,
  type AuthenticatedRequest,
  asyncHandler,
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes,
  validateRequest,
  rateLimit,
  invalidateCache,
  QueryCache,
  notificationPreferencesService,
  auditLogger,
  softDeleteService,
  clientService,
  ClientValidationSchemas,
  normalizeEmail,
  normalizePhone
} from './helpers.js';

const router = express.Router();

// =====================================================
// CURRENT CLIENT ENDPOINTS (/me)
// =====================================================

/**
 * @swagger
 * /api/clients/me:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me - Get current client's profile
 *     description: GET /me - Get current client's profile.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const client = await clientService.getClientProfile(req.user!.id);

    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    sendSuccess(res, { client });
  })
);

/**
 * @swagger
 * /api/clients/me:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me - Update current client's profile
 *     description: PUT /me - Update current client's profile.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/me',
  authenticateToken,
  validateRequest(ClientValidationSchemas.updateProfile, { allowUnknownFields: true }),
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Only pass fields that are actually present in the request body
    const profileUpdates: Record<string, string | null> = {};
    if ('contact_name' in req.body) profileUpdates.contact_name = req.body.contact_name;
    if ('company_name' in req.body) profileUpdates.company_name = req.body.company_name;
    if ('phone' in req.body) profileUpdates.phone = req.body.phone;

    await clientService.updateClientProfile(req.user!.id, profileUpdates);

    // Sync profile name/phone to primary client_contact if present
    if ('contact_name' in profileUpdates || 'phone' in profileUpdates) {
      const contacts = await clientService.getContacts(req.user!.id);
      const primaryContact = contacts.find((c) => c.isPrimary);
      if (primaryContact) {
        const contactUpdates: Record<string, string | null> = {};
        if ('contact_name' in profileUpdates && profileUpdates.contact_name) {
          const nameParts = profileUpdates.contact_name.trim().split(/\s+/);
          contactUpdates.first_name = nameParts[0] || '';
          contactUpdates.last_name = nameParts.slice(1).join(' ') || '';
        }
        if ('phone' in profileUpdates) {
          contactUpdates.phone = profileUpdates.phone || null;
        }
        if (Object.keys(contactUpdates).length > 0) {
          await clientService.updateClientContact(primaryContact.id, req.user!.id, contactUpdates);
        }
      }
    }

    // Auto-populate billing name/company on first profile save if billing fields are empty
    const currentBilling = await clientService.getClientBilling(req.user!.id);
    const billingUpdates: Record<string, string | null> = {};
    if ('contact_name' in req.body && !currentBilling?.billing_name) {
      billingUpdates.billing_name = req.body.contact_name;
    }
    if ('company_name' in req.body && !currentBilling?.company) {
      billingUpdates.company = req.body.company_name;
    }
    if ('phone' in req.body && !(currentBilling as Record<string, unknown>)?.phone) {
      billingUpdates.phone = req.body.phone;
    }
    if (Object.keys(billingUpdates).length > 0) {
      await clientService.updateClientBilling(req.user!.id, billingUpdates);
    }

    const updatedClient = await clientService.getClientProfileBasic(req.user!.id);

    // Invalidate admin client detail cache
    await QueryCache.invalidate([`client:${req.user!.id}`]);

    await auditLogger.logUpdate(
      'client',
      String(req.user!.id),
      req.user!.email,
      {
        contact_name: req.body.original_contact_name,
        company_name: req.body.original_company_name
      },
      profileUpdates,
      req
    );

    sendSuccess(res, { client: updatedClient }, 'Profile updated successfully');
  })
);

/**
 * @swagger
 * /api/clients/me/password:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/password - Change current client's password
 *     description: PUT /me/password - Change current client's password.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/me/password',
  authenticateToken,
  validateRequest(ClientValidationSchemas.changePassword),
  // Rate limit: 5 password change attempts per hour per user to prevent abuse
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: 'Too many password change attempts. Please try again later.',
    keyGenerator: (req) => `password-change:${(req as AuthenticatedRequest).user?.id || req.ip}`
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return errorResponse(res, 'Current and new passwords are required', 400, ErrorCodes.MISSING_FIELDS);
    }

    if (newPassword.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters', 400, ErrorCodes.WEAK_PASSWORD);
    }

    const client = await clientService.getClientPasswordHash(req.user!.id);

    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    // Verify current password
    const passwordHash = client.password_hash;
    const validPassword = await bcrypt.compare(currentPassword, passwordHash);
    if (!validPassword) {
      return errorResponse(res, 'Current password is incorrect', 401, ErrorCodes.INVALID_PASSWORD);
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await clientService.updateClientPassword(req.user!.id, newHash);

    sendSuccess(res, undefined, 'Password changed successfully');
  })
);

/**
 * @swagger
 * /api/clients/me/notifications:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/notifications - Update notification preferences
 *     description: PUT /me/notifications - Update notification preferences.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/me/notifications',
  authenticateToken,
  validateRequest(ClientValidationSchemas.updateNotifications, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { messages, status, invoices, weekly } = req.body;

    // Map legacy field names to new notification_preferences columns
    await notificationPreferencesService.updatePreferences(req.user!.id, 'client', {
      notify_new_message: messages,
      notify_project_update: status,
      notify_invoice_created: invoices,
      email_frequency: weekly ? 'weekly_digest' : 'immediate'
    });

    sendSuccess(res, undefined, 'Notification preferences updated');
  })
);

/**
 * @swagger
 * /api/clients/me/notifications:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/notifications - Get notification preferences
 *     description: GET /me/notifications - Get notification preferences.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/notifications',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const prefs = await notificationPreferencesService.getPreferences(req.user!.id, 'client');

    // Map to legacy field names for backward compatibility
    sendSuccess(res, {
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

// Alias: /me/notification-preferences → same handlers as /me/notifications
router.get('/me/notification-preferences', authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }
    const prefs = await notificationPreferencesService.getPreferences(req.user!.id, 'client');
    sendSuccess(res, {
      notifications: {
        messages: prefs.notify_new_message,
        status: prefs.notify_project_update,
        invoices: prefs.notify_invoice_created,
        weekly: prefs.email_frequency === 'weekly_digest'
      },
      fullPreferences: prefs
    });
  })
);

router.put('/me/notification-preferences', authenticateToken,
  validateRequest(ClientValidationSchemas.updateNotifications, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }
    const { messages, status, invoices, weekly } = req.body;
    await notificationPreferencesService.updatePreferences(req.user!.id, 'client', {
      notify_new_message: messages,
      notify_project_update: status,
      notify_invoice_created: invoices,
      email_frequency: weekly ? 'weekly_digest' : 'immediate'
    });
    sendSuccess(res, undefined, 'Notification preferences updated');
  })
);

/**
 * @swagger
 * /api/clients/me/billing:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/billing - Get billing information
 *     description: GET /me/billing - Get billing information.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/billing',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const client = await clientService.getClientBilling(req.user!.id);

    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    sendSuccess(res, { billing: client });
  })
);

/**
 * @swagger
 * /api/clients/me/billing:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/billing - Update billing information
 *     description: PUT /me/billing - Update billing information.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/me/billing',
  authenticateToken,
  validateRequest(ClientValidationSchemas.updateBilling, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { billing_name, company, address, address2, city, state, zip, country, phone, email } = req.body;

    // Normalize email and phone if provided
    const normalizedEmail = email ? normalizeEmail(email) : email;
    const normalizedPhone = phone ? normalizePhone(phone) : phone;

    await clientService.updateClientBilling(req.user!.id, {
      billing_name,
      company,
      address,
      address2,
      city,
      state,
      zip,
      country,
      phone: normalizedPhone,
      email: normalizedEmail
    });

    // Invalidate admin client detail cache so billing shows immediately
    await QueryCache.invalidate([`client:${req.user!.id}`, 'clients']);

    sendSuccess(res, undefined, 'Billing information updated');
  })
);

/**
 * @swagger
 * /api/clients/me/dashboard:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/dashboard - Get client dashboard stats and recent activity
 *     description: GET /me/dashboard - Get client dashboard stats and recent activity.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/dashboard',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    // Ensure only clients can access their dashboard
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const clientId = req.user!.id;

    // Get all projects for this client (for project selector + count)
    const allProjects = await clientService.getClientProjects(clientId);
    const totalProjects = allProjects.length;

    // Get active projects count
    const activeProjects = allProjects.filter(
      (p) => ['pending', 'active', 'in-progress', 'in-review'].includes(p.status)
    ).length;

    // Run independent dashboard queries in parallel
    const [
      pendingInvoices,
      unreadMessages,
      recentActivity,
      pendingDocRequests,
      pendingContracts,
      pendingQuestionnaires,
      pendingApprovals,
      outstandingBalance,
      deliverablesInReview,
      currentDeliverable
    ] = await Promise.all([
      clientService.getPendingInvoiceCount(clientId),
      clientService.getUnreadMessageCount(clientId),
      clientService.getClientRecentActivity(clientId),
      clientService.getPendingDocRequestCount(clientId),
      clientService.getPendingContractCount(clientId),
      clientService.getPendingQuestionnaireCount(clientId),
      clientService.getPendingApprovalCount(clientId),
      clientService.getOutstandingBalance(clientId),
      clientService.getDeliverablesInReviewCount(clientId),
      clientService.getCurrentDeliverable(clientId)
    ]);

    sendSuccess(res, {
      stats: {
        activeProjects,
        pendingInvoices,
        unreadMessages,
        pendingDocRequests,
        pendingContracts,
        pendingQuestionnaires,
        pendingApprovals,
        outstandingBalance,
        deliverablesInReview
      },
      totalProjects,
      projects: allProjects.map((p) => ({
        id: p.id,
        name: p.project_name,
        status: p.status,
        progress: p.progress,
        startDate: p.start_date,
        endDate: p.end_date,
        previewUrl: p.preview_url
      })),
      currentDeliverable: currentDeliverable
        ? { id: currentDeliverable.id, title: currentDeliverable.title, status: currentDeliverable.status, type: currentDeliverable.type, projectId: currentDeliverable.project_id }
        : null,
      recentActivity: recentActivity.map((item) => ({
        type: item.type,
        title: item.title,
        context: item.context,
        date: item.date,
        entityId: item.entity_id
      }))
    });
  })
);

// ===================================
// CLIENT CONTACT MANAGEMENT (/me/contacts)
// ===================================

/**
 * @swagger
 * /api/clients/me/contacts:
 *   get:
 *     tags: [Clients]
 *     summary: GET /me/contacts - List client's own contacts
 *     description: GET /me/contacts - List client's own contacts.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/me/contacts',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    const contacts = await clientService.getClientOwnContacts(clientId);

    sendSuccess(res, { contacts });
  })
);

/**
 * @swagger
 * /api/clients/me/contacts:
 *   post:
 *     tags: [Clients]
 *     summary: POST /me/contacts - Add a new contact
 *     description: POST /me/contacts - Add a new contact.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/me/contacts',
  authenticateToken,
  validateRequest(ClientValidationSchemas.createContact, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    const { first_name, last_name, email, phone, title, department, role, notes } = req.body;

    if (!first_name || !last_name) {
      return errorResponse(res, 'First name and last name are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const normalizedEmail = email ? normalizeEmail(email) : email;
    const normalizedPhone = phone ? normalizePhone(phone) : phone;

    const contact = await clientService.insertClientContact(clientId, {
      first_name,
      last_name,
      email: normalizedEmail,
      phone: normalizedPhone,
      title,
      department,
      role,
      notes
    });

    await QueryCache.invalidate([`client:${clientId}`, 'clients']);

    sendCreated(res, { contact });
  })
);

/**
 * @swagger
 * /api/clients/me/contacts/{id}:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /me/contacts/:id - Update a contact
 *     description: PUT /me/contacts/:id - Update a contact.
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
  '/me/contacts/:id',
  authenticateToken,
  validateRequest(ClientValidationSchemas.updateContact, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    const contactId = parseInt(req.params.id, 10);
    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify ownership
    const ownershipValid = await clientService.verifyContactOwnership(contactId, clientId);
    if (!ownershipValid) {
      return errorResponse(res, 'Contact not found', 404, ErrorCodes.NOT_FOUND);
    }

    const { first_name, last_name, email, phone, title, department, role, notes } = req.body;

    const fields: Record<string, string | null | undefined> = {};
    if (first_name !== undefined) fields.first_name = first_name;
    if (last_name !== undefined) fields.last_name = last_name;
    if (email !== undefined) fields.email = email ? normalizeEmail(email) : null;
    if (phone !== undefined) fields.phone = phone ? normalizePhone(phone) : null;
    if (title !== undefined) fields.title = title || null;
    if (department !== undefined) fields.department = department || null;
    if (role !== undefined) fields.role = role;
    if (notes !== undefined) fields.notes = notes || null;

    if (Object.keys(fields).length === 0) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const contact = await clientService.updateClientContact(contactId, clientId, fields);

    await QueryCache.invalidate([`client:${clientId}`, 'clients']);

    sendSuccess(res, { contact });
  })
);

/**
 * @swagger
 * /api/clients/me/contacts/{id}:
 *   delete:
 *     tags: [Clients]
 *     summary: DELETE /me/contacts/:id - Remove a contact
 *     description: DELETE /me/contacts/:id - Remove a contact.
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
  '/me/contacts/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    const contactId = parseInt(req.params.id, 10);
    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify ownership
    const ownershipValid = await clientService.verifyContactOwnershipActive(contactId, clientId);
    if (!ownershipValid) {
      return errorResponse(res, 'Contact not found', 404, ErrorCodes.NOT_FOUND);
    }

    const deletedBy = req.user?.email || 'client';
    await softDeleteService.softDelete('contact', contactId, deletedBy);

    await QueryCache.invalidate([`client:${clientId}`, 'clients']);

    sendSuccess(res, undefined, 'Contact deleted');
  })
);

export { router as meRouter };
export default router;
