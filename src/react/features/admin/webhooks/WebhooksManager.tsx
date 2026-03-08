/**
 * ===============================================
 * WEBHOOKS MANAGER
 * ===============================================
 * @file src/react/features/admin/webhooks/WebhooksManager.tsx
 *
 * Full CRUD admin panel for managing webhooks.
 * Views: Main table, Add/Edit modal, Deliveries, Stats, Test modal.
 */

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Webhook,
  Inbox,
  Play,
  History,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
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
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import type { SortConfig } from '../types';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('WebhooksManager');

// ============================================
// CONSTANTS
// ============================================

const AVAILABLE_EVENTS = [
  'client.created',
  'client.updated',
  'client.deleted',
  'project.created',
  'project.updated',
  'project.completed',
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  'proposal.sent',
  'proposal.accepted',
  'proposal.declined',
  'contract.signed',
  'task.completed',
  'message.received'
] as const;

const METHOD_OPTIONS = ['POST', 'PUT'] as const;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

const DELIVERY_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' }
];

const WEBHOOKS_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS }
];

const DELIVERIES_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: DELIVERY_STATUS_FILTER_OPTIONS },
  { key: 'eventType', label: 'EVENT', options: [{ value: 'all', label: 'All' }] }
];

const MAX_URL_DISPLAY_LENGTH = 40;
const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BACKOFF_SECONDS = 60;

// ============================================
// TYPES
// ============================================

interface WebhookItem {
  id: number;
  name: string;
  url: string;
  events: string[];
  method: string;
  headers: Record<string, string>;
  is_active: boolean;
  retryMaxAttempts: number;
  retryBackoffSeconds: number;
  totalDeliveries: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

interface WebhookDelivery {
  id: number;
  webhookId: number;
  eventType: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus: number | null;
  responseBody: string | null;
  payload: string | null;
  createdAt: string;
}

interface WebhookFormData {
  name: string;
  url: string;
  events: string[];
  method: string;
  headers: string;
  retryMaxAttempts: number;
  retryBackoffSeconds: number;
}

interface WebhooksManagerProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
}

type PanelView = 'list' | 'deliveries' | 'stats';

// ============================================
// HELPERS
// ============================================

function truncateUrl(url: string): string {
  if (url.length <= MAX_URL_DISPLAY_LENGTH) return url;
  return `${url.substring(0, MAX_URL_DISPLAY_LENGTH)}...`;
}

function getDeliveryStatusVariant(status: string) {
  switch (status) {
  case 'success':
    return 'completed';
  case 'failed':
    return 'cancelled';
  case 'pending':
    return 'pending';
  default:
    return 'inactive';
  }
}

const EMPTY_FORM: WebhookFormData = {
  name: '',
  url: '',
  events: [],
  method: 'POST',
  headers: '{}',
  retryMaxAttempts: DEFAULT_RETRY_MAX_ATTEMPTS,
  retryBackoffSeconds: DEFAULT_RETRY_BACKOFF_SECONDS
};

function filterWebhook(
  webhook: WebhookItem,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    const matchesSearch =
      webhook.name.toLowerCase().includes(query) ||
      webhook.url.toLowerCase().includes(query);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    const isActive = filters.status === 'active';
    if (webhook.is_active !== isActive) return false;
  }

  return true;
}

function sortWebhooks(a: WebhookItem, b: WebhookItem, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return a.name.localeCompare(b.name) * multiplier;
  case 'updatedAt':
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * multiplier;
  case 'totalDeliveries':
    return (a.totalDeliveries - b.totalDeliveries) * multiplier;
  default:
    return 0;
  }
}

function filterDelivery(
  delivery: WebhookDelivery,
  filters: Record<string, string>,
  _search: string
): boolean {
  if (filters.status && filters.status !== 'all') {
    if (delivery.status !== filters.status) return false;
  }
  if (filters.eventType && filters.eventType !== 'all') {
    if (delivery.eventType !== filters.eventType) return false;
  }
  return true;
}

