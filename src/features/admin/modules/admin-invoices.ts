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
import { apiFetch } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { showTableError } from '../../../utils/error-utils';
import { getStatusBadgeHTML } from '../../../components/status-badge';
import { getPortalCheckboxHTML } from '../../../components/portal-checkbox';

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

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Load invoices data
 */
export async function loadInvoicesData(ctx: AdminDashboardContext): Promise<void> {
  const tableBody = document.getElementById('invoices-table-body');
  if (!tableBody) return;

  showTableLoading(tableBody, 7, 'Loading invoices...');

  try {
    const response = await apiFetch('/api/invoices');
    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }

    const invoices: InvoiceWithDetails[] = await response.json();
    cachedInvoices = invoices;

    // Update stats
    updateInvoiceStats(invoices);

    // Render table
    renderInvoicesTable(invoices, tableBody);

    // Set up event handlers
    setupInvoiceHandlers(ctx);

  } catch (error) {
    console.error('[AdminInvoices] Error loading invoices:', error);
    showTableError(tableBody, 7, 'Failed to load invoices');
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
 * Render invoices table
 */
function renderInvoicesTable(invoices: InvoiceWithDetails[], tableBody: HTMLElement): void {
  if (invoices.length === 0) {
    showTableEmpty(tableBody, 7, 'No invoices found');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tableBody.innerHTML = invoices.map((invoice) => {
    const safeInvoiceNumber = SanitizationUtils.escapeHtml(invoice.invoice_number || `INV-${invoice.id}`);
    const safeClientName = SanitizationUtils.escapeHtml(invoice.client_name || 'Unknown Client');
    const safeProjectName = SanitizationUtils.escapeHtml(invoice.project_name || '-');
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

    return `
      <tr data-invoice-id="${invoice.id}">
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
}

/**
 * Set up invoice action handlers
 */
function setupInvoiceHandlers(ctx: AdminDashboardContext): void {
  const tableBody = document.getElementById('invoices-table-body');
  if (!tableBody) return;

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

  // Refresh button
  const refreshBtn = document.getElementById('refresh-invoices-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadInvoicesData(ctx);
    });
  }

  // Export button
  const exportBtn = document.getElementById('export-invoices-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportInvoicesToCsv();
    });
  }
}

/**
 * Export invoices to CSV
 */
function exportInvoicesToCsv(): void {
  if (cachedInvoices.length === 0) {
    return;
  }

  const headers = ['Invoice #', 'Client', 'Project', 'Amount', 'Status', 'Due Date', 'Created'];
  const rows = cachedInvoices.map((inv) => [
    inv.invoice_number || `INV-${inv.id}`,
    inv.client_name || '',
    inv.project_name || '',
    getAmount(inv).toString(),
    inv.status || '',
    inv.due_date || '',
    inv.created_at || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
