/**
 * ===============================================
 * PORTAL INVOICES MODULE
 * ===============================================
 * @file src/features/client/modules/portal-invoices.ts
 *
 * Invoice management functionality for client portal.
 * Dynamically imported for code splitting.
 */

import type { PortalInvoice, ClientPortalContext } from '../portal-types';
import { formatCurrency } from '../../../utils/format-utils';
import { getContainerLoadingHTML } from '../../../utils/loading-utils';
import { showToast } from '../../../utils/toast-notifications';
import { ICONS } from '../../../constants/icons';
import { getStatusBadgeHTML } from '../../../components/status-badge';
import { createEmptyState, createErrorState } from '../../../components/empty-state';
import { initTableKeyboardNav } from '../../../components/table-keyboard-nav';
import { getReactComponent } from '../../../react/registry';

const INVOICES_API_BASE = '/api/invoices';

// Track React unmount function
let reactUnmountFn: (() => void) | null = null;

/**
 * Check if React portal invoices should be used
 */
function shouldUseReactPortalInvoices(): boolean {
  const component = getReactComponent('portalInvoices');
  if (!component) return false;

  // Check URL parameter for vanilla fallback
  const params = new URLSearchParams(window.location.search);
  if (params.get('vanilla_portal_invoices') === 'true') return false;

  // Check localStorage flag
  const flag = localStorage.getItem('feature_react_portal_invoices');
  if (flag === 'false') return false;

  // Default: enabled
  return true;
}

/**
 * Cleanup React portal invoices
 */
export function cleanupPortalInvoices(): void {
  if (reactUnmountFn) {
    reactUnmountFn();
    reactUnmountFn = null;
  }
}

/**
 * Load invoices from API and render the list
 */
export async function loadInvoices(ctx: ClientPortalContext): Promise<void> {
  const invoicesContainer = document.querySelector('.invoices-list');
  const summaryOutstanding = document.querySelector('.summary-card:first-child .summary-value');
  const summaryPaid = document.querySelector('.summary-card:last-child .summary-value');

  if (!invoicesContainer) return;

  // Check if React component should be used
  if (shouldUseReactPortalInvoices()) {
    const component = getReactComponent('portalInvoices');
    if (component) {
      // Hide vanilla summary cards - React renders its own
      const summaryContainer = document.querySelector('.invoices-summary');
      if (summaryContainer) {
        (summaryContainer as HTMLElement).style.display = 'none';
      }

      // Mount React component
      const unmountResult = component.mount(invoicesContainer as HTMLElement, {
        getAuthToken: ctx.getAuthToken,
        showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
          showToast(message, type);
        }
      });

      if (typeof unmountResult === 'function') {
        reactUnmountFn = unmountResult;
      }

      return;
    }
  }

  // Vanilla implementation below

  // Show loading state - remove existing table or items
  const existingTable = invoicesContainer.querySelector('.data-table');
  if (existingTable) existingTable.remove();
  const noInvoicesMsg = invoicesContainer.querySelector('.no-invoices-message');
  if (noInvoicesMsg) noInvoicesMsg.remove();

  const loadingEl = document.createElement('div');
  loadingEl.className = 'invoices-loading';
  loadingEl.innerHTML = getContainerLoadingHTML('Loading invoices...');
  invoicesContainer.appendChild(loadingEl);

  try {
    const response = await fetch(`${INVOICES_API_BASE}/me`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }

    const data = await response.json();

    // Remove loading indicator
    const loading = invoicesContainer.querySelector('.invoices-loading');
    if (loading) loading.remove();

    if (summaryOutstanding && data.summary) {
      summaryOutstanding.textContent = formatCurrency(data.summary.totalOutstanding);
    }
    if (summaryPaid && data.summary) {
      summaryPaid.textContent = formatCurrency(data.summary.totalPaid);
    }

    renderInvoicesList(invoicesContainer as HTMLElement, data.invoices || [], ctx);
  } catch (error) {
    // Remove loading indicator on error
    const loading = invoicesContainer.querySelector('.invoices-loading');
    if (loading) loading.remove();
    console.error('Error loading invoices:', error);
    if (summaryOutstanding) summaryOutstanding.textContent = '$0.00';
    if (summaryPaid) summaryPaid.textContent = '$0.00';
    const errorState = createErrorState('Unable to load invoices. Please try again later.', {
      className: 'no-invoices-message',
      onRetry: () => loadInvoices(ctx)
    });
    (invoicesContainer as HTMLElement).appendChild(errorState);
  }
}

/**
 * Render invoices list as a table (unified with admin portal)
 */
