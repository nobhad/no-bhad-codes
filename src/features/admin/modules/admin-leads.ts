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
import { formatDisplayValue, formatDate, formatDateTime } from '../../../utils/format-utils';
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
import { createKanbanBoard, type KanbanColumn, type KanbanItem } from '../../../components/kanban-board';

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
let currentView: 'table' | 'pipeline' = 'table';
let kanbanBoard: ReturnType<typeof createKanbanBoard> | null = null;

// Pipeline stage configuration
const PIPELINE_STAGES = [
  { id: 'new', label: 'New', statuses: ['new', 'pending'], color: 'var(--portal-text-secondary)' },
  { id: 'contacted', label: 'Contacted', statuses: ['contacted'], color: 'var(--app-color-primary)' },
  { id: 'qualified', label: 'Qualified', statuses: ['qualified'], color: '#f59e0b' },
  { id: 'proposal', label: 'Proposal', statuses: ['proposal'], color: '#8b5cf6' },
  { id: 'won', label: 'Won', statuses: ['active', 'converted', 'completed'], color: 'var(--status-active)' },
  { id: 'lost', label: 'Lost', statuses: ['cancelled', 'rejected'], color: 'var(--status-cancelled)' }
];

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

  // Setup view toggle
  setupViewToggle(ctx);
}

/**
 * Set up view toggle between table and pipeline
 */
function setupViewToggle(ctx: AdminDashboardContext): void {
  const toggle = getElement('leads-view-toggle');
  if (!toggle || toggle.dataset.listenerAdded) return;
  toggle.dataset.listenerAdded = 'true';

  toggle.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('button');
    if (!button) return;

    const view = button.dataset.view as 'table' | 'pipeline';
    if (view && view !== currentView) {
      currentView = view;

      // Update active button
      toggle.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Toggle views
      const tableView = getElement('leads-table-view');
      const pipelineView = getElement('leads-pipeline-container');

      if (view === 'table') {
        if (tableView) tableView.style.display = 'block';
        if (pipelineView) pipelineView.classList.add('hidden');
        if (kanbanBoard) {
          kanbanBoard.destroy();
          kanbanBoard = null;
        }
      } else {
        if (tableView) tableView.style.display = 'none';
        if (pipelineView) pipelineView.classList.remove('hidden');
        renderPipelineView(ctx);
      }
    }
  });
}

/**
 * Render pipeline (Kanban) view
 */
function renderPipelineView(ctx: AdminDashboardContext): void {
  // Destroy existing board
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }

  const container = getElement('leads-pipeline-container');
  if (!container) return;

  // Build columns from stages
  const columns: KanbanColumn[] = PIPELINE_STAGES.map(stage => ({
    id: stage.id,
    title: stage.label,
    color: stage.color,
    items: leadsData
      .filter(lead => {
        const status = lead.status || 'pending';
        return stage.statuses.includes(status);
      })
      .map(lead => leadToKanbanItem(lead))
  }));

  // Create kanban board
  kanbanBoard = createKanbanBoard({
    containerId: 'leads-pipeline-container',
    columns,
    onItemMove: (itemId, _fromColumn, toColumn) => handleLeadStageChange(itemId, toColumn, ctx),
    onItemClick: (item) => {
      const lead = leadsData.find(l => l.id === item.id);
      if (lead) showLeadDetails(lead.id);
    },
    renderItem: renderLeadCard,
    emptyColumnText: 'No leads'
  });
}

/**
 * Convert lead to Kanban item
 */
function leadToKanbanItem(lead: Lead): KanbanItem {
  const leadAny = lead as unknown as Record<string, string | number>;
  return {
    id: lead.id,
    title: lead.contact_name || 'Unknown',
    subtitle: lead.company_name || undefined,
    metadata: {
      email: lead.email,
      budget: leadAny.budget_range,
      source: lead.source || 'Website',
      score: calculateLeadScore(lead),
      createdAt: lead.created_at
    }
  };
}

/**
 * Calculate a simple lead score
 */
