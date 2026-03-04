/**
 * ===============================================
 * PORTAL QUESTIONNAIRES MODULE
 * ===============================================
 * @file src/features/shared/PortalQuestionnaires.ts
 *
 * Role-adaptive questionnaire module for both admin and client portals.
 * Admin can create, manage, and view all questionnaire responses.
 * Client can view and complete assigned questionnaires.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, unwrapApiData } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import type { DataItem } from './types';

const logger = createLogger('PortalQuestionnaires');

// ============================================
// TYPES
// ============================================

interface Questionnaire extends DataItem {
  id: number;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'archived';
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuestionnaireAssignment extends DataItem {
  id: number;
  questionnaireId: number;
  questionnaireTitle: string;
  clientId: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  completedAt?: string;
  assignedAt: string;
}

interface QuestionnaireStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

// ============================================
// PORTAL QUESTIONNAIRES MODULE
// ============================================

/**
 * Portal Questionnaires Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: create questionnaires, view all responses, manage assignments
 * - Client: view assigned questionnaires, complete responses
 */
export default class PortalQuestionnaires extends PortalFeatureModule {
  /** Questionnaires list (admin) */
  private questionnaires: Questionnaire[] = [];

  /** Assignments list (client sees their assignments) */
  private assignments: QuestionnaireAssignment[] = [];

  /** Stats */
  private stats: QuestionnaireStats = {
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  };

  /** Current filter */
  private currentFilter: string = 'all';

