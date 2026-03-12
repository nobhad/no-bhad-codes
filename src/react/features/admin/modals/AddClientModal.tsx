/**
 * AddClientModal
 * Form modal to add a new client with contact information.
 * Uses shared PortalModal + PortalInput for consistent UI.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';
import { PortalInput } from '@react/components/portal/PortalInput';

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
    <PortalModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Client"
      icon={<UserPlus size={20} />}
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
            {loading ? 'Adding...' : 'Add Client'}
          </button>
        </>
      }
    >
      <fieldset>
        <legend>Contact Information</legend>

        <div className="form-field">
          <PortalInput
            type="email"
            label="Email"
            placeholder="client@example.com"
            value={formData.email}
            onChange={handleFieldChange('email')}
            required
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
      </fieldset>
    </PortalModal>
  );
}