function calculateLeadScore(lead: Lead): number {
  let score = 50; // Base score
  const leadAny = lead as unknown as Record<string, string | number>;

  // Budget factor
  const budget = String(leadAny.budget_range || '').toLowerCase();
  if (budget.includes('10000') || budget.includes('20000') || budget.includes('enterprise')) score += 20;
  else if (budget.includes('5000') || budget.includes('premium')) score += 15;
  else if (budget.includes('2500') || budget.includes('3000') || budget.includes('standard')) score += 10;

  // Company name (indicates B2B)
  if (lead.company_name) score += 10;

  // Timeline urgency
  const timeline = String(leadAny.timeline || '').toLowerCase();
  if (timeline.includes('asap') || timeline.includes('urgent') || timeline.includes('1 week')) score += 15;
  else if (timeline.includes('2 week') || timeline.includes('month')) score += 10;

  // Source quality
  const source = (lead.source || '').toLowerCase();
  if (source.includes('referral')) score += 15;
  else if (source.includes('linkedin') || source.includes('google')) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Get score class based on value
 */
function getScoreClass(score: number): string {
  if (score >= 70) return 'score-hot';
  if (score >= 50) return 'score-warm';
  return 'score-cold';
}

/**
 * Custom render for lead cards in pipeline
 */
function renderLeadCard(item: KanbanItem): string {
  const meta = item.metadata as {
    email?: string;
    budget?: string;
    source?: string;
    score?: number;
    createdAt?: string;
  };

  const score = meta.score || 50;
  const scoreClass = getScoreClass(score);
  const budget = meta.budget ? formatDisplayValue(meta.budget) : '';

  return `
    <div class="lead-card-score ${scoreClass}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ${score}
    </div>
    <div class="kanban-card-title">${SanitizationUtils.escapeHtml(String(item.title))}</div>
    ${item.subtitle ? `<div class="lead-card-company">${SanitizationUtils.escapeHtml(String(item.subtitle))}</div>` : ''}
    ${budget ? `<div class="lead-card-value">${SanitizationUtils.escapeHtml(budget)}</div>` : ''}
    <div class="lead-card-meta">
      ${meta.source ? `<span class="lead-card-source">${SanitizationUtils.escapeHtml(meta.source)}</span>` : ''}
      ${meta.createdAt ? `<span class="lead-card-date">${formatDate(meta.createdAt)}</span>` : ''}
    </div>
  `;
}

/**
 * Handle lead stage change from drag-drop
 */
async function handleLeadStageChange(
  itemId: string | number,
  toStage: string,
  ctx: AdminDashboardContext
): Promise<void> {
  const leadId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
  const lead = leadsData.find(l => l.id === leadId);
  if (!lead) return;

  // Map stage to status
  const stageToStatus: Record<string, string> = {
    'new': 'pending',
    'contacted': 'contacted',
    'qualified': 'qualified',
    'proposal': 'proposal',
    'won': 'converted',
    'lost': 'cancelled'
  };

  const newStatus = stageToStatus[toStage] || 'pending';
  await updateLeadStatus(leadId, newStatus, ctx);

  // Update local data
  lead.status = newStatus as Lead['status'];
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
          const date = formatDate(lead.created_at);
          const decoded = SanitizationUtils.decodeHtmlEntities(lead.contact_name || 'Unknown');
          const safeName = SanitizationUtils.escapeHtml(decoded);
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

  // Update leads view based on current view mode
  if (currentView === 'pipeline') {
    renderPipelineView(ctx);
  } else {
    renderLeadsTable(data.leads, ctx);
  }
}

function renderLeadsTable(leads: Lead[], ctx: AdminDashboardContext): void {
  const tableBody = getElement('leads-table-body');
  if (!tableBody) return;

  if (!leads || leads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="loading-row">No leads yet. New form submissions will appear here.</td></tr>';
    return;
  }

  // Apply filters
  const filteredLeads = applyFilters(leads, filterState, LEADS_FILTER_CONFIG);

  if (filteredLeads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="loading-row">No leads match the current filters. Try adjusting your filters.</td></tr>';
    return;
  }

  // Clear and rebuild table
  tableBody.innerHTML = '';

  filteredLeads.forEach((lead) => {
    const date = formatDate(lead.created_at);
    const decodedContact = SanitizationUtils.decodeHtmlEntities(lead.contact_name || '-');
    const decodedCompany = SanitizationUtils.decodeHtmlEntities(lead.company_name || '');
    const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedContact));
    const safeCompanyName = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '-';
    const safeEmail = SanitizationUtils.escapeHtml(lead.email || '-');
    const leadAny = lead as unknown as Record<string, string>;
    const projectType = leadAny.project_type || '-';
    const displayType = projectType !== '-' ? projectType.charAt(0).toUpperCase() + projectType.slice(1) : '-';
    const displayBudget = formatDisplayValue(leadAny.budget_range);
    const status = lead.status || 'pending';

    // Show convert button for qualified leads
    const showConvertBtn = status === 'qualified' || status === 'pending' || status === 'contacted';

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
      <td class="actions-cell">
        ${showConvertBtn ? `<button class="icon-btn icon-btn-convert btn-convert-lead" data-lead-id="${lead.id}" title="Convert to Project" aria-label="Convert to Project">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            <line x1="12" y1="11" x2="12" y2="17"></line>
            <line x1="9" y1="14" x2="15" y2="14"></line>
          </svg>
        </button>` : ''}
      </td>
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
          // Re-render to update convert button visibility
          renderLeadsTable(leadsData, ctx);
        }
      });
      statusCell.appendChild(dropdown);
    }

    // Add click handler for convert button
    const convertBtn = row.querySelector('.btn-convert-lead');
    if (convertBtn) {
      convertBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await confirmDialog({
          title: 'Convert to Project',
          message: `Convert "${decodedContact}" to an active project?`,
          confirmText: 'Convert',
          icon: 'folder-plus'
        });
        if (confirmed) {
          await activateLead(lead.id, ctx);
        }
      });
    }

    // Add click handler for row (excluding status cell and buttons)
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.table-dropdown') || target.closest('button')) return;
      showLeadDetails(lead.id);
    });

    tableBody.appendChild(row);
  });
}

