/**
 * PortalHeader Component
 * Header with user info and logout for the portal sidebar
 * Portal design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@react/lib/utils';

export interface PortalHeaderProps {
  /** User information */
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  /** Whether the sidebar is collapsed */
  isCollapsed?: boolean;
  /** Toggle collapse callback */
  onToggleCollapse?: () => void;
  /** Logout callback */
  onLogout?: () => void;
}

/**
 * Get user initials from name
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PortalHeader({
  user,
  isCollapsed = false,
  onToggleCollapse,
  onLogout,
}: PortalHeaderProps) {
  const initials = user?.name ? getInitials(user.name) : '?';

  return (
    <div
      className={cn(
        'tw-flex tw-items-center tw-gap-2 tw-p-3',
        'tw-border-b tw-border-[var(--portal-border-color)]',
        'tw-bg-transparent',
        isCollapsed ? 'tw-flex-col' : 'tw-justify-between'
      )}
    >
      {/* User Info */}
      <div
        className={cn(
          'tw-flex tw-items-center tw-gap-2',
          isCollapsed && 'tw-flex-col'
        )}
      >
        {/* Avatar - square with border */}
        <div
          className={cn(
            'tw-flex-shrink-0 tw-flex tw-items-center tw-justify-center',
            'tw-border tw-border-white tw-bg-transparent',
            'tw-text-white tw-font-bold tw-font-mono',
            isCollapsed ? 'tw-w-8 tw-h-8 tw-text-[11px]' : 'tw-w-9 tw-h-9 tw-text-[12px]'
          )}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="tw-w-full tw-h-full tw-object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Name and Email */}
        {!isCollapsed && user && (
          <div className="tw-flex-1 tw-min-w-0">
            <p className="tw-text-[12px] tw-font-bold tw-text-white tw-truncate tw-font-mono">
              {user.name}
            </p>
            <p className="tw-text-[10px] tw-text-[var(--portal-text-muted)] tw-truncate tw-font-mono">
              {user.email}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className={cn(
          'tw-flex tw-items-center tw-gap-1',
          isCollapsed && 'tw-flex-col tw-mt-2'
        )}
      >
        {/* Collapse Toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="tw-btn-icon"
          >
            {isCollapsed ? (
              <ChevronRight className="tw-h-4 tw-w-4" />
            ) : (
              <ChevronLeft className="tw-h-4 tw-w-4" />
            )}
          </button>
        )}

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Sign out"
            className="tw-btn-icon"
          >
            <LogOut className="tw-h-4 tw-w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default PortalHeader;
