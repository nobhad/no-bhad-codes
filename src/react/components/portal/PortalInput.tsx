import * as React from 'react';
import { cn } from '@react/lib/utils';

export interface PortalInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
}

/**
 * PortalInput
 * Styled input for portal forms
 */
export const PortalInput = React.forwardRef<HTMLInputElement, PortalInputProps>(
  ({ className, label, error, helperText, id, required, ...props }, ref) => {
    const inputId = id || `input-${React.useId()}`;

    return (
      <div className="tw-flex tw-flex-col tw-gap-1">
        {label && (
          <label htmlFor={inputId} className="tw-field-label">
            {label}
            {required && <span className="tw-text-white tw-ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn('tw-input', error && 'tw-border-white', className)}
          {...props}
        />
        {error && <span className="tw-text-xs tw-text-white">{error}</span>}
        {helperText && !error && (
          <span className="tw-text-xs tw-text-muted">{helperText}</span>
        )}
      </div>
    );
  }
);

PortalInput.displayName = 'PortalInput';
