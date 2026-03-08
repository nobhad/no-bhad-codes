/**
 * ConfirmationStep
 * Step 5: Review and submit
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import {
  User,
  Building2,
  FolderKanban,
  Palette,
  Puzzle,
  FileText,
  Check,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import type { StepProps, OnboardingStep } from '../types';

interface ConfirmationStepProps extends StepProps {
  onGoToStep?: (step: OnboardingStep) => void;
}

/**
 * Summary Section Component - Brutalist style
 */
interface SummarySectionProps {
  icon: React.ElementType;
  title: string;
  items: { label: string; value: string | React.ReactNode }[];
  onEdit?: () => void;
  stepNumber?: number;
}

function SummarySection({ icon: Icon, title, items, onEdit, stepNumber }: SummarySectionProps) {
  return (
    <div className="portal-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="icon-sm text-primary" />
          <h4 className="text-sm font-mono text-primary">
            {title}
          </h4>
          {stepNumber && (
            <span className="badge">
              Step {stepNumber}
            </span>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="btn-ghost text-xs"
          >
            <Edit3 className="icon-xs" />
            Edit
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex gap-2 text-sm font-mono">
            <span className="text-muted min-w-[100px] flex-shrink-0">
              {item.label}:
            </span>
            <span className="text-primary">{item.value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ConfirmationStep Component
 */
export function ConfirmationStep({ data, errors, isSubmitting: _isSubmitting, onGoToStep }: ConfirmationStepProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const { basicInfo, projectOverview, requirements, assets } = data;

  const hasErrors = errors.length > 0;

  // Format features list
  const featuresDisplay =
    requirements?.features && requirements.features.length > 0
      ? requirements.features.join(', ')
      : 'None selected';

  // Format files count
  const filesDisplay =
    assets?.files && assets.files.length > 0 ? `${assets.files.length} file(s)` : 'No files uploaded';

  return (
    <div ref={containerRef} className="section">
      {/* Section Header */}
      <div className="mb-4">
        <h3 className="heading text-lg">
          Review Your Information
        </h3>
        <p className="text-muted text-sm mt-1">
          Please review all the information below before submitting.
        </p>
      </div>

      {/* Validation Errors Banner */}
      {hasErrors && (
        <div className="error-state flex items-start gap-3">
          <AlertCircle className="icon-sm flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold font-mono">
              Please fix the following issues:
            </p>
            <ul className="mt-1 space-y-1">
              {errors.map((error) => (
                <li key={error.message} className="text-sm font-mono">
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Basic Info Summary */}
      <SummarySection
        icon={User}
        title="Contact Information"
        stepNumber={1}
        onEdit={onGoToStep ? () => onGoToStep('basic-info') : undefined}
        items={[
          { label: 'Name', value: basicInfo?.contactName || '' },
          { label: 'Email', value: basicInfo?.contactEmail || '' },
          { label: 'Phone', value: basicInfo?.contactPhone || '' },
          { label: 'Contact via', value: basicInfo?.preferredContactMethod || '' }
        ]}
      />

      {/* Company Summary */}
      {(basicInfo?.companyName || basicInfo?.companyWebsite) && (
        <SummarySection
          icon={Building2}
          title="Company Details"
          onEdit={onGoToStep ? () => onGoToStep('basic-info') : undefined}
          items={[
            { label: 'Company', value: basicInfo?.companyName || '' },
            { label: 'Website', value: basicInfo?.companyWebsite || '' },
            { label: 'Timezone', value: basicInfo?.timezone || '' }
          ]}
        />
      )}

      {/* Project Overview Summary */}
      <SummarySection
        icon={FolderKanban}
        title="Project Details"
        stepNumber={2}
        onEdit={onGoToStep ? () => onGoToStep('project-overview') : undefined}
        items={[
          { label: 'Project Name', value: projectOverview?.projectName || '' },
          { label: 'Type', value: projectOverview?.projectType || '' },
          { label: 'Launch Date', value: projectOverview?.targetLaunchDate || '' },
          { label: 'Budget', value: projectOverview?.budget || '' },
          { label: 'Audience', value: projectOverview?.targetAudience || '' }
        ]}
      />

      {/* Project Description */}
      {projectOverview?.projectDescription && (
        <div className="portal-card">
          <h4 className="label mb-2">
            Project Description
          </h4>
          <p className="text-sm text-primary font-mono whitespace-pre-wrap">
            {projectOverview.projectDescription}
          </p>
        </div>
      )}

      {/* Requirements Summary */}
      <SummarySection
        icon={Palette}
        title="Design Requirements"
        stepNumber={3}
        onEdit={onGoToStep ? () => onGoToStep('requirements') : undefined}
        items={[
          { label: 'Style', value: requirements?.designStyle || '' },
          { label: 'Colors', value: requirements?.colorPreferences || '' },
          {
            label: 'Brand Guide',
            value: requirements?.brandGuidelines ? (
              <span className="flex items-center gap-1">
                <Check className="icon-xs text-status-active" />
                Yes
              </span>
            ) : (
              'No'
            )
          },
          {
            label: 'Content Ready',
            value: requirements?.contentReady ? (
              <span className="flex items-center gap-1">
                <Check className="icon-xs text-status-active" />
                Yes
              </span>
            ) : (
              'No'
            )
          }
        ]}
      />

      {/* Features Summary */}
      <SummarySection
        icon={Puzzle}
        title="Features & Integrations"
        onEdit={onGoToStep ? () => onGoToStep('requirements') : undefined}
        items={[
          { label: 'Features', value: featuresDisplay },
          { label: 'Integrations', value: requirements?.integrations || '' }
        ]}
      />

      {/* Assets Summary */}
      <SummarySection
        icon={FileText}
        title="Assets"
        stepNumber={4}
        onEdit={onGoToStep ? () => onGoToStep('assets') : undefined}
        items={[
          { label: 'Files', value: filesDisplay },
          {
            label: 'Logo',
            value: assets?.logoProvided ? (
              <span className="flex items-center gap-1">
                <Check className="icon-xs text-status-active" />
                Included
              </span>
            ) : (
              'Not provided'
            )
          }
        ]}
      />

      {/* Additional Notes */}
      {requirements?.additionalNotes && (
        <div className="portal-card">
          <h4 className="label mb-2">
            Additional Notes
          </h4>
          <p className="text-sm text-primary font-mono whitespace-pre-wrap">
            {requirements.additionalNotes}
          </p>
        </div>
      )}

      {/* Submission Notice */}
      <div className="portal-card flex items-start gap-3 mt-2 border-primary">
        <Check className="icon-sm text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold font-mono text-primary">
            Ready to submit
          </p>
          <p className="text-sm text-muted mt-1 font-mono">
            Click "Complete Onboarding" below to submit your information. We'll review everything and
            get back to you within 1-2 business days.
          </p>
        </div>
      </div>
    </div>
  );
}
