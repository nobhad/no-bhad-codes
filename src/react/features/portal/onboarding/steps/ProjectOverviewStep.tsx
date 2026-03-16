/**
 * ProjectOverviewStep
 * Step 2: Project goals, type, and timeline
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { FolderKanban, Calendar, DollarSign, Users } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { FormDropdown } from '@react/components/portal/FormDropdown';
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
    targetAudience: ''
  };

  const handleChange = (field: keyof ProjectOverviewData, value: string) => {
    onUpdate({
      projectOverview: {
        ...projectOverview,
        [field]: value
      }
    });
  };

  const getFieldError = (field: string): string | undefined => {
    return errors.find((e) => e.field === field)?.message;
  };

  return (
    <div ref={containerRef}>
      {/* Section Header */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Project Details
        </h3>
        <p className="text-muted mt-1">
          Tell us about your project goals and timeline.
        </p>
      </div>

      {/* Project Name & Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project Name */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-name">
            Project Name <span className="form-required">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <FolderKanban className="icon-xs" />
            </div>
            <input
              id="project-name"
              type="text"
              placeholder="My Awesome Project"
              value={projectOverview.projectName}
              onChange={(e) => handleChange('projectName', e.target.value)}
              className={cn('input pl-10', getFieldError('projectName') && 'border-primary')}
            />
          </div>
          {getFieldError('projectName') && (
            <span className="form-error-message">{getFieldError('projectName')}</span>
          )}
        </div>

        {/* Project Type */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-type">
            Project Type <span className="form-required">*</span>
          </label>
          <FormDropdown
            id="project-type"
            value={projectOverview.projectType}
            onChange={(val) => handleChange('projectType', val)}
            options={[
              { value: '', label: 'Select project type...' },
              ...PROJECT_TYPES.map((type) => ({ value: type, label: type }))
            ]}
            placeholder="Select project type..."
            className={cn(getFieldError('projectType') && 'border-primary')}
          />
          {getFieldError('projectType') && (
            <span className="form-error-message">{getFieldError('projectType')}</span>
          )}
        </div>
      </div>

      {/* Project Description */}
      <div className="flex flex-col gap-1 mt-4">
        <label className="field-label" htmlFor="project-description">
          Project Description <span className="form-required">*</span>
        </label>
        <textarea
          id="project-description"
          value={projectOverview.projectDescription}
          onChange={(e) => handleChange('projectDescription', e.target.value)}
          placeholder="Describe your project goals, what you want to achieve, and any specific requirements..."
          rows={4}
          className={cn('textarea', getFieldError('projectDescription') && 'border-primary')}
        />
        {getFieldError('projectDescription') && (
          <span className="form-error-message">{getFieldError('projectDescription')}</span>
        )}
      </div>

      <div className="divider" />

      {/* Timeline & Budget Section */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Timeline & Budget
        </h3>
        <p className="text-muted mt-1">
          Help us understand your constraints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Target Launch Date */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-launch-date">Target Launch Date</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <Calendar className="icon-xs" />
            </div>
            <input
              id="project-launch-date"
              type="date"
              value={projectOverview.targetLaunchDate}
              onChange={(e) => handleChange('targetLaunchDate', e.target.value)}
              className="input pl-10"
            />
          </div>
          <span className="text-muted">
            When do you want to launch?
          </span>
        </div>

        {/* Budget Range */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-budget">Budget Range</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted z-10">
              <DollarSign className="icon-xs" />
            </div>
            <FormDropdown
              id="project-budget"
              value={projectOverview.budget}
              onChange={(val) => handleChange('budget', val)}
              options={[
                { value: '', label: 'Select budget range...' },
                ...BUDGET_RANGES.map((range) => ({ value: range, label: range }))
              ]}
              placeholder="Select budget range..."
              className="pl-10"
            />
          </div>
          <span className="text-muted">
            This helps us recommend the right scope
          </span>
        </div>
      </div>

      {/* Target Audience */}
      <div className="flex flex-col gap-1 mt-4">
        <label className="field-label" htmlFor="project-target-audience">Target Audience</label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
            <Users className="icon-xs" />
          </div>
          <input
            id="project-target-audience"
            type="text"
            placeholder="Who is this project for? (e.g., small business owners, tech enthusiasts)"
            value={projectOverview.targetAudience}
            onChange={(e) => handleChange('targetAudience', e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>
    </div>
  );
}
