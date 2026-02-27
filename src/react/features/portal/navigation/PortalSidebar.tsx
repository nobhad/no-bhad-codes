/**
 * PortalSidebar Component
 * Main sidebar navigation component for the client portal
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  MessageSquare,
  Receipt,
  ClipboardList,
  CheckSquare,
  Settings,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { NavItem } from './NavItem';
import { PortalHeader } from './PortalHeader';

/**
 * Badge keys that can have counts
 */
type BadgeKey = 'messages' | 'approvals';

/**
 * Navigation item configuration
 */
interface NavItemConfig {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: BadgeKey;
}

/**
 * Navigation items configuration
 */
const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'questionnaires', label: 'Questionnaires', icon: ClipboardList },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare, badgeKey: 'approvals' },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export interface PortalNavigationProps {
  /** Currently active tab */
  activeTab: string;
  /** Navigation callback */
  onNavigate: (tab: string) => void;
  /** User information */
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  /** Badge counts for navigation items */
  badges?: {
    messages?: number;
    approvals?: number;
  };
  /** Logout callback */
  onLogout?: () => void;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** External control of collapsed state */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function PortalSidebar({
  activeTab,
  onNavigate,
  user,
  badges,
  onLogout,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: PortalNavigationProps) {
  // Use controlled or uncontrolled collapsed state
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed ?? uncontrolledCollapsed;

  const containerRef = useFadeIn<HTMLElement>();

  const handleToggleCollapse = useCallback(() => {
    const newValue = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newValue);
    } else {
      setUncontrolledCollapsed(newValue);
    }
  }, [isCollapsed, onCollapsedChange]);

  const handleNavigate = useCallback(
    (tab: string) => {
      onNavigate(tab);
    },
    [onNavigate]
  );

  return (
    <aside
      ref={containerRef}
      className={cn(
        'tw-flex tw-flex-col tw-h-full',
        'tw-bg-transparent tw-border-r tw-border-[var(--portal-border-color)]',
        'tw-transition-[width] tw-duration-200 tw-ease-out',
        isCollapsed ? 'tw-w-16' : 'tw-w-56'
      )}
    >
      {/* Header with User Info */}
      <PortalHeader
        user={user}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onLogout={onLogout}
      />

      {/* Navigation */}
      <nav className="tw-flex-1 tw-p-2 tw-space-y-0 tw-overflow-y-auto tw-scroll-container">
        {NAV_ITEMS.map((item) => {
          const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;

          return (
            <NavItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              isActive={activeTab === item.id}
              badge={badge}
              isCollapsed={isCollapsed}
              onClick={() => handleNavigate(item.id)}
            />
          );
        })}
      </nav>

      {/* Footer - Version or branding if needed */}
      {!isCollapsed && (
        <div className="tw-p-3 tw-border-t tw-border-[var(--portal-border-color)]">
          <p className="tw-section-title tw-text-center">
            Client Portal
          </p>
        </div>
      )}
    </aside>
  );
}

export default PortalSidebar;
