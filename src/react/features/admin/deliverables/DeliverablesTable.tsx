import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  Package,
  AlertCircle,
  Inbox,
  ChevronDown
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
import { DELIVERABLES_FILTER_CONFIG } from '../shared/filterConfigs';
import { useListFetch } from '@react/factories/useDataFetch';
import type { SortConfig } from '../types';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost, apiFetch } from '@/utils/api-client';

const logger = createLogger('DeliverablesTable');

interface Deliverable {
  id: number;
  title: string;
  description?: string;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  status: 'pending' | 'in-progress' | 'review' | 'approved' | 'delivered';
  dueDate?: string;
  deliveredAt?: string;
  version: number;
  files: number;
  createdAt: string;
  updatedAt: string;
}

interface DeliverableStats {
  total: number;
  pending: number;
  inProgress: number;
  review: number;
  delivered: number;
  overdue: number;
}

const DEFAULT_DELIVERABLE_STATS: DeliverableStats = {
  total: 0,
  pending: 0,
  inProgress: 0,
  review: 0,
  delivered: 0,
  overdue: 0
};

interface DeliverablesTableProps {
  projectId?: string;
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
  overviewMode?: boolean;
}

const DELIVERABLE_STATUS_CONFIG: Record<string, { label: string }> = {
  pending: { label: 'Pending' },
  'in-progress': { label: 'In Progress' },
  review: { label: 'In Review' },
  approved: { label: 'Approved' },
  delivered: { label: 'Delivered' }
};

// Filter function
function filterDeliverable(
  deliverable: Deliverable,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      deliverable.title.toLowerCase().includes(searchLower) ||
      deliverable.projectName.toLowerCase().includes(searchLower) ||
      deliverable.clientName.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(deliverable.status)) return false;
  }

  return true;
}

// Sort function
function sortDeliverables(a: Deliverable, b: Deliverable, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'project':
    return multiplier * a.projectName.localeCompare(b.projectName);
  case 'dueDate':
    return multiplier * ((a.dueDate || '').localeCompare(b.dueDate || ''));
  case 'updatedAt':
    return multiplier * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  default:
    return 0;
  }
}

