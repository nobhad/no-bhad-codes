/**
 * Project Invoices Module
 * @file src/features/admin/project-details/invoices.ts
 *
 * Handles loading and displaying project invoices.
 */

import { formatDate } from '../../../utils/format-utils';
import { AdminAuth } from '../admin-auth';
import { apiFetch } from '../../../utils/api-client';
import { domCache } from './dom-cache';
import type { InvoiceResponse } from '../../../types/api';
import { getStatusBadgeHTML } from '../../../components/status-badge';

// Extended invoice type for deposit fields
export type ExtendedInvoice = InvoiceResponse & { invoice_type?: string };

/**
 * Load invoices for the specified project
 */
export async function loadProjectInvoices(projectId: number): Promise<void> {
  const invoicesList = domCache.get('invoicesList');
  const outstandingEl = domCache.get('outstanding');
  const paidEl = domCache.get('paid');

  if (!invoicesList) return;

  if (!AdminAuth.isAuthenticated()) {
    invoicesList.innerHTML = '<p class="empty-state">Authentication required.</p>';
    return;
  }

  try {
    const response = await apiFetch(`/api/invoices/project/${projectId}`);

    if (response.ok) {
      const data = await response.json();
      const invoices: InvoiceResponse[] = data.invoices || [];

      // Calculate totals
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

      if (outstandingEl) outstandingEl.textContent = `$${totalOutstanding.toFixed(2)}`;
      if (paidEl) paidEl.textContent = `$${totalPaid.toFixed(2)}`;

      if (invoices.length === 0) {
        invoicesList.innerHTML = '<p class="empty-state">No invoices yet. Create one above.</p>';
      } else {
        invoicesList.innerHTML = invoices
          .map((inv: ExtendedInvoice) => {
            // Determine which action buttons to show
            const isDraft = inv.status === 'draft';
            const isCancelled = inv.status === 'cancelled';
            const isPaid = inv.status === 'paid';
            const isOutstanding = ['sent', 'viewed', 'partial', 'overdue'].includes(inv.status);
            const showSendBtn = isDraft;
            const showEditBtn = isDraft;
            const showRecordPaymentBtn = isOutstanding;
            const showMarkPaidBtn = isOutstanding;
            const showReminderBtn = isOutstanding;
            const showApplyCreditBtn = inv.invoice_type !== 'deposit' && isOutstanding;
            const showDuplicateBtn = !isCancelled;
            const showDeleteBtn = !isPaid;
            const isDeposit = inv.invoice_type === 'deposit';

            return `
              <div class="invoice-item${isDeposit ? ' invoice-deposit' : ''}">
                <div class="invoice-info">
                  <strong>${inv.invoice_number || `INV-${inv.id}`}</strong>
                  ${isDeposit ? '<span class="invoice-type-badge">DEPOSIT</span>' : ''}
                  <span class="invoice-date">${formatDate(inv.created_at)}</span>
                </div>
                <div class="invoice-amount">$${(typeof inv.amount_total === 'string' ? parseFloat(inv.amount_total) : (inv.amount_total || 0)).toFixed(2)}</div>
                ${getStatusBadgeHTML(inv.status, inv.status)}
                <div class="invoice-actions">
                  <a href="/api/invoices/${inv.id}/pdf" class="btn btn-outline btn-sm" target="_blank">PDF</a>
                  ${showEditBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.editInvoice(${inv.id})">Edit</button>` : ''}
                  ${showSendBtn ? `<button class="btn btn-secondary btn-sm" onclick="window.adminDashboard?.sendInvoice(${inv.id})">Send</button>` : ''}
                  ${showRecordPaymentBtn ? `<button class="btn btn-success btn-sm" onclick="window.adminDashboard?.recordPayment(${inv.id})">Record Payment</button>` : ''}
                  ${showMarkPaidBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.markInvoicePaid(${inv.id})">Mark Paid</button>` : ''}
                  ${showApplyCreditBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.showApplyCreditPrompt(${inv.id})">Apply Credit</button>` : ''}
                  ${showReminderBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.sendInvoiceReminder(${inv.id})">Remind</button>` : ''}
                  ${showDuplicateBtn ? `<button class="btn btn-outline btn-sm" onclick="window.adminDashboard?.duplicateInvoice(${inv.id})">Duplicate</button>` : ''}
                  ${showDeleteBtn ? `<button class="btn btn-danger btn-sm" onclick="window.adminDashboard?.deleteInvoice(${inv.id})">Delete</button>` : ''}
                </div>
              </div>
            `;
          })
          .join('');
      }
    }
  } catch (error) {
    console.error('[ProjectInvoices] Error loading invoices:', error);
    invoicesList.innerHTML = '<p class="empty-state">Error loading invoices.</p>';
  }
}
