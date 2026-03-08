/**
 * ===============================================
 * PORTAL NAVIGATION CONFIGURATION
 * ===============================================
 * @file server/config/navigation.ts
 *
 * EJS template adapter for unified portal navigation.
 * Combines unified config (source of truth) with SVG icons
 * for server-side rendering in EJS templates.
 *
 * NOTE: The actual navigation data lives in unified-navigation.ts.
 * This file provides backward compatibility with EJS templates.
 */

import {
  getNavigationForRole,
  getSubtabGroupsForRole,
  getFeaturesForRole,
  type UserRole,
  type UnifiedNavItem,
  type UnifiedSubtabGroup
} from './unified-navigation.js';
import { BUSINESS_INFO } from './business.js';

// ============================================
// TYPES (for EJS template compatibility)
// ============================================

export interface NavItem {
  id: string;
  label: string;
  /** SVG icon markup */
  icon: string;
  /** Keyboard shortcut number (admin only) */
  shortcut?: string;
  /** Badge element ID for dynamic counts */
  badge?: string;
  /** data-tab attribute value (defaults to id) */
  dataTab?: string;
  /** Is this the default active item */
  active?: boolean;
  /** aria-label override (defaults to label) */
  ariaLabel?: string;
}

export interface SubtabGroup {
  forTab: string;
  mode?: 'primary';
  id?: string;
  subtabs: { id: string; label: string; active?: boolean; dataAttr?: string }[];
}

export interface PortalConfig {
  type: 'admin' | 'client';
  title: string;
  pageTitle: string;
  authTitle: string;
  authDescription: string;
  dashboardId: string;
  pageTitleId: string;
  /** Meta theme-color value for the browser chrome */
  themeColor: string;
  navigation: NavItem[];
  subtabGroups?: SubtabGroup[];
  features: {
    subtabs: boolean;
    notificationBell: boolean;
    mobileMenuToggle: boolean;
    themeToggle?: boolean;
  };
}

// ============================================
// ICON DEFINITIONS (Lucide SVG)
// ============================================

export const ICONS: Record<string, string> = {
  // Sidebar toggle
  panelLeft:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M15 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6"/></svg>',

  // Navigation icons
  gauge:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  folder:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16Z"/></svg>',
  lineChart:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  users:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  fileText:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
  barChart:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  bookOpen:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  settings:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  logOut:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  logOutClient:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>',

  // Client-specific icons
  briefcase:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  receipt:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>',
  checkCircle:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
  messageCircle:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  clipboardList:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
  messageSquare:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>',
  eye: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  helpCircle:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  package:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  settingsClient:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>'
};

// ============================================
// PORTAL CONFIG METADATA
// ============================================

/**
 * Meta theme-color for browser chrome.
 * Sourced from BRAND_COLOR env or falls back to neutral gray.
 * This is the single source of truth for all EJS-rendered pages.
 */
const META_THEME_COLOR = process.env.META_THEME_COLOR || '#e0e0e0';

const PORTAL_METADATA: Record<
  UserRole,
  {
    title: string;
    pageTitle: string;
    authTitle: string;
    authDescription: string;
    dashboardId: string;
    pageTitleId: string;
    themeColor: string;
  }
> = {
  admin: {
    title: `Admin Dashboard - ${BUSINESS_INFO.name}`,
    pageTitle: 'Dashboard',
    authTitle: 'Admin Access',
    authDescription: 'Enter your admin password to continue',
    dashboardId: 'admin-dashboard',
    pageTitleId: 'admin-page-title',
    themeColor: META_THEME_COLOR
  },
  client: {
    title: `Client Portal - ${BUSINESS_INFO.name}`,
    pageTitle: 'Welcome Back',
    authTitle: 'Client Portal',
    authDescription: 'Sign in to access your projects and documents',
    dashboardId: 'client-dashboard',
    pageTitleId: 'portal-page-title',
    themeColor: META_THEME_COLOR
  }
};

// ============================================
// CONVERSION FUNCTIONS
// ============================================

/**
 * Convert unified nav item to EJS-compatible nav item
 * Resolves icon key to actual SVG markup
 */