async function updateLeadStatus(id: number, status: string, ctx: AdminDashboardContext): Promise<void> {
  try {
    let cancelled_by: string | null = null;
    let cancellation_reason: string | null = null;

    // If cancelling, ask who cancelled
    if (status === 'cancelled') {
      // First confirm they want to cancel
      const confirmCancel = await confirmDialog({
        title: 'Cancel Project',
        message: 'Are you sure you want to cancel this project?',
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Keep It',
        danger: true,
        icon: 'warning'
      });

      if (!confirmCancel) return;

      // Ask who initiated the cancellation and why
      const cancelInfo = await showCancelledByDialog();
      if (!cancelInfo) return; // User cancelled the dialog
      cancelled_by = cancelInfo.cancelled_by;
      cancellation_reason = cancelInfo.reason;
    }

    const body: { status: string; cancelled_by?: string; cancellation_reason?: string } = { status };
    if (cancelled_by) {
      body.cancelled_by = cancelled_by;
    }
    if (cancellation_reason) {
      body.cancellation_reason = cancellation_reason;
    }

    const response = await apiPut(`/api/admin/leads/${id}/status`, body);
    if (response.ok) {
      ctx.showNotification('Status updated', 'success');
    } else if (response.status !== 401) {
      ctx.showNotification('Failed to update status. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to update status:', error);
    ctx.showNotification('Failed to update status. Please try again.', 'error');
  }
}

interface CancellationInfo {
  cancelled_by: string;
  reason: string;
}

const CANCELLATION_REASONS = [
  { value: 'budget', label: 'Budget constraints' },
  { value: 'timeline', label: 'Timeline issues' },
  { value: 'scope', label: 'Scope changed' },
  { value: 'unresponsive', label: 'Client unresponsive' },
  { value: 'found_alternative', label: 'Found alternative' },
  { value: 'project_complete', label: 'Project no longer needed' },
  { value: 'other', label: 'Other' }
];

/**
 * Show dialog asking who cancelled and why
 */
async function showCancelledByDialog(): Promise<CancellationInfo | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cancel-dialog-title');

    const reasonOptions = CANCELLATION_REASONS.map(r =>
      `<option value="${r.value}">${r.label}</option>`
    ).join('');

    overlay.innerHTML = `
      <div class="confirm-dialog" style="max-width: 450px;">
        <h3 id="cancel-dialog-title" class="confirm-dialog-title">CANCELLATION DETAILS</h3>

        <div style="text-align: left; margin-bottom: var(--space-4);">
          <label class="field-label" style="margin-bottom: var(--space-2); display: block;">Who cancelled?</label>
          <div class="confirm-dialog-actions" style="justify-content: flex-start; margin-bottom: var(--space-4);">
            <button type="button" class="confirm-dialog-btn cancelled-by-btn" data-value="admin">I Cancelled</button>
            <button type="button" class="confirm-dialog-btn cancelled-by-btn" data-value="client">Client Cancelled</button>
          </div>

          <label class="field-label" style="margin-bottom: var(--space-2); display: block;">Reason</label>
          <select id="cancel-reason" class="form-input" style="width: 100%; margin-bottom: var(--space-3);">
            <option value="">Select a reason...</option>
            ${reasonOptions}
          </select>

          <div id="cancel-description-wrapper" style="display: none;">
            <label class="field-label" style="margin-bottom: var(--space-2); display: block;">Description (optional)</label>
            <textarea id="cancel-description" class="form-input" rows="2" placeholder="Additional details..." style="width: 100%; resize: vertical;"></textarea>
          </div>
        </div>

        <div class="confirm-dialog-actions">
          <button type="button" class="confirm-dialog-btn cancel-btn">Cancel</button>
          <button type="button" class="confirm-dialog-btn confirm-btn" style="color: var(--color-danger);" disabled>Confirm Cancellation</button>
        </div>
      </div>
    `;

    let selectedCancelledBy: string | null = null;

    const cancelledByBtns = overlay.querySelectorAll('.cancelled-by-btn');
    const reasonSelect = overlay.querySelector('#cancel-reason') as HTMLSelectElement;
    const descWrapper = overlay.querySelector('#cancel-description-wrapper') as HTMLElement;
    const descTextarea = overlay.querySelector('#cancel-description') as HTMLTextAreaElement;
    const confirmBtn = overlay.querySelector('.confirm-btn') as HTMLButtonElement;
    const cancelBtn = overlay.querySelector('.cancel-btn') as HTMLButtonElement;

    // Update confirm button state
    const updateConfirmState = () => {
      const hasWho = !!selectedCancelledBy;
      const hasReason = !!reasonSelect.value;
      confirmBtn.disabled = !(hasWho && hasReason);
    };

    // Who cancelled buttons
    cancelledByBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        cancelledByBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCancelledBy = (btn as HTMLElement).dataset.value || null;
        updateConfirmState();
      });
    });

    // Reason dropdown - show description for "other"
    reasonSelect.addEventListener('change', () => {
      descWrapper.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
      updateConfirmState();
    });

    const closeDialog = (result: CancellationInfo | null) => {
      overlay.classList.add('closing');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 150);
    };

    // Cancel button
    cancelBtn.addEventListener('click', () => closeDialog(null));

    // Confirm button
    confirmBtn.addEventListener('click', () => {
      if (!selectedCancelledBy || !reasonSelect.value) return;

      let reason = reasonSelect.value;
      if (reason === 'other' && descTextarea.value.trim()) {
        reason = descTextarea.value.trim();
      } else {
        // Get the label for the selected reason
        const selectedOption = CANCELLATION_REASONS.find(r => r.value === reason);
        if (selectedOption) {
          reason = selectedOption.label;
          if (descTextarea.value.trim()) {
            reason += `: ${descTextarea.value.trim()}`;
          }
        }
      }

      closeDialog({
        cancelled_by: selectedCancelledBy,
        reason
      });
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog(null);
    });

    // Close on Escape
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDialog(null);
    });

    document.body.appendChild(overlay);
  });
}

