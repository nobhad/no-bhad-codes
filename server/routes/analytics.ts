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
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { UAParser } from 'ua-parser-js';

const router = Router();

// Rate limit for tracking events (generous limit for legitimate traffic)
const trackingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per IP
  message: 'Too many tracking requests',
});

// Stricter rate limit for admin endpoints
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Too many requests',
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
      return res.status(400).json({ error: 'Invalid payload' });
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
          session.sessionId,
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
          os,
        ]
      );
    }

    // Insert events
    for (const event of events) {
      if ('title' in event) {
        // Page view event
        await db.run(
          `INSERT INTO page_views (session_id, url, title, timestamp, time_on_page, scroll_depth, interactions)
           VALUES (?, ?, ?, datetime(?, 'unixepoch', 'subsec'), ?, ?, ?)`,
          [
            event.sessionId,
            event.url,
            event.title,
            event.timestamp / 1000,
            event.timeOnPage || 0,
            event.scrollDepth || 0,
            event.interactions || 0,
          ]
        );
      } else if ('type' in event) {
        // Interaction event
        await db.run(
          `INSERT INTO interaction_events (session_id, event_type, element, timestamp, url, data)
           VALUES (?, ?, ?, datetime(?, 'unixepoch', 'subsec'), ?, ?)`,
          [
            event.sessionId,
            event.type,
            event.element,
            event.timestamp / 1000,
            event.url,
            event.data ? JSON.stringify(event.data) : null,
          ]
        );
      }
    }

    logger.info('Tracking events received', {
      category: 'analytics',
      metadata: {
        sessionId: session.sessionId,
        eventCount: events.length,
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process tracking events', {
      category: 'analytics',
      metadata: { error },
    });
    res.status(500).json({ error: 'Failed to process tracking events' });
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
      const summary = await db.get(
        `SELECT
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(DISTINCT visitor_id) as unique_visitors,
          SUM(page_views) as total_page_views,
          CAST(AVG(total_time_on_site) AS INTEGER) as avg_session_duration,
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
        topInteractions,
      });
    } catch (error) {
      logger.error('Failed to get analytics summary', {
        category: 'analytics',
        metadata: { error },
      });
      res.status(500).json({ error: 'Failed to get analytics summary' });
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
        recentPages,
      });
    } catch (error) {
      logger.error('Failed to get realtime analytics', {
        category: 'analytics',
        metadata: { error },
      });
      res.status(500).json({ error: 'Failed to get realtime analytics' });
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
        metadata: { deletedSessions: result.changes, olderThanDays: days },
      });

      res.json({
        success: true,
        deletedSessions: result.changes,
      });
    } catch (error) {
      logger.error('Failed to clear analytics data', {
        category: 'analytics',
        metadata: { error },
      });
      res.status(500).json({ error: 'Failed to clear analytics data' });
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
      const total = countResult?.total || 0;

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
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      logger.error('Failed to get sessions list', {
        category: 'analytics',
        metadata: { error },
      });
      res.status(500).json({ error: 'Failed to get sessions list' });
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
        return res.status(404).json({ error: 'Session not found' });
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
        interactions,
      });
    } catch (error) {
      logger.error('Failed to get session details', {
        category: 'analytics',
        metadata: { error },
      });
      res.status(500).json({ error: 'Failed to get session details' });
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
          totalInteractions: interactions.length,
        },
        sessions,
        pageViews,
        interactions,
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
        metadata: { error },
      });
      res.status(500).json({ error: 'Failed to export analytics data' });
    }
  }
);

export default router;
