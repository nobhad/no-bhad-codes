/**
 * ===============================================
 * ADMIN LEADS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-leads.ts
 *
 * Lead management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 *
 * REFACTORED: Uses createTableModule factory for core table
 * functionality while preserving custom features (pipeline view,
 * analytics, scoring rules, tasks, notes).
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDisplayValue, formatDate, formatDateTime } from '../../../utils/format-utils';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { ICONS } from '../../../constants/icons';
import { renderActionsCell, conditionalAction } from '../../../factories';
import { createTableDropdown, LEAD_STATUS_OPTIONS } from '../../../utils/table-dropdown';
import { initModalDropdown } from '../../../utils/modal-dropdown';
import { LEADS_FILTER_CONFIG } from '../../../utils/table-filter';
import type { Lead, AdminDashboardContext } from '../admin-types';
import { confirmDialog, multiPromptDialog } from '../../../utils/confirm-dialog';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { showToast } from '../../../utils/toast-notifications';
import { getCopyEmailButtonHtml } from '../../../utils/copy-email';
import { createKanbanBoard, type KanbanColumn, type KanbanItem } from '../../../components/kanban-board';
import { createPortalModal } from '../../../components/portal-modal';
import { createRowCheckbox, setupBulkSelectionHandlers, resetSelection, type BulkActionConfig } from '../../../utils/table-bulk-actions';
import { LEADS_EXPORT_CONFIG } from '../../../utils/table-export';
import { createViewToggle } from '../../../components/view-toggle';
import { renderEmptyState, renderErrorState } from '../../../components/empty-state';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { makeEditable } from '../../../components/inline-edit';
import {
  createTableModule,
  createPaginationConfig,
  type TableModuleHelpers
} from '../../../utils/table-module-factory';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('AdminLeads');

// ============================================================================
// TYPES
// ============================================================================

interface LeadsStats {
  total: number;
  new: number;
  inProgress: number;
  converted: number;
}

// ============================================================================
// MODULE STATE (view-specific, not handled by factory)
// ============================================================================

let currentView: 'table' | 'pipeline' = 'table';
let kanbanBoard: ReturnType<typeof createKanbanBoard> | null = null;
let pipelineLinkHandlersAttached = false;

// ============================================================================
// REACT INTEGRATION (island architecture)
// ============================================================================

// React mount functions - dynamically imported for code splitting
type ReactMountFn = typeof import('../../../react/features/admin/leads').mountLeadsTable;
type ReactUnmountFn = typeof import('../../../react/features/admin/leads').unmountLeadsTable;

let mountLeadsTable: ReactMountFn | null = null;
let unmountLeadsTable: ReactUnmountFn | null = null;
let reactTableMounted = false;
let reactMountContainer: HTMLElement | null = null;

/**
 * Check if React table is actually mounted (container exists and has content)
 */
function isReactTableActuallyMounted(): boolean {
  if (!reactTableMounted) return false;
  // Check if the container still exists in the DOM and has content
  if (!reactMountContainer || !reactMountContainer.isConnected || reactMountContainer.children.length === 0) {
    reactTableMounted = false;
    reactMountContainer = null;
    return false;
  }
  return true;
}

/** Check if React leads table should be used */
function shouldUseReactLeadsTable(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_leads') === 'true') return false;

  // Check feature flag in localStorage
  const localFlag = localStorage.getItem('feature_react_leads_table');
  if (localFlag === 'false') return false;
  if (localFlag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}

/** Lazy load React mount functions */
async function loadReactLeadsTable(): Promise<boolean> {
  if (mountLeadsTable && unmountLeadsTable) return true;

  try {
    const module = await import('../../../react/features/admin/leads');
    mountLeadsTable = module.mountLeadsTable;
    unmountLeadsTable = module.unmountLeadsTable;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

// Pipeline stage configuration
const PIPELINE_STAGES = [
  { id: 'new', label: 'New', statuses: ['new'], color: 'var(--portal-text-secondary)' },
  { id: 'contacted', label: 'Contacted', statuses: ['contacted'], color: 'var(--app-color-primary)' },
  { id: 'qualified', label: 'Qualified', statuses: ['qualified'], color: 'var(--color-warning-500)' },
  { id: 'in-progress', label: 'In Progress', statuses: ['in-progress'], color: 'var(--color-info-500)' },
  { id: 'won', label: 'Won', statuses: ['converted'], color: 'var(--status-active)' },
  { id: 'lost', label: 'Lost', statuses: ['lost', 'cancelled'], color: 'var(--status-cancelled)' }
];

// ============================================================================
// BULK ACTIONS
// ============================================================================

// Module reference holder - assigned after module creation to avoid forward references
let _leadsModuleRef: ReturnType<typeof createTableModule<Lead, LeadsStats>> | null = null;

const LEADS_BULK_CONFIG: BulkActionConfig = {
  tableId: 'leads',
  actions: [
    {
      id: 'update-status',
      label: 'Update status',
      icon: ICONS.PENCIL,
      variant: 'default',
      dropdownOptions: LEAD_STATUS_OPTIONS,
      handler: async (ids: number[], selectedStatus?: string) => {
        if (!_leadsModuleRef) return;
        const ctx = _leadsModuleRef.getContext();
        if (!selectedStatus || !ctx) return;
        try {
          const response = await apiPost('/api/admin/leads/bulk/status', {
            projectIds: ids,
            status: selectedStatus
          });
          if (response.ok) {
            ctx.showNotification(`Updated ${ids.length} lead${ids.length > 1 ? 's' : ''}`, 'success');
            resetSelection('leads');
            await _leadsModuleRef.load(ctx);
          } else {
            ctx.showNotification('Failed to update leads', 'error');
          }
        } catch (error) {
          logger.error(' Bulk status update error:', error);
          ctx.showNotification('Error updating leads', 'error');
        }
      }
    }
  ]
};

// ============================================================================
// ROW RENDERING
// ============================================================================

function buildLeadRow(
  lead: Lead,
  ctx: AdminDashboardContext,
  helpers: TableModuleHelpers<Lead>
): HTMLTableRowElement {
  const date = formatDate(lead.created_at);
  const decodedContact = SanitizationUtils.decodeHtmlEntities(lead.contact_name || '');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(lead.company_name || '');
  const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedContact));
  const safeCompanyName = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
  const safeEmail = SanitizationUtils.escapeHtml(lead.email || '');
  const leadAny = lead as unknown as Record<string, string>;
  const projectType = leadAny.project_type || '';
  const displayType = projectType ? projectType.charAt(0).toUpperCase() + projectType.slice(1) : '';
  const displayBudget = formatDisplayValue(leadAny.budget_range);
  const status = lead.status || 'new';
  const hasClient = typeof lead.client_id === 'number';

  const showConvertBtn = ['new', 'contacted', 'qualified', 'in-progress'].includes(status);

  const row = document.createElement('tr');
  row.dataset.leadId = String(lead.id);

  const wrapWithClientLink = (text: string) => hasClient
    ? `<a href="/admin/clients/${lead.client_id}" class="lead-link lead-link-client" data-client-id="${lead.client_id}" title="View client">${text}</a>`
    : text;

  const primaryName = safeCompanyName || safeContactName;
  const primaryContent = primaryName ? wrapWithClientLink(primaryName) : '';
  const secondaryContent = safeCompanyName && safeContactName ? wrapWithClientLink(safeContactName) : '';

  row.innerHTML = `
    ${createRowCheckbox('leads', lead.id)}
    <td class="identity-cell inline-editable-cell" data-label="Lead">
      ${primaryContent ? `<span class="identity-name" data-field="primary-name">${primaryContent}</span>` : '<span class="identity-name hidden" data-field="primary-name"></span>'}
      ${secondaryContent ? `<span class="identity-contact" data-field="secondary-name">${secondaryContent}</span>` : '<span class="identity-contact hidden" data-field="secondary-name"></span>'}
      <span class="identity-email">${safeEmail}</span>
    </td>
    <td class="type-cell" data-label="Type">
      <span class="type-value">${SanitizationUtils.escapeHtml(displayType)}</span>
      <span class="budget-stacked">${SanitizationUtils.escapeHtml(displayBudget)}</span>
    </td>
    <td class="status-cell" data-label="Status"><span class="date-stacked">${date}</span></td>
    <td class="amount-cell" data-label="Budget">${SanitizationUtils.escapeHtml(displayBudget)}</td>
    <td class="date-cell" data-label="Date">${date}</td>
    <td class="actions-cell" data-label="Actions">
      ${renderActionsCell([
    conditionalAction(showConvertBtn, 'convert-project', lead.id, { className: 'btn-convert-lead', dataAttrs: { 'lead-id': lead.id } })
  ])}
    </td>
  `;

  // Status dropdown
  const statusCell = row.querySelector('.status-cell');
  if (statusCell) {
    const dropdown = createTableDropdown({
      options: LEAD_STATUS_OPTIONS,
      currentValue: status,
      onChange: async (newStatus) => {
        await updateLeadStatus(lead.id, newStatus, ctx);
        helpers.updateItem(lead.id, { status: newStatus as Lead['status'] });
        helpers.rerender();
      }
    });
    statusCell.appendChild(dropdown);
  }

  // Convert button handler
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

  // Client link handlers
  if (lead.client_id) {
    row.querySelectorAll('.lead-link-client').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openClientDetails(lead.client_id!, ctx);
      });
    });
  }

  // Row click handler
  row.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.table-dropdown') || target.closest('button') || target.closest('.lead-link') || target.closest('.bulk-select-cell') || target.closest('.inline-editable-cell') || target.tagName === 'INPUT') return;
    showLeadDetails(lead.id);
  });

  // Inline editing
  setupInlineEditing(row, lead, hasClient, helpers);

  return row;
}

