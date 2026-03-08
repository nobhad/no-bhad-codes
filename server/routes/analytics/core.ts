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
import { getDatabase } from '../../database/init.js';
import { getNumber } from '../../database/row-helpers.js';
import { UAParser } from 'ua-parser-js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import {
  VISITOR_SESSION_COLUMNS,
  PAGE_VIEW_COLUMNS,
  INTERACTION_EVENT_COLUMNS,
  trackingRateLimit,
  adminRateLimit,
  getDateThreshold,
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
router.post('/track', trackingRateLimit, async (req: Request, res: Response) => {
  try {
    const payload: TrackingPayload = req.body;

    if (!payload.session || !payload.events) {
      return errorResponse(res, 'Invalid payload', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
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

    // Check if session exists
    const existingSession = await db.get(
      'SELECT session_id FROM visitor_sessions WHERE session_id = ?',
      [session.sessionId]
    );

    if (existingSession) {
      // Update existing session
      await db.run(
        `UPDATE visitor_sessions SET
          last_activity = datetime(?, 'unixepoch', 'subsec'),
          page_views = ?,
          total_time_on_site = ?,
          bounced = ?,
          updated_at = datetime('now')
        WHERE session_id = ?`,
        [
          session.lastActivity / 1000,
          session.pageViews,
          session.totalTimeOnSite,
          session.bounced ? 1 : 0,
          session.sessionId
        ]
      );
    } else {
      // Insert new session
      await db.run(
        `INSERT INTO visitor_sessions (
          session_id, visitor_id, start_time, last_activity, page_views,
          total_time_on_site, bounced, referrer, user_agent, screen_resolution,
          language, timezone, ip_address, device_type, browser, os
        ) VALUES (?, ?, datetime(?, 'unixepoch', 'subsec'), datetime(?, 'unixepoch', 'subsec'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session.sessionId,
          session.visitorId,
          session.startTime / 1000,
          session.lastActivity / 1000,
          session.pageViews,
          session.totalTimeOnSite,
          session.bounced ? 1 : 0,
          session.referrer,
          session.userAgent,
          session.screenResolution,
          session.language,
          session.timezone,
          ipAddress,
          deviceType,
          browser,
          os
        ]
      );
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

        await db.run(
          `INSERT INTO page_views (session_id, url, title, timestamp, time_on_page, scroll_depth, interactions)
           VALUES (?, ?, ?, datetime(?, 'unixepoch', 'subsec'), ?, ?, ?)`,
          [sessionId, url, title, timestamp, timeOnPage, scrollDepth, interactions]
        );
      } else if ('type' in event) {
        // Interaction event
        const sessionId = typeof event.sessionId === 'string' ? event.sessionId : null;
        const eventType = typeof event.type === 'string' ? event.type : null;
        const element = typeof event.element === 'string' ? event.element : null;
        const timestamp = typeof event.timestamp === 'number' ? event.timestamp / 1000 : 0;
        const url = typeof event.url === 'string' ? event.url : null;
        const data = event.data ? JSON.stringify(event.data) : null;

        await db.run(
          `INSERT INTO interaction_events (session_id, event_type, element, timestamp, url, data)
           VALUES (?, ?, ?, datetime(?, 'unixepoch', 'subsec'), ?, ?)`,
          [sessionId, eventType, element, timestamp, url, data]
        );
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
  } catch (error) {
    logger.error('Failed to process tracking events', {
      category: 'analytics',
      metadata: { error }
    });
    errorResponse(res, 'Failed to process tracking events', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

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
  async (req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const { days = 30 } = req.query;
      const daysNum = Math.min(Math.max(parseInt(days as string, 10) || 30, 1), 365);

      // Get summary metrics
      // Note: total_time_on_site is stored in milliseconds
      // Filter out sessions > 1 hour (3600000ms) as outliers (tabs left open)
      const MAX_SESSION_MS = 3600000; // 1 hour in milliseconds
      const dateThreshold = getDateThreshold(daysNum);

      const summary = await db.get(
        `SELECT
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(DISTINCT visitor_id) as unique_visitors,
          SUM(page_views) as total_page_views,
          CAST(AVG(CASE WHEN total_time_on_site <= ? THEN total_time_on_site ELSE NULL END) AS INTEGER) as avg_session_duration,
          ROUND(AVG(page_views), 2) as avg_pages_per_session,
          ROUND(COUNT(CASE WHEN bounced = 1 THEN 1 END) * 100.0 / MAX(COUNT(*), 1), 2) as bounce_rate
        FROM visitor_sessions
        WHERE start_time >= ?`,
        [MAX_SESSION_MS, dateThreshold]
      );

      // Get daily breakdown
      const daily = await db.all(
        `SELECT
          DATE(start_time) as date,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(DISTINCT visitor_id) as visitors,
          SUM(page_views) as page_views
        FROM visitor_sessions
        WHERE start_time >= ?
        GROUP BY DATE(start_time)
        ORDER BY date DESC`,
        [dateThreshold]
      );

      // Get top pages
      const topPages = await db.all(
        `SELECT
          url,
          COUNT(*) as views,
          CAST(AVG(time_on_page) AS INTEGER) as avg_time
        FROM page_views
        WHERE timestamp >= ?
        GROUP BY url
        ORDER BY views DESC
        LIMIT 10`,
        [dateThreshold]
      );

      // Get top referrers
      const topReferrers = await db.all(
        `SELECT
          CASE
            WHEN referrer = '' OR referrer IS NULL THEN 'Direct'
            ELSE referrer
          END as source,
          COUNT(*) as count
        FROM visitor_sessions
        WHERE start_time >= ?
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10`,
        [dateThreshold]
      );

      // Get device breakdown
      const devices = await db.all(
        `SELECT
          device_type,
          COUNT(*) as count
        FROM visitor_sessions
        WHERE start_time >= ?
        GROUP BY device_type
        ORDER BY count DESC`,
        [dateThreshold]
      );

      // Get browser breakdown
      const browsers = await db.all(
        `SELECT
          browser,
          COUNT(*) as count
        FROM visitor_sessions
        WHERE start_time >= ?
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 5`,
        [dateThreshold]
      );

      // Get top interactions
      const topInteractions = await db.all(
        `SELECT
          event_type,
          element,
          COUNT(*) as count
        FROM interaction_events
        WHERE timestamp >= ?
        GROUP BY event_type, element
        ORDER BY count DESC
        LIMIT 10`,
        [dateThreshold]
      );

      sendSuccess(res, {
        summary: summary || {},
        daily,
        topPages,
        topReferrers,
        devices,
        browsers,
        topInteractions
      });
    } catch (error) {
      logger.error('Failed to get analytics summary', {
        category: 'analytics',
        metadata: { error }
      });
      errorResponse(res, 'Failed to get analytics summary', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
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
  async (req: Request, res: Response) => {
    try {
      const db = getDatabase();

      // Active sessions (last 5 minutes)
      const sessions = await db.all(
        `SELECT
          session_id,
          visitor_id,
          device_type,
          browser,
          referrer,
          page_views,
          last_activity
        FROM visitor_sessions
        WHERE last_activity >= datetime('now', '-5 minutes')
        ORDER BY last_activity DESC`
      );

      // Recent page views (last 10 minutes)
      const recentPages = await db.all(
        `SELECT
          pv.url,
          pv.title,
          pv.timestamp,
          vs.device_type
        FROM page_views pv
        JOIN visitor_sessions vs ON pv.session_id = vs.session_id
        WHERE pv.timestamp >= datetime('now', '-10 minutes')
        ORDER BY pv.timestamp DESC
        LIMIT 20`
      );

      sendSuccess(res, {
        activeSessions: sessions.length,
        sessions,
        recentPages
      });
    } catch (error) {
      logger.error('Failed to get realtime analytics', {
        category: 'analytics',
        metadata: { error }
      });
      errorResponse(res, 'Failed to get realtime analytics', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
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
  async (req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const { olderThanDays = 90 } = req.query;
      const days = Math.max(parseInt(olderThanDays as string, 10) || 90, 7);
      const dateThreshold = getDateThreshold(days);

      // Delete old interaction events
      await db.run(
        `DELETE FROM interaction_events
         WHERE timestamp < ?`,
        [dateThreshold]
      );

      // Delete old page views
      await db.run(
        `DELETE FROM page_views
         WHERE timestamp < ?`,
        [dateThreshold]
      );

      // Delete old sessions (will cascade if foreign keys are set up)
      const result = await db.run(
        `DELETE FROM visitor_sessions
         WHERE start_time < ?`,
        [dateThreshold]
      );

      logger.info('Analytics data cleared', {
        category: 'analytics',
        metadata: { deletedSessions: result.changes, olderThanDays: days }
      });

      sendSuccess(res, { deletedSessions: result.changes });
    } catch (error) {
      logger.error('Failed to clear analytics data', {
        category: 'analytics',
        metadata: { error }
      });
      errorResponse(res, 'Failed to clear analytics data', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
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
  async (req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const { page = 1, limit = 50, days = 7 } = req.query;

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
      const daysNum = Math.min(365, Math.max(1, parseInt(days as string, 10) || 7));
      const offset = (pageNum - 1) * limitNum;
      const dateThreshold = getDateThreshold(daysNum);

      // Get total count
      const countResult = await db.get(
        `SELECT COUNT(*) as total FROM visitor_sessions
         WHERE start_time >= ?`,
        [dateThreshold]
      );
      const total = getNumber(countResult, 'total');

      // Get sessions
      const sessions = await db.all(
        `SELECT
          session_id,
          visitor_id,
          start_time,
          last_activity,
          page_views,
          total_time_on_site,
          bounced,
          referrer,
          device_type,
          browser,
          os,
          country,
          city
        FROM visitor_sessions
        WHERE start_time >= ?
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?`,
        [dateThreshold, limitNum, offset]
      );

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
    } catch (error) {
      logger.error('Failed to get sessions list', {
        category: 'analytics',
        metadata: { error }
      });
      errorResponse(res, 'Failed to get sessions list', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
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
  async (req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const { sessionId } = req.params;

      // Get session
      const session = await db.get(
        `SELECT ${VISITOR_SESSION_COLUMNS} FROM visitor_sessions WHERE session_id = ?`,
        [sessionId]
      );

      if (!session) {
        return errorResponse(res, 'Session not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Get page views
      const pageViews = await db.all(
        `SELECT url, title, timestamp, time_on_page, scroll_depth, interactions
         FROM page_views
         WHERE session_id = ?
         ORDER BY timestamp ASC`,
        [sessionId]
      );

      // Get interactions
      const interactions = await db.all(
        `SELECT event_type, element, timestamp, url, data
         FROM interaction_events
         WHERE session_id = ?
         ORDER BY timestamp ASC`,
        [sessionId]
      );

      sendSuccess(res, {
        session,
        pageViews,
        interactions
      });
    } catch (error) {
      logger.error('Failed to get session details', {
        category: 'analytics',
        metadata: { error }
      });
      errorResponse(res, 'Failed to get session details', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
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
  async (req: Request, res: Response) => {
    try {
      const db = getDatabase();
      const { days = 30 } = req.query;
      const daysNum = Math.min(365, Math.max(1, parseInt(days as string, 10) || 30));
      const dateThreshold = getDateThreshold(daysNum);

      // Get all data for export
      const sessions = await db.all(
        `SELECT ${VISITOR_SESSION_COLUMNS} FROM visitor_sessions
         WHERE start_time >= ?
         ORDER BY start_time DESC`,
        [dateThreshold]
      );

      const pageViews = await db.all(
        `SELECT ${PAGE_VIEW_COLUMNS} FROM page_views
         WHERE timestamp >= ?
         ORDER BY timestamp DESC`,
        [dateThreshold]
      );

      const interactions = await db.all(
        `SELECT ${INTERACTION_EVENT_COLUMNS} FROM interaction_events
         WHERE timestamp >= ?
         ORDER BY timestamp DESC`,
        [dateThreshold]
      );

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
    } catch (error) {
      logger.error('Failed to export analytics data', {
        category: 'analytics',
        metadata: { error }
      });
      errorResponse(res, 'Failed to export analytics data', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }
);

export { router as coreRouter };
export default router;
