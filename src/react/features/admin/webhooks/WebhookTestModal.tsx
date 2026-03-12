/**
 * Webhook Test Modal
 * @file src/react/features/admin/webhooks/WebhookTestModal.tsx
 */

import * as React from 'react';
import { PortalModal } from '@react/components/portal/PortalModal';
import type { WebhookItem } from './types';

interface WebhookTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  webhook: WebhookItem | null;
  eventType: string;
  sampleData: string;
  sending: boolean;
  onEventTypeChange: (value: string) => void;
  onSampleDataChange: (value: string) => void;
  onSubmit: () => void;
}

export function WebhookTestModal({
  open,
  onOpenChange,
  onClose,
  webhook,
  eventType,
  sampleData,
  sending,
  onEventTypeChange,
  onSampleDataChange,
  onSubmit
}: WebhookTestModalProps) {
  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Test Webhook: ${webhook?.name || ''}`}
      size="md"
      footer={
        <>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={sending || !eventType}
          >
            {sending ? 'Sending...' : 'Send Test'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="form-field">
          <label className="field-label" htmlFor="webhook-test-event">Event Type</label>
          <select
            id="webhook-test-event"
            className="form-select"
            value={eventType}
            onChange={(e) => onEventTypeChange(e.target.value)}
          >
            <option value="">Select event...</option>
            {webhook?.events.map((event) => (
              <option key={event} value={event}>{event}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="field-label" htmlFor="webhook-test-data">Sample Data (JSON, optional)</label>
          <textarea
            id="webhook-test-data"
            className="form-textarea"
            rows={6}
            value={sampleData}
            onChange={(e) => onSampleDataChange(e.target.value)}
            placeholder='{"key": "value"}'
          />
        </div>
      </div>
    </PortalModal>
  );
}
