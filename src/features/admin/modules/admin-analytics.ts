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
  await Promise.all([loadVisitorsChart(), loadSourcesChart()]);
}

export async function loadPerformanceData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const perfData = await getPerformanceMetrics();

    // Core Web Vitals
    updateVital('lcp', perfData.lcp);
    updateVital('fid', perfData.fid);
    updateVital('cls', perfData.cls);

    // Bundle analysis
    if (perfData.bundleSize) {
      updateElement('total-bundle-size', perfData.bundleSize.total);
      updateElement('js-bundle-size', perfData.bundleSize.main);
      updateElement('css-bundle-size', perfData.bundleSize.vendor);
    }

    // Performance score
    if (perfData.score !== undefined) {
      updateElement('performance-score', `${Math.round(perfData.score)}/100`);
    }
  } catch (error) {
    console.error('[AdminAnalytics] Error loading performance data:', error);
  }
}

export async function loadAnalyticsData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const analyticsData = await getAnalyticsData();

    populateDataList(
      'popular-pages',
      analyticsData.popularPages || [
        { label: 'Homepage', value: '2,145 views' },
        { label: 'Art Portfolio', value: '856 views' },
        { label: 'Codes Section', value: '634 views' },
        { label: 'Contact', value: '423 views' }
      ]
    );

    populateDataList(
      'device-breakdown',
      analyticsData.deviceBreakdown || [
        { label: 'Desktop', value: '45%' },
        { label: 'Mobile', value: '38%' },
        { label: 'Tablet', value: '17%' }
      ]
    );

    populateDataList(
      'geo-distribution',
      analyticsData.geoDistribution || [
        { label: 'United States', value: '42%' },
        { label: 'Canada', value: '18%' },
        { label: 'United Kingdom', value: '12%' },
        { label: 'Other', value: '28%' }
      ]
    );

    populateDataList(
      'engagement-events',
      analyticsData.engagementEvents || [
        { label: 'Business Card Flips', value: '456' },
        { label: 'Contact Form Submissions', value: '23' },
        { label: 'External Link Clicks', value: '187' }
      ]
    );
  } catch (error) {
    console.error('[AdminAnalytics] Error loading analytics data:', error);
  }
}

export async function loadVisitorsData(_ctx: AdminDashboardContext): Promise<void> {
  const container = document.getElementById('visitors-table-body');
  if (!container) return;

  // Load visitor data from service if available
  try {
    const { container: serviceContainer } = await import('../../../core/container');
    const visitorService = (await serviceContainer.resolve('VisitorTrackingService')) as {
      exportData?: () => Promise<RawVisitorData>;
    };

    if (visitorService?.exportData) {
      const data = await visitorService.exportData();
      renderVisitorsTable(data, container);
      return;
    }
  } catch (error) {
    console.warn('[AdminAnalytics] Could not load visitor service:', error);
  }

  // Fallback message
  container.innerHTML =
    '<tr><td colspan="6" class="loading-row">Visitor tracking data not available</td></tr>';
}

function renderVisitorsTable(data: RawVisitorData, container: HTMLElement): void {
  const sessions = data.sessions || [];

  if (sessions.length === 0) {
    container.innerHTML =
      '<tr><td colspan="6" class="loading-row">No visitor sessions recorded</td></tr>';
    return;
  }

  container.innerHTML = sessions
    .slice(0, 50)
    .map((session) => {
      const startTime = new Date(session.startTime).toLocaleString();
      return `
        <tr>
          <td>${session.id.substring(0, 8)}...</td>
          <td>${startTime}</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
        </tr>
      `;
    })
    .join('');
}

async function getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
  try {
    // Try to get data from container
    const { container } = await import('../../../core/container');
    const performanceService = (await container.resolve('PerformanceService')) as {
      generateReport?: () => any;
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
    console.warn('[AdminAnalytics] Could not get live performance data:', error);
  }

  // Fallback mock data
  return {
    lcp: { value: '1.2s', status: 'good' },
    fid: { value: '45ms', status: 'good' },
    cls: { value: '0.05', status: 'good' },
    ttfb: { value: '120ms', status: 'good' },
    bundleSize: { total: '156 KB', main: '98 KB', vendor: '58 KB' },
    score: 95,
    grade: 'A'
  };
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

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Visitors',
          data: [120, 190, 150, 220, 180, 90, 110],
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
          ticks: { color: '#cccccc' },
          grid: { color: '#555555' }
        },
        x: {
          ticks: { color: '#cccccc' },
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

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Direct', 'Search', 'Social', 'Referral'],
      datasets: [
        {
          data: [45, 30, 15, 10],
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
          labels: { color: '#cccccc' }
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
