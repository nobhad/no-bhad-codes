/**
 * Questionnaire step — links to the questionnaire with a button.
 */

import * as React from 'react';
import { Check, ClipboardList, ExternalLink } from 'lucide-react';

interface QuestionnaireStepProps {
  entityId: number;
  entityData?: Record<string, unknown>;
  onComplete: () => void;
}

export const QuestionnaireStep = React.memo(({
  entityId: _entityId,
  entityData,
  onComplete
}: QuestionnaireStepProps) => {
  const status = entityData?.status as string | undefined;
  const isComplete = status === 'completed' || status === 'submitted';
  const name = entityData?.name as string | undefined;

  if (isComplete) {
    return (
      <div className="agreement-step-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--app-color-success)' }}>
          <Check size={20} />
          <span>Questionnaire completed</span>
        </div>
      </div>
    );
  }

  return (
    <div className="agreement-step-content">
      <h3>{name || 'Project Questionnaire'}</h3>
      <p className="text-muted">Help us understand your vision and requirements.</p>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <a
          href={'#/requests-hub'}
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
        >
          <ClipboardList size={16} /> Open Questionnaire <ExternalLink size={14} />
        </a>
        <button className="btn-secondary" onClick={onComplete}>
          Mark as Done
        </button>
      </div>
    </div>
  );
});
