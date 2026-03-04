import * as React from 'react';
import { cn } from '@react/lib/utils';

/**
 * Status color mapping (matches portal-badges.css)
 * - active (blue): In progress, contacted, sent
 * - pending (yellow): Waiting, on-hold
 * - completed (green): Done, converted, replied, paid
 * - cancelled (red): Lost, archived, overdue
 * - qualified (purple): In review
 * - inactive (gray): Read, inactive, draft
 * - new (cyan): New items
 */

type StatusVariant =
  | 'active'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'qualified'
  | 'inactive'
  | 'new'
  | 'on-hold'
  | 'not-invited';

/** Map status variant to CSS class name */
const STATUS_CLASSES: Record<StatusVariant, string> = {
  active: 'status-active',
  pending: 'status-pending',
  completed: 'status-completed',
  cancelled: 'status-cancelled',
  qualified: 'status-qualified',
  inactive: 'status-inactive',
  new: 'status-new',
  'on-hold': 'status-on-hold',
  'not-invited': 'status-not-invited'
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Status variant determines the dot color */
  status?: StatusVariant | null;
  /** Size of the badge */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * StatusBadge
 * Displays a colored dot followed by status text
 * Uses vanilla CSS classes from shared/portal-badges.css (.status-indicator)
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status = 'inactive', size = 'md', children, ...props }, ref) => {
    const statusClass = STATUS_CLASSES[status || 'inactive'];

    return (
      <span
        ref={ref}
        className={cn('status-indicator', statusClass, className)}
        data-size={size}
        {...props}
      >
        {/* Colored dot */}
        <span className="status-dot" />
        {/* Status text */}
        <span className="status-text">{children}</span>
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

/**
 * Helper to map common status strings to badge variants
 */
export function getStatusVariant(status: string): StatusVariant {
  const statusMap: Record<string, StatusVariant> = {
    // Active states (blue)
    active: 'active',
    'in-progress': 'active',
    'in_progress': 'active',
    contacted: 'active',
    sent: 'active',
    viewed: 'active',

    // Pending states (yellow)
    pending: 'pending',
    waiting: 'pending',
    partial: 'pending',

    // Completed states (green)
    completed: 'completed',
    done: 'completed',
    converted: 'completed',
    replied: 'completed',
    paid: 'completed',
    approved: 'completed',

    // Cancelled states (red)
    cancelled: 'cancelled',
    canceled: 'cancelled',
    lost: 'cancelled',
    archived: 'cancelled',
    overdue: 'cancelled',
    rejected: 'cancelled',

    // Qualified states (purple)
    qualified: 'qualified',
    'in-review': 'qualified',
    'in_review': 'qualified',
    review: 'qualified',

    // Inactive states (gray)
    inactive: 'inactive',
    read: 'inactive',
    closed: 'inactive',
    draft: 'inactive',

    // Not invited (special)
    'not-invited': 'not-invited',
    'not_invited': 'not-invited',

    // New states (cyan)
    new: 'new',
    upcoming: 'new',

    // On-hold states (yellow/orange)
    'on-hold': 'on-hold',
    'on_hold': 'on-hold',
    blocked: 'on-hold',
    'high-priority': 'on-hold'
  };

  if (!status) return 'inactive';
  return statusMap[status.toLowerCase()] || 'inactive';
}

export type { StatusVariant };
