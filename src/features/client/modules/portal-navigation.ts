/**
 * ===============================================
 * PORTAL NAVIGATION MODULE
 * ===============================================
 * @file src/features/client/modules/portal-navigation.ts
 *
 * Navigation and view management for client portal.
 * Handles sidebar, tabs, mobile menu, breadcrumbs, and view switching.
 */

import { renderBreadcrumbs, type BreadcrumbItem } from '../../../components/breadcrumbs';
import { authStore } from '../../../auth/auth-store';
import { renderView } from './portal-views';

/** Tab titles mapping */
const TAB_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  files: 'Files',
  messages: 'Messages',
  invoices: 'Invoices',
  settings: 'Settings',
  'new-project': 'New Project',
  requests: 'Requests',
  help: 'Help',
  documents: 'Document Requests',
  questionnaires: 'Questionnaires',
  preview: 'Project Preview',
  work: 'Work',
  docs: 'Documents',
  support: 'Support'
};

// ============================================================================
// HASH-BASED ROUTING
// ============================================================================

/** Route configuration mapping tabs to hash paths */
const PORTAL_ROUTES: Record<string, string> = {
  'dashboard': '/dashboard',
  'files': '/files',
  'invoices': '/invoices',
  'documents': '/documents',
  'questionnaires': '/questionnaires',
  'requests': '/requests',
  'preview': '/review',
  'new-project': '/new-project',
  'messages': '/messages',
  'help': '/help',
  'settings': '/settings'
};

/** Reverse mapping from hash path to tab name */
const HASH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(PORTAL_ROUTES).map(([tab, hash]) => [hash, tab])
);

/** Flag to prevent re-entrant hash updates */
let isNavigating = false;

/**
 * Get tab name from current URL hash
 * Returns 'dashboard' if hash is invalid or empty
 */
export function getTabFromHash(): string {
  const hash = window.location.hash;
  if (!hash || hash === '#' || hash === '#/') {
    return 'dashboard';
  }

  // Remove leading # and normalize
  const path = hash.startsWith('#') ? hash.slice(1) : hash;

  // Check if it matches a known route
  if (HASH_TO_TAB[path]) {
    return HASH_TO_TAB[path];
  }

  // Invalid hash - return dashboard
  return 'dashboard';
}

/**
 * Update URL hash without triggering navigation
 * Resolves group names (work, docs, support) to their default tabs
 */
function updateHash(tabName: string): void {
  // Resolve group names to their actual tab
  const resolved = resolvePortalTab(tabName);
  const actualTab = resolved.tab;

  const hashPath = PORTAL_ROUTES[actualTab] || '/dashboard';
  const newHash = `#${hashPath}`;

  // Only update if different to avoid unnecessary history entries
  if (window.location.hash !== newHash) {
    isNavigating = true;
    window.location.hash = newHash;
    // Reset flag after a tick to allow hashchange to be ignored
    setTimeout(() => { isNavigating = false; }, 0);
  }
}

/**
 * Navigate to a tab and update URL hash
 */
export function navigateTo(
  tabName: string,
  callbacks: {
    loadFiles: () => Promise<void>;
    loadInvoices: () => Promise<void>;
    loadProjectPreview: () => Promise<void>;
    loadMessagesFromAPI: () => Promise<void>;
    loadHelp?: () => Promise<void>;
    loadDocumentRequests?: () => Promise<void>;
    loadAdHocRequests?: () => Promise<void>;
    loadQuestionnaires?: () => Promise<void>;
    loadSettings?: () => Promise<void>;
    loadDashboard?: () => Promise<void>;
  }
): void {
  // Update hash first
  updateHash(tabName);
  // Then switch tab (without updating hash again)
  switchTab(tabName, callbacks, false);
}

/**
 * Initialize hash-based router
 * Sets up hashchange listener and navigates to initial tab from URL
 */
