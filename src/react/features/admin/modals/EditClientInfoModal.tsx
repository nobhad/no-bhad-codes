/**
 * EditClientInfoModal
 * Form modal to edit client contact information and status.
 * Replaces the EJS #edit-client-info-modal from admin-modals.ejs.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Pencil, X } from 'lucide-react';
import { useScaleIn } from '@react/hooks/useGsap';
import { ModalDropdown } from '@react/components/portal/ModalDropdown';
import type { ModalDropdownOption } from '@react/components/portal/ModalDropdown';

// ============================================
// TYPES
// ============================================

export interface EditClientInfoFormData {
  email: string;
  contactName: string;
  companyName: string;
  phone: string;
  status: string;
}

export interface EditClientInfoModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when form is submitted */
  onSubmit: (data: EditClientInfoFormData) => void | Promise<void>;
  /** Initial values to populate the form */
  initialData?: Partial<EditClientInfoFormData>;
  /** Available status options for the dropdown */
  statusOptions: ModalDropdownOption[];
  /** Whether submission is in progress */
  loading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const EMPTY_FORM: EditClientInfoFormData = {
  email: '',
  contactName: '',
  companyName: '',
  phone: '',
  status: ''
};

// ============================================
// COMPONENT
// ============================================

export function EditClientInfoModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  statusOptions,
  loading = false
}: EditClientInfoModalProps) {
  const contentRef = useScaleIn<HTMLDivElement>();
  const titleId = React.useId();
  const [formData, setFormData] = useState<EditClientInfoFormData>(EMPTY_FORM);

  // Sync form data when initialData changes or modal opens
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        email: initialData.email ?? '',
        contactName: initialData.contactName ?? '',
        companyName: initialData.companyName ?? '',
        phone: initialData.phone ?? '',
        status: initialData.status ?? ''
      });
    }
  }, [open, initialData]);

  const handleFieldChange = useCallback(
    (field: keyof EditClientInfoFormData) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  const handleStatusChange = useCallback((value: string | string[]) => {
    const selected = Array.isArray(value) ? value[0] : value;
    setFormData((prev) => ({ ...prev, status: selected }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await onSubmit(formData);
    },
    [formData, onSubmit]
  );

  const handleCancel = useCallback(() => {
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
              <Pencil size={20} />
              <h2 id={titleId}>Edit Client Info</h2>
            </div>
            <DialogPrimitive.Close className="admin-modal-close" aria-label="Close modal">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="admin-modal-body">
              <div className="form-group">
                <label className="field-label" htmlFor="edit-client-email">
                  Email
                </label>
                <input
                  type="email"
                  id="edit-client-email"
                  className="form-input"
                  placeholder="client@example.com"
                  value={formData.email}
                  onChange={handleFieldChange('email')}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="edit-client-name">
                  Contact Name
                </label>
                <input
                  type="text"
                  id="edit-client-name"
                  className="form-input"
                  placeholder="John Smith"
                  value={formData.contactName}
                  onChange={handleFieldChange('contactName')}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="edit-client-company">
                  Company Name
                </label>
                <input
                  type="text"
                  id="edit-client-company"
                  className="form-input"
                  placeholder="Acme Inc."
                  value={formData.companyName}
                  onChange={handleFieldChange('companyName')}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="edit-client-phone">
                  Phone
                </label>
                <input
                  type="tel"
                  id="edit-client-phone"
                  className="form-input"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={handleFieldChange('phone')}
                />
              </div>

              <div className="form-group">
                <label className="field-label">Status</label>
                <ModalDropdown
                  options={statusOptions}
                  value={formData.status}
                  onChange={handleStatusChange}
                  placeholder="Select status"
                />
              </div>
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
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
