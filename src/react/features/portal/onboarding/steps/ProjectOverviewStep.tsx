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
    <div ref={containerRef} className="section">
      {/* Section Header */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Project Details
        </h3>
        <p className="text-muted text-sm mt-1">
          Tell us about your project goals and timeline.
        </p>
      </div>

      {/* Project Name & Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project Name */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-name">
            Project Name <span className="text-primary">*</span>
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
            <span className="text-xs text-primary">{getFieldError('projectName')}</span>
          )}
        </div>

        {/* Project Type */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-type">
            Project Type <span className="text-primary">*</span>
          </label>
          <select
            id="project-type"
            value={projectOverview.projectType}
            onChange={(e) => handleChange('projectType', e.target.value)}
            className={cn('select w-full', getFieldError('projectType') && 'border-primary')}
          >
            <option value="">Select project type...</option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {getFieldError('projectType') && (
            <span className="text-xs text-primary">{getFieldError('projectType')}</span>
          )}
        </div>
      </div>

      {/* Project Description */}
      <div className="flex flex-col gap-1 mt-4">
        <label className="field-label" htmlFor="project-description">
          Project Description <span className="text-primary">*</span>
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
          <span className="text-xs text-primary">{getFieldError('projectDescription')}</span>
        )}
      </div>

      <div className="divider" />

      {/* Timeline & Budget Section */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Timeline & Budget
        </h3>
        <p className="text-muted text-sm mt-1">
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
          <span className="text-xs text-muted">
            When do you want to launch?
          </span>
        </div>

        {/* Budget Range */}
        <div className="flex flex-col gap-1">
          <label className="field-label" htmlFor="project-budget">Budget Range</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted">
              <DollarSign className="icon-xs" />
            </div>
            <select
              id="project-budget"
              value={projectOverview.budget}
              onChange={(e) => handleChange('budget', e.target.value)}
              className="select w-full pl-10"
            >
              <option value="">Select budget range...</option>
              {BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted">
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
