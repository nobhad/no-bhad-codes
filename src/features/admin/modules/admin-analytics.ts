/**
 * ===============================================
 * ADMIN ANALYTICS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-analytics.ts
 *
 * Analytics and performance tracking for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { Chart, registerables } from 'chart.js';
import { apiFetch } from '../../../utils/api-client';
import type {
  PerformanceMetricsDisplay,
  AnalyticsData,
  AnalyticsDataItem,
  RawVisitorData,
  AdminDashboardContext
} from '../admin-types';

// Register Chart.js components
Chart.register(...registerables);

const charts: Map<string, Chart> = new Map();

export async function loadOverviewData(_ctx: AdminDashboardContext): Promise<void> {
  // Load overview stats and charts
  await Promise.all([
    loadVisitorsChart(),
    loadSourcesChart(),
    loadAnalyticsSummary()
  ]);
}

async function loadAnalyticsSummary(): Promise<void> {
  try {
    const response = await apiFetch('/api/analytics/summary?days=30');

    if (!response.ok) {
      // 401 handled by apiFetch, only show defaults for other errors
      if (response.status !== 401) {
        console.warn('[AdminAnalytics] Failed to load analytics summary');
        showOverviewDefaults();
      }
      return;
    }

    const data = await response.json();
    const summary = data.summary || {};

    // Update analytics tab stats
    updateElement('analytics-visitors', formatNumber(summary.unique_visitors || 0));
    updateElement('analytics-pageviews', formatNumber(summary.total_page_views || 0));
    updateElement('analytics-sessions', formatDuration(summary.avg_session_duration || 0));

    // Update overview tab stats
    updateElement('total-visitors', formatNumber(summary.unique_visitors || 0));
    updateElement('page-views', formatNumber(summary.total_page_views || 0));
    updateElement('avg-session', formatDuration(summary.avg_session_duration || 0));

    // Update stat-visitors with today's visitors
    if (data.daily && data.daily.length > 0) {
      const todayVisitors = data.daily[0]?.visitors || 0;
      updateElement('stat-visitors', todayVisitors.toString());
    }

    // Calculate week-over-week changes if we have daily data
    if (data.daily && data.daily.length >= 7) {
      const thisWeek = data.daily.slice(0, 7);
      const lastWeek = data.daily.slice(7, 14);

      if (lastWeek.length > 0) {
        // Visitors change
        const thisWeekVisitors = thisWeek.reduce((sum: number, d: { visitors?: number }) => sum + (d.visitors || 0), 0);
        const lastWeekVisitors = lastWeek.reduce((sum: number, d: { visitors?: number }) => sum + (d.visitors || 0), 0);
        const visitorChange = calculatePercentChange(lastWeekVisitors, thisWeekVisitors);
        updateChangeElement('visitors-change', visitorChange);

        // Page views change
        const thisWeekViews = thisWeek.reduce((sum: number, d: { page_views?: number }) => sum + (d.page_views || 0), 0);
        const lastWeekViews = lastWeek.reduce((sum: number, d: { page_views?: number }) => sum + (d.page_views || 0), 0);
        const viewsChange = calculatePercentChange(lastWeekViews, thisWeekViews);
        updateChangeElement('views-change', viewsChange);

        // Session duration change
        const thisWeekSessions = thisWeek.reduce((sum: number, d: { avg_session?: number }) => sum + (d.avg_session || 0), 0) / thisWeek.length;
        const lastWeekSessions = lastWeek.reduce((sum: number, d: { avg_session?: number }) => sum + (d.avg_session || 0), 0) / lastWeek.length;
        const sessionChange = calculatePercentChange(lastWeekSessions, thisWeekSessions);
        updateChangeElement('session-change', sessionChange);
      }
    } else {
      // No comparison data available
      setChangeText('visitors-change', 'No prior data');
      setChangeText('views-change', 'No prior data');
      setChangeText('session-change', 'No prior data');
    }

  } catch (error) {
    console.error('[AdminAnalytics] Error loading analytics summary:', error);
    showOverviewDefaults();
  }
}

function showOverviewDefaults(): void {
  updateElement('total-visitors', '0');
  updateElement('page-views', '0');
  updateElement('avg-session', '0s');
  updateElement('stat-visitors', '0');
  setChangeText('visitors-change', 'No data');
  setChangeText('views-change', 'No data');
  setChangeText('session-change', 'No data');
}

function setChangeText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
    el.className = 'metric-change neutral';
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function calculatePercentChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return Math.round(((newVal - oldVal) / oldVal) * 100);
}

function updateChangeElement(id: string, change: number): void {
  const el = document.getElementById(id);
  if (!el) return;

  const prefix = change >= 0 ? '+' : '';
  el.textContent = `${prefix}${change}%`;
  el.className = `metric-change ${change >= 0 ? 'positive' : 'negative'}`;
}

export async function loadPerformanceData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const perfData = await getPerformanceMetrics();

    // Core Web Vitals
    updateVital('lcp', perfData.lcp);
    updateVital('fid', perfData.fid);
    updateVital('cls', perfData.cls);

    // Performance score
    if (perfData.score !== undefined) {
      updateElement('performance-score', `${Math.round(perfData.score)}/100`);
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error loading performance data:', error);
  }

  // Load bundle stats from API
  try {
    const response = await apiFetch('/api/admin/bundle-stats');

    if (response.ok) {
      const bundleData = await response.json();
      updateElement('total-bundle-size', bundleData.totalFormatted);
      updateElement('js-bundle-size', bundleData.jsFormatted);
      updateElement('css-bundle-size', bundleData.cssFormatted);
    }
    // 401 handled by apiFetch
  } catch (error) {
    console.error('[AdminAnalytics] Error loading bundle stats:', error);
  }
}

export async function loadAnalyticsData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiFetch('/api/analytics/summary?days=30');

    if (!response.ok) {
      if (response.status !== 401) {
        console.warn('[AdminAnalytics] Failed to load analytics data');
        showEmptyStates();
      }
      return;
    }

    const data = await response.json();

    // Popular Pages
    if (data.topPages && data.topPages.length > 0) {
      populateDataList(
        'popular-pages',
        data.topPages.map((p: { url: string; views: number }) => ({
          label: formatPageUrl(p.url),
          value: `${p.views.toLocaleString()} views`
        }))
      );
    } else {
      populateDataList('popular-pages', [{ label: 'No data yet', value: '-' }]);
    }

    // Device Breakdown
    if (data.devices && data.devices.length > 0) {
      const total = data.devices.reduce((sum: number, d: { count: number }) => sum + d.count, 0);
      populateDataList(
        'device-breakdown',
        data.devices.map((d: { device_type: string; count: number }) => ({
          label: capitalizeFirst(d.device_type || 'Unknown'),
          value: `${Math.round((d.count / total) * 100)}%`
        }))
      );
    } else {
      populateDataList('device-breakdown', [{ label: 'No data yet', value: '-' }]);
    }

    // Geographic Distribution (from browsers/referrers as proxy - real geo needs IP lookup)
    if (data.browsers && data.browsers.length > 0) {
      const total = data.browsers.reduce((sum: number, b: { count: number }) => sum + b.count, 0);
      populateDataList(
        'geo-distribution',
        data.browsers.slice(0, 4).map((b: { browser: string; count: number }) => ({
          label: b.browser || 'Unknown',
          value: `${Math.round((b.count / total) * 100)}%`
        }))
      );
    } else {
      populateDataList('geo-distribution', [{ label: 'No data yet', value: '-' }]);
    }

    // Engagement Events
    if (data.topInteractions && data.topInteractions.length > 0) {
      populateDataList(
        'engagement-events',
        data.topInteractions.slice(0, 5).map((i: { event_type: string; element?: string; count: number }) => ({
          label: formatInteractionType(i.event_type, i.element),
          value: i.count.toLocaleString()
        }))
      );
    } else {
      // Show summary stats as engagement if no interactions
      const summary = data.summary || {};
      populateDataList('engagement-events', [
        { label: 'Total Sessions', value: (summary.total_sessions || 0).toLocaleString() },
        { label: 'Bounce Rate', value: `${summary.bounce_rate || 0}%` },
        { label: 'Pages per Session', value: (summary.avg_pages_per_session || 0).toFixed(1) }
      ]);
    }

  } catch (error) {
    console.error('[AdminAnalytics] Error loading analytics data:', error);
    showEmptyStates();
  }
}

function showEmptyStates(): void {
  const emptyData = [{ label: 'No data available', value: '-' }];
  populateDataList('popular-pages', emptyData);
  populateDataList('device-breakdown', emptyData);
  populateDataList('geo-distribution', emptyData);
  populateDataList('engagement-events', emptyData);
}

function formatPageUrl(url: string): string {
  if (!url || url === '/') return 'Homepage';
  // Remove leading slash and clean up
  return url.replace(/^\//, '').replace(/-/g, ' ').replace(/\//g, ' / ') || 'Homepage';
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatInteractionType(type: string, element?: string): string {
  const formatted = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (element && element.length < 20) {
    return `${formatted} (${element})`;
  }
  return formatted;
}

export async function loadVisitorsData(_ctx: AdminDashboardContext): Promise<void> {
  const container = document.getElementById('visitors-table-body');
  if (!container) return;

  try {
    const response = await apiFetch('/api/analytics/sessions?days=7&limit=50');

    if (!response.ok) {
      if (response.status !== 401) {
        container.innerHTML =
          '<tr><td colspan="6" class="loading-row">Failed to load visitor data</td></tr>';
      }
      return;
    }

    const data = await response.json();
    const sessions = data.sessions || [];

    if (sessions.length === 0) {
      container.innerHTML =
        '<tr><td colspan="6" class="loading-row">No visitor sessions recorded</td></tr>';
      return;
    }

    container.innerHTML = sessions
      .map((session: {
        session_id: string;
        start_time: string;
        total_time_on_site: number;
        page_views: number;
        device_type: string;
        city?: string;
        country?: string;
        browser?: string;
      }) => {
        const startTime = new Date(session.start_time).toLocaleString();
        const duration = formatDuration(session.total_time_on_site || 0);
        const location = session.city && session.country
          ? `${session.city}, ${session.country}`
          : session.country || '-';

        return `
          <tr>
            <td>${session.session_id.substring(0, 8)}...</td>
            <td>${startTime}</td>
            <td>${duration}</td>
            <td>${session.page_views || 0}</td>
            <td>${capitalizeFirst(session.device_type || 'desktop')}</td>
            <td>${location}</td>
          </tr>
        `;
      })
      .join('');

  } catch (error) {
    console.error('[AdminAnalytics] Error loading visitors data:', error);
    container.innerHTML =
      '<tr><td colspan="6" class="loading-row">Error loading visitor data</td></tr>';
  }
}

async function getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
  // Try to get data from PerformanceService first
  try {
    const { container } = await import('../../../core/container');
    const performanceService = (await container.resolve('PerformanceService')) as {
      generateReport?: () => {
        metrics: { lcp?: number; fid?: number; cls?: number; ttfb?: number; bundleSize?: number };
        score?: number;
      };
    };

    if (performanceService?.generateReport) {
      const report = performanceService.generateReport();
      return {
        lcp: {
          value: report.metrics.lcp ? `${Math.round(report.metrics.lcp)}ms` : 'N/A',
          status: getVitalStatus('lcp', report.metrics.lcp)
        },
        fid: {
          value: report.metrics.fid ? `${Math.round(report.metrics.fid)}ms` : 'N/A',
          status: getVitalStatus('fid', report.metrics.fid)
        },
        cls: {
          value: report.metrics.cls ? report.metrics.cls.toFixed(3) : 'N/A',
          status: getVitalStatus('cls', report.metrics.cls)
        },
        ttfb: {
          value: report.metrics.ttfb ? `${Math.round(report.metrics.ttfb)}ms` : 'N/A',
          status: getVitalStatus('ttfb', report.metrics.ttfb)
        },
        bundleSize: {
          total: report.metrics.bundleSize
            ? `${Math.round(report.metrics.bundleSize / 1024)} KB`
            : 'N/A',
          main: 'N/A',
          vendor: 'N/A'
        },
        score: report.score || 0,
        grade: getGradeFromScore(report.score || 0)
      };
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Could not get performance service data:', error);
  }

  // Try browser Performance API as fallback
  try {
    type NavTiming = { responseStart?: number; requestStart?: number };
    type ResourceTiming = { name: string; transferSize?: number };
    type LCPEntry = { startTime: number };

    const navEntries = performance.getEntriesByType('navigation');
    const navigation = navEntries[0] as NavTiming | undefined;
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');

    const ttfb = navigation?.responseStart && navigation?.requestStart
      ? Math.round(navigation.responseStart - navigation.requestStart)
      : undefined;
    const lcp = lcpEntries.length > 0
      ? Math.round((lcpEntries[lcpEntries.length - 1] as LCPEntry).startTime)
      : undefined;

    // Get resource sizes for bundle estimation
    const resources = performance.getEntriesByType('resource') as ResourceTiming[];
    const jsResources = resources.filter(r => r.name.endsWith('.js'));
    const cssResources = resources.filter(r => r.name.endsWith('.css'));

    const jsSize = jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const cssSize = cssResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const totalSize = jsSize + cssSize;

    return {
      lcp: {
        value: lcp ? `${lcp}ms` : 'N/A',
        status: getVitalStatus('lcp', lcp)
      },
      fid: {
        value: 'N/A', // FID requires user interaction
        status: 'unknown'
      },
      cls: {
        value: 'N/A', // CLS requires PerformanceObserver
        status: 'unknown'
      },
      ttfb: {
        value: ttfb ? `${ttfb}ms` : 'N/A',
        status: getVitalStatus('ttfb', ttfb)
      },
      bundleSize: {
        total: totalSize > 0 ? `${Math.round(totalSize / 1024)} KB` : 'N/A',
        main: jsSize > 0 ? `${Math.round(jsSize / 1024)} KB` : 'N/A',
        vendor: cssSize > 0 ? `${Math.round(cssSize / 1024)} KB` : 'N/A'
      },
      score: lcp && ttfb ? calculatePerformanceScore(lcp, ttfb) : 0,
      grade: lcp && ttfb ? getGradeFromScore(calculatePerformanceScore(lcp, ttfb)) : 'N/A'
    };
  } catch (error) {
    console.warn('[AdminAnalytics] Could not get browser performance data:', error);
  }

  // No data available
  return {
    lcp: { value: 'N/A', status: 'unknown' },
    fid: { value: 'N/A', status: 'unknown' },
    cls: { value: 'N/A', status: 'unknown' },
    ttfb: { value: 'N/A', status: 'unknown' },
    bundleSize: { total: 'N/A', main: 'N/A', vendor: 'N/A' },
    score: 0,
    grade: 'N/A'
  };
}

function calculatePerformanceScore(lcp: number, ttfb: number): number {
  // Simple scoring based on Core Web Vitals thresholds
  let score = 100;

  // LCP scoring (good < 2500ms, needs improvement < 4000ms)
  if (lcp > 4000) score -= 30;
  else if (lcp > 2500) score -= 15;

  // TTFB scoring (good < 800ms, needs improvement < 1800ms)
  if (ttfb > 1800) score -= 20;
  else if (ttfb > 800) score -= 10;

  return Math.max(0, score);
}

async function getAnalyticsData(): Promise<AnalyticsData> {
  try {
    const { container } = await import('../../../core/container');
    const visitorService = (await container.resolve('VisitorTrackingService')) as {
      exportData?: () => Promise<RawVisitorData>;
    };

    if (visitorService?.exportData) {
      const data = await visitorService.exportData();
      return formatAnalyticsData(data);
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Could not get live analytics data:', error);
  }

  return {};
}

function formatAnalyticsData(rawData: RawVisitorData): AnalyticsData {
  const pageViews = rawData.pageViews || [];
  const sessions = rawData.sessions || [];
  const interactions = rawData.interactions || [];

  // Calculate popular pages
  const popularPages = calculatePopularPages(pageViews);

  // Calculate device breakdown from user agents
  const deviceBreakdown = calculateDeviceBreakdown(sessions);

  // Calculate geographic distribution from timezones
  const geoDistribution = calculateGeoDistribution(sessions);

  // Calculate engagement events
  const engagementEvents = calculateEngagementEvents(sessions, interactions);

  return {
    popularPages: popularPages.length > 0 ? popularPages : undefined,
    deviceBreakdown: deviceBreakdown.length > 0 ? deviceBreakdown : undefined,
    geoDistribution: geoDistribution.length > 0 ? geoDistribution : undefined,
    engagementEvents: engagementEvents.length > 0 ? engagementEvents : undefined
  };
}

function calculatePopularPages(pageViews: { url: string; timestamp: number }[]): AnalyticsDataItem[] {
  const pageCounts = new Map<string, number>();
  pageViews.forEach((pv) => {
    const url = pv.url || '/';
    pageCounts.set(url, (pageCounts.get(url) || 0) + 1);
  });

  return Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({
      label: formatPageLabel(url),
      value: `${count.toLocaleString()} views`
    }));
}

function formatPageLabel(url: string): string {
  if (url === '/' || url === '') return 'Homepage';
  // Remove leading slash and format
  const path = url.replace(/^\//, '').replace(/-/g, ' ');
  // Capitalize first letter of each word
  return path
    .split('/')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');
}

function calculateDeviceBreakdown(sessions: { userAgent?: string; screenResolution?: string }[]): AnalyticsDataItem[] {
  if (sessions.length === 0) return [];

  const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };

  sessions.forEach((session) => {
    const device = detectDeviceType(session.userAgent, session.screenResolution);
    deviceCounts[device]++;
  });

  const total = sessions.length;
  const breakdown: AnalyticsDataItem[] = [];

  if (deviceCounts.desktop > 0) {
    breakdown.push({
      label: 'Desktop',
      value: `${Math.round((deviceCounts.desktop / total) * 100)}%`
    });
  }
  if (deviceCounts.mobile > 0) {
    breakdown.push({
      label: 'Mobile',
      value: `${Math.round((deviceCounts.mobile / total) * 100)}%`
    });
  }
  if (deviceCounts.tablet > 0) {
    breakdown.push({
      label: 'Tablet',
      value: `${Math.round((deviceCounts.tablet / total) * 100)}%`
    });
  }

  return breakdown.sort((a, b) => {
    const aVal = parseInt(String(a.value).replace('%', ''), 10);
    const bVal = parseInt(String(b.value).replace('%', ''), 10);
    return bVal - aVal;
  });
}

function detectDeviceType(
  userAgent?: string,
  screenResolution?: string
): 'desktop' | 'mobile' | 'tablet' {
  if (!userAgent) {
    // Fallback to screen resolution if no user agent
    if (screenResolution) {
      const width = parseInt(screenResolution.split('x')[0], 10);
      if (width <= 480) return 'mobile';
      if (width <= 1024) return 'tablet';
    }
    return 'desktop';
  }

  const ua = userAgent.toLowerCase();

  // Check for tablets first (they often contain 'mobile' in UA too)
  if (/ipad|tablet|playbook|silk/i.test(ua) ||
      (/android/i.test(ua) && !/mobile/i.test(ua))) {
    return 'tablet';
  }

  // Check for mobile devices
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function calculateGeoDistribution(sessions: { timezone?: string; language?: string }[]): AnalyticsDataItem[] {
  if (sessions.length === 0) return [];

  const regionCounts = new Map<string, number>();

  sessions.forEach((session) => {
    const region = inferRegionFromTimezone(session.timezone) ||
                   inferRegionFromLanguage(session.language) ||
                   'Unknown';
    regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
  });

  const total = sessions.length;

  return Array.from(regionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([region, count]) => ({
      label: region,
      value: `${Math.round((count / total) * 100)}%`
    }));
}

function inferRegionFromTimezone(timezone?: string): string | null {
  if (!timezone) return null;

  const tz = timezone.toLowerCase();

  // Americas
  if (tz.includes('america/new_york') || tz.includes('america/chicago') ||
      tz.includes('america/denver') || tz.includes('america/los_angeles') ||
      tz.includes('america/phoenix') || tz.includes('est') || tz.includes('pst') ||
      tz.includes('cst') || tz.includes('mst')) {
    return 'United States';
  }
  if (tz.includes('america/toronto') || tz.includes('america/vancouver') ||
      tz.includes('america/montreal')) {
    return 'Canada';
  }
  if (tz.includes('america/mexico')) {
    return 'Mexico';
  }
  if (tz.includes('america/sao_paulo') || tz.includes('america/buenos_aires')) {
    return 'South America';
  }

  // Europe
  if (tz.includes('europe/london') || tz.includes('gmt') || tz.includes('bst')) {
    return 'United Kingdom';
  }
  if (tz.includes('europe/')) {
    return 'Europe';
  }

  // Asia Pacific
  if (tz.includes('asia/tokyo') || tz.includes('asia/seoul')) {
    return 'Asia Pacific';
  }
  if (tz.includes('australia/')) {
    return 'Australia';
  }
  if (tz.includes('asia/')) {
    return 'Asia';
  }

  return null;
}

function inferRegionFromLanguage(language?: string): string | null {
  if (!language) return null;

  const lang = language.toLowerCase().split('-')[0];

  switch (lang) {
  case 'en':
    return 'English Speaking';
  case 'es':
    return 'Spanish Speaking';
  case 'fr':
    return 'French Speaking';
  case 'de':
    return 'German Speaking';
  case 'pt':
    return 'Portuguese Speaking';
  case 'zh':
    return 'China';
  case 'ja':
    return 'Japan';
  case 'ko':
    return 'South Korea';
  default:
    return null;
  }
}

function calculateEngagementEvents(
  sessions: { bounced?: boolean; totalTimeOnSite?: number; pageViews?: number }[],
  interactions: { type: string; timestamp: number }[]
): AnalyticsDataItem[] {
  const events: AnalyticsDataItem[] = [];

  if (sessions.length === 0 && interactions.length === 0) {
    return events;
  }

  // Total sessions
  if (sessions.length > 0) {
    events.push({
      label: 'Total Sessions',
      value: sessions.length.toLocaleString()
    });

    // Bounce rate
    const bouncedSessions = sessions.filter(s => s.bounced === true).length;
    if (bouncedSessions > 0 || sessions.some(s => s.bounced !== undefined)) {
      const bounceRate = Math.round((bouncedSessions / sessions.length) * 100);
      events.push({
        label: 'Bounce Rate',
        value: `${bounceRate}%`
      });
    }

    // Average session duration
    const sessionsWithDuration = sessions.filter(s => typeof s.totalTimeOnSite === 'number');
    if (sessionsWithDuration.length > 0) {
      const totalTime = sessionsWithDuration.reduce((sum, s) => sum + (s.totalTimeOnSite || 0), 0);
      const avgDuration = totalTime / sessionsWithDuration.length;
      events.push({
        label: 'Avg. Session Duration',
        value: formatDuration(avgDuration)
      });
    }

    // Average pages per session
    const sessionsWithPageViews = sessions.filter(s => typeof s.pageViews === 'number');
    if (sessionsWithPageViews.length > 0) {
      const totalPages = sessionsWithPageViews.reduce((sum, s) => sum + (s.pageViews || 0), 0);
      const avgPages = totalPages / sessionsWithPageViews.length;
      events.push({
        label: 'Pages per Session',
        value: avgPages.toFixed(1)
      });
    }
  }

  // Group interactions by type
  if (interactions.length > 0) {
    const interactionCounts = new Map<string, number>();
    interactions.forEach((interaction) => {
      const type = interaction.type || 'unknown';
      interactionCounts.set(type, (interactionCounts.get(type) || 0) + 1);
    });

    // Add top interaction types (limited to keep list manageable)
    const topInteractions = Array.from(interactionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topInteractions.forEach(([type, count]) => {
      events.push({
        label: formatInteractionLabel(type),
        value: count.toLocaleString()
      });
    });
  }

  return events;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

function formatInteractionLabel(type: string): string {
  // Convert snake_case or kebab-case to Title Case
  return type
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getVitalStatus(metric: string, value?: number): string {
  if (!value) return 'unknown';

  switch (metric) {
  case 'lcp':
    return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
  case 'fid':
    return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
  case 'cls':
    return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
  default:
    return 'unknown';
  }
}

function getGradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function updateVital(
  metric: string,
  data: { value: string; status: string }
): void {
  const valueEl = document.getElementById(`${metric}-value`);
  const statusEl = document.getElementById(`${metric}-status`);

  if (valueEl) valueEl.textContent = data.value;
  if (statusEl) {
    statusEl.textContent = data.status;
    statusEl.className = `vital-status status-${data.status}`;
  }
}

function updateElement(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function populateDataList(containerId: string, items: AnalyticsDataItem[]): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items
    .map(
      (item) => `
      <div class="data-item">
        <span class="data-label">${item.label}</span>
        <span class="data-value">${item.value}</span>
      </div>
    `
    )
    .join('');
}

async function loadVisitorsChart(): Promise<void> {
  const canvas = document.getElementById('visitors-chart') as HTMLCanvasElement;
  if (!canvas) return;

  // Destroy existing chart
  if (charts.has('visitors')) {
    charts.get('visitors')?.destroy();
  }

  // Try to fetch real data from API
  let labels: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let data: number[] = [0, 0, 0, 0, 0, 0, 0];

  try {
    const response = await apiFetch('/api/analytics/summary?days=7');

    if (response.ok) {
      const result = await response.json();
      if (result.daily && result.daily.length > 0) {
        // Reverse to get chronological order and take last 7 days
        const dailyData = result.daily.slice(0, 7).reverse();
        labels = dailyData.map((d: { date: string }) => {
          const date = new Date(d.date);
          return date.toLocaleDateString('en-US', { weekday: 'short' });
        });
        data = dailyData.map((d: { visitors?: number }) => d.visitors || 0);
      }
    }
    // 401 handled by apiFetch
  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load chart data:', error);
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Visitors',
          data,
          borderColor: '#00aff0',
          backgroundColor: 'rgba(0, 175, 240, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#f5f5f5' },
          grid: { color: '#555555' }
        },
        x: {
          ticks: { color: '#f5f5f5' },
          grid: { color: '#555555' }
        }
      }
    }
  });

  charts.set('visitors', chart);
}

async function loadSourcesChart(): Promise<void> {
  const canvas = document.getElementById('sources-chart') as HTMLCanvasElement;
  if (!canvas) return;

  if (charts.has('sources')) {
    charts.get('sources')?.destroy();
  }

  // Try to fetch real data from API
  let labels: string[] = ['Direct', 'Search', 'Social', 'Referral'];
  let data: number[] = [0, 0, 0, 0];

  try {
    const response = await apiFetch('/api/analytics/summary?days=30');

    if (response.ok) {
      const result = await response.json();
      if (result.topReferrers && result.topReferrers.length > 0) {
        // Map referrers to categories
        const sources: Record<string, number> = {
          'Direct': 0,
          'Search': 0,
          'Social': 0,
          'Referral': 0
        };

        result.topReferrers.forEach((r: { source: string; count: number }) => {
          const source = r.source.toLowerCase();
          if (source === 'direct' || source === '') {
            sources['Direct'] += r.count;
          } else if (source.includes('google') || source.includes('bing') || source.includes('yahoo') || source.includes('duckduckgo')) {
            sources['Search'] += r.count;
          } else if (source.includes('facebook') || source.includes('twitter') || source.includes('linkedin') || source.includes('instagram') || source.includes('tiktok')) {
            sources['Social'] += r.count;
          } else {
            sources['Referral'] += r.count;
          }
        });

        labels = Object.keys(sources);
        data = Object.values(sources);
      }
    }
    // 401 handled by apiFetch
  } catch (error) {
    console.warn('[AdminAnalytics] Failed to load sources chart data:', error);
  }

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: ['#00aff0', '#00d4aa', '#ffc107', '#ff6b6b']
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#f5f5f5' }
        }
      }
    }
  });

  charts.set('sources', chart);
}

export function destroyCharts(): void {
  charts.forEach((chart) => chart.destroy());
  charts.clear();
}

// Data export functions
export async function exportAnalyticsData(): Promise<Record<string, unknown>> {
  const data = await getAnalyticsData();
  return {
    exportedAt: new Date().toISOString(),
    analytics: data
  };
}

export async function exportPerformanceData(): Promise<Record<string, unknown>> {
  const data = await getPerformanceMetrics();
  return {
    exportedAt: new Date().toISOString(),
    performance: data
  };
}
