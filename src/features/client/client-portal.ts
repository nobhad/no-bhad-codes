/**
 * ===============================================
 * CLIENT PORTAL MODULE
 * ===============================================
 * @file src/modules/client-portal.ts
 *
 * Orchestrator for client portal functionality including login, project dashboard,
 * and project management interface. Delegates to extracted modules:
 *
 * - portal-event-handlers.ts     - Event listener setup, login, auth events
 * - portal-settings-handler.ts   - Settings/form submissions
 * - portal-dashboard-renderer.ts - Dashboard stats, milestones, projects list
 * - portal-project-detail.ts     - Project selection and detail rendering
 * - portal-session-manager.ts    - Dashboard display, routing, admin, logout
 */

import { BaseModule } from '../../modules/core/base';
import type { ClientProject } from '../../types/client';
import type { ClientPortalContext } from './portal-types';
import {
  loadNavigationModule,
  loadAuthModule
} from './modules';
import { ROUTES as _ROUTES } from '../../constants/api-endpoints';
import { createDOMCache } from '../../utils/dom-cache';
import { formatDate } from '../../utils/format-utils';
import { showToast } from '../../utils/toast-notifications';
import { initCopyEmailDelegation } from '../../utils/copy-email';
import { installGlobalAuthInterceptor } from '../../utils/api-client';
import { createLogger } from '../../utils/logger';

// Extracted modules
import {
  setupLoginFormHandler,
  setupPasswordToggle,
  setupMagicLinkToggle,
  setupAuthEventListeners,
  clearPortalData,
  setupDashboardEventListeners as setupDashboardListeners,
  normalizeProjectTabs
} from './portal-event-handlers';
import {
  setupSettingsFormHandlers,
  initializePasswordForm as _initializePasswordForm,
  loadUserSettings
} from './portal-settings-handler';
import {
  loadRealUserProjects,
  loadDashboardStats as _loadDashboardStats
} from './portal-dashboard-renderer';
import {
  selectProject as selectProjectDetail
} from './portal-project-detail';
import {
  showDashboard as showDashboardFlow,
  logout as _logout,
  handleLogout,
  switchTab,
  toggleSidebar,
  sendMessage,
  createSessionManagerState,
  type SessionManagerState
} from './portal-session-manager';

const logger = createLogger('ClientPortal');

// DOM element keys for caching
type PortalDOMKeys = Record<string, string>;

export class ClientPortalModule extends BaseModule {
  private isLoggedIn = false;
  private currentProject: ClientProject | null = null;
  private currentUser: string | null = null;
  private currentUserData: { id: number; email: string; name: string } | null = null;
  private dashboardListenersSetup = false;

  // Configuration
  private config = {
    loginSectionId: 'auth-gate',
    dashboardSectionId: 'client-dashboard',
    loginFormId: 'portal-login-form',
    projectsListId: 'projects-list',
    projectDetailsId: 'project-details'
  };

  // DOM elements
  private loginSection: HTMLElement | null = null;
  private dashboardSection: HTMLElement | null = null;
  private loginForm: HTMLFormElement | null = null;
  private projectsList: HTMLElement | null = null;
  private projectDetails: HTMLElement | null = null;

  /** Context object for module communication */
  private moduleContext: ClientPortalContext;

  /** DOM element cache */
  private domCache = createDOMCache<PortalDOMKeys>();

  /** Session manager state (portal header, react nav, hash router) */
  private sessionState: SessionManagerState;

  constructor(options: { debug?: boolean } = {}) {
    super('client-portal', options);
    this.moduleContext = this.createModuleContext();
    this.sessionState = createSessionManagerState();

    // Register DOM element selectors
    this.domCache.register({
      passwordToggle: '#portal-password-toggle',
      clientPassword: '#portal-password',
      sidebarToggle: '#sidebar-toggle',
      btnLogout: '#btn-logout',
      messageInput: '#message-input',
      btnSendMessage: '#btn-send-message',
      profileForm: '#profile-form',
      passwordForm: '#password-form',
      notificationsForm: '#notifications-form',
      billingForm: '#billing-form',
      newProjectForm: '#new-project-form',
      projectName: '#project-name',
      projectType: '#project-type',
      projectBudget: '#project-budget',
      projectTimeline: '#project-timeline',
      projectDescription: '#project-description',
      settingsName: '#settings-name',
      settingsCompany: '#settings-company',
      settingsPhone: '#settings-phone',
      currentPassword: '#current-password',
      newPassword: '#new-password',
      confirmPassword: '#confirm-password',
      billingCompany: '#billing-company',
      billingAddress: '#billing-address',
      billingAddress2: '#billing-address2',
      billingCity: '#billing-city',
      billingState: '#billing-state',
      billingZip: '#billing-zip',
      billingCountry: '#billing-country',
      clientName: '#client-name',
      welcomeView: '#welcome-view',
      projectDetailView: '#project-detail-view',
      settingsView: '#settings-view',
      billingView: '#billing-view',
      projectTitle: '#project-title',
      projectStatus: '#project-status',
      projectDescriptionEl: '#project-description',
      currentPhase: '#current-phase',
      nextMilestone: '#next-milestone',
      progressFill: '#progress-fill',
      progressText: '#progress-text',
      startDate: '#start-date',
      lastUpdate: '#last-update',
      updatesTimeline: '#updates-timeline',
      messagesList: '#messages-list'
    });
  }

