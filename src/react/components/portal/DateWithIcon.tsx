/**
 * ===============================================
 * DATE WITH ICON
 * ===============================================
 * @file src/react/components/portal/DateWithIcon.tsx
 *
 * Shared component for displaying a calendar icon next to a formatted date.
 * Replaces repeated inline Calendar + formatDate patterns across portal.
 */

import * as React from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '@react/utils/formatDate';

// ============================================
// TYPES
// ============================================

interface DateWithIconProps {
  /** ISO date string or display-ready date string */
  date: string | null | undefined;
  /** Optional prefix text (e.g., "Due", "Completed") */
  prefix?: string;
  /** CSS class for the wrapper */
  className?: string;
  /** CSS class for the icon (default: icon-xs) */
  iconClassName?: string;
}

// ============================================
// COMPONENT
// ============================================

export function DateWithIcon({
  date,
  prefix,
  className = 'cell-with-icon text-muted',
  iconClassName = 'icon-xs'
}: DateWithIconProps) {
  if (!date) return null;

  return (
    <span className={className}>
      <Calendar className={iconClassName} />
      {prefix && <span>{prefix}</span>}
      <span>{formatDate(date)}</span>
    </span>
  );
}
