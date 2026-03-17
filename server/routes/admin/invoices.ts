/**
 * ===============================================
 * ADMIN INVOICE ROUTES
 * ===============================================
 * @file server/routes/admin/invoices.ts
 *
 * Admin-only invoice listing, stats, and bulk operations.
 * Individual invoice CRUD is handled by /api/invoices routes.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { invalidateCache } from '../../middleware/cache.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';

const router = express.Router();

/**
 * GET /api/admin/invoices
 * List all invoices with client/project joins for admin management.
 */
router.get(
  '/invoices',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const invoices = await db.all(`
      SELECT
        i.id, i.invoice_number, i.status, i.amount_total, i.amount_paid,
        i.due_date, i.issued_date, i.paid_date, i.created_at,
        c.contact_name as client_name, c.company_name,
        p.project_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.deleted_at IS NULL
      ORDER BY i.created_at DESC
    `);

    const stats = await db.get(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) as draft,
        COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) as sent,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) as paid,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END), 0) as overdue,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN amount_total ELSE 0 END), 0) as outstanding_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paid ELSE 0 END), 0) as paid_amount
      FROM invoices
      WHERE deleted_at IS NULL
    `);

    sendSuccess(res, { invoices, stats });
  })
);

/**
 * POST /api/admin/invoices/bulk-delete
 * Soft-delete multiple invoices.
 */
router.post(
  '/invoices/bulk-delete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['invoices']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { invoiceIds } = req.body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return errorResponse(res, 'Invoice IDs are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const placeholders = invoiceIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE invoices SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [req.user?.email || 'admin', ...invoiceIds]
    );

    sendSuccess(res, { deleted: result.changes || 0 }, `Deleted ${result.changes || 0} invoices`);
  })
);

/**
 * POST /api/admin/invoices/bulk-status
 * Change status for multiple invoices.
 */
router.post(
  '/invoices/bulk-status',
  authenticateToken,
  requireAdmin,
  invalidateCache(['invoices']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { invoiceIds, status } = req.body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0 || !status) {
      return errorResponse(res, 'Invoice IDs and status are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const placeholders = invoiceIds.map(() => '?').join(',');
    const result = await db.run(
      `UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [status, ...invoiceIds]
    );

    sendSuccess(res, { updated: result.changes || 0 }, `Updated ${result.changes || 0} invoices to '${status}'`);
  })
);

export default router;