function toNavItem(item: UnifiedNavItem): NavItem {
  return {
    id: item.id,
    label: item.label,
    icon: ICONS[item.icon] || ICONS.gauge, // Fallback to gauge icon
    shortcut: item.shortcut,
    badge: item.badge,
    dataTab: item.dataTab,
    active: item.activeForRole !== undefined,
    ariaLabel: item.ariaLabel
  };
}

/**
 * Convert unified subtab group to EJS-compatible subtab group
 */
function toSubtabGroup(group: UnifiedSubtabGroup): SubtabGroup {
  return {
    forTab: group.forTab,
    mode: group.mode,
    id: group.id,
    subtabs: group.subtabs.map((subtab) => ({
      id: subtab.id,
      label: subtab.label,
      active: subtab.active,
      dataAttr: subtab.dataAttr
    }))
  };
}

/**
 * Get portal configuration by type
 * This is the main function used by EJS templates
 *
 * IMPORTANT: This now uses unified-navigation.ts as the source of truth
 */
export function getPortalConfig(portalType: 'admin' | 'client'): PortalConfig {
  const role: UserRole = portalType;
  const metadata = PORTAL_METADATA[role];
  const features = getFeaturesForRole(role);
  const navItems = getNavigationForRole(role);
  const subtabGroups = getSubtabGroupsForRole(role);

  // Filter to only show top-level nav items (not grouped tabs for admin)
  // Admin shows: dashboard, work, workflows, crm, documents, analytics, support, system
  // Client shows: all their items since they don't have groups
  const topLevelNavItems =
    role === 'admin'
      ? navItems.filter(
        (item) =>
          !item.group ||
            ['work', 'crm', 'documents', 'workflows', 'analytics', 'support', 'system'].includes(
              item.id
            )
      )
      : navItems;

  return {
    type: portalType,
    ...metadata,
    navigation: topLevelNavItems.map(toNavItem),
    subtabGroups: subtabGroups.map(toSubtabGroup),
    features: {
      subtabs: features.subtabs,
      notificationBell: features.notificationBell,
      mobileMenuToggle: features.mobileMenuToggle,
      themeToggle: features.themeToggle
    }
  };
}

/**
 * Export both configs for direct access (backward compatibility)
 */
export const PORTAL_CONFIGS = {
  get admin() {
    return getPortalConfig('admin');
  },
  get client() {
    return getPortalConfig('client');
  }
} as const;

/**
 * Tab content IDs that need to be rendered (admin only)
 */
export const ADMIN_TAB_IDS = [
  'dashboard',
  // Group tabs (parent dashboard components)
  'work',
  'crm',
  'documents',
  'analytics',
  'workflows',
  'support',
  // Child tabs (mounted within groups or standalone)
  'leads',
  'contacts',
  'projects',
  'clients',
  'ad-hoc-requests',
  'tasks',
  'client-detail',
  'messages',
  'system',
  'project-detail',
  'questionnaires',
  'invoices',
  'contracts',
  'document-requests',
  'email-templates'
];

/**
 * Tab content IDs for client portal.
 * Each gets a pre-rendered `.tab-content` div in the EJS template,
 * matching the admin architecture for consistent tab switching.
 */
export const CLIENT_TAB_IDS = [
  'dashboard',
  'projects',
  'project-detail',
  'messages',
  'files',
  'invoices',
  'proposals',
  'contracts',
  'deliverables',
  'requests',
  'questionnaires',
  'documents',
  'approvals',
  'review',
  'help',
  'settings',
  'new-project',
  'onboarding'
];

// Re-export from unified-navigation for TypeScript usage
export {
  getNavigationForRole,
  getSubtabGroupsForRole,
  getFeaturesForRole,
  getCapabilitiesForRole,
  resolveTab,
  getTabTitle,
  canAccessTab,
  getDefaultTabForRole,
  UNIFIED_NAVIGATION,
  UNIFIED_SUBTAB_GROUPS,
  UNIFIED_TAB_TITLES,
  UNIFIED_TAB_GROUPS
} from './unified-navigation.js';

export type { UserRole, UnifiedNavItem, UnifiedSubtabGroup } from './unified-navigation.js';