export function initHashRouter(callbacks: {
  loadFiles: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadProjectPreview: () => Promise<void>;
  loadMessagesFromAPI: () => Promise<void>;
  loadHelp?: () => Promise<void>;
  loadDocumentRequests?: () => Promise<void>;
  loadAdHocRequests?: () => Promise<void>;
  loadQuestionnaires?: () => Promise<void>;
  loadSettings?: () => Promise<void>;
  loadDashboard?: () => Promise<void>;
}): void {
  // Handle browser back/forward navigation
  window.addEventListener('hashchange', () => {
    // Skip if we triggered this change ourselves
    if (isNavigating) return;

    const tabName = getTabFromHash();
    switchTab(tabName, callbacks, false);
  });

  // Navigate to initial tab from URL hash
  const initialTab = getTabFromHash();

  // If no hash, set default to dashboard
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    updateHash('dashboard');
  }

  // Switch to the initial tab
  switchTab(initialTab, callbacks, false);
}

const PORTAL_TAB_GROUPS = {
  work: {
    label: 'Work',
    tabs: ['requests', 'preview', 'new-project'],
    defaultTab: 'requests'
  },
  docs: {
    label: 'Documents',
    tabs: ['files', 'invoices', 'documents', 'questionnaires'],
    defaultTab: 'files'
  },
  support: {
    label: 'Support',
    tabs: ['messages', 'help'],
    defaultTab: 'messages'
  }
} as const;

type PortalTabGroup = keyof typeof PORTAL_TAB_GROUPS;

function getPortalGroupForTab(tabName: string): PortalTabGroup | null {
  const entries = Object.entries(PORTAL_TAB_GROUPS) as [PortalTabGroup, typeof PORTAL_TAB_GROUPS[PortalTabGroup]][];
  for (const [group, config] of entries) {
    if ((config.tabs as readonly string[]).includes(tabName)) return group;
  }
  return null;
}

function resolvePortalTab(tabName: string): { group: PortalTabGroup | null; tab: string } {
  if (tabName in PORTAL_TAB_GROUPS) {
    const group = tabName as PortalTabGroup;
    return { group, tab: PORTAL_TAB_GROUPS[group].defaultTab };
  }

  return { group: getPortalGroupForTab(tabName), tab: tabName };
}

/** All portal view IDs */
const VIEW_IDS = [
  'welcome-view',
  'settings-view',
  'contact-view',
  'billing-view',
  'notifications-view',
  'project-detail-view',
  'updates-view',
  'files-view',
  'messages-view',
  'content-view'
] as const;

// ============================================================================
// CACHED DOM REFERENCES
// ============================================================================

/** Cached view elements by ID */
const cachedViews: Map<string, HTMLElement | null> = new Map();

/** Cached button elements by ID */
const cachedButtons: Map<string, HTMLElement | null> = new Map();

/** Other cached elements */
let cachedSidebar: HTMLElement | null | undefined;
let cachedMobileHeaderTitle: HTMLElement | null | undefined;
let cachedBreadcrumbList: HTMLElement | null | undefined;
let cachedAccountList: HTMLElement | null | undefined;
let cachedAccountHeader: HTMLElement | null | undefined;
let cachedPortalPageTitle: HTMLElement | null | undefined;

/** Get cached view element */
function getView(viewId: string): HTMLElement | null {
  if (!cachedViews.has(viewId)) {
    cachedViews.set(viewId, document.getElementById(viewId));
  }
  return cachedViews.get(viewId) ?? null;
}

/** Get cached button element */
function getButton(buttonId: string): HTMLElement | null {
  if (!cachedButtons.has(buttonId)) {
    cachedButtons.set(buttonId, document.getElementById(buttonId));
  }
  return cachedButtons.get(buttonId) ?? null;
}

/** Get cached sidebar */
function getSidebar(): HTMLElement | null {
  if (cachedSidebar === undefined) {
    cachedSidebar = document.getElementById('sidebar');
  }
  return cachedSidebar;
}

/** Get cached mobile header title */
function getMobileHeaderTitle(): HTMLElement | null {
  if (cachedMobileHeaderTitle === undefined) {
    cachedMobileHeaderTitle = document.getElementById('mobile-header-title');
  }
  return cachedMobileHeaderTitle;
}

