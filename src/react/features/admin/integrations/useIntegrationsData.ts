/**
 * Integrations data fetching and CRUD operations hook
 * @file src/react/features/admin/integrations/useIntegrationsData.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '@/utils/logger';
import { unwrapApiData, apiFetch, apiPut, apiDelete, apiPost } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import {
  EMPTY_NOTIFICATION_FORM,
  type IntegrationStatus,
  type NotificationConfig,
  type NotificationFormData,
  type StripeStatus,
  type CalendarStatus
} from './types';

const logger = createLogger('IntegrationsManager');

interface UseIntegrationsDataParams {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useIntegrationsData({ getAuthToken, showNotification }: UseIntegrationsDataParams) {
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [getAuthToken]);

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);

  // Modal state
  const [editingNotification, setEditingNotification] = useState<NotificationConfig | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // ---- Data fetching ----

  const loadIntegrations = useCallback(async () => {
    try {
      const response = await apiFetch(API_ENDPOINTS.INTEGRATIONS_STATUS);
      if (!response.ok) throw new Error('Failed to load integration status');
      const payload = unwrapApiData<IntegrationStatus[]>(await response.json());
      setIntegrations(Array.isArray(payload) ? payload : []);
    } catch (err) {
      logger.error('Failed to load integrations', err);
    }
  }, [getHeaders]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiFetch(API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS);
      if (!response.ok) throw new Error('Failed to load notifications');
      const payload = unwrapApiData<NotificationConfig[]>(await response.json());
      setNotifications(Array.isArray(payload) ? payload : []);
    } catch (err) {
      logger.error('Failed to load notifications', err);
    }
  }, [getHeaders]);

  const loadStripeStatus = useCallback(async () => {
    try {
      const response = await apiFetch(API_ENDPOINTS.INTEGRATIONS_STRIPE_STATUS);
      if (!response.ok) throw new Error('Failed to load Stripe status');
      const payload = unwrapApiData<StripeStatus>(await response.json());
      setStripeStatus(payload);
    } catch (err) {
      logger.error('Failed to load Stripe status', err);
    }
  }, [getHeaders]);

  const loadCalendarStatus = useCallback(async () => {
    try {
      const response = await apiFetch(API_ENDPOINTS.INTEGRATIONS_CALENDAR_STATUS);
      if (!response.ok) throw new Error('Failed to load calendar status');
      const payload = unwrapApiData<CalendarStatus>(await response.json());
      setCalendarStatus(payload);
    } catch (err) {
      logger.error('Failed to load calendar status', err);
    }
  }, [getHeaders]);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadIntegrations(), loadNotifications(), loadStripeStatus(), loadCalendarStatus()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations data');
    } finally {
      setIsLoading(false);
    }
  }, [loadIntegrations, loadNotifications, loadStripeStatus, loadCalendarStatus]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  // ---- Notification CRUD ----

  const prepareAddNotification = useCallback(() => {
    setEditingNotification(null);
  }, []);

  const prepareEditNotification = useCallback((notification: NotificationConfig) => {
    setEditingNotification(notification);
  }, []);

  const handleSaveNotification = useCallback(async (data: NotificationFormData, onClose: () => void) => {
    setIsSubmitting(true);
    try {
      const isEditing = editingNotification !== null;
      const url = isEditing
        ? `${API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS}/${editingNotification.id}`
        : API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS;

      const response = isEditing
        ? await apiPut(url, data)
        : await apiPost(url, data);

      if (!response.ok) throw new Error(`Failed to ${isEditing ? 'update' : 'create'} notification`);

      showNotification?.(`Notification ${isEditing ? 'updated' : 'created'} successfully`, 'success');
      onClose();
      await loadNotifications();
    } catch (err) {
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to save notification',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editingNotification, getHeaders, showNotification, loadNotifications]);

  const handleDeleteNotification = useCallback(async () => {
    if (deletingNotificationId === null) return;
    try {
      const response = await apiDelete(`${API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS}/${deletingNotificationId}`);
      if (!response.ok) throw new Error('Failed to delete notification');
      showNotification?.('Notification deleted successfully', 'success');
      await loadNotifications();
    } catch (err) {
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to delete notification',
        'error'
      );
    }
  }, [deletingNotificationId, getHeaders, showNotification, loadNotifications]);

  const handleTestNotification = useCallback(async (id: number) => {
    setTestingId(id);
    try {
      const response = await apiPost(`${API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS}/${id}/test`);
      if (!response.ok) throw new Error('Failed to send test notification');
      showNotification?.('Test notification sent', 'success');
    } catch (err) {
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to send test notification',
        'error'
      );
    } finally {
      setTestingId(null);
    }
  }, [getHeaders, showNotification]);

  const prepareDeleteNotification = useCallback((notification: NotificationConfig) => {
    setDeletingNotificationId(notification.id);
  }, []);

  // ---- Calendar settings ----

  const handleToggleCalendarSync = useCallback(async () => {
    if (!calendarStatus) return;
    try {
      const response = await apiPut(API_ENDPOINTS.INTEGRATIONS_CALENDAR_SETTINGS, { syncEnabled: !calendarStatus.syncEnabled });
      if (!response.ok) throw new Error('Failed to update calendar settings');
      showNotification?.(
        `Calendar sync ${calendarStatus.syncEnabled ? 'disabled' : 'enabled'}`,
        'success'
      );
      await loadCalendarStatus();
    } catch (err) {
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to update calendar settings',
        'error'
      );
    }
  }, [calendarStatus, getHeaders, showNotification, loadCalendarStatus]);

  // ---- Derived values ----

  const activeCount = integrations.filter((i) => i.active).length;
  const configuredCount = integrations.filter((i) => i.configured).length;

  const notificationFormData: NotificationFormData = editingNotification
    ? {
      name: editingNotification.name,
      channel: editingNotification.channel,
      event: editingNotification.event,
      enabled: editingNotification.enabled
    }
    : EMPTY_NOTIFICATION_FORM;

  return {
    // Data state
    isLoading, error,
    integrations, notifications, stripeStatus, calendarStatus,
    // Derived
    activeCount, configuredCount, notificationFormData,
    // Modal state
    isSubmitting, testingId, deletingNotificationId,
    // Data fetching
    loadAllData,
    // Notification CRUD
    prepareAddNotification, prepareEditNotification,
    handleSaveNotification, handleDeleteNotification,
    handleTestNotification, prepareDeleteNotification,
    // Calendar
    handleToggleCalendarSync
  };
}
