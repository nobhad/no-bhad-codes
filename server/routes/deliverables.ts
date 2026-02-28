/**
 * Deliverable Routes
 * Admin and client APIs for deliverable upload, review, and approval
 */

import { Router, Response } from 'express';
import { deliverableService } from '../services/deliverable-service.js';
import { fileService } from '../services/file-service.js';
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';
import { workflowTriggerService } from '../services/workflow-trigger-service.js';
import { logger } from '../services/logger.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessProject, isUserAdmin } from '../middleware/access-control.js';
import { getDatabase } from '../database/init.js';

const router = Router();

// All deliverable routes require authentication
router.use(authenticateToken);

/**
 * Helper to check if user can access a deliverable
 */
async function canAccessDeliverable(
  req: AuthenticatedRequest,
  deliverableId: number
): Promise<boolean> {
  if (await isUserAdmin(req)) return true;
  const db = getDatabase();
  const row = await db.get(
    `SELECT d.project_id FROM deliverables d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id = ? AND p.client_id = ? AND d.deleted_at IS NULL`,
    [deliverableId, req.user?.id]
  );
  return !!row;
}

// ===== DELIVERABLE CRUD =====

/**
 * POST /api/v1/deliverables
 * Create new deliverable
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, title, description, type, createdById, tags, reviewDeadline, roundNumber } =
      req.body;

    if (!projectId || !title || !type || !createdById) {
      return errorResponse(res, 'Missing required fields', 400, 'VALIDATION_ERROR');
    }

    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }

    // Verify user can access this project
    if (!(await canAccessProject(req, parsedProjectId))) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
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
      type,
    });

    sendCreated(res, { deliverable });
  } catch (error) {
    logger.error('[Deliverables] Failed to create deliverable', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to create deliverable', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/deliverables/:id
 * Get deliverable by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const deliverable = await deliverableService.getDeliverableById(deliverableId);

    if (!deliverable) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    sendSuccess(res, { deliverable });
  } catch (error) {
    logger.error('[Deliverables] Failed to retrieve deliverable', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to retrieve deliverable', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/projects/:projectId/deliverables
 * List project deliverables
 */
router.get('/projects/:projectId/list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId) || parsedProjectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, 'VALIDATION_ERROR');
    }

    // Verify user can access this project
    if (!(await canAccessProject(req, parsedProjectId))) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { status, roundNumber, limit = '50', offset = '0' } = req.query;
    const parsedLimit = parseInt(limit as string, 10);
    const parsedOffset = parseInt(offset as string, 10);
    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return errorResponse(res, 'Invalid pagination parameters', 400, 'VALIDATION_ERROR');
    }

    const result = await deliverableService.getProjectDeliverables(parsedProjectId, {
      status: status as string | undefined,
      roundNumber: roundNumber ? parseInt(roundNumber as string, 10) : undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    sendSuccess(res, { deliverables: result.deliverables, pagination: { total: result.total } });
  } catch (error) {
    logger.error('[Deliverables] Failed to list deliverables', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to list deliverables', 500, 'INTERNAL_ERROR');
  }
});

/**
 * PUT /api/v1/deliverables/:id
 * Update deliverable
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const deliverable = await deliverableService.updateDeliverable(deliverableId, req.body);
    sendSuccess(res, { deliverable });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to update deliverable', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to update deliverable', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/deliverables/:id/lock
 * Approve and lock deliverable (final approval)
 * Also archives the deliverable file to the Files tab
 */
router.post('/:id/lock', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { reviewedById } = req.body;

    if (!reviewedById) {
      return errorResponse(res, 'reviewedById is required', 400, 'VALIDATION_ERROR');
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
          uploadedBy: reviewedById?.toString() || 'system',
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
          deliverableId: deliverableId,
        });
      } catch (archiveError) {
        // Log but don't fail the lock operation if archiving fails
        logger.error('[Deliverables] Failed to archive deliverable file', {
          error: archiveError instanceof Error ? archiveError : new Error(String(archiveError)),
          category: 'DELIVERABLE',
        });
      }
    }

    // Emit workflow event for deliverable approval
    await workflowTriggerService.emit('deliverable.approved', {
      entityId: deliverableId,
      triggeredBy: reviewedById?.toString() || 'system',
      projectId: deliverable.project_id,
      archivedFileId: archivedFile?.id,
    });

    sendSuccess(
      res,
      {
        deliverable,
        archivedFile: archivedFile
          ? { id: archivedFile.id, project_id: archivedFile.project_id }
          : null,
      },
      'Deliverable approved and locked'
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to lock deliverable', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to lock deliverable', 500, 'INTERNAL_ERROR');
  }
});

/**
 * POST /api/v1/deliverables/:id/revision
 * Request revision on deliverable
 */
