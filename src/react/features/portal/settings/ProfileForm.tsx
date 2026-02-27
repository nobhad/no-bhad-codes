/**
 * ProfileForm
 * Contact information form for client portal settings
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { User, Building2, Mail, Phone, Save, Loader2 } from 'lucide-react';
import { cn } from '@react/lib/utils';
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
 */
export function ProfileForm({ profile, onUpdate }: ProfileFormProps) {
  // Form state
  const [contactName, setContactName] = useState(profile.contact_name || '');
  const [companyName, setCompanyName] = useState(profile.company_name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [phone, setPhone] = useState(profile.phone || '');

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
      contact_name: validateName(contactName),
      email: validateEmail(email),
      phone: validatePhone(phone)
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== null);
  }, [contactName, email, phone]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    const updates: Partial<ClientProfile> = {
      contact_name: contactName.trim(),
      company_name: companyName.trim() || undefined,
      email: email.trim(),
      phone: phone.trim() || undefined
    };

    const success = await onUpdate(updates);

    setIsSaving(false);

    if (success) {
      setIsDirty(false);
    }
  }, [contactName, companyName, email, phone, validateForm, onUpdate]);

  // Check if form has unsaved changes
  const hasChanges = isDirty && (
    contactName !== (profile.contact_name || '') ||
    companyName !== (profile.company_name || '') ||
    email !== (profile.email || '') ||
    phone !== (profile.phone || '')
  );

  return (
    <form onSubmit={handleSubmit} className="tw-section">
      {/* Form Section */}
      <div className="tw-panel">
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
          <User className="tw-h-4 tw-w-4 tw-text-[var(--portal-text-muted)]" />
          <h3 className="tw-section-title tw-m-0">
            Contact Information
          </h3>
        </div>

        <div className="tw-grid tw-grid-cols-2 tw-gap-4">
          {/* Contact Name */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-field-label">
              Full Name <span className="tw-text-white">*</span>
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => handleFieldChange(setContactName, e.target.value, 'contact_name')}
              placeholder="Your full name"
              className={cn('tw-input', errors.contact_name && 'tw-border-white')}
              required
            />
            {errors.contact_name && (
              <span className="tw-text-[12px] tw-text-white">{errors.contact_name}</span>
            )}
          </div>

          {/* Company Name */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-field-label">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => handleFieldChange(setCompanyName, e.target.value, 'company_name')}
              placeholder="Your company (optional)"
              className="tw-input"
            />
          </div>

          {/* Email */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-field-label">
              Email Address <span className="tw-text-white">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleFieldChange(setEmail, e.target.value, 'email')}
              placeholder="your@email.com"
              className={cn('tw-input', errors.email && 'tw-border-white')}
              required
            />
            {errors.email && (
              <span className="tw-text-[12px] tw-text-white">{errors.email}</span>
            )}
          </div>

          {/* Phone */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <label className="tw-field-label">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => handleFieldChange(setPhone, e.target.value, 'phone')}
              placeholder="(555) 123-4567"
              className={cn('tw-input', errors.phone && 'tw-border-white')}
            />
            {errors.phone && (
              <span className="tw-text-[12px] tw-text-white">{errors.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Account Info (Read Only) */}
      <div className="tw-panel">
        <div className="tw-flex tw-items-center tw-gap-2 tw-mb-4">
          <Mail className="tw-h-4 tw-w-4 tw-text-[var(--portal-text-muted)]" />
          <h3 className="tw-section-title tw-m-0">
            Account Information
          </h3>
        </div>

        <div className="tw-flex tw-flex-col tw-gap-3">
          <div className="tw-flex tw-items-center tw-justify-between">
            <span className="tw-label">Account ID</span>
            <span className="tw-text-[14px] tw-text-white tw-font-mono">
              #{profile.id}
            </span>
          </div>
          {profile.created_at && (
            <div className="tw-flex tw-items-center tw-justify-between">
              <span className="tw-label">Member Since</span>
              <span className="tw-text-[14px] tw-text-white tw-font-mono">
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
          )}
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
