/**
 * ===============================================
 * ADMIN CONTRACTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-contracts.ts
 *
 * Admin dashboard contracts list + detail modal.
 */

import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
import { formatDate, formatDateTime } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { confirmDialog, alertError } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { createPortalModal } from '../../../components/portal-modal';
import {
  applyFilters,
  createFilterUI,
  loadFilterState,
  saveFilterState,
  updateFilterStatusOptions,
  CONTRACTS_FILTER_CONFIG,
  type FilterState
} from '../../../utils/table-filter';
import type { AdminDashboardContext } from '../admin-types';
import {
  createPaginationUI,
  applyPagination,
  getDefaultPaginationState,
  loadPaginationState,
  savePaginationState,
  type PaginationState,
  type PaginationConfig
} from '../../../utils/table-pagination';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { makeEditable } from '../../../components/inline-edit';

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

let contractsCache: ContractListItem[] = [];
let listenersInitialized = false;
let activeContext: AdminDashboardContext | null = null;
let filterUIInitialized = false;
let filterContainerEl: HTMLElement | null = null;

let filterState: FilterState = loadFilterState(CONTRACTS_FILTER_CONFIG.storageKey);

const CONTRACTS_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'contracts',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 10,
  storageKey: 'admin_contracts_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(CONTRACTS_PAGINATION_CONFIG),
  ...loadPaginationState(CONTRACTS_PAGINATION_CONFIG.storageKey!)
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  expired: 'Expired',
  cancelled: 'Cancelled'
};

