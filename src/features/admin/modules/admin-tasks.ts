/**
 * ===============================================
 * ADMIN TASKS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-tasks.ts
 *
 * Task management for projects with Kanban and List views.
 */

import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { confirmDanger, alertSuccess, alertError, multiPromptDialog } from '../../../utils/confirm-dialog';
import { formatDate } from '../../../utils/format-utils';
import { createPortalModal } from '../../../components/portal-modal';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createKanbanBoard, type KanbanColumn, type KanbanItem } from '../../../components/kanban-board';
import { getStatusDotHTML } from '../../../components/status-badge';
import { createViewToggle } from '../../../components/view-toggle';
import { createModalDropdown } from '../../../components/modal-dropdown';

// View toggle icons
const BOARD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="9" y="8" width="6" height="13" rx="1"/><rect x="15" y="5" width="6" height="16" rx="1"/></svg>';
const LIST_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

// Task interfaces
interface ProjectTask {
  id: number;
  project_id: number;
  project_name?: string;
  milestone_id?: number;
  milestone_title?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_email?: string;
  assignee_name?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  parent_task_id?: number;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  checklist_items?: TaskChecklistItem[];
  dependencies?: TaskDependency[];
  comments_count?: number;
}

interface TaskChecklistItem {
  id: number;
  task_id: number;
  title: string;
  is_completed: boolean;
  sort_order: number;
}

interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  dependency_type: 'blocks' | 'blocked_by';
  depends_on_task?: {
    id: number;
    title: string;
    status: string;
  };
}

// Module state
let currentProjectId: number | null = null;
let currentTasks: ProjectTask[] = [];
let currentView: 'kanban' | 'list' = 'kanban';
let kanbanBoard: ReturnType<typeof createKanbanBoard> | null = null;

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'To Do', color: 'var(--portal-text-secondary)' },
  in_progress: { label: 'In Progress', color: 'var(--app-color-primary)' },
  blocked: { label: 'Blocked', color: 'var(--color-warning-500)' },
  completed: { label: 'Done', color: 'var(--status-active)' },
  cancelled: { label: 'Cancelled', color: 'var(--status-cancelled)' }
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', class: 'task-priority-low' },
  medium: { label: 'Medium', class: 'task-priority-medium' },
  high: { label: 'High', class: 'task-priority-high' },
  urgent: { label: 'Urgent', class: 'task-priority-urgent' }
};

/**
 * Initialize tasks module for a project
 */
export async function initTasksModule(projectId: number): Promise<void> {
  currentProjectId = projectId;
  await loadTasks();
  setupViewToggle();
  renderCurrentView();
}

/**
 * Load tasks from API
 */
async function loadTasks(): Promise<void> {
  if (!currentProjectId) return;

  try {
    const response = await apiFetch(`/api/projects/${currentProjectId}/tasks`);
    if (response.ok) {
      const json = await response.json();
      // Handle canonical API format { success: true, data: {...} }
      const data = json.data ?? json;
      currentTasks = data.tasks || [];
    } else {
      currentTasks = [];
    }
  } catch (error) {
    console.error('[AdminTasks] Error loading tasks:', error);
    currentTasks = [];
  }
}

/**
 * Set up view toggle (reusable component)
 */
