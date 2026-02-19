/**
 * Portal Navigation Configuration
 *
 * Single source of truth for both admin and client portal navigation.
 * Changes here automatically reflect in both portals via EJS templates.
 */

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
  navigation: NavItem[];
  subtabGroups?: SubtabGroup[];
  features: {
    secondarySidebar: boolean;
    subtabs: boolean;
    notificationBell: boolean;
    mobileMenuToggle: boolean;
  };
}

// ============================================
// ICON DEFINITIONS (Lucide SVG)
// ============================================

const ICONS = {
  // Sidebar toggle
  panelLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M15 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6"/></svg>',

  // Navigation icons
  gauge: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16Z"/></svg>',
  lineChart: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  fileText: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
  barChart: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  bookOpen: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  logOut: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  logOutClient: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>',

  // Client-specific icons
  messageCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  clipboardList: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
  messageSquare: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>',
  eye: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  helpCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  settingsClient: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>'
};

/**
 * Admin Portal Configuration
 */
const ADMIN_CONFIG: PortalConfig = {
  type: 'admin',
  title: 'Admin Dashboard - No Bhad Codes',
  pageTitle: 'Dashboard',
  authTitle: 'Admin Access',
  authDescription: 'Enter your admin password to continue',
  dashboardId: 'admin-dashboard',
  pageTitleId: 'admin-page-title',
  navigation: [
    { id: 'overview', label: 'Overview', icon: ICONS.gauge, shortcut: '1', active: true },
    { id: 'work', label: 'Projects', icon: ICONS.folder, shortcut: '2', dataTab: 'work' },
    { id: 'workflows', label: 'Workflows', icon: ICONS.lineChart, shortcut: '3' },
    { id: 'crm', label: 'CRM', icon: ICONS.users, shortcut: '4', ariaLabel: 'Clients & Leads' },
    { id: 'documents', label: 'Documents', icon: ICONS.fileText, shortcut: '5' },
    { id: 'analytics', label: 'Analytics', icon: ICONS.barChart, shortcut: '6' },
    { id: 'support', label: 'Knowledge', icon: ICONS.bookOpen, shortcut: '7', ariaLabel: 'Knowledge Base' },
    { id: 'system', label: 'Settings', icon: ICONS.settings, shortcut: '8', ariaLabel: 'System Status' }
  ],
  subtabGroups: [
    {
      forTab: 'work',
      mode: 'primary',
      subtabs: [
        { id: 'projects', label: 'Projects', active: true },
        { id: 'tasks', label: 'Tasks' },
        { id: 'ad-hoc-requests', label: 'Requests' }
      ]
    },
    {
      forTab: 'crm',
      mode: 'primary',
      subtabs: [
        { id: 'leads', label: 'Leads', active: true },
        { id: 'contacts', label: 'Contacts' },
        { id: 'messages', label: 'Messages' },
        { id: 'clients', label: 'Clients' }
      ]
    },
    {
      forTab: 'documents',
      mode: 'primary',
      subtabs: [
        { id: 'invoices', label: 'Invoices', active: true },
        { id: 'contracts', label: 'Contracts' },
        { id: 'document-requests', label: 'Document Requests' },
        { id: 'questionnaires', label: 'Questionnaires' }
      ]
    },
    {
      forTab: 'analytics',
      subtabs: [
        { id: 'overview', label: 'Overview', active: true },
        { id: 'business', label: 'Business' },
        { id: 'visitors', label: 'Visitors' },
        { id: 'reports', label: 'Reports & Alerts' }
      ]
    },
    {
      forTab: 'workflows',
      id: 'workflows-subtabs',
      subtabs: [
        { id: 'approvals', label: 'Approvals', active: true },
        { id: 'triggers', label: 'Triggers' },
        { id: 'email-templates', label: 'Email Templates' }
      ]
    },
    {
      forTab: 'project-detail',
      id: 'project-detail-header-tabs',
      subtabs: [
        { id: 'overview', label: 'Overview', active: true, dataAttr: 'pd-tab' },
        { id: 'files', label: 'Files', dataAttr: 'pd-tab' },
        { id: 'deliverables', label: 'Deliverables', dataAttr: 'pd-tab' },
        { id: 'messages', label: 'Messages', dataAttr: 'pd-tab' },
        { id: 'invoices', label: 'Invoices', dataAttr: 'pd-tab' },
        { id: 'tasks', label: 'Tasks', dataAttr: 'pd-tab' },
        { id: 'time', label: 'Time', dataAttr: 'pd-tab' },
        { id: 'contract', label: 'Contract', dataAttr: 'pd-tab' },
        { id: 'notes', label: 'Notes', dataAttr: 'pd-tab' }
      ]
    },
    {
      forTab: 'client-detail',
      id: 'client-detail-header-tabs',
      subtabs: [
        { id: 'overview', label: 'Overview', active: true, dataAttr: 'cd-tab' },
        { id: 'contacts', label: 'Contacts', dataAttr: 'cd-tab' },
        { id: 'activity', label: 'Activity', dataAttr: 'cd-tab' },
        { id: 'projects', label: 'Projects', dataAttr: 'cd-tab' },
        { id: 'invoices', label: 'Invoices', dataAttr: 'cd-tab' },
        { id: 'notes', label: 'Notes', dataAttr: 'cd-tab' }
      ]
    }
  ],
  features: {
    secondarySidebar: true,
    subtabs: true,
    notificationBell: false,
    mobileMenuToggle: false
  }
};

/**
 * Client Portal Configuration
 */
const CLIENT_CONFIG: PortalConfig = {
  type: 'client',
  title: 'Client Portal - No Bhad Codes',
  pageTitle: 'Welcome Back',
  authTitle: 'Client Portal',
  authDescription: 'Sign in to access your projects and documents',
  dashboardId: 'client-dashboard',
  pageTitleId: 'portal-page-title',
  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.gauge, active: true },
    { id: 'requests', label: 'Requests', icon: ICONS.messageCircle, badge: 'badge-requests' },
    { id: 'questionnaires', label: 'Questionnaires', icon: ICONS.clipboardList, badge: 'badge-questionnaires' },
    { id: 'messages', label: 'Messages', icon: ICONS.messageSquare, badge: 'badge-messages' },
    { id: 'review', label: 'Review', icon: ICONS.eye, dataTab: 'preview' },
    { id: 'documents', label: 'Files', icon: ICONS.fileText, badge: 'badge-documents', dataTab: 'files' },
    { id: 'help', label: 'Help', icon: ICONS.helpCircle },
    { id: 'settings', label: 'Settings', icon: ICONS.settingsClient }
  ],
  features: {
    secondarySidebar: false,
    subtabs: false,
    notificationBell: true,
    mobileMenuToggle: true
  }
};

/**
 * Get portal configuration by type
 */
export function getPortalConfig(portalType: 'admin' | 'client'): PortalConfig {
  return portalType === 'admin' ? ADMIN_CONFIG : CLIENT_CONFIG;
}

/**
 * Export both configs for direct access
 */
export const PORTAL_CONFIGS = {
  admin: ADMIN_CONFIG,
  client: CLIENT_CONFIG
} as const;

/**
 * Export icons for use in templates
 */
export { ICONS };

/**
 * Tab content IDs that need to be rendered (admin only)
 */
export const ADMIN_TAB_IDS = [
  'overview',
  'leads',
  'contacts',
  'projects',
  'clients',
  'invoices',
  'contracts',
  'ad-hoc-requests',
  'tasks',
  'client-detail',
  'messages',
  'analytics',
  'document-requests',
  'questionnaires',
  'knowledge-base',
  'system',
  'project-detail',
  'workflows'
];
