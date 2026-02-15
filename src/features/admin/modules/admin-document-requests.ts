/**
 * ===============================================
 * ADMIN DOCUMENT REQUESTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-document-requests.ts
 *
 * Admin UI for document requests: list (pending / for-review / overdue),
 * create single request, create from templates, view detail, review actions.
 * Uses /api/document-requests admin endpoints.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiDelete, parseApiResponse } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { confirmDanger } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { openModalOverlay, closeModalOverlay } from '../../../utils/modal-utils';
import { initModalDropdown } from '../../../utils/modal-dropdown';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { exportToCsv, DOCUMENT_REQUESTS_EXPORT_CONFIG } from '../../../utils/table-export';
import { getPortalCheckboxHTML } from '../../../components/portal-checkbox';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  DOCUMENT_REQUESTS_FILTER_CONFIG,
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
import {
  createRowCheckbox,
  createBulkActionToolbar,
  setupBulkSelectionHandlers,
  resetSelection,
  type BulkActionConfig
} from '../../../utils/table-bulk-actions';
import { ICONS } from '../../../constants/icons';

const DR_API = '/api/document-requests';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RequestStatus =
  | 'requested'
  | 'viewed'
  | 'uploaded'
  | 'under_review'
  | 'approved'
  | 'rejected';

interface DocumentRequest {
  id: number;
  client_id: number;
  project_id?: number;
  requested_by: string;
  title: string;
  description?: string;
  document_type?: string;
  priority?: string;
  status: RequestStatus;
  due_date?: string;
  file_id?: number;
  uploaded_by?: string;
  uploaded_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  is_required: boolean;
  reminder_sent_at?: string;
  reminder_count: number;
  created_at: string;
  updated_at: string;
  client_name?: string;
  project_name?: string;
  file_name?: string;
}

interface DocumentRequestHistory {
  id: number;
  request_id: number;
  action: string;
  old_status?: string;
  new_status?: string;
  actor_email: string;
  actor_type: string;
  notes?: string;
  created_at: string;
}

interface DocumentRequestTemplate {
  id: number;
  name: string;
  title: string;
  description?: string;
  document_type?: string;
  is_required: boolean;
  days_until_due: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface ClientOption {
  id: number;
  company_name?: string;
  contact_name?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeHtml(text: string): string {
  return SanitizationUtils.escapeHtml(text);
}

function statusLabel(status: RequestStatus): string {
  const map: Record<RequestStatus, string> = {
    requested: 'Requested',
    viewed: 'Viewed',
    uploaded: 'Uploaded',
    under_review: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let requestsCache: DocumentRequest[] = [];
let drListenersSetup = false;
let filterUIContainer: HTMLElement | null = null;
let filterState: FilterState = loadFilterState(DOCUMENT_REQUESTS_FILTER_CONFIG.storageKey);

// Pagination configuration and state
const DR_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'document-requests',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_document_requests_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(DR_PAGINATION_CONFIG),
  ...loadPaginationState(DR_PAGINATION_CONFIG.storageKey!)
};

let drCreateClientDropdownInit = false;
let drTemplatesClientDropdownInit = false;
let drCreateModalFocusCleanup: (() => void) | null = null;
let drDetailModalFocusCleanup: (() => void) | null = null;
let storedDrContext: AdminDashboardContext | null = null;
let drActiveTab: 'single' | 'templates' = 'single';

// Bulk action configuration for document requests
const DR_BULK_CONFIG: BulkActionConfig = {
  tableId: 'document-requests',
  actions: [
    {
      id: 'send-reminder',
      label: 'Send Reminders',
      icon: ICONS.BELL,
      variant: 'default',
      confirmMessage: 'Send reminders for {count} selected document requests?',
      handler: async (ids: number[]) => {
        if (!storedDrContext) return;
        try {
          const results = await Promise.all(
            ids.map(id =>
              apiPost(`${DR_API}/${id}/remind`, {})
                .then(res => ({ id, success: res.ok }))
                .catch(() => ({ id, success: false }))
            )
          );
          const successCount = results.filter(r => r.success).length;
          if (successCount > 0) {
            showToast(`Sent ${successCount} reminder${successCount > 1 ? 's' : ''}`, 'success');
            resetSelection('document-requests');
          }
        } catch (error) {
          console.error('[DocRequests] Bulk remind error:', error);
          showToast('Failed to send reminders', 'error');
        }
      }
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: ICONS.TRASH,
      variant: 'danger',
      confirmMessage: 'Delete {count} selected document requests? This cannot be undone.',
      handler: async (ids: number[]) => {
        if (!storedDrContext) return;
        try {
          const results = await Promise.all(
            ids.map(id =>
              apiDelete(`${DR_API}/${id}`)
                .then(res => ({ id, success: res.ok }))
                .catch(() => ({ id, success: false }))
            )
          );
          const successCount = results.filter(r => r.success).length;
          if (successCount > 0) {
            showToast(`Deleted ${successCount} request${successCount > 1 ? 's' : ''}`, 'success');
            resetSelection('document-requests');
            await refreshTable(storedDrContext);
          }
        } catch (error) {
          console.error('[DocRequests] Bulk delete error:', error);
          showToast('Failed to delete requests', 'error');
        }
      }
    }
  ]
};


// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

async function loadAllRequests(): Promise<DocumentRequest[]> {
  // Load from all endpoints and merge to get complete list
  const [pendingRes, forReviewRes, overdueRes] = await Promise.all([
    apiFetch(`${DR_API}/pending`),
    apiFetch(`${DR_API}/for-review`),
    apiFetch(`${DR_API}/overdue`)
  ]);

  // Log any errors
  if (!pendingRes.ok) {
    console.error('[DocRequests] Failed to load pending:', pendingRes.status);
  }
  if (!forReviewRes.ok) {
    console.error('[DocRequests] Failed to load for-review:', forReviewRes.status);
  }
  if (!overdueRes.ok) {
    console.error('[DocRequests] Failed to load overdue:', overdueRes.status);
  }

  const pending = pendingRes.ok ? await parseApiResponse<{ requests: DocumentRequest[] }>(pendingRes).then((d) => d.requests || []) : [];
  const forReview = forReviewRes.ok ? await parseApiResponse<{ requests: DocumentRequest[] }>(forReviewRes).then((d) => d.requests || []) : [];
  const overdue = overdueRes.ok ? await parseApiResponse<{ requests: DocumentRequest[] }>(overdueRes).then((d) => d.requests || []) : [];

  const byId = new Map<number, DocumentRequest>();
  [...pending, ...forReview, ...overdue].forEach((r) => byId.set(r.id, r));
  return Array.from(byId.values()).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
}

async function loadClients(): Promise<ClientOption[]> {
  const res = await apiFetch('/api/clients');
  if (!res.ok) return [];
  const data = await parseApiResponse<{ clients: ClientOption[] }>(res);
  return data.clients || [];
}

async function loadTemplates(): Promise<DocumentRequestTemplate[]> {
  const res = await apiFetch(`${DR_API}/templates/list`);
  if (!res.ok) return [];
  const data = await parseApiResponse<{ templates: DocumentRequestTemplate[] }>(res);
  return data.templates || [];
}

async function loadRequestDetail(id: number): Promise<{ request: DocumentRequest; history: DocumentRequestHistory[] } | null> {
  const res = await apiFetch(`${DR_API}/${id}`);
  if (!res.ok) return null;
  return parseApiResponse(res);
}

// ---------------------------------------------------------------------------
// Render table
// ---------------------------------------------------------------------------

const DR_TABLE_COLSPAN = 7;

function renderRequestsTable(requests: DocumentRequest[], _ctx: AdminDashboardContext): void {
  const tbody = el('document-requests-table-body');
  if (!tbody) return;

  if (requests.length === 0) {
    const message = requestsCache.length === 0
      ? 'No document requests yet.'
      : 'No document requests match the current filters.';
    showTableEmpty(tbody, DR_TABLE_COLSPAN, message);
    return;
  }

  // Reset bulk selection when data changes
  resetSelection('document-requests');

  // Standard column order: ☐ | Title | Client | Type | Status | Due | Actions
  tbody.innerHTML = requests
    .map(
      (r) => `
    <tr data-request-id="${r.id}">
      ${createRowCheckbox('document-requests', r.id)}
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(SanitizationUtils.decodeHtmlEntities(r.client_name ?? String(r.client_id)))}</td>
      <td>${SanitizationUtils.capitalizeName(r.document_type || '')}</td>
      <td>${statusLabel(r.status)}</td>
      <td>${formatDate(r.due_date)}</td>
      <td class="actions-cell">
        <button type="button" class="icon-btn dr-view" data-id="${r.id}" title="View" aria-label="View">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        ${r.status === 'uploaded' ? `<button type="button" class="icon-btn dr-start-review" data-id="${r.id}" title="Start review" aria-label="Start review"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></button>` : ''}
        ${r.status === 'under_review' ? `<button type="button" class="icon-btn icon-btn-success dr-approve" data-id="${r.id}" title="Approve" aria-label="Approve"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></button><button type="button" class="icon-btn icon-btn-danger dr-reject" data-id="${r.id}" title="Reject" aria-label="Reject"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>` : ''}
        ${r.status !== 'approved' && r.status !== 'rejected' ? `<button type="button" class="icon-btn dr-remind" data-id="${r.id}" title="Send reminder" aria-label="Send reminder"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></button>` : ''}
        <button type="button" class="icon-btn icon-btn-danger dr-delete" data-id="${r.id}" data-title="${escapeHtml(r.title)}" title="Delete" aria-label="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>
  `
    )
    .join('');

  // Setup bulk selection handlers
  const allRowIds = requests.map(r => r.id);
  setupBulkSelectionHandlers(DR_BULK_CONFIG, allRowIds);
}

/**
 * Render pagination UI for document requests table
 */
function renderDRPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = el('document-requests-pagination');
  if (!container) return;

  // Update state
  paginationState.totalItems = totalItems;

  // Create pagination UI
  const paginationUI = createPaginationUI(
    DR_PAGINATION_CONFIG,
    paginationState,
    (newState) => {
      paginationState = newState;
      savePaginationState(DR_PAGINATION_CONFIG.storageKey!, paginationState);
      // Re-render table with new pagination
      if (requestsCache.length > 0) {
        refreshFilteredTable(ctx);
      }
    }
  );

  // Replace container content
  container.innerHTML = '';
  container.appendChild(paginationUI);
}

// ---------------------------------------------------------------------------
// Create modal (combined single request + from templates tabs)
// ---------------------------------------------------------------------------

function openCreateModal(_ctx: AdminDashboardContext): void {
  const modal = el('dr-create-modal');
  if (!modal) return;

  // Show modal
  openModalOverlay(modal);
  drCreateModalFocusCleanup = manageFocusTrap(modal, {});

  // Reset to single tab
  drActiveTab = 'single';
  updateTabUI();

  // Load clients first, then initialize dropdowns
  loadClients().then((clients) => {
    // Populate native selects first
    populateNativeSelect('dr-create-client', clients);
    populateNativeSelect('dr-templates-client', clients);

    // Then initialize modal dropdowns (converts to custom dropdown)
    initClientDropdowns();
  });

  // Load templates for templates tab
  const listEl = el('dr-templates-list');
  if (listEl) {
    listEl.innerHTML = '<p class="loading-message">Loading templates...</p>';
    loadTemplates().then((templates) => {
      if (templates.length === 0) {
        listEl.innerHTML = '<p class="empty-message">No templates available. Use Single Request tab.</p>';
        return;
      }
      listEl.innerHTML = templates
        .map(
          (t) => `
        <label class="dr-template-option">
          ${getPortalCheckboxHTML({
    name: 'dr-template-id',
    value: String(t.id),
    ariaLabel: t.title
  })}
          <span class="dr-template-label">${escapeHtml(t.title)}${t.name ? ` (${escapeHtml(t.name)})` : ''}</span>
        </label>
      `
        )
        .join('');
    });
  }
}

