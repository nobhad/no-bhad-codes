/**
 * ===============================================
 * ADMIN PROPOSALS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-proposals.ts
 *
 * Proposal management functionality for admin dashboard.
 * View, review, and manage client proposal submissions.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { getEmailWithCopyHtml } from '../../../utils/copy-email';
import { formatDate, formatDateTime, formatProjectType } from '../../../utils/format-utils';
import { apiFetch, apiPut, apiPost, apiDelete } from '../../../utils/api-client';
import { createTableDropdown } from '../../../utils/table-dropdown';
import { initModalDropdown } from '../../../utils/modal-dropdown';
import type { AdminDashboardContext } from '../admin-types';
import { confirmDialog, alertSuccess, alertError, multiPromptDialog } from '../../../utils/confirm-dialog';
import { createPortalModal } from '../../../components/portal-modal';
import { showToast } from '../../../utils/toast-notifications';
import { createViewToggle } from '../../../components/view-toggle';
import {
  createRowCheckbox,
  createBulkActionToolbar,
  setupBulkSelectionHandlers,
  resetSelection,
  type BulkActionConfig
} from '../../../utils/table-bulk-actions';

// View toggle icons
const PROPOSALS_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
const TEMPLATES_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>';
import { exportToCsv, PROPOSALS_EXPORT_CONFIG } from '../../../utils/table-export';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  PROPOSALS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import {
  createPaginationUI,
  applyPagination,
  getDefaultPaginationState,
  loadPaginationState,
  savePaginationState,
  type PaginationState,
  type PaginationConfig
} from '../../../utils/table-pagination';

// ============================================================================
// TYPES
// ============================================================================

interface Proposal {
  id: number;
  projectId: number;
  clientId: number;
  projectType: string;
  selectedTier: 'good' | 'better' | 'best';
  basePrice: number;
  finalPrice: number;
  maintenanceOption: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected' | 'converted';
  clientNotes: string | null;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  project: {
    name: string;
  };
  client: {
    name: string;
    email: string;
    company: string | null;
  };
  features?: Array<{
    featureId: string;
    featureName: string;
    featurePrice: number;
    isIncludedInTier: boolean;
    isAddon: boolean;
  }>;
}

interface ProposalsData {
  proposals: Proposal[];
  total: number;
}

interface TemplateTier {
  id: string;
  name: string;
  basePrice: number;
  description?: string;
}

interface TemplateFeature {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  includedTiers: string[];
  isActive: boolean;
}

interface TemplateMaintenanceOption {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  highlighted?: boolean;
  features?: string[];
}

interface TemplateTierStructure {
  tiers: TemplateTier[];
  features?: TemplateFeature[];
  maintenanceOptions?: TemplateMaintenanceOption[];
}

interface TemplateLineItem {
  description: string;
  quantity?: number;
  unitPrice: number;
  unitLabel?: string;
  category?: string;
  isTaxable?: boolean;
  isOptional?: boolean;
}

interface ProposalTemplate {
  id: number;
  name: string;
  description: string | null;
  projectType: string | null;
  tierStructure?: TemplateTierStructure;
  defaultLineItems?: TemplateLineItem[];
  termsAndConditions?: string | null;
  validityDays: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProposalVersion {
  id: number;
  proposalId: number;
  versionNumber: number;
  content: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  notes: string | null;
}

interface ProposalComment {
  id: number;
  proposalId: number;
  authorType: 'admin' | 'client';
  authorName: string;
  authorEmail?: string;
  content: string;
  isInternal: boolean;
  parentCommentId?: number;
  createdAt: string;
}

interface ProposalCustomItem {
  id: number;
  proposalId: number;
  itemType: 'service' | 'product' | 'discount' | 'fee' | 'hourly';
  description: string;
  quantity: number;
  unitPrice: number;
  unitLabel?: string;
  isTaxable: boolean;
  isOptional: boolean;
  sortOrder: number;
}

interface ProposalActivity {
  id: number;
  proposalId: number;
  activityType: string;
  actor?: string;
  actorType?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// STATUS OPTIONS
// ============================================================================

const PROPOSAL_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'var(--color-warning-500)' },
  { value: 'reviewed', label: 'Reviewed', color: 'var(--color-info-500)' },
  { value: 'accepted', label: 'Accepted', color: 'var(--color-success-500)' },
  { value: 'rejected', label: 'Rejected', color: 'var(--color-error-500)' },
  { value: 'converted', label: 'Converted', color: 'var(--color-primary)' }
];

// ============================================================================
// STATE
// ============================================================================

let proposalsData: Proposal[] = [];
let _storedContext: AdminDashboardContext | null = null;
let templatesData: ProposalTemplate[] = [];
let currentProposalVersions: ProposalVersion[] = [];
let _currentProposal: Proposal | null = null;
let _currentView: 'proposals' | 'templates' = 'proposals';
let filterUIInitialized = false;

// Filter state (replaces currentFilter and searchQuery)
let filterState: FilterState = loadFilterState(PROPOSALS_FILTER_CONFIG.storageKey);

// Pagination configuration and state
const PROPOSALS_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'proposals',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_proposals_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(PROPOSALS_PAGINATION_CONFIG),
  ...loadPaginationState(PROPOSALS_PAGINATION_CONFIG.storageKey!)
};

// Bulk action configuration for proposals table
const PROPOSALS_BULK_CONFIG: BulkActionConfig = {
  tableId: 'proposals',
  actions: [
    {
      id: 'update-status',
      label: 'Update Status',
      variant: 'default',
      confirmMessage: 'Update status of {count} selected proposals?',
      handler: async (ids: number[]) => {
        // Show status selection dialog
        const result = await multiPromptDialog({
          title: 'Update Proposal Status',
          fields: [
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              required: true,
              options: PROPOSAL_STATUS_OPTIONS
            }
          ],
          confirmText: 'Update'
        });
        if (!result || !_storedContext) return;
        try {
          // Update each proposal
          const results = await Promise.all(
            ids.map(id =>
              apiPut(`/api/proposals/admin/${id}`, { status: result.status })
                .then(res => ({ id, success: res.ok }))
                .catch(() => ({ id, success: false }))
            )
          );
          const successCount = results.filter(r => r.success).length;
          if (successCount > 0) {
            _storedContext.showNotification?.(`Updated ${successCount} proposal${successCount > 1 ? 's' : ''}`, 'success');
            resetSelection('proposals');
            await refreshProposals(_storedContext);
          } else {
            _storedContext.showNotification?.('Failed to update proposals', 'error');
          }
        } catch (error) {
          console.error('[AdminProposals] Bulk status update error:', error);
          _storedContext.showNotification?.('Error updating proposals', 'error');
        }
      }
    }
  ]
};

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

const cachedElements: Map<string, HTMLElement | null> = new Map();

function getElement(id: string): HTMLElement | null {
  if (!cachedElements.has(id)) {
    cachedElements.set(id, document.getElementById(id));
  }
  return cachedElements.get(id) ?? null;
}

function clearElementCache(): void {
  cachedElements.clear();
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getProposalsData(): Proposal[] {
  return proposalsData;
}

export function setProposalsContext(ctx: AdminDashboardContext): void {
  _storedContext = ctx;
}

/**
 * Load and display proposals
 */
export async function loadProposals(ctx: AdminDashboardContext): Promise<void> {
  _storedContext = ctx;
  clearElementCache();

  const container = getElement('proposals-content');
  if (!container) {
    console.error('[AdminProposals] Container not found');
    return;
  }

  // Show loading state
  container.innerHTML = renderProposalsLayout();

  // Setup view toggle
  setupViewToggle(ctx);

  // Setup bulk action toolbar
  const bulkToolbarContainer = document.getElementById('proposals-bulk-toolbar');
  if (bulkToolbarContainer) {
    const toolbar = createBulkActionToolbar({
      ...PROPOSALS_BULK_CONFIG,
      onSelectionChange: () => {
        // Selection change callback if needed
      }
    });
    bulkToolbarContainer.replaceWith(toolbar);
  }

  // Setup filter UI (replaces custom filter buttons and search bar)
  if (!filterUIInitialized) {
    filterUIInitialized = true;
    initializeProposalsFilterUI(ctx);
  }

  // Setup export button
  const exportBtn = document.getElementById('export-proposals-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const filteredData = getFilteredProposals();
      if (filteredData.length === 0) {
        ctx.showNotification?.('No proposals to export', 'warning');
        return;
      }
      exportToCsv(filteredData as unknown as Record<string, unknown>[], PROPOSALS_EXPORT_CONFIG);
      ctx.showNotification?.(`Exported ${filteredData.length} proposals to CSV`, 'success');
    });
  }

  // Load data
  await refreshProposals(ctx);
}

/**
 * Refresh proposals data from API
 */