/**
 * Setup inline editing for lead name/company fields
 */
function setupInlineEditing(
  row: HTMLTableRowElement,
  lead: Lead,
  hasClient: boolean,
  helpers: TableModuleHelpers<Lead>
): void {
  const identityCell = row.querySelector('.identity-cell.inline-editable-cell') as HTMLElement;
  if (!identityCell) return;

  const hasBothNames = lead.company_name && lead.contact_name;
  const isPrimaryCompany = !!lead.company_name;

  // Primary name editing
  const primaryNameEl = identityCell.querySelector('.identity-name') as HTMLElement;
  if (primaryNameEl) {
    makeEditable(
      primaryNameEl,
      () => isPrimaryCompany ? (lead.company_name || '') : (lead.contact_name || ''),
      async (newValue) => {
        const fieldToUpdate = isPrimaryCompany ? 'company_name' : 'contact_name';
        const response = await apiPut(`/api/admin/leads/${lead.id}`, { [fieldToUpdate]: newValue || null });
        if (response.ok) {
          if (isPrimaryCompany) {
            helpers.updateItem(lead.id, { company_name: newValue || '' });
          } else {
            helpers.updateItem(lead.id, { contact_name: newValue || '' });
          }
          const displayName = newValue
            ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(newValue)))
            : '';
          primaryNameEl.innerHTML = hasClient && displayName
            ? `<a href="/admin/clients/${lead.client_id}" class="lead-link lead-link-client" data-client-id="${lead.client_id}" title="View client">${displayName}</a>`
            : displayName;
          primaryNameEl.style.display = displayName ? '' : 'none';
          showToast(`${isPrimaryCompany ? 'Company' : 'Name'} updated`, 'success');
        } else {
          showToast('Failed to update lead', 'error');
          throw new Error('Update failed');
        }
      },
      { placeholder: isPrimaryCompany ? 'Enter company' : 'Enter name' }
    );
  }

  // Secondary name editing
  const secondaryNameEl = identityCell.querySelector('.identity-contact') as HTMLElement;
  if (secondaryNameEl && hasBothNames) {
    makeEditable(
      secondaryNameEl,
      () => isPrimaryCompany ? (lead.contact_name || '') : (lead.company_name || ''),
      async (newValue) => {
        const fieldToUpdate = isPrimaryCompany ? 'contact_name' : 'company_name';
        const response = await apiPut(`/api/admin/leads/${lead.id}`, { [fieldToUpdate]: newValue || null });
        if (response.ok) {
          if (isPrimaryCompany) {
            helpers.updateItem(lead.id, { contact_name: newValue || '' });
          } else {
            helpers.updateItem(lead.id, { company_name: newValue || '' });
          }
          const displayName = newValue
            ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(SanitizationUtils.decodeHtmlEntities(newValue)))
            : '';
          secondaryNameEl.innerHTML = hasClient && displayName
            ? `<a href="/admin/clients/${lead.client_id}" class="lead-link lead-link-client" data-client-id="${lead.client_id}" title="View client">${displayName}</a>`
            : displayName;
          secondaryNameEl.style.display = displayName ? '' : 'none';
          showToast(`${isPrimaryCompany ? 'Name' : 'Company'} updated`, 'success');
        } else {
          showToast('Failed to update lead', 'error');
          throw new Error('Update failed');
        }
      },
      { placeholder: isPrimaryCompany ? 'Enter name' : 'Enter company' }
    );
  }
}

// ============================================================================
// MODULE CREATION (FACTORY)
// ============================================================================

