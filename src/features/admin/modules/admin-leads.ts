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
import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
import { createTableDropdown, LEAD_STATUS_OPTIONS } from '../../../utils/table-dropdown';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  LEADS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import type { Lead, AdminDashboardContext } from '../admin-types';
import { loadProjects, showProjectDetails } from './admin-projects';
import { confirmDialog } from '../../../utils/confirm-dialog';

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
let storedContext: AdminDashboardContext | null = null;
let filterState: FilterState = loadFilterState(LEADS_FILTER_CONFIG.storageKey);
let filterUIInitialized = false;

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

/** Get cached element by ID */
function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

/**
 * Format budget/timeline values with proper capitalization
 */
function formatDisplayValue(value: string | undefined | null): string {
  if (!value || value === '-') return '-';

  // Handle special cases first
  const lowerValue = value.toLowerCase();

  // ASAP should be all caps
  if (lowerValue === 'asap') return 'ASAP';

  // Budget ranges: "under-1k" -> "Under 1k", "1000-2500" -> "$1,000-$2,500"
  if (lowerValue.includes('under')) {
    return value.replace(/under-?/gi, 'Under ').replace(/-/g, '');
  }

  // Replace hyphens with spaces and capitalize each word
  let formatted = value.replace(/-/g, ' ');
  formatted = formatted.replace(/\b\w/g, (char) => char.toUpperCase());

  return formatted;
}

export function getLeadsData(): Lead[] {
  return leadsData;
}

export async function loadLeads(ctx: AdminDashboardContext): Promise<void> {
  // Store context for global functions (activate from details panel)
  setLeadsContext(ctx);

  // Initialize filter UI once
  if (!filterUIInitialized) {
    initializeFilterUI(ctx);
    filterUIInitialized = true;
  }

  try {
    const response = await apiFetch('/api/admin/leads');

    if (response.ok) {
      const data: LeadsData = await response.json();
      leadsData = data.leads || [];
      updateLeadsDisplay(data, ctx);
    } else if (response.status !== 401) {
      // Don't show error for 401 - handled by apiFetch
      const errorText = await response.text();
      console.error('[AdminLeads] API error:', response.status, errorText);
      const tableBody = getElement('leads-table-body');
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" class="loading-row">Error loading leads: ${response.status}</td></tr>`;
      }
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to load leads:', error);
    const tableBody = getElement('leads-table-body');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="8" class="loading-row">Network error loading leads</td></tr>';
    }
  }
}

/**
 * Initialize filter UI for leads table
 */
function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = getElement('leads-filter-container');
  if (!container) return;

  // Create filter UI
  const filterUI = createFilterUI(
    LEADS_FILTER_CONFIG,
    filterState,
    (newState) => {
      filterState = newState;
      // Re-render table with new filters
      if (leadsData.length > 0) {
        renderLeadsTable(leadsData, ctx);
      }
    }
  );

  // Insert before the refresh button
  const refreshBtn = container.querySelector('#refresh-leads-btn');
  if (refreshBtn) {
    container.insertBefore(filterUI, refreshBtn);
  } else {
    container.appendChild(filterUI);
  }

  // Setup sortable headers after table is rendered
  setTimeout(() => {
    createSortableHeaders(LEADS_FILTER_CONFIG, filterState, (column, direction) => {
      filterState = { ...filterState, sortColumn: column, sortDirection: direction };
      saveFilterState(LEADS_FILTER_CONFIG.storageKey, filterState);
      if (leadsData.length > 0) {
        renderLeadsTable(leadsData, ctx);
      }
    });
  }, 100);
}