function closeCreateModal(): void {
  const modal = el('dr-create-modal');
  if (modal) {
    closeModalOverlay(modal);
    drCreateModalFocusCleanup?.();
    drCreateModalFocusCleanup = null;
  }
}

/**
 * Populate native select with client options (call before initModalDropdown)
 */
function populateNativeSelect(selectId: string, clients: ClientOption[]): void {
  const select = document.getElementById(selectId) as HTMLSelectElement;
  if (!select) return;

  // Clear and repopulate
  select.innerHTML = '<option value="">Select client</option>';
  clients.forEach((c) => {
    const option = document.createElement('option');
    option.value = String(c.id);
    option.textContent = c.company_name || c.contact_name || c.email || String(c.id);
    select.appendChild(option);
  });
}

/**
 * Initialize modal dropdowns (converts native selects to custom dropdowns)
 */
function initClientDropdowns(): void {
  // Initialize single request client dropdown
  if (!drCreateClientDropdownInit) {
    const createClientSelect = document.getElementById('dr-create-client') as HTMLSelectElement;
    if (createClientSelect && !createClientSelect.dataset.dropdownInit) {
      initModalDropdown(createClientSelect);
      drCreateClientDropdownInit = true;
    }
  }

  // Initialize templates client dropdown
  if (!drTemplatesClientDropdownInit) {
    const templatesClientSelect = document.getElementById('dr-templates-client') as HTMLSelectElement;
    if (templatesClientSelect && !templatesClientSelect.dataset.dropdownInit) {
      initModalDropdown(templatesClientSelect);
      drTemplatesClientDropdownInit = true;
    }
  }
}