  constructor() {
    super('PortalQuestionnaires');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadData();
    this.calculateStats();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.questionnaires = [];
    this.assignments = [];
    this.currentFilter = 'all';
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    return this.capabilities.canViewAll
      ? '/api/questionnaires'
      : '/api/questionnaires/client';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadData(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);

      if (this.isAdmin) {
        this.questionnaires = (data.questionnaires as Questionnaire[]) || (data as unknown as Questionnaire[]) || [];
        // Also load assignments for admin
        const assignmentsResponse = await apiFetch('/api/questionnaires/assignments');
        const assignmentsRaw = await assignmentsResponse.json();
        const assignmentsData = unwrapApiData<Record<string, unknown>>(assignmentsRaw);
        this.assignments = (assignmentsData.assignments as QuestionnaireAssignment[]) || (assignmentsData as unknown as QuestionnaireAssignment[]) || [];
      } else {
        this.assignments = (data.assignments as QuestionnaireAssignment[]) || (data as unknown as QuestionnaireAssignment[]) || [];
      }
    } catch (error) {
      this.notify('Failed to load questionnaires', 'error');
      logger.error('Error loading data:', error);
    }
  }

  private calculateStats(): void {
    const items = this.isAdmin ? this.assignments : this.assignments;

    this.stats = {
      total: items.length,
      pending: items.filter((a) => a.status === 'pending').length,
      inProgress: items.filter((a) => a.status === 'in_progress').length,
      completed: items.filter((a) => a.status === 'completed').length
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
      <div class="questionnaires-layout admin-questionnaires">
        <div class="questionnaires-tabs">
          <button class="tab-btn ${this.currentFilter === 'templates' ? 'active' : ''}" data-tab="templates">
            Templates
          </button>
          <button class="tab-btn ${this.currentFilter !== 'templates' ? 'active' : ''}" data-tab="assignments">
            Assignments
          </button>
        </div>
        ${this.currentFilter === 'templates'
    ? this.renderTemplatesSection()
    : this.renderAssignmentsSection()
}
      </div>
    `;
  }

  private renderClientLayout(): string {
    return `
      <div class="questionnaires-layout client-questionnaires">
        <div class="questionnaires-header">
          <h3>Your Questionnaires</h3>
        </div>
        <div class="questionnaires-stats">
          ${this.renderStatsCards()}
        </div>
        <div class="questionnaires-filters">
          ${this.renderFilters()}
        </div>
        <div class="questionnaires-list" id="questionnaires-list">
          ${this.renderAssignmentsList()}
        </div>
      </div>
    `;
  }

  private renderTemplatesSection(): string {
    return `
      <div class="templates-section">
        <div class="section-header">
          <h3>Questionnaire Templates</h3>
          ${this.capabilities.canCreate ? `
            <button class="btn btn-primary" data-action="create-template">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              New Template
            </button>
          ` : ''}
        </div>
        <div class="templates-grid">
          ${this.questionnaires.length > 0
    ? this.questionnaires.map((q) => this.renderTemplateCard(q)).join('')
    : '<div class="empty-state"><p>No questionnaire templates yet</p></div>'
}
        </div>
      </div>
    `;
  }

  private renderAssignmentsSection(): string {
    return `
      <div class="assignments-section">
        <div class="section-header">
          <h3>Questionnaire Assignments</h3>
        </div>
        <div class="questionnaires-stats">
          ${this.renderStatsCards()}
        </div>
        <div class="questionnaires-filters">
          ${this.renderFilters()}
        </div>
        <div class="assignments-list">
          ${this.renderAssignmentsList()}
        </div>
      </div>
    `;
  }

  private renderStatsCards(): string {
    return `
      <div class="stats-grid">
        <button class="stat-card ${this.currentFilter === 'all' || this.currentFilter === 'templates' || this.currentFilter === 'assignments' ? 'active' : ''}" data-filter="all">
          <span class="stat-number">${this.stats.total}</span>
          <span class="stat-label">Total</span>
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

  private renderTemplateCard(questionnaire: Questionnaire): string {
    return `
      <div class="template-card" data-template-id="${questionnaire.id}">
        <div class="template-header">
          <h4 class="template-title">${this.escapeHtml(questionnaire.title)}</h4>
          ${this.renderStatusBadge(questionnaire.status)}
        </div>
        ${questionnaire.description ? `
          <p class="template-description">${this.escapeHtml(questionnaire.description)}</p>
        ` : ''}
        <div class="template-meta">
          <span class="response-count">${questionnaire.responseCount} responses</span>
        </div>
        <div class="template-actions">
          <button class="btn btn-sm btn-secondary" data-action="view-template" data-id="${questionnaire.id}">View</button>
          ${this.capabilities.canEdit ? `
            <button class="btn btn-sm btn-secondary" data-action="edit-template" data-id="${questionnaire.id}">Edit</button>
            <button class="btn btn-sm btn-primary" data-action="assign" data-id="${questionnaire.id}">Assign</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderAssignmentsList(): string {
    const filteredAssignments = this.getFilteredAssignments();

    if (filteredAssignments.length === 0) {
      return '<div class="empty-state"><p>No questionnaires found</p></div>';
    }

    return filteredAssignments.map((assignment) => this.renderAssignmentCard(assignment)).join('');
  }

  private renderAssignmentCard(assignment: QuestionnaireAssignment): string {
    const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date() && assignment.status !== 'completed';

    return `
      <div class="assignment-card ${isOverdue ? 'overdue' : ''}" data-assignment-id="${assignment.id}">
        <div class="assignment-header">
          <h4 class="assignment-title">${this.escapeHtml(assignment.questionnaireTitle)}</h4>
          ${this.renderAssignmentStatusBadge(assignment.status)}
        </div>
        <div class="assignment-meta">
          ${this.isAdmin && assignment.clientName ? `
            <span class="assignment-client">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${this.escapeHtml(assignment.clientName)}
            </span>
          ` : ''}
          ${assignment.projectName ? `
            <span class="assignment-project">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              ${this.escapeHtml(assignment.projectName)}
            </span>
          ` : ''}
          ${assignment.dueDate ? `
            <span class="assignment-due ${isOverdue ? 'overdue' : ''}">
              Due: ${this.formatDate(assignment.dueDate)}
            </span>
          ` : ''}
        </div>
        <div class="assignment-actions">
          ${assignment.status === 'completed' ? `
            <button class="btn btn-sm btn-secondary" data-action="view-response" data-id="${assignment.id}">View Response</button>
          ` : `
            <button class="btn btn-sm btn-primary" data-action="start" data-id="${assignment.id}">
              ${assignment.status === 'in_progress' ? 'Continue' : 'Start'}
            </button>
          `}
        </div>
      </div>
    `;
  }

  private getFilteredAssignments(): QuestionnaireAssignment[] {
    if (this.currentFilter === 'all' || this.currentFilter === 'templates' || this.currentFilter === 'assignments') {
      return this.assignments;
    }

    return this.assignments.filter((a) => a.status === this.currentFilter);
  }

  private renderStatusBadge(status: string): string {
    const statusClasses: Record<string, string> = {
      draft: 'status-muted',
      active: 'status-success',
      archived: 'status-muted'
    };

    return `<span class="status-badge ${statusClasses[status] || ''}">${status}</span>`;
  }

  private renderAssignmentStatusBadge(status: string): string {
    const statusClasses: Record<string, string> = {
      pending: 'status-pending',
      in_progress: 'status-active',
      completed: 'status-success'
    };

    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed'
    };

    return `<span class="status-badge ${statusClasses[status] || ''}">${statusLabels[status] || status}</span>`;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private attachEventListeners(): void {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      // Tab clicks (admin)
      const tabBtn = target.closest('[data-tab]') as HTMLElement;
      if (tabBtn) {
        this.currentFilter = tabBtn.dataset.tab || 'assignments';
        this.renderView();
        this.attachEventListeners();
        return;
      }

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
        const id = actionBtn.dataset.id;

        switch (action) {
        case 'create-template':
          this.createTemplate();
          break;
        case 'view-template':
          if (id) this.viewTemplate(parseInt(id, 10));
          break;
        case 'edit-template':
          if (id) this.editTemplate(parseInt(id, 10));
          break;
        case 'assign':
          if (id) this.assignQuestionnaire(parseInt(id, 10));
          break;
        case 'start':
          if (id) this.startQuestionnaire(parseInt(id, 10));
          break;
        case 'view-response':
          if (id) this.viewResponse(parseInt(id, 10));
          break;
        }
      }
    });
  }

  // ============================================
  // QUESTIONNAIRE OPERATIONS
  // ============================================

  private createTemplate(): void {
    this.notify('Template creation coming soon', 'info');
  }

  private viewTemplate(templateId: number): void {
    this.notify(`Viewing template #${  templateId}`, 'info');
  }

  private editTemplate(_templateId: number): void {
    if (!this.capabilities.canEdit) return;
    this.notify('Template editing coming soon', 'info');
  }

  private assignQuestionnaire(_templateId: number): void {
    if (!this.capabilities.canAssign) return;
    this.notify('Assignment feature coming soon', 'info');
  }

  private startQuestionnaire(assignmentId: number): void {
    this.notify(`Starting questionnaire #${  assignmentId}`, 'info');
    // Navigate to questionnaire response page
  }

  private viewResponse(assignmentId: number): void {
    this.notify(`Viewing response #${  assignmentId}`, 'info');
  }

  // ============================================
  // UTILITIES
  // ============================================

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
