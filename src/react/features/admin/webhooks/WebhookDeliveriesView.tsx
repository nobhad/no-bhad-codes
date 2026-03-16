/**
 * Webhook Deliveries View
 * @file src/react/features/admin/webhooks/WebhookDeliveriesView.tsx
 */

import * as React from 'react';
import {
  Inbox,
  RotateCcw,
  ArrowLeft
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
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
import { PortalModal, useModal } from '@react/components/portal/PortalModal';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import {
  DELIVERIES_FILTER_CONFIG,
  filterDelivery,
  sortDeliveries,
  getDeliveryStatusVariant,
  type WebhookItem,
  type WebhookDelivery
} from './types';

interface WebhookDeliveriesViewProps {
  containerRef: React.RefObject<HTMLElement | null>;
  selectedWebhook: WebhookItem;
  deliveries: WebhookDelivery[];
  deliveriesLoading: boolean;
  deliveriesError: string | null;
  defaultPageSize: number;
  onBack: () => void;
  onRefresh: (webhookId: number) => void;
  onRetry: (webhookId: number) => void;
}

export function WebhookDeliveriesView({
  containerRef,
  selectedWebhook,
  deliveries,
  deliveriesLoading,
  deliveriesError,
  defaultPageSize,
  onBack,
  onRefresh,
  onRetry
}: WebhookDeliveriesViewProps) {
  const [selectedDelivery, setSelectedDelivery] = React.useState<WebhookDelivery | null>(null);
  const deliveryDetailModal = useModal();

  const deliveryFilters = useTableFilters<WebhookDelivery>({
    storageKey: 'admin_webhook_deliveries',
    filters: DELIVERIES_FILTER_CONFIG,
    filterFn: filterDelivery,
    sortFn: sortDeliveries,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  const filteredDeliveries = React.useMemo(
    () => deliveryFilters.applyFilters(deliveries),
    [deliveryFilters, deliveries]
  );

  const deliveryPagination = usePagination({
    storageKey: 'admin_webhook_deliveries_pagination',
    totalItems: filteredDeliveries.length,
    defaultPageSize
  });

  const paginatedDeliveries = React.useMemo(
    () => deliveryPagination.paginate(filteredDeliveries),
    [deliveryPagination, filteredDeliveries]
  );

  const openDeliveryDetail = React.useCallback((delivery: WebhookDelivery) => {
    setSelectedDelivery(delivery);
    deliveryDetailModal.open();
  }, [deliveryDetailModal]);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title={`DELIVERIES: ${selectedWebhook.name}`}
        stats={
          <TableStats
            items={[
              { value: deliveries.length, label: 'total' },
              { value: deliveries.filter((d) => d.status === 'success').length, label: 'success', variant: 'completed' },
              { value: deliveries.filter((d) => d.status === 'failed').length, label: 'failed', variant: 'cancelled' },
              { value: deliveries.filter((d) => d.status === 'pending').length, label: 'pending', variant: 'pending' }
            ]}
          />
        }
        actions={
          <>
            <button className="btn btn-secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <FilterDropdown
              sections={DELIVERIES_FILTER_CONFIG.map((c) => ({
                key: c.key,
                label: c.label,
                options: c.options
              }))}
              values={deliveryFilters.filterValues}
              onChange={(key, value) => deliveryFilters.setFilter(key, value)}
            />
            <IconButton
              action="refresh"
              onClick={() => onRefresh(selectedWebhook.id)}
              disabled={deliveriesLoading}
              title="Refresh"
            />
          </>
        }
        pagination={
          !deliveriesLoading && filteredDeliveries.length > 0 ? (
            <TablePagination
              pageInfo={deliveryPagination.pageInfo}
              page={deliveryPagination.page}
              pageSize={deliveryPagination.pageSize}
              pageSizeOptions={deliveryPagination.pageSizeOptions}
              canGoPrev={deliveryPagination.canGoPrev}
              canGoNext={deliveryPagination.canGoNext}
              onPageSizeChange={deliveryPagination.setPageSize}
              onFirstPage={deliveryPagination.firstPage}
              onPrevPage={deliveryPagination.prevPage}
              onNextPage={deliveryPagination.nextPage}
              onLastPage={deliveryPagination.lastPage}
            />
          ) : undefined
        }
      >
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="type-col">Event Type</PortalTableHead>
              <PortalTableHead className="status-col">Status</PortalTableHead>
              <PortalTableHead className="count-col">Response</PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={deliveryFilters.sort?.column === 'createdAt' ? deliveryFilters.sort.direction : null}
                onClick={() => deliveryFilters.toggleSort('createdAt')}
              >
                Created At
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!deliveriesLoading && !deliveriesError}>
            {deliveriesError ? (
              <PortalTableError colSpan={5} message={deliveriesError} onRetry={() => onRefresh(selectedWebhook.id)} />
            ) : deliveriesLoading ? (
              <PortalTableLoading colSpan={5} rows={5} />
            ) : paginatedDeliveries.length === 0 ? (
              <PortalTableEmpty
                colSpan={5}
                icon={<Inbox />}
                message={deliveryFilters.hasActiveFilters ? 'No deliveries match your filters' : 'No deliveries yet'}
              />
            ) : (
              paginatedDeliveries.map((delivery) => (
                <PortalTableRow key={delivery.id}>
                  <PortalTableCell className="type-cell">
                    <span className="status-badge">{delivery.eventType}</span>
                  </PortalTableCell>
                  <PortalTableCell className="status-col">
                    <StatusBadge status={getStatusVariant(getDeliveryStatusVariant(delivery.status))} size="sm">
                      {delivery.status}
                    </StatusBadge>
                  </PortalTableCell>
                  <PortalTableCell className="count-cell">
                    {delivery.responseStatus ?? '-'}
                  </PortalTableCell>
                  <PortalTableCell className="date-col">
                    {formatDate(delivery.createdAt)}
                  </PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      <IconButton
                        action="view"
                        title="View Detail"
                        onClick={() => openDeliveryDetail(delivery)}
                      />
                      {delivery.status === 'failed' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onRetry(selectedWebhook.id)}
                          title="Retry"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      {/* Delivery Detail Modal */}
      <PortalModal
        open={deliveryDetailModal.isOpen}
        onOpenChange={deliveryDetailModal.setIsOpen}
        title="Delivery Detail"
        size="lg"
      >
        {selectedDelivery && (
          <div className="detail-grid">
            <div className="detail-row">
              <span className="detail-label">Event Type</span>
              <span className="detail-value">{selectedDelivery.eventType}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <span className="detail-value">
                <StatusBadge status={getStatusVariant(getDeliveryStatusVariant(selectedDelivery.status))} size="sm">
                  {selectedDelivery.status}
                </StatusBadge>
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Response Status</span>
              <span className="detail-value">{selectedDelivery.responseStatus ?? 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Created At</span>
              <span className="detail-value">{formatDate(selectedDelivery.createdAt)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Payload</span>
              <pre className="detail-value form-textarea pre-wrap-scroll">
                {selectedDelivery.payload || 'N/A'}
              </pre>
            </div>
            <div className="detail-row">
              <span className="detail-label">Response Body</span>
              <pre className="detail-value form-textarea pre-wrap-scroll">
                {selectedDelivery.responseBody || 'N/A'}
              </pre>
            </div>
          </div>
        )}
      </PortalModal>
    </div>
  );
}
