/**
 * EditBillingModal
 * Form modal to edit client billing details (name, email, address).
 * Replaces the EJS #edit-billing-modal from admin-modals.ejs.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CreditCard, X } from 'lucide-react';
import { useScaleIn } from '@react/hooks/useGsap';

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
  const contentRef = useScaleIn<HTMLDivElement>();
  const titleId = React.useId();
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
              <CreditCard size={20} />
              <h2 id={titleId}>Edit Billing Details</h2>
            </div>
            <DialogPrimitive.Close className="admin-modal-close" aria-label="Close modal">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="admin-modal-body">
              <div className="form-group">
                <label className="field-label" htmlFor="edit-billing-name">
                  Billing Name
                </label>
                <input
                  type="text"
                  id="edit-billing-name"
                  className="form-input"
                  placeholder="John Smith"
                  value={formData.billingName}
                  onChange={handleFieldChange('billingName')}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="edit-billing-email">
                  Billing Email
                </label>
                <input
                  type="email"
                  id="edit-billing-email"
                  className="form-input"
                  placeholder="billing@example.com"
                  value={formData.billingEmail}
                  onChange={handleFieldChange('billingEmail')}
                />
              </div>

              <div className="form-group">
                <label className="field-label" htmlFor="edit-billing-address">
                  Address
                </label>
                <input
                  type="text"
                  id="edit-billing-address"
                  className="form-input"
                  placeholder="123 Main St"
                  value={formData.address}
                  onChange={handleFieldChange('address')}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="field-label" htmlFor="edit-billing-city">
                    City
                  </label>
                  <input
                    type="text"
                    id="edit-billing-city"
                    className="form-input"
                    placeholder="New York"
                    value={formData.city}
                    onChange={handleFieldChange('city')}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="edit-billing-state">
                    State/Province
                  </label>
                  <input
                    type="text"
                    id="edit-billing-state"
                    className="form-input"
                    placeholder="NY"
                    value={formData.state}
                    onChange={handleFieldChange('state')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="field-label" htmlFor="edit-billing-zip">
                    ZIP/Postal Code
                  </label>
                  <input
                    type="text"
                    id="edit-billing-zip"
                    className="form-input"
                    placeholder="10001"
                    value={formData.zip}
                    onChange={handleFieldChange('zip')}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="edit-billing-country">
                    Country
                  </label>
                  <input
                    type="text"
                    id="edit-billing-country"
                    className="form-input"
                    placeholder="USA"
                    value={formData.country}
                    onChange={handleFieldChange('country')}
                  />
                </div>
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
