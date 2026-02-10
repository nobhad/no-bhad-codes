/**
 * ===============================================
 * APPLICATION CONTROLLER
 * ===============================================
 * @file src/core/app.ts
 *
 * Main application controller using dependency injection,
 * state management, and lazy loading.
 */

import { container } from './container';
import { appState } from './state';
import { ComponentRegistry, createConsentBanner, ConsentBanner } from '../components';
import { registerServices } from './services-config';
import {
  registerModules,
  getMainSiteModules,
  getClientPortalModules,
  getClientIntakeModules,
  getAdminModules
} from './modules-config';
import { setupDebugHelpers } from './debug';
import { isDev } from './env';
import { APP_CONSTANTS } from '../config/constants';

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

export class Application {
  private modules = new Map<string, ModuleInstance>();
  private services = new Map<string, ServiceInstance>();
  private isInitialized = false;
  private debug = isDev();

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[Application]', ...args);
    }
  }

  constructor() {
    registerServices();
    registerModules(this.debug);
  }

  /**
   * Initialize application
   */
  async init(): Promise<void> {
    // Enforce HTTPS in production
    if (this.shouldEnforceHttps()) {
      this.redirectToHttps();
      return;
    }

    if (this.isInitialized) {
      console.warn('[Application] Already initialized');
      return;
    }

    this.log('Starting initialization...');

    try {
      // Initialize consent banner FIRST (non-blocking)
      this.initConsentBanner();

      // Initialize core services first
      await this.initializeServices();

      // Initialize modules based on page type
      await this.initializeModules();

      // Initialize components from data attributes
      await ComponentRegistry.autoInit();

      // Initialize visitor tracking (config has cookieConsent: false, so no consent needed)
      if (typeof window !== 'undefined') {
        try {
          const trackingService = (await container.resolve('VisitorTrackingService')) as ServiceInstance;
          await trackingService.init?.();
        } catch (error) {
          console.error('[Application] Failed to initialize visitor tracking:', error);
        }
      }

      this.isInitialized = true;
      this.log('Initialization complete');

      // Update global state
      appState.setState({ introAnimating: true });

      // Enable section card after intro completion - ONLY if on intro page
      setTimeout(() => {
        const hash = window.location.hash;
        const isIntroPage = !hash || hash === '#/' || hash === '#' || hash === '#/intro';

        if (isIntroPage) {
          const sectionRenderer = this.getModule('SectionCardRenderer');
          if (
            sectionRenderer &&
            'enableAfterIntro' in sectionRenderer &&
            typeof sectionRenderer.enableAfterIntro === 'function'
          ) {
            sectionRenderer.enableAfterIntro();
          }
        }

        this.setupStickyFooter();
      }, APP_CONSTANTS.TIMERS.INTRO_COMPLETE_WAIT);
    } catch (error) {
      console.error('[Application] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize consent banner AFTER intro animation completes
   */
  private async initConsentBanner(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (!ConsentBanner.hasExistingConsent()) {
        const currentPath = window.location.pathname;
        const isHomePage = currentPath === '/' || currentPath === '/index.html';

        if (isHomePage) {
          await this.waitForIntroComplete();
        }

        let consentWrapper = document.getElementById('consent-banner-wrapper');
        if (!consentWrapper) {
          consentWrapper = document.createElement('div');
          consentWrapper.id = 'consent-banner-wrapper';
          document.body.appendChild(consentWrapper);
        }

        await createConsentBanner(
          {
            position: 'bottom',
            theme: 'light',
            showDetailsLink: true,
            autoHide: false,
            companyName: 'No Bhad Codes',
            onAccept: async () => {
              try {
                const trackingService = (await container.resolve('VisitorTrackingService')) as ServiceInstance;
                await trackingService.init?.();
              } catch (error) {
                console.error('[Application] Failed to initialize visitor tracking:', error);
              }
            },
            onDecline: () => {
              this.log('Visitor tracking declined');
            }
          },
          consentWrapper
        );
      } else {
        this.log('Existing consent found, will initialize tracking after services');
      }
    } catch (error) {
      console.error('[Application] Failed to initialize consent banner:', error);
    }
  }

  /**
   * Wait for intro animation to fully complete
   */
  private waitForIntroComplete(): Promise<void> {
    return new Promise((resolve) => {
      const html = document.documentElement;

      if (html.classList.contains('intro-finished')) {
        setTimeout(resolve, APP_CONSTANTS.TIMERS.INTRO_FINISHED_DELAY);
        return;
      }

      if (!html.classList.contains('intro-loading')) {
        setTimeout(resolve, APP_CONSTANTS.TIMERS.INTRO_MAX_WAIT);
        return;
      }

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            if (html.classList.contains('intro-finished')) {
              observer.disconnect();
              setTimeout(resolve, APP_CONSTANTS.TIMERS.INTRO_FINISHED_DELAY);
              return;
            }
          }
        }
      });

      observer.observe(html, { attributes: true });

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, APP_CONSTANTS.TIMERS.INTRO_OBSERVER_TIMEOUT);
    });
  }

  /**
   * Initialize core services
   */
  private async initializeServices(): Promise<void> {
    const currentPath = window.location.pathname;
    const isClientPage = currentPath.includes('/client/');
    const isAdminPage = currentPath.includes('/admin');

    const services: string[] = [
      'VisitorTrackingService',
      'PerformanceService',
      'BundleAnalyzerService',
      'RouterService'
    ];

    if (!isClientPage && !isAdminPage) {
      services.push('DataService');
      services.push('ContactService');
    }

    const { isProtectionEnabled } = await import('../config/protection.config');
    if (isProtectionEnabled()) {
      services.push('CodeProtectionService');
    } else {
      this.log('CodeProtectionService skipped (protection disabled)');
    }

    for (const serviceName of services) {
      try {
        this.log(`Initializing ${serviceName}...`);
        const service = (await container.resolve(serviceName)) as ServiceInstance;
        await service.init?.();
        this.services.set(serviceName, service);
        this.log(`${serviceName} initialized`);

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
   * Uses hash routing: #/, #/about, #/contact
   */
  private registerHomePageRoutes(routerService: { addRoute: (route: { path: string; section: string; title: string }) => void }): void {
    // Hash routes
    routerService.addRoute({ path: '#/', section: 'intro', title: 'No Bhad Codes - Professional Web Development' });
    routerService.addRoute({ path: '#/about', section: 'about', title: 'About - No Bhad Codes' });
    routerService.addRoute({ path: '#/contact', section: 'contact', title: 'Contact - No Bhad Codes' });
    // Root path
    routerService.addRoute({ path: '/', section: 'intro', title: 'No Bhad Codes - Professional Web Development' });
    this.log('Home page routes registered');
  }

  /**
   * Initialize modules
   */
  private async initializeModules(): Promise<void> {
    const currentPath = window.location.pathname;
    const isClientPortal = currentPath.startsWith('/client') && !currentPath.includes('/client/intake');
    const isClientIntake = currentPath.includes('/client/intake');
    const isAdminPage = currentPath.includes('/admin');
    const isHomePage = currentPath === '/' || currentPath === '/index.html';

    let baseCoreModules: string[];
    if (isClientPortal) {
      // All /client/* pages use portal modules (including set-password, login, etc.)
      baseCoreModules = getClientPortalModules();
    } else if (isClientIntake) {
      baseCoreModules = getClientIntakeModules();
    } else if (isAdminPage) {
      baseCoreModules = getAdminModules();
    } else {
      baseCoreModules = getMainSiteModules();
    }

    const coreModuleList = [...baseCoreModules];

    if (isHomePage) {
      coreModuleList.splice(1, 0, 'IntroAnimationModule');
    }

    for (const moduleName of coreModuleList) {
      try {
        this.log(`Initializing ${moduleName}...`);
        const moduleInstance = (await container.resolve(moduleName)) as ModuleInstance;
        await moduleInstance.init?.();
        this.modules.set(moduleName, moduleInstance);
        this.log(`${moduleName} initialized`);
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
    this.log('Hot reloading...');

    for (const [_name, module] of this.modules) {
      if (module.destroy) {
        await module.destroy();
      }
    }

    this.modules.clear();
    this.services.clear();
    container.clear();

    this.isInitialized = false;
    registerServices();
    registerModules(this.debug);
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
      const isAtBottom = scrollTop + windowHeight >= documentHeight - 10;

      if (isAtBottom) {
        footer.classList.add('at-bottom');
      } else {
        footer.classList.remove('at-bottom');
      }
    };

    window.addEventListener('scroll', checkScrollPosition, { passive: true });
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
          typeof module === 'object' && module && 'getStatus' in module && typeof module.getStatus === 'function'
            ? module.getStatus()
            : { loaded: true }
        ])
      ),
      services: Object.fromEntries(
        Array.from(this.services.entries()).map(([name, service]) => [
          name,
          typeof service === 'object' && service && 'getStatus' in service && typeof service.getStatus === 'function'
            ? service.getStatus()
            : { loaded: true }
        ])
      )
    };
  }

  /**
   * Check if HTTPS should be enforced
   */
  private shouldEnforceHttps(): boolean {
    if (typeof window === 'undefined') return false;

    const { protocol, hostname } = window.location;
    const isDevelopment =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local');

    if (isDevelopment) return false;
    return protocol === 'http:';
  }

  /**
   * Redirect to HTTPS version of current URL
   */
  private redirectToHttps(): void {
    const { href } = window.location;
    const httpsUrl = href.replace(/^http:/, 'https:');
    this.log('Redirecting to HTTPS:', httpsUrl);
    window.location.replace(httpsUrl);
  }
}

// Create and export global application instance
export const app = new Application();

// Save scroll position before page unload
window.addEventListener('beforeunload', () => {
  const scrollContainer = document.querySelector('main');
  const scrollPos = scrollContainer ? scrollContainer.scrollTop : window.scrollY;
  sessionStorage.setItem('scrollPosition', String(scrollPos));
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.init();

    // Restore scroll position after init
    const savedPos = sessionStorage.getItem('scrollPosition');
    sessionStorage.removeItem('scrollPosition');
    if (savedPos) {
      const scrollContainer = document.querySelector('main');
      const pos = parseInt(savedPos, 10);
      const minValidPos = 50;
      if (pos > minValidPos) {
        requestAnimationFrame(() => {
          if (scrollContainer) {
            scrollContainer.scrollTop = pos;
          } else {
            window.scrollTo(0, pos);
          }
        });
      }
    }
  } catch (error) {
    console.error('[Application] Startup failed:', error);
  }
});

// Setup development helpers
if (typeof window !== 'undefined') {
  setupDebugHelpers(app);
}
