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
import { apiFetch, apiPost, apiDelete } from '../../../utils/api-client';
import { parseJsonResponse } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { confirmDanger, alertError, alertSuccess } from '../../../utils/confirm-dialog';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { createFilterSelect, type FilterSelectInstance } from '../../../components/filter-select';
import { createTableDropdown } from '../../../components/table-dropdown';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createSearchBar } from '../../../components/search-bar';
import { exportToCsv, DOCUMENT_REQUESTS_EXPORT_CONFIG } from '../../../utils/table-export';
import {
  createRowCheckbox,
  createBulkActionToolbar,
  setupBulkSelectionHandlers,
  resetSelection,
  type BulkActionConfig
} from '../../../utils/table-bulk-actions';

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
let drFilterWrapper: HTMLElement | null = null;
let drCreateClientSelectInstance: FilterSelectInstance | null = null;
let drTemplatesClientSelectInstance: FilterSelectInstance | null = null;
let drCreateModalFocusCleanup: (() => void) | null = null;
let drTemplatesModalFocusCleanup: (() => void) | null = null;
let drDetailModalFocusCleanup: (() => void) | null = null;
let drSearchQuery: string = '';
let currentDrFilter: 'all' | 'pending' | 'for-review' | 'overdue' = 'all';
let storedDrContext: AdminDashboardContext | null = null;

// Bulk action configuration for document requests
const DR_BULK_CONFIG: BulkActionConfig = {
  tableId: 'document-requests',
  actions: [
    {
      id: 'send-reminder',
      label: 'Send Reminders',
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
            await alertSuccess(`Sent ${successCount} reminder${successCount > 1 ? 's' : ''}`);
            resetSelection('document-requests');
          }
        } catch (error) {
          console.error('[DocRequests] Bulk remind error:', error);
          await alertError('Failed to send reminders');
        }
      }
    },
    {
      id: 'delete',
      label: 'Delete',
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
            await alertSuccess(`Deleted ${successCount} request${successCount > 1 ? 's' : ''}`);
            resetSelection('document-requests');
            await refreshTable(storedDrContext);
          }
        } catch (error) {
          console.error('[DocRequests] Bulk delete error:', error);
          await alertError('Failed to delete requests');
        }
      }
    }
  ]
};

const DR_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'for-review', label: 'For review' },
  { value: 'overdue', label: 'Overdue' }
] as const;

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

async function loadRequests(
  filter: 'all' | 'pending' | 'for-review' | 'overdue'
): Promise<DocumentRequest[]> {
  if (filter === 'all') {
    const [pendingRes, forReviewRes, overdueRes] = await Promise.all([
      apiFetch(`${DR_API}/pending`),
      apiFetch(`${DR_API}/for-review`),
      apiFetch(`${DR_API}/overdue`)
    ]);
    const pending = pendingRes.ok ? await parseJsonResponse<{ requests: DocumentRequest[] }>(pendingRes).then((d) => d.requests || []) : [];
    const forReview = forReviewRes.ok ? await parseJsonResponse<{ requests: DocumentRequest[] }>(forReviewRes).then((d) => d.requests || []) : [];
    const overdue = overdueRes.ok ? await parseJsonResponse<{ requests: DocumentRequest[] }>(overdueRes).then((d) => d.requests || []) : [];
    const byId = new Map<number, DocumentRequest>();
    [...pending, ...forReview, ...overdue].forEach((r) => byId.set(r.id, r));
    return Array.from(byId.values()).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }
  const path =
    filter === 'pending' ? '/pending' : filter === 'for-review' ? '/for-review' : '/overdue';
  const res = await apiFetch(`${DR_API}${path}`);
  if (!res.ok) return [];
  const data = await parseJsonResponse<{ requests: DocumentRequest[] }>(res);
  return data.requests || [];
}

async function loadClients(): Promise<ClientOption[]> {
  const res = await apiFetch('/api/clients');
  if (!res.ok) return [];
  const data = await parseJsonResponse<{ clients: ClientOption[] }>(res);
  return data.clients || [];
}

async function loadTemplates(): Promise<DocumentRequestTemplate[]> {
  const res = await apiFetch(`${DR_API}/templates/list`);
  if (!res.ok) return [];
  const data = await parseJsonResponse<{ templates: DocumentRequestTemplate[] }>(res);
  return data.templates || [];
}

