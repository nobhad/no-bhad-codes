/**
 * ===============================================
 * PORTAL MODULE LOADER
 * ===============================================
 * @file src/features/portal/PortalModuleLoader.ts
 *
 * Dynamic module loader for the portal.
 * Handles lazy loading, caching, and lifecycle management
 * of feature modules.
 */

import type { PortalContext } from '../shared/types';
import type { PortalFeatureModule } from '../shared/PortalFeatureModule';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PortalModuleLoader');

/**
 * Module loader function type
 */
type ModuleLoader = () => Promise<{ default: new () => PortalFeatureModule }>;

/**
 * Module instance with metadata
 */
interface ModuleInstance {
  module: PortalFeatureModule;
  tabId: string;
  loadedAt: number;
}

/**
 * Module loader registry
 * Maps tab IDs to their dynamic import functions
 *
 * NOTE: Modules are commented out until implemented.
 * Uncomment as each portal module is created.
 */
const MODULE_LOADERS: Record<string, ModuleLoader> = {
  // ========== SHARED MODULES (role-adaptive) ==========
  // These modules adapt their behavior based on user role
  dashboard: () => import('../shared/PortalDashboard').then((m) => ({ default: m.default })),
  messages: () => import('../shared/PortalMessaging').then((m) => ({ default: m.default })),
  files: () => import('../shared/PortalFiles').then((m) => ({ default: m.default })),
  invoices: () => import('../shared/PortalInvoices').then((m) => ({ default: m.default })),
  projects: () => import('../shared/PortalProjects').then((m) => ({ default: m.default })),
  requests: () => import('../shared/PortalRequests').then((m) => ({ default: m.default })),
  settings: () => import('../shared/PortalSettings').then((m) => ({ default: m.default })),
  questionnaires: () => import('../shared/PortalQuestionnaires').then((m) => ({ default: m.default }))

  // ========== ADMIN-ONLY MODULES ==========
  // These modules are only available to admin users
  // 'overview': () => import('../admin/modules/admin-overview'),
  // 'tasks': () => import('../admin/modules/admin-tasks'),
  // 'leads': () => import('../admin/modules/admin-leads'),
  // 'contacts': () => import('../admin/modules/admin-contacts'),
  // 'clients': () => import('../admin/modules/admin-clients'),
  // 'contracts': () => import('../admin/modules/admin-contracts'),
  // 'document-requests': () => import('../admin/modules/admin-document-requests'),
  // 'analytics': () => import('../admin/modules/admin-analytics'),
  // 'workflows': () => import('../admin/modules/admin-workflows'),
  // 'support': () => import('../admin/modules/admin-knowledge-base'),
  // 'system': () => import('../admin/modules/admin-system-status'),

  // ========== CLIENT-ONLY MODULES ==========
  // These modules are only available to client users
  // 'approvals': () => import('../client/modules/portal-approvals'),
  // 'review': () => import('../client/modules/portal-views'),
  // 'help': () => import('../client/modules/portal-help'),
};

/**
 * Portal Module Loader
 *
 * Manages dynamic loading and caching of feature modules.
 * Each module is loaded on-demand when its tab is activated,
 * then cached for fast switching.
 */
export class PortalModuleLoader {
  /** Cached module instances */
  private cache: Map<string, ModuleInstance> = new Map();

  /** Currently active module */
  private currentModule: PortalFeatureModule | null = null;

  /** Portal context passed to modules */
  private context: PortalContext;

  /** Container element for module content */
  private container: HTMLElement | null = null;

  constructor(context: PortalContext) {
    this.context = context;
  }

  /**
   * Set the container element for module content
   */
  setContainer(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * Load and activate a module for the given tab
   *
   * 1. Deactivates the current module
   * 2. Checks cache for existing instance
   * 3. Loads module dynamically if not cached
   * 4. Initializes with context
   * 5. Activates the module
   */
  async loadModule(tabId: string): Promise<void> {
    // Deactivate current module
    if (this.currentModule) {
      try {
        await this.currentModule.deactivate();
      } catch (error) {
        logger.error('Error deactivating module:', error);
      }
    }

    // Check cache first
    const cached = this.cache.get(tabId);
    if (cached) {
      this.currentModule = cached.module;
      if (this.container) {
        this.currentModule.setContainer(this.container);
      }
      await this.currentModule.activate();
      return;
    }

    // Get the loader for this tab
    const loader = MODULE_LOADERS[tabId];
    if (!loader) {
      logger.warn(`No module registered for tab: ${tabId}`);
      this.showModuleNotFound(tabId);
      return;
    }

    try {
      // Dynamically import the module
      const { default: ModuleClass } = await loader();

      // Create instance
      const instance = new ModuleClass();

      // Set container before init
      if (this.container) {
        instance.setContainer(this.container);
      }

      // Initialize with context
      await instance.initWithContext(this.context);

      // Cache the instance
      this.cache.set(tabId, {
        module: instance,
        tabId,
        loadedAt: Date.now()
      });

      // Set as current and activate
      this.currentModule = instance;
      await instance.activate();
    } catch (error) {
      logger.error(`Error loading module for tab ${tabId}:`, error);
      this.showLoadError(tabId, error);
    }
  }

  /**
   * Get the currently active module
   */
  getCurrentModule(): PortalFeatureModule | null {
    return this.currentModule;
  }

  /**
   * Check if a module is loaded for a tab
   */
  isModuleLoaded(tabId: string): boolean {
    return this.cache.has(tabId);
  }

  /**
   * Clear the module cache
   * Useful for forcing fresh loads after auth changes
   */
  async clearCache(): Promise<void> {
    // Deactivate current module
    if (this.currentModule) {
      await this.currentModule.deactivate();
      this.currentModule = null;
    }

    // Destroy all cached modules
    for (const [, instance] of this.cache) {
      try {
        await instance.module.destroy();
      } catch (error) {
        logger.error('Error destroying module:', error);
      }
    }

    this.cache.clear();
  }

  /**
   * Refresh the current module
   */
  async refreshCurrentModule(): Promise<void> {
    if (this.currentModule) {
      await this.currentModule.deactivate();
      await this.currentModule.activate();
    }
  }

  /**
   * Show error when module fails to load
   */
  private showLoadError(tabId: string, error: unknown): void {
    if (this.container) {
      this.container.innerHTML = `
        <div class="error-state">
          <h3>Failed to load ${tabId}</h3>
          <p class="error-message">${error instanceof Error ? error.message : 'Unknown error'}</p>
          <button class="btn btn-secondary" data-action="retry" data-tab="${tabId}">
            Retry
          </button>
        </div>
      `;
    }
  }

  /**
   * Show message when module is not found
   */
  private showModuleNotFound(tabId: string): void {
    if (this.container) {
      this.container.innerHTML = `
        <div class="empty-state">
          <h3>Module not available</h3>
          <p>The "${tabId}" module is not yet implemented.</p>
        </div>
      `;
    }
  }

  /**
   * Register a module loader for a tab
   * Allows dynamic registration of modules
   */
  static registerModule(tabId: string, loader: ModuleLoader): void {
    MODULE_LOADERS[tabId] = loader;
  }

  /**
   * Get list of registered module IDs
   */
  static getRegisteredModules(): string[] {
    return Object.keys(MODULE_LOADERS);
  }
}
