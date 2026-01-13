/**
 * ===============================================
 * PORTAL NAVIGATION MODULE
 * ===============================================
 * @file src/features/client/modules/portal-navigation.ts
 *
 * Navigation and view management for client portal.
 * Handles sidebar, tabs, mobile menu, breadcrumbs, and view switching.
 */

/** Breadcrumb item structure */
interface BreadcrumbItem {
  label: string;
  href: boolean;
  onClick?: () => void;
}

/** Tab titles mapping */
const TAB_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  files: 'Files',
  messages: 'Messages',
  invoices: 'Invoices',
  settings: 'Settings',
  'new-project': 'New Project',
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
];

/**
 * Switch to a specific tab in the dashboard
 */
export function switchTab(tabName: string, callbacks: {
  loadFiles: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadProjectPreview: () => Promise<void>;
  loadMessagesFromAPI: () => Promise<void>;
}): void {
  // Hide all tab content
  const allTabContent = document.querySelectorAll('.tab-content');
  allTabContent.forEach((tab) => tab.classList.remove('active'));

  // Show the selected tab content
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.add('active');
  }

  // Update nav button active states
  const navButtons = document.querySelectorAll('.nav-btn[data-tab]');
  navButtons.forEach((btn) => {
    btn.classList.remove('active');
    if ((btn as HTMLElement).dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });

  // Update mobile header title
  updateMobileHeaderTitle(tabName);

  // Load tab-specific data
  if (tabName === 'files') {
    callbacks.loadFiles();
  } else if (tabName === 'invoices') {
    callbacks.loadInvoices();
  } else if (tabName === 'preview') {
    callbacks.loadProjectPreview();
  } else if (tabName === 'messages') {
    callbacks.loadMessagesFromAPI();
  }
}

/**
 * Update the mobile header title based on current tab
 */
export function updateMobileHeaderTitle(tabName: string): void {
  const mobileHeaderTitle = document.getElementById('mobile-header-title');
  if (!mobileHeaderTitle) return;
  mobileHeaderTitle.textContent = TAB_TITLES[tabName] || 'Dashboard';
}

/**
 * Hide all portal views
 */
