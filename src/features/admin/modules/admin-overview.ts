/**
 * ===============================================
 * ADMIN OVERVIEW MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-overview.ts
 *
 * Dashboard functionality for admin dashboard.
 * Loads priority-first data: attention items, snapshot metrics, and activity.
 * Dynamically imported for code splitting.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch } from '../../../utils/api-client';
import { formatDateTime, formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createViewToggle } from '../../../components/view-toggle';
import { createKanbanBoard, type KanbanColumn, type KanbanItem } from '../../../components/kanban-board';
import { getStatusDotHTML as _getStatusDotHTML } from '../../../components/status-badge';

// View toggle icons
const BOARD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="9" y="8" width="6" height="13" rx="1"/><rect x="15" y="5" width="6" height="16" rx="1"/></svg>';
const LIST_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';

// Task interface for upcoming tasks
interface UpcomingTask {
  id: number;
  title: string;
  description?: string;
  projectId: number;
  projectName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  dueDate?: string;
  assignedTo?: string;
}

// Module state for dashboard tasks widget
let dashboardTasksView: 'kanban' | 'list' = 'list';
let dashboardTasks: UpcomingTask[] = [];
let dashboardKanbanBoard: ReturnType<typeof createKanbanBoard> | null = null;
let dashboardCtx: AdminDashboardContext | null = null;

const PRIORITY_CLASSES: Record<string, string> = {
  urgent: 'task-priority-urgent',
  high: 'task-priority-high',
  medium: 'task-priority-medium',
  low: 'task-priority-low'
};

const PRIORITY_CONFIG: Record<string, { label: string; class: string }> = {
  low: { label: 'Low', class: 'task-priority-low' },
  medium: { label: 'Medium', class: 'task-priority-medium' },
  high: { label: 'High', class: 'task-priority-high' },
  urgent: { label: 'Urgent', class: 'task-priority-urgent' }
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'To Do', color: 'var(--portal-text-secondary)' },
  in_progress: { label: 'In Progress', color: 'var(--app-color-primary)' },
  blocked: { label: 'Blocked', color: 'var(--status-on-hold)' },
  completed: { label: 'Done', color: 'var(--status-active)' }
};

/**
 * Dashboard data structure
 */
interface DashboardData {
  attention: {
    overdueInvoices: number;
    pendingContracts: number;
    newLeadsThisWeek: number;
    unreadMessages: number;
  };
  snapshot: {
    activeProjects: number;
    totalClients: number;
    revenueMTD: number;
    conversionRate: number;
  };
}

/**
 * Load overview data for admin dashboard
 */
export async function loadOverviewData(ctx: AdminDashboardContext): Promise<void> {
  try {
    // Load all dashboard data in parallel
    const [dashboardData] = await Promise.all([
      loadDashboardData(),
      loadRecentActivity(),
      loadUpcomingTasks(ctx)
    ]);

    // Update Needs Attention section
    updateAttentionCard('stat-overdue-invoices', dashboardData.attention.overdueInvoices);
    updateAttentionCard('stat-pending-contracts', dashboardData.attention.pendingContracts);
    updateAttentionCard('stat-new-leads', dashboardData.attention.newLeadsThisWeek);
    updateAttentionCard('stat-unread-messages', dashboardData.attention.unreadMessages);

    // Update Today's Snapshot section
    updateElement('stat-active-projects', formatNumber(dashboardData.snapshot.activeProjects));
    updateElement('stat-total-clients', formatNumber(dashboardData.snapshot.totalClients));
    updateElement('stat-revenue-mtd', formatCurrency(dashboardData.snapshot.revenueMTD));
    updateElement('stat-conversion-rate', `${dashboardData.snapshot.conversionRate}%`);

  } catch (error) {
    console.error('[AdminOverview] Error loading overview data:', error);
    showNoDataMessage();
  }
}

/**
 * Load dashboard data from various API endpoints
 */
