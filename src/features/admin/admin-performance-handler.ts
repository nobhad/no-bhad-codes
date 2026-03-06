/**
 * ===============================================
 * ADMIN PERFORMANCE HANDLER
 * ===============================================
 * @file src/features/admin/admin-performance-handler.ts
 *
 * Handles performance metrics retrieval, chart creation,
 * vital status assessment, and performance dashboard initialization.
 */

import type { PerformanceAlert } from '../../services/performance-service';
import { SanitizationUtils } from '../../utils/sanitization-utils';
import { getChartColor, getChartColorWithAlpha } from '../../config/constants';
import { createLogger } from '../../utils/logger';
import { mountReactModule } from './ReactModuleLoader';
import type { AdminDashboardContext } from './admin-types';
import type { createDOMCache } from '../../utils/dom-cache';

const logger = createLogger('AdminPerformance');

type DOMCacheInstance = ReturnType<typeof createDOMCache>;

// Chart.js is loaded dynamically to reduce initial bundle size
let Chart: typeof import('chart.js').Chart | null = null;

async function loadChartJS(): Promise<typeof import('chart.js').Chart> {
  if (!Chart) {
    const chartModule = await import('chart.js');
    chartModule.Chart.register(...chartModule.registerables);
    Chart = chartModule.Chart;
  }
  return Chart;
}

// Type definitions
interface PerformanceReport {
  score: number;
  metrics: {
    lcp?: number;
    fid?: number;
    cls?: number;
    ttfb?: number;
    bundleSize?: number;
  };
  alerts: PerformanceAlert[];
  recommendations: string[];
}

interface PerformanceMetricDisplay {
  value: string;
  status: string;
}

export interface PerformanceMetricsDisplay {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts?: string[];
}

/**
 * Get the status rating for a web vital metric.
 */
export function getVitalStatus(metric: string, value?: number): string {
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

/**
 * Get a letter grade from a numeric score.
 */
export function getGradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get performance metrics from available sources.
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
  try {
    if (window.opener?.NBW_DEBUG) {
      const debug = window.opener.NBW_DEBUG;
      if (debug.getPerformanceReport) {
        return (await debug.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
      }
    }

    if (window.NBW_DEBUG?.getPerformanceReport) {
      return (await window.NBW_DEBUG.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
    }

    const { container } = await import('../../core/container');
    const performanceService = (await container.resolve('PerformanceService')) as {
      generateReport?: () => PerformanceReport;
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
        grade: getGradeFromScore(report.score || 0),
        alerts: (report.alerts || []).map((alert) => alert.message)
      };
    }
  } catch (error) {
    logger.warn(' Could not get live performance data:', error);
  }

  return {
    lcp: { value: 'N/A', status: 'unknown' },
    fid: { value: 'N/A', status: 'unknown' },
    cls: { value: 'N/A', status: 'unknown' },
    ttfb: { value: 'N/A', status: 'unknown' },
    bundleSize: { total: 'N/A', main: 'N/A', vendor: 'N/A' },
    score: 0,
    grade: 'N/A',
    alerts: ['Unable to load performance data']
  };
}

/**
 * Update a web vital display element.
 */
export function updateVital(type: string, data: { value: string; status: string }): void {
  const valueElement = document.getElementById(`${type}-value`);
  const statusElement = document.getElementById(`${type}-status`);

  if (valueElement) valueElement.textContent = data.value;
  if (statusElement) {
    statusElement.textContent = data.status.replace('-', ' ');
    statusElement.className = `vital-status ${data.status}`;
  }
}

/**
 * Update a generic element by ID.
 */
export function updateElement(id: string, text: string, className?: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
    if (className) {
      element.className = `metric-change ${className}`;
    }
  }
}

/**
 * Create or update a Chart.js chart (loads Chart.js dynamically).
 */
