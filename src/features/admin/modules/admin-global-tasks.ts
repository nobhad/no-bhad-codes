/**
 * ===============================================
 * ADMIN GLOBAL TASKS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-global-tasks.ts
 *
 * Global task management with Kanban and List views.
 * Shows tasks across ALL projects, prioritized by urgency + due date.
 */

import { apiFetch, apiPut, apiDelete } from '../../../utils/api-client';
import { alertSuccess, alertError, confirmDanger } from '../../../utils/confirm-dialog';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import {
  createKanbanBoard,
  type KanbanColumn,
  type KanbanItem
} from '../../../components/kanban-board';
import { getStatusDotHTML } from '../../../components/status-badge';
import { createViewToggle } from '../../../components/view-toggle';
import { createPortalModal } from '../../../components/portal-modal';
import { ICONS } from '../../../constants/icons';
import { renderActionsCell, createAction } from '../../../factories';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import type { AdminDashboardContext } from '../admin-types';
import {
  type PaginationState,
  getDefaultPaginationState,
  loadPaginationState,
  applyPagination,
  createPaginationUI
} from '../../../utils/table-pagination';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('AdminGlobalTasks');

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn =
  typeof import('../../../react/features/admin/global-tasks').mountGlobalTasksTable;
type ReactUnmountFn =
  typeof import('../../../react/features/admin/global-tasks').unmountGlobalTasksTable;

let mountGlobalTasksTable: ReactMountFn | null = null;
let unmountGlobalTasksTable: ReactUnmountFn | null = null;
let reactTableMounted = false;
let reactMountContainer: HTMLElement | null = null;

/**
 * Check if React table is actually mounted (container exists and has content)
 */
function isReactTableActuallyMounted(): boolean {
  if (!reactTableMounted) return false;
  // Check if the container still exists in the DOM and has content
  if (
    !reactMountContainer ||
    !reactMountContainer.isConnected ||
    reactMountContainer.children.length === 0
  ) {
    reactTableMounted = false;
    reactMountContainer = null;
    return false;
  }
  return true;
}

