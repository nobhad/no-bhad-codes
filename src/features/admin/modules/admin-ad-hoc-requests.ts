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
import { formatDate, formatCurrency } from '../../../utils/format-utils';
import { showToast } from '../../../utils/toast-notifications';
import { createPortalModal } from '../../../components/portal-modal';
import { ICONS } from '../../../constants/icons';
import { renderActionsCell, createAction } from '../../../factories';
import { createModalDropdown } from '../../../components/modal-dropdown';
import { getStatusDotHTML } from '../../../components/status-badge';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { AD_HOC_REQUESTS_FILTER_CONFIG } from '../../../utils/table-filter';
import { createTableModule, createPaginationConfig } from '../../../utils/table-module-factory';
import { createLogger } from '../../../utils/logger';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';

const logger = createLogger('AdHocRequests');

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn =
  typeof import('../../../react/features/admin/ad-hoc-requests').mountAdHocRequestsTable;
type ReactUnmountFn =
  typeof import('../../../react/features/admin/ad-hoc-requests').unmountAdHocRequestsTable;

let mountAdHocRequestsTable: ReactMountFn | null = null;
let unmountAdHocRequestsTable: ReactUnmountFn | null = null;
let reactTableMounted = false;
let reactMountContainer: HTMLElement | null = null;

/**
 * Check if React table is actually mounted (container exists and has content)
 */
function isReactTableActuallyMounted(): boolean {
  if (!reactTableMounted) return false;
  // Check if the container still exists in the DOM and has content
  if (
    !reactMountContainer ||
    !reactMountContainer.isConnected ||
    reactMountContainer.children.length === 0
  ) {
    reactTableMounted = false;
    reactMountContainer = null;
    return false;
  }
  return true;
}

/** Lazy load React mount functions */
async function loadReactAdHocRequestsTable(): Promise<boolean> {
  if (mountAdHocRequestsTable && unmountAdHocRequestsTable) return true;

  try {
    const module = await import('../../../react/features/admin/ad-hoc-requests');
    mountAdHocRequestsTable = module.mountAdHocRequestsTable;
    unmountAdHocRequestsTable = module.unmountAdHocRequestsTable;
    return true;
  } catch (err) {
    logger.error(' Failed to load React module:', err);
    return false;
  }
}

/** Check if React ad hoc requests table should be used - always true */
function shouldUseReactAdHocRequestsTable(): boolean {
  return true;
}

const REQUESTS_API = API_ENDPOINTS.AD_HOC_REQUESTS;

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

// Module-specific state (not handled by factory)
let listenersInitialized = false;

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
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

// ============================================
// TABLE MODULE FACTORY
// ============================================

/**
 * Ad Hoc Requests table module using factory pattern
 */
const adHocRequestsModule = createTableModule<AdHocRequest>({
  moduleId: 'ad-hoc-requests',
  filterConfig: AD_HOC_REQUESTS_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('ad-hoc-requests'),
  columnCount: 7,
  apiEndpoint: REQUESTS_API,

  emptyMessage: 'No ad hoc requests yet.',
  filterEmptyMessage: 'No ad hoc requests match the current filters.',

  extractData: (response: unknown) => {
    const data = response as { requests?: AdHocRequest[] };
    const requests = Array.isArray(data.requests) ? data.requests : [];
    return { data: requests };
  },

  renderRow: (request: AdHocRequest) => {
    return buildRequestRow(request);
  },

  onDataLoaded: (_data: AdHocRequest[], ctx: AdminDashboardContext) => {
    setupListeners(ctx);
  },

  onTableRendered: (_filteredData: AdHocRequest[], _ctx: AdminDashboardContext) => {
    initTableKeyboardNav({
      tableSelector: '#ad-hoc-requests-table-body',
      rowSelector: 'tr[data-adhoc-request-id]',
      onRowSelect: (row) => {
        const viewBtn = row.querySelector('button[title="View request"]') as HTMLButtonElement;
        if (viewBtn) viewBtn.click();
      },
      focusClass: 'row-focused',
      selectedClass: 'row-selected'
    });
  }
});

