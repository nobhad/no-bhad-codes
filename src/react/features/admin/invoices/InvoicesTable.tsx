import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox, Download, RefreshCw, Eye, Send, Check, FileText } from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableHead,
  AdminTableRow,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading
} from '@react/components/portal/AdminTable';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useInvoices } from '@react/hooks/useInvoices';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useSelection } from '@react/hooks/useSelection';
import { useExport } from '@react/hooks/useExport';
import { useFadeIn } from '@react/hooks/useGsap';
import { INVOICES_EXPORT_CONFIG } from '../../../../utils/table-export';
import type { Invoice, InvoiceStatus, SortConfig } from '../types';
import { INVOICE_STATUS_CONFIG } from '../types';
import { formatDate } from '@react/utils/formatDate';

interface InvoicesTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when invoice is selected for detail view */
  onViewInvoice?: (invoiceId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Filter configuration for useTableFilters
const FILTER_CONFIG = [
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'all', label: 'All Statuses' },
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'pending', label: 'Pending' },
      { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' }
    ]
  }
];

// Filter dropdown sections for FilterDropdown component
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' }
];

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

// Filter function
function filterInvoice(
  invoice: Invoice,
  filters: Record<string, string>,
  search: string
): boolean {
  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(searchLower) ||
      invoice.client_name?.toLowerCase().includes(searchLower) ||
      invoice.project_name?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    const displayStatus = getDisplayStatus(invoice);
    if (filters.status === 'overdue') {
      if (!isOverdue(invoice)) return false;
    } else if (displayStatus !== filters.status) {
      return false;
    }
  }

  return true;
}

// Sort function
function sortInvoices(a: Invoice, b: Invoice, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
    case 'invoice_number':
      return multiplier * (a.invoice_number || '').localeCompare(b.invoice_number || '');
    case 'client':
      return multiplier * (a.client_name || '').localeCompare(b.client_name || '');
    case 'amount':
      const aAmount = typeof a.amount_total === 'string' ? parseFloat(a.amount_total) : (a.amount_total || 0);
      const bAmount = typeof b.amount_total === 'string' ? parseFloat(b.amount_total) : (b.amount_total || 0);
      return multiplier * (aAmount - bAmount);
    case 'status':
      return multiplier * getDisplayStatus(a).localeCompare(getDisplayStatus(b));
    case 'due_date':
      return (
        multiplier *
        (new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime())
      );
    default:
      return 0;
  }
}

// Format currency
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
 * InvoicesTable
 * React implementation of the admin invoices table
 */
