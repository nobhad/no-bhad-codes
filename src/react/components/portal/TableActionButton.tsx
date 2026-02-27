import * as React from 'react';
import { cn } from '@react/lib/utils';

/**
 * TABLE ACTION BUTTON - Standardized icon button for table actions
 * @file src/react/components/portal/TableActionButton.tsx
 *
 * Ensures consistent 28x28px buttons with 16x16px icons across ALL tables.
 * Use this component instead of raw <button className="icon-btn"> in tables.
 *
 * @example
 * <TableActionButton
 *   icon={<Eye />}
 *   onClick={() => handleView(id)}
 *   title="View"
 *   ariaLabel="View item"
 * />
 */

/** Standard icon size for table actions (matches portal-buttons.css) */
const TABLE_ICON_SIZE = 16;

interface TableActionButtonProps {
  /** Lucide icon element - will be cloned with size prop */
  icon: React.ReactElement;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Button title (tooltip) */
  title: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional className (e.g., 'icon-btn-danger') */
  className?: string;
  /** Data attributes for JS targeting */
  dataAction?: string;
  /** Data ID for the row */
  dataId?: string | number;
}

/**
 * TableActionButton - Consistent action button for table rows
 *
 * Automatically applies size={16} to the Lucide icon to ensure
 * consistent 16x16px icons across all tables.
 */
export function TableActionButton({
  icon,
  onClick,
  title,
  ariaLabel,
  disabled = false,
  className,
  dataAction,
  dataId,
}: TableActionButtonProps) {
  // Clone the icon element with forced size prop
  const sizedIcon = React.cloneElement(icon, {
    size: TABLE_ICON_SIZE,
    'aria-hidden': true,
  } as React.Attributes & { size: number; 'aria-hidden': boolean });

  return (
    <button
      type="button"
      className={cn('icon-btn', className)}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
      data-action={dataAction}
      data-id={dataId}
    >
      {sizedIcon}
    </button>
  );
}

/**
 * TableActions - Wrapper for table action buttons
 * Provides consistent flex layout with 4px gap
 */
interface TableActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function TableActions({ children, className }: TableActionsProps) {
  return (
    <div className={cn('table-actions', className)}>
      {children}
    </div>
  );
}
