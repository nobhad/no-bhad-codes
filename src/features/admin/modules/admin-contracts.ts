/**
 * ===============================================
 * ADMIN CONTRACTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-contracts.ts
 *
 * Admin dashboard contracts list + detail modal.
 *
 * Uses createTableModule factory for standardized table operations.
 */

import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { getStatusBadgeHTML } from '../../../components/status-badge';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { confirmDialog, alertError } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { createPortalModal } from '../../../components/portal-modal';
import { ICONS } from '../../../constants/icons';
import { renderActionsCell, createAction } from '../../../factories';
import {
  saveFilterState,
  updateFilterStatusOptions,
  CONTRACTS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import {
  createRowCheckbox,
  resetSelection,
  type BulkActionConfig
} from '../../../utils/table-bulk-actions';
import type { AdminDashboardContext } from '../admin-types';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { makeEditable } from '../../../components/inline-edit';
import { batchUpdateText } from '../../../utils/dom-cache';
import {
  createTableModule,
  createPaginationConfig,
  type TableModuleHelpers
} from '../../../utils/table-module-factory';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('AdminContracts');

interface ContractListItem {
  id: number;
  projectId: number;
  clientId: number;
  status: string;
  content: string;
  sentAt?: string | null;
  signedAt?: string | null;
  expiresAt?: string | null;
  projectName?: string;
  clientName?: string;
  clientEmail?: string;
  templateName?: string;
  templateType?: string | null;
  parentContractId?: number | null;
  renewalAt?: string | null;
  reminderCount?: number | null;
  lastReminderAt?: string | null;
}

interface ContractActivityItem {
  id: number;
  action: string;
  actor_email?: string | null;
  actor_ip?: string | null;
  details?: string | null;
  created_at: string;
}

interface ContractStats {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  signed: number;
}

// Module-specific state
let listenersInitialized = false;
let filterContainerEl: HTMLElement | null = null;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  expired: 'Expired',
  cancelled: 'Cancelled'
};

const STATUS_VARIANTS: Record<string, string> = {
  draft: 'pending',
  sent: 'pending',
  viewed: 'pending',
  signed: 'completed',
  expired: 'cancelled',
  cancelled: 'cancelled'
};

const STATUS_FILTER_MAP: Record<string, string[]> = {
  all: [],
  draft: ['draft'],
  sent: ['sent'],
  viewed: ['viewed'],
  signed: ['signed'],
  expired: ['expired'],
  cancelled: ['cancelled']
};

// Bulk action configuration for contracts table
const CONTRACTS_BULK_CONFIG: BulkActionConfig = {
  tableId: 'contracts',
  actions: [
    {
      id: 'send-reminder',
      label: 'Send Reminders',
      icon: ICONS.BELL,
      variant: 'default',
      confirmMessage: 'Send reminders for {count} selected contracts?',
      handler: async (ids: number[]) => {
        const results = await Promise.all(
          ids.map(id =>
            apiPost(`/api/contracts/${id}/remind`, {})
              .then(res => ({ id, success: res.ok }))
              .catch(() => ({ id, success: false }))
          )
        );
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          showToast(`Sent ${successCount} reminder${successCount > 1 ? 's' : ''}`, 'success');
          resetSelection('contracts');
        }
      }
    },
    {
      id: 'expire',
      label: 'Mark Expired',
      icon: ICONS.CLOCK,
      variant: 'warning',
      confirmMessage: 'Mark {count} selected contracts as expired?',
      handler: async (ids: number[]) => {
        const results = await Promise.all(
          ids.map(id =>
            apiPut(`/api/contracts/${id}`, { status: 'expired' })
              .then(res => ({ id, success: res.ok }))
              .catch(() => ({ id, success: false }))
          )
        );
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          showToast(`Marked ${successCount} contract${successCount > 1 ? 's' : ''} as expired`, 'success');
          resetSelection('contracts');
          // Reload data to reflect changes - dispatch custom event
          window.dispatchEvent(new CustomEvent('contracts:reload'));
        }
      }
    }
  ]
};

function getStatusBadge(status: string): string {
  const label = STATUS_LABELS[status] || status;
  const variant = STATUS_VARIANTS[status] || 'pending';
  return getStatusBadgeHTML(label, variant);
}

function formatDateSafe(value?: string | null): string {
  if (!value) return '-';
  return formatDate(value);
}

function formatDateTimeSafe(value?: string | null): string {
  if (!value) return '-';
  return formatDateTime(value);
}

