/**
 * ===============================================
 * PORTAL SESSION MANAGER
 * ===============================================
 * @file src/features/client/portal-session-manager.ts
 *
 * Extracted from client-portal.ts
 * Handles dashboard display, onboarding wizard, hash routing,
 * admin features, React navigation mounting, portal header,
 * and logout flow.
 */

import type { ClientPortalContext } from './portal-types';
import { loadNavigationModule, loadAuthModule, loadOnboardingWizardModule, loadMessagesModule } from './modules';
import { ROUTES } from '../../constants/api-endpoints';
import { authStore } from '../../auth/auth-store';
import { decodeJwtPayload, isAdminPayload } from '../../utils/jwt-utils';
import { showToast } from '../../utils/toast-notifications';
import { initPortalHeader, type PortalHeader } from '../shared/portal-header';
import { getReactComponent } from '../../react/registry';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalSession');

/** Dependencies injected from the main portal module */
export interface SessionManagerDeps {
  loginSection: HTMLElement | null;
  dashboardSection: HTMLElement | null;
  loginForm: HTMLFormElement | null;
  moduleContext: ClientPortalContext;
  getCurrentUserData: () => { id: number; email: string; name: string } | null;
  log: (...args: unknown[]) => void;
  setLoggedIn: (value: boolean) => void;
  setDashboardListenersSetup: (value: boolean) => void;
  getDashboardListenersSetup: () => boolean;
  setupDashboardEventListeners: () => void;
}

/** Mutable state managed by session manager */
export interface SessionManagerState {
  portalHeader: PortalHeader | null;
  reactNavigationMounted: boolean;
  hashRouterInitialized: boolean;
}

/**
 * Create initial session manager state
 */
export function createSessionManagerState(): SessionManagerState {
  return {
    portalHeader: null,
    reactNavigationMounted: false,
    hashRouterInitialized: false
  };
}

/**
 * Show the dashboard (handles first-login onboarding check)
 */
export function showDashboard(deps: SessionManagerDeps, state: SessionManagerState): void {
  if (!deps.dashboardSection) return;

  // Hide auth gate if present (legacy -- auth gate removed from dashboard template)
  if (deps.loginSection) {
    deps.loginSection.classList.add('hidden');
  }

  // Add logged-in class to body -- CSS handles hiding header, footer, and nav overlay
  // See: src/styles/client-portal/login.css -- body.portal-logged-in rules
  document.body.classList.add('portal-logged-in');

  // Check if this is first login - show onboarding wizard
  const { isFirstLogin } = authStore.getState();
  if (isFirstLogin) {
    showOnboardingWizard(deps, state);
    return;
  }

  // Show normal dashboard
  showDashboardContent(deps, state);
}

/**
 * Show the onboarding wizard for first-time login
 */
async function showOnboardingWizard(
  deps: SessionManagerDeps,
  state: SessionManagerState
): Promise<void> {
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

  const wizard = new OnboardingWizardModule(wizardContainer, deps.moduleContext, {
    onComplete: () => {
      clearFirstLoginFlag();
      wizardOverlay.remove();
      showDashboardContent(deps, state);
      showToast('Welcome! Your profile is set up.', 'success');
    },
    onCancel: () => {
      clearFirstLoginFlag();
      wizardOverlay.remove();
      showDashboardContent(deps, state);
    }
  });

  await wizard.init();
}

/**
 * Clear the first login flag after onboarding is complete
 */
function clearFirstLoginFlag(): void {
  sessionStorage.removeItem('nbw_auth_is_first_login');
  // Note: The authStore state will be updated on next page load
  // For this session, we just ensure the wizard doesn't show again
}

/**
 * Show the main dashboard content
 */
export function showDashboardContent(
  deps: SessionManagerDeps,
  state: SessionManagerState
): void {
  if (!deps.dashboardSection) return;

  // Remove hidden class -- CSS restores display:flex via .dashboard-container rule
  deps.dashboardSection.classList.remove('hidden');

  // Mount React navigation sidebar
  mountReactNavigation(deps, state);

  // Set initial breadcrumb at top of page (Dashboard when on main dashboard tab)
  loadNavigationModule().then((navModule) => {
    navModule.updateBreadcrumbs([{ label: 'Dashboard', href: false }]);
  });

  // Dashboard stats now loaded by React PortalDashboard component

  // Setup dashboard event listeners if not already done, then initialize hash router
  if (!deps.getDashboardListenersSetup()) {
    setTimeout(() => {
      deps.setupDashboardEventListeners();
      // Initialize hash-based routing after listeners are ready
      initializeHashRouter(deps, state);
    }, 100);
  } else {
    // Listeners already set up, just ensure hash router is initialized
    initializeHashRouter(deps, state);
  }

  // Show admin features if user is admin
  setupAdminFeatures(deps);

  // Initialize shared portal header (notification bell, theme toggle)
  initPortalHeaderInstance(deps, state);
}

/**
 * Mount React navigation sidebar
 */
