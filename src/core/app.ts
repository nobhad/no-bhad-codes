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

// CSS imports moved to main.ts entry point

export class Application {
  private modules = new Map<string, any>();
  private services = new Map<string, any>();
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
    container.register('RouterService', async () => {
      const { RouterService } = await import('../services/router-service');
      return new RouterService({
        defaultRoute: '/',
        smoothScrolling: true,
        scrollOffset: 80,
        transitionDuration: 600
      });
    }, { singleton: true });

    // Register data service
    container.register('DataService', async () => {
      const { DataService } = await import('../services/data-service');
      return new DataService();
    }, { singleton: true });

    // Register contact service
    container.register('ContactService', async () => {
      const { ContactService } = await import('../services/contact-service');
      return new ContactService({
        backend: 'netlify' // Can be configured based on environment
      });
    }, { singleton: true });

    // Register performance service
    container.register('PerformanceService', async () => {
      const { PerformanceService } = await import('../services/performance-service');
      return new PerformanceService({
        lcp: 2500,
        fid: 100,
        cls: 0.1,
        bundleSize: 600 * 1024,
        ttfb: 200
      });
    }, { singleton: true });

    // Register bundle analyzer service
    container.register('BundleAnalyzerService', async () => {
      const { BundleAnalyzerService } = await import('../services/bundle-analyzer');
      return new BundleAnalyzerService();
    }, { singleton: true });

    // Register visitor tracking service
    container.register('VisitorTrackingService', async () => {
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
    }, { singleton: true });

    // Register code protection service (uses config)
    container.register('CodeProtectionService', async () => {
      const { CodeProtectionService } = await import('../services/code-protection-service');
      const { getProtectionConfig } = await import('../config/protection.config');
      return new CodeProtectionService(getProtectionConfig());
    }, { singleton: true });
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
          const { BusinessCardInteractions } = await import('../modules/business-card-interactions');
          const renderer = await container.resolve('SectionCardRenderer') as any;
          return new BusinessCardInteractions(renderer);
        },
        dependencies: ['SectionCardRenderer']
      },
      {
        name: 'NavigationModule',
        type: 'dom',
        factory: async () => {
          const { NavigationModule } = await import('../modules/navigation');
          const routerService = await container.resolve('RouterService') as any;
          const dataService = await container.resolve('DataService') as any;
          return new NavigationModule({
            debug: this.debug,
            routerService,
            dataService
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
            const adminDashboard = new AdminDashboard();
            return {
              init: async () => { /* AdminDashboard initializes itself */ },
              destroy: () => { /* AdminDashboard handles its own cleanup */ },
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
    modules.forEach(module => {
      container.register(module.name, module.factory, {
        singleton: true,
        dependencies: module.dependencies || []
      });
    });
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
      // Initialize core services first
      await this.initializeServices();

      // Initialize modules based on page type
      await this.initializeModules();

      // Initialize components from data attributes
      await ComponentRegistry.autoInit();

      // Initialize consent banner (always show if no consent exists)
      if (typeof window !== 'undefined') {
        const { createConsentBanner, ConsentBanner } = await import('../components');

        if (!ConsentBanner.hasExistingConsent()) {
          const _consentBanner = await createConsentBanner({
            position: 'bottom',
            theme: 'light',
            showDetailsLink: true,
            autoHide: false,
            companyName: 'No Bhad Codes',
            onAccept: async () => {
              // Initialize visitor tracking when consent is given
              const trackingService = await container.resolve('VisitorTrackingService') as any;
              await trackingService.init();
            },
            onDecline: () => {
              console.log('[Application] Visitor tracking declined');
            }
          }, document.body);
        } else {
          // If consent already exists, initialize tracking
          const consentStatus = ConsentBanner.getConsentStatus();
          if (consentStatus === 'accepted') {
            const trackingService = await container.resolve('VisitorTrackingService') as any;
            await trackingService.init();
          }
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
        if (sectionRenderer) {
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
    const services: string[] = ['VisitorTrackingService', 'PerformanceService', 'BundleAnalyzerService', 'RouterService', 'DataService', 'ContactService', 'CodeProtectionService'];

    for (const serviceName of services) {
      try {
        console.log(`[Application] Initializing ${serviceName}...`);
        const service = await container.resolve(serviceName) as any;
        await service.init();
        this.services.set(serviceName, service);
        console.log(`[Application] ${serviceName} initialized`);
      } catch (error) {
        console.error(`[Application] Failed to initialize ${serviceName}:`, error);
      }
    }
  }

  /**
   * Initialize modules
   */
  private async initializeModules(): Promise<void> {
    // Core modules that always load
    const baseCoreModules = [
      'ThemeModule',
      'SectionCardRenderer', // Section business card renderer
      'SectionCardInteractions', // Section business card interactions
      'NavigationModule',
      'ContactFormModule',
      'ClientLandingModule', // Client landing page animations
      'ClientPortalModule', // Client portal functionality
      'AdminDashboardModule' // Admin dashboard functionality
    ];

    // Only add intro animation on index/home page
    const coreModules = [...baseCoreModules];
    const currentPath = window.location.pathname;
    if (currentPath === '/' || currentPath === '/index.html') {
      coreModules.splice(1, 0, 'IntroAnimationModule'); // Insert after ThemeModule
    }

    for (const moduleName of coreModules) {
      try {
        console.log(`[Application] Initializing ${moduleName}...`);
        const moduleInstance = await container.resolve(moduleName) as any;
        await moduleInstance.init();
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
  getModule(name: string): any {
    return this.modules.get(name);
  }

  /**
   * Get service instance
   */
  getService(name: string): any {
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
          module.getStatus ? module.getStatus() : { loaded: true }
        ])
      ),
      services: Object.fromEntries(
        Array.from(this.services.entries()).map(([name, service]) => [
          name,
          service.getStatus ? service.getStatus() : { loaded: true }
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

// Development helpers
if (typeof window !== 'undefined') {
  (window as any).NBW_APP = app;
  (window as any).NBW_STATE = appState;
  (window as any).NBW_CONTAINER = container;
  (window as any).NBW_DEBUG = {
    app,
    state: appState,
    container,
    components: componentStore,
    getStatus: () => app.getStatus(),
    getComponentStats: () => ComponentRegistry.getStats(),
    getPerformanceReport: async () => {
      const perfService = await container.resolve('PerformanceService') as any;
      return perfService.generateReport();
    },
    getBundleAnalysis: async () => {
      const bundleService = await container.resolve('BundleAnalyzerService') as any;
      return bundleService.analyzeBundles();
    },
    getVisitorData: async () => {
      try {
        const trackingService = await container.resolve('VisitorTrackingService') as any;
        return trackingService.exportData();
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
        status: renderer?.getStatus?.() || 'No status method'
      });
      console.log('SectionCardInteractions:', {
        exists: !!interactions,
        status: interactions?.getStatus?.() || 'No status method'
      });

      if (renderer) {
        console.log('Renderer elements:', renderer.getCardElements());
      }

      console.log('All business card elements:', Array.from(document.querySelectorAll('[id*="business-card"], [class*="business-card"]')).map(el => ({
        tag: el.tagName,
        id: el.id,
        classes: el.className
      })));

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