/**
 * Webhook Add/Edit Form Modal
 * @file src/react/features/admin/webhooks/WebhookFormModal.tsx
 */

import * as React from 'react';
import { PortalModal } from '@react/components/portal/PortalModal';
import {
  AVAILABLE_EVENTS,
  METHOD_OPTIONS,
  type WebhookFormData
} from './types';

interface WebhookFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  isEditing: boolean;
  formData: WebhookFormData;
  formError: string | null;
  formSaving: boolean;
  onFormDataChange: React.Dispatch<React.SetStateAction<WebhookFormData>>;
  onEventToggle: (event: string) => void;
  onSubmit: () => void;
}

export function WebhookFormModal({
  open,
  onOpenChange,
  onClose,
  isEditing,
  formData,
  formError,
  formSaving,
  onFormDataChange,
  onEventToggle,
  onSubmit
}: WebhookFormModalProps) {
  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Webhook' : 'Add Webhook'}
      size="lg"
      footer={
        <>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={formSaving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={formSaving}
          >
            {formSaving ? 'Saving...' : isEditing ? 'Update' : 'Create'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && (
          <div className="form-error-message">{formError}</div>
        )}

        <div className="form-field">
          <label className="field-label" htmlFor="webhook-name">Name</label>
          <input
            id="webhook-name"
            type="text"
            className="form-input"
            value={formData.name}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="My Webhook"
          />
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="webhook-url">URL</label>
          <input
            id="webhook-url"
            type="url"
            className="form-input"
            value={formData.url}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://example.com/webhook"
          />
        </div>

        <div className="form-field">
          <label className="field-label">Events</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {AVAILABLE_EVENTS.map((event) => (
              <button
                key={event}
                type="button"
                className={`status-badge ${formData.events.includes(event) ? 'status-badge-active' : ''}`}
                onClick={() => onEventToggle(event)}
              >
                {event}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="webhook-method">Method</label>
          <select
            id="webhook-method"
            className="form-select"
            value={formData.method}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, method: e.target.value }))}
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="webhook-headers">Headers (JSON)</label>
          <textarea
            id="webhook-headers"
            className="form-textarea"
            rows={4}
            value={formData.headers}
            onChange={(e) => onFormDataChange((prev) => ({ ...prev, headers: e.target.value }))}
            placeholder='{"Authorization": "Bearer ..."}'
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-field">
            <label className="field-label" htmlFor="webhook-retry-attempts">Max Retry Attempts</label>
            <input
              id="webhook-retry-attempts"
              type="number"
              className="form-input"
              min={0}
              max={10}
              value={formData.retryMaxAttempts}
              onChange={(e) => onFormDataChange((prev) => ({
                ...prev,
                retryMaxAttempts: parseInt(e.target.value, 10) || 0
              }))}
            />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="webhook-retry-backoff">Retry Backoff (seconds)</label>
            <input
              id="webhook-retry-backoff"
              type="number"
              className="form-input"
              min={0}
              value={formData.retryBackoffSeconds}
              onChange={(e) => onFormDataChange((prev) => ({
                ...prev,
                retryBackoffSeconds: parseInt(e.target.value, 10) || 0
              }))}
            />
          </div>
        </div>
      </div>
    </PortalModal>
  );
}
