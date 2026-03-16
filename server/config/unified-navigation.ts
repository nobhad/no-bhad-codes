/**
 * ===============================================
 * UNIFIED PORTAL NAVIGATION CONFIGURATION
 * ===============================================
 * @file server/config/unified-navigation.ts
 *
 * Single source of truth for both admin and client portal navigation.
 * All tabs, subtabs, features, and capabilities are defined here and
 * filtered at runtime based on user role.
 *
 * CORE PRINCIPLE: Nothing is hardcoded. Everything is filtered by role.
 */

// ============================================
// TYPES
// ============================================

export type UserRole = 'admin' | 'client';

export interface UnifiedNavItem {
  /** Unique identifier for the navigation item */
  id: string;
  /** Display label for the navigation item */
  label: string;
  /** Icon key from ICON_KEYS (not raw SVG) */
  icon: string;
  /** Roles that can see this tab */
  roles: UserRole[];
  /** Parent group for grouped tabs (work, crm, documents) */
  group?: string;
  /** Display order (lower = higher priority) */
  order: number;
  /** Badge element ID for dynamic counts */
  badge?: string;
  /** Keyboard shortcut number (admin only) */
  shortcut?: string;
  /** Override data-tab attribute (defaults to id) */
  dataTab?: string;
  /** Accessibility label override */
  ariaLabel?: string;
  /** Is this the default active item for the role */
  activeForRole?: UserRole;
}

export interface UnifiedSubtab {
  /** Subtab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Roles that can see this subtab */
  roles: UserRole[];
  /** Is this the default active subtab */
  active?: boolean;
  /** Custom data attribute (e.g., 'pd-tab' for project-detail) */
  dataAttr?: string;
}

export interface UnifiedSubtabGroup {
  /** Group identifier */
  id: string;
  /** Tab this group belongs to */
  forTab: string;
  /** Roles that can see this group */
  roles: UserRole[];
  /** Display mode */
  mode?: 'primary';
  /** Subtabs in this group */
  subtabs: UnifiedSubtab[];
}

export interface PortalFeatures {
  /** Show notification bell in header */
  notificationBell: boolean;
  /** Show subtabs navigation */
  subtabs: boolean;
  /** Show mobile menu toggle */
  mobileMenuToggle: boolean;
  /** Show theme toggle button */
  themeToggle: boolean;
}

export interface FeatureCapabilities {
  /** Can create new items */
  canCreate: boolean;
  /** Can edit existing items */
  canEdit: boolean;
  /** Can delete items */
  canDelete: boolean;
  /** Can perform bulk actions */
  canBulkAction: boolean;
  /** Can export data */
  canExport: boolean;
  /** Can view all items (not just own) */
  canViewAll: boolean;
  /** Can assign items to users */
  canAssign: boolean;
  /** Can manage users */
  canManageUsers: boolean;
  /** Can access analytics */
  canAccessAnalytics: boolean;
}

// ============================================
// ICON KEYS
// Reference keys for icons (actual SVG in navigation.ts ICONS)
// ============================================

export const ICON_KEYS = {
  gauge: 'gauge',
  folder: 'folder',
  lineChart: 'lineChart',
  users: 'users',
  fileText: 'fileText',
  barChart: 'barChart',
  bookOpen: 'bookOpen',
  settings: 'settings',
  briefcase: 'briefcase',
  receipt: 'receipt',
  checkCircle: 'checkCircle',
  messageCircle: 'messageCircle',
  clipboardList: 'clipboardList',
  messageSquare: 'messageSquare',
  eye: 'eye',
  helpCircle: 'helpCircle',
  settingsClient: 'settingsClient',
  panelLeft: 'panelLeft',
  logOut: 'logOut',
  package: 'package',
  logOutClient: 'logOutClient'
} as const;

export type IconKey = keyof typeof ICON_KEYS;

// ============================================
// UNIFIED NAVIGATION - Single Source of Truth
// ============================================