/** Lazy load React mount functions */
async function loadReactGlobalTasksTable(): Promise<boolean> {
  if (mountGlobalTasksTable && unmountGlobalTasksTable) return true;

  try {
    const module = await import('../../../react/features/admin/global-tasks');
    mountGlobalTasksTable = module.mountGlobalTasksTable;
    unmountGlobalTasksTable = module.unmountGlobalTasksTable;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

/** Feature flag for React global tasks table */
function shouldUseReactGlobalTasksTable(): boolean {
  return true;
}

// View toggle icons
const BOARD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="9" y="8" width="6" height="13" rx="1"/><rect x="15" y="5" width="6" height="16" rx="1"/></svg>';
const LIST_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

// Task interface matching backend response
interface GlobalTask {
  id: number;
  projectId: number;
  projectName: string;
  clientName?: string;
  milestoneTitle?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  updatedAt: string;
}

// Module state
let currentTasks: GlobalTask[] = [];
let currentView: 'kanban' | 'list' = 'kanban';
let kanbanBoard: ReturnType<typeof createKanbanBoard> | null = null;
let moduleContext: AdminDashboardContext | null = null;

// Pagination state - only show when > 10 items
const PAGINATION_THRESHOLD = 10;
const PAGINATION_STORAGE_KEY = 'global-tasks-pagination';
let paginationState: PaginationState = getDefaultPaginationState({
  tableId: 'global-tasks',
  defaultPageSize: 25
});

// Status configuration - all colors use CSS variables
const STATUS_CONFIG = {
  pending: { label: 'To Do', color: 'var(--portal-text-secondary)' },
  in_progress: { label: 'In Progress', color: 'var(--app-color-primary)' },
  blocked: { label: 'Blocked', color: 'var(--status-on-hold)' },
  completed: { label: 'Done', color: 'var(--status-active)' },
  cancelled: { label: 'Cancelled', color: 'var(--status-cancelled)' }
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', class: 'task-priority-low', color: 'var(--color-neutral-500)' },
  medium: { label: 'Medium', class: 'task-priority-medium', color: 'var(--app-color-primary)' },
  high: { label: 'High', class: 'task-priority-high', color: 'var(--status-on-hold)' },
  urgent: { label: 'Urgent', class: 'task-priority-urgent', color: 'var(--status-cancelled)' }
};

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  REFRESH:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
};

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

// Stat card icons
const STAT_ICONS = {
  TODO: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
  IN_PROGRESS:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>',
  BLOCKED:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
  DONE: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
};

/**
 * Renders the Global Tasks tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderGlobalTasksTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactGlobalTasksTable();

  if (useReact) {
    // React implementation - render minimal container
    container.innerHTML = `
      <!-- React Global Tasks Table Mount Point -->
      <div id="react-global-tasks-mount"></div>
    `;
    return;
  }

  // Vanilla implementation - original HTML
  container.innerHTML = `
    <!-- Task Stats Strip -->
    <div class="tasks-stats-strip" aria-label="Task statistics">
      <div class="tasks-stat-card">
        <div class="stat-card-top">
          <span class="field-label">To Do</span>
          <span class="stat-card-icon stat-icon-muted" aria-hidden="true">${STAT_ICONS.TODO}</span>
        </div>
        <span class="stat-card-value" id="stat-tasks-todo">-</span>
      </div>
      <div class="tasks-stat-card">
        <div class="stat-card-top">
          <span class="field-label">In Progress</span>
          <span class="stat-card-icon stat-icon-blue" aria-hidden="true">${STAT_ICONS.IN_PROGRESS}</span>
        </div>
        <span class="stat-card-value" id="stat-tasks-in-progress">-</span>
      </div>
      <div class="tasks-stat-card tasks-stat-card--alert">
        <div class="stat-card-top">
          <span class="field-label">Blocked</span>
          <span class="stat-card-icon stat-icon-warning" aria-hidden="true">${STAT_ICONS.BLOCKED}</span>
        </div>
        <span class="stat-card-value" id="stat-tasks-blocked">-</span>
      </div>
      <div class="tasks-stat-card">
        <div class="stat-card-top">
          <span class="field-label">Done</span>
          <span class="stat-card-icon stat-icon-green" aria-hidden="true">${STAT_ICONS.DONE}</span>
        </div>
        <span class="stat-card-value" id="stat-tasks-done">-</span>
      </div>
    </div>

    <div class="data-table-card tasks-main-container" id="global-tasks-card">
      <div class="data-table-header">
        <h3>All Tasks</h3>
        <div class="data-table-actions">
          <div id="global-tasks-view-toggle-mount"></div>
          <button class="icon-btn" id="refresh-global-tasks-btn" title="Refresh" aria-label="Refresh tasks">
            ${RENDER_ICONS.REFRESH}
          </button>
        </div>
      </div>
      <div id="global-tasks-kanban-container"></div>
      <div id="global-tasks-list-container" style="display: none;"></div>
    </div>
  `;

  // Reset view state
  currentView = 'kanban';
  kanbanBoard = null;
}

/**
 * Update task stat cards with current counts
 */
function updateTaskStats(): void {
  const counts = {
    pending: currentTasks.filter((t) => t.status === 'pending').length,
    in_progress: currentTasks.filter((t) => t.status === 'in_progress').length,
    blocked: currentTasks.filter((t) => t.status === 'blocked').length,
    completed: currentTasks.filter((t) => t.status === 'completed').length
  };

  const todoEl = document.getElementById('stat-tasks-todo');
  const inProgressEl = document.getElementById('stat-tasks-in-progress');
  const blockedEl = document.getElementById('stat-tasks-blocked');
  const doneEl = document.getElementById('stat-tasks-done');

  if (todoEl) todoEl.textContent = String(counts.pending);
  if (inProgressEl) inProgressEl.textContent = String(counts.in_progress);
  if (blockedEl) blockedEl.textContent = String(counts.blocked);
  if (doneEl) doneEl.textContent = String(counts.completed);

  // Highlight blocked card if there are blocked tasks
  const blockedCard = blockedEl?.closest('.tasks-stat-card');
  if (blockedCard) {
    if (counts.blocked > 0) {
      blockedCard.classList.add('has-items');
    } else {
      blockedCard.classList.remove('has-items');
    }
  }
}

/**
 * Cleanup function called when leaving the global tasks tab
 * Unmounts React components if they were mounted
 */
export function cleanupGlobalTasksTab(): void {
  if (reactTableMounted && unmountGlobalTasksTable) {
    unmountGlobalTasksTable();
    reactTableMounted = false;
  }
}

/**
 * Load global tasks and render the view
 */
export async function loadGlobalTasks(ctx: AdminDashboardContext): Promise<void> {
  moduleContext = ctx;

  // Check if React implementation should be used
  const useReact = shouldUseReactGlobalTasksTable();
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React GlobalTasksTable
    const mountContainer = document.getElementById('react-global-tasks-mount');
    if (mountContainer) {
      const loaded = await loadReactGlobalTasksTable();
      if (loaded && mountGlobalTasksTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountGlobalTasksTable) {
          unmountGlobalTasksTable();
        }
        mountGlobalTasksTable(mountContainer, {
          onNavigate: (tab: string, entityId?: string) => {
            if (entityId) {
              ctx.switchTab(tab);
            } else {
              ctx.switchTab(tab);
            }
          }
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        reactMountSuccess = true;
      } else {
        logger.error(' React module failed to load, falling back to vanilla');
      }
    }

    if (reactMountSuccess) {
      return;
    }
    // Fall through to vanilla implementation if React failed
  }

  // Vanilla implementation
  await fetchTasks();
  updateTaskStats();
  setupViewToggle();
  renderCurrentView();
  setupRefreshHandler();
  openTaskFromUrl();
}

function openTaskFromUrl(): void {
  const params = new URLSearchParams(window.location.search);
  const taskIdParam = params.get('taskId');
  if (!taskIdParam) return;

  const taskId = Number(taskIdParam);
  if (Number.isNaN(taskId)) return;

  const task = currentTasks.find((t) => t.id === taskId);
  if (task) {
    handleTaskClick(taskToKanbanItem(task));
    const url = new URL(window.location.href);
    url.searchParams.delete('taskId');
    window.history.replaceState({}, '', url.toString());
  }
}

/**
 * Fetch tasks from API
 */
async function fetchTasks(): Promise<void> {
  try {
    const response = await apiFetch('/api/admin/tasks');
    if (response.ok) {
      const data = await response.json();
      currentTasks = (data.tasks || []).map(mapTaskFromApi);
    } else {
      currentTasks = [];
      logger.error(' Failed to fetch tasks');
    }
  } catch (error) {
    logger.error(' Error loading tasks:', error);
    currentTasks = [];
  }
}

/**
 * Map API response to internal format
 */
function mapTaskFromApi(task: Record<string, unknown>): GlobalTask {
  return {
    id: task.id as number,
    projectId: task.projectId as number,
    projectName: task.projectName as string,
    clientName: task.clientName as string | undefined,
    milestoneTitle: task.milestoneTitle as string | undefined,
    title: task.title as string,
    description: task.description as string | undefined,
    status: task.status as GlobalTask['status'],
    priority: task.priority as GlobalTask['priority'],
    assignedTo: task.assignedTo as string | undefined,
    dueDate: task.dueDate as string | undefined,
    estimatedHours: task.estimatedHours as number | undefined,
    actualHours: task.actualHours as number | undefined,
    createdAt: task.createdAt as string,
    updatedAt: task.updatedAt as string
  };
}

/**
 * Set up view toggle (Kanban / List)
 */
function setupViewToggle(): void {
  const mount = document.getElementById('global-tasks-view-toggle-mount');
  if (!mount) return;

  // Clear existing toggle
  mount.innerHTML = '';

  const toggleEl = createViewToggle({
    id: 'global-tasks-view-toggle',
    options: [
      {
        value: 'kanban',
        label: 'Board',
        title: 'Board view',
        ariaLabel: 'Board view',
        iconSvg: BOARD_ICON
      },
      {
        value: 'list',
        label: 'List',
        title: 'List view',
        ariaLabel: 'List view',
        iconSvg: LIST_ICON
      }
    ],
    value: currentView,
    onChange: (v) => {
      currentView = v as 'kanban' | 'list';
      renderCurrentView();
    }
  });
  mount.appendChild(toggleEl);
}

/**
 * Render current view (kanban or list)
 */
function renderCurrentView(): void {
  if (currentView === 'kanban') {
    renderKanbanView();
  } else {
    renderListView();
  }
}

function setupRefreshHandler(): void {
  const refreshBtn = document.getElementById('refresh-global-tasks-btn');
  if (!refreshBtn || refreshBtn.dataset.listenerAttached === 'true') return;
  refreshBtn.dataset.listenerAttached = 'true';
  refreshBtn.addEventListener('click', async () => {
    await fetchTasks();
    updateTaskStats();
    renderCurrentView();
  });
}

/**
 * Render Kanban view
 */
function renderKanbanView(): void {
  // Destroy existing board
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }

  // Hide list, show kanban
  const listContainer = document.getElementById('global-tasks-list-container');
  const kanbanContainer = document.getElementById('global-tasks-kanban-container');
  if (listContainer) listContainer.style.display = 'none';
  if (kanbanContainer) kanbanContainer.style.display = 'block';

  // Build columns from tasks (exclude cancelled)
  const columns: KanbanColumn[] = [
    { id: 'pending', title: 'To Do', color: STATUS_CONFIG.pending.color, items: [] },
    { id: 'in_progress', title: 'In Progress', color: STATUS_CONFIG.in_progress.color, items: [] },
    { id: 'blocked', title: 'Blocked', color: STATUS_CONFIG.blocked.color, items: [] },
    { id: 'completed', title: 'Done', color: STATUS_CONFIG.completed.color, items: [] }
  ];

  // Populate columns
  currentTasks
    .filter((task) => task.status !== 'cancelled')
    .forEach((task) => {
      const column = columns.find((c) => c.id === task.status);
      if (column) {
        column.items.push(taskToKanbanItem(task));
      }
    });

  // Create kanban board
  kanbanBoard = createKanbanBoard({
    containerId: 'global-tasks-kanban-container',
    columns,
    onItemMove: handleTaskStatusChange,
    onItemClick: handleTaskClick,
    renderItem: renderTaskCard,
    emptyColumnText: 'No tasks'
  });
}

