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
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-3">
        <div className="tw-flex tw-items-center tw-gap-2">
          <Icon className="icon-sm tw-text-primary" />
          <h4 className="tw-text-[14px] tw-font-mono tw-text-primary">
            {title}
          </h4>
          {stepNumber && (
            <span className="tw-badge">
              Step {stepNumber}
            </span>
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="btn-ghost tw-text-[12px]"
          >
            <Edit3 className="icon-xs" />
            Edit
          </button>
        )}
      </div>
      <div className="tw-space-y-2">
        {items.map((item, index) => (
          <div key={index} className="tw-flex tw-gap-2 tw-text-[14px] tw-font-mono">
            <span className="text-muted tw-min-w-[100px] tw-flex-shrink-0">
              {item.label}:
            </span>
            <span className="tw-text-primary">{item.value || '-'}</span>
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
    <div ref={containerRef} className="tw-section">
      {/* Section Header */}
      <div className="tw-mb-4">
        <h3 className="heading tw-text-lg">
          Review Your Information
        </h3>
        <p className="text-muted tw-text-[14px] tw-mt-1">
          Please review all the information below before submitting.
        </p>
      </div>

      {/* Validation Errors Banner */}
      {hasErrors && (
        <div className="error-state tw-flex tw-items-start tw-gap-3">
          <AlertCircle className="tw-h-4 tw-w-4 tw-flex-shrink-0 tw-mt-0.5" />
          <div>
            <p className="tw-text-[14px] tw-font-bold tw-font-mono">
              Please fix the following issues:
            </p>
            <ul className="tw-mt-1 tw-space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="tw-text-[14px] tw-font-mono">
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
          <h4 className="label tw-mb-2">
            Project Description
          </h4>
          <p className="tw-text-[14px] tw-text-primary tw-font-mono tw-whitespace-pre-wrap">
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
              <span className="tw-flex tw-items-center tw-gap-1">
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
              <span className="tw-flex tw-items-center tw-gap-1">
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
              <span className="tw-flex tw-items-center tw-gap-1">
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
          <h4 className="label tw-mb-2">
            Additional Notes
          </h4>
          <p className="tw-text-[14px] tw-text-primary tw-font-mono tw-whitespace-pre-wrap">
            {requirements.additionalNotes}
          </p>
        </div>
      )}

      {/* Submission Notice */}
      <div className="portal-card tw-flex tw-items-start tw-gap-3 tw-mt-2 tw-border-primary">
        <Check className="tw-h-4 tw-w-4 tw-text-primary tw-flex-shrink-0 tw-mt-0.5" />
        <div>
          <p className="tw-text-[14px] tw-font-bold tw-font-mono tw-text-primary">
            Ready to submit
          </p>
          <p className="tw-text-[14px] text-muted tw-mt-1 tw-font-mono">
            Click "Complete Onboarding" below to submit your information. We'll review everything and
            get back to you within 1-2 business days.
          </p>
        </div>
      </div>
    </div>
  );
}
