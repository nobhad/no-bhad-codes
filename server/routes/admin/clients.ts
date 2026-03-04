/**
 * ===============================================
 * ADMIN CLIENTS ROUTES
 * ===============================================
 * @file server/routes/admin/clients.ts
 *
 * Admin client listing endpoint.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';

const router = express.Router();

/**
 * GET /api/admin/clients - List all clients
 */
router.get(
  '/clients',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const clients = await db.all(`
      SELECT
        c.id,
        c.company_name as companyName,
        c.contact_name as contactName,
        c.email,
        c.phone,
        c.status,
        c.client_type as clientType,
        c.created_at as createdAt,
        c.updated_at as updatedAt,
        (SELECT COUNT(*) FROM projects WHERE client_id = c.id AND deleted_at IS NULL) as projectCount,
        (SELECT COUNT(*) FROM invoices WHERE client_id = c.id AND deleted_at IS NULL) as invoiceCount
      FROM clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `);

    const stats = {
      total: clients.length,
      active: clients.filter((c: { status: string }) => c.status === 'active').length,
      pending: clients.filter((c: { status: string }) => c.status === 'pending').length,
      inactive: clients.filter((c: { status: string }) => c.status === 'inactive').length
    };

    sendSuccess(res, { clients, stats });
  })
);

export default router;
