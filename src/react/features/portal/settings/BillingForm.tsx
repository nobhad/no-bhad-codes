/**
 * BillingForm
 * Billing address form for client portal settings
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { MapPin, Save, Loader2 } from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { BillingAddress } from './PortalSettings';

interface BillingFormProps {
  billing: BillingAddress;
  onUpdate: (updates: BillingAddress) => Promise<boolean>;
}

// Country options
const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'JP', label: 'Japan' },
  { value: 'OTHER', label: 'Other' }
];

// US State options
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' }
];

// Validation helpers
function validatePostalCode(postalCode: string, country: string): string | null {
  if (!postalCode) return null; // Optional

  if (country === 'US') {
    const usZipRegex = /^\d{5}(-\d{4})?$/;
    if (!usZipRegex.test(postalCode)) {
      return 'Please enter a valid ZIP code (e.g., 12345 or 12345-6789)';
    }
  } else if (country === 'CA') {
    const caPostalRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
    if (!caPostalRegex.test(postalCode)) {
      return 'Please enter a valid postal code (e.g., K1A 0B1)';
    }
  }

  return null;
}

/**
 * BillingForm Component
 */
export function BillingForm({ billing, onUpdate }: BillingFormProps) {
  // Form state
  const [streetAddress, setStreetAddress] = useState(billing.street_address || '');
  const [city, setCity] = useState(billing.city || '');
  const [state, setState] = useState(billing.state || '');
  const [postalCode, setPostalCode] = useState(billing.postal_code || '');
  const [country, setCountry] = useState(billing.country || 'US');

  // Validation state
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Track changes
  const handleFieldChange = useCallback((
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string,
    field: string
  ) => {
    setter(value);
    setIsDirty(true);
    // Clear error on change
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  // Validate all fields
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string | null> = {
      postal_code: validatePostalCode(postalCode, country)
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== null);
  }, [postalCode, country]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    const updates: BillingAddress = {
      street_address: streetAddress.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      postal_code: postalCode.trim() || undefined,
      country: country || undefined
    };

    const success = await onUpdate(updates);

    setIsSaving(false);

    if (success) {
      setIsDirty(false);
    }
  }, [streetAddress, city, state, postalCode, country, validateForm, onUpdate]);

  // Check if form has unsaved changes
  const hasChanges = isDirty && (
    streetAddress !== (billing.street_address || '') ||
    city !== (billing.city || '') ||
    state !== (billing.state || '') ||
    postalCode !== (billing.postal_code || '') ||
    country !== (billing.country || 'US')
  );

  return (
    <form onSubmit={handleSubmit} className="tw-section">
      {/* Billing Address Section */}
      <div className="tw-panel">
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
          <MapPin className="tw-h-4 tw-w-4 tw-text-[rgba(255,255,255,0.46)]" />
          <h3 className="tw-section-title tw-m-0">
            Billing Address
          </h3>
        </div>

        <p className="tw-text-muted tw-text-[14px] tw-mb-4">
          This address will appear on your invoices and receipts.
        </p>

        <div className="tw-flex tw-flex-col tw-gap-4">
          {/* Street Address */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-field-label">Street Address</label>
            <input
              type="text"
              value={streetAddress}
              onChange={(e) => handleFieldChange(setStreetAddress, e.target.value, 'street_address')}
              placeholder="123 Main Street, Suite 100"
              className="tw-input"
            />
          </div>

          {/* City and State Row */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            <div className="tw-flex tw-flex-col tw-gap-1">
              <label className="tw-field-label">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => handleFieldChange(setCity, e.target.value, 'city')}
                placeholder="City"
                className="tw-input"
              />
            </div>

            {/* State/Province - Show select for US, text input for others */}
            {country === 'US' ? (
              <div className="tw-flex tw-flex-col tw-gap-1">
                <label className="tw-field-label">State</label>
                <select
                  value={state}
                  onChange={(e) => handleFieldChange(setState, e.target.value, 'state')}
                  className="tw-select tw-w-full"
                >
                  <option value="">Select state</option>
                  {US_STATES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="tw-flex tw-flex-col tw-gap-1">
                <label className="tw-field-label">State / Province</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => handleFieldChange(setState, e.target.value, 'state')}
                  placeholder="State or Province"
                  className="tw-input"
                />
              </div>
            )}
          </div>

          {/* Postal Code and Country Row */}
          <div className="tw-grid tw-grid-cols-2 tw-gap-4">
            <div className="tw-flex tw-flex-col tw-gap-1">
              <label className="tw-field-label">
                {country === 'US' ? 'ZIP Code' : 'Postal Code'}
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => handleFieldChange(setPostalCode, e.target.value, 'postal_code')}
                placeholder={country === 'US' ? '12345' : 'Postal code'}
                className={cn('tw-input', errors.postal_code && 'tw-border-white')}
              />
              {errors.postal_code && (
                <span className="tw-text-[12px] tw-text-white">{errors.postal_code}</span>
              )}
            </div>

            <div className="tw-flex tw-flex-col tw-gap-1">
              <label className="tw-field-label">Country</label>
              <select
                value={country}
                onChange={(e) => {
                  handleFieldChange(setCountry, e.target.value, 'country');
                  // Clear state when country changes
                  if (e.target.value !== 'US') {
                    setState('');
                  }
                }}
                className="tw-select tw-w-full"
              >
                {COUNTRIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="tw-flex tw-justify-end">
        <button
          type="submit"
          className="tw-btn-primary"
          disabled={!hasChanges || isSaving}
        >
          {isSaving ? (
            <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" />
          ) : (
            <Save className="tw-h-4 tw-w-4" />
          )}
          Save Changes
        </button>
      </div>
    </form>
  );
}
