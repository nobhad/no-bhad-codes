/**
 * ===============================================
 * ADMIN DASHBOARD CONTROLLER
 * ===============================================
 * @file src/features/admin/admin-dashboard.ts
 *
 * Secure admin dashboard for performance and analytics monitoring.
 * Only accessible with proper authentication.
 */

import { AdminSecurity } from './admin-security';
import { AdminAuth } from './admin-auth';
import { authStore } from '../../auth/auth-store';
import type { AdminUser } from '../../auth/auth-types';
import { AdminProjectDetails } from './admin-project-details';
import type { PerformanceMetrics, PerformanceAlert } from '../../services/performance-service';
import { SanitizationUtils } from '../../utils/sanitization-utils';
import type {
  AdminDashboardContext,
  AnalyticsEvent,
  Lead,
  ContactSubmission,
  Project,
  Message,
  ContactStats
} from './admin-types';
import { APP_CONSTANTS, getChartColor, getChartColorWithAlpha } from '../../config/constants';
import { configureApiClient, apiFetch, apiPost, apiPut } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { createDOMCache } from '../../utils/dom-cache';
import { formatDate, formatDateTime, formatProjectType } from '../../utils/format-utils';
import { confirmDanger, alertError, alertSuccess, alertInfo } from '../../utils/confirm-dialog';
import { showToast } from '../../utils/toast-notifications';
import { manageFocusTrap } from '../../utils/focus-trap';
import { renderBreadcrumbs, type BreadcrumbItem } from '../../components/breadcrumbs';
import { createTableDropdown } from '../../utils/table-dropdown';
import { getStatusDotHTML } from '../../components/status-badge';
import {
  initCopyEmailDelegation,
  getCopyEmailButtonHtml,
  getEmailWithCopyHtml
} from '../../utils/copy-email';
import { closeAllModalOverlays } from '../../utils/modal-utils';
import { initAdminCommandPalette, destroyAdminCommandPalette } from './admin-command-palette';
import { initKeyboardHelp } from '../../components/keyboard-help';
import { showTableEmpty } from '../../utils/loading-utils';
import { initPortalHeader, type PortalHeader } from '../shared/portal-header';

// DOM element keys for caching
type DashboardDOMKeys = Record<string, string>;

const logger = createLogger('AdminDashboard');

// React module loader - direct React mounting without vanilla JS fallback
import { mountReactModule, hasReactModule } from './ReactModuleLoader';

// Deliverables module initialization (event delegation for deliverables modal)
import { initializeDeliverablesModule } from './modules/admin-deliverables';

// Chart.js is loaded dynamically to reduce initial bundle size
let Chart: typeof import('chart.js').Chart | null = null;

async function loadChartJS(): Promise<typeof import('chart.js').Chart> {
  if (!Chart) {
    const chartModule = await import('chart.js');
    chartModule.Chart.register(...chartModule.registerables);
    Chart = chartModule.Chart;
  }
  return Chart;
}

// Type definitions
interface PerformanceReport {
  score: number;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
}

interface PerformanceMetricDisplay {
  value: string;
  status: string;
}

interface PerformanceMetricsDisplay {
  lcp: PerformanceMetricDisplay;
  fid: PerformanceMetricDisplay;
  cls: PerformanceMetricDisplay;
  ttfb: PerformanceMetricDisplay;
  score: number;
  grade: string;
  bundleSize?: {
    total: string;
    main: string;
    vendor: string;
  };
  alerts?: string[];
}

// NOTE: AnalyticsData, RawVisitorData, ApplicationStatus, VisitorInfo
// types are defined in admin-types.ts and used by modules

/** Admin tab titles for dynamic page header */
const ADMIN_TAB_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads',
  contacts: 'Contacts',
  projects: 'Projects',
  clients: 'Clients',
  invoices: 'Invoices',
  contracts: 'Contracts',
  tasks: 'Tasks',
  messages: 'Messages',
  analytics: 'Analytics',
  'document-requests': 'Document Requests',
  'ad-hoc-requests': 'Ad Hoc Requests',
  questionnaires: 'Questionnaires',
  support: 'Knowledge Base',
  system: 'System Status',
  workflows: 'Workflows',
  work: 'Work',
  crm: 'CRM',
  documents: 'Documents',
  'client-detail': 'Client Details',
  'project-detail': 'Project Details'
};

// Tab groups that use INTERNAL VIEW pattern (one component handles all subtabs)
// These dispatch events instead of calling switchTab() for each subtab
const ADMIN_TAB_GROUPS = {
  work: {
    label: 'Work',
    tabs: ['overview', 'projects', 'tasks', 'ad-hoc-requests'],
    defaultTab: 'overview'
  },
  crm: {
    label: 'CRM',
    tabs: ['overview', 'leads', 'contacts', 'messages', 'clients'],
    defaultTab: 'overview'
  },
  documents: {
    label: 'Documents',
    tabs: ['overview', 'invoices', 'contracts', 'document-requests', 'questionnaires'],
    defaultTab: 'overview'
  },
  workflows: {
    label: 'Workflows',
    tabs: ['overview', 'approvals', 'triggers', 'email-templates'],
    defaultTab: 'overview'
  },
  support: {
    label: 'Knowledge Base',
    tabs: ['overview', 'categories', 'articles'],
    defaultTab: 'overview'
  },
  analytics: {
    label: 'Analytics',
    tabs: ['overview', 'revenue', 'leads', 'projects'],
    defaultTab: 'overview'
  }
} as const;

type AdminTabGroup = keyof typeof ADMIN_TAB_GROUPS;

function getAdminGroupForTab(tabName: string): AdminTabGroup | null {
  const entries = Object.entries(ADMIN_TAB_GROUPS) as [
    AdminTabGroup,
    (typeof ADMIN_TAB_GROUPS)[AdminTabGroup],
  ][];
  for (const [group, config] of entries) {
    if ((config.tabs as readonly string[]).includes(tabName)) return group;
  }
  return null;
}

// Groups that have a parent dashboard component (mount the group, not the defaultTab)
const GROUPS_WITH_PARENT_COMPONENT = ['analytics', 'workflows', 'support', 'work', 'crm', 'documents'] as const;

function resolveAdminTab(tabName: string): { group: AdminTabGroup | null; tab: string } {
  if (tabName in ADMIN_TAB_GROUPS) {
    const group = tabName as AdminTabGroup;
    // If this group has a parent component, return the group name as the tab
    // The parent component handles subtab switching internally
    if ((GROUPS_WITH_PARENT_COMPONENT as readonly string[]).includes(group)) {
      return { group, tab: group };
    }
    // For groups without parent components, resolve to defaultTab
    return { group, tab: ADMIN_TAB_GROUPS[group].defaultTab };
  }

  return { group: getAdminGroupForTab(tabName), tab: tabName };
}

// Dashboard data management
class AdminDashboard {
  private currentTab = 'dashboard';
  private currentGroup: string | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private charts: Map<string, { destroy: () => void }> = new Map();

  // Store data for detail views
  private leadsData: Lead[] = [];
  private contactsData: ContactSubmission[] = [];
  private projectsData: Project[] = [];

  // Module context for code-split modules
  private moduleContext: AdminDashboardContext;

  // Project details handler
  private projectDetails: AdminProjectDetails;

  // Clients module reference for breadcrumbs
  // Note: Client name is now managed by the React ClientDetail component

  // DOM element cache
  private domCache = createDOMCache<DashboardDOMKeys>();

  // Focus trap cleanup function for detail modal
  private focusTrapCleanup: (() => void) | null = null;

  // Delegate currentProjectId to project details handler
  private get currentProjectId(): number | null {
    return this.projectDetails.getCurrentProjectId();
  }

  private set currentProjectId(value: number | null) {
    // Note: Setting handled by projectDetails.showProjectDetails()
    // This setter exists for compatibility with existing code
    if (value === null) {
      // Reset by switching tabs - handled in switchTab method
    }
  }

  constructor() {
    // Register DOM element selectors for caching
    this.domCache.register({
      authGate: '#auth-gate',
      adminDashboard: '#admin-dashboard',
      adminLoginForm: '#admin-login-form',
      adminPassword: '#admin-password',
      passwordToggle: '#password-toggle',
      authError: '#auth-error',
      sidebar: '#sidebar',
      refreshLeadsBtn: '#refresh-leads-btn',
      refreshAnalytics: '#refresh-analytics',
      refreshContactsBtn: '#refresh-contacts-btn',
      refreshProjectsBtn: '#refresh-projects-btn',
      logoutBtn: '#logout-btn',
      btnLogout: '#btn-logout',
      detailModal: '#detail-modal',
      modalCloseBtn: '#modal-close-btn',
      modalCloseBtnFooter: '#modal-close-btn-footer',
      modalTitle: '#modal-title',
      modalBody: '#modal-body',
      inviteLeadBtn: '#invite-lead-btn',
      contactsTableBody: '#contacts-table-body',
      contactNewCount: '#contact-new-count',
      sysVersion: '#sys-version',
      sysEnvironment: '#sys-environment',
      sysBuildDate: '#sys-build-date',
      sysUseragent: '#sys-useragent',
      sysScreen: '#sys-screen',
      sysViewport: '#sys-viewport',
      statVisitors: '#stat-visitors',
      analyticsVisitors: '#analytics-visitors',
      analyticsPageviews: '#analytics-pageviews',
      analyticsSessions: '#analytics-sessions',
      adminMessagesThread: '#admin-messages-thread',
      adminMessagesContainer: '#admin-messages-container',
      adminMessageText: '#admin-message-text',
      adminSendMessage: '#admin-send-message',
      exportAnalytics: '#export-analytics',
      exportVisitors: '#export-visitors',
      exportPerformance: '#export-performance',
      clearOldData: '#clear-old-data',
      resetAnalytics: '#reset-analytics',
      loadingIndicator: '#loading-indicator',
      performanceDashboardContainer: '#performance-dashboard-container',
      performanceTab: '#performance-tab',
      performanceAlerts: '#performance-alerts',
      leadsTableBody: '#leads-table-body',
      projectsTableBody: '#projects-table-body',
      clientsTableBody: '#clients-table-body',
      invoicesTableBody: '#invoices-table-body',
      crmBadge: '#crm-badge'
    });

    // Initialize module context
    this.moduleContext = {
      getAuthToken: () => sessionStorage.getItem('client_auth_mode'),
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') =>
        this.showNotification(message, type),
      refreshData: () => this.loadDashboardData(),
      switchTab: (tab: string) => this.switchTab(tab)
    };

    // Configure API client for token expiration handling
    configureApiClient({
      showNotification: (message: string, type: 'error' | 'warning' | 'success' | 'info') =>
        this.showNotification(message, type),
      onSessionExpired: () => {
        // Let the default handler redirect to /admin login
      }
    });

    // Initialize project details handler
    this.projectDetails = new AdminProjectDetails();
    this.init();
  }

