/**
 * ===============================================
 * ADMIN DESIGN REVIEWS ROUTES
 * ===============================================
 * @file server/routes/admin/design-reviews.ts
 *
 * Endpoints for managing design review items.
 * Design reviews are deliverables that require client approval.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { designReviewService } from '../../services/design-review-service.js';
import { invalidateCache } from '../../middleware/cache.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

/**
 * GET /api/admin/design-reviews - Get all design reviews
 * Design reviews are deliverables that are in review-related statuses
 */
router.get(
  '/design-reviews',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId } = req.query;

    const reviews = await designReviewService.getAll(projectId ? String(projectId) : undefined);

    // Calculate stats
    const stats = {
      total: reviews.length,
      pending: reviews.filter((r) => r.status === 'pending').length,
      inReview: reviews.filter((r) => r.status === 'in-review').length,
      approved: reviews.filter((r) => r.status === 'approved').length,
      revisionRequested: reviews.filter((r) => r.status === 'revision-requested').length
    };

    sendSuccess(res, { reviews, stats });
  })
);

/**
 * POST /api/admin/design-reviews - Create a new design review
 */
router.post(
  '/design-reviews',
  authenticateToken,
  requireAdmin,
  invalidateCache(['design-reviews']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, title, description, type, reviewDeadline } = req.body;

    if (!projectId || !title) {
      return errorResponse(res, 'Project ID and title are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const review = await designReviewService.create({
      projectId: parseInt(projectId, 10),
      title,
      description: description || null,
      type: type || 'design',
      reviewDeadline: reviewDeadline || null
    });

    sendSuccess(res, { review }, 'Design review created');
  })
);

/**
 * GET /api/admin/design-reviews/:reviewId - Get a specific design review
 */
router.get(
  '/design-reviews/:reviewId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const reviewId = parseInt(req.params.reviewId, 10);

    if (isNaN(reviewId) || reviewId <= 0) {
      return errorResponse(res, 'Invalid review ID', 400, ErrorCodes.INVALID_ID);
    }

    const review = await designReviewService.getById(reviewId);

    if (!review) {
      return errorResponse(res, 'Design review not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Get attachments
    const attachments = await designReviewService.getAttachments(reviewId);

    sendSuccess(res, { review: { ...review, attachments } });
  })
);

/**
 * PATCH /api/admin/design-reviews/:reviewId - Update review status
 */
router.patch(
  '/design-reviews/:reviewId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['design-reviews']),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const reviewId = parseInt(req.params.reviewId, 10);
    const { status } = req.body;

    if (isNaN(reviewId) || reviewId <= 0) {
      return errorResponse(res, 'Invalid review ID', 400, ErrorCodes.INVALID_ID);
    }

    const updated = await designReviewService.updateStatus(reviewId, status);

    sendSuccess(res, { review: updated });
  })
);

export default router;