function sortDeliveries(a: WebhookDelivery, b: WebhookDelivery, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'createdAt':
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
  default:
    return 0;
  }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WebhooksManager({
  getAuthToken,
  showNotification,
  onNavigate: _onNavigate,
  defaultPageSize = 25
}: WebhooksManagerProps) {
  const containerRef = useFadeIn();

  // ---- Auth headers ----
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

  // ---- Panel view state ----
  const [view, setView] = useState<PanelView>('list');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookItem | null>(null);

  // ---- List state ----
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);

  // ---- Form modal state ----
  const formModal = useModal();
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Delete confirm state ----
  const deleteDialog = useConfirmDialog();
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookItem | null>(null);

  // ---- Test modal state ----
  const testModal = useModal();
  const [testingWebhook, setTestingWebhook] = useState<WebhookItem | null>(null);
  const [testEventType, setTestEventType] = useState('');
  const [testSampleData, setTestSampleData] = useState('{}');
  const [testSending, setTestSending] = useState(false);

  // ---- Deliveries state ----
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDelivery | null>(null);
  const deliveryDetailModal = useModal();

  // ---- Stats state ----
  const [webhookStats, setWebhookStats] = useState<WebhookStats>({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0
  });

  // ---- Table filters for webhooks list ----
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

  const filteredWebhooks = useMemo(() => applyFilters(webhooks), [applyFilters, webhooks]);

  const pagination = usePagination({
    storageKey: 'admin_webhooks_pagination',
    totalItems: filteredWebhooks.length,
    defaultPageSize
  });

  const paginatedWebhooks = useMemo(
    () => pagination.paginate(filteredWebhooks),
    [pagination, filteredWebhooks]
  );

  // ---- Table filters for deliveries ----
  const deliveryFilters = useTableFilters<WebhookDelivery>({
    storageKey: 'admin_webhook_deliveries',
    filters: DELIVERIES_FILTER_CONFIG,
    filterFn: filterDelivery,
    sortFn: sortDeliveries,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  const filteredDeliveries = useMemo(
    () => deliveryFilters.applyFilters(deliveries),
    [deliveryFilters, deliveries]
  );

  const deliveryPagination = usePagination({
    storageKey: 'admin_webhook_deliveries_pagination',
    totalItems: filteredDeliveries.length,
    defaultPageSize
  });

  const paginatedDeliveries = useMemo(
    () => deliveryPagination.paginate(filteredDeliveries),
    [deliveryPagination, filteredDeliveries]
  );

  // ============================================
  // DATA FETCHING
  // ============================================

  const loadWebhooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.WEBHOOKS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load webhooks');
      const payload = unwrapApiData<{ webhooks?: WebhookItem[] }>(await response.json());
      setWebhooks(payload.webhooks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  const loadDeliveries = useCallback(async (webhookId: number) => {
    setDeliveriesLoading(true);
    setDeliveriesError(null);
    try {
      const response = await fetch(buildEndpoint.webhookDeliveries(webhookId), {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load deliveries');
      const payload = unwrapApiData<{ deliveries?: WebhookDelivery[] }>(await response.json());
      setDeliveries(payload.deliveries || []);
    } catch (err) {
      setDeliveriesError(err instanceof Error ? err.message : 'Failed to load deliveries');
    } finally {
      setDeliveriesLoading(false);
    }
  }, [getHeaders]);

  const loadStats = useCallback(async (webhookId: number) => {
    try {
      const response = await fetch(buildEndpoint.webhookStats(webhookId), {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load stats');
      const payload = unwrapApiData<WebhookStats>(await response.json());
      setWebhookStats(payload);
    } catch (err) {
      logger.error('Failed to load webhook stats:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  // ============================================
  // ACTIONS
  // ============================================

  const handleToggleActive = useCallback(async (webhook: WebhookItem) => {
    try {
      const response = await fetch(buildEndpoint.webhookToggle(webhook.id), {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to toggle webhook');
      setWebhooks((prev) =>
        prev.map((w) =>
          w.id === webhook.id ? { ...w, is_active: !w.is_active } : w
        )
      );
      showNotification?.(
        `Webhook ${!webhook.is_active ? 'activated' : 'deactivated'}`,
        'success'
      );
    } catch (err) {
      logger.error('Failed to toggle webhook:', err);
      showNotification?.('Failed to toggle webhook', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleDelete = useCallback(async () => {
    if (!deletingWebhook) return;
    try {
      const response = await fetch(buildEndpoint.webhook(deletingWebhook.id), {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete webhook');
      setWebhooks((prev) => prev.filter((w) => w.id !== deletingWebhook.id));
      showNotification?.('Webhook deleted', 'success');
    } catch (err) {
      logger.error('Failed to delete webhook:', err);
      showNotification?.('Failed to delete webhook', 'error');
    }
  }, [deletingWebhook, getHeaders, showNotification]);

  const openDeleteDialog = useCallback((webhook: WebhookItem) => {
    setDeletingWebhook(webhook);
    deleteDialog.open();
  }, [deleteDialog]);

  const handleRetryDelivery = useCallback(async (webhookId: number) => {
    try {
      const response = await fetch(buildEndpoint.webhookRetry(webhookId), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to retry delivery');
      showNotification?.('Delivery retry queued', 'success');
      if (selectedWebhook) {
        loadDeliveries(selectedWebhook.id);
      }
    } catch (err) {
      logger.error('Failed to retry delivery:', err);
      showNotification?.('Failed to retry delivery', 'error');
    }
  }, [getHeaders, showNotification, selectedWebhook, loadDeliveries]);

  // ---- Form handlers ----

  const openAddModal = useCallback(() => {
    setEditingWebhook(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    formModal.open();
  }, [formModal]);

  const openEditModal = useCallback((webhook: WebhookItem) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: [...webhook.events],
      method: webhook.method,
      headers: JSON.stringify(webhook.headers, null, 2),
      retryMaxAttempts: webhook.retryMaxAttempts,
      retryBackoffSeconds: webhook.retryBackoffSeconds
    });
    setFormError(null);
    formModal.open();
  }, [formModal]);

  const handleFormSubmit = useCallback(async () => {
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!formData.url.trim()) {
      setFormError('URL is required');
      return;
    }
    if (formData.events.length === 0) {
      setFormError('At least one event is required');
      return;
    }

    let parsedHeaders: Record<string, string>;
    try {
      parsedHeaders = JSON.parse(formData.headers);
    } catch {
      setFormError('Headers must be valid JSON');
      return;
    }

    setFormSaving(true);
    try {
      const body = {
        name: formData.name.trim(),
        url: formData.url.trim(),
        events: formData.events,
        method: formData.method,
        headers: parsedHeaders,
        retryMaxAttempts: formData.retryMaxAttempts,
        retryBackoffSeconds: formData.retryBackoffSeconds
      };

      const isEditing = editingWebhook !== null;
      const endpoint = isEditing
        ? buildEndpoint.webhook(editingWebhook.id)
        : API_ENDPOINTS.ADMIN.WEBHOOKS;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to ${isEditing ? 'update' : 'create'} webhook`);
      }

      showNotification?.(
        `Webhook ${isEditing ? 'updated' : 'created'} successfully`,
        'success'
      );
      formModal.close();
      loadWebhooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save webhook';
      setFormError(message);
      logger.error('Failed to save webhook:', err);
    } finally {
      setFormSaving(false);
    }
  }, [formData, editingWebhook, getHeaders, showNotification, formModal, loadWebhooks]);

  const handleEventToggle = useCallback((event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event]
    }));
  }, []);

  // ---- Test handlers ----

  const openTestModal = useCallback((webhook: WebhookItem) => {
    setTestingWebhook(webhook);
    setTestEventType(webhook.events[0] || '');
    setTestSampleData('{}');
    testModal.open();
  }, [testModal]);

  const handleTestSubmit = useCallback(async () => {
    if (!testingWebhook || !testEventType) return;

    let parsedData: Record<string, unknown>;
    try {
      parsedData = JSON.parse(testSampleData);
    } catch {
      showNotification?.('Sample data must be valid JSON', 'error');
      return;
    }

    setTestSending(true);
    try {
      const response = await fetch(buildEndpoint.webhookTest(testingWebhook.id), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          eventType: testEventType,
          sampleData: parsedData
        })
      });
      if (!response.ok) throw new Error('Failed to send test');
      showNotification?.('Test webhook sent', 'success');
      testModal.close();
    } catch (err) {
      logger.error('Failed to test webhook:', err);
      showNotification?.('Failed to send test webhook', 'error');
    } finally {
      setTestSending(false);
    }
  }, [testingWebhook, testEventType, testSampleData, getHeaders, showNotification, testModal]);

  // ---- View navigation ----

  const navigateToDeliveries = useCallback((webhook: WebhookItem) => {
    setSelectedWebhook(webhook);
    setView('deliveries');
    loadDeliveries(webhook.id);
  }, [loadDeliveries]);

  const navigateToStats = useCallback((webhook: WebhookItem) => {
    setSelectedWebhook(webhook);
    setView('stats');
    loadStats(webhook.id);
  }, [loadStats]);

  const navigateToList = useCallback(() => {
    setSelectedWebhook(null);
    setView('list');
    setDeliveries([]);
    setSelectedDelivery(null);
  }, []);

  const openDeliveryDetail = useCallback((delivery: WebhookDelivery) => {
    setSelectedDelivery(delivery);
    deliveryDetailModal.open();
  }, [deliveryDetailModal]);

  // ---- Filter config ----
  const handleFilterChange = useCallback(
    (key: string, value: string) => setFilter(key, value),
    [setFilter]
  );

  const filterSections = WEBHOOKS_FILTER_CONFIG.map((config) => ({
    key: config.key,
    label: config.label,
    options: config.options
  }));

  // ---- Computed stats for list header ----
  const listStats = useMemo(() => {
    const total = webhooks.length;
    const active = webhooks.filter((w) => w.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [webhooks]);

  // ============================================
  // RENDER: DELIVERIES VIEW
  // ============================================

  if (view === 'deliveries' && selectedWebhook) {
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
              <button className="btn btn-secondary" onClick={navigateToList}>
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
                onClick={() => loadDeliveries(selectedWebhook.id)}
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
                <PortalTableHead className="actions-col">Actions</PortalTableHead>
              </PortalTableRow>
            </PortalTableHeader>

            <PortalTableBody animate={!deliveriesLoading && !deliveriesError}>
              {deliveriesError ? (
                <PortalTableError colSpan={5} message={deliveriesError} onRetry={() => loadDeliveries(selectedWebhook.id)} />
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
                    <PortalTableCell className="status-cell">
                      <StatusBadge status={getStatusVariant(getDeliveryStatusVariant(delivery.status))} size="sm">
                        {delivery.status}
                      </StatusBadge>
                    </PortalTableCell>
                    <PortalTableCell className="count-cell">
                      {delivery.responseStatus ?? '-'}
                    </PortalTableCell>
                    <PortalTableCell className="date-cell">
                      {formatDate(delivery.createdAt)}
                    </PortalTableCell>
                    <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
                        <IconButton
                          action="view"
                          title="View Detail"
                          onClick={() => openDeliveryDetail(delivery)}
                        />
                        {delivery.status === 'failed' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRetryDelivery(selectedWebhook.id)}
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

  // ============================================
  // RENDER: STATS VIEW
  // ============================================

  if (view === 'stats' && selectedWebhook) {
    return (
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="portal-card">
        <div className="flex items-center gap-3 mb-6">
          <button className="btn btn-secondary" onClick={navigateToList}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h3 className="text-lg font-semibold">Stats: {selectedWebhook.name}</h3>
          <IconButton
            action="refresh"
            onClick={() => loadStats(selectedWebhook.id)}
            title="Refresh"
          />
        </div>

        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">Total Deliveries</span>
            <span className="detail-value">{webhookStats.total}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Successful</span>
            <span className="detail-value text-success">{webhookStats.success}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Failed</span>
            <span className="detail-value text-danger">{webhookStats.failed}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Pending</span>
            <span className="detail-value text-warning">{webhookStats.pending}</span>
          </div>
          {webhookStats.total > 0 && (
            <div className="detail-row">
              <span className="detail-label">Success Rate</span>
              <span className="detail-value">
                {Math.round((webhookStats.success / webhookStats.total) * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: MAIN LIST VIEW
  // ============================================

  return (
    <>
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
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus className="h-4 w-4" />
              Add Webhook
            </button>
            <IconButton
              action="refresh"
              onClick={loadWebhooks}
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
              <PortalTableError colSpan={7} message={error} onRetry={loadWebhooks} />
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
                      onClick={() => handleToggleActive(webhook)}
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
                        onClick={() => openEditModal(webhook)}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openTestModal(webhook)}
                        title="Test"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigateToDeliveries(webhook)}
                        title="View Deliveries"
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigateToStats(webhook)}
                        title="View Stats"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                      </button>
                      <IconButton
                        action="delete"
                        title="Delete"
                        onClick={() => openDeleteDialog(webhook)}
                      />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      {/* Add/Edit Webhook Modal */}
      <PortalModal
        open={formModal.isOpen}
        onOpenChange={formModal.setIsOpen}
        title={editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
        size="lg"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={formModal.close}
              disabled={formSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleFormSubmit}
              disabled={formSaving}
            >
              {formSaving ? 'Saving...' : editingWebhook ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="form-error-message">{formError}</div>
          )}

          <div className="form-group">
            <label className="field-label">Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="My Webhook"
            />
          </div>

          <div className="form-group">
            <label className="field-label">URL</label>
            <input
              type="url"
              className="form-input"
              value={formData.url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/webhook"
            />
          </div>

          <div className="form-group">
            <label className="field-label">Events</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {AVAILABLE_EVENTS.map((event) => (
                <button
                  key={event}
                  type="button"
                  className={`status-badge ${formData.events.includes(event) ? 'status-badge-active' : ''}`}
                  onClick={() => handleEventToggle(event)}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="field-label">Method</label>
            <select
              className="form-select"
              value={formData.method}
              onChange={(e) => setFormData((prev) => ({ ...prev, method: e.target.value }))}
            >
              {METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="field-label">Headers (JSON)</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={formData.headers}
              onChange={(e) => setFormData((prev) => ({ ...prev, headers: e.target.value }))}
              placeholder='{"Authorization": "Bearer ..."}'
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="field-label">Max Retry Attempts</label>
              <input
                type="number"
                className="form-input"
                min={0}
                max={10}
                value={formData.retryMaxAttempts}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  retryMaxAttempts: parseInt(e.target.value, 10) || 0
                }))}
              />
            </div>
            <div className="form-group">
              <label className="field-label">Retry Backoff (seconds)</label>
              <input
                type="number"
                className="form-input"
                min={0}
                value={formData.retryBackoffSeconds}
                onChange={(e) => setFormData((prev) => ({
                  ...prev,
                  retryBackoffSeconds: parseInt(e.target.value, 10) || 0
                }))}
              />
            </div>
          </div>
        </div>
      </PortalModal>

      {/* Test Webhook Modal */}
      <PortalModal
        open={testModal.isOpen}
        onOpenChange={testModal.setIsOpen}
        title={`Test Webhook: ${testingWebhook?.name || ''}`}
        size="md"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={testModal.close}
              disabled={testSending}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleTestSubmit}
              disabled={testSending || !testEventType}
            >
              {testSending ? 'Sending...' : 'Send Test'}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="form-group">
            <label className="field-label">Event Type</label>
            <select
              className="form-select"
              value={testEventType}
              onChange={(e) => setTestEventType(e.target.value)}
            >
              <option value="">Select event...</option>
              {testingWebhook?.events.map((event) => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="field-label">Sample Data (JSON, optional)</label>
            <textarea
              className="form-textarea"
              rows={6}
              value={testSampleData}
              onChange={(e) => setTestSampleData(e.target.value)}
              placeholder='{"key": "value"}'
            />
          </div>
        </div>
      </PortalModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Webhook"
        description={`Are you sure you want to delete "${deletingWebhook?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteDialog.isLoading}
        onConfirm={() => deleteDialog.confirm(handleDelete)}
      />
    </>
  );
}
