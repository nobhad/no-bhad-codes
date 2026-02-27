import * as React from 'react';
import { useMemo, useCallback } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Download,
  Inbox
} from 'lucide-react';
import { Checkbox } from '@react/components/ui/checkbox';
import { cn } from '@react/lib/utils';
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
import { PortalButton } from '@react/components/portal/PortalButton';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useSelection } from '@react/hooks/useSelection';
import { useExport } from '@react/hooks/useExport';
import { useFadeIn } from '@react/hooks/useGsap';
import type { ExportConfig } from '../../../../utils/table-export';
import type { DataTableProps, SortConfig } from './types';

/**
 * Default filter function - searches all string fields
 */
function defaultFilterFn<T>(
  item: T,
  filters: Record<string, string>,
  search: string
): boolean {
  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    const values = Object.values(item as Record<string, unknown>);
    const matchesSearch = values.some(
      (v) => typeof v === 'string' && v.toLowerCase().includes(searchLower)
    );
    if (!matchesSearch) return false;
  }

  // Apply all active filters
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') {
      const itemValue = (item as Record<string, unknown>)[key];
      if (itemValue !== value) return false;
    }
  }

  return true;
}

/**
 * Default sort function - handles common types
 */
function defaultSortFn<T>(a: T, b: T, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  const aVal = (a as Record<string, unknown>)[column];
  const bVal = (b as Record<string, unknown>)[column];

  if (typeof aVal === 'string' && typeof bVal === 'string') {
    return multiplier * aVal.localeCompare(bVal);
  }
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return multiplier * (aVal - bVal);
  }
  if (aVal instanceof Date && bVal instanceof Date) {
    return multiplier * (aVal.getTime() - bVal.getTime());
  }

  return 0;
}

/**
 * DataTable
 * Reusable table component with filtering, sorting, pagination, and bulk actions
 */
