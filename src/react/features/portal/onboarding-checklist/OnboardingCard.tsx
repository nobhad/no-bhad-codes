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
    <div className="portal-card onboarding-card" style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0' }}>Getting Started</h3>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            {progress.completed} of {progress.total} steps completed
          </span>
        </div>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          title="Dismiss checklist"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            color: 'var(--app-color-text-muted)'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: 'var(--app-color-border)',
        overflow: 'hidden',
        margin: '0.75rem 0'
      }}>
        <div style={{
          height: '100%',
          width: `${progress.percentage}%`,
          backgroundColor: 'var(--app-color-success)',
          borderRadius: 3,
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {steps.map((step) => {
          const isComplete = step.status === 'completed';

          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0',
                opacity: isComplete ? 0.6 : 1
              }}
            >
              {/* Status icon */}
              {isComplete ? (
                <CheckCircle size={18} style={{ color: 'var(--app-color-success)', flexShrink: 0 }} />
              ) : (
                <Circle size={18} style={{ color: 'var(--app-color-text-muted)', flexShrink: 0 }} />
              )}

              {/* Step icon + label */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getStepIcon(step.stepType)}
                <div>
                  <span style={{
                    fontWeight: 500,
                    textDecoration: isComplete ? 'line-through' : 'none',
                    fontSize: '0.9rem'
                  }}>
                    {step.label}
                  </span>
                  {step.description && !isComplete && (
                    <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.1rem 0 0' }}>
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action */}
              {!isComplete && (
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {step.navigateTab && (
                    <button
                      className="btn-secondary"
                      onClick={() => handleStepNavigate(step)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      Go <ChevronRight size={12} />
                    </button>
                  )}
                  {!step.autoDetect && (
                    <button
                      className="btn-secondary"
                      onClick={() => handleStepComplete(step.id)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
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