async function refreshProposals(ctx: AdminDashboardContext): Promise<void> {
  const tableBody = document.getElementById('proposals-table-body');
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="8" class="loading-row">Loading proposals...</td></tr>';
  }

  try {
    // Fetch all proposals — filtering is now done client-side via applyFilters
    const response = await apiFetch('/api/proposals/admin/list');

    if (response.ok) {
      const data: { success: boolean; data: ProposalsData } = await response.json();
      proposalsData = data.data.proposals || [];
      renderFilteredProposals(ctx);
      updateStats(proposalsData);
    } else if (response.status !== 401) {
      console.error('[AdminProposals] API error:', response.status);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="8" class="loading-row">Error loading proposals: ${response.status}</td></tr>`;
      }
    }
  } catch (error) {
    console.error('[AdminProposals] Failed to load proposals:', error);
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="8" class="loading-row">Network error loading proposals</td></tr>';
    }
  }
}

// ============================================================================
// RENDER FUNCTIONS
// ============================================================================

function renderProposalsLayout(): string {
  return `
    <div id="proposals-view-toggle-mount"></div>

    <div class="proposals-panel" id="proposals-list-panel">
      <div class="proposals-header">
        <h2>Proposal Requests</h2>
        <div class="proposals-actions" id="proposals-filter-container">
          <button class="icon-btn" id="export-proposals-btn" title="Export to CSV" aria-label="Export proposals to CSV">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="btn btn-secondary" id="refresh-proposals-btn">
            Refresh
          </button>
        </div>
      </div>

      <div class="proposals-stats" id="proposals-stats">
        <div class="stat-card">
          <span class="stat-value" id="stat-pending">0</span>
          <span class="stat-label">Pending</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-reviewed">0</span>
          <span class="stat-label">Reviewed</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-accepted">0</span>
          <span class="stat-label">Accepted</span>
        </div>
        <div class="stat-card">
          <span class="stat-value" id="stat-total-value">$0</span>
          <span class="stat-label">Total Value</span>
        </div>
      </div>

      <div id="proposals-bulk-toolbar" class="bulk-action-toolbar"></div>

      <div class="table-responsive">
        <table class="admin-table proposals-table">
          <thead>
            <tr>
              <th class="bulk-select-cell">
                <div class="portal-checkbox">
                  <input type="checkbox" id="proposals-select-all" class="bulk-select-all" aria-label="Select all proposals" />
                </div>
              </th>
              <th>Client</th>
              <th>Project</th>
              <th>Tier</th>
              <th>Price</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="proposals-table-body">
            <tr><td colspan="8" class="loading-row">Loading proposals...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="proposals-pagination" class="table-pagination"></div>
    </div>

    <div class="proposal-details-panel" id="proposal-details-panel" style="display: none;">
      <div class="panel-header">
        <button class="btn-back" id="proposal-back-btn">Back to List</button>
        <h3>Proposal Details</h3>
      </div>
      <div class="panel-content" id="proposal-details-content"></div>
    </div>

    <div class="templates-panel" id="templates-panel" style="display: none;">
      <div class="templates-header">
        <h2>Proposal Templates</h2>
        <button class="btn btn-primary" id="create-template-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          New Template
        </button>
      </div>
      <div class="templates-list" id="templates-list">
        <div class="loading-row">Loading templates...</div>
      </div>
    </div>
  `;
}

function renderProposalsTable(proposals: Proposal[], ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('proposals-table-body');
  if (!tableBody) return;

  if (proposals.length === 0) {
    const message = proposalsData.length === 0
      ? 'No proposals yet.'
      : 'No proposals match the current filters.';
    tableBody.innerHTML = `<tr><td colspan="8" class="empty-row">${message}</td></tr>`;
    return;
  }

  // Reset bulk selection when data changes
  resetSelection('proposals');

  tableBody.innerHTML = proposals.map(proposal => renderProposalRow(proposal, ctx)).join('');

  // Setup event listeners
  setupRowEventListeners(proposals, ctx);

  // Setup bulk selection handlers
  const allRowIds = proposals.map(p => p.id);
  setupBulkSelectionHandlers(PROPOSALS_BULK_CONFIG, allRowIds);
}

function renderProposalRow(proposal: Proposal, _ctx: AdminDashboardContext): string {
  const _statusOption = PROPOSAL_STATUS_OPTIONS.find(s => s.value === proposal.status);
  const tierLabel = proposal.selectedTier.charAt(0).toUpperCase() + proposal.selectedTier.slice(1);
  const formattedDate = formatDate(proposal.createdAt);

  // Standard column order: ☐ | Client | Project | Tier | Price | Status | Date | Actions
  return `
    <tr data-proposal-id="${proposal.id}">
      ${createRowCheckbox('proposals', proposal.id)}
      <td>
        <div class="client-info">
          <span class="client-name">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.name))}</span>
          ${proposal.client.company ? `<span class="client-company">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.company))}</span>` : ''}
        </div>
      </td>
      <td>
        <span class="project-name">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.project.name))}</span>
        <span class="project-type">${formatProjectType(proposal.projectType)}</span>
      </td>
      <td>
        <span class="tier-badge tier-${proposal.selectedTier}">${tierLabel}</span>
      </td>
      <td class="price-cell">
        <span class="price-value">${formatPrice(proposal.finalPrice)}</span>
        ${proposal.maintenanceOption && proposal.maintenanceOption !== 'diy'
    ? `<span class="maintenance-badge">+${proposal.maintenanceOption}</span>`
    : ''}
      </td>
      <td>
        <div class="status-dropdown-container" data-proposal-id="${proposal.id}"></div>
      </td>
      <td class="date-cell">${formattedDate}</td>
      <td class="actions-cell">
        <button class="icon-btn btn-view" data-proposal-id="${proposal.id}" title="View Details" aria-label="View proposal details">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${proposal.status === 'accepted' ? `
          <button class="icon-btn btn-convert" data-proposal-id="${proposal.id}" title="Convert to Invoice" aria-label="Convert to invoice">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

/**
 * Get proposals filtered using shared filter infrastructure
 */
function getFilteredProposals(): Proposal[] {
  return applyFilters(proposalsData, filterState, PROPOSALS_FILTER_CONFIG);
}

/**
 * Render proposals with current filter and search applied
 */
function renderFilteredProposals(ctx: AdminDashboardContext): void {
  const filtered = getFilteredProposals();

  // Update pagination state with total items
  paginationState.totalItems = filtered.length;

  // Apply pagination
  const paginatedProposals = applyPagination(filtered, paginationState);

  renderProposalsTable(paginatedProposals, ctx);
  renderProposalsPaginationUI(filtered.length, ctx);
}

/**
 * Render pagination UI for proposals
 */
function renderProposalsPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('proposals-pagination');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  const paginationUI = createPaginationUI(
    PROPOSALS_PAGINATION_CONFIG,
    paginationState,
    (newState: PaginationState) => {
      paginationState = newState;
      savePaginationState(PROPOSALS_PAGINATION_CONFIG.storageKey!, paginationState);
      renderFilteredProposals(ctx);
    }
  );
  container.appendChild(paginationUI);
}

function setupRowEventListeners(proposals: Proposal[], ctx: AdminDashboardContext): void {
  // Row click navigation - open details on row click (except interactive elements)
  document.querySelectorAll('#proposals-table-body tr[data-proposal-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // Skip if clicking on interactive elements
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('.status-dropdown-container') ||
        target.closest('.table-dropdown') ||
        target.closest('.bulk-select-cell')
      ) {
        return;
      }
      const id = parseInt((row as HTMLElement).dataset.proposalId || '0', 10);
      const proposal = proposals.find(p => p.id === id);
      if (proposal) {
        showProposalDetails(proposal, ctx);
      }
    });
    // Add cursor pointer style for clickable rows
    (row as HTMLElement).style.cursor = 'pointer';
  });

  // Setup status dropdowns
  proposals.forEach(proposal => {
    const container = document.querySelector(`.status-dropdown-container[data-proposal-id="${proposal.id}"]`);
    if (container) {
      const dropdown = createTableDropdown({
        options: PROPOSAL_STATUS_OPTIONS,
        currentValue: proposal.status,
        onChange: async (newValue) => {
          await updateProposalStatus(proposal.id, newValue, ctx);
        }
      });
      container.innerHTML = '';
      container.appendChild(dropdown);
    }
  });

  // View buttons
  document.querySelectorAll('.btn-view[data-proposal-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.proposalId || '0', 10);
      const proposal = proposals.find(p => p.id === id);
      if (proposal) {
        showProposalDetails(proposal, ctx);
      }
    });
  });

  // Convert buttons
  document.querySelectorAll('.btn-convert[data-proposal-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt((e.currentTarget as HTMLElement).dataset.proposalId || '0', 10);
      await convertToInvoice(id, ctx);
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refresh-proposals-btn');
  if (refreshBtn) {
    refreshBtn.onclick = () => refreshProposals(ctx);
  }

  // Back button
  const backBtn = document.getElementById('proposal-back-btn');
  if (backBtn) {
    backBtn.onclick = () => hideProposalDetails();
  }
}

/**
 * Initialize shared filter UI for proposals
 */
function initializeProposalsFilterUI(ctx: AdminDashboardContext): void {
  const container = document.getElementById('proposals-filter-container');
  if (!container) return;

  // Create filter UI using shared infrastructure
  const filterUI = createFilterUI(
    PROPOSALS_FILTER_CONFIG,
    filterState,
    (newState) => {
      filterState = newState;
      renderFilteredProposals(ctx);
    }
  );

  // Insert filter UI at the beginning of the container (before export button)
  const firstBtn = container.querySelector('button');
  if (firstBtn) {
    container.insertBefore(filterUI, firstBtn);
  } else {
    container.appendChild(filterUI);
  }

  // Setup sortable headers
  setTimeout(() => {
    createSortableHeaders(PROPOSALS_FILTER_CONFIG, filterState, (column, direction) => {
      filterState = { ...filterState, sortColumn: column, sortDirection: direction };
      saveFilterState(PROPOSALS_FILTER_CONFIG.storageKey, filterState);
      renderFilteredProposals(ctx);
    });
  }, 100);
}

function setupViewToggle(ctx: AdminDashboardContext): void {
  const mount = document.getElementById('proposals-view-toggle-mount');
  const proposalsPanel = document.getElementById('proposals-list-panel');
  const templatesPanel = document.getElementById('templates-panel');
  if (!mount) return;

  const toggleEl = createViewToggle({
    id: 'proposals-view-toggle',
    options: [
      { value: 'proposals', label: 'Proposals', title: 'Proposals', ariaLabel: 'Proposals view', iconSvg: PROPOSALS_ICON },
      { value: 'templates', label: 'Templates', title: 'Templates', ariaLabel: 'Templates view', iconSvg: TEMPLATES_ICON }
    ],
    value: _currentView,
    onChange: async (view) => {
      _currentView = view as 'proposals' | 'templates';
      if (_currentView === 'proposals') {
        if (proposalsPanel) proposalsPanel.style.display = 'block';
        if (templatesPanel) templatesPanel.style.display = 'none';
      } else {
        if (proposalsPanel) proposalsPanel.style.display = 'none';
        if (templatesPanel) templatesPanel.style.display = 'block';
        await loadTemplates(ctx);
      }
    }
  });
  mount.appendChild(toggleEl);
}

// ============================================================================
// TEMPLATES MANAGEMENT
// ============================================================================

async function loadTemplates(ctx: AdminDashboardContext): Promise<void> {
  const templatesList = document.getElementById('templates-list');
  if (!templatesList) return;

  templatesList.innerHTML = '<div class="loading-row">Loading templates...</div>';

  try {
    const response = await apiFetch('/api/proposals/templates');
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      templatesData = data.templates || [];
      renderTemplatesList(ctx);
    } else {
      templatesList.innerHTML = '<div class="empty-row">Error loading templates</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading templates:', error);
    templatesList.innerHTML = '<div class="empty-row">Network error loading templates</div>';
  }
}

function renderTemplatesList(ctx: AdminDashboardContext): void {
  const templatesList = document.getElementById('templates-list');
  if (!templatesList) return;

  if (templatesData.length === 0) {
    templatesList.innerHTML = `
      <div class="empty-state">
        <p>No templates found</p>
        <p class="empty-hint">Create a template to save proposal configurations for reuse</p>
      </div>
    `;
    setupTemplateListeners(ctx);
    return;
  }

  templatesList.innerHTML = `
    <div class="templates-grid">
      ${templatesData.map(template => `
        <div class="template-card" data-template-id="${template.id}">
          <div class="template-card-header">
            <h4>${SanitizationUtils.escapeHtml(template.name)}</h4>
            ${template.isDefault ? '<span class="default-badge">Default</span>' : ''}
          </div>
          <div class="template-card-body">
            ${template.description ? `<p class="template-description">${SanitizationUtils.escapeHtml(template.description)}</p>` : ''}
            <div class="template-meta">
              <span class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${formatDate(template.createdAt)}
              </span>
              ${template.projectType ? `
                <span class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
                  ${formatProjectType(template.projectType)}
                </span>
              ` : ''}
              <span class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
                ${template.validityDays || 30} days
              </span>
            </div>
          </div>
          <div class="template-card-actions">
            <button class="btn btn-secondary btn-sm use-template-btn" data-template-id="${template.id}">
              Use Template
            </button>
            <button class="icon-btn edit-template-btn" data-template-id="${template.id}" title="Edit" aria-label="Edit template">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn delete-template-btn" data-template-id="${template.id}" title="Delete" aria-label="Delete template">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  setupTemplateListeners(ctx);
}

function setupTemplateListeners(ctx: AdminDashboardContext): void {
  // Create template button
  const createBtn = document.getElementById('create-template-btn');
  if (createBtn) {
    createBtn.onclick = () => openTemplateEditor(null, ctx);
  }

  // Use template buttons
  document.querySelectorAll('.use-template-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0', 10);
      await useTemplate(templateId, ctx);
    });
  });

  // Edit template buttons
  document.querySelectorAll('.edit-template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0', 10);
      const template = templatesData.find(t => t.id === templateId);
      if (template) {
        openTemplateEditor(template, ctx);
      }
    });
  });

  // Delete template buttons
  document.querySelectorAll('.delete-template-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = parseInt((btn as HTMLElement).dataset.templateId || '0', 10);
      await deleteTemplate(templateId, ctx);
    });
  });
}

// Store reference to active template modal for cleanup
let activeTemplateModal: ReturnType<typeof createPortalModal> | null = null;

const TEMPLATE_PROJECT_TYPES = [
  { value: 'simple-site', label: 'Simple Site' },
  { value: 'business-site', label: 'Business Site' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web App' },
  { value: 'browser-extension', label: 'Browser Extension' },
  { value: 'other', label: 'Other' }
];

const DEFAULT_TIERS: TemplateTier[] = [
  { id: 'good', name: 'Good', basePrice: 0 },
  { id: 'better', name: 'Better', basePrice: 0 },
  { id: 'best', name: 'Best', basePrice: 0 }
];

function normalizeTierStructure(structure?: TemplateTierStructure): TemplateTierStructure {
  const tiers = structure?.tiers?.length
    ? structure.tiers.map(tier => ({
      id: tier.id || '',
      name: tier.name || '',
      basePrice: Number(tier.basePrice || 0),
      description: tier.description
    }))
    : DEFAULT_TIERS.map(tier => ({ ...tier }));

  const features = structure?.features?.map(feature => ({
    id: feature.id || '',
    name: feature.name || '',
    description: feature.description,
    category: feature.category,
    price: Number(feature.price || 0),
    includedTiers: Array.isArray(feature.includedTiers) ? [...feature.includedTiers] : [],
    isActive: feature.isActive !== false
  })) || [];

  const maintenanceOptions = structure?.maintenanceOptions?.map(option => ({
    id: option.id || '',
    name: option.name || '',
    description: option.description,
    price: Number(option.price || 0),
    billingCycle: (option.billingCycle === 'yearly' ? 'yearly' : 'monthly') as TemplateMaintenanceOption['billingCycle'],
    highlighted: option.highlighted,
    features: option.features || []
  })) || [];

  return { tiers, features, maintenanceOptions };
}

function normalizeLineItems(items?: TemplateLineItem[]): TemplateLineItem[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(item => ({
    description: item.description || '',
    quantity: item.quantity ?? 1,
    unitPrice: Number(item.unitPrice || 0),
    unitLabel: item.unitLabel,
    category: item.category,
    isTaxable: item.isTaxable !== false,
    isOptional: item.isOptional === true
  }));
}

function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'item';
}

function openTemplateEditor(template: ProposalTemplate | null, ctx: AdminDashboardContext): void {
  // Clean up any existing template modal
  if (activeTemplateModal) {
    activeTemplateModal.hide();
    activeTemplateModal = null;
  }

  // Create modal using portal modal component
  const modal = createPortalModal({
    id: 'template-editor-modal',
    titleId: 'template-modal-title',
    title: template ? 'Edit Template' : 'New Template',
    contentClassName: 'template-editor-modal-content',
    onClose: () => {
      activeTemplateModal = null;
    }
  });

  const projectType = template?.projectType || 'business-site';
  const validityDays = template?.validityDays || 30;
  const tierStructure = normalizeTierStructure(template?.tierStructure);
  const lineItems = normalizeLineItems(template?.defaultLineItems);
  const termsAndConditions = template?.termsAndConditions || '';

  const editorState = {
    tiers: tierStructure.tiers,
    features: tierStructure.features || [],
    maintenanceOptions: tierStructure.maintenanceOptions || [],
    lineItems
  };

  modal.body.innerHTML = `
    <div class="template-editor">
      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Basics</h4>
        </div>
        <div class="template-form-grid">
          <div class="form-group">
            <label class="form-label" for="template-name">Template Name</label>
            <input type="text" id="template-name" class="form-input" placeholder="e.g., Standard Website Package" value="${template ? SanitizationUtils.escapeHtml(template.name) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label" for="template-description">Description</label>
            <textarea id="template-description" class="form-input" rows="2" placeholder="Brief description of this template">${template?.description ? SanitizationUtils.escapeHtml(template.description) : ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="template-project-type">Project Type</label>
            <select id="template-project-type" class="form-input">
              ${TEMPLATE_PROJECT_TYPES.map(type => `
                <option value="${type.value}" ${projectType === type.value ? 'selected' : ''}>${type.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="template-validity">Validity (days)</label>
            <input type="number" id="template-validity" class="form-input" min="1" value="${validityDays}">
          </div>
          <div class="form-group form-checkbox">
            <input type="checkbox" id="template-is-default" ${template?.isDefault ? 'checked' : ''}>
            <label for="template-is-default">Set as default template</label>
          </div>
        </div>
      </section>

      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Tier Configuration</h4>
          <button class="btn btn-secondary btn-sm" id="add-tier-btn" type="button">Add Tier</button>
        </div>
        <div class="template-list" id="template-tier-list"></div>
      </section>

      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Feature Library</h4>
          <button class="btn btn-secondary btn-sm" id="add-feature-btn" type="button">Add Feature</button>
        </div>
        <div class="template-list" id="template-feature-list"></div>
      </section>

      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Maintenance Options</h4>
          <button class="btn btn-secondary btn-sm" id="add-maintenance-btn" type="button">Add Maintenance</button>
        </div>
        <div class="template-list" id="template-maintenance-list"></div>
      </section>

      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Default Line Items</h4>
          <button class="btn btn-secondary btn-sm" id="add-line-item-btn" type="button">Add Line Item</button>
        </div>
        <div class="template-list" id="template-lineitem-list"></div>
      </section>

      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Terms and Conditions</h4>
        </div>
        <textarea id="template-terms" class="form-input" rows="4" placeholder="Add proposal terms and conditions...">${SanitizationUtils.escapeHtml(termsAndConditions)}</textarea>
      </section>

      <section class="template-editor-section">
        <div class="template-section-header">
          <h4>Preview</h4>
        </div>
        <div class="template-preview" id="template-preview"></div>
      </section>
    </div>
  `;

  // Build footer with action buttons
  modal.footer.innerHTML = `
    <button class="btn btn-outline" id="cancel-template-btn">Cancel</button>
    <button class="btn btn-primary" id="save-template-btn">Save Template</button>
  `;

  // Append to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();
  activeTemplateModal = modal;

  const typeSelect = modal.body.querySelector('#template-project-type') as HTMLSelectElement;
  if (typeSelect && !typeSelect.dataset.dropdownInit) {
    typeSelect.dataset.dropdownInit = 'true';
    initModalDropdown(typeSelect, { placeholder: 'Select type...' });
  }

  // Setup button handlers
  modal.footer.querySelector('#cancel-template-btn')?.addEventListener('click', () => {
    modal.hide();
    activeTemplateModal = null;
  });

  modal.footer.querySelector('#save-template-btn')?.addEventListener('click', async () => {
    await saveTemplateFromModal(template?.id || null, modal, ctx, editorState);
  });

  // Close on Escape
  const escHandler = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      modal.hide();
      activeTemplateModal = null;
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  const renderTierList = (): void => {
    const container = modal.body.querySelector('#template-tier-list') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = editorState.tiers.map((tier, index) => `
      <div class="template-row template-tier-row" data-tier-index="${index}">
        <input class="form-input" data-scope="tier" data-field="id" data-index="${index}" value="${SanitizationUtils.escapeHtml(tier.id)}" placeholder="tier-id">
        <input class="form-input" data-scope="tier" data-field="name" data-index="${index}" value="${SanitizationUtils.escapeHtml(tier.name)}" placeholder="Tier name">
        <input class="form-input" type="number" min="0" data-scope="tier" data-field="basePrice" data-index="${index}" value="${tier.basePrice}">
        <input class="form-input" data-scope="tier" data-field="description" data-index="${index}" value="${SanitizationUtils.escapeHtml(tier.description || '')}" placeholder="Description">
        <button class="icon-btn remove-row-btn" data-scope="tier" data-index="${index}" title="Remove tier" aria-label="Remove tier">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M5 6l1-2h12l1 2"/></svg>
        </button>
      </div>
    `).join('');
  };

  const renderFeatureList = (): void => {
    const container = modal.body.querySelector('#template-feature-list') as HTMLElement | null;
    if (!container) return;
    const tierOptions = editorState.tiers.map(tier => ({ id: tier.id, name: tier.name }));
    container.innerHTML = editorState.features.map((feature, index) => `
      <div class="template-row template-feature-row" data-feature-index="${index}">
        <input class="form-input" data-scope="feature" data-field="id" data-index="${index}" value="${SanitizationUtils.escapeHtml(feature.id)}" placeholder="feature-id">
        <input class="form-input" data-scope="feature" data-field="name" data-index="${index}" value="${SanitizationUtils.escapeHtml(feature.name)}" placeholder="Feature name">
        <input class="form-input" data-scope="feature" data-field="category" data-index="${index}" value="${SanitizationUtils.escapeHtml(feature.category || '')}" placeholder="Category">
        <input class="form-input" type="number" min="0" data-scope="feature" data-field="price" data-index="${index}" value="${feature.price}">
        <div class="template-tier-checks">
          ${tierOptions.map(tier => `
            <label class="template-tier-check">
              <input type="checkbox" data-scope="feature-tier" data-index="${index}" data-tier-id="${SanitizationUtils.escapeHtml(tier.id)}" ${feature.includedTiers.includes(tier.id) ? 'checked' : ''}>
              <span>${SanitizationUtils.escapeHtml(tier.name || tier.id)}</span>
            </label>
          `).join('')}
        </div>
        <label class="template-toggle">
          <input type="checkbox" data-scope="feature" data-field="isActive" data-index="${index}" ${feature.isActive ? 'checked' : ''}>
          <span>Active</span>
        </label>
        <button class="icon-btn remove-row-btn" data-scope="feature" data-index="${index}" title="Remove feature" aria-label="Remove feature">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M5 6l1-2h12l1 2"/></svg>
        </button>
      </div>
    `).join('');
  };

  const renderMaintenanceList = (): void => {
    const container = modal.body.querySelector('#template-maintenance-list') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = editorState.maintenanceOptions.map((option, index) => `
      <div class="template-row template-maintenance-row" data-maintenance-index="${index}">
        <input class="form-input" data-scope="maintenance" data-field="id" data-index="${index}" value="${SanitizationUtils.escapeHtml(option.id)}" placeholder="option-id">
        <input class="form-input" data-scope="maintenance" data-field="name" data-index="${index}" value="${SanitizationUtils.escapeHtml(option.name)}" placeholder="Maintenance name">
        <input class="form-input" type="number" min="0" data-scope="maintenance" data-field="price" data-index="${index}" value="${option.price}">
        <select class="form-input" data-scope="maintenance" data-field="billingCycle" data-index="${index}">
          <option value="monthly" ${option.billingCycle === 'monthly' ? 'selected' : ''}>Monthly</option>
          <option value="yearly" ${option.billingCycle === 'yearly' ? 'selected' : ''}>Yearly</option>
        </select>
        <input class="form-input" data-scope="maintenance" data-field="description" data-index="${index}" value="${SanitizationUtils.escapeHtml(option.description || '')}" placeholder="Description">
        <label class="template-toggle">
          <input type="checkbox" data-scope="maintenance" data-field="highlighted" data-index="${index}" ${option.highlighted ? 'checked' : ''}>
          <span>Highlight</span>
        </label>
        <button class="icon-btn remove-row-btn" data-scope="maintenance" data-index="${index}" title="Remove maintenance" aria-label="Remove maintenance">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M5 6l1-2h12l1 2"/></svg>
        </button>
      </div>
    `).join('');
  };

  const renderLineItems = (): void => {
    const container = modal.body.querySelector('#template-lineitem-list') as HTMLElement | null;
    if (!container) return;
    container.innerHTML = editorState.lineItems.map((item, index) => `
      <div class="template-row template-lineitem-row" data-lineitem-index="${index}">
        <input class="form-input" data-scope="line-item" data-field="description" data-index="${index}" value="${SanitizationUtils.escapeHtml(item.description)}" placeholder="Description">
        <input class="form-input" type="number" min="0" step="0.01" data-scope="line-item" data-field="unitPrice" data-index="${index}" value="${item.unitPrice}">
        <input class="form-input" type="number" min="0" step="0.01" data-scope="line-item" data-field="quantity" data-index="${index}" value="${item.quantity ?? 1}">
        <input class="form-input" data-scope="line-item" data-field="unitLabel" data-index="${index}" value="${SanitizationUtils.escapeHtml(item.unitLabel || '')}" placeholder="Unit">
        <input class="form-input" data-scope="line-item" data-field="category" data-index="${index}" value="${SanitizationUtils.escapeHtml(item.category || '')}" placeholder="Category">
        <label class="template-toggle">
          <input type="checkbox" data-scope="line-item" data-field="isTaxable" data-index="${index}" ${item.isTaxable !== false ? 'checked' : ''}>
          <span>Taxable</span>
        </label>
        <label class="template-toggle">
          <input type="checkbox" data-scope="line-item" data-field="isOptional" data-index="${index}" ${item.isOptional ? 'checked' : ''}>
          <span>Optional</span>
        </label>
        <button class="icon-btn remove-row-btn" data-scope="line-item" data-index="${index}" title="Remove line item" aria-label="Remove line item">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M5 6l1-2h12l1 2"/></svg>
        </button>
      </div>
    `).join('');
  };

  const renderPreview = (): void => {
    const preview = modal.body.querySelector('#template-preview') as HTMLElement | null;
    if (!preview) return;

    const activeFeatures = editorState.features.filter(feature => feature.isActive);
    const lineItemsCount = editorState.lineItems.filter(item => item.description.trim()).length;

    preview.innerHTML = `
      <div class="template-preview-grid">
        <div class="preview-card">
          <span class="preview-label">Tiers</span>
          <span class="preview-value">${editorState.tiers.length}</span>
          <span class="preview-subtext">${editorState.tiers.map(tier => SanitizationUtils.escapeHtml(tier.name || tier.id)).join(', ') || 'None'}</span>
        </div>
        <div class="preview-card">
          <span class="preview-label">Features</span>
          <span class="preview-value">${activeFeatures.length}</span>
          <span class="preview-subtext">${activeFeatures.slice(0, 3).map(feature => SanitizationUtils.escapeHtml(feature.name || feature.id)).join(', ') || 'None'}${activeFeatures.length > 3 ? '...' : ''}</span>
        </div>
        <div class="preview-card">
          <span class="preview-label">Maintenance</span>
          <span class="preview-value">${editorState.maintenanceOptions.length}</span>
          <span class="preview-subtext">${editorState.maintenanceOptions.map(option => SanitizationUtils.escapeHtml(option.name || option.id)).join(', ') || 'None'}</span>
        </div>
        <div class="preview-card">
          <span class="preview-label">Line Items</span>
          <span class="preview-value">${lineItemsCount}</span>
          <span class="preview-subtext">${lineItemsCount ? 'Defaults ready' : 'None added'}</span>
        </div>
      </div>
    `;
  };

  const rerenderAll = (): void => {
    renderTierList();
    renderFeatureList();
    renderMaintenanceList();
    renderLineItems();
    renderPreview();
  };

  rerenderAll();

  modal.body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const removeBtn = target.closest('.remove-row-btn') as HTMLElement | null;

    if (target.closest('#add-tier-btn')) {
      editorState.tiers.push({ id: `tier-${editorState.tiers.length + 1}`, name: '', basePrice: 0 });
      rerenderAll();
      return;
    }

    if (target.closest('#add-feature-btn')) {
      editorState.features.push({
        id: `feature-${editorState.features.length + 1}`,
        name: '',
        description: '',
        category: '',
        price: 0,
        includedTiers: [],
        isActive: true
      });
      rerenderAll();
      return;
    }

    if (target.closest('#add-maintenance-btn')) {
      editorState.maintenanceOptions.push({
        id: `maintenance-${editorState.maintenanceOptions.length + 1}`,
        name: '',
        description: '',
        price: 0,
        billingCycle: 'monthly'
      });
      rerenderAll();
      return;
    }

    if (target.closest('#add-line-item-btn')) {
      editorState.lineItems.push({
        description: '',
        quantity: 1,
        unitPrice: 0,
        unitLabel: '',
        category: '',
        isTaxable: true,
        isOptional: false
      });
      rerenderAll();
      return;
    }

    if (removeBtn) {
      const scope = removeBtn.dataset.scope;
      const index = parseInt(removeBtn.dataset.index || '-1', 10);
      if (index < 0) return;
      if (scope === 'tier') editorState.tiers.splice(index, 1);
      if (scope === 'feature') editorState.features.splice(index, 1);
      if (scope === 'maintenance') editorState.maintenanceOptions.splice(index, 1);
      if (scope === 'line-item') editorState.lineItems.splice(index, 1);
      rerenderAll();
    }
  });

  modal.body.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    const scope = target.dataset.scope;
    const field = target.dataset.field;
    const index = Number(target.dataset.index);

    if (!scope || !field || Number.isNaN(index)) return;

    if (scope === 'tier') {
      const tier = editorState.tiers[index];
      if (!tier) return;
      if (field === 'id') {
        const previousId = tier.id;
        tier.id = target.value.trim();
        if (previousId && previousId !== tier.id) {
          editorState.features.forEach(feature => {
            feature.includedTiers = feature.includedTiers.map(id => (id === previousId ? tier.id : id));
          });
        }
      } else if (field === 'name') {
        tier.name = target.value;
      } else if (field === 'basePrice') {
        tier.basePrice = Number(target.value || 0);
      } else if (field === 'description') {
        tier.description = target.value;
      }
      renderFeatureList();
      renderPreview();
      return;
    }

    if (scope === 'feature') {
      const feature = editorState.features[index];
      if (!feature) return;
      if (field === 'id') feature.id = target.value.trim();
      if (field === 'name') feature.name = target.value;
      if (field === 'category') feature.category = target.value;
      if (field === 'price') feature.price = Number(target.value || 0);
      if (field === 'isActive') feature.isActive = target.checked;
      renderPreview();
      return;
    }

    if (scope === 'maintenance') {
      const option = editorState.maintenanceOptions[index];
      if (!option) return;
      if (field === 'id') option.id = target.value.trim();
      if (field === 'name') option.name = target.value;
      if (field === 'price') option.price = Number(target.value || 0);
      if (field === 'billingCycle') option.billingCycle = target.value === 'yearly' ? 'yearly' : 'monthly';
      if (field === 'description') option.description = target.value;
      if (field === 'highlighted') option.highlighted = target.checked;
      renderPreview();
      return;
    }

    if (scope === 'line-item') {
      const item = editorState.lineItems[index];
      if (!item) return;
      if (field === 'description') item.description = target.value;
      if (field === 'unitPrice') item.unitPrice = Number(target.value || 0);
      if (field === 'quantity') item.quantity = Number(target.value || 1);
      if (field === 'unitLabel') item.unitLabel = target.value;
      if (field === 'category') item.category = target.value;
      if (field === 'isTaxable') item.isTaxable = target.checked;
      if (field === 'isOptional') item.isOptional = target.checked;
      renderPreview();
    }
  });

  modal.body.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    const scope = target.dataset.scope;

    if (scope === 'feature-tier') {
      const featureIndex = Number(target.dataset.index);
      const tierId = target.dataset.tierId || '';
      const feature = editorState.features[featureIndex];
      if (!feature || !tierId) return;
      if (target.checked) {
        if (!feature.includedTiers.includes(tierId)) feature.includedTiers.push(tierId);
      } else {
        feature.includedTiers = feature.includedTiers.filter(id => id !== tierId);
      }
      renderPreview();
      return;
    }

    if (scope === 'maintenance' && target.dataset.field === 'billingCycle') {
      const index = Number(target.dataset.index);
      const option = editorState.maintenanceOptions[index];
      if (option) {
        option.billingCycle = target.value === 'yearly' ? 'yearly' : 'monthly';
        renderPreview();
      }
    }
  });

  // Focus the name input
  setTimeout(() => {
    const nameInput = modal.body.querySelector('#template-name') as HTMLInputElement;
    nameInput?.focus();
  }, 100);
}