async function loadDashboardData(): Promise<DashboardData> {
  // Fetch data from multiple endpoints in parallel
  const [
    invoicesRes,
    projectsRes,
    clientsRes,
    leadsRes,
    messagesRes,
    metricsRes
  ] = await Promise.all([
    apiFetch('/api/invoices').catch(() => null),
    apiFetch('/api/projects').catch(() => null),
    apiFetch('/api/clients').catch(() => null),
    apiFetch('/api/admin/leads').catch(() => null),
    apiFetch('/api/messages/unread-count').catch(() => null),
    apiFetch('/api/analytics/quick/revenue?days=30').catch(() => null)
  ]);

  // Parse responses - handle nested response objects
  const invoices = invoicesRes?.ok ? await invoicesRes.json() : [];
  const projectsData = projectsRes?.ok ? await projectsRes.json() : { projects: [] };
  const projects = projectsData.projects || projectsData || [];
  const clientsData = clientsRes?.ok ? await clientsRes.json() : { clients: [] };
  const clients = clientsData.clients || clientsData || [];
  const leadsData = leadsRes?.ok ? await leadsRes.json() : { leads: [] };
  const leads = leadsData.leads || [];
  const messagesData = messagesRes?.ok ? await messagesRes.json() : { unread_count: 0 };
  const metricsData = metricsRes?.ok ? await metricsRes.json() : { summary: {}, revenueMTD: 0 };

  // Calculate overdue invoices (due_date < today and status not paid)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueInvoices = Array.isArray(invoices)
    ? invoices.filter((inv: { due_date?: string; status?: string }) => {
      if (!inv.due_date || inv.status === 'paid') return false;
      const dueDate = new Date(inv.due_date);
      return dueDate < today;
    }).length
    : 0;

  // Calculate pending contracts (projects with contract not signed)
  const pendingContracts = Array.isArray(projects)
    ? projects.filter((p: { contract_signed?: boolean; status?: string }) =>
      !p.contract_signed && p.status !== 'completed' && p.status !== 'cancelled'
    ).length
    : 0;

  // Calculate new leads this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const newLeadsThisWeek = Array.isArray(leads)
    ? leads.filter((lead: { created_at?: string }) => {
      if (!lead.created_at) return false;
      const createdAt = new Date(lead.created_at);
      return createdAt >= oneWeekAgo;
    }).length
    : 0;

  // Unread messages count
  const unreadMessages = messagesData.unread_count || 0;

  // Active projects count (status uses hyphen: 'in-progress')
  const activeProjects = Array.isArray(projects)
    ? projects.filter((p: { status?: string }) =>
      p.status === 'active' || p.status === 'in-progress'
    ).length
    : 0;

  // Total clients count
  const totalClients = Array.isArray(clients) ? clients.length : 0;

  // Revenue MTD (from analytics quick/revenue - summary.total_revenue or legacy revenueMTD)
  const revenueMTD = metricsData.summary?.total_revenue ?? metricsData.revenueMTD ?? 0;

  // Conversion rate (leads converted / total leads * 100)
  const totalLeads = Array.isArray(leads) ? leads.length : 0;
  const convertedLeads = Array.isArray(leads)
    ? leads.filter((lead: { status?: string }) => lead.status === 'converted').length
    : 0;
  const conversionRate = totalLeads > 0
    ? Math.round((convertedLeads / totalLeads) * 100)
    : 0;

  return {
    attention: {
      overdueInvoices,
      pendingContracts,
      newLeadsThisWeek,
      unreadMessages
    },
    snapshot: {
      activeProjects,
      totalClients,
      revenueMTD,
      conversionRate
    }
  };
}

/**
 * Activity item from the API (reserved for future activity feed)
 */
interface _ActivityItem {
  id: number;
  activity_type: string;
  title: string;
  description?: string;
  created_at: string;
  client_name?: string;
  client_id?: number;
}

/**
 * Load recent activity from the API
 * Shows recent leads as the primary activity feed for the dashboard
 */
async function loadRecentActivity(): Promise<void> {
  const listEl = document.getElementById('recent-activity-list');
  if (!listEl) return;

  try {
    // Fetch recent leads - the primary activity for the dashboard
    const response = await apiFetch('/api/admin/leads');

    if (!response.ok) {
      throw new Error('Failed to fetch recent activity');
    }

    const data = await response.json();
    const leads = data.leads || [];

    // Show the 5 most recent leads
    const recentLeads = leads.slice(0, 5);

    if (recentLeads.length === 0) {
      listEl.innerHTML = '<li class="activity-item empty">No recent activity</li>';
      return;
    }

    listEl.innerHTML = recentLeads.map((lead: { created_at?: string; contact_name?: string }) => {
      const date = lead.created_at ? formatDateTime(lead.created_at).split(',')[0] : '';
      const decoded = SanitizationUtils.decodeHtmlEntities(lead.contact_name || 'Unknown');
      const safeName = SanitizationUtils.escapeHtml(decoded);

      return `<li class="activity-item">${date} - New Lead: ${safeName}</li>`;
    }).join('');

  } catch (error) {
    console.error('[AdminOverview] Error loading recent activity:', error);
    listEl.innerHTML = '<li class="activity-item empty">Failed to load activity</li>';
  }
}

/**
 * Get icon for activity type (reserved for future activity feed)
 */
