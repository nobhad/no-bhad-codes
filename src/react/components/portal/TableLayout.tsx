import * as React from 'react';
import { cn } from '@react/lib/utils';

/**
 * TableLayout
 * Unified wrapper for all admin tables ensuring consistent structure.
 *
 * Structure:
 * - admin-table-card (outer container)
 *   - admin-table-header (title + stats + actions)
 *   - admin-table-container (scrollable table wrapper)
 *   - table-pagination (if provided)
 */

export interface TableLayoutProps {
  /** Table title displayed in header */
  title: string;
  /** Optional stats to display next to title */
  stats?: React.ReactNode;
  /** Action buttons (search, filter, export, add) */
  actions?: React.ReactNode;
  /** The AdminTable component */
  children: React.ReactNode;
  /** Pagination component */
  pagination?: React.ReactNode;
  /** Bulk actions toolbar (shown above table when items selected) */
  bulkActions?: React.ReactNode;
  /** Error state */
  error?: React.ReactNode;
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
  error,
  className,
  containerRef,
}: TableLayoutProps) {
  return (
    <div ref={containerRef} className={cn(className)}>
      <div className="admin-table-card">
        {/* Table Header */}
        <div className="admin-table-header">
          <div className="admin-table-title-group">
            <h3>
              <span className="title-full">{title}</span>
              <span className="title-mobile">{title}</span>
            </h3>
            {stats}
          </div>
          {actions && (
            <div className="admin-table-actions">
              {actions}
            </div>
          )}
        </div>

        {/* Error State */}
        {error}

        {/* Bulk Actions */}
        {bulkActions}

        {/* Table Container */}
        <div className="admin-table-container">
          <div className="admin-table-scroll-wrapper">
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
  /** Only show if value > 0 */
  hideIfZero?: boolean;
}

export interface TableStatsProps {
  items: StatItem[];
  /** Tooltip text on hover */
  tooltip?: string;
}

export function TableStats({ items, tooltip }: TableStatsProps) {
  const visibleItems = items.filter(item => {
    if (!item.hideIfZero) return true;
    return typeof item.value === 'number' ? item.value > 0 : item.value !== '0';
  });

  return (
    <div className="stats-summary" title={tooltip}>
      {visibleItems.map((item, index) => (
        <span
          key={index}
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
}

/**
 * TableActions
 * Container for table action buttons with consistent spacing.
 */
export interface TableActionsProps {
  children: React.ReactNode;
}

export function TableActions({ children }: TableActionsProps) {
  return <div className="admin-table-actions">{children}</div>;
}

export default TableLayout;
