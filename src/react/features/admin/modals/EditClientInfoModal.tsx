/**
 * EditClientInfoModal
 * Form modal to edit client contact information and status.
 * Uses shared PortalModal + PortalInput for consistent UI.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';
import { PortalInput } from '@react/components/portal/PortalInput';
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
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Client Info"
      icon={<Pencil size={20} />}
      onSubmit={handleSubmit}
      footer={
        <>
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
        </>
      }
    >
      <div className="form-field">
        <PortalInput
          type="email"
          label="Email"
          placeholder="client@example.com"
          value={formData.email}
          onChange={handleFieldChange('email')}
        />
      </div>

      <div className="form-field">
        <PortalInput
          type="text"
          label="Contact Name"
          placeholder="John Smith"
          value={formData.contactName}
          onChange={handleFieldChange('contactName')}
        />
      </div>

      <div className="form-field">
        <PortalInput
          type="text"
          label="Company Name"
          placeholder="Acme Inc."
          value={formData.companyName}
          onChange={handleFieldChange('companyName')}
        />
      </div>

      <div className="form-field">
        <PortalInput
          type="tel"
          label="Phone"
          placeholder="(555) 123-4567"
          value={formData.phone}
          onChange={handleFieldChange('phone')}
        />
      </div>

      <div className="form-field">
        <label className="field-label">Status</label>
        <ModalDropdown
          options={statusOptions}
          value={formData.status}
          onChange={handleStatusChange}
          placeholder="Select status"
        />
      </div>
    </PortalModal>
  );
}
