/**
 * BasicInfoStep
 * Step 1: Contact and company information
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { User, Mail, Phone, Building2, Globe, Clock } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import type { StepProps, BasicInfoData } from '../types';
import { TIMEZONES } from '../types';

/**
 * BasicInfoStep Component
 */
export function BasicInfoStep({ data, onUpdate, errors }: StepProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const basicInfo = data.basicInfo || {
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    companyName: '',
    companyWebsite: '',
    timezone: 'America/New_York',
    preferredContactMethod: 'email' as const,
  };

  const handleChange = (field: keyof BasicInfoData, value: string) => {
    onUpdate({
      basicInfo: {
        ...basicInfo,
        [field]: value,
      },
    });
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  return (
    <div ref={containerRef} className="tw-section">
      {/* Section Header */}
      <div className="tw-mb-4">
        <h3 className="tw-heading tw-text-lg">
          Contact Information
        </h3>
        <p className="tw-text-muted tw-text-[14px] tw-mt-1">
          Tell us how to reach you during the project.
        </p>
      </div>

      {/* Contact Fields */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
        {/* Contact Name */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">
            Contact Name <span className="tw-text-primary">*</span>
          </label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[var(--portal-text-muted)]">
              <User className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="text"
              placeholder="Your full name"
              value={basicInfo.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              className={cn('tw-input tw-pl-10', getFieldError('contactName') && 'tw-border-primary')}
            />
          </div>
          {getFieldError('contactName') && (
            <span className="tw-text-[12px] tw-text-primary">{getFieldError('contactName')}</span>
          )}
        </div>

        {/* Contact Email */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">
            Email Address <span className="tw-text-primary">*</span>
          </label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[var(--portal-text-muted)]">
              <Mail className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="email"
              placeholder="your@email.com"
              value={basicInfo.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              className={cn('tw-input tw-pl-10', getFieldError('contactEmail') && 'tw-border-primary')}
            />
          </div>
          {getFieldError('contactEmail') && (
            <span className="tw-text-[12px] tw-text-primary">{getFieldError('contactEmail')}</span>
          )}
        </div>

        {/* Contact Phone */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">Phone Number</label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[var(--portal-text-muted)]">
              <Phone className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="tel"
              placeholder="(555) 123-4567"
              value={basicInfo.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              className={cn('tw-input tw-pl-10', getFieldError('contactPhone') && 'tw-border-primary')}
            />
          </div>
          {getFieldError('contactPhone') && (
            <span className="tw-text-[12px] tw-text-primary">{getFieldError('contactPhone')}</span>
          )}
        </div>

        {/* Timezone */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">Timezone</label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[var(--portal-text-muted)]">
              <Clock className="tw-h-4 tw-w-4" />
            </div>
            <select
              value={basicInfo.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="tw-select tw-w-full tw-pl-10"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="tw-divider" />

      {/* Company Section */}
      <div className="tw-mb-4">
        <h3 className="tw-heading tw-text-lg">
          Company Details
        </h3>
        <p className="tw-text-muted tw-text-[14px] tw-mt-1">
          Help us understand your business.
        </p>
      </div>

      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
        {/* Company Name */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">Company Name</label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[var(--portal-text-muted)]">
              <Building2 className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="text"
              placeholder="Your company name"
              value={basicInfo.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className="tw-input tw-pl-10"
            />
          </div>
        </div>

        {/* Company Website */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">Current Website</label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[var(--portal-text-muted)]">
              <Globe className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="url"
              placeholder="https://yoursite.com"
              value={basicInfo.companyWebsite}
              onChange={(e) => handleChange('companyWebsite', e.target.value)}
              className="tw-input tw-pl-10"
            />
          </div>
          <span className="tw-text-[12px] tw-text-[var(--portal-text-muted)]">
            Leave blank if this is a new business
          </span>
        </div>
      </div>

      {/* Preferred Contact Method */}
      <div className="tw-mt-6">
        <label className="tw-field-label">
          Preferred Contact Method
        </label>
        <div className="tw-flex tw-gap-4 tw-mt-2">
          {(['email', 'phone', 'either'] as const).map((method) => (
            <label
              key={method}
              className={cn(
                'tw-flex tw-items-center tw-gap-2 tw-cursor-pointer',
                'tw-px-3 tw-py-2',
                'tw-border tw-transition-colors',
                basicInfo.preferredContactMethod === method
                  ? 'tw-border-primary tw-bg-white tw-text-black'
                  : 'tw-border-[var(--portal-border-color)] hover:tw-border-primary'
              )}
            >
              <input
                type="radio"
                name="preferredContactMethod"
                value={method}
                checked={basicInfo.preferredContactMethod === method}
                onChange={(e) => handleChange('preferredContactMethod', e.target.value)}
                className="tw-sr-only"
              />
              <span
                className={cn(
                  'tw-w-3 tw-h-3 tw-border tw-flex tw-items-center tw-justify-center',
                  basicInfo.preferredContactMethod === method
                    ? 'tw-border-black tw-bg-black'
                    : 'tw-border-primary'
                )}
              >
                {basicInfo.preferredContactMethod === method && (
                  <span className="tw-w-1.5 tw-h-1.5 tw-bg-white" />
                )}
              </span>
              <span className={cn(
                'tw-text-[14px] tw-font-mono tw-capitalize',
                basicInfo.preferredContactMethod === method ? 'tw-text-black' : 'tw-text-primary'
              )}>
                {method}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