/** Get cached breadcrumb list */
function getBreadcrumbList(): HTMLElement | null {
  // Always re-query if not found (element may be hidden initially)
  if (cachedBreadcrumbList === undefined || cachedBreadcrumbList === null) {
    cachedBreadcrumbList = document.getElementById('breadcrumb-list');
  }
  return cachedBreadcrumbList;
}

/** Get cached account list */
function getAccountList(): HTMLElement | null {
  if (cachedAccountList === undefined) {
    cachedAccountList = document.querySelector('.account-list') as HTMLElement | null;
  }
  return cachedAccountList;
}

/** Get cached account header */
function getAccountHeader(): HTMLElement | null {
  if (cachedAccountHeader === undefined) {
    cachedAccountHeader = document.querySelector('.account-header') as HTMLElement | null;
  }
  return cachedAccountHeader;
}

/** Get cached portal page title */
function getPortalPageTitle(): HTMLElement | null {
  if (cachedPortalPageTitle === undefined) {
    cachedPortalPageTitle = document.getElementById('portal-page-title');
  }
  return cachedPortalPageTitle;
}

/** Store the current client name for use in page title */
let currentClientName = 'Client';

/** Store the current active tab */
let currentActiveTab = 'dashboard';

/**
 * Set the client name (called after login)
 * Updates both the stored value and the page title if on dashboard
 */
export function setClientName(name: string): void {
  currentClientName = name || 'Client';
  // Update the page title if we're on dashboard
  if (currentActiveTab === 'dashboard') {
    updatePortalPageTitle('dashboard');
  }
}

/**
 * Update the portal page header title based on current tab
 */
export function updatePortalPageTitle(tabName: string): void {
  const titleEl = getPortalPageTitle();
  if (!titleEl) return;

  const resolved = resolvePortalTab(tabName);
  currentActiveTab = resolved.tab;

  // Special case for dashboard - show "Welcome to the portal" on first login, "Welcome Back" on return visits
  if (currentActiveTab === 'dashboard') {
    const { isFirstLogin } = authStore.getState();
    const welcomeText = isFirstLogin ? 'Welcome to the Portal' : 'Welcome Back';
    titleEl.innerHTML = `${welcomeText}, <span id="client-name">${currentClientName}</span>!`;
  } else {
    // Show the individual tab title (not group title)
    const title = TAB_TITLES[currentActiveTab] || 'Dashboard';
    titleEl.textContent = title;
  }
}

/**
 * Switch to a specific tab in the dashboard
 * @param tabName - The tab to switch to
 * @param callbacks - Data loading callbacks for each tab
 * @param shouldUpdateHash - Whether to update the URL hash (default: true)
 */
