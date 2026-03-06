/**
 * DetailModal
 * Generic detail viewer for contact submissions and other read-only detail views.
 * Replaces the EJS #detail-modal from admin-modals.ejs.
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Info, X } from 'lucide-react';
import { useScaleIn } from '@react/hooks/useGsap';

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
  const contentRef = useScaleIn<HTMLDivElement>();
  const titleId = React.useId();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="admin-modal-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Header */}
          <div className="admin-modal-header">
            <div className="admin-modal-title">
              <Info size={20} />
              <h2 id={titleId}>{title}</h2>
            </div>
            <DialogPrimitive.Close className="admin-modal-close" aria-label="Close modal">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="admin-modal-body">
            {statusBadge && (
              <div className="form-group">{statusBadge}</div>
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
          </div>

          {/* Footer */}
          <div className="admin-modal-footer">
            <DialogPrimitive.Close className="btn btn-secondary">
              Close
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
