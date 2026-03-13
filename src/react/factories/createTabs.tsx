/**
 * ===============================================
 * TAB FACTORY
 * ===============================================
 * @file src/react/factories/createTabs.tsx
 *
 * Reusable tab components with best practices:
 * - ARIA accessibility (role, aria-selected, aria-controls)
 * - Keyboard navigation (arrow keys, Home, End)
 * - Roving tabindex for focus management
 * - Matches existing codebase patterns
 *
 * @see ProjectDetail.tsx, ClientDetail.tsx for usage patterns
 */

import * as React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@react/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ============================================
// TYPES - Match existing patterns
// ============================================

/**
 * Tab configuration - matches existing TABS arrays
 * @example
 * const TABS: Array<{ id: ProjectDetailTab; label: string }> = [
 *   { id: 'overview', label: 'Overview' },
 *   { id: 'files', label: 'Files' }
 * ];
 */
export interface TabItem<T extends string = string> {
  /** Unique tab identifier */
  id: T;
  /** Display label */
  label: string;
  /** Optional badge count */
  badge?: number;
  /** Whether tab is disabled */
  disabled?: boolean;
}

/**
 * Tab icons mapping - matches existing TAB_ICONS pattern
 * @example
 * const TAB_ICONS: Record<ProjectDetailTab, React.ElementType> = {
 *   overview: LayoutDashboard,
 *   files: FolderOpen
 * };
 */
export type TabIconMap<T extends string = string> = Record<T, React.ElementType>;

// ============================================
// TAB LIST COMPONENT
// ============================================

export interface TabListProps<T extends string = string> {
  /** Tab configuration array */
  tabs: Array<TabItem<T>>;
  /** Tab icons mapping (optional) */
  tabIcons?: TabIconMap<T>;
  /** Visual container style */
  variant?: 'tabs' | 'subtabs';
  /** Currently active tab ID */
  activeTab: T;
  /** Tab change handler */
  setActiveTab: (tabId: T) => void;
  /** Additional className */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * TabList - Renders tab buttons with accessibility and keyboard navigation.
 *
 * Best practices implemented:
 * - role="tablist" on container
 * - role="tab" on buttons
 * - aria-selected for active state
 * - aria-controls linking to panel
 * - Keyboard: ArrowLeft/Right, Home, End
 * - Roving tabindex
 *
 * @example
 * <TabList
 *   tabs={TABS}
 *   tabIcons={TAB_ICONS}
 *   activeTab={activeTab}
 *   setActiveTab={setActiveTab}
 * />
 */
export function TabList<T extends string>({
  tabs,
  tabIcons,
  variant = 'tabs',
  activeTab,
  setActiveTab,
  className,
  ariaLabel = 'Tab navigation'
}: TabListProps<T>) {
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

  // Get enabled tabs for keyboard navigation
  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentTabId: T) => {
      const currentIndex = enabledTabs.findIndex((t) => t.id === currentTabId);
      let nextIndex: number | null = null;

      switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % enabledTabs.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
      }

