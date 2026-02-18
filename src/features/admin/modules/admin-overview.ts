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
import { formatDateTime, formatDate, formatCurrency } from '../../../utils/format-utils';
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
 * Load overview data for admin dashboard (Linear-style layout)
 */
export async function loadOverviewData(ctx: AdminDashboardContext): Promise<void> {
  // Store context for use in click handlers
  dashboardCtx = ctx;

  // Set up click handlers for panel actions
  setupPanelClickHandlers(ctx);

  try {
    // Load all dashboard data in parallel
    const [dashboardData] = await Promise.all([
      loadDashboardData(),
      loadRecentActivity(),
      loadActiveProjects(ctx),
      loadRecentLeads(ctx),
      loadProjectHealth()
    ]);

    // Update 4-stat strip
    updateElement('stat-active-projects', formatNumber(dashboardData.snapshot.activeProjects));
    updateElement('stat-revenue-mtd', formatCurrency(dashboardData.snapshot.revenueMTD, false));
    updateElement('stat-new-leads', formatNumber(dashboardData.attention.newLeadsThisWeek));
    updateElement('stat-overdue-tasks', formatNumber(dashboardData.attention.overdueInvoices + dashboardData.attention.pendingContracts));

    // Update leads badge
    const leadsBadge = document.getElementById('leads-count-badge');
    if (leadsBadge) {
      leadsBadge.textContent = String(dashboardData.attention.newLeadsThisWeek);
      if (dashboardData.attention.newLeadsThisWeek > 0) {
        leadsBadge.classList.add('has-items');
      }
    }

    // Update revenue KPIs (placeholder values for now - can be extended)
    updateElement('stat-invoiced-ytd', formatCurrency(dashboardData.snapshot.revenueMTD * 2, false));
    updateElement('stat-collected-ytd', formatCurrency(dashboardData.snapshot.revenueMTD * 1.6, false));
    updateElement('stat-outstanding', formatCurrency(dashboardData.snapshot.revenueMTD * 0.4, false));

    // Render simple revenue chart
    renderRevenueChart();

  } catch (error) {
    console.error('[AdminOverview] Error loading overview data:', error);
    showNoDataMessage();
  }
}

/**
 * Set up click handlers for panel actions
 */
function setupPanelClickHandlers(ctx: AdminDashboardContext): void {
  // Handle all data-tab buttons
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    if (!btn.getAttribute('data-listener-added')) {
      btn.setAttribute('data-listener-added', 'true');
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) ctx.switchTab?.(tab);
      });
    }
  });
}

/**
 * Load and render active projects in the overview table
 */
async function loadActiveProjects(ctx: AdminDashboardContext): Promise<void> {
  const tbody = document.getElementById('overview-projects-tbody');
  if (!tbody) return;

  try {
    const response = await apiFetch('/api/projects?status=active,in-progress&limit=5');
    if (!response.ok) throw new Error('Failed to fetch projects');

    const data = await response.json();
    const projectsData = data.data ?? data ?? { projects: [] };
    const projects = (projectsData.projects ?? projectsData ?? []).slice(0, 5);

    if (projects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No active projects</td></tr>';
      return;
    }

    tbody.innerHTML = projects.map((p: {
      id: number;
      name: string;
      client_name?: string;
      status: string;
      progress?: number;
      due_date?: string;
    }) => {
      const progress = p.progress ?? 0;
      const statusClass = getStatusClass(p.status);
      const statusLabel = getStatusLabel(p.status);
      const dueClass = getDueDateClass(p.due_date);
      const dueStr = p.due_date ? formatDate(p.due_date) : '-';

      return `
        <tr class="overview-table-row" data-project-id="${p.id}">
          <td class="project-cell">
            <span class="project-name">${SanitizationUtils.escapeHtml(p.name)}</span>
            <span class="project-client">${SanitizationUtils.escapeHtml(p.client_name || '')}</span>
          </td>
          <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
          <td>
            <div class="progress-cell">
              <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
              <span class="progress-pct">${progress}%</span>
            </div>
          </td>
          <td class="due-cell ${dueClass}">${dueStr}</td>
        </tr>
      `;
    }).join('');

    // Add click handlers - navigate to projects tab
    tbody.querySelectorAll('.overview-table-row').forEach((row) => {
      row.addEventListener('click', () => {
        ctx.switchTab?.('projects');
      });
    });

  } catch (error) {
    console.error('[AdminOverview] Error loading projects:', error);
    tbody.innerHTML = '<tr><td colspan="4" class="error-cell">Failed to load projects</td></tr>';
  }
}