  private async init(): Promise<void> {
    logger.log('init() called');
    // Initialize security measures first
    AdminSecurity.init();

    // Safety: ensure no admin modals are blocking the login gate
    this.hideAllAdminModals();

    // Check authentication first
    const isAuthenticated = await this.checkAuthentication();

    if (!isAuthenticated) {
      logger.log('Not authenticated, showing auth gate');
      AdminAuth.setApiAuthenticated(false);
      this.setupAuthGate();
      return;
    }

    // User is authenticated - mark as authenticated via API
    AdminAuth.setApiAuthenticated(true);

    // User is authenticated - show dashboard
    this.showDashboard();

    // Update time-of-day greeting
    this.updateGreeting();

    // Initialize navigation and theme modules
    await this.initializeModules();

    // Initialize command palette (Linear-style ⌘K)
    this.initializeCommandPalette();

    // Initialize keyboard shortcut help (press ?)
    initKeyboardHelp();

    // Set up the dashboard
    logger.log('Setting up dashboard');
    this.setupEventListeners();
    initCopyEmailDelegation(document);
    logger.log('setupEventListeners complete');
    await this.loadDashboardData();
    this.handleInitialNavigation();
    this.setupTruncatedTextTooltips();
    this.updateSidebarBadges();
    this.startAutoRefresh();
  }

  private handleInitialNavigation(): void {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const projectIdParam = params.get('projectId');

    // Ensure URL shows /admin (not /admin/login) after successful auth
    if (window.location.pathname === '/admin/login') {
      const url = new URL(window.location.href);
      url.pathname = '/admin';
      window.history.replaceState({}, '', url.toString());
    }

    // Navigate to specified tab (switchTab handles URL updates)
    if (tab && ADMIN_TAB_TITLES[tab]) {
      this.switchTab(tab);
    }

    if (projectIdParam) {
      const projectId = Number(projectIdParam);
      if (!Number.isNaN(projectId)) {
        this.showProjectDetails(projectId);
        const url = new URL(window.location.href);
        url.searchParams.delete('projectId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }

  /**
   * Hide any open admin modals so the auth gate is accessible.
   */
  private hideAllAdminModals(): void {
    closeAllModalOverlays({ unlockBody: true });
    document.body.classList.remove('modal-open');

    const overlays = document.querySelectorAll<HTMLElement>('.admin-modal-overlay, .modal-overlay');

    overlays.forEach((overlay) => {
      overlay.classList.add('hidden');
      overlay.classList.remove('open');
      overlay.removeAttribute('aria-labelledby');
      overlay.removeAttribute('aria-modal');
      overlay.removeAttribute('role');
    });
  }

  /**
   * Sets up fast custom tooltips for truncated text elements
   * Uses data-tooltip attribute for instant CSS-based tooltips
   */
  private setupTruncatedTextTooltips(): void {
    // Helper to add tooltip if text is truncated
    const addTooltipIfTruncated = (element: HTMLElement): void => {
      const text = element.textContent?.trim();
      if (!text || text === '-') return;

      // Only add tooltip if content is actually truncated
      // Check if scrollWidth > clientWidth (text overflows)
      if (element.scrollWidth > element.clientWidth || text.length > 30) {
        element.setAttribute('data-tooltip', text);
        // Remove native title to avoid double tooltip
        element.removeAttribute('title');
      }
    };

    // Find all elements with truncation classes
    const truncatedElements = document.querySelectorAll(
      '.truncate-text, .message-cell, [class*="ellipsis"]'
    );
    truncatedElements.forEach((el) => addTooltipIfTruncated(el as HTMLElement));

    // Also set up a mutation observer to handle dynamically added content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            // Check child elements
            const truncated = node.querySelectorAll(
              '.truncate-text, .message-cell, [class*="ellipsis"]'
            );
            truncated.forEach((el) => {
              if (!el.hasAttribute('data-tooltip')) {
                addTooltipIfTruncated(el as HTMLElement);
              }
            });
            // Check if the node itself is truncated
            if (
              node.classList?.contains('truncate-text') ||
              node.classList?.contains('message-cell')
            ) {
              if (!node.hasAttribute('data-tooltip')) {
                addTooltipIfTruncated(node);
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Initialize the command palette (Linear-style ⌘K)
   */
  private initializeCommandPalette(): void {
    initAdminCommandPalette({
      switchTab: (tab: string) => this.switchTab(tab),
      logout: () => this.handleLogout()
    });
    logger.log('Command palette initialized');
  }

  /**
   * Clean up command palette on logout/destroy
   */
  private cleanupCommandPalette(): void {
    destroyAdminCommandPalette();
  }

  private async checkAuthentication(): Promise<boolean> {
    // Try to validate session by calling an admin-only endpoint
    // Retry logic handles race condition when backend starts slower than frontend
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 500;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await apiFetch('/api/admin/leads');

        // 503 = backend starting up, retry
        if (response.status === 503) {
          if (attempt < MAX_RETRIES) {
            logger.log(
              `Backend starting up (attempt ${attempt}), retrying in ${RETRY_DELAY_MS}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
        }

        // If we get 200, we're authenticated as admin
        // If we get 401/403, we're not authenticated
        return response.ok;
      } catch (error) {
        // Network error - backend might not be ready yet
        if (attempt < MAX_RETRIES) {
          logger.log(`Auth check attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        } else {
          logger.log('Auth check failed after all retries:', error);
        }
      }
    }
    return false;
  }

  private setupAuthGate(): void {
    const authGate = this.domCache.get('authGate');
    const dashboard = this.domCache.get('adminDashboard');
    const loginForm = this.domCache.get('adminLoginForm');
    const passwordInput = this.domCache.getAs<HTMLInputElement>('adminPassword');
    const passwordToggle = this.domCache.get('passwordToggle');
    const authError = this.domCache.get('authError');
    const passwordPromptKey = 'nbw_password_prompted';

    if (authGate) authGate.style.display = 'flex';
    if (dashboard) dashboard.style.display = 'none';

    if (loginForm && sessionStorage.getItem(passwordPromptKey) === '1') {
      loginForm.setAttribute('autocomplete', 'off');
      passwordInput?.setAttribute('autocomplete', 'off');
    }

    // Password toggle
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
      });
    }

    // Login form submission
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authError) authError.textContent = '';

        if (sessionStorage.getItem(passwordPromptKey) !== '1') {
          sessionStorage.setItem(passwordPromptKey, '1');
          loginForm.setAttribute('autocomplete', 'off');
          passwordInput?.setAttribute('autocomplete', 'off');
        }

        const password = passwordInput?.value;
        if (!password) return;

        const submitBtn = loginForm.querySelector('.auth-submit') as HTMLButtonElement;
        const btnText = submitBtn?.querySelector('.btn-text') as HTMLElement;
        const btnLoading = submitBtn?.querySelector('.btn-loading') as HTMLElement;

        if (submitBtn) submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline';

        try {
          const response = await apiPost('/api/auth/admin/login', { password });

          if (response.ok) {
            // Reload page to show dashboard
            window.location.reload();
          } else {
            const data = await response.json();
            if (authError) authError.textContent = data.error || 'Invalid password';
          }
        } catch (error) {
          logger.error(' Login error:', error);
          if (authError) authError.textContent = 'Connection error. Please try again.';
        } finally {
          if (submitBtn) submitBtn.disabled = false;
          if (btnText) btnText.style.display = 'inline';
          if (btnLoading) btnLoading.style.display = 'none';
        }
      });
    }
  }

  private showDashboard(): void {
    const authGate = this.domCache.get('authGate');
    const dashboard = this.domCache.get('adminDashboard');

    if (authGate) authGate.style.display = 'none';
    if (dashboard) {
      dashboard.classList.remove('hidden');
      dashboard.style.display = '';
    }
    // Hide header, nav overlay, and footer when showing dashboard
    const adminHeader = document.querySelector('.admin-header');
    const adminNav = document.querySelector('.admin-nav');
    const adminFooter = document.querySelector('.admin-footer');
    if (adminHeader) (adminHeader as HTMLElement).style.display = 'none';
    if (adminNav) (adminNav as HTMLElement).style.display = 'none';
    if (adminFooter) (adminFooter as HTMLElement).style.display = 'none';
    // Add logged-in class to body to hide header/footer
    document.body.classList.add('admin-logged-in');
    // Show initial breadcrumb (Dashboard)
    this.updateAdminBreadcrumbs(this.currentTab);
    this.updateActiveGroupState(getAdminGroupForTab(this.currentTab), this.currentTab);
  }

