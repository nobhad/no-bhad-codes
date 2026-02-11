/**
 * Deliverable Routes
 * Admin and client APIs for deliverable upload, review, and approval
 */

import { Router, Request, Response } from 'express';
import { deliverableService } from '../services/deliverable-service.js';
import { errorResponse } from '../utils/api-response.js';

const router = Router();

// ===== DELIVERABLE CRUD =====

/**
 * POST /api/v1/deliverables
 * Create new deliverable
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { projectId, title, description, type, createdById, tags, reviewDeadline, roundNumber } = req.body;

    if (!projectId || !title || !type || !createdById) {
      return errorResponse(res, 'Missing required fields', 400);
    }

    const deliverable = await deliverableService.createDeliverable(
      projectId,
      title,
      description || '',
      type,
      createdById,
      { tags, reviewDeadline, roundNumber }
    );

    res.status(201).json({ deliverable });
  } catch (error) {
    errorResponse(res, 'Failed to create deliverable', 500);
  }
});

/**
 * GET /api/v1/deliverables/:id
 * Get deliverable by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deliverable = await deliverableService.getDeliverableById(parseInt(id));

    if (!deliverable) {
      return errorResponse(res, 'Deliverable not found', 404);
    }

    res.json({ deliverable });
  } catch (error) {
    errorResponse(res, 'Failed to retrieve deliverable', 500);
  }
});

/**
 * GET /api/v1/projects/:projectId/deliverables
 * List project deliverables
 */
router.get('/projects/:projectId/list', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { status, roundNumber, limit = 50, offset = 0 } = req.query;

    const result = await deliverableService.getProjectDeliverables(parseInt(projectId), {
      status: status as string | undefined,
      roundNumber: roundNumber ? parseInt(roundNumber as string) : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({ deliverables: result.deliverables, pagination: { total: result.total } });
  } catch (error) {
    errorResponse(res, 'Failed to list deliverables', 500);
  }
});

/**
 * PUT /api/v1/deliverables/:id
 * Update deliverable
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deliverable = await deliverableService.updateDeliverable(parseInt(id), req.body);
    res.json({ deliverable });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to update deliverable', 500);
  }
});

/**
 * POST /api/v1/deliverables/:id/lock
 * Approve and lock deliverable (final approval)
 */
router.post('/:id/lock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewedById } = req.body;

    if (!reviewedById) {
      return errorResponse(res, 'reviewedById is required', 400);
    }

    const deliverable = await deliverableService.lockDeliverable(parseInt(id), reviewedById);
    res.json({ deliverable, message: 'Deliverable approved and locked' });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to lock deliverable', 500);
  }
});

/**
 * POST /api/v1/deliverables/:id/revision
 * Request revision on deliverable
 */
router.post('/:id/revision', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, reviewedById } = req.body;

    if (!reason || !reviewedById) {
      return errorResponse(res, 'reason and reviewedById are required', 400);
    }

    const deliverable = await deliverableService.requestRevision(parseInt(id), reason, reviewedById);
    res.json({ deliverable, message: 'Revision requested' });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to request revision', 500);
  }
});

/**
 * DELETE /api/v1/deliverables/:id
 * Archive deliverable (soft delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deliverableService.deleteDeliverable(parseInt(id));
    res.json({ message: 'Deliverable archived' });
  } catch (error) {
    errorResponse(res, 'Failed to delete deliverable', 500);
  }
});

// ===== VERSIONS =====

/**
 * POST /api/v1/deliverables/:id/versions
 * Upload new version
 */
router.post('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filePath, fileName, fileSize, fileType, uploadedById, changeNotes } = req.body;

    if (!filePath || !fileName || !uploadedById) {
      return errorResponse(res, 'Missing required fields', 400);
    }

    const version = await deliverableService.uploadVersion(
      parseInt(id),
      filePath,
      fileName,
      fileSize,
      fileType,
      uploadedById,
      changeNotes
    );

    res.status(201).json({ version });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to upload version', 500);
  }
});

/**
 * GET /api/v1/deliverables/:id/versions
 * Get all versions
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const versions = await deliverableService.getDeliverableVersions(parseInt(id));
    res.json({ versions });
  } catch (error) {
    errorResponse(res, 'Failed to list versions', 500);
  }
});

/**
 * GET /api/v1/deliverables/:id/versions/latest
 * Get latest version
 */