/**
 * Convert task to kanban item
 */
function taskToKanbanItem(task: GlobalTask): KanbanItem {
  return {
    id: task.id,
    title: task.title,
    subtitle: task.projectName,
    metadata: {
      task,
      priority: task.priority,
      dueDate: task.dueDate,
      assignee: task.assignedTo,
      projectId: task.projectId,
      projectName: task.projectName,
      clientName: task.clientName,
      milestoneTitle: task.milestoneTitle
    }
  };
}

/**
 * Custom render for task cards in Kanban
 */
function renderTaskCard(item: KanbanItem): string {
  const meta = item.metadata as {
    task: GlobalTask;
    priority: string;
    dueDate?: string;
    assignee?: string;
    projectName: string;
    projectId: number;
    clientName?: string;
    milestoneTitle?: string;
  };

  const priorityConfig = PRIORITY_CONFIG[meta.priority as keyof typeof PRIORITY_CONFIG];
  const priorityClass = priorityConfig?.class || '';
  const priorityLabel = priorityConfig?.label || meta.priority;

  const isOverdue = meta.dueDate && new Date(meta.dueDate) < new Date();
  const dueDateClass = isOverdue ? 'overdue' : '';

  return `
    ${
  meta.projectName && meta.projectId
    ? `
      <div class="task-project-link">
        <button type="button" class="task-project-name" data-action="view-project" data-project-id="${meta.projectId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          ${SanitizationUtils.escapeHtml(meta.projectName)}
        </button>
      </div>
    `
    : ''
}
    <div class="kanban-card-title">${SanitizationUtils.escapeHtml(item.title)}</div>
    ${
  meta.milestoneTitle
    ? `
      <div class="task-milestone-tag">${SanitizationUtils.escapeHtml(meta.milestoneTitle)}</div>
    `
    : `
      <div class="task-standalone-tag">Standalone</div>
    `
}
    <div class="task-meta">
      <span class="task-priority ${priorityClass}">${priorityLabel}</span>
      ${
  meta.dueDate
    ? `
        <span class="task-due-date ${dueDateClass}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${formatDate(meta.dueDate)}
        </span>
      `
    : ''
}
    </div>
    <div class="task-card-actions">
      <button type="button" class="task-delete-btn" data-action="delete-task" data-task-id="${item.id}" title="Delete task">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `;
}

