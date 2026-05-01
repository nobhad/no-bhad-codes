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
import type { BusinessCardRenderer } from '../modules/ui/business-card-renderer';
import type { RouterService } from '../services/router-service';
import type { DataService } from '../services/data-service';

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
            const { MobileIntroAnimationModule } =
              await import('../modules/animation/intro-animation-mobile');
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
        const renderer = await container.resolve<BusinessCardRenderer>('SectionCardRenderer');
        return new BusinessCardInteractions(renderer);
      },
      dependencies: ['SectionCardRenderer']
    },
    {
      name: 'NavigationModule',
      type: 'dom',
      factory: async () => {
        const { NavigationModule } = await import('../modules/ui/navigation');
        const routerService = await container.resolve<RouterService>('RouterService');
        // DataService may not be available on client/admin pages - handle gracefully
        let dataService: DataService | null = null;
        try {
          dataService = await container.resolve<DataService>('DataService');
          if (dataService && typeof dataService.init === 'function') {
            await dataService.init();
          }
        } catch {
          // DataService not available on this page, NavigationModule will use fallbacks
        }
        return new NavigationModule({
          debug,
          routerService,
          dataService: dataService ?? undefined
        });
      },
      dependencies: ['RouterService']
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
      name: 'ProjectsModule',
      type: 'dom',
      factory: async () => {
        // Only load projects module on index/home page
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
          const { ProjectsModule } = await import('../modules/ui/projects');
          return new ProjectsModule();
        }
        // Return a dummy module for other pages
        return {
          init: async () => {},
          destroy: () => {},
          isInitialized: true,
          name: 'ProjectsModule'
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
      name: 'ReactPortalModule',
      type: 'dom',
      factory: async () => {
        // Mount the React SPA for admin and client portal pages
        const currentPath = window.location.pathname;
        const pageType = document.body.getAttribute('data-page') || '';
        const isPortalPage =
          currentPath.includes('/admin') ||
          (currentPath === '/dashboard' && (pageType === 'admin' || pageType === 'client')) ||
          (currentPath.startsWith('/client') && !currentPath.includes('/client/intake'));

        if (isPortalPage) {
          let cleanup: (() => void) | null = null;

          return {
            init: async () => {
              const { mountPortalApp } = await import('../react/app/mount-portal');
              // Hide EJS elements outside the React-managed container
              // (site header, mobile nav) — React renders its own shell.
              const siteHeader = document.querySelector('body > header.header') as HTMLElement;
              const mobileNav = document.querySelector('body > nav.nav') as HTMLElement;
              const siteFooter = document.querySelector('body > footer, body > .footer') as HTMLElement;
              if (siteHeader) siteHeader.style.display = 'none';
              if (mobileNav) mobileNav.style.display = 'none';
              if (siteFooter) siteFooter.style.display = 'none';

              // Mount React directly into the existing EJS container.
              // mountPortalApp uses flushSync so React paints in the same
              // frame as clearing — no visual flash.
              const dashboardContainer =
                document.querySelector('.portal') as HTMLElement;
              if (dashboardContainer) {
                cleanup = mountPortalApp(dashboardContainer);
              }
            },
            destroy: () => {
              cleanup?.();
              cleanup = null;
              // Restore EJS elements if React is unmounted
              const siteHeader = document.querySelector('body > header.header') as HTMLElement;
              const mobileNav = document.querySelector('body > nav.nav') as HTMLElement;
              const siteFooter = document.querySelector('body > footer, body > .footer') as HTMLElement;
              if (siteHeader) siteHeader.style.display = '';
              if (mobileNav) mobileNav.style.display = '';
              if (siteFooter) siteFooter.style.display = '';
            },
            isInitialized: true,
            name: 'ReactPortalModule'
          };
        }

        return {
          init: async () => {},
          destroy: () => {},
          isInitialized: true,
          name: 'ReactPortalModule'
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
 * Get module list for main site (home page)
 */
export function getMainSiteModules(): string[] {
  return [
    'ThemeModule',
    'SectionCardRenderer',
    'SectionCardInteractions',
    'NavigationModule',
    'ContactFormModule',
    'TextAnimationModule',
    'ContactAnimationModule',
    'PageTransitionModule',
    'ProjectsModule'
  ];
}

/**
 * Get module list for React SPA portal (admin + client)
 */
export function getReactPortalModules(): string[] {
  return ['ThemeModule', 'ReactPortalModule'];
}

/**
 * Get module list for client intake
 */
export function getClientIntakeModules(): string[] {
  return ['ThemeModule', 'NavigationModule', 'FooterModule'];
}

