/**
 * ===============================================
 * PORTAL REQUESTS MODULE
 * ===============================================
 * @file src/features/shared/PortalRequests.ts
 *
 * Role-adaptive request management module for both admin and client portals.
 * Admin can manage all requests, assign team members, set priorities.
 * Client can submit requests and track status.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, apiPut, unwrapApiData } from '../../utils/api-client';
import { formatTimeAgo } from '../../utils/time-utils';
import type { DataItem } from './types';
import {
  getAdHocRequestStatusLabel,
  getAdHocRequestStatusVariant,
  getStatusBadgeClass
} from '../../utils/status-utils';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalRequests');

// ============================================
// TYPES
// ============================================

interface Request extends DataItem {
  id: number;
  title: string;
  description: string;
  type: 'general' | 'change' | 'bug' | 'feature' | 'support';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  clientId: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  assignedTo?: number;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
}

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

// ============================================
// PORTAL REQUESTS MODULE
// ============================================

/**
 * Portal Requests Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: manage all requests, assign, prioritize
 * - Client: submit requests, track status
 */
export default class PortalRequests extends PortalFeatureModule {
  /** Requests list */
  private requests: Request[] = [];

  /** Request stats */
  private stats: RequestStats = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  };

  /** Current filter */
  private currentFilter: string = 'all';

  constructor() {
    super('PortalRequests');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadRequests();
    this.calculateStats();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.requests = [];
    this.currentFilter = 'all';
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    return this.capabilities.canViewAll
      ? '/api/requests'
      : '/api/requests/client';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadRequests(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);
      this.requests = (data.requests as Request[]) || (data as unknown as Request[]) || [];
    } catch (error) {
      this.notify('Failed to load requests', 'error');
      logger.error('Error loading requests:', error);
    }
  }

  private calculateStats(): void {
    this.stats = {
      total: this.requests.length,
      pending: this.requests.filter((r) => r.status === 'pending').length,
      inProgress: this.requests.filter((r) => r.status === 'in_progress').length,
      completed: this.requests.filter((r) => r.status === 'completed').length
    };
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
      <div class="requests-layout admin-requests">
        <div class="requests-stats">
          ${this.renderStatsCards()}
        </div>
        <div class="requests-toolbar">
          ${this.renderToolbar({ showSearch: true, searchPlaceholder: 'Search requests...' })}
        </div>
        <div class="requests-filters">
          ${this.renderFilters()}
        </div>
        <div class="requests-list" id="requests-list">
          ${this.renderRequestsList()}
        </div>
      </div>
    `;
  }

  private renderClientLayout(): string {
    return `
      <div class="requests-layout client-requests">
        <div class="requests-header">
          <h3>Your Requests</h3>
          <button class="btn btn-primary" data-action="new-request">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            New Request
          </button>
        </div>
        <div class="requests-filters">
          ${this.renderFilters()}
        </div>
        <div class="requests-list" id="requests-list">
          ${this.renderRequestsList()}
        </div>
      </div>
    `;
  }

  private renderStatsCards(): string {
    return `
      <div class="stats-grid">
        <button class="stat-card ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
          <span class="stat-number">${this.stats.total}</span>
          <span class="stat-label">Total Requests</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">
          <span class="stat-number">${this.stats.pending}</span>
          <span class="stat-label">Pending</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'in_progress' ? 'active' : ''}" data-filter="in_progress">
          <span class="stat-number">${this.stats.inProgress}</span>
          <span class="stat-label">In Progress</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
          <span class="stat-number">${this.stats.completed}</span>
          <span class="stat-label">Completed</span>
        </button>
      </div>
    `;
  }

  private renderFilters(): string {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'pending', label: 'Pending' },
      { id: 'in_progress', label: 'In Progress' },
      { id: 'completed', label: 'Completed' }
    ];

    return `
      <div class="filter-tabs">
        ${filters.map((f) => `
          <button class="filter-tab ${this.currentFilter === f.id ? 'active' : ''}" data-filter="${f.id}">
            ${f.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  private renderRequestsList(): string {
    const filteredRequests = this.getFilteredRequests();

    if (filteredRequests.length === 0) {
      return `
        <div class="empty-state">
          <p>No requests found</p>
          ${!this.isAdmin ? '<button class="btn btn-primary" data-action="new-request">Create a Request</button>' : ''}
        </div>
      `;
    }

    return filteredRequests.map((request) => this.renderRequestCard(request)).join('');
  }

  private renderRequestCard(request: Request): string {
    return `
      <div class="request-card" data-request-id="${request.id}">
        <div class="request-card-header">
          <div class="request-meta">
            ${this.renderTypeBadge(request.type)}
            ${this.renderPriorityBadge(request.priority)}
            ${this.renderStatusBadge(request.status)}
          </div>
          <span class="request-date">${this.formatRelativeTime(request.createdAt)}</span>
        </div>
        <div class="request-card-body">
          <h4 class="request-title">${this.escapeHtml(request.title)}</h4>
          <p class="request-description">${this.escapeHtml(request.description.substring(0, 150))}...</p>
        </div>
        <div class="request-card-footer">
          ${this.isAdmin && request.clientName ? `
            <span class="request-client">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${this.escapeHtml(request.clientName)}
            </span>
          ` : ''}
          ${request.projectName ? `
            <span class="request-project">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              ${this.escapeHtml(request.projectName)}
            </span>
          ` : ''}
          <div class="request-actions">
            <button class="btn btn-sm btn-secondary" data-action="view" data-id="${request.id}">View</button>
            ${this.isAdmin && request.status !== 'completed' ? `
              <button class="btn btn-sm btn-primary" data-action="update-status" data-id="${request.id}">Update</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  private getFilteredRequests(): Request[] {
    if (this.currentFilter === 'all') {
      return this.requests;
    }

    return this.requests.filter((r) => r.status === this.currentFilter);
  }

  private renderTypeBadge(type: string): string {
    const typeClasses: Record<string, string> = {
      general: 'type-default',
      change: 'type-warning',
      bug: 'type-danger',
      feature: 'type-primary',
      support: 'type-info'
    };

    return `<span class="type-badge ${typeClasses[type] || ''}">${type}</span>`;
  }

  private renderPriorityBadge(priority: string): string {
    const priorityClasses: Record<string, string> = {
      low: 'priority-low',
      medium: 'priority-medium',
      high: 'priority-high',
      urgent: 'priority-urgent'
    };

    return `<span class="priority-badge ${priorityClasses[priority] || ''}">${priority}</span>`;
  }

  private renderStatusBadge(status: string): string {
    const variant = getAdHocRequestStatusVariant(status);
    const label = getAdHocRequestStatusLabel(status);
    return `<span class="${getStatusBadgeClass(variant)}">${label}</span>`;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Filter clicks
      const filterBtn = target.closest('[data-filter]') as HTMLElement;
      if (filterBtn) {
        this.currentFilter = filterBtn.dataset.filter || 'all';
        this.renderView();
        this.attachEventListeners();
        return;
      }

      // Action buttons
      const actionBtn = target.closest('[data-action]') as HTMLElement;
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const requestId = actionBtn.dataset.id;

        switch (action) {
        case 'new-request':
          this.showNewRequestForm();
          break;
        case 'view':
          if (requestId) this.viewRequest(parseInt(requestId, 10));
          break;
        case 'update-status':
          if (requestId) this.updateRequestStatus(parseInt(requestId, 10));
          break;
        }
      }
    });
  }

  // ============================================
  // REQUEST OPERATIONS
  // ============================================

  private showNewRequestForm(): void {
    // Show modal or form for creating new request
    this.notify('New request form coming soon', 'info');
  }

  private viewRequest(requestId: number): void {
    // Open request detail view
    this.notify(`Viewing request #${  requestId}`, 'info');
  }

  private async updateRequestStatus(requestId: number): Promise<void> {
    if (!this.capabilities.canEdit) return;

    // For now, just cycle through statuses
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) return;

    const statusOrder = ['pending', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(request.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    try {
      await apiPut(`/api/requests/${requestId}`, { status: nextStatus });
      this.notify('Request status updated', 'success');
      await this.loadRequests();
      this.calculateStats();
      this.renderView();
      this.attachEventListeners();
    } catch (error) {
      this.notify('Failed to update request', 'error');
      logger.error('Error updating request:', error);
    }
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
}
