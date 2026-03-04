/**
 * ===============================================
 * PORTAL DASHBOARD MODULE
 * ===============================================
 * @file src/features/shared/PortalDashboard.ts
 *
 * Role-adaptive dashboard module for both admin and client portals.
 * Admin sees overview metrics, activity, and management tools.
 * Client sees project status, upcoming tasks, and notifications.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, unwrapApiData } from '../../utils/api-client';
import { formatTimeAgo } from '../../utils/time-utils';
import { createLogger } from '../../utils/logger';
import type { DataItem } from './types';

const logger = createLogger('PortalDashboard');

// ============================================
// TYPES
// ============================================

interface DashboardMetric {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

interface ActivityItem extends DataItem {
  id: number;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  actorName?: string;
  link?: string;
}

interface DashboardData {
  metrics: DashboardMetric[];
  recentActivity: ActivityItem[];
  upcomingTasks?: { id: number; title: string; dueDate: string }[];
  notifications?: { id: number; message: string; type: string }[];
}

// ============================================
// PORTAL DASHBOARD MODULE
// ============================================

/**
 * Portal Dashboard Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: full business metrics, all activity, system status
 * - Client: project status, personal tasks, messages
 */
export default class PortalDashboard extends PortalFeatureModule {
  /** Dashboard data */
  private dashboardData: DashboardData = {
    metrics: [],
    recentActivity: [],
    upcomingTasks: [],
    notifications: []
  };

  constructor() {
    super('PortalDashboard');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadDashboardData();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.dashboardData = {
      metrics: [],
      recentActivity: [],
      upcomingTasks: [],
      notifications: []
    };
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    return this.capabilities.canViewAll
      ? '/api/admin/dashboard'
      : '/api/dashboard';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadDashboardData(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<DashboardData>(raw);
      this.dashboardData = data;
    } catch (error) {
      this.notify('Failed to load dashboard data', 'error');
      logger.error('Error loading data:', error);
    }
  }

  // ============================================
  // VIEW RENDERING - Role-adaptive
  // ============================================

  protected renderView(): void {
    if (!this.container) return;

    const layout = this.isAdmin
      ? this.renderAdminLayout()
      : this.renderClientLayout();

    this.container.innerHTML = layout;
  }

  private renderAdminLayout(): string {
    return `
      <div class="dashboard-layout admin-dashboard">
        <div class="dashboard-metrics">
          ${this.renderMetricsGrid()}
        </div>
        <div class="dashboard-content">
          <div class="dashboard-main">
            <div class="dashboard-section">
              <h3>Recent Activity</h3>
              <div class="activity-list" id="activity-list">
                ${this.renderActivityList()}
              </div>
            </div>
          </div>
          <div class="dashboard-sidebar">
            <div class="dashboard-section">
              <h3>Quick Actions</h3>
              ${this.renderQuickActions()}
            </div>
            ${this.renderSystemStatus()}
          </div>
        </div>
      </div>
    `;
  }

  private renderClientLayout(): string {
    return `
      <div class="dashboard-layout client-dashboard">
        <div class="dashboard-welcome">
          <h2>Welcome back</h2>
          <p>Here's an overview of your projects and tasks.</p>
        </div>
        <div class="dashboard-metrics">
          ${this.renderMetricsGrid()}
        </div>
        <div class="dashboard-content">
          <div class="dashboard-main">
            <div class="dashboard-section">
              <h3>Project Updates</h3>
              <div class="activity-list" id="activity-list">
                ${this.renderActivityList()}
              </div>
            </div>
          </div>
          <div class="dashboard-sidebar">
            ${this.renderUpcomingTasks()}
            ${this.renderNotifications()}
          </div>
        </div>
      </div>
    `;
  }

  private renderMetricsGrid(): string {
    const { metrics } = this.dashboardData;

    if (metrics.length === 0) {
      return '<div class="empty-metrics">No metrics available</div>';
    }

    return `
      <div class="metrics-grid">
        ${metrics.map((metric) => `
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">${this.escapeHtml(metric.label)}</span>
            </div>
            <div class="metric-value">${metric.value}</div>
            ${metric.change !== undefined ? `
              <div class="metric-change ${metric.change >= 0 ? 'positive' : 'negative'}">
                ${metric.change >= 0 ? '+' : ''}${metric.change}%
                ${metric.changeLabel ? `<span class="change-label">${metric.changeLabel}</span>` : ''}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderActivityList(): string {
    const { recentActivity } = this.dashboardData;

    if (recentActivity.length === 0) {
      return '<div class="empty-state"><p>No recent activity</p></div>';
    }

    return recentActivity
      .map((activity) => `
        <div class="activity-item" data-activity-id="${activity.id}">
          <div class="activity-icon ${activity.type}">
            ${this.getActivityIcon(activity.type)}
          </div>
          <div class="activity-content">
            <span class="activity-title">${this.escapeHtml(activity.title)}</span>
            <span class="activity-description">${this.escapeHtml(activity.description)}</span>
          </div>
          <div class="activity-meta">
            <span class="activity-time">${this.formatRelativeTime(activity.timestamp)}</span>
            ${activity.actorName ? `<span class="activity-actor">${this.escapeHtml(activity.actorName)}</span>` : ''}
          </div>
        </div>
      `)
      .join('');
  }

  private renderQuickActions(): string {
    if (!this.capabilities.canCreate) return '';

    return `
      <div class="quick-actions-list">
        <button class="quick-action-btn" data-action="new-project">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          New Project
        </button>
        <button class="quick-action-btn" data-action="new-invoice">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          New Invoice
        </button>
        <button class="quick-action-btn" data-action="new-task">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          New Task
        </button>
      </div>
    `;
  }

  private renderSystemStatus(): string {
    if (!this.capabilities.canAccessAnalytics) return '';

    return `
      <div class="dashboard-section">
        <h3>System Status</h3>
        <div class="system-status">
          <div class="status-indicator online">
            <span class="status-dot"></span>
            <span class="status-label">All Systems Operational</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderUpcomingTasks(): string {
    const { upcomingTasks } = this.dashboardData;

    return `
      <div class="dashboard-section">
        <h3>Upcoming Tasks</h3>
        <div class="tasks-list">
          ${upcomingTasks && upcomingTasks.length > 0
    ? upcomingTasks.map((task) => `
              <div class="task-item">
                <span class="task-title">${this.escapeHtml(task.title)}</span>
                <span class="task-due">${this.formatRelativeTime(task.dueDate)}</span>
              </div>
            `).join('')
    : '<p class="empty-state">No upcoming tasks</p>'
}
        </div>
      </div>
    `;
  }

  private renderNotifications(): string {
    const { notifications } = this.dashboardData;

    if (!notifications || notifications.length === 0) return '';

    return `
      <div class="dashboard-section">
        <h3>Notifications</h3>
        <div class="notifications-list">
          ${notifications.map((notif) => `
            <div class="notification-item ${notif.type}">
              <span class="notification-message">${this.escapeHtml(notif.message)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionBtn = target.closest('[data-action]') as HTMLElement;

      if (actionBtn) {
        const action = actionBtn.dataset.action;
        switch (action) {
        case 'new-project':
          this.context.switchTab('projects');
          break;
        case 'new-invoice':
          this.context.switchTab('invoices');
          break;
        case 'new-task':
          this.context.switchTab('tasks');
          break;
        }
      }
    });
  }

  // ============================================
  // UTILITIES
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatRelativeTime(dateString: string): string {
    return formatTimeAgo(dateString);
  }

  private getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      project: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      invoice: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      message: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      file: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'
    };
    return icons[type] || icons.file;
  }
}
