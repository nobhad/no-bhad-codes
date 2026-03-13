/**
 * ===============================================
 * DELIVERABLES — CRUD
 * ===============================================
 * Client list, create, get, list-by-project, update,
 * lock/approve, request revision, delete.
 */

import { Router, Response } from 'express';
import { deliverableService } from '../../services/deliverable-service.js';
import { fileService } from '../../services/file-service.js';
import { errorResponse, sendSuccess, sendCreated, sendPaginated, parsePaginationQuery, ErrorCodes } from '../../utils/api-response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { logger } from '../../services/logger.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessProject, isUserAdmin } from '../../utils/access-control.js';
import { getDatabase } from '../../database/init.js';
import { validateRequest } from '../../middleware/validation.js';
import { DeliverableValidationSchemas, canAccessDeliverable } from './shared.js';

const router = Router();

// ===== CLIENT-SCOPED ROUTES =====

/**
 * @swagger
 * /api/deliverables/my:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get client deliverables
 *     description: Returns all deliverables for the authenticated client across all their projects.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of client deliverables
 *       403:
 *         description: Admin users should use admin endpoint
 */
router.get('/my', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (await isUserAdmin(req)) {
    return errorResponse(res, 'Admin users should use /api/admin/deliverables', 403, ErrorCodes.FORBIDDEN);
  }

  const clientId = req.user?.id;
  if (!clientId) {
    return errorResponse(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
  }

  const db = getDatabase();
  const deliverables = await db.all(
    `SELECT d.id, d.title, d.type, d.status, d.approval_status,
            d.review_deadline, d.round_number, d.created_at,
            p.project_name
     FROM deliverables d
     JOIN projects p ON d.project_id = p.id
     WHERE p.client_id = ? AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC`,
    [clientId]
  );

  sendSuccess(res, { deliverables });
}));

// ===== DELIVERABLE CRUD =====

/**
 * @swagger
 * /api/deliverables:
 *   post:
 *     tags: [Deliverables]
 *     summary: Create a new deliverable
 *     description: Creates a new deliverable for a project.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, title, type, createdById]
 *             properties:
 *               projectId:
 *                 type: integer
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *               createdById:
 *                 type: integer
 *               description:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               reviewDeadline:
 *                 type: string
 *               roundNumber:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Deliverable created
 *       404:
 *         description: Project not found
 */
router.post('/', validateRequest(DeliverableValidationSchemas.create, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, title, description, type, createdById, tags, reviewDeadline, roundNumber } =
    req.body;

  const parsedProjectId = parseInt(projectId, 10);
  if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
    return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Verify user can access this project
  if (!(await canAccessProject(req, parsedProjectId))) {
    return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const deliverable = await deliverableService.createDeliverable(
    projectId,
    title,
    description || '',
    type,
    createdById,
    { tags, reviewDeadline, roundNumber }
  );

  // Emit workflow event for deliverable submission
  await workflowTriggerService.emit('deliverable.submitted', {
    entityId: deliverable.id,
    triggeredBy: createdById?.toString() || 'system',
    projectId,
    title,
    type
  });

  sendCreated(res, { deliverable });
}));

/**
 * @swagger
 * /api/deliverables/{id}:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get deliverable by ID
 *     description: Returns a specific deliverable.
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
 *         description: Deliverable details
 *       404:
 *         description: Deliverable not found
 */
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const deliverable = await deliverableService.getDeliverableById(deliverableId);

  if (!deliverable) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  sendSuccess(res, { deliverable });
}));

/**
 * @swagger
 * /api/deliverables/projects/{projectId}/list:
 *   get:
 *     tags: [Deliverables]
 *     summary: List project deliverables
 *     description: Returns paginated deliverables for a specific project.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: roundNumber
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of deliverables
 *       404:
 *         description: Project not found
 */
router.get('/projects/:projectId/list', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { projectId } = req.params;
  const parsedProjectId = parseInt(projectId, 10);
  if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
    return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Verify user can access this project
  if (!(await canAccessProject(req, parsedProjectId))) {
    return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const { status, roundNumber } = req.query;
  const { page, perPage, limit, offset } = parsePaginationQuery(
    req.query as Record<string, unknown>
  );

  const result = await deliverableService.getProjectDeliverables(parsedProjectId, {
    status: status as string | undefined,
    roundNumber: roundNumber ? parseInt(roundNumber as string, 10) : undefined,
    limit,
    offset
  });

  sendPaginated(res, result.deliverables, { page, perPage, total: result.total });
}));

