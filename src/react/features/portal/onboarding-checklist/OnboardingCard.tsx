/**
 * ===============================================
 * ONBOARDING CARD
 * ===============================================
 * @file src/react/features/portal/onboarding-checklist/OnboardingCard.tsx
 *
 * Dashboard widget showing onboarding progress with step list.
 * Auto-refreshes when steps are completed via workflow events.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  CheckCircle, Circle, ChevronRight, X,
  FileSignature, CreditCard, ClipboardList, Upload, Eye, Sparkles
} from 'lucide-react';
import { usePortalData, usePortalFetch } from '../../../hooks/usePortalFetch';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';
import type { OnboardingChecklist, OnboardingCardProps, OnboardingStep } from './types';

/** Map step types to Lucide icons */
function getStepIcon(stepType: string) {
  switch (stepType) {
  case 'review_proposal':
    return <Eye size={16} />;
  case 'sign_contract':
    return <FileSignature size={16} />;
  case 'pay_deposit':
    return <CreditCard size={16} />;
  case 'complete_questionnaire':
    return <ClipboardList size={16} />;
  case 'upload_assets':
    return <Upload size={16} />;
  default:
    return <Sparkles size={16} />;
  }
}

export function OnboardingCard({
  getAuthToken,
  showNotification,
  onNavigate
}: OnboardingCardProps) {
  const { data, isLoading, refetch } = usePortalData<{ checklist: OnboardingChecklist | null }>({
    getAuthToken,
    url: API_ENDPOINTS.ONBOARDING_CHECKLIST_MY,
    transform: (raw) => raw as { checklist: OnboardingChecklist | null }
  });

  const { portalFetch } = usePortalFetch({ getAuthToken });
  const [dismissing, setDismissing] = useState(false);

  const checklist = data?.checklist;

  const handleDismiss = useCallback(async () => {
    if (!checklist) return;
    setDismissing(true);
    try {
      await portalFetch(`${API_ENDPOINTS.ONBOARDING_CHECKLIST}/dismiss`, {
        method: 'POST',
        body: { checklistId: checklist.id }
      });
      refetch();
    } catch {
      showNotification?.('Failed to dismiss checklist', 'error');
    } finally {
      setDismissing(false);
    }
  }, [checklist, portalFetch, refetch, showNotification]);

  const handleStepComplete = useCallback(async (stepId: number) => {
    try {
      await portalFetch(buildEndpoint.onboardingStepComplete(stepId), {
        method: 'POST'
      });
      showNotification?.('Step completed!', 'success');
      refetch();
    } catch {
      showNotification?.('Failed to complete step', 'error');
    }
  }, [portalFetch, showNotification, refetch]);

  const handleStepNavigate = useCallback((step: OnboardingStep) => {
    if (step.navigateTab) {
      onNavigate?.(step.navigateTab, step.navigateEntityId ? String(step.navigateEntityId) : undefined);
    }
  }, [onNavigate]);

  // Don't render if no active checklist
  if (isLoading || !checklist || checklist.status !== 'active') {
    return null;
  }

  const { progress, steps } = checklist;

  return (
    <div className="portal-card onboarding-card relative">
      {/* Header */}
      <div className="layout-row-top justify-between">
        <div>
          <h3>Getting Started</h3>
          <span className="text-muted text-sm">
            {progress.completed} of {progress.total} steps completed
          </span>
        </div>
        <button
          className="icon-btn icon-btn-sm text-muted"
          onClick={handleDismiss}
          disabled={dismissing}
          title="Dismiss checklist"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="progress-bar progress-sm">
        <div
          className="progress-fill progress-success"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-1">
        {steps.map((step) => {
          const isComplete = step.status === 'completed';

          return (
            <div
              key={step.id}
              className="flex items-center gap-2 py-1"
              style={{ opacity: isComplete ? 0.6 : 1 }}
            >
              {/* Status icon */}
              {isComplete ? (
                <CheckCircle size={18} className="text-success shrink-0" />
              ) : (
                <Circle size={18} className="text-muted shrink-0" />
              )}

              {/* Step icon + label */}
              <div className="flex-1 flex items-center gap-1">
                {getStepIcon(step.stepType)}
                <div>
                  <span
                    className="font-medium text-sm"
                    style={{ textDecoration: isComplete ? 'line-through' : 'none' }}
                  >
                    {step.label}
                  </span>
                  {step.description && !isComplete && (
                    <p className="text-muted text-xs mt-0\.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action */}
              {!isComplete && (
                <div className="flex gap-1 shrink-0">
                  {step.navigateTab && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleStepNavigate(step)}
                    >
                      Go <ChevronRight size={12} />
                    </button>
                  )}
                  {!step.autoDetect && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() => handleStepComplete(step.id)}
                    >
                      Done
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
