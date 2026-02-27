import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Eye,
  Send,
  Check,
  Download,
  Trash2,
  MoreHorizontal,
  Inbox
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
  PortalDropdownSeparator
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import type { Invoice, InvoiceStatus } from '../../types';
import { INVOICE_STATUS_CONFIG } from '../../types';

interface InvoicesTabProps {
  invoices: Invoice[];
  projectId: number;
  onViewInvoice?: (invoiceId: number) => void;
  onCreateInvoice?: () => void;
  onSendInvoice?: (invoiceId: number) => Promise<boolean>;
  onMarkPaid?: (invoiceId: number) => Promise<boolean>;
  onDeleteInvoice?: (invoiceId: number) => Promise<boolean>;
  onDownloadPdf?: (invoiceId: number) => Promise<void>;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Check if an invoice is overdue
 */
function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
  if (!invoice.due_date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(invoice.due_date);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

/**
 * Get display status considering overdue
 */
function getDisplayStatus(invoice: Invoice): InvoiceStatus {
  if (isOverdue(invoice)) return 'overdue';
  return invoice.status;
}

/**
 * Format currency
 */
function formatCurrency(amount: number | string | undefined): string {
  if (amount === undefined || amount === null) return '-';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Format date
 */
function formatDate(date: string | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * InvoicesTab
 * Invoice list and management for project
 */
export function InvoicesTab({
  invoices,
  onViewInvoice,
  onCreateInvoice,
  onSendInvoice,
  onMarkPaid,
  onDeleteInvoice,
  onDownloadPdf,
  showNotification
}: InvoicesTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<{ type: string; id: number } | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);

  const deleteDialog = useConfirmDialog();
  const markPaidDialog = useConfirmDialog();

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return invoices;
    if (statusFilter === 'overdue') {
      return invoices.filter((inv) => isOverdue(inv));
    }
    return invoices.filter((inv) => inv.status === statusFilter);
  }, [invoices, statusFilter]);

  // Calculate totals
  const { totalOutstanding, totalPaid } = useMemo(() => {
    let outstanding = 0;
    let paid = 0;

    for (const invoice of invoices) {
      const total =
        typeof invoice.amount_total === 'string'
          ? parseFloat(invoice.amount_total)
          : invoice.amount_total || 0;
      const amountPaid =
        typeof invoice.amount_paid === 'string'
          ? parseFloat(invoice.amount_paid)
          : invoice.amount_paid || 0;

      if (invoice.status === 'paid') {
        paid += total;
      } else if (invoice.status !== 'cancelled' && invoice.status !== 'draft') {
        outstanding += total - amountPaid;
        paid += amountPaid;
      }
    }

    return { totalOutstanding: outstanding, totalPaid: paid };
  }, [invoices]);

  // Handle send invoice
  const handleSend = useCallback(
    async (invoiceId: number) => {
      if (!onSendInvoice) return;
      setActionLoading({ type: 'send', id: invoiceId });
      const success = await onSendInvoice(invoiceId);
      setActionLoading(null);

      if (success) {
        showNotification?.('Invoice sent', 'success');
      } else {
        showNotification?.('Failed to send invoice', 'error');
      }
    },
    [onSendInvoice, showNotification]
  );

  // Handle mark paid
  const handleMarkPaid = useCallback(async () => {
    if (!onMarkPaid || deletingInvoiceId === null) return;
    const success = await onMarkPaid(deletingInvoiceId);

    if (success) {
      showNotification?.('Invoice marked as paid', 'success');
    } else {
      showNotification?.('Failed to mark invoice as paid', 'error');
    }
    setDeletingInvoiceId(null);
  }, [onMarkPaid, deletingInvoiceId, showNotification]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!onDeleteInvoice || deletingInvoiceId === null) return;
    const success = await onDeleteInvoice(deletingInvoiceId);

    if (success) {
      showNotification?.('Invoice deleted', 'success');
    } else {
      showNotification?.('Failed to delete invoice', 'error');
    }
    setDeletingInvoiceId(null);
  }, [onDeleteInvoice, deletingInvoiceId, showNotification]);

  // Handle download PDF
  const handleDownloadPdf = useCallback(
    async (invoiceId: number) => {
      if (!onDownloadPdf) return;
      setActionLoading({ type: 'download', id: invoiceId });
      try {
        await onDownloadPdf(invoiceId);
        showNotification?.('PDF downloaded', 'success');
      } catch {
        showNotification?.('Failed to download PDF', 'error');
      }
      setActionLoading(null);
    },
    [onDownloadPdf, showNotification]
  );

  return (
    <div className="tw-section">
      {/* Header with stats and actions */}
      <div className="tw-flex tw-items-center tw-justify-between">
        <div className="tw-flex tw-items-center tw-gap-6" style={{ fontSize: '14px' }}>
          <div>
            <span className="tw-text-muted">Outstanding: </span>
            <span
              className={cn(
                totalOutstanding > 0
                  ? 'tw-text-primary'
                  : 'tw-text-muted'
              )}
              style={{ fontWeight: 600 }}
            >
              {formatCurrency(totalOutstanding)}
            </span>
          </div>
          <div>
            <span className="tw-text-muted">Paid: </span>
            <span className="tw-text-primary" style={{ fontWeight: 600 }}>
              {formatCurrency(totalPaid)}
            </span>
          </div>
        </div>

        <div className="tw-flex tw-items-center tw-gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="tw-input"
            style={{ height: '36px', width: 'auto' }}
          >
            <option value="all">All Invoices</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Create Invoice */}
          {onCreateInvoice && (
            <button className="tw-btn-primary" onClick={onCreateInvoice}>
              <Plus className="tw-h-4 tw-w-4" />
              New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <div className="tw-empty-state">
          <Inbox className="tw-h-8 tw-w-8 tw-mb-2" />
          <span>
            {statusFilter === 'all' ? 'No invoices yet' : `No ${statusFilter} invoices`}
          </span>
        </div>
      ) : (
        <div className="tw-panel" style={{ padding: 0 }}>
          <table className="tw-w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--portal-border-color)' }}>
                <th className="tw-label tw-text-left tw-px-4 tw-py-3">
                  Invoice #
                </th>
                <th className="tw-label tw-text-left tw-px-4 tw-py-3">
                  Amount
                </th>
                <th className="tw-label tw-text-left tw-px-4 tw-py-3">
                  Status
                </th>
                <th className="tw-label tw-text-left tw-px-4 tw-py-3">
                  Due Date
                </th>
                <th className="tw-label tw-text-right tw-px-4 tw-py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => {
                const displayStatus = getDisplayStatus(invoice);
                const isDraft = invoice.status === 'draft';
                const isPaid = invoice.status === 'paid';
                const canSend = isDraft && onSendInvoice;
                const canMarkPaid = !isPaid && !isDraft && onMarkPaid;

                return (
                  <tr
                    key={invoice.id}
                    className="tw-list-item tw-cursor-pointer"
                    style={{ display: 'table-row' }}
                    onClick={() => onViewInvoice?.(invoice.id)}
                  >
                    <td className="tw-px-4 tw-py-3">
                      <span className="tw-text-primary" style={{ fontSize: '14px', fontWeight: 500 }}>
                        {invoice.invoice_number || '-'}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3">
                      <span className="tw-text-primary" style={{ fontSize: '14px', fontWeight: 500 }}>
                        {formatCurrency(invoice.amount_total)}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3">
                      <span className="tw-badge">
                        {INVOICE_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3">
                      <span
                        className={cn(
                          isOverdue(invoice)
                            ? 'tw-text-primary'
                            : 'tw-text-muted'
                        )}
                        style={{ fontSize: '14px' }}
                      >
                        {formatDate(invoice.due_date)}
                      </span>
                    </td>
                    <td className="tw-px-4 tw-py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="tw-flex tw-items-center tw-justify-end tw-gap-1">
                        <button
                          className="tw-btn-icon"
                          onClick={() => onViewInvoice?.(invoice.id)}
                          title="View invoice"
                        >
                          <Eye className="tw-h-4 tw-w-4" />
                        </button>

                        {canSend && (
                          <button
                            className="tw-btn-icon"
                            onClick={() => handleSend(invoice.id)}
                            disabled={actionLoading?.type === 'send' && actionLoading?.id === invoice.id}
                            title="Send invoice"
                          >
                            <Send className="tw-h-4 tw-w-4" />
                          </button>
                        )}

                        {canMarkPaid && (
                          <button
                            className="tw-btn-icon"
                            onClick={() => {
                              setDeletingInvoiceId(invoice.id);
                              markPaidDialog.open();
                            }}
                            title="Mark as paid"
                          >
                            <Check className="tw-h-4 tw-w-4" />
                          </button>
                        )}

                        {!isDraft && onDownloadPdf && (
                          <button
                            className="tw-btn-icon"
                            onClick={() => handleDownloadPdf(invoice.id)}
                            disabled={actionLoading?.type === 'download' && actionLoading?.id === invoice.id}
                            title="Download PDF"
                          >
                            <Download className="tw-h-4 tw-w-4" />
                          </button>
                        )}

                        <PortalDropdown>
                          <PortalDropdownTrigger asChild>
                            <button className="tw-btn-icon">
                              <MoreHorizontal className="tw-h-4 tw-w-4" />
                            </button>
                          </PortalDropdownTrigger>
                          <PortalDropdownContent align="end">
                            <PortalDropdownItem onClick={() => onViewInvoice?.(invoice.id)}>
                              View Details
                            </PortalDropdownItem>
                            {!isPaid && (
                              <>
                                <PortalDropdownSeparator />
                                <PortalDropdownItem
                                  onClick={() => {
                                    setDeletingInvoiceId(invoice.id);
                                    deleteDialog.open();
                                  }}
                                >
                                  <Trash2 className="tw-h-4 tw-w-4 tw-mr-2" />
                                  Delete
                                </PortalDropdownItem>
                              </>
                            )}
                          </PortalDropdownContent>
                        </PortalDropdown>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Paid Confirmation */}
      <ConfirmDialog
        open={markPaidDialog.isOpen}
        onOpenChange={markPaidDialog.setIsOpen}
        title="Mark as Paid"
        description="Mark this invoice as paid?"
        confirmText="Mark Paid"
        cancelText="Cancel"
        onConfirm={handleMarkPaid}
        variant="info"
        loading={markPaidDialog.isLoading}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Invoice"
        description="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </div>
  );
}
