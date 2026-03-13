/**
 * ===============================================
 * DELIVERABLES — REVIEWS
 * ===============================================
 * Create and list deliverable reviews.
 */

import { Router, Response } from 'express';
import { deliverableService } from '../../services/deliverable-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import { DeliverableValidationSchemas, canAccessDeliverable } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/deliverables/{id}/reviews:
 *   post:
 *     tags: [Deliverables]
 *     summary: Create a review
 *     description: Creates a review for a deliverable with a decision.
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
 *             required: [reviewerId, decision]
 *             properties:
 *               reviewerId:
 *                 type: integer
 *               decision:
 *                 type: string
 *                 enum: [approved, revision_needed, rejected]
 *               feedback:
 *                 type: string
 *               elementsReviewed:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Review created
 */
router.post('/:id/reviews', validateRequest(DeliverableValidationSchemas.createReview, { allowUnknownFields: true }), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

    const { reviewerId, decision, feedback, elementsReviewed } = req.body;

    if (!reviewerId || !decision) {
      return errorResponse(res, 'reviewerId and decision are required', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}/reviews:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get all reviews
 *     description: Returns all reviews for a deliverable.
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
 *         description: List of reviews
 */
router.get('/:id/reviews', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const reviews = await deliverableService.getDeliverableReviews(deliverableId);
  sendSuccess(res, { reviews });
}));

export default router;
