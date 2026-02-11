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
import { errorResponse } from '../utils/api-response.js';

// Helper for async route handlers
const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      logger.error('Route error', { category: 'analytics', metadata: { error } });
      errorResponse(res, 'Internal server error', 500, 'INTERNAL_ERROR');
    });
  };

const router = Router();

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
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
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
          [
            sessionId,
            url,
            title,
            timestamp,
            timeOnPage,
            scrollDepth,
            interactions
          ]
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
          [
            sessionId,
            eventType,
            element,
            timestamp,
            url,
            data
          ]
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

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process tracking events', {
      category: 'analytics',
      metadata: { error }
    });
    errorResponse(res, 'Failed to process tracking events', 500, 'INTERNAL_ERROR');
  }
});

/**
 * GET /api/analytics/summary
 * Get analytics summary (admin only)
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
      const summary = await db.get(
        `SELECT
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(DISTINCT visitor_id) as unique_visitors,
          SUM(page_views) as total_page_views,
          CAST(AVG(CASE WHEN total_time_on_site <= ${MAX_SESSION_MS} THEN total_time_on_site ELSE NULL END) AS INTEGER) as avg_session_duration,
          ROUND(AVG(page_views), 2) as avg_pages_per_session,
          ROUND(COUNT(CASE WHEN bounced = 1 THEN 1 END) * 100.0 / MAX(COUNT(*), 1), 2) as bounce_rate
        FROM visitor_sessions
        WHERE start_time >= datetime('now', '-${daysNum} days')`
      );

      // Get daily breakdown
      const daily = await db.all(
        `SELECT
          DATE(start_time) as date,
          COUNT(DISTINCT session_id) as sessions,
          COUNT(DISTINCT visitor_id) as visitors,
          SUM(page_views) as page_views
        FROM visitor_sessions
        WHERE start_time >= datetime('now', '-${daysNum} days')
        GROUP BY DATE(start_time)
        ORDER BY date DESC`
      );

      // Get top pages
      const topPages = await db.all(
        `SELECT
          url,
          COUNT(*) as views,
          CAST(AVG(time_on_page) AS INTEGER) as avg_time
        FROM page_views
        WHERE timestamp >= datetime('now', '-${daysNum} days')
        GROUP BY url
        ORDER BY views DESC
        LIMIT 10`
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
        WHERE start_time >= datetime('now', '-${daysNum} days')
        GROUP BY source
        ORDER BY count DESC
        LIMIT 10`
      );

      // Get device breakdown
      const devices = await db.all(
        `SELECT
          device_type,
          COUNT(*) as count
        FROM visitor_sessions
        WHERE start_time >= datetime('now', '-${daysNum} days')
        GROUP BY device_type
        ORDER BY count DESC`
      );

      // Get browser breakdown
      const browsers = await db.all(
        `SELECT
          browser,
          COUNT(*) as count
        FROM visitor_sessions
        WHERE start_time >= datetime('now', '-${daysNum} days')
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 5`
      );

      // Get top interactions
      const topInteractions = await db.all(
        `SELECT
          event_type,
          element,
          COUNT(*) as count
        FROM interaction_events
        WHERE timestamp >= datetime('now', '-${daysNum} days')
        GROUP BY event_type, element
        ORDER BY count DESC
        LIMIT 10`
      );

      res.json({
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
 * GET /api/analytics/realtime
 * Get realtime visitor data (admin only)
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

      res.json({
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
 * DELETE /api/analytics/data
 * Clear analytics data older than specified days (admin only)
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

      // Delete old interaction events
      await db.run(
        `DELETE FROM interaction_events
         WHERE timestamp < datetime('now', '-${days} days')`
      );

      // Delete old page views
      await db.run(
        `DELETE FROM page_views
         WHERE timestamp < datetime('now', '-${days} days')`
      );

      // Delete old sessions (will cascade if foreign keys are set up)
      const result = await db.run(
        `DELETE FROM visitor_sessions
         WHERE start_time < datetime('now', '-${days} days')`
      );

      logger.info('Analytics data cleared', {
        category: 'analytics',
        metadata: { deletedSessions: result.changes, olderThanDays: days }
      });

      res.json({
        success: true,
        deletedSessions: result.changes
      });
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
 * GET /api/analytics/sessions
 * List visitor sessions with pagination (admin only)
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - days: Filter sessions from last N days (default: 7)
 *
 * Response:
 * - sessions: Array of session objects
 * - pagination: { page, limit, total, totalPages }
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

      // Get total count
      const countResult = await db.get(
        `SELECT COUNT(*) as total FROM visitor_sessions
         WHERE start_time >= datetime('now', '-${daysNum} days')`
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
        WHERE start_time >= datetime('now', '-${daysNum} days')
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?`,
        [limitNum, offset]
      );

      res.json({
        sessions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: typeof total === 'number' && typeof limitNum === 'number' ? Math.ceil(total / limitNum) : 0
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
 * GET /api/analytics/sessions/:sessionId
 * Get detailed session information (admin only)
 *
 * Response:
 * - session: Session object with full details
 * - pageViews: Array of page views in this session
 * - interactions: Array of interactions in this session
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
        'SELECT * FROM visitor_sessions WHERE session_id = ?',
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

      res.json({
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
 * GET /api/analytics/export
 * Export analytics data as JSON (admin only)
 *
 * Query params:
 * - days: Export data from last N days (default: 30, max: 365)
 * - format: Export format ('json' only for now)
 *
 * Response:
 * - JSON file download with sessions, page views, and interactions
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

      // Get all data for export
      const sessions = await db.all(
        `SELECT * FROM visitor_sessions
         WHERE start_time >= datetime('now', '-${daysNum} days')
         ORDER BY start_time DESC`
      );

      const pageViews = await db.all(
        `SELECT * FROM page_views
         WHERE timestamp >= datetime('now', '-${daysNum} days')
         ORDER BY timestamp DESC`
      );

      const interactions = await db.all(
        `SELECT * FROM interaction_events
         WHERE timestamp >= datetime('now', '-${daysNum} days')
         ORDER BY timestamp DESC`
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

      res.json(exportData);
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
 * GET /api/analytics/reports
 * Get all saved reports
 */
