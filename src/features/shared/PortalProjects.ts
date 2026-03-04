/**
 * ===============================================
 * PORTAL PROJECTS MODULE
 * ===============================================
 * @file src/features/shared/PortalProjects.ts
 *
 * Role-adaptive project management module for both admin and client portals.
 * Admin sees all projects with full management capabilities.
 * Client sees only their projects with limited actions.
 *
 * CORE PRINCIPLE: Same module, different capabilities based on role.
 */

import { PortalFeatureModule } from './PortalFeatureModule';
import { apiFetch, unwrapApiData } from '../../utils/api-client';
import type { DataItem, ColumnDef } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalProjects');

// ============================================
// TYPES
// ============================================

interface Project extends DataItem {
  id: number;
  name: string;
  clientId: number;
  clientName?: string;
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold' | 'cancelled';
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  budget?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  onHold: number;
}

// ============================================
// PORTAL PROJECTS MODULE
// ============================================

/**
 * Portal Projects Module
 *
 * Adapts UI and API calls based on user role:
 * - Admin: full project management, team assignments, timelines
 * - Client: view own projects, milestones, deliverables
 */
export default class PortalProjects extends PortalFeatureModule {
  /** Projects list */
  private projects: Project[] = [];

  /** Project stats */
  private stats: ProjectStats = {
    total: 0,
    active: 0,
    completed: 0,
    onHold: 0
  };

  /** Current filter */
  private currentFilter: string = 'all';

  constructor() {
    super('PortalProjects');
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  async activate(): Promise<void> {
    this.showLoading();
    await this.loadProjects();
    this.calculateStats();
    this.renderView();
    this.attachEventListeners();
    this.setModuleState('ready');
  }

  async deactivate(): Promise<void> {
    this.projects = [];
    this.currentFilter = 'all';
  }

  // ============================================
  // API - Role-based endpoints
  // ============================================

  protected getApiEndpoint(): string {
    return this.capabilities.canViewAll
      ? '/api/projects'
      : '/api/projects/client';
  }

  // ============================================
  // DATA LOADING
  // ============================================

  private async loadProjects(): Promise<void> {
    try {
      const response = await apiFetch(this.getApiEndpoint());
      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);
      this.projects = (data.projects as Project[]) || (data as unknown as Project[]) || [];
    } catch (error) {
      this.notify('Failed to load projects', 'error');
      logger.error('Error loading projects:', error);
    }
  }

