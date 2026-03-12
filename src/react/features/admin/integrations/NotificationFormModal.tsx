/**
 * Notification Form Modal
 * @file src/react/features/admin/integrations/NotificationFormModal.tsx
 */

import * as React from 'react';
import { useState } from 'react';
import { PortalModal } from '@react/components/portal/PortalModal';
import {
  CHANNEL_OPTIONS,
  EVENT_OPTIONS,
  type NotificationFormData
} from './types';

interface NotificationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: NotificationFormData;
  onSubmit: (data: NotificationFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function NotificationFormModal({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  isSubmitting
}: NotificationFormModalProps) {
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
        <div className="form-field">
          <label className="field-label" htmlFor="notification-name">Name</label>
          <input
            id="notification-name"
            className="form-input"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Notification name"
            required
          />
        </div>
        <div className="form-field">
          <label className="field-label" htmlFor="notification-channel">Channel</label>
          <select
            id="notification-channel"
            className="form-select"
            value={form.channel}
            onChange={(e) => handleChange('channel', e.target.value)}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="field-label" htmlFor="notification-event">Event</label>
          <select
            id="notification-event"
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
        <div className="form-field">
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