export function switchTab(tabName: string, callbacks: {
  loadFiles: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadProjectPreview: () => Promise<void>;
  loadMessagesFromAPI: () => Promise<void>;
  loadHelp?: () => Promise<void>;
  loadDocumentRequests?: () => Promise<void>;
  loadAdHocRequests?: () => Promise<void>;
  loadQuestionnaires?: () => Promise<void>;
  loadSettings?: () => Promise<void>;
  loadDashboard?: () => Promise<void>;
}, shouldUpdateHash = true): void {
  // Update URL hash if requested (default behavior)
  if (shouldUpdateHash) {
    updateHash(tabName);
  }
  const resolved = resolvePortalTab(tabName);
  const activeTab = resolved.tab;
  const activeGroup = resolved.group || activeTab;

  // Render the view dynamically
  renderView(activeTab);

  // Update nav button active states
  const navButtons = document.querySelectorAll('.nav-btn[data-tab], .sidebar-buttons .btn[data-tab]');
  navButtons.forEach((btn) => {
    btn.classList.remove('active');
    btn.removeAttribute('aria-current');
    if ((btn as HTMLElement).dataset.tab === activeGroup) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
    }
  });

  document.body.dataset.activeGroup = activeGroup;
  document.body.dataset.activeTab = activeTab;

  // Class-based fallback for mobile CSS targeting (more reliable than data attributes in some browsers)
  document.body.classList.remove('messages-tab-active', 'files-tab-active', 'help-tab-active');
  if (activeTab === 'messages') {
    document.body.classList.add('messages-tab-active');
  } else if (activeTab === 'files') {
    document.body.classList.add('files-tab-active');
  } else if (activeTab === 'help') {
    document.body.classList.add('help-tab-active');
  }

  const headerGroup = document.querySelector(`.header-subtab-group[data-for-tab="${activeGroup}"]`);
  if (headerGroup && (headerGroup as HTMLElement).dataset.mode === 'primary') {
    headerGroup.querySelectorAll('.portal-subtab').forEach((btn) => {
      btn.classList.toggle('active', (btn as HTMLElement).dataset.subtab === activeTab);
    });
  }

  // Update mobile header title
  updateMobileHeaderTitle(activeTab);

  // Update portal page header title
  updatePortalPageTitle(activeTab);

  // Update breadcrumbs based on current tab
  const tabTitle = TAB_TITLES[activeTab] || 'Dashboard';
  if (activeTab === 'dashboard') {
    updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
  } else {
    updateBreadcrumbs([
      { label: 'Dashboard', href: true, onClick: () => switchTab('dashboard', callbacks) },
      { label: tabTitle, href: false }
    ]);
  }

  // Load tab-specific data
  if (activeTab === 'dashboard' && callbacks.loadDashboard) {
    callbacks.loadDashboard();
  } else if (activeTab === 'files') {
    callbacks.loadFiles();
  } else if (activeTab === 'invoices') {
    callbacks.loadInvoices();
  } else if (activeTab === 'preview') {
    callbacks.loadProjectPreview();
  } else if (activeTab === 'messages') {
    callbacks.loadMessagesFromAPI();
  } else if (activeTab === 'help' && callbacks.loadHelp) {
    callbacks.loadHelp();
  } else if (activeTab === 'documents' && callbacks.loadDocumentRequests) {
    callbacks.loadDocumentRequests();
  } else if (activeTab === 'requests' && callbacks.loadAdHocRequests) {
    callbacks.loadAdHocRequests();
  } else if (activeTab === 'questionnaires' && callbacks.loadQuestionnaires) {
    callbacks.loadQuestionnaires();
  } else if (activeTab === 'settings' && callbacks.loadSettings) {
    callbacks.loadSettings();
  }
}

/**
 * Update the mobile header title based on current tab
 */
export function updateMobileHeaderTitle(tabName: string): void {
  const mobileHeaderTitle = getMobileHeaderTitle();
  if (!mobileHeaderTitle) return;
  const resolved = resolvePortalTab(tabName);
  // Show individual tab title (not group title)
  const title = TAB_TITLES[resolved.tab] || 'Dashboard';
  mobileHeaderTitle.textContent = title;
}

/**
 * Hide all portal views
 */
export function hideAllViews(): void {
  VIEW_IDS.forEach((viewId) => {
    const view = getView(viewId);
    if (view) {
      view.style.display = 'none';
    }
  });
}

/**
 * Clear active state from all navigation items
 */
function clearActiveStates(): void {
  document
    .querySelectorAll('.project-item, .account-item, .project-subitem')
    .forEach((item) => item.classList.remove('active'));
}

/**
 * Show settings view
 */
export function showSettings(loadUserSettings: () => void): void {
  hideAllViews();
  const settingsView = getView('settings-view');
  if (settingsView) {
    settingsView.style.display = 'block';
    loadUserSettings();
  }
  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
}

/**
 * Show billing view
 */
export function showBillingView(loadBillingSettings: () => void): void {
  hideAllViews();

  const billingView = getView('billing-view');
  if (billingView) {
    billingView.style.display = 'block';
    loadBillingSettings();
  }

  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
  const billingBtn = getButton('billing-btn');
  if (billingBtn) billingBtn.classList.add('active');
}

/**
 * Show contact view
 */
export function showContactView(loadContactSettings: () => void): void {
  hideAllViews();
  const contactView = getView('contact-view');
  if (contactView) {
    contactView.style.display = 'block';
    loadContactSettings();
  }
  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
  const contactBtn = getButton('contact-btn');
  if (contactBtn) contactBtn.classList.add('active');
}

/**
 * Show notifications view
 */