/**
 * @swagger
 * /api/deliverables/{id}:
 *   put:
 *     tags: [Deliverables]
 *     summary: Update a deliverable
 *     description: Updates an existing deliverable.
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
 *         description: Deliverable updated
 *       404:
 *         description: Deliverable not found
 */
router.put('/:id', validateRequest(DeliverableValidationSchemas.update, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const deliverable = await deliverableService.updateDeliverable(deliverableId, req.body);
    sendSuccess(res, { deliverable });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}/lock:
 *   post:
 *     tags: [Deliverables]
 *     summary: Approve and lock deliverable
 *     description: Final approval that locks a deliverable and archives the file to the Files tab.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewedById]
 *             properties:
 *               reviewedById:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Deliverable approved and locked
 *       404:
 *         description: Deliverable not found
 */
router.post('/:id/lock', validateRequest(DeliverableValidationSchemas.lockDeliverable, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { reviewedById } = req.body;

    if (!reviewedById) {
      return errorResponse(res, 'reviewedById is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const deliverable = await deliverableService.lockDeliverable(deliverableId, reviewedById);

    // Get the latest version file info for archiving
    const latestVersion = await deliverableService.getLatestVersion(deliverableId);

    let archivedFile = null;

    // Archive deliverable file to Files tab if version exists
    if (latestVersion) {
      try {
        // Create file entry in files table (category: deliverable, shared with client)
        archivedFile = await fileService.createFileFromDeliverable({
          projectId: deliverable.project_id,
          deliverableId: deliverableId,
          deliverableTitle: deliverable.title,
          filePath: latestVersion.file_path,
          fileName: latestVersion.file_name,
          fileSize: latestVersion.file_size,
          fileType: latestVersion.file_type,
          uploadedBy: reviewedById?.toString() || 'system'
        });

        // Update deliverable with archived file reference
        await deliverableService.setArchivedFileId(deliverableId, archivedFile.id);

        // Emit file.uploaded event for the archived file
        await workflowTriggerService.emit('file.uploaded', {
          entityId: archivedFile.id,
          triggeredBy: reviewedById?.toString() || 'system',
          projectId: deliverable.project_id,
          fileName: latestVersion.file_name,
          source: 'deliverable_archive',
          deliverableId: deliverableId
        });
      } catch (archiveError) {
        // Log but don't fail the lock operation if archiving fails
        logger.error('[Deliverables] Failed to archive deliverable file', {
          error: archiveError instanceof Error ? archiveError : new Error(String(archiveError)),
          category: 'DELIVERABLE'
        });
      }
    }

    // Emit workflow event for deliverable approval
    await workflowTriggerService.emit('deliverable.approved', {
      entityId: deliverableId,
      triggeredBy: reviewedById?.toString() || 'system',
      projectId: deliverable.project_id,
      archivedFileId: archivedFile?.id
    });

    sendSuccess(
      res,
      {
        deliverable,
        archivedFile: archivedFile
          ? { id: archivedFile.id, project_id: archivedFile.project_id }
          : null
      },
      'Deliverable approved and locked'
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}/revision:
 *   post:
 *     tags: [Deliverables]
 *     summary: Request revision on deliverable
 *     description: Requests a revision on a deliverable with a reason.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason, reviewedById]
 *             properties:
 *               reason:
 *                 type: string
 *               reviewedById:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Revision requested
 *       404:
 *         description: Deliverable not found
 */
router.post('/:id/revision', validateRequest(DeliverableValidationSchemas.requestRevision, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { reason, reviewedById } = req.body;

    if (!reason || !reviewedById) {
      return errorResponse(res, 'reason and reviewedById are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const deliverable = await deliverableService.requestRevision(
      deliverableId,
      reason,
      reviewedById
    );

    // Emit workflow event for deliverable rejection/revision request
    await workflowTriggerService.emit('deliverable.rejected', {
      entityId: deliverableId,
      triggeredBy: reviewedById?.toString() || 'system',
      reason
    });

    sendSuccess(res, { deliverable }, 'Revision requested');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}:
 *   delete:
 *     tags: [Deliverables]
 *     summary: Archive a deliverable
 *     description: Soft-deletes a deliverable.
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
 *         description: Deliverable archived
 *       404:
 *         description: Deliverable not found
 */
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  await deliverableService.deleteDeliverable(deliverableId);
  sendSuccess(res, undefined, 'Deliverable archived');
}));

export default router;
