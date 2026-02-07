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
import type { InvoiceResponse } from '../../../types/api';
import { formatCurrency, formatDate } from '../../../utils/format-utils';
import { apiFetch, apiPost, apiPut, apiDelete } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { getStatusDotHTML } from '../../../components/status-badge';
import { getPortalCheckboxHTML } from '../../../components/portal-checkbox';
import { exportToCsv, INVOICES_EXPORT_CONFIG } from '../../../utils/table-export';
import { createBulkActionToolbar, setupBulkSelectionHandlers, type BulkActionConfig } from '../../../utils/table-bulk-actions';
import { showToast } from '../../../utils/toast-notifications';
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
    const safeClientName = SanitizationUtils.escapeHtml(invoice.client_name || 'Unknown Client');
    const safeProjectName = SanitizationUtils.escapeHtml(invoice.project_name || '');
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
        <td class="status-cell">${statusIndicator}</td>
        <td class="date-cell">${dueDate}</td>
        <td class="actions-cell">
          <div class="table-actions">
            ${actionButtons}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Wire bulk selection handlers for current rows
  const allRowIds = paginatedInvoices.map(inv => inv.id);
  const bulkConfig: BulkActionConfig = { tableId: 'invoices', actions: [] };
  setupBulkSelectionHandlers(bulkConfig, allRowIds);

  // Render pagination
  renderPaginationUI(filteredInvoices.length, ctx);
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
      // TODO: Implement view invoice modal
      ctx.showNotification('View invoice coming soon', 'info');
      break;
    case 'edit':
      // TODO: Implement edit invoice modal
      ctx.showNotification('Edit invoice coming soon', 'info');
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
