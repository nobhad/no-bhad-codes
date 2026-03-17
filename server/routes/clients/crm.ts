/**
 * ===============================================
 * CLIENT CRM ROUTES
 * ===============================================
 * @file server/routes/clients/crm.ts
 *
 * CRM enhancement endpoints: admin contact management,
 * activity timeline, and notes for clients.
 */

import {
  express,
  authenticateToken,
  requireAdmin,
  type AuthenticatedRequest,
  asyncHandler,
  errorResponse,
  sendSuccess,
  sendCreated,
  ErrorCodes,
  invalidateCache,
  QueryCache,
  clientService,
  toApiNote,
  validateRequest,
  normalizeEmail,
  normalizePhone
} from './helpers.js';

const router = express.Router();

const CrmContactSchemas = {
  create: {
    firstName: [{ type: 'required' as const }, { type: 'string' as const, maxLength: 100 }],
    lastName: [{ type: 'required' as const }, { type: 'string' as const, maxLength: 100 }],
    email: { type: 'email' as const },
    phone: { type: 'string' as const, maxLength: 30 },
    title: { type: 'string' as const, maxLength: 100 },
    department: { type: 'string' as const, maxLength: 100 },
    role: { type: 'string' as const, maxLength: 50 },
    isPrimary: { type: 'boolean' as const },
    notes: { type: 'string' as const, maxLength: 2000 }
  },
  update: {
    firstName: { type: 'string' as const, maxLength: 100 },
    lastName: { type: 'string' as const, maxLength: 100 },
    email: { type: 'email' as const },
    phone: { type: 'string' as const, maxLength: 30 },
    title: { type: 'string' as const, maxLength: 100 },
    department: { type: 'string' as const, maxLength: 100 },
    role: { type: 'string' as const, maxLength: 50 },
    isPrimary: { type: 'boolean' as const },
    notes: { type: 'string' as const, maxLength: 2000 }
  }
};

// =====================================================
// CRM ENHANCEMENT ENDPOINTS
// =====================================================

// =====================================================
// CONTACT MANAGEMENT
// =====================================================