/**
 * Render List view
 */
function renderListView(): void {
  // Destroy kanban if exists
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }

  // Show list, hide kanban
  const listContainer = document.getElementById('global-tasks-list-container');
  const kanbanContainer = document.getElementById('global-tasks-kanban-container');
  if (kanbanContainer) kanbanContainer.style.display = 'none';
  if (!listContainer) return;
  listContainer.style.display = 'block';

  // Filter out cancelled tasks
  const activeTasks = currentTasks.filter((t) => t.status !== 'cancelled');

  if (activeTasks.length === 0) {
    listContainer.innerHTML = `
      <div class="data-table-container">
        <div class="empty-state">No tasks found across any projects.</div>
      </div>
    `;
    return;
  }

  // Check if pagination is needed (> 10 items)
  const showPagination = activeTasks.length > PAGINATION_THRESHOLD;

  // Load saved page size if needed
  if (showPagination) {
    const savedState = loadPaginationState(PAGINATION_STORAGE_KEY);
    if (savedState.pageSize) {
      paginationState.pageSize = savedState.pageSize;
    }
    paginationState.totalItems = activeTasks.length;
    // Ensure current page is valid
    const totalPages = Math.ceil(activeTasks.length / paginationState.pageSize) || 1;
    if (paginationState.currentPage > totalPages) {
      paginationState.currentPage = 1;
    }
  }

  // Apply pagination if needed
  const displayTasks = showPagination ? applyPagination(activeTasks, paginationState) : activeTasks;

  listContainer.innerHTML = `
    <div class="data-table-container">
      <div class="data-table-scroll-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col" class="identity-col">Task</th>
              <th scope="col" class="name-col">Project</th>
              <th scope="col" class="name-col">Milestone</th>
              <th scope="col" class="type-col">Priority</th>
              <th scope="col" class="status-col">Status</th>
              <th scope="col" class="date-col">Due Date</th>
              <th scope="col" class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="global-tasks-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
            ${displayTasks.map((task) => renderListItem(task)).join('')}
          </tbody>
        </table>
      </div>
      ${showPagination ? '<div class="table-pagination" id="global-tasks-pagination"></div>' : ''}
    </div>
  `;

  // Create pagination UI if needed
  if (showPagination) {
    const paginationContainer = listContainer.querySelector('#global-tasks-pagination');
    if (paginationContainer) {
      const paginationUI = createPaginationUI(
        { tableId: 'global-tasks', storageKey: PAGINATION_STORAGE_KEY },
        paginationState,
        (newState) => {
          paginationState = newState;
          renderListView();
        }
      );
      paginationContainer.appendChild(paginationUI);
    }
  }

  // Add click and keyboard handlers for accessibility
  const tableBody = listContainer.querySelector('#global-tasks-table-body');
  if (tableBody) {
    tableBody.querySelectorAll('tr[data-task-id]').forEach((row) => {
      const handleRowActivate = (): void => {
        const taskId = parseInt((row as HTMLElement).dataset.taskId || '0');
        const task = currentTasks.find((t) => t.id === taskId);
        if (task) handleTaskClick(taskToKanbanItem(task));
      };

      row.addEventListener('click', handleRowActivate);
      row.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          handleRowActivate();
        }
      });
    });

    // Initialize keyboard navigation (J/K to move between rows)
    initTableKeyboardNav({
      tableSelector: '#global-tasks-table-body',
      rowSelector: 'tr[data-task-id]',
      onRowSelect: (row) => {
        const taskId = parseInt(row.dataset.taskId || '0');
        const task = currentTasks.find((t) => t.id === taskId);
        if (task) handleTaskClick(taskToKanbanItem(task));
      },
      focusClass: 'row-focused',
      selectedClass: 'row-selected'
    });
  }
}

