/**
 * ===============================================
 * PORTAL SHELL
 * ===============================================
 * @file src/features/portal/PortalShell.ts
 *
 * Main controller for the portal.
 * Manages navigation, theming, and module lifecycle
 * based on the user's role.
 *
 * CORE PRINCIPLE: Single shell, dynamically configured by role.
 */

import { BaseModule } from '../../modules/core/base';
import { authStore } from '../../auth/auth-store';
import {
  getNavigationForRole,
  getSubtabGroupsForRole,
  getFeaturesForRole,
  getCapabilitiesForRole,
  getDefaultTabForRole,
  resolveTab,
  getTabTitle,
  canAccessTab,
  type UserRole,
  type UnifiedNavItem,
  type UnifiedSubtabGroup,
  type PortalFeatures
} from '../../../server/config/unified-navigation';
import { PortalModuleLoader } from './PortalModuleLoader';
import type { PortalContext } from '../shared/types';

/**
 * Portal Shell
 *
 * The single entry point for both admin and client portals.
 * Dynamically configures navigation, features, and modules
 * based on the authenticated user's role.
 */
export class PortalShell extends BaseModule {
  /** Dynamic module loader */
  private moduleLoader: PortalModuleLoader;

  /** Portal context shared with modules */
  private context: PortalContext;

  /** Current user role */
  private role: UserRole;

  /** Currently active tab */
  private currentTab: string;

  /** Currently active group (for grouped tabs) */
  private currentGroup: string | null = null;

  /** Navigation items for current role */
  private navItems: UnifiedNavItem[] = [];

  /** Subtab groups for current role */
  private subtabGroups: UnifiedSubtabGroup[] = [];

  /** Portal features for current role */
  private features: PortalFeatures;

  /** Hash-based routing flag to prevent re-entrant updates */
  private isNavigating = false;