/**
 * Load and render recent leads
 */
async function loadRecentLeads(ctx: AdminDashboardContext): Promise<void> {
  const list = document.getElementById('overview-leads-list');
  if (!list) return;

  try {
    const response = await apiFetch('/api/admin/leads?status=new,contacted&limit=3');
    if (!response.ok) throw new Error('Failed to fetch leads');

    const data = await response.json();
    const leadsData = data.data ?? data ?? { leads: [] };
    const leads = (leadsData.leads ?? []).slice(0, 3);

    if (leads.length === 0) {
      list.innerHTML = '<li class="leads-item-empty">No pending leads</li>';
      return;
    }

    list.innerHTML = leads.map((lead: {
      id: number;
      name: string;
      company?: string;
      project_type?: string;
      budget?: string;
      created_at?: string;
    }) => {
      const initials = getInitials(lead.name);
      const color = getAvatarColor(lead.id);
      const timeAgo = lead.created_at ? getTimeAgo(lead.created_at) : '';

      return `
        <li class="leads-item" data-lead-id="${lead.id}">
          <span class="leads-avatar" style="background: ${color}">${initials}</span>
          <div class="leads-info">
            <span class="leads-name">${SanitizationUtils.escapeHtml(lead.name)}</span>
            <span class="leads-context">${SanitizationUtils.escapeHtml(lead.company || '')}${lead.project_type ? ' · ' + lead.project_type : ''}</span>
          </div>
          <div class="leads-meta">
            <span class="leads-budget">${lead.budget || ''}</span>
            <span class="leads-time">${timeAgo}</span>
          </div>
        </li>
      `;
    }).join('');

    // Add click handlers
    list.querySelectorAll('.leads-item').forEach((item) => {
      item.addEventListener('click', () => {
        ctx.switchTab?.('leads');
      });
    });

  } catch (error) {
    console.error('[AdminOverview] Error loading leads:', error);
    list.innerHTML = '<li class="leads-item-error">Failed to load leads</li>';
  }
}

/**
 * Load and render project health donut chart
 */
async function loadProjectHealth(): Promise<void> {
  const container = document.getElementById('health-chart-container');
  if (!container) return;

  try {
    const response = await apiFetch('/api/projects');
    if (!response.ok) throw new Error('Failed to fetch projects');

    const data = await response.json();
    const projectsData = data.data ?? data ?? { projects: [] };
    const projects = projectsData.projects ?? projectsData ?? [];

    // Count by status
    const statusCounts: Record<string, number> = {
      active: 0,
      'in-progress': 0,
      'on-hold': 0,
      completed: 0,
      cancelled: 0
    };

    projects.forEach((p: { status?: string }) => {
      const status = p.status || 'active';
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      } else {
        statusCounts['active']++;
      }
    });

    const total = projects.length || 1;
    const healthData = [
      { label: 'Active', count: statusCounts['active'] + statusCounts['in-progress'], color: 'var(--status-active)' },
      { label: 'On Hold', count: statusCounts['on-hold'], color: 'var(--status-on-hold)' },
      { label: 'Completed', count: statusCounts['completed'], color: 'var(--color-primary)' }
    ];

    container.innerHTML = `
      <div class="health-donut">
        <svg viewBox="0 0 36 36" class="health-donut-svg">
          ${renderDonutSegments(healthData, total)}
          <text x="18" y="18" class="health-donut-center">${total}</text>
          <text x="18" y="22" class="health-donut-label">Total</text>
        </svg>
      </div>
      <div class="health-legend">
        ${healthData.map(d => `
          <div class="health-legend-row">
            <span class="health-legend-dot" style="background: ${d.color}"></span>
            <span class="health-legend-label">${d.label}</span>
            <span class="health-legend-value">${d.count}</span>
          </div>
        `).join('')}
      </div>
    `;

  } catch (error) {
    console.error('[AdminOverview] Error loading project health:', error);
    container.innerHTML = '<div class="health-error">Failed to load</div>';
  }
}

/**
 * Render donut chart segments
 */
function renderDonutSegments(data: { count: number; color: string }[], total: number): string {
  const strokeWidth = 3.5;
  const radius = 15.91549430918954; // circumference = 100
  let offset = 25; // Start at top

  return data.map(d => {
    const pct = (d.count / total) * 100;
    const segment = `
      <circle
        cx="18" cy="18" r="${radius}"
        fill="none"
        stroke="${d.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${pct} ${100 - pct}"
        stroke-dashoffset="${offset}"
        class="health-segment"
      />
    `;
    offset -= pct;
    return segment;
  }).join('');
}

