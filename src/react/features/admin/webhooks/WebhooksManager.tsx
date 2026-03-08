/**
 * ===============================================
 * WEBHOOKS MANAGER
 * ===============================================
 * @file src/react/features/admin/webhooks/WebhooksManager.tsx
 *
 * Thin orchestrator for the webhooks admin panel.
 * Sub-components: WebhookListView, WebhookDeliveriesView,
 * WebhookStatsView, WebhookFormModal, WebhookTestModal.
 * Data logic: useWebhooksData hook.
 */

import * as React from 'react';
import { useCallback } from 'react';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useModal } from '@react/components/portal/PortalModal';
import { useFadeIn } from '@react/hooks/useGsap';
import type { WebhooksManagerProps, WebhookItem } from './types';
import { useWebhooksData } from './useWebhooksData';
import { WebhookListView } from './WebhookListView';
import { WebhookDeliveriesView } from './WebhookDeliveriesView';
import { WebhookStatsView } from './WebhookStatsView';
import { WebhookFormModal } from './WebhookFormModal';
import { WebhookTestModal } from './WebhookTestModal';

export function WebhooksManager({
  getAuthToken,
  showNotification,
  onNavigate: _onNavigate,
  defaultPageSize = 25
}: WebhooksManagerProps) {
  const containerRef = useFadeIn();
  const formModal = useModal();
  const testModal = useModal();
  const deleteDialog = useConfirmDialog();

  const data = useWebhooksData({ getAuthToken, showNotification });

  // ---- Form modal wrappers ----

  const openAddModal = useCallback(() => {
    data.prepareAddForm();
    formModal.open();
  }, [data, formModal]);

  const openEditModal = useCallback((webhook: WebhookItem) => {
    data.prepareEditForm(webhook);
    formModal.open();
  }, [data, formModal]);

  const openTestModal = useCallback((webhook: WebhookItem) => {
    data.prepareTest(webhook);
    testModal.open();
  }, [data, testModal]);

  const openDeleteDialog = useCallback((webhook: WebhookItem) => {
    data.setDeletingWebhook(webhook);
    deleteDialog.open();
  }, [data, deleteDialog]);

  const handleFormSubmit = useCallback(() => {
    data.handleFormSubmit(formModal.close);
  }, [data, formModal]);

  const handleTestSubmit = useCallback(() => {
    data.handleTestSubmit(testModal.close);
  }, [data, testModal]);

  // ---- Render ----

  if (data.view === 'deliveries' && data.selectedWebhook) {
    return (
      <WebhookDeliveriesView
        containerRef={containerRef}
        selectedWebhook={data.selectedWebhook}
        deliveries={data.deliveries}
        deliveriesLoading={data.deliveriesLoading}
        deliveriesError={data.deliveriesError}
        defaultPageSize={defaultPageSize}
        onBack={data.navigateToList}
        onRefresh={data.loadDeliveries}
        onRetry={data.handleRetryDelivery}
      />
    );
  }

  if (data.view === 'stats' && data.selectedWebhook) {
    return (
      <WebhookStatsView
        containerRef={containerRef}
        selectedWebhook={data.selectedWebhook}
        stats={data.webhookStats}
        onBack={data.navigateToList}
        onRefresh={data.loadStats}
      />
    );
  }

  return (
    <>
      <WebhookListView
        containerRef={containerRef}
        webhooks={data.webhooks}
        isLoading={data.isLoading}
        error={data.error}
        defaultPageSize={defaultPageSize}
        onRefresh={data.loadWebhooks}
        onAdd={openAddModal}
        onEdit={openEditModal}
        onDelete={openDeleteDialog}
        onToggleActive={data.handleToggleActive}
        onTest={openTestModal}
        onViewDeliveries={data.navigateToDeliveries}
        onViewStats={data.navigateToStats}
      />

      <WebhookFormModal
        open={formModal.isOpen}
        onOpenChange={formModal.setIsOpen}
        onClose={formModal.close}
        isEditing={data.editingWebhook !== null}
        formData={data.formData}
        formError={data.formError}
        formSaving={data.formSaving}
        onFormDataChange={data.setFormData}
        onEventToggle={data.handleEventToggle}
        onSubmit={handleFormSubmit}
      />

      <WebhookTestModal
        open={testModal.isOpen}
        onOpenChange={testModal.setIsOpen}
        onClose={testModal.close}
        webhook={data.testingWebhook}
        eventType={data.testEventType}
        sampleData={data.testSampleData}
        sending={data.testSending}
        onEventTypeChange={data.setTestEventType}
        onSampleDataChange={data.setTestSampleData}
        onSubmit={handleTestSubmit}
      />

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Webhook"
        description={`Are you sure you want to delete "${data.deletingWebhook?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteDialog.isLoading}
        onConfirm={() => deleteDialog.confirm(data.handleDelete)}
      />
    </>
  );
}

export default WebhooksManager;
