/**
 * ===============================================
 * ANALYTICS ROUTE HELPERS
 * ===============================================
 * @file server/routes/analytics/helpers.ts
 *
 * Shared helpers, types, middleware, and constants for analytics routes.
 */

import { Request, Response } from 'express';
import { rateLimit } from '../../middleware/security.js';
import { logger } from '../../services/logger.js';
import { errorResponse, ErrorCodes } from '../../utils/api-response.js';

// =====================================================
// COLUMN CONSTANTS
// =====================================================

/** Explicit column list for visitor_sessions SELECT queries (avoid SELECT *) */
export const VISITOR_SESSION_COLUMNS = `
  id, session_id, visitor_id, start_time, last_activity, page_views,
  total_time_on_site, bounced, referrer, user_agent, screen_resolution,
  language, timezone, ip_address, country, city, device_type, browser, os,
  created_at, updated_at
`.replace(/\s+/g, ' ').trim();

/** Explicit column list for page_views SELECT queries */
export const PAGE_VIEW_COLUMNS = `
  id, session_id, url, title, timestamp, time_on_page, scroll_depth,
  interactions, created_at
`.replace(/\s+/g, ' ').trim();

/** Explicit column list for interaction_events SELECT queries */
export const INTERACTION_EVENT_COLUMNS = `
  id, session_id, event_type, element, timestamp, url, data, created_at
`.replace(/\s+/g, ' ').trim();

// =====================================================
// TYPES
// =====================================================

export interface TrackingPayload {
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

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Wrap async route handlers with error logging */
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) => (req: Request, res: Response) => {
    Promise.resolve(fn(req, res)).catch((error) => {
      logger.error('Route error', { category: 'analytics', metadata: { error } });
      errorResponse(res, 'Internal server error', 500, ErrorCodes.INTERNAL_ERROR);
    });
  };

/**
 * Compute a date threshold for SQL queries.
 * Returns ISO string that can be used as a parameterized query value.
 */
export function getDateThreshold(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// =====================================================
// RATE LIMITERS
// =====================================================

/** Rate limit for tracking events (generous limit for legitimate traffic) */
export const trackingRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per IP
  message: 'Too many tracking requests'
});

/** Stricter rate limit for admin endpoints. Configurable via env vars. */
const adminWindowMs = Number(process.env.ANALYTICS_ADMIN_RATE_WINDOW_MS) || 60 * 1000;
const adminMaxRequests = Number(process.env.ANALYTICS_ADMIN_MAX_REQUESTS) || 30;
export const adminRateLimit = rateLimit({
  windowMs: adminWindowMs,
  maxRequests: adminMaxRequests,
  // In development, skip strict admin limits to avoid local 429s
  skipIf: () => process.env.NODE_ENV === 'development',
  message: 'Too many requests'
});