function updateTabUI(): void {
  const modal = el('dr-create-modal');
  if (!modal) return;

  // Update tab buttons
  modal.querySelectorAll('.admin-modal-tab').forEach((tab) => {
    const tabName = tab.getAttribute('data-dr-tab');
    tab.classList.toggle('active', tabName === drActiveTab);
  });

  // Update tab content visibility
  const singleForm = document.getElementById('dr-create-form');
  const templatesForm = document.getElementById('dr-from-templates-form');

  if (singleForm) {
    singleForm.style.display = drActiveTab === 'single' ? '' : 'none';
  }
  if (templatesForm) {
    templatesForm.style.display = drActiveTab === 'templates' ? '' : 'none';
  }
}

/**
 * Sync client selection between tabs when switching
 */
function syncClientSelection(fromTab: 'single' | 'templates', toTab: 'single' | 'templates'): void {
  const sourceSelectId = fromTab === 'single' ? 'dr-create-client' : 'dr-templates-client';
  const targetSelectId = toTab === 'single' ? 'dr-create-client' : 'dr-templates-client';

  // Find the source value - check both hidden input (custom dropdown) and native select
  let sourceValue = '';
  let sourceLabel = '';

  // Try custom dropdown first (hidden input with same id)
  const sourceHiddenInput = document.querySelector(`input[type="hidden"][id="${sourceSelectId}"]`) as HTMLInputElement;
  const sourceSelect = document.getElementById(sourceSelectId) as HTMLSelectElement | null;

  if (sourceHiddenInput && sourceHiddenInput.value) {
    sourceValue = sourceHiddenInput.value;
    // Get label from the trigger text
    const sourceWrapper = sourceHiddenInput.closest('.custom-dropdown');
    const sourceText = sourceWrapper?.querySelector('.custom-dropdown-text');
    sourceLabel = sourceText?.textContent || '';
  } else if (sourceSelect && sourceSelect.value) {
    sourceValue = sourceSelect.value;
    sourceLabel = sourceSelect.options[sourceSelect.selectedIndex]?.textContent || '';
  }

  if (!sourceValue) return;

  // Update target - check both hidden input (custom dropdown) and native select
  const targetHiddenInput = document.querySelector(`input[type="hidden"][id="${targetSelectId}"]`) as HTMLInputElement;
  const targetSelect = document.getElementById(targetSelectId) as HTMLSelectElement | null;

  // Update hidden input for custom dropdown
  if (targetHiddenInput) {
    targetHiddenInput.value = sourceValue;
    // Update the display text
    const targetWrapper = targetHiddenInput.closest('.custom-dropdown');
    const targetText = targetWrapper?.querySelector('.custom-dropdown-text');
    if (targetText) {
      targetText.textContent = sourceLabel;
    }
  }

  // Update native select (for form compatibility)
  if (targetSelect) {
    targetSelect.value = sourceValue;
  }
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

function openDetailModal(requestId: number, ctx: AdminDashboardContext): void {
  const modal = el('dr-detail-modal');
  const titleEl = el('dr-detail-modal-title');
  const bodyEl = el('dr-detail-body');
  const footerEl = el('dr-detail-footer');
  if (!modal || !titleEl || !bodyEl || !footerEl) return;

  titleEl.textContent = 'Document Request';
  bodyEl.innerHTML = '<p class="loading-message">Loading...</p>';
  footerEl.innerHTML = '';
  openModalOverlay(modal);
  drDetailModalFocusCleanup = manageFocusTrap(modal, {});

  loadRequestDetail(requestId).then((data) => {
    if (!data) {
      bodyEl.innerHTML = '<p>Request not found.</p>';
      return;
    }
    const { request: r, history } = data;
    titleEl.textContent = r.title;
    bodyEl.innerHTML = `
      <dl class="dr-detail-dl">
        <dt>Client</dt><dd>${escapeHtml(SanitizationUtils.decodeHtmlEntities(r.client_name ?? String(r.client_id)))}</dd>
        <dt>Status</dt><dd>${statusLabel(r.status)}</dd>
        <dt>Due date</dt><dd>${formatDate(r.due_date)}</dd>
        <dt>Requested by</dt><dd>${escapeHtml(r.requested_by)}</dd>
        ${r.description ? `<dt>Description</dt><dd>${escapeHtml(r.description)}</dd>` : ''}
        ${r.uploaded_at ? `<dt>Uploaded</dt><dd>${formatDate(r.uploaded_at)} by ${escapeHtml(r.uploaded_by ?? '-')}</dd>` : ''}
        ${r.reviewed_at ? `<dt>Reviewed</dt><dd>${formatDate(r.reviewed_at)} by ${escapeHtml(r.reviewed_by ?? '-')}</dd>` : ''}
        ${r.review_notes ? `<dt>Review notes</dt><dd>${escapeHtml(r.review_notes)}</dd>` : ''}
        ${r.rejection_reason ? `<dt>Rejection reason</dt><dd>${escapeHtml(r.rejection_reason)}</dd>` : ''}
      </dl>
      ${history && history.length > 0 ? `<h3>History</h3><ul class="dr-history-list">${history.map((h) => `<li><strong>${escapeHtml(h.action)}</strong> ${escapeHtml(h.actor_email)} (${formatDate(h.created_at)})${h.notes ? ` – ${escapeHtml(h.notes)}` : ''}</li>`).join('')}</ul>` : ''}
    `;
    footerEl.innerHTML = `
      ${r.status === 'uploaded' ? `<button type="button" class="btn btn-primary btn-sm dr-detail-start-review" data-id="${  r.id  }">Start review</button>` : ''}
      ${r.status === 'under_review' ? `<button type="button" class="btn btn-primary btn-sm dr-detail-approve" data-id="${  r.id  }">Approve</button><button type="button" class="btn btn-danger btn-sm dr-detail-reject" data-id="${  r.id  }">Reject</button>` : ''}
      ${r.status !== 'approved' && r.status !== 'rejected' ? `<button type="button" class="btn btn-outline btn-sm dr-detail-remind" data-id="${  r.id  }">Send reminder</button>` : ''}
      <button type="button" class="btn btn-secondary btn-sm" id="dr-detail-close">Close</button>
    `;
    footerEl.querySelector('#dr-detail-close')?.addEventListener('click', () => closeDetailModal());
    footerEl.querySelectorAll('.dr-detail-start-review, .dr-detail-approve, .dr-detail-reject, .dr-detail-remind').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt((e.currentTarget as HTMLElement).getAttribute('data-id')!, 10);
        const action = (e.currentTarget as HTMLElement).classList.contains('dr-detail-start-review')
          ? 'start-review'
          : (e.currentTarget as HTMLElement).classList.contains('dr-detail-approve')
            ? 'approve'
            : (e.currentTarget as HTMLElement).classList.contains('dr-detail-reject')
              ? 'reject'
              : 'remind';
        await runDetailAction(id, action, ctx);
        closeDetailModal();
        await refreshDocumentRequests(ctx);
      });
    });
  });
}

