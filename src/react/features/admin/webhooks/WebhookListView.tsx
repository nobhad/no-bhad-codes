/**
 * Webhook List View (main table)
 * @file src/react/features/admin/webhooks/WebhookListView.tsx
 */

import * as React from 'react';
import {
  Webhook,
  Inbox,
  Play,
  History,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  Plus
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
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
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import {
  WEBHOOKS_FILTER_CONFIG,
  filterWebhook,
  sortWebhooks,
  truncateUrl,
  type WebhookItem
} from './types';

interface WebhookListViewProps {
  containerRef: React.RefObject<HTMLElement | null>;
  webhooks: WebhookItem[];
  isLoading: boolean;
  error: string | null;
  defaultPageSize: number;
  onRefresh: () => void;
  onAdd: () => void;
  onEdit: (webhook: WebhookItem) => void;
  onDelete: (webhook: WebhookItem) => void;
  onToggleActive: (webhook: WebhookItem) => void;
  onTest: (webhook: WebhookItem) => void;
  onViewDeliveries: (webhook: WebhookItem) => void;
  onViewStats: (webhook: WebhookItem) => void;
}

export function WebhookListView({
  containerRef,
  webhooks,
  isLoading,
  error,
  defaultPageSize,
  onRefresh,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
  onTest,
  onViewDeliveries,
  onViewStats
}: WebhookListViewProps) {
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<WebhookItem>({
    storageKey: 'admin_webhooks',
    filters: WEBHOOKS_FILTER_CONFIG,
    filterFn: filterWebhook,
    sortFn: sortWebhooks,
    defaultSort: { column: 'updatedAt', direction: 'desc' }
  });

  const filteredWebhooks = React.useMemo(() => applyFilters(webhooks), [applyFilters, webhooks]);

  const pagination = usePagination({
    storageKey: 'admin_webhooks_pagination',
    totalItems: filteredWebhooks.length,
    defaultPageSize
  });

  const paginatedWebhooks = React.useMemo(
    () => pagination.paginate(filteredWebhooks),
    [pagination, filteredWebhooks]
  );

  const handleFilterChange = React.useCallback(
    (key: string, value: string) => setFilter(key, value),
    [setFilter]
  );

  const filterSections = WEBHOOKS_FILTER_CONFIG.map((config) => ({
    key: config.key,
    label: config.label,
    options: config.options
  }));

  const listStats = React.useMemo(() => {
    const total = webhooks.length;
    const active = webhooks.filter((w) => w.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [webhooks]);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="WEBHOOKS"
      stats={
        <TableStats
          items={[
            { value: listStats.total, label: 'total' },
            { value: listStats.active, label: 'active', variant: 'completed' },
            { value: listStats.inactive, label: 'inactive', variant: 'cancelled' }
          ]}
          tooltip={`${listStats.total} Total -- ${listStats.active} Active -- ${listStats.inactive} Inactive`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search webhooks..."
          />
          <FilterDropdown
            sections={filterSections}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <button className="btn btn-primary" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add Webhook
          </button>
          <IconButton
            action="refresh"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh"
          />
        </>
      }
      pagination={
        !isLoading && filteredWebhooks.length > 0 ? (
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
            <PortalTableHead
              className="name-col"
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Name
            </PortalTableHead>
            <PortalTableHead className="type-col">URL</PortalTableHead>
            <PortalTableHead className="count-col">Events</PortalTableHead>
            <PortalTableHead className="type-col">Method</PortalTableHead>
            <PortalTableHead className="status-col">Active</PortalTableHead>
            <PortalTableHead
              className="count-col"
              sortable
              sortDirection={sort?.column === 'totalDeliveries' ? sort.direction : null}
              onClick={() => toggleSort('totalDeliveries')}
            >
              Stats
            </PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={onRefresh} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={7} rows={5} />
          ) : paginatedWebhooks.length === 0 ? (
            <PortalTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No webhooks match your filters' : 'No webhooks yet'}
            />
          ) : (
            paginatedWebhooks.map((webhook) => (
              <PortalTableRow key={webhook.id}>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Webhook className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{webhook.name}</span>
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="type-cell" title={webhook.url}>
                  {truncateUrl(webhook.url)}
                </PortalTableCell>
                <PortalTableCell className="count-cell">
                  <span className="status-badge">{webhook.events.length}</span>
                </PortalTableCell>
                <PortalTableCell className="type-cell">
                  {webhook.method}
                </PortalTableCell>
                <PortalTableCell
                  className="status-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onToggleActive(webhook)}
                    title={webhook.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {webhook.is_active ? (
                      <ToggleRight className="h-5 w-5 text-success" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted" />
                    )}
                  </button>
                </PortalTableCell>
                <PortalTableCell className="count-cell">
                  <span title={`${webhook.successCount} ok / ${webhook.failedCount} failed`}>
                    {webhook.totalDeliveries}
                  </span>
                </PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton
                      action="edit"
                      title="Edit"
                      onClick={() => onEdit(webhook)}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onTest(webhook)}
                      title="Test"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onViewDeliveries(webhook)}
                      title="View Deliveries"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onViewStats(webhook)}
                      title="View Stats"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </button>
                    <IconButton
                      action="delete"
                      title="Delete"
                      onClick={() => onDelete(webhook)}
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
