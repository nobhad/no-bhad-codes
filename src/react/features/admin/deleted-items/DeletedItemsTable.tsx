import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('DeletedItemsTable');

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

const TYPE_ICONS: Record<string, React.ReactNode> = {
  client: <User className="cell-icon" />,
  project: <Briefcase className="cell-icon" />,
  invoice: <FileText className="cell-icon" />,
  file: <File className="cell-icon" />,
  message: <MessageSquare className="cell-icon" />,
  contact: <User className="cell-icon" />
};

// Filter function for deleted items
function filterDeletedItem(
  item: DeletedItem,
  filters: Record<string, string>,
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
  if (filters.type && filters.type !== 'all') {
    if (item.type !== filters.type) return false;
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

export function DeletedItemsTable({ getAuthToken, showNotification, onNavigate: _onNavigate, defaultPageSize = 25, overviewMode = false }: DeletedItemsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);

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
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [stats, setStats] = useState<DeletedItemsStats>({
    total: 0,
    clients: 0,
    projects: 0,
    invoices: 0,
    files: 0,
    expiringIn7Days: 0
  });
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

  const loadDeletedItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.DELETED_ITEMS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load deleted items');
      const payload = unwrapApiData<{ items?: DeletedItem[]; stats?: DeletedItemsStats }>(await response.json());
      setItems(payload.items || []);
      setStats(payload.stats || {
        total: 0,
        clients: 0,
        projects: 0,
        invoices: 0,
        files: 0,
        expiringIn7Days: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deleted items');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadDeletedItems();
  }, [loadDeletedItems]);

  const handleRestore = useCallback(async (itemId: string) => {
    try {
      const response = await fetch(buildEndpoint.adminDeletedItemRestore(itemId), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to restore item');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      showNotification?.('Item restored', 'success');
    } catch (err) {
      logger.error('Failed to restore item:', err);
      showNotification?.('Failed to restore item', 'error');
    }
  }, [getHeaders, showNotification]);

  const handlePermanentDelete = useCallback(async (itemId: string) => {
    if (
      !confirm(
        'Are you sure you want to permanently delete this item? This action cannot be undone.'
      )
    ) {
      return;
    }
    try {
      const response = await fetch(buildEndpoint.adminDeletedItem(itemId), {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete item');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      showNotification?.('Item permanently deleted', 'success');
    } catch (err) {
      logger.error('Failed to delete item:', err);
      showNotification?.('Failed to delete item', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleEmptyTrash = useCallback(async () => {
    if (
      !confirm(
        'Are you sure you want to permanently delete all items? This action cannot be undone.'
      )
    ) {
      return;
    }
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.DELETED_ITEMS_EMPTY, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to empty trash');
      setItems([]);
      showNotification?.('Trash emptied', 'success');
    } catch (err) {
      logger.error('Failed to empty trash:', err);
      showNotification?.('Failed to empty trash', 'error');
    }
  }, [getHeaders, showNotification]);

  // Bulk restore
  const handleBulkRestore = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    if (
      !confirm(`Are you sure you want to restore ${selection.selectedCount} item(s)?`)
    ) {
      return;
    }

    setBulkLoading(true);
    try {
      const ids = Array.from(selection.selectedIds);
      const response = await fetch(API_ENDPOINTS.ADMIN.DELETED_ITEMS_BULK_RESTORE, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('Failed to restore items');
      setItems((prev) => prev.filter((item) => !selection.selectedIds.has(item.id)));
      selection.clearSelection();
      showNotification?.(`Restored ${ids.length} item${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to bulk restore:', err);
      showNotification?.('Failed to restore items', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [selection, getHeaders, showNotification]);

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
    try {
      const ids = Array.from(selection.selectedIds);
      const response = await fetch(API_ENDPOINTS.ADMIN.DELETED_ITEMS_BULK_DELETE, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids })
      });
      if (!response.ok) throw new Error('Failed to delete items');
      setItems((prev) => prev.filter((item) => !selection.selectedIds.has(item.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} item${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to bulk delete:', err);
      showNotification?.('Failed to delete items', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [selection, getHeaders, showNotification]);

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
            <AlertTriangle className="cell-icon" />
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
            <PortalTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
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
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={loadDeletedItems} />
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
                  className="bulk-select-cell"
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
                <PortalTableCell className="date-cell">
                  {formatDate(item.deletedAt)}
                </PortalTableCell>
                <PortalTableCell className="date-cell">
                  <span className={cn(isExpiringSoon(item.expiresAt) && 'text-danger')}>
                    <span className="cell-with-icon">
                      {isExpiringSoon(item.expiresAt) && <Clock className="cell-icon-sm" />}
                      {getDaysUntilExpiry(item.expiresAt)}
                    </span>
                  </span>
                </PortalTableCell>
                <PortalTableCell className="actions-cell">
                  <div className="table-actions">
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
