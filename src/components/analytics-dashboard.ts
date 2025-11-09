/**
 * ===============================================
 * ANALYTICS DASHBOARD COMPONENT
 * ===============================================
 * @file src/components/analytics-dashboard.ts
 *
 * Visual dashboard for visitor analytics and engagement metrics.
 */

import { BaseComponent, type ComponentProps, type ComponentState } from './base-component';
import { ComponentUtils } from './component-store';
import { container } from '../core/container';
import type { VisitorTrackingService, EngagementMetrics, VisitorSession } from '../services/visitor-tracking';

export interface AnalyticsDashboardProps extends ComponentProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  minimized?: boolean;
  showRealTime?: boolean;
  updateInterval?: number;
  showCharts?: boolean;
}

export interface AnalyticsDashboardState extends ComponentState {
  isMinimized: boolean;
  isVisible: boolean;
  currentSession: VisitorSession | null;
  metrics: EngagementMetrics;
  realtimeData: {
    activeVisitors: number;
    currentPage: string;
    sessionDuration: number;
    interactionCount: number;
  };
}

export class AnalyticsDashboard extends BaseComponent<AnalyticsDashboardProps, AnalyticsDashboardState> {
  private trackingService: VisitorTrackingService | null = null;
  private updateTimer: any = null;

  constructor(props: AnalyticsDashboardProps) {
    const initialState: AnalyticsDashboardState = {
      isMinimized: props.minimized || false,
      isVisible: true,
      currentSession: null,
      metrics: {
        averageTimeOnSite: 0,
        bounceRate: 0,
        pagesPerSession: 0,
        topPages: [],
        topInteractions: [],
        deviceTypes: {},
        referrers: {}
      },
      realtimeData: {
        activeVisitors: 1,
        currentPage: window.location.pathname,
        sessionDuration: 0,
        interactionCount: 0
      }
    };

    super('AnalyticsDashboard', props, initialState, { debug: true });

    this.template = {
      render: () => this.renderTemplate(),
      css: () => this.getStyles()
    };
  }

  override async mounted(): Promise<void> {
    // Get visitor tracking service
    try {
      this.trackingService = await container.resolve('VisitorTrackingService');
      this.startDataUpdate();
    } catch (error) {
      console.warn('[AnalyticsDashboard] Visitor tracking service not available:', error);
    }
  }

  private startDataUpdate(): void {
    const interval = this.props.updateInterval || 5000; // 5 seconds

    this.updateTimer = setInterval(() => {
      this.updateData();
    }, interval);

    // Initial update
    this.updateData();
  }

  private updateData(): void {
    if (!this.trackingService) return;

    const currentSession = this.trackingService.getCurrentSession();
    const metrics = this.trackingService.getEngagementMetrics();

    // Calculate real-time data
    const realtimeData = {
      activeVisitors: 1, // Would be multiple in a real system
      currentPage: window.location.pathname,
      sessionDuration: currentSession ? Date.now() - currentSession.startTime : 0,
      interactionCount: currentSession ? currentSession.pageViews : 0
    };

    this.setState({
      currentSession,
      metrics,
      realtimeData
    });
  }

