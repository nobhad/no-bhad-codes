/**
 * ===============================================
 * DELIVERABLES — COMMENTS & ANNOTATIONS
 * ===============================================
 * Add, list, resolve, and delete comments/annotations.
 */

import { Router, Response } from 'express';
import { deliverableService } from '../../services/deliverable-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import { invalidateCache } from '../../middleware/cache.js';
import { DeliverableValidationSchemas, canAccessDeliverable } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/deliverables/{id}/comments:
 *   post:
 *     tags: [Deliverables]
 *     summary: Add comment or annotation
 *     description: Adds a comment or visual annotation to a deliverable.
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
 *             required: [authorId, text]
 *             properties:
 *               authorId:
 *                 type: integer
 *               text:
 *                 type: string
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 *               annotationType:
 *                 type: string
 *               elementId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 */
router.post('/:id/comments', validateRequest(DeliverableValidationSchemas.addComment, { allowUnknownFields: true }), invalidateCache(['deliverables']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

    const { authorId, text, x, y, annotationType, elementId } = req.body;

    if (!authorId || !text) {
      return errorResponse(res, 'authorId and text are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const comment = await deliverableService.addComment(deliverableId, authorId, text, {
      x,
      y,
      annotationType,
      elementId
    });

    sendCreated(res, { comment });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}/comments:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get all comments
 *     description: Returns all comments and annotations for a deliverable.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: resolved
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: elementId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 */
router.get('/:id/comments', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const { resolved, elementId } = req.query;

  const comments = await deliverableService.getDeliverableComments(deliverableId, {
    resolved: resolved === 'true',
    elementId: elementId as string
  });

  sendSuccess(res, { comments });
}));

/**
 * @swagger
 * /api/deliverables/{deliverableId}/comments/{commentId}/resolve:
 *   patch:
 *     tags: [Deliverables]
 *     summary: Resolve a comment
 *     description: Marks a comment as resolved.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliverableId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment resolved
 *       404:
 *         description: Comment not found
 */
router.patch(
  '/:deliverableId/comments/:commentId/resolve',
  invalidateCache(['deliverables']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
        return errorResponse(res, 'Invalid ID parameters', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Check authorization
      if (!(await canAccessDeliverable(req, parsedDeliverableId))) {
        return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Verify comment belongs to this deliverable
      const existingComment = await deliverableService.getCommentById(parsedCommentId);
      if (!existingComment || existingComment.deliverable_id !== parsedDeliverableId) {
        return errorResponse(res, 'Comment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const comment = await deliverableService.resolveComment(parsedCommentId);
      sendSuccess(res, { comment });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(res, 'Comment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/deliverables/{deliverableId}/comments/{commentId}:
 *   delete:
 *     tags: [Deliverables]
 *     summary: Delete a comment
 *     description: Deletes a comment from a deliverable.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliverableId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment deleted
 *       404:
 *         description: Comment not found
 */
router.delete(
  '/:deliverableId/comments/:commentId',
  invalidateCache(['deliverables']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { deliverableId, commentId } = req.params;
    const parsedDeliverableId = parseInt(deliverableId, 10);
    const parsedCommentId = parseInt(commentId, 10);
    if (
      isNaN(parsedDeliverableId) ||
      parsedDeliverableId <= 0 ||
      isNaN(parsedCommentId) ||
      parsedCommentId <= 0
    ) {
      return errorResponse(res, 'Invalid ID parameters', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, parsedDeliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Verify comment belongs to this deliverable
    const existingComment = await deliverableService.getCommentById(parsedCommentId);
    if (!existingComment || existingComment.deliverable_id !== parsedDeliverableId) {
      return errorResponse(res, 'Comment not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await deliverableService.deleteComment(parsedCommentId);
    sendSuccess(res, undefined, 'Comment deleted');
  })
);

export default router;