export const UNIFIED_NAVIGATION: UnifiedNavItem[] = [
  // ========== SHARED TABS (both roles) ==========
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'gauge',
    roles: ['admin', 'client'],
    order: 1,
    shortcut: '1',
    activeForRole: 'admin'
  },

  // Admin subtab items (hidden from sidebar, shown as subtabs within groups)
  {
    id: 'projects',
    label: 'Projects',
    icon: 'briefcase',
    roles: ['admin'],
    group: 'work',
    order: 2,
    badge: 'badge-projects'
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'messageSquare',
    roles: ['admin'],
    group: 'crm',
    order: 3,
    badge: 'badge-messages'
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: 'receipt',
    roles: ['admin'],
    group: 'documents',
    order: 5,
    badge: 'badge-invoices'
  },
  {
    id: 'requests',
    label: 'Requests',
    icon: 'messageCircle',
    roles: ['admin'],
    group: 'work',
    order: 6,
    badge: 'badge-requests'
  },
  {
    id: 'questionnaires',
    label: 'Questionnaires',
    icon: 'clipboardList',
    roles: ['admin'],
    group: 'documents',
    order: 7,
    badge: 'badge-questionnaires'
  },

  // Client top-level items (no group — visible directly in sidebar)
  // No separate Projects tab — multi-project clients use header dropdown
  {
    id: 'messages',
    label: 'Messages',
    icon: 'messageSquare',
    roles: ['client'],
    order: 2,
    badge: 'badge-messages'
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'fileText',
    roles: ['client'],
    order: 3,
    badge: 'badge-documents'
  },
  {
    id: 'requests-hub',
    label: 'Requests',
    icon: 'clipboardList',
    roles: ['client'],
    order: 4
  },
  {
    id: 'deliverables',
    label: 'Deliverables',
    icon: 'package',
    roles: ['client'],
    order: 5
  },
  {
    id: 'files',
    label: 'Files',
    icon: 'folder',
    roles: ['client'],
    order: 6,
    badge: 'badge-files',
    dataTab: 'files'
  },
  {
    id: 'payment-schedule',
    label: 'Payments',
    icon: 'receipt',
    roles: ['client'],
    order: 7
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settingsClient',
    roles: ['client'],
    order: 8
  },
  {
    id: 'help',
    label: 'Help',
    icon: 'helpCircle',
    roles: ['client'],
    order: 100
  },

  // ========== ADMIN-ONLY TABS ==========
  {
    id: 'work',
    label: 'Work',
    icon: 'folder',
    roles: ['admin'],
    order: 2,
    shortcut: '2',
    dataTab: 'work'
  },
  // Workflows moved under Settings as a subtab (no longer top-level)
  {
    id: 'crm',
    label: 'CRM',
    icon: 'users',
    roles: ['admin'],
    order: 4,
    shortcut: '4',
    ariaLabel: 'Clients & Leads'
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: 'fileText',
    roles: ['admin'],
    order: 5,
    shortcut: '5'
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'checkCircle',
    roles: ['admin'],
    group: 'work',
    order: 8
  },
  {
    id: 'leads',
    label: 'Leads',
    icon: 'users',
    roles: ['admin'],
    group: 'crm',
    order: 9
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: 'users',
    roles: ['admin'],
    group: 'crm',
    order: 10
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: 'users',
    roles: ['admin'],
    group: 'crm',
    order: 11
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: 'fileText',
    roles: ['admin'],
    group: 'documents',
    order: 12
  },
  {
    id: 'document-requests',
    label: 'Document Requests',
    icon: 'fileText',
    roles: ['admin'],
    group: 'documents',
    order: 13
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'barChart',
    roles: ['admin'],
    order: 14,
    shortcut: '6'
  },
  {
    id: 'support',
    label: 'Knowledge',
    icon: 'bookOpen',
    roles: ['admin'],
    order: 15,
    shortcut: '7',
    ariaLabel: 'Knowledge Base'
  },
  {
    id: 'system',
    label: 'Settings',
    icon: 'settings',
    roles: ['admin'],
    order: 16,
    shortcut: '8',
    ariaLabel: 'Settings & Configuration'
  }

  // ========== CLIENT-ONLY TABS (consolidated) ==========
  // proposals, contracts, invoices → merged into /documents
  // approvals → merged into /deliverables
  // review → removed (preview links on dashboard)
  // requests → submit from dashboard, no dedicated tab
  // questionnaires → subtab under /files
];

// ============================================
// UNIFIED SUBTAB GROUPS
// ============================================

