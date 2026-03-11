/**
 * ProfileForm
 * Contact information form for client portal settings
 * Uses inline-edit pattern: click to edit, Enter/blur to save
 */

import * as React from 'react';
import { useCallback } from 'react';
import { User, Mail, Building2, Phone, Hash, Calendar } from 'lucide-react';
import { InlineEditField } from '@react/components/portal/InlineEditField';
import { formatCardDate } from '@react/utils/cardFormatters';
import {
  validateEmail as sharedValidateEmail,
  validatePhone as sharedValidatePhone,
  validateName as sharedValidateName
} from '../../../../../shared/validation/validators';
import type { ClientProfile } from './PortalSettings';

interface ProfileFormProps {
  profile: ClientProfile;
  onUpdate: (updates: Partial<ClientProfile>) => Promise<boolean>;
}

// Validation adapters — wraps shared ValidationResult into (string | null) for InlineEditField
function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  const result = sharedValidateEmail(email, { allowDisposable: true });
  return result.isValid ? null : (result.error || 'Invalid email');
}

function validatePhone(phone: string): string | null {
  if (!phone) return null; // Phone is optional
  const result = sharedValidatePhone(phone);
  return result.isValid ? null : (result.error || 'Invalid phone number');
}

function validateName(name: string): string | null {
  if (!name || !name.trim()) return 'Name is required';
  const result = sharedValidateName(name, { type: 'person' });
  return result.isValid ? null : (result.error || 'Invalid name');
}

/**
 * ProfileForm Component
 * Inline-editable profile fields
 */
export function ProfileForm({ profile, onUpdate }: ProfileFormProps) {
  // Save handlers for each field
  const handleSaveName = useCallback(async (value: string) => {
    return await onUpdate({ contact_name: value });
  }, [onUpdate]);

  const handleSaveCompany = useCallback(async (value: string) => {
    return await onUpdate({ company_name: value || undefined });
  }, [onUpdate]);

  const handleSaveEmail = useCallback(async (value: string) => {
    return await onUpdate({ email: value });
  }, [onUpdate]);

  const handleSavePhone = useCallback(async (value: string) => {
    return await onUpdate({ phone: value || undefined });
  }, [onUpdate]);

  return (
    <>
      {/* Contact Information Section */}
      <div className="portal-section">
        <div className="section-header">
          <User className="section-icon"  />
          <h3 className="section-title">
            Contact Information
          </h3>
        </div>

        <div className="settings-fields">
          <InlineEditField
            label="Full Name"
            value={profile.contact_name || ''}
            onSave={handleSaveName}
            placeholder="Enter your name"
            required
            validate={validateName}
            icon={<User  />}
          />

          <InlineEditField
            label="Company"
            value={profile.company_name || ''}
            onSave={handleSaveCompany}
            placeholder="Enter company name"
            icon={<Building2  />}
          />

          <InlineEditField
            label="Email"
            value={profile.email || ''}
            onSave={handleSaveEmail}
            type="email"
            placeholder="Enter email address"
            required
            validate={validateEmail}
            icon={<Mail  />}
          />

          <InlineEditField
            label="Phone"
            value={profile.phone || ''}
            onSave={handleSavePhone}
            type="tel"
            placeholder="Enter phone number"
            validate={validatePhone}
            icon={<Phone  />}
          />
        </div>
      </div>

      {/* Account Information Section (Read Only) */}
      <div className="portal-section">
        <div className="section-header">
          <Hash className="section-icon"  />
          <h3 className="section-title">
            Account Information
          </h3>
        </div>

        <div className="settings-fields">
          <InlineEditField
            label="Account ID"
            value={`#${profile.id}`}
            onSave={async () => false}
            readOnly
            icon={<Hash  />}
          />

          {profile.created_at && (
            <InlineEditField
              label="Member Since"
              value={profile.created_at}
              onSave={async () => false}
              formatDisplay={(v) => v ? formatCardDate(v) : '-'}
              readOnly
              icon={<Calendar  />}
            />
          )}
        </div>
      </div>
    </>
  );
}
