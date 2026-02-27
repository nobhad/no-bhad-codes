/**
 * ===============================================
 * ADMIN INVOICES MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-invoices.ts
 *
 * Invoice management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 *
 * Uses createTableModule factory for standardized table operations.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import type { AdminDashboardContext } from '../admin-types';
import type { InvoiceResponse, InvoiceLineItem } from '../../../types/api';
import { formatCurrency, formatDate } from '../../../utils/format-utils';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { getStatusDotHTML } from '../../../components/status-badge';
import { INVOICES_EXPORT_CONFIG } from '../../../utils/table-export';
import { createRowCheckbox } from '../../../utils/table-bulk-actions';
import { INVOICES_FILTER_CONFIG } from '../../../utils/table-filter';
import { showToast } from '../../../utils/toast-notifications';
import { createPortalModal } from '../../../components/portal-modal';
import { ICONS as GLOBAL_ICONS } from '../../../constants/icons';
import { renderActionsCell, createAction, conditionalAction } from '../../../components/table-action-buttons';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { withButtonLoading } from '../../../utils/button-loading';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { makeEditable } from '../../../components/inline-edit';
import { batchUpdateText } from '../../../utils/dom-cache';
import {
  createTableModule,
  createPaginationConfig,
  type TableModuleHelpers
} from '../../../utils/table-module-factory';

// ============================================
// REACT INTEGRATION (ISLAND ARCHITECTURE)
// ============================================

// React bundle only loads when feature flag is enabled
type ReactMountFn = typeof import('../../../react/features/admin/invoices').mountInvoicesTable;
type ReactUnmountFn = typeof import('../../../react/features/admin/invoices').unmountInvoicesTable;

let mountInvoicesTable: ReactMountFn | null = null;
let unmountInvoicesTable: ReactUnmountFn | null = null;
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

/** Lazy load React mount functions */
async function loadReactInvoicesTable(): Promise<boolean> {
  if (mountInvoicesTable && unmountInvoicesTable) return true;

  try {
    const module = await import('../../../react/features/admin/invoices');
    mountInvoicesTable = module.mountInvoicesTable;
    unmountInvoicesTable = module.unmountInvoicesTable;
    return true;
  } catch (err) {
    console.error('[AdminInvoices] Failed to load React module:', err);
    return false;
  }
}

/** Feature flag for React invoices table */
function shouldUseReactInvoicesTable(): boolean {
  // Check URL parameter for vanilla fallback
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('vanilla_invoices') === 'true') return false;

  // Check feature flag in localStorage
  const flag = localStorage.getItem('feature_react_invoices_table');
  if (flag === 'false') return false;
  if (flag === 'true') return true;

  // Default: enabled (React implementation)
  return true;
}

// ============================================
// TYPES
// ============================================

interface InvoiceStats {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
}

/** Extended invoice with joined client/project data */
interface InvoiceWithDetails extends InvoiceResponse {
  client_name?: string;
  project_name?: string;
}

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  EXPORT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
};

// ============================================
// TABLE MODULE FACTORY
// ============================================

/**
 * Invoices table module using factory pattern
 */