export const UNIFIED_SUBTAB_GROUPS: UnifiedSubtabGroup[] = [
  // Admin: Work group subtabs
  {
    id: 'work-subtabs',
    forTab: 'work',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'projects', label: 'Projects', roles: ['admin'] },
      { id: 'tasks', label: 'Tasks', roles: ['admin'] },
      { id: 'ad-hoc-requests', label: 'Requests', roles: ['admin'] }
    ]
  },
  // Admin: CRM group subtabs
  {
    id: 'crm-subtabs',
    forTab: 'crm',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'leads', label: 'Leads', roles: ['admin'] },
      { id: 'messages', label: 'Messages', roles: ['admin'] },
      { id: 'clients', label: 'Clients', roles: ['admin'] },
      { id: 'contacts', label: 'Contacts', roles: ['admin'] }
    ]
  },
  // Admin: Documents group subtabs
  {
    id: 'documents-subtabs',
    forTab: 'documents',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'invoices', label: 'Invoices', roles: ['admin'] },
      { id: 'contracts', label: 'Contracts', roles: ['admin'] },
      { id: 'document-requests', label: 'Document Requests', roles: ['admin'] },
      { id: 'questionnaires', label: 'Questionnaires', roles: ['admin'] }
    ]
  },
  // Admin: Analytics subtabs
  {
    id: 'analytics-subtabs',
    forTab: 'analytics',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'revenue', label: 'Revenue', roles: ['admin'] },
      { id: 'leads', label: 'Leads', roles: ['admin'] },
      { id: 'projects', label: 'Projects', roles: ['admin'] }
    ]
  },
  // Admin: Settings subtabs (system tab)
  {
    id: 'settings-admin-subtabs',
    forTab: 'system',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'configuration', label: 'Configuration', roles: ['admin'] },
      { id: 'workflows', label: 'Workflows', roles: ['admin'] },
      { id: 'email-templates', label: 'Email Templates', roles: ['admin'] },
      { id: 'audit-log', label: 'Audit Log', roles: ['admin'] },
      { id: 'system-health', label: 'System Health', roles: ['admin'] }
    ]
  },
  // Admin: Knowledge subtabs
  {
    id: 'knowledge-subtabs',
    forTab: 'support',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'categories', label: 'Categories', roles: ['admin'] },
      { id: 'articles', label: 'Articles', roles: ['admin'] }
    ]
  }
  // Client settings subtabs are rendered by React TabList in PortalSettings.tsx
  // NOTE: project-detail and client-detail subtabs are managed by their React components
  // (PortalProjectDetail.tsx, ClientDetail.tsx) and must NOT be defined here —
  // doing so creates duplicate tab bars that don't connect to React state.
];

// ============================================
// TAB TITLES MAPPING (for page headers)
// ============================================

export const UNIFIED_TAB_TITLES: Record<string, string> = {
  // Shared
  dashboard: 'Dashboard',
  projects: 'Projects',
  files: 'Files',
  messages: 'Messages',
  invoices: 'Invoices',
  requests: 'Requests',
  questionnaires: 'Questionnaires',
  settings: 'Settings',

  // Admin-only
  leads: 'Leads',
  contacts: 'Contacts',
  clients: 'Clients',
  tasks: 'Tasks',
  contracts: 'Contracts',
  'document-requests': 'Document Requests',
  'ad-hoc-requests': 'Ad Hoc Requests',
  analytics: 'Analytics',
  workflows: 'Workflows',
  support: 'Knowledge Base',
  system: 'Settings',
  work: 'Work',
  crm: 'CRM',
  documents: 'Documents',
  'client-detail': 'Client Details',
  'project-detail': 'Project Details',

  // Client-only (some now consolidated)
  proposals: 'Proposals',
  deliverables: 'Deliverables',
  approvals: 'Approvals',
  preview: 'Project Preview',
  review: 'Project Preview',
  help: 'Help',
  'new-project': 'New Project',
  'requests-hub': 'Requests',
  'content-requests': 'Content Requests',
  'payment-schedule': 'Payments',
  // Redirects keep working via title lookup
  'client-documents': 'Documents'
};

// ============================================
// TAB GROUPS (for resolving group -> default tab)
// ============================================

export const UNIFIED_TAB_GROUPS: Record<
  string,
  { label: string; tabs: string[]; defaultTab: string; roles: UserRole[] }
> = {
  work: {
    label: 'Work',
    tabs: ['projects', 'tasks', 'requests', 'ad-hoc-requests'],
    defaultTab: 'projects',
    roles: ['admin']
  },
  crm: {
    label: 'CRM',
    tabs: ['leads', 'contacts', 'messages', 'clients'],
    defaultTab: 'leads',
    roles: ['admin']
  },
  documents: {
    label: 'Documents',
    tabs: ['invoices', 'contracts', 'document-requests', 'questionnaires'],
    defaultTab: 'invoices',
    roles: ['admin']
  },
  // Client support group (for hash routing)
  support: {
    label: 'Support',
    tabs: ['messages', 'help'],
    defaultTab: 'messages',
    roles: ['client']
  }
};

// ============================================
// RUNTIME FILTERING FUNCTIONS
// ============================================

/**
 * Get navigation items filtered for a specific role
 * Returns only the nav items that the role can access, sorted by order
 */
export function getNavigationForRole(role: UserRole): UnifiedNavItem[] {
  return UNIFIED_NAVIGATION.filter((item) => item.roles.includes(role)).sort(
    (a, b) => a.order - b.order
  );
}

