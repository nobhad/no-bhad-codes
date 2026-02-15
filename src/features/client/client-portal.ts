/**
 * ===============================================
 * CLIENT PORTAL MODULE
 * ===============================================
 * @file src/modules/client-portal.ts
 *
 * Handles client portal functionality including login, project dashboard,
 * and project management interface.
 */

import { BaseModule } from '../../modules/core/base';
import type { ClientProject, ClientProjectStatus, ProjectPriority } from '../../types/client';
import type {
  ProjectResponse,
  ProjectMilestoneResponse,
  MessageResponse,
  ProjectUpdateResponse,
  ProjectDetailResponse
} from '../../types/api';
import { gsap } from 'gsap';
import { APP_CONSTANTS } from '../../config/constants';
import type { ClientPortalContext } from './portal-types';
import {
  loadFilesModule,
  loadInvoicesModule,
  loadMessagesModule,
  loadSettingsModule,
  loadNavigationModule,
  loadProjectsModule,
  loadAuthModule,
  loadHelpModule,
  loadDocumentRequestsModule,
  loadQuestionnairesModule,
  loadAdHocRequestsModule,
  loadApprovalsModule,
  loadOnboardingWizardModule
} from './modules';
import { authStore } from '../../auth/auth-store';
import { decodeJwtPayload, isAdminPayload } from '../../utils/jwt-utils';
import { ICONS, getAccessibleIcon } from '../../constants/icons';
import { createDOMCache } from '../../utils/dom-cache';
import { formatTextWithLineBreaks, formatDate } from '../../utils/format-utils';
import { showToast } from '../../utils/toast-notifications';
import { withButtonLoading } from '../../utils/button-loading';
import { initCopyEmailDelegation } from '../../utils/copy-email';
import { installGlobalAuthInterceptor } from '../../utils/api-client';

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

  constructor(options: { debug?: boolean } = {}) {
    super('client-portal', options);
    this.moduleContext = this.createModuleContext();

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
      getAuthToken: () => sessionStorage.getItem('client_auth_mode'),
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        if (type === 'error') {
          console.error('[ClientPortal]', message);
          showToast(message, 'error', { duration: 5000 });
        } else {
          showToast(message, type);
        }
      },
      formatDate: (dateString: string) => formatDate(dateString),
      escapeHtml: (text: string) => this.escapeHtml(text)
    };
  }

  protected override async onInit(): Promise<void> {
    // Install global 401 interceptor to handle expired sessions
    installGlobalAuthInterceptor();

    this.cacheElements();
    this.setupEventListeners();
    this.setupAuthEventListeners();
    this.normalizeProjectTabs();
    initCopyEmailDelegation(document);
    // Set initial breadcrumb at top of page when on client portal (so it shows even before/without login)
    if (document.body.getAttribute('data-page') === 'client-portal' && document.getElementById('breadcrumb-list')) {
      loadNavigationModule().then((nav) => nav.updateBreadcrumbs([{ label: 'Dashboard', href: false }]));
    }
    // Check for existing authentication using the auth module
    const authModule = await loadAuthModule();
    await authModule.checkExistingAuth({
      onAuthValid: async (user) => {
        this.isLoggedIn = true;
        this.currentUser = user.email;
        this.currentUserData = user;
        await this.loadRealUserProjects(user);
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

  private setupEventListeners(): void {
    if (this.loginForm) {
      this.log('Login form found, attaching submit handler');
      // Note: Do NOT dynamically change autocomplete attributes - this causes
      // browsers to re-evaluate and show multiple save password prompts.
      // Autocomplete attributes are set correctly in HTML.
      this.loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.log('Login form submitted');

        const formData = new FormData(this.loginForm!);
        const email = (formData.get('email') as string || '').trim();
        const password = formData.get('password') as string || '';

        this.log('Login attempt for:', email);

        if (!email || !password) {
          this.log('Missing email or password');
          const authModule = await loadAuthModule();
          authModule.showLoginError('Please enter your email and password');
          return;
        }

        const authModule = await loadAuthModule();
        await authModule.handleLogin(
          { email, password },
          {
            onLoginSuccess: async (user) => {
              this.log('Login successful for:', user.email);
              // Clear any stale data before loading new user's data
              this.clearPortalData();
              this.isLoggedIn = true;
              this.currentUser = user.email;
              this.currentUserData = user;
              await this.loadRealUserProjects(user);
              const isOnPortalPage = document.body.getAttribute('data-page') === 'client-portal';
              if (!isOnPortalPage) {
                window.location.href = '/client/';
                return;
              }
              this.showDashboard();
            },
            onLoginError: (message) => {
              this.log('Login error:', message);
              authModule.showLoginError(message);
            },
            setLoading: (loading) => authModule.setLoginLoading(loading),
            clearErrors: () => authModule.clearErrors(),
            showFieldError: (fieldId, message) => authModule.showFieldError(fieldId, message)
          }
        );
      });
    } else {
      this.log('Login form not found');
    }

    // Use setTimeout to ensure DOM elements are ready after dashboard is shown
    setTimeout(() => {
      this.setupDashboardEventListeners();
    }, 100);

    // Password toggle (login form)
    const passwordToggle = this.domCache.get('passwordToggle');
    const passwordInput = this.domCache.getAs<HTMLInputElement>('clientPassword');
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        passwordToggle.innerHTML =
          type === 'password'
            ? getAccessibleIcon('EYE', 'Show password')
            : getAccessibleIcon('EYE_OFF', 'Hide password');
      });
    }

    // Magic link toggle handler
    this.setupMagicLinkToggle();
  }

  /**
   * Setup magic link toggle and form submission
   */
  private setupMagicLinkToggle(): void {
    const toggle = document.getElementById('magic-link-toggle');
    const passwordForm = document.getElementById('portal-login-form');
    const magicLinkForm = document.getElementById('magic-link-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');

    if (!toggle || !passwordForm || !magicLinkForm) {
      return;
    }

    // Toggle between password and magic link forms
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const isShowingPassword = passwordForm.style.display !== 'none';

      if (isShowingPassword) {
        // Switch to magic link form
        passwordForm.style.display = 'none';
        magicLinkForm.style.display = 'block';
        toggle.textContent = 'Use password instead';
        if (forgotPasswordLink) {
          forgotPasswordLink.style.display = 'none';
        }
        // Clear any previous magic link errors/success
        const magicError = document.getElementById('magic-link-error');
        const magicSuccess = document.getElementById('magic-link-success');
        if (magicError) magicError.textContent = '';
        if (magicSuccess) magicSuccess.style.display = 'none';
      } else {
        // Switch to password form
        passwordForm.style.display = 'block';
        magicLinkForm.style.display = 'none';
        toggle.textContent = 'Use magic link instead';
        if (forgotPasswordLink) {
          forgotPasswordLink.style.display = '';
        }
      }
    });

    // Magic link form submission
    magicLinkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('magic-link-email') as HTMLInputElement;
      const submitBtn = document.getElementById('magic-link-btn') as HTMLButtonElement;
      const errorEl = document.getElementById('magic-link-error');
      const successEl = document.getElementById('magic-link-success');
      const emailError = document.getElementById('magic-email-error');

      if (!emailInput || !submitBtn) return;

      const email = emailInput.value.trim();

      // Clear previous errors
      if (errorEl) errorEl.textContent = '';
      if (emailError) emailError.style.display = 'none';
      if (successEl) successEl.style.display = 'none';

      if (!email) {
        if (emailError) {
          emailError.textContent = 'Email address is required';
          emailError.style.display = 'block';
        }
        return;
      }

      // Show loading state
      submitBtn.disabled = true;
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoading = submitBtn.querySelector('.btn-loading');
      if (btnText) (btnText as HTMLElement).style.display = 'none';
      if (btnLoading) (btnLoading as HTMLElement).style.display = 'inline';

      try {
        const { requestMagicLink } = await import('../../auth');
        const result = await requestMagicLink(email);

        if (result.success) {
          // Show success message
          if (successEl) {
            successEl.style.display = 'block';
          }
          // Hide the submit button after success
          submitBtn.style.display = 'none';
        } else {
          if (errorEl) {
            errorEl.textContent = result.error || 'Failed to send magic link. Please try again.';
          }
        }
      } catch (error) {
        if (errorEl) {
          errorEl.textContent = 'Failed to send magic link. Please try again.';
        }
        console.error('Magic link error:', error);
      } finally {
        submitBtn.disabled = false;
        if (btnText) (btnText as HTMLElement).style.display = 'inline';
        if (btnLoading) (btnLoading as HTMLElement).style.display = 'none';
      }
    });
  }

  private normalizeProjectTabs(): void {
    document.querySelectorAll('.project-tabs').forEach((tabs) => {
      tabs.classList.add('portal-tabs');
    });

    document.querySelectorAll('.tab-pane').forEach((panel) => {
      panel.classList.add('portal-tab-panel');
    });
  }

  /**
   * Setup auth event listeners to handle session expiry
   * Clears sensitive data from DOM when session expires to prevent data leakage
   */
  private setupAuthEventListeners(): void {
    // Listen for session expiry to clear sensitive data and redirect to login
    window.addEventListener('nbw:auth:session-expired', () => {
      this.log('Session expired - redirecting to login');
      this.clearPortalData();
      // Redirect to login page - prevents seeing any portal content
      window.location.href = '/client/?session=expired';
    });

    // Listen for logout to ensure data is cleared
    window.addEventListener('nbw:auth:logout', () => {
      this.log('User logged out - clearing portal data');
      this.clearPortalData();
    });
  }

  /**
   * Clear all portal data from DOM and state
   * Called on session expiry or logout to prevent data leakage
   */
  private clearPortalData(): void {
    // Clear state
    this.isLoggedIn = false;
    this.currentUser = null;
    this.currentUserData = null;

    // Clear milestones list
    const milestonesList = document.getElementById('milestones-list');
    if (milestonesList) {
      milestonesList.innerHTML = '';
    }

    // Clear milestones summary
    const milestonesSummary = document.getElementById('milestones-summary');
    if (milestonesSummary) {
      milestonesSummary.textContent = '';
    }

    // Clear projects list
    if (this.projectsList) {
      this.projectsList.innerHTML = '';
    }

    // Clear project details
    if (this.projectDetails) {
      this.projectDetails.innerHTML = '';
    }

    // Clear any visible project title/description
    const projectTitle = this.domCache.get('projectTitle');
    if (projectTitle) {
      projectTitle.textContent = '';
    }

    const projectDescription = this.domCache.get('projectDescriptionEl');
    if (projectDescription) {
      projectDescription.textContent = '';
    }

    // Clear progress indicators
    const progressFill = this.domCache.get('progressFill') as HTMLElement | null;
    if (progressFill) {
      progressFill.style.width = '0%';
    }

    const progressText = this.domCache.get('progressText');
    if (progressText) {
      progressText.textContent = '';
    }

    // Clear messages list
    const messagesList = this.domCache.get('messagesList');
    if (messagesList) {
      messagesList.innerHTML = '';
    }

    // Clear updates timeline
    const updatesTimeline = this.domCache.get('updatesTimeline');
    if (updatesTimeline) {
      updatesTimeline.innerHTML = '';
    }

    this.log('Portal data cleared');
  }

  private setupDashboardEventListeners(): void {
    if (this.dashboardListenersSetup) {
      this.log('Dashboard event listeners already set up, skipping...');
      return;
    }

    this.log('Setting up dashboard event listeners...');

    // Sidebar toggle (desktop)
    const sidebarToggle = this.domCache.get('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }

    // Header sidebar toggle buttons (arrows next to page titles) - legacy
    const headerSidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
    headerSidebarToggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
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

    // Mobile menu toggle button (in page header)
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
      // Add accessibility attributes if not present
      if (!mobileMenuToggle.hasAttribute('aria-label')) {
        mobileMenuToggle.setAttribute('aria-label', 'Toggle navigation menu');
      }
      if (!mobileMenuToggle.hasAttribute('aria-expanded')) {
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
      }
      mobileMenuToggle.setAttribute('aria-controls', 'sidebar');

      mobileMenuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }

    // Sidebar toggle button - add accessibility attributes
    if (sidebarToggleBtn) {
      if (!sidebarToggleBtn.hasAttribute('aria-label')) {
        sidebarToggleBtn.setAttribute('aria-label', 'Toggle sidebar');
      }
      if (!sidebarToggleBtn.hasAttribute('aria-expanded')) {
        sidebarToggleBtn.setAttribute('aria-expanded', 'true');
      }
      sidebarToggleBtn.setAttribute('aria-controls', 'sidebar');
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

    // Logout button
    const logoutBtn = this.domCache.get('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    // Sidebar buttons with data-tab attribute - each goes directly to its view
    const sidebarButtons = document.querySelectorAll('.sidebar-buttons .btn[data-tab]');
    if (sidebarButtons.length > 0) {
      this.log(`Found ${sidebarButtons.length} sidebar buttons with data-tab`);
      sidebarButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const btnEl = btn as HTMLElement;
          const tabName = btnEl.dataset.tab;
          if (tabName) {
            this.switchTab(tabName);
          }
        });
      });
    }

    // Header group subtabs - REMOVED (each page is now standalone)
    // Legacy support: if any header subtabs still exist, handle them
    const headerGroups = document.querySelectorAll('.header-subtab-group[data-mode="primary"]');
    headerGroups.forEach((group) => {
      const groupEl = group as HTMLElement;
      if (groupEl.dataset.initialized === 'true') return;
      groupEl.dataset.initialized = 'true';

      groupEl.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('.portal-subtab') as HTMLElement | null;
        if (!target) return;
        const tabName = target.dataset.subtab;
        if (!tabName) return;
        this.switchTab(tabName);
      });
    });

    // Clickable stat cards
    const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
    if (statCards.length > 0) {
      this.log(`Found ${statCards.length} clickable stat cards`);
      statCards.forEach((card) => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          const tabName = (card as HTMLElement).dataset.tab;
          if (tabName) {
            this.switchTab(tabName);
          }
        });
      });
    }

    // Password toggle buttons
    const passwordToggles = document.querySelectorAll('.cp-password-toggle');
    passwordToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = (toggle as HTMLElement).dataset.target;
        if (targetId) {
          const input = document.getElementById(targetId) as HTMLInputElement;
          if (input) {
            if (input.type === 'password') {
              input.type = 'text';
              toggle.innerHTML = ICONS.EYE_OFF;
            } else {
              input.type = 'password';
              toggle.innerHTML = ICONS.EYE;
            }
          }
        }
      });
    });

    const messageInput = this.domCache.getAs<HTMLTextAreaElement>('messageInput');
    const sendButton = this.domCache.get('btnSendMessage');

    // Enter key to send message
    if (messageInput && sendButton) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendButton.click();
        }
      });

      // Send button click handler
      sendButton.addEventListener('click', (e) => {
        this.sendMessage(e);
      });
    }

    // Setup file upload handlers (drag & drop) and filter listeners - uses module
    loadFilesModule().then((filesModule) => {
      filesModule.setupFileUploadHandlers(this.moduleContext);
      filesModule.setupFileFilterListeners(this.moduleContext);
    });

    // Setup settings form handlers
    this.setupSettingsFormHandlers();

    this.log('Dashboard event listeners setup complete');
    this.dashboardListenersSetup = true;

    // Note: Initial tab is now handled by hash router in showDashboard()
    // via initializeHashRouter() which reads the URL hash
  }

  /**
   * Setup settings form handlers (profile, notifications, billing)
   */
  private setupSettingsFormHandlers(): void {
    // Profile form
    const profileForm = this.domCache.getAs<HTMLFormElement>('profileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = profileForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        await withButtonLoading(submitBtn, () => this.saveProfileSettings(), 'Saving...');
      });
    }

    // NOTE: Password form is now part of the settings view template (portal-views.ts)
    // and is initialized via initializePasswordForm() when settings tab is loaded.
    // This prevents browser password save prompts on dashboard load since the form
    // doesn't exist in the DOM until the user navigates to settings.

    // Notifications form
    const notificationsForm = this.domCache.getAs<HTMLFormElement>('notificationsForm');
    if (notificationsForm) {
      notificationsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = notificationsForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        await withButtonLoading(submitBtn, () => this.saveNotificationSettings(), 'Saving...');
      });
    }

    // Billing form
    const billingForm = this.domCache.getAs<HTMLFormElement>('billingForm');
    if (billingForm) {
      billingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = billingForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        await withButtonLoading(submitBtn, () => this.saveBillingSettings(), 'Saving...');
      });
    }

    // New project form
    const newProjectForm = this.domCache.getAs<HTMLFormElement>('newProjectForm');
    if (newProjectForm) {
      newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = newProjectForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        await withButtonLoading(submitBtn, () => this.submitProjectRequest(), 'Submitting...');
      });
    }
  }

  /**
   * Submit new project request
   */
  private async submitProjectRequest(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      showToast('Please log in to submit a project request.', 'error');
      return;
    }

    const name = this.domCache.getAs<HTMLInputElement>('projectName')?.value;
    const projectType = this.domCache.getAs<HTMLSelectElement>('projectType')?.value;
    const budget = this.domCache.getAs<HTMLSelectElement>('projectBudget')?.value;
    const timeline = this.domCache.getAs<HTMLSelectElement>('projectTimeline')?.value;
    const description = this.domCache.getAs<HTMLTextAreaElement>('projectDescription')?.value;

    if (!name || !projectType || !description) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await fetch(`${ClientPortalModule.PROJECTS_API_BASE}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({
          name,
          projectType,
          budget,
          timeline,
          description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit project request');
      }

      showToast(data.message || 'Project request submitted successfully!', 'success');

      // Clear the form
      const form = document.getElementById('new-project-form') as HTMLFormElement;
      if (form) form.reset();

      // Reload projects list to show the new project
      if (this.currentUserData) {
        await this.loadRealUserProjects(this.currentUserData);
      }

      // Switch to dashboard tab
      this.switchTab('dashboard');
    } catch (error) {
      console.error('Error submitting project request:', error);
      showToast('Failed to submit project request. Please try again.', 'error');
    }
  }

  /**
   * Save profile settings
   */
  private async saveProfileSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      showToast('Please log in to save settings.', 'error');
      return;
    }

    const contactName = this.domCache.getAs<HTMLInputElement>('settingsName')?.value;
    const companyName = this.domCache.getAs<HTMLInputElement>('settingsCompany')?.value;
    const phone = this.domCache.getAs<HTMLInputElement>('settingsPhone')?.value;
    // Password fields are rendered dynamically, so access directly from DOM
    const currentPassword = (document.getElementById('current-password') as HTMLInputElement | null)?.value;
    const newPassword = (document.getElementById('new-password') as HTMLInputElement | null)?.value;
    const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement | null)?.value;

    try {
      // Update profile info
      const profileResponse = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify({
          contact_name: contactName,
          company_name: companyName,
          phone: phone
        })
      });

      if (!profileResponse.ok) {
        const error = await profileResponse.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      // If password fields are filled, update password
      if (currentPassword && newPassword) {
        if (newPassword !== confirmPassword) {
          showToast('New passwords do not match', 'error');
          return;
        }

        if (newPassword.length < 8) {
          showToast('Password must be at least 8 characters', 'error');
          return;
        }

        const passwordResponse = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Include HttpOnly cookies
          body: JSON.stringify({
            currentPassword,
            newPassword
          })
        });

        if (!passwordResponse.ok) {
          const error = await passwordResponse.json();
          throw new Error(error.error || 'Failed to update password');
        }

        // Clear password fields (rendered dynamically)
        const currPassEl = document.getElementById('current-password') as HTMLInputElement | null;
        const newPassEl = document.getElementById('new-password') as HTMLInputElement | null;
        const confPassEl = document.getElementById('confirm-password') as HTMLInputElement | null;
        if (currPassEl) currPassEl.value = '';
        if (newPassEl) newPassEl.value = '';
        if (confPassEl) confPassEl.value = '';
      }

      showToast('Profile updated successfully!', 'success');

      // Refresh displayed profile data
      await this.loadUserSettings();
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast('Failed to save profile. Please try again.', 'error');
    }
  }

  /**
   * Initialize password form event handlers (form HTML is now in portal-views.ts template)
   * Sets up password toggle buttons and form submission
   */
  private initializePasswordForm(): void {
    const passwordForm = document.getElementById('password-form') as HTMLFormElement | null;
    if (!passwordForm || passwordForm.dataset.initialized === 'true') return;

    passwordForm.dataset.initialized = 'true';

    // Initialize password toggles
    const toggles = passwordForm.querySelectorAll<HTMLButtonElement>('[data-password-toggle]');
    toggles.forEach((toggle) => {
      const inputId = toggle.dataset.passwordToggle;
      if (!inputId) return;
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
          // Update icon
          const isVisible = input.type === 'text';
          toggle.innerHTML = isVisible
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
      });
    });

    // Attach form submit handler
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = passwordForm.querySelector('button[type="submit"]') as HTMLButtonElement;
      await withButtonLoading(submitBtn, () => this.savePasswordSettings(), 'Updating...');
    });
  }

  /**
   * Save password settings
   */
  private async savePasswordSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      showToast('Please log in to change your password.', 'error');
      return;
    }

    // Get password values directly from DOM (elements are rendered dynamically)
    const currentPassword = (document.getElementById('current-password') as HTMLInputElement | null)?.value;
    const newPassword = (document.getElementById('new-password') as HTMLInputElement | null)?.value;
    const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement | null)?.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Please fill in all password fields', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    try {
      const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }

      // Clear password fields (rendered dynamically)
      const currPassEl2 = document.getElementById('current-password') as HTMLInputElement | null;
      const newPassEl2 = document.getElementById('new-password') as HTMLInputElement | null;
      const confPassEl2 = document.getElementById('confirm-password') as HTMLInputElement | null;
      if (currPassEl2) currPassEl2.value = '';
      if (newPassEl2) newPassEl2.value = '';
      if (confPassEl2) confPassEl2.value = '';

      showToast('Password updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating password:', error);
      showToast('Failed to update password. Please try again.', 'error');
    }
  }

  /**
   * Save notification settings
   */
  private async saveNotificationSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      showToast('Please log in to save settings.', 'error');
      return;
    }

    const form = this.domCache.get('notificationsForm');
    if (!form) return;

    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    const settings = {
      messages: (checkboxes[0] as HTMLInputElement)?.checked || false,
      status: (checkboxes[1] as HTMLInputElement)?.checked || false,
      invoices: (checkboxes[2] as HTMLInputElement)?.checked || false,
      weekly: (checkboxes[3] as HTMLInputElement)?.checked || false
    };

    try {
      const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update notification preferences');
      }

      showToast('Notification preferences saved!', 'success');
    } catch (error) {
      console.error('Error saving notifications:', error);
      showToast('Failed to save preferences. Please try again.', 'error');
    }
  }

  /**
   * Save billing settings
   */
  private async saveBillingSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode) {
      showToast('Please log in to save settings.', 'error');
      return;
    }

    const billing = {
      company: this.domCache.getAs<HTMLInputElement>('billingCompany')?.value,
      address: this.domCache.getAs<HTMLInputElement>('billingAddress')?.value,
      address2: this.domCache.getAs<HTMLInputElement>('billingAddress2')?.value,
      city: this.domCache.getAs<HTMLInputElement>('billingCity')?.value,
      state: this.domCache.getAs<HTMLInputElement>('billingState')?.value,
      zip: this.domCache.getAs<HTMLInputElement>('billingZip')?.value,
      country: this.domCache.getAs<HTMLInputElement>('billingCountry')?.value
    };

    try {
      const response = await fetch(`${ClientPortalModule.CLIENTS_API_BASE}/me/billing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include HttpOnly cookies
        body: JSON.stringify(billing)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update billing information');
      }

      showToast('Billing information saved!', 'success');
    } catch (error) {
      console.error('Error saving billing:', error);
      showToast('Failed to save billing info. Please try again.', 'error');
    }
  }

  /**
   * Load real user projects from API (for authenticated users)
   * Fetches projects and milestones from backend instead of using mock data
   */
  private async loadRealUserProjects(user: {
    id: number;
    email: string;
    name: string;
  }): Promise<void> {
    // Show loading state
    if (this.projectsList) {
      this.projectsList.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading projects...</p></div>';
    }

    try {
      // Fetch projects from API
      const projectsResponse = await fetch('/api/projects', {
        credentials: 'include'
      });

      if (!projectsResponse.ok) {
        console.error('[ClientPortal] Failed to fetch projects:', projectsResponse.status);
        // Show error state with client name
        const errorClientName = user.name || user.email || 'Client';
        loadNavigationModule().then((nav) => nav.setClientName(errorClientName));
        if (this.projectsList) {
          this.projectsList.innerHTML =
            '<div class="error-message"><p>Unable to load projects. Please try again later.</p></div>';
        }
        this.renderDashboardMilestones([], 'Unable to load milestones right now.');
        return;
      }

      const projectsData = await projectsResponse.json();
      const apiProjects = projectsData.projects || [];

      if (apiProjects.length === 0) {
        // No projects yet - show empty state with client name
        const emptyClientName = user.name || user.email || 'Client';
        loadNavigationModule().then((nav) => nav.setClientName(emptyClientName));
        this.populateProjectsList([]);
        this.renderDashboardMilestones([]);
        return;
      }

      // Transform API projects to ClientProject interface
      // Track milestone fetch failures for user feedback
      let milestoneFetchFailures = 0;

      const clientProjects: ClientProject[] = await Promise.all(
        apiProjects.map(async (apiProject: ProjectResponse) => {
          // Fetch milestones for this project
          let milestones: ProjectMilestoneResponse[] = [];
          try {
            const milestonesResponse = await fetch(`/api/projects/${apiProject.id}/milestones`, {
              credentials: 'include'
            });
            if (milestonesResponse.ok) {
              const milestonesData = await milestonesResponse.json() as { milestones?: ProjectMilestoneResponse[] };
              milestones = milestonesData.milestones || [];
            } else {
              milestoneFetchFailures++;
              console.warn(`[ClientPortal] Failed to fetch milestones for project ${apiProject.id}: ${milestonesResponse.status}`);
            }
          } catch (milestoneError) {
            milestoneFetchFailures++;
            console.warn(`[ClientPortal] Failed to fetch milestones for project ${apiProject.id}:`, milestoneError);
          }

          // Transform milestone data to match ProjectMilestone interface
          const transformedMilestones = milestones.map((m: ProjectMilestoneResponse) => ({
            id: String(m.id),
            title: m.title || 'Untitled Milestone',
            description: m.description || '',
            dueDate: m.due_date || new Date().toISOString().split('T')[0],
            completedDate: m.completed_date || undefined,
            isCompleted: Boolean(m.is_completed),
            deliverables: Array.isArray(m.deliverables) ? m.deliverables : []
          }));

          // Calculate progress from milestones if available
          const completedMilestones = transformedMilestones.filter((m) => m.isCompleted).length;
          const totalMilestones = transformedMilestones.length;
          const calculatedProgress = totalMilestones > 0
            ? Math.round((completedMilestones / totalMilestones) * 100)
            : (apiProject.progress || 0);

          // Transform to ClientProject interface
          return {
            id: String(apiProject.id),
            projectName: apiProject.project_name || apiProject.name || 'Untitled Project',
            description: apiProject.description || '',
            clientId: String(apiProject.client_id || user.id),
            clientName: user.name || user.email || 'Client',
            status: (apiProject.status || 'pending') as ClientProjectStatus,
            priority: (apiProject.priority || 'medium') as ProjectPriority,
            progress: calculatedProgress,
            startDate: apiProject.start_date || apiProject.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            estimatedEndDate: apiProject.estimated_end_date || undefined,
            actualEndDate: apiProject.actual_end_date || undefined,
            updates: [], // Loaded on-demand when project is selected
            files: [],   // Loaded on-demand when project is selected
            messages: [], // Loaded on-demand when project is selected
            milestones: transformedMilestones
          } as ClientProject;
        })
      );

      // Show warning toast if any milestone fetches failed
      if (milestoneFetchFailures > 0) {
        showToast(
          'Some milestone data could not be loaded. Progress information may be incomplete.',
          'warning'
        );
      }

      // Set client name in header and page title
      const clientName = user.name || user.email || 'Client';
      loadNavigationModule().then((nav) => nav.setClientName(clientName));

      this.populateProjectsList(clientProjects);
      this.renderDashboardMilestones(clientProjects);
    } catch (error) {
      console.error('[ClientPortal] Failed to load projects:', error);
      // Show error state with client name
      const clientName = user.name || user.email || 'Client';
      loadNavigationModule().then((nav) => nav.setClientName(clientName));
      if (this.projectsList) {
        this.projectsList.innerHTML =
          '<div class="error-message"><p>Unable to load projects. Please try again later.</p></div>';
      }
      this.renderDashboardMilestones([], 'Unable to load milestones right now.');
    }
  }

  /**
   * Load dashboard stats and recent activity from API
   */
  private async loadDashboardStats(): Promise<void> {
    try {
      const response = await fetch('/api/clients/me/dashboard', {
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[ClientPortal] Failed to load dashboard stats:', response.status);
        // Clear "Loading..." state on API error
        const activityList = document.querySelector('.activity-list');
        if (activityList) {
          activityList.innerHTML = '<li class="activity-item empty">Unable to load activity</li>';
        }
        return;
      }

      const response_data = await response.json();
      const stats = response_data.data?.stats;
      const recentActivity = response_data.data?.recentActivity;

      // Defensive check - if stats is missing, log and return
      if (!stats) {
        console.warn('[ClientPortal] Dashboard response missing stats:', response_data);
        return;
      }

      // Update stat cards
      const statCards = document.querySelectorAll('.stat-card');
      statCards.forEach((card) => {
        const tabAttr = card.getAttribute('data-tab');
        const numberEl = card.querySelector('.stat-number');
        if (!numberEl) return;

        if (tabAttr === 'dashboard') {
          numberEl.textContent = String(stats.activeProjects || 0);
        } else if (tabAttr === 'invoices') {
          numberEl.textContent = String(stats.pendingInvoices || 0);
        } else if (tabAttr === 'messages') {
          numberEl.textContent = String(stats.unreadMessages || 0);
        }
      });

      // Update recent activity
      const activityList = document.querySelector('.activity-list');
      if (activityList) {
        if (!recentActivity || recentActivity.length === 0) {
          activityList.innerHTML = '<li class="activity-item empty">No recent activity</li>';
        } else {
          activityList.innerHTML = recentActivity.map((item: {
            type: string;
            title: string;
            context: string;
            date: string;
            entityId?: number;
          }) => {
            const date = new Date(item.date);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            const formattedDate = `${month}/${day}/${year}`;
            const icon = this.getActivityIcon(item.type);
            const safeTitle = this.escapeHtml(item.title);
            const safeContext = item.context ? this.escapeHtml(item.context) : '';
            return `
              <li class="activity-item">
                <div class="activity-icon">${icon}</div>
                <div class="activity-content">
                  <span class="activity-title">${safeTitle}</span>
                  ${safeContext ? `<span class="activity-client">${safeContext}</span>` : ''}
                </div>
                <span class="activity-time">${formattedDate}</span>
              </li>
            `;
          }).join('');
        }
      }

      // Update sidebar badges
      this.updateSidebarBadges(
        stats.unreadMessages || 0,
        stats.pendingInvoices || 0,
        stats.pendingDocRequests || 0,
        stats.pendingContracts || 0
      );

      // Load pending approvals for dashboard
      try {
        const approvalsModule = await loadApprovalsModule();
        await approvalsModule.initClientApprovals();
      } catch (approvalError) {
        console.warn('[ClientPortal] Error loading approvals:', approvalError);
      }

      this.log('[ClientPortal] Dashboard stats loaded');
    } catch (error) {
      console.error('[ClientPortal] Error loading dashboard stats:', error);
      // Clear "Loading..." state on error
      const activityList = document.querySelector('.activity-list');
      if (activityList) {
        activityList.innerHTML = '<li class="activity-item empty">Unable to load activity</li>';
      }
    }
  }

  private renderDashboardMilestones(
    projects: ClientProject[],
    errorMessage?: string
  ): void {
    const list = document.getElementById('milestones-list');
    const empty = document.getElementById('milestones-empty');
    const summary = document.getElementById('milestones-summary');
    if (!list) return;

    if (errorMessage) {
      list.innerHTML = '';
      if (summary) summary.textContent = '';
      if (empty) {
        empty.textContent = errorMessage;
        empty.style.display = 'block';
      }
      return;
    }

    const milestones = projects.flatMap((project) =>
      (project.milestones || []).map((milestone) => ({
        ...milestone,
        projectName: project.projectName
      }))
    );

    const total = milestones.length;
    const completed = milestones.filter((milestone) => milestone.isCompleted).length;

    if (summary) {
      summary.textContent = total > 0 ? `${completed}/${total} complete` : '';
    }

    if (total === 0) {
      list.innerHTML = '';
      if (empty) {
        empty.textContent = 'No milestones yet.';
        empty.style.display = 'block';
      }
      return;
    }

    if (empty) {
      empty.style.display = 'none';
    }

    const getSortTime = (date?: string): number => {
      if (!date) return Number.POSITIVE_INFINITY;
      const time = Date.parse(date);
      return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
    };

    milestones.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return getSortTime(a.dueDate) - getSortTime(b.dueDate);
    });

    list.innerHTML = '';

    // Track if we've found the first non-completed milestone (it should be "In Progress")
    let foundFirstActive = false;

    milestones.forEach((milestone) => {
      const item = document.createElement('div');
      const safeTitle = this.escapeHtml(milestone.title || 'Milestone');
      const safeDescription = this.escapeHtml(milestone.description || '');

      // Determine status: Completed, In Progress (first non-completed), or Upcoming (rest)
      let statusLabel: string;
      let statusClass: string;
      if (milestone.isCompleted) {
        statusLabel = 'Completed';
        statusClass = 'completed';
      } else if (!foundFirstActive) {
        // First non-completed milestone is always "In Progress"
        statusLabel = 'In Progress';
        statusClass = 'in-progress';
        foundFirstActive = true;
      } else {
        // All other non-completed milestones are "Upcoming"
        statusLabel = 'Upcoming';
        statusClass = 'upcoming';
      }

      const dueLabel = milestone.isCompleted
        ? `Completed ${milestone.completedDate ? formatDate(milestone.completedDate) : 'Date TBD'}`
        : milestone.dueDate
          ? `Due ${formatDate(milestone.dueDate)}`
          : 'Due date TBD';

      const deliverables = Array.isArray(milestone.deliverables)
        ? milestone.deliverables
        : [];
      const deliverablesMarkup = deliverables.length > 0
        ? `<ul class="milestone-deliverables">${deliverables
          .map((deliverableItem) => `<li>${this.escapeHtml(String(deliverableItem))}</li>`)
          .join('')}</ul>`
        : '';

      item.className = `milestone-item${milestone.isCompleted ? ' completed' : ''}`;
      item.innerHTML = `
        <label class="milestone-checkbox" aria-label="${statusLabel}">
          <input type="checkbox" ${milestone.isCompleted ? 'checked' : ''} disabled />
        </label>
        <div class="milestone-content">
          <div class="milestone-header">
            <h4 class="milestone-title">${safeTitle}</h4>
            <span class="milestone-status status-badge status-${statusClass}">${statusLabel}</span>
          </div>
          ${safeDescription ? `<p class="milestone-description">${safeDescription}</p>` : ''}
          ${deliverablesMarkup}
          <div class="milestone-footer">
            <span class="milestone-due-date">${dueLabel}</span>
          </div>
        </div>
      `;

      list.appendChild(item);
    });
  }

  /**
   * Get icon for activity type
   */
  private getActivityIcon(type: string): string {
    switch (type) {
    case 'project_update':
      return getAccessibleIcon('CLIPBOARD', 'Project update', { width: 16, height: 16 });
    case 'message':
      return getAccessibleIcon('MAIL', 'Message', { width: 16, height: 16 });
    case 'invoice':
      return getAccessibleIcon('FILE_TEXT', 'Invoice', { width: 16, height: 16 });
    case 'file':
      return getAccessibleIcon('FILE', 'File', { width: 16, height: 16 });
    case 'document_request':
      return getAccessibleIcon('DOCUMENT', 'Document request', { width: 16, height: 16 });
    case 'contract':
      return getAccessibleIcon('PENCIL', 'Contract', { width: 16, height: 16 });
    default:
      return getAccessibleIcon('CHECK', 'Activity', { width: 16, height: 16 });
    }
  }

  /**
   * Update sidebar notification badges
   */
  private updateSidebarBadges(
    unreadMessages: number,
    pendingInvoices: number,
    pendingDocRequests: number = 0,
    pendingContracts: number = 0
  ): void {
    const supportBadge = document.getElementById('badge-support');
    if (supportBadge) {
      if (unreadMessages > 0) {
        supportBadge.textContent = unreadMessages > 99 ? '99+' : String(unreadMessages);
        supportBadge.classList.add('has-count');
        supportBadge.setAttribute('aria-label', `${unreadMessages} unread messages`);
      } else {
        supportBadge.textContent = '';
        supportBadge.classList.remove('has-count');
        supportBadge.setAttribute('aria-label', 'unread messages');
      }
    }

    // Combine invoices and document requests for documents badge
    const totalDocumentItems = pendingInvoices + pendingDocRequests + pendingContracts;
    const documentsBadge = document.getElementById('badge-documents');
    if (documentsBadge) {
      if (totalDocumentItems > 0) {
        documentsBadge.textContent = totalDocumentItems > 99 ? '99+' : String(totalDocumentItems);
        documentsBadge.classList.add('has-count');
        documentsBadge.setAttribute('aria-label', `${totalDocumentItems} pending items`);
      } else {
        documentsBadge.textContent = '';
        documentsBadge.classList.remove('has-count');
        documentsBadge.setAttribute('aria-label', 'pending items');
      }
    }
  }

  private populateProjectsList(projects: ClientProject[]): void {
    if (!this.projectsList) return;

    if (projects.length === 0) {
      this.projectsList.innerHTML = '<div class="no-projects"><p>No projects yet. Submit a project request to get started!</p></div>';
      return;
    }

    this.projectsList.innerHTML = '';

    projects.forEach((project) => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      projectItem.dataset.projectId = project.id;

      projectItem.innerHTML = `
        <span class="project-icon">📄</span>
        <span class="project-name">${project.projectName}</span>
      `;

      projectItem.addEventListener('click', () => {
        this.selectProject(project);
        document
          .querySelectorAll('.project-item')
          .forEach((item) => item.classList.remove('active'));
        projectItem.classList.add('active');
      });

      this.projectsList?.appendChild(projectItem);
    });
  }

  private async selectProject(project: ClientProject): Promise<void> {
    this.currentProject = project;

    // Hide other views first
    const welcomeView = this.domCache.get('welcomeView');
    const projectDetailView = this.domCache.get('projectDetailView');
    const settingsView = this.domCache.get('settingsView');
    const billingView = this.domCache.get('billingView');

    if (welcomeView) welcomeView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'block';

    // Clear active state from navigation items
    document.querySelectorAll('.account-item').forEach((item) => item.classList.remove('active'));

    // For authenticated users, fetch full project details (updates, messages)
    const authMode = sessionStorage.getItem('client_auth_mode');
    if (authMode === 'authenticated') {
      await this.fetchProjectDetails(project.id);
    }

    this.populateProjectDetails();
  }

  /**
   * Fetch full project details including updates and messages from API
   */
  private async fetchProjectDetails(projectId: string): Promise<void> {
    if (!this.currentProject) return;

    try {
      // Fetch project details from API
      const response = await fetch(`/api/projects/${projectId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[ClientPortal] Failed to fetch project details:', response.status);
        return;
      }

      const data = await response.json() as ProjectDetailResponse;

      // Transform and update updates
      if (data.updates && Array.isArray(data.updates)) {
        this.currentProject.updates = data.updates.map((u: ProjectUpdateResponse) => ({
          id: String(u.id),
          date: u.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          title: u.title || 'Update',
          description: u.description || '',
          author: (u as { author?: string }).author || 'System',
          type: (u.update_type || 'general') as 'progress' | 'milestone' | 'issue' | 'resolution' | 'general'
        }));
      }

      // Transform and update messages
      if (data.messages && Array.isArray(data.messages)) {
        this.currentProject.messages = data.messages.map((m: MessageResponse) => ({
          id: String(m.id),
          sender: m.sender_name || 'Unknown',
          senderRole: (m.sender_role === 'admin' ? 'developer' : (m.sender_role || 'system')) as 'client' | 'developer' | 'system',
          message: m.message || '',
          timestamp: m.created_at || new Date().toISOString(),
          isRead: m.read_at !== null
        }));
      }

    } catch (error) {
      console.warn('[ClientPortal] Error fetching project details:', error);
    }
  }

  private populateProjectDetails(): void {
    if (!this.currentProject) return;

    // Populate project title
    const titleElement = this.domCache.get('projectTitle');
    if (titleElement) {
      titleElement.textContent = this.currentProject.projectName;
    }

    // Populate status
    const statusElement = this.domCache.get('projectStatus');
    if (statusElement) {
      statusElement.textContent = this.currentProject.status.replace('-', ' ');
      statusElement.className = `status-badge status-${this.currentProject.status}`;
    }

    // Populate project description (use innerHTML with sanitized line breaks)
    const descriptionElement = this.domCache.get('projectDescriptionEl');
    if (descriptionElement) {
      descriptionElement.innerHTML = formatTextWithLineBreaks(
        this.currentProject.description || 'Project details will be updated soon.'
      );
    }

    // Populate current phase
    const currentPhaseElement = this.domCache.get('currentPhase');
    if (currentPhaseElement) {
      const phase =
        this.currentProject.status === 'pending'
          ? 'Initial Review'
          : this.currentProject.status === 'in-progress'
            ? 'Development'
            : this.currentProject.status === 'in-review'
              ? 'Review'
              : 'Completed';
      currentPhaseElement.textContent = phase;
    }

    // Populate next milestone
    const nextMilestoneElement = this.domCache.get('nextMilestone');
    if (
      nextMilestoneElement &&
      this.currentProject.milestones &&
      this.currentProject.milestones.length > 0
    ) {
      const nextMilestone = this.currentProject.milestones.find((m) => !m.isCompleted);
      nextMilestoneElement.textContent = nextMilestone
        ? nextMilestone.title
        : 'No upcoming milestones';
    }

    // Populate progress
    const progressFill = this.domCache.get('progressFill');
    const progressText = this.domCache.get('progressText');
    if (progressFill && progressText) {
      progressFill.style.width = `${this.currentProject.progress}%`;
      progressText.textContent = `${this.currentProject.progress}% Complete`;
    }

    // Populate dates
    const startDateElement = this.domCache.get('startDate');
    if (startDateElement) {
      startDateElement.textContent = formatDate(this.currentProject.startDate);
    }

    const lastUpdateElement = this.domCache.get('lastUpdate');
    if (lastUpdateElement) {
      const lastUpdate =
        this.currentProject.updates && this.currentProject.updates.length > 0
          ? this.currentProject.updates[0].date
          : this.currentProject.startDate;
      lastUpdateElement.textContent = formatDate(lastUpdate);
    }

    // Load sections
    this.loadUpdates();
    this.loadFiles();
    this.loadMessages();
  }

  private loadUpdates(): void {
    if (!this.currentProject) return;

    const timelineContainer = this.domCache.get('updatesTimeline');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = '';

    this.currentProject.updates.forEach((update) => {
      const updateElement = document.createElement('div');
      updateElement.className = 'timeline-item';
      // Sanitize user data to prevent XSS
      const safeTitle = this.escapeHtml(update.title || '');
      const safeDescription = this.escapeHtml(update.description || '');
      const safeAuthor = this.escapeHtml(update.author || '');
      updateElement.innerHTML = `
        <div class="timeline-marker ${update.type}"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <h4>${safeTitle}</h4>
            <span class="timeline-date">${formatDate(update.date)}</span>
          </div>
          <p>${safeDescription}</p>
          <div class="timeline-author">by ${safeAuthor}</div>
        </div>
      `;
      timelineContainer.appendChild(updateElement);
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
   * Load files from API and render the list (delegates to module)
   */
  private async loadFiles(): Promise<void> {
    const filesModule = await loadFilesModule();
    await filesModule.loadFiles(this.moduleContext);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // =====================================================
  // INVOICE MANAGEMENT
  // =====================================================

  /**
   * Load invoices - delegates to invoices module
   */
  private async loadInvoices(): Promise<void> {
    const invoicesModule = await loadInvoicesModule();
    await invoicesModule.loadInvoices(this.moduleContext);
  }

  // NOTE: Invoice rendering methods moved to portal-invoices module

  private loadMessages(): void {
    if (!this.currentProject) return;

    const messagesContainer = this.domCache.get('messagesList');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    this.currentProject.messages.forEach((message) => {
      const messageElement = document.createElement('div');
      messageElement.className = `message message-${message.senderRole}`;
      // Sanitize user data to prevent XSS
      const safeSender = this.escapeHtml(message.sender || '');
      const safeMessage = this.escapeHtml(message.message || '');
      messageElement.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${safeSender}</span>
          <span class="message-time">${formatDate(message.timestamp)}</span>
        </div>
        <div class="message-content">${safeMessage}</div>
      `;
      messagesContainer.appendChild(messageElement);
    });
  }

  private showDashboard(): void {
    if (!this.loginSection || !this.dashboardSection) return;

    // Hide auth gate (login form) and header/footer
    // Note: We don't clear the form here - browsers need to see the credentials to offer to save them
    if (this.loginSection) {
      this.loginSection.classList.add('hidden');
      this.loginSection.style.display = 'none';
    }

    // Hide login page header, nav overlay, and footer
    const portalHeader = document.querySelector('.portal-header');
    const portalNav = document.querySelector('.portal-nav');
    const portalFooter = document.querySelector('.portal-footer');
    if (portalHeader) (portalHeader as HTMLElement).style.display = 'none';
    if (portalNav) (portalNav as HTMLElement).style.display = 'none';
    if (portalFooter) (portalFooter as HTMLElement).style.display = 'none';

    // Check if this is first login - show onboarding wizard
    const { isFirstLogin } = authStore.getState();
    if (isFirstLogin) {
      this.showOnboardingWizard();
      return;
    }

    // Show normal dashboard
    this.showDashboardContent();
  }

  /**
   * Show the onboarding wizard for first-time login
   */
  private async showOnboardingWizard(): Promise<void> {
    // Create wizard container overlay
    const wizardOverlay = document.createElement('div');
    wizardOverlay.id = 'onboarding-wizard-overlay';
    wizardOverlay.className = 'onboarding-wizard-overlay';

    const wizardContainer = document.createElement('div');
    wizardContainer.id = 'onboarding-wizard-container';
    wizardContainer.className = 'onboarding-wizard-container';

    wizardOverlay.appendChild(wizardContainer);
    document.body.appendChild(wizardOverlay);

    // Load and initialize the wizard
    const { OnboardingWizardModule } = await loadOnboardingWizardModule();

    const wizard = new OnboardingWizardModule(wizardContainer, this.moduleContext, {
      onComplete: () => {
        this.clearFirstLoginFlag();
        wizardOverlay.remove();
        this.showDashboardContent();
        showToast('Welcome! Your profile is set up.', 'success');
      },
      onCancel: () => {
        this.clearFirstLoginFlag();
        wizardOverlay.remove();
        this.showDashboardContent();
      }
    });

    await wizard.init();
  }

  /**
   * Clear the first login flag after onboarding is complete
   */
  private clearFirstLoginFlag(): void {
    sessionStorage.removeItem('nbw_auth_is_first_login');
    // Note: The authStore state will be updated on next page load
    // For this session, we just ensure the wizard doesn't show again
  }

  /**
   * Show the main dashboard content
   */
  private showDashboardContent(): void {
    if (!this.dashboardSection) return;

    this.dashboardSection.classList.remove('hidden');
    this.dashboardSection.style.display = 'flex';

    // Set initial breadcrumb at top of page (Dashboard when on main dashboard tab)
    loadNavigationModule().then((navModule) => {
      navModule.updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
    });

    // Load dashboard stats from API
    this.loadDashboardStats();

    // Setup dashboard event listeners if not already done, then initialize hash router
    if (!this.dashboardListenersSetup) {
      setTimeout(() => {
        this.setupDashboardEventListeners();
        // Initialize hash-based routing after listeners are ready
        this.initializeHashRouter();
      }, 100);
    } else {
      // Listeners already set up, just ensure hash router is initialized
      this.initializeHashRouter();
    }

    // Show admin features if user is admin
    this.setupAdminFeatures();

    // Initialize notification bell
    this.initNotificationBell();
  }

  /** Reference to notification bell instance */
  private notificationBellInstance: unknown = null;

  /**
   * Initialize the notification bell component
   */
  private async initNotificationBell(): Promise<void> {
    const container = document.getElementById('notification-bell-container');
    if (!container || this.notificationBellInstance) return;

    try {
      const { initNotificationBell } = await import('../../components/notification-bell');
      this.notificationBellInstance = await initNotificationBell(container);
    } catch (error) {
      console.warn('[ClientPortal] Failed to initialize notification bell:', error);
    }
  }

  /** Flag to track if hash router has been initialized */
  private hashRouterInitialized = false;

  /**
   * Initialize hash-based routing for browser navigation
   */
  private initializeHashRouter(): void {
    // Only initialize once
    if (this.hashRouterInitialized) return;
    this.hashRouterInitialized = true;

    loadNavigationModule().then((navModule) => {
      navModule.initHashRouter({
        loadFiles: () => this.loadFiles(),
        loadInvoices: () => this.loadInvoices(),
        loadProjectPreview: () => this.loadProjectPreview(),
        loadMessagesFromAPI: () => this.loadMessagesFromAPI(),
        loadHelp: () => this.loadHelp(),
        loadDocumentRequests: () => this.loadDocumentRequests(),
        loadAdHocRequests: () => this.loadAdHocRequests(),
        loadQuestionnaires: () => this.loadQuestionnaires(),
        loadSettings: () => this.loadUserSettings(),
        loadDashboard: () => this.loadDashboardStats()
      });
    });
  }

  /**
   * Check if user is admin and show admin-only UI elements
   */
  private setupAdminFeatures(): void {
    try {
      // Check sessionStorage for admin flag
      const authData = sessionStorage.getItem('clientAuth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.isAdmin) {
          // Show admin buttons
          const adminButtons = document.querySelectorAll('.btn-admin');
          adminButtons.forEach((btn) => btn.classList.remove('hidden'));
          this.log('[ClientPortal] Admin features enabled');
        }
      }

      // Also check JWT token for admin flag
      const token = sessionStorage.getItem('client_auth_token');
      if (token) {
        const payload = decodeJwtPayload(token);
        if (payload && isAdminPayload(payload)) {
          const adminButtons = document.querySelectorAll('.btn-admin');
          adminButtons.forEach((btn) => btn.classList.remove('hidden'));
          this.log('[ClientPortal] Admin features enabled (from token)');
        }
      }
    } catch (error) {
      console.error('[ClientPortal] Error checking admin status:', error);
    }
  }

  private animateDashboard(): void {
    gsap.fromTo(
      this.dashboardSection,
      {
        opacity: 0,
        y: 20
      },
      {
        opacity: 1,
        y: 0,
        duration: APP_CONSTANTS.TIMERS.PAGE_TRANSITION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      }
    );
  }

  private async logout(): Promise<void> {
    // Clear authentication data using auth module
    const authModule = await loadAuthModule();
    authModule.clearAuthData();

    this.isLoggedIn = false;
    this.currentProject = null;
    this.currentUser = null;
    this.currentUserData = null;
    this.dashboardListenersSetup = false; // Reset listeners flag

    // Clear form data
    if (this.loginForm) {
      this.loginForm.reset();
    }
    authModule.clearErrors();

    // Simple transition without animations
    if (this.dashboardSection) this.dashboardSection.style.display = 'none';
    if (this.loginSection) this.loginSection.style.display = 'block';
  }

  // =====================================================
  // MESSAGING - Delegates to portal-messages module
  // =====================================================

  /**
   * Load messages from API - delegates to messages module
   */
  private async loadMessagesFromAPI(): Promise<void> {
    const messagesModule = await loadMessagesModule();
    await messagesModule.loadMessagesFromAPI(this.moduleContext);
  }

  /**
   * Send a message - delegates to messages module
   */
  private async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const messagesModule = await loadMessagesModule();
    await messagesModule.sendMessage(this.moduleContext);
  }

  // NOTE: Message rendering methods moved to portal-messages module

  private handleTabClick(event: Event): void {
    event.preventDefault();
    const tab = (event.target as HTMLElement).closest('button');
    if (!tab) return;
    const tabName = tab.dataset.tab;
    if (!tabName) return;

    // Update tab active states
    document.querySelectorAll('.project-tab, .portal-tabs button').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-pane, .portal-tab-panel').forEach((pane) => pane.classList.remove('active'));
    const targetPane = document.getElementById(`${tabName}-content`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }

  // =====================================================
  // NAVIGATION - Delegates to portal-navigation module
  // =====================================================

  private async showSettings(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showSettings(() => this.loadUserSettings());
  }

  private async showBillingView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showBillingView(() => this.loadBillingSettings());
  }

  private async showContactView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showContactView(() => this.loadContactSettings());
  }

  private async showNotificationsView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showNotificationsView(() => this.loadNotificationSettings());
  }

  private async showUpdatesView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showUpdatesView();
  }

  private async showFilesView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showFilesView();
  }

  private async showMessagesView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showMessagesView();
  }

  private async showContentView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showContentView();
  }

  private async showProjectDetailView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showProjectDetailView(() => this.showWelcomeView());
  }

  private async showWelcomeView(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.showWelcomeView();
  }

  private async hideAllViews(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.hideAllViews();
  }

  private async toggleSidebar(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.toggleSidebar();
  }

  /**
   * Handle user logout - delegates to auth module
   */
  private async handleLogout(): Promise<void> {
    const authModule = await loadAuthModule();
    authModule.handleLogout();
  }

  /**
   * Switch to a specific tab in the dashboard - delegates to navigation module
   * Uses navigateTo to update URL hash for browser back/forward support
   */
  private async switchTab(tabName: string): Promise<void> {
    const navModule = await loadNavigationModule();
    // Use navigateTo to update URL hash and switch tab
    navModule.navigateTo(tabName, {
      loadFiles: () => this.loadFiles(),
      loadInvoices: () => this.loadInvoices(),
      loadProjectPreview: () => this.loadProjectPreview(),
      loadMessagesFromAPI: () => this.loadMessagesFromAPI(),
      loadHelp: () => this.loadHelp(),
      loadDocumentRequests: () => this.loadDocumentRequests(),
      loadAdHocRequests: () => this.loadAdHocRequests(),
      loadQuestionnaires: () => this.loadQuestionnaires(),
      loadSettings: () => this.loadUserSettings(),
      loadDashboard: () => this.loadDashboardStats()
    });
  }

  /**
   * Initialize password form event handlers when settings tab is opened
   * Form HTML is now rendered as part of the settings view template
   */
  private setupPasswordForm(): void {
    this.initializePasswordForm();
  }

  /**
   * Load project preview into iframe - delegates to projects module
   */
  private async loadProjectPreview(): Promise<void> {
    const projectsModule = await loadProjectsModule();
    await projectsModule.loadProjectPreview(this.moduleContext);
  }

  /**
   * Load Help tab (knowledge base) - delegates to help module
   */
  private async loadHelp(): Promise<void> {
    const helpModule = await loadHelpModule();
    await helpModule.loadHelp(this.moduleContext);
  }

  /**
   * Load Document requests tab - delegates to document-requests module
   */
  private async loadDocumentRequests(): Promise<void> {
    const docModule = await loadDocumentRequestsModule();
    await docModule.loadDocumentRequests(this.moduleContext);
  }

  /**
   * Load Ad Hoc requests tab - delegates to ad hoc requests module
   */
  private async loadAdHocRequests(): Promise<void> {
    const requestsModule = await loadAdHocRequestsModule();
    await requestsModule.loadAdHocRequests(this.moduleContext);
  }

  /**
   * Load Questionnaires tab - delegates to questionnaires module
   */
  private async loadQuestionnaires(): Promise<void> {
    const qModule = await loadQuestionnairesModule();
    await qModule.loadQuestionnaires(this.moduleContext);
  }

  private async toggleAccountFolder(): Promise<void> {
    const navModule = await loadNavigationModule();
    navModule.toggleAccountFolder();
  }

  /**
   * Setup settings forms - delegates to settings module
   */
  private async setupSettingsForms(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.setupSettingsForms(this.moduleContext);
  }

  // =====================================================
  // SETTINGS - Delegates to portal-settings module
  // =====================================================

  /**
   * Load user settings - delegates to settings module
   * Also initializes form handlers after view is available
   */
  private async loadUserSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    await settingsModule.loadUserSettings(this.currentUser);
    // Setup form event handlers after settings view is rendered
    settingsModule.setupSettingsForms(this.moduleContext);
    // Initialize password form event handlers after settings view is loaded
    this.setupPasswordForm();
  }

  /**
   * Load billing settings - delegates to settings module
   */
  private async loadBillingSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadBillingSettings();
  }

  /**
   * Load contact settings - delegates to settings module
   */
  private async loadContactSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadContactSettings(this.currentUser);
  }

  /**
   * Load notification settings - delegates to settings module
   */
  private async loadNotificationSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadNotificationSettings();
  }

  // NOTE: Settings save methods moved to portal-settings module
  // The setupViewFormHandlers method now delegates to the module

  private showSuccessMessage(message: string): void {
    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-primary);
      color: var(--color-dark);
      padding: 1rem 2rem;
      border: 2px solid var(--color-dark);
      z-index: 9999;
      font-weight: 600;
    `;

    document.body.appendChild(successDiv);

    // Remove after 3 seconds
    setTimeout(() => {
      successDiv.remove();
    }, 3000);
  }
}