function _getActivityIcon(activityType: string): string {
  const icons: Record<string, string> = {
    'note': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
    'call': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    'email': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    'meeting': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'task': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>',
    'status_change': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
  };

  return icons[activityType] || '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
}

/**
 * Update attention card with count and highlight if > 0
 */
function updateAttentionCard(id: string, count: number): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = formatNumber(count);

    // Add highlight class if count > 0
    const card = element.closest('.attention-card');
    if (card) {
      if (count > 0) {
        card.classList.add('has-items');
      } else {
        card.classList.remove('has-items');
      }
    }
  }
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Update DOM element with text
 */
function updateElement(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Show message when no data is available
 */
function showNoDataMessage(): void {
  updateElement('stat-overdue-invoices', '—');
  updateElement('stat-pending-contracts', '—');
  updateElement('stat-new-leads', '—');
  updateElement('stat-unread-messages', '—');
  updateElement('stat-active-projects', '—');
  updateElement('stat-total-clients', '—');
  updateElement('stat-revenue-mtd', '—');
  updateElement('stat-conversion-rate', '—');
}

/**
 * Load upcoming tasks for dashboard widget
 * Shows the most urgent/near-due tasks across all projects with Board/List toggle
 */
async function loadUpcomingTasks(ctx: AdminDashboardContext): Promise<void> {
  dashboardCtx = ctx;

  try {
    // Fetch tasks from global tasks API - get more for kanban view
    const response = await apiFetch('/api/admin/tasks?status=pending,in_progress,blocked&limit=20');

    if (!response.ok) {
      throw new Error('Failed to fetch tasks');
    }

    const data = await response.json();
    dashboardTasks = (data.tasks || []).map((t: Record<string, unknown>) => ({
      id: t.id as number,
      title: t.title as string,
      description: t.description as string | undefined,
      projectId: t.projectId as number,
      projectName: t.projectName as string,
      priority: t.priority as UpcomingTask['priority'],
      status: t.status as UpcomingTask['status'],
      dueDate: t.dueDate as string | undefined,
      assignedTo: t.assignedTo as string | undefined
    }));

    // Setup view toggle
    setupDashboardTasksViewToggle();

    // Render current view
    renderDashboardTasksView();

  } catch (error) {
    console.error('[AdminOverview] Error loading upcoming tasks:', error);
    const listEl = document.getElementById('upcoming-tasks-list');
    if (listEl) {
      listEl.innerHTML = '<li class="task-item empty">Failed to load tasks</li>';
    }
  }
}

/**
 * Setup view toggle for dashboard tasks widget
 */
function setupDashboardTasksViewToggle(): void {
  const mount = document.getElementById('dashboard-tasks-view-toggle-mount');
  if (!mount) return;

  mount.innerHTML = '';

  const toggleEl = createViewToggle({
    id: 'dashboard-tasks-view-toggle',
    options: [
      { value: 'kanban', label: 'Board', title: 'Board view', ariaLabel: 'Board view', iconSvg: BOARD_ICON },
      { value: 'list', label: 'List', title: 'List view', ariaLabel: 'List view', iconSvg: LIST_ICON }
    ],
    value: dashboardTasksView,
    onChange: (v) => {
      dashboardTasksView = v as 'kanban' | 'list';
      renderDashboardTasksView();
    }
  });
  mount.appendChild(toggleEl);
}

/**
 * Render current dashboard tasks view
 */
function renderDashboardTasksView(): void {
  if (dashboardTasksView === 'kanban') {
    renderDashboardKanbanView();
  } else {
    renderDashboardListView();
  }
}

/**
 * Render Kanban view for dashboard tasks
 */
function renderDashboardKanbanView(): void {
  // Destroy existing board
  if (dashboardKanbanBoard) {
    dashboardKanbanBoard.destroy();
    dashboardKanbanBoard = null;
  }

  // Hide list, show kanban
  const listContainer = document.getElementById('dashboard-tasks-list-container');
  const kanbanContainer = document.getElementById('dashboard-tasks-kanban-container');
  if (listContainer) listContainer.style.display = 'none';
  if (kanbanContainer) kanbanContainer.style.display = 'block';

  if (dashboardTasks.length === 0) {
    if (kanbanContainer) {
      kanbanContainer.innerHTML = '<div class="task-list-empty">No upcoming tasks</div>';
    }
    return;
  }

  // Build columns (exclude completed/cancelled for dashboard)
  const columns: KanbanColumn[] = [
    { id: 'pending', title: 'To Do', color: STATUS_CONFIG.pending.color, items: [] },
    { id: 'in_progress', title: 'In Progress', color: STATUS_CONFIG.in_progress.color, items: [] },
    { id: 'blocked', title: 'Blocked', color: STATUS_CONFIG.blocked.color, items: [] }
  ];

  // Populate columns
  dashboardTasks
    .filter(task => task.status !== 'completed' && task.status !== 'cancelled')
    .forEach(task => {
      const column = columns.find(c => c.id === task.status);
      if (column) {
        column.items.push(taskToKanbanItem(task));
      }
    });

  // Create kanban board
  dashboardKanbanBoard = createKanbanBoard({
    containerId: 'dashboard-tasks-kanban-container',
    columns,
    onItemMove: handleDashboardTaskMove,
    onItemClick: handleDashboardTaskClick,
    renderItem: renderDashboardTaskCard,
    emptyColumnText: 'No tasks'
  });
}

/**
 * Convert task to kanban item
 */
function taskToKanbanItem(task: UpcomingTask): KanbanItem {
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
      projectName: task.projectName
    }
  };
}

