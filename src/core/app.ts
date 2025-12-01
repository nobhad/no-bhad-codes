/**
 * ===============================================
 * APPLICATION CONTROLLER - NEW ARCHITECTURE
 * ===============================================
 * @file src/core/app.ts
 *
 * Modern application controller using dependency injection,
 * state management, and lazy loading.
 */

import { container } from './container';
import { appState } from './state';
import { componentStore, ComponentRegistry } from '../components';
import type { ModuleDefinition } from '../types/modules';

// Type definitions
interface ServiceInstance {
  init?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
  [key: string]: unknown;
}

interface ModuleInstance {
  init?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
  [key: string]: unknown;
}

// CSS imports moved to main.ts entry point

export class Application {
  private modules = new Map<string, ModuleInstance>();
  private services = new Map<string, ServiceInstance>();
  private isInitialized = false;
  private debug = false; // Disable debug to prevent flashing in development

  constructor() {
    this.setupServices();
    this.setupModules();
  }

  /**
   * Register core services
   */
  private setupServices(): void {
    // Register component store as a service
    container.singleton('ComponentStore', async () => componentStore);

    // Register component registry utilities
    container.singleton('ComponentRegistry', async () => ComponentRegistry);

    // Register router service
    container.register(
      'RouterService',
      async () => {
        const { RouterService } = await import('../services/router-service');
        return new RouterService({
          defaultRoute: '/',
          smoothScrolling: true,
          scrollOffset: 80,
          transitionDuration: 600
        });
      },
      { singleton: true }
    );

    // Register data service
    container.register(
      'DataService',
      async () => {
        const { DataService } = await import('../services/data-service');
        return new DataService();
      },
      { singleton: true }
    );

    // Register contact service
    container.register(
      'ContactService',
      async () => {
        const { ContactService } = await import('../services/contact-service');
        return new ContactService({
          backend: 'netlify' // Can be configured based on environment
        });
      },
      { singleton: true }
    );

    // Register performance service
    container.register(
      'PerformanceService',
      async () => {
        const { PerformanceService } = await import('../services/performance-service');
        return new PerformanceService({
          lcp: 2500,
          fid: 100,
          cls: 0.1,
          bundleSize: 600 * 1024,
          ttfb: 200
        });
      },
      { singleton: true }
    );

    // Register bundle analyzer service
    container.register(
      'BundleAnalyzerService',
      async () => {
        const { BundleAnalyzerService } = await import('../services/bundle-analyzer');
        return new BundleAnalyzerService();
      },
      { singleton: true }
    );

    // Register visitor tracking service
    container.register(
      'VisitorTrackingService',
      async () => {
        const { VisitorTrackingService } = await import('../services/visitor-tracking');
        return new VisitorTrackingService({
          enableTracking: true,
          respectDoNotTrack: true,
          cookieConsent: true,
          sessionTimeout: 30,
          trackScrollDepth: true,
          trackClicks: true,
          trackBusinessCardInteractions: true,
          trackFormSubmissions: true,
          trackDownloads: true,
          trackExternalLinks: true,
          batchSize: 10,
          flushInterval: 30
        });
      },
      { singleton: true }
    );

    // Register code protection service (uses config)
    container.register(
      'CodeProtectionService',
      async () => {
        const { CodeProtectionService } = await import('../services/code-protection-service');
        const { getProtectionConfig } = await import('../config/protection.config');
        return new CodeProtectionService(getProtectionConfig());
      },
      { singleton: true }
    );
  }

