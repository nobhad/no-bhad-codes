import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox, Receipt } from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
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
import { INVOICES_EXPORT_CONFIG } from '@/utils/table-export';
import type { Invoice, InvoiceStatus, SortConfig } from '../types';
import { INVOICE_STATUS_CONFIG } from '../types';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
import { INVOICES_FILTER_CONFIG } from '../shared/filterConfigs';
import { decodeHtmlEntities } from '@react/utils/decodeText';

interface InvoicesTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when invoice is selected for detail view */
  onViewInvoice?: (invoiceId: number) => void;
  /** Navigation callback */
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
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
  case 'amount': {
    const aAmount = typeof a.amount_total === 'string' ? parseFloat(a.amount_total) : (a.amount_total || 0);
    const bAmount = typeof b.amount_total === 'string' ? parseFloat(b.amount_total) : (b.amount_total || 0);
    return multiplier * (aAmount - bAmount);
  }
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

/**
 * InvoicesTable
 * React implementation of the admin invoices table
 */
export function InvoicesTable({
  getAuthToken,
  onViewInvoice,
  onNavigate,
  showNotification,
  defaultPageSize = 25,
  overviewMode = false
}: InvoicesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const {
    invoices,
    isLoading,
    error,
    stats,
    refetch,
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
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Invoice>({
    storageKey: overviewMode ? undefined : 'admin_invoices',
    filters: INVOICES_FILTER_CONFIG,
    filterFn: filterInvoice,
    sortFn: sortInvoices,
    defaultSort: { column: 'due_date', direction: 'desc' }
  });

  // Apply filters to get filtered data
  const filteredInvoices = useMemo(() => applyFilters(invoices), [applyFilters, invoices]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_invoices_pagination',
    totalItems: filteredInvoices.length,
    defaultPageSize
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
      if (onViewInvoice) {
        onViewInvoice(invoiceId);
      } else if (onNavigate) {
        onNavigate('invoice-detail', String(invoiceId));
      }
    },
    [onViewInvoice, onNavigate]
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
              { value: stats.pending, label: 'pending', variant: 'pending' },
              { value: stats.overdue, label: 'overdue', variant: 'overdue' }
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
              sections={INVOICES_FILTER_CONFIG}
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
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleSelectAll}
                  aria-label="Select all"
                />
              </PortalTableHead>
              <PortalTableHead
                className="name-col"
                sortable
                sortDirection={sort?.column === 'invoice_number' ? sort.direction : null}
                onClick={() => toggleSort('invoice_number')}
              >
                Invoice
              </PortalTableHead>
              <PortalTableHead
                className="client-col"
                sortable
                sortDirection={sort?.column === 'client' ? sort.direction : null}
                onClick={() => toggleSort('client')}
              >
                Client
              </PortalTableHead>
              <PortalTableHead
                className="amount-col"
                sortable
                sortDirection={sort?.column === 'amount' ? sort.direction : null}
                onClick={() => toggleSort('amount')}
              >
                Amount
              </PortalTableHead>
              <PortalTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'due_date' ? sort.direction : null}
                onClick={() => toggleSort('due_date')}
              >
                Due Date
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : paginatedInvoices.length === 0 ? (
              <PortalTableEmpty
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
                  <PortalTableRow
                    key={invoice.id}
                    clickable
                    selected={selection.isSelected(invoice)}
                    onClick={() => handleRowClick(invoice)}
                  >
                    {/* Checkbox */}
                    <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.isSelected(invoice)}
                        onCheckedChange={() => selection.toggleSelection(invoice)}
                        aria-label={`Select invoice ${invoice.invoice_number}`}
                      />
                    </PortalTableCell>

                    {/* Invoice */}
                    <PortalTableCell className="primary-cell">
                      <div className="cell-with-icon">
                        <Receipt className="cell-icon" />
                        <div className="cell-content">
                          <span className="cell-title">{invoice.invoice_number}</span>
                          {invoice.project_name && <span className="cell-subtitle">{decodeHtmlEntities(invoice.project_name)}</span>}
                        </div>
                      </div>
                    </PortalTableCell>

                    {/* Client */}
                    <PortalTableCell className="client-cell">
                      {decodeHtmlEntities(invoice.client_name) || 'Unknown Client'}
                    </PortalTableCell>

                    {/* Amount */}
                    <PortalTableCell className="amount-cell">
                      {formatCurrency(invoice.amount_total)}
                    </PortalTableCell>

                    {/* Status */}
                    <PortalTableCell className="status-cell">
                      <StatusBadge status={getStatusVariant(displayStatus)}>
                        {INVOICE_STATUS_CONFIG[displayStatus]?.label || displayStatus}
                      </StatusBadge>
                    </PortalTableCell>

                    {/* Due Date */}
                    <PortalTableCell className="date-cell">
                      {invoice.due_date && formatDate(invoice.due_date)}
                    </PortalTableCell>

                    {/* Actions */}
                    <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
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
                    </PortalTableCell>
                  </PortalTableRow>
                );
              })
            )}
          </PortalTableBody>
        </PortalTable>
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