/**
 * @swagger
 * /api/clients/{id}/contacts:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/contacts - Get all contacts for a client
 *     description: GET /clients/:id/contacts - Get all contacts for a client.
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
  '/:id/contacts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const contacts = await clientService.getContacts(clientId);
    sendSuccess(res, { contacts });
  })
);

/**
 * @swagger
 * /api/clients/{id}/contacts:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/:id/contacts - Create a new contact for a client
 *     description: POST /clients/:id/contacts - Create a new contact for a client.
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
  '/:id/contacts',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  validateRequest(CrmContactSchemas.create, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { firstName, lastName, email, phone, title, department, role, isPrimary, notes } =
      req.body;

    if (!firstName || !lastName) {
      return errorResponse(
        res,
        'First name and last name are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const normalizedEmail = email ? normalizeEmail(email) : email;
    const normalizedPhone = phone ? normalizePhone(phone) : phone;

    const contact = await clientService.createContact(clientId, {
      firstName,
      lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      title,
      department,
      role,
      isPrimary,
      notes
    });

    sendCreated(res, { contact });
  })
);

/**
 * @swagger
 * /api/clients/contacts/{contactId}:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /clients/contacts/:contactId - Update a contact
 *     description: PUT /clients/contacts/:contactId - Update a contact.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  validateRequest(CrmContactSchemas.update, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId, 10);

    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Normalize email if provided
    if (req.body.email) {
      req.body.email = normalizeEmail(req.body.email);
    }

    // Normalize phone if provided
    if (req.body.phone) {
      req.body.phone = normalizePhone(req.body.phone);
    }

    const contact = await clientService.updateContact(contactId, req.body);

    // Sync primary contact name back to clients.contact_name
    if (contact.isPrimary) {
      const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
      await clientService.updateClientProfile(contact.clientId, { contact_name: fullName });
      await QueryCache.invalidate([`client:${contact.clientId}`, 'clients']);
    }

    sendSuccess(res, { contact });
  })
);

/**
 * @swagger
 * /api/clients/contacts/{contactId}:
 *   delete:
 *     tags: [Clients]
 *     summary: DELETE /clients/contacts/:contactId - Delete a contact
 *     description: DELETE /clients/contacts/:contactId - Delete a contact.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId, 10);

    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.deleteContact(contactId);
    sendSuccess(res, undefined, 'Contact deleted successfully');
  })
);

/**
 * @swagger
 * /api/clients/{id}/contacts/{contactId}/set-primary:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/:id/contacts/:contactId/set-primary - Set primary contact
 *     description: POST /clients/:id/contacts/:contactId/set-primary - Set primary contact.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/contacts/:contactId/set-primary',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);
    const contactId = parseInt(req.params.contactId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.setPrimaryContact(clientId, contactId);
    sendSuccess(res, undefined, 'Primary contact updated');
  })
);

// =====================================================
// ACTIVITY TIMELINE
// =====================================================

/**
 * @swagger
 * /api/clients/{id}/activities:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/activities - Get activity timeline for a client
 *     description: GET /clients/:id/activities - Get activity timeline for a client.
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
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { type, startDate, endDate, limit, offset } = req.query;

    const activities = await clientService.getActivityTimeline(clientId, {
      activityType: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined
    });

    sendSuccess(res, { activities });
  })
);

/**
 * @swagger
 * /api/clients/{id}/activities:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/:id/activities - Log an activity for a client
 *     description: POST /clients/:id/activities - Log an activity for a client.
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
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { activityType, title, description, metadata } = req.body;

    if (!activityType || !title) {
      return errorResponse(
        res,
        'Activity type and title are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const activity = await clientService.logActivity(clientId, {
      activityType,
      title,
      description,
      metadata,
      createdBy: req.user?.email || 'admin'
    });

    sendCreated(res, { activity });
  })
);

/**
 * @swagger
 * /api/clients/activities/recent:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/activities/recent - Get recent activities across all clients
 *     description: GET /clients/activities/recent - Get recent activities across all clients.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/activities/recent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await clientService.getRecentActivities(limit);
    // Transform to snake_case for API response
    const apiActivities = activities.map((a) => ({
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
    sendSuccess(res, { activities: apiActivities });
  })
);

// =====================================================
// NOTES
// =====================================================

/**
 * @swagger
 * /api/clients/{id}/notes:
 *   get:
 *     tags: [Clients]
 *     summary: GET /clients/:id/notes - Get notes for a client
 *     description: GET /clients/:id/notes - Get notes for a client.
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
  '/:id/notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const notes = await clientService.getNotes(clientId);
    sendSuccess(res, { notes: notes.map(toApiNote) });
  })
);

/**
 * @swagger
 * /api/clients/{id}/notes:
 *   post:
 *     tags: [Clients]
 *     summary: POST /clients/:id/notes - Add note to a client
 *     description: POST /clients/:id/notes - Add note to a client.
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
  '/:id/notes',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.id, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return errorResponse(res, 'Note content is required', 400, ErrorCodes.MISSING_CONTENT);
    }

    const note = await clientService.addNote(clientId, req.user?.email || 'admin', content.trim());
    sendCreated(res, { note: toApiNote(note) });
  })
);

/**
 * @swagger
 * /api/clients/notes/{noteId}:
 *   put:
 *     tags: [Clients]
 *     summary: PUT /clients/notes/:noteId - Update a note (e.g. is_pinned)
 *     description: PUT /clients/notes/:noteId - Update a note (e.g. is_pinned).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/notes/:noteId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId, 10);

    if (isNaN(noteId) || noteId <= 0) {
      return errorResponse(res, 'Invalid note ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { is_pinned } = req.body;

    if (typeof is_pinned !== 'boolean') {
      return errorResponse(res, 'is_pinned must be a boolean', 400, ErrorCodes.INVALID_INPUT);
    }

    const note = await clientService.updateNote(noteId, { isPinned: is_pinned });
    sendSuccess(res, { note: toApiNote(note) });
  })
);

/**
 * @swagger
 * /api/clients/notes/{noteId}:
 *   delete:
 *     tags: [Clients]
 *     summary: DELETE /clients/notes/:noteId - Delete a note
 *     description: DELETE /clients/notes/:noteId - Delete a note.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/notes/:noteId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const noteId = parseInt(req.params.noteId, 10);

    if (isNaN(noteId) || noteId <= 0) {
      return errorResponse(res, 'Invalid note ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await clientService.deleteNote(noteId);
    sendSuccess(res, undefined, 'Note deleted');
  })
);

export { router as crmRouter };
export default router;