  /**
   * Register modules with lazy loading
   */
  private setupModules(): void {
    const modules: ModuleDefinition[] = [
      {
        name: 'ThemeModule',
        type: 'dom',
        factory: async () => {
          const { ThemeModule } = await import('../modules/theme');
          return new ThemeModule({ debug: this.debug });
        }
      },
      {
        name: 'IntroAnimationModule',
        type: 'dom',
        factory: async () => {
          // Only load intro animation on index/home page
          const currentPath = window.location.pathname;
          if (currentPath === '/' || currentPath === '/index.html') {
            const { IntroAnimationModule } = await import('../modules/intro-animation');
            return new IntroAnimationModule();
          }
          // Return a dummy module that does nothing for other pages
          return {
            init: async () => {},
            destroy: () => {},
            isInitialized: true,
            name: 'IntroAnimationModule'
          };
        }
      },
      {
        name: 'SectionCardRenderer',
        type: 'dom',
        factory: async () => {
          const { BusinessCardRenderer } = await import('../modules/business-card-renderer');
          return new BusinessCardRenderer({
            businessCardId: 'business-card',
            businessCardInnerId: 'business-card-inner',
            frontSelector: '#business-card .business-card-front',
            backSelector: '#business-card .business-card-back',
            containerSelector: '.business-card-container'
          });
        }
      },
      {
        name: 'SectionCardInteractions',
        type: 'dom',
        factory: async () => {
          const { BusinessCardInteractions } = await import(
            '../modules/business-card-interactions'
          );
          const renderer = await container.resolve('SectionCardRenderer');
          return new BusinessCardInteractions(renderer as any);
        },
        dependencies: ['SectionCardRenderer']
      },
      {
        name: 'NavigationModule',
        type: 'dom',
        factory: async () => {
          const { NavigationModule } = await import('../modules/navigation');
          const routerService = await container.resolve('RouterService');
          const dataService = await container.resolve('DataService');
          return new NavigationModule({
            debug: this.debug,
            routerService: routerService as any,
            dataService: dataService as any
          });
        },
        dependencies: ['RouterService', 'DataService']
      },
      {
        name: 'ContactFormModule',
        type: 'dom',
        factory: async () => {
          const { ContactFormModule } = await import('../modules/contact-form');
          const _contactService = await container.resolve('ContactService');
          return new ContactFormModule({
            backend: 'netlify' // Will use the ContactService configuration
          });
        },
        dependencies: ['ContactService']
      },
      {
        name: 'FooterModule',
        type: 'dom',
        factory: async () => {
          const { FooterModule } = await import('../modules/footer');
          return new FooterModule();
        }
      },
      {
        name: 'ClientLandingModule',
        type: 'dom',
        factory: async () => {
          // Only load client landing on client landing pages
          const currentPath = window.location.pathname;
          if (currentPath.includes('/client/landing')) {
            const { ClientLandingModule } = await import('../features/client/client-landing');
            return new ClientLandingModule();
          }
          // Return a dummy module for other pages
          return {
            init: async () => {},
            destroy: () => {},
            isInitialized: true,
            name: 'ClientLandingModule'
          };
        }
      },
      {
        name: 'ClientPortalModule',
        type: 'dom',
        factory: async () => {
          // Only load client portal on client portal pages
          const currentPath = window.location.pathname;
          if (currentPath.includes('/client') && currentPath.includes('/portal')) {
            const { ClientPortalModule } = await import('../features/client/client-portal');
            return new ClientPortalModule();
          }
          // Return a dummy module for other pages
          return {
            init: async () => {},
            destroy: () => {},
            isInitialized: true,
            name: 'ClientPortalModule'
          };
        }
      },
      {
        name: 'AdminDashboardModule',
        type: 'dom',
        factory: async () => {
          // Only load admin dashboard on admin pages
          const currentPath = window.location.pathname;
          if (currentPath.includes('/admin')) {
            const { AdminDashboard } = await import('../features/admin/admin-dashboard');
            const _adminDashboard = new AdminDashboard();
            return {
              init: async () => {
                /* AdminDashboard initializes itself */
              },
              destroy: () => {
                /* AdminDashboard handles its own cleanup */
              },
              isInitialized: true,
              name: 'AdminDashboardModule'
            };
          }
          // Return a dummy module for other pages
          return {
            init: async () => {},
            destroy: () => {},
            isInitialized: true,
            name: 'AdminDashboardModule'
          };
        }
      }
    ];

    // Register modules in container
    modules.forEach((module) => {
      container.register(module.name, module.factory, {
        singleton: true,
        dependencies: module.dependencies || []
      });
    });
  }

