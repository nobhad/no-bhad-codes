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
    <div ref={containerRef} className="section">
      {/* Design Preferences Section */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Design Preferences
        </h3>
        <p className="text-muted text-sm mt-1">
          Help us understand your visual style.
        </p>
      </div>

      {/* Design Style Selection */}
      <div className="flex flex-col gap-2">
        <label className="field-label">
          Design Style <span className="text-primary">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {DESIGN_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => handleChange('designStyle', style)}
              className={cn(
                'flex items-center justify-center gap-2',
                'px-3 py-2',
                'border transition-all duration-200',
                'text-sm text-center font-mono',
                'focus:outline-none focus:ring-2 focus:ring-white',
                requirements.designStyle === style
                  ? 'border-primary bg-white text-[var(--portal-text-dark)]'
                  : 'border-[var(--portal-border-color)] text-[var(--portal-text-light)] hover:border-primary'
              )}
            >
              <Palette className="icon-sm flex-shrink-0" />
              <span>{style}</span>
            </button>
          ))}
        </div>
        {getFieldError('designStyle') && (
          <span className="text-xs text-primary">{getFieldError('designStyle')}</span>
        )}
      </div>

      {/* Color Preferences */}
      <div className="flex flex-col gap-1 mt-4">
        <label className="field-label">Color Preferences</label>
        <input
          type="text"
          value={requirements.colorPreferences}
          onChange={(e) => handleChange('colorPreferences', e.target.value)}
          placeholder="Any specific colors or color schemes you prefer?"
          className="input"
        />
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4 mt-4">
        {/* Brand Guidelines */}
        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[var(--portal-border-color)]">
          <Checkbox
            checked={requirements.brandGuidelines}
            onCheckedChange={(checked) => handleChange('brandGuidelines', checked === true)}
          />
          <span className="text-sm font-mono">
            I have brand guidelines
          </span>
        </label>

        {/* Content Ready */}
        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-[var(--portal-border-color)]">
          <Checkbox
            checked={requirements.contentReady}
            onCheckedChange={(checked) => handleChange('contentReady', checked === true)}
          />
          <span className="text-sm font-mono">
            Content is ready/prepared
          </span>
        </label>
      </div>

      <div className="divider" />

      {/* Features Section */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Features & Functionality
        </h3>
        <p className="text-muted text-sm mt-1">
          Select the features you need for your project.
        </p>
      </div>

      {/* Feature Checkboxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {FEATURE_OPTIONS.map((feature) => {
          const isSelected = (requirements.features || []).includes(feature);
          return (
            <button
              key={feature}
              type="button"
              onClick={() => toggleFeature(feature)}
              className={cn(
                'flex items-center gap-2 text-left',
                'px-3 py-2',
                'border transition-all duration-200',
                'text-sm font-mono',
                'focus:outline-none focus:ring-2 focus:ring-white',
                isSelected
                  ? 'border-primary bg-white text-[var(--portal-text-dark)]'
                  : 'border-[var(--portal-border-color)] text-[var(--portal-text-light)] hover:border-primary'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 border flex items-center justify-center flex-shrink-0',
                  'transition-colors',
                  isSelected
                    ? 'bg-black border-black'
                    : 'border-primary'
                )}
              >
                {isSelected && <Check className="icon-xs text-[var(--portal-text-light)]" strokeWidth={3} />}
              </div>
              <span>{feature}</span>
            </button>
          );
        })}
      </div>

      {/* Integrations */}
      <div className="mt-6 flex flex-col gap-1">
        <label className="field-label flex items-center gap-1">
          <Link2 className="icon-xs" />
          Third-party Integrations
        </label>
        <textarea
          value={requirements.integrations}
          onChange={(e) => handleChange('integrations', e.target.value)}
          placeholder="List any third-party services or APIs you need to integrate with (e.g., Stripe, Mailchimp, Salesforce)"
          rows={2}
          className="textarea"
        />
      </div>

      {/* Additional Notes */}
      <div className="flex flex-col gap-1 mt-4">
        <label className="field-label flex items-center gap-1">
          <FileText className="icon-xs" />
          Additional Notes
        </label>
        <textarea
          value={requirements.additionalNotes}
          onChange={(e) => handleChange('additionalNotes', e.target.value)}
          placeholder="Anything else we should know about your requirements?"
          rows={3}
          className="textarea"
        />
      </div>
    </div>
  );
}
