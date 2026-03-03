import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileUp,
  FileCheck,
  AlertCircle,
  MoreHorizontal,
  Inbox,
  Trash2,
  Download,
  ChevronDown,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
} from '@react/components/portal/AdminTable';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { DOCUMENT_REQUESTS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';

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

interface DocumentRequestsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

const DOCUMENT_REQUEST_STATUS_CONFIG: Record<string, { label: string }> = {
  pending: { label: 'Pending' },
  submitted: { label: 'Submitted' },
  approved: { label: 'Approved' },
  rejected: { label: 'Rejected' },
  expired: { label: 'Expired' },
  viewed: { label: 'Viewed' },
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

export function DocumentRequestsTable({ getAuthToken, showNotification, onNavigate }: DocumentRequestsTableProps) {
  const containerRef = useFadeIn();

  // Build headers helper with auth token
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [stats, setStats] = useState<DocumentRequestStats>({
    total: 0,
    pending: 0,
    submitted: 0,
    approved: 0,
    overdue: 0,
  });

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
    storageKey: 'admin_document_requests',
    filters: DOCUMENT_REQUESTS_FILTER_CONFIG,
    filterFn: filterDocumentRequest,
    sortFn: sortDocumentRequests,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  // Apply filters
  const filteredRequests = useMemo(() => applyFilters(requests), [applyFilters, requests]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_document_requests_pagination',
    totalItems: filteredRequests.length,
    defaultPageSize: 25
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

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/document-requests', {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load document requests');
      const data = await response.json();
      const payload = data.data || data;
      setRequests(payload.requests || []);
      setStats(payload.stats || {
        total: 0,
        pending: 0,
        submitted: 0,
        approved: 0,
        overdue: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document requests');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Status change handler
  const handleStatusChange = useCallback(async (requestId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/document-requests/${requestId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update request');

      setRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? { ...request, status: newStatus as DocumentRequest['status'] }
            : request
        )
      );
      showNotification?.('Request status updated', 'success');
    } catch (err) {
      console.error('Failed to update request status:', err);
      showNotification?.('Failed to update request status', 'error');
    }
  }, [getHeaders, showNotification]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((r) => r.id);
    try {
      const response = await fetch('/api/document-requests/bulk-delete', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error('Failed to delete requests');

      setRequests((prev) => prev.filter((r) => !ids.includes(r.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} request${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      console.error('Failed to delete requests:', err);
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
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.submitted, label: 'submitted', variant: 'active', hideIfZero: true },
            { value: stats.approved, label: 'approved', variant: 'completed', hideIfZero: true },
            { value: stats.overdue, label: 'overdue', variant: 'overdue', hideIfZero: true },
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
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadRequests}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
      {!error && (
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
              className="name-col"
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Request
            </AdminTableHead>
            <AdminTableHead className="client-col">Client</AdminTableHead>
            <AdminTableHead className="status-col">Status</AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'dueDate' ? sort.direction : null}
              onClick={() => toggleSort('dueDate')}
            >
              Due Date
            </AdminTableHead>
            <AdminTableHead className="docs-col">Docs</AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedRequests.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No requests match your filters' : 'No document requests yet'}
            />
          ) : (
            paginatedRequests.map((request) => (
              <AdminTableRow
                key={request.id}
                clickable
                selected={selection.isSelected(request)}
              >
                <AdminTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(request)}
                    onCheckedChange={() => selection.toggleSelection(request)}
                    aria-label={`Select ${request.title}`}
                  />
                </AdminTableCell>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileUp className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{request.title}</span>
                      {request.description && (
                        <span className="cell-subtitle">{request.description}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', String(request.clientId));
                    }}
                    className="table-link"
                  >
                    {request.clientName}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <StatusBadge status={getStatusVariant(request.status)}>
                    {getStatusLabel(request.status)}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className={cn(isOverdue(request.dueDate) && 'text-danger')}>
                  {request.dueDate ? formatDate(request.dueDate) : '-'}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  {request.documents > 0 ? (
                    <span className="cell-with-icon">
                      <FileCheck className="cell-icon-sm" />
                      {request.documents}
                    </span>
                  ) : (
                    '-'
                  )}
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    {request.status === 'pending' && (
                      <IconButton action="send" title="Send Reminder" />
                    )}
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent>
                        {request.documents > 0 && (
                          <PortalDropdownItem>
                            <Download className="dropdown-icon" />
                            Download All
                          </PortalDropdownItem>
                        )}
                        <PortalDropdownItem className="text-danger">
                          <Trash2 className="dropdown-icon" />
                          Delete
                        </PortalDropdownItem>
                      </PortalDropdownContent>
                    </PortalDropdown>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>
      )}
    </TableLayout>
  );
}

export default DocumentRequestsTable;
