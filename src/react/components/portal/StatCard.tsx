/**
 * StatCard & StatsRow
 * Shared stat display components for portal views.
 * Replaces repeated raw HTML stat-card pattern across all portal views.
 */

import * as React from 'react';
import { cn } from '@react/lib/utils';

// ============================================
// STAT CARD
// ============================================

export interface StatCardProps {
  /** Label displayed above the value */
  label: string;
  /** The stat value (number or formatted string) */
  value: string | number;
  /** Visual variant for contextual emphasis */
  variant?: 'default' | 'success' | 'warning' | 'alert';
  /** Click handler — makes the card a clickable filter */
  onClick?: () => void;
  /** Whether this card is the active/selected filter */
  isActive?: boolean;
  /** Icon displayed in the header beside label */
  icon?: React.ReactNode;
  /** Secondary text displayed below value */
  meta?: string;
  /** Additional className */
  className?: string;
}

/**
 * StatCard — single stat display used inside StatsRow.
 * When onClick is provided, renders as a clickable button for filtering.
 *
 * @example
 * <StatCard label="Outstanding" value={formatCurrency(1200)} />
 * <StatCard label="New" value={5} variant="warning" onClick={() => setFilter('status', 'new')} isActive={filter === 'new'} />
 */
export function StatCard({ label, value, variant = 'default', onClick, isActive, icon, meta, className }: StatCardProps) {
  const classes = cn(
    'stat-card',
    variant !== 'default' && `stat-card--${variant}`,
    onClick && 'stat-card-clickable',
    isActive && 'active',
    className
  );

  const content = (
    <>
      {icon ? (
        <div className="stat-card-header">
          {icon}
          <span className="stat-label">{label}</span>
        </div>
      ) : (
        <span className="stat-label">{label}</span>
      )}
      <span className="stat-value">{value}</span>
      {meta && <span className="text-muted stat-meta">{meta}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}

// ============================================
// STATS ROW
// ============================================

export interface StatsRowProps {
  /** StatCard children */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * StatsRow — container for a row of StatCard components.
 *
 * @example
 * <StatsRow>
 *   <StatCard label="Total" value={10} />
 *   <StatCard label="Active" value={3} />
 * </StatsRow>
 */
export function StatsRow({ children, className }: StatsRowProps) {
  return <div className={cn('stats-grid', className)}>{children}</div>;
}
