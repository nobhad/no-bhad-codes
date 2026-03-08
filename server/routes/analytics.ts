/**
 * ===============================================
 * ANALYTICS ROUTES
 * ===============================================
 * @file server/routes/analytics.ts
 *
 * Visitor tracking and analytics API endpoints.
 *
 * ENDPOINTS:
 * - POST /api/analytics/track     - Receive tracking events (public)
 * - GET  /api/analytics/summary   - Get analytics summary (admin)
 * - GET  /api/analytics/realtime  - Get realtime visitor data (admin)
 * - GET  /api/analytics/sessions  - List visitor sessions (admin)
 * - GET  /api/analytics/export    - Export analytics data (admin)
 * - DELETE /api/analytics/data    - Clear old analytics data (admin)
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
import { rateLimit } from '../middleware/security.js';
import { logger } from '../services/logger.js';
import { getDatabase } from '../database/init.js';
import { getNumber } from '../database/row-helpers.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { UAParser } from 'ua-parser-js';
import { analyticsService } from '../services/analytics-service.js';
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const VISITOR_SESSION_COLUMNS = `
  id, session_id, visitor_id, start_time, last_activity, page_views,
  total_time_on_site, bounced, referrer, user_agent, screen_resolution,
  language, timezone, ip_address, country, city, device_type, browser, os,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const PAGE_VIEW_COLUMNS = `
  id, session_id, url, title, timestamp, time_on_page, scroll_depth,
  interactions, created_at
`.replace(/\s+/g, ' ').trim();

const INTERACTION_EVENT_COLUMNS = `
  id, session_id, event_type, element, timestamp, url, data, created_at
`.replace(/\s+/g, ' ').trim();

// Helper for async route handlers
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      logger.error('Route error', { category: 'analytics', metadata: { error } });
      errorResponse(res, 'Internal server error', 500, 'INTERNAL_ERROR');
    });
  };

const router = Router();

/**
 * Helper to compute a date threshold for SQL queries
 * Returns ISO string that can be used as a parameterized query value
 */
function getDateThreshold(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// Rate limit for tracking events (generous limit for legitimate traffic)
const trackingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per IP
  message: 'Too many tracking requests'
});

// Stricter rate limit for admin endpoints. Make configurable via env vars
const adminWindowMs = Number(process.env.ANALYTICS_ADMIN_RATE_WINDOW_MS) || 60 * 1000;
const adminMaxRequests = Number(process.env.ANALYTICS_ADMIN_MAX_REQUESTS) || 30;
const adminRateLimit = rateLimit({
  windowMs: adminWindowMs,
  maxRequests: adminMaxRequests,
  // In development, skip strict admin limits to avoid local 429s
  skipIf: () => process.env.NODE_ENV === 'development',
  message: 'Too many requests'
});

interface TrackingPayload {
  session: {
    sessionId: string;
    visitorId: string;
    startTime: number;
    lastActivity: number;
    pageViews: number;
    totalTimeOnSite: number;
    bounced: boolean;
    referrer: string;
    userAgent: string;
    screenResolution: string;
    language: string;
    timezone: string;
  };
  events: Array<{
    sessionId: string;
    url: string;
    title?: string;
    timestamp: number;
    timeOnPage?: number;
    scrollDepth?: number;
    interactions?: number;
    type?: string;
    element?: string;
    data?: Record<string, unknown>;
  }>;
}

/**
 * POST /api/analytics/track
 * Receive tracking events from client
 */
router.post('/track', trackingRateLimit, async (req: Request, res: Response) => {
  try {
    const payload: TrackingPayload = req.body;

    if (!payload.session || !payload.events) {
      return errorResponse(res, 'Invalid payload', 400, 'VALIDATION_ERROR');
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
    errorResponse(res, 'Failed to process tracking events', 500, 'INTERNAL_ERROR');
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
      errorResponse(res, 'Failed to get analytics summary', 500, 'INTERNAL_ERROR');
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
      errorResponse(res, 'Failed to get realtime analytics', 500, 'INTERNAL_ERROR');
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
      errorResponse(res, 'Failed to clear analytics data', 500, 'INTERNAL_ERROR');
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
      errorResponse(res, 'Failed to get sessions list', 500, 'INTERNAL_ERROR');
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
        return errorResponse(res, 'Session not found', 404, 'RESOURCE_NOT_FOUND');
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
      errorResponse(res, 'Failed to get session details', 500, 'INTERNAL_ERROR');
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
      errorResponse(res, 'Failed to export analytics data', 500, 'INTERNAL_ERROR');
    }
  }
);

// =====================================================
// SAVED REPORTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/reports:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports
 *     description: GET /api/analytics/reports.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, favorites } = req.query;
    const reports = await analyticsService.getSavedReports(
      type as string | undefined,
      favorites === 'true'
    );
    sendSuccess(res, { reports });
  })
);

