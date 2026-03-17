/**
 * ===============================================
 * FEEDBACK PUBLIC ROUTES
 * ===============================================
 * @file server/routes/feedback/public.ts
 *
 * Unauthenticated endpoints for survey submission
 * and public testimonial access.
 *
 * GET    /survey/:token          — Get survey form data
 * POST   /survey/:token/submit   — Submit survey response
 * GET    /testimonials/public     — Published testimonials
 * GET    /testimonials/featured   — Featured testimonials
 */

import { Router, Response, Request } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { feedbackService } from '../../services/feedback-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

const router = Router();

/**
 * GET /api/feedback/survey/:token
 * Get survey data for the public form (no auth required).
 */
router.get(
  '/survey/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const survey = await feedbackService.getSurveyByToken(req.params.token);

    if (!survey) {
      errorResponse(res, 'Survey not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    // Only return safe, non-sensitive data
    sendSuccess(res, {
      survey: {
        id: survey.id,
        surveyType: survey.survey_type,
        status: survey.status,
        clientName: survey.clientName,
        projectName: survey.projectName,
        expiresAt: survey.expires_at,
        completed: survey.status === 'completed'
      }
    });
  })
);

/**
 * POST /api/feedback/survey/:token/submit
 * Submit a survey response (no auth required).
 */
router.post(
  '/survey/:token/submit',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await feedbackService.submitResponse(req.params.token, {
        overallRating: req.body.overallRating,
        npsScore: req.body.npsScore,
        communicationRating: req.body.communicationRating,
        qualityRating: req.body.qualityRating,
        timelinessRating: req.body.timelinessRating,
        highlights: req.body.highlights,
        improvements: req.body.improvements,
        testimonialText: req.body.testimonialText,
        testimonialApproved: req.body.testimonialApproved,
        allowNameUse: req.body.allowNameUse
      });

      sendSuccess(res, undefined, 'Thank you for your feedback');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * GET /api/feedback/testimonials/public
 * Get all published testimonials (no auth required).
 */
router.get(
  '/testimonials/public',
  asyncHandler(async (_req: Request, res: Response) => {
    const testimonials = await feedbackService.getPublicTestimonials();
    sendSuccess(res, { testimonials });
  })
);

/**
 * GET /api/feedback/testimonials/featured
 * Get featured published testimonials (no auth required).
 */
router.get(
  '/testimonials/featured',
  asyncHandler(async (_req: Request, res: Response) => {
    const testimonials = await feedbackService.getFeaturedTestimonials();
    sendSuccess(res, { testimonials });
  })
);

export default router;
