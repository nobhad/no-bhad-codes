/**
 * ===============================================
 * ADMIN EVENT SETUP
 * ===============================================
 * @file src/features/admin/admin-event-setup.ts
 *
 * Sets up event listeners for the admin dashboard including
 * tab navigation, sidebar, modals, refresh buttons, and header group navigation.
 */

import { AdminAuth } from './admin-auth';
import { createLogger } from '../../utils/logger';
import { ADMIN_TAB_TITLES, ADMIN_TAB_GROUPS } from './admin-tab-manager';
import type { createDOMCache } from '../../utils/dom-cache';

const logger = createLogger('AdminEvents');

type DOMCacheInstance = ReturnType<typeof createDOMCache>;

/** Callbacks the event setup needs from the dashboard */
export interface EventSetupCallbacks {
  switchTab: (tab: string) => void;
  switchTabInternal: (tab: string) => void;
  toggleSidebar: () => void;
  loadTabData: (tab: string) => Promise<void>;
  loadContactSubmissions: () => void;
  loadAnalyticsData: () => void;
  loadSystemInfo: () => void;
  handleLogout: () => Promise<void>;
  showLoading: (show: boolean) => void;
  applyAttentionFilter: (tabName: string, filter: string) => void;
  filterTable: (tableName: string, filter: string) => void;
  exportData: (type: string) => void;
  clearOldData: () => void;
  resetAnalytics: () => void;
}

/**
 * Set up all dashboard event listeners.
 */
export function setupEventListeners(
  domCache: DOMCacheInstance,
  callbacks: EventSetupCallbacks
): void {
  logger.log('setupEventListeners() called');

  // Handle browser back/forward navigation
  window.addEventListener('popstate', (_e) => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || 'dashboard';
    if (ADMIN_TAB_TITLES[tab]) {
      callbacks.switchTabInternal(tab);
    }
  });

  // Logout button - try direct query first, then fallback to domCache
  const logoutBtn =
    document.getElementById('btn-logout') ||
    document.getElementById('logout-btn') ||
    document.querySelector('.btn-logout') ||
    domCache.get('logoutBtn') ||
    domCache.get('btnLogout');
  logger.log('logoutBtn found:', !!logoutBtn);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      logger.log('Logout button clicked');
      try {
        await AdminAuth.logout();
      } catch (error) {
        logger.error('Logout failed:', error);
        window.location.href = '/admin';
      }
    });
  }

  // Document-level event delegation for logout button (fallback for CSS blocking)
  document.addEventListener(
    'click',
    async (e) => {
      const target = e.target as HTMLElement;
      const logoutButton = target.closest('#btn-logout, #logout-btn, .btn-logout');
      if (logoutButton) {
        logger.log('Logout detected via document delegation');
        e.preventDefault();
        e.stopPropagation();
        try {
          await AdminAuth.logout();
        } catch (error) {
          logger.error('Logout via delegation failed:', error);
          window.location.href = '/admin';
        }
      }
    },
    true
  );

  // Details overlay - close panels when clicking overlay
  const detailsOverlay = document.getElementById('details-overlay');
  if (detailsOverlay) {
    detailsOverlay.addEventListener('click', () => {
      detailsOverlay.classList.add('hidden');
      detailsOverlay.classList.remove('open');
    });
  }

  // Tab navigation - old style (.tab-btn)
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLButtonElement;
      const tabName = target.dataset.tab;
      if (tabName) {
        callbacks.switchTab(tabName);
      }
    });
  });

  // Tab navigation - new portal style (sidebar buttons with data-tab)
  const sidebarButtons = document.querySelectorAll('.sidebar-buttons .btn[data-tab]');
  logger.log('Found sidebar buttons:', sidebarButtons.length);
  sidebarButtons.forEach((btn, index) => {
    const tabName = (btn as HTMLElement).dataset.tab;
    logger.log(`Setting up button ${index}: ${tabName}`);
    btn.addEventListener('click', (e) => {
      logger.log('Button clicked!', tabName);
      e.preventDefault();
      e.stopPropagation();
      if (tabName) {
        logger.log('Switching to tab:', tabName);
        callbacks.switchTab(tabName);
      }
    });
  });

  setupHeaderGroupNavigation();

  // Clickable stat cards
  const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
  statCards.forEach((card) => {
    card.addEventListener('click', () => {
      const tabName = (card as HTMLElement).dataset.tab;
      if (tabName) {
        callbacks.switchTab(tabName);
      }
    });
  });

  // Clickable attention cards (dashboard "Needs Attention" section)
  const attentionCards = document.querySelectorAll('.attention-card[data-tab]');
  attentionCards.forEach((card) => {
    card.addEventListener('click', () => {
      const tabName = (card as HTMLElement).dataset.tab;
      const filter = (card as HTMLElement).dataset.filter;
      if (tabName) {
        callbacks.switchTab(tabName);
        if (filter) {
          callbacks.applyAttentionFilter(tabName, filter);
        }
      }
    });
  });

  // Filter stat cards for leads and projects tables
  const filterCards = document.querySelectorAll('.stat-card-clickable[data-filter]');
  filterCards.forEach((card) => {
    card.addEventListener('click', () => {
      const filter = (card as HTMLElement).dataset.filter;
      const table = (card as HTMLElement).dataset.table;
      if (filter && table) {
        callbacks.filterTable(table, filter);
        const siblingCards = document.querySelectorAll(
          `.stat-card-clickable[data-table="${table}"]`
        );
        siblingCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
      }
    });
  });

  // Sidebar toggle buttons
  const sidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
  sidebarToggles.forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      callbacks.toggleSidebar();
    });
  });

  const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      callbacks.toggleSidebar();
    });
  }

  // Theme toggle in global header
  const headerThemeToggle = document.getElementById('header-toggle-theme');
  if (headerThemeToggle) {
    headerThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      try {
        localStorage.setItem('theme', newTheme);
      } catch (_error) {
        // Ignore storage errors
      }
    });
  }

  // Refresh leads button
  const refreshLeadsBtn = domCache.get('refreshLeadsBtn');
  if (refreshLeadsBtn) {
    refreshLeadsBtn.addEventListener('click', () => {
      callbacks.loadTabData('leads');
    });
  }

  // Refresh analytics button
  const refreshAnalytics = domCache.get('refreshAnalytics');
  if (refreshAnalytics) {
    refreshAnalytics.addEventListener('click', () => {
      callbacks.loadAnalyticsData();
    });
  }

  // Export buttons
  setupExportButtons(domCache, callbacks);

  // Data management buttons
  setupDataManagementButtons(domCache, callbacks);

  // Extend session on activity
  document.addEventListener('click', () => {
    AdminAuth.extendSession();
  });

  document.addEventListener('keydown', () => {
    AdminAuth.extendSession();
  });

  // Load initial data
  callbacks.loadTabData('leads');
  callbacks.loadContactSubmissions();
  callbacks.loadSystemInfo();

  // Refresh contacts button
  const refreshContactsBtn = domCache.get('refreshContactsBtn');
  if (refreshContactsBtn) {
    refreshContactsBtn.addEventListener('click', () => {
      callbacks.loadContactSubmissions();
    });
  }

  // Refresh projects button
  const refreshProjectsBtn = domCache.get('refreshProjectsBtn');
  if (refreshProjectsBtn) {
    refreshProjectsBtn.addEventListener('click', () => {
      callbacks.loadTabData('projects');
    });
  }

  // Load projects data
  callbacks.loadTabData('projects');

  // Modal close buttons
  setupModalHandlers(domCache);
}

