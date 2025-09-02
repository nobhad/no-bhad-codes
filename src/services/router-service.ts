/**
 * ===============================================
 * ROUTER SERVICE
 * ===============================================
 * @file src/services/router-service.ts
 *
 * Client-side routing service for SPA navigation without full page reloads.
 * Supports hash-based routing with smooth transitions.
 */

import { BaseService } from './base-service';

export interface Route {
  path: string;
  section: string;
  title?: string;
  beforeEnter?: () => boolean | Promise<boolean>;
  onEnter?: () => void | Promise<void>;
  onLeave?: () => void | Promise<void>;
}

export interface RouterConfig {
  defaultRoute: string;
  smoothScrolling: boolean;
  scrollOffset: number;
  transitionDuration: number;
}

export class RouterService extends BaseService {
  private routes = new Map<string, Route>();
  private currentRoute: string = '';
  private isNavigating: boolean = false;
  private config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    super('RouterService');

    this.config = {
      defaultRoute: '/',
      smoothScrolling: true,
      scrollOffset: 80, // Header height offset
      transitionDuration: 600,
      ...config
    };

    // Bind methods
    this.handlePopState = this.handlePopState.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // Setup default routes
    this.setupDefaultRoutes();

    this.setupEventListeners();
    this.log('Router service initialized');

