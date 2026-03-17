/**
 * ===============================================
 * AGREEMENT HEADER
 * ===============================================
 * @file src/react/features/portal/agreements/AgreementHeader.tsx
 *
 * Title + progress dots for the agreement flow.
 */

import * as React from 'react';
import { Check, Circle, CircleDot } from 'lucide-react';
import type { AgreementStep, StepStatus } from './types';
import { STEP_TYPE_LABELS } from './types';
import type { StepType } from './types';

interface AgreementHeaderProps {
  title: string;
  steps: AgreementStep[];
  currentStepOrder: number;
}

function StepDot({ status }: { status: StepStatus }) {
  switch (status) {
  case 'completed':
    return <Check size={14} style={{ color: 'var(--app-color-success)' }} />;
  case 'active':
    return <CircleDot size={14} style={{ color: 'var(--app-color-primary)' }} />;
  default:
    return <Circle size={14} style={{ color: 'var(--app-color-text-muted)' }} />;
  }
}

export const AgreementHeader = React.memo(({
  title,
  steps,
  currentStepOrder
}: AgreementHeaderProps) => {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const total = steps.length;

  return (
    <div className="agreement-header">
      <h2 style={{ margin: 0 }}>{title}</h2>
      <div className="agreement-progress">
        <span className="text-muted" style={{ fontSize: '0.85rem' }}>
          {completed} of {total} steps completed
        </span>
        <div className="agreement-progress__dots" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
          {steps.map((step) => (
            <div
              key={step.id}
              title={STEP_TYPE_LABELS[step.stepType as StepType] || step.customTitle || step.stepType}
              style={{
                display: 'flex',
                alignItems: 'center',
                opacity: step.stepOrder === currentStepOrder ? 1 : 0.6
              }}
            >
              <StepDot status={step.status as StepStatus} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