  /** Create module context for passing to child modules */
  private createModuleContext(): ClientPortalContext {
    return {
      // Auth is cookie-based via credentials: 'include'; token getter is unused
      getAuthToken: () => null,
      showNotification: (
        message: string,
        type: 'success' | 'error' | 'info' | 'warning' = 'success'
      ) => {
        if (type === 'error') {
          logger.error(message);
          showToast(message, 'error', { duration: 5000 });
        } else {
          showToast(message, type);
        }
      },
      formatDate: (dateString: string) => formatDate(dateString),
      escapeHtml: (text: string) => this.escapeHtml(text),
      onSelectProject: async (projectId: string) => {
        // Store the project ID for the detail component to pick up
        sessionStorage.setItem('portal_active_project_id', projectId);

        // Navigate to project-detail tab using the tab-content architecture
        const navModule = await loadNavigationModule();
        // Force re-mount so the detail component picks up the new project ID
        navModule.remountTab('project-detail');
        navModule.navigateTo('project-detail');
      }
    };
  }

  protected override async onInit(): Promise<void> {
    // Install global 401 interceptor to handle expired sessions
    installGlobalAuthInterceptor();

    this.cacheElements();
    this.setupEventListeners();
    this.setupAuthEventListeners();
    normalizeProjectTabs();
    initCopyEmailDelegation(document);
    // Set initial breadcrumb at top of page when on client portal
    if (
      document.body.getAttribute('data-page') === 'client-portal' &&
      document.getElementById('breadcrumb-list')
    ) {
      loadNavigationModule().then((nav) =>
        nav.updateBreadcrumbs([{ label: 'Dashboard', href: false }])
      );
    }
    // Check for existing authentication using the auth module
    const authModule = await loadAuthModule();
    await authModule.checkExistingAuth({
      onAuthValid: async (user) => {
        this.isLoggedIn = true;
        this.currentUser = user.email;
        this.currentUserData = user;
        await this.loadRealUserProjectsInternal(user);
        this.showDashboard();
      }
    });
  }

  protected override async onDestroy(): Promise<void> {
    // Cleanup handled by page unload
  }

  private cacheElements(): void {
    this.loginSection = this.getElement(
      'Login section',
      `#${this.config.loginSectionId}`,
      false
    ) as HTMLElement | null;
    this.dashboardSection = this.getElement(
      'Dashboard section',
      `#${this.config.dashboardSectionId}`,
      false
    ) as HTMLElement | null;
    this.loginForm = this.getElement(
      'Login form',
      `#${this.config.loginFormId}`,
      false
    ) as HTMLFormElement | null;
    this.projectsList = this.getElement(
      'Projects list',
      `#${this.config.projectsListId}`,
      false
    ) as HTMLElement | null;
    this.projectDetails = this.getElement(
      'Project details',
      `#${this.config.projectDetailsId}`,
      false
    ) as HTMLElement | null;
  }

  /** Escape HTML to prevent XSS */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ─── Delegation methods ──────────────────────────────────────

  private setupEventListeners(): void {
    const deps = this.createEventHandlerDeps();
    setupLoginFormHandler(deps);

    // Use setTimeout to ensure DOM elements are ready after dashboard is shown
    setTimeout(() => {
      this.setupDashboardEventListeners();
    }, 100);

    setupPasswordToggle(deps);
    setupMagicLinkToggle();
  }

  private setupAuthEventListeners(): void {
    setupAuthEventListeners(this.createEventHandlerDeps());
  }