      if (nextIndex !== null) {
        const nextTab = enabledTabs[nextIndex];
        setActiveTab(nextTab.id);
        tabRefs.current.get(nextTab.id)?.focus();
      }
    },
    [enabledTabs, setActiveTab]
  );

  return (
    <div
      className={cn(variant === 'subtabs' ? 'portal-subtabs' : 'portal-tabs', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const _Icon = tabIcons?.[tab.id];
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            aria-disabled={tab.disabled}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={isActive ? 'is-active' : ''}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="portal-tab-badge">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// TAB PANEL COMPONENT
// ============================================

export interface TabPanelProps {
  /** Tab ID this panel belongs to */
  tabId: string;
  /** Whether this panel is active */
  isActive: boolean;
  /** Panel content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * TabPanel - Wrapper for tab content with accessibility.
 *
 * Best practices:
 * - role="tabpanel"
 * - aria-labelledby linking to tab
 * - tabIndex for focus management
 *
 * @example
 * <TabPanel tabId="overview" isActive={activeTab === 'overview'}>
 *   <OverviewTab {...props} />
 * </TabPanel>
 */
export function TabPanel({
  tabId,
  isActive,
  children,
  className
}: TabPanelProps) {
  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      tabIndex={0}
      className={cn('portal-tab-panel', 'is-active', className)}
    >
      {children}
    </div>
  );
}

// ============================================
// SUBTAB LIST COMPONENT
// ============================================

export interface SubtabListProps<T extends string = string> {
  /** Subtab configuration array */
  tabs: Array<TabItem<T>>;
  /** Currently active subtab ID */
  activeTab: T;
  /** Subtab change handler */
  setActiveTab: (tabId: T) => void;
  /** Additional className */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * SubtabList - Secondary tab navigation with accessibility.
 *
 * @example
 * const SUBTABS = [
 *   { id: 'all', label: 'All' },
 *   { id: 'active', label: 'Active', badge: 12 }
 * ];
 *
 * <SubtabList
 *   tabs={SUBTABS}
 *   activeTab={activeSubtab}
 *   setActiveTab={setActiveSubtab}
 * />
 */
export function SubtabList<T extends string>({
  tabs,
  activeTab,
  setActiveTab,
  className,
  ariaLabel = 'Secondary navigation'
}: SubtabListProps<T>) {
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const enabledTabs = tabs.filter((tab) => !tab.disabled);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentTabId: T) => {
      const currentIndex = enabledTabs.findIndex((t) => t.id === currentTabId);
      let nextIndex: number | null = null;

      switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        nextIndex = (currentIndex + 1) % enabledTabs.length;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
        break;
      case 'Home':
        e.preventDefault();
        nextIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
      }

      if (nextIndex !== null) {
        const nextTab = enabledTabs[nextIndex];
        setActiveTab(nextTab.id);
        tabRefs.current.get(nextTab.id)?.focus();
      }
    },
    [enabledTabs, setActiveTab]
  );

  return (
    <div
      className={cn('portal-subtabs', className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            role="tab"
            id={`subtab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`subpanel-${tab.id}`}
            aria-disabled={tab.disabled}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={cn('portal-subtab', isActive && 'is-active')}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="portal-subtab-badge">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// SUBTAB PANEL COMPONENT
// ============================================

export interface SubtabPanelProps {
  /** Subtab ID this panel belongs to */
  tabId: string;
  /** Whether this panel is active */
  isActive: boolean;
  /** Panel content */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * SubtabPanel - Wrapper for subtab content with accessibility.
 */
export function SubtabPanel({
  tabId,
  isActive,
  children,
  className
}: SubtabPanelProps) {
  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`subpanel-${tabId}`}
      aria-labelledby={`subtab-${tabId}`}
      className={cn('portal-subtab-content', 'is-active', className)}
    >
      {children}
    </div>
  );
}

// ============================================
// VIEW TOGGLE COMPONENT
// ============================================

export interface ViewToggleOption<T extends string = string> {
  /** Option ID */
  id: T;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: LucideIcon;
}

export interface ViewToggleProps<T extends string = string> {
  /** Toggle options */
  options: Array<ViewToggleOption<T>>;
  /** Selected option */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Show labels (default: true) */
  showLabels?: boolean;
  /** Additional className */
  className?: string;
  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * ViewToggle - Segmented control for view switching.
 *
 * @example
 * <ViewToggle
 *   options={[
 *     { id: 'table', label: 'Table', icon: List },
 *     { id: 'grid', label: 'Grid', icon: LayoutGrid }
 *   ]}
 *   value={viewMode}
 *   onChange={setViewMode}
 * />
 */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
  showLabels = true,
  className,
  ariaLabel = 'View mode'
}: ViewToggleProps<T>) {
  return (
    <div
      className={cn('view-toggle', className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.id;
        const Icon = option.icon;

        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.id)}
            className={isActive ? 'is-active' : ''}
            title={option.label}
          >
            {Icon && <Icon />}
            {showLabels && option.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// USE TABS HOOK
// ============================================

export interface UseTabsOptions<T extends string> {
  /** Initial active tab */
  initialTab: T;
  /** Callback when tab changes */
  onChange?: (tabId: T) => void;
  /** Sync with URL hash */
  syncWithHash?: boolean;
}

export interface UseTabsReturn<T extends string> {
  /** Currently active tab */
  activeTab: T;
  /** Set active tab */
  setActiveTab: (tabId: T) => void;
  /** Check if tab is active - convenience for conditional rendering */
  isActive: (tabId: T) => boolean;
}

/**
 * useTabs - Hook for managing tab state.
 *
 * Matches existing useState pattern but with optional enhancements:
 * - Optional onChange callback
 * - Optional URL hash sync
 * - isActive helper for cleaner conditional rendering
 *
 * @example
 * // Simple usage (matches existing pattern):
 * const [activeTab, setActiveTab] = useState<ProjectDetailTab>('overview');
 *
 * // Enhanced usage with hook:
 * const { activeTab, setActiveTab, isActive } = useTabs({
 *   initialTab: 'overview',
 *   onChange: (tab) => analytics.track('tab_change', { tab })
 * });
 *
 * // With URL hash sync:
 * const { activeTab, setActiveTab } = useTabs({
 *   initialTab: 'overview',
 *   syncWithHash: true
 * });
 */
export function useTabs<T extends string>(
  options: UseTabsOptions<T>
): UseTabsReturn<T> {
  const { initialTab, onChange, syncWithHash = false } = options;

  // Get initial tab from URL hash if enabled
  const getInitialTab = (): T => {
    if (syncWithHash && typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1) as T;
      if (hash) return hash;
    }
    return initialTab;
  };

  const [activeTab, setActiveTabState] = useState<T>(getInitialTab);

  // Update handler with optional hash sync
  const setActiveTab = useCallback(
    (tabId: T) => {
      setActiveTabState(tabId);

      if (syncWithHash && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${tabId}`);
      }

      onChange?.(tabId);
    },
    [onChange, syncWithHash]
  );

  // Listen for hash changes
  useEffect(() => {
    if (!syncWithHash || typeof window === 'undefined') return;

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as T;
      if (hash) {
        setActiveTabState(hash);
        onChange?.(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [onChange, syncWithHash]);

  // Convenience helper
  const isActive = useCallback(
    (tabId: T) => activeTab === tabId,
    [activeTab]
  );

  return {
    activeTab,
    setActiveTab,
    isActive
  };
}

/**
 * useSubtabs - Alias for useTabs, semantically named for subtabs.
 */
export const useSubtabs = useTabs;

// ============================================
// SIMPLE TABS COMPOUND COMPONENT
// ============================================

/**
 * Tab content item for Tabs compound component.
 */
export interface TabContent<T extends string = string> {
  /** Tab ID matching TabItem id */
  id: T;
  /** Content to render when tab is active */
  content: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  /** Tab configuration array */
  tabs: Array<TabItem<T>>;
  /** Tab icons mapping (optional) */
  tabIcons?: TabIconMap<T>;
  /** Tab content mapping */
  children: Array<TabContent<T>> | ((activeTab: T) => React.ReactNode);
  /** Initial active tab */
  initialTab?: T;
  /** Controlled active tab (optional) */
  activeTab?: T;
  /** Tab change callback */
  onTabChange?: (tabId: T) => void;
  /** Wrapper className */
  className?: string;
  /** TabList className */
  tabListClassName?: string;
  /** TabPanel className */
  tabPanelClassName?: string;
  /** Aria label */
  ariaLabel?: string;
}

/**
 * Tabs - Simplified compound component combining TabList + TabPanel.
 *
 * Use this for straightforward tab implementations without subtabs.
 * For more control, use TabList and TabPanel separately.
 *
 * @example
 * // With content array
 * <Tabs
 *   tabs={[
 *     { id: 'overview', label: 'Overview' },
 *     { id: 'files', label: 'Files' }
 *   ]}
 *   initialTab="overview"
 * >
 *   {[
 *     { id: 'overview', content: <OverviewContent /> },
 *     { id: 'files', content: <FilesContent /> }
 *   ]}
 * </Tabs>
 *
 * @example
 * // With render function
 * <Tabs
 *   tabs={TABS}
 *   tabIcons={TAB_ICONS}
 *   initialTab="overview"
 *   onTabChange={(tab) => console.log('Tab changed:', tab)}
 * >
 *   {(activeTab) => {
 *     switch (activeTab) {
 *       case 'overview': return <OverviewTab />;
 *       case 'files': return <FilesTab />;
 *       default: return null;
 *     }
 *   }}
 * </Tabs>
 */
export function Tabs<T extends string>({
  tabs,
  tabIcons,
  children,
  initialTab,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
  tabListClassName,
  tabPanelClassName,
  ariaLabel
}: TabsProps<T>) {
  // Use first tab if no initialTab provided
  const defaultTab = initialTab ?? tabs[0]?.id;

  const { activeTab, setActiveTab } = useTabs({
    initialTab: defaultTab,
    onChange: onTabChange
  });

  // Support controlled mode
  const currentTab = controlledActiveTab ?? activeTab;
  const handleSetTab = controlledActiveTab !== undefined
    ? (tabId: T) => onTabChange?.(tabId)
    : setActiveTab;

  // Render content based on children type
  const renderContent = () => {
    if (typeof children === 'function') {
      return children(currentTab);
    }

    // Find matching content
    const tabContent = children.find((c) => c.id === currentTab);
    return tabContent?.content ?? null;
  };

  return (
    <div className={cn('tabs-container', className)}>
      <TabList
        tabs={tabs}
        tabIcons={tabIcons}
        activeTab={currentTab}
        setActiveTab={handleSetTab}
        className={tabListClassName}
        ariaLabel={ariaLabel}
      />
      <TabPanel
        tabId={currentTab}
        isActive={true}
        className={tabPanelClassName}
      >
        {renderContent()}
      </TabPanel>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * createTabs - Type-safe helper to create tab configuration.
 *
 * @example
 * const TABS = createTabs([
 *   { id: 'overview', label: 'Overview' },
 *   { id: 'files', label: 'Files' }
 * ] as const);
 *
 * type MyTab = typeof TABS[number]['id']; // 'overview' | 'files'
 */
export function createTabs<T extends string>(
  tabs: ReadonlyArray<TabItem<T>>
): Array<TabItem<T>> {
  return [...tabs];
}

/**
 * createTabIcons - Type-safe helper to create tab icon mapping.
 *
 * @example
 * const TAB_ICONS = createTabIcons<ProjectDetailTab>({
 *   overview: LayoutDashboard,
 *   files: FolderOpen
 * });
 */
export function createTabIcons<T extends string>(
  icons: TabIconMap<T>
): TabIconMap<T> {
  return icons;
}

// ============================================
// EXPORTS
// ============================================

export const TabComponents = {
  Tabs,
  TabList,
  TabPanel,
  SubtabList,
  SubtabPanel,
  ViewToggle
};

export default TabComponents;
