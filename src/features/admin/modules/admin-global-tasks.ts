/**
 * ===============================================
 * ADMIN GLOBAL TASKS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-global-tasks.ts
 *
 * Global task management with Kanban and List views.
 * Shows tasks across ALL projects, prioritized by urgency + due date.
 */

import { apiFetch, apiPut } from '../../../utils/api-client';
import { alertSuccess, alertError } from '../../../utils/confirm-dialog';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createKanbanBoard, type KanbanColumn, type KanbanItem } from '../../../components/kanban-board';
import { getStatusDotHTML } from '../../../components/status-badge';
import { createViewToggle } from '../../../components/view-toggle';
import { manageFocusTrap } from '../../../utils/focus-trap';
import type { AdminDashboardContext } from '../admin-types';

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

/**
 * Load global tasks and render the view
 */
export async function loadGlobalTasks(ctx: AdminDashboardContext): Promise<void> {
  moduleContext = ctx;
  await fetchTasks();
  setupViewToggle();
  renderCurrentView();
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
      console.error('[AdminGlobalTasks] Failed to fetch tasks');
    }
  } catch (error) {
    console.error('[AdminGlobalTasks] Error loading tasks:', error);
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
      { value: 'kanban', label: 'Board', title: 'Board view', ariaLabel: 'Board view', iconSvg: BOARD_ICON },
      { value: 'list', label: 'List', title: 'List view', ariaLabel: 'List view', iconSvg: LIST_ICON }
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
    .filter(task => task.status !== 'cancelled')
    .forEach(task => {
      const column = columns.find(c => c.id === task.status);
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
      clientName: task.clientName
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
    clientName?: string;
  };

  const priorityConfig = PRIORITY_CONFIG[meta.priority as keyof typeof PRIORITY_CONFIG];
  const priorityClass = priorityConfig?.class || '';
  const priorityLabel = priorityConfig?.label || meta.priority;

  const isOverdue = meta.dueDate && new Date(meta.dueDate) < new Date();
  const dueDateClass = isOverdue ? 'overdue' : '';

  return `
    <div class="kanban-card-title">${SanitizationUtils.escapeHtml(item.title)}</div>
    <div class="kanban-card-project">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      ${SanitizationUtils.escapeHtml(meta.projectName)}
    </div>
    <div class="task-meta">
      <span class="task-priority ${priorityClass}">${priorityLabel}</span>
      ${meta.dueDate ? `
        <span class="task-due-date ${dueDateClass}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${formatDate(meta.dueDate)}
        </span>
      ` : ''}
    </div>
    ${meta.assignee ? `
      <div class="task-assignee">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        ${SanitizationUtils.escapeHtml(meta.assignee)}
      </div>
    ` : ''}
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
  const activeTasks = currentTasks.filter(t => t.status !== 'cancelled');

  if (activeTasks.length === 0) {
    listContainer.innerHTML = '<div class="task-list-empty">No tasks found across any projects.</div>';
    return;
  }

  listContainer.innerHTML = `
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Project</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody id="global-tasks-table-body">
          ${activeTasks.map(task => renderListItem(task)).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Add click and keyboard handlers for accessibility
  const tableBody = listContainer.querySelector('#global-tasks-table-body');
  if (tableBody) {
    tableBody.querySelectorAll('tr[data-task-id]').forEach(row => {
      const handleRowActivate = (): void => {
        const taskId = parseInt((row as HTMLElement).dataset.taskId || '0');
        const task = currentTasks.find(t => t.id === taskId);
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
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return `
    <tr data-task-id="${task.id}" class="clickable-row" tabindex="0" role="button" aria-label="View task: ${SanitizationUtils.escapeHtml(task.title)}">
      <td>
        <div class="task-list-title">
          <span>${SanitizationUtils.escapeHtml(task.title)}</span>
          ${task.description ? `<small class="text-muted">${SanitizationUtils.escapeHtml(task.description.substring(0, 50))}${task.description.length > 50 ? '...' : ''}</small>` : ''}
        </div>
      </td>
      <td>
        <span class="project-link">${SanitizationUtils.escapeHtml(task.projectName)}</span>
      </td>
      <td><span class="task-priority ${priorityClass}">${priorityLabel}</span></td>
      <td>${getStatusDotHTML(task.status)}</td>
      <td class="${isOverdue ? 'overdue' : ''}">${task.dueDate ? formatDate(task.dueDate) : ''}</td>
      <td>${task.assignedTo ? SanitizationUtils.escapeHtml(task.assignedTo) : ''}</td>
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
  const task = currentTasks.find(t => t.id === taskId);
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
    console.error('[AdminGlobalTasks] Error updating task status:', error);
    alertError('Error updating task');
    await fetchTasks();
    renderCurrentView();
  }
}

/**
 * Handle task click to show detail modal
 */
function handleTaskClick(item: KanbanItem): void {
  const task = currentTasks.find(t => t.id === item.id);
  if (!task) return;

  showTaskDetailModal(task);
}

// Focus trap cleanup reference
let focusTrapCleanup: (() => void) | null = null;

/**
 * Show task detail modal
 */
function showTaskDetailModal(task: GlobalTask): void {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const priorityClass = priorityConfig?.class || '';
  const priorityLabel = priorityConfig?.label || task.priority;
  const statusLabel = STATUS_CONFIG[task.status]?.label || task.status;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  const modalId = 'global-task-detail-modal';
  const titleId = 'global-task-modal-title';

  const overlay = document.createElement('div');
  overlay.className = 'confirm-dialog-overlay';
  overlay.id = modalId;

  overlay.innerHTML = `
    <div class="confirm-dialog task-detail-modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="task-detail-header">
        <h3 class="task-detail-title" id="${titleId}">${SanitizationUtils.escapeHtml(task.title)}</h3>
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

      ${task.description ? `
        <div class="task-detail-section">
          <h4>Description</h4>
          <p>${SanitizationUtils.escapeHtml(task.description)}</p>
        </div>
      ` : ''}

      <div class="task-detail-section">
        <h4>Details</h4>
        <div class="meta-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div><strong>Status:</strong> ${statusLabel}</div>
          <div class="${isOverdue ? 'overdue' : ''}"><strong>Due:</strong> ${task.dueDate ? formatDate(task.dueDate) : ''}</div>
          <div><strong>Assignee:</strong> ${task.assignedTo || ''}</div>
          <div><strong>Est. Hours:</strong> ${task.estimatedHours || ''}</div>
        </div>
      </div>

      <div class="confirm-dialog-actions">
        <button type="button" class="confirm-dialog-btn confirm-dialog-cancel" aria-label="Close modal">Close</button>
        <button type="button" class="confirm-dialog-btn" id="btn-view-project">View Project</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = (): void => {
    // Clean up focus trap
    if (focusTrapCleanup) {
      focusTrapCleanup();
      focusTrapCleanup = null;
    }
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 150);
  };

  // Set up focus trap for accessibility
  const dialogEl = overlay.querySelector('.confirm-dialog') as HTMLElement;
  if (dialogEl) {
    focusTrapCleanup = manageFocusTrap(dialogEl, {
      initialFocus: '.confirm-dialog-cancel',
      onClose: closeModal
    });
  }

  // Event handlers
  overlay.querySelector('.confirm-dialog-cancel')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // View project button
  overlay.querySelector('#btn-view-project')?.addEventListener('click', () => {
    closeModal();
    if (moduleContext) {
      moduleContext.switchTab('project-detail');
      // The project detail tab will need the project ID - dispatch custom event
      window.dispatchEvent(new CustomEvent('admin:view-project', { detail: { projectId: task.projectId } }));
    }
  });

  // Project link click
  overlay.querySelector('.project-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
    if (moduleContext) {
      moduleContext.switchTab('project-detail');
      window.dispatchEvent(new CustomEvent('admin:view-project', { detail: { projectId: task.projectId } }));
    }
  });
}

/**
 * Cleanup module
 */
export function cleanup(): void {
  // Clean up focus trap if active
  if (focusTrapCleanup) {
    focusTrapCleanup();
    focusTrapCleanup = null;
  }
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
}
