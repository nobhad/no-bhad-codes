/**
 * ===============================================
 * ADMIN PERFORMANCE MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-performance.ts
 *
 * Performance metrics functionality for admin dashboard.
 * Fetches real Core Web Vitals from Performance API.
 * Dynamically imported for code splitting.
 */

import type { AdminDashboardContext, PerformanceMetricsDisplay, PerformanceMetricDisplay } from '../admin-types';
import { renderEmptyState } from '../../../components/empty-state';

interface WebVitalsResult {
  lcp: number | null;
  fid: number | null;
  cls: number | null;
  ttfb: number | null;
  fcp: number | null;
}

/**
 * Load performance data for admin dashboard
 */
export async function loadPerformanceData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    const metrics = await getPerformanceMetrics();

    // Update Core Web Vitals
    updateVital('lcp', metrics.lcp);
    updateVital('fid', metrics.fid);
    updateVital('cls', metrics.cls);

    // Update bundle sizes if available
    if (metrics.bundleSize) {
      updateElement('total-bundle-size', metrics.bundleSize.total);
      updateElement('js-bundle-size', metrics.bundleSize.main);
      updateElement('css-bundle-size', metrics.bundleSize.vendor);
    }

    // Update performance score
    updateElement('performance-score', `${Math.round(metrics.score)}/100`);

    // Show alerts if any
    if (metrics.alerts && metrics.alerts.length > 0) {
      displayPerformanceAlerts(metrics.alerts);
    }

  } catch (error) {
    console.error('[AdminPerformance] Error loading performance data:', error);
    showNoDataMessage();
  }
}

/**
 * Get performance metrics from browser APIs
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
  // Try to get data from main window NBW_DEBUG first
  if (window.opener?.NBW_DEBUG?.getPerformanceReport) {
    try {
      const report = await window.opener.NBW_DEBUG.getPerformanceReport();
      if (report) {
        return formatPerformanceReport(report);
      }
    } catch (error) {
      console.warn('[AdminPerformance] Could not get data from opener:', error);
    }
  }

  // Try current window NBW_DEBUG
  if (window.NBW_DEBUG?.getPerformanceReport) {
    try {
      const report = await window.NBW_DEBUG.getPerformanceReport();
      if (report) {
        return formatPerformanceReport(report);
      }
    } catch (error) {
      console.warn('[AdminPerformance] Could not get data from window:', error);
    }
  }

  // Try to get data from Performance API directly
  const vitals = await measureWebVitals();

  return {
    lcp: formatVital('lcp', vitals.lcp),
    fid: formatVital('fid', vitals.fid),
    cls: formatVital('cls', vitals.cls),
    ttfb: formatVital('ttfb', vitals.ttfb),
    score: calculatePerformanceScore(vitals),
    grade: getGradeFromScore(calculatePerformanceScore(vitals)),
    bundleSize: await getBundleSizes(),
    alerts: generateAlerts(vitals)
  };
}

/**
 * Measure Core Web Vitals using browser Performance API
 */
async function measureWebVitals(): Promise<WebVitalsResult> {
  const result: WebVitalsResult = {
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    fcp: null
  };

  // Get navigation timing (using unknown to avoid ESLint globals issue)
  const navEntry = performance.getEntriesByType('navigation')[0] as unknown as {
    responseStart: number;
    requestStart: number;
    startTime: number;
  };
  if (navEntry) {
    result.ttfb = navEntry.responseStart - navEntry.requestStart;
  }

  // Get paint timing
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
  if (fcpEntry) {
    result.fcp = fcpEntry.startTime;
  }

  // Get LCP from PerformanceObserver (if available in stored data)
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  if (lcpEntries.length > 0) {
    const lastLcp = lcpEntries[lcpEntries.length - 1];
    result.lcp = lastLcp.startTime;
  }

  // Get CLS from stored layout shift data
  const layoutShiftEntries = performance.getEntriesByType('layout-shift');
  if (layoutShiftEntries.length > 0) {
    result.cls = layoutShiftEntries.reduce((sum, entry) => {
      const value = (entry as unknown as { value: number }).value || 0;
      return sum + value;
    }, 0);
  }

  // FID cannot be measured passively - would need user interaction
  // Leave as null to show "N/A"

  return result;
}

/**
 * Format a vital metric for display
 */
function formatVital(metric: string, value: number | null): PerformanceMetricDisplay {
  if (value === null) {
    return { value: 'N/A', status: 'unknown' };
  }

  const status = getVitalStatus(metric, value);

  switch (metric) {
  case 'lcp':
    return { value: `${(value / 1000).toFixed(2)}s`, status };
  case 'fid':
    return { value: `${Math.round(value)}ms`, status };
  case 'cls':
    return { value: value.toFixed(3), status };
  case 'ttfb':
    return { value: `${Math.round(value)}ms`, status };
  default:
    return { value: String(value), status };
  }
}

/**
 * Get status (good/needs-improvement/poor) for a vital metric
 */
function getVitalStatus(metric: string, value: number): string {
  switch (metric) {
  case 'lcp':
    return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
  case 'fid':
    return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
  case 'cls':
    return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
  case 'ttfb':
    return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
  default:
    return 'unknown';
  }
}