function renderInvoicesList(
  container: HTMLElement,
  invoices: PortalInvoice[],
  ctx: ClientPortalContext
): void {
  // Clear existing content
  const existingTable = container.querySelector('.data-table');
  if (existingTable) existingTable.remove();

  const noInvoicesMsg = container.querySelector('.no-invoices-message');
  if (noInvoicesMsg) noInvoicesMsg.remove();

  if (invoices.length === 0) {
    const emptyState = createEmptyState(
      'No invoices yet. Your first invoice will appear here once your project begins.',
      { className: 'no-invoices-message' }
    );
    container.appendChild(emptyState);
    return;
  }

  // Build table rows
  const tableRows = invoices
    .map((invoice) => {
      const statusLabel = getInvoiceStatusLabel(invoice.status);
      const showReceiptBtn = invoice.status === 'paid' || invoice.status === 'partial';

      const receiptBtnHtml = showReceiptBtn
        ? `
      <button class="icon-btn btn-download-receipt"
              data-invoice-id="${invoice.id}"
              data-invoice-number="${ctx.escapeHtml(invoice.invoice_number)}"
              aria-label="Download receipt" title="Download Receipt">
        ${ICONS.FILE_TEXT}
      </button>
    `
        : '';

      return `
      <tr data-invoice-id="${invoice.id}">
        <td class="name-cell" data-label="Invoice">${ctx.escapeHtml(invoice.invoice_number)}</td>
        <td class="name-cell" data-label="Project">${ctx.escapeHtml(invoice.project_name || 'Project')}</td>
        <td class="date-cell" data-label="Date">${ctx.formatDate(invoice.created_at)}</td>
        <td class="amount-cell" data-label="Amount">${formatCurrency(invoice.amount_total)}</td>
        <td class="status-cell" data-label="Status">${getStatusBadgeHTML(statusLabel, invoice.status)}</td>
        <td class="actions-cell" data-label="Actions">
          <button class="icon-btn btn-preview-invoice" data-invoice-id="${invoice.id}" aria-label="Preview invoice" title="Preview">
            ${ICONS.EYE}
          </button>
          <button class="icon-btn btn-download-invoice"
                  data-invoice-id="${invoice.id}"
                  data-invoice-number="${ctx.escapeHtml(invoice.invoice_number)}"
                  aria-label="Download invoice" title="Download Invoice">
            ${ICONS.DOWNLOAD}
          </button>
          ${receiptBtnHtml}
        </td>
      </tr>
    `;
    })
    .join('');

  // Create table HTML
  const tableHtml = `
    <div class="data-table-container">
      <div class="data-table-scroll-wrapper">
        <table class="data-table" aria-label="Invoices">
          <thead>
            <tr>
              <th scope="col" class="name-col">Invoice #</th>
              <th scope="col" class="name-col">Project</th>
              <th scope="col" class="date-col">Date</th>
              <th scope="col" class="amount-col">Amount</th>
              <th scope="col" class="status-col">Status</th>
              <th scope="col" class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody id="portal-invoices-body" aria-live="polite" aria-atomic="false" aria-relevant="additions removals">
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', tableHtml);
  attachInvoiceActionListeners(container, ctx);

  // Initialize keyboard navigation
  initTableKeyboardNav({
    tableSelector: '#portal-invoices-body',
    rowSelector: 'tr[data-invoice-id]',
    onRowSelect: (row) => {
      const previewBtn = row.querySelector('.btn-preview-invoice') as HTMLButtonElement;
      if (previewBtn) previewBtn.click();
    },
    focusClass: 'row-focused',
    selectedClass: 'row-selected'
  });
}

/**
 * Get display label for invoice status
 */
function getInvoiceStatusLabel(status: string): string {
  const labelMap: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled'
  };
  return labelMap[status] || 'Pending';
}

/**
 * Attach event listeners to invoice action buttons
 */
function attachInvoiceActionListeners(container: HTMLElement, ctx: ClientPortalContext): void {
  container.querySelectorAll('.btn-preview-invoice').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const invoiceId = (e.currentTarget as HTMLElement).dataset.invoiceId;
      if (invoiceId) {
        previewInvoice(parseInt(invoiceId), ctx);
      }
    });
  });

  container.querySelectorAll('.btn-download-invoice').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const invoiceId = (e.currentTarget as HTMLElement).dataset.invoiceId;
      const invoiceNumber = (e.currentTarget as HTMLElement).dataset.invoiceNumber || 'invoice';
      if (invoiceId) {
        downloadInvoice(parseInt(invoiceId), invoiceNumber, ctx);
      }
    });
  });

  // Receipt download buttons (for paid/partial invoices)
  container.querySelectorAll('.btn-download-receipt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const invoiceId = (e.currentTarget as HTMLElement).dataset.invoiceId;
      const invoiceNumber = (e.currentTarget as HTMLElement).dataset.invoiceNumber || 'receipt';
      if (invoiceId) {
        downloadReceipt(parseInt(invoiceId), invoiceNumber);
      }
    });
  });
}

/**
 * Preview invoice (open in new tab or modal)
 */
function previewInvoice(invoiceId: number, _ctx: ClientPortalContext): void {
  const url = `${INVOICES_API_BASE}/${invoiceId}/pdf?preview=true`;
  window.open(url, '_blank');
}

/**
 * Download invoice as PDF
 */
async function downloadInvoice(
  invoiceId: number,
  invoiceNumber: string,
  _ctx: ClientPortalContext
): Promise<void> {
  try {
    const response = await fetch(`${INVOICES_API_BASE}/${invoiceId}/pdf`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to download invoice');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading invoice:', error);
    showToast('Failed to download invoice. Please try again.', 'error');
  }
}

/**
 * Download receipt PDF for a paid invoice
 */
async function downloadReceipt(invoiceId: number, invoiceNumber: string): Promise<void> {
  try {
    // First, get receipts for this invoice
    const receiptsResponse = await fetch(`/api/receipts/invoice/${invoiceId}`, {
      credentials: 'include'
    });

    if (!receiptsResponse.ok) {
      throw new Error('Failed to fetch receipts');
    }

    const receiptsData = await receiptsResponse.json();
    const receipts = receiptsData.receipts || [];

    if (receipts.length === 0) {
      showToast('No receipt found for this invoice.', 'warning');
      return;
    }

    // Download the most recent receipt
    const latestReceipt = receipts[0];
    const pdfResponse = await fetch(`/api/receipts/${latestReceipt.id}/pdf`, {
      credentials: 'include'
    });

    if (!pdfResponse.ok) {
      throw new Error('Failed to download receipt');
    }

    const blob = await pdfResponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${latestReceipt.receipt_number || invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast('Receipt downloaded successfully', 'success');
  } catch (error) {
    console.error('Error downloading receipt:', error);
    showToast('Failed to download receipt. Please try again.', 'error');
  }
}