function updateLeadsDisplay(data: LeadsData, ctx: AdminDashboardContext): void {
  // Update overview stats
  const statTotal = getElement('stat-total-leads');
  const statPending = getElement('stat-pending-leads');
  const statVisitors = getElement('stat-visitors');

  // Update leads tab stats
  const leadsTotal = getElement('leads-total');
  const leadsPending = getElement('leads-pending');
  const leadsActive = getElement('leads-active');
  const leadsCompleted = getElement('leads-completed');

  if (statTotal) statTotal.textContent = data.stats?.total?.toString() || '0';
  if (statPending) statPending.textContent = data.stats?.pending?.toString() || '0';
  if (statVisitors) statVisitors.textContent = '0';
  if (leadsTotal) leadsTotal.textContent = data.stats?.total?.toString() || '0';
  if (leadsPending) leadsPending.textContent = data.stats?.pending?.toString() || '0';
  if (leadsActive) leadsActive.textContent = data.stats?.active?.toString() || '0';
  if (leadsCompleted) leadsCompleted.textContent = data.stats?.completed?.toString() || '0';

  // Update recent activity list (leads appear as activity items)
  const recentList = getElement('recent-activity-list');
  if (recentList && data.leads) {
    const recentLeads = data.leads.slice(0, 5);
    if (recentLeads.length === 0) {
      recentList.innerHTML = '<li>No recent activity</li>';
    } else {
      recentList.innerHTML = recentLeads
        .map((lead) => {
          const date = new Date(lead.created_at).toLocaleDateString();
          const safeName = SanitizationUtils.escapeHtml(lead.contact_name || 'Unknown');
          return `<li data-activity-type="lead" data-activity-id="${lead.id}" class="clickable-activity">${date} - New Lead: ${safeName}</li>`;
        })
        .join('');

      // Add click handlers to recent activity items
      recentList.querySelectorAll('li[data-activity-type]').forEach((li) => {
        li.addEventListener('click', () => {
          const activityType = (li as HTMLElement).dataset.activityType;
          const activityId = parseInt((li as HTMLElement).dataset.activityId || '0');
          if (activityType === 'lead' && activityId) {
            showLeadDetails(activityId);
          }
        });
      });
    }
  }

  // Update leads table
  renderLeadsTable(data.leads, ctx);
}

function renderLeadsTable(leads: Lead[], ctx: AdminDashboardContext): void {
  const tableBody = getElement('leads-table-body');
  if (!tableBody) return;

  if (!leads || leads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">No leads found</td></tr>';
    return;
  }

  // Apply filters
  const filteredLeads = applyFilters(leads, filterState, LEADS_FILTER_CONFIG);

  if (filteredLeads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">No leads match the current filters</td></tr>';
    return;
  }

  // Clear and rebuild table
  tableBody.innerHTML = '';

  filteredLeads.forEach((lead) => {
    const date = new Date(lead.created_at).toLocaleDateString();
    const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.contact_name || '-'));
    const safeCompanyName = lead.company_name ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.company_name)) : '-';
    const safeEmail = SanitizationUtils.escapeHtml(lead.email || '-');
    const leadAny = lead as unknown as Record<string, string>;
    const projectType = leadAny.project_type || '-';
    const displayType = projectType !== '-' ? projectType.charAt(0).toUpperCase() + projectType.slice(1) : '-';
    const displayBudget = formatDisplayValue(leadAny.budget_range);
    const status = lead.status || 'pending';

    const row = document.createElement('tr');
    row.dataset.leadId = String(lead.id);

    // Add data cells
    row.innerHTML = `
      <td>${date}</td>
      <td>${safeContactName}</td>
      <td>${safeCompanyName}</td>
      <td>${safeEmail}</td>
      <td>${SanitizationUtils.escapeHtml(displayType)}</td>
      <td>${SanitizationUtils.escapeHtml(displayBudget)}</td>
      <td class="status-cell"></td>
    `;

    // Create custom dropdown for status
    const statusCell = row.querySelector('.status-cell');
    if (statusCell) {
      const dropdown = createTableDropdown({
        options: LEAD_STATUS_OPTIONS,
        currentValue: status,
        onChange: async (newStatus) => {
          await updateLeadStatus(lead.id, newStatus, ctx);
          // Update local data
          lead.status = newStatus as Lead['status'];
        }
      });
      statusCell.appendChild(dropdown);
    }

    // Add click handler for row (excluding status cell)
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.table-dropdown')) return;
      showLeadDetails(lead.id);
    });

    tableBody.appendChild(row);
  });
}

