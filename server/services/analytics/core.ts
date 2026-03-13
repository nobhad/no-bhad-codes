/**
 * ===============================================
 * ANALYTICS — CORE TRACKING, SESSIONS & EXPORT
 * ===============================================
 * Database operations for event tracking, pageviews,
 * realtime visitors, session listing, and data export/cleanup.
 */

import { getDatabase } from '../../database/init.js';
import type { DatabaseRow } from '../../database/init.js';
import {
  VISITOR_SESSION_COLUMNS,
  PAGE_VIEW_COLUMNS,
  INTERACTION_EVENT_COLUMNS
} from '../../routes/analytics/helpers.js';

// =====================================================
// TYPES
// =====================================================

/** Parameters for upserting a visitor session */
export interface UpsertSessionParams {
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
  ipAddress: string;
  deviceType: string;
  browser: string;
  os: string;
}

/** Parameters for inserting a page view */
export interface InsertPageViewParams {
  sessionId: string | null;
  url: string | null;
  title: string | null;
  timestamp: number;
  timeOnPage: number;
  scrollDepth: number;
  interactions: number;
}

/** Parameters for inserting an interaction event */
export interface InsertInteractionParams {
  sessionId: string | null;
  eventType: string | null;
  element: string | null;
  timestamp: number;
  url: string | null;
  data: string | null;
}

/** Summary row returned by getSummaryMetrics */
export interface SummaryMetrics {
  total_sessions: number;
  unique_visitors: number;
  total_page_views: number;
  avg_session_duration: number;
  avg_pages_per_session: number;
  bounce_rate: number;
}

/** Daily breakdown row */
export interface DailyBreakdown {
  date: string;
  sessions: number;
  visitors: number;
  page_views: number;
}

/** Top page row */
export interface TopPage {
  url: string;
  views: number;
  avg_time: number;
}

/** Top referrer row */
export interface TopReferrer {
  source: string;
  count: number;
}

/** Device breakdown row */
export interface DeviceBreakdown {
  device_type: string;
  count: number;
}

/** Browser breakdown row */
export interface BrowserBreakdown {
  browser: string;
  count: number;
}

/** Top interaction row */
export interface TopInteraction {
  event_type: string;
  element: string;
  count: number;
}

/** Active session row for realtime data */
export interface ActiveSession {
  session_id: string;
  visitor_id: string;
  device_type: string;
  browser: string;
  referrer: string;
  page_views: number;
  last_activity: string;
}

/** Recent page view row for realtime data */
export interface RecentPageView {
  url: string;
  title: string;
  timestamp: string;
  device_type: string;
}

/** Session list item */
export interface SessionListItem {
  session_id: string;
  visitor_id: string;
  start_time: string;
  last_activity: string;
  page_views: number;
  total_time_on_site: number;
  bounced: number;
  referrer: string;
  device_type: string;
  browser: string;
  os: string;
  country: string;
  city: string;
}

/** Page view detail for session detail endpoint */
export interface SessionPageView {
  url: string;
  title: string;
  timestamp: string;
  time_on_page: number;
  scroll_depth: number;
  interactions: number;
}

/** Interaction detail for session detail endpoint */
export interface SessionInteraction {
  event_type: string;
  element: string;
  timestamp: string;
  url: string;
  data: string | null;
}

/** Result from data deletion */
export interface DeleteResult {
  deletedSessions: number | undefined;
}

// =====================================================
// TRACKING — UPSERT SESSION & INSERT EVENTS
// =====================================================

/** Check whether a session already exists by session_id */
export async function findSession(sessionId: string): Promise<DatabaseRow | undefined> {
  const db = getDatabase();
  return db.get(
    'SELECT session_id FROM visitor_sessions WHERE session_id = ?',
    [sessionId]
  );
}

