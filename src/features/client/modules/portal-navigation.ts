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

/** Tab titles mapping */
const TAB_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  files: 'Files',
  messages: 'Messages',
  invoices: 'Invoices',
  settings: 'Settings',
  'new-project': 'New Project',
  help: 'Help',
  documents: 'Document Requests',
  preview: 'Project Preview'
};

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
  if (cachedBreadcrumbList === undefined) {
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

/**
 * Switch to a specific tab in the dashboard
 */
export function switchTab(tabName: string, callbacks: {
  loadFiles: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadProjectPreview: () => Promise<void>;
  loadMessagesFromAPI: () => Promise<void>;
  loadHelp?: () => Promise<void>;
  loadDocumentRequests?: () => Promise<void>;
}): void {
  // Hide all tab content
  const allTabContent = document.querySelectorAll('.tab-content');
  allTabContent.forEach((tab) => tab.classList.remove('active'));

  // Show the selected tab content - use cache for tabs
  if (!cachedViews.has(`tab-${tabName}`)) {
    cachedViews.set(`tab-${tabName}`, document.getElementById(`tab-${tabName}`));
  }
  const targetTab = cachedViews.get(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Update nav button active states
  const navButtons = document.querySelectorAll('.nav-btn[data-tab], .sidebar-buttons .btn[data-tab]');
  navButtons.forEach((btn) => {
    btn.classList.remove('active');
    btn.removeAttribute('aria-current');
    if ((btn as HTMLElement).dataset.tab === tabName) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
    }
  });

  // Update mobile header title
  updateMobileHeaderTitle(tabName);

  // Update breadcrumbs based on current tab
  const tabTitle = TAB_TITLES[tabName] || 'Dashboard';
  if (tabName === 'dashboard') {
    updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
  } else {
    updateBreadcrumbs([
      { label: 'Dashboard', href: true, onClick: () => switchTab('dashboard', callbacks) },
      { label: tabTitle, href: false }
    ]);
  }

  // Load tab-specific data
  if (tabName === 'files') {
    callbacks.loadFiles();
  } else if (tabName === 'invoices') {
    callbacks.loadInvoices();
  } else if (tabName === 'preview') {
    callbacks.loadProjectPreview();
  } else if (tabName === 'messages') {
    callbacks.loadMessagesFromAPI();
  } else if (tabName === 'help' && callbacks.loadHelp) {
    callbacks.loadHelp();
  } else if (tabName === 'documents' && callbacks.loadDocumentRequests) {
    callbacks.loadDocumentRequests();
  }
}

/**
 * Update the mobile header title based on current tab
 */
export function updateMobileHeaderTitle(tabName: string): void {
  const mobileHeaderTitle = getMobileHeaderTitle();
  if (!mobileHeaderTitle) return;
  mobileHeaderTitle.textContent = TAB_TITLES[tabName] || 'Dashboard';
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
