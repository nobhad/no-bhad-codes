/**
 * ===============================================
 * MODULE CONFIGURATION
 * ===============================================
 * @file src/core/modules-config.ts
 *
 * Defines and registers all application modules.
 * Modules are lazy-loaded based on page context.
 */

import { container } from './container';
import type { ModuleDefinition } from '../types/modules';

/**
 * Register all application modules with the DI container
 * @param debug - Whether to enable debug mode for modules
 */
export function registerModules(debug: boolean = false): void {
  const modules: ModuleDefinition[] = [
    {
      name: 'ThemeModule',
      type: 'dom',
      factory: async () => {
        const { ThemeModule } = await import('../modules/utilities/theme');
        return new ThemeModule({ debug });
      }
    },
    {
      name: 'IntroAnimationModule',
      type: 'dom',
      factory: async () => {
        // Only load intro animation on index/home page
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
          // Use separate modules for mobile and desktop
          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (isMobile) {
            const { MobileIntroAnimationModule } = await import('../modules/animation/intro-animation-mobile');
            return new MobileIntroAnimationModule();
          }
          const { IntroAnimationModule } = await import('../modules/animation/intro-animation');
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
        const { BusinessCardRenderer } = await import('../modules/ui/business-card-renderer');
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
        const { BusinessCardInteractions } =
          await import('../modules/ui/business-card-interactions');
        const renderer = await container.resolve('SectionCardRenderer');
        return new BusinessCardInteractions(renderer as any);
      },
      dependencies: ['SectionCardRenderer']
    },
    {
      name: 'ContactCardRenderer',
      type: 'dom',
      factory: async () => {
        const { BusinessCardRenderer } = await import('../modules/ui/business-card-renderer');
        return new BusinessCardRenderer({
          businessCardId: 'contact-business-card',
          businessCardInnerId: 'contact-business-card-inner',
          frontSelector: '#contact-business-card .business-card-front',
          backSelector: '#contact-business-card .business-card-back',
          containerSelector: '#contact-card-container'
        });
      }
    },
    {
      name: 'ContactCardInteractions',
      type: 'dom',
      factory: async () => {
        const { BusinessCardInteractions } =
          await import('../modules/ui/business-card-interactions');
        const renderer = await container.resolve('ContactCardRenderer');
        return new BusinessCardInteractions(renderer as any);
      },
      dependencies: ['ContactCardRenderer']
    },
    {
      name: 'NavigationModule',
      type: 'dom',
      factory: async () => {
        const { NavigationModule } = await import('../modules/ui/navigation');
        const routerService = await container.resolve('RouterService');
        const dataService = await container.resolve('DataService');
        return new NavigationModule({
          debug,
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
        const { ContactFormModule } = await import('../modules/ui/contact-form');
        const _contactService = await container.resolve('ContactService');
        // Always use custom backend - Vercel proxies /api/* to Railway
        return new ContactFormModule({
          backend: 'custom',
          endpoint: '/api/contact'
        });
      },
      dependencies: ['ContactService']
    },
    {
      name: 'FooterModule',
      type: 'dom',
      factory: async () => {
        const { FooterModule } = await import('../modules/ui/footer');
        return new FooterModule();
      }
    },
    {
      name: 'ScrollSnapModule',
      type: 'dom',
      factory: async () => {
        // Load scroll snap on all pages EXCEPT client portal and desktop home (uses virtual pages)
        const currentPath = window.location.pathname;
        const isClientPortal = currentPath.includes('/client');
        const isHomePage = currentPath === '/' || currentPath === '/index.html';
        const isDesktop = window.matchMedia('(min-width: 768px)').matches;

        // Desktop home page uses virtual pages instead of scroll snap
        if (isClientPortal || (isHomePage && isDesktop)) {
          return {
            init: async () => {},
            destroy: () => {},
            isInitialized: true,
            name: 'ScrollSnapModule'
          };
        }

        const { ScrollSnapModule } = await import('../modules/animation/scroll-snap');
        return new ScrollSnapModule({
          containerSelector: 'main',
          sectionSelector: '.business-card-section, .hero-section, .about-section, .contact-section, .page-section, main > section',
          snapDuration: 0.6,
          snapDelay: 150
        });
      }
    },
    {
      name: 'TextAnimationModule',
      type: 'dom',
      factory: async () => {
        // Only load text animation on index/home page
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
          const { TextAnimationModule } = await import('../modules/animation/text-animation');
          return new TextAnimationModule();
        }
        // Return a dummy module for other pages
        return {
          init: async () => {},
          destroy: () => {},
          isInitialized: true,
          name: 'TextAnimationModule'
        };
      }
    },
    {
      name: 'ContactAnimationModule',
      type: 'dom',
      factory: async () => {
        // Only load contact animation on index/home page
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
          const { ContactAnimationModule } = await import('../modules/animation/contact-animation');
          return new ContactAnimationModule();
        }
        // Return a dummy module for other pages
        return {
          init: async () => {},
          destroy: () => {},
          isInitialized: true,
          name: 'ContactAnimationModule'
        };
      }
    },
    {
      name: 'PageTransitionModule',
      type: 'dom',
      factory: async () => {
        // Load page transitions on index/home page (mobile + desktop)
        const currentPath = window.location.pathname;
        const isHomePage = currentPath === '/' || currentPath === '/index.html';

        if (isHomePage) {
          const { PageTransitionModule } = await import('../modules/animation/page-transition');
          return new PageTransitionModule({ debug, enableOnMobile: true });
        }
        // Return a dummy module for other pages
        return {
          init: async () => {},
          destroy: () => {},
          isInitialized: true,
          name: 'PageTransitionModule'
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
    },
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
 * Get module list for main site (home page)
 */
export function getMainSiteModules(): string[] {
  return [
    'ThemeModule',
    'SectionCardRenderer',
    'SectionCardInteractions',
    'ContactCardRenderer',
    // ContactCardInteractions removed - flip controlled by ContactAnimationModule
    'NavigationModule',
    'ContactFormModule',
    'ScrollSnapModule', // Disabled on desktop home - virtual pages instead
    'TextAnimationModule',
    'ContactAnimationModule',
    'PageTransitionModule' // Virtual pages for all screen sizes
  ];
}

/**
 * Get module list for client portal
 */
export function getClientPortalModules(): string[] {
  return ['ThemeModule', 'ClientPortalModule'];
}

/**
 * Get module list for client intake
 */
export function getClientIntakeModules(): string[] {
  return ['ThemeModule', 'NavigationModule', 'FooterModule'];
}

/**
 * Get module list for admin pages
 */
export function getAdminModules(): string[] {
  return ['ThemeModule', 'AdminDashboardModule'];
}
