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
import { mountReactModule, hasReactModule } from '../ReactModuleLoader';
import { loadEjsTable, hasEjsTable } from '../../shared/table-manager/loadEjsTable';
import type { ClientPortalContext } from '../portal-types';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalNavigation');

/** Tab titles mapping */
const TAB_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  'project-detail': 'Project Details',
  files: 'Files',
  messages: 'Messages',
  invoices: 'Invoices',
  approvals: 'Approvals',
  settings: 'Settings',
  'new-project': 'New Project',
  requests: 'Requests',
  help: 'Help',
  documents: 'Document Requests',
  questionnaires: 'Questionnaires',
  review: 'Project Preview',
  onboarding: 'Onboarding',
  work: 'Work',
  docs: 'Documents',
  support: 'Support'
};

/**
 * Map tab names to React module IDs in ReactModuleLoader.
 * ALL client tabs must have a React module — no vanilla fallback.
 */
const TAB_TO_REACT_MODULE: Record<string, string> = {
  dashboard: 'dashboard',
  projects: 'projects',
  'project-detail': 'project-detail',
  files: 'files',
  messages: 'messages',
  invoices: 'invoices',
  approvals: 'approvals',
  settings: 'settings',
  questionnaires: 'questionnaires',
  documents: 'document-requests',
  requests: 'ad-hoc-requests',
  onboarding: 'onboarding',
  help: 'help',
  review: 'review',
  'new-project': 'new-project'
};

/** Track which tab containers have been mounted with React */
const mountedTabs = new Set<string>();

/** Stored module context for React mounting */
let moduleContext: ClientPortalContext | null = null;

/**
 * Set the module context for React component mounting.
 * Must be called during portal initialization.
 */
export function setModuleContext(ctx: ClientPortalContext): void {
  moduleContext = ctx;
}

// ============================================================================
// HASH-BASED ROUTING
// ============================================================================

/** Route configuration mapping tabs to hash paths */
const PORTAL_ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  projects: '/projects',
  'project-detail': '/project-detail',
  files: '/files',
  invoices: '/invoices',
  approvals: '/approvals',
  documents: '/documents',
  questionnaires: '/questionnaires',
  requests: '/requests',
  review: '/review',
  'new-project': '/new-project',
  onboarding: '/onboarding',
  messages: '/messages',
  help: '/help',
  settings: '/settings'
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
    setTimeout(() => {
      isNavigating = false;
    }, 0);
  }
}

/**
 * Navigate to a tab and update URL hash.
 * Callbacks parameter kept for backward compatibility but no longer used.
 */
export function navigateTo(
  tabName: string,
  _callbacks?: Record<string, unknown>
): void {
  // Update hash first
  updateHash(tabName);
  // Then switch tab (without updating hash again)
  switchTab(tabName, {}, false);
}

/**
 * Initialize hash-based router
 * Sets up hashchange listener and navigates to initial tab from URL.
 * Callbacks parameter kept for backward compatibility but no longer used.
 */
export function initHashRouter(_callbacks?: Record<string, unknown>): void {
  // Handle browser back/forward navigation
  window.addEventListener('hashchange', () => {
    // Skip if we triggered this change ourselves
    if (isNavigating) return;

    const tabName = getTabFromHash();
    switchTab(tabName, {}, false);
  });

  // Navigate to initial tab from URL hash
  const initialTab = getTabFromHash();

  // If no hash, set default to dashboard
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    updateHash('dashboard');
  }

  // Switch to the initial tab
  switchTab(initialTab, {}, false);
}

const PORTAL_TAB_GROUPS = {
  work: {
    label: 'Work',
    tabs: ['requests', 'review', 'new-project'],
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
  const entries = Object.entries(PORTAL_TAB_GROUPS) as [
    PortalTabGroup,
    (typeof PORTAL_TAB_GROUPS)[PortalTabGroup],
  ][];
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

// ============================================================================
// SUBTAB HANDLING (mirrors admin pattern)
// ============================================================================

/**
 * Set up event delegation for client portal subtab clicks.
 * Handles both `data-subtab` (settings) and `data-pd-tab` (project-detail) clicks.
 * Dispatches CustomEvents like `settingsSubtabChange` and `projectDetailTabChange`
 * so React views can listen without coupling to EJS DOM.
 */
export function setupClientSubtabHandlers(): void {
  const subtabContainer = document.querySelector('.portal-header-subtabs');
  if (!subtabContainer) return;

  subtabContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.portal-subtab') as HTMLElement | null;
    if (!btn) return;

    // Check both subtab types: data-subtab (settings) and data-pd-tab (project-detail)
    const subtabId = btn.dataset.subtab || btn.dataset.pdTab;
    if (!subtabId) return;

    // Find which group this subtab belongs to
    const group = btn.closest('.header-subtab-group') as HTMLElement | null;
    const forTab = group?.dataset.forTab;
    if (!forTab) return;

    // Update active state within this group
    group.querySelectorAll('.portal-subtab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Dispatch event for React to listen to
    // project-detail → "projectDetailTabChange", settings → "settingsSubtabChange"
    const eventName = forTab === 'project-detail'
      ? 'projectDetailTabChange'
      : `${forTab}SubtabChange`;
    window.dispatchEvent(
      new CustomEvent(eventName, { detail: { subtab: subtabId } })
    );
  });
}

/**
 * Show/hide subtab groups based on active tab.
 * Visibility is primarily driven by CSS data-active-tab / data-active-group
 * selectors on <body>. This JS method handles edge cases where CSS can't
 * cover (e.g., inline style overrides) and also resets the subtab-group
 * default active subtab when returning to a tab.
 */
function updateSubtabGroupVisibility(activeTab: string): void {
  // CSS handles visibility via body[data-active-tab] selectors.
  // Reset active subtab state when entering a group tab (e.g., settings).
  const activeGroup = document.querySelector(`.header-subtab-group[data-for-tab="${activeTab}"]`);
  if (activeGroup) {
    const hasActive = activeGroup.querySelector('.portal-subtab.active');
    if (!hasActive) {
      // Activate the first subtab as default
      const firstBtn = activeGroup.querySelector('.portal-subtab') as HTMLElement | null;
      firstBtn?.classList.add('active');
    }
  }
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
    // Use DOM methods instead of innerHTML to prevent XSS
    titleEl.textContent = '';
    titleEl.appendChild(document.createTextNode(`${welcomeText}, `));
    const nameSpan = document.createElement('span');
    nameSpan.id = 'client-name';
    nameSpan.textContent = currentClientName || '';
    titleEl.appendChild(nameSpan);
    titleEl.appendChild(document.createTextNode('!'));
  } else {
    // Show the individual tab title (not group title)
    const title = TAB_TITLES[currentActiveTab] || 'Dashboard';
    titleEl.textContent = title;
  }
}