const invoicesModule = createTableModule<InvoiceWithDetails, InvoiceStats>({
  moduleId: 'invoices',
  filterConfig: INVOICES_FILTER_CONFIG,
  paginationConfig: createPaginationConfig('invoices'),
  columnCount: 7,
  apiEndpoint: '/api/invoices',

  bulkConfig: {
    tableId: 'invoices',
    actions: [
      {
        id: 'download-pdfs',
        label: 'Download PDFs',
        variant: 'default',
        handler: async (ids: number[]) => {
          showToast(`Generating ${ids.length} PDF(s)...`, 'info');
          try {
            const response = await apiPost('/api/invoices/export-batch', { invoiceIds: ids });
            if (response.ok) {
              const blob = await response.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `invoices-${Date.now()}.zip`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              showToast(`${ids.length} invoice(s) downloaded`, 'success');
            } else {
              const error = await response.json();
              showToast(error.error || 'Failed to export invoices', 'error');
            }
          } catch (error) {
            console.error('[AdminInvoices] Export error:', error);
            showToast('Failed to export invoices', 'error');
          }
        },
        confirmMessage: 'Download selected invoices as PDF?'
      },
      {
        id: 'mark-paid',
        label: 'Mark Paid',
        variant: 'default',
        handler: async (ids: number[]) => {
          for (const id of ids) {
            await apiPut(`/api/invoices/${id}`, { status: 'paid' });
          }
          showToast(`${ids.length} invoice(s) marked as paid`, 'success');
          const ctx = invoicesModule.getContext();
          if (ctx) invoicesModule.load(ctx);
        },
        confirmMessage: 'Mark selected invoices as paid?'
      },
      {
        id: 'send',
        label: 'Send',
        variant: 'default',
        handler: async (ids: number[]) => {
          for (const id of ids) {
            await apiPut(`/api/invoices/${id}`, { status: 'sent' });
          }
          showToast(`${ids.length} invoice(s) sent`, 'success');
          const ctx = invoicesModule.getContext();
          if (ctx) invoicesModule.load(ctx);
        },
        confirmMessage: 'Send selected invoices?'
      },
      {
        id: 'delete',
        label: 'Delete',
        variant: 'danger',
        handler: async (ids: number[]) => {
          for (const id of ids) {
            await apiDelete(`/api/invoices/${id}`);
          }
          showToast(`${ids.length} invoice(s) deleted`, 'success');
          const ctx = invoicesModule.getContext();
          if (ctx) invoicesModule.load(ctx);
        },
        confirmMessage: 'Delete selected invoices? This cannot be undone.'
      }
    ]
  },

  exportConfig: INVOICES_EXPORT_CONFIG,
  emptyMessage: 'No invoices yet.',
  filterEmptyMessage: 'No invoices match the current filters.',

  extractData: (response: unknown) => {
    const invoices = response as InvoiceWithDetails[];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: InvoiceStats = {
      total: invoices.length,
      pending: 0,
      paid: 0,
      overdue: 0
    };

    invoices.forEach((inv) => {
      if (inv.status === 'paid') {
        stats.paid++;
      } else if (inv.status === 'pending' || inv.status === 'sent') {
        if (inv.due_date) {
          const dueDate = new Date(inv.due_date);
          if (dueDate < today) {
            stats.overdue++;
          } else {
            stats.pending++;
          }
        } else {
          stats.pending++;
        }
      }
    });

    return { data: invoices, stats };
  },

  renderRow: (invoice: InvoiceWithDetails, ctx: AdminDashboardContext, _helpers: TableModuleHelpers<InvoiceWithDetails>) => {
    return buildInvoiceRow(invoice, ctx);
  },

  renderStats: (stats: InvoiceStats) => {
    batchUpdateText({
      'invoices-total': stats.total.toLocaleString(),
      'invoices-pending': stats.pending.toLocaleString(),
      'invoices-paid': stats.paid.toLocaleString(),
      'invoices-overdue': stats.overdue.toLocaleString()
    });
  },

  onDataLoaded: (_data: InvoiceWithDetails[], ctx: AdminDashboardContext) => {
    // Setup invoice action handlers
    setupInvoiceHandlers(ctx);
  },

  onTableRendered: (filteredData: InvoiceWithDetails[], ctx: AdminDashboardContext) => {
    const tableBody = invoicesModule.getElement('invoices-table-body');
    if (!tableBody) return;

    // Setup inline editing for due_date cells
    setupInlineDateEditing(tableBody, filteredData);

    // Initialize keyboard navigation
    initTableKeyboardNav({
      tableSelector: '.invoices-table',
      rowSelector: 'tbody tr[data-invoice-id]',
      onRowSelect: (row) => {
        const invoiceId = parseInt(row.dataset.invoiceId || '0');
        if (invoiceId) showViewInvoiceModal(invoiceId, ctx);
      },
      focusClass: 'row-focused',
      selectedClass: 'row-selected'
    });
  }
});

// Export factory-provided functions
export const getInvoicesData = invoicesModule.getData;

// Store context for React callbacks (used for future detail view integration)
let _storedContext: AdminDashboardContext | null = null;

/**
 * Cleanup function called when leaving the invoices tab
 * Unmounts React components if they were mounted
 */
export function cleanupInvoicesTab(): void {
  if (reactTableMounted && unmountInvoicesTable) {
    unmountInvoicesTable();
    reactTableMounted = false;
  }
}

/**
 * Load invoices data - handles both React and vanilla implementations
 */
