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
import { errorResponse, sendSuccess } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';

const CLIENT_CONTACT_COLUMNS = `
  id, client_id, first_name, last_name, email, phone, title, department,
  role, is_primary, notes, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

/**
 * GET /api/admin/contacts - List all contacts across all clients
 * Includes both explicit client_contacts AND the client's own contact info
 */
router.get(
  '/contacts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const explicitContacts = await db.all(`
      SELECT
        cc.id,
        cc.first_name as firstName,
        cc.last_name as lastName,
        cc.email,
        cc.phone,
        cc.role,
        cc.is_primary as isPrimary,
        'active' as status,
        cc.client_id as clientId,
        c.company_name as company,
        c.company_name as clientName,
        cc.created_at as createdAt,
        cc.updated_at as updatedAt
      FROM client_contacts cc
      JOIN clients c ON cc.client_id = c.id
      WHERE c.deleted_at IS NULL
      ORDER BY cc.is_primary DESC, cc.created_at DESC
    `);

    const clientContacts = await db.all(`
      SELECT
        c.id,
        c.contact_name,
        c.email,
        c.phone,
        c.company_name as company,
        c.status,
        c.created_at as createdAt,
        c.updated_at as updatedAt
      FROM clients c
      WHERE c.deleted_at IS NULL
    `);

    const clientIdsWithContacts = new Set(
      explicitContacts.map((c: { clientId: number }) => c.clientId)
    );

    type ContactRow = Record<string, unknown>;
    const allContacts: ContactRow[] = [];

    for (const c of explicitContacts as ContactRow[]) {
      allContacts.push({
        ...c,
        isPrimary: c.isPrimary === 1
      });
    }

    for (const client of clientContacts as ContactRow[]) {
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
        status: 'active',
        clientId: client.id,
        company: client.company,
        clientName: client.company,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt
      });
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
 * PATCH /api/admin/contacts/:contactId - Update a contact
 */
router.patch(
  '/contacts/:contactId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const contactId = parseInt(req.params.contactId);
    const { isPrimary, firstName, lastName, email, phone, role } = req.body;

    if (isNaN(contactId)) {
      return errorResponse(res, 'Invalid contact ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (isPrimary !== undefined) {
      if (isPrimary) {
        const contact = await db.get('SELECT client_id FROM client_contacts WHERE id = ?', [contactId]);
        if (contact) {
          await db.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ?', [contact.client_id]);
        }
      }
      updates.push('is_primary = ?');
      values.push(isPrimary ? 1 : 0);
    }
    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No fields to update', 400, 'NO_FIELDS');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(contactId);

    await db.run(
      `UPDATE client_contacts SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updatedContact = await db.get(
      `SELECT ${CLIENT_CONTACT_COLUMNS} FROM client_contacts WHERE id = ?`,
      [contactId]
    );

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
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { contactIds } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return errorResponse(res, 'contactIds array is required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const db = getDatabase();
    let deleted = 0;

    for (const contactId of contactIds) {
      const id = typeof contactId === 'string' ? parseInt(contactId, 10) : contactId;
      if (isNaN(id)) continue;

      const result = await db.run('DELETE FROM client_contacts WHERE id = ?', [id]);
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    sendSuccess(res, { deleted });
  })
);

export default router;