async function saveTemplateFromModal(
  templateId: number | null,
  modal: ReturnType<typeof createPortalModal>,
  ctx: AdminDashboardContext,
  editorState: {
    tiers: TemplateTier[];
    features: TemplateFeature[];
    maintenanceOptions: TemplateMaintenanceOption[];
    lineItems: TemplateLineItem[];
  }
): Promise<void> {
  const nameInput = modal.body.querySelector('#template-name') as HTMLInputElement;
  const descInput = modal.body.querySelector('#template-description') as HTMLTextAreaElement;
  const typeSelect = modal.body.querySelector('#template-project-type') as HTMLSelectElement;
  const validityInput = modal.body.querySelector('#template-validity') as HTMLInputElement;
  const defaultCheckbox = modal.body.querySelector('#template-is-default') as HTMLInputElement;
  const termsInput = modal.body.querySelector('#template-terms') as HTMLTextAreaElement;

  const name = nameInput?.value.trim();
  if (!name) {
    alertError('Please enter a template name');
    return;
  }

  if (!editorState.tiers.length) {
    alertError('Please add at least one tier');
    return;
  }

  const tiers = editorState.tiers
    .map(tier => ({
      id: tier.id.trim() || slugifyValue(tier.name || 'tier'),
      name: tier.name.trim() || tier.id.trim() || 'Tier',
      basePrice: Number(tier.basePrice || 0),
      description: tier.description?.trim() || undefined
    }))
    .filter(tier => tier.id && tier.name);

  if (!tiers.length) {
    alertError('Please provide valid tier details');
    return;
  }

  const features = editorState.features
    .map(feature => ({
      id: feature.id.trim() || slugifyValue(feature.name || 'feature'),
      name: feature.name.trim() || feature.id.trim(),
      description: feature.description?.trim() || undefined,
      category: feature.category?.trim() || undefined,
      price: Number(feature.price || 0),
      includedTiers: feature.includedTiers || [],
      isActive: feature.isActive !== false
    }))
    .filter(feature => feature.name);

  const maintenanceOptions = editorState.maintenanceOptions
    .map(option => ({
      id: option.id.trim() || slugifyValue(option.name || 'maintenance'),
      name: option.name.trim() || option.id.trim(),
      description: option.description?.trim() || undefined,
      price: Number(option.price || 0),
      billingCycle: option.billingCycle === 'yearly' ? 'yearly' : 'monthly',
      highlighted: option.highlighted || false,
      features: option.features || []
    }))
    .filter(option => option.name);

  const defaultLineItems = editorState.lineItems
    .map(item => ({
      description: item.description.trim(),
      unitPrice: Number(item.unitPrice || 0),
      quantity: Number(item.quantity ?? 1),
      unitLabel: item.unitLabel?.trim() || undefined,
      category: item.category?.trim() || undefined,
      isTaxable: item.isTaxable !== false,
      isOptional: item.isOptional === true
    }))
    .filter(item => item.description);

  const validityDays = Math.max(1, Number(validityInput?.value || 30));

  const templateData = {
    name,
    description: descInput?.value.trim() || null,
    projectType: typeSelect?.value || 'business-site',
    tierStructure: {
      tiers,
      features,
      maintenanceOptions
    },
    defaultLineItems,
    termsAndConditions: termsInput?.value.trim() || null,
    validityDays,
    isDefault: defaultCheckbox?.checked || false
  };

  try {
    let response;
    if (templateId) {
      response = await apiPut(`/api/proposals/templates/${templateId}`, templateData);
    } else {
      response = await apiPost('/api/proposals/templates', templateData);
    }

    if (response.ok) {
      alertSuccess(templateId ? 'Template updated' : 'Template created');
      modal.hide();
      activeTemplateModal = null;
      await loadTemplates(ctx);
    } else {
      const error = await response.text();
      alertError(`Failed to save template: ${error}`);
    }
  } catch (error) {
    console.error('[AdminProposals] Error saving template:', error);
    alertError('Network error saving template');
  }
}