    // Handle initial route
    await this.handleInitialRoute();
  }

  /**
   * Setup default routes for the application
   */
  private setupDefaultRoutes(): void {
    // Register default routes - match actual HTML sections
    this.routes.set('/', {
      path: '/',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    this.routes.set('#intro', {
      path: '#intro',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    this.routes.set('#home', {
      path: '#home',
      section: 'intro', // Redirect home to intro
      title: 'No Bhad Codes'
    });

    this.routes.set('#about', {
      path: '#about',
      section: 'about',
      title: 'About - No Bhad Codes'
    });

    this.routes.set('#contact', {
      path: '#contact',
      section: 'contact',
      title: 'Contact - No Bhad Codes'
    });

    this.log('Default routes registered');
  }

  /**
   * Setup browser event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('hashchange', this.handleHashChange);

    // Disabled global link interception - let browser handle navigation normally
    // document.addEventListener('click', (e) => {
    //   const link = (e.target as HTMLElement)?.closest('a[href^="#"], a[href^="/"]');
    //   if (link && !link.hasAttribute('data-external')) {
    //     e.preventDefault();
    //     const href = link.getAttribute('href');
    //     if (href) {
    //       this.navigate(href);
    //     }
    //   }
    // });
  }

  /**
   * Register a route
   */
  addRoute(route: Route): void {
    this.routes.set(route.path, route);
    this.log(`Route registered: ${route.path} -> ${route.section}`);
  }

  /**
   * Register multiple routes
   */
  addRoutes(routes: Route[]): void {
    routes.forEach(route => this.addRoute(route));
  }

  /**
   * Navigate to a route
   */
  async navigate(path: string, options: { replace?: boolean; smooth?: boolean } = {}): Promise<void> {
    if (this.isNavigating || path === this.currentRoute) {
      return;
    }

    this.isNavigating = true;

    try {
      this.log(`Navigating to: ${path}`);

      // Update browser history
      if (options.replace) {
        window.history.replaceState({ path }, '', path);
      } else {
        window.history.pushState({ path }, '', path);
      }

      // Perform navigation
      await this.performNavigation(path, options);

    } catch (error) {
      this.error('Navigation failed:', error);
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Navigate to a section (scroll-based)
   */
  async navigateToSection(sectionId: string, options: { smooth?: boolean } = {}): Promise<void> {
    // Try multiple selector strategies to find the section
    const section =
      document.getElementById(sectionId) ||
      document.querySelector(`.${sectionId}-section`) ||
      document.querySelector(`section.${sectionId}-section`) ||
      document.querySelector(`[data-section="${sectionId}"]`);

    if (!section) {
      this.warn(`Section not found: ${sectionId}`);
      return;
    }

    const shouldSmooth = options.smooth ?? this.config.smoothScrolling;

    if (shouldSmooth) {
      await this.smoothScrollToSection(section);
    } else {
      this.scrollToSection(section);
    }

    // Update current route
    this.currentRoute = `#${sectionId}`;

    // Dispatch navigation event
    this.dispatchNavigationEvent('section-change', { sectionId, section });
  }

  /**
   * Handle browser back/forward navigation
   */
  private async handlePopState(event: PopStateEvent): Promise<void> {
    const path = event.state?.path || window.location.pathname + window.location.hash;
    await this.performNavigation(path, { fromPopState: true });
  }

  /**
   * Handle hash changes
   */
  private async handleHashChange(): Promise<void> {
    const hash = window.location.hash;
    if (hash) {
      await this.navigateToSection(hash.substring(1));
    }
  }

  /**
   * Handle initial route on page load
   */
  private async handleInitialRoute(): Promise<void> {
    const path = window.location.pathname + window.location.hash;
    const route = path || this.config.defaultRoute;

    await this.performNavigation(route, { initial: true });
  }

  /**
   * Perform the actual navigation
   */
  private async performNavigation(path: string, options: any = {}): Promise<void> {
    const route = this.findRoute(path);

    if (!route) {
      this.warn(`Route not found: ${path}`);
      return;
    }

    // Call beforeEnter guard
    if (route.beforeEnter) {
      const canEnter = await route.beforeEnter();
      if (!canEnter) {
        this.log(`Navigation blocked by beforeEnter guard: ${path}`);
        return;
      }
    }

    // Call current route's onLeave if exists
    const currentRoute = this.routes.get(this.currentRoute);
    if (currentRoute?.onLeave && !options.initial) {
      await currentRoute.onLeave();
    }

    // Update current route
    this.currentRoute = path;

    // Navigate to section
    if (route.section) {
      await this.navigateToSection(route.section, options);
    }

    // Update document title
    if (route.title) {
      document.title = route.title;
    }

    // Call route's onEnter
    if (route.onEnter) {
      await route.onEnter();
    }

    // Dispatch navigation complete event
    this.dispatchNavigationEvent('navigation-complete', {
      path,
      route,
      fromPopState: options.fromPopState,
      initial: options.initial
    });
  }

  /**
   * Find route by path
   */
  private findRoute(path: string): Route | null {
    // Direct match
    if (this.routes.has(path)) {
      return this.routes.get(path)!;
    }

    // Hash-based match
    if (path.startsWith('#')) {
      const sectionId = path.substring(1);
      for (const route of this.routes.values()) {
        if (route.section === sectionId) {
          return route;
        }
      }
    }

    // Default route fallback
    return this.routes.get(this.config.defaultRoute) || null;
  }

  /**
   * Smooth scroll to section
   */
  private async smoothScrollToSection(section: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const targetY = section.offsetTop - this.config.scrollOffset;
      const startY = window.pageYOffset;
      const distance = targetY - startY;
      const duration = this.config.transitionDuration;
      let start: number;

      const step = (timestamp: number) => {
        if (!start) start = timestamp;

        const progress = Math.min((timestamp - start) / duration, 1);
        const easeInOutCubic = progress < 0.5
          ? 4 * progress * progress * progress
          : (progress - 1) * (2 * progress - 2) * (2 * progress - 2) + 1;

        window.scrollTo(0, startY + distance * easeInOutCubic);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }

  /**
   * Instant scroll to section
   */
  private scrollToSection(section: HTMLElement): void {
    const targetY = section.offsetTop - this.config.scrollOffset;
    window.scrollTo(0, targetY);
  }

  /**
   * Dispatch navigation events
   */
  private dispatchNavigationEvent(eventName: string, detail: any): void {
    const event = new CustomEvent(`router:${eventName}`, { detail });
    document.dispatchEvent(event);
    this.log(`Event dispatched: ${eventName}`, detail);
  }

  /**
   * Get current route
   */
  getCurrentRoute(): string {
    return this.currentRoute;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return Array.from(this.routes.values());
  }

  /**
   * Check if currently navigating
   */
  isCurrentlyNavigating(): boolean {
    return this.isNavigating;
  }

  /**
   * Update router configuration
   */
  updateConfig(newConfig: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Router configuration updated', this.config);
  }

  /**
   * Go back in history
   */
  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    }
  }

  /**
   * Go forward in history
   */
  goForward(): void {
    window.history.forward();
  }

  /**
   * Cleanup event listeners
   */
  async destroy(): Promise<void> {
    window.removeEventListener('popstate', this.handlePopState);
    window.removeEventListener('hashchange', this.handleHashChange);
    // await super.destroy();
  }

  override getStatus() {
    return {
      ...super.getStatus(),
      currentRoute: this.currentRoute,
      routeCount: this.routes.size,
      isNavigating: this.isNavigating,
      config: this.config
    };
  }
}