export function hideAllViews(): void {
  VIEW_IDS.forEach((viewId) => {
    const view = document.getElementById(viewId);
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
  const settingsView = document.getElementById('settings-view');
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

  const billingView = document.getElementById('billing-view');
  if (billingView) {
    billingView.style.display = 'block';
    loadBillingSettings();
  }

  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
  const billingBtn = document.getElementById('billing-btn');
  if (billingBtn) billingBtn.classList.add('active');
}

/**
 * Show contact view
 */
export function showContactView(loadContactSettings: () => void): void {
  hideAllViews();
  const contactView = document.getElementById('contact-view');
  if (contactView) {
    contactView.style.display = 'block';
    loadContactSettings();
  }
  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
  const contactBtn = document.getElementById('contact-btn');
  if (contactBtn) contactBtn.classList.add('active');
}

/**
 * Show notifications view
 */
export function showNotificationsView(loadNotificationSettings: () => void): void {
  hideAllViews();
  const notificationsView = document.getElementById('notifications-view');
  if (notificationsView) {
    notificationsView.style.display = 'block';
    loadNotificationSettings();
  }
  document
    .querySelectorAll('.project-item, .account-item')
    .forEach((item) => item.classList.remove('active'));
  const notificationsBtn = document.getElementById('notifications-btn');
  if (notificationsBtn) notificationsBtn.classList.add('active');
}

/**
 * Show updates view
 */
export function showUpdatesView(): void {
  hideAllViews();
  const updatesView = document.getElementById('updates-view');
  if (updatesView) {
    updatesView.style.display = 'block';
  }
  clearActiveStates();
  const updatesBtn = document.getElementById('updates-btn');
  if (updatesBtn) updatesBtn.classList.add('active');
}

/**
 * Show files view
 */
export function showFilesView(): void {
  hideAllViews();
  const filesView = document.getElementById('files-view');
  if (filesView) {
    filesView.style.display = 'block';
  }
  clearActiveStates();
  const filesBtn = document.getElementById('files-btn');
  if (filesBtn) filesBtn.classList.add('active');
}

/**
 * Show messages view
 */
export function showMessagesView(): void {
  hideAllViews();
  const messagesView = document.getElementById('messages-view');
  if (messagesView) {
    messagesView.style.display = 'block';
  }
  clearActiveStates();
  const messagesBtn = document.getElementById('messages-btn');
  if (messagesBtn) messagesBtn.classList.add('active');
}

/**
 * Show content view
 */
export function showContentView(): void {
  hideAllViews();
  const contentView = document.getElementById('content-view');
  if (contentView) {
    contentView.style.display = 'block';
  }
  clearActiveStates();
  const contentBtn = document.getElementById('content-btn');
  if (contentBtn) contentBtn.classList.add('active');
}

/**
 * Show project detail view (overview)
 */
export function showProjectDetailView(showWelcomeViewFn: () => void): void {
  hideAllViews();
  const projectDetailView = document.getElementById('project-detail-view');
  if (projectDetailView) {
    projectDetailView.style.display = 'block';
  }
  clearActiveStates();
  const projectMain = document.getElementById('project-main');
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
  const welcomeView = document.getElementById('welcome-view');
  if (welcomeView) {
    welcomeView.style.display = 'block';
  }
  clearActiveStates();
  updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
}

/**
 * Update breadcrumb navigation
 */
export function updateBreadcrumbs(breadcrumbs: BreadcrumbItem[]): void {
  const breadcrumbList = document.getElementById('breadcrumb-list');
  if (!breadcrumbList) return;

  breadcrumbList.innerHTML = '';

  breadcrumbs.forEach((crumb, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'breadcrumb-item';

    if (crumb.href && crumb.onClick) {
      const link = document.createElement('button');
      link.className = 'breadcrumb-link';
      link.textContent = crumb.label;
      link.onclick = crumb.onClick;
      listItem.appendChild(link);
    } else {
      const span = document.createElement('span');
      span.className = 'breadcrumb-current';
      span.textContent = crumb.label;
      listItem.appendChild(span);
    }

    breadcrumbList.appendChild(listItem);

    // Add separator if not last item
    if (index < breadcrumbs.length - 1) {
      const separator = document.createElement('li');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '>';
      breadcrumbList.appendChild(separator);
    }
  });
}

/**
 * Toggle sidebar collapsed/expanded state (desktop)
 */
export function toggleSidebar(): void {
  const sidebar = document.getElementById('sidebar');

  if (!sidebar) {
    console.error('Sidebar element not found');
    return;
  }

  sidebar.classList.toggle('collapsed');
}

/**
 * Toggle mobile menu (hamburger)
 */
export function toggleMobileMenu(): void {
  const sidebar = document.getElementById('sidebar');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileOverlay = document.getElementById('mobile-overlay');

  if (!sidebar || !mobileMenuToggle) {
    console.error('Mobile menu elements not found');
    return;
  }

  const isOpen = sidebar.classList.contains('mobile-open');

  if (isOpen) {
    closeMobileMenu();
  } else {
    sidebar.classList.add('mobile-open');
    mobileMenuToggle.classList.add('active');
    mobileOverlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Close mobile menu
 */
export function closeMobileMenu(): void {
  const sidebar = document.getElementById('sidebar');
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileOverlay = document.getElementById('mobile-overlay');

  sidebar?.classList.remove('mobile-open');
  mobileMenuToggle?.classList.remove('active');
  mobileOverlay?.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Toggle account folder expanded/collapsed state
 */
export function toggleAccountFolder(): void {
  const accountList = document.querySelector('.account-list') as HTMLElement;
  const accountHeader = document.querySelector('.account-header');

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
    const welcomeView = document.getElementById('welcome-view');
    const settingsView = document.getElementById('settings-view');
    const billingView = document.getElementById('billing-view');

    if (settingsView && settingsView.style.display !== 'none') {
      if (welcomeView) welcomeView.style.display = 'block';
      if (settingsView) settingsView.style.display = 'none';
      if (billingView) billingView.style.display = 'none';
    }
  }
}
