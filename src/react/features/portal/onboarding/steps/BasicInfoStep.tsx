/**
 * BasicInfoStep
 * Step 1: Contact and company information
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { User, Mail, Phone, Building2, Globe, Clock } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { FormDropdown } from '@react/components/portal/FormDropdown';
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
    preferredContactMethod: 'email' as const
  };

  const handleChange = (field: keyof BasicInfoData, value: string) => {
    onUpdate({
      basicInfo: {
        ...basicInfo,
        [field]: value
      }
    });
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  return (
    <div ref={containerRef} className="section">
      {/* Section Header */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Contact Information
        </h3>
        <p className="text-muted text-sm mt-1">
          Tell us how to reach you during the project.
        </p>
      </div>

      {/* Contact Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Name */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="basic-contact-name">
            Contact Name <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <User className="icon-xs" />
            </div>
            <input
              id="basic-contact-name"
              type="text"
              placeholder="Your full name"
              value={basicInfo.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              className={cn('input pl-10', getFieldError('contactName') && 'border-primary')}
            />
          </div>
          {getFieldError('contactName') && (
            <span className="text-xs text-primary">{getFieldError('contactName')}</span>
          )}
        </div>

        {/* Contact Email */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="basic-contact-email">
            Email Address <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <Mail className="icon-xs" />
            </div>
            <input
              id="basic-contact-email"
              type="email"
              placeholder="your@email.com"
              value={basicInfo.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              className={cn('input pl-10', getFieldError('contactEmail') && 'border-primary')}
            />
          </div>
          {getFieldError('contactEmail') && (
            <span className="text-xs text-primary">{getFieldError('contactEmail')}</span>
          )}
        </div>

        {/* Contact Phone */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="basic-contact-phone">Phone Number</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <Phone className="icon-xs" />
            </div>
            <input
              id="basic-contact-phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={basicInfo.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              className={cn('input pl-10', getFieldError('contactPhone') && 'border-primary')}
            />
          </div>
          {getFieldError('contactPhone') && (
            <span className="text-xs text-primary">{getFieldError('contactPhone')}</span>
          )}
        </div>

        {/* Timezone */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="basic-timezone">Timezone</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted z-10">
              <Clock className="icon-xs" />
            </div>
            <FormDropdown
              id="basic-timezone"
              value={basicInfo.timezone}
              onChange={(val) => handleChange('timezone', val)}
              options={TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* Company Section */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Company Details
        </h3>
        <p className="text-muted text-sm mt-1">
          Help us understand your business.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company Name */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="basic-company-name">Company Name</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <Building2 className="icon-xs" />
            </div>
            <input
              id="basic-company-name"
              type="text"
              placeholder="Your company name"
              value={basicInfo.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Company Website */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="basic-company-website">Current Website</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <Globe className="icon-xs" />
            </div>
            <input
              id="basic-company-website"
              type="url"
              placeholder="https://yoursite.com"
              value={basicInfo.companyWebsite}
              onChange={(e) => handleChange('companyWebsite', e.target.value)}
              className="input pl-10"
            />
          </div>
          <span className="text-xs text-muted">
            Leave blank if this is a new business
          </span>
        </div>
      </div>

      {/* Preferred Contact Method */}
      <div className="mt-6">
        <label className="field-label">
          Preferred Contact Method
        </label>
        <div className="flex gap-4 mt-2">
          {(['email', 'phone', 'either'] as const).map((method) => (
            <label
              key={method}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                'px-3 py-2',
                'border transition-colors',
                basicInfo.preferredContactMethod === method
                  ? 'border-primary bg-white text-dark'
                  : 'border border-default hover-border-primary'
              )}
            >
              <input
                type="radio"
                name="preferredContactMethod"
                value={method}
                checked={basicInfo.preferredContactMethod === method}
                onChange={(e) => handleChange('preferredContactMethod', e.target.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  'w-3 h-3 border flex items-center justify-center',
                  basicInfo.preferredContactMethod === method
                    ? 'border-black bg-black'
                    : 'border-primary'
                )}
              >
                {basicInfo.preferredContactMethod === method && (
                  <span className="w-1.5 h-1.5 bg-white" />
                )}
              </span>
              <span className={cn(
                'text-sm font-mono capitalize',
                basicInfo.preferredContactMethod === method ? 'text-dark' : 'text-primary'
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