/**
 * @swagger
 * /api/analytics/reports:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports
 *     description: POST /api/analytics/reports.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/reports',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const report = await analyticsService.createSavedReport({
      ...req.body,
      createdBy: userEmail
    });
    sendCreated(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/:id
 *     description: GET /api/analytics/reports/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const report = await analyticsService.getSavedReport(reportId);
    if (!report) {
      errorResponse(res, 'Report not found', 404, 'RESOURCE_NOT_FOUND');
      return;
    }
    sendSuccess(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/reports/:id
 *     description: PUT /api/analytics/reports/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/reports/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const report = await analyticsService.updateSavedReport(reportId, req.body);
    sendSuccess(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/reports/:id
 *     description: DELETE /api/analytics/reports/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/reports/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    await analyticsService.deleteSavedReport(reportId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}/favorite:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports/:id/favorite
 *     description: POST /api/analytics/reports/:id/favorite.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/reports/:id/favorite',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const report = await analyticsService.toggleReportFavorite(reportId);
    sendSuccess(res, { report });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{id}/run:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports/:id/run
 *     description: POST /api/analytics/reports/:id/run.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/reports/:id/run',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const result = await analyticsService.runReport(reportId);
    sendSuccess(res, result);
  })
);

// =====================================================
// REPORT SCHEDULES ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/reports/{reportId}/schedules:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/:reportId/schedules
 *     description: GET /api/analytics/reports/:reportId/schedules.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/:reportId/schedules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const schedules = await analyticsService.getReportSchedules(reportId);
    sendSuccess(res, { schedules });
  })
);

/**
 * @swagger
 * /api/analytics/reports/{reportId}/schedules:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/reports/:reportId/schedules
 *     description: POST /api/analytics/reports/:reportId/schedules.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/reports/:reportId/schedules',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.reportId, 10);
    if (isNaN(reportId) || reportId <= 0) {
      errorResponse(res, 'Invalid report ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const schedule = await analyticsService.createReportSchedule({
      ...req.body,
      reportId,
      createdBy: userEmail
    });
    sendCreated(res, { schedule });
  })
);

/**
 * @swagger
 * /api/analytics/schedules/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/schedules/:id
 *     description: PUT /api/analytics/schedules/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/schedules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = parseInt(req.params.id, 10);
    if (isNaN(scheduleId) || scheduleId <= 0) {
      errorResponse(res, 'Invalid schedule ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const schedule = await analyticsService.updateReportSchedule(scheduleId, req.body);
    sendSuccess(res, { schedule });
  })
);

/**
 * @swagger
 * /api/analytics/schedules/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/schedules/:id
 *     description: DELETE /api/analytics/schedules/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/schedules/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = parseInt(req.params.id, 10);
    if (isNaN(scheduleId) || scheduleId <= 0) {
      errorResponse(res, 'Invalid schedule ID', 400, 'VALIDATION_ERROR');
      return;
    }
    await analyticsService.deleteReportSchedule(scheduleId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/schedules/process:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/schedules/process
 *     description: POST /api/analytics/schedules/process.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/schedules/process',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const processed = await analyticsService.processDueSchedules();
    sendSuccess(res, { processed });
  })
);

// =====================================================
// DASHBOARD WIDGETS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/widgets:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/widgets
 *     description: GET /api/analytics/widgets.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/widgets',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const widgets = await analyticsService.getDashboardWidgets(userEmail);
    sendSuccess(res, { widgets });
  })
);

/**
 * @swagger
 * /api/analytics/widgets:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/widgets
 *     description: POST /api/analytics/widgets.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/widgets',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const widget = await analyticsService.createDashboardWidget({
      ...req.body,
      userEmail
    });
    sendCreated(res, { widget });
  })
);

/**
 * @swagger
 * /api/analytics/widgets/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/widgets/:id
 *     description: PUT /api/analytics/widgets/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/widgets/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const widgetId = parseInt(req.params.id, 10);
    if (isNaN(widgetId) || widgetId <= 0) {
      errorResponse(res, 'Invalid widget ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const widget = await analyticsService.updateDashboardWidget(widgetId, req.body);
    sendSuccess(res, { widget });
  })
);

/**
 * @swagger
 * /api/analytics/widgets/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/widgets/:id
 *     description: DELETE /api/analytics/widgets/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/widgets/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const widgetId = parseInt(req.params.id, 10);
    if (isNaN(widgetId) || widgetId <= 0) {
      errorResponse(res, 'Invalid widget ID', 400, 'VALIDATION_ERROR');
      return;
    }
    await analyticsService.deleteDashboardWidget(widgetId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/widgets/layout:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/widgets/layout
 *     description: PUT /api/analytics/widgets/layout.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/widgets/layout',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const { widgets } = req.body;
    await analyticsService.updateWidgetLayout(userEmail, widgets);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/widgets/presets:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/widgets/presets
 *     description: GET /api/analytics/widgets/presets.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/widgets/presets',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const presets = await analyticsService.getDashboardPresets();
    sendSuccess(res, { presets });
  })
);

/**
 * @swagger
 * /api/analytics/widgets/presets/{id}/apply:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/widgets/presets/:id/apply
 *     description: POST /api/analytics/widgets/presets/:id/apply.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/widgets/presets/:id/apply',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const presetId = parseInt(req.params.id, 10);
    if (isNaN(presetId) || presetId <= 0) {
      errorResponse(res, 'Invalid preset ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const widgets = await analyticsService.applyDashboardPreset(userEmail, presetId);
    sendSuccess(res, { widgets });
  })
);

// =====================================================
// KPI SNAPSHOTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/kpis/snapshot:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/kpis/snapshot
 *     description: POST /api/analytics/kpis/snapshot.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/kpis/snapshot',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    await analyticsService.captureKPISnapshot();
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/kpis/latest:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/kpis/latest
 *     description: GET /api/analytics/kpis/latest.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/kpis/latest',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const kpis = await analyticsService.getLatestKPIs();
    sendSuccess(res, { kpis });
  })
);

/**
 * @swagger
 * /api/analytics/kpis/{type}/trend:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/kpis/:type/trend
 *     description: GET /api/analytics/kpis/:type/trend.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/kpis/:type/trend',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const daysParam = parseInt(days as string, 10);
    const daysNum = isNaN(daysParam) || daysParam < 1 || daysParam > 365 ? 30 : daysParam;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const trend = await analyticsService.getKPITrend(req.params.type, {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });
    sendSuccess(res, { trend });
  })
);

// =====================================================
// METRIC ALERTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/alerts:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/alerts
 *     description: GET /api/analytics/alerts.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/alerts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const alerts = await analyticsService.getMetricAlerts();
    sendSuccess(res, { alerts });
  })
);

/**
 * @swagger
 * /api/analytics/alerts:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/alerts
 *     description: POST /api/analytics/alerts.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/alerts',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
    const alert = await analyticsService.createMetricAlert({
      ...req.body,
      createdBy: userEmail
    });
    sendCreated(res, { alert });
  })
);

/**
 * @swagger
 * /api/analytics/alerts/{id}:
 *   put:
 *     tags: [Analytics]
 *     summary: PUT /api/analytics/alerts/:id
 *     description: PUT /api/analytics/alerts/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/alerts/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId) || alertId <= 0) {
      errorResponse(res, 'Invalid alert ID', 400, 'VALIDATION_ERROR');
      return;
    }
    const alert = await analyticsService.updateMetricAlert(alertId, req.body);
    sendSuccess(res, { alert });
  })
);

/**
 * @swagger
 * /api/analytics/alerts/{id}:
 *   delete:
 *     tags: [Analytics]
 *     summary: DELETE /api/analytics/alerts/:id
 *     description: DELETE /api/analytics/alerts/:id.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/alerts/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const alertId = parseInt(req.params.id, 10);
    if (isNaN(alertId) || alertId <= 0) {
      errorResponse(res, 'Invalid alert ID', 400, 'VALIDATION_ERROR');
      return;
    }
    await analyticsService.deleteMetricAlert(alertId);
    sendSuccess(res, undefined);
  })
);

/**
 * @swagger
 * /api/analytics/alerts/check:
 *   post:
 *     tags: [Analytics]
 *     summary: POST /api/analytics/alerts/check
 *     description: POST /api/analytics/alerts/check.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/alerts/check',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const triggered = await analyticsService.checkAlertTriggers();
    sendSuccess(res, { triggered });
  })
);

// =====================================================
// QUICK ANALYTICS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/quick/revenue:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/revenue
 *     description: GET /api/analytics/quick/revenue.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/revenue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const analytics = await analyticsService.getRevenueAnalytics(parseInt(days as string, 10));
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/pipeline:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/pipeline
 *     description: GET /api/analytics/quick/pipeline.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const analytics = await analyticsService.getPipelineAnalytics();
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/projects:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/projects
 *     description: GET /api/analytics/quick/projects.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/projects',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const analytics = await analyticsService.getProjectAnalytics(parseInt(days as string, 10));
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/clients:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/clients
 *     description: GET /api/analytics/quick/clients.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/clients',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const analytics = await analyticsService.getClientAnalytics();
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/quick/team:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/quick/team
 *     description: GET /api/analytics/quick/team.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/quick/team',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { days = '30' } = req.query;
    const analytics = await analyticsService.getTeamAnalytics(parseInt(days as string, 10));
    sendSuccess(res, analytics);
  })
);

/**
 * @swagger
 * /api/analytics/report-runs:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/report-runs
 *     description: GET /api/analytics/report-runs.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/report-runs',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { reportId, limit = '50' } = req.query;
    const runs = await analyticsService.getReportRuns(
      reportId ? parseInt(reportId as string, 10) : undefined,
      parseInt(limit as string, 10)
    );
    sendSuccess(res, { runs });
  })
);

// =====================================================
// SECTION 8.1: BUSINESS INTELLIGENCE ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/bi/revenue/{period}:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/revenue/:period
 *     description: GET /api/analytics/bi/revenue/:period.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: period
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/revenue/:period',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const period = req.params.period as 'month' | 'quarter' | 'year';
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getRevenueByPeriod(
      period,
      startDate as string | undefined,
      endDate as string | undefined
    );
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/bi/pipeline:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/pipeline
 *     description: GET /api/analytics/bi/pipeline.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/pipeline',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getProjectPipelineValue();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/bi/funnel:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/funnel
 *     description: GET /api/analytics/bi/funnel.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/funnel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;
    const data = await analyticsService.getAcquisitionFunnel(
      startDate as string | undefined,
      endDate as string | undefined
    );
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/bi/project-stats:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/bi/project-stats
 *     description: GET /api/analytics/bi/project-stats.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/bi/project-stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getProjectStatistics();
    sendSuccess(res, { data });
  })
);

// =====================================================
// SECTION 8.2: CLIENT INSIGHTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/clients/ltv:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/clients/ltv
 *     description: GET /api/analytics/clients/ltv.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/clients/ltv',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = '20' } = req.query;
    const data = await analyticsService.getClientLifetimeValue(parseInt(limit as string, 10));
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/clients/activity-scores:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/clients/activity-scores
 *     description: GET /api/analytics/clients/activity-scores.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/clients/activity-scores',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = '20' } = req.query;
    const data = await analyticsService.getClientActivityScores(parseInt(limit as string, 10));
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/clients/upsell:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/clients/upsell
 *     description: GET /api/analytics/clients/upsell.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/clients/upsell',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getUpsellOpportunities();
    sendSuccess(res, { data });
  })
);

// =====================================================
// SECTION 8.3: OPERATIONAL REPORTS ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/analytics/reports/overdue-invoices:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/overdue-invoices
 *     description: GET /api/analytics/reports/overdue-invoices.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/overdue-invoices',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getOverdueInvoicesReport();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/reports/pending-approvals:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/pending-approvals
 *     description: GET /api/analytics/reports/pending-approvals.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/pending-approvals',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getPendingApprovalsReport();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/reports/document-requests:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/document-requests
 *     description: GET /api/analytics/reports/document-requests.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/document-requests',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getDocumentRequestsStatusReport();
    sendSuccess(res, { data });
  })
);

/**
 * @swagger
 * /api/analytics/reports/project-health:
 *   get:
 *     tags: [Analytics]
 *     summary: GET /api/analytics/reports/project-health
 *     description: GET /api/analytics/reports/project-health.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/reports/project-health',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await analyticsService.getProjectHealthSummary();
    sendSuccess(res, { data });
  })
);

export default router;
