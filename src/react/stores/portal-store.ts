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

/** Minimal project info for the project selector */
export interface PortalProject {
  id: number;
  name: string;
  status: string;
}

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

  /** Active project ID for project-scoped tabs (client portal) */
  activeProjectId: number | null;
  /** Total number of projects for the client */
  projectCount: number;
  /** List of projects for the project selector */
  projects: PortalProject[];

  // Actions
  setRole: (role: UserRole) => void;
  switchTab: (tabId: string) => void;
  /** Override the page title (e.g. with a project/client name) */
  setPageTitle: (title: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  /** Set the active project and trigger re-renders in project-scoped tabs */
  setActiveProject: (projectId: number) => void;
  /** Load project list from API response */
  setProjects: (projects: PortalProject[]) => void;
}

// ============================================
// INITIAL STATE FROM STORAGE
// ============================================

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  // Prefer the DOM attribute already set by the inline head script (handles OS preference + localStorage).
  // Fall back to localStorage directly, then default to light.
  const domTheme = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  if (domTheme === 'light' || domTheme === 'dark') return domTheme;
  const stored = localStorage.getItem(STORAGE_KEYS.THEME);
  const theme: 'light' | 'dark' = stored === 'light' || stored === 'dark' ? stored : 'light';
  // Apply to DOM so CSS selectors match if head script didn't run (e.g. SSR hydration edge cases).
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  return theme;
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

        activeProjectId: null,
        projectCount: 0,
        projects: [],

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

        setPageTitle: (title) => {
          set({ pageTitle: title }, false, 'setPageTitle');
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
        },

        setActiveProject: (projectId) => {
          set({ activeProjectId: projectId }, false, 'setActiveProject');
        },

        setProjects: (projects) => {
          const activeProjectId = get().activeProjectId;
          const firstProject = projects[0]?.id ?? null;
          // If no active project set, default to first project
          const resolvedActiveId = activeProjectId && projects.some((p) => p.id === activeProjectId)
            ? activeProjectId
            : firstProject;

          set({
            projects,
            projectCount: projects.length,
            activeProjectId: resolvedActiveId
          }, false, 'setProjects');
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
export const useSetPageTitle = () => usePortalStore((s) => s.setPageTitle);
export const useToggleSidebar = () => usePortalStore((s) => s.toggleSidebar);
export const useToggleTheme = () => usePortalStore((s) => s.toggleTheme);
export const useActiveProjectId = () => usePortalStore((s) => s.activeProjectId);
export const useProjectCount = () => usePortalStore((s) => s.projectCount);
export const useProjects = () => usePortalStore((s) => s.projects);
export const useSetActiveProject = () => usePortalStore((s) => s.setActiveProject);
export const useSetProjects = () => usePortalStore((s) => s.setProjects);