export function DeliverablesTable({ projectId, getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: DeliverablesTableProps) {
  const containerRef = useFadeIn();

  // Build endpoint with optional projectId query param
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    return qs ? `${API_ENDPOINTS.ADMIN.DELIVERABLES}?${qs}` : API_ENDPOINTS.ADMIN.DELIVERABLES;
  }, [projectId]);

  // Data fetching via useListFetch
  const { data, isLoading, error, refetch, setData } = useListFetch<Deliverable, DeliverableStats>({
    endpoint,
    getAuthToken,
    defaultStats: DEFAULT_DELIVERABLE_STATS,
    itemsKey: 'deliverables',
    deps: [endpoint]
  });
  const deliverables = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_DELIVERABLE_STATS, [data]);

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
  } = useTableFilters<Deliverable>({
    storageKey: overviewMode ? undefined : 'admin_deliverables',
    filters: DELIVERABLES_FILTER_CONFIG,
    filterFn: filterDeliverable,
    sortFn: sortDeliverables,
    defaultSort: { column: 'updatedAt', direction: 'desc' }
  });

  // Apply filters
  const filteredDeliverables = useMemo(() => applyFilters(deliverables), [applyFilters, deliverables]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_deliverables_pagination',
    totalItems: filteredDeliverables.length,
    defaultPageSize
  });

  const paginatedDeliverables = useMemo(
    () => pagination.paginate(filteredDeliverables),
    [pagination, filteredDeliverables]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (d: Deliverable) => d.id,
    items: paginatedDeliverables
  });

  // Status change handler
  const handleStatusChange = useCallback(async (deliverableId: number, newStatus: string) => {
    try {
      const response = await apiFetch(buildEndpoint.adminDeliverable(deliverableId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update deliverable');

      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((d) =>
          d.id === deliverableId
            ? { ...d, status: newStatus as Deliverable['status'] }
            : d
        )
      } : prev);
      showNotification?.('Deliverable status updated', 'success');
    } catch (err) {
      logger.error('Failed to update deliverable status:', err);
      showNotification?.('Failed to update deliverable status', 'error');
    }
  }, [setData, showNotification]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((d) => d.id);
    try {
      const response = await apiPost(API_ENDPOINTS.ADMIN.DELIVERABLES_BULK_DELETE, { deliverableIds: ids });

      if (!response.ok) throw new Error('Failed to delete deliverables');

      setData((prev) => prev ? { ...prev, items: prev.items.filter((d) => !ids.includes(d.id)) } : prev);
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} deliverable${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to delete deliverables:', err);
      showNotification?.('Failed to delete deliverables', 'error');
    }
  }, [selection, setData, showNotification]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(DELIVERABLE_STATUS_CONFIG).map(([value, config]) => ({
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

      for (const d of selection.selectedItems) {
        await handleStatusChange(d.id, newStatus);
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

  function isOverdue(dueDate?: string, status?: string): boolean {
    if (!dueDate || status === 'delivered' || status === 'approved') return false;
    return new Date(dueDate) < new Date();
  }

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DELIVERABLES"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.inProgress, label: 'in progress', variant: 'active' },
            { value: stats.review, label: 'review', variant: 'pending' },
            { value: stats.delivered, label: 'delivered', variant: 'completed' },
            { value: stats.overdue, label: 'overdue', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.inProgress} In Progress • ${stats.review} Review • ${stats.delivered} Delivered`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search deliverables..."
          />
          <FilterDropdown
            sections={DELIVERABLES_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredDeliverables.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" title="New Deliverable" />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredDeliverables.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredDeliverables)}
          allSelected={selection.allSelected && selection.selectedCount === filteredDeliverables.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
      }
      pagination={
        !isLoading && filteredDeliverables.length > 0 ? (
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
              Deliverable
            </PortalTableHead>
            <PortalTableHead
              className="project-col"
              sortable
              sortDirection={sort?.column === 'project' ? sort.direction : null}
              onClick={() => toggleSort('project')}
            >
              Project
            </PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="version-col">Ver</PortalTableHead>
            <PortalTableHead className="files-col">Files</PortalTableHead>
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
          ) : paginatedDeliverables.length === 0 ? (
            <PortalTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No deliverables match your filters' : 'No deliverables yet'}
            />
          ) : (
            paginatedDeliverables.map((deliverable) => (
              <PortalTableRow
                key={deliverable.id}
                clickable
                selected={selection.isSelected(deliverable)}
              >
                <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(deliverable)}
                    onCheckedChange={() => selection.toggleSelection(deliverable)}
                    aria-label={`Select ${deliverable.title}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Package className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{deliverable.title}</span>
                      {deliverable.clientId && onNavigate ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('client-detail', String(deliverable.clientId));
                          }}
                          className="table-link cell-subtitle"
                        >
                          {deliverable.clientName}
                        </button>
                      ) : (
                        <span className="cell-subtitle">{deliverable.clientName}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('projects', String(deliverable.projectId));
                    }}
                    className="table-link"
                  >
                    {deliverable.projectName}
                  </button>
                </PortalTableCell>
                <PortalTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button className="status-dropdown-trigger" aria-label="Change deliverable status">
                        <StatusBadge status={getStatusVariant(deliverable.status)} size="sm">
                          {DELIVERABLE_STATUS_CONFIG[deliverable.status]?.label || deliverable.status.replace('-', ' ')}
                        </StatusBadge>
                        <ChevronDown className="status-dropdown-caret" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent sideOffset={0} align="start">
                      {Object.entries(DELIVERABLE_STATUS_CONFIG)
                        .filter(([status]) => status !== deliverable.status)
                        .map(([status, config]) => (
                          <PortalDropdownItem
                            key={status}
                            onClick={() => handleStatusChange(deliverable.id, status)}
                          >
                            <StatusBadge status={getStatusVariant(status)} size="sm">
                              {config.label}
                            </StatusBadge>
                          </PortalDropdownItem>
                        ))}
                    </PortalDropdownContent>
                  </PortalDropdown>
                </PortalTableCell>
                <PortalTableCell>v{deliverable.version}</PortalTableCell>
                <PortalTableCell>{deliverable.files}</PortalTableCell>
                <PortalTableCell className="date-cell">
                  {deliverable.dueDate && (
                    <span
                      className={cn(
                        'due-date',
                        isOverdue(deliverable.dueDate, deliverable.status) && 'overdue'
                      )}
                    >
                      {isOverdue(deliverable.dueDate, deliverable.status) && (
                        <AlertCircle className="overdue-icon" />
                      )}
                      {formatDate(deliverable.dueDate)}
                    </span>
                  )}
                </PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    <IconButton action="edit" title="Edit" />
                    {deliverable.files > 0 && (
                      <IconButton action="download" title="Download" />
                    )}
                    <IconButton action="copy-link" title="Share Link" />
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