// ============================================
// TABLE MODULE FACTORY
// ============================================

/**
 * Contracts table module using factory pattern
 */
const contractsModule = createTableModule<ContractListItem, ContractStats>({
  moduleId: 'contracts',
  filterConfig: CONTRACTS_FILTER_CONFIG,
  paginationConfig: { ...createPaginationConfig('contracts'), defaultPageSize: 10 },
  columnCount: 9,
  apiEndpoint: '/api/contracts',
  bulkConfig: CONTRACTS_BULK_CONFIG,

  emptyMessage: 'No contracts found.',
  filterEmptyMessage: 'No contracts match the current filters.',

  extractData: (response: unknown) => {
    const data = response as { contracts?: ContractListItem[] };
    const contracts = Array.isArray(data.contracts) ? data.contracts : [];
    const stats: ContractStats = {
      total: contracts.length,
      draft: contracts.filter(c => c.status === 'draft').length,
      sent: contracts.filter(c => c.status === 'sent').length,
      viewed: contracts.filter(c => c.status === 'viewed').length,
      signed: contracts.filter(c => c.status === 'signed').length
    };
    return { data: contracts, stats };
  },

  renderRow: (contract: ContractListItem, _ctx: AdminDashboardContext, _helpers: TableModuleHelpers<ContractListItem>) => {
    return buildContractRow(contract);
  },

  renderStats: (stats: ContractStats) => {
    batchUpdateText({
      'contracts-total': stats.total.toString(),
      'contracts-draft': stats.draft.toString(),
      'contracts-sent': stats.sent.toString(),
      'contracts-viewed': stats.viewed.toString(),
      'contracts-signed': stats.signed.toString()
    });
  },

  onDataLoaded: (_data: ContractListItem[], ctx: AdminDashboardContext) => {
    // Setup event listeners
    attachContractsListeners(ctx);
    // Listen for reload events from bulk actions
    const reloadHandler = () => contractsModule.load(ctx);
    window.addEventListener('contracts:reload', reloadHandler, { once: true });
  },

  onTableRendered: (filteredData: ContractListItem[], _ctx: AdminDashboardContext) => {
    const tableBody = contractsModule.getElement('contracts-table-body');
    if (!tableBody) return;

    // Setup inline editing for expires_at cells
    setupInlineExpiresEditing(tableBody, filteredData);

    // Initialize keyboard navigation
    initTableKeyboardNav({
      tableSelector: '.contracts-table',
      rowSelector: 'tbody tr[data-contract-id]',
      onRowSelect: (row) => {
        const contractId = parseInt(row.dataset.contractId || '0');
        const contract = contractsModule.findById(contractId);
        if (contract) openContractDetail(contract);
      },
      focusClass: 'row-focused',
      selectedClass: 'row-selected'
    });
  }
});

// Export factory-provided functions
export const loadContracts = contractsModule.load;
export const getContractsData = contractsModule.getData;

// ============================================
// ROW BUILDING HELPERS
// ============================================

/**
 * Build a single contract table row
 */
function buildContractRow(contract: ContractListItem): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.dataset.contractId = String(contract.id);

  const title = SanitizationUtils.escapeHtml(contract.templateName || `Contract #${contract.id}`);
  const projectName = SanitizationUtils.escapeHtml(contract.projectName || 'Project');
  const clientName = SanitizationUtils.escapeHtml(contract.clientName || 'Client');
  const clientEmail = SanitizationUtils.escapeHtml(contract.clientEmail || '');
  const typeLabel = contract.templateType ? ` · ${contract.templateType}` : '';
  const amendmentLabel = contract.parentContractId ? ' · Amendment' : '';

  row.innerHTML = `
    ${createRowCheckbox('contracts', contract.id)}
    <td class="identity-cell" data-label="Contract">
      <span class="identity-name" data-field="primary-name">${title}</span>
      <span class="identity-contact" data-field="secondary-name">${typeLabel}${amendmentLabel}</span>
    </td>
    <td class="name-cell" data-label="Project">${projectName}</td>
    <td class="identity-cell" data-label="Client">
      <span class="identity-name" data-field="primary-name">${clientName}</span>
      <span class="identity-email">${clientEmail}</span>
    </td>
    <td class="status-cell" data-label="Status">${getStatusBadge(contract.status)}</td>
    <td class="date-cell" data-label="Sent">${formatDateSafe(contract.sentAt)}</td>
    <td class="date-cell" data-label="Signed">${formatDateSafe(contract.signedAt)}</td>
    <td class="date-cell inline-editable-cell" data-contract-id="${contract.id}" data-field="expires_at" data-label="Expires">
      <span class="expires-at-value">${formatDateSafe(contract.expiresAt)}</span>
    </td>
    <td class="actions-cell" data-label="Actions">
      ${renderActionsCell([
    createAction('view', contract.id, { title: 'View details', ariaLabel: 'View contract' }),
    createAction('remind', contract.id, { title: 'Resend reminder', ariaLabel: 'Resend reminder' }),
    createAction('expire', contract.id, { title: 'Expire contract', ariaLabel: 'Expire contract' })
  ])}
    </td>
  `;

  return row;
}

