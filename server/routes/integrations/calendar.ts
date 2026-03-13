/**
 * Google Calendar routes.
 *
 * GET  /calendar/status                    - Get calendar sync status
 * GET  /calendar/auth-url                  - Get Google Calendar auth URL
 * POST /calendar/callback                  - Google Calendar OAuth callback
 * PUT  /calendar/settings                  - Update calendar sync settings
 * GET  /calendar/export/project/:projectId - Export project calendar
 * GET  /calendar/export/upcoming           - Export upcoming events calendar
 */

import { Router } from 'express';
import { Response } from 'express';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import {
  isGoogleCalendarConfigured,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  exportProjectToICal,
  exportUpcomingToICal,
  saveCalendarSyncConfig,
  getCalendarSyncConfig
} from '../../services/integrations/index.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

const router = Router();

/**
 * @swagger
 * /api/integrations/calendar/status:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get calendar sync status
 *     description: Retrieve Google Calendar configuration and sync status. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar sync status
 */
router.get(
  '/calendar/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const configured = isGoogleCalendarConfigured();
    const userId = req.user?.id;

    let syncConfig = null;
    if (userId) {
      syncConfig = await getCalendarSyncConfig(userId);
    }

    sendSuccess(res, {
      configured,
      connected: Boolean(syncConfig?.isActive),
      syncConfig: syncConfig
        ? {
          syncMilestones: syncConfig.syncMilestones,
          syncTasks: syncConfig.syncTasks,
          syncInvoiceDueDates: syncConfig.syncInvoiceDueDates,
          lastSyncAt: syncConfig.lastSyncAt
        }
        : null
    });
  })
);

/**
 * @swagger
 * /api/integrations/calendar/auth-url:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Get Google Calendar auth URL
 *     description: Get the Google OAuth authorization URL for calendar integration. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: OAuth authorization URL
 *       400:
 *         description: Google Calendar not configured
 */
router.get(
  '/calendar/auth-url',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!isGoogleCalendarConfigured()) {
      errorResponse(
        res,
        'Google Calendar is not configured',
        400,
        ErrorCodes.GOOGLE_CALENDAR_NOT_CONFIGURED
      );
      return;
    }

    const state = req.user?.id?.toString() || '';
    const authUrl = getGoogleAuthUrl(state);
    sendSuccess(res, { authUrl });
  })
);

/**
 * @swagger
 * /api/integrations/calendar/callback:
 *   post:
 *     tags:
 *       - Integrations
 *     summary: Google Calendar OAuth callback
 *     description: Handle the Google OAuth callback and store tokens. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Calendar connected
 *       400:
 *         description: Authorization code required
 */
router.post(
  '/calendar/callback',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      errorResponse(res, 'Authentication required', 401, ErrorCodes.AUTH_REQUIRED);
      return;
    }

    if (!code) {
      errorResponse(res, 'Authorization code is required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const tokens = await exchangeCodeForTokens(code);

    // Save sync configuration
    await saveCalendarSyncConfig({
      userId,
      calendarId: 'primary',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
      syncMilestones: true,
      syncTasks: true,
      syncInvoiceDueDates: false,
      isActive: true
    });

    sendSuccess(res, undefined, 'Calendar connected successfully');
  })
);

/**
 * @swagger
 * /api/integrations/calendar/settings:
 *   put:
 *     tags:
 *       - Integrations
 *     summary: Update calendar sync settings
 *     description: Update calendar synchronization preferences. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               syncMilestones:
 *                 type: boolean
 *               syncTasks:
 *                 type: boolean
 *               syncInvoiceDueDates:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated
 *       404:
 *         description: Calendar not connected
 */
router.put(
  '/calendar/settings',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      errorResponse(res, 'Authentication required', 401, ErrorCodes.AUTH_REQUIRED);
      return;
    }
    const { syncMilestones, syncTasks, syncInvoiceDueDates, isActive } = req.body;

    const existing = await getCalendarSyncConfig(userId);
    if (!existing) {
      errorResponse(res, 'Calendar not connected', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    await saveCalendarSyncConfig({
      ...existing,
      syncMilestones: syncMilestones ?? existing.syncMilestones,
      syncTasks: syncTasks ?? existing.syncTasks,
      syncInvoiceDueDates: syncInvoiceDueDates ?? existing.syncInvoiceDueDates,
      isActive: isActive ?? existing.isActive
    });

    sendSuccess(res, undefined, 'Calendar settings updated');
  })
);

/**
 * @swagger
 * /api/integrations/calendar/export/project/{projectId}:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Export project calendar
 *     description: Export project milestones and tasks in iCal format.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: iCal file
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 */
router.get(
  '/calendar/export/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId } = req.params;
    const ical = await exportProjectToICal(parseInt(projectId, 10));

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}.ics"`);
    res.send(ical);
  })
);

/**
 * @swagger
 * /api/integrations/calendar/export/upcoming:
 *   get:
 *     tags:
 *       - Integrations
 *     summary: Export upcoming events calendar
 *     description: Export all upcoming milestones and tasks in iCal format.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look ahead (1-365)
 *     responses:
 *       200:
 *         description: iCal file
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 */
router.get(
  '/calendar/export/upcoming',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysParam = parseInt(req.query.days as string, 10);
    const days = isNaN(daysParam) || daysParam < 1 || daysParam > 365 ? 30 : daysParam;
    const ical = await exportUpcomingToICal(days);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="upcoming.ics"');
    res.send(ical);
  })
);

export default router;