export function DataTable<T extends { id: number }>({
  data,
  isLoading,
  error,
  onRefetch,
  columns,
  filterConfig = [],
  stats = [],
  storageKey,
  defaultSort,
  defaultPageSize = 25,
  filterFn,
  sortFn,
  exportConfig,
  bulkActions = [],
  showBulkDelete = true,
  onBulkDelete,
  onRowClick,
  rowActions = [],
  showNotification,
  emptyMessage = 'No data yet',
  emptyFilteredMessage = 'No items match your filters',
  renderCell,
  className
}: DataTableProps<T>) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Confirmation dialogs
  const deleteDialog = useConfirmDialog();

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
  } = useTableFilters<T>({
    storageKey,
    filters: filterConfig,
    filterFn: filterFn || defaultFilterFn,
    sortFn: sortFn || defaultSortFn,
    defaultSort
  });

  // Apply filters to get filtered data
  const filteredData = useMemo(() => applyFilters(data), [applyFilters, data]);

  // Pagination
  const pagination = usePagination({
    storageKey: `${storageKey}_pagination`,
    totalItems: filteredData.length,
    defaultPageSize
  });

  // Get paginated data
  const paginatedData = useMemo(
    () => pagination.paginate(filteredData),
    [pagination, filteredData]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (item: T) => item.id,
    items: paginatedData
  });

  // Default export config (empty - only used if exportConfig is not provided)
  const defaultExportConfig: ExportConfig = { filename: storageKey, columns: [] };

  // Export functionality
  const { exportCsv, isExporting } = useExport({
    config: exportConfig || defaultExportConfig,
    data: filteredData,
    onExport: (count) => {
      showNotification?.(`Exported ${count} item${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0 || !onBulkDelete) return;

    const ids = selection.selectedItems.map((item) => item.id);
    const result = await onBulkDelete(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Deleted ${result.success} item${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(`Deleted ${result.success}, failed ${result.failed}`, 'warning');
    } else {
      showNotification?.('Failed to delete items', 'error');
    }

    onRefetch();
  }, [selection, onBulkDelete, showNotification, onRefetch]);

  // Handle row click
  const handleRowClick = useCallback(
    (item: T) => {
      onRowClick?.(item);
    },
    [onRowClick]
  );

  // Render cell content
  const renderCellContent = useCallback(
    (item: T, column: typeof columns[0], index: number) => {
      // Custom render function from column config
      if (column.render) {
        return column.render(item, index);
      }

      // Custom cell renderer prop
      if (renderCell) {
        return renderCell(item, column, index);
      }

      // Default: return raw value
      const value = (item as Record<string, unknown>)[column.key];
      return value != null ? String(value) : '-';
    },
    [renderCell]
  );

  return (
    <div ref={containerRef} className={cn('tw-section', className)}>
      {/* Stats Bar */}
      {stats.length > 0 && (
        <div className="tw-flex tw-items-center tw-gap-6 tw-text-sm tw-text-muted">
          {stats.map((stat) => (
            <span key={stat.key} className="tw-flex tw-items-center tw-gap-1">
              {stat.label}:{' '}
              <strong className="tw-font-semibold tw-text-primary">
                {stat.value}
              </strong>
            </span>
          ))}
        </div>
      )}

      {/* Filters Bar */}
      <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3">
        {/* Search */}
        <div className="tw-relative tw-flex-1 tw-min-w-[200px] tw-max-w-[320px]">
          <span className="tw-absolute tw-left-3 tw-top-1/2 tw--translate-y-1/2 tw-text-muted">
            <Search className="tw-h-4 tw-w-4" />
          </span>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="tw-input tw-pl-10"
          />
        </div>

        {/* Filter Dropdowns */}
        {filterConfig.map((filter) => (
          <select
            key={filter.key}
            value={filterValues[filter.key] || 'all'}
            onChange={(e) => setFilter(filter.key, e.target.value)}
            className="tw-select"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <PortalButton variant="ghost" size="sm" onClick={clearFilters}>
            <X className="tw-h-4 tw-w-4" />
            Clear
          </PortalButton>
        )}

        {/* Export */}
        {exportConfig && (
          <PortalButton
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            loading={isExporting}
            disabled={filteredData.length === 0}
            title="Export to CSV"
          >
            <Download className="tw-h-4 tw-w-4" />
          </PortalButton>
        )}

        {/* Refresh */}
        <PortalButton variant="ghost" size="sm" onClick={onRefetch} loading={isLoading}>
          <RefreshCw className="tw-h-4 tw-w-4" />
        </PortalButton>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={selection.selectedCount}
        totalCount={filteredData.length}
        onClearSelection={selection.clearSelection}
        onSelectAll={() => selection.selectMany(filteredData)}
        allSelected={selection.allSelected && selection.selectedCount === filteredData.length}
        actions={bulkActions}
        onDelete={showBulkDelete && onBulkDelete ? deleteDialog.open : undefined}
        deleteLoading={deleteDialog.isLoading}
      />

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <PortalButton variant="secondary" size="sm" onClick={onRefetch} className="tw-ml-4">
            Retry
          </PortalButton>
        </div>
      )}

      {/* Table */}
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            {/* Checkbox column */}
            <AdminTableHead onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selection.allSelected}
                onCheckedChange={selection.toggleSelectAll}
                aria-label="Select all"
                className="tw-data-[state=checked]:tw-bg-[var(--color-brand-primary)] tw-data-[state=checked]:tw-border-[var(--color-brand-primary)]"
              />
            </AdminTableHead>

            {/* Data columns */}
            {columns.map((column) => (
              <AdminTableHead
                key={column.key}
                sortable={column.sortable}
                sortDirection={
                  sort?.column === (column.sortKey || column.key) ? sort.direction : null
                }
                onClick={
                  column.sortable
                    ? () => toggleSort(column.sortKey || column.key)
                    : undefined
                }
                className={column.headerClassName}
              >
                {column.label}
              </AdminTableHead>
            ))}

            {/* Actions column */}
            {rowActions.length > 0 && (
              <AdminTableHead>Actions</AdminTableHead>
            )}
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={columns.length + 1 + (rowActions.length > 0 ? 1 : 0)} rows={5} />
          ) : paginatedData.length === 0 ? (
            <AdminTableEmpty
              colSpan={columns.length + 1 + (rowActions.length > 0 ? 1 : 0)}
              icon={<Inbox className="tw-h-8 tw-w-8" />}
              message={hasActiveFilters ? emptyFilteredMessage : emptyMessage}
            />
          ) : (
            paginatedData.map((item, index) => (
              <AdminTableRow
                key={item.id}
                clickable={!!onRowClick}
                onClick={() => handleRowClick(item)}
                className={cn(
                  selection.isSelected(item) && 'tw-bg-[var(--color-brand-primary-10)]'
                )}
              >
                {/* Checkbox */}
                <AdminTableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(item)}
                    onCheckedChange={() => selection.toggleSelection(item)}
                    aria-label={`Select item ${item.id}`}
                    className="tw-data-[state=checked]:tw-bg-[var(--color-brand-primary)] tw-data-[state=checked]:tw-border-[var(--color-brand-primary)]"
                  />
                </AdminTableCell>

                {/* Data cells */}
                {columns.map((column) => (
                  <AdminTableCell
                    key={column.key}
                    className={column.cellClassName}
                  >
                    {renderCellContent(item, column, index)}
                  </AdminTableCell>
                ))}

                {/* Actions */}
                {rowActions.length > 0 && (
                  <AdminTableCell onClick={(e) => e.stopPropagation()}>
                    <div className="tw-flex tw-items-center tw-gap-1">
                      {rowActions.map((action) => {
                        const show = action.show ? action.show(item) : true;
                        if (!show) return null;

                        const loading = action.loading ? action.loading(item) : false;

                        return (
                          <PortalButton
                            key={action.id}
                            variant="icon"
                            size="icon"
                            onClick={() => action.onClick(item)}
                            loading={loading}
                            title={action.title}
                          >
                            {action.icon}
                          </PortalButton>
                        );
                      })}
                    </div>
                  </AdminTableCell>
                )}
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>

      {/* Pagination */}
      {!isLoading && filteredData.length > 0 && (
        <div className="tw-card tw-mt-4">
          <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-4">
            <div className="tw-text-sm tw-text-muted">
              {pagination.pageInfo}
            </div>

            <div className="tw-flex tw-items-center tw-gap-4">
              <div className="tw-flex tw-items-center tw-gap-2">
                <label className="tw-label">Show</label>
                <select
                  value={pagination.pageSize}
                  onChange={(e) => pagination.setPageSize(Number(e.target.value))}
                  className="tw-select tw-py-1"
                >
                  {pagination.pageSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tw-flex tw-items-center tw-gap-1">
                <button
                  type="button"
                  className="tw-btn-icon"
                  onClick={pagination.firstPage}
                  disabled={!pagination.canGoPrev}
                  title="First page"
                >
                  <ChevronsLeft className="tw-h-4 tw-w-4" />
                </button>
                <button
                  type="button"
                  className="tw-btn-icon"
                  onClick={pagination.prevPage}
                  disabled={!pagination.canGoPrev}
                  title="Previous page"
                >
                  <ChevronLeft className="tw-h-4 tw-w-4" />
                </button>

                <div className="tw-flex tw-items-center tw-gap-1 tw-px-2">
                  <span className="tw-badge">
                    {pagination.page}
                  </span>
                  <span className="tw-text-sm tw-text-muted">of {pagination.totalPages}</span>
                </div>

                <button
                  type="button"
                  className="tw-btn-icon"
                  onClick={pagination.nextPage}
                  disabled={!pagination.canGoNext}
                  title="Next page"
                >
                  <ChevronRight className="tw-h-4 tw-w-4" />
                </button>
                <button
                  type="button"
                  className="tw-btn-icon"
                  onClick={pagination.lastPage}
                  disabled={!pagination.canGoNext}
                  title="Last page"
                >
                  <ChevronsRight className="tw-h-4 tw-w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showBulkDelete && onBulkDelete && (
        <ConfirmDialog
          open={deleteDialog.isOpen}
          onOpenChange={deleteDialog.setIsOpen}
          title="Delete Items"
          description={`Are you sure you want to delete ${selection.selectedCount} item${selection.selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleBulkDelete}
          variant="danger"
          loading={deleteDialog.isLoading}
        />
      )}
    </div>
  );
}