/**
 * Cleanup function called when leaving the ad hoc requests tab
 * Unmounts React components if they were mounted
 */
export function cleanupAdHocRequestsTab(): void {
  if (reactTableMounted && unmountAdHocRequestsTable) {
    unmountAdHocRequestsTable();
    reactTableMounted = false;
  }
}

/**
 * Load ad hoc requests data - handles both React and vanilla implementations
 */
export async function loadAdHocRequests(ctx: AdminDashboardContext): Promise<void> {
  // Check if React implementation should be used
  const useReact = shouldUseReactAdHocRequestsTable();
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React AdHocRequestsTable
    const mountContainer = document.getElementById('react-ad-hoc-requests-mount');
    if (mountContainer) {
      const loaded = await loadReactAdHocRequestsTable();
      if (loaded && mountAdHocRequestsTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountAdHocRequestsTable) {
          unmountAdHocRequestsTable();
        }
        mountAdHocRequestsTable(mountContainer, {
          getAuthToken: ctx.getAuthToken,
          showNotification: ctx.showNotification,
          onNavigate: (tab: string, entityId?: string) => {
            if (entityId) {
              ctx.switchTab(tab);
            } else {
              ctx.switchTab(tab);
            }
          }
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        reactMountSuccess = true;
      } else {
        logger.error(' React module failed to load, falling back to vanilla');
      }
    }

    if (reactMountSuccess) {
      return;
    }
    // Fall through to vanilla implementation if React failed
  }

  // Vanilla implementation
  await adHocRequestsModule.load(ctx);
}

/**
 * Build a single ad hoc request table row
 */
function buildRequestRow(request: AdHocRequest): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.dataset.adhocRequestId = String(request.id);

  const title = SanitizationUtils.escapeHtml(request.title);
  const clientName = SanitizationUtils.escapeHtml(request.clientName || 'Client');
  const projectName = SanitizationUtils.escapeHtml(request.projectName || 'Project');
  const typeLabel = SanitizationUtils.escapeHtml(formatLabel(request.requestType));
  const priorityLabel = SanitizationUtils.escapeHtml(formatLabel(request.priority));

  row.innerHTML = `
    <td class="identity-cell" data-label="Request">
      <span class="identity-name" data-field="primary-name">${title}</span>
      <span class="identity-contact" data-field="secondary-name">${typeLabel}</span>
    </td>
    <td class="name-cell" data-label="Client">${clientName}</td>
    <td class="name-cell" data-label="Project">${projectName}</td>
    <td class="type-cell" data-label="Priority">${priorityLabel}</td>
    <td class="status-cell" data-label="Status">${getStatusIndicator(request.status)}</td>
    <td class="date-cell" data-label="Submitted">${formatDate(request.createdAt)}</td>
    <td class="actions-cell" data-label="Actions">
      ${renderActionsCell([
    createAction('view', request.id, { title: 'View request', ariaLabel: 'View request' })
  ])}
    </td>
  `;

  return row;
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
    logger.error('Failed to load time entries:', error);
  }

  const totalHours = timeEntries.reduce(
    (sum: number, entry: TimeEntry) => sum + (entry.hours || 0),
    0
  );

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
      <div class="meta-grid meta-grid--2col meta-grid--gap-sm">
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
      <div class="meta-grid meta-grid--2col meta-grid--gap-sm">
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
      <button type="submit" class="btn btn-primary btn-full">Log Time Entry</button>
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