const leadsModule = createTableModule<Lead, LeadsStats>({
  moduleId: 'leads',
  filterConfig: LEADS_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('leads'),
  columnCount: 7,
  apiEndpoint: '/api/admin/leads',
  bulkConfig: LEADS_BULK_CONFIG,
  exportConfig: LEADS_EXPORT_CONFIG,
  emptyMessage: 'No leads yet.',
  filterEmptyMessage: 'No leads match the current filters.',
  loadingMessage: 'Loading leads...',
  defaultSort: { column: 'status', direction: 'asc' },

  extractData: (json) => {
    const data = json as { leads: Lead[]; stats: LeadsStats };
    return {
      data: data.leads || [],
      stats: data.stats
    };
  },

  renderStats: (stats, _ctx) => {
    // Overview stats
    const statTotal = document.getElementById('stat-total-leads');
    const statNew = document.getElementById('stat-pending-leads');
    const statVisitors = document.getElementById('stat-visitors');

    // Leads tab stats
    const leadsTotal = document.getElementById('leads-total');
    const leadsNew = document.getElementById('leads-pending');
    const leadsInProgress = document.getElementById('leads-active');
    const leadsConverted = document.getElementById('leads-completed');

    if (statTotal) statTotal.textContent = stats.total?.toString() || '0';
    if (statNew) statNew.textContent = stats.new?.toString() || '0';
    if (statVisitors) statVisitors.textContent = '0';
    if (leadsTotal) leadsTotal.textContent = stats.total?.toString() || '0';
    if (leadsNew) leadsNew.textContent = stats.new?.toString() || '0';
    if (leadsInProgress) leadsInProgress.textContent = stats.inProgress?.toString() || '0';
    if (leadsConverted) leadsConverted.textContent = stats.converted?.toString() || '0';
  },

  renderRow: buildLeadRow,

  onDataLoaded: (leads, ctx) => {
    // Update recent activity list
    const recentList = document.getElementById('recent-activity-list');
    if (recentList && leads) {
      const recentLeads = leads.slice(0, 5);
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

    // Update view based on current mode
    if (currentView === 'pipeline') {
      renderPipelineView(ctx);
    }
  },

  onTableRendered: (filteredLeads, _ctx) => {
    // Initialize keyboard navigation
    initTableKeyboardNav({
      tableSelector: '.leads-table',
      rowSelector: 'tbody tr[data-lead-id]',
      onRowSelect: (row) => {
        const leadId = parseInt(row.dataset.leadId || '0');
        if (leadId) showLeadDetails(leadId);
      },
      focusClass: 'row-focused',
      selectedClass: 'row-selected'
    });

    // Setup bulk selection
    const allRowIds = filteredLeads.map(l => l.id);
    setupBulkSelectionHandlers({ tableId: 'leads', actions: [] }, allRowIds);
  }
});

// Initialize module reference for bulk actions
_leadsModuleRef = leadsModule;

// ============================================================================
// VIEW TOGGLE SETUP
// ============================================================================

const LEADS_TABLE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
const LEADS_PIPELINE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="9" y="8" width="6" height="13" rx="1"/><rect x="15" y="5" width="6" height="16" rx="1"/></svg>';

function setupViewToggle(ctx: AdminDashboardContext): void {
  const container = leadsModule.getElement('leads-filter-container');
  const existingToggle = leadsModule.getElement('leads-view-toggle');
  if (!container || !existingToggle || container.dataset.leadsViewToggleInit) return;
  container.dataset.leadsViewToggleInit = 'true';

  function applyView(view: 'table' | 'pipeline'): void {
    const tableView = leadsModule.getElement('leads-table-view');
    const pipelineView = leadsModule.getElement('leads-pipeline-container');
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

  const toggleEl = createViewToggle({
    id: 'leads-view-toggle',
    options: [
      { value: 'table', label: 'Table', title: 'Table View', ariaLabel: 'Table view', iconSvg: LEADS_TABLE_ICON },
      { value: 'pipeline', label: 'Pipeline', title: 'Pipeline View', ariaLabel: 'Pipeline view', iconSvg: LEADS_PIPELINE_ICON }
    ],
    value: currentView,
    onChange: (value) => {
      currentView = value as 'table' | 'pipeline';
      applyView(currentView);
    }
  });

  existingToggle.replaceWith(toggleEl);
}

// ============================================================================
// PIPELINE VIEW
// ============================================================================

function renderPipelineView(ctx: AdminDashboardContext): void {
  if (kanbanBoard) {
    kanbanBoard.destroy();
    kanbanBoard = null;
  }

  const container = leadsModule.getElement('leads-pipeline-container');
  if (!container) return;

  const leadsData = leadsModule.getData();

  const columns: KanbanColumn[] = PIPELINE_STAGES.map(stage => ({
    id: stage.id,
    title: stage.label,
    color: stage.color,
    items: leadsData
      .filter(lead => {
        const status = lead.status || 'new';
        return stage.statuses.includes(status);
      })
      .map(lead => leadToKanbanItem(lead))
  }));

  kanbanBoard = createKanbanBoard({
    containerId: 'leads-pipeline-container',
    columns,
    onItemMove: (itemId, _fromColumn, toColumn) => handleLeadStageChange(itemId, toColumn, ctx),
    onItemClick: (item) => {
      const lead = leadsModule.findById(item.id as number);
      if (lead) showLeadDetails(lead.id);
    },
    renderItem: renderLeadCard,
    emptyColumnText: 'No leads'
  });

  // Pipeline link handlers
  if (!pipelineLinkHandlersAttached && container) {
    pipelineLinkHandlersAttached = true;
    container.addEventListener('click', async (e: Event) => {
      const target = (e.target as HTMLElement).closest?.('.lead-card-client-link, .lead-card-project-link');
      const currentCtx = leadsModule.getContext();
      if (!target || !currentCtx) return;
      e.preventDefault();
      e.stopPropagation();
      const clientId = target.getAttribute('data-client-id');
      const projectId = target.getAttribute('data-project-id');
      if (clientId) openClientDetails(parseInt(clientId, 10), currentCtx);
      else if (projectId) {
        const { showProjectDetails } = await import('./admin-projects');
        showProjectDetails(parseInt(projectId, 10), currentCtx);
      }
    });
  }
}

function leadToKanbanItem(lead: Lead): KanbanItem {
  return {
    id: lead.id,
    title: SanitizationUtils.decodeHtmlEntities(lead.contact_name || 'Unknown'),
    subtitle: lead.company_name ? SanitizationUtils.decodeHtmlEntities(lead.company_name) : undefined,
    metadata: {
      email: lead.email,
      budget: lead.budget_range,
      source: lead.source || 'Website',
      score: calculateLeadScore(lead),
      createdAt: lead.created_at,
      clientId: lead.client_id,
      projectName: lead.project_name,
      isActivated: ['in-progress', 'converted'].includes(lead.status || '')
    }
  };
}

function calculateLeadScore(lead: Lead): number {
  let score = 50;
  const leadAny = lead as unknown as Record<string, string | number>;

  const budget = String(leadAny.budget_range || '').toLowerCase();
  if (budget.includes('10000') || budget.includes('20000') || budget.includes('enterprise')) score += 20;
  else if (budget.includes('5000') || budget.includes('premium')) score += 15;
  else if (budget.includes('2500') || budget.includes('3000') || budget.includes('standard')) score += 10;

  if (lead.company_name) score += 10;

  const timeline = String(leadAny.timeline || '').toLowerCase();
  if (timeline.includes('asap') || timeline.includes('urgent') || timeline.includes('1 week')) score += 15;
  else if (timeline.includes('2 week') || timeline.includes('month')) score += 10;

  const source = (lead.source || '').toLowerCase();
  if (source.includes('referral')) score += 15;
  else if (source.includes('linkedin') || source.includes('google')) score += 5;

  return Math.min(100, Math.max(0, score));
}

function getScoreClass(score: number): string {
  if (score >= 70) return 'score-hot';
  if (score >= 50) return 'score-warm';
  return 'score-cold';
}

function renderLeadCard(item: KanbanItem): string {
  const meta = item.metadata as {
    email?: string;
    budget?: string;
    source?: string;
    score?: number;
    createdAt?: string;
    clientId?: number;
    projectName?: string;
    isActivated?: boolean;
  };

  const score = meta.score || 50;
  const scoreClass = getScoreClass(score);
  const budget = meta.budget ? formatDisplayValue(meta.budget) : '';
  const titleEscaped = SanitizationUtils.escapeHtml(String(item.title));
  const nameContent = meta.clientId
    ? `<a href="/admin/clients/${meta.clientId}" class="lead-card-client-link" data-client-id="${meta.clientId}" title="View client">${titleEscaped}</a>`
    : titleEscaped;
  const projectName = meta.projectName ? SanitizationUtils.escapeHtml(String(meta.projectName)) : '';
  const projectContent = projectName && meta.isActivated
    ? `<a href="/admin/projects/${item.id}" class="lead-card-project-link" data-project-id="${item.id}" title="View project">${projectName}</a>`
    : projectName || '';
  const titleBlock = projectContent
    ? `<div class="kanban-card-title">${projectContent}</div><div class="lead-card-client-name">${nameContent}</div>`
    : `<div class="kanban-card-title">${nameContent}</div>`;

  return `
    <div class="lead-card-score ${scoreClass}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      ${score}
    </div>
    ${titleBlock}
    ${item.subtitle ? `<div class="lead-card-company">${SanitizationUtils.escapeHtml(String(item.subtitle))}</div>` : ''}
    ${budget ? `<div class="lead-card-value">${SanitizationUtils.escapeHtml(budget)}</div>` : ''}
    <div class="lead-card-meta">
      ${meta.source ? `<span class="lead-card-source">${SanitizationUtils.escapeHtml(meta.source)}</span>` : ''}
      ${meta.createdAt ? `<span class="lead-card-date">${formatDate(meta.createdAt)}</span>` : ''}
    </div>
  `;
}

async function handleLeadStageChange(
  itemId: string | number,
  toStage: string,
  ctx: AdminDashboardContext
): Promise<void> {
  const leadId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
  const lead = leadsModule.findById(leadId);
  if (!lead) return;

  const stageToStatus: Record<string, string> = {
    'new': 'new',
    'contacted': 'contacted',
    'qualified': 'qualified',
    'in-progress': 'in-progress',
    'won': 'converted',
    'lost': 'lost'
  };

  const newStatus = stageToStatus[toStage] || 'new';
  await updateLeadStatus(leadId, newStatus, ctx);
  leadsModule.updateItem(leadId, { status: newStatus as Lead['status'] });
}

// ============================================================================
// PUBLIC EXPORTS
// ============================================================================

/**
 * Cleanup function called when leaving the leads tab
 * Unmounts React components if they were mounted
 */
export function cleanupLeadsTab(): void {
  if (reactTableMounted && unmountLeadsTable) {
    unmountLeadsTable();
    reactTableMounted = false;
  }
}

export async function loadLeads(ctx: AdminDashboardContext): Promise<void> {
  logger.log(' loadLeads called');
  setLeadsContext(ctx);

  // Check if React implementation should be used
  const useReact = shouldUseReactLeadsTable();
  logger.log(' useReact:', useReact);
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      logger.log(' React table already mounted, returning');
      return; // Already mounted and working
    }

    // Lazy load and mount React LeadsTable
    const mountContainer = document.getElementById('react-leads-mount');
    logger.log(' Mount container found:', !!mountContainer);
    if (mountContainer) {
      const loaded = await loadReactLeadsTable();
      logger.log(' React module loaded:', loaded, 'mountLeadsTable:', !!mountLeadsTable);
      if (loaded && mountLeadsTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountLeadsTable) {
          unmountLeadsTable();
        }
        logger.log(' Mounting React LeadsTable...');
        mountLeadsTable(mountContainer, {
          getAuthToken: ctx.getAuthToken,
          onViewLead: (leadId: number) => showLeadDetails(leadId),
          showNotification: ctx.showNotification
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        reactMountSuccess = true;
        logger.log(' React LeadsTable mounted successfully');
      } else {
        logger.error(' React module failed to load, falling back to vanilla');
      }
    } else {
      logger.log(' No mount container found, falling back to vanilla');
    }

    if (reactMountSuccess) {
      return;
    }
    // Fall through to vanilla implementation if React failed
  }

  // Vanilla implementation
  setupViewToggle(ctx);
  await leadsModule.load(ctx);
}

export const getLeadsData = leadsModule.getData;

export function setLeadsContext(ctx: AdminDashboardContext): void {
  leadsModule.setContext(ctx);
}

// ============================================================================
// CLIENT DETAILS NAVIGATION
// ============================================================================

async function openClientDetails(clientId: number, ctx: AdminDashboardContext): Promise<void> {
  ctx.switchTab('clients');
  const clientsModule = await import('./admin-clients');
  clientsModule.showClientDetails(clientId, ctx);
}

// ============================================================================
// STATUS UPDATE
// ============================================================================

async function updateLeadStatus(id: number, status: string, ctx: AdminDashboardContext): Promise<void> {
  try {
    let cancelled_by: string | null = null;
    let cancellation_reason: string | null = null;

    if (status === 'cancelled') {
      const confirmCancel = await confirmDialog({
        title: 'Cancel Project',
        message: 'Are you sure you want to cancel this project?',
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Keep It',
        danger: true,
        icon: 'warning'
      });

      if (!confirmCancel) return;

      const cancelInfo = await showCancelledByDialog();
      if (!cancelInfo) return;
      cancelled_by = cancelInfo.cancelled_by;
      cancellation_reason = cancelInfo.reason;
    }

    const normalizedStatus = String(status).trim().replace(/_/g, '-');
    const body: { status: string; cancelled_by?: string; cancellation_reason?: string } = { status: normalizedStatus };
    if (cancelled_by) body.cancelled_by = cancelled_by;
    if (cancellation_reason) body.cancellation_reason = cancellation_reason;

    const response = await apiPut(`/api/admin/leads/${id}/status`, body);
    if (response.ok) {
      ctx.showNotification('Status updated', 'success');
    } else if (response.status !== 401) {
      let message = 'Failed to update status. Please try again.';
      try {
        const data = (await response.json()) as { error?: string; message?: string };
        if (data?.error || data?.message) {
          message = data.error ?? data.message ?? message;
        }
      } catch {
        // use default
      }
      ctx.showNotification(message, 'error');
    }
  } catch (error) {
    logger.error(' Failed to update status:', error);
    ctx.showNotification('Failed to update status. Please try again.', 'error');
  }
}

// ============================================================================
// CANCELLATION DIALOG
// ============================================================================

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

async function showCancelledByDialog(): Promise<CancellationInfo | null> {
  return new Promise((resolve) => {
    let selectedCancelledBy: string | null = null;
    let resolved = false;

    const reasonOptions = CANCELLATION_REASONS.map(r =>
      `<option value="${r.value}">${r.label}</option>`
    ).join('');

    const modal = createPortalModal({
      id: 'cancel-dialog-modal',
      titleId: 'cancel-dialog-title',
      title: 'Cancellation Details',
      icon: ICONS.X,
      onClose: () => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }
    });

    modal.body.innerHTML = `
      <div class="form-group">
        <label class="form-label">Who cancelled?</label>
        <div class="btn-group flex gap-2 mb-4">
          <button type="button" class="btn btn-outline cancelled-by-btn" data-value="admin">I Cancelled</button>
          <button type="button" class="btn btn-outline cancelled-by-btn" data-value="client">Client Cancelled</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Reason</label>
        <select id="cancel-reason" class="form-input">
          <option value="">Select a reason...</option>
          ${reasonOptions}
        </select>
      </div>
      <div id="cancel-description-wrapper" class="form-group" style="display: none;">
        <label class="form-label">Description (optional)</label>
        <textarea id="cancel-description" class="form-input" rows="2" placeholder="Additional details..."></textarea>
      </div>
    `;

    modal.footer.innerHTML = `
      <button type="button" class="btn btn-outline cancel-btn">Cancel</button>
      <button type="button" class="btn btn-danger confirm-btn" disabled>Confirm Cancellation</button>
    `;

    document.body.appendChild(modal.overlay);
    modal.show();

    const cancelledByBtns = modal.body.querySelectorAll('.cancelled-by-btn');
    const reasonSelect = modal.body.querySelector('#cancel-reason') as HTMLSelectElement;
    const descWrapper = modal.body.querySelector('#cancel-description-wrapper') as HTMLElement;
    const descTextarea = modal.body.querySelector('#cancel-description') as HTMLTextAreaElement;
    const confirmBtn = modal.footer.querySelector('.confirm-btn') as HTMLButtonElement;
    const cancelBtn = modal.footer.querySelector('.cancel-btn') as HTMLButtonElement;

    if (reasonSelect && !reasonSelect.dataset.dropdownInit) {
      reasonSelect.dataset.dropdownInit = 'true';
      initModalDropdown(reasonSelect, { placeholder: 'Select a reason...' });
    }

    const updateConfirmState = () => {
      confirmBtn.disabled = !(selectedCancelledBy && reasonSelect.value);
    };

    cancelledByBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        cancelledByBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCancelledBy = (btn as HTMLElement).dataset.value || null;
        updateConfirmState();
      });
    });

    reasonSelect.addEventListener('change', () => {
      descWrapper.style.display = reasonSelect.value === 'other' ? 'block' : 'none';
      updateConfirmState();
    });

    cancelBtn.addEventListener('click', () => {
      resolved = true;
      modal.hide();
      resolve(null);
    });

    confirmBtn.addEventListener('click', () => {
      if (!selectedCancelledBy || !reasonSelect.value) return;

      let reason = reasonSelect.value;
      if (reason === 'other' && descTextarea.value.trim()) {
        reason = descTextarea.value.trim();
      } else {
        const selectedOption = CANCELLATION_REASONS.find(r => r.value === reason);
        if (selectedOption) {
          reason = selectedOption.label;
          if (descTextarea.value.trim()) {
            reason += `: ${descTextarea.value.trim()}`;
          }
        }
      }

      resolved = true;
      modal.hide();
      resolve({ cancelled_by: selectedCancelledBy, reason });
    });

    const escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (!resolved) {
          resolved = true;
          modal.hide();
          resolve(null);
        }
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}

