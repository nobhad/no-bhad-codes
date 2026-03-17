/**
 * ===============================================
 * ADMIN CONTACTS ROUTES
 * ===============================================
 * @file server/routes/admin/contacts.ts
 *
 * Admin contact management endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { invalidateCache, QueryCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { clientService } from '../../services/client-service.js';
import { softDeleteService } from '../../services/soft-delete-service.js';
import { validateRequest } from '../../middleware/validation.js';

const router = express.Router();

const AdminContactSchemas = {
  create: {
    clientId: [{ type: 'required' as const }, { type: 'number' as const }],
    name: [{ type: 'required' as const }, { type: 'string' as const, maxLength: 200 }],
    email: [{ type: 'required' as const }, { type: 'email' as const }],
    phone: { type: 'string' as const, maxLength: 30 },
    title: { type: 'string' as const, maxLength: 100 },
    company: { type: 'string' as const, maxLength: 200 },
    isPrimary: { type: 'boolean' as const }
  },
  update: {
    firstName: { type: 'string' as const, maxLength: 100 },
    lastName: { type: 'string' as const, maxLength: 100 },
    email: { type: 'email' as const },
    phone: { type: 'string' as const, maxLength: 30 },
    role: { type: 'string' as const, maxLength: 50 },
    isPrimary: { type: 'boolean' as const }
  }
};

/**
 * GET /api/admin/contacts - List all contacts across all clients
 * Includes both explicit client_contacts AND the client's own contact info
 */
router.get(
  '/contacts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const explicitContacts = await clientService.getAllExplicitContacts();
    const clientContacts = await clientService.getAllClientContactRecords();

    const clientIdsWithContacts = new Set(
      explicitContacts.map((c) => c.clientId as number)
    );

    type ContactRow = Record<string, unknown>;
    const allContacts: ContactRow[] = [];

    for (const c of explicitContacts) {
      allContacts.push({
        ...c,
        isPrimary: c.isPrimary === 1
      });
    }

    // Track emails already seen from explicit contacts for deduplication
    const seenEmails = new Set<string>();
    for (const c of explicitContacts) {
      if (c.email) seenEmails.add(String(c.email).toLowerCase());
    }

    for (const client of clientContacts) {
      const clientEmail = String(client.email || '').toLowerCase();

      // Skip if this client's email is already represented in explicit contacts
      if (clientEmail && seenEmails.has(clientEmail)) continue;

      const contactName = (client.contact_name as string) || '';
      const nameParts = contactName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const isPrimary = !clientIdsWithContacts.has(client.id as number);

      allContacts.push({
        id: 100000 + (client.id as number),
        firstName,
        lastName,
        email: client.email,
        phone: client.phone,
        role: 'client',
        isPrimary,
        synthetic: true,
        status: 'active',
        clientId: client.id,
        company: client.company,
        clientName: client.company,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt
      });

      if (clientEmail) seenEmails.add(clientEmail);
    }

    allContacts.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    const stats = {
      total: allContacts.length,
      active: allContacts.length,
      primary: allContacts.filter((c) => c.isPrimary).length,
      withCompany: allContacts.filter((c) => c.company).length
    };

    sendSuccess(res, { contacts: allContacts, stats });
  })
);

/**
 * POST /api/admin/contacts - Create a new contact
 */
router.post(
  '/contacts',
  authenticateToken,
  requireAdmin,
  invalidateCache(['contacts', 'clients']),
  validateRequest(AdminContactSchemas.create, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { clientId, name, email, phone, title, company: _company, isPrimary } = req.body;

    if (!clientId || !name || !email) {
      return errorResponse(res, 'clientId, name, and email are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const parsedClientId = parseInt(clientId, 10);
    if (isNaN(parsedClientId) || parsedClientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.INVALID_ID);
    }

    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const normalizedEmail = email.trim().toLowerCase();

    const normalizedPhone = phone ? phone.trim().replace(/[^\d+\-() ]/g, '') : '';

    const contact = await clientService.createContact(parsedClientId, {
      firstName,
      lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      title: title || '',
      role: 'general',
      isPrimary: isPrimary || false
    });

    sendCreated(res, { contact }, 'Contact created');
  })
);

/**
 * PUT /api/admin/contacts/:contactId - Update a contact
 */
router.put(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['contacts', 'clients']),
  validateRequest(AdminContactSchemas.update, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId, 10);
    const { isPrimary, firstName, lastName, email, phone, role } = req.body;

    if (isNaN(contactId) || contactId <= 0) {
      return errorResponse(res, 'Invalid contact ID', 400, ErrorCodes.INVALID_ID);
    }

    // Normalize email if provided
    const normalizedEmail = (email !== undefined && email) ? email.trim().toLowerCase() : email;

    // Normalize phone if provided
    if (phone !== undefined && phone) {
      req.body.phone = phone.trim().replace(/[^\d+\-() ]/g, '');
    }

    // Check if there are any fields to update
    if (isPrimary === undefined && firstName === undefined && lastName === undefined &&
        email === undefined && phone === undefined && role === undefined) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.NO_FIELDS);
    }

    const updatedContact = await clientService.updateContactAdmin(contactId, {
      isPrimary, firstName, lastName, email: normalizedEmail, phone, role
    });

    if (updatedContact?.client_id) {
      await QueryCache.invalidate([`client:${updatedContact.client_id}`]);
    }

    sendSuccess(res, { contact: updatedContact });
  })
);

/**
 * POST /api/admin/contacts/bulk-delete - Bulk delete contacts
 */
router.post(
  '/contacts/bulk-delete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['contacts', 'clients']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return errorResponse(res, 'contactIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const MAX_BATCH_SIZE = 100;
    if (contactIds.length > MAX_BATCH_SIZE) {
      return errorResponse(res, `Cannot delete more than ${MAX_BATCH_SIZE} contacts at once`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validIds = contactIds
      .map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
      .filter((id: number) => !isNaN(id) && id > 0);

    if (validIds.length === 0) {
      return sendSuccess(res, { deleted: 0 });
    }

    const adminEmail = req.user?.email || 'admin';
    const result = await softDeleteService.bulkSoftDelete('contact', validIds, adminEmail);

    sendSuccess(res, { deleted: result.deleted });
  })
);

export default router;
