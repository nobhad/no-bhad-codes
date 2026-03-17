/**
 * ===============================================
 * FEEDBACK PORTAL ROUTES
 * ===============================================
 * @file server/routes/feedback/portal.ts
 *
 * Client-facing endpoints for viewing surveys.
 *
 * GET    /my   — Client's pending/completed surveys
 */

import { Router, Response } from 'express';
import { authenticateToken, requireClient } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { feedbackService } from '../../services/feedback-service.js';
import { sendSuccess } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/feedback/my
 * Get all surveys for the authenticated client.
 */
router.get(
  '/my',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const surveys = await feedbackService.getClientSurveys(clientId);
    sendSuccess(res, { surveys });
  })
);

export default router;
