/**
 * OnboardingWizard
 * Main wizard component with step navigation
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Save, Loader2 } from 'lucide-react';
import { gsap } from 'gsap';
import { useFadeIn } from '@react/hooks/useGsap';
import { StepIndicator } from './StepIndicator';
import {
  BasicInfoStep,
  ProjectOverviewStep,
  RequirementsStep,
  AssetsStep,
  ConfirmationStep
} from './steps';
import type {
  OnboardingWizardProps,
  OnboardingStep,
  OnboardingFormData,
  OnboardingProgress,
  ValidationError,
  StepValidationResult
} from './types';
import { ONBOARDING_STEPS, DRAFT_STORAGE_KEY, DRAFT_SAVE_INTERVAL } from './types';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('OnboardingWizard');

/**
 * Validate a specific step's data
 */
function validateStep(step: OnboardingStep, data: Partial<OnboardingFormData>): StepValidationResult {
  const errors: ValidationError[] = [];

  switch (step) {
  case 'basic-info': {
    const { basicInfo } = data;
    if (!basicInfo?.contactName?.trim()) {
      errors.push({ field: 'contactName', message: 'Contact name is required' });
    }
    if (!basicInfo?.contactEmail?.trim()) {
      errors.push({ field: 'contactEmail', message: 'Email address is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(basicInfo.contactEmail)) {
      errors.push({ field: 'contactEmail', message: 'Please enter a valid email address' });
    }
    break;
  }
  case 'project-overview': {
    const { projectOverview } = data;
    if (!projectOverview?.projectName?.trim()) {
      errors.push({ field: 'projectName', message: 'Project name is required' });
    }
    if (!projectOverview?.projectType) {
      errors.push({ field: 'projectType', message: 'Please select a project type' });
    }
    if (!projectOverview?.projectDescription?.trim()) {
      errors.push({ field: 'projectDescription', message: 'Project description is required' });
    }
    break;
  }
  case 'requirements': {
    const { requirements } = data;
    if (!requirements?.designStyle) {
      errors.push({ field: 'designStyle', message: 'Please select a design style' });
    }
    break;
  }
  case 'assets':
    // Assets step has no required fields
    break;
  case 'confirmation': {
    // Confirmation validates all previous steps
    const basicValidation = validateStep('basic-info', data);
    const projectValidation = validateStep('project-overview', data);
    const requirementsValidation = validateStep('requirements', data);
    errors.push(
      ...basicValidation.errors,
      ...projectValidation.errors,
      ...requirementsValidation.errors
    );
    break;
  }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Get step index from step ID
 */
function getStepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.findIndex((s) => s.id === step);
}

/**
 * OnboardingWizard Component
 */
export function OnboardingWizard({
  getAuthToken,
  onComplete,
  showNotification
}: OnboardingWizardProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const stepContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('basic-info');
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [formData, setFormData] = useState<Partial<OnboardingFormData>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step animation direction
  const animationDirectionRef = useRef<'forward' | 'backward'>('forward');

  /**
   * Load saved progress from API or localStorage
   */
  const loadProgress = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      // Try to load from API first
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.ONBOARDING, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        const unwrapped = unwrapApiData<Record<string, unknown>>(await response.json());
        if (unwrapped && Object.keys(unwrapped).length > 0) {
          const progress = unwrapped as unknown as OnboardingProgress;
          setCurrentStep(progress.currentStep || 'basic-info');
          setCompletedSteps(progress.completedSteps || []);
          setFormData(progress.formData || {});
          if (progress.lastSavedAt) {
            setLastSavedAt(new Date(progress.lastSavedAt));
          }
          setIsLoading(false);
          return;
        }
      }

      // Fall back to localStorage
      const localData = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (localData) {
        const parsed = JSON.parse(localData) as OnboardingProgress;
        setCurrentStep(parsed.currentStep || 'basic-info');
        setCompletedSteps(parsed.completedSteps || []);
        setFormData(parsed.formData || {});
        if (parsed.lastSavedAt) {
          setLastSavedAt(new Date(parsed.lastSavedAt));
        }
      }
    } catch (error) {
      logger.error('Failed to load onboarding progress:', error);
      // Try localStorage as fallback
      try {
        const localData = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (localData) {
          const parsed = JSON.parse(localData) as OnboardingProgress;
          setFormData(parsed.formData || {});
        }
      } catch {
        // Ignore localStorage errors
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  /**
   * Save progress to localStorage
   */
  const saveDraftToLocal = useCallback(() => {
    const progress: OnboardingProgress = {
      currentStep,
      completedSteps,
      formData,
      lastSavedAt: new Date().toISOString(),
      isComplete: false
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(progress));
    setLastSavedAt(new Date());
  }, [currentStep, completedSteps, formData]);

  /**
   * Save progress to API
   */
  const saveProgress = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsSaving(true);
      }

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        const token = getAuthToken?.();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const progress: OnboardingProgress = {
          currentStep,
          completedSteps,
          formData,
          lastSavedAt: new Date().toISOString(),
          isComplete: false
        };

        const response = await fetch(API_ENDPOINTS.ONBOARDING_SAVE, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(progress)
        });

        if (response.ok) {
          setLastSavedAt(new Date());
          // Also save to localStorage as backup
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(progress));
          if (!silent) {
            showNotification?.('Progress saved', 'success');
          }
        } else {
          // Save to localStorage as fallback
          saveDraftToLocal();
          if (!silent) {
            showNotification?.('Saved locally', 'info');
          }
        }
      } catch (error) {
        logger.error('Failed to save progress:', error);
        // Save to localStorage as fallback
        saveDraftToLocal();
        if (!silent) {
          showNotification?.('Saved locally', 'info');
        }
      } finally {
        setIsSaving(false);
      }
    },
    [currentStep, completedSteps, formData, getAuthToken, saveDraftToLocal, showNotification]
  );

  /**
   * Submit completed onboarding
   */
  const submitOnboarding = useCallback(async () => {
    // Validate all steps
    const validation = validateStep('confirmation', formData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      showNotification?.('Please fix the errors before submitting', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.ONBOARDING_COMPLETE, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          formData,
          completedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        // Clear localStorage draft
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        showNotification?.('Onboarding completed successfully!', 'success');
        onComplete?.();
      } else {
        const errorData = await response.json();
        showNotification?.(errorData.error || 'Failed to submit onboarding', 'error');
      }
    } catch (error) {
      logger.error('Failed to submit onboarding:', error);
      showNotification?.('Failed to submit. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, getAuthToken, onComplete, showNotification]);

  /**
   * Update form data for a step
   */
  const handleUpdateData = useCallback((stepData: Partial<OnboardingFormData>) => {
    setFormData((prev) => ({ ...prev, ...stepData }));
    setValidationErrors([]); // Clear errors when data changes
  }, []);

  /**
   * Navigate to a specific step
   */
  const goToStep = useCallback(
    (step: OnboardingStep) => {
      const currentIndex = getStepIndex(currentStep);
      const targetIndex = getStepIndex(step);
      animationDirectionRef.current = targetIndex > currentIndex ? 'forward' : 'backward';

      // Animate out current step
      if (stepContainerRef.current) {
        const direction = animationDirectionRef.current === 'forward' ? -30 : 30;
        gsap.to(stepContainerRef.current, {
          opacity: 0,
          x: direction,
          duration: 0.2,
          ease: 'power2.in',
          onComplete: () => {
            setCurrentStep(step);
            setValidationErrors([]);
            // Animate in new step
            if (stepContainerRef.current) {
              gsap.fromTo(
                stepContainerRef.current,
                { opacity: 0, x: -direction },
                { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }
              );
            }
          }
        });
      } else {
        setCurrentStep(step);
        setValidationErrors([]);
      }
    },
    [currentStep]
  );

  /**
   * Navigate to next step
   */
  const handleNext = useCallback(() => {
    // Validate current step
    const validation = validateStep(currentStep, formData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }

    // Go to next step
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      goToStep(ONBOARDING_STEPS[currentIndex + 1].id);
    }

    // Save progress
    saveProgress(true);
  }, [currentStep, formData, completedSteps, goToStep, saveProgress]);

  /**
   * Navigate to previous step
   */
  const handleBack = useCallback(() => {
    const currentIndex = getStepIndex(currentStep);
    if (currentIndex > 0) {
      goToStep(ONBOARDING_STEPS[currentIndex - 1].id);
    }
  }, [currentStep, goToStep]);

  /**
   * Handle step indicator click
   */
  const handleStepClick = useCallback(
    (step: OnboardingStep) => {
      const stepIndex = getStepIndex(step);
      const currentIndex = getStepIndex(currentStep);

      // Can only go to completed steps or the current step
      if (completedSteps.includes(step) || stepIndex <= currentIndex) {
        goToStep(step);
      }
    },
    [currentStep, completedSteps, goToStep]
  );

  // Load progress on mount
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(() => {
      saveDraftToLocal();
    }, DRAFT_SAVE_INTERVAL);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [saveDraftToLocal]);

  // Render current step content
  const renderStepContent = () => {
    const stepProps = {
      data: formData,
      onUpdate: handleUpdateData,
      errors: validationErrors,
      isSubmitting
    };

    switch (currentStep) {
    case 'basic-info':
      return <BasicInfoStep {...stepProps} />;
    case 'project-overview':
      return <ProjectOverviewStep {...stepProps} />;
    case 'requirements':
      return <RequirementsStep {...stepProps} />;
    case 'assets':
      return <AssetsStep {...stepProps} />;
    case 'confirmation':
      return <ConfirmationStep {...stepProps} onGoToStep={goToStep} />;
    default:
      return null;
    }
  };

  // Get current step config
  const currentStepConfig = ONBOARDING_STEPS.find((s) => s.id === currentStep);
  const currentIndex = getStepIndex(currentStep);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === ONBOARDING_STEPS.length - 1;

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state tw-h-64">
        <span className="loading-spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="error-state tw-h-64">
        <p>{loadError}</p>
        <button className="btn-secondary tw-mt-4" onClick={loadProgress}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="portal-main-container">
      {/* Header with Step Indicator */}
      <div className="tw-flex tw-flex-col tw-gap-4">
        <div className="tw-flex tw-items-center tw-justify-between">
          <div>
            <h2 className="heading tw-text-xl">
              Client Onboarding
            </h2>
            <p className="text-muted tw-text-[14px] tw-mt-0.5">
              {currentStepConfig?.description}
            </p>
          </div>
          {lastSavedAt && (
            <div className="tw-flex tw-items-center tw-gap-1.5 label">
              <Save className="icon-xs" />
              <span>
                Saved{' '}
                {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        <StepIndicator
          steps={ONBOARDING_STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Step Content */}
      <div
        ref={stepContainerRef}
        className="tw-panel tw-min-h-[400px]"
      >
        {renderStepContent()}
      </div>

      {/* Navigation Footer */}
      <div className="tw-flex tw-items-center tw-justify-between tw-pt-2">
        <div>
          {!isFirstStep && (
            <button
              className="btn-secondary"
              onClick={handleBack}
              disabled={isSubmitting}
            >
              <ChevronLeft className="icon-xs" />
              Back
            </button>
          )}
        </div>

        <div className="tw-flex tw-items-center tw-gap-2">
          {/* Save Progress Button */}
          <button
            className="btn-ghost"
            onClick={() => saveProgress(false)}
            disabled={isSaving || isSubmitting}
          >
            {isSaving ? (
              <Loader2 className="icon-xs loading-spin" />
            ) : null}
            Save Progress
          </button>

          {/* Next/Submit Button */}
          {isLastStep ? (
            <button
              className="btn-primary"
              onClick={submitOnboarding}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="icon-xs loading-spin" />
              ) : (
                <Check className="icon-xs" />
              )}
              Complete Onboarding
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleNext}
              disabled={isSubmitting}
            >
              Continue
              <ChevronRight className="icon-xs" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