/**
 * Render task card for dashboard kanban
 */
function renderDashboardTaskCard(item: KanbanItem): string {
  const meta = item.metadata as { priority: string; dueDate?: string; assignee?: string; projectName: string };
  const priorityConfig = PRIORITY_CONFIG[meta.priority];
  const priorityClass = priorityConfig?.class || '';
  const priorityLabel = priorityConfig?.label || meta.priority;
  const isOverdue = meta.dueDate && new Date(meta.dueDate) < new Date();
  const dueDateClass = isOverdue ? 'overdue' : '';

  return `
    <div class="task-card-header">
      <span class="task-card-title">${SanitizationUtils.escapeHtml(item.title)}</span>
      <span class="task-card-project">${SanitizationUtils.escapeHtml(meta.projectName)}</span>
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
  `;
}

/**
 * Handle task move in dashboard kanban (navigate to tasks tab)
 */
async function handleDashboardTaskMove(_itemId: string | number, _fromColumn: string, _toColumn: string): Promise<void> {
  // For dashboard widget, just navigate to tasks tab for full functionality
  dashboardCtx?.switchTab?.('tasks');
}

/**
 * Handle task click in dashboard
 */
function handleDashboardTaskClick(_item: KanbanItem): void {
  // Navigate to tasks tab
  dashboardCtx?.switchTab?.('tasks');
}

/**
 * Render List view for dashboard tasks
 */
function renderDashboardListView(): void {
  // Destroy kanban if exists
  if (dashboardKanbanBoard) {
    dashboardKanbanBoard.destroy();
    dashboardKanbanBoard = null;
  }

  // Show list, hide kanban
  const listContainer = document.getElementById('dashboard-tasks-list-container');
  const kanbanContainer = document.getElementById('dashboard-tasks-kanban-container');
  if (kanbanContainer) kanbanContainer.style.display = 'none';
  if (!listContainer) return;
  listContainer.style.display = 'block';

  const listEl = document.getElementById('upcoming-tasks-list');
  if (!listEl) return;

  // Show top 5 tasks for list view
  const activeTasks = dashboardTasks
    .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
    .slice(0, 5);

  if (activeTasks.length === 0) {
    listEl.innerHTML = '<li class="task-item empty">No upcoming tasks</li>';
    return;
  }

  listEl.innerHTML = activeTasks.map((task) => {
    const priorityClass = PRIORITY_CLASSES[task.priority] || '';
    const dueDateStr = task.dueDate ? formatDate(task.dueDate) : '';
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
    const overdueClass = isOverdue ? 'task-overdue' : '';

    const safeTitle = SanitizationUtils.escapeHtml(task.title);
    const safeProject = SanitizationUtils.escapeHtml(task.projectName);

    return `
      <li class="task-item ${priorityClass} ${overdueClass}" data-task-id="${task.id}" data-project-id="${task.projectId}">
        <div class="task-item-content">
          <span class="task-title">${safeTitle}</span>
          <span class="task-project">${safeProject}</span>
        </div>
        <div class="task-item-meta">
          ${dueDateStr ? `<span class="task-due">${dueDateStr}</span>` : ''}
          <span class="task-priority-badge ${priorityClass}">${task.priority}</span>
        </div>
      </li>
    `;
  }).join('');

  // Add click handlers to navigate to tasks tab
  listEl.querySelectorAll('.task-item[data-task-id]').forEach((item) => {
    item.addEventListener('click', () => {
      dashboardCtx?.switchTab?.('tasks');
    });
  });
}

/**
 * Check if tracking data exists (kept for backwards compatibility)
 */
export function hasTrackingData(): boolean {
  return true;
}

/**
 * Get total event count (kept for backwards compatibility)
 */
export function getEventCount(): number {
  return 0;
}