function closeDetailModal(): void {
  const modal = el('dr-detail-modal');
  if (modal) {
    closeModalOverlay(modal);
    drDetailModalFocusCleanup?.();
    drDetailModalFocusCleanup = null;
  }
}

async function runDetailAction(
  id: number,
  action: 'start-review' | 'approve' | 'reject' | 'remind',
  _ctx: AdminDashboardContext
): Promise<void> {
  try {
    if (action === 'start-review') {
      await apiPost(`${DR_API}/${id}/start-review`, {});
      showToast('Review started', 'success');
    } else if (action === 'approve') {
      const notes = window.prompt('Review notes (optional):') ?? '';
      await apiPost(`${DR_API}/${id}/approve`, { notes });
      showToast('Request approved', 'success');
    } else if (action === 'reject') {
      const reason = window.prompt('Rejection reason (required):');
      if (reason === null || !reason.trim()) return;
      await apiPost(`${DR_API}/${id}/reject`, { reason: reason.trim() });
      showToast('Request rejected', 'success');
    } else if (action === 'remind') {
      await apiPost(`${DR_API}/${id}/remind`, {});
      showToast('Reminder sent', 'success');
    }
  } catch (err) {
    showToast((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Main load and setup
// ---------------------------------------------------------------------------

async function refreshDocumentRequests(ctx: AdminDashboardContext): Promise<void> {
  const tbody = el('document-requests-table-body');
  if (tbody) showTableLoading(tbody, DR_TABLE_COLSPAN, 'Loading requests...');

  try {
    requestsCache = await loadAllRequests();
    // Apply client-side filters
    const filtered = applyFilters(requestsCache, filterState, DOCUMENT_REQUESTS_FILTER_CONFIG);
    // Update pagination total and apply pagination
    paginationState.totalItems = filtered.length;
    const paginated = applyPagination(filtered, paginationState);
    renderRequestsTable(paginated, ctx);
    renderDRPaginationUI(filtered.length, ctx);
  } catch (err) {
    if (tbody) showTableEmpty(tbody, DR_TABLE_COLSPAN, 'Failed to load requests.');
    showToast((err as Error).message, 'error');
  }
}

function setupDRListeners(ctx: AdminDashboardContext): void {
  if (drListenersSetup) return;
  drListenersSetup = true;

  // Create modal open/close
  el('dr-add-request')?.addEventListener('click', () => openCreateModal(ctx));
  el('dr-create-modal-close')?.addEventListener('click', closeCreateModal);
  el('dr-create-cancel')?.addEventListener('click', closeCreateModal);
  el('dr-templates-cancel')?.addEventListener('click', closeCreateModal);

  // Tab switching - sync client selection between tabs
  const modal = el('dr-create-modal');
  modal?.querySelectorAll('.admin-modal-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-dr-tab') as 'single' | 'templates';
      if (tabName) {
        // Sync client selection before switching
        syncClientSelection(drActiveTab, tabName);
        drActiveTab = tabName;
        updateTabUI();
      }
    });
  });

  // Close modal on backdrop click
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeCreateModal();
  });

  // Single request form submit
  document.getElementById('dr-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Get client value from hidden input (custom dropdown) or native select
    const clientHiddenInput = document.querySelector('input[type="hidden"][id="dr-create-client"]') as HTMLInputElement | null;
    const clientSelect = document.getElementById('dr-create-client') as HTMLSelectElement | null;
    const clientValue = clientHiddenInput?.value || clientSelect?.value || '';

    const titleInput = document.getElementById('dr-create-title') as HTMLInputElement | null;
    const descInput = document.getElementById('dr-create-description') as HTMLTextAreaElement | null;
    const dueInput = document.getElementById('dr-create-due') as HTMLInputElement | null;

    if (!clientValue || !titleInput?.value.trim()) {
      showToast('Please select a client and enter a title', 'error');
      return;
    }
    try {
      const response = await apiPost(DR_API, {
        client_id: parseInt(clientValue, 10),
        title: titleInput.value.trim(),
        description: descInput?.value.trim() || undefined,
        due_date: dueInput?.value || undefined
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      await response.json();

      showToast('Document request created', 'success');
      closeCreateModal();
      // Reset form
      titleInput.value = '';
      if (descInput) descInput.value = '';
      if (dueInput) dueInput.value = '';
      await refreshDocumentRequests(ctx);
    } catch (err) {
      console.error('[DocRequests] Create error:', err);
      showToast((err as Error).message, 'error');
    }
  });

  // Templates form submit
  document.getElementById('dr-from-templates-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Get client value from hidden input (custom dropdown) or native select
    const clientHiddenInput = document.querySelector('input[type="hidden"][id="dr-templates-client"]') as HTMLInputElement | null;
    const clientSelect = document.getElementById('dr-templates-client') as HTMLSelectElement | null;
    const clientValue = clientHiddenInput?.value || clientSelect?.value || '';

    const checked = document.querySelectorAll<HTMLInputElement>('input[name="dr-template-id"]:checked');
    if (!clientValue || checked.length === 0) {
      showToast('Select a client and at least one template', 'error');
      return;
    }
    try {
      await apiPost(`${DR_API}/from-templates`, {
        client_id: parseInt(clientValue, 10),
        template_ids: Array.from(checked).map((c) => parseInt(c.value, 10))
      });
      showToast(`${checked.length} document request(s) created`, 'success');
      closeCreateModal();
      await refreshDocumentRequests(ctx);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  });

  el('dr-refresh')?.addEventListener('click', () => refreshDocumentRequests(ctx));

  // Setup filter UI (search, status checkboxes, date range)
  const filterContainer = el('dr-filter-container');
  if (filterContainer && !filterUIContainer) {
    filterUIContainer = createFilterUI(
      DOCUMENT_REQUESTS_FILTER_CONFIG,
      filterState,
      (newState) => {
        filterState = newState;
        refreshFilteredTable(ctx);
      }
    );

    // Insert filter UI before export button
    const exportBtn = filterContainer.querySelector('#dr-export');
    if (exportBtn) {
      filterContainer.insertBefore(filterUIContainer, exportBtn);
    } else {
      filterContainer.prepend(filterUIContainer);
    }

    // Setup sortable headers after table is rendered
    setTimeout(() => {
      createSortableHeaders(DOCUMENT_REQUESTS_FILTER_CONFIG, filterState, (column, direction) => {
        filterState = { ...filterState, sortColumn: column, sortDirection: direction };
        saveFilterState(DOCUMENT_REQUESTS_FILTER_CONFIG.storageKey, filterState);
        refreshFilteredTable(ctx);
      });
    }, 100);
  }

  // Setup export button
  const exportBtn = el('dr-export');
  if (exportBtn && !exportBtn.dataset.listenerAdded) {
    exportBtn.dataset.listenerAdded = 'true';
    exportBtn.addEventListener('click', () => {
      const filtered = getFilteredRequests();
      if (filtered.length === 0) {
        showToast('No document requests to export', 'warning');
        return;
      }
      exportToCsv(filtered as unknown as Record<string, unknown>[], DOCUMENT_REQUESTS_EXPORT_CONFIG);
      showToast(`Exported ${filtered.length} document requests to CSV`, 'success');
    });
  }

  // Setup bulk action toolbar
  const bulkToolbarContainer = el('dr-bulk-toolbar');
  if (bulkToolbarContainer && !bulkToolbarContainer.classList.contains('bulk-initialized')) {
    const toolbar = createBulkActionToolbar({
      ...DR_BULK_CONFIG,
      onSelectionChange: () => {
        // Selection change callback if needed
      }
    });
    bulkToolbarContainer.replaceWith(toolbar);
  }

  // Detail modal close
  el('dr-detail-modal-close')?.addEventListener('click', closeDetailModal);

  // Close detail modal on backdrop click
  const detailModal = el('dr-detail-modal');
  detailModal?.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });

  el('document-requests-table-body')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const viewBtn = target.closest('.dr-view');
    const startBtn = target.closest('.dr-start-review');
    const approveBtn = target.closest('.dr-approve');
    const rejectBtn = target.closest('.dr-reject');
    const remindBtn = target.closest('.dr-remind');
    const deleteBtn = target.closest('.dr-delete');

    if (viewBtn) {
      const id = parseInt(viewBtn.getAttribute('data-id')!, 10);
      openDetailModal(id, ctx);
      return;
    }
    if (startBtn) {
      const id = parseInt(startBtn.getAttribute('data-id')!, 10);
      try {
        await apiPost(`${DR_API}/${id}/start-review`, {});
        showToast('Review started', 'success');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
      return;
    }
    if (approveBtn) {
      const id = parseInt(approveBtn.getAttribute('data-id')!, 10);
      const notes = window.prompt('Review notes (optional):') ?? '';
      try {
        await apiPost(`${DR_API}/${id}/approve`, { notes });
        showToast('Request approved', 'success');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
      return;
    }
    if (rejectBtn) {
      const id = parseInt(rejectBtn.getAttribute('data-id')!, 10);
      const reason = window.prompt('Rejection reason (required):');
      if (reason === null || !reason.trim()) return;
      try {
        await apiPost(`${DR_API}/${id}/reject`, { reason: reason.trim() });
        showToast('Request rejected', 'success');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
      return;
    }
    if (remindBtn) {
      const id = parseInt(remindBtn.getAttribute('data-id')!, 10);
      try {
        await apiPost(`${DR_API}/${id}/remind`, {});
        showToast('Reminder sent', 'success');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
      return;
    }
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id')!;
      const title = deleteBtn.getAttribute('data-title') || 'this request';
      const ok = await confirmDanger(`Delete document request "${title}"? This cannot be undone.`);
      if (!ok) return;
      try {
        await apiDelete(`${DR_API}/${id}`);
        showToast('Request deleted', 'success');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Render icons for dynamic rendering
// ---------------------------------------------------------------------------

const RENDER_ICONS = {
  EXPORT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>',
  PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  DOCUMENT: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
};

// ---------------------------------------------------------------------------
// Dynamic Tab Render
// ---------------------------------------------------------------------------

/**
 * Render the document requests tab structure dynamically
 */
export function renderDocumentRequestsTab(container: HTMLElement): void {
  container.innerHTML = `
    <div class="admin-table-card portal-shadow">
      <div class="admin-table-header">
        <h3>Requests</h3>
        <div class="admin-table-actions" id="dr-filter-container">
          <button type="button" class="icon-btn" id="dr-export" title="Export to CSV" aria-label="Export to CSV">
            <span class="icon-btn-svg">${RENDER_ICONS.EXPORT}</span>
          </button>
          <button type="button" class="icon-btn" id="dr-refresh" title="Refresh" aria-label="Refresh">
            <span class="icon-btn-svg">${RENDER_ICONS.REFRESH}</span>
          </button>
          <button type="button" class="icon-btn" id="dr-add-request" title="Add Request" aria-label="Add Request">
            <span class="icon-btn-svg">${RENDER_ICONS.PLUS}</span>
          </button>
        </div>
      </div>
      <div id="dr-bulk-toolbar" class="bulk-action-toolbar"></div>
      <div class="admin-table-container">
        <div class="admin-table-scroll-wrapper">
        <table class="admin-table" aria-label="Document requests">
          <thead>
            <tr>
              <th scope="col" class="bulk-select-cell">
                <div class="portal-checkbox">
                  <input type="checkbox" id="document-requests-select-all" class="bulk-select-all" aria-label="Select all document requests" />
                </div>
              </th>
              <th scope="col">Title</th>
              <th scope="col" class="contact-col">Client</th>
              <th scope="col" class="type-col">Type</th>
              <th scope="col" class="status-col">Status</th>
              <th scope="col" class="date-col">Due</th>
              <th scope="col" class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="document-requests-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
            <tr>
              <td colspan="7" class="loading-row">Loading requests...</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="document-requests-pagination" class="table-pagination"></div>
    </div>
    <!-- Create Modal -->
    <div class="admin-modal-overlay hidden" id="dr-create-modal" role="dialog" aria-modal="true" aria-labelledby="dr-create-modal-title">
      <div class="admin-modal">
        <div class="admin-modal-header">
          <div class="admin-modal-title">
            ${RENDER_ICONS.DOCUMENT}
            <h2 id="dr-create-modal-title">New Document Request</h2>
          </div>
          <button class="admin-modal-close" id="dr-create-modal-close" aria-label="Close modal">&times;</button>
        </div>
        <div class="admin-modal-tabs">
          <button type="button" class="admin-modal-tab active" data-dr-tab="single">Single Request</button>
          <button type="button" class="admin-modal-tab" data-dr-tab="templates">From Templates</button>
        </div>
        <!-- Single Request Tab -->
        <form id="dr-create-form" data-dr-tab-content="single">
          <div class="admin-modal-body">
            <div class="form-group">
              <label class="field-label" for="dr-create-client">Client *</label>
              <select id="dr-create-client" name="dr-create-client" class="form-input" required>
                <option value="">Select client</option>
              </select>
            </div>
            <div class="form-group">
              <label class="field-label" for="dr-create-title">Title *</label>
              <input type="text" id="dr-create-title" class="form-input" placeholder="Document title" required />
            </div>
            <div class="form-group">
              <label class="field-label" for="dr-create-description">Description</label>
              <textarea id="dr-create-description" class="form-input" rows="3" placeholder="Additional details about the document request"></textarea>
            </div>
            <div class="form-group">
              <label class="field-label" for="dr-create-due">Due Date</label>
              <input type="date" id="dr-create-due" class="form-input" />
            </div>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="btn btn-secondary" id="dr-create-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Request</button>
          </div>
        </form>
        <!-- From Templates Tab -->
        <form id="dr-from-templates-form" data-dr-tab-content="templates" style="display: none;">
          <div class="admin-modal-body">
            <div class="form-group">
              <label class="field-label" for="dr-templates-client">Client *</label>
              <select id="dr-templates-client" name="dr-templates-client" class="form-input" required>
                <option value="">Select client</option>
              </select>
            </div>
            <div class="form-group">
              <label class="field-label">Select Templates *</label>
              <div id="dr-templates-list" class="dr-templates-checkboxes" aria-label="Select templates"></div>
            </div>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="btn btn-secondary" id="dr-templates-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Requests</button>
          </div>
        </form>
      </div>
    </div>
    <!-- Detail Modal -->
    <div class="admin-modal-overlay hidden" id="dr-detail-modal" role="dialog" aria-modal="true" aria-labelledby="dr-detail-modal-title">
      <div class="admin-modal admin-modal--wide">
        <div class="admin-modal-header">
          <div class="admin-modal-title">
            ${RENDER_ICONS.DOCUMENT}
            <h2 id="dr-detail-modal-title">Document Request</h2>
          </div>
          <button class="admin-modal-close" id="dr-detail-modal-close" aria-label="Close modal">&times;</button>
        </div>
        <div id="dr-detail-body" class="admin-modal-body"></div>
        <div id="dr-detail-footer" class="admin-modal-footer"></div>
      </div>
    </div>
  `;

  // Reset initialization flags since DOM was rebuilt
  drListenersSetup = false;
  filterUIContainer = null;
  drCreateClientDropdownInit = false;
  drTemplatesClientDropdownInit = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadDocumentRequests(ctx: AdminDashboardContext): Promise<void> {
  storedDrContext = ctx;
  setupDRListeners(ctx);
  await refreshDocumentRequests(ctx);
}

/**
 * Get document requests filtered by current filter state
 */
function getFilteredRequests(): DocumentRequest[] {
  return applyFilters(requestsCache, filterState, DOCUMENT_REQUESTS_FILTER_CONFIG);
}

/**
 * Refresh the table with current filter and search applied
 */
function refreshFilteredTable(ctx: AdminDashboardContext): void {
  const filtered = getFilteredRequests();
  // Update pagination total and apply pagination
  paginationState.totalItems = filtered.length;
  const paginated = applyPagination(filtered, paginationState);
  renderRequestsTable(paginated, ctx);
  renderDRPaginationUI(filtered.length, ctx);
}

/**
 * Refresh the table (called from various places)
 */
async function refreshTable(ctx: AdminDashboardContext): Promise<void> {
  await refreshDocumentRequests(ctx);
}
