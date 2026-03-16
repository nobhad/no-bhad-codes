/**
 * PortalInvoicesTable
 * Client portal invoices list with summary and actions
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { IconButton } from '@react/factories';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty
} from '@react/components/portal/PortalTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePortalInvoices } from '@react/hooks/usePortalInvoices';
import { PORTAL_INVOICE_STATUS_CONFIG } from '../types';
import { PORTAL_INVOICES_FILTER_CONFIG } from '../shared/filterConfigs';
import type { PortalInvoice, PortalViewProps } from '../types';
import { formatCardDate, formatCurrency } from '@react/utils/cardFormatters';
import { createLogger } from '@/utils/logger';
import { apiFetch } from '@/utils/api-client';
import { downloadInvoicePdf } from '@/utils/file-download';
import { buildEndpoint } from '@/constants/api-endpoints';

const logger = createLogger('PortalInvoicesTable');

interface PortalInvoicesTableProps extends PortalViewProps {}

/**
 * Filter invoice by search and status
 */
function filterInvoice(
  invoice: PortalInvoice,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      invoice.invoice_number?.toLowerCase().includes(s) ||
      invoice.project_name?.toLowerCase().includes(s) ||
      String(invoice.amount_total).includes(s);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(invoice.status)) return false;
  }

  return true;
}

/**
 * Sort invoices by column
 */
