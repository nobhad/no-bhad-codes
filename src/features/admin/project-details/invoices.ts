/**
 * Project Invoices Module
 * @file src/features/admin/project-details/invoices.ts
 *
 * Handles loading and displaying project invoices with filtering and view modal.
 */

import { formatDate, formatCurrency } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch, parseApiResponse } from '../../../utils/api-client';
import { renderEmptyState, renderErrorState } from '../../../components/empty-state';
import { domCache } from './dom-cache';
import type { InvoiceResponse, InvoiceLineItem } from '../../../types/api';
import { getStatusDotHTML } from '../../../components/status-badge';
import { createPortalModal } from '../../../components/portal-modal';
import { showToast } from '../../../utils/toast-notifications';

// Extended invoice type for deposit fields
export type ExtendedInvoice = InvoiceResponse & { invoice_type?: string };

// Module state
let cachedInvoices: ExtendedInvoice[] = [];
let currentFilter: string = 'all';
let _currentProjectId: number | null = null;

// Status filter options
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Invoices' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'partial', label: 'Partial' }
];

/**
 * Load invoices for the specified project
 */
export async function loadProjectInvoices(projectId: number): Promise<void> {
  const invoicesList = domCache.get('invoicesList');
  const outstandingEl = domCache.get('outstanding');
  const paidEl = domCache.get('paid');

  if (!invoicesList) return;

  _currentProjectId = projectId;

  if (!AdminAuth.isAuthenticated()) {
    renderEmptyState(invoicesList, 'Authentication required.');
    return;
  }

  try {
    const response = await apiFetch(`/api/invoices/project/${projectId}`);

    if (response.ok) {
      const data = await parseApiResponse<{ invoices: ExtendedInvoice[] }>(response);
      const invoices: ExtendedInvoice[] = data.invoices || [];
      cachedInvoices = invoices;

      // Calculate totals (across all invoices, not filtered)
      let totalOutstanding = 0;
      let totalPaid = 0;

      invoices.forEach((inv: InvoiceResponse) => {
        const amount = typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0);
        const paid = typeof inv.amount_paid === 'string' ? parseFloat(inv.amount_paid) : (inv.amount_paid || 0);
        if (inv.status === 'paid') {
          totalPaid += amount;
        } else if (['sent', 'viewed', 'partial', 'overdue'].includes(inv.status)) {
          totalOutstanding += amount - paid;
          totalPaid += paid;
        }
      });

      if (outstandingEl) outstandingEl.textContent = formatCurrency(totalOutstanding);
      if (paidEl) paidEl.textContent = formatCurrency(totalPaid);

      // Render with current filter
      renderInvoicesList(invoices, invoicesList);

      // Initialize filter dropdown if not already done
      initializeStatusFilter();
    }
  } catch (error) {
    console.error('[ProjectInvoices] Error loading invoices:', error);
    renderErrorState(invoicesList, 'Error loading invoices.', { type: 'general' });
  }
}

/**
 * Initialize status filter dropdown
 */
function initializeStatusFilter(): void {
  const filterContainer = document.getElementById('pd-invoices-filter');
  if (!filterContainer || filterContainer.dataset.initialized === 'true') return;

  filterContainer.dataset.initialized = 'true';

  // Create filter select
  const filterSelect = document.createElement('select');
  filterSelect.id = 'invoice-status-filter';
  filterSelect.className = 'form-input form-input-sm';
  filterSelect.innerHTML = STATUS_FILTER_OPTIONS.map(opt =>
    `<option value="${opt.value}"${opt.value === currentFilter ? ' selected' : ''}>${opt.label}</option>`
  ).join('');

  // Add change handler
  filterSelect.addEventListener('change', () => {
    currentFilter = filterSelect.value;
    const invoicesList = domCache.get('invoicesList');
    if (invoicesList && cachedInvoices.length > 0) {
      renderInvoicesList(cachedInvoices, invoicesList);
    }
  });

  filterContainer.appendChild(filterSelect);
}

/**
 * Filter invoices by status
 */
