/**
 * ===============================================
 * MEETING REQUEST PORTAL ROUTES
 * ===============================================
 * @file server/routes/meeting-requests/portal.ts
 *
 * Client-facing endpoints for submitting and
 * managing meeting requests.
 *
 * POST   /                — Submit a new meeting request
 * GET    /my              — Get client's meeting requests
 * POST   /:id/cancel      — Cancel own meeting request
 */

import { Router, Response } from 'express';
import { authenticateToken, requireClient } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';
import { meetingRequestService } from '../../services/meeting-request-service.js';
import { VALID_MEETING_TYPES } from '../../services/meeting-request-types.js';

const router = Router();

/**
 * POST /api/meeting-requests
 * Submit a new meeting request (client).
 */
router.post(
  '/',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const { projectId, meetingType, preferredSlot1, preferredSlot2, preferredSlot3, durationMinutes, notes } = req.body;

    if (!meetingType || !preferredSlot1) {
      errorResponse(res, 'meetingType and preferredSlot1 are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    if (!VALID_MEETING_TYPES.includes(meetingType)) {
      errorResponse(res, `Invalid meeting type: ${meetingType}`, 400, ErrorCodes.INVALID_TYPE);
      return;
    }

    const meetingRequestId = await meetingRequestService.create(clientId, {
      projectId: projectId ? Number(projectId) : undefined,
      meetingType,
      preferredSlot1,
      preferredSlot2,
      preferredSlot3,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      notes
    });

    sendCreated(res, { meetingRequestId }, 'Meeting request submitted');
  })
);

/**
 * GET /api/meeting-requests/my
 * Get all meeting requests for the authenticated client.
 */
router.get(
  '/my',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const meetingRequests = await meetingRequestService.getByClient(clientId);
    sendSuccess(res, { meetingRequests });
  })
);

/**
 * POST /api/meeting-requests/:id/cancel
 * Cancel a meeting request (client can only cancel their own).
 */
router.post(
  '/:id/cancel',
  authenticateToken,
  requireClient,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const clientId = req.user!.id;
    const meetingRequestId = Number(req.params.id);

    try {
      await meetingRequestService.cancel(meetingRequestId, clientId);
      sendSuccess(res, undefined, 'Meeting request cancelled');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel meeting request';
      errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

export default router;
