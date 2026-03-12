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
  getDatabase,
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes,
  validateRequest,
  rateLimit,
  invalidateCache,
  notificationPreferencesService,
  auditLogger,
  getString,
  softDeleteService,
  ClientValidationSchemas
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

    const db = getDatabase();
    const client = await db.get(
      `SELECT id, email, company_name, contact_name, phone, status, client_type,
              billing_name, billing_company, billing_address, billing_address2, billing_city,
              billing_state, billing_zip, billing_country,
              created_at, updated_at
       FROM active_clients WHERE id = ?`,
      [req.user!.id]
    );

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

    const { contact_name, company_name, phone } = req.body;
    const db = getDatabase();

    await db.run(
      `UPDATE clients SET contact_name = ?, company_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [contact_name || null, company_name || null, phone || null, req.user!.id]
    );

    const updatedClient = await db.get(
      'SELECT id, email, company_name, contact_name, phone, client_type FROM active_clients WHERE id = ?',
      [req.user!.id]
    );

    await auditLogger.logUpdate(
      'client',
      String(req.user!.id),
      req.user!.email,
      {
        contact_name: req.body.original_contact_name,
        company_name: req.body.original_company_name
      },
      { contact_name, company_name, phone },
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

    const db = getDatabase();
    const client = await db.get('SELECT password_hash FROM active_clients WHERE id = ?', [req.user!.id]);

    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    // Verify current password
    const passwordHash = getString(client, 'password_hash');
    const validPassword = await bcrypt.compare(currentPassword, passwordHash);
    if (!validPassword) {
      return errorResponse(res, 'Current password is incorrect', 401, ErrorCodes.INVALID_PASSWORD);
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.run(
      'UPDATE clients SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, req.user!.id]
    );

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

    const db = getDatabase();
    const client = await db.get(
      `SELECT
         billing_name, billing_company as company,
         billing_address as address, billing_address2 as address2,
         billing_city as city, billing_state as state,
         billing_zip as zip, billing_country as country
       FROM active_clients WHERE id = ?`,
      [req.user!.id]
    );

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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    if (req.user!.type !== 'client') {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    const { billing_name, company, address, address2, city, state, zip, country } = req.body;
    const db = getDatabase();

    await db.run(
      `UPDATE clients SET
         billing_name = ?,
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
        billing_name || null,
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

    const db = getDatabase();
    const clientId = req.user!.id;

    // Get all projects for this client (for project selector + count)
    const allProjects = await db.all(
      `SELECT id, project_name as name, status, progress,
              start_date, estimated_end_date as end_date, preview_url,
              created_at, updated_at
       FROM active_projects WHERE client_id = ?
       ORDER BY
         CASE WHEN status IN ('active', 'in-progress', 'in-review') THEN 0 ELSE 1 END,
         updated_at DESC`,
      [clientId]
    );
    const totalProjects = allProjects.length;

    // Get active projects count
    const activeProjects = allProjects.filter(
      (p: Record<string, unknown>) => ['pending', 'active', 'in-progress', 'in-review'].includes(p.status as string)
    ).length;

    // Get pending invoices count (sent, viewed, partial, overdue)
    const invoicesResult = await db.get(
      `SELECT COUNT(*) as count FROM active_invoices
       WHERE client_id = ? AND status IN ('sent', 'viewed', 'partial', 'overdue')`,
      [clientId]
    );
    const pendingInvoices = invoicesResult?.count || 0;

    // Get unread messages count
    const messagesResult = await db.get(
      `SELECT COUNT(*) as count FROM active_messages m
       JOIN active_message_threads t ON m.thread_id = t.id
       WHERE t.client_id = ? AND m.read_at IS NULL AND m.sender_type = 'admin'`,
      [clientId]
    );
    const unreadMessages = messagesResult?.count || 0;

    // Get recent activity (last 10 items)
    const recentActivity = await db.all(
      `SELECT type, title, context, date, entity_id FROM (
        -- Project updates
        SELECT
          'project_update' as type,
          pu.title as title,
          p.project_name as context,
          pu.created_at as date,
          CAST(NULL as INTEGER) as entity_id
        FROM project_updates pu
        JOIN active_projects p ON pu.project_id = p.id
        WHERE p.client_id = ?

        UNION ALL

        -- Messages received
        SELECT
          'message' as type,
          'New message received' as title,
          t.subject as context,
          m.created_at as date,
          t.id as entity_id
        FROM active_messages m
        JOIN active_message_threads t ON m.thread_id = t.id
        WHERE t.client_id = ? AND m.sender_type = 'admin'

        UNION ALL

        -- Invoices
        SELECT
          'invoice' as type,
          CASE
            WHEN i.status = 'sent' THEN 'Invoice sent'
            WHEN i.status = 'paid' THEN 'Invoice paid'
            WHEN i.status = 'overdue' THEN 'Invoice overdue'
            WHEN i.status = 'viewed' THEN 'Invoice viewed'
            ELSE 'Invoice updated'
          END as title,
          i.invoice_number as context,
          i.updated_at as date,
          i.id as entity_id
        FROM active_invoices i
        WHERE i.client_id = ?

        UNION ALL

        -- Files uploaded
        SELECT
          'file' as type,
          'File uploaded' as title,
          f.original_filename as context,
          f.created_at as date,
          f.id as entity_id
        FROM files f
        JOIN active_projects p ON f.project_id = p.id
        WHERE p.client_id = ? AND f.deleted_at IS NULL

        UNION ALL

        -- Document requests
        SELECT
          'document_request' as type,
          CASE
            WHEN dr.status = 'requested' THEN 'Document requested'
            WHEN dr.status = 'approved' THEN 'Document approved'
            WHEN dr.status = 'rejected' THEN 'Document rejected'
            WHEN dr.status = 'under_review' THEN 'Document under review'
            ELSE 'Document request updated'
          END as title,
          dr.title as context,
          dr.updated_at as date,
          dr.id as entity_id
        FROM active_document_requests dr
        WHERE dr.client_id = ?

        UNION ALL

        -- Contracts
        SELECT
          'contract' as type,
          CASE
            WHEN c.status = 'sent' THEN 'Contract sent for signature'
            WHEN c.status = 'signed' THEN 'Contract signed'
            WHEN c.status = 'expired' THEN 'Contract expired'
            WHEN c.countersigned_at IS NOT NULL THEN 'Contract countersigned'
            ELSE 'Contract updated'
          END as title,
          p.project_name as context,
          COALESCE(c.signed_at, c.sent_at, c.updated_at) as date,
          c.id as entity_id
        FROM active_contracts c
        JOIN active_projects p ON c.project_id = p.id
        WHERE c.client_id = ?
      ) AS activity
      ORDER BY date DESC
      LIMIT 10`,
      [clientId, clientId, clientId, clientId, clientId, clientId]
    );

    // Get pending document requests count
    const docRequestsResult = await db.get(
      `SELECT COUNT(*) as count FROM active_document_requests
       WHERE client_id = ? AND status IN ('requested', 'rejected')`,
      [clientId]
    );
    const pendingDocRequests = docRequestsResult?.count || 0;

    // Get pending contracts count (sent but not signed)
    const contractsResult = await db.get(
      `SELECT COUNT(*) as count FROM active_contracts
       WHERE client_id = ? AND status = 'sent'`,
      [clientId]
    );
    const pendingContracts = contractsResult?.count || 0;

    // Get pending questionnaires count (responses not yet completed)
    const questionnairesResult = await db.get(
      `SELECT COUNT(*) as count FROM questionnaire_responses qr
       JOIN active_projects p ON qr.project_id = p.id
       WHERE p.client_id = ? AND qr.status IN ('pending', 'in_progress')`,
      [clientId]
    );
    const pendingQuestionnaires = questionnairesResult?.count || 0;

    // Get pending approvals count (deliverables awaiting client approval)
    const approvalsResult = await db.get(
      `SELECT COUNT(*) as count FROM deliverables d
       JOIN active_projects p ON d.project_id = p.id
       WHERE p.client_id = ? AND d.approval_status = 'pending' AND d.deleted_at IS NULL`,
      [clientId]
    );
    const pendingApprovals = approvalsResult?.count || 0;

    // Get outstanding balance
    const balanceResult = await db.get(
      `SELECT COALESCE(SUM(amount_total - COALESCE(amount_paid, 0)), 0) as balance
       FROM active_invoices
       WHERE client_id = ? AND status IN ('sent', 'viewed', 'partial', 'overdue')`,
      [clientId]
    );
    const outstandingBalance = balanceResult?.balance || 0;

    // Get deliverables in review count
    const deliverablesInReviewResult = await db.get(
      `SELECT COUNT(*) as count FROM deliverables d
       JOIN active_projects p ON d.project_id = p.id
       WHERE p.client_id = ? AND d.status = 'in_review' AND d.deleted_at IS NULL`,
      [clientId]
    );
    const deliverablesInReview = deliverablesInReviewResult?.count || 0;

    // Get current active deliverable or milestone for active projects
    const currentDeliverable = await db.get(
      `SELECT id, title, status, type, project_id FROM (
        -- Deliverables (design review system)
        SELECT d.id, d.title, d.status, d.type, p.id as project_id, d.updated_at
        FROM deliverables d
        JOIN active_projects p ON d.project_id = p.id
        WHERE p.client_id = ? AND d.deleted_at IS NULL
          AND d.status IN ('in_progress', 'in_review')

        UNION ALL

        -- Milestones (project milestones)
        SELECT m.id, m.title, m.status, 'milestone' as type, p.id as project_id, m.updated_at
        FROM milestones m
        JOIN active_projects p ON m.project_id = p.id
        WHERE p.client_id = ? AND m.deleted_at IS NULL
          AND m.status = 'in_progress'
      )
      ORDER BY
        CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1`,
      [clientId, clientId]
    );

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
      projects: allProjects.map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        progress: p.progress,
        startDate: p.start_date,
        endDate: p.end_date,
        previewUrl: p.preview_url
      })),
      currentDeliverable: currentDeliverable
        ? { id: currentDeliverable.id, title: currentDeliverable.title, status: currentDeliverable.status, type: currentDeliverable.type, projectId: currentDeliverable.project_id }
        : null,
      recentActivity: recentActivity.map((item: Record<string, unknown>) => ({
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

const CONTACT_COLUMNS = 'id, client_id, first_name, last_name, email, phone, title, department, role, is_primary, notes, created_at, updated_at';

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

    const db = getDatabase();
    const contacts = await db.all(
      `SELECT ${CONTACT_COLUMNS} FROM client_contacts WHERE client_id = ? AND deleted_at IS NULL ORDER BY is_primary DESC, first_name ASC`,
      [clientId]
    );

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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    const { first_name, last_name, email, phone, title, department, role, notes } = req.body;

    if (!first_name || !last_name) {
      return errorResponse(res, 'First name and last name are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const result = await db.run(
      `INSERT INTO client_contacts (client_id, first_name, last_name, email, phone, title, department, role, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, first_name, last_name, email || null, phone || null, title || null, department || null, role || 'general', notes || null]
    );

    const contact = await db.get(
      `SELECT ${CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`,
      [result.lastID]
    );

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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    if (!clientId) {
      return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    const contactId = parseInt(req.params.id, 10);
    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();

    // Verify ownership
    const existing = await db.get(
      'SELECT id FROM client_contacts WHERE id = ? AND client_id = ?',
      [contactId, clientId]
    );
    if (!existing) {
      return errorResponse(res, 'Contact not found', 404, ErrorCodes.NOT_FOUND);
    }

    const { first_name, last_name, email, phone, title, department, role, notes } = req.body;

    const updates: string[] = [];
    const values: (string | number | boolean | null | undefined)[] = [];

    if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
    if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (title !== undefined) { updates.push('title = ?'); values.push(title || null); }
    if (department !== undefined) { updates.push('department = ?'); values.push(department || null); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes || null); }

    if (updates.length === 0) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(contactId, clientId);

    await db.run(
      `UPDATE client_contacts SET ${updates.join(', ')} WHERE id = ? AND client_id = ?`,
      values
    );

    const contact = await db.get(
      `SELECT ${CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`,
      [contactId]
    );

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

    const db = getDatabase();

    // Verify ownership
    const existing = await db.get(
      'SELECT id FROM client_contacts WHERE id = ? AND client_id = ? AND deleted_at IS NULL',
      [contactId, clientId]
    );
    if (!existing) {
      return errorResponse(res, 'Contact not found', 404, ErrorCodes.NOT_FOUND);
    }

    const deletedBy = req.user?.email || 'client';
    await softDeleteService.softDelete('contact', contactId, deletedBy);

    sendSuccess(res, undefined, 'Contact deleted');
  })
);

export { router as meRouter };
export default router;
