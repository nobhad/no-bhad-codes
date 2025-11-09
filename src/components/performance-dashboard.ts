/**
 * ===============================================
 * PERFORMANCE DASHBOARD COMPONENT
 * ===============================================
 * @file src/components/performance-dashboard.ts
 *
 * Visual dashboard for monitoring Core Web Vitals and performance metrics.
 */

import { BaseComponent, type ComponentProps, type ComponentState } from './base-component';
import { ComponentUtils } from './component-store';
import { container } from '../core/container';
import type { PerformanceService, PerformanceMetrics, PerformanceAlert } from '../services/performance-service';

export interface PerformanceDashboardProps extends ComponentProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  minimized?: boolean;
  autoHide?: boolean;
  updateInterval?: number;
  showAlerts?: boolean;
  showRecommendations?: boolean;
}

export interface PerformanceDashboardState extends ComponentState {
  isMinimized: boolean;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  score: number;
  isVisible: boolean;
}

export class PerformanceDashboard extends BaseComponent<PerformanceDashboardProps, PerformanceDashboardState> {
  private performanceService: PerformanceService | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(props: PerformanceDashboardProps) {
    const initialState: PerformanceDashboardState = {
      isMinimized: props.minimized || false,
      metrics: {},
      alerts: [],
      score: 100,
      isVisible: true
    };

    super('PerformanceDashboard', props, initialState, { debug: true });

    this.template = {
      render: () => this.renderTemplate(),
      css: () => this.getStyles()
    };
  }

  override async mounted(): Promise<void> {
    // Get performance service
    this.performanceService = await container.resolve('PerformanceService');

    // Start updating metrics
    this.startMetricsUpdate();

    // Auto-hide after 10 seconds if enabled
    if (this.props.autoHide) {
      setTimeout(() => {
        this.setState({ isVisible: false });
      }, 10000);
    }
  }

  private startMetricsUpdate(): void {
    const interval = this.props.updateInterval || 2000;

    this.updateTimer = setInterval(() => {
      if (this.performanceService) {
        const report = this.performanceService.generateReport();
        this.setState({
          metrics: report.metrics,
          alerts: report.alerts,
          score: report.score
        });
      }
    }, interval);

    // Initial update
    if (this.performanceService) {
      const report = this.performanceService.generateReport();
      this.setState({
        metrics: report.metrics,
        alerts: report.alerts,
        score: report.score
      });
    }
  }

  private renderTemplate(): string {
    const { position = 'top-right', showAlerts = true, showRecommendations: _showRecommendations = true } = this.props;
    const { isMinimized, isVisible, metrics, alerts, score } = this.state;

    if (!isVisible) {
      return '';
    }

    const positionClass = `perf-dashboard--${position}`;
    const minimizedClass = isMinimized ? 'perf-dashboard--minimized' : '';

    return ComponentUtils.html`
      <div class="perf-dashboard ${positionClass} ${minimizedClass}" data-ref="dashboard">
        <div class="perf-dashboard__header" data-ref="header">
          <div class="perf-dashboard__title">
            <span class="perf-dashboard__score perf-dashboard__score--${this.getScoreClass(score)}">
              ${Math.round(score)}
            </span>
            <span>Performance</span>
          </div>
          <div class="perf-dashboard__controls">
            <button 
              class="perf-dashboard__btn" 
              data-ref="toggleBtn" 
              title="${isMinimized ? 'Expand' : 'Minimize'}"
            >
              ${isMinimized ? '⬆' : '⬇'}
            </button>
            <button 
              class="perf-dashboard__btn" 
              data-ref="closeBtn" 
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>
        
        ${!isMinimized ? `
          <div class="perf-dashboard__content">
            <div class="perf-dashboard__metrics">
              ${this.renderCoreWebVitals(metrics)}
              ${this.renderLoadingMetrics(metrics)}
              ${this.renderMemoryMetrics(metrics)}
            </div>
            
            ${showAlerts && alerts.length > 0 ? `
              <div class="perf-dashboard__alerts">
                <h4>Alerts</h4>
                ${alerts.slice(0, 3).map(alert => this.renderAlert(alert)).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderCoreWebVitals(metrics: PerformanceMetrics): string {
    return ComponentUtils.html`
      <div class="perf-metric-group">
        <h4>Core Web Vitals</h4>
        ${this.renderMetric('LCP', metrics.lcp, 'ms', { good: 2500, needsWork: 4000 })}
        ${this.renderMetric('FID', metrics.fid, 'ms', { good: 100, needsWork: 300 })}
        ${this.renderMetric('CLS', metrics.cls, '', { good: 0.1, needsWork: 0.25 })}
      </div>
    `;
  }

  private renderLoadingMetrics(metrics: PerformanceMetrics): string {
    return ComponentUtils.html`
      <div class="perf-metric-group">
        <h4>Loading</h4>
        ${this.renderMetric('TTFB', metrics.ttfb, 'ms', { good: 200, needsWork: 500 })}
        ${this.renderMetric('FCP', metrics.fcp, 'ms', { good: 1800, needsWork: 3000 })}
        ${this.renderMetric('Load', metrics.loadComplete, 'ms', { good: 3000, needsWork: 5000 })}
      </div>
    `;
  }

  private renderMemoryMetrics(metrics: PerformanceMetrics): string {
    const memory = metrics.memoryUsage;
    if (!memory) return '';

    const usedMB = Math.round(memory.used / 1024 / 1024);
    const totalMB = Math.round(memory.total / 1024 / 1024);
    const usagePercent = Math.round((memory.used / memory.limit) * 100);

    return ComponentUtils.html`
      <div class="perf-metric-group">
        <h4>Memory</h4>
        <div class="perf-metric">
          <span class="perf-metric__label">JS Heap</span>
          <span class="perf-metric__value">
            ${usedMB}/${totalMB} MB (${usagePercent}%)
          </span>
        </div>
      </div>
    `;
  }

  private renderMetric(
    name: string,
    value: number | undefined,
    unit: string,
    thresholds: { good: number; needsWork: number }
  ): string {
    if (value === undefined) return '';

    const displayValue = unit === 'ms' ? Math.round(value) : value.toFixed(2);
    const status = value <= thresholds.good ? 'good' :
      value <= thresholds.needsWork ? 'needs-work' : 'poor';

    return ComponentUtils.html`
      <div class="perf-metric">
        <span class="perf-metric__label">${name}</span>
        <span class="perf-metric__value perf-metric__value--${status}">
          ${displayValue}${unit}
        </span>
      </div>
    `;
  }

  private renderAlert(alert: PerformanceAlert): string {
    return ComponentUtils.html`
      <div class="perf-alert perf-alert--${alert.type}">
        <div class="perf-alert__header">
          <span class="perf-alert__metric">${alert.metric.toUpperCase()}</span>
          <span class="perf-alert__value">${Math.round(alert.value)}</span>
        </div>
        <div class="perf-alert__message">${alert.message}</div>
      </div>
    `;
  }

  private getScoreClass(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'needs-work';
    return 'poor';
  }

  private getStyles(): string {
    return ComponentUtils.css`
      .perf-dashboard {
        position: fixed;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        z-index: 10000;
        min-width: 280px;
        max-width: 320px;
        transition: all 0.3s ease;
      }

      .perf-dashboard--top-right {
        top: 20px;
        right: 20px;
      }

      .perf-dashboard--top-left {
        top: 20px;
        left: 20px;
      }

      .perf-dashboard--bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .perf-dashboard--bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .perf-dashboard--minimized {
        max-height: 40px;
      }

      .perf-dashboard__header {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.05);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
      }

      .perf-dashboard__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }

