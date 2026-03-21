import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Eye,
  Send,
  Check,
  Download,
  Trash2,
  Pencil,
  Inbox,
  ChevronDown
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { EmptyState } from '@react/components/portal/EmptyState';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { PortalModal } from '@react/components/portal/PortalModal';
import { InvoiceDetailPanel } from '../../invoices/InvoiceDetailPanel';
import { buildEndpoint } from '@/constants/api-endpoints';
import type { Invoice, InvoiceStatus } from '../../types';
import { INVOICE_STATUS_CONFIG } from '../../types';
import { formatCurrency, formatDate } from '@/utils/format-utils';
import { NOTIFICATIONS } from '@/constants/notifications';
import { KEYS } from '@/constants/keyboard';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Invoices' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' }
] as const;

const STATUS_FILTER_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_FILTER_OPTIONS.map((o) => [o.value, o.label])
);

interface InvoicesTabProps {
  invoices: Invoice[];
  onViewInvoice?: (invoiceId: number) => void;
  onEditInvoice?: (invoiceId: number) => void;
  onCreateInvoice?: () => void;
  onSendInvoice?: (invoiceId: number) => Promise<boolean>;
  onMarkPaid?: (invoiceId: number) => Promise<boolean>;
  onDeleteInvoice?: (invoiceId: number) => Promise<boolean>;
  onDownloadPdf?: (invoiceId: number) => Promise<void>;
  onStatusChange?: (invoiceId: number, status: string) => Promise<boolean>;
  onNavigate?: (tab: string, entityId?: string) => void;
  onRefresh?: () => void;
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
 * InvoicesTab
 * Invoice list and management for project
 */
export function InvoicesTab({
  invoices,
  onViewInvoice,
  onEditInvoice,
  onCreateInvoice,
  onSendInvoice,
  onMarkPaid,
  onDeleteInvoice,
  onDownloadPdf,
  onStatusChange,
  onNavigate,
  onRefresh,
  showNotification
}: InvoicesTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<{ type: string; id: number } | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

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
        showNotification?.(NOTIFICATIONS.invoice.SENT, 'success');
      } else {
        showNotification?.(NOTIFICATIONS.invoice.SEND_FAILED, 'error');
      }
    },
    [onSendInvoice, showNotification]
  );

  // Handle mark paid
  const handleMarkPaid = useCallback(async () => {
    if (!onMarkPaid || deletingInvoiceId === null) return;
    const success = await onMarkPaid(deletingInvoiceId);

    if (success) {
      showNotification?.(NOTIFICATIONS.invoice.MARKED_PAID, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.invoice.MARK_PAID_FAILED, 'error');
    }
    setDeletingInvoiceId(null);
  }, [onMarkPaid, deletingInvoiceId, showNotification]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!onDeleteInvoice || deletingInvoiceId === null) return;
    const success = await onDeleteInvoice(deletingInvoiceId);

    if (success) {
      showNotification?.(NOTIFICATIONS.invoice.DELETED, 'success');
    } else {
      showNotification?.(NOTIFICATIONS.invoice.DELETE_FAILED, 'error');
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
        showNotification?.(NOTIFICATIONS.invoice.PDF_DOWNLOADED, 'success');
      } catch {
        showNotification?.(NOTIFICATIONS.invoice.PDF_DOWNLOAD_FAILED, 'error');
      }
      setActionLoading(null);
    },
    [onDownloadPdf, showNotification]
  );

  return (
    <div className="section tab-section">
      {/* Header with stats and actions */}
      <div className="panel-header">
        <div className="detail-meta">
          <div>
            <span className="text-secondary">Outstanding: </span>
            <span
              className={cn(
                'pd-highlight-value',
                totalOutstanding === 0 && 'text-secondary'
              )}
            >
              {formatCurrency(totalOutstanding)}
            </span>
          </div>
          <div>
            <span className="text-secondary">Paid: </span>
            <span className="pd-highlight-value">
              {formatCurrency(totalPaid)}
            </span>
          </div>
        </div>

        <div className="layout-row">
          {/* Status Filter */}
          <PortalDropdown>
            <PortalDropdownTrigger asChild>
              <button className="dropdown-trigger--form invtab-filter" type="button">
                {STATUS_FILTER_LABELS[statusFilter] || 'All Invoices'}
                <ChevronDown className="dropdown-caret" />
              </button>
            </PortalDropdownTrigger>
            <PortalDropdownContent align="end" sideOffset={-4}>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <PortalDropdownItem
                  key={opt.value}
                  className={cn(statusFilter === opt.value && 'is-active')}
                  onSelect={() => setStatusFilter(opt.value)}
                >
                  {opt.label}
                </PortalDropdownItem>
              ))}
            </PortalDropdownContent>
          </PortalDropdown>

          {/* Create Invoice */}
          {onCreateInvoice && (
            <button className="btn-primary" onClick={onCreateInvoice}>
              <Plus className="icon-md" />
              New Invoice
            </button>
          )}
        </div>
      </div>

      {/* Invoices List */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message={statusFilter === 'all' ? 'No invoices yet.' : `No ${statusFilter} invoices.`}
        />
      ) : (
        <div className="panel contract-panel-no-padding">
          <table className="pd-full-width">
            <thead>
              <tr>
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  Invoice #
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  Amount
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  Status
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-left">
                  Due Date
                </th>
                <th scope="col" className="label pd-table-cell pd-cell-right">
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
                    className="pd-clickable-row"
                    onClick={() => setSelectedInvoice(invoice)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === KEYS.ENTER || e.key === KEYS.SPACE) { e.preventDefault(); setSelectedInvoice(invoice); } }}
                  >
                    <td className="pd-table-cell">
                      <span className="pd-highlight-value">
                        {invoice.invoice_number}
                      </span>
                    </td>
                    <td className="pd-table-cell">
                      <span className="pd-highlight-value">
                        {formatCurrency(invoice.amount_total)}
                      </span>
                    </td>
                    <td className="pd-table-cell">
                      <span className="badge">
                        {INVOICE_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                      </span>
                    </td>
                    <td className="pd-table-cell">
                      <span
                        className={cn(
                          isOverdue(invoice)
                            ? 'pd-highlight-value'
                            : 'text-secondary'
                        )}
                      >
                        {formatDate(invoice.due_date)}
                      </span>
                    </td>
                    <td className="pd-table-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="action-group">
                        {!isDraft && (
                          <button
                            className="icon-btn"
                            onClick={() => setPreviewInvoice(invoice)}
                            title="Preview PDF"
                            aria-label="Preview invoice PDF"
                          >
                            <Eye className="icon-md" />
                          </button>
                        )}

                        {canSend && (
                          <button
                            className="icon-btn"
                            onClick={() => handleSend(invoice.id)}
                            disabled={actionLoading?.type === 'send' && actionLoading?.id === invoice.id}
                            title="Send invoice"
                            aria-label="Send invoice"
                          >
                            <Send className="icon-md" />
                          </button>
                        )}

                        {canMarkPaid && (
                          <button
                            className="icon-btn"
                            onClick={() => {
                              setDeletingInvoiceId(invoice.id);
                              markPaidDialog.open();
                            }}
                            title="Mark as paid"
                            aria-label="Mark as paid"
                          >
                            <Check className="icon-md" />
                          </button>
                        )}

                        {!isDraft && onDownloadPdf && (
                          <button
                            className="icon-btn"
                            onClick={() => handleDownloadPdf(invoice.id)}
                            disabled={actionLoading?.type === 'download' && actionLoading?.id === invoice.id}
                            title="Download PDF"
                            aria-label="Download PDF"
                          >
                            <Download className="icon-md" />
                          </button>
                        )}

                        {!isPaid && onDeleteInvoice && (
                          <button
                            className="icon-btn icon-btn--danger"
                            onClick={() => {
                              setDeletingInvoiceId(invoice.id);
                              deleteDialog.open();
                            }}
                            title="Delete invoice"
                            aria-label="Delete invoice"
                          >
                            <Trash2 className="icon-md" />
                          </button>
                        )}
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

      {/* PDF Preview Modal */}
      <PortalModal
        open={!!previewInvoice}
        onOpenChange={(open) => { if (!open) setPreviewInvoice(null); }}
        title={previewInvoice?.invoice_number || 'Invoice Preview'}
        icon={<Eye />}
        size="lg"
        footer={
          previewInvoice && onDownloadPdf ? (
            <button className="btn-secondary" onClick={() => { handleDownloadPdf(previewInvoice.id); }}>
              <Download className="icon-sm" /> Download
            </button>
          ) : undefined
        }
      >
        {previewInvoice && (
          <div style={{ minHeight: '200px' }}>
            <iframe
              src={buildEndpoint.invoicePdf(previewInvoice.id)}
              title={`Preview ${previewInvoice.invoice_number}`}
              style={{ width: '100%', height: '70vh', border: 'none' }}
            />
          </div>
        )}
      </PortalModal>

      {/* Invoice Detail Panel */}
      <InvoiceDetailPanel
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onStatusChange={onStatusChange ? async (id, status) => { await onStatusChange(id, status); onRefresh?.(); } : undefined}
        onSend={onSendInvoice}
        onMarkPaid={onMarkPaid}
        onDownloadPdf={onDownloadPdf}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
        showNotification={showNotification}
      />
    </div>
  );
}
