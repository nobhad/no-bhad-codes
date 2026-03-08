import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Calendar,
  MessageSquare,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Send,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { PortalModal, useModal } from '@react/components/portal/PortalModal';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { IconButton } from '@react/factories';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('IntegrationsManager');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationStatus {
  name: string;
  configured: boolean;
  active: boolean;
  lastActivity: string | null;
}

interface NotificationConfig {
  id: number;
  name: string;
  channel: string;
  event: string;
  enabled: boolean;
  createdAt: string;
}

interface StripeStatus {
  connected: boolean;
  accountId: string | null;
  mode: 'live' | 'test' | null;
  lastCharge: string | null;
}

interface CalendarStatus {
  connected: boolean;
  provider: string | null;
  syncEnabled: boolean;
  lastSync: string | null;
}

interface NotificationFormData {
  name: string;
  channel: string;
  event: string;
  enabled: boolean;
}

interface IntegrationsManagerProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_NOTIFICATION_FORM: NotificationFormData = {
  name: '',
  channel: 'email',
  event: '',
  enabled: true
};

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'discord', label: 'Discord' },
  { value: 'webhook', label: 'Webhook' }
];

const EVENT_OPTIONS = [
  { value: 'invoice.paid', label: 'Invoice Paid' },
  { value: 'invoice.overdue', label: 'Invoice Overdue' },
  { value: 'client.created', label: 'Client Created' },
  { value: 'project.completed', label: 'Project Completed' },
  { value: 'contract.signed', label: 'Contract Signed' },
  { value: 'proposal.accepted', label: 'Proposal Accepted' }
];

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  Stripe: <CreditCard className="icon-lg" />,
  'Google Calendar': <Calendar className="icon-lg" />,
  Slack: <MessageSquare className="icon-lg" />,
  Discord: <MessageSquare className="icon-lg" />,
  Zapier: <Zap className="icon-lg" />
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIntegrationHealthClass(configured: boolean, active: boolean): string {
  if (configured && active) return 'health-indicator health-ok';
  if (configured && !active) return 'health-indicator health-warning';
  return 'health-indicator health-error';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IntegrationCard({ integration }: { integration: IntegrationStatus }) {
  const icon = SERVICE_ICONS[integration.name] || <Zap className="icon-lg" />;
  const healthClass = getIntegrationHealthClass(integration.configured, integration.active);

  return (
    <div className="portal-card">
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--portal-text-muted)' }}>{icon}</span>
            <span className="font-semibold">{integration.name}</span>
          </div>
          <span className={healthClass} />
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Configured</span>
            <span>{integration.configured ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Active</span>
            <span>{integration.active ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Last Activity</span>
            <span>{formatDate(integration.lastActivity)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationFormModal({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isSubmitting
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: NotificationFormData;
  onSubmit: (data: NotificationFormData) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<NotificationFormData>(initialData);
  const isEditing = initialData.name !== '';

  React.useEffect(() => {
    if (open) setForm(initialData);
  }, [open, initialData]);

  const handleChange = (field: keyof NotificationFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Notification' : 'Add Notification'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="field-label">Name</label>
          <input
            className="form-input"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Notification name"
            required
          />
        </div>
        <div className="form-group">
          <label className="field-label">Channel</label>
          <select
            className="form-select"
            value={form.channel}
            onChange={(e) => handleChange('channel', e.target.value)}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="field-label">Event</label>
          <select
            className="form-select"
            value={form.event}
            onChange={(e) => handleChange('event', e.target.value)}
            required
          >
            <option value="">Select event...</option>
            {EVENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="field-label flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
            />
            Enabled
          </label>
        </div>
      </form>
    </PortalModal>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function IntegrationsManager({
  onNavigate: _onNavigate,
  getAuthToken,
  showNotification
}: IntegrationsManagerProps) {
  const containerRef = useFadeIn();

  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationConfig[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);

  // Modal state
  const notificationModal = useModal();
  const deleteDialog = useConfirmDialog();
  const [editingNotification, setEditingNotification] = useState<NotificationConfig | null>(null);
  const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Auth headers
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [getAuthToken]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const loadIntegrations = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.INTEGRATIONS_STATUS, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load integration status');
      const payload = unwrapApiData<IntegrationStatus[]>(await response.json());
      setIntegrations(Array.isArray(payload) ? payload : []);
    } catch (err) {
      logger.error('Failed to load integrations', err);
    }
  }, [getHeaders]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load notifications');
      const payload = unwrapApiData<NotificationConfig[]>(await response.json());
      setNotifications(Array.isArray(payload) ? payload : []);
    } catch (err) {
      logger.error('Failed to load notifications', err);
    }
  }, [getHeaders]);

  const loadStripeStatus = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.INTEGRATIONS_STRIPE_STATUS, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load Stripe status');
      const payload = unwrapApiData<StripeStatus>(await response.json());
      setStripeStatus(payload);
    } catch (err) {
      logger.error('Failed to load Stripe status', err);
    }
  }, [getHeaders]);

  const loadCalendarStatus = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.INTEGRATIONS_CALENDAR_STATUS, {
        headers: getHeaders(),
        credentials: 'include'
      });
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
        loadIntegrations(),
        loadNotifications(),
        loadStripeStatus(),
        loadCalendarStatus()
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations data');
    } finally {
      setIsLoading(false);
    }
  }, [loadIntegrations, loadNotifications, loadStripeStatus, loadCalendarStatus]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ---------------------------------------------------------------------------
  // Notification CRUD
  // ---------------------------------------------------------------------------

  const handleOpenAddNotification = useCallback(() => {
    setEditingNotification(null);
    notificationModal.open();
  }, [notificationModal]);

  const handleOpenEditNotification = useCallback((notification: NotificationConfig) => {
    setEditingNotification(notification);
    notificationModal.open();
  }, [notificationModal]);

  const handleSaveNotification = useCallback(async (data: NotificationFormData) => {
    setIsSubmitting(true);
    try {
      const isEditing = editingNotification !== null;
      const url = isEditing
        ? `${API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS}/${editingNotification.id}`
        : API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error(`Failed to ${isEditing ? 'update' : 'create'} notification`);

      showNotification?.(`Notification ${isEditing ? 'updated' : 'created'} successfully`, 'success');
      notificationModal.close();
      await loadNotifications();
    } catch (err) {
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to save notification',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editingNotification, getHeaders, showNotification, notificationModal, loadNotifications]);

  const handleDeleteNotification = useCallback(async () => {
    if (deletingNotificationId === null) return;
    try {
      const response = await fetch(
        `${API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS}/${deletingNotificationId}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
          credentials: 'include'
        }
      );
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
      const response = await fetch(
        `${API_ENDPOINTS.INTEGRATIONS_NOTIFICATIONS}/${id}/test`,
        {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include'
        }
      );
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

  // ---------------------------------------------------------------------------
  // Calendar settings
  // ---------------------------------------------------------------------------

  const handleToggleCalendarSync = useCallback(async () => {
    if (!calendarStatus) return;
    try {
      const response = await fetch(API_ENDPOINTS.INTEGRATIONS_CALENDAR_SETTINGS, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ syncEnabled: !calendarStatus.syncEnabled })
      });
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

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <TableLayout
      containerRef={containerRef as React.Ref<HTMLDivElement>}
      title="INTEGRATIONS"
      stats={
        <TableStats items={[
          { value: integrations.length, label: 'services' },
          { value: activeCount, label: 'active', variant: 'completed' },
          { value: configuredCount, label: 'configured' },
          { value: notifications.length, label: 'notifications' }
        ]} />
      }
      actions={
        <IconButton action="refresh" onClick={loadAllData} title="Refresh" loading={isLoading} />
      }
    >
      {isLoading ? (
        <LoadingState message="Loading integrations..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAllData} />
      ) : (
        <div className="status-content">

          {/* Overview Section */}
          <div className="status-section">
            <h4 className="status-section-title">Integration Overview</h4>
            <div className="stats-grid">
              {integrations.map((integration) => (
                <IntegrationCard key={integration.name} integration={integration} />
              ))}
            </div>
          </div>

          {/* Notifications Section */}
          <div className="status-section">
            <div className="section-header-with-actions">
              <h4 className="section-title">Notification Configurations</h4>
              <button className="btn btn-primary" onClick={handleOpenAddNotification}>
                <Plus className="icon-sm" />
                Add Notification
              </button>
            </div>

            {notifications.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Channel</th>
                    <th>Event</th>
                    <th>Enabled</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notif) => (
                    <tr key={notif.id}>
                      <td>{notif.name}</td>
                      <td>
                        <span className="status-badge">{notif.channel}</span>
                      </td>
                      <td>{notif.event}</td>
                      <td>
                        <span className={`health-indicator ${notif.enabled ? 'health-ok' : 'health-error'}`} />
                      </td>
                      <td>{formatDate(notif.createdAt)}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleTestNotification(notif.id)}
                            disabled={testingId === notif.id}
                            title="Test notification"
                          >
                            {testingId === notif.id ? (
                              <RefreshCw className="icon-sm animate-spin" />
                            ) : (
                              <Send className="icon-sm" />
                            )}
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditNotification(notif)}
                            title="Edit notification"
                          >
                            <Pencil className="icon-sm" />
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => {
                              setDeletingNotificationId(notif.id);
                              deleteDialog.open();
                            }}
                            title="Delete notification"
                          >
                            <Trash2 className="icon-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="status-empty">
                <AlertCircle className="icon-lg" style={{ color: 'var(--portal-text-muted)' }} />
                <span>No notification configurations yet.</span>
              </div>
            )}
          </div>

          {/* Stripe Section */}
          <div className="status-section">
            <h4 className="status-section-title">Stripe</h4>
            {stripeStatus ? (
              <div className="stats-grid">
                <div className="portal-card">
                  <div className="stat-card">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="icon-lg" style={{ color: 'var(--portal-text-muted)' }} />
                      <span className="font-semibold">Stripe Payment Gateway</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Connected</span>
                        <span className={stripeStatus.connected ? 'text-[var(--status-completed)]' : ''}>
                          {stripeStatus.connected ? (
                            <CheckCircle className="icon-sm" style={{ color: 'var(--status-completed)' }} />
                          ) : (
                            <XCircle className="icon-sm" style={{ color: 'var(--status-cancelled)' }} />
                          )}
                        </span>
                      </div>
                      {stripeStatus.accountId && (
                        <div className="flex justify-between">
                          <span className="text-muted">Account</span>
                          <span>{stripeStatus.accountId}</span>
                        </div>
                      )}
                      {stripeStatus.mode && (
                        <div className="flex justify-between">
                          <span className="text-muted">Mode</span>
                          <span className="status-badge">{stripeStatus.mode}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted">Last Charge</span>
                        <span>{formatDate(stripeStatus.lastCharge)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="status-empty">
                <CreditCard className="icon-lg" style={{ color: 'var(--portal-text-muted)' }} />
                <span>Stripe status unavailable.</span>
              </div>
            )}
          </div>

          {/* Calendar Section */}
          <div className="status-section">
            <h4 className="status-section-title">Calendar</h4>
            {calendarStatus ? (
              <div className="stats-grid">
                <div className="portal-card">
                  <div className="stat-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="icon-lg" style={{ color: 'var(--portal-text-muted)' }} />
                      <span className="font-semibold">Calendar Sync</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted">Connected</span>
                        <span>
                          {calendarStatus.connected ? (
                            <CheckCircle className="icon-sm" style={{ color: 'var(--status-completed)' }} />
                          ) : (
                            <XCircle className="icon-sm" style={{ color: 'var(--status-cancelled)' }} />
                          )}
                        </span>
                      </div>
                      {calendarStatus.provider && (
                        <div className="flex justify-between">
                          <span className="text-muted">Provider</span>
                          <span>{calendarStatus.provider}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted">Sync Enabled</span>
                        <button
                          className="btn btn-secondary p-0 border-0"
                          onClick={handleToggleCalendarSync}
                          title={calendarStatus.syncEnabled ? 'Disable sync' : 'Enable sync'}
                        >
                          {calendarStatus.syncEnabled ? (
                            <ToggleRight className="icon-md" style={{ color: 'var(--status-completed)' }} />
                          ) : (
                            <ToggleLeft className="icon-md" style={{ color: 'var(--portal-text-muted)' }} />
                          )}
                        </button>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Last Sync</span>
                        <span>{formatDate(calendarStatus.lastSync)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="status-empty">
                <Calendar className="icon-lg" style={{ color: 'var(--portal-text-muted)' }} />
                <span>Calendar status unavailable.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notification Form Modal */}
      <NotificationFormModal
        open={notificationModal.isOpen}
        onOpenChange={notificationModal.setIsOpen}
        initialData={notificationFormData}
        onSubmit={handleSaveNotification}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Notification"
        description="Are you sure you want to delete this notification configuration? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteDialog.isLoading}
        onConfirm={() => deleteDialog.confirm(handleDeleteNotification)}
      />
    </TableLayout>
  );
}

export default IntegrationsManager;