router.get('/reports', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { type, favorites } = req.query;
  const reports = await analyticsService.getSavedReports(
    type as string | undefined,
    favorites === 'true'
  );
  res.json({ reports });
}));

/**
 * POST /api/analytics/reports
 * Create a new saved report
 */
router.post('/reports', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const report = await analyticsService.createSavedReport({
    ...req.body,
    createdBy: userEmail
  });
  res.status(201).json({ report });
}));

/**
 * GET /api/analytics/reports/:id
 * Get a specific saved report
 */
router.get('/reports/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const report = await analyticsService.getSavedReport(parseInt(req.params.id, 10));
  if (!report) {
    errorResponse(res, 'Report not found', 404, 'RESOURCE_NOT_FOUND');
    return;
  }
  res.json({ report });
}));

/**
 * PUT /api/analytics/reports/:id
 * Update a saved report
 */
router.put('/reports/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const report = await analyticsService.updateSavedReport(
    parseInt(req.params.id, 10),
    req.body
  );
  res.json({ report });
}));

/**
 * DELETE /api/analytics/reports/:id
 * Delete a saved report
 */
router.delete('/reports/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await analyticsService.deleteSavedReport(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

/**
 * POST /api/analytics/reports/:id/favorite
 * Toggle report favorite status
 */
router.post('/reports/:id/favorite', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const report = await analyticsService.toggleReportFavorite(parseInt(req.params.id, 10));
  res.json({ report });
}));

/**
 * POST /api/analytics/reports/:id/run
 * Run a saved report and get results
 */
router.post('/reports/:id/run', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const result = await analyticsService.runReport(parseInt(req.params.id, 10));
  res.json(result);
}));

// =====================================================
// REPORT SCHEDULES ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/reports/:reportId/schedules
 * Get schedules for a report
 */
router.get('/reports/:reportId/schedules', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const schedules = await analyticsService.getReportSchedules(parseInt(req.params.reportId, 10));
  res.json({ schedules });
}));

/**
 * POST /api/analytics/reports/:reportId/schedules
 * Create a schedule for a report
 */
router.post('/reports/:reportId/schedules', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const schedule = await analyticsService.createReportSchedule({
    ...req.body,
    reportId: parseInt(req.params.reportId, 10),
    createdBy: userEmail
  });
  res.status(201).json({ schedule });
}));

/**
 * PUT /api/analytics/schedules/:id
 * Update a report schedule
 */
router.put('/schedules/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const schedule = await analyticsService.updateReportSchedule(
    parseInt(req.params.id, 10),
    req.body
  );
  res.json({ schedule });
}));

