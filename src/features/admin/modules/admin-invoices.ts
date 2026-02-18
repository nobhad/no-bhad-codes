/**
 * ===============================================
 * ADMIN INVOICES MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-invoices.ts
 *
 * Invoice management functionality for admin dashboard.
 * Dynamically imported for code splitting.
 */

import { SanitizationUtils } from '../../../utils/sanitization-utils';
import type { AdminDashboardContext } from '../admin-types';
import type { InvoiceResponse, InvoiceLineItem } from '../../../types/api';
import { formatCurrency, formatDate } from '../../../utils/format-utils';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { getStatusDotHTML } from '../../../components/status-badge';
import { getPortalCheckboxHTML } from '../../../components/portal-checkbox';
import { exportToCsv, INVOICES_EXPORT_CONFIG } from '../../../utils/table-export';
import { createBulkActionToolbar, setupBulkSelectionHandlers, type BulkActionConfig } from '../../../utils/table-bulk-actions';
import { showToast } from '../../../utils/toast-notifications';
import { createPortalModal } from '../../../components/portal-modal';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { withButtonLoading } from '../../../utils/button-loading';
import {
  createFilterUI,
  createSortableHeaders,
  applyFilters,
  loadFilterState,
  saveFilterState,
  INVOICES_FILTER_CONFIG,
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
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { makeEditable } from '../../../components/inline-edit';

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
// STATE
// ============================================

let cachedInvoices: InvoiceWithDetails[] = [];
let storedContext: AdminDashboardContext | null = null;
let filterUIInitialized = false;

// Filter state
let filterState: FilterState = loadFilterState(INVOICES_FILTER_CONFIG.storageKey);

// Pagination configuration and state
const INVOICES_PAGINATION_CONFIG: PaginationConfig = {
  tableId: 'invoices',
  pageSizeOptions: [10, 25, 50, 100],
  defaultPageSize: 25,
  storageKey: 'admin_invoices_pagination'
};

let paginationState: PaginationState = {
  ...getDefaultPaginationState(INVOICES_PAGINATION_CONFIG),
  ...loadPaginationState(INVOICES_PAGINATION_CONFIG.storageKey!)
};

// Bulk action configuration for invoices table
const INVOICES_BULK_CONFIG: BulkActionConfig = {
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
        if (storedContext) loadInvoicesData(storedContext);
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
        if (storedContext) loadInvoicesData(storedContext);
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
        if (storedContext) loadInvoicesData(storedContext);
      },
      confirmMessage: 'Delete selected invoices? This cannot be undone.'
    }
  ]
};

// ============================================
// SVG ICONS FOR DYNAMIC RENDERING
// ============================================

const RENDER_ICONS = {
  EXPORT: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  REFRESH: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  PLUS: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>'
};

// ============================================
// DYNAMIC TAB RENDERING
// ============================================

/**
 * Renders the Invoices tab structure dynamically.
 * Called by admin-dashboard before loading data.
 */
