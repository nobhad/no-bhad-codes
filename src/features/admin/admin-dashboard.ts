/**
 * ADMIN DASHBOARD CONTROLLER
 * @file src/features/admin/admin-dashboard.ts
 *
 * Orchestrator that delegates to extracted modules:
 * admin-tab-manager, admin-contacts-handler, admin-messages-handler,
 * admin-performance-handler, admin-data-operations, admin-event-setup, admin-ui-helpers
 */

import { AdminSecurity } from './admin-security';
import { AdminAuth } from './admin-auth';
import { authStore } from '../../auth/auth-store';
import type { AdminUser } from '../../auth/auth-types';
import { AdminProjectDetails } from './admin-project-details';
import type {
  AdminDashboardContext,
  Lead,
  ContactSubmission,
  Project
} from './admin-types';
import { apiFetch, apiPost, apiPut, unwrapApiData, configureApiClient } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';
import { createDOMCache } from '../../utils/dom-cache';
import { formatProjectType } from '../../utils/format-utils';
import { alertError, alertSuccess, alertInfo } from '../../utils/confirm-dialog';
import { showToast } from '../../utils/toast-notifications';
import { initCopyEmailDelegation } from '../../utils/copy-email';
import { closeAllModalOverlays } from '../../utils/modal-utils';
import { initAdminCommandPalette, destroyAdminCommandPalette } from './admin-command-palette';
import { initKeyboardHelp } from '../../components/keyboard-help';
import { initPortalHeader, type PortalHeader } from '../shared/portal-header';
import { SanitizationUtils } from '../../utils/sanitization-utils';

// React module loader
import { mountReactModule, hasReactModule } from './ReactModuleLoader';
import { loadEjsTable, hasEjsTable } from '../shared/table-manager/loadEjsTable';

// Deliverables module initialization
import { initializeDeliverablesModule } from './modules/admin-deliverables';

// Extracted modules
import {
  ADMIN_TAB_TITLES,
  resolveAdminTab,
  getAdminGroupForTab,
  updateAdminPageTitle,
  updateAdminBreadcrumbs,
  updateActiveGroupState
} from './admin-tab-manager';
import {
  loadContactSubmissions,
  showContactDetails as showContactDetailsFn
} from './admin-contacts-handler';
import { loadAnalyticsData } from './admin-performance-handler';
import { exportData, clearOldData, resetAnalytics } from './admin-data-operations';
import { setupEventListeners } from './admin-event-setup';
import {
  setupTruncatedTextTooltips,
  loadSystemInfo,
  applyAttentionFilter,
  filterTable
} from './admin-ui-helpers';

// DOM element keys for caching
type DashboardDOMKeys = Record<string, string>;

