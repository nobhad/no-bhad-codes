import * as React from 'react';
import { cn } from '@react/lib/utils';
import { useStaggerChildren } from '@react/hooks/useGsap';

/**
 * AdminTable
 * Table component matching the admin dashboard design system
 * Uses CSS classes from portal-tables.css for styling
 */

interface AdminTableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Enable row hover effects */
  hoverable?: boolean;
  /** Compact row height */
  compact?: boolean;
  /** Enable GSAP stagger animation for rows */
  animateRows?: boolean;
}

const AdminTable = React.forwardRef<HTMLTableElement, AdminTableProps>(
  ({ className, hoverable = true, compact = false, animateRows = false, ...props }, ref) => {
    return (
      <table
        ref={ref}
        className={cn('data-table', className)}
        {...props}
      />
    );
  }
);
AdminTable.displayName = 'AdminTable';

const AdminTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={className} {...props} />
));
AdminTableHeader.displayName = 'AdminTableHeader';

interface AdminTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Enable GSAP stagger animation */
  animate?: boolean;
}

const AdminTableBody = React.forwardRef<HTMLTableSectionElement, AdminTableBodyProps>(
  ({ className, animate = false, ...props }, ref) => {
    const animationRef = useStaggerChildren<HTMLTableSectionElement>(0.05, 0.1);
    const combinedRef = animate ? animationRef : ref;

    return (
      <tbody
        ref={combinedRef as React.Ref<HTMLTableSectionElement>}
        className={className}
        {...props}
      />
    );
  }
);
AdminTableBody.displayName = 'AdminTableBody';

const AdminTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={className} {...props} />
));
AdminTableFooter.displayName = 'AdminTableFooter';

interface AdminTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Whether row is selected */
  selected?: boolean;
  /** Whether row is clickable */
  clickable?: boolean;
}

const AdminTableRow = React.forwardRef<HTMLTableRowElement, AdminTableRowProps>(
  ({ className, selected, clickable = false, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(clickable && 'clickable', className)}
      data-selected={selected ? 'true' : undefined}
      {...props}
    />
  )
);
AdminTableRow.displayName = 'AdminTableRow';

interface AdminTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Sortable column - shows sort indicator */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc' | null;
}

const AdminTableHead = React.forwardRef<HTMLTableCellElement, AdminTableHeadProps>(
  ({ className, sortable, sortDirection, children, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        sortable && 'sortable',
        className
      )}
      aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : undefined}
      {...props}
    >
      {sortable ? (
        <button type="button" className="sort-header-btn">
          <span>{children}</span>
          {sortDirection && (
            <span className="sort-indicator" aria-hidden="true">
              {sortDirection === 'asc' ? '\u2191' : '\u2193'}
            </span>
          )}
        </button>
      ) : (
        children
      )}
    </th>
  )
);
AdminTableHead.displayName = 'AdminTableHead';

const AdminTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={className} {...props} />
));
AdminTableCell.displayName = 'AdminTableCell';

const AdminTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={className} {...props} />
));
AdminTableCaption.displayName = 'AdminTableCaption';

/**
 * Empty state for tables - uses standardized .empty-state class
 */
interface AdminTableEmptyProps {
  /** Number of columns to span */
  colSpan: number;
  /** Icon to display (SVG) - if omitted, default icon shown via CSS */
  icon?: React.ReactNode;
  /** Message to display */
  message?: string;
}

function AdminTableEmpty({
  colSpan,
  icon,
  message = 'No data available',
}: AdminTableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="empty-state">
          {icon}
          <span>{message}</span>
        </div>
      </td>
    </tr>
  );
}

/**
 * Loading state for tables - uses standardized .loading-state class
 */
interface AdminTableLoadingProps {
  /** Number of columns to span */
  colSpan: number;
  /** Number of skeleton rows to show (default: 1, shows spinner) */
  rows?: number;
  /** Message to display (only shown when rows=1) */
  message?: string;
}

function AdminTableLoading({ colSpan, rows = 1, message = 'Loading...' }: AdminTableLoadingProps) {
  // Single row with spinner
  if (rows <= 1) {
    return (
      <tr>
        <td colSpan={colSpan}>
          <div className="loading-state">
            <span>{message}</span>
          </div>
        </td>
      </tr>
    );
  }

  // Multiple skeleton rows
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="skeleton-row">
          <td colSpan={colSpan}>
            <div className="skeleton-bar" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Error state for tables - uses standardized .error-state class
 */
interface AdminTableErrorProps {
  /** Number of columns to span */
  colSpan: number;
  /** Error message to display */
  message?: string;
  /** Retry callback */
  onRetry?: () => void;
}

function AdminTableError({
  colSpan,
  message = 'Failed to load data',
  onRetry,
}: AdminTableErrorProps) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="error-state">
          <span>{message}</span>
          {onRetry && (
            <button type="button" className="btn-primary" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableFooter,
  AdminTableHead,
  AdminTableRow,
  AdminTableCell,
  AdminTableCaption,
  AdminTableEmpty,
  AdminTableLoading,
  AdminTableError,
};