// ============================================================================
// LEAD DETAILS PANEL
// ============================================================================

export async function showLeadDetails(leadId: number): Promise<void> {
  const lead = leadsModule.findById(leadId);
  if (!lead) return;

  const detailsPanel = leadsModule.getElement('lead-details-panel');
  const overlay = leadsModule.getElement('details-overlay');
  if (!detailsPanel) return;

  const storedContext = leadsModule.getContext();

  const decodedContact = SanitizationUtils.decodeHtmlEntities(lead.contact_name || '');
  const decodedCompany = SanitizationUtils.decodeHtmlEntities(lead.company_name || '');
  const safeContactName = SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedContact));
  const safeCompanyName = decodedCompany ? SanitizationUtils.escapeHtml(SanitizationUtils.capitalizeName(decodedCompany)) : '';
  const safeEmail = SanitizationUtils.escapeHtml(lead.email || '');
  const safePhone = SanitizationUtils.formatPhone(lead.phone || '');
  const safeProjectType = SanitizationUtils.escapeHtml(lead.project_type || '');
  const safeDescription = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(lead.description || 'No description'));
  const safeBudget = SanitizationUtils.escapeHtml(formatDisplayValue(lead.budget_range));
  const safeTimeline = SanitizationUtils.escapeHtml(formatDisplayValue(lead.timeline));
  const safeFeatures = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities((lead.features || '').replace(/,/g, ', ')));
  const safeSource = SanitizationUtils.escapeHtml(lead.source || '');
  const hasClient = typeof lead.client_id === 'number';
  const safeProjectName = lead.project_name ? SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(lead.project_name)) : '';

  const score = calculateLeadScore(lead);
  const scoreClass = getScoreClass(score);
  const showActivateBtn = !lead.status || ['new', 'contacted', 'qualified'].includes(lead.status);
  const isActiveProject = ['in-progress', 'converted'].includes(lead.status || '');

  const [tasks, notes] = await Promise.all([loadLeadTasks(leadId), loadLeadNotes(leadId)]);

  const companyValue = safeCompanyName && hasClient
    ? `<a href="#" class="panel-link panel-link-client" data-client-id="${lead.client_id}" title="View client">${safeCompanyName}</a>`
    : safeCompanyName;
  const nameValue = hasClient
    ? `<a href="#" class="panel-link panel-link-client" data-client-id="${lead.client_id}" title="View client">${safeContactName}</a>`
    : safeContactName;
  const projectValue = safeProjectName
    ? isActiveProject
      ? `<a href="#" class="panel-link panel-link-project" data-project-id="${lead.id}" title="View project">${safeProjectName}</a>`
      : safeProjectName
    : '—';

  detailsPanel.innerHTML = `
    <div class="details-header">
      <h3>Lead Details</h3>
      <div class="lead-score-badge ${scoreClass}">Score: ${score}</div>
      <button class="close-btn btn-close-details-panel" aria-label="Close panel">×</button>
    </div>
    <div class="lead-details-created">Created ${formatDateTime(lead.created_at)}</div>
    <div class="details-actions">
      ${showActivateBtn ? `<button type="button" class="icon-btn details-activate-btn" data-id="${lead.id}" title="Activate as Project" aria-label="Activate as Project">${ICONS.ROCKET}</button>` : ''}
    </div>
    <div class="panel-status-row">
      <span class="field-label">Status</span>
      <span id="panel-lead-status-container"></span>
    </div>
    <div class="details-content">
      <div class="lead-details-tabs">
        <button class="lead-tab active" data-tab="overview">Overview</button>
        <button class="lead-tab" data-tab="tasks">Tasks (${tasks.length})</button>
        <button class="lead-tab" data-tab="notes">Notes (${notes.length})</button>
      </div>
      <div class="lead-tab-content active" data-tab-content="overview">
        <div class="project-detail-meta">
          <div class="meta-item">
            <span class="field-label">Project</span>
            <span class="meta-value">${projectValue}</span>
          </div>
          ${safeCompanyName ? `<div class="meta-item"><span class="field-label">Company</span><span class="meta-value">${companyValue}</span></div>` : ''}
          <div class="meta-item"><span class="field-label">Name</span><span class="meta-value">${nameValue}</span></div>
          <div class="meta-item"><span class="field-label">Email</span><span class="meta-value meta-value-with-copy">${safeEmail}${getCopyEmailButtonHtml(lead.email || '')}</span></div>
          <div class="meta-item"><span class="field-label">Phone</span><span class="meta-value">${safePhone}</span></div>
          ${lead.source?.trim() ? `<div class="meta-item"><span class="field-label">Source</span><span class="meta-value">${safeSource}</span></div>` : ''}
          <div class="meta-item"><span class="field-label">Project Type</span><span class="meta-value">${safeProjectType}</span></div>
          <div class="meta-item"><span class="field-label">Budget</span><span class="meta-value">${safeBudget}</span></div>
          <div class="meta-item"><span class="field-label">Timeline</span><span class="meta-value">${safeTimeline}</span></div>
        </div>
        <div class="project-description-row"><div class="meta-item description-item"><span class="field-label">Description</span><span class="meta-value">${safeDescription}</span></div></div>
        <div class="project-description-row"><div class="meta-item description-item"><span class="field-label">Features</span><span class="meta-value">${safeFeatures}</span></div></div>
      </div>
      <div class="lead-tab-content" data-tab-content="tasks">${renderLeadTasks(tasks, leadId)}</div>
      <div class="lead-tab-content" data-tab-content="notes">${renderLeadNotes(notes, leadId)}</div>
    </div>
  `;

  // Tab switching
  detailsPanel.querySelectorAll('.lead-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = (tab as HTMLElement).dataset.tab;
      detailsPanel.querySelectorAll('.lead-tab').forEach(t => t.classList.remove('active'));
      detailsPanel.querySelectorAll('.lead-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      detailsPanel.querySelector(`[data-tab-content="${tabName}"]`)?.classList.add('active');
    });
  });

  // Task actions
  detailsPanel.querySelectorAll('[data-action="toggle-task"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskItem = btn.closest('.lead-task-item');
      const taskId = parseInt((taskItem as HTMLElement)?.dataset.taskId || '0');
      if (taskId) completeTask(taskId, leadId);
    });
  });
  detailsPanel.querySelector('.add-lead-task-btn')?.addEventListener('click', () => showAddTaskDialog(leadId));

  // Note actions
  detailsPanel.querySelectorAll('[data-action="toggle-pin"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const noteItem = btn.closest('.lead-note-item');
      const noteId = parseInt((noteItem as HTMLElement)?.dataset.noteId || '0');
      if (noteId) toggleNotePin(noteId, leadId);
    });
  });
  detailsPanel.querySelector('.add-lead-note-btn')?.addEventListener('click', () => showAddNoteDialog(leadId));

  // Status dropdown
  const statusContainer = detailsPanel.querySelector('#panel-lead-status-container');
  if (statusContainer && storedContext) {
    const dropdown = createTableDropdown({
      options: LEAD_STATUS_OPTIONS,
      currentValue: lead.status || 'new',
      onChange: async (newStatus) => {
        await updateLeadStatus(lead.id, newStatus, storedContext);
        leadsModule.updateItem(lead.id, { status: newStatus as Lead['status'] });
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

  // Activate button
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

  // Panel links
  detailsPanel.querySelectorAll('.panel-link-client').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const clientId = (el as HTMLElement).dataset.clientId;
      if (clientId && storedContext) {
        window.closeDetailsPanel();
        openClientDetails(parseInt(clientId, 10), storedContext);
      }
    });
  });
  detailsPanel.querySelectorAll('.panel-link-project').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const projectId = (el as HTMLElement).dataset.projectId;
      if (projectId && storedContext) {
        window.closeDetailsPanel();
        const { showProjectDetails } = await import('./admin-projects');
        showProjectDetails(parseInt(projectId, 10), storedContext);
      }
    });
  });

  if (overlay) openModalOverlay(overlay);
  detailsPanel.classList.remove('hidden');
}