/**
 * Calculate overall performance score (0-100)
 */
function calculatePerformanceScore(vitals: WebVitalsResult): number {
  let score = 100;
  let measurements = 0;

  if (vitals.lcp !== null) {
    measurements++;
    if (vitals.lcp > 4000) score -= 30;
    else if (vitals.lcp > 2500) score -= 15;
  }

  if (vitals.fid !== null) {
    measurements++;
    if (vitals.fid > 300) score -= 30;
    else if (vitals.fid > 100) score -= 15;
  }

  if (vitals.cls !== null) {
    measurements++;
    if (vitals.cls > 0.25) score -= 30;
    else if (vitals.cls > 0.1) score -= 15;
  }

  if (vitals.ttfb !== null) {
    measurements++;
    if (vitals.ttfb > 1800) score -= 20;
    else if (vitals.ttfb > 800) score -= 10;
  }

  // If no measurements, return estimate
  if (measurements === 0) {
    return 80; // Default estimate
  }

  return Math.max(0, score);
}

/**
 * Get letter grade from score
 */
function getGradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get bundle sizes (estimate based on resources)
 */
async function getBundleSizes(): Promise<{ total: string; main: string; vendor: string } | undefined> {
  try {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const jsResources = resources.filter(r =>
      r.name.endsWith('.js') || r.initiatorType === 'script'
    );

    const cssResources = resources.filter(r =>
      r.name.endsWith('.css') || r.initiatorType === 'link'
    );

    const totalJsSize = jsResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
    const totalCssSize = cssResources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

    if (totalJsSize === 0 && totalCssSize === 0) {
      return undefined;
    }

    return {
      total: formatBytes(totalJsSize + totalCssSize),
      main: formatBytes(totalJsSize),
      vendor: formatBytes(totalCssSize)
    };
  } catch {
    return undefined;
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Generate alerts for poor metrics
 */
function generateAlerts(vitals: WebVitalsResult): string[] {
  const alerts: string[] = [];

  if (vitals.lcp !== null && vitals.lcp > 4000) {
    alerts.push('Largest Contentful Paint is poor (>4s). Consider optimizing images and critical rendering path.');
  } else if (vitals.lcp !== null && vitals.lcp > 2500) {
    alerts.push('Largest Contentful Paint needs improvement (>2.5s).');
  }

  if (vitals.fid !== null && vitals.fid > 300) {
    alerts.push('First Input Delay is poor (>300ms). Consider reducing JavaScript execution time.');
  }

  if (vitals.cls !== null && vitals.cls > 0.25) {
    alerts.push('Cumulative Layout Shift is poor (>0.25). Ensure elements have explicit dimensions.');
  }

  if (vitals.ttfb !== null && vitals.ttfb > 1800) {
    alerts.push('Time to First Byte is poor (>1.8s). Consider server-side optimizations.');
  }

  return alerts;
}

/**
 * Format performance report from NBW_DEBUG
 */
function formatPerformanceReport(report: unknown): PerformanceMetricsDisplay {
  const r = report as {
    metrics?: { lcp?: number; fid?: number; cls?: number; ttfb?: number; bundleSize?: number };
    score?: number;
    alerts?: Array<{ message: string }>;
  };

  return {
    lcp: formatVital('lcp', r.metrics?.lcp || null),
    fid: formatVital('fid', r.metrics?.fid || null),
    cls: formatVital('cls', r.metrics?.cls || null),
    ttfb: formatVital('ttfb', r.metrics?.ttfb || null),
    score: r.score || 80,
    grade: getGradeFromScore(r.score || 80),
    bundleSize: r.metrics?.bundleSize ? {
      total: formatBytes(r.metrics.bundleSize),
      main: 'N/A',
      vendor: 'N/A'
    } : undefined,
    alerts: r.alerts?.map(a => a.message) || []
  };
}

/**
 * Update DOM element
 */
function updateElement(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Update vital display
 */
function updateVital(type: string, data: PerformanceMetricDisplay): void {
  const valueElement = document.getElementById(`${type}-value`);
  const statusElement = document.getElementById(`${type}-status`);

  if (valueElement) valueElement.textContent = data.value;
  if (statusElement) {
    statusElement.textContent = data.status.replace('-', ' ');
    statusElement.className = `vital-status ${data.status}`;
  }
}

/**
 * Display performance alerts
 */
function displayPerformanceAlerts(alerts: string[]): void {
  const container = document.getElementById('performance-alerts');
  if (!container) return;

  if (alerts.length === 0) {
    renderEmptyState(container, 'No performance issues detected');
    return;
  }

  container.innerHTML = alerts.map(alert => `
    <div class="performance-alert warning">
      <span class="alert-icon">⚠</span>
      <span class="alert-message">${alert}</span>
    </div>
  `).join('');
}

/**
 * Show no data message
 */
function showNoDataMessage(): void {
  updateVital('lcp', { value: 'N/A', status: 'unknown' });
  updateVital('fid', { value: 'N/A', status: 'unknown' });
  updateVital('cls', { value: 'N/A', status: 'unknown' });
  updateElement('performance-score', 'N/A');
}

// NBW_DEBUG type is declared globally in app.ts