  /**
   * Initialize consent banner early (before other modules)
   * This ensures users see the banner immediately without waiting for app initialization
   */
  private async initConsentBanner(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const { createConsentBanner, ConsentBanner } = await import('../components');

      if (!ConsentBanner.hasExistingConsent()) {
        // Show consent banner immediately
        const _consentBanner = await createConsentBanner(
          {
            position: 'bottom',
            theme: 'light',
            showDetailsLink: true,
            autoHide: false,
            companyName: 'No Bhad Codes',
            onAccept: async () => {
              // Initialize visitor tracking when consent is given
              try {
                const trackingService = (await container.resolve('VisitorTrackingService')) as any;
                await trackingService.init();
              } catch (error) {
                console.error('[Application] Failed to initialize visitor tracking:', error);
              }
            },
            onDecline: () => {
              console.log('[Application] Visitor tracking declined');
            }
          },
          document.body
        );
      } else {
        // If consent already exists, we'll initialize tracking later in main init
        console.log(
          '[Application] Existing consent found, will initialize tracking after services'
        );
      }
    } catch (error) {
      console.error('[Application] Failed to initialize consent banner:', error);
    }
  }

  /**
   * Initialize application
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[Application] Already initialized');
      return;
    }

    console.log('[Application] Starting initialization...');

    try {
      // Initialize consent banner FIRST (non-blocking)
      // This ensures users see something immediately
      this.initConsentBanner(); // Don't await - let it load in parallel

      // Initialize core services first
      await this.initializeServices();

      // Initialize modules based on page type
      await this.initializeModules();

      // Initialize components from data attributes
      await ComponentRegistry.autoInit();

      // If consent was already accepted, initialize tracking now
      if (typeof window !== 'undefined') {
        const { ConsentBanner } = await import('../components');
        const consentStatus = ConsentBanner.getConsentStatus?.();
        if (consentStatus === 'accepted') {
          const trackingService = (await container.resolve(
            'VisitorTrackingService'
          )) as ServiceInstance;
          await trackingService.init?.();
        }
      }

      // Dashboards moved to admin.html page - no popups on main site

      this.isInitialized = true;
      console.log('[Application] Initialization complete');

      // Update global state
      appState.setState({ introAnimating: true });

      // Enable section card after intro completion
      setTimeout(() => {
        const sectionRenderer = this.getModule('SectionCardRenderer');
        if (
          sectionRenderer &&
          'enableAfterIntro' in sectionRenderer &&
          typeof sectionRenderer.enableAfterIntro === 'function'
        ) {
          sectionRenderer.enableAfterIntro();
        }

        // Setup sticky footer content visibility
        this.setupStickyFooter();
      }, 3000);
    } catch (error) {
      console.error('[Application] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize core services
   */
  private async initializeServices(): Promise<void> {
    const services: string[] = [
      'VisitorTrackingService',
      'PerformanceService',
      'BundleAnalyzerService',
      'RouterService',
      'DataService',
      'ContactService',
      'CodeProtectionService'
    ];

    for (const serviceName of services) {
      try {
        console.log(`[Application] Initializing ${serviceName}...`);
        const service = (await container.resolve(serviceName)) as ServiceInstance;
        await service.init?.();
        this.services.set(serviceName, service);
        console.log(`[Application] ${serviceName} initialized`);

        // After RouterService is initialized, register routes for home page sections
        if (serviceName === 'RouterService') {
          this.registerHomePageRoutes(service as any);
        }
      } catch (error) {
        console.error(`[Application] Failed to initialize ${serviceName}:`, error);
      }
    }
  }

  /**
   * Register routes for home page sections
   */
  private registerHomePageRoutes(routerService: any): void {
    // Register routes for home page sections
    routerService.addRoute({
      path: '#about',
      section: 'about',
      title: 'About - No Bhad Codes'
    });

    routerService.addRoute({
      path: '#contact',
      section: 'contact',
      title: 'Contact - No Bhad Codes'
    });

    routerService.addRoute({
      path: '/',
      section: 'intro',
      title: 'No Bhad Codes - Professional Web Development'
    });

    console.log('[Application] Home page routes registered');
  }

  /**
   * Initialize modules
   */
  private async initializeModules(): Promise<void> {
    // Re-enable client portal module for actual functionality
    const coreModules = ['ClientPortalModule'];

    for (const moduleName of coreModules) {
      try {
        console.log(`[Application] Initializing ${moduleName}...`);
        const moduleInstance = (await container.resolve(moduleName)) as any;
        await moduleInstance.init();
        this.modules.set(moduleName, moduleInstance);
        console.log(`[Application] ${moduleName} initialized`);
      } catch (error) {
        console.error(`[Application] Failed to initialize ${moduleName}:`, error);
      }
    }

    // Determine current page type
    const currentPath = window.location.pathname;
    const isClientPortal = currentPath.includes('/client') && currentPath.includes('/portal');
    const isAdminPage = currentPath.includes('/admin');
    const isHomePage = currentPath === '/' || currentPath === '/index.html';

    // Core modules for the main site
    const mainSiteModules = [
      'ThemeModule',
      'SectionCardRenderer', // Section business card renderer
      'SectionCardInteractions', // Section business card interactions
      'NavigationModule',
      'ContactFormModule',
      'ClientLandingModule' // Client landing page animations
    ];

    // Modules for Client Portal only
    const clientPortalModules = [
      'ThemeModule', // Theme still needed for dark mode toggle
      'ClientPortalModule'
    ];

    // Modules for Admin Dashboard only
    const adminModules = [
      'ThemeModule',
      'AdminDashboardModule'
    ];

    // Select appropriate modules based on page type
    let baseCoreModules: string[];
    if (isClientPortal) {
      baseCoreModules = clientPortalModules;
    } else if (isAdminPage) {
      baseCoreModules = adminModules;
    } else {
      baseCoreModules = mainSiteModules;
    }

    // Build final module list
    const coreModuleList = [...baseCoreModules];

    // Only add intro animation on index/home page
    if (isHomePage) {
      coreModuleList.splice(1, 0, 'IntroAnimationModule'); // Insert after ThemeModule
    }

    for (const moduleName of coreModuleList) {
      try {
        console.log(`[Application] Initializing ${moduleName}...`);
        const moduleInstance = (await container.resolve(moduleName)) as ModuleInstance;
        await moduleInstance.init?.();
        this.modules.set(moduleName, moduleInstance);
        console.log(`[Application] ${moduleName} initialized`);
      } catch (error) {
        console.error(`[Application] Failed to initialize ${moduleName}:`, error);
      }
    }
  }

  /**
   * Get module instance
   */
  getModule(name: string): ModuleInstance | undefined {
    return this.modules.get(name);
  }

  /**
   * Get service instance
   */
  getService(name: string): ServiceInstance | undefined {
    return this.services.get(name);
  }

  /**
   * Hot reload for development
   */
  async hotReload(): Promise<void> {
    console.log('[Application] Hot reloading...');

    // Destroy all modules
    for (const [_name, module] of this.modules) {
      if (module.destroy) {
        await module.destroy();
      }
    }

    // Clear containers
    this.modules.clear();
    this.services.clear();
    container.clear();

    // Reinitialize
    this.isInitialized = false;
    this.setupServices();
    this.setupModules();
    await this.init();
  }

  /**
   * Setup sticky footer content visibility
   */
  private setupStickyFooter(): void {
    const footer = document.querySelector('.footer') as HTMLElement;
    if (!footer) return;

    const checkScrollPosition = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Check if user has scrolled to bottom (with small threshold)
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 10;

      if (isAtBottom) {
        footer.classList.add('at-bottom');
      } else {
        footer.classList.remove('at-bottom');
      }
    };

    // Listen for scroll events
    window.addEventListener('scroll', checkScrollPosition, { passive: true });

    // Check initial position
    checkScrollPosition();
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      moduleCount: this.modules.size,
      serviceCount: this.services.size,
      state: appState.getState(),
      modules: Object.fromEntries(
        Array.from(this.modules.entries()).map(([name, module]) => [
          name,
          typeof module === 'object' &&
          module &&
          'getStatus' in module &&
          typeof module.getStatus === 'function'
            ? module.getStatus()
            : { loaded: true }
        ])
      ),
      services: Object.fromEntries(
        Array.from(this.services.entries()).map(([name, service]) => [
          name,
          typeof service === 'object' &&
          service &&
          'getStatus' in service &&
          typeof service.getStatus === 'function'
            ? service.getStatus()
            : { loaded: true }
        ])
      )
    };
  }
}