/**
 * Render a list item row
 */
function renderListItem(task: GlobalTask): string {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const priorityClass = priorityConfig?.class || '';
  const priorityLabel = priorityConfig?.label || task.priority;
  const _statusLabel = STATUS_CONFIG[task.status]?.label || task.status;
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return `
    <tr data-task-id="${task.id}" class="clickable-row" tabindex="0" role="button" aria-label="View task: ${SanitizationUtils.escapeHtml(task.title)}">
      <td class="identity-cell" data-label="Task">
        <span class="identity-name" data-field="primary-name">${SanitizationUtils.escapeHtml(task.title)}</span>
        ${task.description ? `<span class="identity-contact" data-field="secondary-name">${SanitizationUtils.escapeHtml(task.description.substring(0, 50))}${task.description.length > 50 ? '...' : ''}</span>` : '<span class="identity-contact hidden" data-field="secondary-name"></span>'}
      </td>
      <td class="name-cell" data-label="Project">
        <button type="button" class="project-link-btn" data-action="view-project" data-project-id="${task.projectId}" title="View project">
          ${SanitizationUtils.escapeHtml(task.projectName)}
        </button>
      </td>
      <td class="name-cell" data-label="Milestone">
        ${
  task.milestoneTitle
    ? `
          <span class="task-milestone-tag">${SanitizationUtils.escapeHtml(task.milestoneTitle)}</span>
        `
    : `
          <span class="task-standalone-tag">Standalone</span>
        `
}
      </td>
      <td class="type-cell" data-label="Priority"><span class="task-priority ${priorityClass}">${priorityLabel}</span></td>
      <td class="status-cell" data-label="Status">${getStatusDotHTML(task.status)}</td>
      <td class="date-cell ${isOverdue ? 'overdue' : ''}" data-label="Due Date">${task.dueDate ? formatDate(task.dueDate) : ''}</td>
      <td class="actions-cell" data-label="Actions">
        ${renderActionsCell([
    createAction('delete', task.id, {
      dataAttrs: { 'task-id': task.id },
      title: 'Delete task'
    })
  ])}
      </td>
    </tr>
  `;
}