router.post('/:id/revision', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { reason, reviewedById } = req.body;

    if (!reason || !reviewedById) {
      return errorResponse(res, 'reason and reviewedById are required', 400, 'VALIDATION_ERROR');
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
      reason,
    });

    sendSuccess(res, { deliverable }, 'Revision requested');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to request revision', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to request revision', 500, 'INTERNAL_ERROR');
  }
});

/**
 * DELETE /api/v1/deliverables/:id
 * Archive deliverable (soft delete)
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    await deliverableService.deleteDeliverable(deliverableId);
    sendSuccess(res, undefined, 'Deliverable archived');
  } catch (error) {
    logger.error('[Deliverables] Failed to delete deliverable', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to delete deliverable', 500, 'INTERNAL_ERROR');
  }
});

// ===== VERSIONS =====

/**
 * POST /api/v1/deliverables/:id/versions
 * Upload new version
 */
router.post('/:id/versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { filePath, fileName, fileSize, fileType, uploadedById, changeNotes } = req.body;

    if (!filePath || !fileName || !uploadedById) {
      return errorResponse(res, 'Missing required fields', 400, 'VALIDATION_ERROR');
    }

    const version = await deliverableService.uploadVersion(
      deliverableId,
      filePath,
      fileName,
      fileSize,
      fileType,
      uploadedById,
      changeNotes
    );

    sendCreated(res, { version });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to upload version', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to upload version', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/deliverables/:id/versions
 * Get all versions
 */
router.get('/:id/versions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const versions = await deliverableService.getDeliverableVersions(deliverableId);
    sendSuccess(res, { versions });
  } catch (error) {
    logger.error('[Deliverables] Failed to list versions', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to list versions', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/deliverables/:id/versions/latest
 * Get latest version
 */
router.get('/:id/versions/latest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const version = await deliverableService.getLatestVersion(deliverableId);

    if (!version) {
      return errorResponse(res, 'No versions found', 404, 'RESOURCE_NOT_FOUND');
    }

    sendSuccess(res, { version });
  } catch (error) {
    logger.error('[Deliverables] Failed to retrieve latest version', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to retrieve latest version', 500, 'INTERNAL_ERROR');
  }
});

// ===== COMMENTS & ANNOTATIONS =====

/**
 * POST /api/v1/deliverables/:id/comments
 * Add comment or annotation
 */
router.post('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { authorId, text, x, y, annotationType, elementId } = req.body;

    if (!authorId || !text) {
      return errorResponse(res, 'authorId and text are required', 400, 'VALIDATION_ERROR');
    }

    const comment = await deliverableService.addComment(deliverableId, authorId, text, {
      x,
      y,
      annotationType,
      elementId,
    });

    sendCreated(res, { comment });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to add comment', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to add comment', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/deliverables/:id/comments
 * Get all comments
 */
router.get('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { resolved, elementId } = req.query;

    const comments = await deliverableService.getDeliverableComments(deliverableId, {
      resolved: resolved === 'true',
      elementId: elementId as string,
    });

    sendSuccess(res, { comments });
  } catch (error) {
    logger.error('[Deliverables] Failed to list comments', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to list comments', 500, 'INTERNAL_ERROR');
  }
});

/**
 * PATCH /api/v1/deliverables/:deliverableId/comments/:commentId/resolve
 * Mark comment as resolved
 */
router.patch(
  '/:deliverableId/comments/:commentId/resolve',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deliverableId, commentId } = req.params;
      const parsedDeliverableId = parseInt(deliverableId, 10);
      const parsedCommentId = parseInt(commentId, 10);
      if (
        isNaN(parsedDeliverableId) ||
        parsedDeliverableId <= 0 ||
        isNaN(parsedCommentId) ||
        parsedCommentId <= 0
      ) {
        return errorResponse(res, 'Invalid ID parameters', 400, 'VALIDATION_ERROR');
      }

      // Check authorization
      if (!(await canAccessDeliverable(req, parsedDeliverableId))) {
        return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Verify comment belongs to this deliverable
      const existingComment = await deliverableService.getCommentById(parsedCommentId);
      if (!existingComment || existingComment.deliverable_id !== parsedDeliverableId) {
        return errorResponse(res, 'Comment not found', 404, 'RESOURCE_NOT_FOUND');
      }

      const comment = await deliverableService.resolveComment(parsedCommentId);
      sendSuccess(res, { comment });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(res, 'Comment not found', 404, 'RESOURCE_NOT_FOUND');
      }
      logger.error('[Deliverables] Failed to resolve comment', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'DELIVERABLE',
      });
      errorResponse(res, 'Failed to resolve comment', 500, 'INTERNAL_ERROR');
    }
  }
);

/**
 * DELETE /api/v1/deliverables/:deliverableId/comments/:commentId
 * Delete comment
 */