async function loadRequestDetail(id: number): Promise<{ request: DocumentRequest; history: DocumentRequestHistory[] } | null> {
  const res = await apiFetch(`${DR_API}/${id}`);
  if (!res.ok) return null;
  return parseJsonResponse(res);
}

// ---------------------------------------------------------------------------
// Render table
// ---------------------------------------------------------------------------

const DR_TABLE_COLSPAN = 7;

function renderRequestsTable(requests: DocumentRequest[], _ctx: AdminDashboardContext): void {
  const tbody = el('dr-tbody');
  if (!tbody) return;

  if (requests.length === 0) {
    showTableEmpty(tbody, DR_TABLE_COLSPAN, 'No document requests match the filter.');
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
      <td>${escapeHtml(r.client_name ?? String(r.client_id))}</td>
      <td>${escapeHtml(r.document_type || '-')}</td>
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

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------

function openCreateModal(_ctx: AdminDashboardContext): void {
  const modal = el('dr-create-modal');
  if (!modal) return;

  if (drCreateClientSelectInstance) {
    drCreateClientSelectInstance.setOptions([{ value: '', label: 'Loading...' }], '');
  }
  modal.style.display = 'flex';
  drCreateModalFocusCleanup = manageFocusTrap(modal, {});

  loadClients().then((clients) => {
    if (drCreateClientSelectInstance) {
      drCreateClientSelectInstance.setOptions(
        clients.map((c) => ({
          value: String(c.id),
          label: c.company_name || c.contact_name || c.email || String(c.id)
        })),
        ''
      );
    }
  });
}

function closeCreateModal(): void {
  const modal = el('dr-create-modal');
  if (modal) {
    modal.style.display = 'none';
    drCreateModalFocusCleanup?.();
    drCreateModalFocusCleanup = null;
  }
}

// ---------------------------------------------------------------------------
// From-templates modal
// ---------------------------------------------------------------------------

function openFromTemplatesModal(_ctx: AdminDashboardContext): void {
  const modal = el('dr-from-templates-modal');
  const listEl = el('dr-templates-list');
  if (!modal || !listEl) return;

  if (drTemplatesClientSelectInstance) {
    drTemplatesClientSelectInstance.setOptions([{ value: '', label: 'Loading...' }], '');
  }
  listEl.innerHTML = '<p class="loading-message">Loading templates...</p>';
  modal.style.display = 'flex';
  drTemplatesModalFocusCleanup = manageFocusTrap(modal, {});

  Promise.all([loadClients(), loadTemplates()]).then(([clients, templates]) => {
    if (drTemplatesClientSelectInstance) {
      drTemplatesClientSelectInstance.setOptions(
        clients.map((c) => ({
          value: String(c.id),
          label: c.company_name || c.contact_name || c.email || String(c.id)
        })),
        ''
      );
    }

    if (templates.length === 0) {
      listEl.innerHTML = '<p>No templates. Create templates first (or add a single request).</p>';
      return;
    }
    listEl.innerHTML = templates
      .map(
        (t) => `
      <label class="dr-template-option">
        <input type="checkbox" name="dr-template-id" value="${t.id}" />
        <span>${escapeHtml(t.title)}${t.name ? ` (${escapeHtml(t.name)})` : ''}</span>
      </label>
    `
      )
      .join('');
  });
}

function closeFromTemplatesModal(): void {
  const modal = el('dr-from-templates-modal');
  if (modal) {
    modal.style.display = 'none';
    drTemplatesModalFocusCleanup?.();
    drTemplatesModalFocusCleanup = null;
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
  modal.style.display = 'flex';
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
        <dt>Client</dt><dd>${escapeHtml(r.client_name ?? String(r.client_id))}</dd>
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
    modal.style.display = 'none';
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
      alertSuccess('Review started.');
    } else if (action === 'approve') {
      const notes = window.prompt('Review notes (optional):') ?? '';
      await apiPost(`${DR_API}/${id}/approve`, { notes });
      alertSuccess('Request approved.');
    } else if (action === 'reject') {
      const reason = window.prompt('Rejection reason (required):');
      if (reason === null || !reason.trim()) return;
      await apiPost(`${DR_API}/${id}/reject`, { reason: reason.trim() });
      alertSuccess('Request rejected.');
    } else if (action === 'remind') {
      await apiPost(`${DR_API}/${id}/remind`, {});
      alertSuccess('Reminder sent.');
    }
  } catch (err) {
    alertError((err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Main load and setup
// ---------------------------------------------------------------------------

async function refreshDocumentRequests(ctx: AdminDashboardContext): Promise<void> {
  const filterValue = (drFilterWrapper?.dataset?.status ?? (document.getElementById('dr-filter') as HTMLSelectElement | null)?.value) ?? 'all';
  const filter = filterValue as 'all' | 'pending' | 'for-review' | 'overdue';
  const tbody = el('dr-tbody');
  if (tbody) showTableLoading(tbody, DR_TABLE_COLSPAN, 'Loading requests...');

  try {
    requestsCache = await loadRequests(filter);
    renderRequestsTable(requestsCache, ctx);
  } catch (err) {
    if (tbody) showTableEmpty(tbody, DR_TABLE_COLSPAN, 'Failed to load requests.');
    alertError((err as Error).message);
  }
}

function setupDRListeners(ctx: AdminDashboardContext): void {
  if (drListenersSetup) return;
  drListenersSetup = true;

  el('dr-add-request')?.addEventListener('click', () => openCreateModal(ctx));
  el('dr-create-modal-close')?.addEventListener('click', closeCreateModal);
  el('dr-create-cancel')?.addEventListener('click', closeCreateModal);

  document.getElementById('dr-create-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientSelect = document.getElementById('dr-create-client') as HTMLSelectElement | null;
    const titleInput = document.getElementById('dr-create-title') as HTMLInputElement | null;
    const descInput = document.getElementById('dr-create-description') as HTMLTextAreaElement | null;
    const dueInput = document.getElementById('dr-create-due') as HTMLInputElement | null;
    if (!clientSelect?.value || !titleInput?.value.trim()) return;
    try {
      await apiPost(DR_API, {
        client_id: parseInt(clientSelect.value, 10),
        title: titleInput.value.trim(),
        description: descInput?.value.trim() || undefined,
        due_date: dueInput?.value || undefined
      });
      alertSuccess('Document request created.');
      closeCreateModal();
      titleInput.value = '';
      if (descInput) descInput.value = '';
      if (dueInput) dueInput.value = '';
      await refreshDocumentRequests(ctx);
    } catch (err) {
      alertError((err as Error).message);
    }
  });

  el('dr-from-templates')?.addEventListener('click', () => openFromTemplatesModal(ctx));
  el('dr-templates-modal-close')?.addEventListener('click', closeFromTemplatesModal);
  el('dr-templates-cancel')?.addEventListener('click', closeFromTemplatesModal);

  document.getElementById('dr-from-templates-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientSelect = document.getElementById('dr-templates-client') as HTMLSelectElement | null;
    const checked = document.querySelectorAll<HTMLInputElement>('input[name="dr-template-id"]:checked');
    if (!clientSelect?.value || checked.length === 0) {
      alertError('Select a client and at least one template.');
      return;
    }
    try {
      await apiPost(`${DR_API}/from-templates`, {
        client_id: parseInt(clientSelect.value, 10),
        template_ids: Array.from(checked).map((c) => parseInt(c.value, 10))
      });
      alertSuccess(`${checked.length} document request(s) created.`);
      closeFromTemplatesModal();
      await refreshDocumentRequests(ctx);
    } catch (err) {
      alertError((err as Error).message);
    }
  });

  el('dr-refresh')?.addEventListener('click', () => refreshDocumentRequests(ctx));

  const drFilterMount = el('dr-filter-mount');
  if (drFilterMount && !drFilterWrapper) {
    const options = DR_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
    drFilterWrapper = createTableDropdown({
      options,
      currentValue: 'all',
      showStatusDot: false,
      ariaLabelPrefix: 'Filter requests',
      showAllWithCheckmark: true,
      onChange: () => refreshDocumentRequests(ctx)
    });
    drFilterWrapper.id = 'dr-filter';
    drFilterMount.appendChild(drFilterWrapper);
  }

  // Setup search bar
  const searchMount = el('dr-search-mount');
  if (searchMount && !searchMount.querySelector('.search-bar')) {
    const { wrapper } = createSearchBar({
      placeholder: 'Search requests...',
      ariaLabel: 'Search document requests',
      onInput: (value) => {
        drSearchQuery = value.toLowerCase();
        refreshFilteredTable(ctx);
      }
    });
    searchMount.appendChild(wrapper);
  }

  // Setup export button
  const exportBtn = el('dr-export');
  if (exportBtn && !exportBtn.dataset.listenerAdded) {
    exportBtn.dataset.listenerAdded = 'true';
    exportBtn.addEventListener('click', () => {
      const filtered = getFilteredRequests();
      if (filtered.length === 0) {
        alertError('No document requests to export');
        return;
      }
      exportToCsv(filtered as unknown as Record<string, unknown>[], DOCUMENT_REQUESTS_EXPORT_CONFIG);
      alertSuccess(`Exported ${filtered.length} document requests to CSV`);
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

  const createClientMount = el('dr-create-client-mount');
  if (createClientMount && !drCreateClientSelectInstance) {
    drCreateClientSelectInstance = createFilterSelect({
      id: 'dr-create-client',
      ariaLabel: 'Client',
      emptyOption: 'Select client',
      options: [],
      value: '',
      className: 'form-input',
      required: true
    });
    createClientMount.appendChild(drCreateClientSelectInstance.element);
  }

  const templatesClientMount = el('dr-templates-client-mount');
  if (templatesClientMount && !drTemplatesClientSelectInstance) {
    drTemplatesClientSelectInstance = createFilterSelect({
      id: 'dr-templates-client',
      ariaLabel: 'Client',
      emptyOption: 'Select client',
      options: [],
      value: '',
      className: 'form-input',
      required: true
    });
    templatesClientMount.appendChild(drTemplatesClientSelectInstance.element);
  }

  el('dr-detail-modal-close')?.addEventListener('click', closeDetailModal);

  el('dr-tbody')?.addEventListener('click', async (e) => {
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
        alertSuccess('Review started.');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        alertError((err as Error).message);
      }
      return;
    }
    if (approveBtn) {
      const id = parseInt(approveBtn.getAttribute('data-id')!, 10);
      const notes = window.prompt('Review notes (optional):') ?? '';
      try {
        await apiPost(`${DR_API}/${id}/approve`, { notes });
        alertSuccess('Request approved.');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        alertError((err as Error).message);
      }
      return;
    }
    if (rejectBtn) {
      const id = parseInt(rejectBtn.getAttribute('data-id')!, 10);
      const reason = window.prompt('Rejection reason (required):');
      if (reason === null || !reason.trim()) return;
      try {
        await apiPost(`${DR_API}/${id}/reject`, { reason: reason.trim() });
        alertSuccess('Request rejected.');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        alertError((err as Error).message);
      }
      return;
    }
    if (remindBtn) {
      const id = parseInt(remindBtn.getAttribute('data-id')!, 10);
      try {
        await apiPost(`${DR_API}/${id}/remind`, {});
        alertSuccess('Reminder sent.');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        alertError((err as Error).message);
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
        alertSuccess('Request deleted.');
        await refreshDocumentRequests(ctx);
      } catch (err) {
        alertError((err as Error).message);
      }
    }
  });
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
 * Get document requests filtered by current filter and search query
 */
function getFilteredRequests(): DocumentRequest[] {
  let filtered = requestsCache;

  // Apply search filter
  if (drSearchQuery) {
    filtered = filtered.filter(r => {
      const clientName = r.client_name?.toLowerCase() || '';
      const title = r.title?.toLowerCase() || '';
      const status = r.status?.toLowerCase() || '';
      const type = r.document_type?.toLowerCase() || '';

      return (
        clientName.includes(drSearchQuery) ||
        title.includes(drSearchQuery) ||
        status.includes(drSearchQuery) ||
        type.includes(drSearchQuery)
      );
    });
  }

  return filtered;
}

/**
 * Refresh the table with current filter and search applied
 */
function refreshFilteredTable(ctx: AdminDashboardContext): void {
  const filtered = getFilteredRequests();
  renderRequestsTable(filtered, ctx);
}

/**
 * Refresh the table (called from various places)
 */
async function refreshTable(ctx: AdminDashboardContext): Promise<void> {
  await refreshDocumentRequests(ctx);
}
