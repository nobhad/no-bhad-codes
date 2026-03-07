/**
 * ===============================================
 * PORTAL EVENT HANDLERS
 * ===============================================
 * @file src/features/client/portal-event-handlers.ts
 *
 * Extracted from client-portal.ts
 * Handles login form setup, magic link toggle, auth event listeners,
 * dashboard event listeners, sidebar toggles, and portal data clearing.
 */

import type { ClientPortalContext } from './portal-types';
import { loadAuthModule } from './modules';
import { createDOMCache } from '../../utils/dom-cache';
import { ROUTES } from '../../constants/api-endpoints';
import { ICONS, getAccessibleIcon } from '../../constants/icons';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalEvents');

/** Dependencies injected from the main portal module */
export interface EventHandlerDeps {
  domCache: ReturnType<typeof createDOMCache>;
  loginForm: HTMLFormElement | null;
  projectsList: HTMLElement | null;
  projectDetails: HTMLElement | null;
  moduleContext: ClientPortalContext;
  log: (...args: unknown[]) => void;
  setLoggedIn: (value: boolean) => void;
  setCurrentUser: (email: string | null) => void;
  setCurrentUserData: (data: { id: number; email: string; name: string } | null) => void;
  clearPortalData: () => void;
  loadRealUserProjects: (user: { id: number; email: string; name: string }) => Promise<void>;
  showDashboard: () => void;
  switchTab: (tabName: string) => Promise<void>;
  toggleSidebar: () => Promise<void>;
  handleLogout: () => Promise<void>;
  sendMessage: (event: Event) => Promise<void>;
  setupSettingsFormHandlers: () => void;
  setupDashboardEventListeners: () => void;
  getDashboardListenersSetup: () => boolean;
  setDashboardListenersSetup: (value: boolean) => void;
}

/**
 * Setup login form event listener
 */
export function setupLoginFormHandler(deps: EventHandlerDeps): void {
  if (deps.loginForm) {
    deps.log('Login form found, attaching submit handler');
    // Note: Do NOT dynamically change autocomplete attributes - this causes
    // browsers to re-evaluate and show multiple save password prompts.
    // Autocomplete attributes are set correctly in HTML.
    deps.loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      deps.log('Login form submitted');

      const formData = new FormData(deps.loginForm!);
      const email = ((formData.get('email') as string) || '').trim();
      const password = (formData.get('password') as string) || '';

      deps.log('Login attempt for:', email);

      if (!email || !password) {
        deps.log('Missing email or password');
        const authModule = await loadAuthModule();
        authModule.showLoginError('Please enter your email and password');
        return;
      }

      const authModule = await loadAuthModule();
      await authModule.handleLogin(
        { email, password },
        {
          onLoginSuccess: async (user) => {
            deps.log('Login successful for:', user.email);
            // Clear any stale data before loading new user's data
            deps.clearPortalData();
            deps.setLoggedIn(true);
            deps.setCurrentUser(user.email);
            deps.setCurrentUserData(user);
            await deps.loadRealUserProjects(user);
            const isOnPortalPage = document.body.getAttribute('data-page') === 'client-portal';
            if (!isOnPortalPage) {
              window.location.href = ROUTES.PORTAL.DASHBOARD;
              return;
            }
            deps.showDashboard();
          },
          onLoginError: (message) => {
            deps.log('Login error:', message);
            authModule.showLoginError(message);
          },
          setLoading: (loading) => authModule.setLoginLoading(loading),
          clearErrors: () => authModule.clearErrors(),
          showFieldError: (fieldId, message) => authModule.showFieldError(fieldId, message)
        }
      );
    });
  } else {
    deps.log('Login form not found');
  }
}

/**
 * Setup password toggle for login form
 */
export function setupPasswordToggle(deps: EventHandlerDeps): void {
  const passwordToggle = deps.domCache.get('passwordToggle');
  const passwordInput = deps.domCache.getAs<HTMLInputElement>('clientPassword');
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
}

/**
 * Setup magic link toggle and form submission
 */
export function setupMagicLinkToggle(): void {
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
      logger.error('Magic link error:', error);
    } finally {
      submitBtn.disabled = false;
      if (btnText) (btnText as HTMLElement).style.display = 'inline';
      if (btnLoading) (btnLoading as HTMLElement).style.display = 'none';
    }
  });
}

/**
 * Setup auth event listeners to handle session expiry
 * Clears sensitive data from DOM when session expires to prevent data leakage
 */
export function setupAuthEventListeners(deps: EventHandlerDeps): void {
  // Listen for session expiry to clear sensitive data and redirect to login
  window.addEventListener('nbw:auth:session-expired', () => {
    deps.log('Session expired - redirecting to login');
    deps.clearPortalData();
    // Redirect to login page - prevents seeing any portal content
    window.location.href = `${ROUTES.CLIENT.LOGIN}?session=expired`;
  });

  // Listen for logout to ensure data is cleared
  window.addEventListener('nbw:auth:logout', () => {
    deps.log('User logged out - clearing portal data');
    deps.clearPortalData();
  });
}