export async function loadChart(
  containerId: string,
  chartType: 'visitors' | 'sources',
  charts: Map<string, { destroy: () => void }>
): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) return;

  const ChartJS = await loadChartJS();

  const existingChart = charts.get(containerId);
  if (existingChart) {
    existingChart.destroy();
  }

  container.innerHTML = '<canvas></canvas>';
  const canvas = container.querySelector('canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let chart: InstanceType<typeof ChartJS>;

  if (chartType === 'visitors') {
    chart = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Visitors',
            data: [120, 190, 150, 220, 180, 250, 210],
            borderColor: getChartColor('PRIMARY'),
            backgroundColor: getChartColorWithAlpha('PRIMARY', 0.1),
            tension: 0.4,
            fill: true
          },
          {
            label: 'Page Views',
            data: [300, 450, 380, 520, 420, 600, 480],
            borderColor: getChartColor('DARK'),
            backgroundColor: getChartColorWithAlpha('DARK', 0.1),
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { usePointStyle: true, padding: 20 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: getChartColorWithAlpha('DARK', 0.1) }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  } else {
    chart = new ChartJS(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
        datasets: [
          {
            data: [35, 30, 20, 10, 5],
            backgroundColor: [
              getChartColor('PRIMARY'),
              getChartColor('DARK'),
              getChartColor('GRAY_600'),
              getChartColor('GRAY_400'),
              getChartColor('GRAY_300')
            ],
            borderColor: getChartColor('WHITE'),
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { usePointStyle: true, padding: 15 }
          }
        }
      }
    });
  }

  charts.set(containerId, chart);
}

/**
 * Populate a data list element.
 */
export function populateDataList(
  listId: string,
  data: Array<{ label: string; value: string | number }>
): void {
  const list = document.getElementById(listId);
  if (!list) return;

  list.innerHTML = data
    .map(
      (item) => `
      <div class="data-item">
        <span>${SanitizationUtils.escapeHtml(item.label)}</span>
        <span>${SanitizationUtils.escapeHtml(String(item.value))}</span>
      </div>
    `
    )
    .join('');
}

/**
 * Initialize the performance dashboard container.
 */
export async function initializePerformanceDashboard(
  domCache: DOMCacheInstance
): Promise<void> {
  try {
    let dashboardContainer = domCache.get('performanceDashboardContainer');

    if (!dashboardContainer) {
      const performanceTab = domCache.get('performanceTab');
      if (performanceTab) {
        dashboardContainer = document.createElement('div');
        dashboardContainer.id = 'performance-dashboard-container';
        dashboardContainer.className = 'admin-performance-dashboard';
        performanceTab.appendChild(dashboardContainer);
      }
    }

    if (dashboardContainer) {
      dashboardContainer.innerHTML =
        '<div class="empty-state">Performance dashboard coming soon</div>';
    }
  } catch (error) {
    logger.warn(' Failed to initialize performance dashboard component:', error);
  }
}

/**
 * Display performance alerts in the alerts container.
 */
export function displayPerformanceAlerts(
  alerts: PerformanceAlert[],
  domCache: DOMCacheInstance
): void {
  const container = domCache.get('performanceAlerts');
  if (!container || !alerts.length) return;

  container.innerHTML = alerts
    .slice(0, 5)
    .map(
      (alert) => `
      <div class="performance-alert alert-${alert.type}">
        <div class="alert-header">
          <span class="alert-metric">${alert.metric.toUpperCase()}</span>
          <span class="alert-value">${Math.round(alert.value)}</span>
        </div>
        <div class="alert-message">${SanitizationUtils.escapeHtml(alert.message)}</div>
        ${
  alert.suggestions && alert.suggestions.length > 0
    ? `
          <div class="alert-suggestions">
            <ul>
              ${alert.suggestions
    .slice(0, 2)
    .map((suggestion: string) => `<li>${SanitizationUtils.escapeHtml(suggestion)}</li>`)
    .join('')}
            </ul>
          </div>
        `
    : ''
}
      </div>
    `
    )
    .join('');
}

/**
 * Load performance data and mount the React component.
 */
export async function loadPerformanceData(
  domCache: DOMCacheInstance,
  moduleContext: AdminDashboardContext
): Promise<void> {
  try {
    await initializePerformanceDashboard(domCache);

    const tabContainer = document.getElementById('tab-performance');
    if (tabContainer) {
      await mountReactModule('performance', tabContainer, moduleContext);
    }
  } catch (error) {
    logger.error('Error loading performance data:', error);
  }
}

/**
 * Load analytics data via React module.
 */
export async function loadAnalyticsData(
  moduleContext: AdminDashboardContext
): Promise<void> {
  const tabContainer = document.getElementById('tab-analytics');
  if (tabContainer) {
    await mountReactModule('analytics', tabContainer, moduleContext);
  }
}

/**
 * Load system data via React module.
 */
export async function loadSystemData(
  moduleContext: AdminDashboardContext
): Promise<void> {
  const tabContainer = document.getElementById('tab-system');
  if (tabContainer) {
    await mountReactModule('system', tabContainer, moduleContext);
  }
}