// ============================================================================
// GLOBAL FUNCTIONS
// ============================================================================

declare global {
  interface Window {
    closeDetailsPanel: () => void;
    activateLeadFromPanel: (leadId: number) => void;
    viewProjectFromLead: (projectId: number) => void;
  }
}

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.matches('.btn-close-details-panel')) {
    window.closeDetailsPanel();
  }
});

window.closeDetailsPanel = function (): void {
  const leadDetailsPanel = leadsModule.getElement('lead-details-panel');
  if (leadDetailsPanel) leadDetailsPanel.classList.add('hidden');
  const contactDetailsPanel = leadsModule.getElement('contact-details-panel');
  if (contactDetailsPanel) contactDetailsPanel.classList.add('hidden');
  const overlay = leadsModule.getElement('details-overlay');
  if (overlay) closeModalOverlay(overlay);
};

window.activateLeadFromPanel = function (leadId: number): void {
  const ctx = leadsModule.getContext();
  if (ctx) {
    activateLead(leadId, ctx).then(() => {
      window.closeDetailsPanel();
    });
  }
};

window.viewProjectFromLead = function (projectId: number): void {
  const ctx = leadsModule.getContext();
  if (ctx) {
    ctx.switchTab('projects');
    setTimeout(() => {
      import('./admin-projects').then((module) => {
        module.showProjectDetails(projectId, ctx);
      });
    }, 100);
  }
};

