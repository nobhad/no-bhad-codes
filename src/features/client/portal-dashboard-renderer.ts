/**
 * ===============================================
 * PORTAL DASHBOARD RENDERER
 * ===============================================
 * @file src/features/client/portal-dashboard-renderer.ts
 *
 * Extracted from client-portal.ts
 * Handles dashboard stats loading, milestone rendering,
 * projects list population, and sidebar badge updates.
 */

import type { ClientProject, ClientProjectStatus, ProjectPriority } from '../../types/client';
import type {
  ProjectResponse,
  ProjectMilestoneResponse
} from '../../types/api';
import { loadNavigationModule, loadApprovalsModule } from './modules';
import { apiFetch, unwrapApiData } from '../../utils/api-client';
import { formatDate } from '../../utils/format-utils';
import { showToast } from '../../utils/toast-notifications';
import { getStatusBadgeHTML } from '../../components/status-badge';
import { renderEmptyState } from '../../components/empty-state';
import { getAccessibleIcon } from '../../constants/icons';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalDashboard');

/** Dependencies injected from the main portal module */
export interface DashboardRendererDeps {
  projectsList: HTMLElement | null;
  escapeHtml: (text: string) => string;
  selectProject: (project: ClientProject) => Promise<void>;
  log: (...args: unknown[]) => void;
}

/**
 * Load real user projects from API (for authenticated users)
 * Fetches projects and milestones from backend instead of using mock data
 */
export async function loadRealUserProjects(
  user: { id: number; email: string; name: string },
  deps: DashboardRendererDeps
): Promise<void> {
  const { projectsList } = deps;

  // Show loading state
  if (projectsList) {
    projectsList.innerHTML =
      '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading projects...</span></div>';
  }

  try {
    // Fetch projects from API
    const projectsResponse = await apiFetch('/api/projects');

    if (!projectsResponse.ok) {
      logger.error('Failed to fetch projects:', projectsResponse.status);
      // Show error state with client name
      const errorClientName = user.name || user.email || 'Client';
      loadNavigationModule().then((nav) => nav.setClientName(errorClientName));
      if (projectsList) {
        projectsList.innerHTML =
          '<div class="error-message"><p>Unable to load projects. Please try again later.</p></div>';
      }
      renderDashboardMilestones([], deps, 'Unable to load milestones right now.');
      return;
    }

    const projectsRaw = await projectsResponse.json();
    const projectsData = unwrapApiData<Record<string, unknown>>(projectsRaw);
    const apiProjects = (projectsData.projects as ProjectResponse[]) || [];

    if (apiProjects.length === 0) {
      // No projects yet - show empty state with client name
      const emptyClientName = user.name || user.email || 'Client';
      loadNavigationModule().then((nav) => nav.setClientName(emptyClientName));
      populateProjectsList([], deps);
      renderDashboardMilestones([], deps);
      return;
    }

    // Transform API projects to ClientProject interface
    // Track milestone fetch failures for user feedback
    let milestoneFetchFailures = 0;

    const clientProjects: ClientProject[] = await Promise.all(
      apiProjects.map(async (apiProject: ProjectResponse) => {
        // Fetch milestones for this project
        let milestones: ProjectMilestoneResponse[] = [];
        try {
          const milestonesResponse = await apiFetch(`/api/projects/${apiProject.id}/milestones`);
          if (milestonesResponse.ok) {
            const milestonesRaw = await milestonesResponse.json();
            const milestonesData = unwrapApiData<{
              milestones?: ProjectMilestoneResponse[];
            }>(milestonesRaw);
            milestones = milestonesData.milestones || [];
          } else {
            milestoneFetchFailures++;
            logger.warn(
              `Failed to fetch milestones for project ${apiProject.id}: ${milestonesResponse.status}`
            );
          }
        } catch (milestoneError) {
          milestoneFetchFailures++;
          logger.warn(
            `Failed to fetch milestones for project ${apiProject.id}:`,
            milestoneError
          );
        }

        // Transform milestone data to match ProjectMilestone interface
        const transformedMilestones = milestones.map((m: ProjectMilestoneResponse) => ({
          id: String(m.id),
          title: m.title || 'Untitled Milestone',
          description: m.description || '',
          dueDate: m.due_date || new Date().toISOString().split('T')[0],
          completedDate: m.completed_date || undefined,
          isCompleted: Boolean(m.is_completed),
          deliverables: Array.isArray(m.deliverables) ? m.deliverables : []
        }));

        // Calculate progress from milestones if available
        const completedMilestones = transformedMilestones.filter((m) => m.isCompleted).length;
        const totalMilestones = transformedMilestones.length;
        const calculatedProgress =
          totalMilestones > 0
            ? Math.round((completedMilestones / totalMilestones) * 100)
            : apiProject.progress || 0;

        // Transform to ClientProject interface
        return {
          id: String(apiProject.id),
          projectName: apiProject.project_name || apiProject.name || 'Untitled Project',
          description: apiProject.description || '',
          clientId: String(apiProject.client_id || user.id),
          clientName: user.name || user.email || 'Client',
          status: (apiProject.status || 'pending') as ClientProjectStatus,
          priority: (apiProject.priority || 'medium') as ProjectPriority,
          progress: calculatedProgress,
          startDate:
            apiProject.start_date ||
            apiProject.created_at?.split('T')[0] ||
            new Date().toISOString().split('T')[0],
          estimatedEndDate: apiProject.estimated_end_date || undefined,
          actualEndDate: apiProject.actual_end_date || undefined,
          updates: [], // Loaded on-demand when project is selected
          files: [], // Loaded on-demand when project is selected
          messages: [], // Loaded on-demand when project is selected
          milestones: transformedMilestones
        } as ClientProject;
      })
    );

    // Show warning toast if any milestone fetches failed
    if (milestoneFetchFailures > 0) {
      showToast(
        'Some milestone data could not be loaded. Progress information may be incomplete.',
        'warning'
      );
    }

    // Set client name in header and page title
    const clientName = user.name || user.email || 'Client';
    loadNavigationModule().then((nav) => nav.setClientName(clientName));

    populateProjectsList(clientProjects, deps);
    renderDashboardMilestones(clientProjects, deps);
  } catch (error) {
    logger.error('Failed to load projects:', error);
    // Show error state with client name
    const clientName = user.name || user.email || 'Client';
    loadNavigationModule().then((nav) => nav.setClientName(clientName));
    if (projectsList) {
      projectsList.innerHTML =
        '<div class="error-message"><p>Unable to load projects. Please try again later.</p></div>';
    }
    renderDashboardMilestones([], deps, 'Unable to load milestones right now.');
  }
}

