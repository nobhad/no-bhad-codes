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
import { invalidateCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { deliverableService } from '../../services/deliverable-service.js';
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
    const { projectId, status } = req.query;

    const { deliverables, stats } = await deliverableService.listAdminDeliverablesWithDetails({
      projectId: projectId ? parseInt(projectId as string, 10) : undefined,
      status: status as string | undefined
    });

    sendSuccess(res, { deliverables, stats });
  })
);

/**
 * POST /api/admin/deliverables - Create a new deliverable
 */
router.post(
  '/deliverables',
  authenticateToken,
  requireAdmin,
  invalidateCache(['deliverables']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, title, description, type, reviewDeadline, tags } = req.body;

    if (!projectId || !title || !type) {
      return errorResponse(res, 'projectId, title, and type are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    const createdById = req.user?.id || 0;
    const deliverable = await deliverableService.createDeliverable(
      parsedProjectId,
      title,
      description || '',
      type,
      createdById,
      { reviewDeadline, tags }
    );

    sendCreated(res, { deliverable }, 'Deliverable created');
  })
);

/**
 * PUT /api/admin/deliverables/:id - Update a deliverable
 */
router.put(
  '/deliverables/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['deliverables']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.INVALID_ID);
    }

    const { status, title, description, due_date } = req.body;

    const hasFields = status !== undefined || title !== undefined
      || description !== undefined || due_date !== undefined;

    if (!hasFields) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.NO_FIELDS);
    }

    const updated = await deliverableService.updateAdminDeliverable(id, {
      status,
      title,
      description,
      due_date
    });

    sendSuccess(res, { deliverable: updated });
  })
);

/**
 * POST /api/admin/deliverables/bulk-delete - Bulk delete deliverables
 */
router.post(
  '/deliverables/bulk-delete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['deliverables']),
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
