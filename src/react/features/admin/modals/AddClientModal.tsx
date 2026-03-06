/**
 * AddClientModal
 * Form modal to add a new client with contact information.
 * Replaces the EJS #add-client-modal from admin-modals.ejs.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { UserPlus, X } from 'lucide-react';
import { useScaleIn } from '@react/hooks/useGsap';

// ============================================
// TYPES
// ============================================

export interface AddClientFormData {
  email: string;
  contactName: string;
  companyName: string;
  phone: string;
}

export interface AddClientModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when form is submitted */
  onSubmit: (data: AddClientFormData) => void | Promise<void>;
  /** Whether submission is in progress */
  loading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const INITIAL_FORM_STATE: AddClientFormData = {
  email: '',
  contactName: '',
  companyName: '',
  phone: ''
};

// ============================================
// COMPONENT
// ============================================

export function AddClientModal({
  open,
  onOpenChange,
  onSubmit,
  loading = false
}: AddClientModalProps) {
  const contentRef = useScaleIn<HTMLDivElement>();
  const titleId = React.useId();
  const [formData, setFormData] = useState<AddClientFormData>(INITIAL_FORM_STATE);

  const handleFieldChange = useCallback(
    (field: keyof AddClientFormData) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSubmit(formData);
      setFormData(INITIAL_FORM_STATE);
    },
    [formData, onSubmit]
  );

  const handleCancel = useCallback(() => {
    setFormData(INITIAL_FORM_STATE);
    onOpenChange(false);
  }, [onOpenChange]);

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
              <UserPlus size={20} />
              <h2 id={titleId}>Add New Client</h2>
            </div>
            <DialogPrimitive.Close className="admin-modal-close" aria-label="Close modal">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="admin-modal-body">
              <fieldset>
                <legend>Contact Information</legend>

                <div className="form-group">
                  <label className="field-label" htmlFor="new-client-email">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="new-client-email"
                    className="form-input"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={handleFieldChange('email')}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="new-client-name">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    id="new-client-name"
                    className="form-input"
                    placeholder="John Smith"
                    value={formData.contactName}
                    onChange={handleFieldChange('contactName')}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="new-client-company">
                    Company Name
                  </label>
                  <input
                    type="text"
                    id="new-client-company"
                    className="form-input"
                    placeholder="Acme Inc."
                    value={formData.companyName}
                    onChange={handleFieldChange('companyName')}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="new-client-phone">
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="new-client-phone"
                    className="form-input"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={handleFieldChange('phone')}
                  />
                </div>
              </fieldset>
            </div>

            {/* Footer */}
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Client'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