  private clearPortalData(): void {
    clearPortalData({
      domCache: this.domCache,
      projectsList: this.projectsList,
      projectDetails: this.projectDetails,
      setLoggedIn: (v) => { this.isLoggedIn = v; },
      setCurrentUser: (v) => { this.currentUser = v; },
      setCurrentUserData: (v) => { this.currentUserData = v; },
      log: (...args) => this.log(...args)
    });
    this.currentProject = null;
  }

  private setupDashboardEventListeners(): void {
    setupDashboardListeners(this.createEventHandlerDeps());
  }

  private async loadRealUserProjectsInternal(
    user: { id: number; email: string; name: string }
  ): Promise<void> {
    await loadRealUserProjects(user, this.createDashboardRendererDeps());
  }

  private showDashboard(): void {
    showDashboardFlow(this.createSessionManagerDeps(), this.sessionState);
  }

  private async selectProject(project: ClientProject): Promise<void> {
    await selectProjectDetail(project, {
      domCache: this.domCache,
      moduleContext: this.moduleContext,
      getCurrentProject: () => this.currentProject,
      setCurrentProject: (p) => { this.currentProject = p; },
      escapeHtml: (text) => this.escapeHtml(text)
    });
  }

  // ─── Dependency factory methods ──────────────────────────────

  private createEventHandlerDeps() {
    return {
      domCache: this.domCache,
      loginForm: this.loginForm,
      projectsList: this.projectsList,
      projectDetails: this.projectDetails,
      moduleContext: this.moduleContext,
      log: (...args: unknown[]) => this.log(...args),
      setLoggedIn: (v: boolean) => { this.isLoggedIn = v; },
      setCurrentUser: (v: string | null) => { this.currentUser = v; },
      setCurrentUserData: (v: { id: number; email: string; name: string } | null) => {
        this.currentUserData = v;
      },
      clearPortalData: () => this.clearPortalData(),
      loadRealUserProjects: (user: { id: number; email: string; name: string }) =>
        this.loadRealUserProjectsInternal(user),
      showDashboard: () => this.showDashboard(),
      switchTab: (tabName: string) => switchTab(tabName),
      toggleSidebar: () => toggleSidebar(),
      handleLogout: () => handleLogout(),
      sendMessage: (event: Event) => sendMessage(event, this.moduleContext),
      setupSettingsFormHandlers: () => this.setupSettingsFormHandlersInternal(),
      setupDashboardEventListeners: () => this.setupDashboardEventListeners(),
      getDashboardListenersSetup: () => this.dashboardListenersSetup,
      setDashboardListenersSetup: (v: boolean) => { this.dashboardListenersSetup = v; }
    };
  }

  private createDashboardRendererDeps() {
    return {
      projectsList: this.projectsList,
      escapeHtml: (text: string) => this.escapeHtml(text),
      selectProject: (project: ClientProject) => this.selectProject(project),
      log: (...args: unknown[]) => this.log(...args)
    };
  }

  private createSessionManagerDeps() {
    return {
      loginSection: this.loginSection,
      dashboardSection: this.dashboardSection,
      loginForm: this.loginForm,
      moduleContext: this.moduleContext,
      getCurrentUserData: () => this.currentUserData,
      log: (...args: unknown[]) => this.log(...args),
      setLoggedIn: (v: boolean) => { this.isLoggedIn = v; },
      setDashboardListenersSetup: (v: boolean) => { this.dashboardListenersSetup = v; },
      getDashboardListenersSetup: () => this.dashboardListenersSetup,
      setupDashboardEventListeners: () => this.setupDashboardEventListeners()
    };
  }

  private setupSettingsFormHandlersInternal(): void {
    setupSettingsFormHandlers({
      domCache: this.domCache,
      getCurrentUser: () => this.currentUser,
      getCurrentUserData: () => this.currentUserData,
      loadRealUserProjects: (user) => this.loadRealUserProjectsInternal(user),
      switchTab: (tabName) => switchTab(tabName),
      moduleContext: this.moduleContext
    });
  }

  /** Files API base URL */
  private static readonly FILES_API_BASE = '/api/uploads';

  /** Invoices API base URL */
  private static readonly INVOICES_API_BASE = '/api/invoices';

  /** Clients API base URL */
  private static readonly CLIENTS_API_BASE = '/api/clients';

  /** Projects API base URL */
  private static readonly PROJECTS_API_BASE = '/api/projects';

  /** Messages API base URL */
  private static readonly MESSAGES_API_BASE = '/api/messages';

  /**
   * Load user settings - delegates to settings module
   * Also initializes form handlers after view is available
   */
  private async loadUserSettings(): Promise<void> {
    await loadUserSettings(this.currentUser, this.moduleContext);
  }
}