async function deleteTemplate(templateId: number, ctx: AdminDashboardContext): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Template',
    message: 'Are you sure you want to delete this template? This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/proposals/templates/${templateId}`);
    if (response.ok) {
      alertSuccess('Template deleted');
      await loadTemplates(ctx);
    } else {
      alertError('Failed to delete template');
    }
  } catch (error) {
    console.error('[AdminProposals] Error deleting template:', error);
    alertError('Network error deleting template');
  }
}

async function useTemplate(templateId: number, ctx: AdminDashboardContext): Promise<void> {
  const template = templatesData.find(t => t.id === templateId);
  if (!template) return;

  // For now, show a notification - in a full implementation this would
  // pre-fill a proposal creation form with the template data
  ctx.showNotification?.(`Template "${template.name}" selected. Create a new proposal to use it.`, 'info');
}

// ============================================================================
// VERSION HISTORY
// ============================================================================

async function loadProposalVersions(proposalId: number): Promise<void> {
  const versionContainer = document.getElementById('version-history');
  if (!versionContainer) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/versions`);
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      currentProposalVersions = data.versions || [];
      renderVersionHistory(proposalId);
    } else {
      versionContainer.innerHTML = '<div class="empty-row">No versions available</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading versions:', error);
    versionContainer.innerHTML = '<div class="empty-row">Error loading versions</div>';
  }
}

function renderVersionHistory(proposalId: number): void {
  const versionContainer = document.getElementById('version-history');
  if (!versionContainer) return;

  if (currentProposalVersions.length === 0) {
    versionContainer.innerHTML = `
      <div class="version-empty">
        <p>No previous versions</p>
        <button class="btn btn-secondary btn-sm" id="create-version-btn">
          Save Current as Version
        </button>
      </div>
    `;
    const createBtn = document.getElementById('create-version-btn');
    if (createBtn) {
      createBtn.onclick = () => createVersion(proposalId);
    }
    return;
  }

  versionContainer.innerHTML = `
    <div class="version-actions">
      <button class="btn btn-secondary btn-sm" id="create-version-btn">
        Save Current as Version
      </button>
    </div>
    <div class="version-list">
      ${currentProposalVersions.map(version => `
        <div class="version-item" data-version-id="${version.id}">
          <div class="version-info">
            <span class="version-number">v${version.versionNumber}</span>
            <span class="version-date">${formatDateTime(version.createdAt)}</span>
            <span class="version-author">${SanitizationUtils.escapeHtml(version.createdBy)}</span>
          </div>
          ${version.notes ? `
            <div class="version-summary">${SanitizationUtils.escapeHtml(version.notes)}</div>
          ` : ''}
          <div class="version-actions">
            <button class="btn-link restore-version-btn" data-version-id="${version.id}">
              Restore
            </button>
            <button class="btn-link compare-version-btn" data-version-id="${version.id}">
              Compare
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Setup version listeners
  const createBtn = document.getElementById('create-version-btn');
  if (createBtn) {
    createBtn.onclick = () => createVersion(proposalId);
  }

  document.querySelectorAll('.restore-version-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const versionId = parseInt((btn as HTMLElement).dataset.versionId || '0', 10);
      await restoreVersion(proposalId, versionId);
    });
  });

  document.querySelectorAll('.compare-version-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const versionId = parseInt((btn as HTMLElement).dataset.versionId || '0', 10);
      await showVersionComparison(proposalId, versionId);
    });
  });
}

async function createVersion(proposalId: number): Promise<void> {
  const summary = prompt('Enter a summary of changes (optional):');

  try {
    const response = await apiPost(`/api/proposals/${proposalId}/versions`, {
      notes: summary || null
    });

    if (response.ok) {
      alertSuccess('Version saved');
      await loadProposalVersions(proposalId);
    } else {
      alertError('Failed to create version');
    }
  } catch (error) {
    console.error('[AdminProposals] Error creating version:', error);
    alertError('Network error creating version');
  }
}

async function restoreVersion(proposalId: number, versionId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Restore Version',
    message: 'This will restore the proposal to this version. A backup of the current state will be saved. Continue?',
    confirmText: 'Restore',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/proposals/${proposalId}/versions/${versionId}/restore`, {});

    if (response.ok) {
      alertSuccess('Version restored');
      // Refresh the proposal details
      if (_storedContext) {
        await refreshProposals(_storedContext);
      }
    } else {
      alertError('Failed to restore version');
    }
  } catch (error) {
    console.error('[AdminProposals] Error restoring version:', error);
    alertError('Network error restoring version');
  }
}