export async function loadInvoicesData(ctx: AdminDashboardContext): Promise<void> {
  _storedContext = ctx;

  // Check if React implementation should be used
  const useReact = shouldUseReactInvoicesTable();
  let reactMountSuccess = false;

  if (useReact) {
    // Check if React table is already properly mounted
    if (isReactTableActuallyMounted()) {
      return; // Already mounted and working
    }

    // Lazy load and mount React InvoicesTable
    const mountContainer = document.getElementById('react-invoices-mount');
    if (mountContainer) {
      const loaded = await loadReactInvoicesTable();
      if (loaded && mountInvoicesTable) {
        // Unmount first if previously mounted to a different container
        if (reactTableMounted && unmountInvoicesTable) {
          unmountInvoicesTable();
        }
        mountInvoicesTable(mountContainer, {
          getAuthToken: ctx.getAuthToken,
          onViewInvoice: (invoiceId: number) => showViewInvoiceModal(invoiceId, ctx),
          showNotification: ctx.showNotification
        });
        reactTableMounted = true;
        reactMountContainer = mountContainer;
        reactMountSuccess = true;
      } else {
        console.error('[AdminInvoices] React module failed to load, falling back to vanilla');
      }
    }

    if (reactMountSuccess) {
      return;
    }
    // Fall through to vanilla implementation if React failed
  }

  // Vanilla implementation
  await invoicesModule.load(ctx);
}

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the Invoices tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderInvoicesTab(container: HTMLElement): void {
  // Check if React implementation should be used
  const useReact = shouldUseReactInvoicesTable();

  if (useReact) {
    // React implementation - render minimal container (no extra classes - React component has its own structure)
    container.innerHTML = `
      <!-- React Invoices Table Mount Point -->
      <div id="react-invoices-mount"></div>
    `;
    return;
  }

  // Vanilla implementation - original HTML
  container.innerHTML = `
    <!-- Invoice Stats -->
    <div class="quick-stats">
      <button class="stat-card stat-card-clickable" data-filter="all" data-table="invoices">
        <span class="stat-number" id="invoices-total">-</span>
        <span class="stat-label">Total Invoices</span>
      </button>
      <button class="stat-card stat-card-clickable" data-filter="pending" data-table="invoices">
        <span class="stat-number" id="invoices-pending">-</span>
        <span class="stat-label">Pending</span>
      </button>
      <button class="stat-card stat-card-clickable" data-filter="paid" data-table="invoices">
        <span class="stat-number" id="invoices-paid">-</span>
        <span class="stat-label">Paid</span>
      </button>
      <button class="stat-card stat-card-clickable" data-filter="overdue" data-table="invoices">
        <span class="stat-number" id="invoices-overdue">-</span>
        <span class="stat-label">Overdue</span>
      </button>
    </div>

    <!-- Invoices Table -->
    <div class="data-table-card" id="invoices-table-card">
      <div class="data-table-header">
        <h3><span class="title-full">All Invoices</span><span class="title-mobile">Invoices</span></h3>
        <div class="data-table-actions" id="invoices-filter-container">
          <button class="icon-btn" id="export-invoices-btn" title="Export to CSV" aria-label="Export invoices to CSV">
            ${RENDER_ICONS.EXPORT}
          </button>
          <button class="icon-btn" id="refresh-invoices-btn" title="Refresh" aria-label="Refresh invoices">
            ${RENDER_ICONS.REFRESH}
          </button>
          <button class="icon-btn" id="create-invoice-btn" title="Add Invoice" aria-label="Add new invoice">
            ${RENDER_ICONS.PLUS}
          </button>
        </div>
      </div>
      <!-- Bulk Action Toolbar (hidden initially) -->
      <div id="invoices-bulk-toolbar" class="bulk-action-toolbar hidden"></div>
      <div class="data-table-container">
        <div class="data-table-scroll-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col" class="bulk-select-cell">
                  <div class="portal-checkbox">
                    <input type="checkbox" id="invoices-select-all" class="bulk-select-all" aria-label="Select all invoices" />
                  </div>
                </th>
                <th scope="col" class="name-col">Invoice #</th>
                <th scope="col" class="identity-col">Client / Project</th>
                <th scope="col" class="amount-col">Amount</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="date-col">Due Date</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="invoices-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr class="loading-row">
                <td colspan="7">
                  <div class="loading-state">
                    <span class="loading-spinner" aria-hidden="true"></span>
                    <span class="loading-message">Loading invoices...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="invoices-pagination" class="table-pagination"></div>
    </div>
  `;

  // Reset factory cache so elements get re-queried after render
  invoicesModule.resetCache();
}

/**
 * Get numeric amount from invoice
 */
function getAmount(invoice: InvoiceWithDetails): number {
  const amount = invoice.amount_total;
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') return parseFloat(amount) || 0;
  return 0;
}

// ============================================
// ROW BUILDING HELPERS
// ============================================

