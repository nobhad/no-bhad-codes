import * as React from 'react';
import { cn } from '@react/lib/utils';
import { useStaggerChildren } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';

/**
 * PortalTable
 * Generic table component shared across admin and client portals.
 * Uses CSS classes from portal-tables.css for styling.
 * Formerly "AdminTable" — renamed to PortalTable since it is used across both admin and client portals.
 */

interface PortalTableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Enable row hover effects */
  hoverable?: boolean;
  /** Compact row height */
  compact?: boolean;
  /** Enable GSAP stagger animation for rows */
  animateRows?: boolean;
}

const PortalTable = React.forwardRef<HTMLTableElement, PortalTableProps>(
  ({ className, ...props }, ref) => {
    return (
      <table
        ref={ref}
        className={cn('data-table', className)}
        {...props}
      />
    );
  }
);
PortalTable.displayName = 'PortalTable';

const PortalTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={className} {...props} />
));
PortalTableHeader.displayName = 'PortalTableHeader';

interface PortalTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Enable GSAP stagger animation */
  animate?: boolean;
}

const PortalTableBody = React.forwardRef<HTMLTableSectionElement, PortalTableBodyProps>(
  ({ className, animate = false, ...props }, ref) => {
    const animationRef = useStaggerChildren<HTMLTableSectionElement>(GSAP.STAGGER_DEFAULT, GSAP.STAGGER_DELAY_SHORT);
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
PortalTableBody.displayName = 'PortalTableBody';

const PortalTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={className} {...props} />
));
PortalTableFooter.displayName = 'PortalTableFooter';

interface PortalTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Whether row is selected */
  selected?: boolean;
  /** Whether row is clickable */
  clickable?: boolean;
}

const PortalTableRow = React.memo(React.forwardRef<HTMLTableRowElement, PortalTableRowProps>(
  ({ className, selected, clickable = false, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(clickable && 'clickable', className)}
      data-selected={selected ? 'true' : undefined}
      {...props}
    />
  )
));
PortalTableRow.displayName = 'PortalTableRow';

interface PortalTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Sortable column - shows sort indicator */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc' | null;
}

const PortalTableHead = React.memo(React.forwardRef<HTMLTableCellElement, PortalTableHeadProps>(
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
));
PortalTableHead.displayName = 'PortalTableHead';

interface PortalTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Label shown in mobile card layout via data-label attribute */
  label?: string;
}

const PortalTableCell = React.memo(React.forwardRef<HTMLTableCellElement, PortalTableCellProps>(
  ({ className, label, ...props }, ref) => (
    <td ref={ref} className={className} data-label={label || undefined} {...props} />
  )
));
PortalTableCell.displayName = 'PortalTableCell';

const PortalTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={className} {...props} />
));
PortalTableCaption.displayName = 'PortalTableCaption';

/**
 * Empty state for tables — uses standardized .empty-state class
 */
interface PortalTableEmptyProps {
  /** Number of columns to span */
  colSpan: number;
  /** Icon to display (SVG) — if omitted, default icon shown via CSS */
  icon?: React.ReactNode;
  /** Message to display */
  message?: string;
}

const PortalTableEmpty = React.memo(function PortalTableEmpty({
  colSpan,
  icon,
  message = 'No data available'
}: PortalTableEmptyProps) {
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
});

/**
 * Loading state for tables — uses standardized .loading-state class
 */
interface PortalTableLoadingProps {
  /** Number of columns to span */
  colSpan: number;
  /** Number of skeleton rows to show (default: 1, shows spinner) */
  rows?: number;
  /** Message to display (only shown when rows=1) */
  message?: string;
}

function PortalTableLoading({ colSpan, rows = 1, message = 'Loading...' }: PortalTableLoadingProps) {
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

  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`skeleton-${i}`} className="skeleton-row">
          <td colSpan={colSpan}>
            <div className="skeleton-bar" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Error state for tables — uses standardized .error-state class
 */
interface PortalTableErrorProps {
  /** Number of columns to span */
  colSpan: number;
  /** Error message to display */
  message?: string;
  /** Retry callback */
  onRetry?: () => void;
}

function PortalTableError({
  colSpan,
  message = 'Failed to load data',
  onRetry
}: PortalTableErrorProps) {
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
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableFooter,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableCaption,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
};