const logger = createLogger('AdminDashboard');

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

  // DOM element cache
  private domCache = createDOMCache<DashboardDOMKeys>();

  // Focus trap cleanup function for detail modal
  private focusTrapCleanup: { current: (() => void) | null } = { current: null };

  // Messages state
  private messagesState = {
    selectedClientId: null as number | null,
    selectedThreadId: null as number | null
  };

  // Delegate currentProjectId to project details handler
  private get currentProjectId(): number | null {
    return this.projectDetails.getCurrentProjectId();
  }

  private set currentProjectId(value: number | null) {
    if (value === null) {
      // Reset by switching tabs - handled in switchTab method
    }
  }

  /** Reference to shared portal header instance */
  private portalHeader: PortalHeader | null = null;

  constructor() {
    this.registerDOMCache();

    // Initialize module context
    this.moduleContext = {
      getAuthToken: () => sessionStorage.getItem('client_auth_mode'),
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') =>
        this.showNotification(message, type),
      refreshData: () => this.loadTabData('dashboard'),
      switchTab: (tab: string, entityId?: string) => {
        if (entityId !== undefined) this.moduleContext.currentEntityId = entityId;
        this.switchTab(tab);
      },
      currentEntityId: null
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

  private registerDOMCache(): void {
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
      crmBadge: '#crm-badge'
    });
  }

  private async init(): Promise<void> {
    logger.log('init() called');
    AdminSecurity.init();
    this.hideAllAdminModals();

    const isAuthenticated = await this.checkAuthentication();

    if (!isAuthenticated) {
      logger.log('Not authenticated, redirecting to login');
      AdminAuth.setApiAuthenticated(false);
      window.location.href = '/#/portal';
      return;
    }

    AdminAuth.setApiAuthenticated(true);
    this.showDashboard();
    this.updateGreeting();
    await this.initializeModules();
    this.initializeCommandPalette();
    initKeyboardHelp();

    logger.log('Setting up dashboard');
    setupEventListeners(this.domCache, {
      switchTab: (tab) => this.switchTab(tab),
      switchTabInternal: (tab) => this.switchTabInternal(tab),
      toggleSidebar: () => this.toggleSidebar(),
      loadTabData: (tab) => this.loadTabData(tab),
      loadContactSubmissions: () => this.refreshContacts(),
      loadAnalyticsData: () => loadAnalyticsData(this.moduleContext),
      loadSystemInfo: () => loadSystemInfo(this.domCache),
      handleLogout: () => this.handleLogout(),
      showLoading: (show) => this.showLoading(show),
      applyAttentionFilter: (tab, f) => applyAttentionFilter(tab, f, filterTable),
      filterTable: (table, f) => filterTable(table, f),
      exportData: (type) => exportData(type, (msg, t) => this.showNotification(msg, t)),
      clearOldData: () => clearOldData((msg, t) => this.showNotification(msg, t)),
      resetAnalytics: () => resetAnalytics((msg, t) => this.showNotification(msg, t))
    });
    initCopyEmailDelegation(document);
    logger.log('setupEventListeners complete');
    await this.loadTabData('dashboard');
    this.handleInitialNavigation();
    setupTruncatedTextTooltips();
    this.updateSidebarBadges();
    this.startAutoRefresh();
  }

  private handleInitialNavigation(): void {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const projectIdParam = params.get('projectId');

    if (window.location.pathname === '/admin/login') {
      const url = new URL(window.location.href);
      url.pathname = '/admin';
      window.history.replaceState({}, '', url.toString());
    }

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

  private initializeCommandPalette(): void {
    initAdminCommandPalette({
      switchTab: (tab: string) => this.switchTab(tab),
      logout: () => this.handleLogout()
    });
    logger.log('Command palette initialized');
  }

  private cleanupCommandPalette(): void {
    destroyAdminCommandPalette();
  }

  private async checkAuthentication(): Promise<boolean> {
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 500;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await apiFetch('/api/admin/leads');
        if (response.status === 503) {
          if (attempt < MAX_RETRIES) {
            logger.log(
              `Backend starting up (attempt ${attempt}), retrying in ${RETRY_DELAY_MS}ms...`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
        }
        return response.ok;
      } catch (error) {
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

  private showDashboard(): void {
    const authGate = this.domCache.get('authGate');
    const dashboard = this.domCache.get('adminDashboard');

    if (authGate) authGate.style.display = 'none';
    if (dashboard) {
      dashboard.classList.remove('hidden');
      dashboard.style.display = '';
    }
    const adminHeader = document.querySelector('.admin-header');
    const adminNav = document.querySelector('.admin-nav');
    const adminFooter = document.querySelector('.admin-footer');
    if (adminHeader) (adminHeader as HTMLElement).style.display = 'none';
    if (adminNav) (adminNav as HTMLElement).style.display = 'none';
    if (adminFooter) (adminFooter as HTMLElement).style.display = 'none';
    document.body.classList.add('admin-logged-in');
    updateAdminBreadcrumbs(this.currentTab, this.projectDetails, (tab) => this.switchTab(tab));
    this.currentGroup = updateActiveGroupState(
      getAdminGroupForTab(this.currentTab),
      this.currentTab
    );
  }

  private updateGreeting(tab?: string): void {
    const greetingEl = document.getElementById('page-header-greeting');
    if (!greetingEl) return;

    const currentTab = tab || this.currentTab;
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

    const currentUser = authStore.getCurrentUser() as AdminUser | null;
    let displayName = 'Admin';
    if (currentUser) {
      if (currentUser.username) {
        displayName = currentUser.username;
      } else if (currentUser.email) {
        displayName = currentUser.email.split('@')[0];
        displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      }
    }

    greetingEl.innerHTML = `${greeting}, <b>${SanitizationUtils.escapeHtml(displayName)}</b>`;
    greetingEl.style.display = '';
  }

  private async initializeModules(): Promise<void> {
    initializeDeliverablesModule();
    this.portalHeader = await initPortalHeader({ role: 'admin' });

    const modalRoot = document.getElementById('admin-modal-root');
    if (modalRoot) {
      await mountReactModule('admin-modals', modalRoot, this.moduleContext);
    }
  }

  private toggleSidebar(): void {
    const sidebar = this.domCache.get('sidebar');
    const page = document.querySelector('[data-page="admin"]');
    sidebar?.classList.toggle('collapsed');
    const isCollapsed = sidebar?.classList.contains('collapsed');
    page?.setAttribute('data-sidebar-collapsed', isCollapsed ? 'true' : 'false');
  }

  // --- Contacts delegation ---

  private refreshContacts(): void {
    loadContactSubmissions(
      this.domCache,
      this.contactsData,
      (id) => this.showContactDetailsView(id)
    ).then((data) => {
      this.contactsData = data;
    });
  }

  private showContactDetailsView(contactId: number): void {
    showContactDetailsFn(
      contactId,
      this.contactsData,
      this.domCache,
      this.focusTrapCleanup,
      () => this.refreshContacts()
    );
  }

  // --- Lead invitation ---

  private async inviteLead(leadId: number, email: string): Promise<void> {
    const inviteBtn = this.domCache.getAs<HTMLButtonElement>('inviteLeadBtn');
    if (inviteBtn) {
      inviteBtn.disabled = true;
      inviteBtn.textContent = 'Sending Invitation...';
    }

    try {
      const response = await apiPost(`/api/admin/leads/${leadId}/invite`);
      if (response.ok) {
        const raw = await response.json();
        const data = unwrapApiData<Record<string, unknown>>(raw);
        if (!data.error) {
          await alertSuccess(
            `Invitation sent to ${email}! They will receive a link to set up their account.`
          );
          const modal = this.domCache.get('detailModal');
          if (modal) modal.style.display = 'none';
          this.loadTabData('leads');
          this.loadTabData('projects');
        } else {
          await alertError((data.error as string) || 'Failed to send invitation. Please try again.');
          if (inviteBtn) {
            inviteBtn.disabled = false;
            inviteBtn.textContent = 'Invite to Client Portal';
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({} as Record<string, unknown>));
        await alertError((errorData as Record<string, unknown>).error as string || 'Failed to send invitation. Please try again.');
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

  // --- Project status ---

  private async updateProjectStatus(id: number, status: string): Promise<void> {
    try {
      const response = await apiPut(`/api/projects/${id}`, { status });
      if (response.ok) {
        logger.log('Project status updated');
        this.loadTabData('leads');
        this.loadTabData('projects');
      } else {
        logger.error(' Failed to update project status');
        alertError('Failed to update project status');
      }
    } catch (error) {
      logger.error(' Error updating project status:', error);
    }
  }

  private async activateLead(leadId: number): Promise<void> {
    await this.updateProjectStatus(leadId, 'active');
  }

  public showProjectDetails(projectId: number): void {
    this.projectDetails.showProjectDetails(
      projectId,
      this.projectsData,
      (tab) => this.switchTab(tab),
      () => this.loadTabData('projects'),
      formatProjectType,
      (leadId, email) => this.inviteLead(leadId, email)
    );
  }

  public async handleLogout(): Promise<void> {
    logger.log('handleLogout() called via inline onclick');
    this.cleanupCommandPalette();
    try {
      await AdminAuth.logout();
    } catch (error) {
      logger.error('handleLogout failed:', error);
      window.location.href = '/admin';
    }
  }

  // --- Tab switching ---

  private switchTab(tabName: string): void {
    this.switchTabInternal(tabName, true);
  }

  private switchTabInternal(tabName: string, updateUrl = false): void {
    const resolved = resolveAdminTab(tabName);
    const activeTab = resolved.tab;

    document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
    const tabContent =
      document.getElementById(`tab-${activeTab}`) || document.getElementById(`${activeTab}-tab`);
    tabContent?.classList.add('active');

    this.currentTab = activeTab;
    this.currentGroup = updateActiveGroupState(resolved.group, activeTab);

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

    updateAdminPageTitle(activeTab, this.projectDetails);
    this.updateGreeting(activeTab);
    updateAdminBreadcrumbs(activeTab, this.projectDetails, (tab) => this.switchTab(tab));
    this.loadTabData(activeTab);
  }

  // --- Tab data loading ---

  public async loadTabData(tabName: string): Promise<void> {
    this.showLoading(true);

    try {
      const tabContainer = document.getElementById(`tab-${tabName}`)
        || document.getElementById(`${tabName}-tab`);

      // Check if there's an EJS hybrid table for this tab
      const ejsTableId = `admin-${tabName}`;
      if (hasEjsTable(ejsTableId) && tabContainer) {
        const navigateToEntity = (rowId: string | number) => {
          const tableRoot = tabContainer.querySelector<HTMLElement>('[data-table-id]');
          const config = tableRoot?.getAttribute('data-table-config');
          if (config) {
            try {
              const def = JSON.parse(config);
              if (def.rowClickTarget) {
                this.moduleContext.currentEntityId = String(rowId);
                this.switchTab(def.rowClickTarget);
              }
            } catch { /* ignore parse error */ }
          }
        };

        await loadEjsTable(ejsTableId, tabContainer, {
          onRowClick: (rowId) => navigateToEntity(rowId),
          onAction: (action, rowId) => {
            if (action === 'view') navigateToEntity(rowId);
          }
        });
        return;
      }

      // Check if there's a React module for this tab
      if (hasReactModule(tabName) && tabContainer) {
        await mountReactModule(tabName, tabContainer, this.moduleContext);
        return;
      }

      switch (tabName) {
      case 'visitors':
        logger.log('Visitors view requested - handled by analytics component');
        break;
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

      const tabContainer = document.getElementById(`tab-${tabName}`);
      if (tabContainer) {
        tabContainer.innerHTML = `
          <div class="module-error-state">
            <p class="text-danger">
              Failed to load ${tabName.replace(/-/g, ' ')} module
            </p>
            <p class="text-muted text-sm">
              ${errorMessage}
            </p>
            <button class="btn-secondary tw-mt-4" data-action="retry" data-tab="${tabName}">
              Retry
            </button>
          </div>
        `;
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

  // --- Utility methods ---

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
    const logFn = type === 'error' ? logger.error : logger.log;
    logFn(`${type.toUpperCase()}: ${message}`);

    if (type === 'error') {
      alertError(message);
    } else {
      showToast(message, type);
    }
  }

  private async updateSidebarBadges(): Promise<void> {
    try {
      const response = await apiFetch('/api/admin/sidebar-counts');
      if (!response.ok) return;

      const raw = await response.json();
      const data = unwrapApiData<Record<string, unknown>>(raw);

      const crmBadge = this.domCache.get('crmBadge');
      if (crmBadge) {
        if ((data.messages as number) > 0) {
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
    this.refreshInterval = setInterval(
      () => {
        this.loadTabData(this.currentTab);
        this.updateSidebarBadges();
      },
      5 * 60 * 1000
    );
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // ============================================================================
  // PROJECT DETAILS DELEGATE METHODS
  // Exposed for onclick handlers in dynamically rendered HTML
  // ============================================================================

  public toggleMilestone(milestoneId: number, isCompleted: boolean): Promise<void> {
    return this.projectDetails.toggleMilestone(milestoneId, isCompleted);
  }

  public deleteMilestone(milestoneId: number): Promise<void> {
    return this.projectDetails.deleteMilestone(milestoneId);
  }

  public toggleMilestoneTasks(milestoneId: number, projectId: number): Promise<void> {
    return this.projectDetails.toggleMilestoneTasks(milestoneId, projectId);
  }

  public toggleTaskCompletion(
    taskId: number,
    isCompleted: boolean,
    projectId: number
  ): Promise<void> {
    return this.projectDetails.toggleTaskCompletion(taskId, isCompleted, projectId);
  }

  public sendInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.sendInvoice(invoiceId);
  }

  public markInvoicePaid(invoiceId: number): Promise<void> {
    return this.projectDetails.markInvoicePaid(invoiceId);
  }

  public sendInvoiceReminder(invoiceId: number): Promise<void> {
    return this.projectDetails.sendInvoiceReminder(invoiceId);
  }

  public editInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.editInvoice(invoiceId);
  }

  public showApplyCreditPrompt(invoiceId: number): Promise<void> {
    return this.projectDetails.showApplyCreditPrompt(invoiceId);
  }

  public duplicateInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.duplicateInvoice(invoiceId);
  }

  public deleteInvoice(invoiceId: number): Promise<void> {
    return this.projectDetails.deleteInvoice(invoiceId);
  }

  public recordPayment(invoiceId: number): Promise<void> {
    return this.projectDetails.recordPayment(invoiceId);
  }

  public cancelScheduledInvoice(scheduleId: number): Promise<void> {
    return this.projectDetails.cancelScheduledInvoice(scheduleId);
  }

  public toggleRecurringInvoice(recurringId: number, isActive: boolean): Promise<void> {
    return this.projectDetails.toggleRecurringInvoice(recurringId, isActive);
  }

  public destroy(): void {
    this.stopAutoRefresh();
    this.charts.forEach((chart) => chart.destroy());
    this.charts.clear();
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
