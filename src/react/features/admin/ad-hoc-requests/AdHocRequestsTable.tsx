import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  Zap,
  Inbox,
  User,
  ChevronDown
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
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
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { AD_HOC_REQUESTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { useListFetch } from '@react/factories/useDataFetch';
import type { SortConfig } from '../types';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

const logger = createLogger('AdHocRequestsTable');

interface AdHocRequest {
  id: number;
  title: string;
  description?: string;
  clientId: number;
  clientName: string;
  projectId?: number;
  projectName?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'on-hold';
  estimatedHours?: number;
  actualHours?: number;
  rate?: number;
  assignee?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AdHocRequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  totalRevenue: number;
  totalHours: number;
}

const DEFAULT_AD_HOC_STATS: AdHocRequestStats = {
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  totalRevenue: 0,
  totalHours: 0
};

interface AdHocRequestsTableProps {
  clientId?: string;
  projectId?: string;
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

const AD_HOC_STATUS_CONFIG: Record<string, { label: string }> = {
  pending: { label: 'Pending' },
  'in-progress': { label: 'In Progress' },
  completed: { label: 'Completed' },
  'on-hold': { label: 'On Hold' },
  cancelled: { label: 'Cancelled' }
};

// Filter function
function filterAdHocRequest(
  request: AdHocRequest,
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

  if (filters.priority && filters.priority !== 'all') {
    if (request.priority !== filters.priority) return false;
  }

  return true;
}

// Sort function
function sortAdHocRequests(a: AdHocRequest, b: AdHocRequest, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'priority': {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return multiplier * (order[a.priority] - order[b.priority]);
  }
  case 'dueDate':
    return multiplier * ((a.dueDate || '').localeCompare(b.dueDate || ''));
  case 'createdAt':
    return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  default:
    return 0;
  }
}

export function AdHocRequestsTable({ clientId, projectId, getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: AdHocRequestsTableProps) {
  const containerRef = useFadeIn();

  // Build endpoint with optional query params
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    return qs ? `${API_ENDPOINTS.AD_HOC_REQUESTS}?${qs}` : API_ENDPOINTS.AD_HOC_REQUESTS;
  }, [clientId, projectId]);

  // Data fetching via useListFetch
  const { data, isLoading, error, refetch, setData } = useListFetch<AdHocRequest, AdHocRequestStats>({
    endpoint,
    getAuthToken,
    defaultStats: DEFAULT_AD_HOC_STATS,
    itemsKey: 'requests',
    deps: [endpoint]
  });
  const requests = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_AD_HOC_STATS, [data]);

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
  } = useTableFilters<AdHocRequest>({
    storageKey: overviewMode ? undefined : 'admin_ad_hoc_requests',
    filters: AD_HOC_REQUESTS_FILTER_CONFIG,
    filterFn: filterAdHocRequest,
    sortFn: sortAdHocRequests,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  // Apply filters
  const filteredRequests = useMemo(() => applyFilters(requests), [applyFilters, requests]);

  // Pagination - overview mode disables persistence
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_ad_hoc_requests_pagination',
    totalItems: filteredRequests.length,
    defaultPageSize
  });

  const paginatedRequests = useMemo(
    () => pagination.paginate(filteredRequests),
    [pagination, filteredRequests]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (request: AdHocRequest) => request.id,
    items: paginatedRequests
  });

  // Status change handler
  const handleStatusChange = useCallback(async (requestId: number, newStatus: string) => {
    try {
      const response = await fetch(buildEndpoint.adHocRequest(requestId), {
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
            ? { ...request, status: newStatus as AdHocRequest['status'] }
            : request
        )
      } : prev);
      showNotification?.('Status updated', 'success');
    } catch (err) {
      logger.error('Failed to update request status:', err);
      showNotification?.('Failed to update status', 'error');
    }
  }, [getHeaders, showNotification]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((r) => r.id);
    try {
      const response = await fetch(API_ENDPOINTS.AD_HOC_REQUESTS_BULK_DELETE, {
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
      Object.entries(AD_HOC_STATUS_CONFIG).map(([value, config]) => ({
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

  function getPriorityColor(priority: string): string {
    switch (priority) {
    case 'urgent': return 'var(--status-cancelled)';
    case 'high': return 'var(--status-pending)';
    case 'medium': return 'var(--status-active)';
    case 'low': return 'var(--portal-text-muted)';
    default: return 'var(--portal-text-muted)';
    }
  }

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="AD-HOC REQUESTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.inProgress, label: 'in progress', variant: 'active' },
            { value: stats.completed, label: 'completed', variant: 'completed' }
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.inProgress} In Progress • ${stats.completed} Completed • ${stats.totalHours}h Total Hours • ${formatCurrency(stats.totalRevenue)} Revenue`}
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
            sections={AD_HOC_REQUESTS_FILTER_CONFIG}
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
            <PortalTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
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
            <PortalTableHead
              className="priority-col"
              sortable
              sortDirection={sort?.column === 'priority' ? sort.direction : null}
              onClick={() => toggleSort('priority')}
            >
              Priority
            </PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="hours-col">Hours</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'dueDate' ? sort.direction : null}
              onClick={() => toggleSort('dueDate')}
            >
              Due
            </PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={8} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={8} rows={5} />
          ) : paginatedRequests.length === 0 ? (
            <PortalTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No requests match your filters' : 'No ad-hoc requests yet'}
            />
          ) : (
            paginatedRequests.map((request) => (
              <PortalTableRow
                key={request.id}
                clickable
                selected={selection.isSelected(request)}
              >
                <PortalTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(request)}
                    onCheckedChange={() => selection.toggleSelection(request)}
                    aria-label={`Select ${request.title}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Zap className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{request.title}</span>
                      {request.assignee && (
                        <span className="cell-subtitle">
                          <User className="cell-icon-sm" />
                          {request.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', String(request.clientId));
                    }}
                    className="cell-link-btn"
                  >
                    {request.clientName}
                  </button>
                </PortalTableCell>
                <PortalTableCell>
                  <span
                    className="priority-badge"
                    style={{
                      color: getPriorityColor(request.priority),
                      backgroundColor: `color-mix(in srgb, ${getPriorityColor(request.priority)} 15%, transparent)`
                    }}
                  >
                    {request.priority}
                  </span>
                </PortalTableCell>
                <PortalTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button className="status-dropdown-trigger" aria-label="Change request status">
                        <StatusBadge status={getStatusVariant(request.status)} size="sm">
                          {AD_HOC_STATUS_CONFIG[request.status]?.label || request.status.replace('-', ' ')}
                        </StatusBadge>
                        <ChevronDown className="status-dropdown-caret" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent sideOffset={0} align="start">
                      {Object.entries(AD_HOC_STATUS_CONFIG)
                        .filter(([status]) => status !== request.status)
                        .map(([status, config]) => (
                          <PortalDropdownItem
                            key={status}
                            onClick={() => handleStatusChange(request.id, status)}
                          >
                            <StatusBadge status={getStatusVariant(status)} size="sm">
                              {config.label}
                            </StatusBadge>
                          </PortalDropdownItem>
                        ))}
                    </PortalDropdownContent>
                  </PortalDropdown>
                </PortalTableCell>
                <PortalTableCell className="text-right">
                  {request.actualHours !== undefined ? (
                    <span>
                      {request.actualHours}
                      {request.estimatedHours && (
                        <span className="text-muted">/{request.estimatedHours}h</span>
                      )}
                    </span>
                  ) : request.estimatedHours ? (
                    <span className="text-muted">{request.estimatedHours}h est</span>
                  ) : null}
                </PortalTableCell>
                <PortalTableCell className="date-cell">
                  {request.dueDate && formatDate(request.dueDate)}
                </PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    <IconButton action="edit" title="Edit" />
                    {request.status === 'pending' && (
                      <IconButton action="start" title="Start" onClick={() => handleStatusChange(request.id, 'in-progress')} />
                    )}
                    {request.status === 'in-progress' && (
                      <IconButton action="pause" title="Put On Hold" onClick={() => handleStatusChange(request.id, 'on-hold')} />
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