// ============================================================================
// ACTIVATE LEAD
// ============================================================================

export async function activateLead(leadId: number, ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/leads/${leadId}/activate`);

    if (response.ok) {
      const data = await response.json();
      ctx.showNotification('Lead activated successfully!', 'success');

      const { loadProjects, showProjectDetails } = await import('./admin-projects');
      await loadProjects(ctx);
      const projectId = data.projectId || leadId;
      showProjectDetails(projectId, ctx);
    } else if (response.status !== 401) {
      ctx.showNotification('Failed to activate lead. Please try again.', 'error');
    }
  } catch (error) {
    logger.error(' Failed to activate lead:', error);
    ctx.showNotification('Failed to activate lead. Please try again.', 'error');
  }
}

export async function inviteLead(leadId: number, email: string, ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/leads/${leadId}/invite`, { email });

    if (response.ok) {
      ctx.showNotification('Invitation sent successfully!', 'success');
    } else if (response.status !== 401) {
      ctx.showNotification('Failed to send invitation. Please try again.', 'error');
    }
  } catch (error) {
    logger.error(' Failed to invite lead:', error);
    ctx.showNotification('Failed to send invitation. Please try again.', 'error');
  }
}

// ============================================================================
// LEAD ANALYTICS
// ============================================================================

interface FunnelStage { stage: string; count: number; percentage: number; }
interface SourcePerformance { source: string; total: number; converted: number; conversionRate: number; }

export async function loadLeadAnalytics(): Promise<void> {
  await Promise.all([loadConversionFunnel(), loadSourcePerformance()]);
}

async function loadConversionFunnel(): Promise<void> {
  const container = leadsModule.getElement('leads-conversion-funnel');
  if (!container) return;

  try {
    const response = await apiFetch('/api/admin/leads/conversion-funnel');
    if (response.ok) {
      const data = await response.json();
      const raw = data?.funnel?.stages ?? data?.funnel;
      const stages = Array.isArray(raw) ? raw : [];
      const funnel: FunnelStage[] = stages.map((s: { name?: string; stage?: string; count: number; conversionRate?: number; percentage?: number }) => ({
        stage: s.name ?? s.stage ?? '',
        count: s.count ?? 0,
        percentage: s.percentage ?? (s.conversionRate !== undefined && s.conversionRate !== null ? s.conversionRate * 100 : 0)
      }));
      renderConversionFunnel(container, funnel);
    } else {
      renderErrorState(container, 'Unable to load funnel data', { type: 'general' });
    }
  } catch (error) {
    logger.error(' Failed to load conversion funnel:', error);
    renderErrorState(container, 'Error loading funnel', { type: 'general' });
  }
}

function renderConversionFunnel(container: HTMLElement, funnel: FunnelStage[]): void {
  const safeFunnel = Array.isArray(funnel) ? funnel : [];
  if (safeFunnel.length === 0) {
    renderEmptyState(container, 'No funnel data available');
    return;
  }

  const maxCount = Math.max(...safeFunnel.map(s => s.count), 1);
  const stageCount = safeFunnel.length;
  const allZero = safeFunnel.every(s => s.count === 0);
  const TAPER_RANGE = 85;

  container.innerHTML = safeFunnel.map((stage, index) => {
    let barWidth: number;
    let barClass = 'funnel-bar';
    if (allZero) {
      barWidth = stageCount > 1 ? 100 - (index * (TAPER_RANGE / (stageCount - 1))) : 100;
      barClass = 'funnel-bar funnel-bar-empty';
    } else {
      barWidth = Math.max((stage.count / maxCount) * 100, 8);
    }
    return `
      <div class="funnel-stage">
        <div class="funnel-stage-label">${SanitizationUtils.escapeHtml(stage.stage)}</div>
        <div class="funnel-bar-wrapper"><div class="${barClass}" style="width: ${barWidth}%"></div></div>
        <div class="funnel-stage-stats"><span class="funnel-count">${stage.count}</span><span class="funnel-percentage">${stage.percentage.toFixed(0)}%</span></div>
      </div>
    `;
  }).join('');
}

async function loadSourcePerformance(): Promise<void> {
  const container = leadsModule.getElement('leads-source-performance');
  if (!container) return;

  try {
    const response = await apiFetch('/api/admin/leads/source-performance');
    if (response.ok) {
      const data = await response.json();
      const rawSources = data.sources || [];
      const sources: SourcePerformance[] = rawSources
        .map((s: Record<string, unknown>) => ({
          source: String(s.sourceName ?? s.source ?? '').trim(),
          total: Number(s.leadCount ?? s.total ?? 0),
          converted: Number(s.wonCount ?? s.converted ?? 0),
          conversionRate: Number(s.conversionRate ?? 0)
        }))
        .filter((s: SourcePerformance) => s.source.length > 0);
      renderSourcePerformance(container, sources);
    } else {
      renderErrorState(container, 'Unable to load source data', { type: 'general' });
    }
  } catch (error) {
    logger.error(' Failed to load source performance:', error);
    renderErrorState(container, 'Error loading sources', { type: 'general' });
  }
}