/**
 * DELETE /api/analytics/schedules/:id
 * Delete a report schedule
 */
router.delete('/schedules/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await analyticsService.deleteReportSchedule(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

/**
 * POST /api/analytics/schedules/process
 * Process all due scheduled reports
 */
router.post('/schedules/process', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const processed = await analyticsService.processDueSchedules();
  res.json({ processed });
}));

// =====================================================
// DASHBOARD WIDGETS ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/widgets
 * Get user's dashboard widgets
 */
router.get('/widgets', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const widgets = await analyticsService.getDashboardWidgets(userEmail);
  res.json({ widgets });
}));

/**
 * POST /api/analytics/widgets
 * Create a dashboard widget
 */
router.post('/widgets', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const widget = await analyticsService.createDashboardWidget({
    ...req.body,
    userEmail
  });
  res.status(201).json({ widget });
}));

/**
 * PUT /api/analytics/widgets/:id
 * Update a dashboard widget
 */
router.put('/widgets/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const widget = await analyticsService.updateDashboardWidget(
    parseInt(req.params.id, 10),
    req.body
  );
  res.json({ widget });
}));

/**
 * DELETE /api/analytics/widgets/:id
 * Delete a dashboard widget
 */
router.delete('/widgets/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await analyticsService.deleteDashboardWidget(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

/**
 * PUT /api/analytics/widgets/layout
 * Update widget layout (positions/sizes)
 */
router.put('/widgets/layout', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const { widgets } = req.body;
  await analyticsService.updateWidgetLayout(userEmail, widgets);
  res.json({ success: true });
}));

/**
 * GET /api/analytics/widgets/presets
 * Get available dashboard presets
 */
router.get('/widgets/presets', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const presets = await analyticsService.getDashboardPresets();
  res.json({ presets });
}));

/**
 * POST /api/analytics/widgets/presets/:id/apply
 * Apply a dashboard preset
 */
router.post('/widgets/presets/:id/apply', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const widgets = await analyticsService.applyDashboardPreset(
    userEmail,
    parseInt(req.params.id, 10)
  );
  res.json({ widgets });
}));

// =====================================================
// KPI SNAPSHOTS ENDPOINTS
// =====================================================

/**
 * POST /api/analytics/kpis/snapshot
 * Capture a KPI snapshot
 */
router.post('/kpis/snapshot', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await analyticsService.captureKPISnapshot();
  res.json({ success: true });
}));

/**
 * GET /api/analytics/kpis/latest
 * Get latest KPI values
 */
router.get('/kpis/latest', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const kpis = await analyticsService.getLatestKPIs();
  res.json({ kpis });
}));

/**
 * GET /api/analytics/kpis/:type/trend
 * Get KPI trend over time
 */
router.get('/kpis/:type/trend', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days = '30' } = req.query;
  const daysNum = parseInt(days as string, 10);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  const trend = await analyticsService.getKPITrend(
    req.params.type,
    { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] }
  );
  res.json({ trend });
}));

// =====================================================
// METRIC ALERTS ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/alerts
 * Get all metric alerts
 */
router.get('/alerts', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const alerts = await analyticsService.getMetricAlerts();
  res.json({ alerts });
}));

/**
 * POST /api/analytics/alerts
 * Create a metric alert
 */
router.post('/alerts', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const userEmail = (req as Request & { user?: { email: string } }).user?.email || 'admin';
  const alert = await analyticsService.createMetricAlert({
    ...req.body,
    createdBy: userEmail
  });
  res.status(201).json({ alert });
}));

/**
 * PUT /api/analytics/alerts/:id
 * Update a metric alert
 */
router.put('/alerts/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const alert = await analyticsService.updateMetricAlert(
    parseInt(req.params.id, 10),
    req.body
  );
  res.json({ alert });
}));

/**
 * DELETE /api/analytics/alerts/:id
 * Delete a metric alert
 */
router.delete('/alerts/:id', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  await analyticsService.deleteMetricAlert(parseInt(req.params.id, 10));
  res.json({ success: true });
}));

/**
 * POST /api/analytics/alerts/check
 * Check all alerts for triggers
 */
router.post('/alerts/check', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const triggered = await analyticsService.checkAlertTriggers();
  res.json({ triggered });
}));

// =====================================================
// QUICK ANALYTICS ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/quick/revenue
 * Quick revenue analytics
 */