export function renderInvoicesTab(container: HTMLElement): void {
  container.innerHTML = `
    <!-- Invoice Stats -->
    <div class="quick-stats">
      <button class="stat-card stat-card-clickable portal-shadow" data-filter="all" data-table="invoices">
        <span class="stat-number" id="invoices-total">-</span>
        <span class="stat-label">Total Invoices</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-filter="pending" data-table="invoices">
        <span class="stat-number" id="invoices-pending">-</span>
        <span class="stat-label">Pending</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-filter="paid" data-table="invoices">
        <span class="stat-number" id="invoices-paid">-</span>
        <span class="stat-label">Paid</span>
      </button>
      <button class="stat-card stat-card-clickable portal-shadow" data-filter="overdue" data-table="invoices">
        <span class="stat-number" id="invoices-overdue">-</span>
        <span class="stat-label">Overdue</span>
      </button>
    </div>

    <!-- Invoices Table -->
    <div class="admin-table-card" id="invoices-table-card">
      <div class="admin-table-header">
        <h3><span class="title-full">All Invoices</span><span class="title-mobile">Invoices</span></h3>
        <div class="admin-table-actions" id="invoices-filter-container">
          <button class="icon-btn" id="export-invoices-btn" title="Export to CSV" aria-label="Export invoices to CSV">
            <span class="icon-btn-svg">${RENDER_ICONS.EXPORT}</span>
          </button>
          <button class="icon-btn" id="refresh-invoices-btn" title="Refresh" aria-label="Refresh invoices">
            <span class="icon-btn-svg">${RENDER_ICONS.REFRESH}</span>
          </button>
          <button class="icon-btn" id="create-invoice-btn" title="Add Invoice" aria-label="Add new invoice">
            <span class="icon-btn-svg">${RENDER_ICONS.PLUS}</span>
          </button>
        </div>
      </div>
      <!-- Bulk Action Toolbar (hidden initially) -->
      <div id="invoices-bulk-toolbar" class="bulk-action-toolbar hidden"></div>
      <div class="admin-table-container invoices-table-container">
        <div class="admin-table-scroll-wrapper">
          <table class="admin-table invoices-table">
            <thead>
              <tr>
                <th scope="col" class="bulk-select-cell">
                  <div class="portal-checkbox">
                    <input type="checkbox" id="invoices-select-all" class="bulk-select-all" aria-label="Select all invoices" />
                  </div>
                </th>
                <th scope="col">Invoice #</th>
                <th scope="col" class="contact-col">Client</th>
                <th scope="col">Project</th>
                <th scope="col" class="budget-col">Amount</th>
                <th scope="col" class="status-col">Status</th>
                <th scope="col" class="date-col">Due Date</th>
                <th scope="col" class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody id="invoices-table-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
              <tr>
                <td colspan="8" class="loading-row">Loading invoices...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <!-- Pagination -->
      <div id="invoices-pagination" class="table-pagination"></div>
    </div>
  `;

  // Reset filter UI initialization flag so it gets re-initialized
  filterUIInitialized = false;
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Load invoices data
 */
export async function loadInvoicesData(ctx: AdminDashboardContext): Promise<void> {
  storedContext = ctx;

  const tableBody = document.getElementById('invoices-table-body');
  if (!tableBody) return;

  // Initialize filter UI once
  if (!filterUIInitialized) {
    initializeFilterUI(ctx);
    filterUIInitialized = true;
  }

  showTableLoading(tableBody, 8, 'Loading invoices...');

  try {
    const response = await apiFetch('/api/invoices');
    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }

    const invoices: InvoiceWithDetails[] = await response.json();
    cachedInvoices = invoices;

    // Update stats
    updateInvoiceStats(invoices);

    // Render table with filters and pagination
    renderInvoicesTable(ctx);

    // Set up event handlers
    setupInvoiceHandlers(ctx);

  } catch (error) {
    console.error('[AdminInvoices] Error loading invoices:', error);
    showTableError(tableBody, 8, 'Failed to load invoices');
  }
}

/**
 * Initialize filter UI for invoices table
 */