/**
 * Build contextual action buttons based on invoice status
 * Uses centralized table-action-buttons for consistent rendering.
 */
function buildActionButtons(invoiceId: number, status: string): string {
  const isDraft = status === 'draft';
  const canMarkPaid = ['sent', 'pending', 'viewed', 'overdue'].includes(status);
  const canDownload = canMarkPaid || status === 'paid';

  return renderActionsCell([
    createAction('view', invoiceId, { title: 'View Invoice', ariaLabel: 'View invoice' }),
    conditionalAction(isDraft, 'send', invoiceId, { title: 'Send Invoice', ariaLabel: 'Send invoice' }),
    conditionalAction(isDraft, 'edit', invoiceId, { title: 'Edit Invoice', ariaLabel: 'Edit invoice' }),
    conditionalAction(canMarkPaid, 'mark-paid', invoiceId, { ariaLabel: 'Mark as paid' }),
    conditionalAction(canDownload, 'download', invoiceId, { title: 'Download PDF', ariaLabel: 'Download PDF' }),
  ]);
}

/**
 * Build a single invoice table row
 */
function buildInvoiceRow(invoice: InvoiceWithDetails, _ctx: AdminDashboardContext): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.dataset.invoiceId = String(invoice.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const safeInvoiceNumber = SanitizationUtils.escapeHtml(invoice.invoice_number || `INV-${invoice.id}`);
  const safeClientName = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(invoice.client_name || 'Unknown Client'));
  const safeProjectName = SanitizationUtils.escapeHtml(SanitizationUtils.decodeHtmlEntities(invoice.project_name || ''));
  const amount = formatCurrency(getAmount(invoice));
  const dueDate = invoice.due_date ? formatDate(invoice.due_date) : '-';

  // Determine status (check for overdue)
  let status = invoice.status || 'pending';
  if (status !== 'paid' && invoice.due_date) {
    const dueDateObj = new Date(invoice.due_date);
    if (dueDateObj < today) {
      status = 'overdue';
    }
  }

  const statusIndicator = getStatusDotHTML(status);

  // Build contextual action buttons based on status
  const actionButtons = buildActionButtons(invoice.id, status);

  row.innerHTML = `
    ${createRowCheckbox('invoices', invoice.id)}
    <td class="name-cell" data-label="Invoice"><strong>${safeInvoiceNumber}</strong></td>
    <td class="identity-cell" data-label="Client/Project">
      <span class="identity-name">${safeClientName}</span>
      <span class="identity-contact">${safeProjectName}</span>
    </td>
    <td class="amount-cell" data-label="Amount">${amount}</td>
    <td class="status-cell" data-label="Status">
      ${statusIndicator}
      <span class="date-stacked">${dueDate}</span>
    </td>
    <td class="date-cell inline-editable-cell" data-invoice-id="${invoice.id}" data-field="due_date" data-label="Due Date">
      <span class="due-date-value">${dueDate}</span>
    </td>
    <td class="actions-cell" data-label="Actions">
      ${actionButtons}
    </td>
  `;

  return row;
}

/**
 * Setup inline editing for due_date cells
 */
function setupInlineDateEditing(tableBody: HTMLElement, invoices: InvoiceWithDetails[]): void {
  tableBody.querySelectorAll('.date-cell.inline-editable-cell').forEach((cell) => {
    const cellEl = cell as HTMLElement;
    const invoiceId = parseInt(cellEl.dataset.invoiceId || '0');
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    makeEditable(
      cellEl,
      () => invoice.due_date ? invoice.due_date.split('T')[0] : '',
      async (newValue) => {
        const response = await apiPut(`/api/invoices/${invoiceId}`, { due_date: newValue || null });
        if (response.ok) {
          // Update the cached value
          (invoice as { due_date: string }).due_date = newValue || '';
          const dueDateValue = cellEl.querySelector('.due-date-value');
          if (dueDateValue) dueDateValue.textContent = newValue ? formatDate(newValue) : '-';
          showToast('Due date updated', 'success');
        } else {
          showToast('Failed to update due date', 'error');
          throw new Error('Update failed');
        }
      },
      { type: 'date', placeholder: 'Select date' }
    );
  });
}

/**
 * Set up invoice action handlers (table body delegation)
 */