/**
 * Setup inline editing for expires_at cells
 */
function setupInlineExpiresEditing(tableBody: HTMLElement, contracts: ContractListItem[]): void {
  tableBody.querySelectorAll('.date-cell.inline-editable-cell').forEach((cell) => {
    const cellEl = cell as HTMLElement;
    const contractId = parseInt(cellEl.dataset.contractId || '0');
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    makeEditable(
      cellEl,
      () => contract.expiresAt ? contract.expiresAt.split('T')[0] : '',
      async (newValue) => {
        const response = await apiPut(`/api/contracts/${contractId}`, { expires_at: newValue || null });
        if (response.ok) {
          contract.expiresAt = newValue || null;
          const expiresAtValue = cellEl.querySelector('.expires-at-value');
          if (expiresAtValue) expiresAtValue.textContent = formatDateSafe(newValue);
          showToast('Expiration date updated', 'success');
        } else {
          showToast('Failed to update expiration date', 'error');
          throw new Error('Update failed');
        }
      },
      { type: 'date', placeholder: 'Select date' }
    );
  });
}

// ============================================
// FILTER HELPERS
// ============================================

function updateFilterBadge(): void {
  if (!filterContainerEl) return;
  const badge = filterContainerEl.querySelector('.filter-count-badge');
  if (!badge) return;
  const filterState = contractsModule.getFilterState();
  const count =
    filterState.statusFilters.length +
    (filterState.dateStart ? 1 : 0) +
    (filterState.dateEnd ? 1 : 0);
  badge.textContent = String(count);
  badge.classList.toggle('visible', count > 0);
}

function applyStatusFilter(value: string): void {
  const nextFilters = STATUS_FILTER_MAP[value] ?? [];
  const filterState = contractsModule.getFilterState();
  const newState = { ...filterState, statusFilters: nextFilters };
  saveFilterState(CONTRACTS_FILTER_CONFIG.storageKey, newState);

  if (filterContainerEl) {
    updateFilterStatusOptions(
      filterContainerEl,
      CONTRACTS_FILTER_CONFIG.statusOptions,
      'Status',
      newState,
      CONTRACTS_FILTER_CONFIG,
      (updatedState: FilterState) => {
        saveFilterState(CONTRACTS_FILTER_CONFIG.storageKey, updatedState);
        contractsModule.rerender();
      }
    );
    updateFilterBadge();
  }
  contractsModule.rerender();
}


async function fetchContractActivity(contractId: number): Promise<ContractActivityItem[]> {
  const response = await apiFetch(`/api/contracts/${contractId}/activity`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to load contract activity');
  }

  // Ensure we always return an array, even if API returns undefined
  return Array.isArray(data.activity) ? data.activity : [];
}

