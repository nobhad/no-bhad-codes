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

  // Calculate popular pages
  const pageCounts = new Map<string, number>();
  pageViews.forEach((pv) => {
    const url = pv.url || '/';
    pageCounts.set(url, (pageCounts.get(url) || 0) + 1);
  });

  const popularPages: AnalyticsDataItem[] = Array.from(pageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({
      label: url === '/' ? 'Homepage' : url,
      value: `${count} views`
    }));

  return {
    popularPages: popularPages.length > 0 ? popularPages : undefined,
    deviceBreakdown: undefined,
    geoDistribution: undefined,
    engagementEvents: undefined
  };
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
        y: { beginAtZero: true }
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
        legend: { position: 'bottom' }
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
