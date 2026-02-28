/**
 * BillingForm
 * Billing address form for client portal settings
 * Uses inline-edit pattern: click to edit, Enter/blur to save
 */

import * as React from 'react';
import { useCallback } from 'react';
import { MapPin, Building, Globe } from 'lucide-react';
import { InlineEditField, InlineEditSelect } from '@react/components/portal/InlineEditField';
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
  { value: '', label: 'Select state' },
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
function validatePostalCode(postalCode: string, country?: string): string | null {
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
 * Inline-editable billing address fields
 */
export function BillingForm({ billing, onUpdate }: BillingFormProps) {
  // Save handlers - each field updates the full billing object
  const handleSaveStreet = useCallback(async (value: string) => {
    return await onUpdate({ ...billing, street_address: value || undefined });
  }, [billing, onUpdate]);

  const handleSaveCity = useCallback(async (value: string) => {
    return await onUpdate({ ...billing, city: value || undefined });
  }, [billing, onUpdate]);

  const handleSaveState = useCallback(async (value: string) => {
    return await onUpdate({ ...billing, state: value || undefined });
  }, [billing, onUpdate]);

  const handleSavePostalCode = useCallback(async (value: string) => {
    return await onUpdate({ ...billing, postal_code: value || undefined });
  }, [billing, onUpdate]);

  const handleSaveCountry = useCallback(async (value: string) => {
    // Clear state when changing away from US
    const updates: BillingAddress = { ...billing, country: value || undefined };
    if (value !== 'US') {
      updates.state = undefined;
    }
    return await onUpdate(updates);
  }, [billing, onUpdate]);

  // Determine if we're in the US for state dropdown
  const isUS = billing.country === 'US';

  return (
    <div className="settings-form-section">
      {/* Billing Address Section */}
      <div className="portal-section">
        <div className="section-header">
          <MapPin className="section-icon"  />
          <h3 className="section-title">
            Billing Address
          </h3>
        </div>

        <p className="section-description">
          This address will appear on your invoices and receipts.
        </p>

        <div className="settings-fields">
          <InlineEditField
            label="Street Address"
            value={billing.street_address || ''}
            onSave={handleSaveStreet}
            placeholder="Enter street address"
            icon={<Building  />}
          />

          <InlineEditField
            label="City"
            value={billing.city || ''}
            onSave={handleSaveCity}
            placeholder="Enter city"
            icon={<MapPin  />}
          />

          {isUS ? (
            <InlineEditSelect
              label="State"
              value={billing.state || ''}
              options={US_STATES}
              onSave={handleSaveState}
              icon={<MapPin  />}
            />
          ) : (
            <InlineEditField
              label="State / Province"
              value={billing.state || ''}
              onSave={handleSaveState}
              placeholder="Enter state or province"
              icon={<MapPin  />}
            />
          )}

          <InlineEditField
            label={isUS ? 'ZIP Code' : 'Postal Code'}
            value={billing.postal_code || ''}
            onSave={handleSavePostalCode}
            placeholder={isUS ? '12345' : 'Postal code'}
            validate={(value) => validatePostalCode(value, billing.country)}
            icon={<MapPin  />}
          />

          <InlineEditSelect
            label="Country"
            value={billing.country || 'US'}
            options={COUNTRIES}
            onSave={handleSaveCountry}
            icon={<Globe  />}
          />
        </div>
      </div>
    </div>
  );
}
