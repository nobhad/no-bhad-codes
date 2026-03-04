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
  /** Show secondary sidebar */
  secondarySidebar: boolean;
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
    activeForRole: 'admin' // Default active for both roles
  },
  {
    id: 'projects',
    label: 'Projects',
    icon: 'briefcase',
    roles: ['admin', 'client'],
    group: 'work',
    order: 2,
    badge: 'badge-projects'
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'messageSquare',
    roles: ['admin', 'client'],
    group: 'crm',
    order: 3,
    badge: 'badge-messages'
  },
  {
    id: 'files',
    label: 'Files',
    icon: 'fileText',
    roles: ['client'],
    group: 'documents',
    order: 4,
    badge: 'badge-documents',
    dataTab: 'files'
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: 'receipt',
    roles: ['admin', 'client'],
    group: 'documents',
    order: 5,
    badge: 'badge-invoices'
  },
  {
    id: 'requests',
    label: 'Requests',
    icon: 'messageCircle',
    roles: ['admin', 'client'],
    group: 'work',
    order: 6,
    badge: 'badge-requests'
  },
  {
    id: 'questionnaires',
    label: 'Questionnaires',
    icon: 'clipboardList',
    roles: ['admin', 'client'],
    group: 'documents',
    order: 7,
    badge: 'badge-questionnaires'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settingsClient',
    roles: ['client'],
    order: 100 // Always last for client
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
  {
    id: 'workflows',
    label: 'Workflows',
    icon: 'lineChart',
    roles: ['admin'],
    order: 3,
    shortcut: '3'
  },
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
    ariaLabel: 'System Status'
  },

  // ========== CLIENT-ONLY TABS ==========
  {
    id: 'proposals',
    label: 'Proposals',
    icon: 'fileText',
    roles: ['client'],
    group: 'documents',
    order: 16
  },
  {
    id: 'contracts',
    label: 'Contracts',
    icon: 'fileText',
    roles: ['client'],
    group: 'documents',
    order: 17
  },
  {
    id: 'deliverables',
    label: 'Deliverables',
    icon: 'package',
    roles: ['client'],
    group: 'documents',
    order: 17.5
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: 'checkCircle',
    roles: ['client'],
    order: 18,
    badge: 'badge-approvals'
  },
  {
    id: 'review',
    label: 'Review',
    icon: 'eye',
    roles: ['client'],
    order: 19
  },
  {
    id: 'help',
    label: 'Help',
    icon: 'helpCircle',
    roles: ['client'],
    order: 20
  }
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
      { id: 'contacts', label: 'Contacts', roles: ['admin'] },
      { id: 'messages', label: 'Messages', roles: ['admin'] },
      { id: 'clients', label: 'Clients', roles: ['admin'] }
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
  // Admin: Workflows subtabs
  {
    id: 'workflows-subtabs',
    forTab: 'workflows',
    roles: ['admin'],
    mode: 'primary',
    subtabs: [
      { id: 'overview', label: 'Overview', roles: ['admin'], active: true },
      { id: 'approvals', label: 'Approvals', roles: ['admin'] },
      { id: 'triggers', label: 'Triggers', roles: ['admin'] },
      { id: 'email-templates', label: 'Email Templates', roles: ['admin'] }
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
  },
  // Client: Settings subtabs
  {
    id: 'settings-subtabs',
    forTab: 'settings',
    roles: ['client'],
    subtabs: [
      { id: 'profile', label: 'Profile', roles: ['client'], active: true },
      { id: 'billing', label: 'Billing', roles: ['client'] },
      { id: 'notifications', label: 'Notifications', roles: ['client'] }
    ]
  }
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
  system: 'System Status',
  work: 'Work',
  crm: 'CRM',
  documents: 'Documents',
  'client-detail': 'Client Details',
  'project-detail': 'Project Details',

  // Client-only
  proposals: 'Proposals',
  deliverables: 'Deliverables',
  approvals: 'Approvals',
  preview: 'Project Preview',
  review: 'Project Preview',
  help: 'Help',
  'new-project': 'New Project'
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
    tabs: ['projects', 'tasks', 'ad-hoc-requests'],
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
  // Client groups (for hash routing)
  docs: {
    label: 'Documents',
    tabs: ['files', 'invoices', 'documents', 'questionnaires'],
    defaultTab: 'files',
    roles: ['client']
  },
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
    subtabs: true, // Both roles
    secondarySidebar: false // Removed — not used
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
export function resolveTab(
  tabName: string,
  role: UserRole
): { group: string | null; tab: string } {
  // Check if it's a group
  if (UNIFIED_TAB_GROUPS[tabName] && UNIFIED_TAB_GROUPS[tabName].roles.includes(role)) {
    return { group: tabName, tab: UNIFIED_TAB_GROUPS[tabName].defaultTab };
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
export function canAccessTab(tabId: string, role: UserRole): boolean {
  const navItem = UNIFIED_NAVIGATION.find((item) => item.id === tabId);
  return navItem ? navItem.roles.includes(role) : false;
}