/**
 * Handle task status change (from Kanban drag)
 */
async function handleTaskStatusChange(
  itemId: string | number,
  _fromColumn: string,
  toColumn: string
): Promise<void> {
  const taskId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
  const task = currentTasks.find((t) => t.id === taskId);
  if (!task) return;

  try {
    const response = await apiPut(`/api/projects/${task.projectId}/tasks/${taskId}`, {
      status: toColumn
    });

    if (response.ok) {
      // Update local state
      task.status = toColumn as GlobalTask['status'];
      alertSuccess('Task status updated');
    } else {
      alertError('Failed to update task status');
      // Refresh to restore state
      await fetchTasks();
      renderCurrentView();
    }
  } catch (error) {
    logger.error(' Error updating task status:', error);
    alertError('Error updating task');
    await fetchTasks();
    renderCurrentView();
  }
}

/**
 * Handle task click to show detail modal
 */
function handleTaskClick(item: KanbanItem): void {
  const task = currentTasks.find((t) => t.id === item.id);
  if (!task) return;

  showTaskDetailModal(task);
}

/**
 * Show task detail modal
 */
function showTaskDetailModal(task: GlobalTask): void {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const priorityClass = priorityConfig?.class || '';
  const priorityLabel = priorityConfig?.label || task.priority;
  const statusLabel = STATUS_CONFIG[task.status]?.label || task.status;
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  // Create modal using portal modal component
  const modal = createPortalModal({
    id: 'global-task-detail-modal',
    titleId: 'global-task-modal-title',
    title: task.title,
    icon: ICONS.CHECK_SQUARE,
    contentClassName: 'task-detail-modal-content',
    onClose: () => modal.hide()
  });

  // Build body content
  modal.body.innerHTML = `
    <div class="task-detail-header-meta">
      <span class="task-priority ${priorityClass}">${priorityLabel}</span>
    </div>

    <div class="task-detail-section">
      <h4>Project</h4>
      <p>
        <a href="#" class="project-link" data-project-id="${task.projectId}">
          ${SanitizationUtils.escapeHtml(task.projectName)}
        </a>
        ${task.clientName ? `<span class="text-muted"> - ${SanitizationUtils.escapeHtml(task.clientName)}</span>` : ''}
      </p>
    </div>

    ${
  task.description
    ? `
      <div class="task-detail-section">
        <h4>Description</h4>
        <p>${SanitizationUtils.escapeHtml(task.description)}</p>
      </div>
    `
    : ''
}

    <div class="task-detail-section">
      <h4>Details</h4>
      <div class="meta-grid meta-grid--2col meta-grid--gap-xs">
        <div><strong>Status:</strong> ${statusLabel}</div>
        <div class="${isOverdue ? 'overdue' : ''}"><strong>Due:</strong> ${task.dueDate ? formatDate(task.dueDate) : ''}</div>
        <div><strong>Est. Hours:</strong> ${task.estimatedHours || ''}</div>
      </div>
    </div>
  `;

  // Build footer with action buttons
  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close-task">Close</button>
    <button type="button" class="btn btn-secondary" id="btn-view-project">View Project</button>
  `;

  // Append to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();

  // Event handlers
  modal.footer.querySelector('#btn-close-task')?.addEventListener('click', () => modal.hide());

  // View project button
  modal.footer.querySelector('#btn-view-project')?.addEventListener('click', () => {
    modal.hide();
    if (moduleContext) {
      moduleContext.switchTab('project-detail');
      // The project detail tab will need the project ID - dispatch custom event
      window.dispatchEvent(
        new CustomEvent('admin:view-project', { detail: { projectId: task.projectId } })
      );
    }
  });

  // Project link click
  modal.body.querySelector('.project-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    modal.hide();
    if (moduleContext) {
      moduleContext.switchTab('project-detail');
      window.dispatchEvent(
        new CustomEvent('admin:view-project', { detail: { projectId: task.projectId } })
      );
    }
  });

  // Close on Escape key
  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      modal.hide();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Delete a task
 */
async function deleteTask(taskId: number): Promise<void> {
  const confirmed = await confirmDanger(
    'Are you sure you want to delete this task? This action cannot be undone.',
    'Delete Task'
  );

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/projects/tasks/${taskId}`);

    if (response.ok) {
      alertSuccess('Task deleted');
      await fetchTasks();
      renderCurrentView();
    } else {
      alertError('Failed to delete task');
    }
  } catch (error) {
    logger.error(' Error deleting task:', error);
    alertError('Error deleting task');
  }
}