function setupInvoiceHandlers(ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('invoices-table-body');
  if (!tableBody || tableBody.dataset.handlersAttached) return;

  tableBody.dataset.handlersAttached = 'true';

  // Delegate click events for action buttons
  tableBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-action]') as HTMLElement;
    if (!button) return;

    const action = button.dataset.action;
    const invoiceId = button.dataset.id;

    if (!invoiceId) return;

    switch (action) {
    case 'view':
      showViewInvoiceModal(parseInt(invoiceId), ctx);
      break;
    case 'edit':
      showEditInvoiceModal(parseInt(invoiceId), ctx);
      break;
    case 'send':
      handleSendInvoice(parseInt(invoiceId), ctx);
      break;
    case 'mark-paid':
      handleMarkPaid(parseInt(invoiceId), ctx);
      break;
    case 'download':
      handleDownloadPdf(parseInt(invoiceId));
      break;
    }
  });
}

/**
 * Handle sending an invoice
 */
async function handleSendInvoice(invoiceId: number, ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiPut(`/api/invoices/${invoiceId}`, { status: 'sent' });
    if (response.ok) {
      showToast('Invoice sent successfully', 'success');
      invoicesModule.load(ctx);
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to send invoice', 'error');
    }
  } catch (error) {
    console.error('[AdminInvoices] Send error:', error);
    showToast('Failed to send invoice', 'error');
  }
}

/**
 * Handle marking invoice as paid
 */
async function handleMarkPaid(invoiceId: number, ctx: AdminDashboardContext): Promise<void> {
  try {
    const response = await apiPut(`/api/invoices/${invoiceId}`, { status: 'paid' });
    if (response.ok) {
      showToast('Invoice marked as paid', 'success');
      invoicesModule.load(ctx);
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to update invoice', 'error');
    }
  } catch (error) {
    console.error('[AdminInvoices] Mark paid error:', error);
    showToast('Failed to update invoice', 'error');
  }
}

/**
 * Handle downloading invoice PDF
 */
async function handleDownloadPdf(invoiceId: number): Promise<void> {
  try {
    const response = await apiFetch(`/api/invoices/${invoiceId}/pdf`);
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      showToast('Failed to download PDF', 'error');
    }
  } catch (error) {
    console.error('[AdminInvoices] Download error:', error);
    showToast('Failed to download PDF', 'error');
  }
}

// ============================================
// VIEW INVOICE MODAL
// ============================================

/**
 * Show view invoice modal (read-only)
 */