async function showVersionComparison(proposalId: number, versionId: number): Promise<void> {
  try {
    const versionsSorted = [...currentProposalVersions].sort((a, b) => b.versionNumber - a.versionNumber);
    const latestVersion = versionsSorted[0]?.id;
    if (!latestVersion) {
      alertError('No versions available to compare');
      return;
    }

    let version1 = latestVersion;
    const version2 = versionId;

    if (version1 === version2 && versionsSorted[1]) {
      version1 = versionsSorted[1].id;
    }

    if (version1 === version2) {
      alertError('Select a different version to compare');
      return;
    }

    const response = await apiFetch(`/api/proposals/versions/compare?version1=${version1}&version2=${version2}`);

    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      const comparison = data.comparison || data;
      const differences = comparison?.differences || {};

      const changeEntries = Object.entries(differences);
      if (changeEntries.length === 0) {
        alertSuccess('No differences found between versions');
      } else {
        alert(`Changes:\n${changeEntries.map(([field, value]) => {
          const diff = value as { v1?: unknown; v2?: unknown };
          return `- ${field}: ${diff.v1 ?? 'N/A'} → ${diff.v2 ?? 'N/A'}`;
        }).join('\n')}`);
      }
    } else {
      alertError('Failed to compare versions');
    }
  } catch (error) {
    console.error('[AdminProposals] Error comparing versions:', error);
    alertError('Network error comparing versions');
  }
}