function renderSourcePerformance(container: HTMLElement, sources: SourcePerformance[]): void {
  if (sources.length === 0) {
    renderEmptyState(container, 'No source data available');
    return;
  }

  container.innerHTML = sources.map(source => `
    <div class="source-item">
      <div class="source-name">${SanitizationUtils.escapeHtml(source.source)}</div>
      <div class="source-stats">
        <span class="source-total">${source.total} leads</span>
        <span class="source-converted">${source.converted} won</span>
        <span class="source-rate ${source.conversionRate > 20 ? 'rate-good' : ''}">${source.conversionRate.toFixed(0)}%</span>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// SCORING RULES
// ============================================================================

interface ScoringRule { id: number; name: string; description?: string; field_name: string; operator: string; threshold_value: string; points: number; is_active: boolean; }
let scoringRulesInitialized = false;

export async function loadScoringRules(): Promise<void> {
  if (!scoringRulesInitialized) {
    setupScoringRulesListeners();
    scoringRulesInitialized = true;
  }

  const container = leadsModule.getElement('scoring-rules-list');
  if (!container) return;

  try {
    const response = await apiFetch('/api/admin/leads/scoring-rules');
    if (response.ok) {
      const data: { rules: ScoringRule[] } = await response.json();
      renderScoringRules(container, data.rules || []);
    } else {
      renderErrorState(container, 'Unable to load scoring rules', { type: 'general' });
    }
  } catch (error) {
    logger.error(' Failed to load scoring rules:', error);
    renderErrorState(container, 'Error loading rules', { type: 'general' });
  }
}

function setupScoringRulesListeners(): void {
  const addBtn = leadsModule.getElement('add-scoring-rule-btn');
  if (addBtn && !addBtn.dataset.listenerAdded) {
    addBtn.dataset.listenerAdded = 'true';
    addBtn.addEventListener('click', () => showAddScoringRuleDialog());
  }
}

function renderScoringRules(container: HTMLElement, rules: ScoringRule[]): void {
  if (rules.length === 0) {
    renderEmptyState(container, 'No scoring rules configured');
    return;
  }

  container.innerHTML = rules.map(rule => `
    <div class="scoring-rule-item ${rule.is_active ? '' : 'rule-inactive'}" data-rule-id="${rule.id}">
      <div class="rule-info">
        <div class="rule-name">${SanitizationUtils.escapeHtml(rule.name)}</div>
        <div class="rule-condition"><code>${SanitizationUtils.escapeHtml(rule.field_name)}</code><span class="rule-operator">${SanitizationUtils.escapeHtml(rule.operator)}</span><code>${SanitizationUtils.escapeHtml(rule.threshold_value)}</code></div>
      </div>
      <div class="rule-points ${rule.points >= 0 ? 'points-positive' : 'points-negative'}">${rule.points >= 0 ? '+' : ''}${rule.points} pts</div>
      <div class="rule-actions">
        <button class="icon-btn" title="${rule.is_active ? 'Disable' : 'Enable'}" data-action="toggle" aria-label="${rule.is_active ? 'Disable rule' : 'Enable rule'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${rule.is_active ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}</svg>
        </button>
        <button class="icon-btn" title="Delete" data-action="delete" aria-label="Delete rule">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.scoring-rule-item').forEach(item => {
    const ruleId = parseInt((item as HTMLElement).dataset.ruleId || '0');
    item.querySelector('[data-action="toggle"]')?.addEventListener('click', () => toggleScoringRule(ruleId));
    item.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteScoringRule(ruleId));
  });
}

async function showAddScoringRuleDialog(): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Add Scoring Rule',
    fields: [
      { name: 'name', label: 'Rule Name', type: 'text', required: true },
      { name: 'field_name', label: 'Field', type: 'select', options: [
        { value: 'budget_range', label: 'Budget Range' }, { value: 'project_type', label: 'Project Type' },
        { value: 'timeline', label: 'Timeline' }, { value: 'source', label: 'Source' },
        { value: 'company_name', label: 'Company Name' }, { value: 'description', label: 'Description' }
      ], required: true },
      { name: 'operator', label: 'Operator', type: 'select', options: [
        { value: 'equals', label: 'Equals' }, { value: 'contains', label: 'Contains' },
        { value: 'in', label: 'In (comma-separated)' }, { value: 'not_empty', label: 'Not Empty' },
        { value: 'greater_than', label: 'Greater Than' }
      ], required: true },
      { name: 'threshold_value', label: 'Value', type: 'text', required: true },
      { name: 'points', label: 'Points', type: 'text', required: true }
    ],
    confirmText: 'Add Rule',
    cancelText: 'Cancel'
  });

  if (result) {
    try {
      const response = await apiPost('/api/admin/leads/scoring-rules', {
        name: result.name, field_name: result.field_name, operator: result.operator,
        threshold_value: result.threshold_value, points: parseInt(result.points) || 0
      });
      if (response.ok) {
        showToast('Scoring rule added', 'success');
        await loadScoringRules();
      } else {
        showToast('Failed to add rule', 'error');
      }
    } catch (error) {
      logger.error(' Failed to add scoring rule:', error);
      showToast('Error adding rule', 'error');
    }
  }
}

async function toggleScoringRule(ruleId: number): Promise<void> {
  try {
    const response = await apiPut(`/api/admin/leads/scoring-rules/${ruleId}`, { toggleActive: true });
    if (response.ok) {
      showToast('Rule updated', 'success');
      await loadScoringRules();
    } else {
      showToast('Failed to update rule', 'error');
    }
  } catch (error) {
    logger.error(' Failed to toggle scoring rule:', error);
    showToast('Error updating rule', 'error');
  }
}

async function deleteScoringRule(ruleId: number): Promise<void> {
  const confirmed = await confirmDialog({ title: 'Delete Scoring Rule', message: 'Are you sure you want to delete this scoring rule?', confirmText: 'Delete', danger: true });
  if (confirmed) {
    try {
      const response = await apiDelete(`/api/admin/leads/scoring-rules/${ruleId}`);
      if (response.ok) {
        showToast('Rule deleted', 'success');
        await loadScoringRules();
      } else {
        showToast('Failed to delete rule', 'error');
      }
    } catch (error) {
      logger.error(' Failed to delete scoring rule:', error);
      showToast('Error deleting rule', 'error');
    }
  }
}

// ============================================================================
// LEAD TASKS
// ============================================================================

interface LeadTask { id: number; project_id: number; title: string; description?: string; task_type: string; due_date?: string; status: string; priority: string; completed_at?: string; }

async function loadLeadTasks(leadId: number): Promise<LeadTask[]> {
  try {
    const response = await apiFetch(`/api/admin/leads/${leadId}/tasks`);
    if (response.ok) {
      const data = await response.json();
      return data.tasks || [];
    }
  } catch (error) {
    logger.error(' Failed to load tasks:', error);
  }
  return [];
}

function renderLeadTasks(tasks: LeadTask[], leadId: number): string {
  const emptyBody = '<div class="empty-state-small">No tasks yet</div>';
  const listBody = `<div class="lead-tasks-list">${tasks.map(task => `
    <div class="lead-task-item ${task.status === 'completed' ? 'task-completed' : ''}" data-task-id="${task.id}">
      <button class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" data-action="toggle-task">${task.status === 'completed' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</button>
      <div class="task-info flex flex-col gap-0-5"><span class="task-title">${SanitizationUtils.escapeHtml(task.title)}</span>${task.due_date ? `<span class="task-due">${formatDate(task.due_date)}</span>` : ''}</div>
      <span class="task-type-badge">${task.task_type}</span>
    </div>
  `).join('')}</div>`;
  return `<div class="lead-tab-section"><div class="lead-tab-section-header"><span class="field-label">Tasks</span><button type="button" class="icon-btn add-lead-task-btn" data-lead-id="${leadId}" title="Add Task" aria-label="Add Task">${ICONS.PLUS}</button></div><div class="lead-tab-section-body">${tasks.length === 0 ? emptyBody : listBody}</div></div>`;
}

