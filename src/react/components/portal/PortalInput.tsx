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
      <div className="form-field">
        {label && (
          <label htmlFor={inputId} className="field-label">
            {label}
            {required && <span className="form-required">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn('form-input', error && 'form-input-error', className)}
          {...props}
        />
        {error && <span className="form-error-message">{error}</span>}
        {helperText && !error && (
          <span className="form-helper-text">{helperText}</span>
        )}
      </div>
    );
  }
);

PortalInput.displayName = 'PortalInput';
