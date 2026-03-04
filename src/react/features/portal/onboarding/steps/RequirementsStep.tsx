/**
 * RequirementsStep
 * Step 3: Technical and design requirements
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { Palette, FileText, Link2, Check } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { Checkbox } from '@react/components/ui/checkbox';
import type { StepProps, RequirementsData } from '../types';
import { DESIGN_STYLES, FEATURE_OPTIONS } from '../types';

/**
 * RequirementsStep Component
 */
export function RequirementsStep({ data, onUpdate, errors }: StepProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const requirements = data.requirements || {
    designStyle: '',
    colorPreferences: '',
    brandGuidelines: false,
    contentReady: false,
    features: [],
    integrations: '',
    additionalNotes: ''
  };

  const handleChange = (field: keyof RequirementsData, value: string | boolean | string[]) => {
    onUpdate({
      requirements: {
        ...requirements,
        [field]: value
      }
    });
  };

  const toggleFeature = (feature: string) => {
    const currentFeatures = requirements.features || [];
    const newFeatures = currentFeatures.includes(feature)
      ? currentFeatures.filter((f) => f !== feature)
      : [...currentFeatures, feature];
    handleChange('features', newFeatures);
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  return (
    <div ref={containerRef} className="tw-section">
      {/* Design Preferences Section */}
      <div className="tw-mb-4">
        <h3 className="heading tw-text-lg">
          Design Preferences
        </h3>
        <p className="text-muted tw-text-[14px] tw-mt-1">
          Help us understand your visual style.
        </p>
      </div>

      {/* Design Style Selection */}
      <div className="tw-flex tw-flex-col tw-gap-2">
        <label className="field-label">
          Design Style <span className="tw-text-primary">*</span>
        </label>
        <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-3 lg:tw-grid-cols-4 tw-gap-2">
          {DESIGN_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => handleChange('designStyle', style)}
              className={cn(
                'tw-flex tw-items-center tw-justify-center tw-gap-2',
                'tw-px-3 tw-py-2',
                'tw-border tw-transition-all tw-duration-200',
                'tw-text-[14px] tw-text-center tw-font-mono',
                'focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-white',
                requirements.designStyle === style
                  ? 'tw-border-primary tw-bg-white tw-text-black'
                  : 'tw-border-[var(--portal-border-color)] tw-text-[var(--portal-text-light)] hover:tw-border-primary'
              )}
            >
              <Palette className="icon-sm tw-flex-shrink-0" />
              <span>{style}</span>
            </button>
          ))}
        </div>
        {getFieldError('designStyle') && (
          <span className="tw-text-[12px] tw-text-primary">{getFieldError('designStyle')}</span>
        )}
      </div>

      {/* Color Preferences */}
      <div className="tw-flex tw-flex-col tw-gap-1 tw-mt-4">
        <label className="field-label">Color Preferences</label>
        <input
          type="text"
          value={requirements.colorPreferences}
          onChange={(e) => handleChange('colorPreferences', e.target.value)}
          placeholder="Any specific colors or color schemes you prefer?"
          className="tw-input"
        />
      </div>

      {/* Checkboxes */}
      <div className="tw-flex tw-flex-wrap tw-gap-4 tw-mt-4">
        {/* Brand Guidelines */}
        <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-px-3 tw-py-2 tw-border tw-border-[var(--portal-border-color)]">
          <Checkbox
            checked={requirements.brandGuidelines}
            onCheckedChange={(checked) => handleChange('brandGuidelines', checked === true)}
          />
          <span className="tw-text-[14px] tw-font-mono">
            I have brand guidelines
          </span>
        </label>

        {/* Content Ready */}
        <label className="tw-flex tw-items-center tw-gap-2 tw-cursor-pointer tw-px-3 tw-py-2 tw-border tw-border-[var(--portal-border-color)]">
          <Checkbox
            checked={requirements.contentReady}
            onCheckedChange={(checked) => handleChange('contentReady', checked === true)}
          />
          <span className="tw-text-[14px] tw-font-mono">
            Content is ready/prepared
          </span>
        </label>
      </div>

      <div className="tw-divider" />

      {/* Features Section */}
      <div className="tw-mb-4">
        <h3 className="heading tw-text-lg">
          Features & Functionality
        </h3>
        <p className="text-muted tw-text-[14px] tw-mt-1">
          Select the features you need for your project.
        </p>
      </div>

      {/* Feature Checkboxes */}
      <div className="tw-grid tw-grid-cols-2 md:tw-grid-cols-3 tw-gap-2">
        {FEATURE_OPTIONS.map((feature) => {
          const isSelected = (requirements.features || []).includes(feature);
          return (
            <button
              key={feature}
              type="button"
              onClick={() => toggleFeature(feature)}
              className={cn(
                'tw-flex tw-items-center tw-gap-2 tw-text-left',
                'tw-px-3 tw-py-2',
                'tw-border tw-transition-all tw-duration-200',
                'tw-text-[14px] tw-font-mono',
                'focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-white',
                isSelected
                  ? 'tw-border-primary tw-bg-white tw-text-black'
                  : 'tw-border-[var(--portal-border-color)] tw-text-[var(--portal-text-light)] hover:tw-border-primary'
              )}
            >
              <div
                className={cn(
                  'tw-w-4 tw-h-4 tw-border tw-flex tw-items-center tw-justify-center tw-flex-shrink-0',
                  'tw-transition-colors',
                  isSelected
                    ? 'tw-bg-black tw-border-black'
                    : 'tw-border-primary'
                )}
              >
                {isSelected && <Check className="icon-xs tw-text-white" strokeWidth={3} />}
              </div>
              <span>{feature}</span>
            </button>
          );
        })}
      </div>

      {/* Integrations */}
      <div className="tw-mt-6 tw-flex tw-flex-col tw-gap-1">
        <label className="field-label tw-flex tw-items-center tw-gap-1">
          <Link2 className="icon-xs" />
          Third-party Integrations
        </label>
        <textarea
          value={requirements.integrations}
          onChange={(e) => handleChange('integrations', e.target.value)}
          placeholder="List any third-party services or APIs you need to integrate with (e.g., Stripe, Mailchimp, Salesforce)"
          rows={2}
          className="tw-textarea"
        />
      </div>

      {/* Additional Notes */}
      <div className="tw-flex tw-flex-col tw-gap-1 tw-mt-4">
        <label className="field-label tw-flex tw-items-center tw-gap-1">
          <FileText className="icon-xs" />
          Additional Notes
        </label>
        <textarea
          value={requirements.additionalNotes}
          onChange={(e) => handleChange('additionalNotes', e.target.value)}
          placeholder="Anything else we should know about your requirements?"
          rows={3}
          className="tw-textarea"
        />
      </div>
    </div>
  );
}
