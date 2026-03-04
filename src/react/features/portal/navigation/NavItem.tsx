/**
 * NavItem Component
 * Individual navigation item for the portal sidebar
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@react/lib/utils';

export interface NavItemProps {
  /** Unique identifier for the nav item */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Whether this item is currently active */
  isActive: boolean;
  /** Optional badge count (e.g., unread messages) */
  badge?: number;
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Click handler */
  onClick: () => void;
}

export function NavItem({
  id,
  label,
  icon: Icon,
  isActive,
  badge,
  isCollapsed = false,
  onClick
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'tw-w-full tw-flex tw-items-center tw-gap-2 tw-px-3 tw-py-2',
        'tw-text-[14px] tw-font-mono tw-transition-colors tw-cursor-pointer',
        'tw-border-none tw-bg-transparent',
        isActive
          ? 'tw-text-primary tw-border-l-2 tw-border-l-primary'
          : 'tw-text-[var(--portal-text-muted)] hover:tw-text-primary',
        isCollapsed && 'tw-justify-center tw-px-2'
      )}
      title={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      data-nav-id={id}
    >
      <Icon
        className={cn(
          'icon-sm tw-flex-shrink-0',
          isActive && 'tw-text-primary'
        )}
      />
      {!isCollapsed && (
        <>
          <span className="tw-flex-1 tw-text-left tw-truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="tw-badge">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
      {isCollapsed && badge !== undefined && badge > 0 && (
        <span
          className={cn(
            'tw-absolute tw-top-1 tw-right-1',
            'tw-w-2 tw-h-2',
            'tw-bg-primary'
          )}
        />
      )}
    </button>
  );
}

export default NavItem;
