/**
 * ===============================================
 * ANALYTICS CORE ROUTES
 * ===============================================
 * @file server/routes/analytics/core.ts
 *
 * Event tracking, pageviews, and main analytics endpoints.
 *
 * ENDPOINTS:
 * - POST /track           - Receive tracking events (public)
 * - GET  /summary         - Get analytics summary (admin)
 * - GET  /realtime        - Get realtime visitor data (admin)
 * - DELETE /data          - Clear old analytics data (admin)
 * - GET  /sessions        - List visitor sessions (admin)
 * - GET  /sessions/:id    - Get session details (admin)
 * - GET  /export          - Export analytics data (admin)
 *
 * TABLES USED:
 * - visitor_sessions    - Session data with device/browser info
 * - page_views          - Individual page view events
 * - interaction_events  - User interaction events
 *
 * RATE LIMITS:
 * - Tracking endpoint: 100 requests/minute per IP
 * - Admin endpoints: 30 requests/minute per IP
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { logger } from '../../services/logger.js';
import { analyticsService } from '../../services/analytics-service.js';
import { UAParser } from 'ua-parser-js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import {
  trackingRateLimit,
  adminRateLimit,
  getDateThreshold,
  asyncHandler,
  TrackingPayload
} from './helpers.js';

const router = Router();

/**
 * @swagger
 * /api/analytics/track:
 *   post:
 *     tags:
 *       - Analytics
 *     summary: POST /api/analytics/track
 *     description: Receive tracking events from client.
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/track', trackingRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const payload: TrackingPayload = req.body;

  if (!payload.session || !payload.events) {
    return errorResponse(res, 'Invalid payload', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const { session, events } = payload;

  // Parse user agent for device info
  const parser = new UAParser(session.userAgent);
  const uaResult = parser.getResult();
  const deviceType = uaResult.device.type || 'desktop';
  const browser = uaResult.browser.name || 'unknown';
  const os = uaResult.os.name || 'unknown';

  // Get IP address (handle proxies)
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  const sessionParams = {
    sessionId: session.sessionId,
    visitorId: session.visitorId,
    startTime: session.startTime,
    lastActivity: session.lastActivity,
    pageViews: session.pageViews,
    totalTimeOnSite: session.totalTimeOnSite,
    bounced: session.bounced,
    referrer: session.referrer,
    userAgent: session.userAgent,
    screenResolution: session.screenResolution,
    language: session.language,
    timezone: session.timezone,
    ipAddress,
    deviceType,
    browser,
    os
  };

  // Check if session exists
  const existingSession = await analyticsService.findSession(session.sessionId);

  if (existingSession) {
    await analyticsService.updateSession(sessionParams);
  } else {
    await analyticsService.insertSession(sessionParams);
  }

  // Insert events
  for (const event of events) {
    if ('title' in event) {
      // Page view event
      const sessionId = typeof event.sessionId === 'string' ? event.sessionId : null;
      const url = typeof event.url === 'string' ? event.url : null;
      const title = typeof event.title === 'string' ? event.title : null;
      const timestamp = typeof event.timestamp === 'number' ? event.timestamp / 1000 : 0;
      const timeOnPage = typeof event.timeOnPage === 'number' ? event.timeOnPage : 0;
      const scrollDepth = typeof event.scrollDepth === 'number' ? event.scrollDepth : 0;
      const interactions = typeof event.interactions === 'number' ? event.interactions : 0;

      await analyticsService.insertPageView({
        sessionId, url, title, timestamp, timeOnPage, scrollDepth, interactions
      });
    } else if ('type' in event) {
      // Interaction event
      const sessionId = typeof event.sessionId === 'string' ? event.sessionId : null;
      const eventType = typeof event.type === 'string' ? event.type : null;
      const element = typeof event.element === 'string' ? event.element : null;
      const timestamp = typeof event.timestamp === 'number' ? event.timestamp / 1000 : 0;
      const url = typeof event.url === 'string' ? event.url : null;
      const data = event.data ? JSON.stringify(event.data) : null;

      await analyticsService.insertInteraction({
        sessionId, eventType, element, timestamp, url, data
      });
    }
  }

  logger.info('Tracking events received', {
    category: 'analytics',
    metadata: {
      sessionId: session.sessionId,
      eventCount: events.length
    }
  });

  sendSuccess(res, undefined);
}));

/**
 * @swagger
 * /api/analytics/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/summary
 *     description: GET /api/analytics/summary.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/summary',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = 30 } = req.query;
    const daysNum = Math.min(Math.max(parseInt(days as string, 10) || 30, 1), 365);
    const dateThreshold = getDateThreshold(daysNum);

    const summary = await analyticsService.getSummaryMetrics(dateThreshold);
    const daily = await analyticsService.getDailyBreakdown(dateThreshold);
    const topPages = await analyticsService.getTopPages(dateThreshold);
    const topReferrers = await analyticsService.getTopReferrers(dateThreshold);
    const devices = await analyticsService.getDeviceBreakdown(dateThreshold);
    const browsers = await analyticsService.getBrowserBreakdown(dateThreshold);
    const topInteractions = await analyticsService.getTopInteractions(dateThreshold);

    sendSuccess(res, {
      summary: summary || {},
      daily,
      topPages,
      topReferrers,
      devices,
      browsers,
      topInteractions
    });
  })
);

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/realtime
 *     description: GET /api/analytics/realtime.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/realtime',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const sessions = await analyticsService.getActiveSessions();
    const recentPages = await analyticsService.getRecentPageViews();

    sendSuccess(res, {
      activeSessions: sessions.length,
      sessions,
      recentPages
    });
  })
);

/**
 * @swagger
 * /api/analytics/data:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/data
 *     description: DELETE /api/analytics/data.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/data',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { olderThanDays = 90 } = req.query;
    const days = Math.max(parseInt(olderThanDays as string, 10) || 90, 7);
    const dateThreshold = getDateThreshold(days);

    const result = await analyticsService.deleteOldData(dateThreshold);

    logger.info('Analytics data cleared', {
      category: 'analytics',
      metadata: { deletedSessions: result.deletedSessions, olderThanDays: days }
    });

    sendSuccess(res, { deletedSessions: result.deletedSessions });
  })
);

/**
 * @swagger
 * /api/analytics/sessions:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/sessions
 *     description: GET /api/analytics/sessions.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/sessions',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50, days = 7 } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const daysNum = Math.min(365, Math.max(1, parseInt(days as string, 10) || 7));
    const offset = (pageNum - 1) * limitNum;
    const dateThreshold = getDateThreshold(daysNum);

    const total = await analyticsService.getSessionCount(dateThreshold);
    const sessions = await analyticsService.getSessionList(dateThreshold, limitNum, offset);

    sendSuccess(res, {
      sessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages:
          typeof total === 'number' && typeof limitNum === 'number'
            ? Math.ceil(total / limitNum)
            : 0
      }
    });
  })
);

/**
 * @swagger
 * /api/analytics/sessions/{sessionId}:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/sessions/:sessionId
 *     description: GET /api/analytics/sessions/:sessionId.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/sessions/:sessionId',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = await analyticsService.getSessionById(sessionId);

    if (!session) {
      return errorResponse(res, 'Session not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const pageViews = await analyticsService.getPageViewsBySession(sessionId);
    const interactions = await analyticsService.getInteractionsBySession(sessionId);

    sendSuccess(res, {
      session,
      pageViews,
      interactions
    });
  })
);

/**
 * @swagger
 * /api/analytics/export:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/export
 *     description: GET /api/analytics/export.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/export',
  adminRateLimit,
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = 30 } = req.query;
    const daysNum = Math.min(365, Math.max(1, parseInt(days as string, 10) || 30));
    const dateThreshold = getDateThreshold(daysNum);

    const sessions = await analyticsService.getExportSessions(dateThreshold);
    const pageViews = await analyticsService.getExportPageViews(dateThreshold);
    const interactions = await analyticsService.getExportInteractions(dateThreshold);

    const exportData = {
      exportedAt: new Date().toISOString(),
      daysIncluded: daysNum,
      summary: {
        totalSessions: sessions.length,
        totalPageViews: pageViews.length,
        totalInteractions: interactions.length
      },
      sessions,
      pageViews,
      interactions
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics-export-${new Date().toISOString().split('T')[0]}.json"`
    );

    sendSuccess(res, exportData);
  })
);

export { router as coreRouter };
export default router;