router.get('/quick/revenue', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days = '30' } = req.query;
  const analytics = await analyticsService.getRevenueAnalytics(parseInt(days as string, 10));
  res.json(analytics);
}));

/**
 * GET /api/analytics/quick/pipeline
 * Quick pipeline analytics
 */
router.get('/quick/pipeline', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const analytics = await analyticsService.getPipelineAnalytics();
  res.json(analytics);
}));

/**
 * GET /api/analytics/quick/projects
 * Quick project analytics
 */
router.get('/quick/projects', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days = '30' } = req.query;
  const analytics = await analyticsService.getProjectAnalytics(parseInt(days as string, 10));
  res.json(analytics);
}));

/**
 * GET /api/analytics/quick/clients
 * Quick client analytics
 */
router.get('/quick/clients', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const analytics = await analyticsService.getClientAnalytics();
  res.json(analytics);
}));

/**
 * GET /api/analytics/quick/team
 * Quick team performance analytics
 */
router.get('/quick/team', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { days = '30' } = req.query;
  const analytics = await analyticsService.getTeamAnalytics(parseInt(days as string, 10));
  res.json(analytics);
}));

/**
 * GET /api/analytics/report-runs
 * Get report run history
 */
router.get('/report-runs', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { reportId, limit = '50' } = req.query;
  const runs = await analyticsService.getReportRuns(
    reportId ? parseInt(reportId as string, 10) : undefined,
    parseInt(limit as string, 10)
  );
  res.json({ runs });
}));

// =====================================================
// SECTION 8.1: BUSINESS INTELLIGENCE ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/bi/revenue/:period
 * Get revenue breakdown by time period
 */
router.get('/bi/revenue/:period', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const period = req.params.period as 'month' | 'quarter' | 'year';
  const { startDate, endDate } = req.query;
  const data = await analyticsService.getRevenueByPeriod(
    period,
    startDate as string | undefined,
    endDate as string | undefined
  );
  res.json({ data });
}));

/**
 * GET /api/analytics/bi/pipeline
 * Get project pipeline value
 */
router.get('/bi/pipeline', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getProjectPipelineValue();
  res.json({ data });
}));

/**
 * GET /api/analytics/bi/funnel
 * Get client acquisition funnel
 */
router.get('/bi/funnel', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  const data = await analyticsService.getAcquisitionFunnel(
    startDate as string | undefined,
    endDate as string | undefined
  );
  res.json({ data });
}));

/**
 * GET /api/analytics/bi/project-stats
 * Get project statistics
 */
router.get('/bi/project-stats', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getProjectStatistics();
  res.json({ data });
}));

// =====================================================
// SECTION 8.2: CLIENT INSIGHTS ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/clients/ltv
 * Get client lifetime value
 */
router.get('/clients/ltv', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { limit = '20' } = req.query;
  const data = await analyticsService.getClientLifetimeValue(parseInt(limit as string, 10));
  res.json({ data });
}));

/**
 * GET /api/analytics/clients/activity-scores
 * Get client activity scores
 */
router.get('/clients/activity-scores', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { limit = '20' } = req.query;
  const data = await analyticsService.getClientActivityScores(parseInt(limit as string, 10));
  res.json({ data });
}));

/**
 * GET /api/analytics/clients/upsell
 * Get upsell opportunities
 */
router.get('/clients/upsell', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getUpsellOpportunities();
  res.json({ data });
}));

// =====================================================
// SECTION 8.3: OPERATIONAL REPORTS ENDPOINTS
// =====================================================

/**
 * GET /api/analytics/reports/overdue-invoices
 * Get overdue invoices report
 */
router.get('/reports/overdue-invoices', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getOverdueInvoicesReport();
  res.json({ data });
}));

/**
 * GET /api/analytics/reports/pending-approvals
 * Get pending approvals aging report
 */
router.get('/reports/pending-approvals', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getPendingApprovalsReport();
  res.json({ data });
}));

/**
 * GET /api/analytics/reports/document-requests
 * Get document requests status report
 */
router.get('/reports/document-requests', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getDocumentRequestsStatusReport();
  res.json({ data });
}));

/**
 * GET /api/analytics/reports/project-health
 * Get project health summary
 */
router.get('/reports/project-health', authenticateToken, requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const data = await analyticsService.getProjectHealthSummary();
  res.json({ data });
}));

export default router;
