/**
 * ===============================================
 * PORTAL STORE
 * ===============================================
 * @file src/react/stores/portal-store.ts
 *
 * Zustand store for portal-wide state: navigation,
 * capabilities, sidebar, theme, and notifications.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { STORAGE_KEYS, THEME_ATTRIBUTE } from '../config/portal-constants';
import {
  getNavigationForRole,
  getSubtabGroupsForRole,
  getFeaturesForRole,
  getCapabilitiesForRole,
  getDefaultTabForRole,
  resolveTab,
  getTabTitle,
  canAccessTab,
  type UserRole,
  type UnifiedNavItem,
  type UnifiedSubtabGroup,
  type PortalFeatures,
  type FeatureCapabilities
} from '../../../server/config/unified-navigation';

// ============================================
// TYPES
// ============================================

export interface PortalStoreState {
  /** Current user role */
  role: UserRole;
  /** Current active tab */
  currentTab: string;
  /** Current group (for grouped tabs like work, crm, documents) */
  currentGroup: string | null;
  /** Navigation items for current role */
  navItems: UnifiedNavItem[];
  /** Subtab groups for current role */
  subtabGroups: UnifiedSubtabGroup[];
  /** Portal features for current role */
  features: PortalFeatures;
  /** Feature capabilities for current role */
  capabilities: FeatureCapabilities;
  /** Page title for current tab */
  pageTitle: string;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Current theme */
  theme: 'light' | 'dark';

  // Actions
  setRole: (role: UserRole) => void;
  switchTab: (tabId: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

// ============================================
// INITIAL STATE FROM STORAGE
// ============================================

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

function getInitialSidebarState(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
}

// ============================================
// STORE
// ============================================

export const usePortalStore = create<PortalStoreState>()(
  devtools(
    (set, get) => {
      // Default to client - will be overridden by auth on init
      const defaultRole: UserRole = 'client';

      return {
        role: defaultRole,
        currentTab: getDefaultTabForRole(defaultRole),
        currentGroup: null,
        navItems: getNavigationForRole(defaultRole),
        subtabGroups: getSubtabGroupsForRole(defaultRole),
        features: getFeaturesForRole(defaultRole),
        capabilities: getCapabilitiesForRole(defaultRole),
        pageTitle: 'Dashboard',
        sidebarCollapsed: getInitialSidebarState(),
        theme: getInitialTheme(),

        setRole: (role) => {
          const navItems = getNavigationForRole(role);
          const subtabGroups = getSubtabGroupsForRole(role);
          const features = getFeaturesForRole(role);
          const capabilities = getCapabilitiesForRole(role);
          const defaultTab = getDefaultTabForRole(role);

          set({
            role,
            navItems,
            subtabGroups,
            features,
            capabilities,
            currentTab: defaultTab,
            currentGroup: null,
            pageTitle: getTabTitle(defaultTab)
          }, false, 'setRole');
        },

        switchTab: (tabId) => {
          const { role } = get();

          // Verify access
          if (!canAccessTab(tabId, role)) {
            tabId = getDefaultTabForRole(role);
          }

          const { group, tab } = resolveTab(tabId, role);

          set({
            currentTab: tab,
            currentGroup: group,
            pageTitle: getTabTitle(tab)
          }, false, 'switchTab');
        },

        setSidebarCollapsed: (collapsed) => {
          localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(collapsed));
          set({ sidebarCollapsed: collapsed }, false, 'setSidebarCollapsed');
        },

        toggleSidebar: () => {
          const next = !get().sidebarCollapsed;
          localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
          set({ sidebarCollapsed: next }, false, 'toggleSidebar');
        },

        setTheme: (theme) => {
          document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
          localStorage.setItem(STORAGE_KEYS.THEME, theme);
          set({ theme }, false, 'setTheme');
        },

        toggleTheme: () => {
          const next = get().theme === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
          localStorage.setItem(STORAGE_KEYS.THEME, next);
          set({ theme: next }, false, 'toggleTheme');
        }
      };
    },
    { name: 'portal-store' }
  )
);

// ============================================
// SELECTORS
// ============================================

export const useCurrentTab = () => usePortalStore((s) => s.currentTab);
export const useCurrentGroup = () => usePortalStore((s) => s.currentGroup);
export const useNavItems = () => usePortalStore((s) => s.navItems);
export const useSubtabGroups = () => usePortalStore((s) => s.subtabGroups);
export const useCapabilities = () => usePortalStore((s) => s.capabilities);
export const usePageTitle = () => usePortalStore((s) => s.pageTitle);
export const useSidebarCollapsed = () => usePortalStore((s) => s.sidebarCollapsed);
export const usePortalTheme = () => usePortalStore((s) => s.theme);
export const usePortalRole = () => usePortalStore((s) => s.role);
export const useSwitchTab = () => usePortalStore((s) => s.switchTab);
export const useToggleSidebar = () => usePortalStore((s) => s.toggleSidebar);
export const useToggleTheme = () => usePortalStore((s) => s.toggleTheme);