/**
 * Load dashboard stats and recent activity from API
 */
export async function loadDashboardStats(
  deps: DashboardRendererDeps
): Promise<void> {
  try {
    const response = await apiFetch('/api/clients/me/dashboard');

    if (!response.ok) {
      logger.warn('Failed to load dashboard stats:', response.status);
      // Clear "Loading..." state on API error
      const activityList = document.querySelector('.activity-list');
      if (activityList) {
        activityList.innerHTML = '<li class="activity-item empty">Unable to load activity</li>';
      }
      return;
    }

    const response_raw = await response.json();
    const response_data = unwrapApiData<{
      stats?: {
        activeProjects?: number;
        pendingInvoices?: number;
        unreadMessages?: number;
        pendingDocRequests?: number;
        pendingContracts?: number;
      };
      recentActivity?: Array<{
        type: string;
        title: string;
        context: string;
        date: string;
        entityId?: number;
      }>;
    }>(response_raw);
    const stats = response_data.stats;
    const recentActivity = response_data.recentActivity;

    // Defensive check - if stats is missing, show empty state and return
    if (!stats) {
      logger.warn('Dashboard response missing stats:', response_data);
      // Clear loading states to prevent infinite loading
      const activityList = document.querySelector('.activity-list');
      if (activityList) {
        activityList.innerHTML = '<li class="activity-item empty">No activity data available</li>';
      }
      const milestonesList = document.getElementById('milestones-list');
      if (milestonesList) {
        milestonesList.innerHTML = '';
        const empty = document.getElementById('milestones-empty');
        if (empty) {
          empty.textContent = 'No milestone data available';
          empty.style.display = 'block';
        }
      }
      return;
    }

    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card) => {
      const tabAttr = card.getAttribute('data-tab');
      const numberEl = card.querySelector('.stat-number');
      if (!numberEl) return;

      if (tabAttr === 'dashboard') {
        numberEl.textContent = String(stats.activeProjects || 0);
      } else if (tabAttr === 'invoices') {
        numberEl.textContent = String(stats.pendingInvoices || 0);
      } else if (tabAttr === 'messages') {
        numberEl.textContent = String(stats.unreadMessages || 0);
      }
    });

    // Update recent activity
    const activityList = document.querySelector('.activity-list');
    if (activityList) {
      if (!recentActivity || recentActivity.length === 0) {
        activityList.innerHTML = '<li class="activity-item empty">No recent activity</li>';
      } else {
        activityList.innerHTML = recentActivity
          .map(
            (item: {
              type: string;
              title: string;
              context: string;
              date: string;
              entityId?: number;
            }) => {
              const date = new Date(item.date);
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const year = date.getFullYear();
              const formattedDate = `${month}/${day}/${year}`;
              const icon = getActivityIcon(item.type);
              const safeTitle = deps.escapeHtml(item.title);
              const safeContext = item.context ? deps.escapeHtml(item.context) : '';
              return `
              <li class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                  <span class="activity-title">${safeTitle}</span>
                  ${safeContext ? `<span class="activity-client">${safeContext}</span>` : ''}
                </div>
                <span class="activity-time">${formattedDate}</span>
              </li>
            `;
            }
          )
          .join('');
      }
    }

    // Update sidebar badges
    updateSidebarBadges(
      stats.unreadMessages || 0,
      stats.pendingInvoices || 0,
      stats.pendingDocRequests || 0,
      stats.pendingContracts || 0
    );

    // Load pending approvals for dashboard
    try {
      const approvalsModule = await loadApprovalsModule();
      await approvalsModule.initClientApprovals();
    } catch (approvalError) {
      logger.warn('Error loading approvals:', approvalError);
    }

    deps.log('[ClientPortal] Dashboard stats loaded');
  } catch (error) {
    logger.error('Error loading dashboard stats:', error);
    // Clear "Loading..." state on error
    const activityList = document.querySelector('.activity-list');
    if (activityList) {
      activityList.innerHTML = '<li class="activity-item empty">Unable to load activity</li>';
    }
  }
}

