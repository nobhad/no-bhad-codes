/**
 * Deliverable Routes
 * Admin and client APIs for deliverable upload, review, and approval
 */

import { Router, Request, Response } from 'express';
import { deliverableService } from '../services/deliverable-service.js';

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
      return res.status(400).json({ error: 'Missing required fields' });
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
    res.status(500).json({ error: 'Failed to create deliverable' });
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
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    res.json({ deliverable });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve deliverable' });
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
    res.status(500).json({ error: 'Failed to list deliverables' });
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
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to update deliverable' });
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
      return res.status(400).json({ error: 'reviewedById is required' });
    }

    const deliverable = await deliverableService.lockDeliverable(parseInt(id), reviewedById);
    res.json({ deliverable, message: 'Deliverable approved and locked' });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to lock deliverable' });
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
      return res.status(400).json({ error: 'reason and reviewedById are required' });
    }

    const deliverable = await deliverableService.requestRevision(parseInt(id), reason, reviewedById);
    res.json({ deliverable, message: 'Revision requested' });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to request revision' });
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
    res.status(500).json({ error: 'Failed to delete deliverable' });
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
      return res.status(400).json({ error: 'Missing required fields' });
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
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to upload version' });
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
    res.status(500).json({ error: 'Failed to list versions' });
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
      return res.status(404).json({ error: 'No versions found' });
    }

    res.json({ version });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve latest version' });
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
      return res.status(400).json({ error: 'authorId and text are required' });
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
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to add comment' });
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
    res.status(500).json({ error: 'Failed to list comments' });
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
      return res.status(404).json({ error: 'Comment not found' });
    }
    res.status(500).json({ error: 'Failed to resolve comment' });
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
    res.status(500).json({ error: 'Failed to delete comment' });
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
      return res.status(400).json({ error: 'name is required' });
    }

    const element = await deliverableService.createDesignElement(parseInt(id), name, description);
    res.status(201).json({ element });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to create design element' });
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
    res.status(500).json({ error: 'Failed to list design elements' });
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
      return res.status(400).json({ error: 'Invalid approval status' });
    }

    const element = await deliverableService.updateElementApprovalStatus(parseInt(elementId), status);
    res.json({ element });
  } catch (error: any) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Design element not found' });
    }
    res.status(500).json({ error: 'Failed to update element approval status' });
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
      return res.status(400).json({ error: 'reviewerId and decision are required' });
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
      return res.status(404).json({ error: 'Deliverable not found' });
    }
    res.status(500).json({ error: 'Failed to create review' });
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
    res.status(500).json({ error: 'Failed to list reviews' });
  }
});

export default router;
