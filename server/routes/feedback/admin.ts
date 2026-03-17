/**
 * ===============================================
 * FEEDBACK ADMIN ROUTES
 * ===============================================
 * @file server/routes/feedback/admin.ts
 *
 * Admin endpoints for managing surveys and testimonials.
 *
 * POST   /                          — Send survey
 * GET    /surveys                   — List all surveys
 * GET    /analytics                 — NPS and rating analytics
 * GET    /testimonials              — List testimonials
 * POST   /testimonials              — Create testimonial manually
 * PUT    /testimonials/:id          — Update testimonial
 * DELETE /testimonials/:id          — Delete testimonial
 * PUT    /testimonials/:id/publish  — Publish testimonial
 * PUT    /testimonials/:id/feature  — Toggle featured
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { feedbackService } from '../../services/feedback-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * POST /api/feedback
 * Send a feedback survey to a client.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { clientId, projectId, surveyType, expiryDays } = req.body;

    if (!clientId) {
      errorResponse(res, 'clientId is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const survey = await feedbackService.sendSurvey({
      clientId,
      projectId,
      surveyType: surveyType || 'project_completion',
      expiryDays
    });

    sendCreated(res, { survey }, 'Survey sent');
  })
);

/**
 * GET /api/feedback/surveys
 * List all surveys with optional filters.
 */
router.get(
  '/surveys',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;
    const surveyType = req.query.surveyType as string | undefined;
    const surveys = await feedbackService.listSurveys({ status, surveyType });
    sendSuccess(res, { surveys });
  })
);

/**
 * GET /api/feedback/analytics
 * Get NPS score, average ratings, and completion stats.
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const analytics = await feedbackService.getAnalytics();
    sendSuccess(res, { analytics });
  })
);

/**
 * GET /api/feedback/testimonials
 * List all testimonials with optional status filter.
 */
router.get(
  '/testimonials',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const status = req.query.status as string | undefined;
    const featured = req.query.featured === 'true' ? true : undefined;
    const testimonials = await feedbackService.listTestimonials({ status, featured });
    sendSuccess(res, { testimonials });
  })
);

/**
 * POST /api/feedback/testimonials
 * Create a testimonial manually.
 */
router.post(
  '/testimonials',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { clientId, projectId, text, clientName, companyName, rating } = req.body;

    if (!clientId || !text || !clientName) {
      errorResponse(res, 'clientId, text, and clientName are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const testimonialId = await feedbackService.createTestimonial({
      clientId,
      projectId,
      text,
      clientName,
      companyName,
      rating
    });

    sendCreated(res, { testimonialId }, 'Testimonial created');
  })
);

/**
 * PUT /api/feedback/testimonials/:id
 * Update a testimonial.
 */
router.put(
  '/testimonials/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await feedbackService.updateTestimonial(Number(req.params.id), req.body);
    sendSuccess(res, undefined, 'Testimonial updated');
  })
);

/**
 * DELETE /api/feedback/testimonials/:id
 * Delete a testimonial.
 */
router.delete(
  '/testimonials/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await feedbackService.deleteTestimonial(Number(req.params.id));
    sendSuccess(res, undefined, 'Testimonial deleted');
  })
);

/**
 * PUT /api/feedback/testimonials/:id/publish
 * Publish a testimonial.
 */
router.put(
  '/testimonials/:id/publish',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await feedbackService.publishTestimonial(Number(req.params.id));
    sendSuccess(res, undefined, 'Testimonial published');
  })
);

/**
 * PUT /api/feedback/testimonials/:id/feature
 * Toggle featured flag on a testimonial.
 */
router.put(
  '/testimonials/:id/feature',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    await feedbackService.toggleFeatured(Number(req.params.id));
    sendSuccess(res, undefined, 'Featured toggled');
  })
);

export default router;