/**
 * Render dashboard milestones section
 */
export function renderDashboardMilestones(
  projects: ClientProject[],
  deps: DashboardRendererDeps,
  errorMessage?: string
): void {
  const list = document.getElementById('milestones-list');
  const empty = document.getElementById('milestones-empty');
  const summary = document.getElementById('milestones-summary');
  if (!list) return;

  if (errorMessage) {
    list.innerHTML = '';
    if (summary) summary.textContent = '';
    if (empty) {
      empty.textContent = errorMessage;
      empty.style.display = 'block';
    }
    return;
  }

  const milestones = projects.flatMap((project) =>
    (project.milestones || []).map((milestone) => ({
      ...milestone,
      projectName: project.projectName
    }))
  );

  const total = milestones.length;
  const completed = milestones.filter((milestone) => milestone.isCompleted).length;

  if (summary) {
    summary.textContent = total > 0 ? `${completed}/${total} complete` : '';
  }

  if (total === 0) {
    list.innerHTML = '';
    if (empty) {
      empty.textContent = 'No milestones yet.';
      empty.style.display = 'block';
    }
    return;
  }

  if (empty) {
    empty.style.display = 'none';
  }

  const getSortTime = (date?: string): number => {
    if (!date) return Number.POSITIVE_INFINITY;
    const time = Date.parse(date);
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };

  milestones.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return getSortTime(a.dueDate) - getSortTime(b.dueDate);
  });

  list.innerHTML = '';

  // Track if we've found the first non-completed milestone (it should be "In Progress")
  let foundFirstActive = false;

  milestones.forEach((milestone) => {
    const item = document.createElement('div');
    const safeTitle = deps.escapeHtml(milestone.title || 'Milestone');
    const safeDescription = deps.escapeHtml(milestone.description || '');

    // Determine status: Completed, In Progress (first non-completed), or Upcoming (rest)
    let statusLabel: string;
    let statusClass: string;
    if (milestone.isCompleted) {
      statusLabel = 'Completed';
      statusClass = 'completed';
    } else if (!foundFirstActive) {
      // First non-completed milestone is always "In Progress"
      statusLabel = 'In Progress';
      statusClass = 'in-progress';
      foundFirstActive = true;
    } else {
      // All other non-completed milestones are "Upcoming"
      statusLabel = 'Upcoming';
      statusClass = 'upcoming';
    }

    const dueLabel = milestone.isCompleted
      ? `Completed ${milestone.completedDate ? formatDate(milestone.completedDate) : 'Date TBD'}`
      : milestone.dueDate
        ? `Due ${formatDate(milestone.dueDate)}`
        : 'Due date TBD';

    const deliverables = Array.isArray(milestone.deliverables) ? milestone.deliverables : [];
    const deliverablesMarkup =
      deliverables.length > 0
        ? `<ul class="milestone-deliverables">${deliverables
          .map((deliverableItem) => `<li>${deps.escapeHtml(String(deliverableItem))}</li>`)
          .join('')}</ul>`
        : '';

    item.className = `milestone-item${milestone.isCompleted ? ' completed' : ''}`;
    item.innerHTML = `
        <label class="milestone-checkbox" aria-label="${statusLabel}">
          <input type="checkbox" ${milestone.isCompleted ? 'checked' : ''} disabled />
        </label>
        <div class="milestone-content">
          <div class="milestone-header">
            <h4 class="milestone-title">${safeTitle}</h4>
            <span class="milestone-status">${getStatusBadgeHTML(statusLabel, statusClass)}</span>
          </div>
          ${safeDescription ? `<p class="milestone-description">${safeDescription}</p>` : ''}
          ${deliverablesMarkup}
          <div class="milestone-footer">
            <span class="milestone-due-date">${dueLabel}</span>
          </div>
        </div>
      `;

    list.appendChild(item);
  });
}

