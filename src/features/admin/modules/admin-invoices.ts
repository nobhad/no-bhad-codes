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
import { getStatusBadgeHTML } from '../../../components/status-badge';
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

    const statusBadge = getStatusBadgeHTML(status);
    const checkboxHTML = getPortalCheckboxHTML({ id: `invoice-${invoice.id}`, checked: false, ariaLabel: `Select invoice ${safeInvoiceNumber}` });

    return `
      <tr data-invoice-id="${invoice.id}">
        <td class="bulk-select-cell">${checkboxHTML}</td>
        <td><strong>${safeInvoiceNumber}</strong></td>
        <td>${safeClientName}</td>
        <td>${safeProjectName}</td>
        <td>${amount}</td>
        <td>${statusBadge}</td>
        <td>${dueDate}</td>
        <td>
          <div class="table-actions">
            <button class="icon-btn" data-action="view" data-id="${invoice.id}" title="View Invoice" aria-label="View invoice">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="icon-btn" data-action="edit" data-id="${invoice.id}" title="Edit Invoice" aria-label="Edit invoice">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
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

    if (action === 'view' && invoiceId) {
      // TODO: Implement view invoice
      ctx.showNotification('View invoice coming soon', 'info');
    } else if (action === 'edit' && invoiceId) {
      // TODO: Implement edit invoice
      ctx.showNotification('Edit invoice coming soon', 'info');
    }
  });
}