// Create and export global application instance
export const app = new Application();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.init();
  } catch (error) {
    console.error('[Application] Startup failed:', error);
  }
});

// Type definitions for window globals
declare global {
  interface Window {
    NBW_APP?: Application;
    NBW_STATE?: typeof appState;
    NBW_CONTAINER?: typeof container;
    NBW_DEBUG?: {
      app: Application;
      state: typeof appState;
      container: typeof container;
      components: typeof componentStore;
      getStatus(): unknown;
      getComponentStats(): unknown;
      getPerformanceReport(): Promise<unknown>;
      getBundleAnalysis(): Promise<unknown>;
      getVisitorData(): Promise<unknown>;
      hotReload(): Promise<void>;
      testBusinessCard(): void;
    };
  }
}

// Development helpers
if (typeof window !== 'undefined') {
  window.NBW_APP = app;
  window.NBW_STATE = appState;
  window.NBW_CONTAINER = container;
  window.NBW_DEBUG = {
    app,
    state: appState,
    container,
    components: componentStore,
    getStatus: () => app.getStatus(),
    getComponentStats: () => ComponentRegistry.getStats(),
    getPerformanceReport: async () => {
      const perfService = (await container.resolve('PerformanceService')) as ServiceInstance & {
        generateReport?: () => unknown;
      };
      return perfService.generateReport?.();
    },
    getBundleAnalysis: async () => {
      const bundleService = (await container.resolve(
        'BundleAnalyzerService'
      )) as ServiceInstance & { analyzeBundles?: () => Promise<unknown> };
      return bundleService.analyzeBundles?.();
    },
    getVisitorData: async () => {
      try {
        const trackingService = (await container.resolve(
          'VisitorTrackingService'
        )) as ServiceInstance & { exportData?: () => Promise<unknown> };
        return trackingService.exportData
          ? trackingService.exportData()
          : { error: 'Export method not available' };
      } catch (_error) {
        return { error: 'Visitor tracking not initialized or consented' };
      }
    },
    hotReload: () => app.hotReload(),
    testBusinessCard: () => {
      console.log('=== BUSINESS CARD DEBUG TEST ===');
      console.log('Overlay elements:', {
        overlayContainer: !!document.getElementById('overlay-business-card-container'),
        overlayCard: !!document.getElementById('overlay-business-card'),
        overlayInner: !!document.getElementById('overlay-business-card-inner')
      });
      console.log('Section elements:', {
        sectionCard: !!document.getElementById('business-card'),
        sectionInner: !!document.getElementById('business-card-inner'),
        sectionContainer: !!document.querySelector('.business-card-container')
      });

      const renderer = app.getModule('SectionCardRenderer');
      const interactions = app.getModule('SectionCardInteractions');

      console.log('SectionCardRenderer:', {
        exists: !!renderer,
        status:
          renderer &&
          typeof renderer === 'object' &&
          'getStatus' in renderer &&
          typeof renderer.getStatus === 'function'
            ? renderer.getStatus()
            : 'No status method'
      });
      console.log('SectionCardInteractions:', {
        exists: !!interactions,
        status:
          interactions &&
          typeof interactions === 'object' &&
          'getStatus' in interactions &&
          typeof interactions.getStatus === 'function'
            ? interactions.getStatus()
            : 'No status method'
      });

      if (
        renderer &&
        'getCardElements' in renderer &&
        typeof renderer.getCardElements === 'function'
      ) {
        console.log('Renderer elements:', renderer.getCardElements());
      }

      console.log(
        'All business card elements:',
        Array.from(
          document.querySelectorAll('[id*="business-card"], [class*="business-card"]')
        ).map((el) => ({
          tag: el.tagName,
          id: el.id,
          classes: el.className
        }))
      );

      // Test clicking on section card
      const sectionCard = document.getElementById('business-card');
      if (sectionCard) {
        console.log('Section card click listeners:', sectionCard.onclick);
        console.log('Section card style:', {
          cursor: sectionCard.style.cursor,
          pointerEvents: sectionCard.style.pointerEvents
        });
      }
    }
  };
}
