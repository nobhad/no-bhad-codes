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
import { formatDateTime } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';

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
export async function loadOverviewData(_ctx: AdminDashboardContext): Promise<void> {
  try {
    // Load all dashboard data in parallel
    const [dashboardData] = await Promise.all([
      loadDashboardData(),
      loadRecentActivity()
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
