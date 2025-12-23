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
import type { ClientProject, ClientProjectStatus } from '../../types/client';
import { gsap } from 'gsap';
import { APP_CONSTANTS } from '../../config/constants';
import 'emoji-picker-element';
import type { ClientPortalContext, PortalFile, PortalProject } from './portal-types';
import {
  loadFilesModule,
  loadInvoicesModule,
  loadMessagesModule,
  loadSettingsModule
} from './modules';

export class ClientPortalModule extends BaseModule {
  private isLoggedIn = false;
  private currentProject: ClientProject | null = null;
  private currentUser: string | null = null;
  private dashboardListenersSetup = false;

  // Configuration
  private config = {
    loginSectionId: 'login-section',
    dashboardSectionId: 'dashboard-section',
    loginFormId: 'login-form',
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

  constructor() {
    super('client-portal');
    this.moduleContext = this.createModuleContext();
  }

  /** Create module context for passing to child modules */
  private createModuleContext(): ClientPortalContext {
    return {
      getAuthToken: () => sessionStorage.getItem('client_auth_mode'),
      isDemo: () => {
        const mode = sessionStorage.getItem('client_auth_mode');
        return mode === 'demo';
      },
      showNotification: (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'error') {
          console.error('[ClientPortal]', message);
          alert(message); // Show error prominently
        } else {
          this.showSuccessMessage(message);
        }
      },
      formatDate: (dateString: string) => this.formatDate(dateString),
      escapeHtml: (text: string) => this.escapeHtml(text)
    };
  }

  protected override async onInit(): Promise<void> {
    this.cacheElements();
    this.setupEventListeners();
    // Disable animations that might cause issues
    // this.setupAnimations();

    // Disable auth check to prevent redirects
    // await this.checkExistingAuth();
  }

  protected override async onDestroy(): Promise<void> {
    // Cleanup event listeners and animations
    if (this.loginForm) {
      this.loginForm.removeEventListener('submit', this.handleLogin);
    }
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
      this.loginForm.addEventListener('submit', this.handleLogin.bind(this));
    }

    // Use setTimeout to ensure DOM elements are ready after dashboard is shown
    setTimeout(() => {
      this.setupDashboardEventListeners();
    }, 100);

