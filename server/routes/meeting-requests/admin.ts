/**
 * ===============================================
 * MEETING REQUEST ADMIN ROUTES
 * ===============================================
 * @file server/routes/meeting-requests/admin.ts
 *
 * Admin endpoints for managing meeting requests.
 *
 * GET    /              — List all meeting requests (query: ?status=)
 * GET    /:id           — Get a single meeting request
 * POST   /:id/confirm   — Confirm a meeting request
 * POST   /:id/decline   — Decline a meeting request
 * POST   /:id/reschedule — Reschedule a meeting request
 * POST   /:id/complete  — Mark meeting as completed
 * GET    /:id/ics       — Download .ics calendar file
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';
import { meetingRequestService } from '../../services/meeting-request-service.js';
import type { MeetingStatus } from '../../services/meeting-request-types.js';

const ICS_CONTENT_TYPE = 'text/calendar';
const ICS_FILE_EXTENSION = '.ics';

const router = Router();

/**
 * GET /api/meeting-requests
 * List all meeting requests (admin). Optionally filter by ?status=
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const statusFilter = req.query.status as MeetingStatus | undefined;
    const meetingRequests = await meetingRequestService.list(
      statusFilter ? { status: statusFilter } : undefined
    );
    sendSuccess(res, { meetingRequests });
  })
);

/**
 * GET /api/meeting-requests/:id
 * Get a single meeting request by ID.
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const meetingRequestId = Number(req.params.id);
    const meetingRequest = await meetingRequestService.getById(meetingRequestId);

    if (!meetingRequest) {
      errorResponse(res, 'Meeting request not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    sendSuccess(res, { meetingRequest });
  })
);

/**
 * POST /api/meeting-requests/:id/confirm
 * Confirm a meeting request with datetime, location, and optional notes.
 */
router.post(
  '/:id/confirm',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const meetingRequestId = Number(req.params.id);
    const { confirmedDatetime, durationMinutes, locationType, locationDetails, adminNotes, createCalendarEvent } = req.body;

    if (!confirmedDatetime || !locationType) {
      errorResponse(res, 'confirmedDatetime and locationType are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    try {
      await meetingRequestService.confirm(meetingRequestId, {
        confirmedDatetime,
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        locationType,
        locationDetails,
        adminNotes,
        createCalendarEvent: Boolean(createCalendarEvent)
      });
      sendSuccess(res, undefined, 'Meeting request confirmed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm meeting request';
      errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * POST /api/meeting-requests/:id/decline
 * Decline a meeting request with a reason.
 */
router.post(
  '/:id/decline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const meetingRequestId = Number(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      errorResponse(res, 'reason is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    try {
      await meetingRequestService.decline(meetingRequestId, reason);
      sendSuccess(res, undefined, 'Meeting request declined');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decline meeting request';
      errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * POST /api/meeting-requests/:id/reschedule
 * Reschedule a meeting request with new preferred time slots.
 */
router.post(
  '/:id/reschedule',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const meetingRequestId = Number(req.params.id);
    const { slots } = req.body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      errorResponse(res, 'slots array with at least one entry is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    try {
      await meetingRequestService.reschedule(meetingRequestId, slots);
      sendSuccess(res, undefined, 'Meeting request rescheduled');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reschedule meeting request';
      errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * POST /api/meeting-requests/:id/complete
 * Mark a meeting as completed.
 */
router.post(
  '/:id/complete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const meetingRequestId = Number(req.params.id);

    try {
      await meetingRequestService.complete(meetingRequestId);
      sendSuccess(res, undefined, 'Meeting request marked as completed');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete meeting request';
      errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }
  })
);

/**
 * GET /api/meeting-requests/:id/ics
 * Download an .ics calendar file for a confirmed meeting.
 */
router.get(
  '/:id/ics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const meetingRequestId = Number(req.params.id);
    const meetingRequest = await meetingRequestService.getById(meetingRequestId);

    if (!meetingRequest) {
      errorResponse(res, 'Meeting request not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    if (!meetingRequest.confirmed_datetime) {
      errorResponse(res, 'Meeting has not been confirmed yet', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const icsContent = meetingRequestService.generateIcs(meetingRequest);
    const filename = `meeting-${meetingRequestId}${ICS_FILE_EXTENSION}`;

    res.setHeader('Content-Type', ICS_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsContent);
  })
);

export default router;