/**
 * Render simple revenue chart
 */
function renderRevenueChart(): void {
  const container = document.getElementById('revenue-chart-container');
  if (!container) return;

  // Simple SVG line chart placeholder
  container.innerHTML = `
    <svg width="100%" height="72" viewBox="0 0 400 72" class="revenue-chart-svg">
      <defs>
        <linearGradient id="revenue-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--color-primary-alpha-25, rgba(200,241,53,0.25))"/>
          <stop offset="100%" stop-color="var(--color-primary-alpha-0, rgba(200,241,53,0))"/>
        </linearGradient>
      </defs>
      <path d="M0 50 L50 42 L100 46 L150 26 L200 31 L250 16 L300 11 L350 8 L400 6 L400 72 L0 72 Z" fill="url(#revenue-gradient)"/>
      <path d="M0 50 L50 42 L100 46 L150 26 L200 31 L250 16 L300 11 L350 8 L400 6" fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

/**
 * Get status CSS class
 */
function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'active': 'status-in-progress',
    'in-progress': 'status-in-progress',
    'in_progress': 'status-in-progress',
    'on-hold': 'status-on-hold',
    'on_hold': 'status-on-hold',
    'completed': 'status-completed',
    'cancelled': 'status-cancelled',
    'review': 'status-review'
  };
  return classes[status] || 'status-in-progress';
}

/**
 * Get status display label
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'active': 'In Progress',
    'in-progress': 'In Progress',
    'in_progress': 'In Progress',
    'on-hold': 'On Hold',
    'on_hold': 'On Hold',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'review': 'In Review'
  };
  return labels[status] || 'Active';
}

/**
 * Get due date CSS class
 */
function getDueDateClass(dueDate?: string): string {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 0) return 'due-overdue';
  if (days < 7) return 'due-soon';
  return '';
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Get avatar color based on ID
 */
function getAvatarColor(id: number): string {
  const colors = [
    'var(--color-primary-alpha-12, rgba(200,241,53,0.12))',
    'var(--color-info-alpha-12, rgba(91,143,255,0.12))',
    'var(--color-warning-alpha-12, rgba(251,146,60,0.12))',
    'var(--color-purple-alpha-12, rgba(167,139,250,0.12))'
  ];
  return colors[id % colors.length];
}

/**
 * Get time ago string
 */
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1d ago';
  return `${days}d ago`;
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

  // Parse responses - handle canonical API format { success: true, data: {...} }
  const invoicesJson = invoicesRes?.ok ? await invoicesRes.json() : { data: [] };
  const invoices = invoicesJson.data ?? invoicesJson ?? [];

  const projectsJson = projectsRes?.ok ? await projectsRes.json() : { data: { projects: [] } };
  const projectsData = projectsJson.data ?? projectsJson ?? { projects: [] };
  const projects = projectsData.projects ?? projectsData ?? [];

  const clientsJson = clientsRes?.ok ? await clientsRes.json() : { data: { clients: [] } };
  const clientsData = clientsJson.data ?? clientsJson ?? { clients: [] };
  const clients = clientsData.clients ?? clientsData ?? [];

  const leadsJson = leadsRes?.ok ? await leadsRes.json() : { data: { leads: [] } };
  const leadsData = leadsJson.data ?? leadsJson ?? { leads: [] };
  const leads = leadsData.leads ?? [];

  const messagesJson = messagesRes?.ok ? await messagesRes.json() : { data: { unread_count: 0 } };
  const messagesData = messagesJson.data ?? messagesJson ?? { unread_count: 0 };

  const metricsJson = metricsRes?.ok ? await metricsRes.json() : { data: { summary: {}, revenueMTD: 0 } };
  const metricsData = metricsJson.data ?? metricsJson ?? { summary: {}, revenueMTD: 0 };

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
 * Shows consolidated activity feed from all entity types (Linear-style)
 */
async function loadRecentActivity(): Promise<void> {
  const listEl = document.getElementById('recent-activity-list');
  if (!listEl) return;

  try {
    const response = await apiFetch('/api/admin/recent-activity');

    if (!response.ok) {
      throw new Error('Failed to fetch recent activity');
    }

    const data = await response.json();
    const activities = data.recentActivity || [];

    if (activities.length === 0) {
      listEl.innerHTML = '<li class="activity-item-empty">No recent activity</li>';
      return;
    }

    listEl.innerHTML = activities.slice(0, 6).map((item: {
      type: string;
      title: string;
      context?: string;
      date: string;
      clientName?: string;
    }) => {
      const timeAgo = item.date ? getTimeAgo(item.date) : '';
      const dotClass = getActivityDotClass(item.type);
      const safeTitle = SanitizationUtils.escapeHtml(item.title);
      const safeContext = item.context ? SanitizationUtils.escapeHtml(
        SanitizationUtils.decodeHtmlEntities(item.context)
      ) : '';

      return `
        <li class="activity-feed-item">
          <span class="activity-dot ${dotClass}"></span>
          <div class="activity-body">
            <span class="activity-text"><strong>${safeTitle}</strong>${safeContext ? ` ${safeContext}` : ''}</span>
            <span class="activity-time">${timeAgo}</span>
          </div>
        </li>
      `;
    }).join('');

  } catch (error) {
    console.error('[AdminOverview] Error loading recent activity:', error);
    listEl.innerHTML = '<li class="activity-item-error">Failed to load activity</li>';
  }
}

/**
 * Get activity dot color class based on type
 */
function getActivityDotClass(type: string): string {
  const classes: Record<string, string> = {
    'message': 'dot-blue',
    'file': 'dot-green',
    'invoice': 'dot-green',
    'lead': 'dot-purple',
    'project_update': 'dot-orange',
    'contract': 'dot-green',
    'document_request': 'dot-orange'
  };
  return classes[type] || 'dot-blue';
}

/**
 * Get icon for activity type
 */
function getActivityIcon(activityType: string): string {
  const icons: Record<string, string> = {
    'lead': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>',
    'invoice': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
    'message': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    'document_request': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    'contract': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
    'project_update': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
    'file': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  };

  return icons[activityType] || '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';
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
  updateElement('stat-active-projects', '—');
  updateElement('stat-revenue-mtd', '—');
  updateElement('stat-new-leads', '—');
  updateElement('stat-overdue-tasks', '—');
  updateElement('stat-invoiced-ytd', '—');
  updateElement('stat-collected-ytd', '—');
  updateElement('stat-outstanding', '—');
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

// ============================================
// ICONS FOR OVERVIEW DASHBOARD
// ============================================

const OVERVIEW_ICONS = {
  FOLDER: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16Z"/></svg>',
  DOLLAR: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  RADAR: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/></svg>',
  ALERT: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  ACTIVITY: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  USER_PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>',
  HEART: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'
};

// ============================================
// DYNAMIC TAB RENDERING - LINEAR STYLE
// ============================================

/**
 * Render the overview tab HTML structure dynamically.
 * Linear-style layout: 4-stat strip, 2-column grid (projects+chart | activity+leads+health)
 * Call this before loadOverviewData to create the DOM elements.
 */
export function renderOverviewTab(container: HTMLElement): void {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  container.innerHTML = `
  <div class="overview-linear">
    <!-- Page Header with Acme font -->
    <div class="overview-header">
      <div class="overview-header-left">
        <span class="overview-eyebrow">Admin Dashboard</span>
        <h1 class="overview-title">Good ${getGreeting()}</h1>
      </div>
      <div class="overview-header-right">
        <span class="overview-date">${dateStr}</span>
      </div>
    </div>

    <!-- 4-Stat Strip -->
    <div class="overview-stats-strip" aria-label="Key metrics">
      <button class="overview-stat-card" data-tab="projects" type="button">
        <div class="stat-card-top">
          <span class="stat-card-label">Active Projects</span>
          <span class="stat-card-icon stat-icon-blue" aria-hidden="true">${OVERVIEW_ICONS.FOLDER}</span>
        </div>
        <span class="stat-card-value" id="stat-active-projects">-</span>
        <span class="stat-card-delta" id="stat-active-projects-delta"></span>
      </button>
      <button class="overview-stat-card" data-tab="invoices" type="button">
        <div class="stat-card-top">
          <span class="stat-card-label">Revenue MTD</span>
          <span class="stat-card-icon stat-icon-green" aria-hidden="true">${OVERVIEW_ICONS.DOLLAR}</span>
        </div>
        <span class="stat-card-value" id="stat-revenue-mtd">-</span>
        <span class="stat-card-delta" id="stat-revenue-mtd-delta"></span>
      </button>
      <button class="overview-stat-card" data-tab="leads" type="button">
        <div class="stat-card-top">
          <span class="stat-card-label">Pending Leads</span>
          <span class="stat-card-icon stat-icon-purple" aria-hidden="true">${OVERVIEW_ICONS.RADAR}</span>
        </div>
        <span class="stat-card-value" id="stat-new-leads">-</span>
        <span class="stat-card-delta" id="stat-new-leads-delta">Need follow-up</span>
      </button>
      <button class="overview-stat-card overview-stat-card--alert" data-tab="tasks" type="button">
        <div class="stat-card-top">
          <span class="stat-card-label">Overdue Tasks</span>
          <span class="stat-card-icon stat-icon-red" aria-hidden="true">${OVERVIEW_ICONS.ALERT}</span>
        </div>
        <span class="stat-card-value stat-value-alert" id="stat-overdue-tasks">-</span>
        <span class="stat-card-delta stat-delta-alert" id="stat-overdue-tasks-delta">Needs attention</span>
      </button>
    </div>

    <!-- 2-Column Grid Layout -->
    <div class="overview-grid">
      <!-- Left Column: Projects Table + Revenue Chart -->
      <div class="overview-col-main">
        <!-- Active Projects Panel -->
        <div class="overview-panel">
          <div class="overview-panel-header">
            <div class="overview-panel-title">
              <span class="panel-icon panel-icon-blue" aria-hidden="true">${OVERVIEW_ICONS.FOLDER}</span>
              Active Projects
            </div>
            <button type="button" class="overview-panel-action" data-tab="projects">View all</button>
          </div>
          <div class="overview-panel-body">
            <table class="overview-table" id="overview-projects-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody id="overview-projects-tbody">
                <tr><td colspan="4" class="loading-cell">Loading projects...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Revenue Chart Panel -->
        <div class="overview-panel">
          <div class="overview-panel-header">
            <div class="overview-panel-title">
              <span class="panel-icon panel-icon-green" aria-hidden="true">${OVERVIEW_ICONS.DOLLAR}</span>
              Revenue - 2026
            </div>
          </div>
          <div class="overview-panel-body">
            <div class="revenue-chart-wrap" id="revenue-chart-container">
              <div class="revenue-chart-placeholder">Loading chart...</div>
            </div>
            <div class="revenue-kpis">
              <div class="revenue-kpi">
                <span class="revenue-kpi-label">Invoiced YTD</span>
                <span class="revenue-kpi-value" id="stat-invoiced-ytd">-</span>
              </div>
              <div class="revenue-kpi">
                <span class="revenue-kpi-label">Collected YTD</span>
                <span class="revenue-kpi-value" id="stat-collected-ytd">-</span>
              </div>
              <div class="revenue-kpi">
                <span class="revenue-kpi-label">Outstanding</span>
                <span class="revenue-kpi-value revenue-kpi-value--warning" id="stat-outstanding">-</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Activity + Leads + Project Health -->
      <div class="overview-col-aside">
        <!-- Activity Feed -->
        <div class="overview-panel">
          <div class="overview-panel-header">
            <div class="overview-panel-title">
              <span class="panel-icon" aria-hidden="true">${OVERVIEW_ICONS.ACTIVITY}</span>
              Activity
            </div>
            <button type="button" class="overview-panel-action" id="clear-activity-btn">Clear</button>
          </div>
          <div class="overview-panel-body overview-panel-body--compact">
            <ul class="activity-feed" id="recent-activity-list" aria-live="polite">
              <li class="activity-item-loading">Loading activity...</li>
            </ul>
          </div>
        </div>

        <!-- New Leads -->
        <div class="overview-panel">
          <div class="overview-panel-header">
            <div class="overview-panel-title">
              <span class="panel-icon panel-icon-purple" aria-hidden="true">${OVERVIEW_ICONS.RADAR}</span>
              New Leads
              <span class="panel-badge" id="leads-count-badge">0</span>
            </div>
            <button type="button" class="overview-panel-action" data-tab="leads">View all</button>
          </div>
          <div class="overview-panel-body overview-panel-body--compact">
            <ul class="leads-list" id="overview-leads-list" aria-live="polite">
              <li class="leads-item-loading">Loading leads...</li>
            </ul>
          </div>
        </div>

        <!-- Project Health -->
        <div class="overview-panel">
          <div class="overview-panel-header">
            <div class="overview-panel-title">
              <span class="panel-icon panel-icon-green" aria-hidden="true">${OVERVIEW_ICONS.HEART}</span>
              Project Health
            </div>
          </div>
          <div class="overview-panel-body">
            <div class="health-chart-wrap" id="health-chart-container">
              <!-- Donut chart + legend will be rendered here -->
              <div class="health-placeholder">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

/**
 * Get greeting based on time of day
 */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
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