/**
 * Cleanup module
 */
export function cleanup(): void {
  // Remove any open modals
  const modal = document.getElementById('global-task-detail-modal');
  if (modal) modal.remove();
  // Clean up kanban board
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }
  currentTasks = [];
  moduleContext = null;
  // Reset pagination to first page
  paginationState.currentPage = 1;
}

/**
 * Export deleteTask for global access
 */
export { deleteTask };

/**
 * Expose module on window for onclick handlers
 */
declare global {
  interface Window {
    adminGlobalTasks?: {
      deleteTask: (taskId: number) => Promise<void>;
    };
  }
}

// Initialize global exposure
if (typeof window !== 'undefined') {
  window.adminGlobalTasks = {
    deleteTask
  };

  // Event delegation for task actions
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const actionBtn = target.closest('[data-action]') as HTMLElement | null;
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;

    if (action === 'view-project') {
      e.stopPropagation();
      const projectId = parseInt(actionBtn.dataset.projectId || '0');
      if (projectId && window.adminDashboard?.showProjectDetails) {
        window.adminDashboard.showProjectDetails(projectId);
      }
    }

    if (action === 'delete-task') {
      e.stopPropagation();
      const taskId = parseInt(actionBtn.dataset.taskId || '0');
      if (taskId) {
        deleteTask(taskId);
      }
    }
  });
}
