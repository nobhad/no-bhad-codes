/**
 * ProfileForm
 * Contact information form for client portal settings
 * Uses inline-edit pattern: click to edit, Enter/blur to save
 */

import * as React from 'react';
import { useCallback } from 'react';
import { User, Mail, Building2, Phone, Hash, Calendar } from 'lucide-react';
import { InlineEditField } from '@react/components/portal/InlineEditField';
import type { ClientProfile } from './PortalSettings';

interface ProfileFormProps {
  profile: ClientProfile;
  onUpdate: (updates: Partial<ClientProfile>) => Promise<boolean>;
}

// Validation helpers
function validateEmail(email: string): string | null {
  if (!email) return 'Email is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone) return null; // Phone is optional
  const phoneRegex = /^[\d\s\-+()]+$/;
  if (!phoneRegex.test(phone)) return 'Please enter a valid phone number';
  if (phone.replace(/\D/g, '').length < 10) return 'Phone number must have at least 10 digits';
  return null;
}

function validateName(name: string): string | null {
  if (!name || !name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
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

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="settings-form-section">
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
              formatDisplay={formatDate}
              readOnly
              icon={<Calendar  />}
            />
          )}
        </div>
      </div>
    </div>
  );
}