      .perf-dashboard__score {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: bold;
        min-width: 24px;
        text-align: center;
      }

      .perf-dashboard__score--excellent {
        background: #4caf50;
        color: white;
      }

      .perf-dashboard__score--good {
        background: #8bc34a;
        color: white;
      }

      .perf-dashboard__score--needs-work {
        background: #ff9800;
        color: white;
      }

      .perf-dashboard__score--poor {
        background: #f44336;
        color: white;
      }

      .perf-dashboard__controls {
        display: flex;
        gap: 4px;
      }

      .perf-dashboard__btn {
        background: none;
        border: none;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 3px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }

      .perf-dashboard__btn:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.1);
      }

      .perf-dashboard__content {
        padding: 12px;
        max-height: 400px;
        overflow-y: auto;
      }

      .perf-metric-group {
        margin-bottom: 16px;
      }

      .perf-metric-group h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
      }

      .perf-metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 0;
        border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      }

      .perf-metric:last-child {
        border-bottom: none;
      }

      .perf-metric__label {
        color: #333;
        font-weight: 500;
      }

      .perf-metric__value {
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .perf-metric__value--good {
        background: #e8f5e8;
        color: #2e7d32;
      }

      .perf-metric__value--needs-work {
        background: #fff3e0;
        color: #ef6c00;
      }

      .perf-metric__value--poor {
        background: #ffebee;
        color: #c62828;
      }

      .perf-dashboard__alerts {
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        padding-top: 12px;
        margin-top: 12px;
      }

      .perf-dashboard__alerts h4 {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
      }

      .perf-alert {
        background: #fff3e0;
        border-left: 3px solid #ff9800;
        padding: 6px 8px;
        margin-bottom: 6px;
        border-radius: 0 4px 4px 0;
      }

      .perf-alert--error {
        background: #ffebee;
        border-left-color: #f44336;
      }

      .perf-alert__header {
        display: flex;
        justify-content: space-between;
        font-weight: 600;
        font-size: 11px;
        margin-bottom: 2px;
      }

      .perf-alert__message {
        font-size: 10px;
        color: #666;
      }

      @media (max-width: 768px) {
        .perf-dashboard {
          max-width: 260px;
          font-size: 11px;
        }
        
        .perf-dashboard--top-right,
        .perf-dashboard--bottom-right {
          right: 10px;
        }
        
        .perf-dashboard--top-left,
        .perf-dashboard--bottom-left {
          left: 10px;
        }
      }
    `;
  }

  protected override cacheElements(): void {
    this.getElement('dashboard', '[data-ref="dashboard"]');
    this.getElement('header', '[data-ref="header"]');
    this.getElement('toggleBtn', '[data-ref="toggleBtn"]', false);
    this.getElement('closeBtn', '[data-ref="closeBtn"]', false);
  }

  protected override bindEvents(): void {
    const header = this.getElement('header', '[data-ref="header"]');
    const toggleBtn = this.getElement('toggleBtn', '[data-ref="toggleBtn"]', false);
    const closeBtn = this.getElement('closeBtn', '[data-ref="closeBtn"]', false);

    if (header) {
      this.addEventListener(header, 'dblclick', this.toggle.bind(this));
    }

    if (toggleBtn) {
      this.addEventListener(toggleBtn, 'click', this.toggle.bind(this));
    }

    if (closeBtn) {
      this.addEventListener(closeBtn, 'click', this.hide.bind(this));
    }
  }

  /**
   * Public API
   */
  toggle(): void {
    this.setState({ isMinimized: !this.state.isMinimized });
  }

  hide(): void {
    this.setState({ isVisible: false });
  }

  show(): void {
    this.setState({ isVisible: true });
  }

  override async destroy(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    await super.destroy();
  }
}