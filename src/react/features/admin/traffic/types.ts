/**
 * Traffic dashboard types — mirror the shapes returned by the analytics API
 * (server/services/analytics/core.ts). Web traffic to the main site and portal.
 */

export interface TrafficSummary {
  total_sessions: number;
  unique_visitors: number;
  total_page_views: number;
  avg_session_duration: number;
  avg_pages_per_session: number;
  bounce_rate: number;
}

export interface DailyBreakdown {
  date: string;
  sessions: number;
  visitors: number;
  page_views: number;
}

export interface TopPage {
  url: string;
  views: number;
  unique_views: number;
  avg_time: number;
}

export interface DeviceBreakdown {
  device_type: string;
  count: number;
}

export interface BrowserBreakdown {
  browser: string;
  count: number;
}

/** GET /api/analytics/summary */
export interface TrafficSummaryResponse {
  summary: Partial<TrafficSummary>;
  daily: DailyBreakdown[];
  topPages: TopPage[];
  topReferrers: { source: string; count: number }[];
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
  topInteractions: { event_type: string; element: string; count: number }[];
}

export interface ActiveSession {
  session_id: string;
  visitor_id: string;
  device_type: string;
  browser: string;
  referrer: string;
  page_views: number;
  last_activity: string;
}

export interface RecentPageView {
  url: string;
  title: string;
  timestamp: string;
  device_type: string;
}

/** GET /api/analytics/realtime */
export interface TrafficRealtimeResponse {
  activeSessions: number;
  sessions: ActiveSession[];
  recentPages: RecentPageView[];
}

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

/** GET /api/analytics/sessions */
export interface TrafficSessionsResponse {
  sessions: SessionListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** Props shared by every traffic subview (passed down from the router). */
export interface TrafficViewProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export type TrafficSubtab = 'overview' | 'live' | 'sessions';