function initializeFilterUI(ctx: AdminDashboardContext): void {
  const container = document.getElementById('invoices-filter-container');
  if (!container) return;

  // Create filter UI
  const filterUI = createFilterUI(
    INVOICES_FILTER_CONFIG,
    filterState,
    (newState) => {
      filterState = newState;
      paginationState.currentPage = 1; // Reset to page 1 on filter change
      renderInvoicesTable(ctx);
    }
  );

  // Insert before the first button (Create Invoice)
  const firstBtn = container.querySelector('button');
  if (firstBtn) {
    container.insertBefore(filterUI, firstBtn);
  } else {
    container.appendChild(filterUI);
  }

  // Setup sortable headers after table is rendered
  setTimeout(() => {
    createSortableHeaders(INVOICES_FILTER_CONFIG, filterState, (column, direction) => {
      filterState = { ...filterState, sortColumn: column, sortDirection: direction };
      saveFilterState(INVOICES_FILTER_CONFIG.storageKey, filterState);
      renderInvoicesTable(ctx);
    });
  }, 100);

  // Initialize bulk action toolbar
  const bulkToolbarEl = document.getElementById('invoices-bulk-toolbar');
  if (bulkToolbarEl) {
    const toolbar = createBulkActionToolbar({
      ...INVOICES_BULK_CONFIG,
      onSelectionChange: () => {}
    });
    bulkToolbarEl.replaceWith(toolbar);
  }

  // Refresh button
  const refreshBtn = document.getElementById('refresh-invoices-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadInvoicesData(ctx);
    });
  }

  // Export button — use shared utility with filtered data
  const exportBtn = document.getElementById('export-invoices-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const filtered = applyFilters(cachedInvoices, filterState, INVOICES_FILTER_CONFIG);
      exportToCsv(filtered as unknown as Record<string, unknown>[], INVOICES_EXPORT_CONFIG);
    });
  }
}

/**
 * Update invoice statistics
 */
