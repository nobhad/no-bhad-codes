/**
 * DetailModal
 * Generic detail viewer for contact submissions and other read-only detail views.
 * Uses shared PortalModal for consistent UI.
 */

import * as React from 'react';
import { Info } from 'lucide-react';
import { PortalModal, DialogPrimitive } from '@react/components/portal/PortalModal';

// ============================================
// TYPES
// ============================================

export interface DetailField {
  label: string;
  value: React.ReactNode;
}

export interface DetailModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title?: string;
  /** Structured detail fields to display */
  fields?: DetailField[];
  /** Full message content (e.g., contact form message) */
  message?: string;
  /** Optional status badge */
  statusBadge?: React.ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function DetailModal({
  open,
  onOpenChange,
  title = 'Details',
  fields = [],
  message,
  statusBadge
}: DetailModalProps) {
  return (
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      icon={<Info />}
      footer={
        <DialogPrimitive.Close className="btn btn-secondary">
          Close
        </DialogPrimitive.Close>
      }
    >
      {statusBadge && (
        <div className="form-field">{statusBadge}</div>
      )}

      {fields.length > 0 && (
        <div className="detail-grid">
          {fields.map((field) => (
            <div key={field.label} className="detail-row">
              <span className="detail-label">{field.label}</span>
              <span className="detail-value">{field.value}</span>
            </div>
          ))}
        </div>
      )}

      {message && (
        <div className="message-full">{message}</div>
      )}
    </PortalModal>
  );
}