/**
 * Get subtab groups filtered for a specific role
 * Includes only groups and subtabs the role can access
 */
export function getSubtabGroupsForRole(role: UserRole): UnifiedSubtabGroup[] {
  return UNIFIED_SUBTAB_GROUPS.filter((group) => group.roles.includes(role)).map((group) => ({
    ...group,
    subtabs: group.subtabs.filter((subtab) => subtab.roles.includes(role))
  }));
}

/**
 * Get portal features for a specific role
 * Determines which UI features are available
 */
export function getFeaturesForRole(role: UserRole): PortalFeatures {
  return {
    notificationBell: true, // Shared: both roles
    themeToggle: true, // Shared: both roles
    mobileMenuToggle: role === 'client', // Client only (admin has sidebar toggle)
    subtabs: true // Both roles
  };
}

/**
 * Get feature capabilities for a specific role
 * Determines what actions the user can perform
 */
export function getCapabilitiesForRole(role: UserRole): FeatureCapabilities {
  const isAdmin = role === 'admin';
  return {
    canCreate: isAdmin,
    canEdit: isAdmin,
    canDelete: isAdmin,
    canBulkAction: isAdmin,
    canExport: isAdmin,
    canViewAll: isAdmin,
    canAssign: isAdmin,
    canManageUsers: isAdmin,
    canAccessAnalytics: isAdmin
  };
}

/**
 * Get the default tab for a role
 */
export function getDefaultTabForRole(role: UserRole): string {
  const defaultItem = UNIFIED_NAVIGATION.find(
    (item) => item.activeForRole === role && item.roles.includes(role)
  );
  return defaultItem?.id || 'dashboard';
}

/**
 * Resolve a tab name to its actual tab (handles group -> default tab resolution)
 */
/** Detail view tabs and their parent groups + list pages */
export const DETAIL_VIEW_TABS: Record<string, {
  parentGroup: string;
  parentTab: string;
  parentLabel: string;
  roles: UserRole[];
}> = {
  'client-detail': { parentGroup: 'crm', parentTab: 'clients', parentLabel: 'Clients', roles: ['admin'] },
  'project-detail': { parentGroup: 'work', parentTab: 'projects', parentLabel: 'Projects', roles: ['admin'] }
};

export function resolveTab(
  tabName: string,
  role: UserRole
): { group: string | null; tab: string } {
  // Check if it's a group — tab stays as the group name (overview view)
  if (UNIFIED_TAB_GROUPS[tabName] && UNIFIED_TAB_GROUPS[tabName].roles.includes(role)) {
    return { group: tabName, tab: tabName };
  }

  // Check if it's a detail view tab (e.g., client-detail → crm group)
  const detailConfig = DETAIL_VIEW_TABS[tabName];
  if (detailConfig && detailConfig.roles.includes(role)) {
    return { group: detailConfig.parentGroup, tab: tabName };
  }

  // Find which group this tab belongs to (if any)
  for (const [groupName, config] of Object.entries(UNIFIED_TAB_GROUPS)) {
    if (config.tabs.includes(tabName) && config.roles.includes(role)) {
      return { group: groupName, tab: tabName };
    }
  }

  return { group: null, tab: tabName };
}

/**
 * Get tab title for display
 */
export function getTabTitle(tabId: string): string {
  return UNIFIED_TAB_TITLES[tabId] || 'Dashboard';
}

/**
 * Check if a tab is accessible for a role
 */
/** Legacy client tab IDs that redirect to new consolidated tabs */
const LEGACY_CLIENT_TABS = new Set([
  'invoices', 'contracts', 'proposals', 'approvals',
  'review', 'requests', 'questionnaires', 'projects'
]);

export function canAccessTab(tabId: string, role: UserRole): boolean {
  // Allow legacy client tabs for redirect support
  if (role === 'client' && LEGACY_CLIENT_TABS.has(tabId)) return true;

  // Allow detail view tabs (client-detail, project-detail)
  const detailConfig = DETAIL_VIEW_TABS[tabId];
  if (detailConfig && detailConfig.roles.includes(role)) return true;

  // Check top-level navigation items — use .some() not .find() because
  // UNIFIED_NAVIGATION has duplicate IDs for shared tabs (admin + client versions)
  const hasNavAccess = UNIFIED_NAVIGATION.some(
    (item) => item.id === tabId && item.roles.includes(role)
  );
  if (hasNavAccess) return true;

  // Check subtab groups — subtab IDs are valid if the group is accessible
  for (const group of UNIFIED_SUBTAB_GROUPS) {
    if (group.roles.includes(role) && group.subtabs.some((s) => s.id === tabId)) {
      return true;
    }
  }

  return false;
}