export function showNotificationsView(loadNotificationSettings: () => void): void {
  hideAllViews();
  const notificationsView = getView('notifications-view');
  if (notificationsView) {
    notificationsView.style.display = 'block';
    loadNotificationSettings();
  }
  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
  const notificationsBtn = getButton('notifications-btn');
  if (notificationsBtn) notificationsBtn.classList.add('active');
}

/**
 * Show updates view
 */
export function showUpdatesView(): void {
  hideAllViews();
  const updatesView = getView('updates-view');
  if (updatesView) {
    updatesView.style.display = 'block';
  }
  clearActiveStates();
  const updatesBtn = getButton('updates-btn');
  if (updatesBtn) updatesBtn.classList.add('active');
}

/**
 * Show files view
 */
export function showFilesView(): void {
  hideAllViews();
  const filesView = getView('files-view');
  if (filesView) {
    filesView.style.display = 'block';
  }
  clearActiveStates();
  const filesBtn = getButton('files-btn');
  if (filesBtn) filesBtn.classList.add('active');
}

/**
 * Show messages view
 */
export function showMessagesView(): void {
  hideAllViews();
  const messagesView = getView('messages-view');
  if (messagesView) {
    messagesView.style.display = 'block';
  }
  clearActiveStates();
  const messagesBtn = getButton('messages-btn');
  if (messagesBtn) messagesBtn.classList.add('active');
}

/**
 * Show content view
 */
export function showContentView(): void {
  hideAllViews();
  const contentView = getView('content-view');
  if (contentView) {
    contentView.style.display = 'block';
  }
  clearActiveStates();
  const contentBtn = getButton('content-btn');
  if (contentBtn) contentBtn.classList.add('active');
}

/**
 * Show project detail view (overview)
 */
export function showProjectDetailView(showWelcomeViewFn: () => void): void {
  hideAllViews();
  const projectDetailView = getView('project-detail-view');
  if (projectDetailView) {
    projectDetailView.style.display = 'block';
  }
  clearActiveStates();
  const projectMain = getButton('project-main');
  if (projectMain) projectMain.classList.add('active');

  updateBreadcrumbs([
    { label: 'Dashboard', href: true, onClick: showWelcomeViewFn },
    { label: 'Your Website Project', href: false }
  ]);
}

/**
 * Show welcome view (dashboard home)
 */
export function showWelcomeView(): void {
  hideAllViews();
  const welcomeView = getView('welcome-view');
  if (welcomeView) {
    welcomeView.style.display = 'block';
  }
  clearActiveStates();
  updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
}

/**
 * Update breadcrumb navigation (uses shared breadcrumbs component)
 */
export function updateBreadcrumbs(breadcrumbs: BreadcrumbItem[]): void {
  const breadcrumbList = getBreadcrumbList();
  if (!breadcrumbList) return;
  renderBreadcrumbs(breadcrumbList, breadcrumbs);
}

/**
 * Toggle sidebar collapsed/expanded state (desktop)
 */
export function toggleSidebar(): void {
  const sidebar = getSidebar();

  if (!sidebar) {
    console.error('Sidebar element not found');
    return;
  }

  sidebar.classList.toggle('collapsed');
}

/**
 * Toggle account folder expanded/collapsed state
 */
export function toggleAccountFolder(): void {
  const accountList = getAccountList();
  const accountHeader = getAccountHeader();

  if (!accountList || !accountHeader) return;

  const isCollapsed = accountList.classList.contains('collapsed');

  if (isCollapsed) {
    // Expand folder
    accountList.classList.remove('collapsed');
    accountHeader.classList.add('expanded');
  } else {
    // Collapse folder
    accountList.classList.add('collapsed');
    accountHeader.classList.remove('expanded');
    // Clear any active account items when collapsing
    document.querySelectorAll('.account-item').forEach((item) => item.classList.remove('active'));

    // Hide the main content views when collapsing account
    const welcomeView = getView('welcome-view');
    const settingsView = getView('settings-view');
    const billingView = getView('billing-view');

    if (settingsView && settingsView.style.display !== 'none') {
      if (welcomeView) welcomeView.style.display = 'block';
      if (settingsView) settingsView.style.display = 'none';
      if (billingView) billingView.style.display = 'none';
    }
  }
}