function sortInvoices(
  a: PortalInvoice,
  b: PortalInvoice,
  sort: { column: string; direction: 'asc' | 'desc' }
): number {
  const m = sort.direction === 'asc' ? 1 : -1;
  switch (sort.column) {
  case 'invoice_number':
    return m * (a.invoice_number || '').localeCompare(b.invoice_number || '');
  case 'project':
    return m * (a.project_name || '').localeCompare(b.project_name || '');
  case 'date':
    return m * (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  case 'amount':
    return m * ((a.amount_total || 0) - (b.amount_total || 0));
  case 'status':
    return m * (a.status || '').localeCompare(b.status || '');
  default:
    return 0;
  }
}

/**
 * PortalInvoicesTable Component
 */
export function PortalInvoicesTable({
  getAuthToken,
  showNotification
}: PortalInvoicesTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const { invoices, summary, isLoading, error, refetch } = usePortalInvoices({
    getAuthToken
  });

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters
  } = useTableFilters<PortalInvoice>({
    storageKey: 'portal_invoices',
    filters: PORTAL_INVOICES_FILTER_CONFIG,
    filterFn: filterInvoice,
    sortFn: sortInvoices,
    defaultSort: { column: 'date', direction: 'desc' }
  });

  const filteredInvoices = useMemo(() => applyFilters(invoices), [applyFilters, invoices]);

  // Handle preview invoice
  const handlePreview = (invoice: PortalInvoice) => {
    window.open(`${buildEndpoint.invoicePdf(invoice.id)}?preview=true`, '_blank');
  };

  // Handle download invoice
  const handleDownload = async (invoice: PortalInvoice) => {
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoice_number);
    } catch (err) {
      logger.error('Error downloading invoice:', err);
    }
  };

  // Handle download receipt
  const handleDownloadReceipt = async (invoice: PortalInvoice) => {
    try {
      const receiptsResponse = await apiFetch(buildEndpoint.receiptsByInvoice(invoice.id));

      if (!receiptsResponse.ok) {
        throw new Error('Failed to fetch receipts');
      }

      const receiptsData = await receiptsResponse.json();
      const receipts = receiptsData.receipts || [];

      if (receipts.length === 0) {
        showNotification?.('No receipt found for this invoice', 'warning');
        return;
      }

      const latestReceipt = receipts[0];
      const pdfResponse = await apiFetch(buildEndpoint.receiptPdf(latestReceipt.id));

      if (!pdfResponse.ok) {
        throw new Error('Failed to download receipt');
      }

      const blob = await pdfResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${latestReceipt.receipt_number || invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showNotification?.('Receipt downloaded successfully', 'success');
    } catch (err) {
      logger.error('Error downloading receipt:', err);
      showNotification?.('Failed to download receipt', 'error');
    }
  };

  return (
    <TableLayout
      containerRef={containerRef}
      title="INVOICES"
      stats={
        <TableStats items={[
          { value: invoices.length, label: 'total' },
          { value: formatCurrency(summary.totalOutstanding), label: 'outstanding', variant: 'pending' },
          { value: formatCurrency(summary.totalPaid), label: 'paid', variant: 'completed' }
        ]} />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search invoices..." />
          <FilterDropdown
            sections={PORTAL_INVOICES_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading invoices..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="invoice-col" sortable sortDirection={sort?.column === 'invoice_number' ? sort.direction : null} onClick={() => toggleSort('invoice_number')}>Invoice</PortalTableHead>
              <PortalTableHead className="project-col" sortable sortDirection={sort?.column === 'project' ? sort.direction : null} onClick={() => toggleSort('project')}>Project</PortalTableHead>
              <PortalTableHead className="date-col" sortable sortDirection={sort?.column === 'date' ? sort.direction : null} onClick={() => toggleSort('date')}>Date</PortalTableHead>
              <PortalTableHead className="amount-col" sortable sortDirection={sort?.column === 'amount' ? sort.direction : null} onClick={() => toggleSort('amount')}>Amount</PortalTableHead>
              <PortalTableHead className="status-col" sortable sortDirection={sort?.column === 'status' ? sort.direction : null} onClick={() => toggleSort('status')}>Status</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>
          <PortalTableBody animate>
            {filteredInvoices.length === 0 ? (
              <PortalTableEmpty
                colSpan={6}
                icon={<Inbox className="icon-lg" />}
                message={invoices.length === 0
                  ? 'No invoices yet. Your first invoice will appear here once your project begins.'
                  : 'No invoices match the current filters.'
                }
              />
            ) : (
              filteredInvoices.map((invoice) => {
                const showReceipt = invoice.status === 'paid' || invoice.status === 'partial';

                return (
                  <PortalTableRow key={invoice.id}>
                    <PortalTableCell className="invoice-cell" label="Invoice">
                      <span className="mono-text">{invoice.invoice_number}</span>
                    </PortalTableCell>
                    <PortalTableCell className="project-cell" label="Project">
                      <div className="cell-content">
                        <span className="cell-title">{invoice.project_name || 'Project'}</span>
                        {/* Stacked content for responsive */}
                        <span className="invoice-stacked">{invoice.invoice_number}</span>
                        <span className="amount-stacked">{formatCurrency(invoice.amount_total)}</span>
                        <span className="date-stacked">{formatCardDate(invoice.created_at)}</span>
                      </div>
                    </PortalTableCell>
                    <PortalTableCell className="date-col" label="Date">
                      {formatCardDate(invoice.created_at)}
                    </PortalTableCell>
                    <PortalTableCell className="amount-col" label="Amount">
                      {formatCurrency(invoice.amount_total)}
                    </PortalTableCell>
                    <PortalTableCell className="status-col" label="Status">
                      <StatusBadge status={getStatusVariant(invoice.status)}>
                        {PORTAL_INVOICE_STATUS_CONFIG[invoice.status]?.label || invoice.status}
                      </StatusBadge>
                    </PortalTableCell>
                    <PortalTableCell className="col-actions">
                      <div className="action-group">
                        <IconButton
                          action="view"
                          onClick={() => handlePreview(invoice)}
                          title="Preview"
                        />
                        <IconButton
                          action="download"
                          onClick={() => handleDownload(invoice)}
                          title="Download Invoice"
                        />
                        {showReceipt && (
                          <IconButton
                            action="download"
                            onClick={() => handleDownloadReceipt(invoice)}
                            title="Download Receipt"
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
      )}
    </TableLayout>
  );
}