async function openContractDetail(contract: ContractListItem): Promise<void> {
  const modal = createPortalModal({
    id: 'contract-detail-modal',
    titleId: 'contract-detail-title',
    title: 'Contract Details',
    icon: ICONS.FILE_SIGNATURE,
    contentClassName: 'contract-detail-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  const body = document.createElement('div');
  body.className = 'contract-detail-body';
  body.innerHTML = `
    <div class="contract-detail-grid">
      <div class="portal-card">
        <h4 class="portal-card-header">Overview</h4>
        <div class="detail-row"><span class="field-label">Status</span>${getStatusBadge(contract.status)}</div>
        <div class="detail-row"><span class="field-label">Project</span><span>${SanitizationUtils.escapeHtml(contract.projectName || 'Project')}</span></div>
        <div class="detail-row"><span class="field-label">Client</span><span>${SanitizationUtils.escapeHtml(contract.clientName || 'Client')}</span></div>
        <div class="detail-row"><span class="field-label">Template</span><span>${SanitizationUtils.escapeHtml(contract.templateName || 'Custom')}</span></div>
        <div class="detail-row"><span class="field-label">Sent</span><span>${formatDateTimeSafe(contract.sentAt)}</span></div>
        <div class="detail-row"><span class="field-label">Signed</span><span>${formatDateTimeSafe(contract.signedAt)}</span></div>
        <div class="detail-row"><span class="field-label">Expires</span><span>${formatDateTimeSafe(contract.expiresAt)}</span></div>
        <div class="detail-row"><span class="field-label">Renewal</span><span>${formatDateSafe(contract.renewalAt)}</span></div>
      </div>
      <div class="portal-card">
        <h4 class="portal-card-header">Activity</h4>
        <div class="contract-activity" id="contract-activity-list">
          <div class="empty-row">Loading activity...</div>
        </div>
      </div>
    </div>
  `;

  modal.body.appendChild(body);

  const viewBtn = document.createElement('a');
  viewBtn.className = 'btn btn-outline';
  viewBtn.textContent = 'Open PDF';
  viewBtn.href = `/api/projects/${contract.projectId}/contract/pdf`;
  viewBtn.target = '_blank';

  const remindBtn = document.createElement('button');
  remindBtn.className = 'btn btn-secondary';
  remindBtn.textContent = 'Resend Reminder';
  remindBtn.addEventListener('click', () => handleReminder(contract.id));

  const expireBtn = document.createElement('button');
  expireBtn.className = 'btn btn-outline';
  expireBtn.textContent = 'Expire';
  expireBtn.addEventListener('click', () => handleExpire(contract.id));

  const amendBtn = document.createElement('button');
  amendBtn.className = 'btn btn-primary';
  amendBtn.textContent = 'Create Amendment';
  amendBtn.addEventListener('click', () => handleAmendment(contract.id));

  const renewalBtn = document.createElement('button');
  renewalBtn.className = 'btn btn-outline';
  renewalBtn.textContent = 'Send Renewal Reminder';
  renewalBtn.addEventListener('click', () => handleRenewalReminder(contract.id));

  modal.footer.appendChild(viewBtn);
  modal.footer.appendChild(remindBtn);
  modal.footer.appendChild(expireBtn);
  modal.footer.appendChild(amendBtn);
  modal.footer.appendChild(renewalBtn);

  document.body.appendChild(modal.overlay);
  modal.show();

  try {
    const activity = await fetchContractActivity(contract.id);
    const activityList = modal.body.querySelector('#contract-activity-list');
    if (activityList) {
      if (activity.length === 0) {
        activityList.innerHTML = '<div class="empty-row">No activity yet.</div>';
      } else {
        activityList.innerHTML = activity
          .map((item) => {
            const details = item.details ? ` · ${SanitizationUtils.escapeHtml(item.details)}` : '';
            return `
              <div class="contract-activity-item">
                <div class="activity-title">${SanitizationUtils.escapeHtml(item.action)}${details}</div>
                <div class="activity-meta">${formatDateTimeSafe(item.created_at)}${item.actor_email ? ` · ${SanitizationUtils.escapeHtml(item.actor_email)}` : ''}</div>
              </div>
            `;
          })
          .join('');
      }
    }
  } catch (error) {
    logger.error(' Activity load failed', error);
  }
}

async function handleReminder(contractId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/contracts/${contractId}/resend-reminder`, {});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alertError(data.message || 'Failed to send reminder.');
      return;
    }
    showToast('Reminder sent.', 'success');
    const ctx = contractsModule.getContext();
    if (ctx) await contractsModule.load(ctx);
  } catch (error) {
    logger.error(' Reminder failed:', error);
    alertError('Failed to send reminder.');
  }
}

async function handleExpire(contractId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Expire Contract',
    message: 'Expire this contract? The client will no longer be able to sign using the existing link.',
    confirmText: 'Expire',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/contracts/${contractId}/expire`, {});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alertError(data.message || 'Failed to expire contract.');
      return;
    }
    showToast('Contract expired.', 'success');
    const ctx = contractsModule.getContext();
    if (ctx) await contractsModule.load(ctx);
  } catch (error) {
    logger.error(' Expire failed:', error);
    alertError('Failed to expire contract.');
  }
}

