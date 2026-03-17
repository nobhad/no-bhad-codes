import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Zap,
  Inbox,
  User
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatCurrency } from '@/utils/format-utils';
import { StatusDropdownCell } from '@react/components/portal/StatusDropdownCell';
import { InlineEdit } from '@react/components/portal/InlineEdit';
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
import { useEntityOptions } from '@react/hooks/useEntityOptions';
import { AD_HOC_REQUESTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { useListFetch } from '@react/factories/useDataFetch';
import type { SortConfig } from '../types';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost, apiFetch } from '@/utils/api-client';
import { executeUpdateWithToast, executeWithToast } from '@/utils/api-wrappers';
import { useExport, AD_HOC_REQUESTS_EXPORT_CONFIG } from '@react/hooks/useExport';
import { CreateAdHocRequestModal } from '../modals/CreateEntityModals';

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
  filters: Record<string, string[]>,
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

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(request.status)) return false;
  }

  const priorityFilter = filters.priority;
  if (priorityFilter && priorityFilter.length > 0) {
    if (!priorityFilter.includes(request.priority)) return false;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const { clientOptions: entityClients, projectOptions: entityProjects } = useEntityOptions(createOpen);

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

  const { exportCsv, isExporting } = useExport({
    config: AD_HOC_REQUESTS_EXPORT_CONFIG,
    data: filteredRequests,
    onExport: (count) => {
      showNotification?.(`Exported ${count} item${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

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
    await executeUpdateWithToast(
      'status',
      () => apiFetch(buildEndpoint.adHocRequest(requestId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }),
      () => setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((request) =>
          request.id === requestId
            ? { ...request, status: newStatus as AdHocRequest['status'] }
            : request
        )
      } : prev)
    );
  }, [setData]);

  // Generic field update handler
  const handleFieldUpdate = useCallback(async (requestId: number, field: string, value: string): Promise<boolean> => {
    let success = false;
    await executeUpdateWithToast(
      field,
      () => apiFetch(buildEndpoint.adHocRequest(requestId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      }),
      () => {
        setData((prev) => prev ? {
          ...prev,
          items: prev.items.map((request) =>
            request.id === requestId
              ? { ...request, [field]: value }
              : request
          )
        } : prev);
        success = true;
      }
    );
    return success;
  }, [setData]);

  // Single delete handler
  const handleDeleteRequest = useCallback(async (requestId: number) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    await executeWithToast(
      () => apiFetch(buildEndpoint.adHocRequest(requestId), { method: 'DELETE' }),
      { success: 'Request deleted', error: 'Failed to delete request' },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((r) => r.id !== requestId) } : prev);
      }
    );
  }, [setData]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((r) => r.id);
    await executeWithToast(
      () => apiPost(API_ENDPOINTS.AD_HOC_REQUESTS_BULK_DELETE, { ids }),
      { success: `Deleted ${ids.length} request${ids.length !== 1 ? 's' : ''}`, error: 'Failed to delete requests' },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((r) => !ids.includes(r.id)) } : prev);
        selection.clearSelection();
      }
    );
  }, [selection, setData]);

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

  // Merge entity options (full list) with locally-derived options (dedup by value)
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    entityClients.forEach((o) => map.set(o.value, o.label));
    requests.forEach((r) => { if (r.clientId && r.clientName) map.set(String(r.clientId), r.clientName); });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [requests, entityClients]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    entityProjects.forEach((o) => map.set(o.value, o.label));
    requests.forEach((r) => { if (r.projectId && r.projectName) map.set(String(r.projectId), r.projectName); });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [requests, entityProjects]);

  // Create handler
  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const res = await apiPost(API_ENDPOINTS.AD_HOC_REQUESTS, formData);
      if (res.ok) {
        showNotification?.('Ad-hoc request created successfully', 'success');
        setCreateOpen(false);
        refetch();
      } else {
        showNotification?.('Failed to create ad-hoc request', 'error');
      }
    } catch {
      showNotification?.('Failed to create ad-hoc request', 'error');
    } finally {
      setCreateLoading(false);
    }
  }, [showNotification, refetch]);

  function getPriorityColor(priority: string): string {
    switch (priority) {
    case 'urgent': return 'var(--status-cancelled)';
    case 'high': return 'var(--status-pending)';
    case 'medium': return 'var(--status-active)';
    case 'low': return 'var(--color-text-tertiary)';
    default: return 'var(--color-text-tertiary)';
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
            onClick={exportCsv}
            disabled={isExporting || filteredRequests.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" onClick={() => setCreateOpen(true)} title="New Request" />
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
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
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
                <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(request)}
                    onCheckedChange={() => selection.toggleSelection(request)}
                    aria-label={`Select ${request.title}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Zap className="icon-sm" />
                    <div className="cell-content">
                      <InlineEdit
                        value={request.title}
                        type="text"
                        placeholder="Untitled request"
                        onSave={(value) => handleFieldUpdate(request.id, 'title', value)}
                      />
                      {request.projectName && (
                        <span className="cell-subtitle">
                          {request.projectId && onNavigate ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('project-detail', String(request.projectId));
                              }}
                              className="table-link"
                            >
                              {request.projectName}
                            </span>
                          ) : (
                            request.projectName
                          )}
                        </span>
                      )}
                      {request.assignee && (
                        <span className="cell-subtitle">
                          <User className="icon-xs" />
                          {request.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  {request.clientId && onNavigate ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('client-detail', String(request.clientId));
                      }}
                      className="table-link"
                    >
                      {request.clientName}
                    </span>
                  ) : (
                    <span>{request.clientName}</span>
                  )}
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
                <StatusDropdownCell
                  status={request.status}
                  statusConfig={AD_HOC_STATUS_CONFIG}
                  onStatusChange={(newStatus) => handleStatusChange(request.id, newStatus)}
                  ariaLabel="Change request status"
                />
                <PortalTableCell className="text-right">
                  {request.actualHours !== undefined && (
                    <span>{request.actualHours}/</span>
                  )}
                  <InlineEdit
                    value={String(request.estimatedHours ?? '')}
                    type="number"
                    placeholder="0h"
                    formatDisplay={(val) => val ? `${val}h` : '0h'}
                    onSave={(value) => handleFieldUpdate(request.id, 'estimatedHours', value)}
                  />
                </PortalTableCell>
                <PortalTableCell className="date-col">
                  <InlineEdit
                    value={request.dueDate || ''}
                    type="date"
                    placeholder="Set due date"
                    onSave={(value) => handleFieldUpdate(request.id, 'dueDate', value)}
                  />
                </PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="action-group">
                    <IconButton action="view" title="View" onClick={() => onNavigate?.('adhoc-request-detail', String(request.id))} />
                    {request.status === 'pending' && (
                      <IconButton action="start" title="Start" onClick={() => handleStatusChange(request.id, 'in-progress')} />
                    )}
                    {request.status === 'in-progress' && (
                      <IconButton action="pause" title="Put On Hold" onClick={() => handleStatusChange(request.id, 'on-hold')} />
                    )}
                    <IconButton action="delete" title="Delete" onClick={() => handleDeleteRequest(request.id)} />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
      <CreateAdHocRequestModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        loading={createLoading}
        clientOptions={clientOptions}
        projectOptions={projectOptions}
      />
    </TableLayout>
  );
}
