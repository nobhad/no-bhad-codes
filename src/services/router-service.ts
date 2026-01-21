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

export interface NavigationOptions {
  smooth?: boolean;
  replace?: boolean;
  fromPopState?: boolean;
  initial?: boolean;
}

export class RouterService extends BaseService {
  private routes = new Map<string, Route>();
  private currentRoute = '';
  private isNavigating = false;
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
   * Uses salcosta-style hash routing: #/, #/about, #/contact
   */
  private setupDefaultRoutes(): void {
    // Register default routes - salcosta-style hash format
    this.routes.set('/', {
      path: '/',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    // Salcosta-style hash routes
    this.routes.set('#/', {
      path: '#/',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    this.routes.set('#/intro', {
      path: '#/intro',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    this.routes.set('#/home', {
      path: '#/home',
      section: 'intro', // Redirect home to intro
      title: 'No Bhad Codes'
    });

    this.routes.set('#/about', {
      path: '#/about',
      section: 'about',
      title: 'About - No Bhad Codes'
    });

    this.routes.set('#/projects', {
      path: '#/projects',
      section: 'projects',
      title: 'Projects - No Bhad Codes'
    });

    this.routes.set('#/portfolio', {
      path: '#/portfolio',
      section: 'portfolio',
      title: 'Portfolio - No Bhad Codes'
    });

    this.routes.set('#/contact', {
      path: '#/contact',
      section: 'contact',
      title: 'Contact - No Bhad Codes'
    });

    this.routes.set('#/admin-login', {
      path: '#/admin-login',
      section: 'admin-login',
      title: 'Admin Login - No Bhad Codes'
    });

    // Legacy hash routes (without /) for backwards compatibility
    this.routes.set('#intro', {
      path: '#intro',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    this.routes.set('#home', {
      path: '#home',
      section: 'intro',
      title: 'No Bhad Codes'
    });

    this.routes.set('#about', {
      path: '#about',
      section: 'about',
      title: 'About - No Bhad Codes'
    });

    this.routes.set('#projects', {
      path: '#projects',
      section: 'projects',
      title: 'Projects - No Bhad Codes'
    });

    this.routes.set('#portfolio', {
      path: '#portfolio',
      section: 'portfolio',
      title: 'Portfolio - No Bhad Codes'
    });

    this.routes.set('#contact', {
      path: '#contact',
      section: 'contact',
      title: 'Contact - No Bhad Codes'
    });

    this.routes.set('#admin-login', {
      path: '#admin-login',
      section: 'admin-login',
      title: 'Admin Login - No Bhad Codes'
    });

    // Client pages - no section navigation needed
    this.routes.set('/client/intake', {
      path: '/client/intake',
      section: '',
      title: 'New Client Intake - No Bhad Codes'
    });

    this.routes.set('/client/portal', {
      path: '/client/portal',
      section: '',
      title: 'Client Dashboard - No Bhad Codes'
    });

    // Admin page - no section navigation needed
    this.routes.set('/admin', {
      path: '/admin',
      section: '',
      title: 'Admin Dashboard - No Bhad Codes'
    });

    this.routes.set('/admin/', {
      path: '/admin/',
      section: '',
      title: 'Admin Dashboard - No Bhad Codes'
    });

    this.log('Default routes registered');
  }

  /**
   * Setup browser event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('popstate', this.handlePopState);
    window.addEventListener('hashchange', this.handleHashChange);
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
    routes.forEach((route) => this.addRoute(route));
  }

  /**
   * Navigate to a route
   */
  async navigate(
    path: string,
    options: { replace?: boolean; smooth?: boolean } = {}
  ): Promise<void> {
    this.log('navigate() called with path:', path, 'options:', options);

    // Allow re-navigation to hash links (for re-scrolling to sections)
    const isHashLink = path.startsWith('#');

    if (this.isNavigating) {
      this.log('Already navigating, skipping');
      return;
    }

    // Don't navigate if already on the same route (unless it's a hash link)
    if (!isHashLink && path === this.currentRoute) {
      this.log('Already on route, skipping');
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
      this.log('Calling performNavigation...');
      await this.performNavigation(path, options);
      this.log('Navigation complete');
    } catch (error) {
      console.error('[RouterService] Navigation failed:', error);
      this.error('Navigation failed:', error);
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * Navigate to a section
   * Uses virtual pages with PageTransitionModule on all devices
   */
  async navigateToSection(sectionId: string, options: { smooth?: boolean; initial?: boolean } = {}): Promise<void> {
    this.log('navigateToSection called with sectionId:', sectionId, 'initial:', options.initial);

    // Skip dispatching router:navigate during initial page load
    // PageTransitionModule already handles initial page state based on hash
    if (options.initial) {
      this.log('Skipping navigation event dispatch during initial load');
      return;
    }

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

    this.log('Found section:', section);

    // Use virtual pages on all devices
    const hasVirtualPages = document.querySelector('main[data-virtual-pages]');

    if (hasVirtualPages) {
      // Dispatch event for PageTransitionModule (works on mobile + desktop)
      this.log('Dispatching navigate event for virtual pages');
      this.dispatchNavigationEvent('navigate', { pageId: sectionId });
    } else {
      // Fallback to scroll-based navigation if virtual pages not enabled
      const shouldSmooth = options.smooth ?? this.config.smoothScrolling;
      this.log('Fallback - using scrollIntoView, smooth:', shouldSmooth);

      try {
        section.scrollIntoView({
          behavior: shouldSmooth ? 'smooth' : 'instant',
          block: 'start'
        });
        this.log('scrollIntoView complete');
      } catch (_e) {
        // Fallback for older browsers
        this.log('Fallback scroll...');
        section.scrollIntoView(true);
      }
    }

    // Update current route (use salcosta-style hash)
    this.currentRoute = `#/${sectionId}`;

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
   * Supports salcosta-style hashes: #/, #/about, #/contact
   */
  private async handleHashChange(): Promise<void> {
    const { hash } = window.location;
    this.log('handleHashChange called with hash:', hash);

    if (hash) {
      // Extract section ID from salcosta-style hash
      // #/ -> intro, #/about -> about, #/contact -> contact
      let sectionId: string;
      if (hash === '#/' || hash === '#') {
        sectionId = 'intro';
      } else {
        // Remove #/ or # prefix to get section ID
        sectionId = hash.replace('#/', '').replace('#', '');
      }

      this.log('Extracted sectionId:', sectionId);
      await this.navigateToSection(sectionId);
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
  private async performNavigation(path: string, options: NavigationOptions = {}): Promise<void> {
    this.log('performNavigation called with path:', path);
    const route = this.findRoute(path);

    if (!route) {
      this.warn(`Route not found: ${path}`);
      return;
    }

    this.log('Found route:', route);

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
      this.log('Navigating to section:', route.section);
      await this.navigateToSection(route.section, { smooth: options.smooth, initial: options.initial });
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
   * Supports salcosta-style hashes: #/, #/about, #/contact
   * Also supports legacy hashes: #about, #contact
   */
  private findRoute(path: string): Route | null {
    this.log('findRoute searching for path:', path);

    // Extract hash from paths like "/#/about" -> "#/about"
    let searchPath = path;
    if (path.includes('#')) {
      const hashIndex = path.indexOf('#');
      searchPath = path.substring(hashIndex); // Get everything from # onward
      this.log('Extracted hash:', searchPath);
    }

    // Direct match (try salcosta-style first)
    if (this.routes.has(searchPath)) {
      this.log('Found direct match for:', searchPath);
      return this.routes.get(searchPath)!;
    }

    // Convert legacy hash to salcosta-style and try again
    // #about -> #/about
    if (searchPath.startsWith('#') && !searchPath.startsWith('#/')) {
      const salcostaPath = `#/${searchPath.substring(1)}`;
      if (this.routes.has(salcostaPath)) {
        this.log('Found salcosta-style match for:', salcostaPath);
        return this.routes.get(salcostaPath)!;
      }
    }

    // Hash-based section match
    if (searchPath.startsWith('#')) {
      // Extract section ID: #/about -> about, #about -> about
      const sectionId = searchPath.replace('#/', '').replace('#', '');
      this.log('Searching for section:', sectionId);
      for (const route of this.routes.values()) {
        if (route.section === sectionId) {
          this.log('Found route by section:', route);
          return route;
        }
      }
    }

    // Try original path for non-hash routes
    if (this.routes.has(path)) {
      this.log('Found match for original path:', path);
      return this.routes.get(path)!;
    }

    // Default route fallback
    this.log('No match found, using default route');
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
        const easeInOutCubic =
          progress < 0.5
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
  private dispatchNavigationEvent(eventName: string, detail: unknown): void {
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
