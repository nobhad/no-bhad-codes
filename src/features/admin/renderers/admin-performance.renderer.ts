/**
 * ===============================================
 * ADMIN PERFORMANCE RENDERER
 * ===============================================
 * @file src/features/admin/renderers/admin-performance.renderer.ts
 *
 * Renders performance metrics UI in the admin dashboard.
 * Handles Core Web Vitals display, alerts, and bundle size info.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createLogger } from '../../../utils/logging';
import { renderEmptyState } from '../../../components/empty-state';

const logger = createLogger('AdminPerformanceRenderer');

// ============================================
// Types
// ============================================

export interface PerformanceMetricDisplay {
  value: string;
  status: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}

export interface PerformanceMetrics {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb?: PerformanceMetricDisplay;
  fcp?: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts: string[];
}

// ============================================
// Admin Performance Renderer
// ============================================

class AdminPerformanceRenderer {
  /**
   * Render all performance metrics
   */
  renderMetrics(metrics: PerformanceMetrics): void {
    // Update Core Web Vitals
    this.renderVital('lcp', metrics.lcp);
    this.renderVital('fid', metrics.fid);
    this.renderVital('cls', metrics.cls);

    if (metrics.ttfb) {
      this.renderVital('ttfb', metrics.ttfb);
    }

    // Update bundle sizes if available
    if (metrics.bundleSize) {
      this.updateElement('total-bundle-size', metrics.bundleSize.total);
      this.updateElement('js-bundle-size', metrics.bundleSize.main);
      this.updateElement('css-bundle-size', metrics.bundleSize.vendor);
    }

    // Update performance score
    this.updateElement('performance-score', `${Math.round(metrics.score)}/100`);
    this.updateElement('performance-grade', metrics.grade);

    // Update score styling based on grade
    this.updateScoreStyling(metrics.grade);

    // Show alerts if any
    this.renderAlerts(metrics.alerts);

    logger.debug('Performance metrics rendered', { score: metrics.score, grade: metrics.grade });
  }

  /**
   * Render a single vital metric
   */
  renderVital(type: string, data: PerformanceMetricDisplay): void {
    const valueElement = document.getElementById(`${type}-value`);
    const statusElement = document.getElementById(`${type}-status`);
    const cardElement = document.getElementById(`${type}-card`);

    if (valueElement) {
      valueElement.textContent = data.value;
    }

    if (statusElement) {
      const statusText = data.status.replace(/-/g, ' ');
      statusElement.textContent = statusText.charAt(0).toUpperCase() + statusText.slice(1);
      statusElement.className = `vital-status vital-status-${data.status}`;
    }

    if (cardElement) {
      cardElement.className = `vital-card vital-card-${data.status}`;
    }
  }

  /**
   * Render performance alerts
   */
  renderAlerts(alerts: string[]): void {
    const container = document.getElementById('performance-alerts');
    if (!container) return;

    if (alerts.length === 0) {
      renderEmptyState(container, 'No performance issues detected');
      return;
    }

    container.innerHTML = alerts.map(alert => `
      <div class="performance-alert warning">
        <span class="alert-icon warning">&#9888;</span>
        <span class="alert-message">${SanitizationUtils.escapeHtml(alert)}</span>
      </div>
    `).join('');
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    const container = document.getElementById('performance-container');
    if (container) {
      container.classList.add('loading');
    }

    // Show loading indicators on vitals
    ['lcp', 'fid', 'cls', 'ttfb'].forEach(type => {
      const valueElement = document.getElementById(`${type}-value`);
      if (valueElement) {
        valueElement.textContent = '...';
      }
    });

    this.updateElement('performance-score', '...');
    this.updateElement('performance-grade', '-');
  }

  /**
   * Hide loading state
   */
  hideLoading(): void {
    const container = document.getElementById('performance-container');
    if (container) {
      container.classList.remove('loading');
    }
  }

  /**
   * Show error state
   */
  showError(message: string = 'Failed to load performance metrics'): void {
    this.hideLoading();

    // Show N/A for all vitals
    this.showNoData();

    // Show error in alerts
    const container = document.getElementById('performance-alerts');
    if (container) {
      container.innerHTML = `
        <div class="performance-alert error">
          <span class="alert-icon error">&#10006;</span>
          <span class="alert-message">${SanitizationUtils.escapeHtml(message)}</span>
        </div>
      `;
    }

    logger.warn('Performance error displayed', { message });
  }

  /**
   * Show no data state
   */
  showNoData(): void {
    const noDataMetric: PerformanceMetricDisplay = { value: 'N/A', status: 'unknown' };

    this.renderVital('lcp', noDataMetric);
    this.renderVital('fid', noDataMetric);
    this.renderVital('cls', noDataMetric);
    this.renderVital('ttfb', noDataMetric);

    this.updateElement('performance-score', 'N/A');
    this.updateElement('performance-grade', '-');
    this.updateElement('total-bundle-size', 'N/A');
    this.updateElement('js-bundle-size', 'N/A');
    this.updateElement('css-bundle-size', 'N/A');
  }

  /**
   * Render Core Web Vitals info tooltips
   */
  renderVitalTooltips(): void {
    const tooltips = {
      lcp: 'Largest Contentful Paint measures loading performance. Good: ≤2.5s, Needs Improvement: 2.5-4s, Poor: >4s',
      fid: 'First Input Delay measures interactivity. Good: ≤100ms, Needs Improvement: 100-300ms, Poor: >300ms',
      cls: 'Cumulative Layout Shift measures visual stability. Good: ≤0.1, Needs Improvement: 0.1-0.25, Poor: >0.25',
      ttfb: 'Time to First Byte measures server response time. Good: ≤800ms, Needs Improvement: 800-1800ms, Poor: >1800ms'
    };

    Object.entries(tooltips).forEach(([type, tooltip]) => {
      const infoIcon = document.getElementById(`${type}-info`);
      if (infoIcon) {
        infoIcon.setAttribute('title', tooltip);
        infoIcon.setAttribute('aria-label', tooltip);
      }
    });
  }

  /**
   * Update a DOM element's text content
   */
  private updateElement(id: string, text: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Update score card styling based on grade
   */
  private updateScoreStyling(grade: string): void {
    const scoreCard = document.getElementById('performance-score-card');
    if (!scoreCard) return;

    // Remove existing grade classes
    scoreCard.classList.remove('grade-a', 'grade-b', 'grade-c', 'grade-d', 'grade-f');

    // Add appropriate grade class
    scoreCard.classList.add(`grade-${grade.toLowerCase()}`);
  }

  /**
   * Render bundle size breakdown
   */
  renderBundleSizes(sizes: { name: string; size: string; percentage: number }[]): void {
    const container = document.getElementById('bundle-breakdown');
    if (!container) return;

    if (sizes.length === 0) {
      renderEmptyState(container, 'No bundle data available');
      return;
    }

    container.innerHTML = sizes.map(item => `
      <div class="bundle-item">
        <div class="bundle-info">
          <span class="bundle-name">${SanitizationUtils.escapeHtml(item.name)}</span>
          <span class="bundle-size">${SanitizationUtils.escapeHtml(item.size)}</span>
        </div>
        <div class="bundle-bar">
          <div class="bundle-bar-fill" style="width: ${item.percentage}%"></div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render performance history chart placeholder
   */
  renderHistoryPlaceholder(): void {
    const container = document.getElementById('performance-history');
    if (!container) return;

    container.innerHTML = `
      <div class="chart-placeholder">
        <p>Performance history tracking coming soon</p>
        <p class="hint">Historical Core Web Vitals data will be displayed here</p>
      </div>
    `;
  }
}

// Singleton instance
export const adminPerformanceRenderer = new AdminPerformanceRenderer();
export default adminPerformanceRenderer;
