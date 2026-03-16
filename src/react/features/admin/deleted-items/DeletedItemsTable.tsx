import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Trash2,
  AlertTriangle,
  User,
  Briefcase,
  FileText,
  File,
  MessageSquare,
  Inbox,
  Clock,
  RotateCcw
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
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
import { formatDate } from '@react/utils/formatDate';
import { DELETED_ITEMS_FILTER_CONFIG } from '@react/features/admin/shared/filterConfigs';
import type { SortConfig } from '@react/features/admin/types';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost, apiDelete } from '@/utils/api-client';
import { executeWithToast, executeDeleteWithToast } from '@/utils/api-wrappers';

interface DeletedItem {
  id: string;
  type: 'client' | 'project' | 'invoice' | 'file' | 'message' | 'contact';
  name: string;
  description?: string;
  deletedBy: string;
  deletedAt: string;
  expiresAt: string;
  originalId: string;
}

interface DeletedItemsStats {
  total: number;
  clients: number;
  projects: number;
  invoices: number;
  files: number;
  expiringIn7Days: number;
}

interface DeletedItemsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
  overviewMode?: boolean;
}

const DEFAULT_STATS: DeletedItemsStats = {
  total: 0,
  clients: 0,
  projects: 0,
  invoices: 0,
  files: 0,
  expiringIn7Days: 0
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  client: <User className="icon-sm" />,
  project: <Briefcase className="icon-sm" />,
  invoice: <FileText className="icon-sm" />,
  file: <File className="icon-sm" />,
  message: <MessageSquare className="icon-sm" />,
  contact: <User className="icon-sm" />
};

// Filter function for deleted items
function filterDeletedItem(
  item: DeletedItem,
  filters: Record<string, string[]>,
  search: string
): boolean {
  // Search filter
  if (search) {
    const query = search.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query);
    if (!matchesSearch) return false;
  }

  // Type filter
  const typeFilter = filters.type;
  if (typeFilter && typeFilter.length > 0) {
    if (!typeFilter.includes(item.type)) return false;
  }

  return true;
}

// Sort function for deleted items
function sortDeletedItems(a: DeletedItem, b: DeletedItem, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return a.name.localeCompare(b.name) * multiplier;
  case 'type':
    return a.type.localeCompare(b.type) * multiplier;
  case 'deletedAt':
    return (new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime()) * multiplier;
  case 'expiresAt':
    return (new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()) * multiplier;
  default:
    return 0;
  }
}