const STATUS_CLASSES: Record<string, string> = {
  draft: 'status-pending',
  sent: 'status-pending',
  viewed: 'status-pending',
  signed: 'status-completed',
  expired: 'status-cancelled',
  cancelled: 'status-cancelled'
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

function getStatusBadge(status: string): string {
  const label = STATUS_LABELS[status] || status;
  const className = STATUS_CLASSES[status] || 'status-pending';
  return `<span class="status-badge ${className}">${label}</span>`;
}

function formatDateSafe(value?: string | null): string {
  if (!value) return '-';
  return formatDate(value);
}

function formatDateTimeSafe(value?: string | null): string {
  if (!value) return '-';
  return formatDateTime(value);
}

function renderContractsTable(ctx: AdminDashboardContext): void {
  const body = document.getElementById('contracts-table-body');
  if (!body) return;

  const filteredContracts = applyFilters(contractsCache, filterState, CONTRACTS_FILTER_CONFIG);

  if (filteredContracts.length === 0) {
    const message = contractsCache.length === 0
      ? 'No contracts found.'
      : 'No contracts match the current filters.';
    body.innerHTML = `<tr><td colspan="8" class="empty-row">${message}</td></tr>`;
    renderPaginationUI(0, ctx);
    return;
  }

  paginationState.totalItems = filteredContracts.length;
  const paginatedContracts = applyPagination(filteredContracts, paginationState);

  body.innerHTML = paginatedContracts
    .map((contract) => {
      const title = SanitizationUtils.escapeHtml(contract.templateName || `Contract #${contract.id}`);
      const projectName = SanitizationUtils.escapeHtml(contract.projectName || 'Project');
      const clientName = SanitizationUtils.escapeHtml(contract.clientName || 'Client');
      const clientEmail = SanitizationUtils.escapeHtml(contract.clientEmail || '');
      const typeLabel = contract.templateType ? ` · ${contract.templateType}` : '';
      const amendmentLabel = contract.parentContractId ? ' · Amendment' : '';

      return `
        <tr data-contract-id="${contract.id}">
          <td>
            <div class="table-primary">${title}</div>
            <div class="table-subtext">${typeLabel}${amendmentLabel}</div>
          </td>
          <td>${projectName}</td>
          <td>
            <div class="table-primary">${clientName}</div>
            <div class="table-subtext">${clientEmail}</div>
          </td>
          <td>${getStatusBadge(contract.status)}</td>
          <td>${formatDateSafe(contract.sentAt)}</td>
          <td>${formatDateSafe(contract.signedAt)}</td>
          <td class="date-col inline-editable-cell" data-contract-id="${contract.id}" data-field="expires_at">
            <span class="expires-at-value">${formatDateSafe(contract.expiresAt)}</span>
          </td>
          <td class="actions-col">
            <button class="icon-btn" data-action="view" data-id="${contract.id}" title="View details" aria-label="View contract">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="icon-btn" data-action="remind" data-id="${contract.id}" title="Resend reminder" aria-label="Resend reminder">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
            <button class="icon-btn" data-action="expire" data-id="${contract.id}" title="Expire contract" aria-label="Expire contract">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  // Setup inline editing for expires_at cells
  body.querySelectorAll('.date-col.inline-editable-cell').forEach((cell) => {
    const cellEl = cell as HTMLElement;
    const contractId = parseInt(cellEl.dataset.contractId || '0');
    const contract = paginatedContracts.find(c => c.id === contractId);
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

  renderPaginationUI(filteredContracts.length, ctx);

  // Initialize keyboard navigation (J/K to move, Enter to view)
  initTableKeyboardNav({
    tableSelector: '.contracts-table',
    rowSelector: 'tbody tr[data-contract-id]',
    onRowSelect: (row) => {
      const contractId = parseInt(row.dataset.contractId || '0');
      const contract = contractsCache.find((c) => c.id === contractId);
      if (contract) openContractDetail(contract);
    },
    focusClass: 'row-focused',
    selectedClass: 'row-selected'
  });
}

function updateContractStats(contracts: ContractListItem[]): void {
  const totals = {
    total: contracts.length,
    draft: contracts.filter((c) => c.status === 'draft').length,
    sent: contracts.filter((c) => c.status === 'sent').length,
    viewed: contracts.filter((c) => c.status === 'viewed').length,
    signed: contracts.filter((c) => c.status === 'signed').length
  };

  const totalEl = document.getElementById('contracts-total');
  const draftEl = document.getElementById('contracts-draft');
  const sentEl = document.getElementById('contracts-sent');
  const viewedEl = document.getElementById('contracts-viewed');
  const signedEl = document.getElementById('contracts-signed');

  if (totalEl) totalEl.textContent = totals.total.toString();
  if (draftEl) draftEl.textContent = totals.draft.toString();
  if (sentEl) sentEl.textContent = totals.sent.toString();
  if (viewedEl) viewedEl.textContent = totals.viewed.toString();
  if (signedEl) signedEl.textContent = totals.signed.toString();
}

function updateFilterBadge(): void {
  if (!filterContainerEl) return;
  const badge = filterContainerEl.querySelector('.filter-count-badge');
  if (!badge) return;
  const count =
    filterState.statusFilters.length +
    (filterState.dateStart ? 1 : 0) +
    (filterState.dateEnd ? 1 : 0);
  badge.textContent = String(count);
  badge.classList.toggle('visible', count > 0);
}

function applyStatusFilter(value: string): void {
  const nextFilters = STATUS_FILTER_MAP[value] ?? [];
  filterState = { ...filterState, statusFilters: nextFilters };
  saveFilterState(CONTRACTS_FILTER_CONFIG.storageKey, filterState);
  if (filterContainerEl) {
    updateFilterStatusOptions(
      filterContainerEl,
      CONTRACTS_FILTER_CONFIG.statusOptions,
      'Status',
      filterState,
      CONTRACTS_FILTER_CONFIG,
      (newState) => {
        filterState = newState;
        saveFilterState(CONTRACTS_FILTER_CONFIG.storageKey, filterState);
        paginationState.currentPage = 1;
        if (activeContext) renderContractsTable(activeContext);
      }
    );
    updateFilterBadge();
  }
}

function renderPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('contracts-pagination');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  paginationState.totalItems = totalItems;
  const paginationUI = createPaginationUI(CONTRACTS_PAGINATION_CONFIG, paginationState, (newState) => {
    paginationState = newState;
    savePaginationState(CONTRACTS_PAGINATION_CONFIG.storageKey!, newState);
    renderContractsTable(ctx);
  });

  container.innerHTML = '';
  container.appendChild(paginationUI);
}

function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = document.getElementById('contracts-filter-container');
  if (!container) return;
  filterContainerEl = container;

  const filterUI = createFilterUI(CONTRACTS_FILTER_CONFIG, filterState, (newState) => {
    filterState = newState;
    paginationState.currentPage = 1;
    saveFilterState(CONTRACTS_FILTER_CONFIG.storageKey, filterState);
    renderContractsTable(ctx);
  });

  const firstBtn = container.querySelector('button');
  if (firstBtn) {
    container.insertBefore(filterUI, firstBtn);
  } else {
    container.appendChild(filterUI);
  }
}

async function fetchContracts(): Promise<ContractListItem[]> {
  const response = await apiFetch('/api/contracts');
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to load contracts');
  }

  // Ensure we always return an array, even if API returns undefined
  return Array.isArray(data.contracts) ? data.contracts : [];
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
    console.error('[AdminContracts] Activity load failed', error);
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
    if (activeContext) await loadContracts(activeContext);
  } catch (error) {
    console.error('[AdminContracts] Reminder failed:', error);
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
    if (activeContext) await loadContracts(activeContext);
  } catch (error) {
    console.error('[AdminContracts] Expire failed:', error);
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
    if (activeContext) await loadContracts(activeContext);
  } catch (error) {
    console.error('[AdminContracts] Amendment failed:', error);
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
    if (activeContext) await loadContracts(activeContext);
  } catch (error) {
    console.error('[AdminContracts] Renewal reminder failed:', error);
    alertError('Failed to send renewal reminder.');
  }
}

function attachContractsListeners(context: AdminDashboardContext): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  if (!filterUIInitialized) {
    initializeFilterUI(context);
    filterUIInitialized = true;
  }

  document.querySelectorAll('[data-contract-filter]').forEach((card) => {
    card.addEventListener('click', () => {
      const filterValue = (card as HTMLElement).dataset.contractFilter || 'all';
      applyStatusFilter(filterValue);
      paginationState.currentPage = 1;
      renderContractsTable(context);
    });
  });

  const refreshBtn = document.getElementById('refresh-contracts-btn');
  refreshBtn?.addEventListener('click', () => {
    loadContracts(context);
  });

  const table = document.getElementById('contracts-table-body');
  table?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);
    const contract = contractsCache.find((item) => item.id === id);
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
      <button class="stat-card stat-card-clickable portal-shadow" data-contract-filter="all">
        <span class="stat-number" id="contracts-total">-</span>
        <span class="stat-label">Total Contracts</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-contract-filter="draft">
        <span class="stat-number" id="contracts-draft">-</span>
        <span class="stat-label">Draft</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-contract-filter="sent">
        <span class="stat-number" id="contracts-sent">-</span>
        <span class="stat-label">Sent</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-contract-filter="viewed">
        <span class="stat-number" id="contracts-viewed">-</span>
        <span class="stat-label">Viewed</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-contract-filter="signed">
        <span class="stat-number" id="contracts-signed">-</span>
        <span class="stat-label">Signed</span>
      </button>
    </div>

    <div class="admin-table-card" id="contracts-table-card">
      <div class="admin-table-header">
        <h3>Contracts</h3>
        <div class="admin-table-actions" id="contracts-filter-container">
          <button class="icon-btn" id="refresh-contracts-btn" title="Refresh" aria-label="Refresh contracts">
            <span class="icon-btn-svg">${RENDER_ICONS.REFRESH}</span>
          </button>
        </div>
      </div>
      <div class="admin-table-container contracts-table-container">
        <div class="admin-table-scroll-wrapper">
          <table class="admin-table contracts-table">
            <thead>
              <tr>
                <th scope="col">Contract</th>
                <th scope="col">Project</th>
                <th scope="col" class="contact-col">Client</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="date-col">Sent</th>
                <th scope="col" class="date-col">Signed</th>
                <th scope="col" class="date-col">Expires</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="contracts-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr>
                <td colspan="8" class="loading-row">Loading contracts...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div id="contracts-pagination" class="table-pagination"></div>
    </div>
  `;

  // Reset filter UI initialization flag so it gets re-initialized
  filterUIInitialized = false;
  listenersInitialized = false;
}

export async function loadContracts(context: AdminDashboardContext): Promise<void> {
  try {
    activeContext = context;
    attachContractsListeners(context);
    const contracts = await fetchContracts();
    contractsCache = contracts;
    updateContractStats(contractsCache);
    renderContractsTable(context);
  } catch (error) {
    console.error('[AdminContracts] Failed to load contracts:', error);
    alertError('Failed to load contracts. Please try again.');
  }
}