// ============================================================================
// SIGNATURE STATUS
// ============================================================================

async function loadSignatureStatus(proposalId: number): Promise<void> {
  const signatureContainer = document.getElementById('signature-status');
  if (!signatureContainer) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/signature-status`);
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      renderSignatureStatus(proposalId, data);
    } else if (response.status === 404) {
      // No signature requested yet
      renderSignatureStatus(proposalId, null);
    } else {
      signatureContainer.innerHTML = '<div class="empty-row">Error loading signature status</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading signature status:', error);
    signatureContainer.innerHTML = '<div class="empty-row">Error loading signature status</div>';
  }
}

interface SignatureData {
  status: 'pending' | 'signed' | 'declined' | 'expired';
  requested_at: string;
  signed_at?: string;
  signer_name?: string;
  signer_email?: string;
  expires_at?: string;
}

function renderSignatureStatus(proposalId: number, signature: SignatureData | null): void {
  const signatureContainer = document.getElementById('signature-status');
  if (!signatureContainer) return;

  if (!signature) {
    signatureContainer.innerHTML = `
      <div class="signature-empty">
        <p>No signature requested</p>
        <button class="btn btn-primary btn-sm" id="request-signature-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          Request E-Signature
        </button>
      </div>
    `;
    const requestBtn = document.getElementById('request-signature-btn');
    if (requestBtn) {
      requestBtn.onclick = () => requestSignature(proposalId);
    }
    return;
  }

  const statusClass = {
    pending: 'status-pending',
    signed: 'status-success',
    declined: 'status-danger',
    expired: 'status-warning'
  }[signature.status] || 'status-pending';

  const statusLabel = {
    pending: 'Awaiting Signature',
    signed: 'Signed',
    declined: 'Declined',
    expired: 'Expired'
  }[signature.status] || signature.status;

  signatureContainer.innerHTML = `
    <div class="signature-info">
      <div class="signature-badge ${statusClass}">
        ${statusLabel}
      </div>
      <div class="signature-details">
        <p><strong>Requested:</strong> ${formatDateTime(signature.requested_at)}</p>
        ${signature.signed_at ? `<p><strong>Signed:</strong> ${formatDateTime(signature.signed_at)}</p>` : ''}
        ${signature.signer_name ? `<p><strong>Signer:</strong> ${SanitizationUtils.escapeHtml(signature.signer_name)}</p>` : ''}
        ${signature.expires_at ? `<p><strong>Expires:</strong> ${formatDateTime(signature.expires_at)}</p>` : ''}
      </div>
      ${signature.status === 'pending' ? `
        <div class="signature-actions">
          <button class="btn btn-secondary btn-sm" id="resend-signature-btn">Resend Request</button>
          <button class="btn btn-danger btn-sm" id="cancel-signature-btn">Cancel Request</button>
        </div>
      ` : ''}
      ${signature.status === 'expired' ? `
        <div class="signature-actions">
          <button class="btn btn-primary btn-sm" id="request-signature-btn">Request New Signature</button>
        </div>
      ` : ''}
    </div>
  `;

  // Setup signature action listeners
  const requestBtn = document.getElementById('request-signature-btn');
  if (requestBtn) {
    requestBtn.onclick = () => requestSignature(proposalId);
  }

  const resendBtn = document.getElementById('resend-signature-btn');
  if (resendBtn) {
    resendBtn.onclick = () => resendSignatureRequest(proposalId);
  }

  const cancelBtn = document.getElementById('cancel-signature-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => cancelSignatureRequest(proposalId);
  }
}

async function requestSignature(proposalId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/proposals/${proposalId}/request-signature`, {});

    if (response.ok) {
      alertSuccess('Signature request sent to client');
      await loadSignatureStatus(proposalId);
    } else {
      const error = await response.text();
      alertError(`Failed to request signature: ${error}`);
    }
  } catch (error) {
    console.error('[AdminProposals] Error requesting signature:', error);
    alertError('Network error requesting signature');
  }
}