async function showViewInvoiceModal(invoiceId: number, _ctx: AdminDashboardContext): Promise<void> {
  // Find invoice in cache or fetch from API
  let invoice = invoicesModule.findById(invoiceId);

  if (!invoice) {
    try {
      const response = await apiFetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) {
        showToast('Failed to load invoice', 'error');
        return;
      }
      invoice = await response.json();
    } catch (error) {
      console.error('[AdminInvoices] View invoice error:', error);
      showToast('Failed to load invoice', 'error');
      return;
    }
  }

  if (!invoice) return;

  let cleanupFocusTrap: (() => void) | null = null;

  const modal = createPortalModal({
    id: 'view-invoice-modal',
    titleId: 'view-invoice-title',
    title: `Invoice ${SanitizationUtils.escapeHtml(invoice.invoice_number || `#${invoice.id}`)}`,
    icon: GLOBAL_ICONS.RECEIPT,
    contentClassName: 'invoice-modal-content',
    onClose: () => {
      if (cleanupFocusTrap) cleanupFocusTrap();
      modal.hide();
      modal.overlay.remove();
    }
  });

  // Build line items table
  const lineItems = invoice.line_items || [];
  const lineItemsHTML = lineItems.length > 0
    ? `<div class="data-table-scroll-wrapper">
        <table class="data-table invoice-line-items">
          <thead>
            <tr>
              <th scope="col" class="name-col">Description</th>
              <th scope="col" class="count-col">Qty</th>
              <th scope="col" class="amount-col">Rate</th>
              <th scope="col" class="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems.map((item: InvoiceLineItem) => `
              <tr>
                <td data-label="Description">${SanitizationUtils.escapeHtml(item.description || '')}</td>
                <td class="text-right" data-label="Qty">${item.quantity || 1}</td>
                <td class="text-right" data-label="Rate">${formatCurrency(item.rate || 0)}</td>
                <td class="text-right" data-label="Amount">${formatCurrency(item.amount || 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`
    : '<p class="text-muted">No line items</p>';

  // Calculate totals
  const subtotal = lineItems.reduce((sum: number, item: InvoiceLineItem) => sum + (item.amount || 0), 0);
  const total = getAmount(invoice);
  const amountPaid = typeof invoice.amount_paid === 'number'
    ? invoice.amount_paid
    : parseFloat(String(invoice.amount_paid)) || 0;
  const balanceDue = total - amountPaid;

  // Build modal body
  modal.body.innerHTML = `
    <div class="invoice-view-content flex flex-col gap-4">
      <div class="invoice-header-info">
        <div class="invoice-info-row">
          <div class="invoice-info-item flex flex-col gap-1">
            <span class="field-label">Client</span>
            <span class="field-value">${SanitizationUtils.escapeHtml(invoice.client_name || 'Unknown')}</span>
          </div>
          <div class="invoice-info-item flex flex-col gap-1">
            <span class="field-label">Project</span>
            <span class="field-value">${SanitizationUtils.escapeHtml(invoice.project_name || '-')}</span>
          </div>
        </div>
        <div class="invoice-info-row">
          <div class="invoice-info-item flex flex-col gap-1">
            <span class="field-label">Status</span>
            <span class="field-value">${getStatusDotHTML(invoice.status || 'pending')}</span>
          </div>
          <div class="invoice-info-item flex flex-col gap-1">
            <span class="field-label">Due Date</span>
            <span class="field-value">${invoice.due_date ? formatDate(invoice.due_date) : '-'}</span>
          </div>
        </div>
        <div class="invoice-info-row">
          <div class="invoice-info-item flex flex-col gap-1">
            <span class="field-label">Created</span>
            <span class="field-value">${invoice.created_at ? formatDate(invoice.created_at) : '-'}</span>
          </div>
          ${invoice.paid_date ? `
            <div class="invoice-info-item flex flex-col gap-1">
              <span class="field-label">Paid</span>
              <span class="field-value">${formatDate(invoice.paid_date)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="invoice-line-items-section">
        <h3 class="section-title">Line Items</h3>
        ${lineItemsHTML}
      </div>

      <div class="invoice-totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="total-row total-main">
          <span>Total</span>
          <span>${formatCurrency(total)}</span>
        </div>
        ${amountPaid > 0 ? `
          <div class="total-row">
            <span>Amount Paid</span>
            <span>${formatCurrency(amountPaid)}</span>
          </div>
          <div class="total-row total-due">
            <span>Balance Due</span>
            <span>${formatCurrency(balanceDue)}</span>
          </div>
        ` : ''}
      </div>

      ${invoice.notes ? `
        <div class="invoice-notes">
          <h4 class="section-title">Notes</h4>
          <p>${SanitizationUtils.escapeHtml(invoice.notes)}</p>
        </div>
      ` : ''}

      ${invoice.terms ? `
        <div class="invoice-terms">
          <h4 class="section-title">Terms</h4>
          <p>${SanitizationUtils.escapeHtml(invoice.terms)}</p>
        </div>
      ` : ''}
    </div>
  `;

  // Add footer buttons
  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-primary';
  downloadBtn.textContent = 'Download PDF';
  downloadBtn.addEventListener('click', () => handleDownloadPdf(invoiceId));

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-secondary';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    if (cleanupFocusTrap) cleanupFocusTrap();
    modal.hide();
    modal.overlay.remove();
  });

  modal.footer.appendChild(closeBtn);
  modal.footer.appendChild(downloadBtn);

  // Add to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();

  // Setup focus trap
  cleanupFocusTrap = manageFocusTrap(modal.overlay, {
    initialFocus: closeBtn,
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });
}

// ============================================
// EDIT INVOICE MODAL
// ============================================

/**
 * Show edit invoice modal (draft invoices only)
 */