    // Password toggle (login form)
    const passwordToggle = document.getElementById('password-toggle');
    const passwordInput = document.getElementById('client-password') as HTMLInputElement;
    if (passwordToggle && passwordInput) {
      passwordToggle.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        const eyeIcon =
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        const eyeOffIcon =
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        passwordToggle.innerHTML =
          type === 'password'
            ? `<span class="visually-hidden">Show password</span>${eyeIcon}`
            : `<span class="visually-hidden">Hide password</span>${eyeOffIcon}`;
      });
    }
  }

  private setupDashboardEventListeners(): void {
    if (this.dashboardListenersSetup) {
      console.log('Dashboard event listeners already set up, skipping...');
      return;
    }

    console.log('Setting up dashboard event listeners...');

    // Sidebar toggle (desktop)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }

    // Header sidebar toggle buttons (arrows next to page titles)
    const headerSidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
    headerSidebarToggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    });

    // Mobile hamburger menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const sidebar = document.getElementById('sidebar');

    if (mobileMenuToggle && sidebar) {
      mobileMenuToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMobileMenu();
      });
    }

    // Close mobile menu when clicking overlay
    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    }

    // Close mobile menu when clicking sidebar close button
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    if (sidebarCloseBtn) {
      sidebarCloseBtn.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.handleLogout();
      });
    }

    // Sidebar buttons with data-tab attribute
    const sidebarButtons = document.querySelectorAll('.sidebar-buttons .btn[data-tab]');
    if (sidebarButtons.length > 0) {
      console.log(`Found ${sidebarButtons.length} sidebar buttons with data-tab`);
      sidebarButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const tabName = (btn as HTMLElement).dataset.tab;
          if (tabName) {
            this.switchTab(tabName);
            // Update active state on buttons
            sidebarButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            // Close mobile menu after selecting a tab
            this.closeMobileMenu();
          }
        });
      });
    }

    // Clickable stat cards
    const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
    if (statCards.length > 0) {
      console.log(`Found ${statCards.length} clickable stat cards`);
      statCards.forEach((card) => {
        card.addEventListener('click', (e) => {
          e.preventDefault();
          const tabName = (card as HTMLElement).dataset.tab;
          if (tabName) {
            this.switchTab(tabName);
            // Update active state on sidebar buttons
            sidebarButtons.forEach((b) => {
              b.classList.remove('active');
              if ((b as HTMLElement).dataset.tab === tabName) {
                b.classList.add('active');
              }
            });
          }
        });
      });
    }

    // Password toggle buttons
    const passwordToggles = document.querySelectorAll('.cp-password-toggle');
    const eyeIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const eyeOffIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    passwordToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = (toggle as HTMLElement).dataset.target;
        if (targetId) {
          const input = document.getElementById(targetId) as HTMLInputElement;
          if (input) {
            if (input.type === 'password') {
              input.type = 'text';
              toggle.innerHTML = eyeOffIcon;
            } else {
              input.type = 'password';
              toggle.innerHTML = eyeIcon;
            }
          }
        }
      });
    });

    // Emoji picker (using emoji-picker-element web component)
    const emojiToggle = document.getElementById('emoji-toggle');
    const emojiPickerWrapper = document.getElementById('emoji-picker-wrapper');
    const emojiPicker = document.getElementById('emoji-picker');
    const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
    const sendButton = document.getElementById('btn-send-message');

    if (emojiToggle && emojiPickerWrapper && emojiPicker) {
      // Toggle picker visibility
      emojiToggle.addEventListener('click', () => {
        emojiPickerWrapper.classList.toggle('hidden');
      });

      // Handle emoji selection from web component
      emojiPicker.addEventListener('emoji-click', (event: Event) => {
        const customEvent = event as CustomEvent;
        if (messageInput && customEvent.detail?.unicode) {
          const emoji = customEvent.detail.unicode;
          const start = messageInput.selectionStart;
          const end = messageInput.selectionEnd;
          const text = messageInput.value;
          messageInput.value = text.substring(0, start) + emoji + text.substring(end);
          messageInput.focus();
          messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
        }
      });

      // Close picker when clicking outside
      document.addEventListener('click', (e) => {
        if (
          !emojiPickerWrapper.contains(e.target as Node) &&
          e.target !== emojiToggle &&
          !emojiToggle.contains(e.target as Node)
        ) {
          emojiPickerWrapper.classList.add('hidden');
        }
      });
    }

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

    // Setup file upload handlers (drag & drop)
    this.setupFileUploadHandlers();

    // Setup settings form handlers
    this.setupSettingsFormHandlers();

    console.log('Dashboard event listeners setup complete');
    this.dashboardListenersSetup = true;
  }

  /**
   * Setup settings form handlers (profile, notifications, billing)
   */
  private setupSettingsFormHandlers(): void {
    // Profile form
    const profileForm = document.getElementById('profile-form') as HTMLFormElement;
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveProfileSettings();
      });
    }

    // Notifications form
    const notificationsForm = document.getElementById('notifications-form') as HTMLFormElement;
    if (notificationsForm) {
      notificationsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveNotificationSettings();
      });
    }

    // Billing form
    const billingForm = document.getElementById('billing-form') as HTMLFormElement;
    if (billingForm) {
      billingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveBillingSettings();
      });
    }

    // New project form
    const newProjectForm = document.getElementById('new-project-form') as HTMLFormElement;
    if (newProjectForm) {
      newProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitProjectRequest();
      });
    }
  }

  /**
   * Submit new project request
   */
  private async submitProjectRequest(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode || authMode === 'demo') {
      alert(
        'Project requests cannot be submitted in demo mode. Please log in with a real account.'
      );
      return;
    }

    const name = (document.getElementById('project-name') as HTMLInputElement)?.value;
    const projectType = (document.getElementById('project-type') as HTMLSelectElement)?.value;
    const budget = (document.getElementById('project-budget') as HTMLSelectElement)?.value;
    const timeline = (document.getElementById('project-timeline') as HTMLSelectElement)?.value;
    const description = (document.getElementById('project-description') as HTMLTextAreaElement)
      ?.value;

    if (!name || !projectType || !description) {
      alert('Please fill in all required fields');
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

      alert(data.message || 'Project request submitted successfully!');

      // Clear the form
      const form = document.getElementById('new-project-form') as HTMLFormElement;
      if (form) form.reset();

      // Switch to dashboard tab
      this.switchTab('dashboard');
    } catch (error) {
      console.error('Error submitting project request:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Failed to submit project request. Please try again.'
      );
    }
  }

  /**
   * Save profile settings
   */
  private async saveProfileSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode || authMode === 'demo') {
      alert('Settings cannot be saved in demo mode. Please log in with a real account.');
      return;
    }

    const contactName = (document.getElementById('settings-name') as HTMLInputElement)?.value;
    const companyName = (document.getElementById('settings-company') as HTMLInputElement)?.value;
    const phone = (document.getElementById('settings-phone') as HTMLInputElement)?.value;
    const currentPassword = (document.getElementById('current-password') as HTMLInputElement)
      ?.value;
    const newPassword = (document.getElementById('new-password') as HTMLInputElement)?.value;
    const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement)
      ?.value;

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
          alert('New passwords do not match');
          return;
        }

        if (newPassword.length < 8) {
          alert('Password must be at least 8 characters');
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

        // Clear password fields
        (document.getElementById('current-password') as HTMLInputElement).value = '';
        (document.getElementById('new-password') as HTMLInputElement).value = '';
        (document.getElementById('confirm-password') as HTMLInputElement).value = '';
      }

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to save profile. Please try again.');
    }
  }

  /**
   * Save notification settings
   */
  private async saveNotificationSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode || authMode === 'demo') {
      alert('Settings cannot be saved in demo mode. Please log in with a real account.');
      return;
    }

    const form = document.getElementById('notifications-form');
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

      alert('Notification preferences saved!');
    } catch (error) {
      console.error('Error saving notifications:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to save preferences. Please try again.'
      );
    }
  }

  /**
   * Save billing settings
   */
  private async saveBillingSettings(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode || authMode === 'demo') {
      alert('Settings cannot be saved in demo mode. Please log in with a real account.');
      return;
    }

    const billing = {
      company: (document.getElementById('billing-company') as HTMLInputElement)?.value,
      address: (document.getElementById('billing-address') as HTMLInputElement)?.value,
      address2: (document.getElementById('billing-address2') as HTMLInputElement)?.value,
      city: (document.getElementById('billing-city') as HTMLInputElement)?.value,
      state: (document.getElementById('billing-state') as HTMLInputElement)?.value,
      zip: (document.getElementById('billing-zip') as HTMLInputElement)?.value,
      country: (document.getElementById('billing-country') as HTMLInputElement)?.value
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

      alert('Billing information saved!');
    } catch (error) {
      console.error('Error saving billing:', error);
      alert(
        error instanceof Error ? error.message : 'Failed to save billing info. Please try again.'
      );
    }
  }

  private setupAnimations(): void {
    // Disable animations temporarily to prevent flashing
    // this.setupButtonAnimations();
  }

  private setupButtonAnimations(): void {
    const buttons = document.querySelectorAll('.client-buttons .btn');
    buttons.forEach((button) => {
      this.animateButton(button as HTMLElement);
    });
  }

  private animateButton(button: HTMLElement): void {
    // GSAP button animation logic here
    const buttonText = button.textContent?.trim() || '';
    button.innerHTML = `<span style="position: relative; z-index: 2;">${buttonText}</span>`;

    // Create fill element for hover effect
    const fillElement = document.createElement('div');
    fillElement.className = 'button-fill';
    fillElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 0%;
      height: 100%;
      background-color: #dc2626;
      z-index: 0;
      pointer-events: none;
      border-radius: inherit;
      transform-origin: left center;
    `;
    button.appendChild(fillElement);

    // Add hover animations
    button.addEventListener('mouseenter', (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const mouseX = e.clientX;
      const buttonCenter = rect.left + rect.width / 2;
      const enteredFromLeft = mouseX < buttonCenter;

      gsap.set(fillElement, {
        left: enteredFromLeft ? '0' : 'auto',
        right: enteredFromLeft ? 'auto' : '0',
        transformOrigin: enteredFromLeft ? 'left center' : 'right center'
      });

      gsap.to(fillElement, {
        width: '100%',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });

      gsap.to(button, {
        color: APP_CONSTANTS.THEME.DARK,
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    });

    button.addEventListener('mouseleave', (e: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const mouseX = e.clientX;
      const buttonCenter = rect.left + rect.width / 2;
      const exitingFromLeft = mouseX < buttonCenter;

      gsap.set(fillElement, {
        left: exitingFromLeft ? '0' : 'auto',
        right: exitingFromLeft ? 'auto' : '0',
        transformOrigin: exitingFromLeft ? 'left center' : 'right center'
      });

      gsap.to(fillElement, {
        width: '0%',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });

      gsap.to(button, {
        color: 'inherit',
        duration: APP_CONSTANTS.TIMERS.ANIMATION_DURATION / 1000,
        ease: APP_CONSTANTS.EASING.SMOOTH
      });
    });
  }

  /** API base URL for authentication */
  private static readonly API_BASE = '/api/auth';

  private async handleLogin(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.loginForm) return;

    const formData = new FormData(this.loginForm);
    const credentials = {
      email: formData.get('email') as string,
      password: formData.get('password') as string
    };

    // Clear previous errors
    this.clearErrors();
    document.getElementById('login-error')!.style.display = 'none';

    // Basic validation
    if (!credentials.email.trim()) {
      this.showFieldError('client-email', 'Email address is required');
      return;
    }

    if (!credentials.password.trim()) {
      this.showFieldError('client-password', 'Password is required');
      return;
    }

    this.setLoginLoading(true);

    try {
      // Try backend authentication first
      try {
        const response = await fetch(`${ClientPortalModule.API_BASE}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include HttpOnly cookies
          body: JSON.stringify(credentials)
        });

        if (response.ok) {
          const data = await response.json();

          // Store auth mode and user info (token is in HttpOnly cookie)
          sessionStorage.setItem('client_auth_mode', 'authenticated');
          sessionStorage.setItem('client_auth_user', JSON.stringify(data.user));

          this.isLoggedIn = true;
          this.currentUser = data.user.email;

          // Load user projects from backend or mock
          await this.loadMockUserProjects({
            id: data.user.id,
            email: data.user.email,
            name: data.user.contactName || data.user.companyName || data.user.email.split('@')[0]
          });

          // Redirect to client portal if not already there
          const isOnPortalPage = document.body.getAttribute('data-page') === 'client-portal';
          if (!isOnPortalPage) {
            window.location.href = '/client/portal';
            return;
          }

          // If already on portal page, try to show dashboard
          this.showDashboard();
          return;
        }

        // Handle specific error responses from backend
        const errorData = await response.json();
        if (errorData.code === 'INVALID_CREDENTIALS') {
          throw new Error('Invalid email or password');
        } else if (errorData.code === 'ACCOUNT_INACTIVE') {
          throw new Error('Your account is inactive. Please contact support.');
        } else {
          throw new Error(errorData.error || 'Login failed');
        }
      } catch (fetchError) {
        // If backend is unavailable, fall back to demo mode
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          console.warn('[ClientPortal] Backend unavailable, using demo mode');

          // Demo mode fallback - simulate successful login
          const mockUserData = {
            user: {
              id: 1,
              email: credentials.email,
              name: credentials.email
                .split('@')[0]
                .replace(/[^a-zA-Z]/g, ' ')
                .replace(/\b\w/g, (l) => l.toUpperCase())
            }
          };

          // Store demo mode flag (no real token needed - demo data only)
          sessionStorage.setItem('client_auth_mode', 'demo');
          sessionStorage.setItem('client_auth_user', JSON.stringify(mockUserData.user));
          this.isLoggedIn = true;
          this.currentUser = mockUserData.user.email;

          await this.loadMockUserProjects(mockUserData.user);

          // Redirect to client portal if not already there
          const isOnPortalPage = document.body.getAttribute('data-page') === 'client-portal';
          if (!isOnPortalPage) {
            window.location.href = '/client/portal';
            return;
          }

          // If already on portal page, try to show dashboard
          this.showDashboard();
          return;
        }

        // Re-throw authentication errors
        throw fetchError;
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      this.setLoginLoading(false);
    }
  }

  private async loadMockUserProjects(user: {
    id: number;
    email: string;
    name: string;
  }): Promise<void> {
    try {
      // Create sample project data based on user
      const sampleProject: ClientProject = {
        id: `project-${user.id}-001`,
        projectName: 'Your Website Project',
        description: 'Custom website development based on your intake form requirements.',
        clientId: user.email,
        clientName: user.name || 'Valued Client',
        status: 'pending' as ClientProjectStatus,
        priority: 'medium',
        progress: 25,
        startDate: new Date().toISOString().split('T')[0],
        estimatedEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        updates: [
          {
            id: 'update-001',
            date: new Date().toISOString().split('T')[0],
            title: 'Project Intake Received',
            description:
              'Your project details have been received and we\'re reviewing your requirements.',
            author: 'No Bhad Codes Team',
            type: 'general'
          },
          {
            id: 'update-002',
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            title: 'Account Activated',
            description:
              'Your client account has been activated and you now have access to this portal.',
            author: 'System',
            type: 'general'
          }
        ],
        files: [],
        messages: [
          {
            id: 'msg-001',
            sender: 'No Bhad Codes Team',
            senderRole: 'system',
            message: 'Welcome to your project portal! We\'ll keep you updated on progress here.',
            timestamp: new Date().toISOString(),
            isRead: false
          }
        ],
        milestones: [
          {
            id: 'milestone-001',
            title: 'Project Planning',
            description: 'Review requirements and create detailed project plan',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isCompleted: false,
            deliverables: ['Requirements analysis', 'Project timeline', 'Technical specification']
          },
          {
            id: 'milestone-002',
            title: 'Design Phase',
            description: 'Create mockups and design system',
            dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            isCompleted: false,
            deliverables: ['Wireframes', 'Visual designs', 'Style guide']
          }
        ]
      };

      // Set client name in header
      const clientNameElement = document.getElementById('client-name');
      if (clientNameElement) {
        clientNameElement.textContent = user.name || user.email || 'Client';
      }

      this.populateProjectsList([sampleProject]);
    } catch (error) {
      console.error('Failed to load projects:', error);
      // Show error message or fallback
      if (this.projectsList) {
        this.projectsList.innerHTML =
          '<div class="error-message"><p>Failed to load projects. Please try refreshing the page.</p></div>';
      }
    }
  }

  private populateProjectsList(projects: ClientProject[]): void {
    if (!this.projectsList) return;

    if (projects.length === 0) {
      this.projectsList.innerHTML = '<div class="no-projects"><p>No projects found.</p></div>';
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

  private selectProject(project: ClientProject): void {
    this.currentProject = project;
    this.populateProjectDetails();

    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const settingsView = document.getElementById('settings-view');
    const billingView = document.getElementById('billing-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'block';

    // Clear active state from navigation items
    document.querySelectorAll('.account-item').forEach((item) => item.classList.remove('active'));
  }

  private populateProjectDetails(): void {
    if (!this.currentProject) return;

    // Populate project title
    const titleElement = document.getElementById('project-title');
    if (titleElement) {
      titleElement.textContent = this.currentProject.projectName;
    }

    // Populate status
    const statusElement = document.getElementById('project-status');
    if (statusElement) {
      statusElement.textContent = this.currentProject.status.replace('-', ' ');
      statusElement.className = `status-badge status-${this.currentProject.status}`;
    }

    // Populate project description
    const descriptionElement = document.getElementById('project-description');
    if (descriptionElement) {
      descriptionElement.textContent =
        this.currentProject.description || 'Project details will be updated soon.';
    }

    // Populate current phase
    const currentPhaseElement = document.getElementById('current-phase');
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
    const nextMilestoneElement = document.getElementById('next-milestone');
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
    const progressFill = document.getElementById('progress-fill') as HTMLElement;
    const progressText = document.getElementById('progress-text');
    if (progressFill && progressText) {
      progressFill.style.width = `${this.currentProject.progress}%`;
      progressText.textContent = `${this.currentProject.progress}% Complete`;
    }

    // Populate dates
    const startDateElement = document.getElementById('start-date');
    if (startDateElement) {
      startDateElement.textContent = this.formatDate(this.currentProject.startDate);
    }

    const lastUpdateElement = document.getElementById('last-update');
    if (lastUpdateElement) {
      const lastUpdate =
        this.currentProject.updates && this.currentProject.updates.length > 0
          ? this.currentProject.updates[0].date
          : this.currentProject.startDate;
      lastUpdateElement.textContent = this.formatDate(lastUpdate);
    }

    // Load sections
    this.loadUpdates();
    this.loadFiles();
    this.loadMessages();
  }

  private loadUpdates(): void {
    if (!this.currentProject) return;

    const timelineContainer = document.getElementById('updates-timeline');
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
            <span class="timeline-date">${this.formatDate(update.date)}</span>
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
   * Render demo files for demo mode
   */
  private renderDemoFiles(container: HTMLElement): void {
    const demoFiles = [
      {
        id: 1,
        originalName: 'Project-Outline.pdf',
        mimetype: 'application/pdf',
        size: 245760,
        uploadedAt: new Date().toISOString(),
        projectName: 'Website Redesign',
        uploadedBy: 'admin' // Shared by Noelle - client cannot delete
      },
      {
        id: 2,
        originalName: 'My-Brand-Assets.zip',
        mimetype: 'application/zip',
        size: 5242880,
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        projectName: 'Website Redesign',
        uploadedBy: 'client' // Uploaded by client - can delete
      },
      {
        id: 3,
        originalName: 'Intake-Summary.pdf',
        mimetype: 'application/pdf',
        size: 128000,
        uploadedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        projectName: 'Website Redesign',
        uploadedBy: 'admin' // Shared by Noelle - client cannot delete
      }
    ];
    this.renderFilesList(container, demoFiles);
  }

  /**
   * Render the files list
   */
  private renderFilesList(container: HTMLElement, files: PortalFile[]): void {
    if (files.length === 0) {
      container.innerHTML =
        '<p class="no-files">No files uploaded yet. Drag and drop files above to upload.</p>';
      return;
    }

    // Get current client email to determine ownership
    const clientEmail = sessionStorage.getItem('clientEmail') || '';

    // Trash icon SVG
    const trashIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

    container.innerHTML = files
      .map((file) => {
        // Only show delete button if client uploaded the file (not shared by admin/Noelle)
        const canDelete = file.uploadedBy === clientEmail || file.uploadedBy === 'client';
        const deleteIcon = canDelete
          ? `<button class="file-delete-icon btn-delete" data-file-id="${file.id}" data-filename="${this.escapeHtml(file.originalName)}" aria-label="Delete file">
              ${trashIcon}
            </button>`
          : '';

        return `
      <div class="file-item" data-file-id="${file.id}">
        ${deleteIcon}
        <div class="file-icon">
          ${this.getFileIcon(file.mimetype)}
        </div>
        <div class="file-info">
          <span class="file-name">${this.escapeHtml(file.originalName)}</span>
          <span class="file-meta">
            ${file.projectName ? `${file.projectName} • ` : ''}
            ${this.formatDate(file.uploadedAt)} • ${this.formatFileSize(file.size)}
          </span>
        </div>
        <div class="file-actions">
          <button class="btn btn-sm btn-outline btn-preview" data-file-id="${file.id}" data-mimetype="${file.mimetype}">
            Preview
          </button>
          <button class="btn btn-sm btn-outline btn-download" data-file-id="${file.id}" data-filename="${this.escapeHtml(file.originalName)}">
            Download
          </button>
        </div>
      </div>
    `;
      })
      .join('');

    // Attach event listeners to buttons
    this.attachFileActionListeners(container);
  }

  /**
   * Get appropriate icon SVG for file type
   */
  private getFileIcon(mimetype: string): string {
    // Image icon
    const imageIcon =
      '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/><circle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/><polyline points=\'21 15 16 10 5 21\'/></svg>';
    // PDF icon
    const pdfIcon =
      '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\'/><polyline points=\'14 2 14 8 20 8\'/><line x1=\'16\' y1=\'13\' x2=\'8\' y2=\'13\'/><line x1=\'16\' y1=\'17\' x2=\'8\' y2=\'17\'/><polyline points=\'10 9 9 9 8 9\'/></svg>';
    // Default document icon
    const docIcon =
      '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\'/><polyline points=\'14 2 14 8 20 8\'/></svg>';

    if (mimetype.startsWith('image/')) {
      return imageIcon;
    }
    if (mimetype === 'application/pdf') {
      return pdfIcon;
    }
    return docIcon;
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
    return `${size} ${sizes[i]}`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Attach event listeners to file action buttons
   */
  private attachFileActionListeners(container: HTMLElement): void {
    // Preview buttons
    container.querySelectorAll('.btn-preview').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileId = (btn as HTMLElement).dataset.fileId;
        const mimetype = (btn as HTMLElement).dataset.mimetype;
        if (fileId) {
          this.previewFile(parseInt(fileId), mimetype || '');
        }
      });
    });

    // Download buttons
    container.querySelectorAll('.btn-download').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileId = (btn as HTMLElement).dataset.fileId;
        const filename = (btn as HTMLElement).dataset.filename;
        if (fileId) {
          this.downloadFile(parseInt(fileId), filename || 'download');
        }
      });
    });

    // Delete buttons
    container.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const fileId = (btn as HTMLElement).dataset.fileId;
        const filename = (btn as HTMLElement).dataset.filename;
        if (fileId) {
          this.deleteFile(parseInt(fileId), filename || 'file');
        }
      });
    });
  }

  /**
   * Preview a file - opens in modal or new tab
   */
  private previewFile(fileId: number, mimetype: string): void {
    const authMode = sessionStorage.getItem('client_auth_mode');

    // For demo mode, show a demo message
    if (!authMode || authMode === 'demo') {
      alert('Preview not available in demo mode. Please log in to preview files.');
      return;
    }

    // For images and PDFs, open in new tab
    if (mimetype.startsWith('image/') || mimetype === 'application/pdf') {
      const url = `${ClientPortalModule.FILES_API_BASE}/file/${fileId}`;
      window.open(url, '_blank');
    } else {
      // For other files, trigger download instead
      this.downloadFile(fileId, 'file');
    }
  }

  /**
   * Download a file
   */
  private downloadFile(fileId: number, filename: string): void {
    const authMode = sessionStorage.getItem('client_auth_mode');

    // For demo mode, show a demo message
    if (!authMode || authMode === 'demo') {
      alert('Download not available in demo mode. Please log in to download files.');
      return;
    }

    // Create a temporary link to trigger download
    const url = `${ClientPortalModule.FILES_API_BASE}/file/${fileId}?download=true`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Delete a file
   */
  private async deleteFile(fileId: number, filename: string): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    // For demo mode, show a demo message
    if (!authMode || authMode === 'demo') {
      alert('Delete not available in demo mode. Please log in to delete files.');
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${ClientPortalModule.FILES_API_BASE}/file/${fileId}`, {
        method: 'DELETE',
        credentials: 'include' // Include HttpOnly cookies
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete file');
      }

      // Remove the file item from the DOM
      const fileItem = document.querySelector(`.file-item[data-file-id="${fileId}"]`);
      if (fileItem) {
        fileItem.remove();
      }

      // Check if there are any files left
      const filesContainer = document.querySelector('.files-list-section .file-item');
      if (!filesContainer) {
        const container = document.querySelector('.files-list-section');
        if (container) {
          const noFilesMsg = container.querySelector('.no-files');
          if (!noFilesMsg) {
            const msgEl = document.createElement('p');
            msgEl.className = 'no-files';
            msgEl.textContent = 'No files uploaded yet. Drag and drop files above to upload.';
            container.appendChild(msgEl);
          }
        }
      }

      console.log(`File ${filename} deleted successfully`);
    } catch (error) {
      console.error('Error deleting file:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete file. Please try again.');
    }
  }

  /**
   * Setup file upload handlers (drag & drop + browse)
   */
  private setupFileUploadHandlers(): void {
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const browseBtn = document.getElementById('btn-browse-files');

    if (!dropzone) return;

    // Make dropzone keyboard accessible
    dropzone.setAttribute('tabindex', '0');
    dropzone.setAttribute('role', 'button');
    dropzone.setAttribute('aria-label', 'File upload dropzone - press Enter or Space to browse files, or drag and drop files here');

    // Browse button click
    if (browseBtn && fileInput) {
      browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });

      // File input change
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          this.uploadFiles(Array.from(fileInput.files));
          fileInput.value = ''; // Reset input
        }
      });
    }

    // Drag & drop handlers
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-active');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.uploadFiles(Array.from(files));
      }
    });

    // Keyboard support - Enter or Space triggers file browser
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput?.click();
      }
    });

    // Prevent default drag behavior on window
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  /**
   * Upload files to the server
   */
  private async uploadFiles(files: File[]): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');

    // Demo mode check
    if (!authMode || authMode === 'demo') {
      alert('File upload not available in demo mode. Please log in to upload files.');
      return;
    }

    // Check file count limit
    if (files.length > 5) {
      alert('Maximum 5 files allowed per upload.');
      return;
    }

    // Check file sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter((f) => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files exceed the 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
      return;
    }

    // Show upload progress
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <div class="upload-progress">
          <p>Uploading ${files.length} file(s)...</p>
          <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
        </div>
      `;
    }

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${ClientPortalModule.FILES_API_BASE}/multiple`, {
        method: 'POST',
        credentials: 'include', // Include HttpOnly cookies
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      const result = await response.json();

      // Reset dropzone
      this.resetDropzone();

      // Show success message
      this.showUploadSuccess(result.files?.length || files.length);

      // Reload files list
      await this.loadFiles();
    } catch (error) {
      console.error('Upload error:', error);
      this.resetDropzone();
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reset dropzone to initial state
   */
  private resetDropzone(): void {
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) {
      dropzone.innerHTML = `
        <div class="dropzone-content">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Drag and drop files here</p>
          <span class="dropzone-hint">or</span>
          <button type="button" class="btn btn-secondary" id="btn-browse-files">Browse Files</button>
        </div>
      `;
      // Re-attach browse button listener
      const browseBtn = document.getElementById('btn-browse-files');
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (browseBtn && fileInput) {
        browseBtn.addEventListener('click', (e) => {
          e.preventDefault();
          fileInput.click();
        });
      }
    }
  }

  /**
   * Show upload success message
   */
  private showUploadSuccess(count: number): void {
    const filesSection = document.getElementById('tab-files');
    if (filesSection) {
      const successMsg = document.createElement('div');
      successMsg.className = 'upload-success-message';
      successMsg.innerHTML = `<span>✓ ${count} file(s) uploaded successfully</span>`;
      filesSection.insertBefore(successMsg, filesSection.firstChild);

      // Remove after 3 seconds
      setTimeout(() => {
        successMsg.remove();
      }, 3000);
    }
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

    const messagesContainer = document.getElementById('messages-list');
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
          <span class="message-time">${this.formatDate(message.timestamp)}</span>
        </div>
        <div class="message-content">${safeMessage}</div>
      `;
      messagesContainer.appendChild(messageElement);
    });
  }

  private showDashboard(): void {
    if (!this.loginSection || !this.dashboardSection) return;

    // Simplified transition without GSAP to prevent flashing
    if (this.loginSection) this.loginSection.style.display = 'none';
    if (this.dashboardSection) {
      this.dashboardSection.style.display = 'block';

      // Setup dashboard event listeners if not already done
      if (!this.dashboardListenersSetup) {
        setTimeout(() => {
          this.setupDashboardEventListeners();
        }, 100);
      }

      // Show admin features if user is admin
      this.setupAdminFeatures();
    }
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
          console.log('[ClientPortal] Admin features enabled');
        }
      }

      // Also check JWT token for admin flag
      const token = sessionStorage.getItem('client_auth_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.isAdmin || payload.type === 'admin') {
            const adminButtons = document.querySelectorAll('.btn-admin');
            adminButtons.forEach((btn) => btn.classList.remove('hidden'));
            console.log('[ClientPortal] Admin features enabled (from token)');
          }
        } catch {
          // Invalid token format, ignore
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

  private logout(): void {
    // Clear authentication data
    sessionStorage.removeItem('client_auth_mode');
    sessionStorage.removeItem('client_auth_user');

    this.isLoggedIn = false;
    this.currentProject = null;
    this.currentUser = null;
    this.dashboardListenersSetup = false; // Reset listeners flag

    // Clear form data
    if (this.loginForm) {
      this.loginForm.reset();
    }
    this.clearErrors();

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
    const tab = event.target as HTMLElement;
    const tabName = tab.dataset.tab;
    if (!tabName) return;

    // Update tab active states
    document.querySelectorAll('.project-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
    const targetPane = document.getElementById(`${tabName}-content`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  }

  private showFieldError(fieldId: string, message: string): void {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(`${fieldId.replace('client-', '')}-error`);

    if (field) field.classList.add('error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  private showLoginError(message: string): void {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  private setLoginLoading(loading: boolean): void {
    const submitBtn = document.getElementById('login-btn') as HTMLButtonElement;
    const loader = document.querySelector('.btn-loader') as HTMLElement;

    if (submitBtn) {
      submitBtn.disabled = loading;
      if (loading) {
        submitBtn.classList.add('loading');
      } else {
        submitBtn.classList.remove('loading');
      }
    }

    if (loader) {
      loader.style.display = loading ? 'block' : 'none';
    }
  }

  private async checkExistingAuth(): Promise<void> {
    const authMode = sessionStorage.getItem('client_auth_mode');
    if (!authMode) return;

    // Skip auth check for demo mode
    if (authMode === 'demo') {
      console.log('[ClientPortal] Demo mode detected, skipping auth check');
      return;
    }

    try {
      const response = await fetch(`${ClientPortalModule.API_BASE}/profile`, {
        credentials: 'include' // Include HttpOnly cookies
      });

      if (response.ok) {
        const data = await response.json();
        this.isLoggedIn = true;
        this.currentUser = data.user.email;
        await this.loadMockUserProjects({
          id: data.user.id,
          email: data.user.email,
          name: data.user.contactName || data.user.companyName || data.user.email.split('@')[0]
        });
        this.showDashboard();
      } else {
        // Auth is invalid, clear it
        sessionStorage.removeItem('client_auth_mode');
        sessionStorage.removeItem('client_auth_user');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Don't remove auth on network errors - might just be backend down
      if (!(error instanceof TypeError)) {
        sessionStorage.removeItem('client_auth_mode');
        sessionStorage.removeItem('client_auth_user');
      }
    }
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private clearErrors(): void {
    document.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach((el) => {
      (el as HTMLElement).style.display = 'none';
    });
  }

  private showSettings(): void {
    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const settingsView = document.getElementById('settings-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (settingsView) {
      settingsView.style.display = 'block';
      // Load current user data into forms
      this.loadUserSettings();
    }

    // Remove active state from all navigation items
    document
      .querySelectorAll('.project-item, .account-item')
      .forEach((item) => item.classList.remove('active'));
  }

  private showBillingView(): void {
    // Hide other views
    this.hideAllViews();

    // Show billing view
    const billingView = document.getElementById('billing-view');
    if (billingView) {
      billingView.style.display = 'block';
      // Load current billing data into forms
      this.loadBillingSettings();
    }

    // Set active state on billing button
    document
      .querySelectorAll('.project-item, .account-item')
      .forEach((item) => item.classList.remove('active'));
    const billingBtn = document.getElementById('billing-btn');
    if (billingBtn) billingBtn.classList.add('active');
  }

  private showContactView(): void {
    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const billingView = document.getElementById('billing-view');
    const settingsView = document.getElementById('settings-view');
    const notificationsView = document.getElementById('notifications-view');
    const contactView = document.getElementById('contact-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (notificationsView) notificationsView.style.display = 'none';
    if (contactView) {
      contactView.style.display = 'block';
      // Load current contact data into forms
      this.loadContactSettings();
    }

    // Set active state on contact button
    document
      .querySelectorAll('.project-item, .account-item')
      .forEach((item) => item.classList.remove('active'));
    const contactBtn = document.getElementById('contact-btn');
    if (contactBtn) contactBtn.classList.add('active');
  }

  private showNotificationsView(): void {
    // Hide other views
    const welcomeView = document.getElementById('welcome-view');
    const projectDetailView = document.getElementById('project-detail-view');
    const billingView = document.getElementById('billing-view');
    const settingsView = document.getElementById('settings-view');
    const contactView = document.getElementById('contact-view');
    const notificationsView = document.getElementById('notifications-view');

    if (welcomeView) welcomeView.style.display = 'none';
    if (projectDetailView) projectDetailView.style.display = 'none';
    if (billingView) billingView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'none';
    if (contactView) contactView.style.display = 'none';
    if (notificationsView) {
      notificationsView.style.display = 'block';
      // Load current notification preferences
      this.loadNotificationSettings();
    }

    // Set active state on notifications button
    document
      .querySelectorAll('.project-item, .account-item')
      .forEach((item) => item.classList.remove('active'));
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) notificationsBtn.classList.add('active');
  }

  private showUpdatesView(): void {
    // Hide other views
    this.hideAllViews();

    // Show updates view
    const updatesView = document.getElementById('updates-view');
    if (updatesView) {
      updatesView.style.display = 'block';
    }

    // Update active states
    document
      .querySelectorAll('.project-item, .account-item, .project-subitem')
      .forEach((item) => item.classList.remove('active'));
    const updatesBtn = document.getElementById('updates-btn');
    if (updatesBtn) updatesBtn.classList.add('active');
  }

  private showFilesView(): void {
    // Hide other views
    this.hideAllViews();

    // Show files view
    const filesView = document.getElementById('files-view');
    if (filesView) {
      filesView.style.display = 'block';
    }

    // Update active states
    document
      .querySelectorAll('.project-item, .account-item, .project-subitem')
      .forEach((item) => item.classList.remove('active'));
    const filesBtn = document.getElementById('files-btn');
    if (filesBtn) filesBtn.classList.add('active');
  }

  private showMessagesView(): void {
    // Hide other views
    this.hideAllViews();

    // Show messages view
    const messagesView = document.getElementById('messages-view');
    if (messagesView) {
      messagesView.style.display = 'block';
    }

    // Update active states
    document
      .querySelectorAll('.project-item, .account-item, .project-subitem')
      .forEach((item) => item.classList.remove('active'));
    const messagesBtn = document.getElementById('messages-btn');
    if (messagesBtn) messagesBtn.classList.add('active');
  }

  private showContentView(): void {
    // Hide other views
    this.hideAllViews();

    // Show content view
    const contentView = document.getElementById('content-view');
    if (contentView) {
      contentView.style.display = 'block';
    }

    // Update active states
    document
      .querySelectorAll('.project-item, .account-item, .project-subitem')
      .forEach((item) => item.classList.remove('active'));
    const contentBtn = document.getElementById('content-btn');
    if (contentBtn) contentBtn.classList.add('active');
  }

  private showProjectDetailView(): void {
    // Hide other views
    this.hideAllViews();

    // Show project detail view (overview)
    const projectDetailView = document.getElementById('project-detail-view');
    if (projectDetailView) {
      projectDetailView.style.display = 'block';
    }

    // Update active states
    document
      .querySelectorAll('.project-item, .account-item, .project-subitem')
      .forEach((item) => item.classList.remove('active'));
    const projectMain = document.getElementById('project-main');
    if (projectMain) projectMain.classList.add('active');

    // Update breadcrumbs
    this.updateBreadcrumbs([
      { label: 'Dashboard', href: true, onClick: () => this.showWelcomeView() },
      { label: 'Your Website Project', href: false }
    ]);
  }

  private showWelcomeView(): void {
    this.hideAllViews();
    const welcomeView = document.getElementById('welcome-view');
    if (welcomeView) {
      welcomeView.style.display = 'block';
    }

    document
      .querySelectorAll('.project-item, .account-item, .project-subitem')
      .forEach((item) => item.classList.remove('active'));

    this.updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
  }

  private updateBreadcrumbs(
    breadcrumbs: Array<{ label: string; href: boolean; onClick?: () => void }>
  ): void {
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

  private hideAllViews(): void {
    const views = [
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

    views.forEach((viewId) => {
      const view = document.getElementById(viewId);
      if (view) {
        view.style.display = 'none';
      }
    });
  }

  private toggleSidebar(): void {
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
  private toggleMobileMenu(): void {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');

    if (!sidebar || !mobileMenuToggle) {
      console.error('Mobile menu elements not found');
      return;
    }

    const isOpen = sidebar.classList.contains('mobile-open');

    if (isOpen) {
      this.closeMobileMenu();
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
  private closeMobileMenu(): void {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');

    sidebar?.classList.remove('mobile-open');
    mobileMenuToggle?.classList.remove('active');
    mobileOverlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  /**
   * Handle user logout - clear session and redirect to landing page
   */
  private handleLogout(): void {
    // Clear all auth data from sessionStorage
    sessionStorage.removeItem('clientAuth');
    sessionStorage.removeItem('clientAuthToken');
    sessionStorage.removeItem('client_auth_mode');
    sessionStorage.removeItem('client_auth_user');
    sessionStorage.removeItem('clientPortalAuth');
    sessionStorage.removeItem('clientEmail');
    sessionStorage.removeItem('clientName');

    // Redirect to home page
    window.location.href = '/';
  }

  /**
   * Switch to a specific tab in the dashboard
   */
  private switchTab(tabName: string): void {
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
    this.updateMobileHeaderTitle(tabName);

    // Load tab-specific data
    if (tabName === 'files') {
      this.loadFiles();
    } else if (tabName === 'invoices') {
      this.loadInvoices();
    } else if (tabName === 'preview') {
      this.loadProjectPreview();
    } else if (tabName === 'messages') {
      this.loadMessagesFromAPI();
    }
  }

  /**
   * Update the mobile header title based on current tab
   */
  private updateMobileHeaderTitle(tabName: string): void {
    const mobileHeaderTitle = document.getElementById('mobile-header-title');
    if (!mobileHeaderTitle) return;

    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      files: 'Files',
      messages: 'Messages',
      invoices: 'Invoices',
      settings: 'Settings',
      'new-project': 'New Project',
      preview: 'Project Preview'
    };

    mobileHeaderTitle.textContent = titles[tabName] || 'Dashboard';
  }

  /**
   * Load project preview into iframe
   */
  private async loadProjectPreview(): Promise<void> {
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    const urlDisplay = document.getElementById('preview-url');
    const openNewTabBtn = document.getElementById('btn-open-new-tab');
    const refreshBtn = document.getElementById('btn-refresh-preview');

    if (!iframe) return;

    const authMode = sessionStorage.getItem('client_auth_mode');

    if (!authMode || authMode === 'demo') {
      // Demo mode - show placeholder
      iframe.src = '';
      if (urlDisplay) urlDisplay.textContent = 'Preview not available in demo mode';
      return;
    }

    try {
      // Get client's projects to find one with a preview URL
      const response = await fetch(`${ClientPortalModule.PROJECTS_API_BASE}`, {
        credentials: 'include' // Include HttpOnly cookies
      });

      if (!response.ok) {
        throw new Error('Failed to load projects');
      }

      const data = await response.json();
      const projects = data.projects || [];

      // Find a project with a preview URL
      const projectWithPreview = projects.find((p: PortalProject) => p.preview_url);

      if (projectWithPreview && projectWithPreview.preview_url) {
        const previewUrl = projectWithPreview.preview_url;
        iframe.src = previewUrl;
        if (urlDisplay) urlDisplay.textContent = previewUrl;

        // Setup open in new tab button
        if (openNewTabBtn) {
          openNewTabBtn.onclick = () => window.open(previewUrl, '_blank');
        }

        // Setup refresh button
        if (refreshBtn) {
          refreshBtn.onclick = () => {
            iframe.src = '';
            setTimeout(() => {
              iframe.src = previewUrl;
            }, 100);
          };
        }
      } else {
        iframe.src = '';
        if (urlDisplay) urlDisplay.textContent = 'No preview available for your projects yet';
      }
    } catch (error) {
      console.error('Error loading project preview:', error);
      iframe.src = '';
      if (urlDisplay) urlDisplay.textContent = 'Error loading preview';
    }
  }

  private toggleAccountFolder(): void {
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
   */
  private async loadUserSettings(): Promise<void> {
    const settingsModule = await loadSettingsModule();
    settingsModule.loadUserSettings(this.currentUser);
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