  /**
   * Update the page header greeting based on time of day
   * Only shown on the Overview tab
   */
  private updateGreeting(tab?: string): void {
    const greetingEl = document.getElementById('page-header-greeting');
    if (!greetingEl) return;

    const currentTab = tab || this.currentTab;

    // Only show greeting on Dashboard tab
    if (currentTab !== 'dashboard') {
      greetingEl.style.display = 'none';
      return;
    }

    const hour = new Date().getHours();
    let greeting: string;

    if (hour < 12) {
      greeting = 'Good morning';
    } else if (hour < 17) {
      greeting = 'Good afternoon';
    } else {
      greeting = 'Good evening';
    }

    // Get authenticated user name from auth store
    const currentUser = authStore.getCurrentUser() as AdminUser | null;
    let displayName = 'Admin';
    if (currentUser) {
      // Prefer username, then extract from email, fallback to 'Admin'
      if (currentUser.username) {
        displayName = currentUser.username;
      } else if (currentUser.email) {
        // Extract name from email (before @)
        displayName = currentUser.email.split('@')[0];
        // Capitalize first letter
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      }
    }

    greetingEl.innerHTML = `${greeting}, <b>${SanitizationUtils.escapeHtml(displayName)}</b>`;
    greetingEl.style.display = '';
  }

  /** Reference to shared portal header instance */
  private portalHeader: PortalHeader | null = null;

  private async initializeModules(): Promise<void> {
    // Initialize deliverables manager module
    initializeDeliverablesModule();

    // Initialize shared portal header (notification bell, theme toggle)
    this.portalHeader = await initPortalHeader({ role: 'admin' });
  }

