/**
 * ===============================================
 * ADMIN OVERVIEW MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-overview.ts
 *
 * Overview/dashboard statistics functionality for admin dashboard.
 * Fetches real data from visitor tracking service.
 * Dynamically imported for code splitting.
 */

import type { AdminDashboardContext } from '../admin-types';

interface OverviewStats {
  totalVisitors: number;
  visitorsChange: number;
  pageViews: number;
  pageViewsChange: number;
  avgSessionDuration: number;
  sessionChange: number;
  cardInteractions: number;
  interactionsChange: number;
}

interface StoredEvent {
  sessionId: string;
  timestamp: number;
  timeOnPage?: number;
  interactions?: number;
  type?: string;
  element?: string;
}

/**
 * Load overview data for admin dashboard
 */
export async function loadOverviewData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const stats = await getOverviewStats();

    // Update UI with real data
    updateElement('total-visitors', formatNumber(stats.totalVisitors));
    updateElement('visitors-change', formatChange(stats.visitorsChange), getChangeClass(stats.visitorsChange));

    updateElement('page-views', formatNumber(stats.pageViews));
    updateElement('views-change', formatChange(stats.pageViewsChange), getChangeClass(stats.pageViewsChange));

    updateElement('avg-session', formatDuration(stats.avgSessionDuration));
    updateElement('session-change', formatChange(stats.sessionChange), getChangeClass(stats.sessionChange));

    updateElement('card-interactions', formatNumber(stats.cardInteractions));
    updateElement('interactions-change', formatChange(stats.interactionsChange), getChangeClass(stats.interactionsChange));

  } catch (error) {
    console.error('[AdminOverview] Error loading overview data:', error);
    // Show error state in UI
    showNoDataMessage();
  }
}

/**
 * Get overview statistics from visitor tracking data
 */
async function getOverviewStats(): Promise<OverviewStats> {
  const events = getStoredEvents();
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

  // Current week events
  const currentWeekEvents = events.filter(e => e.timestamp >= oneWeekAgo);
  // Previous week events (for comparison)
  const previousWeekEvents = events.filter(e => e.timestamp >= twoWeeksAgo && e.timestamp < oneWeekAgo);

  // Calculate current week stats
  const currentStats = calculatePeriodStats(currentWeekEvents);
  const previousStats = calculatePeriodStats(previousWeekEvents);

  // Calculate percentage changes
  const visitorsChange = calculatePercentChange(currentStats.uniqueVisitors, previousStats.uniqueVisitors);
  const pageViewsChange = calculatePercentChange(currentStats.pageViews, previousStats.pageViews);
  const sessionChange = calculatePercentChange(currentStats.avgSessionDuration, previousStats.avgSessionDuration);
  const interactionsChange = calculatePercentChange(currentStats.cardInteractions, previousStats.cardInteractions);

  return {
    totalVisitors: currentStats.uniqueVisitors,
    visitorsChange,
    pageViews: currentStats.pageViews,
    pageViewsChange,
    avgSessionDuration: currentStats.avgSessionDuration,
    sessionChange,
    cardInteractions: currentStats.cardInteractions,
    interactionsChange
  };
}

/**
 * Calculate statistics for a time period
 */
function calculatePeriodStats(events: StoredEvent[]): {
  uniqueVisitors: number;
  pageViews: number;
  avgSessionDuration: number;
  cardInteractions: number;
} {
  if (events.length === 0) {
    return {
      uniqueVisitors: 0,
      pageViews: 0,
      avgSessionDuration: 0,
      cardInteractions: 0
    };
  }

  // Unique sessions = unique visitors (simplified)
  const uniqueSessions = new Set(events.map(e => e.sessionId));

  // Page views = events with timeOnPage (page view events)
  const pageViewEvents = events.filter(e => 'timeOnPage' in e || !e.type);

  // Total time on site
  const totalTime = events.reduce((sum, e) => sum + (e.timeOnPage || 0), 0);

  // Card interactions
  const cardInteractions = events.filter(e =>
    e.type === 'business_card' ||
    (e.element && e.element.includes('business-card'))
  ).length;

  return {
    uniqueVisitors: uniqueSessions.size,
    pageViews: pageViewEvents.length,
    avgSessionDuration: uniqueSessions.size > 0 ? totalTime / uniqueSessions.size : 0,
    cardInteractions
  };
}

/**
 * Get stored events from localStorage
 */
function getStoredEvents(): StoredEvent[] {
  try {
    const stored = localStorage.getItem('nbw_tracking_events');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Calculate percentage change between two values
 */
function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms: number): string {
  if (ms === 0) return '0s';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format change percentage
 */
function formatChange(change: number): string {
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change}% from last week`;
}

/**
 * Get CSS class for change indicator
 */
function getChangeClass(change: number): string {
  return change >= 0 ? 'positive' : 'negative';
}

/**
 * Update DOM element with text and optional class
 */
function updateElement(id: string, text: string, className?: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
    if (className) {
      element.className = `metric-change ${className}`;
    }
  }
}

/**
 * Show message when no data is available
 */
function showNoDataMessage(): void {
  updateElement('total-visitors', '—');
  updateElement('visitors-change', 'No data available');
  updateElement('page-views', '—');
  updateElement('views-change', 'No data available');
  updateElement('avg-session', '—');
  updateElement('session-change', 'No data available');
  updateElement('card-interactions', '—');
  updateElement('interactions-change', 'No data available');
}

/**
 * Check if tracking data exists
 */
export function hasTrackingData(): boolean {
  const events = getStoredEvents();
  return events.length > 0;
}

/**
 * Get total event count
 */
export function getEventCount(): number {
  return getStoredEvents().length;
}