  private calculateStats(): void {
    this.stats = {
      total: this.projects.length,
      active: this.projects.filter((p) => ['planning', 'in_progress', 'review'].includes(p.status)).length,
      completed: this.projects.filter((p) => p.status === 'completed').length,
      onHold: this.projects.filter((p) => p.status === 'on_hold').length
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
      <div class="projects-layout admin-projects">
        <div class="projects-stats">
          ${this.renderStatsCards()}
        </div>
        <div class="projects-toolbar">
          ${this.renderToolbar({ showSearch: true, searchPlaceholder: 'Search projects...' })}
        </div>
        <div class="projects-filters">
          ${this.renderFilters()}
        </div>
        <div class="projects-table-wrapper">
          ${this.renderProjectsTable()}
        </div>
      </div>
    `;
  }

  private renderClientLayout(): string {
    return `
      <div class="projects-layout client-projects">
        <div class="projects-header">
          <h3>Your Projects</h3>
        </div>
        <div class="projects-filters">
          ${this.renderFilters()}
        </div>
        <div class="projects-grid">
          ${this.renderProjectsGrid()}
        </div>
      </div>
    `;
  }

  private renderStatsCards(): string {
    return `
      <div class="stats-grid">
        <button class="stat-card ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
          <span class="stat-number">${this.stats.total}</span>
          <span class="stat-label">Total Projects</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'active' ? 'active' : ''}" data-filter="active">
          <span class="stat-number">${this.stats.active}</span>
          <span class="stat-label">Active</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">
          <span class="stat-number">${this.stats.completed}</span>
          <span class="stat-label">Completed</span>
        </button>
        <button class="stat-card ${this.currentFilter === 'on_hold' ? 'active' : ''}" data-filter="on_hold">
          <span class="stat-number">${this.stats.onHold}</span>
          <span class="stat-label">On Hold</span>
        </button>
      </div>
    `;
  }

  private renderFilters(): string {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'active', label: 'Active' },
      { id: 'completed', label: 'Completed' },
      { id: 'on_hold', label: 'On Hold' }
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

  private renderProjectsTable(): string {
    const filteredProjects = this.getFilteredProjects();

    const columns: ColumnDef<Project>[] = [
      {
        id: 'name',
        header: 'Project',
        accessor: 'name'
      },
      {
        id: 'client',
        header: 'Client',
        accessor: (p) => p.clientName || '-'
      },
      {
        id: 'status',
        header: 'Status',
        accessor: 'status',
        render: (value) => this.renderStatusBadge(value as string)
      },
      {
        id: 'progress',
        header: 'Progress',
        accessor: 'progress',
        render: (value) => this.renderProgressBar(value as number)
      },
      {
        id: 'dueDate',
        header: 'Due Date',
        accessor: 'dueDate',
        render: (value) => value ? this.formatDate(value as string) : '-'
      }
    ];

    return this.renderTable(filteredProjects, columns, { showCheckboxes: true });
  }

  private renderProjectsGrid(): string {
    const filteredProjects = this.getFilteredProjects();

    if (filteredProjects.length === 0) {
      return '<div class="empty-state"><p>No projects found</p></div>';
    }

    return `
      <div class="projects-cards">
        ${filteredProjects.map((project) => this.renderProjectCard(project)).join('')}
      </div>
    `;
  }

  private renderProjectCard(project: Project): string {
    return `
      <div class="project-card" data-project-id="${project.id}">
        <div class="project-card-header">
          <h4 class="project-name">${this.escapeHtml(project.name)}</h4>
          ${this.renderStatusBadge(project.status)}
        </div>
        <div class="project-card-body">
          ${project.description ? `<p class="project-description">${this.escapeHtml(project.description.substring(0, 100))}...</p>` : ''}
          <div class="project-progress">
            ${this.renderProgressBar(project.progress)}
          </div>
        </div>
        <div class="project-card-footer">
          <span class="project-date">
            ${project.dueDate ? `Due: ${this.formatDate(project.dueDate)}` : 'No due date'}
          </span>
          <button class="btn btn-sm btn-secondary" data-action="view" data-id="${project.id}">
            View Details
          </button>
        </div>
      </div>
    `;
  }

  private getFilteredProjects(): Project[] {
    if (this.currentFilter === 'all') {
      return this.projects;
    }

    if (this.currentFilter === 'active') {
      return this.projects.filter((p) =>
        ['planning', 'in_progress', 'review'].includes(p.status)
      );
    }

    return this.projects.filter((p) => p.status === this.currentFilter);
  }

  private renderStatusBadge(status: string): string {
    const statusClasses: Record<string, string> = {
      planning: 'status-pending',
      in_progress: 'status-active',
      review: 'status-warning',
      completed: 'status-success',
      on_hold: 'status-muted',
      cancelled: 'status-danger'
    };

    const statusLabels: Record<string, string> = {
      planning: 'Planning',
      in_progress: 'In Progress',
      review: 'In Review',
      completed: 'Completed',
      on_hold: 'On Hold',
      cancelled: 'Cancelled'
    };

    return `<span class="status-badge ${statusClasses[status] || ''}">${statusLabels[status] || status}</span>`;
  }

  private renderProgressBar(progress: number): string {
    const percentage = Math.min(100, Math.max(0, progress));
    return `
      <div class="progress-bar-wrapper">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <span class="progress-text">${percentage}%</span>
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
        const projectId = actionBtn.dataset.id;

        if (projectId) {
          switch (action) {
          case 'view':
            this.viewProject(parseInt(projectId, 10));
            break;
          case 'edit':
            this.editProject(parseInt(projectId, 10));
            break;
          }
        }
      }

      // Project card click
      const projectCard = target.closest('.project-card') as HTMLElement;
      if (projectCard && !target.closest('[data-action]')) {
        const projectId = projectCard.dataset.projectId;
        if (projectId) {
          this.viewProject(parseInt(projectId, 10));
        }
      }
    });
  }

  // ============================================
  // PROJECT OPERATIONS
  // ============================================

  private viewProject(projectId: number): void {
    // Navigate to project detail view
    this.notify(`Viewing project #${  projectId}`, 'info');
  }

  private editProject(_projectId: number): void {
    if (!this.capabilities.canEdit) {
      this.notify('You do not have permission to edit projects', 'error');
      return;
    }
    // Open edit modal
    this.notify('Edit feature coming soon', 'info');
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