async function showAddTaskDialog(leadId: number): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Add Task',
    fields: [
      { name: 'title', label: 'Task Title', type: 'text', required: true },
      { name: 'task_type', label: 'Type', type: 'select', options: [
        { value: 'follow_up', label: 'Follow Up' }, { value: 'call', label: 'Call' }, { value: 'email', label: 'Email' },
        { value: 'meeting', label: 'Meeting' }, { value: 'proposal', label: 'Send Proposal' }, { value: 'other', label: 'Other' }
      ], required: true },
      { name: 'due_date', label: 'Due Date', type: 'date' },
      { name: 'priority', label: 'Priority', type: 'select', options: [
        { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }
      ] }
    ],
    confirmText: 'Add Task',
    cancelText: 'Cancel'
  });

  if (result) {
    try {
      const response = await apiPost(`/api/admin/leads/${leadId}/tasks`, { title: result.title, taskType: result.task_type, dueDate: result.due_date || null, priority: result.priority || 'medium' });
      if (response.ok) {
        showToast('Task added', 'success');
        showLeadDetails(leadId);
      } else {
        showToast('Failed to add task', 'error');
      }
    } catch (error) {
      logger.error(' Failed to add task:', error);
      showToast('Error adding task', 'error');
    }
  }
}

async function completeTask(taskId: number, leadId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/leads/tasks/${taskId}/complete`);
    if (response.ok) {
      showToast('Task completed', 'success');
      showLeadDetails(leadId);
    } else {
      showToast('Failed to complete task', 'error');
    }
  } catch (error) {
    logger.error(' Failed to complete task:', error);
    showToast('Error completing task', 'error');
  }
}

// ============================================================================
// LEAD NOTES
// ============================================================================

interface LeadNote { id: number; project_id: number; author: string; content: string; is_pinned: boolean; created_at: string; }

async function loadLeadNotes(leadId: number): Promise<LeadNote[]> {
  try {
    const response = await apiFetch(`/api/admin/leads/${leadId}/notes`);
    if (response.ok) {
      const data = await response.json();
      return data.notes || [];
    }
  } catch (error) {
    logger.error(' Failed to load notes:', error);
  }
  return [];
}

function renderLeadNotes(notes: LeadNote[], leadId: number): string {
  const emptyBody = '<div class="empty-state-small">No notes yet</div>';
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const listBody = `<div class="lead-notes-list">${sortedNotes.map(note => `
    <div class="lead-note-item ${note.is_pinned ? 'note-pinned' : ''}" data-note-id="${note.id}">
      <div class="note-header"><span class="note-author">${SanitizationUtils.escapeHtml(note.author)}</span><span class="note-date">${formatDate(note.created_at)}</span><button class="icon-btn icon-btn-sm" data-action="toggle-pin" title="${note.is_pinned ? 'Unpin' : 'Pin'}" aria-label="${note.is_pinned ? 'Unpin note' : 'Pin note'}"><svg width="12" height="12" viewBox="0 0 24 24" fill="${note.is_pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 2L12 12"/><circle cx="12" cy="16" r="4"/></svg></button></div>
      <div class="note-content">${SanitizationUtils.escapeHtml(note.content)}</div>
    </div>
  `).join('')}</div>`;
  return `<div class="lead-tab-section"><div class="lead-tab-section-header"><span class="field-label">Notes</span><button type="button" class="icon-btn add-lead-note-btn" data-lead-id="${leadId}" title="Add Note" aria-label="Add Note">${ICONS.PLUS}</button></div><div class="lead-tab-section-body">${notes.length === 0 ? emptyBody : listBody}</div></div>`;
}

async function showAddNoteDialog(leadId: number): Promise<void> {
  const result = await multiPromptDialog({ title: 'Add Note', fields: [{ name: 'content', label: 'Note', type: 'textarea', required: true }], confirmText: 'Add Note', cancelText: 'Cancel' });
  if (result && result.content) {
    try {
      const response = await apiPost(`/api/admin/leads/${leadId}/notes`, { content: result.content, author: 'Admin' });
      if (response.ok) {
        showToast('Note added', 'success');
        showLeadDetails(leadId);
      } else {
        showToast('Failed to add note', 'error');
      }
    } catch (error) {
      logger.error(' Failed to add note:', error);
      showToast('Error adding note', 'error');
    }
  }
}

async function toggleNotePin(noteId: number, leadId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/admin/leads/notes/${noteId}/toggle-pin`);
    if (response.ok) {
      showToast('Note updated', 'success');
      showLeadDetails(leadId);
    } else {
      showToast('Failed to update note', 'error');
    }
  } catch (error) {
    logger.error(' Failed to toggle pin:', error);
    showToast('Error updating note', 'error');
  }
}

// ============================================================================
// TAB RENDERING
// ============================================================================

const RENDER_ICONS = {
  EXPORT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
};

export function renderLeadsTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactLeadsTable();
  logger.log(' renderLeadsTab called, useReact:', useReact, 'container:', !!container);

  leadsModule.resetCache();
  currentView = 'table';
  kanbanBoard = null;

  if (useReact) {
    // React implementation - render minimal container
    container.innerHTML = `
      <!-- React Leads Table Mount Point -->
      <div id="react-leads-mount" class="react-data-table"></div>
    `;
    logger.log(' React mount container created');
    return;
  }

  // Vanilla implementation
  container.innerHTML = `
    <div class="quick-stats">
      <button class="stat-card stat-card-clickable" data-filter="all" data-table="leads"><span class="stat-number" id="leads-total">-</span><span class="stat-label">Total Leads</span></button>
      <button class="stat-card stat-card-clickable" data-filter="pending" data-table="leads"><span class="stat-number" id="leads-pending">-</span><span class="stat-label">Pending</span></button>
      <button class="stat-card stat-card-clickable" data-filter="in_progress" data-table="leads"><span class="stat-number" id="leads-active">-</span><span class="stat-label">In Progress</span></button>
      <button class="stat-card stat-card-clickable" data-filter="completed" data-table="leads"><span class="stat-number" id="leads-completed">-</span><span class="stat-label">Completed</span></button>
    </div>
    <div class="data-table-card" id="leads-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">Intake Submissions</span><span class="title-mobile">Leads</span></h3>
        <div class="data-table-actions" id="leads-filter-container">
          <div id="leads-view-toggle"></div>
          <button class="icon-btn" id="export-leads-btn" title="Export to CSV" aria-label="Export leads to CSV">
            ${RENDER_ICONS.EXPORT}
          </button>
          <button class="icon-btn" id="refresh-leads-btn" title="Refresh" aria-label="Refresh leads">
            ${RENDER_ICONS.REFRESH}
          </button>
        </div>
      </div>
      <!-- Bulk Action Toolbar (hidden initially) -->
      <div id="leads-bulk-toolbar" class="bulk-action-toolbar hidden"></div>
      <div class="leads-pipeline-container hidden" id="leads-pipeline-container"></div>
      <div class="data-table-container" id="leads-table-view">
        <div class="data-table-scroll-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col" class="bulk-select-cell">
                  <div class="portal-checkbox">
                    <input type="checkbox" id="leads-select-all" class="bulk-select-all" aria-label="Select all leads" />
                  </div>
                </th>
                <th scope="col" class="identity-col">Lead</th>
                <th scope="col" class="type-col">Type</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="amount-col">Budget</th>
                <th scope="col" class="date-col">Date</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="leads-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr class="loading-row">
                <td colspan="7">
                  <div class="loading-state">
                    <span class="loading-spinner" aria-hidden="true"></span>
                    <span class="loading-message">Loading leads...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="leads-pagination" class="table-pagination"></div>
    </div>
  `;
}
