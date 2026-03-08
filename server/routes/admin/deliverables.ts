/**
 * ===============================================
 * ADMIN DELIVERABLES ROUTES
 * ===============================================
 * @file server/routes/admin/deliverables.ts
 *
 * Admin deliverable management endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';
import { softDeleteService } from '../../services/soft-delete-service.js';

const router = express.Router();

/**
 * GET /api/admin/deliverables - List all deliverables
 */
router.get(
  '/deliverables',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();
    const { projectId, status } = req.query;

    let query = `
      SELECT
        d.id,
        d.project_id as projectId,
        d.title,
        d.description,
        d.status,
        d.due_date as dueDate,
        d.completed_at as completedAt,
        d.created_at as createdAt,
        d.updated_at as updatedAt,
        p.project_name as projectName,
        c.company_name as clientName
      FROM deliverables d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.deleted_at IS NULL
        AND d.deleted_at IS NULL
    `;
    const params: (string | number)[] = [];

    if (projectId) {
      query += ' AND d.project_id = ?';
      params.push(parseInt(projectId as string, 10));
    }
    if (status) {
      query += ' AND d.status = ?';
      params.push(status as string);
    }

    query += ' ORDER BY d.due_date ASC, d.created_at DESC';

    const deliverables = await db.all(query, params);

    const stats = {
      total: deliverables.length,
      pending: deliverables.filter((d: { status: string }) => d.status === 'pending').length,
      inProgress: deliverables.filter((d: { status: string }) => d.status === 'in_progress').length,
      completed: deliverables.filter((d: { status: string }) => d.status === 'completed').length,
      approved: deliverables.filter((d: { status: string }) => d.status === 'approved').length
    };

    sendSuccess(res, { deliverables, stats });
  })
);

/**
 * POST /api/admin/deliverables/bulk-delete - Bulk delete deliverables
 */
router.post(
  '/deliverables/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { deliverableIds } = req.body;

    if (!deliverableIds || !Array.isArray(deliverableIds) || deliverableIds.length === 0) {
      return errorResponse(res, 'deliverableIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const adminEmail = req.user?.email || 'admin';
    const validIds = deliverableIds
      .map((id: string | number) => typeof id === 'string' ? parseInt(id, 10) : id)
      .filter((id: number) => !isNaN(id) && id > 0);

    const result = await softDeleteService.bulkSoftDelete('deliverable', validIds, adminEmail);

    sendSuccess(res, { deleted: result.deleted });
  })
);

export default router;