async function resendSignatureRequest(proposalId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/proposals/${proposalId}/resend-signature`, {});

    if (response.ok) {
      alertSuccess('Signature request resent');
    } else {
      alertError('Failed to resend signature request');
    }
  } catch (error) {
    console.error('[AdminProposals] Error resending signature:', error);
    alertError('Network error resending signature');
  }
}

async function cancelSignatureRequest(proposalId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Cancel Signature Request',
    message: 'Are you sure you want to cancel the signature request?',
    confirmText: 'Cancel Request',
    cancelText: 'Keep Request',
    danger: true
  });

  if (!confirmed) return;

  try {
    const response = await apiDelete(`/api/proposals/${proposalId}/signature`);

    if (response.ok) {
      alertSuccess('Signature request cancelled');
      await loadSignatureStatus(proposalId);
    } else {
      alertError('Failed to cancel signature request');
    }
  } catch (error) {
    console.error('[AdminProposals] Error cancelling signature:', error);
    alertError('Network error cancelling signature');
  }
}

function updateStats(proposals: Proposal[]): void {
  const pending = proposals.filter(p => p.status === 'pending').length;
  const reviewed = proposals.filter(p => p.status === 'reviewed').length;
  const accepted = proposals.filter(p => p.status === 'accepted').length;
  const totalValue = proposals
    .filter(p => ['accepted', 'converted'].includes(p.status))
    .reduce((sum, p) => sum + p.finalPrice, 0);

  const statPending = document.getElementById('stat-pending');
  const statReviewed = document.getElementById('stat-reviewed');
  const statAccepted = document.getElementById('stat-accepted');
  const statTotal = document.getElementById('stat-total-value');

  if (statPending) statPending.textContent = pending.toString();
  if (statReviewed) statReviewed.textContent = reviewed.toString();
  if (statAccepted) statAccepted.textContent = accepted.toString();
  if (statTotal) statTotal.textContent = formatPrice(totalValue);
}

// ============================================================================
// PROPOSAL DETAILS
// ============================================================================

async function showProposalDetails(proposal: Proposal, ctx: AdminDashboardContext): Promise<void> {
  const detailsPanel = document.getElementById('proposal-details-panel');
  const detailsContent = document.getElementById('proposal-details-content');
  const tablePanel = document.querySelector('.proposals-panel') as HTMLElement;

  if (!detailsPanel || !detailsContent || !tablePanel) return;

  _currentProposal = proposal;

  // Hide table, show details
  tablePanel.style.display = 'none';
  detailsPanel.style.display = 'block';

  // Render details
  detailsContent.innerHTML = renderProposalDetailsContent(proposal);

  // Setup event listeners for details panel
  setupDetailsEventListeners(proposal, ctx);

  // Load all proposal sections
  await Promise.all([
    loadProposalVersions(proposal.id),
    loadSignatureStatus(proposal.id),
    loadCustomItems(proposal.id),
    loadProposalComments(proposal.id),
    loadProposalActivities(proposal.id),
    loadDiscountSection(proposal)
  ]);
}

function hideProposalDetails(): void {
  const detailsPanel = document.getElementById('proposal-details-panel');
  const tablePanel = document.querySelector('.proposals-panel') as HTMLElement;

  if (detailsPanel) detailsPanel.style.display = 'none';
  if (tablePanel) tablePanel.style.display = 'block';
}

function renderProposalDetailsContent(proposal: Proposal): string {
  const tierLabel = proposal.selectedTier.charAt(0).toUpperCase() + proposal.selectedTier.slice(1);
  const formattedDate = formatDate(proposal.createdAt);

  const includedFeatures = proposal.features?.filter(f => f.isIncludedInTier) || [];
  const addonFeatures = proposal.features?.filter(f => f.isAddon) || [];

  return `
    <div class="proposal-details">
      <div class="details-section">
        <h4>Client Information</h4>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Name</span>
            <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.name))}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Email</span>
            <span class="detail-value">${getEmailWithCopyHtml(proposal.client.email || '', SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.email || '')))}</span>
          </div>
          ${proposal.client.company ? `
            <div class="detail-item">
              <span class="detail-label">Company</span>
              <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.client.company))}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="details-section">
        <h4>Project Details</h4>
        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-label">Project</span>
            <span class="detail-value">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.project.name))}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Type</span>
            <span class="detail-value">${formatProjectType(proposal.projectType)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Submitted</span>
            <span class="detail-value">${formattedDate}</span>
          </div>
        </div>
      </div>

      <div class="details-section">
        <h4>Package Selection</h4>
        <div class="package-summary">
          <div class="package-tier">
            <span class="tier-badge tier-${proposal.selectedTier} large">${tierLabel} Package</span>
            <span class="package-price">${formatPrice(proposal.basePrice)}</span>
          </div>
          ${proposal.maintenanceOption && proposal.maintenanceOption !== 'diy' ? `
            <div class="maintenance-selection">
              <span class="maintenance-label">Maintenance Plan:</span>
              <span class="maintenance-value">${formatMaintenanceOption(proposal.maintenanceOption)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${includedFeatures.length > 0 ? `
        <div class="details-section">
          <h4>Included Features</h4>
          <ul class="features-list">
            ${includedFeatures.map(f => `
              <li class="feature-item feature-included">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
                <span>${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(f.featureName))}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      ${addonFeatures.length > 0 ? `
        <div class="details-section">
          <h4>Add-ons Selected</h4>
          <ul class="features-list">
            ${addonFeatures.map(f => `
              <li class="feature-item feature-addon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                <span>${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(f.featureName))}</span>
                <span class="addon-price">+${formatPrice(f.featurePrice)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      <div class="details-section">
        <h4>Pricing</h4>
        <div class="pricing-summary">
          <div class="price-row">
            <span>Base Package</span>
            <span>${formatPrice(proposal.basePrice)}</span>
          </div>
          ${addonFeatures.length > 0 ? `
            <div class="price-row">
              <span>Add-ons</span>
              <span>+${formatPrice(proposal.finalPrice - proposal.basePrice)}</span>
            </div>
          ` : ''}
          <div class="price-row total">
            <span>Total</span>
            <span>${formatPrice(proposal.finalPrice)}</span>
          </div>
        </div>
      </div>

      ${proposal.clientNotes ? `
        <div class="details-section">
          <h4>Client Notes</h4>
          <div class="notes-content">${SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(proposal.clientNotes))}</div>
        </div>
      ` : ''}

      <div class="details-section">
        <h4>Admin Notes</h4>
        <textarea class="admin-notes-input" id="admin-notes-input" placeholder="Add internal notes about this proposal...">${proposal.adminNotes || ''}</textarea>
        <button class="btn btn-secondary" id="save-notes-btn">Save Notes</button>
      </div>

      <div class="details-section">
        <h4>Custom Line Items</h4>
        <div class="custom-items-section" id="custom-items-section">
          <div class="loading-row">Loading custom items...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Discount</h4>
        <div class="discount-section" id="discount-section">
          <div class="loading-row">Loading discount info...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Comments</h4>
        <div class="comments-section" id="comments-section">
          <div class="loading-row">Loading comments...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Activity Log</h4>
        <div class="activity-section" id="activity-section">
          <div class="loading-row">Loading activity...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Version History</h4>
        <div class="version-history" id="version-history">
          <div class="loading-row">Loading versions...</div>
        </div>
      </div>

      <div class="details-section">
        <h4>Signature Status</h4>
        <div class="signature-status" id="signature-status">
          <div class="loading-row">Loading signature status...</div>
        </div>
      </div>

      <div class="details-actions">
        ${proposal.status === 'pending' ? `
          <button class="btn btn-success" id="accept-proposal-btn">Accept Proposal</button>
          <button class="btn btn-danger" id="reject-proposal-btn">Reject Proposal</button>
        ` : ''}
        ${proposal.status === 'accepted' ? `
          <button class="btn btn-primary" id="convert-proposal-btn">Convert to Invoice</button>
        ` : ''}
      </div>
    </div>
  `;
}

function setupDetailsEventListeners(proposal: Proposal, ctx: AdminDashboardContext): void {
  // Save notes button
  const saveNotesBtn = document.getElementById('save-notes-btn');
  if (saveNotesBtn) {
    saveNotesBtn.onclick = async () => {
      const notesInput = document.getElementById('admin-notes-input') as HTMLTextAreaElement;
      if (notesInput) {
        await updateProposalNotes(proposal.id, notesInput.value, ctx);
      }
    };
  }

  // Accept button
  const acceptBtn = document.getElementById('accept-proposal-btn');
  if (acceptBtn) {
    acceptBtn.onclick = async () => {
      await updateProposalStatus(proposal.id, 'accepted', ctx);
      hideProposalDetails();
    };
  }

  // Reject button
  const rejectBtn = document.getElementById('reject-proposal-btn');
  if (rejectBtn) {
    rejectBtn.onclick = async () => {
      const confirmed = await confirmDialog({
        title: 'Reject Proposal',
        message: 'Are you sure you want to reject this proposal?',
        confirmText: 'Reject',
        cancelText: 'Cancel',
        danger: true
      });
      if (confirmed) {
        await updateProposalStatus(proposal.id, 'rejected', ctx);
        hideProposalDetails();
      }
    };
  }

  // Convert button
  const convertBtn = document.getElementById('convert-proposal-btn');
  if (convertBtn) {
    convertBtn.onclick = async () => {
      await convertToInvoice(proposal.id, ctx);
    };
  }
}

// ============================================================================
// API ACTIONS
// ============================================================================

async function updateProposalStatus(
  proposalId: number,
  status: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/proposals/admin/${proposalId}`, { status });

    if (response.ok) {
      await refreshProposals(ctx);
      ctx.showNotification?.(`Proposal status updated to ${status}`, 'success');
    } else {
      const error = await response.text();
      console.error('[AdminProposals] Failed to update status:', error);
      ctx.showNotification?.('Failed to update proposal status', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error updating status:', error);
    ctx.showNotification?.('Network error updating proposal', 'error');
  }
}

async function updateProposalNotes(
  proposalId: number,
  notes: string,
  ctx: AdminDashboardContext
): Promise<void> {
  try {
    const response = await apiPut(`/api/proposals/admin/${proposalId}`, { adminNotes: notes });

    if (response.ok) {
      ctx.showNotification?.('Notes saved successfully', 'success');
      // Refresh proposals to show updated notes in the details panel
      await refreshProposals(ctx);
    } else {
      ctx.showNotification?.('Failed to save notes', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error saving notes:', error);
    ctx.showNotification?.('Network error saving notes', 'error');
  }
}

async function convertToInvoice(proposalId: number, ctx: AdminDashboardContext): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Convert to Invoice',
    message: 'This will create a draft invoice based on this proposal. Continue?',
    confirmText: 'Create Invoice',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/proposals/admin/${proposalId}/convert`, {});

    if (response.ok) {
      const data = await response.json();
      await refreshProposals(ctx);
      hideProposalDetails();
      ctx.showNotification?.(`Invoice ${data.data.invoiceNumber} created`, 'success');
    } else {
      const error = await response.text();
      console.error('[AdminProposals] Failed to convert:', error);
      ctx.showNotification?.('Failed to create invoice', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error converting:', error);
    ctx.showNotification?.('Network error creating invoice', 'error');
  }
}

// ============================================================================
// CUSTOM LINE ITEMS
// ============================================================================

async function loadCustomItems(proposalId: number): Promise<void> {
  const container = document.getElementById('custom-items-section');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/custom-items`);
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      renderCustomItems(proposalId, data.items || []);
    } else {
      container.innerHTML = '<div class="empty-state-small">No custom items</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading custom items:', error);
    container.innerHTML = '<div class="empty-state-small">Error loading items</div>';
  }
}

function renderCustomItems(proposalId: number, items: ProposalCustomItem[]): void {
  const container = document.getElementById('custom-items-section');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state-small">No custom line items</div>
      <button class="btn btn-secondary btn-sm" id="add-custom-item-btn">Add Line Item</button>
    `;
    const addBtn = document.getElementById('add-custom-item-btn');
    if (addBtn) addBtn.onclick = () => showAddCustomItemDialog(proposalId);
    return;
  }

  const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  container.innerHTML = `
    <div class="custom-items-list">
      ${items.map(item => `
        <div class="custom-item-row" data-item-id="${item.id}">
          <div class="item-info">
            <span class="item-type-badge">${item.itemType}</span>
            <span class="item-description">${SanitizationUtils.escapeHtml(item.description)}</span>
          </div>
          <div class="item-pricing">
            <span>${item.quantity} × ${formatPrice(item.unitPrice)}</span>
            <span class="item-total">${formatPrice(item.quantity * item.unitPrice)}</span>
          </div>
          <button class="icon-btn icon-btn-danger delete-item-btn" data-item-id="${item.id}" title="Delete" aria-label="Delete item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      `).join('')}
    </div>
    <div class="custom-items-footer">
      <span class="items-total">Custom Items Total: ${formatPrice(total)}</span>
      <button class="btn btn-secondary btn-sm" id="add-custom-item-btn">Add Item</button>
    </div>
  `;

  // Setup event listeners
  const addBtn = document.getElementById('add-custom-item-btn');
  if (addBtn) addBtn.onclick = () => showAddCustomItemDialog(proposalId);

  container.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = parseInt((btn as HTMLElement).dataset.itemId || '0');
      await deleteCustomItem(itemId, proposalId);
    });
  });
}

async function showAddCustomItemDialog(proposalId: number): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Add Custom Line Item',
    fields: [
      { name: 'description', label: 'Description', type: 'text', required: true },
      { name: 'item_type', label: 'Type', type: 'select', options: [
        { value: 'service', label: 'Service' },
        { value: 'product', label: 'Product' },
        { value: 'fee', label: 'Fee' },
        { value: 'discount', label: 'Discount' },
        { value: 'hourly', label: 'Hourly Rate' }
      ], required: true },
      { name: 'quantity', label: 'Quantity', type: 'text', required: true },
      { name: 'unit_price', label: 'Unit Price ($)', type: 'text', required: true }
    ],
    confirmText: 'Add Item',
    cancelText: 'Cancel'
  });

  if (result) {
    try {
      const response = await apiPost(`/api/proposals/${proposalId}/custom-items`, {
        description: result.description,
        itemType: result.item_type,
        quantity: parseFloat(result.quantity) || 1,
        unitPrice: parseFloat(result.unit_price) || 0
      });

      if (response.ok) {
        showToast('Item added', 'success');
        await loadCustomItems(proposalId);
      } else {
        showToast('Failed to add item', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error adding custom item:', error);
      showToast('Error adding item', 'error');
    }
  }
}

async function deleteCustomItem(itemId: number, proposalId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Delete Item',
    message: 'Are you sure you want to delete this line item?',
    confirmText: 'Delete',
    danger: true
  });

  if (confirmed) {
    try {
      const response = await apiDelete(`/api/proposals/custom-items/${itemId}`);
      if (response.ok) {
        showToast('Item deleted', 'success');
        await loadCustomItems(proposalId);
      } else {
        showToast('Failed to delete item', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error deleting custom item:', error);
      showToast('Error deleting item', 'error');
    }
  }
}

// ============================================================================
// DISCOUNTS
// ============================================================================

function loadDiscountSection(proposal: Proposal): void {
  const container = document.getElementById('discount-section');
  if (!container) return;

  // Check if proposal has discount info (would need to be added to Proposal interface)
  const hasDiscount = false; // placeholder - check proposal.discount_type

  if (!hasDiscount) {
    container.innerHTML = `
      <div class="discount-empty">
        <span>No discount applied</span>
        <button class="btn btn-secondary btn-sm" id="apply-discount-btn">Apply Discount</button>
      </div>
    `;
    const applyBtn = document.getElementById('apply-discount-btn');
    if (applyBtn) applyBtn.onclick = () => showApplyDiscountDialog(proposal.id);
    return;
  }

  // If discount exists, show it with remove option
  container.innerHTML = `
    <div class="discount-info">
      <span class="discount-badge">Discount Applied</span>
      <button class="btn btn-danger btn-sm" id="remove-discount-btn">Remove</button>
    </div>
  `;

  const removeBtn = document.getElementById('remove-discount-btn');
  if (removeBtn) removeBtn.onclick = () => removeDiscount(proposal.id);
}

async function showApplyDiscountDialog(proposalId: number): Promise<void> {
  const result = await multiPromptDialog({
    title: 'Apply Discount',
    fields: [
      { name: 'type', label: 'Discount Type', type: 'select', options: [
        { value: 'percentage', label: 'Percentage' },
        { value: 'fixed', label: 'Fixed Amount' }
      ], required: true },
      { name: 'value', label: 'Value (% or $)', type: 'text', required: true },
      { name: 'reason', label: 'Reason', type: 'text' }
    ],
    confirmText: 'Apply',
    cancelText: 'Cancel'
  });

  if (result) {
    try {
      const response = await apiPost(`/api/proposals/${proposalId}/discount`, {
        type: result.type,
        value: parseFloat(result.value) || 0,
        reason: result.reason || null
      });

      if (response.ok) {
        showToast('Discount applied', 'success');
        if (_storedContext) await refreshProposals(_storedContext);
      } else {
        showToast('Failed to apply discount', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error applying discount:', error);
      showToast('Error applying discount', 'error');
    }
  }
}

async function removeDiscount(proposalId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Remove Discount',
    message: 'Are you sure you want to remove the discount?',
    confirmText: 'Remove',
    danger: true
  });

  if (confirmed) {
    try {
      const response = await apiDelete(`/api/proposals/${proposalId}/discount`);
      if (response.ok) {
        showToast('Discount removed', 'success');
        if (_storedContext) await refreshProposals(_storedContext);
      } else {
        showToast('Failed to remove discount', 'error');
      }
    } catch (error) {
      console.error('[AdminProposals] Error removing discount:', error);
      showToast('Error removing discount', 'error');
    }
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

async function loadProposalComments(proposalId: number): Promise<void> {
  const container = document.getElementById('comments-section');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/comments`);
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      renderComments(proposalId, data.comments || []);
    } else {
      container.innerHTML = '<div class="empty-state-small">No comments</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading comments:', error);
    container.innerHTML = '<div class="empty-state-small">Error loading comments</div>';
  }
}

