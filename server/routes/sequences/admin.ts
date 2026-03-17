/**
 * ===============================================
 * EMAIL SEQUENCE ADMIN ROUTES
 * ===============================================
 * @file server/routes/sequences/admin.ts
 *
 * Admin endpoints for managing email drip sequences.
 *
 * Sequence CRUD:
 * GET    /                            — List all sequences with enrollment counts
 * POST   /                            — Create sequence with steps
 * GET    /:id                         — Get sequence with full steps
 * PUT    /:id                         — Update sequence metadata
 * DELETE /:id                         — Delete sequence (stops enrollments)
 *
 * Steps:
 * POST   /:id/steps                   — Add step to sequence
 * PUT    /:id/steps/:stepId           — Update step
 * DELETE /:id/steps/:stepId           — Delete step
 * PUT    /:id/steps/reorder           — Reorder steps
 *
 * Enrollments:
 * GET    /:id/enrollments             — List enrollments for sequence
 * POST   /:id/enroll                  — Manual enroll entity
 * POST   /enrollments/:enrollmentId/stop    — Stop enrollment
 * POST   /enrollments/:enrollmentId/pause   — Pause enrollment
 * POST   /enrollments/:enrollmentId/resume  — Resume enrollment
 *
 * Analytics:
 * GET    /:id/analytics               — Step-level analytics
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';
import { sequenceService } from '../../services/sequence-service.js';

const router = Router();

// ============================================
// Sequence CRUD
// ============================================

/**
 * GET /api/sequences
 * List all sequences with enrollment counts and completion rates.
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const sequences = await sequenceService.list();
    sendSuccess(res, { sequences });
  })
);

/**
 * POST /api/sequences
 * Create a new sequence with steps.
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { name, description, triggerEvent, triggerConditions, steps } = req.body;

    if (!name || !triggerEvent) {
      errorResponse(res, 'name and triggerEvent are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      errorResponse(res, 'At least one step is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const sequenceId = await sequenceService.create({
      name,
      description,
      triggerEvent,
      triggerConditions,
      steps
    });

    sendCreated(res, { sequenceId }, 'Sequence created');
  })
);

/**
 * GET /api/sequences/:id
 * Get a single sequence with full steps and stats.
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const sequence = await sequenceService.getById(sequenceId);

    if (!sequence) {
      errorResponse(res, 'Sequence not found', 404, ErrorCodes.NOT_FOUND);
      return;
    }

    sendSuccess(res, { sequence });
  })
);

/**
 * PUT /api/sequences/:id
 * Update sequence metadata (not steps).
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const { name, description, triggerEvent, triggerConditions, isActive } = req.body;

    await sequenceService.update(sequenceId, {
      name,
      description,
      triggerEvent,
      triggerConditions,
      isActive
    });

    sendSuccess(res, undefined, 'Sequence updated');
  })
);

/**
 * DELETE /api/sequences/:id
 * Delete a sequence (stops active enrollments first).
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    await sequenceService.deleteSequence(sequenceId);
    sendSuccess(res, undefined, 'Sequence deleted');
  })
);

// ============================================
// Steps
// ============================================

/**
 * POST /api/sequences/:id/steps
 * Add a step to a sequence.
 */
router.post(
  '/:id/steps',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const { delayHours, emailTemplateId, subjectOverride, bodyOverride, stopConditions } = req.body;

    if (delayHours === undefined || delayHours === null) {
      errorResponse(res, 'delayHours is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const stepId = await sequenceService.addStep(sequenceId, {
      delayHours,
      emailTemplateId,
      subjectOverride,
      bodyOverride,
      stopConditions
    });

    sendCreated(res, { stepId }, 'Step added');
  })
);

/**
 * PUT /api/sequences/:id/steps/reorder
 * Reorder steps within a sequence.
 * NOTE: This route must be registered before /:id/steps/:stepId
 * to avoid matching "reorder" as a stepId.
 */
router.put(
  '/:id/steps/reorder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const { stepIds } = req.body;

    if (!stepIds || !Array.isArray(stepIds) || stepIds.length === 0) {
      errorResponse(res, 'stepIds array is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    await sequenceService.reorderSteps(sequenceId, stepIds);
    sendSuccess(res, undefined, 'Steps reordered');
  })
);

/**
 * PUT /api/sequences/:id/steps/:stepId
 * Update a step.
 */
router.put(
  '/:id/steps/:stepId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const stepId = Number(req.params.stepId);
    const { delayHours, emailTemplateId, subjectOverride, bodyOverride, stopConditions } = req.body;

    await sequenceService.updateStep(stepId, {
      delayHours,
      emailTemplateId,
      subjectOverride,
      bodyOverride,
      stopConditions
    });

    sendSuccess(res, undefined, 'Step updated');
  })
);

/**
 * DELETE /api/sequences/:id/steps/:stepId
 * Delete a step.
 */
router.delete(
  '/:id/steps/:stepId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const stepId = Number(req.params.stepId);
    await sequenceService.deleteStep(stepId);
    sendSuccess(res, undefined, 'Step deleted');
  })
);

// ============================================
// Enrollments
// ============================================

/**
 * GET /api/sequences/:id/enrollments
 * List all enrollments for a sequence.
 */
router.get(
  '/:id/enrollments',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const enrollments = await sequenceService.getEnrollments(sequenceId);
    sendSuccess(res, { enrollments });
  })
);

/**
 * POST /api/sequences/:id/enroll
 * Manually enroll an entity in a sequence.
 */
router.post(
  '/:id/enroll',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const { entityType, entityId, entityEmail, entityName } = req.body;

    if (!entityType || !entityId || !entityEmail) {
      errorResponse(res, 'entityType, entityId, and entityEmail are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const enrollmentId = await sequenceService.enrollEntity({
      sequenceId,
      entityType,
      entityId: Number(entityId),
      entityEmail,
      entityName
    });

    sendCreated(res, { enrollmentId }, 'Entity enrolled');
  })
);

/**
 * POST /api/sequences/enrollments/:enrollmentId/stop
 * Stop an enrollment.
 */
router.post(
  '/enrollments/:enrollmentId/stop',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const enrollmentId = Number(req.params.enrollmentId);
    const reason = req.body.reason || 'Manually stopped by admin';

    await sequenceService.stopEnrollment(enrollmentId, reason);
    sendSuccess(res, undefined, 'Enrollment stopped');
  })
);

/**
 * POST /api/sequences/enrollments/:enrollmentId/pause
 * Pause an enrollment.
 */
router.post(
  '/enrollments/:enrollmentId/pause',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const enrollmentId = Number(req.params.enrollmentId);
    await sequenceService.pauseEnrollment(enrollmentId);
    sendSuccess(res, undefined, 'Enrollment paused');
  })
);

/**
 * POST /api/sequences/enrollments/:enrollmentId/resume
 * Resume a paused enrollment.
 */
router.post(
  '/enrollments/:enrollmentId/resume',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const enrollmentId = Number(req.params.enrollmentId);
    await sequenceService.resumeEnrollment(enrollmentId);
    sendSuccess(res, undefined, 'Enrollment resumed');
  })
);

// ============================================
// Analytics
// ============================================

/**
 * GET /api/sequences/:id/analytics
 * Get analytics for a sequence including per-step metrics.
 */
router.get(
  '/:id/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const sequenceId = Number(req.params.id);
    const analytics = await sequenceService.getAnalytics(sequenceId);
    sendSuccess(res, { analytics });
  })
);

export default router;
