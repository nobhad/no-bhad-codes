/**
 * EditBillingModal
 * Form modal to edit client billing details (name, email, address).
 * Uses shared PortalModal + PortalInput for consistent UI.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { PortalModal } from '@react/components/portal/PortalModal';
import { PortalInput } from '@react/components/portal/PortalInput';

// ============================================
// TYPES
// ============================================

export interface EditBillingFormData {
  billingName: string;
  billingEmail: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface EditBillingModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when form is submitted */
  onSubmit: (data: EditBillingFormData) => void | Promise<void>;
  /** Initial values to populate the form */
  initialData?: Partial<EditBillingFormData>;
  /** Whether submission is in progress */
  loading?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const EMPTY_FORM: EditBillingFormData = {
  billingName: '',
  billingEmail: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: ''
};

// ============================================
// COMPONENT
// ============================================

export function EditBillingModal({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  loading = false
}: EditBillingModalProps) {
  const [formData, setFormData] = useState<EditBillingFormData>(EMPTY_FORM);

  // Sync form data when initialData changes or modal opens
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        billingName: initialData.billingName ?? '',
        billingEmail: initialData.billingEmail ?? '',
        address: initialData.address ?? '',
        city: initialData.city ?? '',
        state: initialData.state ?? '',
        zip: initialData.zip ?? '',
        country: initialData.country ?? ''
      });
    }
  }, [open, initialData]);

  const handleFieldChange = useCallback(
    (field: keyof EditBillingFormData) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

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
      title="Edit Billing Details"
      icon={<CreditCard size={20} />}
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
          type="text"
          label="Billing Name"
          placeholder="John Smith"
          value={formData.billingName}
          onChange={handleFieldChange('billingName')}
        />
      </div>

      <div className="form-field">
        <PortalInput
          type="email"
          label="Billing Email"
          placeholder="billing@example.com"
          value={formData.billingEmail}
          onChange={handleFieldChange('billingEmail')}
        />
      </div>

      <div className="form-field">
        <PortalInput
          type="text"
          label="Address"
          placeholder="123 Main St"
          value={formData.address}
          onChange={handleFieldChange('address')}
        />
      </div>

      <div className="form-row">
        <div className="form-field">
          <PortalInput
            type="text"
            label="City"
            placeholder="New York"
            value={formData.city}
            onChange={handleFieldChange('city')}
          />
        </div>

        <div className="form-field">
          <PortalInput
            type="text"
            label="State/Province"
            placeholder="NY"
            value={formData.state}
            onChange={handleFieldChange('state')}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <PortalInput
            type="text"
            label="ZIP/Postal Code"
            placeholder="10001"
            value={formData.zip}
            onChange={handleFieldChange('zip')}
          />
        </div>

        <div className="form-field">
          <PortalInput
            type="text"
            label="Country"
            placeholder="USA"
            value={formData.country}
            onChange={handleFieldChange('country')}
          />
        </div>
      </div>
    </PortalModal>
  );
}
