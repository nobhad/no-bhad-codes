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
export const StepIndicator = React.memo(({
  steps,
  currentStep,
  completedSteps,
  onStepClick
}: StepIndicatorProps) => {
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
    <div className="flex items-center justify-center gap-1">
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
                'flex items-center justify-center',
                'w-7 h-7',
                'text-sm font-mono',
                'transition-all duration-200',
                'border border-primary',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black',
                isCompleted && [
                  'bg-white',
                  'text-dark',
                  isAccessible && 'cursor-pointer hover:opacity-80'
                ],
                isCurrent &&
                  !isCompleted && [
                  'bg-white',
                  'text-dark'
                ],
                !isCompleted &&
                  !isCurrent && [
                  'bg-transparent',
                  'text-muted',
                  'border border-default'
                ],
                !isAccessible && 'cursor-not-allowed opacity-50'
              )}
              title={step.title}
              aria-label={`Step ${step.number}: ${step.title}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? (
                <Check className="icon-xs" strokeWidth={3} />
              ) : (
                step.number
              )}
            </button>

            {/* Connector Line */}
            {!isLast && (
              <div
                className={cn(
                  'w-8 h-[1px] transition-colors duration-200',
                  index < currentIndex || isStepCompleted(steps[index + 1]?.id)
                    ? 'bg-primary'
                    : 'bg-subtle'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

/**
 * StepIndicatorDetailed
 * A more detailed version showing step titles (for larger screens)
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */
export const StepIndicatorDetailed = React.memo(({
  steps,
  currentStep,
  completedSteps,
  onStepClick
}: StepIndicatorProps) => {
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
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-start justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = isStepCompleted(step.id);
          const isCurrent = step.id === currentStep;
          const isAccessible = isStepAccessible(step.id);
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={cn('flex flex-col items-center flex-1', !isLast && 'relative')}
            >
              <div className="flex items-center w-full">
                {/* Step Square - Brutalist */}
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  disabled={!isAccessible}
                  className={cn(
                    'flex items-center justify-center flex-shrink-0',
                    'w-8 h-8',
                    'text-sm font-mono',
                    'transition-all duration-200',
                    'border border-primary',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black',
                    isCompleted && [
                      'bg-white',
                      'text-dark',
                      isAccessible && 'cursor-pointer hover:opacity-80'
                    ],
                    isCurrent &&
                      !isCompleted && [
                      'bg-white',
                      'text-dark'
                    ],
                    !isCompleted &&
                      !isCurrent && [
                      'bg-transparent',
                      'text-muted',
                      'border border-default'
                    ],
                    !isAccessible && 'cursor-not-allowed opacity-50'
                  )}
                  aria-label={`Step ${step.number}: ${step.title}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="icon-xs" strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </button>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={cn(
                      'flex-1 h-[1px] mx-2 transition-colors duration-200',
                      index < currentIndex
                        ? 'bg-primary'
                        : 'bg-subtle'
                    )}
                  />
                )}
              </div>

              {/* Step Title */}
              <span
                className={cn(
                  'mt-2 text-2xs text-center max-w-[80px] leading-tight font-mono',
                  isCurrent
                    ? 'text-primary font-bold'
                    : 'text-muted'
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
});
