/**
 * ===============================================
 * ADMIN LEADS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-leads.ts
 *
 * Lead management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import type { Lead, AdminDashboardContext } from '../admin-types';

interface LeadsData {
  leads: Lead[];
  stats: {
    total: number;
    pending: number;
    active: number;
    completed: number;
  };
}

let leadsData: Lead[] = [];

export function getLeadsData(): Lead[] {
  return leadsData;
}

export async function loadLeads(ctx: AdminDashboardContext): Promise<void> {
  if (ctx.isDemo()) {
    console.log('[AdminLeads] Skipping load - demo mode');
    return;
  }

  console.log('[AdminLeads] Loading leads...');

  try {
    const response = await fetch('/api/admin/leads', {
      credentials: 'include'
    });

    console.log('[AdminLeads] Response status:', response.status);

    if (response.ok) {
      const data: LeadsData = await response.json();
      console.log('[AdminLeads] Received data:', {
        leadsCount: data.leads?.length || 0,
        stats: data.stats
      });
      leadsData = data.leads || [];
      updateLeadsDisplay(data, ctx);
    } else {
      const errorText = await response.text();
      console.error('[AdminLeads] API error:', response.status, errorText);
      // Show error in table
      const tableBody = document.getElementById('leads-table-body');
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-row">Error loading leads: ${response.status}</td></tr>`;
      }
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to load leads:', error);
    // Show error in table
    const tableBody = document.getElementById('leads-table-body');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">Network error loading leads</td></tr>';
    }
  }
}

function updateLeadsDisplay(data: LeadsData, ctx: AdminDashboardContext): void {
  // Update overview stats
  const statTotal = document.getElementById('stat-total-leads');
  const statPending = document.getElementById('stat-pending-leads');
  const statVisitors = document.getElementById('stat-visitors');

  // Update leads tab stats
  const leadsTotal = document.getElementById('leads-total');
  const leadsPending = document.getElementById('leads-pending');
  const leadsActive = document.getElementById('leads-active');
  const leadsCompleted = document.getElementById('leads-completed');

  if (statTotal) statTotal.textContent = data.stats?.total?.toString() || '0';
  if (statPending) statPending.textContent = data.stats?.pending?.toString() || '0';
  if (statVisitors) statVisitors.textContent = '0';
  if (leadsTotal) leadsTotal.textContent = data.stats?.total?.toString() || '0';
  if (leadsPending) leadsPending.textContent = data.stats?.pending?.toString() || '0';
  if (leadsActive) leadsActive.textContent = data.stats?.active?.toString() || '0';
  if (leadsCompleted) leadsCompleted.textContent = data.stats?.completed?.toString() || '0';

  // Update recent leads list
  const recentList = document.getElementById('recent-leads-list');
  if (recentList && data.leads) {
    const recentLeads = data.leads.slice(0, 5);
    if (recentLeads.length === 0) {
      recentList.innerHTML = '<li>No leads yet</li>';
    } else {
      recentList.innerHTML = recentLeads
        .map((lead) => {
          const date = new Date(lead.created_at).toLocaleDateString();
          const safeName = SanitizationUtils.escapeHtml(lead.contact_name || 'Unknown');
          return `<li>${safeName} - ${date}</li>`;
        })
        .join('');
    }
  }

  // Update leads table
  renderLeadsTable(data.leads, ctx);
}

function renderLeadsTable(leads: Lead[], ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('leads-table-body');
  if (!tableBody) return;

  if (!leads || leads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">No leads found</td></tr>';
    return;
  }

  tableBody.innerHTML = leads
    .map((lead) => {
      const date = new Date(lead.created_at).toLocaleDateString();
      const statusClass = `status-${lead.status || 'new'}`;
      const showActivateBtn = lead.status === 'new' || lead.status === 'qualified';

      const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.contact_name || '-'));
      const safeCompanyName = lead.company_name ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.company_name)) : '';
      const safeEmail = SanitizationUtils.escapeHtml(lead.email || '-');
      const leadAny = lead as unknown as Record<string, string>;
      const safeProjectType = SanitizationUtils.escapeHtml(leadAny.project_type || '-');
      const safeBudget = SanitizationUtils.escapeHtml(leadAny.budget_range || '-');
      const safeStatus = SanitizationUtils.escapeHtml(lead.status || 'new');

      return `
        <tr data-lead-id="${lead.id}">
          <td>${date}</td>
          <td>${safeContactName}</td>
          <td>${safeCompanyName}</td>
          <td>${safeEmail}</td>
          <td>${safeProjectType}</td>
          <td>${safeBudget}</td>
          <td>
            <span class="status-badge ${statusClass}">${safeStatus}</span>
            ${showActivateBtn ? `<button class="action-btn action-convert activate-lead-btn" data-id="${lead.id}" onclick="event.stopPropagation()" style="margin-left: 0.5rem;">Activate</button>` : ''}
          </td>
        </tr>
      `;
    })
    .join('');

  // Add click handlers
  const rows = tableBody.querySelectorAll('tr[data-lead-id]');
  rows.forEach((row) => {
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      const leadId = parseInt((row as HTMLElement).dataset.leadId || '0');
      showLeadDetails(leadId);
    });
  });

  // Add click handlers for activate buttons
  const activateBtns = tableBody.querySelectorAll('.activate-lead-btn');
  activateBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id && confirm('Activate this lead as a project?')) {
        activateLead(parseInt(id), ctx);
      }
    });
  });
}

export function showLeadDetails(leadId: number): void {
  const lead = leadsData.find((l) => l.id === leadId);
  if (!lead) return;

  const detailsPanel = document.getElementById('lead-details-panel');
  const overlay = document.getElementById('details-overlay');
  if (!detailsPanel) return;

  const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.contact_name || '-'));
  const safeCompanyName = lead.company_name ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.company_name)) : '';
  const safeEmail = SanitizationUtils.escapeHtml(lead.email || '-');
  const safePhone = SanitizationUtils.escapeHtml(lead.phone || '-');
  const safeProjectType = SanitizationUtils.escapeHtml(lead.project_type || '-');
  const safeDescription = SanitizationUtils.escapeHtml(lead.description || 'No description');
  const safeBudget = SanitizationUtils.escapeHtml(lead.budget_range || '-');
  const safeTimeline = SanitizationUtils.escapeHtml(lead.timeline || '-');
  const safeFeatures = SanitizationUtils.escapeHtml(lead.features || '-');
  const safeSource = SanitizationUtils.escapeHtml(lead.source || '-');

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>${safeContactName}</h3>
      <button class="close-btn" onclick="window.closeDetailsPanel()">×</button>
    </div>
    <div class="details-content">
      ${safeCompanyName ? `<p><strong>Company:</strong> ${safeCompanyName}</p>` : ''}
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Phone:</strong> ${safePhone}</p>
      <p><strong>Status:</strong> ${lead.status}</p>
      <p><strong>Source:</strong> ${safeSource}</p>
      <hr class="details-divider">
      <p><strong>Project Type:</strong> ${safeProjectType}</p>
      <p><strong>Budget:</strong> ${safeBudget}</p>
      <p><strong>Timeline:</strong> ${safeTimeline}</p>
      <p><strong>Description:</strong> ${safeDescription}</p>
      <p><strong>Features:</strong> ${safeFeatures}</p>
      <hr class="details-divider">
      <p><strong>Created:</strong> ${new Date(lead.created_at).toLocaleString()}</p>
    </div>
  `;

  // Show overlay and panel
  if (overlay) overlay.classList.remove('hidden');
  detailsPanel.classList.remove('hidden');
}

// Global function to close details panel
declare global {
  interface Window {
    closeDetailsPanel: () => void;
  }
}

window.closeDetailsPanel = function (): void {
  const detailsPanel = document.getElementById('lead-details-panel');
  const overlay = document.getElementById('details-overlay');
  if (detailsPanel) detailsPanel.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
};

export async function activateLead(
  leadId: number,
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

  try {
    const response = await fetch(`/api/admin/leads/${leadId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (response.ok) {
      ctx.showNotification('Lead activated successfully!', 'success');
      await loadLeads(ctx);
    } else {
      const error = await response.json();
      ctx.showNotification(error.message || 'Failed to activate lead', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to activate lead:', error);
    ctx.showNotification('Failed to activate lead', 'error');
  }
}

export async function inviteLead(
  leadId: number,
  email: string,
  ctx: AdminDashboardContext
): Promise<void> {
  if (ctx.isDemo()) return;

  try {
    const response = await fetch(`/api/admin/leads/${leadId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });

    if (response.ok) {
      ctx.showNotification('Invitation sent successfully!', 'success');
    } else {
      const error = await response.json();
      ctx.showNotification(error.message || 'Failed to send invitation', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to invite lead:', error);
    ctx.showNotification('Failed to send invitation', 'error');
  }
}
