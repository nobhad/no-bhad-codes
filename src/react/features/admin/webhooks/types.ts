/**
 * Webhook feature types, constants, and helpers
 * @file src/react/features/admin/webhooks/types.ts
 */

import type { SortConfig } from '../types';

// ============================================
// CONSTANTS
// ============================================

export const AVAILABLE_EVENTS = [
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

export const METHOD_OPTIONS = ['POST', 'PUT'] as const;

export const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const DELIVERY_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' }
];

export const WEBHOOKS_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS }
];

export const DELIVERIES_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: DELIVERY_STATUS_FILTER_OPTIONS },
  { key: 'eventType', label: 'EVENT', options: [{ value: 'all', label: 'All' }] }
];

export const MAX_URL_DISPLAY_LENGTH = 40;
export const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
export const DEFAULT_RETRY_BACKOFF_SECONDS = 60;

// ============================================
// TYPES
// ============================================

export interface WebhookItem {
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

export interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

export interface WebhookDelivery {
  id: number;
  webhookId: number;
  eventType: string;
  status: 'success' | 'failed' | 'pending';
  responseStatus: number | null;
  responseBody: string | null;
  payload: string | null;
  createdAt: string;
}

export interface WebhookFormData {
  name: string;
  url: string;
  events: string[];
  method: string;
  headers: string;
  retryMaxAttempts: number;
  retryBackoffSeconds: number;
}

export interface WebhooksManagerProps {
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
}

export type PanelView = 'list' | 'deliveries' | 'stats';

export const EMPTY_FORM: WebhookFormData = {
  name: '',
  url: '',
  events: [],
  method: 'POST',
  headers: '{}',
  retryMaxAttempts: DEFAULT_RETRY_MAX_ATTEMPTS,
  retryBackoffSeconds: DEFAULT_RETRY_BACKOFF_SECONDS
};

// ============================================
// HELPERS
// ============================================

export function truncateUrl(url: string): string {
  if (url.length <= MAX_URL_DISPLAY_LENGTH) return url;
  return `${url.substring(0, MAX_URL_DISPLAY_LENGTH)}...`;
}

export function getDeliveryStatusVariant(status: string) {
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

export function filterWebhook(
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

export function sortWebhooks(a: WebhookItem, b: WebhookItem, sort: SortConfig): number {
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

export function filterDelivery(
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

export function sortDeliveries(a: WebhookDelivery, b: WebhookDelivery, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'createdAt':
    return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * multiplier;
  default:
    return 0;
  }
}
