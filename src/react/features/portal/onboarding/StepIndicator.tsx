/**
 * StepIndicator
 * Step progress indicator for the onboarding wizard
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@react/lib/utils';
import type { StepIndicatorProps, OnboardingStep } from './types';

/**
 * StepIndicator Component
 * Displays progress through the wizard steps
 */
export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  const isStepCompleted = (stepId: OnboardingStep): boolean => {
    return completedSteps.includes(stepId);
  };

  const isStepAccessible = (stepId: OnboardingStep): boolean => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    // Can access completed steps or the current step
    return isStepCompleted(stepId) || stepIndex <= currentIndex;
  };

  const handleStepClick = (stepId: OnboardingStep) => {
    if (onStepClick && isStepAccessible(stepId)) {
      onStepClick(stepId);
    }
  };

  return (
    <div className="tw-flex tw-items-center tw-justify-center tw-gap-1">
      {steps.map((step, index) => {
        const isCompleted = isStepCompleted(step.id);
        const isCurrent = step.id === currentStep;
        const isAccessible = isStepAccessible(step.id);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            {/* Step Circle - Brutalist square */}
            <button
              type="button"
              onClick={() => handleStepClick(step.id)}
              disabled={!isAccessible}
              className={cn(
                'tw-flex tw-items-center tw-justify-center',
                'tw-w-7 tw-h-7',
                'tw-text-[14px] tw-font-mono',
                'tw-transition-all tw-duration-200',
                'tw-border tw-border-white',
                'focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-white focus:tw-ring-offset-2 focus:tw-ring-offset-black',
                isCompleted && [
                  'tw-bg-white',
                  'tw-text-black',
                  isAccessible && 'tw-cursor-pointer hover:tw-opacity-80',
                ],
                isCurrent &&
                  !isCompleted && [
                    'tw-bg-white',
                    'tw-text-black',
                  ],
                !isCompleted &&
                  !isCurrent && [
                    'tw-bg-transparent',
                    'tw-text-[rgba(255,255,255,0.46)]',
                    'tw-border-[rgba(255,255,255,0.3)]',
                  ],
                !isAccessible && 'tw-cursor-not-allowed tw-opacity-50'
              )}
              title={step.title}
              aria-label={`Step ${step.number}: ${step.title}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? (
                <Check className="tw-h-4 tw-w-4" strokeWidth={3} />
              ) : (
                step.number
              )}
            </button>

            {/* Connector Line */}
            {!isLast && (
              <div
                className={cn(
                  'tw-w-8 tw-h-[1px] tw-transition-colors tw-duration-200',
                  index < currentIndex || isStepCompleted(steps[index + 1]?.id)
                    ? 'tw-bg-white'
                    : 'tw-bg-[rgba(255,255,255,0.2)]'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * StepIndicatorDetailed
 * A more detailed version showing step titles (for larger screens)
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */
export function StepIndicatorDetailed({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  const isStepCompleted = (stepId: OnboardingStep): boolean => {
    return completedSteps.includes(stepId);
  };

  const isStepAccessible = (stepId: OnboardingStep): boolean => {
    const stepIndex = steps.findIndex((s) => s.id === stepId);
    return isStepCompleted(stepId) || stepIndex <= currentIndex;
  };

  const handleStepClick = (stepId: OnboardingStep) => {
    if (onStepClick && isStepAccessible(stepId)) {
      onStepClick(stepId);
    }
  };

  return (
    <nav aria-label="Onboarding progress" className="tw-w-full">
      <ol className="tw-flex tw-items-start tw-justify-between tw-gap-2">
        {steps.map((step, index) => {
          const isCompleted = isStepCompleted(step.id);
          const isCurrent = step.id === currentStep;
          const isAccessible = isStepAccessible(step.id);
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn('tw-flex tw-flex-col tw-items-center tw-flex-1', !isLast && 'tw-relative')}
            >
              <div className="tw-flex tw-items-center tw-w-full">
                {/* Step Square - Brutalist */}
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  disabled={!isAccessible}
                  className={cn(
                    'tw-flex tw-items-center tw-justify-center tw-flex-shrink-0',
                    'tw-w-8 tw-h-8',
                    'tw-text-[14px] tw-font-mono',
                    'tw-transition-all tw-duration-200',
                    'tw-border tw-border-white',
                    'focus:tw-outline-none focus:tw-ring-2 focus:tw-ring-white focus:tw-ring-offset-2 focus:tw-ring-offset-black',
                    isCompleted && [
                      'tw-bg-white',
                      'tw-text-black',
                      isAccessible && 'tw-cursor-pointer hover:tw-opacity-80',
                    ],
                    isCurrent &&
                      !isCompleted && [
                        'tw-bg-white',
                        'tw-text-black',
                      ],
                    !isCompleted &&
                      !isCurrent && [
                        'tw-bg-transparent',
                        'tw-text-[rgba(255,255,255,0.46)]',
                        'tw-border-[rgba(255,255,255,0.3)]',
                      ],
                    !isAccessible && 'tw-cursor-not-allowed tw-opacity-50'
                  )}
                  aria-label={`Step ${step.number}: ${step.title}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="tw-h-4 tw-w-4" strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </button>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={cn(
                      'tw-flex-1 tw-h-[1px] tw-mx-2 tw-transition-colors tw-duration-200',
                      index < currentIndex
                        ? 'tw-bg-white'
                        : 'tw-bg-[rgba(255,255,255,0.2)]'
                    )}
                  />
                )}
              </div>

              {/* Step Title */}
              <span
                className={cn(
                  'tw-mt-2 tw-text-[11px] tw-text-center tw-max-w-[80px] tw-leading-tight tw-font-mono',
                  isCurrent
                    ? 'tw-text-white tw-font-bold'
                    : 'tw-text-[rgba(255,255,255,0.46)]'
                )}
              >
                {step.title}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