async function openInvoiceGenerationModal(
  request: AdHocRequest,
  onSuccess: () => void
): Promise<void> {
  // Get all completed requests for bundling option
  const completedRequests = adHocRequestsModule
    .getData()
    .filter((r) => r.status === 'completed' && r.projectId === request.projectId);

  const modal = createPortalModal({
    id: 'ad-hoc-invoice-modal',
    titleId: 'ad-hoc-invoice-title',
    title: 'Generate Invoice',
    icon: ICONS.RECEIPT,
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
    <form id="ad-hoc-invoice-form" class="ad-hoc-invoice-form flex flex-col gap-2">
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

        const requestIds = Array.from(bundleCheckboxes).map((cb) =>
          Number((cb as HTMLInputElement).value)
        );
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
    icon: ICONS.CLIPBOARD,
    contentClassName: 'ad-hoc-request-modal',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });

  const body = document.createElement('div');
  body.className = 'ad-hoc-request-body flex flex-col gap-2';

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
        <div id="ad-hoc-status-mount" data-current="${request.status}"></div>
      </div>
      <div class="form-group">
        <label for="ad-hoc-priority">Priority</label>
        <div id="ad-hoc-priority-mount" data-current="${request.priority}"></div>
      </div>
      <div class="form-group">
        <label for="ad-hoc-urgency">Urgency</label>
        <div id="ad-hoc-urgency-mount" data-current="${request.urgency}"></div>
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
        <strong>${request.quotedPrice !== null ? formatCurrency(request.quotedPrice) : '-'}</strong>
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

  // Create modal dropdowns for status, priority, urgency
  const statusMount = body.querySelector('#ad-hoc-status-mount') as HTMLElement | null;
  if (statusMount) {
    const statusDropdown = createModalDropdown({
      options: STATUS_OPTIONS.map((s) => ({ value: s, label: formatLabel(s) })),
      currentValue: request.status,
      ariaLabelPrefix: 'Status'
    });
    statusDropdown.id = 'ad-hoc-status';
    statusMount.appendChild(statusDropdown);
  }

  const priorityMount = body.querySelector('#ad-hoc-priority-mount') as HTMLElement | null;
  if (priorityMount) {
    const priorityDropdown = createModalDropdown({
      options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' }
      ],
      currentValue: request.priority,
      ariaLabelPrefix: 'Priority'
    });
    priorityDropdown.id = 'ad-hoc-priority';
    priorityMount.appendChild(priorityDropdown);
  }

  const urgencyMount = body.querySelector('#ad-hoc-urgency-mount') as HTMLElement | null;
  if (urgencyMount) {
    const urgencyDropdown = createModalDropdown({
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'priority', label: 'Priority' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'emergency', label: 'Emergency' }
      ],
      currentValue: request.urgency,
      ariaLabelPrefix: 'Urgency'
    });
    urgencyDropdown.id = 'ad-hoc-urgency';
    urgencyMount.appendChild(urgencyDropdown);
  }

  // Add time entries section if task is linked
  if (request.taskId) {
    const timeEntriesUI = await createTimeEntryUI(request.id, request.taskId);
    modal.body.appendChild(timeEntriesUI);
  }

  document.body.appendChild(modal.overlay);
  modal.show();

  const form = body.querySelector('#ad-hoc-request-form') as HTMLFormElement | null;
  const statusEl = body.querySelector('#ad-hoc-status') as HTMLElement | null;
  const priorityEl = body.querySelector('#ad-hoc-priority') as HTMLElement | null;
  const urgencyEl = body.querySelector('#ad-hoc-urgency') as HTMLElement | null;
  const estimatedHoursEl = body.querySelector('#ad-hoc-estimated-hours') as HTMLInputElement | null;
  const hourlyRateEl = body.querySelector('#ad-hoc-hourly-rate') as HTMLInputElement | null;
  const flatRateEl = body.querySelector('#ad-hoc-flat-rate') as HTMLInputElement | null;
  const quotedPriceEl = body.querySelector('#ad-hoc-quoted-price') as HTMLInputElement | null;
  const sendQuoteBtn = body.querySelector('#send-ad-hoc-quote') as HTMLButtonElement | null;
  const convertTaskBtn = body.querySelector('#convert-ad-hoc-task') as HTMLButtonElement | null;

  const buildPayload = () => ({
    status: statusEl?.getAttribute('data-value') || request.status,
    priority: priorityEl?.getAttribute('data-value') || request.priority,
    urgency: urgencyEl?.getAttribute('data-value') || request.urgency,
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
      const ctx = adHocRequestsModule.getContext();
      if (ctx) await adHocRequestsModule.load(ctx);
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
      const ctx = adHocRequestsModule.getContext();
      if (ctx) await adHocRequestsModule.load(ctx);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  });

  convertTaskBtn?.addEventListener('click', async () => {
    const selectedStatus = statusEl?.getAttribute('data-value') || request.status;
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
      const actionHref = taskId
        ? `/admin?tab=tasks&taskId=${taskId}${projectId ? `&projectId=${projectId}` : ''}`
        : undefined;

      showToast(
        'Request converted to task.',
        'success',
        actionHref
          ? {
            duration: 6000,
            actionLabel: 'View task',
            actionHref
          }
          : undefined
      );
      modal.hide();
      modal.overlay.remove();
      const ctx = adHocRequestsModule.getContext();
      if (ctx) await adHocRequestsModule.load(ctx);
      if (taskId && ctx) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'tasks');
        url.searchParams.set('taskId', String(taskId));
        if (projectId) {
          url.searchParams.set('projectId', String(projectId));
        }
        window.history.replaceState({}, '', url.toString());
        ctx.switchTab('tasks');
      }
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  });

  const generateInvoiceBtn = body.querySelector(
    '#generate-ad-hoc-invoice'
  ) as HTMLButtonElement | null;
  generateInvoiceBtn?.addEventListener('click', async () => {
    await openInvoiceGenerationModal(request, async () => {
      const ctx = adHocRequestsModule.getContext();
      if (ctx) await adHocRequestsModule.load(ctx);
    });
  });
}

