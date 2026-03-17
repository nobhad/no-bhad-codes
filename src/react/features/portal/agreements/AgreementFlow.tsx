/**
 * ===============================================
 * AGREEMENT FLOW
 * ===============================================
 * @file src/react/features/portal/agreements/AgreementFlow.tsx
 *
 * Vertical card stack layout for the unified agreement flow.
 * Active step is expanded, completed steps show summary, future steps are locked.
 * Uses GSAP for step transitions.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { gsap } from 'gsap';
import { Check, Lock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { usePortalData } from '../../../hooks/usePortalFetch';
import { usePortalFetch } from '../../../hooks/usePortalFetch';
import { buildEndpoint } from '../../../../constants/api-endpoints';
import { AgreementHeader } from './AgreementHeader';
import { CustomMessageStep } from './steps/CustomMessageStep';
import { ProposalReviewStep } from './steps/ProposalReviewStep';
import { ContractSignStep } from './steps/ContractSignStep';
import { DepositPaymentStep } from './steps/DepositPaymentStep';
import { QuestionnaireStep } from './steps/QuestionnaireStep';
import { STEP_TYPE_LABELS } from './types';
import type { Agreement, AgreementStep, AgreementFlowProps, StepType } from './types';

const STEP_TRANSITION_DURATION = 0.35;

export function AgreementFlow({
  agreementId,
  getAuthToken,
  showNotification,
  onComplete: _onComplete
}: AgreementFlowProps) {
  const { data, isLoading, error, refetch } = usePortalData<{ agreement: Agreement }>({
    getAuthToken,
    url: buildEndpoint.agreement(agreementId),
    transform: (raw) => raw as { agreement: Agreement }
  });

  const { portalFetch } = usePortalFetch({ getAuthToken });
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const agreement = data?.agreement;

  // Record view on mount
  useEffect(() => {
    if (agreement) {
      portalFetch(buildEndpoint.agreementView(agreementId), { method: 'POST' }).catch(() => {});
    }
  }, [agreement, agreementId, portalFetch]);

  // Auto-expand the current active step
  useEffect(() => {
    if (!agreement) return;
    const activeStep = agreement.steps.find(
      (s) => s.status === 'active' || (s.status === 'pending' && s.stepOrder === agreement.currentStep)
    );
    if (activeStep) {
      setExpandedStep(activeStep.id);
    }
  }, [agreement]);

  // GSAP animation when expanded step changes
  useEffect(() => {
    if (expandedStep === null) return;
    const el = stepRefs.current.get(expandedStep);
    if (el) {
      gsap.from(el.querySelector('.agreement-step__body'), {
        height: 0,
        opacity: 0,
        duration: STEP_TRANSITION_DURATION,
        ease: 'power2.out'
      });
    }
  }, [expandedStep]);

  const handleStepComplete = useCallback(async (step: AgreementStep) => {
    try {
      await portalFetch(buildEndpoint.agreementStepComplete(step.id), {
        method: 'POST',
        body: { agreementId }
      });
      showNotification?.('Step completed!', 'success');
      refetch();
    } catch {
      showNotification?.('Failed to complete step', 'error');
    }
  }, [agreementId, portalFetch, showNotification, refetch]);

  const handleToggleStep = useCallback((stepId: number) => {
    setExpandedStep((prev) => (prev === stepId ? null : stepId));
  }, []);

  if (isLoading) {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
        <p className="text-muted" style={{ marginTop: '1rem' }}>Loading agreement...</p>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="portal-card">
        <p className="form-error-message">{error || 'Agreement not found'}</p>
      </div>
    );
  }

  if (agreement.status === 'completed') {
    return (
      <div className="portal-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <Check size={48} style={{ color: 'var(--app-color-success)', margin: '0 auto' }} />
        <h3 style={{ marginTop: '1rem' }}>Agreement Complete</h3>
        <p className="text-muted">All steps have been completed. Your project is ready to begin!</p>
      </div>
    );
  }

  return (
    <div className="agreement-flow">
      <AgreementHeader
        title={agreement.name}
        steps={agreement.steps}
        currentStepOrder={agreement.currentStep}
      />

      <div className="agreement-steps" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
        {agreement.steps.map((step) => {
          const isExpanded = expandedStep === step.id;
          const isCompleted = step.status === 'completed';
          const isLocked = step.status === 'pending' && step.stepOrder > agreement.currentStep;
          const label = STEP_TYPE_LABELS[step.stepType as StepType] || step.customTitle || step.stepType;

          return (
            <div
              key={step.id}
              ref={(el) => { if (el) stepRefs.current.set(step.id, el); }}
              className={`portal-card agreement-step ${isCompleted ? 'agreement-step--completed' : ''} ${isLocked ? 'agreement-step--locked' : ''}`}
              style={{ opacity: isLocked ? 0.5 : 1 }}
            >
              {/* Step header */}
              <button
                className="agreement-step__header"
                onClick={() => !isLocked && handleToggleStep(step.id)}
                disabled={isLocked}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '0.75rem 0',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isCompleted ? (
                    <Check size={18} style={{ color: 'var(--app-color-success)' }} />
                  ) : isLocked ? (
                    <Lock size={18} style={{ color: 'var(--app-color-text-muted)' }} />
                  ) : (
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '2px solid var(--app-color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: 'var(--app-color-primary)'
                    }}>
                      {step.stepOrder + 1}
                    </div>
                  )}
                  <span style={{ fontWeight: 500 }}>{label}</span>
                </div>

                {!isLocked && (
                  isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                )}
              </button>

              {/* Step body */}
              {isExpanded && !isLocked && (
                <div className="agreement-step__body" style={{ paddingBottom: '0.75rem' }}>
                  {renderStepContent(step, () => handleStepComplete(step), getAuthToken)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Render the correct step component based on step type.
 */
function renderStepContent(
  step: AgreementStep,
  onComplete: () => void,
  getAuthToken?: () => string | null
): React.ReactNode {
  switch (step.stepType) {
  case 'welcome':
  case 'custom_message':
    return (
      <CustomMessageStep
        title={step.customTitle || 'Welcome'}
        content={step.customContent || ''}
        onComplete={onComplete}
      />
    );

  case 'proposal_review':
    return step.entityId ? (
      <ProposalReviewStep
        entityId={step.entityId}
        entityData={step.entityData}
        onComplete={onComplete}
        getAuthToken={getAuthToken}
      />
    ) : null;

  case 'contract_sign':
    return step.entityId ? (
      <ContractSignStep
        entityId={step.entityId}
        entityData={step.entityData}
        onComplete={onComplete}
        getAuthToken={getAuthToken}
      />
    ) : null;

  case 'deposit_payment':
    return step.entityId ? (
      <DepositPaymentStep
        entityId={step.entityId}
        entityData={step.entityData}
        onComplete={onComplete}
        getAuthToken={getAuthToken}
      />
    ) : null;

  case 'questionnaire':
    return (
      <QuestionnaireStep
        entityId={step.entityId || 0}
        entityData={step.entityData}
        onComplete={onComplete}
      />
    );

  default:
    return <p className="text-muted">Unknown step type</p>;
  }
}