  private setupEventListeners(): void {
    logger.log('setupEventListeners() called');

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (_e) => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      if (ADMIN_TAB_TITLES[tab]) {
        // Use internal tab switch without updating URL (already updated by popstate)
        this.switchTabInternal(tab);
      }
    });

    // Logout button - try direct query first, then fallback to domCache
    const logoutBtn =
      document.getElementById('btn-logout') ||
      document.getElementById('logout-btn') ||
      document.querySelector('.btn-logout') ||
      this.domCache.get('logoutBtn') ||
      this.domCache.get('btnLogout');
    logger.log('logoutBtn found:', !!logoutBtn);
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        logger.log('Logout button clicked');
        try {
          // Use AdminAuth.logout() to properly clear admin session
          await AdminAuth.logout();
        } catch (error) {
          logger.error('Logout failed:', error);
          // Force redirect on error
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
            // Force redirect on error
            window.location.href = '/admin';
          }
        }
      },
      true
    ); // Use capture phase to catch events before they're blocked

    // Details overlay - close panels when clicking overlay
    const detailsOverlay = document.getElementById('details-overlay');
    if (detailsOverlay) {
      detailsOverlay.addEventListener('click', () => {
        // Hide the overlay - React components handle their own panel state
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
          this.switchTab(tabName);
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
          this.switchTab(tabName);
        }
      });
    });

    this.setupHeaderGroupNavigation();

    // Clickable stat cards
    const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
    statCards.forEach((card) => {
      card.addEventListener('click', () => {
        const tabName = (card as HTMLElement).dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
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
          this.switchTab(tabName);
          // Apply filter if specified
          if (filter) {
            this.applyAttentionFilter(tabName, filter);
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
          this.filterTable(table, filter);
          // Update active state on filter cards
          const siblingCards = document.querySelectorAll(
            `.stat-card-clickable[data-table="${table}"]`
          );
          siblingCards.forEach((c) => c.classList.remove('active'));
          card.classList.add('active');
        }
      });
    });

    // Sidebar toggle - multiple buttons, one per tab (legacy)
    const sidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
    sidebarToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    });

    // New sidebar toggle button (in sidebar)
    const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }

    // Mobile sidebar overlay - close on click
    const overlay = document.getElementById('sidebar-overlay');
    overlay?.addEventListener('click', () => this.closeMobileSidebar());

    // Close mobile drawer on nav to any tab
    document.querySelectorAll('.sidebar-buttons .btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (window.innerWidth < 768) {
          this.closeMobileSidebar();
        }
      });
    });

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
    const refreshLeadsBtn = this.domCache.get('refreshLeadsBtn');
    if (refreshLeadsBtn) {
      refreshLeadsBtn.addEventListener('click', () => {
        this.loadLeads();
      });
    }

    // Refresh buttons
    const refreshAnalytics = this.domCache.get('refreshAnalytics');
    if (refreshAnalytics) {
      refreshAnalytics.addEventListener('click', () => {
        this.loadAnalyticsData();
      });
    }

    // Export buttons
    this.setupExportButtons();

    // Data management buttons
    this.setupDataManagementButtons();

    // Extend session on activity
    document.addEventListener('click', () => {
      AdminAuth.extendSession();
    });

    document.addEventListener('keydown', () => {
      AdminAuth.extendSession();
    });

    // Load initial data
    this.loadLeads();
    this.loadContactSubmissions();
    this.loadSystemInfo();

    // NOTE: Message listeners are setup when the Messages tab is rendered
    // (see switchTab 'messages' case) to ensure DOM elements exist

    // Refresh contacts button
    const refreshContactsBtn = this.domCache.get('refreshContactsBtn');
    if (refreshContactsBtn) {
      refreshContactsBtn.addEventListener('click', () => {
        this.loadContactSubmissions();
      });
    }

    // Refresh projects button
    const refreshProjectsBtn = this.domCache.get('refreshProjectsBtn');
    if (refreshProjectsBtn) {
      refreshProjectsBtn.addEventListener('click', () => {
        this.loadProjects();
      });
    }

    // Load projects data
    this.loadProjects();

    // Modal close buttons
    this.setupModalHandlers();
  }

  private setupModalHandlers(): void {
    const modal = this.domCache.get('detailModal');
    const closeBtn = this.domCache.get('modalCloseBtn');
    const closeFooterBtn = this.domCache.get('modalCloseBtnFooter');
    const overlay = this.domCache.get('detailModal');

    const closeModal = () => {
      if (modal) {
        modal.style.display = 'none';
        // Clean up focus trap when modal closes
        if (this.focusTrapCleanup) {
          this.focusTrapCleanup();
          this.focusTrapCleanup = null;
        }
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Note: Escape key handling is now managed by the focus trap
  }

  private toggleSidebar(): void {
    const sidebar = this.domCache.get('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const page = document.querySelector('[data-page="admin"]');
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile: toggle drawer open/close
      sidebar?.classList.toggle('mobile-open');
      overlay?.classList.toggle('open');
    } else {
      // Desktop: collapse/expand
      sidebar?.classList.toggle('collapsed');
      // Update data attribute for CSS icon flip
      const isCollapsed = sidebar?.classList.contains('collapsed');
      page?.setAttribute('data-sidebar-collapsed', isCollapsed ? 'true' : 'false');
    }
  }

  private closeMobileSidebar(): void {
    const sidebar = this.domCache.get('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('open');
  }

  private async loadLeads(): Promise<void> {
    // React component handles its own data loading
    const tabContainer = document.getElementById('tab-leads');
    if (tabContainer) {
      await mountReactModule('leads', tabContainer, this.moduleContext);
    }
  }

  // NOTE: updateLeadsDisplay moved to admin-leads module

  private async loadContactSubmissions(): Promise<void> {
    try {
      const response = await apiFetch('/api/admin/contact-submissions');

      if (response.ok) {
        const data = await response.json();
        this.updateContactsDisplay(data);
      }
    } catch (error) {
      logger.error(' Failed to load contact submissions:', error);
    }
  }

  private updateContactsDisplay(data: {
    submissions: ContactSubmission[];
    stats: ContactStats;
  }): void {
    // Store contacts data for detail views
    this.contactsData = data.submissions || [];

    // Update new count badge
    const newCountBadge = this.domCache.get('contactNewCount');
    if (newCountBadge) {
      const newCount = data.stats?.new || 0;
      if (newCount > 0) {
        newCountBadge.textContent = `${newCount} new`;
        newCountBadge.classList.add('has-new');
      } else {
        newCountBadge.classList.remove('has-new');
      }
    }

    // Update contacts table
    const tableBody = this.domCache.get('contactsTableBody');
    if (tableBody && data.submissions) {
      if (data.submissions.length === 0) {
        showTableEmpty(tableBody, 6, 'No contact form submissions yet');
      } else {
        tableBody.innerHTML = data.submissions
          .map((submission: ContactSubmission) => {
            const date = formatDate(submission.created_at);
            // Decode HTML entities then sanitize to prevent XSS
            const decodedName = SanitizationUtils.decodeHtmlEntities(submission.name || '');
            const decodedMessage = SanitizationUtils.decodeHtmlEntities(submission.message || '');
            const safeName = SanitizationUtils.escapeHtml(decodedName);
            const safeEmail = SanitizationUtils.escapeHtml(
              SanitizationUtils.decodeHtmlEntities(submission.email || '')
            );
            const safeSubject = SanitizationUtils.escapeHtml(
              SanitizationUtils.decodeHtmlEntities(submission.subject || '')
            );
            const safeMessage = SanitizationUtils.escapeHtml(decodedMessage);
            // Truncate message for display (after sanitization)
            const truncateLen = APP_CONSTANTS.TEXT.TRUNCATE_LENGTH;
            const truncatedMessage =
              safeMessage.length > truncateLen
                ? `${safeMessage.substring(0, truncateLen)}...`
                : safeMessage;
            // For title attribute, also escape
            const safeTitleMessage = SanitizationUtils.escapeHtml(decodedMessage);
            return `
            <tr data-contact-id="${submission.id}">
              <td class="date-cell" data-label="Date">${date}</td>
              <td class="name-cell" data-label="Name">${safeName}</td>
              <td class="email-cell meta-value-with-copy" data-label="Email">${safeEmail} ${getCopyEmailButtonHtml(submission.email || '')}</td>
              <td class="name-cell" data-label="Subject">${safeSubject}</td>
              <td class="message-cell" data-label="Message" title="${safeTitleMessage}">${truncatedMessage}</td>
              <td class="status-cell" data-label="Status">
                <div class="contact-status-dropdown-container" data-contact-id="${submission.id}"></div>
              </td>
            </tr>
          `;
          })
          .join('');

        // Add click handlers to rows (for viewing details)
        const rows = tableBody.querySelectorAll('tr[data-contact-id]');
        rows.forEach((row) => {
          row.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.table-dropdown')) return;
            const contactId = parseInt((row as HTMLElement).dataset.contactId || '0');
            this.showContactDetails(contactId);
          });
        });

        // Reusable dropdown for contact status (dashboard uses 'replied', not 'responded')
        const DASHBOARD_CONTACT_STATUS_OPTIONS = [
          { value: 'new', label: 'New' },
          { value: 'read', label: 'Read' },
          { value: 'replied', label: 'Replied' },
          { value: 'archived', label: 'Archived' }
        ];
        const dropdownContainers = tableBody.querySelectorAll('.contact-status-dropdown-container');
        dropdownContainers.forEach((container) => {
          const contactId = (container as HTMLElement).dataset.contactId;
          const _row = container.closest('tr');
          const submission = data.submissions.find(
            (s: ContactSubmission) => String(s.id) === contactId
          );
          if (!submission || !contactId) return;
          const dropdown = createTableDropdown({
            options: DASHBOARD_CONTACT_STATUS_OPTIONS,
            currentValue: submission.status || 'new',
            showStatusDot: true,
            onChange: (value: string) => {
              this.updateContactStatus(parseInt(contactId, 10), value);
            }
          });
          container.appendChild(dropdown);
        });
      }
    }
  }

  private async updateContactStatus(id: number, status: string): Promise<void> {
    try {
      const response = await apiPut(`/api/admin/contact-submissions/${id}/status`, { status });

      if (response.ok) {
        logger.log('Contact status updated');
        // Refresh to update counts
        this.loadContactSubmissions();
      } else {
        logger.error(' Failed to update contact status');
      }
    } catch (error) {
      logger.error(' Error updating contact status:', error);
    }
  }

  private async inviteLead(leadId: number, email: string): Promise<void> {
    const inviteBtn = this.domCache.getAs<HTMLButtonElement>('inviteLeadBtn');
    if (inviteBtn) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Sending Invitation...';
    }

    try {
      const response = await apiPost(`/api/admin/leads/${leadId}/invite`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          await alertSuccess(
            `Invitation sent to ${email}! They will receive a link to set up their account.`
          );
          // Close modal and refresh leads
          const modal = this.domCache.get('detailModal');
          if (modal) modal.style.display = 'none';
          this.loadLeads();
          this.loadProjects();
        } else {
          await alertError(data.error || 'Failed to send invitation. Please try again.');
          if (inviteBtn) {
            inviteBtn.disabled = false;
            inviteBtn.textContent = 'Invite to Client Portal';
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        await alertError(errorData.error || 'Failed to send invitation. Please try again.');
        if (inviteBtn) {
          inviteBtn.disabled = false;
          inviteBtn.textContent = 'Invite to Client Portal';
        }
      }
    } catch (error) {
      logger.error(' Error inviting lead:', error);
      await alertError('An error occurred. Please try again.');
      if (inviteBtn) {
        inviteBtn.disabled = false;
        inviteBtn.textContent = 'Invite to Client Portal';
      }
    }
  }

  private showContactDetails(contactId: number): void {
    const contact = this.contactsData.find((c) => c.id === contactId);
    if (!contact) return;

    const modal = this.domCache.get('detailModal');
    const modalTitle = this.domCache.get('modalTitle');
    const modalBody = this.domCache.get('modalBody');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = 'Contact Form Submission';

    const date = formatDateTime(contact.created_at);

    // Decode HTML entities then sanitize to prevent XSS
    const safeName = SanitizationUtils.escapeHtml(
      SanitizationUtils.decodeHtmlEntities(contact.name || '')
    );
    const safeEmail = SanitizationUtils.escapeHtml(
      SanitizationUtils.decodeHtmlEntities(contact.email || '')
    );
    const safeSubject = SanitizationUtils.escapeHtml(
      SanitizationUtils.decodeHtmlEntities(contact.subject || '')
    );
    const safeMessage = SanitizationUtils.escapeHtml(
      SanitizationUtils.decodeHtmlEntities(contact.message || '')
    );

    modalBody.innerHTML = `
      <div class="detail-grid">
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span class="detail-value">${date}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${safeName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${getEmailWithCopyHtml(contact.email || '', safeEmail)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Subject</span>
          <span class="detail-value">${safeSubject}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">${getStatusDotHTML(contact.status || 'new')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Message</span>
          <span class="detail-value message-full">${safeMessage}</span>
        </div>
        ${
  contact.read_at
    ? `
        <div class="detail-row">
          <span class="detail-label">Read At</span>
          <span class="detail-value">${formatDateTime(contact.read_at)}</span>
        </div>
        `
    : ''
}
        ${
  contact.replied_at
    ? `
        <div class="detail-row">
          <span class="detail-label">Replied At</span>
          <span class="detail-value">${formatDateTime(contact.replied_at)}</span>
        </div>
        `
    : ''
}
      </div>
    `;

    modal.style.display = 'flex';

    // Set up focus trap for accessibility
    const closeModal = () => {
      modal.style.display = 'none';
      if (this.focusTrapCleanup) {
        this.focusTrapCleanup();
        this.focusTrapCleanup = null;
      }
    };
    this.focusTrapCleanup = manageFocusTrap(modal, {
      initialFocus: '#modal-close-btn',
      onClose: closeModal
    });

    // Mark as read if status is 'new'
    if (contact.status === 'new') {
      this.updateContactStatus(contactId, 'read');
    }
  }

  private async loadProjects(): Promise<void> {
    // React component handles its own data loading
    const tabContainer = document.getElementById('tab-projects');
    if (tabContainer) {
      await mountReactModule('projects', tabContainer, this.moduleContext);
    }
  }

  // NOTE: updateProjectsDisplay moved to admin-projects module

  private async updateProjectStatus(id: number, status: string): Promise<void> {
    try {
      const response = await apiPut(`/api/projects/${id}`, { status });

      if (response.ok) {
        logger.log('Project status updated');
        // Refresh both leads and projects
        this.loadLeads();
        this.loadProjects();
      } else {
        logger.error(' Failed to update project status');
        alertError('Failed to update project status');
      }
    } catch (error) {
      logger.error(' Error updating project status:', error);
    }
  }

  private async activateLead(leadId: number): Promise<void> {
    // Convert a pending lead to an active project
    await this.updateProjectStatus(leadId, 'active');
  }

  /**
   * Navigate to full project detail view (replaces modal approach)
   * This mirrors the client portal view for admin management
   */
  public showProjectDetails(projectId: number): void {
    this.projectDetails.showProjectDetails(
      projectId,
      this.projectsData,
      (tab) => this.switchTab(tab),
      () => this.loadProjects(),
      formatProjectType,
      (leadId, email) => this.inviteLead(leadId, email)
    );
  }

  /**
   * Public logout handler for inline onclick fallback
   */
  public async handleLogout(): Promise<void> {
    logger.log('handleLogout() called via inline onclick');
    // Clean up command palette before logout
    this.cleanupCommandPalette();
    try {
      await AdminAuth.logout();
    } catch (error) {
      logger.error('handleLogout failed:', error);
      window.location.href = '/admin';
    }
  }

  private loadSystemInfo(): void {
    const sysVersion = this.domCache.get('sysVersion');
    const sysEnv = this.domCache.get('sysEnvironment');
    const sysBuildDate = this.domCache.get('sysBuildDate');
    const sysUserAgent = this.domCache.get('sysUseragent');
    const sysScreen = this.domCache.get('sysScreen');
    const sysViewport = this.domCache.get('sysViewport');

    if (sysVersion) sysVersion.textContent = '10.0.0';
    if (sysEnv) sysEnv.textContent = import.meta.env?.MODE || 'development';
    if (sysBuildDate) sysBuildDate.textContent = formatDate(new Date());
    if (sysUserAgent) {
      sysUserAgent.textContent = navigator.userAgent;
      sysUserAgent.title = navigator.userAgent;
    }
    if (sysScreen) sysScreen.textContent = `${screen.width} x ${screen.height}`;
    if (sysViewport) sysViewport.textContent = `${window.innerWidth} x ${window.innerHeight}`;

    // Load visitor tracking data from sessionStorage
    this.loadVisitorStats();
  }

  private loadVisitorStats(): void {
    try {
      // Read visitor tracking events from sessionStorage (set by visitor-tracking.ts)
      const eventsJson = sessionStorage.getItem('nbw_tracking_events');
      const events: AnalyticsEvent[] = eventsJson ? JSON.parse(eventsJson) : [];

      // Count unique sessions (visitors today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStart = today.getTime();

      const todayEvents = events.filter((e) => e.timestamp >= todayStart);
      const todaySessions = new Set(todayEvents.map((e) => e.sessionId));
      const visitorsToday = todaySessions.size;

      // Count total page views
      const pageViews = events.filter((e) => 'title' in e);
      const totalPageViews = pageViews.length;

      // Count total unique sessions (all time)
      const allSessions = new Set(events.map((e) => e.sessionId));
      const totalVisitors = allSessions.size;

      // Update overview stats
      const statVisitors = this.domCache.get('statVisitors');
      if (statVisitors) statVisitors.textContent = visitorsToday.toString();

      // Update analytics tab stats
      const analyticsVisitors = this.domCache.get('analyticsVisitors');
      const analyticsPageviews = this.domCache.get('analyticsPageviews');
      const analyticsSessions = this.domCache.get('analyticsSessions');

      if (analyticsVisitors) analyticsVisitors.textContent = totalVisitors.toString();
      if (analyticsPageviews) analyticsPageviews.textContent = totalPageViews.toString();
      if (analyticsSessions) {
        // Calculate average session duration
        const sessionsWithTime = pageViews.filter((pv) => pv.timeOnPage);
        if (sessionsWithTime.length > 0) {
          const totalTime = sessionsWithTime.reduce(
            (sum: number, pv) => sum + (pv.timeOnPage || 0),
            0
          );
          const avgTimeMs = totalTime / sessionsWithTime.length;
          const avgSeconds = Math.round(avgTimeMs / 1000);
          const minutes = Math.floor(avgSeconds / 60);
          const seconds = avgSeconds % 60;
          analyticsSessions.textContent = `${minutes}m ${seconds}s`;
        } else {
          analyticsSessions.textContent = '-';
        }
      }

      logger.log('Visitor stats loaded:', {
        visitorsToday,
        totalVisitors,
        totalPageViews
      });
    } catch (error) {
      logger.error(' Failed to load visitor stats:', error);

      // Set defaults on error
      const statVisitors = this.domCache.get('statVisitors');
      const analyticsVisitors = this.domCache.get('analyticsVisitors');
      const analyticsPageviews = this.domCache.get('analyticsPageviews');
      const analyticsSessions = this.domCache.get('analyticsSessions');

      if (statVisitors) statVisitors.textContent = '0';
      if (analyticsVisitors) analyticsVisitors.textContent = '0';
      if (analyticsPageviews) analyticsPageviews.textContent = '0';
      if (analyticsSessions) analyticsSessions.textContent = '-';
    }
  }

  // Messages properties
  private selectedClientId: number | null = null;
  private selectedThreadId: number | null = null;

  private async loadClientThreads(): Promise<void> {
    // React component handles its own data loading
    const tabContainer = document.getElementById('tab-messages');
    if (tabContainer) {
      await mountReactModule('messages', tabContainer, this.moduleContext);
    }
  }

  // NOTE: populateClientDropdown moved to admin-messages module

  private selectThread(clientId: number, threadId: number, _clientName: string): void {
    this.selectedClientId = clientId;
    this.selectedThreadId = threadId;

    // Enable compose area inputs
    const textarea = this.domCache.getAs<HTMLTextAreaElement>('adminMessageText');
    const sendButton = this.domCache.getAs<HTMLButtonElement>('adminSendMessage');
    if (textarea) {
      textarea.disabled = false;
      textarea.placeholder = 'Type your message...';
    }
    if (sendButton) {
      sendButton.disabled = false;
    }

    // Load messages
    this.loadThreadMessages(threadId);
  }

  private async loadThreadMessages(threadId: number): Promise<void> {
    // Try new container ID first, then old one
    const container =
      this.domCache.get('adminMessagesThread') || this.domCache.get('adminMessagesContainer');
    if (!container) return;

    container.innerHTML =
      '<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading...</span></div>';

    try {
      // Backend endpoint: /api/messages/threads/:threadId/messages
      const response = await apiFetch(`/api/messages/threads/${threadId}/messages`);

      if (response.ok) {
        const data = await response.json();
        this.renderMessages(data.messages || []);

        // Mark messages as read
        await apiPut(`/api/messages/threads/${threadId}/read`);
      } else {
        container.innerHTML = '<div class="empty-state-message">Failed to load messages</div>';
      }
    } catch (error) {
      logger.error(' Failed to load messages:', error);
      container.innerHTML = '<div class="empty-state-message">Error loading messages</div>';
    }
  }

  private renderMessages(messages: Message[]): void {
    const container =
      this.domCache.get('adminMessagesThread') || this.domCache.get('adminMessagesContainer');
    if (!container) return;

    if (messages.length === 0) {
      container.innerHTML =
        '<div class="empty-state-message">No messages yet. Start the conversation!</div>';
      return;
    }

    // Use client portal style messages
    container.innerHTML = messages
      .map((msg: Message) => {
        const isAdmin = msg.sender_type === 'admin';
        const dateTime = formatDateTime(msg.created_at);
        const rawSenderName = isAdmin
          ? 'You'
          : SanitizationUtils.decodeHtmlEntities(msg.sender_name || 'Client');
        // Decode HTML entities then sanitize to prevent XSS
        const safeSenderName = SanitizationUtils.escapeHtml(rawSenderName);
        const safeContent = SanitizationUtils.escapeHtml(
          SanitizationUtils.decodeHtmlEntities(msg.message || msg.content || '')
        );
        const safeInitials = SanitizationUtils.escapeHtml(
          rawSenderName.substring(0, 2).toUpperCase()
        );

        if (isAdmin) {
          // Admin message (sent - right aligned)
          return `
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${safeSenderName}</span>
                <span class="message-time">${dateTime}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
            <div class="message-avatar" data-name="Admin">
              <img src="/images/avatar_small_sidebar.svg" alt="Admin" class="avatar-img" />
            </div>
          </div>
        `;
        }
        // Client message (received - left aligned)
        return `
          <div class="message message-received">
            <div class="message-avatar" data-name="${safeSenderName}">
              <div class="avatar-placeholder">${safeInitials}</div>
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="message-sender">${safeSenderName}</span>
                <span class="message-time">${dateTime}</span>
              </div>
              <div class="message-body">${safeContent}</div>
            </div>
          </div>
        `;
      })
      .join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  private async sendMessage(): Promise<void> {
    const input = this.domCache.getAs<HTMLInputElement>('adminMessageText');
    if (!input || !input.value.trim() || !this.selectedThreadId) return;

    const message = input.value.trim();
    input.value = '';
    input.disabled = true;

    try {
      // Backend expects 'message' field
      const response = await apiPost(`/api/messages/threads/${this.selectedThreadId}/messages`, {
        message
      });

      if (response.ok) {
        // Reload messages
        this.loadThreadMessages(this.selectedThreadId);
        // Refresh thread list for unread counts
        this.loadClientThreads();
      } else {
        const error = await response.json();
        logger.error(' Failed to send message:', error);
        alertError('Failed to send message. Please try again.');
      }
    } catch (error) {
      logger.error(' Error sending message:', error);
      alertError('Error sending message. Please try again.');
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  private setupExportButtons(): void {
    const exportAnalytics = this.domCache.get('exportAnalytics');
    const exportVisitors = this.domCache.get('exportVisitors');
    const exportPerformance = this.domCache.get('exportPerformance');

    if (exportAnalytics) {
      exportAnalytics.addEventListener('click', () => {
        this.exportData('analytics');
      });
    }

    if (exportVisitors) {
      exportVisitors.addEventListener('click', () => {
        this.exportData('visitors');
      });
    }

    if (exportPerformance) {
      exportPerformance.addEventListener('click', () => {
        this.exportData('performance');
      });
    }
  }

  private setupDataManagementButtons(): void {
    const clearOldData = this.domCache.get('clearOldData');
    const resetAnalytics = this.domCache.get('resetAnalytics');

    if (clearOldData) {
      clearOldData.addEventListener('click', () => {
        this.clearOldData();
      });
    }

    if (resetAnalytics) {
      resetAnalytics.addEventListener('click', () => {
        this.resetAnalytics();
      });
    }
  }

  private setupHeaderGroupNavigation(): void {
    // UNIVERSAL RULE: Single document-level event delegation for ALL header subtabs
    // SINGLE SOURCE OF TRUTH for subtab click handling and active state management

    logger.log('setupHeaderGroupNavigation called');

    // Use a unique ID on body to track if handlers are attached (resets on hard refresh)
    if (document.body.dataset.subtabHandlersV2) {
      logger.log('Handlers already attached (body dataset), skipping');
      return;
    }
    document.body.dataset.subtabHandlersV2 = 'true';
    logger.log('Attaching subtab handlers');

    // Store reference to this dashboard instance for the click handler
    const dashboard = this;

    /**
     * UNIVERSAL: Update active state for any subtab group
     * This is the SINGLE SOURCE OF TRUTH for subtab active state management
     */
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

    // UNIVERSAL click handler for ALL header subtab types
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest(
        '.header-subtab-group .portal-subtab'
      ) as HTMLElement | null;
      if (!target) return;

      // Get the parent group to check its type
      const group = target.closest('.header-subtab-group') as HTMLElement | null;
      if (!group) return;

      const forTab = group.dataset.forTab;
      // Strip any quotes from mode value (handles malformed HTML attributes)
      const mode = group.dataset.mode?.replace(/["']/g, '');

      // ============================================
      // SUBTAB HANDLING - UNIFIED PATTERN
      // All tab groups use internal view pattern: one component handles all subtabs
      // Components listen for '<groupName>SubtabChange' events
      // ============================================

      const subtab = target.dataset.subtab;

      // TAB GROUPS - dispatch events for internal view switching
      // Event naming: <groupName>SubtabChange (e.g., workSubtabChange, crmSubtabChange)
      if (forTab && forTab in ADMIN_TAB_GROUPS) {
        if (!subtab) return;
        updateSubtabActiveState(group, subtab, 'subtab');
        // Convert forTab to event name (support -> knowledgeBase for backwards compatibility)
        const eventName = forTab === 'support' ? 'knowledgeBase' : forTab;
        document.dispatchEvent(new CustomEvent(`${eventName}SubtabChange`, { detail: { subtab } }));
        return;
      }

      // Project Detail (uses pd-tab data attribute)
      if (forTab === 'project-detail') {
        const tabName = target.dataset.pdTab;
        if (!tabName) return;
        updateSubtabActiveState(group, tabName, 'pdTab');
        document.dispatchEvent(new CustomEvent('projectDetailTabChange', { detail: { tabName } }));
        return;
      }

      // Client Detail (uses cd-tab data attribute)
      if (forTab === 'client-detail') {
        const tabName = target.dataset.cdTab;
        if (!tabName) return;
        updateSubtabActiveState(group, tabName, 'cdTab');
        document.dispatchEvent(new CustomEvent('clientDetailTabChange', { detail: { tabName } }));

      }
    });
  }

  private updateActiveGroupState(group: string | null, tabName: string): void {
    const activeGroup = group || tabName;
    this.currentGroup = activeGroup;

    document.body.dataset.activeGroup = activeGroup;
    document.body.dataset.activeTab = tabName;

    // Update sidebar nav items - match the actual HTML element class
    document.querySelectorAll('.sidebar-buttons .btn[data-tab]').forEach((btn) => {
      const isActive = (btn as HTMLElement).dataset.tab === activeGroup;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    // Update subtab active states for PRIMARY subtab groups only
    // Analytics and Workflows manage their own subtab states
    const subtabGroup = document.querySelector(
      `.header-subtab-group[data-for-tab="${activeGroup}"]`
    ) as HTMLElement | null;
    // Check if it's a primary group (strip quotes from mode value)
    const groupMode = subtabGroup?.dataset.mode?.replace(/["']/g, '');
    if (subtabGroup && groupMode === 'primary') {
      // For support tab, the tabName is 'support' but subtabs are 'categories'/'articles'
      // Default to first subtab (which has active class in HTML) if tabName doesn't match any subtab
      const subtabs = subtabGroup.querySelectorAll('.portal-subtab[data-subtab]');
      const hasMatchingSubtab = Array.from(subtabs).some(
        (btn) => (btn as HTMLElement).dataset.subtab === tabName
      );

      if (hasMatchingSubtab) {
        // Standard behavior: set active based on tabName
        subtabs.forEach((btn) => {
          btn.classList.toggle('active', (btn as HTMLElement).dataset.subtab === tabName);
        });
      }
      // If no match (e.g., support tab), keep the HTML-defined active state
    }
  }

  private switchTab(tabName: string): void {
    this.switchTabInternal(tabName, true);
  }

  /**
   * Internal tab switch - optionally updates URL.
   * @param tabName - The tab to switch to
   * @param updateUrl - Whether to update the browser URL (false for popstate handling)
   */
  private switchTabInternal(tabName: string, updateUrl = false): void {
    const resolved = resolveAdminTab(tabName);
    const activeTab = resolved.tab;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.remove('active');
    });

    // Update active tab content (HTML uses tab-{name} format, e.g., tab-dashboard)
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    // Try both ID formats: tab-{name} (new) and {name}-tab (old)
    const tabContent =
      document.getElementById(`tab-${activeTab}`) || document.getElementById(`${activeTab}-tab`);
    tabContent?.classList.add('active');

    this.currentTab = activeTab;
    this.updateActiveGroupState(resolved.group, activeTab);

    // Update URL to reflect current tab (without page reload)
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.pathname = '/admin';
      if (activeTab === 'dashboard') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', activeTab);
      }
      window.history.pushState({ tab: activeTab }, '', url.toString());
    }

    // Update page title in unified header
    this.updateAdminPageTitle(activeTab);

    // Update greeting (only shown on Overview tab)
    this.updateGreeting(activeTab);

    // Update breadcrumb to match active section
    this.updateAdminBreadcrumbs(activeTab);

    // Load tab-specific data (modules handle all tab data loading)
    this.loadTabData(activeTab);
  }

  /**
   * Update admin header page title based on active tab/section.
   */
  private updateAdminPageTitle(tabName: string): void {
    const titleEl = document.getElementById('admin-page-title');
    if (!titleEl) return;

    // Handle detail views with dynamic names
    if (tabName === 'client-detail') {
      // Client name is managed by the React ClientDetail component
      titleEl.textContent = 'Client';
      return;
    }

    if (tabName === 'project-detail') {
      const projectName = this.projectDetails.getCurrentProjectName() || 'Project';
      titleEl.textContent = projectName;
      return;
    }

    const group = getAdminGroupForTab(tabName);
    if (group) {
      titleEl.textContent = ADMIN_TAB_GROUPS[group].label;
      return;
    }

    titleEl.textContent = ADMIN_TAB_TITLES[tabName] || 'Dashboard';
  }

  /**
   * Update admin header breadcrumbs based on active tab/section.
   */
  private updateAdminBreadcrumbs(tabName: string): void {
    const list = document.getElementById('breadcrumb-list');
    if (!list) return;

    const goOverview = (): void => this.switchTab('dashboard');
    const goClients = (): void => this.switchTab('clients');
    const goProjects = (): void => this.switchTab('projects');

    const items: BreadcrumbItem[] = [];

    const group = getAdminGroupForTab(tabName);
    if (group) {
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({
        label: ADMIN_TAB_GROUPS[group].label,
        href: true,
        onClick: () => this.switchTab(group)
      });
      items.push({ label: ADMIN_TAB_TITLES[tabName] || tabName, href: false });
      renderBreadcrumbs(list, items);
      return;
    }

    switch (tabName) {
    case 'dashboard':
      items.push({ label: 'Dashboard', href: false });
      break;
    case 'clients':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Clients', href: false });
      break;
    case 'invoices':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Invoices', href: false });
      break;
    case 'contracts':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Contracts', href: false });
      break;
    case 'tasks':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Tasks', href: false });
      break;
    case 'client-detail': {
      // Client name is managed by the React ClientDetail component
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Clients', href: true, onClick: goClients });
      items.push({ label: 'Client', href: false });
      break;
    }
    case 'leads':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Leads', href: false });
      break;
    case 'projects':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Projects', href: false });
      break;
    case 'project-detail': {
      // Get project name from project details handler
      const projectName = this.projectDetails.getCurrentProjectName();
      const label = projectName
        ? projectName.length > 40
          ? `${projectName.slice(0, 37)}...`
          : projectName
        : 'Project';
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Projects', href: true, onClick: goProjects });
      items.push({ label, href: false });
      break;
    }
    case 'messages':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Messages', href: false });
      break;
    case 'analytics':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Analytics', href: false });
      break;
    case 'support':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Knowledge Base', href: false });
      break;
    case 'documents':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Documents', href: false });
      break;
    case 'document-requests':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Document Requests', href: false });
      break;
    case 'system':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'System', href: false });
      break;
    case 'workflows':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Workflows', href: false });
      break;
    case 'email-templates':
      items.push({ label: 'Dashboard', href: true, onClick: goOverview });
      items.push({ label: 'Email Templates', href: false });
      break;
    default:
      items.push({ label: 'Dashboard', href: false });
    }

    renderBreadcrumbs(list, items);
  }

  /**
   * Apply special filters from attention cards
   */
  private applyAttentionFilter(tabName: string, filter: string): void {
    // Small delay to allow tab content to render
    setTimeout(() => {
      if (tabName === 'invoices' && filter === 'overdue') {
        // Filter invoices to show only overdue
        this.filterTable('invoices', 'overdue');
        // Update active state on filter cards
        const filterCards = document.querySelectorAll(
          '.stat-card-clickable[data-table="invoices"]'
        );
        filterCards.forEach((c) => c.classList.remove('active'));
        const overdueCard = document.querySelector(
          '.stat-card-clickable[data-filter="overdue"][data-table="invoices"]'
        );
        overdueCard?.classList.add('active');
      } else if (tabName === 'projects' && filter === 'pending_contract') {
        // Filter projects to show only those with unsigned contracts
        const tableBody = this.domCache.get('projectsTableBody');
        if (tableBody) {
          const rows = tableBody.querySelectorAll('tr');
          rows.forEach((row) => {
            // Check for contract badge or contract column
            const contractBadge = row.querySelector('.contract-badge, [data-contract]');
            const hasContract =
              contractBadge?.textContent?.toLowerCase().includes('signed') ||
              contractBadge?.classList.contains('signed');
            row.style.display = hasContract ? 'none' : '';
          });
        }
      } else if (tabName === 'leads' && filter === 'new_this_week') {
        // Filter leads to show only those from this week
        const tableBody = this.domCache.get('leadsTableBody');
        if (tableBody) {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const rows = tableBody.querySelectorAll('tr');
          rows.forEach((row) => {
            // Date is typically in the 6th column (index 5)
            const dateCell = row.querySelectorAll('td')[5];
            if (dateCell) {
              const dateText = dateCell.textContent?.trim() || '';
              const rowDate = new Date(dateText);
              row.style.display = rowDate >= oneWeekAgo ? '' : 'none';
            }
          });
        }
      } else if (tabName === 'messages' && filter === 'unread') {
        // Filter messages to show unread threads
        const threadList = document.querySelector('.thread-list');
        if (threadList) {
          const threads = threadList.querySelectorAll('.thread-item');
          threads.forEach((thread) => {
            const hasUnread =
              thread.classList.contains('unread') ||
              thread.querySelector('.unread-badge, .unread-indicator');
            (thread as HTMLElement).style.display = hasUnread ? '' : 'none';
          });
        }
      }
    }, 100);
  }

  private filterTable(tableName: string, filter: string): void {
    let tableBody: HTMLElement | null = null;
    let statusColumnIndex = -1;

    if (tableName === 'leads') {
      tableBody = this.domCache.get('leadsTableBody');
      statusColumnIndex = 6; // Status column is 7th (0-indexed: 6)
    } else if (tableName === 'projects') {
      tableBody = this.domCache.get('projectsTableBody');
      statusColumnIndex = 4; // Status column is 5th (0-indexed: 4)
    } else if (tableName === 'clients') {
      tableBody = this.domCache.get('clientsTableBody');
      statusColumnIndex = 2; // Status column is 3rd (0-indexed: 2)
    } else if (tableName === 'invoices') {
      tableBody = this.domCache.get('invoicesTableBody');
      statusColumnIndex = 4; // Status column is 5th (0-indexed: 4)
    }

    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((row) => {
      if (filter === 'all') {
        row.style.display = '';
        return;
      }

      const statusCell = row.querySelectorAll('td')[statusColumnIndex];
      if (statusCell) {
        const statusText = statusCell.textContent?.toLowerCase().replace(/\s+/g, '_') || '';
        const filterNormalized = filter.toLowerCase();

        // Match status text with filter
        const matches =
          statusText.includes(filterNormalized) ||
          (filterNormalized === 'in_progress' && statusText.includes('progress')) ||
          (filterNormalized === 'on_hold' && statusText.includes('hold'));

        row.style.display = matches ? '' : 'none';
      }
    });
  }

  private async loadDashboardData(): Promise<void> {
    this.showLoading(true);

    try {
      // Mount dashboard React component - it handles its own data loading
      const tabContainer = document.getElementById('tab-dashboard');
      if (tabContainer) {
        await mountReactModule('dashboard', tabContainer, this.moduleContext);
      }
    } catch (error) {
      logger.error('Error loading dashboard data:', error);
    } finally {
      this.showLoading(false);
    }
  }

  private async loadTabData(tabName: string): Promise<void> {
    this.showLoading(true);

    try {
      // Get the tab container - try both ID formats (tab-{name} and {name}-tab)
      const tabContainer = document.getElementById(`tab-${tabName}`)
        || document.getElementById(`${tabName}-tab`);

      // Check if there's a React module for this tab
      if (hasReactModule(tabName) && tabContainer) {
        // Mount React component directly - no vanilla JS fallback
        await mountReactModule(tabName, tabContainer, this.moduleContext);
        return;
      }

      // Handle special cases without React modules
      switch (tabName) {
      case 'visitors':
        // Visitors is a sub-view of analytics, not a separate tab
        // The analytics React component handles this internally
        logger.log('Visitors view requested - handled by analytics component');
        break;

        // Note: Group tabs (work, crm, documents, analytics, workflows, support)
        // are now handled by their parent dashboard components via hasReactModule().

      default:
        logger.warn(`No handler for tab: ${tabName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error(`Error loading ${tabName} data:`, {
        tab: tabName,
        message: errorMessage,
        stack: errorStack,
        error
      });

      // Show user-friendly error in the tab container
      const tabContainer = document.getElementById(`tab-${tabName}`);
      if (tabContainer) {
        tabContainer.innerHTML = `
          <div class="module-error-state" style="padding: 2rem; text-align: center;">
            <p style="color: var(--app-color-danger); margin-bottom: 1rem;">
              Failed to load ${tabName.replace(/-/g, ' ')} module
            </p>
            <p style="color: var(--app-color-text-muted); font-size: 0.875rem;">
              ${errorMessage}
            </p>
            <button class="btn-secondary" data-action="retry" data-tab="${tabName}" style="margin-top: 1rem;">
              Retry
            </button>
          </div>
        `;
        // Add event listener for retry button
        const retryBtn = tabContainer.querySelector('[data-action="retry"]');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            const tab = retryBtn.getAttribute('data-tab');
            if (tab) {
              window.adminDashboard?.loadTabData(tab);
            }
          });
        }
      }
    } finally {
      this.showLoading(false);
    }
  }

  private async loadDashboardDataLegacy(): Promise<void> {
    // Dashboard React component handles its own data loading
    const tabContainer = document.getElementById('tab-dashboard');
    if (tabContainer) {
      await mountReactModule('dashboard', tabContainer, this.moduleContext);
    }
  }

  private async loadPerformanceData(): Promise<void> {
    try {
      // Initialize the PerformanceDashboard component for admin use
      await this.initializePerformanceDashboard();

      // Performance React component handles its own data loading
      const tabContainer = document.getElementById('tab-performance');
      if (tabContainer) {
        await mountReactModule('performance', tabContainer, this.moduleContext);
      }
    } catch (error) {
      logger.error('Error loading performance data:', error);
    }
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetricsDisplay> {
    try {
      // Try to get data from the main app's services via parent window
      if (window.opener?.NBW_DEBUG) {
        const debug = window.opener.NBW_DEBUG;
        if (debug.getPerformanceReport) {
          return (await debug.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
        }
      }

      // Try to get data from current window (if services are available)
      if (window.NBW_DEBUG?.getPerformanceReport) {
        return (await window.NBW_DEBUG.getPerformanceReport()) as unknown as PerformanceMetricsDisplay;
      }

      // Try to access services directly from container
      const { container } = await import('../../core/container');
      const performanceService = (await container.resolve('PerformanceService')) as {
        generateReport?: () => PerformanceReport;
      };
      if (performanceService?.generateReport) {
        const report = performanceService.generateReport();
        return {
          lcp: {
            value: report.metrics.lcp ? `${Math.round(report.metrics.lcp)}ms` : 'N/A',
            status: this.getVitalStatus('lcp', report.metrics.lcp)
          },
          fid: {
            value: report.metrics.fid ? `${Math.round(report.metrics.fid)}ms` : 'N/A',
            status: this.getVitalStatus('fid', report.metrics.fid)
          },
          cls: {
            value: report.metrics.cls ? report.metrics.cls.toFixed(3) : 'N/A',
            status: this.getVitalStatus('cls', report.metrics.cls)
          },
          ttfb: {
            value: report.metrics.ttfb ? `${Math.round(report.metrics.ttfb)}ms` : 'N/A',
            status: this.getVitalStatus('ttfb', report.metrics.ttfb)
          },
          bundleSize: {
            total: report.metrics.bundleSize
              ? `${Math.round(report.metrics.bundleSize / 1024)} KB`
              : 'N/A',
            main: 'N/A',
            vendor: 'N/A'
          },
          score: report.score || 0,
          grade: this.getGradeFromScore(report.score || 0),
          alerts: (report.alerts || []).map((alert) => alert.message)
        };
      }
    } catch (error) {
      logger.warn(' Could not get live performance data:', error);
    }

    // Fallback - data unavailable
    return {
      lcp: { value: 'N/A', status: 'unknown' },
      fid: { value: 'N/A', status: 'unknown' },
      cls: { value: 'N/A', status: 'unknown' },
      ttfb: { value: 'N/A', status: 'unknown' },
      bundleSize: {
        total: 'N/A',
        main: 'N/A',
        vendor: 'N/A'
      },
      score: 0,
      grade: 'N/A',
      alerts: ['Unable to load performance data']
    };
  }

  private getVitalStatus(metric: string, value?: number): string {
    if (!value) return 'unknown';

    switch (metric) {
    case 'lcp':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'fid':
      return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor';
    case 'cls':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    default:
      return 'unknown';
    }
  }

  private getGradeFromScore(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private async loadAnalyticsData(): Promise<void> {
    // React component handles its own data loading
    const tabContainer = document.getElementById('tab-analytics');
    if (tabContainer) {
      await mountReactModule('analytics', tabContainer, this.moduleContext);
    }
  }

  // NOTE: Analytics helper methods (getAnalyticsData, formatAnalyticsData, formatPageUrl, formatInteractionType)
  // have been moved to admin-analytics module for code splitting

  // NOTE: loadVisitorsData, loadLeadsData, and populateLeadsTable moved to respective modules
  // NOTE: formatProjectType moved to shared format-utils.ts

  private async loadSystemData(): Promise<void> {
    // System status React component handles its own data loading
    const tabContainer = document.getElementById('tab-system');
    if (tabContainer) {
      await mountReactModule('system', tabContainer, this.moduleContext);
    }
  }

  // NOTE: getApplicationStatus moved to admin-system-status module

  private updateElement(id: string, text: string, className?: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
      if (className) {
        element.className = `metric-change ${className}`;
      }
    }
  }

  private updateVital(type: string, data: { value: string; status: string }): void {
    const valueElement = document.getElementById(`${type}-value`);
    const statusElement = document.getElementById(`${type}-status`);

    if (valueElement) valueElement.textContent = data.value;
    if (statusElement) {
      statusElement.textContent = data.status.replace('-', ' ');
      statusElement.className = `vital-status ${data.status}`;
    }
  }

  /**
   * Create or update a Chart.js chart (loads Chart.js dynamically)
   */
  private async loadChart(containerId: string, chartType: 'visitors' | 'sources'): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Load Chart.js dynamically
    const ChartJS = await loadChartJS();

    // Destroy existing chart if it exists
    const existingChart = this.charts.get(containerId);
    if (existingChart) {
      existingChart.destroy();
    }

    // Create canvas element
    container.innerHTML = '<canvas></canvas>';
    const canvas = container.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let chart: InstanceType<typeof ChartJS>;

    if (chartType === 'visitors') {
      // Line chart for visitor trends - colors from CSS variables
      chart = new ChartJS(ctx, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Visitors',
              data: [120, 190, 150, 220, 180, 250, 210],
              borderColor: getChartColor('PRIMARY'),
              backgroundColor: getChartColorWithAlpha('PRIMARY', 0.1),
              tension: 0.4,
              fill: true
            },
            {
              label: 'Page Views',
              data: [300, 450, 380, 520, 420, 600, 480],
              borderColor: getChartColor('DARK'),
              backgroundColor: getChartColorWithAlpha('DARK', 0.1),
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: getChartColorWithAlpha('DARK', 0.1)
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
    } else {
      // Doughnut chart for traffic sources - colors from CSS variables
      chart = new ChartJS(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Direct', 'Search', 'Social', 'Referral', 'Email'],
          datasets: [
            {
              data: [35, 30, 20, 10, 5],
              backgroundColor: [
                getChartColor('PRIMARY'),
                getChartColor('DARK'),
                getChartColor('GRAY_600'),
                getChartColor('GRAY_400'),
                getChartColor('GRAY_300')
              ],
              borderColor: getChartColor('WHITE'),
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                usePointStyle: true,
                padding: 15
              }
            }
          }
        }
      });
    }

    this.charts.set(containerId, chart);
  }

  private populateDataList(
    listId: string,
    data: Array<{ label: string; value: string | number }>
  ): void {
    const list = document.getElementById(listId);
    if (!list) return;

    list.innerHTML = data
      .map(
        (item) => `
      <div class="data-item">
        <span>${SanitizationUtils.escapeHtml(item.label)}</span>
        <span>${SanitizationUtils.escapeHtml(String(item.value))}</span>
      </div>
    `
      )
      .join('');
  }

  // NOTE: populateVisitorsTable moved to admin-analytics module

  // NOTE: populateSystemStatus moved to admin-system-status module

  private async initializePerformanceDashboard(): Promise<void> {
    try {
      // Check if performance dashboard container exists
      let dashboardContainer = this.domCache.get('performanceDashboardContainer');

      if (!dashboardContainer) {
        // Create container for the performance dashboard in the performance tab
        const performanceTab = this.domCache.get('performanceTab');
        if (performanceTab) {
          dashboardContainer = document.createElement('div');
          dashboardContainer.id = 'performance-dashboard-container';
          dashboardContainer.className = 'admin-performance-dashboard';
          performanceTab.appendChild(dashboardContainer);
        }
      }

      if (dashboardContainer) {
        // Feature deferred: Performance dashboard requires additional metrics collection
        // See docs/current_work.md for tracking
        dashboardContainer.innerHTML =
          '<div class="empty-state">Performance dashboard coming soon</div>';
      }
    } catch (error) {
      logger.warn(' Failed to initialize performance dashboard component:', error);
    }
  }

  private displayPerformanceAlerts(alerts: PerformanceAlert[]): void {
    const container = this.domCache.get('performanceAlerts');
    if (!container || !alerts.length) return;

    container.innerHTML = alerts
      .slice(0, 5)
      .map(
        (alert) => `
      <div class="performance-alert alert-${alert.type}">
        <div class="alert-header">
          <span class="alert-metric">${alert.metric.toUpperCase()}</span>
          <span class="alert-value">${Math.round(alert.value)}</span>
        </div>
        <div class="alert-message">${SanitizationUtils.escapeHtml(alert.message)}</div>
        ${
  alert.suggestions && alert.suggestions.length > 0
    ? `
          <div class="alert-suggestions">
            <ul>
              ${alert.suggestions
    .slice(0, 2)
    .map((suggestion: string) => `<li>${SanitizationUtils.escapeHtml(suggestion)}</li>`)
    .join('')}
            </ul>
          </div>
        `
    : ''
}
      </div>
    `
      )
      .join('');
  }

  private showLoading(show: boolean): void {
    const loading = this.domCache.get('loadingIndicator');
    if (loading) {
      if (show) {
        loading.classList.remove('hidden');
      } else {
        loading.classList.add('hidden');
      }
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    // Log notification to console
    const logFn = type === 'error' ? logger.error : logger.log;
    logFn(`${type.toUpperCase()}: ${message}`);

    // Use toast notifications for success/info/warning, dialogs only for errors that need attention
    if (type === 'error') {
      // Keep error dialogs for important errors
      alertError(message);
    } else {
      // Use toast for success/info/warning messages
      showToast(message, type);
    }
  }

  /**
   * Fetches and updates sidebar notification badges for CRM
   */
  private async updateSidebarBadges(): Promise<void> {
    try {
      const response = await apiFetch('/api/admin/sidebar-counts');

      if (!response.ok) return;

      const data = await response.json();
      if (!data.success) return;

      // Update CRM badge (unread messages)
      const crmBadge = this.domCache.get('crmBadge');
      if (crmBadge) {
        if (data.messages > 0) {
          crmBadge.textContent = String(data.messages);
          crmBadge.style.display = '';
        } else {
          crmBadge.style.display = 'none';
        }
      }
    } catch (error) {
      logger.error(' Error fetching sidebar counts:', error);
    }
  }

  private startAutoRefresh(): void {
    // Refresh dashboard data every 5 minutes
    this.refreshInterval = setInterval(
      () => {
        this.loadTabData(this.currentTab);
        this.updateSidebarBadges();
      },
      5 * 60 * 1000
    );
  }

  private async exportData(type: string): Promise<void> {
    try {
      let data: Record<string, unknown>;
      let filename: string;

      switch (type) {
      case 'analytics':
        data = await this.getAnalyticsExport();
        filename = `analytics-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'visitors':
        data = await this.getVisitorsExport();
        filename = `visitors-${new Date().toISOString().split('T')[0]}.json`;
        break;
      case 'performance':
        data = await this.getPerformanceExport();
        filename = `performance-${new Date().toISOString().split('T')[0]}.json`;
        break;
      default:
        logger.error(`Unknown export type requested: ${type}`);
        this.showNotification(`Export type '${type}' is not supported`, 'error');
        return;
      }

      // Create and download file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error(`Error exporting ${type} data:`, error);
      alertError(`Failed to export ${type} data. Please try again.`);
    }
  }

  private async getAnalyticsExport(): Promise<Record<string, unknown>> {
    // Get analytics data for export
    return {
      exportDate: new Date().toISOString(),
      pageViews: [], // Add actual page view data
      visitors: [], // Add actual visitor data
      events: [] // Add actual event data
    };
  }

  private async getVisitorsExport(): Promise<Record<string, unknown>> {
    // Get visitor data for export
    return {
      exportDate: new Date().toISOString(),
      visitors: [] // Add actual visitor data
    };
  }

  private async getPerformanceExport(): Promise<Record<string, unknown>> {
    // Get performance data for export
    return {
      exportDate: new Date().toISOString(),
      metrics: await this.getPerformanceMetrics()
    };
  }

  private async clearOldData(): Promise<void> {
    const confirmed = await confirmDanger(
      'Are you sure you want to clear data older than 90 days? This action cannot be undone.',
      'Clear Data',
      'Clear Old Data'
    );
    if (!confirmed) return;

    try {
      // Clear old data logic here
      this.showNotification('Old data cleared successfully', 'success');
    } catch (error) {
      logger.error(' Error clearing old data:', error);
      this.showNotification('Failed to clear old data', 'error');
    }
  }

  private async resetAnalytics(): Promise<void> {
    const firstConfirm = await confirmDanger(
      'Are you sure you want to reset ALL analytics data? This action cannot be undone.',
      'Reset Analytics',
      'Reset Analytics'
    );
    if (!firstConfirm) return;

    const secondConfirm = await confirmDanger(
      'This will permanently delete all visitor data, page views, and analytics. Are you absolutely sure?',
      'Yes, Reset Everything',
      'Final Confirmation'
    );
    if (!secondConfirm) return;

    try {
      // Reset analytics logic here
      sessionStorage.clear();
      this.showNotification('Analytics data has been reset', 'success');
      window.location.reload();
    } catch (error) {
      logger.error(' Error resetting analytics:', error);
      this.showNotification('Failed to reset analytics', 'error');
    }
  }

  // ============================================================================
  // PROJECT DETAILS DELEGATE METHODS
  // Exposed for onclick handlers in dynamically rendered HTML
  // ============================================================================

  /** Toggle milestone completion - delegated to projectDetails */
  public toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void> {
    return this.projectDetails.toggleMilestone(milestoneId, isCompleted);
  }

  /** Delete milestone - delegated to projectDetails */
  public deleteMilestone(milestoneId: number): Promise<void> {
    return this.projectDetails.deleteMilestone(milestoneId);
  }

  /** Toggle milestone tasks visibility - delegated to projectDetails */
  public toggleMilestoneTasks(milestoneId: number, projectId: number): Promise<void> {
    return this.projectDetails.toggleMilestoneTasks(milestoneId, projectId);
  }

  /** Toggle task completion - delegated to projectDetails */
  public toggleTaskCompletion(
    taskId: number,
    isCompleted: boolean,
    projectId: number
  ): Promise<void> {
    return this.projectDetails.toggleTaskCompletion(taskId, isCompleted, projectId);
  }

  /** Send invoice - delegated to projectDetails */
  public sendInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.sendInvoice(invoiceId);
  }

  /** Mark invoice as paid - delegated to projectDetails */
  public markInvoicePaid(invoiceId: number): Promise<void> {
    return this.projectDetails.markInvoicePaid(invoiceId);
  }

  /** Send invoice reminder - delegated to projectDetails */
  public sendInvoiceReminder(invoiceId: number): Promise<void> {
    return this.projectDetails.sendInvoiceReminder(invoiceId);
  }

  /** Edit invoice - delegated to projectDetails */
  public editInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.editInvoice(invoiceId);
  }

  /** Show apply credit prompt - delegated to projectDetails */
  public showApplyCreditPrompt(invoiceId: number): Promise<void> {
    return this.projectDetails.showApplyCreditPrompt(invoiceId);
  }

  /** Duplicate invoice - delegated to projectDetails */
  public duplicateInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.duplicateInvoice(invoiceId);
  }

  /** Delete/void invoice - delegated to projectDetails */
  public deleteInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.deleteInvoice(invoiceId);
  }

  /** Record payment on invoice - delegated to projectDetails */
  public recordPayment(invoiceId: number): Promise<void> {
    return this.projectDetails.recordPayment(invoiceId);
  }

  /** Cancel scheduled invoice - delegated to projectDetails */
  public cancelScheduledInvoice(scheduleId: number): Promise<void> {
    return this.projectDetails.cancelScheduledInvoice(scheduleId);
  }

  /** Toggle recurring invoice - delegated to projectDetails */
  public toggleRecurringInvoice(recurringId: number, isActive: boolean): Promise<void> {
    return this.projectDetails.toggleRecurringInvoice(recurringId, isActive);
  }

  /** Stop auto refresh interval */
  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /** Clean up resources when dashboard is destroyed */
  public destroy(): void {
    this.stopAutoRefresh();

    // Destroy all charts
    this.charts.forEach((chart) => chart.destroy());
    this.charts.clear();

    // Destroy command palette
    destroyAdminCommandPalette();

    logger.log('AdminDashboard destroyed');
  }
}

// Global function for visitor details (called from table)
declare global {
  interface Window {
    viewVisitorDetails?: (visitorId: string) => void;
  }
}

window.viewVisitorDetails = (visitorId: string) => {
  alertInfo(`Viewing details for visitor: ${visitorId}`);
};

// Extend Window interface for global admin dashboard access
declare global {
  interface Window {
    adminDashboard: AdminDashboard | null;
  }
}

// Note: AdminDashboard is instantiated and assigned to window.adminDashboard
// by the modules-config.ts factory to ensure proper initialization order

export { AdminAuth, AdminDashboard };
