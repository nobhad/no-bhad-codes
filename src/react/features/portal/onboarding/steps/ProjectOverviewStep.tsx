/**
 * ProjectOverviewStep
 * Step 2: Project goals, type, and timeline
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { FolderKanban, Calendar, DollarSign, Users } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import type { StepProps, ProjectOverviewData } from '../types';
import { PROJECT_TYPES, BUDGET_RANGES } from '../types';

/**
 * ProjectOverviewStep Component
 */
export function ProjectOverviewStep({ data, onUpdate, errors }: StepProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const projectOverview = data.projectOverview || {
    projectName: '',
    projectType: '',
    projectDescription: '',
    targetLaunchDate: '',
    budget: '',
    targetAudience: '',
  };

  const handleChange = (field: keyof ProjectOverviewData, value: string) => {
    onUpdate({
      projectOverview: {
        ...projectOverview,
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
          Project Details
        </h3>
        <p className="tw-text-muted tw-text-[14px] tw-mt-1">
          Tell us about your project goals and timeline.
        </p>
      </div>

      {/* Project Name & Type */}
      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
        {/* Project Name */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">
            Project Name <span className="tw-text-white">*</span>
          </label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[rgba(255,255,255,0.46)]">
              <FolderKanban className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="text"
              placeholder="My Awesome Project"
              value={projectOverview.projectName}
              onChange={(e) => handleChange('projectName', e.target.value)}
              className={cn('tw-input tw-pl-10', getFieldError('projectName') && 'tw-border-white')}
            />
          </div>
          {getFieldError('projectName') && (
            <span className="tw-text-[12px] tw-text-white">{getFieldError('projectName')}</span>
          )}
        </div>

        {/* Project Type */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">
            Project Type <span className="tw-text-white">*</span>
          </label>
          <select
            value={projectOverview.projectType}
            onChange={(e) => handleChange('projectType', e.target.value)}
            className={cn('tw-select tw-w-full', getFieldError('projectType') && 'tw-border-white')}
          >
            <option value="">Select project type...</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {getFieldError('projectType') && (
            <span className="tw-text-[12px] tw-text-white">{getFieldError('projectType')}</span>
          )}
        </div>
      </div>

      {/* Project Description */}
      <div className="tw-flex tw-flex-col tw-gap-1 tw-mt-4">
        <label className="tw-field-label">
          Project Description <span className="tw-text-white">*</span>
        </label>
        <textarea
          value={projectOverview.projectDescription}
          onChange={(e) => handleChange('projectDescription', e.target.value)}
          placeholder="Describe your project goals, what you want to achieve, and any specific requirements..."
          rows={4}
          className={cn('tw-textarea', getFieldError('projectDescription') && 'tw-border-white')}
        />
        {getFieldError('projectDescription') && (
          <span className="tw-text-[12px] tw-text-white">{getFieldError('projectDescription')}</span>
        )}
      </div>

      <div className="tw-divider" />

      {/* Timeline & Budget Section */}
      <div className="tw-mb-4">
        <h3 className="tw-heading tw-text-lg">
          Timeline & Budget
        </h3>
        <p className="tw-text-muted tw-text-[14px] tw-mt-1">
          Help us understand your constraints.
        </p>
      </div>

      <div className="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-4">
        {/* Target Launch Date */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">Target Launch Date</label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[rgba(255,255,255,0.46)]">
              <Calendar className="tw-h-4 tw-w-4" />
            </div>
            <input
              type="date"
              value={projectOverview.targetLaunchDate}
              onChange={(e) => handleChange('targetLaunchDate', e.target.value)}
              className="tw-input tw-pl-10"
            />
          </div>
          <span className="tw-text-[12px] tw-text-[rgba(255,255,255,0.46)]">
            When do you want to launch?
          </span>
        </div>

        {/* Budget Range */}
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-field-label">Budget Range</label>
          <div className="tw-relative">
            <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[rgba(255,255,255,0.46)]">
              <DollarSign className="tw-h-4 tw-w-4" />
            </div>
            <select
              value={projectOverview.budget}
              onChange={(e) => handleChange('budget', e.target.value)}
              className="tw-select tw-w-full tw-pl-10"
            >
              <option value="">Select budget range...</option>
              {BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>
          <span className="tw-text-[12px] tw-text-[rgba(255,255,255,0.46)]">
            This helps us recommend the right scope
          </span>
        </div>
      </div>

      {/* Target Audience */}
      <div className="tw-flex tw-flex-col tw-gap-1 tw-mt-4">
        <label className="tw-field-label">Target Audience</label>
        <div className="tw-relative">
          <div className="tw-absolute tw-left-3 tw-top-1/2 tw-transform tw--translate-y-1/2 tw-text-[rgba(255,255,255,0.46)]">
            <Users className="tw-h-4 tw-w-4" />
          </div>
          <input
            type="text"
            placeholder="Who is this project for? (e.g., small business owners, tech enthusiasts)"
            value={projectOverview.targetAudience}
            onChange={(e) => handleChange('targetAudience', e.target.value)}
            className="tw-input tw-pl-10"
          />
        </div>
      </div>
    </div>
  );
}
