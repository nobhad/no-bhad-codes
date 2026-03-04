/**
 * PortalSidebar Component
 * Main sidebar navigation component for the client portal
 * Brutalist design: transparent backgrounds, no border-radius, monospace font
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  LayoutDashboard,
  MessageCircleQuestion,
  ClipboardList,
  MessageSquare,
  Eye,
  FileText,
  HelpCircle,
  Settings,
  LogOut
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { NavItem } from './NavItem';
import { PortalHeader } from './PortalHeader';

/**
 * Badge keys that can have counts
 */
type BadgeKey = 'requests' | 'questionnaires' | 'messages' | 'documents';

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
 * Matches the HTML sidebar structure in client/index.html
 */
const NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'requests', label: 'Requests', icon: MessageCircleQuestion, badgeKey: 'requests' },
  { id: 'questionnaires', label: 'Questionnaires', icon: ClipboardList, badgeKey: 'questionnaires' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
  { id: 'preview', label: 'Review', icon: Eye },
  { id: 'files', label: 'Files', icon: FileText, badgeKey: 'documents' },
  { id: 'help', label: 'Help', icon: HelpCircle },
  { id: 'settings', label: 'Settings', icon: Settings }
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
    requests?: number;
    questionnaires?: number;
    messages?: number;
    documents?: number;
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

/**
 * Hash to tab mapping for URL-based navigation
 */
const HASH_TO_TAB: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/requests': 'requests',
  '/questionnaires': 'questionnaires',
  '/messages': 'messages',
  '/review': 'preview',
  '/files': 'files',
  '/help': 'help',
  '/settings': 'settings'
};

/**
 * Get current tab from URL hash
 */
function getTabFromHash(): string {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') {
    return 'dashboard';
  }
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  return HASH_TO_TAB[path] || 'dashboard';
}

export function PortalSidebar({
  activeTab: initialActiveTab,
  onNavigate,
  user,
  badges,
  onLogout,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onCollapsedChange
}: PortalNavigationProps) {
  // Use controlled or uncontrolled collapsed state
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(defaultCollapsed);
  const isCollapsed = controlledCollapsed ?? uncontrolledCollapsed;

  // Track active tab from hash changes
  const [currentActiveTab, setCurrentActiveTab] = useState(initialActiveTab || getTabFromHash());

  // Listen for hash changes to update active tab
  useEffect(() => {
    const handleHashChange = () => {
      const newTab = getTabFromHash();
      setCurrentActiveTab(newTab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update if controlled activeTab prop changes
  useEffect(() => {
    if (initialActiveTab) {
      setCurrentActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

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
              isActive={currentActiveTab === item.id}
              badge={badge}
              isCollapsed={isCollapsed}
              onClick={() => handleNavigate(item.id)}
            />
          );
        })}
      </nav>

      {/* Footer with Logout */}
      <div className="tw-p-2 tw-border-t tw-border-[var(--portal-border-color)]">
        <button
          onClick={onLogout}
          className={cn(
            'tw-w-full tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2',
            'tw-text-[var(--portal-text-light)] tw-bg-transparent',
            'tw-border tw-border-transparent',
            'hover:tw-bg-[var(--portal-bg-hover)] hover:tw-text-[var(--portal-text-light)]',
            'tw-transition-colors tw-duration-150',
            isCollapsed && 'tw-justify-center'
          )}
          aria-label="Sign out"
        >
          <LogOut className="tw-w-4 tw-h-4 tw-flex-shrink-0" />
          {!isCollapsed && (
            <span className="tw-font-mono tw-text-xs tw-uppercase tw-tracking-wider">
              Sign Out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

export default PortalSidebar;
