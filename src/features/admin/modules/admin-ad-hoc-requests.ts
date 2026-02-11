/**
 * ===============================================
 * ADMIN AD HOC REQUESTS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-ad-hoc-requests.ts
 *
 * Admin UI for ad hoc requests: list, filter, and quote updates.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut } from '../../../utils/api-client';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { formatDate } from '../../../utils/format-utils';
import { showToast } from '../../../utils/toast-notifications';
import { createPortalModal } from '../../../components/portal-modal';
import { getStatusDotHTML } from '../../../components/status-badge';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  AD_HOC_REQUESTS_FILTER_CONFIG,
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

const REQUESTS_API = '/api/ad-hoc-requests';

interface AdHocRequest {
  id: number;
  projectId: number;
  clientId: number;
  title: string;
  description: string;
  status: string;
  requestType: string;
  priority: string;
  urgency: string;
  estimatedHours: number | null;
  flatRate: number | null;
  hourlyRate: number | null;
  quotedPrice: number | null;
  attachmentFileId?: number | null;
  taskId?: number | null;
  convertedAt?: string | null;
  convertedBy?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  projectName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TimeEntry {
  hours: number;
  userName?: string;
  date: string;
  description?: string;
  billable?: boolean;
}

let requestsCache: AdHocRequest[] = [];
let storedContext: AdminDashboardContext | null = null;
let listenersInitialized = false;
let filterUIInitialized = false;

let filterState: FilterState = loadFilterState(AD_HOC_REQUESTS_FILTER_CONFIG.storageKey);

const REQUESTS_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'ad-hoc-requests',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_ad_hoc_requests_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(REQUESTS_PAGINATION_CONFIG),
  ...loadPaginationState(REQUESTS_PAGINATION_CONFIG.storageKey!)
};

const STATUS_OPTIONS = [
  'submitted',
  'reviewing',
  'quoted',
  'approved',
  'in_progress',
  'completed',
  'declined'
];

const STATUS_VARIANTS: Record<string, string> = {
  submitted: 'pending',
  reviewing: 'in-progress',
  quoted: 'pending',
  approved: 'active',
  in_progress: 'in-progress',
  completed: 'completed',
  declined: 'cancelled'
};

function formatLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `$${value.toFixed(2)}`;
}

function parseNumber(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getStatusIndicator(status: string): string {
  const variant = STATUS_VARIANTS[status] || status;
  return getStatusDotHTML(variant, { label: formatLabel(status) });
}

function renderPagination(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('ad-hoc-requests-pagination');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  paginationState.totalItems = totalItems;
  const paginationUI = createPaginationUI(REQUESTS_PAGINATION_CONFIG, paginationState, (newState) => {
    paginationState = newState;
    savePaginationState(REQUESTS_PAGINATION_CONFIG.storageKey!, newState);
    renderRequestsTable(ctx);
  });

  container.innerHTML = '';
  container.appendChild(paginationUI);
}

function renderRequestsTable(ctx: AdminDashboardContext): void {
  const body = document.getElementById('ad-hoc-requests-table-body');
  if (!body) return;

  const filtered = applyFilters(requestsCache, filterState, AD_HOC_REQUESTS_FILTER_CONFIG);

  if (filtered.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="empty-row">No ad hoc requests found.</td></tr>';
    renderPagination(0, ctx);
    return;
  }

  paginationState.totalItems = filtered.length;
  const paginated = applyPagination(filtered, paginationState);

  body.innerHTML = paginated
    .map((request) => {
      const title = SanitizationUtils.escapeHtml(request.title);
      const clientName = SanitizationUtils.escapeHtml(request.clientName || 'Client');
      const projectName = SanitizationUtils.escapeHtml(request.projectName || 'Project');
      const typeLabel = SanitizationUtils.escapeHtml(formatLabel(request.requestType));
      const priorityLabel = SanitizationUtils.escapeHtml(formatLabel(request.priority));

      return `
        <tr>
          <td>
            <div class="table-primary">${title}</div>
            <div class="table-subtext">${typeLabel}</div>
          </td>
          <td>
            <div class="table-primary">${clientName}</div>
            <div class="table-subtext">${SanitizationUtils.escapeHtml(request.clientEmail || '')}</div>
          </td>
          <td>${projectName}</td>
          <td>${priorityLabel}</td>
          <td>${getStatusIndicator(request.status)}</td>
          <td>${formatDate(request.createdAt)}</td>
          <td class="actions-col">
            <button class="icon-btn" data-action="view" data-id="${request.id}" title="View request" aria-label="View request">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  renderPagination(filtered.length, ctx);
}

function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = document.getElementById('ad-hoc-requests-filter-container');
  if (!container) return;

  const filterUI = createFilterUI(AD_HOC_REQUESTS_FILTER_CONFIG, filterState, (newState) => {
    filterState = newState;
    paginationState.currentPage = 1;
    saveFilterState(AD_HOC_REQUESTS_FILTER_CONFIG.storageKey, filterState);
    renderRequestsTable(ctx);
  });

  const firstBtn = container.querySelector('button');
  if (firstBtn) {
    container.insertBefore(filterUI, firstBtn);
  } else {
    container.appendChild(filterUI);
  }

  createSortableHeaders(AD_HOC_REQUESTS_FILTER_CONFIG, filterState, (column, direction) => {
    filterState = { ...filterState, sortColumn: column, sortDirection: direction };
    saveFilterState(AD_HOC_REQUESTS_FILTER_CONFIG.storageKey, filterState);
    renderRequestsTable(ctx);
  });
}

async function fetchRequests(): Promise<AdHocRequest[]> {
  const response = await apiFetch(REQUESTS_API);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to load ad hoc requests');
  }

  return data.requests as AdHocRequest[];
}

function buildSelectOptions(options: string[], selected: string): string {
  return options
    .map((option) => {
      const label = formatLabel(option);
      return `<option value="${option}" ${option === selected ? 'selected' : ''}>${label}</option>`;
    })
    .join('');
}

async function createTimeEntryUI(requestId: number, taskId: number): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'ad-hoc-time-entries-section';

  // Fetch existing time entries
  let timeEntries: TimeEntry[] = [];
  try {
    const response = await apiFetch(`${REQUESTS_API}/${requestId}/time-entries`);
    const data = await response.json();
    if (data.success) {
      timeEntries = data.entries || [];
    }
  } catch (error) {
    console.error('Failed to load time entries:', error);
  }

  const totalHours = timeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.hours || 0), 0);

  container.innerHTML = `
    <div class="ad-hoc-time-entries-header">
      <h3>Time Entries</h3>
      <span class="ad-hoc-time-total">${totalHours.toFixed(1)} hours logged</span>
    </div>
    ${
  timeEntries.length > 0
    ? `
      <div class="ad-hoc-time-entries-list">
        ${timeEntries
    .map(
      (entry: TimeEntry) => `
          <div class="ad-hoc-time-entry">
            <div class="ad-hoc-time-entry-header">
              <span class="ad-hoc-time-entry-user">${SanitizationUtils.escapeHtml(entry.userName || 'Unknown')}</span>
              <span class="ad-hoc-time-entry-date">${formatDate(entry.date)}</span>
            </div>
            <div class="ad-hoc-time-entry-details">
              <span class="ad-hoc-time-entry-hours">${entry.hours.toFixed(1)}h</span>
              ${entry.description ? `<span class="ad-hoc-time-entry-desc">${SanitizationUtils.escapeHtml(entry.description)}</span>` : ''}
              ${entry.billable === false ? '<span class="ad-hoc-time-entry-non-billable">Non-billable</span>' : ''}
            </div>
          </div>
        `
    )
    .join('')}
      </div>
    `
    : '<p class="ad-hoc-time-entries-empty">No time entries yet</p>'
}
    <form id="ad-hoc-time-entry-form" class="ad-hoc-time-entry-form">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
        <div class="form-group">
          <label for="time-entry-user">User Name</label>
          <input type="text" id="time-entry-user" class="form-input" required />
        </div>
        <div class="form-group">
          <label for="time-entry-hours">Hours</label>
          <input type="number" id="time-entry-hours" step="0.1" min="0" class="form-input" required />
        </div>
      </div>
      <div class="form-group">
        <label for="time-entry-date">Date</label>
        <input type="date" id="time-entry-date" class="form-input" required value="${new Date().toISOString().split('T')[0]}" />
      </div>
      <div class="form-group">
        <label for="time-entry-desc">Description (optional)</label>
        <input type="text" id="time-entry-desc" class="form-input" placeholder="What was worked on?" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
        <div class="form-group">
          <label for="time-entry-billable">
            <input type="checkbox" id="time-entry-billable" checked />
            Billable
          </label>
        </div>
        <div class="form-group">
          <label for="time-entry-rate">Hourly Rate (optional)</label>
          <input type="number" id="time-entry-rate" step="0.01" min="0" class="form-input" placeholder="Leave empty for request rate" />
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="width: 100%;">Log Time Entry</button>
    </form>
  `;

  const form = container.querySelector('#ad-hoc-time-entry-form') as HTMLFormElement | null;
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userEl = container.querySelector('#time-entry-user') as HTMLInputElement;
      const hoursEl = container.querySelector('#time-entry-hours') as HTMLInputElement;
      const dateEl = container.querySelector('#time-entry-date') as HTMLInputElement;
      const descEl = container.querySelector('#time-entry-desc') as HTMLInputElement;
      const billableEl = container.querySelector('#time-entry-billable') as HTMLInputElement;
      const rateEl = container.querySelector('#time-entry-rate') as HTMLInputElement;

      try {
        const response = await apiPost(`${REQUESTS_API}/${requestId}/time-entries`, {
          userName: userEl.value,
          hours: parseFloat(hoursEl.value),
          date: dateEl.value,
          description: descEl.value || undefined,
          billable: billableEl.checked,
          hourlyRate: rateEl.value ? parseFloat(rateEl.value) : undefined
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'Failed to log time');
        }

        showToast('Time entry logged.', 'success');
        form.reset();
        (dateEl as HTMLInputElement).value = new Date().toISOString().split('T')[0];

        // Reload time entries
        const updatedUI = await createTimeEntryUI(requestId, taskId);
        container.replaceWith(updatedUI);
      } catch (error) {
        showToast((error as Error).message, 'error');
      }
    });
  }

  return container;
}

async function openInvoiceGenerationModal(request: AdHocRequest, onSuccess: () => void): Promise<void> {
  // Get all completed requests for bundling option
  const completedRequests = requestsCache.filter(
    (r) => r.status === 'completed' && r.projectId === request.projectId
  );

  const modal = createPortalModal({
    id: 'ad-hoc-invoice-modal',
    titleId: 'ad-hoc-invoice-title',
    title: 'Generate Invoice',
    contentClassName: 'ad-hoc-invoice-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  const body = document.createElement('div');
  body.className = 'ad-hoc-invoice-body';

  body.innerHTML = `
    <div class="ad-hoc-invoice-intro">
      <p>Create an invoice for completed ad hoc work. You can invoice a single request or bundle multiple requests.</p>
    </div>
    <form id="ad-hoc-invoice-form" class="ad-hoc-invoice-form">
      <div class="form-group">
        <label for="invoice-type">Invoice Type</label>
        <select id="invoice-type" class="form-input" required>
          <option value="single">Single Request</option>
          ${completedRequests.length > 1 ? '<option value="bundle">Bundle Multiple Requests</option>' : ''}
        </select>
      </div>

      <div id="single-request-section" class="invoice-section">
        <div class="form-group">
          <label for="invoice-request">Request</label>
          <select id="invoice-request" class="form-input" required>
            <option value="${request.id}">${SanitizationUtils.escapeHtml(request.title)}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="invoice-summary-time">
            <input type="checkbox" id="invoice-summary-time" />
            Include billable time summary
          </label>
        </div>
      </div>

      <div id="bundle-section" class="invoice-section" style="display: none;">
        <div class="form-group">
          <label>Select requests to bundle:</label>
          <div class="invoice-request-list">
            ${completedRequests
    .map(
      (req) => `
              <label class="invoice-request-item">
                <input type="checkbox" name="bundle-requests" value="${req.id}" />
                <span>${SanitizationUtils.escapeHtml(req.title)}</span>
              </label>
            `
    )
    .join('')}
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="invoice-due-date">Due Date</label>
        <input type="date" id="invoice-due-date" class="form-input" required value="${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}" />
      </div>

      <div class="form-group">
        <label for="invoice-note">Notes (optional)</label>
        <textarea id="invoice-note" class="form-input" placeholder="Add any notes or special instructions..." style="min-height: 100px; resize: vertical;"></textarea>
      </div>

      <div class="ad-hoc-invoice-actions">
        <button type="submit" class="btn btn-primary">Generate Invoice</button>
        <button type="button" class="btn btn-secondary" id="invoice-cancel">Cancel</button>
      </div>
    </form>
  `;

  modal.body.appendChild(body);
  document.body.appendChild(modal.overlay);
  modal.show();

  const invoiceTypeSelect = body.querySelector('#invoice-type') as HTMLSelectElement;
  const singleSection = body.querySelector('#single-request-section') as HTMLElement;
  const bundleSection = body.querySelector('#bundle-section') as HTMLElement;
  const form = body.querySelector('#ad-hoc-invoice-form') as HTMLFormElement;
  const cancelBtn = body.querySelector('#invoice-cancel') as HTMLButtonElement;

  // Toggle between single and bundle
  invoiceTypeSelect?.addEventListener('change', (e) => {
    const type = (e.target as HTMLSelectElement).value;
    singleSection.style.display = type === 'single' ? 'block' : 'none';
    bundleSection.style.display = type === 'bundle' ? 'block' : 'none';
  });

  cancelBtn?.addEventListener('click', () => {
    modal.hide();
    modal.overlay.remove();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const typeEl = body.querySelector('#invoice-type') as HTMLSelectElement;
    const dueDateEl = body.querySelector('#invoice-due-date') as HTMLInputElement;
    const noteEl = body.querySelector('#invoice-note') as HTMLTextAreaElement;
    const type = typeEl.value;

    try {
      if (type === 'single') {
        const summaryTimeEl = body.querySelector('#invoice-summary-time') as HTMLInputElement;
        const endpoint = `${REQUESTS_API}/${request.id}/invoice`;
        const response = await apiPost(endpoint, {
          dueDate: dueDateEl.value,
          note: noteEl.value || undefined,
          includeBillableTime: summaryTimeEl.checked
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'Failed to generate invoice');
        }

        const data = await response.json();
        const invoiceId = data.invoice?.id;

        showToast(
          'Invoice generated.',
          'success',
          invoiceId
            ? {
              duration: 6000,
              actionLabel: 'View invoice',
              actionHref: `/admin?tab=invoices&invoiceId=${invoiceId}`
            }
            : undefined
        );
      } else {
        const bundleCheckboxes = body.querySelectorAll('input[name="bundle-requests"]:checked');
        if (bundleCheckboxes.length === 0) {
          showToast('Please select at least one request to bundle.', 'error');
          return;
        }

        const requestIds = Array.from(bundleCheckboxes).map((cb) => Number((cb as HTMLInputElement).value));
        const response = await apiPost(`${REQUESTS_API}/invoice/bundle`, {
          requestIds,
          dueDate: dueDateEl.value,
          note: noteEl.value || undefined
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'Failed to create bundled invoice');
        }

        const data = await response.json();
        const invoiceId = data.invoice?.id;

        showToast(
          `Invoice created with ${requestIds.length} requests.`,
          'success',
          invoiceId
            ? {
              duration: 6000,
              actionLabel: 'View invoice',
              actionHref: `/admin?tab=invoices&invoiceId=${invoiceId}`
            }
            : undefined
        );
      }

      modal.hide();
      modal.overlay.remove();
      onSuccess();
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  });
}

async function openRequestModal(request: AdHocRequest): Promise<void> {
  const modal = createPortalModal({
    id: 'ad-hoc-request-modal',
    titleId: 'ad-hoc-request-title',
    title: 'Ad Hoc Request',
    contentClassName: 'ad-hoc-request-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  const body = document.createElement('div');
  body.className = 'ad-hoc-request-body';

  const attachmentNote = request.attachmentFileId
    ? `<div class="ad-hoc-request-meta">Attachment ID: ${request.attachmentFileId}</div>`
    : '<div class="ad-hoc-request-meta">No attachment</div>';
  const taskNote = request.taskId
    ? `<div class="ad-hoc-request-meta">Task ID: ${request.taskId}</div>`
    : '';

  body.innerHTML = `
    <div class="ad-hoc-request-summary">
      <div>
        <div class="ad-hoc-request-label">Client</div>
        <div class="ad-hoc-request-value">${SanitizationUtils.escapeHtml(request.clientName || 'Client')}</div>
        <div class="ad-hoc-request-subvalue">${SanitizationUtils.escapeHtml(request.clientEmail || '')}</div>
      </div>
      <div>
        <div class="ad-hoc-request-label">Project</div>
        <div class="ad-hoc-request-value">${SanitizationUtils.escapeHtml(request.projectName || 'Project')}</div>
      </div>
      <div>
        <div class="ad-hoc-request-label">Type</div>
        <div class="ad-hoc-request-value">${SanitizationUtils.escapeHtml(formatLabel(request.requestType))}</div>
      </div>
      <div>
        <div class="ad-hoc-request-label">Submitted</div>
        <div class="ad-hoc-request-value">${formatDate(request.createdAt)}</div>
      </div>
    </div>
    <div class="ad-hoc-request-description">
      <div class="ad-hoc-request-label">Description</div>
      <p>${SanitizationUtils.escapeHtml(request.description)}</p>
    </div>
    ${attachmentNote}
    ${taskNote}
    <form id="ad-hoc-request-form" class="ad-hoc-request-form">
      <div class="form-group">
        <label for="ad-hoc-status">Status</label>
        <select id="ad-hoc-status" class="form-input">
          ${buildSelectOptions(STATUS_OPTIONS, request.status)}
        </select>
      </div>
      <div class="form-group">
        <label for="ad-hoc-priority">Priority</label>
        <select id="ad-hoc-priority" class="form-input">
          ${buildSelectOptions(['low', 'normal', 'high', 'urgent'], request.priority)}
        </select>
      </div>
      <div class="form-group">
        <label for="ad-hoc-urgency">Urgency</label>
        <select id="ad-hoc-urgency" class="form-input">
          ${buildSelectOptions(['normal', 'priority', 'urgent', 'emergency'], request.urgency)}
        </select>
      </div>
      <div class="form-group">
        <label for="ad-hoc-estimated-hours">Estimated hours</label>
        <input type="number" step="0.1" id="ad-hoc-estimated-hours" class="form-input" value="${request.estimatedHours ?? ''}" />
      </div>
      <div class="form-group">
        <label for="ad-hoc-hourly-rate">Hourly rate</label>
        <input type="number" step="0.01" id="ad-hoc-hourly-rate" class="form-input" value="${request.hourlyRate ?? ''}" />
      </div>
      <div class="form-group">
        <label for="ad-hoc-flat-rate">Flat rate</label>
        <input type="number" step="0.01" id="ad-hoc-flat-rate" class="form-input" value="${request.flatRate ?? ''}" />
      </div>
      <div class="form-group">
        <label for="ad-hoc-quoted-price">Quoted price</label>
        <input type="number" step="0.01" id="ad-hoc-quoted-price" class="form-input" value="${request.quotedPrice ?? ''}" />
      </div>
      <div class="ad-hoc-request-quote-preview">
        <span>Current quote:</span>
        <strong>${formatCurrency(request.quotedPrice)}</strong>
      </div>
      <div class="ad-hoc-request-actions">
        <button type="submit" class="btn btn-primary">Save Updates</button>
        <button type="button" class="btn btn-secondary" id="send-ad-hoc-quote" ${request.clientEmail ? '' : 'disabled'}>
          Send Quote
        </button>
        <button type="button" class="btn btn-secondary" id="convert-ad-hoc-task" ${request.taskId ? 'disabled' : ''}>
          Convert to Task
        </button>
        ${request.status === 'completed' ? '<button type="button" class="btn btn-secondary" id="generate-ad-hoc-invoice">Generate Invoice</button>' : ''}
      </div>
    </form>
  `;

  modal.body.appendChild(body);

  // Add time entries section if task is linked
  if (request.taskId) {
    const timeEntriesUI = await createTimeEntryUI(request.id, request.taskId);
    modal.body.appendChild(timeEntriesUI);
  }

  document.body.appendChild(modal.overlay);
  modal.show();

  const form = body.querySelector('#ad-hoc-request-form') as HTMLFormElement | null;
  const statusEl = body.querySelector('#ad-hoc-status') as HTMLSelectElement | null;
  const priorityEl = body.querySelector('#ad-hoc-priority') as HTMLSelectElement | null;
  const urgencyEl = body.querySelector('#ad-hoc-urgency') as HTMLSelectElement | null;
  const estimatedHoursEl = body.querySelector('#ad-hoc-estimated-hours') as HTMLInputElement | null;
  const hourlyRateEl = body.querySelector('#ad-hoc-hourly-rate') as HTMLInputElement | null;
  const flatRateEl = body.querySelector('#ad-hoc-flat-rate') as HTMLInputElement | null;
  const quotedPriceEl = body.querySelector('#ad-hoc-quoted-price') as HTMLInputElement | null;
  const sendQuoteBtn = body.querySelector('#send-ad-hoc-quote') as HTMLButtonElement | null;
  const convertTaskBtn = body.querySelector('#convert-ad-hoc-task') as HTMLButtonElement | null;

  const buildPayload = () => ({
    status: statusEl?.value || request.status,
    priority: priorityEl?.value || request.priority,
    urgency: urgencyEl?.value || request.urgency,
    estimatedHours: parseNumber(estimatedHoursEl?.value || ''),
    hourlyRate: parseNumber(hourlyRateEl?.value || ''),
    flatRate: parseNumber(flatRateEl?.value || ''),
    quotedPrice: parseNumber(quotedPriceEl?.value || '')
  });

  const updateRequest = async (): Promise<void> => {
    const response = await apiPut(`${REQUESTS_API}/${request.id}`, buildPayload());
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to update request');
    }
  };

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      await updateRequest();
      showToast('Request updated.', 'success');
      modal.hide();
      modal.overlay.remove();
      if (storedContext) await loadAdHocRequests(storedContext);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  });

  sendQuoteBtn?.addEventListener('click', async () => {
    if (!request.clientEmail) {
      showToast('Client email is missing for this request.', 'error');
      return;
    }

    try {
      await updateRequest();
      const response = await apiPost(`${REQUESTS_API}/${request.id}/send-quote`, {});
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to send quote');
      }

      showToast('Quote sent to client.', 'success');
      modal.hide();
      modal.overlay.remove();
      if (storedContext) await loadAdHocRequests(storedContext);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  });

  convertTaskBtn?.addEventListener('click', async () => {
    const selectedStatus = statusEl?.value || request.status;
    if (selectedStatus !== 'approved') {
      showToast('Request must be approved before converting to a task.', 'error');
      return;
    }

    try {
      await updateRequest();
      const response = await apiPost(`${REQUESTS_API}/${request.id}/convert-to-task`, {});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Failed to convert request');
      }

      const taskId = data.task?.id as number | undefined;
      const projectId = data.task?.projectId as number | undefined;
      const actionHref = taskId ? `/admin?tab=tasks&taskId=${taskId}${projectId ? `&projectId=${projectId}` : ''}` : undefined;

      showToast('Request converted to task.', 'success', actionHref ? {
        duration: 6000,
        actionLabel: 'View task',
        actionHref
      } : undefined);
      modal.hide();
      modal.overlay.remove();
      if (storedContext) await loadAdHocRequests(storedContext);
      if (taskId && storedContext) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'tasks');
        url.searchParams.set('taskId', String(taskId));
        if (projectId) {
          url.searchParams.set('projectId', String(projectId));
        }
        window.history.replaceState({}, '', url.toString());
        storedContext.switchTab('tasks');
      }
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  });

  const generateInvoiceBtn = body.querySelector('#generate-ad-hoc-invoice') as HTMLButtonElement | null;
  generateInvoiceBtn?.addEventListener('click', async () => {
    await openInvoiceGenerationModal(request, async () => {
      if (storedContext) await loadAdHocRequests(storedContext);
    });
  });
}

function setupListeners(ctx: AdminDashboardContext): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  const refreshBtn = document.getElementById('refresh-ad-hoc-requests-btn');
  refreshBtn?.addEventListener('click', () => loadAdHocRequests(ctx));

  const tableBody = document.getElementById('ad-hoc-requests-table-body');
  tableBody?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);
    const request = requestsCache.find((item) => item.id === id);
    if (!request) return;

    if (action === 'view') {
      openRequestModal(request);
    }
  });
}

export async function loadAdHocRequests(ctx: AdminDashboardContext): Promise<void> {
  storedContext = ctx;
  setupListeners(ctx);

  if (!filterUIInitialized) {
    initializeFilterUI(ctx);
    filterUIInitialized = true;
  }

  try {
    const requests = await fetchRequests();
    requestsCache = requests;
    renderRequestsTable(ctx);
  } catch (error) {
    console.error('[AdminAdHocRequests] Failed to load requests:', error);
    showToast('Failed to load ad hoc requests.', 'error');
  }
}