async function updateLeadStatus(id: number, status: string, ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiPut(`/api/admin/leads/${id}/status`, { status });
    if (response.ok) {
      ctx.showNotification('Status updated', 'success');
    } else if (response.status !== 401) {
      const error = await response.json();
      ctx.showNotification(error.message || 'Failed to update status', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to update status:', error);
    ctx.showNotification('Failed to update status', 'error');
  }
}

export function showLeadDetails(leadId: number): void {
  const lead = leadsData.find((l) => l.id === leadId);
  if (!lead) return;

  const detailsPanel = getElement('lead-details-panel');
  const overlay = getElement('details-overlay');
  if (!detailsPanel) return;

  const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.contact_name || '-'));
  const safeCompanyName = lead.company_name ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(lead.company_name)) : '';
  const safeEmail = SanitizationUtils.escapeHtml(lead.email || '-');
  const safePhone = SanitizationUtils.formatPhone(lead.phone || '');
  const safeProjectType = SanitizationUtils.escapeHtml(lead.project_type || '-');
  const safeDescription = SanitizationUtils.escapeHtml(lead.description || 'No description');
  const safeBudget = SanitizationUtils.escapeHtml(formatDisplayValue(lead.budget_range));
  const safeTimeline = SanitizationUtils.escapeHtml(formatDisplayValue(lead.timeline));
  const safeFeatures = SanitizationUtils.escapeHtml((lead.features || '-').replace(/,/g, ', '));
  const safeSource = SanitizationUtils.escapeHtml(lead.source || '-');

  // Show activate button only for pending/new leads
  const showActivateBtn = !lead.status || lead.status === 'pending' || lead.status === 'new' || lead.status === 'qualified';
  // Show view project button for activated leads
  const isActivated = lead.status === 'active' || lead.status === 'in_progress' || lead.status === 'on_hold' || lead.status === 'completed' || lead.status === 'converted';

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Intake Form Submission</h3>
      <button class="close-btn" onclick="window.closeDetailsPanel()">×</button>
    </div>
    <div class="details-content">
      <div class="project-detail-meta">
        <div class="meta-item">
          <span class="field-label">Name</span>
          <span class="meta-value">${safeContactName}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Email</span>
          <span class="meta-value">${safeEmail}</span>
        </div>
        ${safeCompanyName ? `
        <div class="meta-item">
          <span class="field-label">Company</span>
          <span class="meta-value">${safeCompanyName}</span>
        </div>
        ` : ''}
        <div class="meta-item">
          <span class="field-label">Phone</span>
          <span class="meta-value">${safePhone}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Status</span>
          <span class="meta-value" id="panel-lead-status-container"></span>
        </div>
        <div class="meta-item">
          <span class="field-label">Source</span>
          <span class="meta-value">${safeSource}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Project Type</span>
          <span class="meta-value">${safeProjectType}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Budget</span>
          <span class="meta-value">${safeBudget}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Timeline</span>
          <span class="meta-value">${safeTimeline}</span>
        </div>
        <div class="meta-item">
          <span class="field-label">Created</span>
          <span class="meta-value">${new Date(lead.created_at).toLocaleString()}</span>
        </div>
      </div>
      <div class="project-description-row">
        <div class="meta-item description-item">
          <span class="field-label">Description</span>
          <span class="meta-value">${safeDescription}</span>
        </div>
      </div>
      <div class="project-description-row">
        <div class="meta-item description-item">
          <span class="field-label">Features</span>
          <span class="meta-value">${safeFeatures}</span>
        </div>
      </div>
      <div class="details-actions">
        ${showActivateBtn ? `<button class="btn details-activate-btn" data-id="${lead.id}">Activate as Project</button>` : ''}
        ${isActivated ? `<button class="btn details-view-project-btn" data-id="${lead.id}">View Project</button>` : ''}
      </div>
    </div>
  `;

  // Add custom dropdown for status in panel
  const statusContainer = detailsPanel.querySelector('#panel-lead-status-container');
  if (statusContainer && storedContext) {
    const dropdown = createTableDropdown({
      options: LEAD_STATUS_OPTIONS,
      currentValue: lead.status || 'pending',
      onChange: async (newStatus) => {
        await updateLeadStatus(lead.id, newStatus, storedContext!);
        lead.status = newStatus as Lead['status'];
        // Update table row dropdown if visible
        const tableDropdown = document.querySelector(`tr[data-lead-id="${lead.id}"] .table-dropdown`);
        if (tableDropdown) {
          const textEl = tableDropdown.querySelector('.custom-dropdown-text');
          if (textEl) {
            const option = LEAD_STATUS_OPTIONS.find(o => o.value === newStatus);
            textEl.textContent = option?.label || newStatus;
          }
          (tableDropdown as HTMLElement).dataset.status = newStatus;
        }
      }
    });
    statusContainer.appendChild(dropdown);
  }

  // Add click handler for activate button
  const activateBtn = detailsPanel.querySelector('.details-activate-btn');
  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      const id = (activateBtn as HTMLElement).dataset.id;
      if (!id) return;
      const confirmed = await confirmDialog({
        title: 'Activate Lead',
        message: 'Activate this lead as a project?',
        confirmText: 'Activate',
        icon: 'question'
      });
      if (confirmed) {
        window.activateLeadFromPanel(parseInt(id));
      }
    });
  }

  // Add click handler for view project button
  const viewProjectBtn = detailsPanel.querySelector('.details-view-project-btn');
  if (viewProjectBtn) {
    viewProjectBtn.addEventListener('click', () => {
      const id = (viewProjectBtn as HTMLElement).dataset.id;
      if (id) {
        window.closeDetailsPanel();
        window.viewProjectFromLead(parseInt(id));
      }
    });
  }

  // Show overlay and panel
  if (overlay) overlay.classList.remove('hidden');
  detailsPanel.classList.remove('hidden');
}

export function setLeadsContext(ctx: AdminDashboardContext): void {
  storedContext = ctx;
}

// Global functions for details panel
declare global {
  interface Window {
    closeDetailsPanel: () => void;
    activateLeadFromPanel: (leadId: number) => void;
    viewProjectFromLead: (projectId: number) => void;
  }
}

window.closeDetailsPanel = function (): void {
  // Close lead details panel
  const leadDetailsPanel = getElement('lead-details-panel');
  if (leadDetailsPanel) leadDetailsPanel.classList.add('hidden');
  // Close contact details panel
  const contactDetailsPanel = getElement('contact-details-panel');
  if (contactDetailsPanel) contactDetailsPanel.classList.add('hidden');
  // Close overlay
  const overlay = getElement('details-overlay');
  if (overlay) overlay.classList.add('hidden');
};

window.activateLeadFromPanel = function (leadId: number): void {
  if (storedContext) {
    activateLead(leadId, storedContext).then(() => {
      window.closeDetailsPanel();
    });
  }
};

window.viewProjectFromLead = function (projectId: number): void {
  if (storedContext) {
    // Switch to projects tab
    storedContext.switchTab('projects');
    // Show project details after a brief delay to allow tab switch
    setTimeout(() => {
      import('./admin-projects').then((module) => {
        module.showProjectDetails(projectId, storedContext!);
      });
    }, 100);
  }
};

export async function activateLead(
  leadId: number,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/leads/${leadId}/activate`);

    if (response.ok) {
      const data = await response.json();
      ctx.showNotification('Lead activated successfully!', 'success');

      // Load projects data and navigate to project detail page
      await loadProjects(ctx);
      const projectId = data.projectId || leadId;
      showProjectDetails(projectId, ctx);
    } else if (response.status !== 401) {
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
  try {
    const response = await apiPost(`/api/admin/leads/${leadId}/invite`, { email });

    if (response.ok) {
      ctx.showNotification('Invitation sent successfully!', 'success');
    } else if (response.status !== 401) {
      const error = await response.json();
      ctx.showNotification(error.message || 'Failed to send invitation', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to invite lead:', error);
    ctx.showNotification('Failed to send invitation', 'error');
  }
}
