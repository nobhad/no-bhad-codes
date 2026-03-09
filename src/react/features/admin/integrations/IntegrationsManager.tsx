/**
 * ===============================================
 * INTEGRATIONS MANAGER
 * ===============================================
 * @file src/react/features/admin/integrations/IntegrationsManager.tsx
 *
 * Thin orchestrator for the integrations admin panel.
 * Sub-components: IntegrationCard, NotificationsSection,
 * NotificationFormModal, StripeSection, CalendarSection.
 * Data logic: useIntegrationsData hook.
 */

import * as React from 'react';
import { useCallback } from 'react';
import { useFadeIn } from '@react/hooks/useGsap';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { useModal } from '@react/components/portal/PortalModal';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { IconButton } from '@react/factories';
import type { IntegrationsManagerProps, NotificationConfig, NotificationFormData } from './types';
import { useIntegrationsData } from './useIntegrationsData';
import { IntegrationCard } from './IntegrationCard';
import { NotificationsSection } from './NotificationsSection';
import { NotificationFormModal } from './NotificationFormModal';
import { StripeSection } from './StripeSection';
import { CalendarSection } from './CalendarSection';

export function IntegrationsManager({
  onNavigate: _onNavigate,
  showNotification
}: IntegrationsManagerProps) {
  const containerRef = useFadeIn();
  const notificationModal = useModal();
  const deleteDialog = useConfirmDialog();

  const data = useIntegrationsData({ showNotification });

  // ---- Modal wrappers ----

  const handleOpenAdd = useCallback(() => {
    data.prepareAddNotification();
    notificationModal.open();
  }, [data, notificationModal]);

  const handleOpenEdit = useCallback((notification: NotificationConfig) => {
    data.prepareEditNotification(notification);
    notificationModal.open();
  }, [data, notificationModal]);

  const handleOpenDelete = useCallback((notification: NotificationConfig) => {
    data.prepareDeleteNotification(notification);
    deleteDialog.open();
  }, [data, deleteDialog]);

  const handleSave = useCallback(async (formData: NotificationFormData) => {
    await data.handleSaveNotification(formData, notificationModal.close);
  }, [data, notificationModal]);

  // ---- Render ----

  return (
    <TableLayout
      containerRef={containerRef as React.Ref<HTMLDivElement>}
      title="INTEGRATIONS"
      stats={
        <TableStats items={[
          { value: data.integrations.length, label: 'services' },
          { value: data.activeCount, label: 'active', variant: 'completed' },
          { value: data.configuredCount, label: 'configured' },
          { value: data.notifications.length, label: 'notifications' }
        ]} />
      }
      actions={
        <IconButton action="refresh" onClick={data.loadAllData} title="Refresh" loading={data.isLoading} />
      }
    >
      {data.isLoading ? (
        <LoadingState message="Loading integrations..." />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.loadAllData} />
      ) : (
        <div className="status-content">
          <div className="status-section">
            <h4 className="status-section-title">Integration Overview</h4>
            <div className="stats-grid">
              {data.integrations.map((integration) => (
                <IntegrationCard key={integration.name} integration={integration} />
              ))}
            </div>
          </div>

          <NotificationsSection
            notifications={data.notifications}
            testingId={data.testingId}
            onAdd={handleOpenAdd}
            onEdit={handleOpenEdit}
            onDelete={handleOpenDelete}
            onTest={data.handleTestNotification}
          />

          <StripeSection stripeStatus={data.stripeStatus} />

          <CalendarSection
            calendarStatus={data.calendarStatus}
            onToggleSync={data.handleToggleCalendarSync}
          />
        </div>
      )}

      <NotificationFormModal
        open={notificationModal.isOpen}
        onOpenChange={notificationModal.setIsOpen}
        initialData={data.notificationFormData}
        onSubmit={handleSave}
        isSubmitting={data.isSubmitting}
      />

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Notification"
        description="Are you sure you want to delete this notification configuration? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        loading={deleteDialog.isLoading}
        onConfirm={() => deleteDialog.confirm(data.handleDeleteNotification)}
      />
    </TableLayout>
  );
}

export default IntegrationsManager;