/** Update an existing visitor session with latest activity data */
export async function updateSession(params: UpsertSessionParams): Promise<void> {
  const db = getDatabase();
  await db.run(
    `UPDATE visitor_sessions SET
      last_activity = datetime(?, 'unixepoch', 'subsec'),
      page_views = ?,
      total_time_on_site = ?,
      bounced = ?,
      updated_at = datetime('now')
    WHERE session_id = ?`,
    [
      params.lastActivity / 1000,
      params.pageViews,
      params.totalTimeOnSite,
      params.bounced ? 1 : 0,
      params.sessionId
    ]
  );
}

/** Insert a new visitor session */
export async function insertSession(params: UpsertSessionParams): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO visitor_sessions (
      session_id, visitor_id, start_time, last_activity, page_views,
      total_time_on_site, bounced, referrer, user_agent, screen_resolution,
      language, timezone, ip_address, device_type, browser, os
    ) VALUES (?, ?, datetime(?, 'unixepoch', 'subsec'), datetime(?, 'unixepoch', 'subsec'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.sessionId,
      params.visitorId,
      params.startTime / 1000,
      params.lastActivity / 1000,
      params.pageViews,
      params.totalTimeOnSite,
      params.bounced ? 1 : 0,
      params.referrer,
      params.userAgent,
      params.screenResolution,
      params.language,
      params.timezone,
      params.ipAddress,
      params.deviceType,
      params.browser,
      params.os
    ]
  );
}