async function showEditInvoiceModal(invoiceId: number, ctx: AdminDashboardContext): Promise<void> {
  // Find invoice in cache or fetch from API
  let invoice = invoicesModule.findById(invoiceId);

  if (!invoice) {
    try {
      const response = await apiFetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) {
        showToast('Failed to load invoice', 'error');
        return;
      }
      invoice = await response.json();
    } catch (error) {
      console.error('[AdminInvoices] Edit invoice error:', error);
      showToast('Failed to load invoice', 'error');
      return;
    }
  }

  if (!invoice) return;

  // Only allow editing draft invoices
  if (invoice.status !== 'draft') {
    showToast('Only draft invoices can be edited', 'warning');
    return;
  }

  let cleanupFocusTrap: (() => void) | null = null;
  let lineItemIndex = 0;

  const modal = createPortalModal({
    id: 'edit-invoice-modal',
    titleId: 'edit-invoice-title',
    title: `Edit Invoice ${SanitizationUtils.escapeHtml(invoice.invoice_number || `#${invoice.id}`)}`,
    icon: GLOBAL_ICONS.PENCIL,
    contentClassName: 'invoice-modal-content invoice-edit-modal',
    onClose: () => {
      if (cleanupFocusTrap) cleanupFocusTrap();
      modal.hide();
      modal.overlay.remove();
    }
  });

  // Get line items
  const lineItems = invoice.line_items || [];

  // Build line item rows HTML
  function buildLineItemRow(item: InvoiceLineItem, index: number): string {
    return `
      <tr class="line-item-row" data-index="${index}">
        <td data-label="Description">
          <input type="text" class="form-input line-item-desc" name="line_items[${index}][description]"
            value="${SanitizationUtils.escapeHtml(item.description || '')}" placeholder="Description" required>
        </td>
        <td data-label="Qty">
          <input type="number" class="form-input line-item-qty" name="line_items[${index}][quantity]"
            value="${item.quantity || 1}" min="1" step="1" required>
        </td>
        <td data-label="Rate">
          <input type="number" class="form-input line-item-rate" name="line_items[${index}][rate]"
            value="${item.rate || 0}" min="0" step="0.01" required>
        </td>
        <td class="line-item-amount" data-label="Amount">${formatCurrency(item.amount || 0)}</td>
        <td data-label="">
          <button type="button" class="icon-btn remove-line-item" data-index="${index}" title="Remove">${GLOBAL_ICONS.X}</button>
        </td>
      </tr>
    `;
  }

  // Build modal body form
  modal.body.innerHTML = `
    <form id="edit-invoice-form" class="invoice-edit-form flex flex-col gap-4">
      <div class="form-row">
        <div class="form-group">
          <label class="field-label" for="invoice-due-date">Due Date</label>
          <input type="date" id="invoice-due-date" name="due_date" class="form-input"
            value="${invoice.due_date ? invoice.due_date.split('T')[0] : ''}">
        </div>
      </div>

      <div class="form-group">
        <label class="field-label">Line Items</label>
        <div class="data-table-scroll-wrapper">
          <table class="data-table invoice-line-items editable">
            <thead>
              <tr>
                <th scope="col" class="name-col">Description</th>
                <th scope="col" class="count-col">Qty</th>
                <th scope="col" class="amount-col">Rate</th>
                <th scope="col" class="amount-col">Amount</th>
                <th scope="col" class="actions-col"></th>
              </tr>
            </thead>
            <tbody id="line-items-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              ${lineItems.map((item, idx) => {
    lineItemIndex = idx + 1;
    return buildLineItemRow(item, idx);
  }).join('')}
            </tbody>
          </table>
        </div>
        <button type="button" id="add-line-item" class="btn btn-secondary btn-sm">
          Add Line Item
        </button>
      </div>

      <div class="invoice-totals-edit">
        <div class="total-row total-main">
          <span>Total</span>
          <span id="invoice-total">${formatCurrency(getAmount(invoice))}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="field-label" for="invoice-notes">Notes</label>
        <textarea id="invoice-notes" name="notes" class="form-input" rows="3"
          placeholder="Notes to client (optional)">${SanitizationUtils.escapeHtml(invoice.notes || '')}</textarea>
      </div>

      <div class="form-group">
        <label class="field-label" for="invoice-terms">Terms</label>
        <textarea id="invoice-terms" name="terms" class="form-input" rows="2"
          placeholder="Payment terms (optional)">${SanitizationUtils.escapeHtml(invoice.terms || '')}</textarea>
      </div>
    </form>
  `;

  // Calculate and update total
  function recalculateTotal(): void {
    const rows = modal.body.querySelectorAll('.line-item-row');
    let total = 0;

    rows.forEach((row) => {
      const qty = parseFloat((row.querySelector('.line-item-qty') as HTMLInputElement)?.value) || 0;
      const rate = parseFloat((row.querySelector('.line-item-rate') as HTMLInputElement)?.value) || 0;
      const amount = qty * rate;
      total += amount;

      const amountCell = row.querySelector('.line-item-amount');
      if (amountCell) amountCell.textContent = formatCurrency(amount);
    });

    const totalEl = document.getElementById('invoice-total');
    if (totalEl) totalEl.textContent = formatCurrency(total);
  }

  // Add line item
  function addLineItem(): void {
    const tbody = document.getElementById('line-items-body');
    if (!tbody) return;

    const _newItem: InvoiceLineItem = { description: '', quantity: 1, rate: 0, amount: 0 };
    const row = document.createElement('tr');
    row.className = 'line-item-row';
    row.dataset.index = String(lineItemIndex);
    row.innerHTML = `
      <td data-label="Description">
        <input type="text" class="form-input line-item-desc" name="line_items[${lineItemIndex}][description]"
          value="" placeholder="Description" required>
      </td>
      <td data-label="Qty">
        <input type="number" class="form-input line-item-qty" name="line_items[${lineItemIndex}][quantity]"
          value="1" min="1" step="1" required>
      </td>
      <td data-label="Rate">
        <input type="number" class="form-input line-item-rate" name="line_items[${lineItemIndex}][rate]"
          value="0" min="0" step="0.01" required>
      </td>
      <td class="line-item-amount" data-label="Amount">${formatCurrency(0)}</td>
      <td data-label="">
        <button type="button" class="icon-btn remove-line-item" data-index="${lineItemIndex}" title="Remove">${GLOBAL_ICONS.X}</button>
      </td>
    `;
    tbody.appendChild(row);
    lineItemIndex++;

    // Focus the description field
    const descInput = row.querySelector('.line-item-desc') as HTMLInputElement;
    descInput?.focus();
  }

  // Setup event listeners after DOM is ready
  setTimeout(() => {
    // Add line item button
    const addBtn = document.getElementById('add-line-item');
    addBtn?.addEventListener('click', addLineItem);

    // Delegate events for line items
    modal.body.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('line-item-qty') || target.classList.contains('line-item-rate')) {
        recalculateTotal();
      }
    });

    // Remove line item
    modal.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const removeBtn = target.closest('.remove-line-item') as HTMLElement;
      if (removeBtn) {
        const row = removeBtn.closest('.line-item-row');
        row?.remove();
        recalculateTotal();
      }
    });
  }, 0);

  // Add footer buttons
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Save Changes';
  saveBtn.addEventListener('click', async () => {
    const form = document.getElementById('edit-invoice-form') as HTMLFormElement;
    if (!form?.checkValidity()) {
      form?.reportValidity();
      return;
    }

    await withButtonLoading(saveBtn, async () => {
      // Collect form data
      const dueDate = (document.getElementById('invoice-due-date') as HTMLInputElement)?.value;
      const notes = (document.getElementById('invoice-notes') as HTMLTextAreaElement)?.value;
      const terms = (document.getElementById('invoice-terms') as HTMLTextAreaElement)?.value;

      // Collect line items
      const rows = modal.body.querySelectorAll('.line-item-row');
      const newLineItems: InvoiceLineItem[] = [];

      rows.forEach((row) => {
        const desc = (row.querySelector('.line-item-desc') as HTMLInputElement)?.value || '';
        const qty = parseFloat((row.querySelector('.line-item-qty') as HTMLInputElement)?.value) || 1;
        const rate = parseFloat((row.querySelector('.line-item-rate') as HTMLInputElement)?.value) || 0;
        const amount = qty * rate;

        if (desc.trim()) {
          newLineItems.push({ description: desc, quantity: qty, rate, amount });
        }
      });

      // Calculate new total
      const newTotal = newLineItems.reduce((sum, item) => sum + item.amount, 0);

      try {
        const response = await apiPut(`/api/invoices/${invoiceId}`, {
          due_date: dueDate || null,
          notes: notes || null,
          terms: terms || null,
          line_items: newLineItems,
          amount_total: newTotal
        });

        if (response.ok) {
          showToast('Invoice updated successfully', 'success');
          if (cleanupFocusTrap) cleanupFocusTrap();
          modal.hide();
          modal.overlay.remove();
          invoicesModule.load(ctx);
        } else {
          const error = await response.json();
          showToast(error.error || 'Failed to update invoice', 'error');
        }
      } catch (error) {
        console.error('[AdminInvoices] Update error:', error);
        showToast('Failed to update invoice', 'error');
      }
    }, 'Saving...');
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    if (cleanupFocusTrap) cleanupFocusTrap();
    modal.hide();
    modal.overlay.remove();
  });

  modal.footer.appendChild(cancelBtn);
  modal.footer.appendChild(saveBtn);

  // Add to DOM and show
  document.body.appendChild(modal.overlay);
  modal.show();

  // Setup focus trap
  cleanupFocusTrap = manageFocusTrap(modal.overlay, {
    initialFocus: '#invoice-due-date',
    onClose: () => {
      modal.hide();
      modal.overlay.remove();
    }
  });
}