export function InvoicesTable({
  getAuthToken,
  onViewInvoice,
  showNotification
}: InvoicesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const {
    invoices,
    isLoading,
    error,
    stats,
    refetch,
    updateInvoice,
    markAsPaid,
    sendInvoice,
    downloadPdf,
    bulkDelete,
    bulkMarkPaid,
    bulkSend
  } = useInvoices({ getAuthToken });

  // Confirmation dialogs
  const deleteDialog = useConfirmDialog();
  const markPaidDialog = useConfirmDialog();
  const sendDialog = useConfirmDialog();

  // Filtering and sorting
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    clearFilters,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Invoice>({
    storageKey: 'admin_invoices',
    filters: FILTER_CONFIG,
    filterFn: filterInvoice,
    sortFn: sortInvoices,
    defaultSort: { column: 'due_date', direction: 'desc' }
  });

  // Apply filters to get filtered data
  const filteredInvoices = useMemo(() => applyFilters(invoices), [applyFilters, invoices]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_invoices_pagination',
    totalItems: filteredInvoices.length,
    defaultPageSize: 25
  });

  // Get paginated data
  const paginatedInvoices = useMemo(
    () => pagination.paginate(filteredInvoices),
    [pagination, filteredInvoices]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (invoice: Invoice) => invoice.id,
    items: paginatedInvoices
  });

  // Export functionality
  const { exportCsv, isExporting } = useExport({
    config: INVOICES_EXPORT_CONFIG,
    data: filteredInvoices,
    onExport: (count) => {
      showNotification?.(`Exported ${count} invoice${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Action loading states
  const [actionLoading, setActionLoading] = useState<{ type: string; id: number } | null>(null);

  // Handle bulk mark paid
  const handleBulkMarkPaid = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((i) => i.id);
    const result = await bulkMarkPaid(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Marked ${result.success} invoice${result.success !== 1 ? 's' : ''} as paid`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Marked ${result.success} paid, failed ${result.failed}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to mark invoices as paid', 'error');
    }

    refetch();
  }, [selection, bulkMarkPaid, showNotification, refetch]);

  // Handle bulk send
  const handleBulkSend = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((i) => i.id);
    const result = await bulkSend(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Sent ${result.success} invoice${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Sent ${result.success}, failed ${result.failed}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to send invoices', 'error');
    }

    refetch();
  }, [selection, bulkSend, showNotification, refetch]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((i) => i.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Deleted ${result.success} invoice${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Deleted ${result.success}, failed ${result.failed}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to delete invoices', 'error');
    }

    refetch();
  }, [selection, bulkDelete, showNotification, refetch]);

  // Handle single invoice actions
  const handleMarkPaid = useCallback(
    async (invoiceId: number) => {
      setActionLoading({ type: 'markPaid', id: invoiceId });
      const success = await markAsPaid(invoiceId);
      setActionLoading(null);

      if (success) {
        showNotification?.('Invoice marked as paid', 'success');
      } else {
        showNotification?.('Failed to mark invoice as paid', 'error');
      }
    },
    [markAsPaid, showNotification]
  );

  const handleSend = useCallback(
    async (invoiceId: number) => {
      setActionLoading({ type: 'send', id: invoiceId });
      const success = await sendInvoice(invoiceId);
      setActionLoading(null);

      if (success) {
        showNotification?.('Invoice sent', 'success');
      } else {
        showNotification?.('Failed to send invoice', 'error');
      }
    },
    [sendInvoice, showNotification]
  );

  const handleDownloadPdf = useCallback(
    async (invoiceId: number) => {
      setActionLoading({ type: 'download', id: invoiceId });
      try {
        await downloadPdf(invoiceId);
        showNotification?.('PDF downloaded', 'success');
      } catch {
        showNotification?.('Failed to download PDF', 'error');
      }
      setActionLoading(null);
    },
    [downloadPdf, showNotification]
  );

  // Handle view invoice
  const handleViewInvoice = useCallback(
    (invoiceId: number) => {
      onViewInvoice?.(invoiceId);
    },
    [onViewInvoice]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (invoice: Invoice) => {
      handleViewInvoice(invoice.id);
    },
    [handleViewInvoice]
  );

  // Custom bulk actions
  const bulkActions = useMemo(
    () => [
      {
        id: 'markPaid',
        label: 'Mark Paid',
        onClick: markPaidDialog.open
      },
      {
        id: 'send',
        label: 'Send',
        onClick: sendDialog.open
      }
    ],
    [markPaidDialog.open, sendDialog.open]
  );

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="INVOICES"
        stats={
          <TableStats
            items={[
              { value: stats.total, label: 'total' },
              { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
              { value: stats.overdue, label: 'overdue', variant: 'overdue', hideIfZero: true }
            ]}
            tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.paid} Paid • ${stats.overdue} Overdue`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search invoices..."
            />
            <FilterDropdown
              sections={[
                { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS }
              ]}
              values={{ status: filterValues.status || 'all' }}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton
              action="download"
              onClick={exportCsv}
              disabled={isExporting || filteredInvoices.length === 0}
              title="Export to CSV"
            />
            <IconButton
              action="refresh"
              onClick={refetch}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
        bulkActions={
          <BulkActionsToolbar
            selectedCount={selection.selectedCount}
            totalCount={filteredInvoices.length}
            onClearSelection={selection.clearSelection}
            onSelectAll={() => selection.selectMany(filteredInvoices)}
            allSelected={selection.allSelected && selection.selectedCount === filteredInvoices.length}
            actions={bulkActions}
            onDelete={deleteDialog.open}
            deleteLoading={deleteDialog.isLoading}
          />
        }
        error={
          error ? (
            <div className="table-error-banner">
              {error}
              <button className="btn btn-secondary btn-sm" onClick={refetch}>Retry</button>
            </div>
          ) : undefined
        }
        pagination={
          !isLoading && filteredInvoices.length > 0 ? (
            <TablePagination
              pageInfo={pagination.pageInfo}
              page={pagination.page}
              pageSize={pagination.pageSize}
              pageSizeOptions={pagination.pageSizeOptions}
              canGoPrev={pagination.canGoPrev}
              canGoNext={pagination.canGoNext}
              onPageSizeChange={pagination.setPageSize}
              onFirstPage={pagination.firstPage}
              onPrevPage={pagination.prevPage}
              onNextPage={pagination.nextPage}
              onLastPage={pagination.lastPage}
            />
          ) : undefined
        }
      >
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleSelectAll}
                  aria-label="Select all"
                />
              </AdminTableHead>
              <AdminTableHead
                className="invoice-col"
                sortable
                sortDirection={sort?.column === 'invoice_number' ? sort.direction : null}
                onClick={() => toggleSort('invoice_number')}
              >
                Invoice #
              </AdminTableHead>
              <AdminTableHead
                className="contact-col"
                sortable
                sortDirection={sort?.column === 'client' ? sort.direction : null}
                onClick={() => toggleSort('client')}
              >
                Client / Project
              </AdminTableHead>
              <AdminTableHead
                className="amount-col"
                sortable
                sortDirection={sort?.column === 'amount' ? sort.direction : null}
                onClick={() => toggleSort('amount')}
              >
                Amount
              </AdminTableHead>
              <AdminTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'due_date' ? sort.direction : null}
                onClick={() => toggleSort('due_date')}
              >
                Due Date
              </AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={7} rows={5} />
            ) : paginatedInvoices.length === 0 ? (
              <AdminTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No invoices match your filters' : 'No invoices yet'}
              />
            ) : (
              paginatedInvoices.map((invoice) => {
                const displayStatus = getDisplayStatus(invoice);
                const isDraft = invoice.status === 'draft';
                const isPaid = invoice.status === 'paid';
                const canMarkPaid = !isPaid && !isDraft;
                const canSend = isDraft;
                const canDownload = !isDraft;

                return (
                  <AdminTableRow
                    key={invoice.id}
                    clickable
                    selected={selection.isSelected(invoice)}
                    onClick={() => handleRowClick(invoice)}
                  >
                    {/* Checkbox */}
                    <AdminTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.isSelected(invoice)}
                        onCheckedChange={() => selection.toggleSelection(invoice)}
                        aria-label={`Select invoice ${invoice.invoice_number}`}
                      />
                    </AdminTableCell>

                    {/* Invoice Number */}
                    <AdminTableCell className="invoice-cell">
                      <span className="mono-text">{invoice.invoice_number || '-'}</span>
                    </AdminTableCell>

                    {/* Client / Project */}
                    <AdminTableCell className="contact-cell">
                      <div className="cell-content">
                        <span className="cell-title">{invoice.client_name || 'Unknown Client'}</span>
                        <span className="cell-subtitle">{invoice.project_name || '-'}</span>
                      </div>
                    </AdminTableCell>

                    {/* Amount */}
                    <AdminTableCell className="amount-cell">
                      {formatCurrency(invoice.amount_total)}
                    </AdminTableCell>

                    {/* Status */}
                    <AdminTableCell className="status-cell">
                      <StatusBadge status={getStatusVariant(displayStatus)}>
                        {INVOICE_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                      </StatusBadge>
                    </AdminTableCell>

                    {/* Due Date */}
                    <AdminTableCell className="date-cell">
                      {invoice.due_date ? formatDate(invoice.due_date) : '-'}
                    </AdminTableCell>

                    {/* Actions */}
                    <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
                        <IconButton
                          action="view"
                          onClick={() => handleViewInvoice(invoice.id)}
                          title="View invoice"
                        />

                        {canSend && (
                          <IconButton
                            action="send"
                            onClick={() => handleSend(invoice.id)}
                            disabled={actionLoading?.type === 'send' && actionLoading?.id === invoice.id}
                            title="Send invoice"
                          />
                        )}

                        {canMarkPaid && (
                          <IconButton
                            action="markPaid"
                            onClick={() => handleMarkPaid(invoice.id)}
                            disabled={actionLoading?.type === 'markPaid' && actionLoading?.id === invoice.id}
                            title="Mark as paid"
                          />
                        )}

                        {canDownload && (
                          <IconButton
                            action="pdf"
                            onClick={() => handleDownloadPdf(invoice.id)}
                            disabled={actionLoading?.type === 'download' && actionLoading?.id === invoice.id}
                            title="Download PDF"
                          />
                        )}
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminTable>
      </TableLayout>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Invoices"
        description={`Are you sure you want to delete ${selection.selectedCount} invoice${selection.selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleBulkDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />

      {/* Mark Paid Confirmation Dialog */}
      <ConfirmDialog
        open={markPaidDialog.isOpen}
        onOpenChange={markPaidDialog.setIsOpen}
        title="Mark Invoices as Paid"
        description={`Mark ${selection.selectedCount} invoice${selection.selectedCount !== 1 ? 's' : ''} as paid?`}
        confirmText="Mark Paid"
        cancelText="Cancel"
        onConfirm={handleBulkMarkPaid}
        variant="info"
        loading={markPaidDialog.isLoading}
      />

      {/* Send Confirmation Dialog */}
      <ConfirmDialog
        open={sendDialog.isOpen}
        onOpenChange={sendDialog.setIsOpen}
        title="Send Invoices"
        description={`Send ${selection.selectedCount} invoice${selection.selectedCount !== 1 ? 's' : ''}?`}
        confirmText="Send"
        cancelText="Cancel"
        onConfirm={handleBulkSend}
        variant="info"
        loading={sendDialog.isLoading}
      />
    </>
  );
}