router.get('/:id/versions/latest', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const version = await deliverableService.getLatestVersion(parseInt(id));

    if (!version) {
      return errorResponse(res, 'No versions found', 404);
    }

    res.json({ version });
  } catch (error) {
    errorResponse(res, 'Failed to retrieve latest version', 500);
  }
});

// ===== COMMENTS & ANNOTATIONS =====

/**
 * POST /api/v1/deliverables/:id/comments
 * Add comment or annotation
 */
router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { authorId, text, x, y, annotationType, elementId } = req.body;

    if (!authorId || !text) {
      return errorResponse(res, 'authorId and text are required', 400);
    }

    const comment = await deliverableService.addComment(
      parseInt(id),
      authorId,
      text,
      { x, y, annotationType, elementId }
    );

    res.status(201).json({ comment });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to add comment', 500);
  }
});

/**
 * GET /api/v1/deliverables/:id/comments
 * Get all comments
 */
router.get('/:id/comments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolved, elementId } = req.query;

    const comments = await deliverableService.getDeliverableComments(parseInt(id), {
      resolved: resolved === 'true',
      elementId: elementId as string
    });

    res.json({ comments });
  } catch (error) {
    errorResponse(res, 'Failed to list comments', 500);
  }
});

/**
 * PATCH /api/v1/deliverables/:deliverableId/comments/:commentId/resolve
 * Mark comment as resolved
 */
router.patch('/:deliverableId/comments/:commentId/resolve', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const comment = await deliverableService.resolveComment(parseInt(commentId));
    res.json({ comment });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Comment not found', 404);
    }
    errorResponse(res, 'Failed to resolve comment', 500);
  }
});

/**
 * DELETE /api/v1/deliverables/:deliverableId/comments/:commentId
 * Delete comment
 */
router.delete('/:deliverableId/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    await deliverableService.deleteComment(parseInt(commentId));
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    errorResponse(res, 'Failed to delete comment', 500);
  }
});

// ===== DESIGN ELEMENTS =====

/**
 * POST /api/v1/deliverables/:id/elements
 * Create design element
 */
router.post('/:id/elements', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return errorResponse(res, 'name is required', 400);
    }

    const element = await deliverableService.createDesignElement(parseInt(id), name, description);
    res.status(201).json({ element });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to create design element', 500);
  }
});

/**
 * GET /api/v1/deliverables/:id/elements
 * Get all design elements
 */
router.get('/:id/elements', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const elements = await deliverableService.getDeliverableElements(parseInt(id));
    res.json({ elements });
  } catch (error) {
    errorResponse(res, 'Failed to list design elements', 500);
  }
});

/**
 * PATCH /api/v1/deliverables/:deliverableId/elements/:elementId/approval
 * Update element approval status
 */
router.patch('/:deliverableId/elements/:elementId/approval', async (req: Request, res: Response) => {
  try {
    const { elementId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'revision_needed'].includes(status)) {
      return errorResponse(res, 'Invalid approval status', 400);
    }

    const element = await deliverableService.updateElementApprovalStatus(parseInt(elementId), status);
    res.json({ element });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Design element not found', 404);
    }
    errorResponse(res, 'Failed to update element approval status', 500);
  }
});

// ===== REVIEWS =====

/**
 * POST /api/v1/deliverables/:id/reviews
 * Create review
 */
router.post('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewerId, decision, feedback, elementsReviewed } = req.body;

    if (!reviewerId || !decision) {
      return errorResponse(res, 'reviewerId and decision are required', 400);
    }

    const review = await deliverableService.createReview(
      parseInt(id),
      reviewerId,
      decision,
      feedback,
      elementsReviewed
    );

    res.status(201).json({ review });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404);
    }
    errorResponse(res, 'Failed to create review', 500);
  }
});

/**
 * GET /api/v1/deliverables/:id/reviews
 * Get all reviews
 */
router.get('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviews = await deliverableService.getDeliverableReviews(parseInt(id));
    res.json({ reviews });
  } catch (error) {
    errorResponse(res, 'Failed to list reviews', 500);
  }
});

export default router;