  constructor() {
    super('PortalShell');

    // Get auth state
    const state = authStore.getState();
    this.role = (state.role as UserRole) || 'client';

    // Get config for role
    this.navItems = getNavigationForRole(this.role);
    this.subtabGroups = getSubtabGroupsForRole(this.role);
    this.features = getFeaturesForRole(this.role);

    // Set initial tab
    this.currentTab = getDefaultTabForRole(this.role);

    // Create context
    // For client users, the userId IS the clientId
    const userId = state.user?.id || 0;
    this.context = {
      role: this.role,
      userId,
      clientId: this.role === 'client' ? userId : undefined,
      capabilities: getCapabilitiesForRole(this.role),
      showNotification: this.showNotification.bind(this),
      refreshData: this.refreshCurrentModule.bind(this),
      switchTab: this.switchTab.bind(this),
      // Auth is cookie-based via credentials: 'include'; token getter is unused
      getAuthToken: () => null
    };

    // Create module loader
    this.moduleLoader = new PortalModuleLoader(this.context);
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  protected async onInit(): Promise<void> {
    this.log('Initializing with role:', this.role);

    // Get container element (tab-content containers rendered by EJS)
    const container = document.getElementById('tab-dashboard') || document.getElementById('dashboard-content');
    if (container) {
      this.moduleLoader.setContainer(container);
    }

    // Setup hash-based routing
    this.setupHashRouter();

    // Setup navigation click handlers
    this.setupNavigationHandlers();

    // Setup theme toggle
    this.setupThemeToggle();

    // Setup keyboard shortcuts (admin only)
    if (this.role === 'admin') {
      this.setupKeyboardShortcuts();
    }

    // Listen for auth changes
    this.setupAuthListener();

    // Load initial tab from URL hash
    const initialTab = this.getTabFromHash() || this.currentTab;
    await this.switchTab(initialTab, false);

    this.log('Initialized successfully');
  }

  protected async onDestroy(): Promise<void> {
    // Clear module cache
    await this.moduleLoader.clearCache();
  }

  // ============================================
  // NAVIGATION
  // ============================================

  /**
   * Switch to a different tab
   *
   * @param tabId - Tab to switch to
   * @param updateHash - Whether to update the URL hash (default: true)
   */
  async switchTab(tabId: string, updateHash = true): Promise<void> {
    // Verify tab access
    if (!canAccessTab(tabId, this.role)) {
      this.warn(`Tab "${tabId}" not accessible for role "${this.role}"`);
      tabId = getDefaultTabForRole(this.role);
    }

    // Resolve group/tab
    const { group, tab } = resolveTab(tabId, this.role);
    this.currentTab = tab;
    this.currentGroup = group;

    // Update URL hash
    if (updateHash) {
      this.updateHash(tab);
    }

    // Update nav button active states
    this.updateNavActiveStates();

    // Update subtabs visibility
    this.updateSubtabs();

    // Update page title
    this.updatePageTitle();

    // Update body data attributes
    document.body.dataset.activeTab = tab;
    document.body.dataset.activeGroup = group || tab;

    // Load the module
    await this.moduleLoader.loadModule(tab);

    this.log('Switched to tab:', tab);
  }

  /**
   * Update navigation button active states
   */
  private updateNavActiveStates(): void {
    const navButtons = document.querySelectorAll(
      '.sidebar-btn[data-tab], .nav-btn[data-tab]'
    );

    navButtons.forEach((btn) => {
      const btnTab = (btn as HTMLElement).dataset.tab;
      const isActive =
        btnTab === this.currentTab ||
        btnTab === this.currentGroup;

      btn.classList.toggle('active', isActive);

      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
  }

  /**
   * Update subtabs visibility and active states
   */
  private updateSubtabs(): void {
    // Hide all subtab groups
    const allGroups = document.querySelectorAll('.header-subtab-group');
    allGroups.forEach((group) => {
      (group as HTMLElement).style.display = 'none';
    });

    // Show the relevant subtab group
    const activeGroup = this.currentGroup || this.currentTab;
    const group = document.querySelector(
      `.header-subtab-group[data-for-tab="${activeGroup}"]`
    );

    if (group) {
      (group as HTMLElement).style.display = 'flex';

      // Update subtab active states
      const subtabs = group.querySelectorAll('.portal-subtab');
      subtabs.forEach((subtab) => {
        const subtabId = (subtab as HTMLElement).dataset.subtab;
        subtab.classList.toggle('active', subtabId === this.currentTab);
      });
    }
  }

  /**
   * Update the page title in the header
   */
  private updatePageTitle(): void {
    const titleEl = document.getElementById('portal-page-title') ||
                    document.getElementById('admin-page-title');

    if (!titleEl) return;

    const title = getTabTitle(this.currentTab);
    titleEl.textContent = title;
  }

  // ============================================
  // HASH-BASED ROUTING
  // ============================================

  /**
   * Setup hash-based routing
   */
  private setupHashRouter(): void {
    window.addEventListener('hashchange', () => {
      // Skip if we triggered this change ourselves
      if (this.isNavigating) return;

      const tabId = this.getTabFromHash();
      if (tabId && tabId !== this.currentTab) {
        this.switchTab(tabId, false);
      }
    });
  }

  /**
   * Get tab ID from current URL hash
   */
  private getTabFromHash(): string | null {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') {
      return null;
    }

    // Remove leading #/ or #
    const path = hash.replace(/^#\/?/, '');

    // Return the tab ID
    return path || null;
  }

  /**
   * Update URL hash
   */
  private updateHash(tabId: string): void {
    const newHash = `#/${tabId}`;

    if (window.location.hash !== newHash) {
      this.isNavigating = true;
      window.location.hash = newHash;

      // Reset flag after a tick
      setTimeout(() => {
        this.isNavigating = false;
      }, 0);
    }
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Setup navigation click handlers
   */
  private setupNavigationHandlers(): void {
    // Sidebar navigation buttons
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.sidebar-btn[data-tab]');
      if (btn) {
        e.preventDefault();
        const tabId = (btn as HTMLElement).dataset.tab;
        if (tabId) {
          this.switchTab(tabId);
        }
      }

      // Subtab buttons
      const subtab = (e.target as HTMLElement).closest('.portal-subtab[data-subtab]');
      if (subtab) {
        e.preventDefault();
        const subtabId = (subtab as HTMLElement).dataset.subtab;
        if (subtabId) {
          this.switchTab(subtabId);
        }
      }
    });
  }

  /**
   * Setup theme toggle handler
   */
  private setupThemeToggle(): void {
    const toggleBtn = document.getElementById('header-toggle-theme');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  }

  /**
   * Toggle between light and dark theme
   */
  private toggleTheme(): void {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    this.log('Theme toggled to:', newTheme);
  }

  /**
   * Setup keyboard shortcuts (admin only)
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Only handle number keys 1-9 when not in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key;
      if (key >= '1' && key <= '9') {
        // Find nav item with this shortcut
        const navItem = this.navItems.find((item) => item.shortcut === key);
        if (navItem) {
          e.preventDefault();
          this.switchTab(navItem.id);
        }
      }
    });
  }

  /**
   * Setup auth state listener
   */
  private setupAuthListener(): void {
    authStore.subscribe((state) => {
      const newRole = (state.role as UserRole) || 'client';

      // If role changed, reinitialize
      if (newRole !== this.role) {
        this.log('Role changed from', this.role, 'to', newRole);
        this.handleRoleChange(newRole);
      }
    });
  }

  /**
   * Handle role change (e.g., after login/logout)
   */
  private async handleRoleChange(newRole: UserRole): Promise<void> {
    // Clear module cache
    await this.moduleLoader.clearCache();

    // Update role and configs
    this.role = newRole;
    this.navItems = getNavigationForRole(this.role);
    this.subtabGroups = getSubtabGroupsForRole(this.role);
    this.features = getFeaturesForRole(this.role);

    // Update context
    this.context.role = newRole;
    this.context.capabilities = getCapabilitiesForRole(newRole);

    // Navigate to default tab for new role
    const defaultTab = getDefaultTabForRole(newRole);
    await this.switchTab(defaultTab);
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Show a notification to the user
   */
  private showNotification(
    message: string,
    type: 'success' | 'error' | 'warning' | 'info'
  ): void {
    // Use existing toast notification system
    const event = new CustomEvent('show-toast', {
      detail: { message, type }
    });
    document.dispatchEvent(event);
  }

  /**
   * Refresh the current module
   */
  private async refreshCurrentModule(): Promise<void> {
    await this.moduleLoader.refreshCurrentModule();
  }

  /**
   * Get the current tab ID
   */
  getCurrentTab(): string {
    return this.currentTab;
  }

  /**
   * Get the current group
   */
  getCurrentGroup(): string | null {
    return this.currentGroup;
  }

  /**
   * Get the portal context
   */
  getContext(): PortalContext {
    return this.context;
  }

  /**
   * Get features for current role
   */
  getFeatures(): PortalFeatures {
    return this.features;
  }
}

/**
 * Export singleton factory
 */
let shellInstance: PortalShell | null = null;

export function getPortalShell(): PortalShell {
  if (!shellInstance) {
    shellInstance = new PortalShell();
  }
  return shellInstance;
}

export function destroyPortalShell(): void {
  if (shellInstance) {
    shellInstance.destroy();
    shellInstance = null;
  }
}