export function showLeadDetails(leadId: number): void {
  const lead = leadsData.find((l) => l.id === leadId);
  if (!lead) return;

  const detailsPanel = getElement('lead-details-panel');
  const overlay = getElement('details-overlay');
  if (!detailsPanel) return;

  const decodedContact = SanitizationUtils.decodeHtmlEntities(lead.contact_name || '-');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(lead.company_name || '');
  const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedContact));
  const safeCompanyName = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
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
  const isActivated = lead.status === 'active' || lead.status === 'in-progress' || lead.status === 'on-hold' || lead.status === 'completed' || lead.status === 'converted';

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Intake Form Submission</h3>
      <button class="close-btn" onclick="window.closeDetailsPanel()" aria-label="Close panel">×</button>
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
          <span class="meta-value">${formatDateTime(lead.created_at)}</span>
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
        icon: 'folder-plus'
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
      ctx.showNotification('Failed to activate lead. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to activate lead:', error);
    ctx.showNotification('Failed to activate lead. Please try again.', 'error');
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
      ctx.showNotification('Failed to send invitation. Please try again.', 'error');
    }
  } catch (error) {
    console.error('[AdminLeads] Failed to invite lead:', error);
    ctx.showNotification('Failed to send invitation. Please try again.', 'error');
  }
}
