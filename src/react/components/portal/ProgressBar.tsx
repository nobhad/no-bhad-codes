import * as React from 'react';

export interface ProgressBarProps {
  value: number;
  label?: string;
  showPercent?: boolean;
  /** Extra info shown after the percent (e.g. "(2/5 tasks)") */
  detail?: string;
}

const PROGRESS_MAX = 100;

/**
 * ProgressBar
 * Reusable progress bar using the portal's .progress-bar-sm / .progress-fill pattern.
 * Used consistently across admin and client portal.
 */
export function ProgressBar({ value, label = 'Progress', showPercent = true, detail }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), PROGRESS_MAX);
  const hasHeader = label !== '' || showPercent || !!detail;

  return (
    <div className="progress-field">
      {hasHeader && (
        <div className="progress-field-header">
          <span className="field-label">{label}</span>
          {(showPercent || detail) && (
            <span className="text-secondary">
              {showPercent ? `${clamped}%` : ''}{detail ? ` ${detail}` : ''}
            </span>
          )}
        </div>
      )}
      <div className="progress-bar-sm">
        <div
          className="progress-fill"
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={PROGRESS_MAX}
          aria-label={`${label || 'Progress'}: ${clamped}%`}
        />
      </div>
    </div>
  );
}
