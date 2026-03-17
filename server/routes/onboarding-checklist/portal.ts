/**
 * ===============================================
 * ONBOARDING CHECKLIST PORTAL ROUTES
 * ===============================================
 * @file server/routes/onboarding-checklist/portal.ts
 *
 * Client-facing onboarding checklist endpoints.
 *
 * GET    /my                     — Get active checklist for authenticated client
 * POST   /dismiss                — Dismiss/hide the checklist
 * POST   /steps/:id/complete     — Manually complete a step
 */

import { Router, Response } from 'express';
import { authenticateToken, requireClient } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { onboardingChecklistService } from '../../services/onboarding-checklist-service.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/onboarding-checklist/my
 * Get the active onboarding checklist for the authenticated client.
 */
router.get(
  '/my',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const checklist = await onboardingChecklistService.getClientChecklist(clientId);
    sendSuccess(res, { checklist });
  })
);

/**
 * POST /api/onboarding-checklist/dismiss
 * Dismiss the active checklist (client hides it from their dashboard).
 */
router.post(
  '/dismiss',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const { checklistId } = req.body;
    await onboardingChecklistService.dismissChecklist(Number(checklistId), clientId);
    sendSuccess(res, undefined, 'Checklist dismissed');
  })
);

/**
 * POST /api/onboarding-checklist/steps/:id/complete
 * Manually complete a step.
 */
router.post(
  '/steps/:id/complete',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const stepId = Number(req.params.id);
    const clientId = req.user!.id;
    await onboardingChecklistService.completeStep(stepId, clientId);
    sendSuccess(res, undefined, 'Step completed');
  })
);

export default router;
