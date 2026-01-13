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

const INVOICES_API_BASE = '/api/invoices';

/**
 * Load invoices from API and render the list
 */
export async function loadInvoices(ctx: ClientPortalContext): Promise<void> {
  const invoicesContainer = document.querySelector('.invoices-list');
  const summaryOutstanding = document.querySelector('.summary-card:first-child .summary-value');
  const summaryPaid = document.querySelector('.summary-card:last-child .summary-value');

  if (!invoicesContainer) return;

  const invoiceItems = invoicesContainer.querySelectorAll('.invoice-item');
  invoiceItems.forEach((item) => item.remove());

  try {
    if (ctx.isDemo()) {
      renderDemoInvoices(invoicesContainer as HTMLElement, ctx);
      return;
    }

    const response = await fetch(`${INVOICES_API_BASE}/me`, {
      credentials: 'include' // Include HttpOnly cookies
    });

    if (!response.ok) {
      throw new Error('Failed to fetch invoices');
    }

    const data = await response.json();

    if (summaryOutstanding && data.summary) {
      summaryOutstanding.textContent = formatCurrency(data.summary.totalOutstanding);
    }
    if (summaryPaid && data.summary) {
      summaryPaid.textContent = formatCurrency(data.summary.totalPaid);
    }

    renderInvoicesList(invoicesContainer as HTMLElement, data.invoices || [], ctx);
  } catch (error) {
    console.error('Error loading invoices:', error);
    renderDemoInvoices(invoicesContainer as HTMLElement, ctx);
  }
}

/**
 * Render demo invoices for demo mode
 */
function renderDemoInvoices(container: HTMLElement, ctx: ClientPortalContext): void {
  const demoInvoices: PortalInvoice[] = [
    {
      id: 1,
      invoice_number: 'INV-2025-001',
      created_at: '2025-11-30T10:00:00Z',
      due_date: '2025-12-30T10:00:00Z',
      amount_total: 2500.0,
      status: 'sent',
      project_name: 'Website Redesign'
    },
    {
      id: 2,
      invoice_number: 'INV-2025-002',
      created_at: '2025-11-15T10:00:00Z',
      due_date: '2025-12-15T10:00:00Z',
      amount_total: 1500.0,
      status: 'paid',
      project_name: 'Brand Identity'
    }
  ];

  const summaryOutstanding = document.querySelector('.summary-card:first-child .summary-value');
  const summaryPaid = document.querySelector('.summary-card:last-child .summary-value');
  if (summaryOutstanding) summaryOutstanding.textContent = '$2,500.00';
  if (summaryPaid) summaryPaid.textContent = '$1,500.00';

  renderInvoicesList(container, demoInvoices, ctx);
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

    invoiceElement.innerHTML = `
      <div class="invoice-info">
        <span class="invoice-number">${ctx.escapeHtml(invoice.invoice_number)}</span>
        <span class="invoice-date">${ctx.formatDate(invoice.created_at)}</span>
        <span class="invoice-project">${ctx.escapeHtml(invoice.project_name || 'Project')}</span>
      </div>
      <div class="invoice-amount">${formatCurrency(invoice.amount_total)}</div>
      <span class="invoice-status ${statusClass}">${statusLabel}</span>
      <div class="invoice-actions">
        <button class="btn btn-outline btn-sm btn-preview-invoice"
                data-invoice-id="${invoice.id}">Preview</button>
        <button class="btn btn-outline btn-sm btn-download-invoice"
                data-invoice-id="${invoice.id}"
                data-invoice-number="${ctx.escapeHtml(invoice.invoice_number)}">Download</button>
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
    sent: 'status-pending',
    viewed: 'status-pending',
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
    sent: 'Pending',
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
}

/**
 * Preview invoice (open in new tab or modal)
 */
function previewInvoice(invoiceId: number, ctx: ClientPortalContext): void {
  if (ctx.isDemo()) {
    alert('Invoice preview not available in demo mode.');
    return;
  }

  const url = `${INVOICES_API_BASE}/${invoiceId}`;
  window.open(url, '_blank');
}

/**
 * Download invoice as PDF
 */
async function downloadInvoice(
  invoiceId: number,
  invoiceNumber: string,
  ctx: ClientPortalContext
): Promise<void> {
  if (ctx.isDemo()) {
    alert('Invoice download not available in demo mode.');
    return;
  }

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
    alert('Failed to download invoice. Please try again.');
  }
}
