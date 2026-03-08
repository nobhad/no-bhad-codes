import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  FileUp,
  FileCheck,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { cn } from '@react/lib/utils';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { DOCUMENT_REQUESTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { useListFetch } from '@react/factories/useDataFetch';
import type { SortConfig } from '../types';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

const logger = createLogger('DocumentRequestsTable');

interface DocumentRequest {
  id: number;
  title: string;
  description?: string;
  clientId: number;
  clientName: string;
  projectId?: number;
  projectName?: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';
  dueDate?: string;
  submittedAt?: string;
  documents: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentRequestStats {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  overdue: number;
}

const DEFAULT_DOCUMENT_REQUEST_STATS: DocumentRequestStats = {
  total: 0,
  pending: 0,
  submitted: 0,
  approved: 0,
  overdue: 0
};

interface DocumentRequestsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

const DOCUMENT_REQUEST_STATUS_CONFIG: Record<string, { label: string }> = {
  pending: { label: 'Pending' },
  submitted: { label: 'Submitted' },
  approved: { label: 'Approved' },
  rejected: { label: 'Rejected' },
  expired: { label: 'Expired' },
  viewed: { label: 'Viewed' }
};

// Capitalize status label (fallback for unknown statuses)
function getStatusLabel(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  if (DOCUMENT_REQUEST_STATUS_CONFIG[status]) {
    return DOCUMENT_REQUEST_STATUS_CONFIG[status].label;
  }
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// Filter function
function filterDocumentRequest(
  request: DocumentRequest,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      request.title.toLowerCase().includes(searchLower) ||
      request.clientName.toLowerCase().includes(searchLower) ||
      request.projectName?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (request.status !== filters.status) return false;
  }

  return true;
}

// Sort function
function sortDocumentRequests(a: DocumentRequest, b: DocumentRequest, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'client':
    return multiplier * a.clientName.localeCompare(b.clientName);
  case 'dueDate':
    return multiplier * ((a.dueDate || '').localeCompare(b.dueDate || ''));
  case 'createdAt':
    return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  default:
    return 0;
  }
}

export function DocumentRequestsTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: DocumentRequestsTableProps) {
  const containerRef = useFadeIn();

  // Data fetching via useListFetch
  const { data, isLoading, error, refetch, setData } = useListFetch<DocumentRequest, DocumentRequestStats>({
    endpoint: API_ENDPOINTS.DOCUMENT_REQUESTS,
    getAuthToken,
    defaultStats: DEFAULT_DOCUMENT_REQUEST_STATS,
    itemsKey: 'requests'
  });
  const requests = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_DOCUMENT_REQUEST_STATS, [data]);

  // Build headers helper for mutation calls
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

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
  } = useTableFilters<DocumentRequest>({
    storageKey: overviewMode ? undefined : 'admin_document_requests',
    filters: DOCUMENT_REQUESTS_FILTER_CONFIG,
    filterFn: filterDocumentRequest,
    sortFn: sortDocumentRequests,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  // Apply filters
  const filteredRequests = useMemo(() => applyFilters(requests), [applyFilters, requests]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_document_requests_pagination',
    totalItems: filteredRequests.length,
    defaultPageSize
  });

  const paginatedRequests = useMemo(
    () => pagination.paginate(filteredRequests),
    [pagination, filteredRequests]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (request: DocumentRequest) => request.id,
    items: paginatedRequests
  });

  // Status change handler
  const handleStatusChange = useCallback(async (requestId: number, newStatus: string) => {
    try {
      const response = await fetch(buildEndpoint.documentRequest(requestId), {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update request');

      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((request) =>
          request.id === requestId
            ? { ...request, status: newStatus as DocumentRequest['status'] }
            : request
        )
      } : prev);
      showNotification?.('Request status updated', 'success');
    } catch (err) {
      logger.error('Failed to update request status:', err);
      showNotification?.('Failed to update request status', 'error');
    }
  }, [getHeaders, showNotification]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((r) => r.id);
    try {
      const response = await fetch(API_ENDPOINTS.DOCUMENT_REQUESTS_BULK_DELETE, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Failed to delete requests');

      setData((prev) => prev ? { ...prev, items: prev.items.filter((r) => !ids.includes(r.id)) } : prev);
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} request${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to delete requests:', err);
      showNotification?.('Failed to delete requests', 'error');
    }
  }, [selection, getHeaders, showNotification]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(DOCUMENT_REQUEST_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`
      })),
    []
  );

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      for (const request of selection.selectedItems) {
        await handleStatusChange(request.id, newStatus);
      }
      selection.clearSelection();
    },
    [selection, handleStatusChange]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  function isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DOCUMENT REQUESTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.submitted, label: 'submitted', variant: 'active' },
            { value: stats.approved, label: 'approved', variant: 'completed' },
            { value: stats.overdue, label: 'overdue', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.submitted} Submitted • ${stats.approved} Approved • ${stats.overdue} Overdue`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search requests..."
          />
          <FilterDropdown
            sections={DOCUMENT_REQUESTS_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredRequests.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" title="New Request" />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredRequests.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredRequests)}
          allSelected={selection.allSelected && selection.selectedCount === filteredRequests.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
      }
      pagination={
        !isLoading && filteredRequests.length > 0 ? (
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
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Request
            </PortalTableHead>
            <PortalTableHead className="client-col">Client</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'dueDate' ? sort.direction : null}
              onClick={() => toggleSort('dueDate')}
            >
              Due Date
            </PortalTableHead>
            <PortalTableHead className="docs-col">Docs</PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={7} rows={5} />
          ) : paginatedRequests.length === 0 ? (
            <PortalTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No requests match your filters' : 'No document requests yet'}
            />
          ) : (
            paginatedRequests.map((request) => (
              <PortalTableRow
                key={request.id}
                clickable
                selected={selection.isSelected(request)}
              >
                <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(request)}
                    onCheckedChange={() => selection.toggleSelection(request)}
                    aria-label={`Select ${request.title}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileUp className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{request.title}</span>
                      {request.description && (
                        <span className="cell-subtitle">{request.description}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', String(request.clientId));
                    }}
                    className="table-link"
                  >
                    {request.clientName}
                  </span>
                </PortalTableCell>
                <PortalTableCell>
                  <StatusBadge status={getStatusVariant(request.status)}>
                    {getStatusLabel(request.status)}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className={cn(isOverdue(request.dueDate) && 'text-danger')}>
                  {request.dueDate && formatDate(request.dueDate)}
                </PortalTableCell>
                <PortalTableCell className="text-right">
                  {request.documents > 0 && (
                    <span className="cell-with-icon">
                      <FileCheck className="cell-icon-sm" />
                      {request.documents}
                    </span>
                  )}
                </PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    {request.status === 'pending' && (
                      <IconButton action="remind" title="Send Reminder" />
                    )}
                    {request.documents > 0 && (
                      <IconButton action="download" title="Download All" />
                    )}
                    <IconButton action="delete" title="Delete" />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