  private renderTemplate(): string {
    const { position = 'top-left', showRealTime = true, showCharts: _showCharts = false } = this.props;
    const { isMinimized, isVisible, currentSession, metrics, realtimeData } = this.state;

    if (!isVisible) {
      return '';
    }

    const positionClass = `analytics-dashboard--${position}`;
    const minimizedClass = isMinimized ? 'analytics-dashboard--minimized' : '';

    return ComponentUtils.html`
      <div class="analytics-dashboard ${positionClass} ${minimizedClass}" data-ref="dashboard">
        <div class="analytics-dashboard__header" data-ref="header">
          <div class="analytics-dashboard__title">
            <span class="analytics-dashboard__icon">📊</span>
            <span>Analytics</span>
          </div>
          <div class="analytics-dashboard__controls">
            <button 
              class="analytics-dashboard__btn" 
              data-ref="toggleBtn" 
              title="${isMinimized ? 'Expand' : 'Minimize'}"
            >
              ${isMinimized ? '⬆' : '⬇'}
            </button>
            <button 
              class="analytics-dashboard__btn" 
              data-ref="closeBtn" 
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        ${!isMinimized ? `
          <div class="analytics-dashboard__content">
            ${showRealTime ? this.renderRealtimeMetrics(realtimeData, currentSession) : ''}
            ${this.renderOverviewMetrics(metrics)}
            ${this.renderTopPages(metrics.topPages)}
            ${this.renderTopInteractions(metrics.topInteractions)}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderRealtimeMetrics(data: any, session: VisitorSession | null): string {
    const sessionDurationMinutes = Math.floor(data.sessionDuration / 60000);
    const sessionDurationSeconds = Math.floor((data.sessionDuration % 60000) / 1000);

    return ComponentUtils.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Real-time</h4>
        <div class="analytics-metrics">
          <div class="analytics-metric">
            <div class="analytics-metric__value">
              <span class="analytics-metric__dot analytics-metric__dot--active"></span>
              ${data.activeVisitors}
            </div>
            <div class="analytics-metric__label">Active Visitors</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">
              ${sessionDurationMinutes}:${sessionDurationSeconds.toString().padStart(2, '0')}
            </div>
            <div class="analytics-metric__label">Session Time</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${session?.pageViews || 0}</div>
            <div class="analytics-metric__label">Page Views</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${session?.bounced ? 'Yes' : 'No'}</div>
            <div class="analytics-metric__label">Bounced</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderOverviewMetrics(metrics: EngagementMetrics): string {
    const avgTimeMinutes = Math.floor(metrics.averageTimeOnSite / 60000);
    const avgTimeSeconds = Math.floor((metrics.averageTimeOnSite % 60000) / 1000);

    return ComponentUtils.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Overview</h4>
        <div class="analytics-metrics">
          <div class="analytics-metric">
            <div class="analytics-metric__value">
              ${avgTimeMinutes}:${avgTimeSeconds.toString().padStart(2, '0')}
            </div>
            <div class="analytics-metric__label">Avg. Time on Site</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${metrics.bounceRate.toFixed(1)}%</div>
            <div class="analytics-metric__label">Bounce Rate</div>
          </div>
          <div class="analytics-metric">
            <div class="analytics-metric__value">${metrics.pagesPerSession.toFixed(1)}</div>
            <div class="analytics-metric__label">Pages/Session</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderTopPages(pages: any[]): string {
    if (pages.length === 0) {
      return '';
    }

    return ComponentUtils.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Top Pages</h4>
        <div class="analytics-list">
          ${pages.slice(0, 5).map(page => {
    const avgTimeMinutes = Math.floor(page.avgTime / 60000);
    const avgTimeSeconds = Math.floor((page.avgTime % 60000) / 1000);
    const shortUrl = page.url.split('/').pop() || page.url;

    return `
              <div class="analytics-list__item">
                <div class="analytics-list__main">
                  <span class="analytics-list__name">${shortUrl}</span>
                  <span class="analytics-list__value">${page.views} views</span>
                </div>
                <div class="analytics-list__sub">
                  Avg. time: ${avgTimeMinutes}:${avgTimeSeconds.toString().padStart(2, '0')}
                </div>
              </div>
            `;
  }).join('')}
        </div>
      </div>
    `;
  }

  private renderTopInteractions(interactions: any[]): string {
    if (interactions.length === 0) {
      return '';
    }

    return ComponentUtils.html`
      <div class="analytics-section">
        <h4 class="analytics-section__title">Top Interactions</h4>
        <div class="analytics-list">
          ${interactions.slice(0, 5).map(interaction => `
            <div class="analytics-list__item">
              <div class="analytics-list__main">
                <span class="analytics-list__name">${interaction.element}</span>
                <span class="analytics-list__value">${interaction.count}x</span>
              </div>
              <div class="analytics-list__sub">
                Type: ${interaction.type}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private getStyles(): string {
    return ComponentUtils.css`
      .analytics-dashboard {
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

      .analytics-dashboard--top-left {
        top: 20px;
        left: 20px;
      }

      .analytics-dashboard--top-right {
        top: 20px;
        right: 20px;
      }

      .analytics-dashboard--bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .analytics-dashboard--bottom-right {
        bottom: 20px;
        right: 20px;
      }

      .analytics-dashboard--minimized {
        max-height: 40px;
      }

      .analytics-dashboard__header {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.05);
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
      }

      .analytics-dashboard__title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }

      .analytics-dashboard__icon {
        font-size: 14px;
      }

      .analytics-dashboard__controls {
        display: flex;
        gap: 4px;
      }

      .analytics-dashboard__btn {
        background: none;
        border: none;
        padding: 4px 6px;
        cursor: pointer;
        border-radius: 3px;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      }

      .analytics-dashboard__btn:hover {
        opacity: 1;
        background: rgba(0, 0, 0, 0.1);
      }

      .analytics-dashboard__content {
        padding: 12px;
        max-height: 500px;
        overflow-y: auto;
      }

      .analytics-section {
        margin-bottom: 16px;
      }

      .analytics-section:last-child {
        margin-bottom: 0;
      }

      .analytics-section__title {
        margin: 0 0 8px 0;
        font-size: 11px;
        text-transform: uppercase;
        color: #666;
        font-weight: 600;
      }

      .analytics-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .analytics-metric {
        text-align: center;
        padding: 8px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 4px;
      }

      .analytics-metric__value {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin-bottom: 2px;
      }

      .analytics-metric__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ccc;
      }

      .analytics-metric__dot--active {
        background: #4caf50;
        animation: pulse 2s infinite;
      }

      .analytics-metric__label {
        font-size: 10px;
        color: #666;
        text-transform: uppercase;
        font-weight: 500;
      }

      .analytics-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .analytics-list__item {
        padding: 6px 8px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 4px;
        border-left: 3px solid var(--color-primary, #ff6b6b);
      }

      .analytics-list__main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2px;
      }

      .analytics-list__name {
        font-weight: 500;
        color: #333;
        font-size: 11px;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .analytics-list__value {
        font-weight: 600;
        color: var(--color-primary, #ff6b6b);
        font-size: 11px;
      }

      .analytics-list__sub {
        font-size: 10px;
        color: #666;
        opacity: 0.8;
      }

      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      @media (max-width: 768px) {
        .analytics-dashboard {
          max-width: 260px;
          font-size: 11px;
        }
        
        .analytics-dashboard--top-left,
        .analytics-dashboard--bottom-left {
          left: 10px;
        }
        
        .analytics-dashboard--top-right,
        .analytics-dashboard--bottom-right {
          right: 10px;
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

  exportData(): any {
    if (!this.trackingService) return null;
    return this.trackingService.exportData();
  }

  override async destroy(): Promise<void> {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    await super.destroy();
  }
}