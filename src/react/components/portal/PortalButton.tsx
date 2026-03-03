import * as React from 'react';
import { cn } from '@react/lib/utils';

export interface PortalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  /** Button size */
  size?: 'sm' | 'md' | 'lg' | 'icon';
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
  /** Icon to display before text */
  icon?: React.ReactNode;
}

/**
 * PortalButton
 * Button component matching the portal design system
 * Uses CSS classes from portal styles
 */
export const PortalButton = React.forwardRef<HTMLButtonElement, PortalButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    // Build class list based on variant and size
    const variantClasses: Record<string, string> = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      danger: 'btn-danger',
      ghost: 'btn-ghost',
      icon: 'btn-icon',
    };

    const sizeClasses: Record<string, string> = {
      sm: 'tw-text-sm tw-py-1 tw-px-2',
      md: '',
      lg: 'tw-text-lg tw-py-3 tw-px-6',
      icon: '',
    };

    const baseClass = variantClasses[variant] || 'btn-primary';
    const sizeClass = sizeClasses[size] || '';

    return (
      <button
        ref={ref}
        className={cn(baseClass, sizeClass, className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="btn-icon loading-spinner" aria-label="Loading">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              width="16"
              height="16"
            >
              <circle
                opacity="0.25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                opacity="0.75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        ) : icon ? (
          <span className="btn-icon">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

PortalButton.displayName = 'PortalButton';
