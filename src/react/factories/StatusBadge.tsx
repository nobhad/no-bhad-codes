/**
 * ===============================================
 * STATUS BADGE (REACT FACTORY)
 * ===============================================
 * @file src/react/factories/StatusBadge.tsx
 *
 * React component for rendering status badges.
 * Uses the factory system for consistent styling.
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';
import {
  BADGE_VARIANTS,
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
} from '../../factories/components/badge-factory';
import type { BadgeVariant } from '../../factories/types';

// ============================================
// STATUS BADGE COMPONENT
// ============================================

interface StatusBadgeProps {
  /** Status value */
  status: string;
  /** Custom label (overrides auto-formatted label) */
  label?: string;
  /** Children (alternative to label) */
  children?: React.ReactNode;
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Display label in uppercase */
  uppercase?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * StatusBadge - Consistent status badge using factory system.
 *
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="pending" label="Awaiting Approval" />
 * <StatusBadge status={user.status} size="sm" />
 */
export function StatusBadge({
  status,
  label,
  children,
  size = 'md',
  uppercase = false,
  className
}: StatusBadgeProps) {
  const cssClass = getStatusClass(status);
  let displayLabel = children ?? label ?? getDefaultLabel(status);

  if (typeof displayLabel === 'string' && uppercase) {
    displayLabel = displayLabel.toUpperCase();
  }

  return (
    <span
      className={cn(
        'status-badge',
        `status-${cssClass}`,
        size !== 'md' && `status-badge--${size}`,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}

// ============================================
// STATUS DOT COMPONENT
// ============================================

interface StatusDotProps {
  /** Status value */
  status: string;
  /** Custom label (overrides auto-formatted label) */
  label?: string;
  /** Display label in uppercase */
  uppercase?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * StatusDot - Status indicator with colored dot.
 *
 * @example
 * <StatusDot status="active" />
 * <StatusDot status="pending" label="Awaiting Review" uppercase />
 */
export function StatusDot({
  status,
  label,
  uppercase = false,
  className
}: StatusDotProps) {
  const cssClass = getStatusClass(status);
  let displayLabel = label ?? getDefaultLabel(status);

  if (uppercase) {
    displayLabel = displayLabel.toUpperCase();
  }

  return (
    <span className={cn('status-indicator', `status-${cssClass}`, className)}>
      <span className="status-dot" />
      <span className="status-text">{displayLabel}</span>
    </span>
  );
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the status variant for a given status value.
 * Used for mapping raw status values to badge variants.
 */
export function getStatusVariant(status: string): string {
  return getStatusClass(status);
}

// ============================================
// EXPORTS
// ============================================

export {
  BADGE_VARIANTS,
  normalizeStatus,
  formatStatusLabel,
  getStatusClass,
  getDefaultLabel
};