function setupListeners(ctx: AdminDashboardContext): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  const refreshBtn = document.getElementById('refresh-ad-hoc-requests-btn');
  refreshBtn?.addEventListener('click', () => adHocRequestsModule.load(ctx));

  const tableBody = document.getElementById('ad-hoc-requests-table-body');
  tableBody?.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button[data-action]') as HTMLButtonElement | null;
    if (!button) return;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);
    const request = adHocRequestsModule.findById(id);
    if (!request) return;

    if (action === 'view') {
      openRequestModal(request);
    }
  });
}

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  REFRESH:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
};

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the Ad Hoc Requests tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderAdHocRequestsTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactAdHocRequestsTable();

  if (useReact) {
    // React implementation - render minimal container
    container.innerHTML = `
      <!-- React Ad Hoc Requests Table Mount Point -->
      <div id="react-ad-hoc-requests-mount"></div>
    `;
    return;
  }

  // Vanilla implementation - original HTML
  container.innerHTML = `
    <div class="data-table-card" id="ad-hoc-requests-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">Ad Hoc Requests</span><span class="title-mobile">Requests</span></h3>
        <div class="data-table-actions" id="ad-hoc-requests-filter-container">
          <button class="icon-btn" id="refresh-ad-hoc-requests-btn" title="Refresh" aria-label="Refresh ad hoc requests">
            ${RENDER_ICONS.REFRESH}
          </button>
        </div>
      </div>
      <div class="data-table-container">
        <div class="data-table-scroll-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col" class="identity-col">Request</th>
                <th scope="col" class="name-col">Client</th>
                <th scope="col" class="name-col">Project</th>
                <th scope="col" class="type-col">Priority</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="date-col">Submitted</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="ad-hoc-requests-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr class="loading-row">
                <td colspan="7">
                  <div class="loading-state">
                    <span class="loading-spinner" aria-hidden="true"></span>
                    <span class="loading-message">Loading requests...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="ad-hoc-requests-pagination" class="table-pagination"></div>
    </div>
  `;

  // Reset module cache when tab is re-rendered (DOM elements changed)
  adHocRequestsModule.resetCache();
  listenersInitialized = false;
}