function renderComments(proposalId: number, comments: ProposalComment[]): void {
  const container = document.getElementById('comments-section');
  if (!container) return;

  container.innerHTML = `
    ${comments.length > 0 ? `
      <div class="comments-list">
        ${comments.map(comment => `
          <div class="comment-item ${comment.isInternal ? 'comment-internal' : ''}">
            <div class="comment-header">
              <span class="comment-author">${SanitizationUtils.escapeHtml(comment.authorName)}</span>
              <span class="comment-type">${comment.authorType}</span>
              ${comment.isInternal ? '<span class="comment-internal-badge">Internal</span>' : ''}
              <span class="comment-date">${formatDateTime(comment.createdAt)}</span>
            </div>
            <div class="comment-content">${SanitizationUtils.escapeHtml(comment.content)}</div>
          </div>
        `).join('')}
      </div>
    ` : '<div class="empty-state-small">No comments yet</div>'}
    <div class="add-comment-form">
      <textarea id="new-comment-input" placeholder="Add a comment..." rows="2"></textarea>
      <div class="comment-actions">
        <label class="checkbox-label">
          <input type="checkbox" id="comment-internal-checkbox">
          <span>Internal only</span>
        </label>
        <button class="btn btn-secondary btn-sm" id="add-comment-btn">Add Comment</button>
      </div>
    </div>
  `;

  const addBtn = document.getElementById('add-comment-btn');
  if (addBtn) {
    addBtn.onclick = () => addComment(proposalId);
  }
}

async function addComment(proposalId: number): Promise<void> {
  const input = document.getElementById('new-comment-input') as HTMLTextAreaElement;
  const internalCheckbox = document.getElementById('comment-internal-checkbox') as HTMLInputElement;

  const content = input?.value.trim();
  if (!content) {
    showToast('Please enter a comment', 'error');
    return;
  }

  try {
    const response = await apiPost(`/api/proposals/${proposalId}/comments`, {
      content,
      authorType: 'admin',
      authorName: 'Admin',
      isInternal: internalCheckbox?.checked || false
    });

    if (response.ok) {
      showToast('Comment added', 'success');
      await loadProposalComments(proposalId);
    } else {
      showToast('Failed to add comment', 'error');
    }
  } catch (error) {
    console.error('[AdminProposals] Error adding comment:', error);
    showToast('Error adding comment', 'error');
  }
}

// ============================================================================
// ACTIVITY LOG
// ============================================================================

async function loadProposalActivities(proposalId: number): Promise<void> {
  const container = document.getElementById('activity-section');
  if (!container) return;

  try {
    const response = await apiFetch(`/api/proposals/${proposalId}/activities`);
    if (response.ok) {
      const json = await response.json();
      const data = json.data ?? json;
      renderActivities(data.activities || []);
    } else {
      container.innerHTML = '<div class="empty-state-small">No activity</div>';
    }
  } catch (error) {
    console.error('[AdminProposals] Error loading activities:', error);
    container.innerHTML = '<div class="empty-state-small">Error loading activity</div>';
  }
}

function renderActivities(activities: ProposalActivity[]): void {
  const container = document.getElementById('activity-section');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = '<div class="empty-state-small">No activity recorded</div>';
    return;
  }

  const activityLabels: Record<string, string> = {
    viewed: 'Viewed',
    downloaded: 'PDF Downloaded',
    commented: 'Comment Added',
    signed: 'Signed',
    status_changed: 'Status Changed',
    version_created: 'Version Created',
    version_restored: 'Version Restored',
    sent: 'Sent to Client',
    reminder_sent: 'Reminder Sent',
    signature_requested: 'Signature Requested',
    signature_declined: 'Signature Declined',
    discount_applied: 'Discount Applied',
    discount_removed: 'Discount Removed'
  };

  container.innerHTML = `
    <div class="activity-list">
      ${activities.slice(0, 10).map(activity => `
        <div class="activity-item">
          <span class="activity-type">${activityLabels[activity.activityType] || activity.activityType}</span>
          ${activity.actor ? `<span class="activity-actor">by ${SanitizationUtils.escapeHtml(activity.actor)}</span>` : ''}
          <span class="activity-date">${formatDateTime(activity.createdAt)}</span>
        </div>
      `).join('')}
    </div>
    ${activities.length > 10 ? `<div class="activity-more">${activities.length - 10} more activities...</div>` : ''}
  `;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// NOTE: formatProjectType moved to shared format-utils.ts

function formatMaintenanceOption(option: string | null): string {
  if (!option) return 'None';
  const labels: Record<string, string> = {
    'diy': 'DIY (Self-managed)',
    'essential': 'Essential Care ($99/mo)',
    'standard': 'Standard Care ($249/mo)',
    'premium': 'Premium Care ($499/mo)'
  };
  return labels[option] || option;
}

export default {
  loadProposals,
  getProposalsData,
  setProposalsContext
};
