import * as React from 'react';
import { cn } from '@react/lib/utils';

/**
 * TableLayout
 * Unified wrapper for all admin tables ensuring consistent structure.
 *
 * Structure:
 * - data-table-card (outer container)
 *   - data-table-header (title + stats + actions)
 *   - data-table-container (scrollable table wrapper)
 *   - table-pagination (if provided)
 */

export interface TableLayoutProps {
  /** Table title displayed in header */
  title: string;
  /** Optional stats to display next to title */
  stats?: React.ReactNode;
  /** Action buttons (search, filter, export, add) */
  actions?: React.ReactNode;
  /** The PortalTable component */
  children: React.ReactNode;
  /** Pagination component */
  pagination?: React.ReactNode;
  /** Bulk actions toolbar (shown above table when items selected) */
  bulkActions?: React.ReactNode;
  /** Additional className for outer container */
  className?: string;
  /** Ref for the outer container (for animations) */
  containerRef?: React.Ref<HTMLDivElement>;
}

export function TableLayout({
  title,
  stats,
  actions,
  children,
  pagination,
  bulkActions,
  className,
  containerRef
}: TableLayoutProps) {
  return (
    <div ref={containerRef} className={cn('table-layout', className)}>
      <div className="data-table-card">
        {/* Table Header */}
        <div className="data-table-header">
          <h3>
            <span className="title-full">{title}</span>
            <span className="title-mobile">{title}</span>
          </h3>
          {stats}
          {actions && (
            <div className="data-table-actions">
              {actions}
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {bulkActions}

        {/* Table Container */}
        <div className="data-table-container">
          <div className="data-table-scroll-wrapper">
            {children}
          </div>
        </div>

        {/* Pagination */}
        {pagination}
      </div>
    </div>
  );
}

/**
 * TableStats
 * Inline stats display for table headers.
 * Shows total count and optional status breakdowns.
 */
export interface StatItem {
  value: number | string;
  label?: string;
  variant?: 'default' | 'pending' | 'active' | 'completed' | 'overdue' | 'cancelled';
}

export interface TableStatsProps {
  items: StatItem[];
  /** Tooltip text on hover */
  tooltip?: string;
}

export const TableStats = React.memo(({ items, tooltip }: TableStatsProps) => {
  const visibleItems = items.filter(item => {
    if (!item.variant || item.variant === 'default') return true;
    return typeof item.value === 'number' ? item.value > 0 : item.value !== '0';
  });

  return (
    <div className="stats-summary" title={tooltip}>
      {visibleItems.map((item) => (
        <span
          key={`${item.value}-${item.label ?? ''}`}
          className={cn(
            'stats-summary-item',
            item.variant && `stats-${item.variant}`
          )}
        >
          {item.value}
          {item.label && ` ${item.label}`}
        </span>
      ))}
    </div>
  );
});

/**
 * TableActions
 * Container for table action buttons with consistent spacing.
 */
export interface TableActionsProps {
  children: React.ReactNode;
}

export function TableActions({ children }: TableActionsProps) {
  return <div className="data-table-actions">{children}</div>;
}

export default TableLayout;