function updateInvoiceStats(invoices: InvoiceWithDetails[]): void {
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
      // Check if overdue
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

  // Update DOM
  const totalEl = document.getElementById('invoices-total');
  const pendingEl = document.getElementById('invoices-pending');
  const paidEl = document.getElementById('invoices-paid');
  const overdueEl = document.getElementById('invoices-overdue');

  if (totalEl) totalEl.textContent = stats.total.toLocaleString();
  if (pendingEl) pendingEl.textContent = stats.pending.toLocaleString();
  if (paidEl) paidEl.textContent = stats.paid.toLocaleString();
  if (overdueEl) overdueEl.textContent = stats.overdue.toLocaleString();
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

// Icon SVGs for action buttons
const ICONS = {
  VIEW: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  EDIT: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  SEND: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  CHECK: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  DOWNLOAD: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>'
};

/**
 * Build contextual action buttons based on invoice status
 */
function buildActionButtons(invoiceId: number, status: string): string {
  const buttons: string[] = [];

  // View button - always shown
  buttons.push(`<button class="icon-btn" data-action="view" data-id="${invoiceId}" title="View Invoice" aria-label="View invoice">${ICONS.VIEW}</button>`);

  // Status-specific buttons
  if (status === 'draft') {
    // Draft: Send, Edit
    buttons.push(`<button class="icon-btn" data-action="send" data-id="${invoiceId}" title="Send Invoice" aria-label="Send invoice">${ICONS.SEND}</button>`);
    buttons.push(`<button class="icon-btn" data-action="edit" data-id="${invoiceId}" title="Edit Invoice" aria-label="Edit invoice">${ICONS.EDIT}</button>`);
  } else if (status === 'sent' || status === 'pending' || status === 'viewed' || status === 'overdue') {
    // Sent/Pending/Viewed/Overdue: Mark Paid, Download
    buttons.push(`<button class="icon-btn" data-action="mark-paid" data-id="${invoiceId}" title="Mark as Paid" aria-label="Mark as paid">${ICONS.CHECK}</button>`);
    buttons.push(`<button class="icon-btn" data-action="download" data-id="${invoiceId}" title="Download PDF" aria-label="Download PDF">${ICONS.DOWNLOAD}</button>`);
  } else if (status === 'paid') {
    // Paid: Download only
    buttons.push(`<button class="icon-btn" data-action="download" data-id="${invoiceId}" title="Download PDF" aria-label="Download PDF">${ICONS.DOWNLOAD}</button>`);
  }

  return buttons.join('');
}

/**
 * Render invoices table with filters and pagination
 */
function renderInvoicesTable(ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('invoices-table-body');
  if (!tableBody) return;

  // Apply filters
  const filteredInvoices = applyFilters(cachedInvoices, filterState, INVOICES_FILTER_CONFIG);

  if (filteredInvoices.length === 0) {
    const message = cachedInvoices.length === 0
      ? 'No invoices yet.'
      : 'No invoices match the current filters.';
    showTableEmpty(tableBody, 8, message);
    renderPaginationUI(0, ctx);
    return;
  }

  // Apply pagination
  paginationState.totalItems = filteredInvoices.length;
  const paginatedInvoices = applyPagination(filteredInvoices, paginationState);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tableBody.innerHTML = paginatedInvoices.map((invoice) => {
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
    const checkboxHTML = getPortalCheckboxHTML({ id: `invoice-${invoice.id}`, checked: false, ariaLabel: `Select invoice ${safeInvoiceNumber}` });

    // Build contextual action buttons based on status
    const actionButtons = buildActionButtons(invoice.id, status);

    return `
      <tr data-invoice-id="${invoice.id}">
        <td class="bulk-select-cell">${checkboxHTML}</td>
        <td><strong>${safeInvoiceNumber}</strong></td>
        <td class="contact-cell">${safeClientName}</td>
        <td>${safeProjectName}</td>
        <td class="budget-cell">${amount}</td>
        <td class="status-cell">
          ${statusIndicator}
          <span class="date-stacked">${dueDate}</span>
        </td>
        <td class="date-cell inline-editable-cell" data-invoice-id="${invoice.id}" data-field="due_date">
          <span class="due-date-value">${dueDate}</span>
        </td>
        <td class="actions-cell">
          <div class="table-actions">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Setup inline editing for due_date cells
  tableBody.querySelectorAll('.date-cell.inline-editable-cell').forEach((cell) => {
    const cellEl = cell as HTMLElement;
    const invoiceId = parseInt(cellEl.dataset.invoiceId || '0');
    const invoice = paginatedInvoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    makeEditable(
      cellEl,
      () => invoice.due_date ? invoice.due_date.split('T')[0] : '',
      async (newValue) => {
        const response = await apiPut(`/api/invoices/${invoiceId}`, { due_date: newValue || null });
        if (response.ok) {
          // Update the cached value (use empty string as fallback for type safety)
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

  // Wire bulk selection handlers for current rows
  const allRowIds = paginatedInvoices.map(inv => inv.id);
  const bulkConfig: BulkActionConfig = { tableId: 'invoices', actions: [] };
  setupBulkSelectionHandlers(bulkConfig, allRowIds);

  // Render pagination
  renderPaginationUI(filteredInvoices.length, ctx);

  // Initialize keyboard navigation (J/K to move, Enter to view)
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

/**
 * Render pagination UI
 */
function renderPaginationUI(totalItems: number, ctx: AdminDashboardContext): void {
  const container = document.getElementById('invoices-pagination');
  if (!container) return;

  if (totalItems === 0) {
    container.innerHTML = '';
    return;
  }

  paginationState.totalItems = totalItems;

  const paginationUI = createPaginationUI(
    INVOICES_PAGINATION_CONFIG,
    paginationState,
    (newState) => {
      paginationState = newState;
      savePaginationState(INVOICES_PAGINATION_CONFIG.storageKey!, newState);
      renderInvoicesTable(ctx);
    }
  );

  container.innerHTML = '';
  container.appendChild(paginationUI);
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
      loadInvoicesData(ctx);
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
      loadInvoicesData(ctx);
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
  let invoice = cachedInvoices.find(inv => inv.id === invoiceId);

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
    ? `<table class="invoice-line-items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map((item: InvoiceLineItem) => `
            <tr>
              <td>${SanitizationUtils.escapeHtml(item.description || '')}</td>
              <td class="text-right">${item.quantity || 1}</td>
              <td class="text-right">${formatCurrency(item.rate || 0)}</td>
              <td class="text-right">${formatCurrency(item.amount || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
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
    <div class="invoice-view-content">
      <div class="invoice-header-info">
        <div class="invoice-info-row">
          <div class="invoice-info-item">
            <span class="field-label">Client</span>
            <span class="field-value">${SanitizationUtils.escapeHtml(invoice.client_name || 'Unknown')}</span>
          </div>
          <div class="invoice-info-item">
            <span class="field-label">Project</span>
            <span class="field-value">${SanitizationUtils.escapeHtml(invoice.project_name || '-')}</span>
          </div>
        </div>
        <div class="invoice-info-row">
          <div class="invoice-info-item">
            <span class="field-label">Status</span>
            <span class="field-value">${getStatusDotHTML(invoice.status || 'pending')}</span>
          </div>
          <div class="invoice-info-item">
            <span class="field-label">Due Date</span>
            <span class="field-value">${invoice.due_date ? formatDate(invoice.due_date) : '-'}</span>
          </div>
        </div>
        <div class="invoice-info-row">
          <div class="invoice-info-item">
            <span class="field-label">Created</span>
            <span class="field-value">${invoice.created_at ? formatDate(invoice.created_at) : '-'}</span>
          </div>
          ${invoice.paid_date ? `
            <div class="invoice-info-item">
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
  let invoice = cachedInvoices.find(inv => inv.id === invoiceId);

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
        <td>
          <input type="text" class="form-input line-item-desc" name="line_items[${index}][description]"
            value="${SanitizationUtils.escapeHtml(item.description || '')}" placeholder="Description" required>
        </td>
        <td>
          <input type="number" class="form-input line-item-qty" name="line_items[${index}][quantity]"
            value="${item.quantity || 1}" min="1" step="1" required>
        </td>
        <td>
          <input type="number" class="form-input line-item-rate" name="line_items[${index}][rate]"
            value="${item.rate || 0}" min="0" step="0.01" required>
        </td>
        <td class="line-item-amount">${formatCurrency(item.amount || 0)}</td>
        <td>
          <button type="button" class="icon-btn btn-danger remove-line-item" data-index="${index}" title="Remove">
            ${ICONS.VIEW.replace('M1 12s4-8 11-8', 'M18 6 6 18M6 6l12 12').replace('circle cx="12" cy="12" r="3"', '')}
          </button>
        </td>
      </tr>
    `;
  }

  // Build modal body form
  modal.body.innerHTML = `
    <form id="edit-invoice-form" class="invoice-edit-form">
      <div class="form-row">
        <div class="form-group">
          <label class="field-label" for="invoice-due-date">Due Date</label>
          <input type="date" id="invoice-due-date" name="due_date" class="form-input"
            value="${invoice.due_date ? invoice.due_date.split('T')[0] : ''}">
        </div>
      </div>

      <div class="form-group">
        <label class="field-label">Line Items</label>
        <table class="invoice-line-items editable">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right" style="width: 80px;">Qty</th>
              <th class="text-right" style="width: 100px;">Rate</th>
              <th class="text-right" style="width: 100px;">Amount</th>
              <th style="width: 50px;"></th>
            </tr>
          </thead>
          <tbody id="line-items-body">
            ${lineItems.map((item, idx) => {
    lineItemIndex = idx + 1;
    return buildLineItemRow(item, idx);
  }).join('')}
          </tbody>
        </table>
        <button type="button" id="add-line-item" class="btn-secondary btn-small">
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
      <td>
        <input type="text" class="form-input line-item-desc" name="line_items[${lineItemIndex}][description]"
          value="" placeholder="Description" required>
      </td>
      <td>
        <input type="number" class="form-input line-item-qty" name="line_items[${lineItemIndex}][quantity]"
          value="1" min="1" step="1" required>
      </td>
      <td>
        <input type="number" class="form-input line-item-rate" name="line_items[${lineItemIndex}][rate]"
          value="0" min="0" step="0.01" required>
      </td>
      <td class="line-item-amount">${formatCurrency(0)}</td>
      <td>
        <button type="button" class="icon-btn btn-danger remove-line-item" data-index="${lineItemIndex}" title="Remove">
          ${ICONS.VIEW.replace('M1 12s4-8 11-8', 'M18 6 6 18M6 6l12 12').replace('circle cx="12" cy="12" r="3"', '')}
        </button>
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
          loadInvoicesData(ctx);
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