/**
 * Clear all portal data from DOM and state
 * Called on session expiry or logout to prevent data leakage
 */
export function clearPortalData(deps: {
  domCache: ReturnType<typeof createDOMCache>;
  projectsList: HTMLElement | null;
  projectDetails: HTMLElement | null;
  setLoggedIn: (value: boolean) => void;
  setCurrentUser: (email: string | null) => void;
  setCurrentUserData: (data: { id: number; email: string; name: string } | null) => void;
  log: (...args: unknown[]) => void;
}): void {
  // Clear state
  deps.setLoggedIn(false);
  deps.setCurrentUser(null);
  deps.setCurrentUserData(null);

  // Clear URL hash so stale tab hash doesn't persist on the login page
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

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
  if (deps.projectsList) {
    deps.projectsList.innerHTML = '';
  }

  // Clear project details
  if (deps.projectDetails) {
    deps.projectDetails.innerHTML = '';
  }

  // Clear any visible project title/description
  const projectTitle = deps.domCache.get('projectTitle');
  if (projectTitle) {
    projectTitle.textContent = '';
  }

  const projectDescription = deps.domCache.get('projectDescriptionEl');
  if (projectDescription) {
    projectDescription.textContent = '';
  }

  // Clear progress indicators
  const progressFill = deps.domCache.get('progressFill') as HTMLElement | null;
  if (progressFill) {
    progressFill.style.width = '0%';
  }

  const progressText = deps.domCache.get('progressText');
  if (progressText) {
    progressText.textContent = '';
  }

  // Clear messages list
  const messagesList = deps.domCache.get('messagesList');
  if (messagesList) {
    messagesList.innerHTML = '';
  }

  // Clear updates timeline
  const updatesTimeline = deps.domCache.get('updatesTimeline');
  if (updatesTimeline) {
    updatesTimeline.innerHTML = '';
  }

  deps.log('Portal data cleared');
}

/**
 * Setup dashboard event listeners (sidebar, tabs, buttons, messages)
 */
export function setupDashboardEventListeners(deps: EventHandlerDeps): void {
  if (deps.getDashboardListenersSetup()) {
    deps.log('Dashboard event listeners already set up, skipping...');
    return;
  }

  deps.log('Setting up dashboard event listeners...');

  // Sidebar toggle (desktop)
  const sidebarToggle = deps.domCache.get('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
      e.preventDefault();
      deps.toggleSidebar();
    });
  }

  // Header sidebar toggle buttons (arrows next to page titles) - legacy
  const headerSidebarToggles = document.querySelectorAll('.header-sidebar-toggle');
  headerSidebarToggles.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      deps.toggleSidebar();
    });
  });

  // New sidebar toggle button (in sidebar)
  const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      deps.toggleSidebar();
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
      deps.toggleSidebar();
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
  const logoutBtn = deps.domCache.get('btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      deps.handleLogout();
    });
  }

  // Sidebar buttons with data-tab attribute - each goes directly to its view
  const sidebarButtons = document.querySelectorAll('.sidebar-buttons .btn[data-tab]');
  if (sidebarButtons.length > 0) {
    deps.log(`Found ${sidebarButtons.length} sidebar buttons with data-tab`);
    sidebarButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const btnEl = btn as HTMLElement;
        const tabName = btnEl.dataset.tab;
        if (tabName) {
          deps.switchTab(tabName);
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
      deps.switchTab(tabName);
    });
  });

  // Clickable stat cards
  const statCards = document.querySelectorAll('.stat-card-clickable[data-tab]');
  if (statCards.length > 0) {
    deps.log(`Found ${statCards.length} clickable stat cards`);
    statCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = (card as HTMLElement).dataset.tab;
        if (tabName) {
          deps.switchTab(tabName);
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

  const messageInput = deps.domCache.getAs<HTMLTextAreaElement>('messageInput');
  const sendButton = deps.domCache.get('btnSendMessage');

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
      deps.sendMessage(e);
    });
  }

  // Note: File upload handlers now handled by React component

  // Setup settings form handlers
  deps.setupSettingsFormHandlers();

  deps.log('Dashboard event listeners setup complete');
  deps.setDashboardListenersSetup(true);

  // Note: Initial tab is now handled by hash router in showDashboard()
  // via initializeHashRouter() which reads the URL hash
}

/**
 * Normalize project tabs classes
 */
export function normalizeProjectTabs(): void {
  document.querySelectorAll('.project-tabs').forEach((tabs) => {
    tabs.classList.add('portal-tabs');
  });

  document.querySelectorAll('.tab-pane').forEach((panel) => {
    panel.classList.add('portal-tab-panel');
  });
}
