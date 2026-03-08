/**
 * Webhooks data fetching and CRUD operations hook
 * @file src/react/features/admin/webhooks/useWebhooksData.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/utils/logger';
import { unwrapApiData } from '@/utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import {
  EMPTY_FORM,
  type WebhookItem,
  type WebhookStats,
  type WebhookDelivery,
  type WebhookFormData,
  type PanelView
} from './types';

const logger = createLogger('WebhooksManager');

interface UseWebhooksDataParams {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useWebhooksData({ getAuthToken, showNotification }: UseWebhooksDataParams) {
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [getAuthToken]);

  // ---- View state ----
  const [view, setView] = useState<PanelView>('list');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookItem | null>(null);

  // ---- List state ----
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);

  // ---- Form state ----
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Delete state ----
  const [deletingWebhook, setDeletingWebhook] = useState<WebhookItem | null>(null);

  // ---- Test state ----
  const [testingWebhook, setTestingWebhook] = useState<WebhookItem | null>(null);
  const [testEventType, setTestEventType] = useState('');
  const [testSampleData, setTestSampleData] = useState('{}');
  const [testSending, setTestSending] = useState(false);

  // ---- Deliveries state ----
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);

  // ---- Stats state ----
  const [webhookStats, setWebhookStats] = useState<WebhookStats>({
    total: 0, success: 0, failed: 0, pending: 0
  });

  // ---- Data fetching ----

  const loadWebhooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.WEBHOOKS, {
        method: 'GET', headers: getHeaders(), credentials: 'include'
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
        method: 'GET', headers: getHeaders(), credentials: 'include'
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
        method: 'GET', headers: getHeaders(), credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load stats');
      const payload = unwrapApiData<WebhookStats>(await response.json());
      setWebhookStats(payload);
    } catch (err) {
      logger.error('Failed to load webhook stats:', err);
    }
  }, [getHeaders]);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);

  // ---- Actions ----

  const handleToggleActive = useCallback(async (webhook: WebhookItem) => {
    try {
      const response = await fetch(buildEndpoint.webhookToggle(webhook.id), {
        method: 'PATCH', headers: getHeaders(), credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to toggle webhook');
      setWebhooks((prev) =>
        prev.map((w) => w.id === webhook.id ? { ...w, is_active: !w.is_active } : w)
      );
      showNotification?.(`Webhook ${!webhook.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (err) {
      logger.error('Failed to toggle webhook:', err);
      showNotification?.('Failed to toggle webhook', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleDelete = useCallback(async () => {
    if (!deletingWebhook) return;
    try {
      const response = await fetch(buildEndpoint.webhook(deletingWebhook.id), {
        method: 'DELETE', headers: getHeaders(), credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete webhook');
      setWebhooks((prev) => prev.filter((w) => w.id !== deletingWebhook.id));
      showNotification?.('Webhook deleted', 'success');
    } catch (err) {
      logger.error('Failed to delete webhook:', err);
      showNotification?.('Failed to delete webhook', 'error');
    }
  }, [deletingWebhook, getHeaders, showNotification]);

  const handleRetryDelivery = useCallback(async (webhookId: number) => {
    try {
      const response = await fetch(buildEndpoint.webhookRetry(webhookId), {
        method: 'POST', headers: getHeaders(), credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to retry delivery');
      showNotification?.('Delivery retry queued', 'success');
      if (selectedWebhook) loadDeliveries(selectedWebhook.id);
    } catch (err) {
      logger.error('Failed to retry delivery:', err);
      showNotification?.('Failed to retry delivery', 'error');
    }
  }, [getHeaders, showNotification, selectedWebhook, loadDeliveries]);

  // ---- Form handlers ----

  const prepareAddForm = useCallback(() => {
    setEditingWebhook(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
  }, []);

  const prepareEditForm = useCallback((webhook: WebhookItem) => {
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
  }, []);

  const handleFormSubmit = useCallback(async (onClose: () => void) => {
    setFormError(null);
    if (!formData.name.trim()) { setFormError('Name is required'); return; }
    if (!formData.url.trim()) { setFormError('URL is required'); return; }
    if (formData.events.length === 0) { setFormError('At least one event is required'); return; }

    let parsedHeaders: Record<string, string>;
    try { parsedHeaders = JSON.parse(formData.headers); }
    catch { setFormError('Headers must be valid JSON'); return; }

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
      const endpoint = isEditing ? buildEndpoint.webhook(editingWebhook.id) : API_ENDPOINTS.ADMIN.WEBHOOKS;
      const response = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getHeaders(), credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to ${isEditing ? 'update' : 'create'} webhook`);
      }
      showNotification?.(`Webhook ${isEditing ? 'updated' : 'created'} successfully`, 'success');
      onClose();
      loadWebhooks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save webhook';
      setFormError(message);
      logger.error('Failed to save webhook:', err);
    } finally {
      setFormSaving(false);
    }
  }, [formData, editingWebhook, getHeaders, showNotification, loadWebhooks]);

  const handleEventToggle = useCallback((event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event]
    }));
  }, []);

  // ---- Test handlers ----

  const prepareTest = useCallback((webhook: WebhookItem) => {
    setTestingWebhook(webhook);
    setTestEventType(webhook.events[0] || '');
    setTestSampleData('{}');
  }, []);

  const handleTestSubmit = useCallback(async (onClose: () => void) => {
    if (!testingWebhook || !testEventType) return;
    let parsedData: Record<string, unknown>;
    try { parsedData = JSON.parse(testSampleData); }
    catch { showNotification?.('Sample data must be valid JSON', 'error'); return; }

    setTestSending(true);
    try {
      const response = await fetch(buildEndpoint.webhookTest(testingWebhook.id), {
        method: 'POST', headers: getHeaders(), credentials: 'include',
        body: JSON.stringify({ eventType: testEventType, sampleData: parsedData })
      });
      if (!response.ok) throw new Error('Failed to send test');
      showNotification?.('Test webhook sent', 'success');
      onClose();
    } catch (err) {
      logger.error('Failed to test webhook:', err);
      showNotification?.('Failed to send test webhook', 'error');
    } finally {
      setTestSending(false);
    }
  }, [testingWebhook, testEventType, testSampleData, getHeaders, showNotification]);

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
  }, []);

  return {
    // View state
    view, selectedWebhook,
    // List state
    isLoading, error, webhooks,
    // Form state
    editingWebhook, formData, formSaving, formError, setFormData,
    // Delete state
    deletingWebhook, setDeletingWebhook,
    // Test state
    testingWebhook, testEventType, testSampleData, testSending,
    setTestEventType, setTestSampleData,
    // Deliveries state
    deliveries, deliveriesLoading, deliveriesError,
    // Stats state
    webhookStats,
    // Data fetching
    loadWebhooks, loadDeliveries, loadStats,
    // Actions
    handleToggleActive, handleDelete, handleRetryDelivery,
    // Form handlers
    prepareAddForm, prepareEditForm, handleFormSubmit, handleEventToggle,
    // Test handlers
    prepareTest, handleTestSubmit,
    // Navigation
    navigateToDeliveries, navigateToStats, navigateToList
  };
}