/**
 * Switch to a specific tab in the dashboard.
 * Uses the same CSS class toggle pattern as admin:
 * 1. Toggle `.tab-content.active` on EJS-rendered containers
 * 2. Lazy-mount React component on first visit
 *
 * @param tabName - The tab to switch to
 * @param _callbacks - Legacy callbacks (no longer used — all views are React)
 * @param shouldUpdateHash - Whether to update the URL hash (default: true)
 */
export function switchTab(
  tabName: string,
  _callbacks: Record<string, unknown> = {},
  shouldUpdateHash = true
): void {
  // Update URL hash if requested (default behavior)
  if (shouldUpdateHash) {
    updateHash(tabName);
  }
  const resolved = resolvePortalTab(tabName);
  const activeTab = resolved.tab;
  const activeGroup = resolved.group || activeTab;

  // Update nav button active states
  const navButtons = document.querySelectorAll(
    '.nav-btn[data-tab], .sidebar-buttons .btn[data-tab]'
  );
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

  // Show/hide subtab groups based on the active tab
  updateSubtabGroupVisibility(activeTab);

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
      { label: 'Dashboard', href: true, onClick: () => switchTab('dashboard') },
      { label: tabTitle, href: false }
    ]);
  }

  // Toggle .tab-content.active (identical to admin pattern)
  switchTabContent(activeTab);
}

/**
 * Toggle `.tab-content.active` and lazy-mount React on first visit.
 * This is the same pattern as the admin portal's tab switching.
 */
function switchTabContent(activeTab: string): void {
  // 1. Toggle .tab-content.active (like admin)
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.remove('active');
  });
  const container = document.getElementById(`tab-${activeTab}`);
  container?.classList.add('active');

  // 2. Lazy-mount on first visit: try EJS table first, then React
  if (container && !mountedTabs.has(activeTab)) {
    const ejsTableId = `portal-${activeTab}`;

    if (hasEjsTable(ejsTableId)) {
      mountedTabs.add(activeTab);
      logger.log(`Loading EJS table for: ${activeTab} (table: ${ejsTableId})`);
      loadEjsTable(ejsTableId, container).catch((error) => {
        logger.error(`Failed to load EJS table ${ejsTableId}:`, error);
        mountedTabs.delete(activeTab);
      });
    } else {
      const reactModuleId = TAB_TO_REACT_MODULE[activeTab];
      if (reactModuleId && hasReactModule(reactModuleId) && moduleContext) {
        mountedTabs.add(activeTab);
        logger.log(`Mounting React component for: ${activeTab} (module: ${reactModuleId})`);
        mountReactModule(reactModuleId, container, moduleContext).catch((error) => {
          logger.error(`Failed to mount React module ${reactModuleId}:`, error);
          mountedTabs.delete(activeTab);
          container.innerHTML = `
            <div class="portal-main-container">
              <div class="error-state">
                <p>Failed to load ${TAB_TITLES[activeTab] || activeTab}</p>
                <button class="btn btn-secondary" onclick="window.location.reload()">Refresh Page</button>
              </div>
            </div>
          `;
        });
      }
    }
  }
}

/**
 * Force re-mount a tab's React component (e.g., after project selection).
 * Clears the mounted state so the next switchTab will re-mount.
 */
export function remountTab(tabName: string): void {
  mountedTabs.delete(tabName);
  const container = document.getElementById(`tab-${tabName}`);
  if (container) {
    container.innerHTML = '';
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
 * Updates aria-expanded on toggle buttons for accessibility
 */
export function toggleSidebar(): void {
  const sidebar = getSidebar();

  if (!sidebar) {
    logger.error('Sidebar element not found');
    return;
  }

  sidebar.classList.toggle('collapsed');

  // Update aria-expanded on all toggle buttons
  const isCollapsed = sidebar.classList.contains('collapsed');
  const toggleButtons = document.querySelectorAll(
    '#mobile-menu-toggle, #btn-sidebar-toggle, [aria-controls="sidebar"]'
  );
  toggleButtons.forEach((btn) => {
    btn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
  });
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
