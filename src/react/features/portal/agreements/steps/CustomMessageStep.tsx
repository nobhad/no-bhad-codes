/**
 * Custom message / welcome step — text + "Continue" button.
 */

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

interface CustomMessageStepProps {
  title: string;
  content: string;
  onComplete: () => void;
}

export const CustomMessageStep = React.memo(({
  title,
  content,
  onComplete
}: CustomMessageStepProps) => {
  return (
    <div className="agreement-step-content">
      <h3>{title}</h3>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{content}</p>
      <button className="btn-primary" onClick={onComplete} style={{ marginTop: '1rem' }}>
        Continue <ArrowRight size={16} />
      </button>
    </div>
  );
});