/** Insert a page view event */
export async function insertPageView(params: InsertPageViewParams): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO page_views (session_id, url, title, timestamp, time_on_page, scroll_depth, interactions)
     VALUES (?, ?, ?, datetime(?, 'unixepoch', 'subsec'), ?, ?, ?)`,
    [params.sessionId, params.url, params.title, params.timestamp, params.timeOnPage, params.scrollDepth, params.interactions]
  );
}

/** Insert an interaction event */
export async function insertInteraction(params: InsertInteractionParams): Promise<void> {
  const db = getDatabase();
  await db.run(
    `INSERT INTO interaction_events (session_id, event_type, element, timestamp, url, data)
     VALUES (?, ?, ?, datetime(?, 'unixepoch', 'subsec'), ?, ?)`,
    [params.sessionId, params.eventType, params.element, params.timestamp, params.url, params.data]
  );
}

// =====================================================
// SUMMARY
// =====================================================

/** Max session duration (ms) used to filter outliers */
const MAX_SESSION_MS = 3600000;

/** Get aggregate summary metrics for a date range */
export async function getSummaryMetrics(dateThreshold: string): Promise<SummaryMetrics> {
  const db = getDatabase();
  const row = await db.get<SummaryMetrics>(
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
  return row || {} as SummaryMetrics;
}

/** Get daily session/visitor/pageview breakdown */
export async function getDailyBreakdown(dateThreshold: string): Promise<DailyBreakdown[]> {
  const db = getDatabase();
  return db.all<DailyBreakdown>(
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
}

/** Get top pages by view count */
export async function getTopPages(dateThreshold: string): Promise<TopPage[]> {
  const db = getDatabase();
  return db.all<TopPage>(
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
}

/** Get top referrer sources */
export async function getTopReferrers(dateThreshold: string): Promise<TopReferrer[]> {
  const db = getDatabase();
  return db.all<TopReferrer>(
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
}

/** Get device type breakdown */
export async function getDeviceBreakdown(dateThreshold: string): Promise<DeviceBreakdown[]> {
  const db = getDatabase();
  return db.all<DeviceBreakdown>(
    `SELECT
      device_type,
      COUNT(*) as count
    FROM visitor_sessions
    WHERE start_time >= ?
    GROUP BY device_type
    ORDER BY count DESC`,
    [dateThreshold]
  );
}

/** Get browser breakdown (top 5) */
export async function getBrowserBreakdown(dateThreshold: string): Promise<BrowserBreakdown[]> {
  const db = getDatabase();
  return db.all<BrowserBreakdown>(
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
}

/** Get top interaction events */
export async function getTopInteractions(dateThreshold: string): Promise<TopInteraction[]> {
  const db = getDatabase();
  return db.all<TopInteraction>(
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
}

// =====================================================
// REALTIME
// =====================================================

/** Get active sessions from the last 5 minutes */
export async function getActiveSessions(): Promise<ActiveSession[]> {
  const db = getDatabase();
  return db.all<ActiveSession>(
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
}

/** Get recent page views from the last 10 minutes */
export async function getRecentPageViews(): Promise<RecentPageView[]> {
  const db = getDatabase();
  return db.all<RecentPageView>(
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
}

// =====================================================
// DATA CLEANUP
// =====================================================

/** Delete analytics data older than the given date threshold */
export async function deleteOldData(dateThreshold: string): Promise<DeleteResult> {
  const db = getDatabase();

  await db.run(
    'DELETE FROM interaction_events WHERE timestamp < ?',
    [dateThreshold]
  );

  await db.run(
    'DELETE FROM page_views WHERE timestamp < ?',
    [dateThreshold]
  );

  const result = await db.run(
    'DELETE FROM visitor_sessions WHERE start_time < ?',
    [dateThreshold]
  );

  return { deletedSessions: result.changes };
}

// =====================================================
// SESSION LIST & DETAIL
// =====================================================

/** Get total session count for a date range */
export async function getSessionCount(dateThreshold: string): Promise<number> {
  const db = getDatabase();
  const row = await db.get<{ total: number }>(
    'SELECT COUNT(*) as total FROM visitor_sessions WHERE start_time >= ?',
    [dateThreshold]
  );
  return row?.total ?? 0;
}

/** Get paginated session list */
export async function getSessionList(
  dateThreshold: string,
  limit: number,
  offset: number
): Promise<SessionListItem[]> {
  const db = getDatabase();
  return db.all<SessionListItem>(
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
    [dateThreshold, limit, offset]
  );
}

/** Get full session detail by session_id */
export async function getSessionById(sessionId: string): Promise<DatabaseRow | undefined> {
  const db = getDatabase();
  return db.get(
    `SELECT ${VISITOR_SESSION_COLUMNS} FROM visitor_sessions WHERE session_id = ?`,
    [sessionId]
  );
}

/** Get page views for a given session */
export async function getPageViewsBySession(sessionId: string): Promise<SessionPageView[]> {
  const db = getDatabase();
  return db.all<SessionPageView>(
    `SELECT url, title, timestamp, time_on_page, scroll_depth, interactions
     FROM page_views
     WHERE session_id = ?
     ORDER BY timestamp ASC`,
    [sessionId]
  );
}

/** Get interaction events for a given session */
export async function getInteractionsBySession(sessionId: string): Promise<SessionInteraction[]> {
  const db = getDatabase();
  return db.all<SessionInteraction>(
    `SELECT event_type, element, timestamp, url, data
     FROM interaction_events
     WHERE session_id = ?
     ORDER BY timestamp ASC`,
    [sessionId]
  );
}

// =====================================================
// EXPORT
// =====================================================

/** Get all sessions for export within a date range */
export async function getExportSessions(dateThreshold: string): Promise<DatabaseRow[]> {
  const db = getDatabase();
  return db.all(
    `SELECT ${VISITOR_SESSION_COLUMNS} FROM visitor_sessions
     WHERE start_time >= ?
     ORDER BY start_time DESC`,
    [dateThreshold]
  );
}

/** Get all page views for export within a date range */
export async function getExportPageViews(dateThreshold: string): Promise<DatabaseRow[]> {
  const db = getDatabase();
  return db.all(
    `SELECT ${PAGE_VIEW_COLUMNS} FROM page_views
     WHERE timestamp >= ?
     ORDER BY timestamp DESC`,
    [dateThreshold]
  );
}

/** Get all interaction events for export within a date range */
export async function getExportInteractions(dateThreshold: string): Promise<DatabaseRow[]> {
  const db = getDatabase();
  return db.all(
    `SELECT ${INTERACTION_EVENT_COLUMNS} FROM interaction_events
     WHERE timestamp >= ?
     ORDER BY timestamp DESC`,
    [dateThreshold]
  );
}
