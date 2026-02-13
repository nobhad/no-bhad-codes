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

const INVOICES_API_BASE = '/api/invoices';

/**
 * Load invoices from API and render the list
 */
export async function loadInvoices(ctx: ClientPortalContext): Promise<void> {
  const invoicesContainer = document.querySelector('.invoices-list');
  const summaryOutstanding = document.querySelector('.summary-card:first-child .summary-value');
  const summaryPaid = document.querySelector('.summary-card:last-child .summary-value');

  if (!invoicesContainer) return;

  // Show loading state
  const invoiceItems = invoicesContainer.querySelectorAll('.invoice-item');
  invoiceItems.forEach((item) => item.remove());
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
    const noInvoices = document.createElement('p');
    noInvoices.className = 'no-invoices-message';
    noInvoices.textContent = 'Unable to load invoices. Please try again later.';
    (invoicesContainer as HTMLElement).appendChild(noInvoices);
  }
}


/**
 * Render invoices list
 */
function renderInvoicesList(
  container: HTMLElement,
  invoices: PortalInvoice[],
  ctx: ClientPortalContext
): void {
  const existingItems = container.querySelectorAll('.invoice-item');
  existingItems.forEach((item) => item.remove());

  const noInvoicesMsg = container.querySelector('.no-invoices-message');
  if (noInvoicesMsg) noInvoicesMsg.remove();

  if (invoices.length === 0) {
    const noInvoices = document.createElement('p');
    noInvoices.className = 'no-invoices-message';
    noInvoices.textContent =
      'No invoices yet. Your first invoice will appear here once your project begins.';
    container.appendChild(noInvoices);
    return;
  }

  invoices.forEach((invoice) => {
    const invoiceElement = document.createElement('div');
    invoiceElement.className = 'invoice-item';
    invoiceElement.dataset.invoiceId = String(invoice.id);

    const statusClass = getInvoiceStatusClass(invoice.status);
    const statusLabel = getInvoiceStatusLabel(invoice.status);

    // Show receipt button for paid/partial invoices
    const showReceiptBtn = invoice.status === 'paid' || invoice.status === 'partial';

    invoiceElement.innerHTML = `
      <div class="invoice-info">
        <span class="invoice-number">${ctx.escapeHtml(invoice.invoice_number)}</span>
        <span class="invoice-date">${ctx.formatDate(invoice.created_at)}</span>
        <span class="invoice-project">${ctx.escapeHtml(invoice.project_name || 'Project')}</span>
      </div>
      <div class="invoice-amount">${formatCurrency(invoice.amount_total)}</div>
      <span class="status-badge ${statusClass}">${statusLabel}</span>
      <div class="invoice-actions">
        <button class="icon-btn btn-preview-invoice" data-invoice-id="${invoice.id}" aria-label="Preview invoice" title="Preview">
          ${ICONS.EYE}
        </button>
        <button class="icon-btn btn-download-invoice"
                data-invoice-id="${invoice.id}"
                data-invoice-number="${ctx.escapeHtml(invoice.invoice_number)}"
                aria-label="Download invoice" title="Download Invoice">
          ${ICONS.DOWNLOAD}
        </button>
        ${showReceiptBtn ? `
        <button class="icon-btn btn-download-receipt"
                data-invoice-id="${invoice.id}"
                data-invoice-number="${ctx.escapeHtml(invoice.invoice_number)}"
                aria-label="Download receipt" title="Download Receipt">
          ${ICONS.FILE_TEXT}
        </button>
        ` : ''}
      </div>
    `;

    container.appendChild(invoiceElement);
  });

  attachInvoiceActionListeners(container, ctx);
}

/**
 * Get CSS class for invoice status
 */
function getInvoiceStatusClass(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'status-draft',
    sent: 'status-sent',
    viewed: 'status-viewed',
    partial: 'status-partial',
    paid: 'status-paid',
    overdue: 'status-overdue',
    cancelled: 'status-cancelled'
  };
  return statusMap[status] || 'status-pending';
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