function filterInvoices(invoices: ExtendedInvoice[]): ExtendedInvoice[] {
  if (currentFilter === 'all') return invoices;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return invoices.filter(inv => {
    // Check for overdue
    const isOverdue = inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < today;

    switch (currentFilter) {
    case 'overdue':
      return isOverdue || inv.status === 'overdue';
    case 'draft':
      return inv.status === 'draft';
    case 'sent':
      return inv.status === 'sent' || inv.status === 'viewed';
    case 'paid':
      return inv.status === 'paid';
    case 'partial':
      return inv.status === 'partial';
    default:
      return true;
    }
  });
}

/**
 * Render the invoices list with filtering
 */
function renderInvoicesList(invoices: ExtendedInvoice[], container: HTMLElement): void {
  const filteredInvoices = filterInvoices(invoices);

  if (invoices.length === 0) {
    renderEmptyState(container, 'No invoices yet. Create one above.');
    return;
  }

  if (filteredInvoices.length === 0) {
    renderEmptyState(container, 'No invoices match the selected filter.');
    return;
  }

  // Check for overdue status based on due date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  container.innerHTML = `
    <table class="invoices-table" aria-label="Project invoices">
      <thead>
        <tr>
          <th scope="col">Invoice #</th>
          <th scope="col">Amount</th>
          <th scope="col">Due Date</th>
          <th scope="col">Status</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filteredInvoices.map((inv: ExtendedInvoice) => {
    // Determine effective status (check for overdue)
    let effectiveStatus = inv.status;
    if (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.due_date) {
      const dueDate = new Date(inv.due_date);
      if (dueDate < today) {
        effectiveStatus = 'overdue';
      }
    }

    // Determine which action buttons to show
    const isDraft = inv.status === 'draft';
    const isOutstanding = ['sent', 'viewed', 'partial', 'overdue'].includes(effectiveStatus);
    const isDeposit = inv.invoice_type === 'deposit';

    // Build action buttons
    const viewBtn = `<button class="icon-btn btn-view-invoice" data-invoice-id="${inv.id}" title="View Details" aria-label="View invoice details">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>`;

    const editBtn = isDraft
      ? `<button class="icon-btn btn-edit-invoice" data-invoice-id="${inv.id}" title="Edit Invoice" aria-label="Edit invoice">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>`
      : '';

    const sendBtn = isDraft
      ? `<button class="icon-btn btn-send-invoice" data-invoice-id="${inv.id}" title="Send to Client" aria-label="Send invoice to client">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>`
      : '';

    const markPaidBtn = isOutstanding
      ? `<button class="icon-btn btn-mark-paid" data-invoice-id="${inv.id}" title="Mark as Paid" aria-label="Mark invoice as paid">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
            </button>`
      : '';

    const downloadBtn = `<button class="icon-btn btn-download-invoice" data-invoice-id="${inv.id}" data-invoice-number="${inv.invoice_number || `INV-${inv.id}`}" title="Download PDF" aria-label="Download invoice PDF">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>`;

    // Receipt download button for paid/partial invoices
    const isPaidOrPartial = inv.status === 'paid' || inv.status === 'partial';
    const receiptBtn = isPaidOrPartial
      ? `<button class="icon-btn btn-download-receipt" data-invoice-id="${inv.id}" data-invoice-number="${inv.invoice_number || `INV-${inv.id}`}" title="Download Receipt" aria-label="Download receipt PDF">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
            </button>`
      : '';

    return `
            <tr data-invoice-id="${inv.id}" class="${isDeposit ? 'invoice-deposit-row' : ''}">
              <td>
                <strong>${SanitizationUtils.escapeHtml(inv.invoice_number || `INV-${inv.id}`)}</strong>
                ${isDeposit ? '<span class="invoice-type-badge">DEPOSIT</span>' : ''}
              </td>
              <td>${formatCurrency(typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0))}</td>
              <td>${inv.due_date ? formatDate(inv.due_date) : '-'}</td>
              <td>${getStatusDotHTML(effectiveStatus)}</td>
              <td class="actions-cell">
                <div class="table-actions">
                  ${viewBtn}
                  ${editBtn}
                  ${sendBtn}
                  ${markPaidBtn}
                  ${downloadBtn}
                  ${receiptBtn}
                </div>
              </td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  `;

  // Attach event handlers using delegation
  setupInvoiceTableHandlers(container);
}

/**
 * Set up event handlers for invoice table actions
 */
function setupInvoiceTableHandlers(container: HTMLElement): void {
  // Remove existing listener to avoid duplicates
  const existingHandler = (container as HTMLElement & { _invoiceHandler?: (e: Event) => void })._invoiceHandler;
  if (existingHandler) {
    container.removeEventListener('click', existingHandler);
  }

  const handler = async (e: Event): Promise<void> => {
    const target = e.target as HTMLElement;
    const button = target.closest('button') as HTMLButtonElement;
    if (!button) return;

    const invoiceId = button.dataset.invoiceId;
    if (!invoiceId) return;

    const id = parseInt(invoiceId);

    if (button.classList.contains('btn-view-invoice')) {
      showViewInvoiceModal(id);
    } else if (button.classList.contains('btn-edit-invoice')) {
      window.adminDashboard?.editInvoice(id);
    } else if (button.classList.contains('btn-send-invoice')) {
      window.adminDashboard?.sendInvoice(id);
    } else if (button.classList.contains('btn-mark-paid')) {
      window.adminDashboard?.markInvoicePaid(id);
    } else if (button.classList.contains('btn-download-invoice')) {
      await downloadInvoicePdf(id, button.dataset.invoiceNumber || `invoice-${id}`);
    } else if (button.classList.contains('btn-download-receipt')) {
      await downloadReceiptPdf(id, button.dataset.invoiceNumber || `invoice-${id}`);
    }
  };

  container.addEventListener('click', handler);
  (container as HTMLElement & { _invoiceHandler?: (e: Event) => void })._invoiceHandler = handler;
}

/**
 * Download invoice PDF
 */
async function downloadInvoicePdf(invoiceId: number, invoiceNumber: string): Promise<void> {
  try {
    const response = await apiFetch(`/api/invoices/${invoiceId}/pdf`);
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      console.error('[ProjectInvoices] Failed to download PDF');
      showToast('Failed to download invoice PDF', 'error');
    }
  } catch (error) {
    console.error('[ProjectInvoices] Download error:', error);
    showToast('Failed to download invoice PDF', 'error');
  }
}

/**
 * Download receipt PDF for a paid invoice
 */
async function downloadReceiptPdf(invoiceId: number, invoiceNumber: string): Promise<void> {
  try {
    // First, get receipts for this invoice
    const receiptsResponse = await apiFetch(`/api/receipts/invoice/${invoiceId}`);

    if (!receiptsResponse.ok) {
      showToast('Failed to fetch receipts', 'error');
      return;
    }

    const receiptsData = await receiptsResponse.json();
    const receipts = receiptsData.receipts || [];

    if (receipts.length === 0) {
      showToast('No receipt found for this invoice', 'warning');
      return;
    }

    // Download the most recent receipt
    const latestReceipt = receipts[0];
    const pdfResponse = await apiFetch(`/api/receipts/${latestReceipt.id}/pdf`);

    if (!pdfResponse.ok) {
      showToast('Failed to download receipt PDF', 'error');
      return;
    }

    const blob = await pdfResponse.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${latestReceipt.receipt_number || invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Receipt downloaded successfully', 'success');
  } catch (error) {
    console.error('[ProjectInvoices] Receipt download error:', error);
    showToast('Failed to download receipt', 'error');
  }
}

/**
 * Show view invoice modal with full details
 */
async function showViewInvoiceModal(invoiceId: number): Promise<void> {
  // Find invoice in cache or fetch
  let invoice = cachedInvoices.find(inv => inv.id === invoiceId);

  if (!invoice) {
    try {
      const response = await apiFetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) {
        console.error('[ProjectInvoices] Failed to load invoice');
        return;
      }
      const data = await parseApiResponse<{ invoice: ExtendedInvoice }>(response);
      invoice = data.invoice;
    } catch (error) {
      console.error('[ProjectInvoices] View invoice error:', error);
      return;
    }
  }

  if (!invoice) return;

  const modal = createPortalModal({
    id: 'view-project-invoice-modal',
    titleId: 'view-project-invoice-title',
    title: `Invoice ${SanitizationUtils.escapeHtml(invoice.invoice_number || `#${invoice.id}`)}`,
    contentClassName: 'invoice-modal-content',
    onClose: () => {
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
  const total = typeof invoice.amount_total === 'string'
    ? parseFloat(invoice.amount_total)
    : (invoice.amount_total || 0);
  const amountPaid = typeof invoice.amount_paid === 'string'
    ? parseFloat(invoice.amount_paid)
    : (invoice.amount_paid || 0);
  const balanceDue = total - amountPaid;

  // Check for overdue
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let effectiveStatus = invoice.status;
  if (invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.due_date) {
    const dueDate = new Date(invoice.due_date);
    if (dueDate < today) {
      effectiveStatus = 'overdue';
    }
  }

  // Build modal body
  modal.body.innerHTML = `
    <div class="invoice-view-content">
      <div class="invoice-header-info">
        <div class="invoice-info-row">
          <div class="invoice-info-item">
            <span class="field-label">Status</span>
            <span class="field-value">${getStatusDotHTML(effectiveStatus)}</span>
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
        ${invoice.invoice_type === 'deposit' ? `
          <div class="invoice-info-row">
            <div class="invoice-info-item">
              <span class="field-label">Type</span>
              <span class="field-value"><span class="invoice-type-badge">DEPOSIT</span></span>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="invoice-line-items-section">
        <h3 class="section-title">Line Items</h3>
        ${lineItemsHTML}
      </div>

      <div class="invoice-totals">
        <div class="total-row total-main">
          <span>Total</span>
          <span>${formatCurrency(total)}</span>
        </div>
        ${amountPaid > 0 ? `
          <div class="total-row">
            <span>Amount Paid</span>
            <span>${formatCurrency(amountPaid)}</span>
          </div>
          <div class="total-row balance-due">
            <span>Balance Due</span>
            <span>${formatCurrency(balanceDue)}</span>
          </div>
        ` : ''}
      </div>

      ${invoice.notes ? `
        <div class="invoice-notes-section">
          <h3 class="section-title">Notes</h3>
          <p>${SanitizationUtils.escapeHtml(invoice.notes)}</p>
        </div>
      ` : ''}
    </div>
  `;

  // Build footer with action buttons based on status
  const isDraft = invoice.status === 'draft';
  const isOutstanding = ['sent', 'viewed', 'partial', 'overdue'].includes(effectiveStatus);

  const isPaidOrPartial = invoice.status === 'paid' || invoice.status === 'partial';

  let footerButtons = `
    <button type="button" class="btn btn-outline" id="view-invoice-close-btn">Close</button>
    <button type="button" class="btn btn-outline" id="view-invoice-pdf-btn">Download PDF</button>
  `;

  if (isPaidOrPartial) {
    footerButtons += `
      <button type="button" class="btn btn-outline" id="view-invoice-receipt-btn">Download Receipt</button>
    `;
  }

  if (isDraft) {
    footerButtons += `
      <button type="button" class="btn btn-secondary" id="view-invoice-send-btn">Send Invoice</button>
    `;
  } else if (isOutstanding) {
    footerButtons += `
      <button type="button" class="btn btn-primary" id="view-invoice-paid-btn">Mark Paid</button>
    `;
  }

  modal.footer.innerHTML = footerButtons;

  document.body.appendChild(modal.overlay);
  modal.show();

  // Set up button handlers
  modal.footer.querySelector('#view-invoice-close-btn')?.addEventListener('click', () => {
    modal.hide();
    modal.overlay.remove();
  });

  modal.footer.querySelector('#view-invoice-pdf-btn')?.addEventListener('click', async () => {
    await downloadInvoicePdf(invoice!.id, invoice!.invoice_number || `invoice-${invoice!.id}`);
  });

  modal.footer.querySelector('#view-invoice-receipt-btn')?.addEventListener('click', async () => {
    await downloadReceiptPdf(invoice!.id, invoice!.invoice_number || `invoice-${invoice!.id}`);
  });

  modal.footer.querySelector('#view-invoice-send-btn')?.addEventListener('click', async () => {
    modal.hide();
    modal.overlay.remove();
    window.adminDashboard?.sendInvoice(invoice!.id);
  });

  modal.footer.querySelector('#view-invoice-paid-btn')?.addEventListener('click', async () => {
    modal.hide();
    modal.overlay.remove();
    window.adminDashboard?.markInvoicePaid(invoice!.id);
  });
}