/**
 * Set up modal close button handlers.
 */
function setupModalHandlers(domCache: DOMCacheInstance): void {
  const modal = domCache.get('detailModal');
  const closeBtn = domCache.get('modalCloseBtn');
  const closeFooterBtn = domCache.get('modalCloseBtnFooter');
  const overlay = domCache.get('detailModal');

  const closeModal = () => {
    if (modal) {
      modal.style.display = 'none';
    }
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
}

/**
 * Set up export button event listeners.
 */
function setupExportButtons(
  domCache: DOMCacheInstance,
  callbacks: EventSetupCallbacks
): void {
  const exportAnalytics = domCache.get('exportAnalytics');
  const exportVisitors = domCache.get('exportVisitors');
  const exportPerformance = domCache.get('exportPerformance');

  if (exportAnalytics) {
    exportAnalytics.addEventListener('click', () => callbacks.exportData('analytics'));
  }
  if (exportVisitors) {
    exportVisitors.addEventListener('click', () => callbacks.exportData('visitors'));
  }
  if (exportPerformance) {
    exportPerformance.addEventListener('click', () => callbacks.exportData('performance'));
  }
}

/**
 * Set up data management button event listeners.
 */
function setupDataManagementButtons(
  domCache: DOMCacheInstance,
  callbacks: EventSetupCallbacks
): void {
  const clearOldData = domCache.get('clearOldData');
  const resetAnalytics = domCache.get('resetAnalytics');

  if (clearOldData) {
    clearOldData.addEventListener('click', () => callbacks.clearOldData());
  }
  if (resetAnalytics) {
    resetAnalytics.addEventListener('click', () => callbacks.resetAnalytics());
  }
}

/**
 * Set up header group navigation (subtab click delegation).
 */
function setupHeaderGroupNavigation(): void {
  logger.log('setupHeaderGroupNavigation called');

  if (document.body.dataset.subtabHandlersV2) {
    logger.log('Handlers already attached (body dataset), skipping');
    return;
  }
  document.body.dataset.subtabHandlersV2 = 'true';
  logger.log('Attaching subtab handlers');

  const updateSubtabActiveState = (
    group: HTMLElement,
    activeValue: string,
    dataAttr: string
  ): void => {
    group.querySelectorAll('.portal-subtab').forEach((btn) => {
      const btnValue = (btn as HTMLElement).dataset[dataAttr];
      btn.classList.toggle('active', btnValue === activeValue);
    });
  };

  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest(
      '.header-subtab-group .portal-subtab'
    ) as HTMLElement | null;
    if (!target) return;

    const group = target.closest('.header-subtab-group') as HTMLElement | null;
    if (!group) return;

    const forTab = group.dataset.forTab;
    const _mode = group.dataset.mode?.replace(/["']/g, '');

    const subtab = target.dataset.subtab;

    // TAB GROUPS - dispatch events for internal view switching
    if (forTab && forTab in ADMIN_TAB_GROUPS) {
      if (!subtab) return;
      updateSubtabActiveState(group, subtab, 'subtab');
      const eventName = forTab === 'support' ? 'knowledgeBase' : forTab;
      document.dispatchEvent(new CustomEvent(`${eventName}SubtabChange`, { detail: { subtab } }));
      return;
    }

    // Project Detail
    if (forTab === 'project-detail') {
      const tabName = target.dataset.pdTab;
      if (!tabName) return;
      updateSubtabActiveState(group, tabName, 'pdTab');
      document.dispatchEvent(new CustomEvent('projectDetailTabChange', { detail: { tabName } }));
      return;
    }

    // Client Detail
    if (forTab === 'client-detail') {
      const tabName = target.dataset.cdTab;
      if (!tabName) return;
      updateSubtabActiveState(group, tabName, 'cdTab');
      document.dispatchEvent(new CustomEvent('clientDetailTabChange', { detail: { tabName } }));
    }
  });
}