/**
 * Get icon for activity type
 */
function getActivityIcon(type: string): string {
  switch (type) {
  case 'project_update':
    return getAccessibleIcon('CLIPBOARD', 'Project update', { width: 16, height: 16 });
  case 'message':
    return getAccessibleIcon('MAIL', 'Message', { width: 16, height: 16 });
  case 'invoice':
    return getAccessibleIcon('FILE_TEXT', 'Invoice', { width: 16, height: 16 });
  case 'file':
    return getAccessibleIcon('FILE', 'File', { width: 16, height: 16 });
  case 'document_request':
    return getAccessibleIcon('DOCUMENT', 'Document request', { width: 16, height: 16 });
  case 'contract':
    return getAccessibleIcon('PENCIL', 'Contract', { width: 16, height: 16 });
  default:
    return getAccessibleIcon('CHECK', 'Activity', { width: 16, height: 16 });
  }
}

/**
 * Update sidebar notification badges.
 * Badges only show when count > 0; hidden otherwise.
 */
export function updateSidebarBadges(
  unreadMessages: number,
  pendingInvoices: number,
  pendingDocRequests: number = 0,
  pendingContracts: number = 0
): void {
  const setBadge = (id: string, count: number, label: string): void => {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.textContent = count > 99 ? '99+' : String(count);
      el.classList.add('has-count');
      el.setAttribute('aria-label', `${count} ${label}`);
    } else {
      el.textContent = '';
      el.classList.remove('has-count');
      el.setAttribute('aria-label', label);
    }
  };

  setBadge('badge-messages', unreadMessages, 'unread messages');
  setBadge('badge-invoices', pendingInvoices, 'pending invoices');
  setBadge('badge-documents', pendingDocRequests + pendingContracts, 'pending document requests');

  // No server counts for these yet -- ensure they stay hidden
  setBadge('badge-projects', 0, 'projects');
  setBadge('badge-requests', 0, 'requests');
  setBadge('badge-questionnaires', 0, 'questionnaires');
  setBadge('badge-approvals', 0, 'approvals');
}

/**
 * Populate the projects list in the sidebar
 */
export function populateProjectsList(
  projects: ClientProject[],
  deps: DashboardRendererDeps
): void {
  const { projectsList } = deps;
  if (!projectsList) return;

  if (projects.length === 0) {
    renderEmptyState(
      projectsList,
      'No projects yet. Submit a project request to get started!',
      { className: 'no-projects' }
    );
    return;
  }

  projectsList.innerHTML = '';

  projects.forEach((project) => {
    const projectItem = document.createElement('div');
    projectItem.className = 'project-item';
    projectItem.dataset.projectId = project.id;

    projectItem.innerHTML = `
        <span class="project-icon">📄</span>
        <span class="project-name">${project.projectName}</span>
      `;

    projectItem.addEventListener('click', () => {
      deps.selectProject(project);
      document
        .querySelectorAll('.project-item')
        .forEach((item) => item.classList.remove('active'));
      projectItem.classList.add('active');
    });

    projectsList.appendChild(projectItem);
  });
}