router.delete(
  '/:deliverableId/comments/:commentId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deliverableId, commentId } = req.params;
      const parsedDeliverableId = parseInt(deliverableId, 10);
      const parsedCommentId = parseInt(commentId, 10);
      if (
        isNaN(parsedDeliverableId) ||
        parsedDeliverableId <= 0 ||
        isNaN(parsedCommentId) ||
        parsedCommentId <= 0
      ) {
        return errorResponse(res, 'Invalid ID parameters', 400, 'VALIDATION_ERROR');
      }

      // Check authorization
      if (!(await canAccessDeliverable(req, parsedDeliverableId))) {
        return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Verify comment belongs to this deliverable
      const existingComment = await deliverableService.getCommentById(parsedCommentId);
      if (!existingComment || existingComment.deliverable_id !== parsedDeliverableId) {
        return errorResponse(res, 'Comment not found', 404, 'RESOURCE_NOT_FOUND');
      }

      await deliverableService.deleteComment(parsedCommentId);
      sendSuccess(res, undefined, 'Comment deleted');
    } catch (error) {
      logger.error('[Deliverables] Failed to delete comment', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'DELIVERABLE',
      });
      errorResponse(res, 'Failed to delete comment', 500, 'INTERNAL_ERROR');
    }
  }
);

// ===== DESIGN ELEMENTS =====

/**
 * POST /api/v1/deliverables/:id/elements
 * Create design element
 */
router.post('/:id/elements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { name, description } = req.body;

    if (!name) {
      return errorResponse(res, 'name is required', 400, 'VALIDATION_ERROR');
    }

    const element = await deliverableService.createDesignElement(deliverableId, name, description);
    sendCreated(res, { element });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to create design element', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to create design element', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/deliverables/:id/elements
 * Get all design elements
 */
router.get('/:id/elements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const elements = await deliverableService.getDeliverableElements(deliverableId);
    sendSuccess(res, { elements });
  } catch (error) {
    logger.error('[Deliverables] Failed to list design elements', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to list design elements', 500, 'INTERNAL_ERROR');
  }
});

/**
 * PATCH /api/v1/deliverables/:deliverableId/elements/:elementId/approval
 * Update element approval status
 */
router.patch(
  '/:deliverableId/elements/:elementId/approval',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deliverableId, elementId } = req.params;
      const parsedDeliverableId = parseInt(deliverableId, 10);
      const parsedElementId = parseInt(elementId, 10);
      if (
        isNaN(parsedDeliverableId) ||
        parsedDeliverableId <= 0 ||
        isNaN(parsedElementId) ||
        parsedElementId <= 0
      ) {
        return errorResponse(res, 'Invalid ID parameters', 400, 'VALIDATION_ERROR');
      }

      // Check authorization
      if (!(await canAccessDeliverable(req, parsedDeliverableId))) {
        return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
      }

      // Verify element belongs to this deliverable
      const existingElement = await deliverableService.getDesignElementById(parsedElementId);
      if (!existingElement || existingElement.deliverable_id !== parsedDeliverableId) {
        return errorResponse(res, 'Design element not found', 404, 'RESOURCE_NOT_FOUND');
      }

      const { status } = req.body;

      if (!['pending', 'approved', 'revision_needed'].includes(status)) {
        return errorResponse(res, 'Invalid approval status', 400, 'VALIDATION_ERROR');
      }

      const element = await deliverableService.updateElementApprovalStatus(parsedElementId, status);
      sendSuccess(res, { element });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(res, 'Design element not found', 404, 'RESOURCE_NOT_FOUND');
      }
      logger.error('[Deliverables] Failed to update element approval status', {
        error: error instanceof Error ? error : new Error(String(error)),
        category: 'DELIVERABLE',
      });
      errorResponse(res, 'Failed to update element approval status', 500, 'INTERNAL_ERROR');
    }
  }
);

// ===== REVIEWS =====

/**
 * POST /api/v1/deliverables/:id/reviews
 * Create review
 */
router.post('/:id/reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { reviewerId, decision, feedback, elementsReviewed } = req.body;

    if (!reviewerId || !decision) {
      return errorResponse(res, 'reviewerId and decision are required', 400, 'VALIDATION_ERROR');
    }

    const review = await deliverableService.createReview(
      deliverableId,
      reviewerId,
      decision,
      feedback,
      elementsReviewed
    );

    sendCreated(res, { review });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }
    logger.error('[Deliverables] Failed to create review', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to create review', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/v1/deliverables/:id/reviews
 * Get all reviews
 */
router.get('/:id/reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, 'VALIDATION_ERROR');
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const reviews = await deliverableService.getDeliverableReviews(deliverableId);
    sendSuccess(res, { reviews });
  } catch (error) {
    logger.error('[Deliverables] Failed to list reviews', {
      error: error instanceof Error ? error : new Error(String(error)),
      category: 'DELIVERABLE',
    });
    errorResponse(res, 'Failed to list reviews', 500, 'INTERNAL_ERROR');
  }
});

export default router;