function setupViewToggle(): void {
  const mount = document.getElementById('tasks-view-toggle-mount');
  if (!mount || mount.dataset.listenerAdded) return;
  mount.dataset.listenerAdded = 'true';

  const toggleEl = createViewToggle({
    id: 'tasks-view-toggle',
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
 * Render Kanban view using the shared component
 */
function renderKanbanView(): void {
  // Destroy existing board
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }

  // Hide list, show kanban
  const listContainer = document.getElementById('tasks-list-container');
  const kanbanContainer = document.getElementById('tasks-kanban-container');
  if (listContainer) listContainer.style.display = 'none';
  if (kanbanContainer) kanbanContainer.style.display = 'block';

  // Build columns from tasks
  const columns: KanbanColumn[] = [
    { id: 'pending', title: 'To Do', color: STATUS_CONFIG.pending.color, items: [] },
    { id: 'in_progress', title: 'In Progress', color: STATUS_CONFIG.in_progress.color, items: [] },
    { id: 'blocked', title: 'Blocked', color: STATUS_CONFIG.blocked.color, items: [] },
    { id: 'completed', title: 'Done', color: STATUS_CONFIG.completed.color, items: [] }
  ];

  // Populate columns
  currentTasks.forEach(task => {
    const column = columns.find(c => c.id === task.status);
    if (column) {
      column.items.push(taskToKanbanItem(task));
    }
  });

  // Create kanban board
  kanbanBoard = createKanbanBoard({
    containerId: 'tasks-kanban-container',
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
function taskToKanbanItem(task: ProjectTask): KanbanItem {
  return {
    id: task.id,
    title: task.title,
    subtitle: task.description?.substring(0, 100),
    metadata: {
      priority: task.priority,
      dueDate: task.due_date,
      assignee: task.assignee_name,
      checklistCount: task.checklist_items?.length || 0,
      checklistCompleted: task.checklist_items?.filter(c => c.is_completed).length || 0,
      milestoneTitle: task.milestone_title,
      projectName: task.project_name,
      projectId: task.project_id
    }
  };
}

/**
 * Custom render for task cards
 */
function renderTaskCard(item: KanbanItem): string {
  const meta = item.metadata as {
    priority: string;
    dueDate?: string;
    assignee?: string;
    checklistCount: number;
    checklistCompleted: number;
    milestoneTitle?: string;
    projectName?: string;
    projectId?: number;
  };

  const priorityClass = PRIORITY_CONFIG[meta.priority as keyof typeof PRIORITY_CONFIG]?.class || '';
  const priorityLabel = PRIORITY_CONFIG[meta.priority as keyof typeof PRIORITY_CONFIG]?.label || meta.priority;

  const isOverdue = meta.dueDate && new Date(meta.dueDate) < new Date();
  const dueDateClass = isOverdue ? 'overdue' : '';

  return `
    ${meta.projectName && meta.projectId ? `
      <div class="task-project-link">
        <button type="button" class="task-project-name" data-action="view-project" data-project-id="${meta.projectId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          ${SanitizationUtils.escapeHtml(meta.projectName)}
        </button>
      </div>
    ` : ''}
    <div class="kanban-card-title">${SanitizationUtils.escapeHtml(item.title)}</div>
    ${item.subtitle ? `<div class="kanban-card-subtitle">${SanitizationUtils.escapeHtml(item.subtitle)}</div>` : ''}
    ${meta.milestoneTitle ? `
      <div class="task-milestone-tag">${SanitizationUtils.escapeHtml(meta.milestoneTitle)}</div>
    ` : `
      <div class="task-standalone-tag">Standalone</div>
    `}
    <div class="task-meta">
      <span class="task-priority ${priorityClass}">${priorityLabel}</span>
      ${meta.dueDate ? `
        <span class="task-due-date ${dueDateClass}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${formatDate(meta.dueDate)}
        </span>
      ` : ''}
      ${meta.checklistCount > 0 ? `
        <span class="task-checklist-count">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          ${meta.checklistCompleted}/${meta.checklistCount}
        </span>
      ` : ''}
    </div>
    <div class="task-card-actions">
      <button type="button" class="task-delete-btn" data-action="delete-project-task" data-task-id="${item.id}" title="Delete task">
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
  const listContainer = document.getElementById('tasks-list-container');
  const kanbanContainer = document.getElementById('tasks-kanban-container');
  if (kanbanContainer) kanbanContainer.style.display = 'none';
  if (!listContainer) return;
  listContainer.style.display = 'block';

  if (currentTasks.length === 0) {
    listContainer.innerHTML = '<div class="task-list-empty">No tasks yet. Create your first task above.</div>';
    return;
  }

  // Sort by priority and status
  const sortedTasks = [...currentTasks].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { in_progress: 0, pending: 1, blocked: 2, completed: 3, cancelled: 4 };

    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  listContainer.innerHTML = `
    <div class="task-list-container">
      <div class="task-list-header">
        <span>Task</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Due Date</span>
      </div>
      ${sortedTasks.map(task => renderListItem(task)).join('')}
    </div>
  `;

  // Add click handlers
  listContainer.querySelectorAll('.task-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const taskId = parseInt((item as HTMLElement).dataset.taskId || '0');
      const task = currentTasks.find(t => t.id === taskId);
      if (task) handleTaskClick(taskToKanbanItem(task));
    });
  });
}

/**
 * Render a list item
 */
function renderListItem(task: ProjectTask): string {
  const priorityClass = PRIORITY_CONFIG[task.priority]?.class || '';
  const priorityLabel = PRIORITY_CONFIG[task.priority]?.label || task.priority;
  const _statusLabel = STATUS_CONFIG[task.status]?.label || task.status;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return `
    <div class="task-list-item" data-task-id="${task.id}">
      <div class="task-list-title">
        <span>${SanitizationUtils.escapeHtml(task.title)}</span>
        ${task.description ? `<small>${SanitizationUtils.escapeHtml(task.description.substring(0, 50))}${task.description.length > 50 ? '...' : ''}</small>` : ''}
      </div>
      <span class="task-priority ${priorityClass}">${priorityLabel}</span>
      ${getStatusDotHTML(task.status)}
      <span class="${isOverdue ? 'overdue' : ''}">${task.due_date ? formatDate(task.due_date) : '-'}</span>
    </div>
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

  try {
    const response = await apiPut(`/api/projects/${currentProjectId}/tasks/${taskId}`, {
      status: toColumn
    });

    if (response.ok) {
      // Update local state
      const task = currentTasks.find(t => t.id === taskId);
      if (task) {
        task.status = toColumn as ProjectTask['status'];
      }
    } else {
      alertError('Failed to update task status');
      // Refresh to restore state
      await loadTasks();
      renderCurrentView();
    }
  } catch (error) {
    console.error('[AdminTasks] Error updating task status:', error);
    alertError('Error updating task');
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

/**
 * Show task detail modal
 */
async function showTaskDetailModal(task: ProjectTask): Promise<void> {
  // Fetch full task details including checklist and comments
  let fullTask = task;
  try {
    const response = await apiFetch(`/api/projects/${currentProjectId}/tasks/${task.id}`);
    if (response.ok) {
      const data = await response.json();
      fullTask = data.task || task;
    }
  } catch (e) {
    console.error('[AdminTasks] Error fetching task details:', e);
  }

  const checklistProgress = fullTask.checklist_items?.length
    ? Math.round((fullTask.checklist_items.filter(c => c.is_completed).length / fullTask.checklist_items.length) * 100)
    : 0;

  // Create modal using portal modal component
  const modal = createPortalModal({
    id: 'task-detail-modal',
    titleId: 'task-detail-modal-title',
    title: fullTask.title,
    contentClassName: 'task-detail-modal-content',
    onClose: () => modal.hide()
  });

  // Build body content
  modal.body.innerHTML = `
    <div class="task-detail-header-meta">
      <span class="task-priority ${PRIORITY_CONFIG[fullTask.priority]?.class || ''}">${PRIORITY_CONFIG[fullTask.priority]?.label || fullTask.priority}</span>
    </div>

    ${fullTask.description ? `
      <div class="task-detail-section">
        <h4>Description</h4>
        <p>${SanitizationUtils.escapeHtml(fullTask.description)}</p>
      </div>
    ` : ''}

    <div class="task-detail-section">
      <h4>Details</h4>
      <div class="meta-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div><strong>Status:</strong> ${STATUS_CONFIG[fullTask.status]?.label || fullTask.status}</div>
        <div><strong>Due:</strong> ${fullTask.due_date ? formatDate(fullTask.due_date) : ''}</div>
        <div><strong>Est. Hours:</strong> ${fullTask.estimated_hours || ''}</div>
      </div>
    </div>

    ${fullTask.checklist_items && fullTask.checklist_items.length > 0 ? `
      <div class="task-detail-section">
        <h4>Checklist</h4>
        <ul class="task-checklist">
          ${fullTask.checklist_items.map(item => `
            <li class="task-checklist-item ${item.is_completed ? 'completed' : ''}" data-item-id="${item.id}">
              <input type="checkbox" ${item.is_completed ? 'checked' : ''}>
              <label>${SanitizationUtils.escapeHtml(item.title)}</label>
            </li>
          `).join('')}
        </ul>
        <div class="task-checklist-progress">
          <div class="task-checklist-progress-bar">
            <div class="task-checklist-progress-fill" style="width: ${checklistProgress}%"></div>
          </div>
          <span class="task-checklist-progress-text">${checklistProgress}%</span>
        </div>
      </div>
    ` : ''}
  `;

  // Build footer with action buttons
  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="btn-close-task">Close</button>
    <button type="button" class="btn btn-secondary" id="btn-edit-task">Edit</button>
    <button type="button" class="btn btn-danger" id="btn-delete-task">Delete</button>
  `;

  // Append to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();

  // Event handlers
  modal.footer.querySelector('#btn-close-task')?.addEventListener('click', () => modal.hide());

  modal.footer.querySelector('#btn-edit-task')?.addEventListener('click', () => {
    modal.hide();
    showEditTaskModal(fullTask);
  });

  modal.footer.querySelector('#btn-delete-task')?.addEventListener('click', async () => {
    modal.hide();
    await deleteTask(fullTask.id);
  });

  // Checklist item toggles
  modal.body.querySelectorAll('.task-checklist-item input').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const itemId = parseInt((target.closest('.task-checklist-item') as HTMLElement).dataset.itemId || '0');
      await toggleChecklistItem(fullTask.id, itemId, target.checked);
    });
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
 * Show create task modal with custom form components
 */
export async function showCreateTaskModal(): Promise<void> {
  if (!currentProjectId) {
    alertError('No project selected');
    return;
  }

  // Priority options for custom dropdown
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ];

  // Create modal using portal modal component
  const modal = createPortalModal({
    id: 'create-task-modal',
    titleId: 'create-task-modal-title',
    title: 'Create Task',
    onClose: () => modal.hide()
  });

  const submitTask = async (): Promise<void> => {
    const titleInput = modal.body.querySelector('#task-title') as HTMLInputElement;
    const descriptionInput = modal.body.querySelector('#task-description') as HTMLTextAreaElement;
    const dueDateInput = modal.body.querySelector('#task-due-date') as HTMLInputElement;
    const estimatedHoursInput = modal.body.querySelector('#task-estimated-hours') as HTMLInputElement;
    const priorityMount = modal.body.querySelector('#task-priority-mount');
    const selectedPriority = priorityMount?.querySelector('.modal-dropdown')?.getAttribute('data-value') || 'medium';

    const title = titleInput?.value?.trim();
    if (!title) {
      alertError('Please enter a task title');
      titleInput?.focus();
      return;
    }

    modal.hide();

    try {
      const response = await apiPost(`/api/projects/${currentProjectId}/tasks`, {
        title,
        description: descriptionInput?.value?.trim() || null,
        priority: selectedPriority,
        status: 'pending',
        due_date: dueDateInput?.value || null,
        estimated_hours: estimatedHoursInput?.value ? parseFloat(estimatedHoursInput.value) : null
      });

      if (response.ok) {
        alertSuccess('Task created successfully!');
        await loadTasks();
        renderCurrentView();
      } else {
        alertError('Failed to create task');
      }
    } catch (error) {
      console.error('[AdminTasks] Error creating task:', error);
      alertError('Error creating task');
    }
  };

  // Build body content
  modal.body.innerHTML = `
    <div class="form-group">
      <label class="form-label" for="task-title">Task Title <span class="required">*</span></label>
      <input type="text" id="task-title" class="form-input" placeholder="Enter task title" required>
    </div>
    <div class="form-group">
      <label class="form-label" for="task-description">Description</label>
      <textarea id="task-description" class="form-input" rows="3" placeholder="Task description (optional)"></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Priority <span class="required">*</span></label>
        <div id="task-priority-mount"></div>
      </div>
      <div class="form-group">
        <label class="form-label" for="task-due-date">Due Date</label>
        <input type="date" id="task-due-date" class="form-input">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="task-estimated-hours">Estimated Hours</label>
      <input type="number" id="task-estimated-hours" class="form-input" placeholder="0" min="0" step="0.5">
    </div>
  `;

  // Build footer with action buttons
  modal.footer.innerHTML = `
    <button type="button" class="btn btn-outline" id="task-cancel-btn">Cancel</button>
    <button type="button" class="btn btn-primary" id="task-submit-btn">Create Task</button>
  `;

  // Append to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();

  // Create priority dropdown using createModalDropdown (matches form field styling)
  const priorityMount = modal.body.querySelector('#task-priority-mount');
  if (priorityMount) {
    const priorityDropdown = createModalDropdown({
      options: priorityOptions,
      currentValue: 'medium',
      ariaLabelPrefix: 'Priority'
    });
    priorityMount.appendChild(priorityDropdown);
  }

  // Set up button handlers
  modal.footer.querySelector('#task-cancel-btn')?.addEventListener('click', () => modal.hide());
  modal.footer.querySelector('#task-submit-btn')?.addEventListener('click', submitTask);

  // Close on Escape
  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      modal.hide();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // Focus the title input
  setTimeout(() => {
    const titleInput = modal.body.querySelector('#task-title') as HTMLInputElement;
    titleInput?.focus();
  }, 100);
}

/**
 * Show edit task modal
 */
async function showEditTaskModal(task: ProjectTask): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Edit Task',
    fields: [
      { name: 'title', label: 'Task Title', type: 'text', required: true, defaultValue: task.title },
      { name: 'description', label: 'Description', type: 'textarea', defaultValue: task.description || '' },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        defaultValue: task.priority,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' }
        ]
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: task.status,
        options: [
          { value: 'pending', label: 'To Do' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'blocked', label: 'Blocked' },
          { value: 'completed', label: 'Done' },
          { value: 'cancelled', label: 'Cancelled' }
        ]
      },
      { name: 'dueDate', label: 'Due Date', type: 'date', defaultValue: task.due_date?.split('T')[0] || '' },
      { name: 'estimatedHours', label: 'Estimated Hours', type: 'number', defaultValue: task.estimated_hours?.toString() || '' }
    ],
    confirmText: 'Save Changes',
    cancelText: 'Cancel'
  });

  if (!result) return;

  try {
    const response = await apiPut(`/api/projects/${currentProjectId}/tasks/${task.id}`, {
      title: result.title,
      description: result.description || null,
      priority: result.priority,
      status: result.status,
      due_date: result.dueDate || null,
      estimated_hours: result.estimatedHours ? parseFloat(result.estimatedHours) : null
    });

    if (response.ok) {
      alertSuccess('Task updated successfully!');
      await loadTasks();
      renderCurrentView();
    } else {
      alertError('Failed to update task');
    }
  } catch (error) {
    console.error('[AdminTasks] Error updating task:', error);
    alertError('Error updating task');
  }
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
    const response = await apiDelete(`/api/projects/${currentProjectId}/tasks/${taskId}`);

    if (response.ok) {
      alertSuccess('Task deleted');
      await loadTasks();
      renderCurrentView();
    } else {
      alertError('Failed to delete task');
    }
  } catch (error) {
    console.error('[AdminTasks] Error deleting task:', error);
    alertError('Error deleting task');
  }
}

/**
 * Toggle checklist item
 */
async function toggleChecklistItem(taskId: number, itemId: number, isCompleted: boolean): Promise<void> {
  try {
    await apiPut(`/api/projects/${currentProjectId}/tasks/${taskId}/checklist/${itemId}`, {
      is_completed: isCompleted
    });
    // Update local state
    const task = currentTasks.find(t => t.id === taskId);
    if (task?.checklist_items) {
      const item = task.checklist_items.find(c => c.id === itemId);
      if (item) item.is_completed = isCompleted;
    }
  } catch (error) {
    console.error('[AdminTasks] Error toggling checklist item:', error);
  }
}

/**
 * Cleanup module
 */
export function cleanup(): void {
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }
  currentProjectId = null;
  currentTasks = [];
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
    adminTasks?: {
      deleteTask: (taskId: number) => Promise<void>;
    };
  }
}

// Initialize global exposure
if (typeof window !== 'undefined') {
  window.adminTasks = {
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

    if (action === 'delete-project-task') {
      e.stopPropagation();
      const taskId = parseInt(actionBtn.dataset.taskId || '0');
      if (taskId) {
        deleteTask(taskId);
      }
    }
  });
}