async function handleAmendment(contractId: number): Promise<void> {
  const confirmed = await confirmDialog({
    title: 'Create Amendment',
    message: 'Create an amendment draft linked to this contract?',
    confirmText: 'Create Amendment',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  try {
    const response = await apiPost(`/api/contracts/${contractId}/amendment`, {});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alertError(data.message || 'Failed to create amendment.');
      return;
    }
    showToast('Amendment created.', 'success');
    const ctx = contractsModule.getContext();
    if (ctx) await contractsModule.load(ctx);
  } catch (error) {
    logger.error(' Amendment failed:', error);
    alertError('Failed to create amendment.');
  }
}

async function handleRenewalReminder(contractId: number): Promise<void> {
  try {
    const response = await apiPost(`/api/contracts/${contractId}/renewal-reminder`, {});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alertError(data.message || 'Failed to send renewal reminder.');
      return;
    }
    showToast('Renewal reminder sent.', 'success');
    const ctx = contractsModule.getContext();
    if (ctx) await contractsModule.load(ctx);
  } catch (error) {
    logger.error(' Renewal reminder failed:', error);
    alertError('Failed to send renewal reminder.');
  }
}

function attachContractsListeners(context: AdminDashboardContext): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  // Cache filter container reference
  filterContainerEl = document.getElementById('contracts-filter-container');

  // Stat card filter clicks
  document.querySelectorAll('[data-contract-filter]').forEach((card) => {
    card.addEventListener('click', () => {
      const filterValue = (card as HTMLElement).dataset.contractFilter || 'all';
      applyStatusFilter(filterValue);
    });
  });

  // Refresh button
  const refreshBtn = document.getElementById('refresh-contracts-btn');
  refreshBtn?.addEventListener('click', () => {
    contractsModule.load(context);
  });

  // Table action buttons (view, remind, expire)
  const table = document.getElementById('contracts-table-body');
  table?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);
    const contract = contractsModule.findById(id);
    if (!contract) return;

    switch (action) {
    case 'view':
      openContractDetail(contract);
      break;
    case 'remind':
      handleReminder(contract.id);
      break;
    case 'expire':
      handleExpire(contract.id);
      break;
    }
  });
}

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
};

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the Contracts tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderContractsTab(container: HTMLElement): void {
  container.innerHTML = `
    <div class="quick-stats">
      <button class="stat-card stat-card-clickable" data-contract-filter="all">
        <span class="stat-number" id="contracts-total">-</span>
        <span class="stat-label">Total Contracts</span>
      </button>
      <button class="stat-card stat-card-clickable" data-contract-filter="draft">
        <span class="stat-number" id="contracts-draft">-</span>
        <span class="stat-label">Draft</span>
      </button>
      <button class="stat-card stat-card-clickable" data-contract-filter="sent">
        <span class="stat-number" id="contracts-sent">-</span>
        <span class="stat-label">Sent</span>
      </button>
      <button class="stat-card stat-card-clickable" data-contract-filter="viewed">
        <span class="stat-number" id="contracts-viewed">-</span>
        <span class="stat-label">Viewed</span>
      </button>
      <button class="stat-card stat-card-clickable" data-contract-filter="signed">
        <span class="stat-number" id="contracts-signed">-</span>
        <span class="stat-label">Signed</span>
      </button>
    </div>

    <div class="data-table-card" id="contracts-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">All Contracts</span><span class="title-mobile">Contracts</span></h3>
        <div class="data-table-actions" id="contracts-filter-container">
          <button class="icon-btn" id="refresh-contracts-btn" title="Refresh" aria-label="Refresh contracts">
            ${RENDER_ICONS.REFRESH}
          </button>
        </div>
      </div>
      <!-- Bulk Action Toolbar (hidden initially) -->
      <div id="contracts-bulk-toolbar" class="bulk-action-toolbar hidden"></div>
      <div class="data-table-container">
        <div class="data-table-scroll-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col" class="bulk-select-cell">
                  <div class="portal-checkbox">
                    <input type="checkbox" id="contracts-select-all" class="bulk-select-all" aria-label="Select all contracts" />
                  </div>
                </th>
                <th scope="col" class="identity-col">Contract</th>
                <th scope="col" class="name-col">Project</th>
                <th scope="col" class="identity-col">Client</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="date-col">Sent</th>
                <th scope="col" class="date-col">Signed</th>
                <th scope="col" class="date-col">Expires</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="contracts-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr class="loading-row">
                <td colspan="9">
                  <div class="loading-state">
                    <span class="loading-spinner" aria-hidden="true"></span>
                    <span class="loading-message">Loading contracts...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div id="contracts-pagination" class="table-pagination"></div>
    </div>
  `;

  // Reset module cache when tab is re-rendered (DOM elements changed)
  contractsModule.resetCache();
  listenersInitialized = false;
  filterContainerEl = null;
}