export function DeletedItemsTable({ getAuthToken, showNotification: _showNotification, onNavigate: _onNavigate, defaultPageSize = 25, overviewMode = false }: DeletedItemsTableProps) {
  const containerRef = useFadeIn();

  // Fetch deleted items via factory hook
  const { data, isLoading, error, refetch, setData } = useListFetch<DeletedItem, DeletedItemsStats>({
    endpoint: API_ENDPOINTS.ADMIN.DELETED_ITEMS,
    getAuthToken,
    defaultStats: DEFAULT_STATS,
    itemsKey: 'items'
  });
  const items = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_STATS, [data]);

  const [bulkLoading, setBulkLoading] = useState(false);

  // Use centralized table filters hook
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<DeletedItem>({
    storageKey: overviewMode ? undefined : 'admin_deleted_items',
    filters: DELETED_ITEMS_FILTER_CONFIG,
    filterFn: filterDeletedItem,
    sortFn: sortDeletedItems,
    defaultSort: { column: 'deletedAt', direction: 'desc' }
  });

  // Apply filters and sorting
  const filteredItems = useMemo(() => applyFilters(items), [applyFilters, items]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_deleted_items_pagination',
    totalItems: filteredItems.length,
    defaultPageSize
  });

  const paginatedItems = useMemo(
    () => pagination.paginate(filteredItems),
    [pagination, filteredItems]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (item: DeletedItem) => item.id,
    items: paginatedItems
  });

  // Filter change handler
  const handleFilterChange = useCallback(
    (key: string, value: string) => setFilter(key, value),
    [setFilter]
  );

  const handleRestore = useCallback(async (itemId: string) => {
    await executeWithToast(
      () => apiPost(buildEndpoint.adminDeletedItemRestore(itemId)),
      { success: 'Item restored', error: 'Failed to restore item' },
      () => setData((prev) => prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : prev)
    );
  }, [setData]);

  const handlePermanentDelete = useCallback(async (itemId: string) => {
    if (
      !confirm(
        'Are you sure you want to permanently delete this item? This action cannot be undone.'
      )
    ) {
      return;
    }
    await executeDeleteWithToast(
      'item',
      () => apiDelete(buildEndpoint.adminDeletedItem(itemId)),
      () => setData((prev) => prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : prev)
    );
  }, [setData]);

  const handleEmptyTrash = useCallback(async () => {
    if (
      !confirm(
        'Are you sure you want to permanently delete all items? This action cannot be undone.'
      )
    ) {
      return;
    }
    await executeWithToast(
      () => apiDelete(API_ENDPOINTS.ADMIN.DELETED_ITEMS_EMPTY),
      { success: 'Trash emptied', error: 'Failed to empty trash' },
      () => setData((prev) => prev ? { ...prev, items: [] } : prev)
    );
  }, [setData]);

  // Bulk restore
  const handleBulkRestore = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    if (
      !confirm(`Are you sure you want to restore ${selection.selectedCount} item(s)?`)
    ) {
      return;
    }

    setBulkLoading(true);
    const ids = Array.from(selection.selectedIds);
    await executeWithToast(
      () => apiPost(API_ENDPOINTS.ADMIN.DELETED_ITEMS_BULK_RESTORE, { ids }),
      { success: `Restored ${ids.length} item${ids.length !== 1 ? 's' : ''}`, error: 'Failed to restore items' },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((item) => !selection.selectedIds.has(item.id)) } : prev);
        selection.clearSelection();
      }
    );
    setBulkLoading(false);
  }, [selection, setData]);

  // Bulk permanent delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    if (
      !confirm(
        `Are you sure you want to permanently delete ${selection.selectedCount} item(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    setBulkLoading(true);
    const ids = Array.from(selection.selectedIds);
    await executeWithToast(
      () => apiDelete(API_ENDPOINTS.ADMIN.DELETED_ITEMS_BULK_DELETE),
      { success: `Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`, error: 'Failed to delete items' },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((item) => !selection.selectedIds.has(item.id)) } : prev);
        selection.clearSelection();
      }
    );
    setBulkLoading(false);
  }, [selection, setData]);

  function isExpiringSoon(expiresAt: string): boolean {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7;
  }

  function getDaysUntilExpiry(expiresAt: string): string {
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  }

  // Build filter dropdown sections from config
  const filterSections = DELETED_ITEMS_FILTER_CONFIG.map((config) => ({
    key: config.key,
    label: config.label,
    options: config.options
  }));

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DELETED ITEMS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.clients, label: 'clients' },
            { value: stats.projects, label: 'projects' },
            { value: stats.invoices, label: 'invoices' },
            { value: stats.files, label: 'files' },
            {
              value: stats.expiringIn7Days,
              label: 'expiring',
              variant: 'overdue'
            }
          ]}
          tooltip={`${stats.total} Total • ${stats.clients} Clients • ${stats.projects} Projects • ${stats.invoices} Invoices • ${stats.files} Files`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search deleted items..."
          />
          <FilterDropdown
            sections={filterSections}
            values={filterValues}
            onChange={handleFilterChange}
          />
          {items.length > 0 && (
            <PortalButton
              variant="secondary"
              size="sm"
              className="btn-danger"
              onClick={handleEmptyTrash}
            >
              <Trash2 className="btn-icon" />
              Empty Trash
            </PortalButton>
          )}
        </>
      }
      bulkActions={
        selection.selectedCount > 0 ? (
          <BulkActionsToolbar
            selectedCount={selection.selectedCount}
            totalCount={filteredItems.length}
            onClearSelection={selection.clearSelection}
            onSelectAll={selection.selectAll}
            allSelected={selection.allSelected}
            actions={[
              {
                id: 'restore',
                label: 'Restore',
                icon: <RotateCcw className="icon-sm" />,
                onClick: handleBulkRestore,
                loading: bulkLoading
              }
            ]}
            onDelete={handleBulkDelete}
            deleteLoading={bulkLoading}
          />
        ) : stats.expiringIn7Days > 0 ? (
          <div className="table-warning-banner">
            <AlertTriangle className="icon-sm" />
            <span>
              {stats.expiringIn7Days} item(s) will be permanently deleted within the next 7
              days.
            </span>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredItems.length > 0 ? (
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
                checked={selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false}
                onCheckedChange={selection.toggleSelectAll}
                aria-label="Select all"
              />
            </PortalTableHead>
            <PortalTableHead
              className="name-col"
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
                Item
            </PortalTableHead>
            <PortalTableHead
              className="type-col"
              sortable
              sortDirection={sort?.column === 'type' ? sort.direction : null}
              onClick={() => toggleSort('type')}
            >
                Type
            </PortalTableHead>
            <PortalTableHead className="user-col">Deleted By</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'deletedAt' ? sort.direction : null}
              onClick={() => toggleSort('deletedAt')}
            >
                Deleted
            </PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'expiresAt' ? sort.direction : null}
              onClick={() => toggleSort('expiresAt')}
            >
                Expires In
            </PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={7} rows={5} />
          ) : paginatedItems.length === 0 ? (
            <PortalTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No items match your filters' : 'Trash is empty'}
            />
          ) : (
            paginatedItems.map((item) => (
              <PortalTableRow
                key={item.id}
                selected={selection.isSelected(item)}
              >
                <PortalTableCell
                  className="col-checkbox"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selection.isSelected(item)}
                    onCheckedChange={() => selection.toggleSelection(item)}
                    aria-label={`Select ${item.name}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    {TYPE_ICONS[item.type]}
                    <div className="cell-content">
                      <span className="cell-title">{item.name}</span>
                      {item.description && (
                        <span className="cell-subtitle">{item.description}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="type-cell">{item.type}</PortalTableCell>
                <PortalTableCell className="user-cell">{item.deletedBy}</PortalTableCell>
                <PortalTableCell className="date-col">
                  {formatDate(item.deletedAt)}
                </PortalTableCell>
                <PortalTableCell className="date-col">
                  <span className={cn(isExpiringSoon(item.expiresAt) && 'text-danger')}>
                    <span className="cell-with-icon">
                      {isExpiringSoon(item.expiresAt) && <Clock className="icon-xs" />}
                      {getDaysUntilExpiry(item.expiresAt)}
                    </span>
                  </span>
                </PortalTableCell>
                <PortalTableCell className="col-actions">
                  <div className="action-group">
                    <IconButton
                      action="restore"
                      onClick={() => handleRestore(item.id)}
                    />
                    <IconButton
                      action="delete"
                      title="Delete Permanently"
                      onClick={() => handlePermanentDelete(item.id)}
                    />
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