async function mountReactNavigation(
  deps: SessionManagerDeps,
  state: SessionManagerState
): Promise<void> {
  if (state.reactNavigationMounted) return;

  const container = document.getElementById('react-portal-navigation-mount');
  if (!container) {
    logger.warn('React navigation mount container not found');
    return;
  }

  const component = getReactComponent('portalNavigation');
  if (!component) {
    logger.warn('React portal navigation component not registered');
    return;
  }

  try {
    // Get current user info
    const currentUserData = deps.getCurrentUserData();
    const user = currentUserData
      ? {
        name: currentUserData.name || 'Client',
        email: currentUserData.email || ''
      }
      : undefined;

    // Get current active tab from hash
    const hash = window.location.hash;
    const activeTab = getTabFromHash(hash);

    component.mount(container, {
      activeTab,
      onNavigate: (tab: string) => {
        loadNavigationModule().then((navModule) => {
          navModule.navigateTo(tab);
        });
      },
      user,
      badges: {}, // Will be updated when counts are loaded
      onLogout: () => logout(deps),
      // Auth is cookie-based via credentials: 'include'; token getter is unused
      getAuthToken: () => null
    });

    state.reactNavigationMounted = true;
    logger.log('React navigation mounted');
  } catch (error) {
    logger.error('Failed to mount React navigation:', error);
  }
}

/**
 * Get tab name from URL hash
 */
export function getTabFromHash(hash: string): string {
  if (!hash || hash === '#' || hash === '#/') {
    return 'dashboard';
  }
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  const hashToTab: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/requests': 'requests',
    '/questionnaires': 'questionnaires',
    '/messages': 'messages',
    '/review': 'preview',
    '/files': 'files',
    '/help': 'help',
    '/settings': 'settings'
  };
  return hashToTab[path] || 'dashboard';
}

/**
 * Initialize the shared portal header (notification bell, theme toggle)
 */
async function initPortalHeaderInstance(
  deps: SessionManagerDeps,
  state: SessionManagerState
): Promise<void> {
  if (state.portalHeader) return;

  try {
    // Check if logged-in user is admin to use correct notification endpoints
    const isAdmin = checkIfUserIsAdmin();
    state.portalHeader = await initPortalHeader({ role: isAdmin ? 'admin' : 'client' });
  } catch (error) {
    logger.warn('Failed to initialize portal header:', error);
  }
}

/**
 * Check if the current user is an admin
 * Used for determining which API endpoints to use
 */
export function checkIfUserIsAdmin(): boolean {
  try {
    // Check sessionStorage for admin flag
    const authData = sessionStorage.getItem('clientAuth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.isAdmin) {
        return true;
      }
    }

    // Also check JWT token for admin flag
    const token = sessionStorage.getItem('client_auth_token');
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && isAdminPayload(payload)) {
        return true;
      }
    }
  } catch (error) {
    logger.warn('Error checking admin status:', error);
  }
  return false;
}

/**
 * Initialize hash-based routing for browser navigation
 */
function initializeHashRouter(
  deps: SessionManagerDeps,
  state: SessionManagerState
): void {
  // Only initialize once
  if (state.hashRouterInitialized) return;
  state.hashRouterInitialized = true;

  loadNavigationModule().then((navModule) => {
    // Set module context for React component mounting
    navModule.setModuleContext(deps.moduleContext);

    // Set up EJS subtab click handlers (e.g. Settings subtabs, project-detail subtabs)
    navModule.setupClientSubtabHandlers();

    // Initialize hash router -- no callbacks needed, all views are React
    navModule.initHashRouter();
  });
}

/**
 * Check if user is admin and show admin-only UI elements
 */
function setupAdminFeatures(deps: SessionManagerDeps): void {
  try {
    // Check sessionStorage for admin flag
    const authData = sessionStorage.getItem('clientAuth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.isAdmin) {
        // Show admin buttons
        const adminButtons = document.querySelectorAll('.btn-admin');
        adminButtons.forEach((btn) => btn.classList.remove('hidden'));
        deps.log('[ClientPortal] Admin features enabled');
      }
    }

    // Also check JWT token for admin flag
    const token = sessionStorage.getItem('client_auth_token');
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && isAdminPayload(payload)) {
        const adminButtons = document.querySelectorAll('.btn-admin');
        adminButtons.forEach((btn) => btn.classList.remove('hidden'));
        deps.log('[ClientPortal] Admin features enabled (from token)');
      }
    }
  } catch (error) {
    logger.error('Error checking admin status:', error);
  }
}

/**
 * Logout the user and redirect to login page
 */
export async function logout(deps: SessionManagerDeps): Promise<void> {
  // Clear authentication data using auth module
  const authModule = await loadAuthModule();
  authModule.clearAuthData();

  deps.setLoggedIn(false);
  deps.setDashboardListenersSetup(false);

  // Clear form data
  if (deps.loginForm) {
    deps.loginForm.reset();
  }
  authModule.clearErrors();

  // Redirect to login page -- auth gate is no longer embedded in the dashboard
  window.location.href = ROUTES.CLIENT.LOGIN;
}

/**
 * Handle user logout - delegates to auth module
 */
export async function handleLogout(): Promise<void> {
  const authModule = await loadAuthModule();
  authModule.handleLogout();
}

/**
 * Switch to a specific tab in the dashboard - delegates to navigation module
 * Uses navigateTo to update URL hash for browser back/forward support
 */
export async function switchTab(tabName: string): Promise<void> {
  const navModule = await loadNavigationModule();
  navModule.navigateTo(tabName);
}

/**
 * Toggle sidebar - delegates to navigation module
 */
export async function toggleSidebar(): Promise<void> {
  const navModule = await loadNavigationModule();
  navModule.toggleSidebar();
}

/**
 * Send a message - delegates to messages module
 */
export async function sendMessage(
  event: Event,
  moduleContext: ClientPortalContext
): Promise<void> {
  event.preventDefault();
  const messagesModule = await loadMessagesModule();
  await messagesModule.sendMessage(moduleContext);
}
