/**
 * ===============================================
 * NAVIGATION MODULE - UPDATED WITH ROUTING
 * ===============================================
 * @file src/modules/navigation.ts
 * @extends BaseModule
 *
 * Enhanced navigation module with client-side routing support.
 * Handles menu animations, theme switching, and route-aware navigation.
 */

import { BaseModule } from './base';
import { appState } from '../core/state';
import { RouterService } from '../services/router-service';
import { DataService } from '../services/data-service';
import { SubmenuModule } from './submenu';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../types/modules';

export interface NavigationModuleOptions extends ModuleOptions {
  routerService?: RouterService;
  dataService?: DataService;
}

export class NavigationModule extends BaseModule {
  // Navigation elements
  private nav: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private menuToggles: NodeListOf<Element> | null = null;
  private menuLinks: NodeListOf<Element> | null = null;
  private bgPanels: NodeListOf<Element> | null = null;
  private menuButtonTexts: NodeListOf<Element> | null = null;

  // Animation timelines
  private mainTimeline: gsap.core.Timeline | null = null;

  // State subscriptions
  private unsubscribeNav?: () => void;

  // Services
  private routerService: RouterService | null = null;
  private dataService: DataService | null = null;
  private submenuModule: SubmenuModule | null = null;

  // Store options for later use
  private options: NavigationModuleOptions;

  constructor(options: NavigationModuleOptions = {}) {
    super('NavigationModule', options);

    this.options = options;
    this.routerService = options.routerService || null;
    this.dataService = options.dataService || null;
  }

  protected override async onInit(): Promise<void> {
    await this.cacheElements();
    this.setupEventListeners();
    this.setupStateSubscriptions();
    this.setupAnimations();
    this.setupRoutes();
    await this.loadNavigationData();

    // Initialize submenu functionality
    this.submenuModule = new SubmenuModule({ debug: this.options.debug || false });
    await this.submenuModule.init();
  }

  /**
   * Cache all navigation elements
   */
  private async cacheElements(): Promise<void> {
    this.nav = this.getElement('nav', '[data-nav]', true) as HTMLElement | null;
    this.overlay = this.getElement('overlay', '.overlay', false) as HTMLElement | null;
    this.menuToggles = this.getElements('menuToggles', '[data-menu-toggle]', true);
    this.menuLinks = this.getElements('menuLinks', '.menu-link', true);
    this.bgPanels = this.getElements('bgPanels', '.bg-panel', true);
    this.menuButtonTexts = this.getElements('menuButtonTexts', '.menu-button-text p', false);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Menu toggle buttons
    if (this.menuToggles) {
      this.menuToggles.forEach(toggle => {
        this.addEventListener(toggle as Element, 'click', () => {
          this.toggleMenu();
        });
      });
    }

    // Menu links - only handle submenu toggles and close menu on valid link clicks
    if (this.menuLinks) {
      this.menuLinks.forEach(link => {
        this.addEventListener(link as Element, 'click', (event: Event) => {
          // Handle submenu toggle links
          if ((link as Element).hasAttribute('data-submenu-toggle')) {
            return; // Let submenu module handle this
          }

          // Prevent disabled links from working
          if ((link as Element).classList.contains('disabled')) {
            event.preventDefault();
            return;
          }

          // For all other valid links, just close the menu and let browser handle navigation
          const href = (link as HTMLAnchorElement).getAttribute('href');
          if (href) {
            // Close menu immediately for better UX
            this.closeMenu();
          }
        });
      });
    }

    // Overlay click to close
    if (this.overlay) {
      this.addEventListener(this.overlay, 'click', () => {
        this.closeMenu();
      });
    }

    // Keyboard support
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && appState.getState().navOpen) {
        this.closeMenu();
      }
    });

  }

  /**
   * Setup state subscriptions
   */
  private setupStateSubscriptions(): void {
    this.unsubscribeNav = appState.subscribeToProperty('navOpen', (isOpen) => {
      if (isOpen) {
        this.openMenuAnimation();
      } else {
        this.closeMenuAnimation();
      }
    });
  }

  /**
   * Setup GSAP animations
   */
  private setupAnimations(): void {
    if (!this.nav) return;

    // Create main timeline
    this.mainTimeline = gsap.timeline({ paused: true });

    // Set initial states exactly like CodePen
    gsap.set(this.nav, { display: 'none' });

    this.log('Animations initialized');
  }

  /**
   * Toggle menu state
   */
  private toggleMenu(): void {
    const currentState = appState.getState().navOpen;
    appState.setState({ navOpen: !currentState });
  }

  /**
   * Open menu with animation
   */
  private openMenuAnimation(): void {
    if (!this.nav || !this.mainTimeline) return;

    this.log('Opening menu');

    // Set nav state
    this.nav.setAttribute('data-nav', 'open');
    document.body.style.overflow = 'hidden';


    // Create opening animation exactly like working version 9.0
    const tl = gsap.timeline();

    // Faster opening sequence
    tl.set(this.nav, { display: 'block' })
      .set(document.querySelector('.menu'), { xPercent: 0 }, '<')
      .fromTo(this.menuButtonTexts, { yPercent: 0 }, { yPercent: -100, stagger: 0.15, duration: 0.5 })
      .fromTo(document.querySelector('.menu-button-icon'), { rotation: 0 }, { rotation: 45, duration: 0.5 }, '<')
      .fromTo(this.overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, '<')
      .fromTo(this.bgPanels, { xPercent: 101 }, { xPercent: 0, stagger: 0.08, duration: 0.4 }, '<')
      .fromTo(this.menuLinks, { yPercent: 140, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.04, duration: 0.5 }, '<+=0.25');
  }

  /**
   * Close menu with animation
   */
  private closeMenuAnimation(): void {
    if (!this.nav) return;

    this.log('Closing menu');

    // Create closing animation matching working version 9.0
    const tl = gsap.timeline({
      onComplete: () => {
        if (this.nav) {
          this.nav.setAttribute('data-nav', 'closed');
          document.body.style.overflow = '';
        }
      }
    });

    // Faster closing sequence
    tl.to(this.overlay, { autoAlpha: 0, duration: 0.3 })
      .to(document.querySelector('.menu'), { xPercent: 120, duration: 0.3 }, '<')
      .to(this.menuButtonTexts, { yPercent: 0, duration: 0.3 }, '<')
      .to(document.querySelector('.menu-button-icon'), { rotation: 0, duration: 0.3 }, '<')
      .set(this.nav, { display: 'none' });

  }

  /**
   * Setup routes with router service
   */
  private setupRoutes(): void {
    if (!this.routerService) return;

    const routes = [
      {
        path: '/',
        section: 'intro',
        title: 'No Bhad Codes - Portfolio',
        onEnter: () => this.onSectionEnter('home')
      },
      {
        path: '/projects',
        section: 'portfolio',
        title: 'Portfolio - No Bhad Codes',
        onEnter: () => this.onSectionEnter('portfolio')
      },
      {
        path: '/client',
        section: 'client',
        title: 'Client Portal - No Bhad Codes',
        onEnter: () => this.onSectionEnter('client')
      },
      {
        path: '#about',
        section: 'about',
        title: 'About - No Bhad Codes',
        onEnter: () => this.onSectionEnter('about')
      },
      {
        path: '#contact',
        section: 'contact',
        title: 'Contact - No Bhad Codes',
        onEnter: () => this.onSectionEnter('contact')
      }
    ];

    this.routerService.addRoutes(routes);
    this.log('Routes registered with router service');
  }

  /**
   * Load navigation data from data service
   */
  private async loadNavigationData(): Promise<void> {
    try {
      // Load navigation data dynamically from data service or template data
      let navigationItems = [];

      if (this.dataService) {
        // Try to get navigation data from data service
        const navigationData = this.dataService.getNavigation();
        navigationItems = navigationData?.main || [];
      }

      // Fallback: try to get from window global if available (from EJS template)
      if (navigationItems.length === 0 && typeof window !== 'undefined') {
        const windowData = (window as any).NAVIGATION_DATA;
        if (windowData?.menuItems) {
          navigationItems = windowData.menuItems;
        }
      }

      // Final fallback: get from DOM data attributes if available
      if (navigationItems.length === 0) {
        const navElement = document.querySelector('[data-navigation]');
        if (navElement) {
          const navData = navElement.getAttribute('data-navigation');
          if (navData) {
            try {
              const parsed = JSON.parse(navData);
              navigationItems = parsed.menuItems || [];
            } catch (e) {
              console.warn('Failed to parse navigation data from DOM');
            }
          }
        }
      }

      // Ultimate fallback: use minimal hardcoded data (only if nothing else works)
      if (navigationItems.length === 0) {
        navigationItems = [
          { id: 'home', text: 'home', href: '/', eyebrow: '00' },
          { id: 'about', text: 'about', href: '#about', eyebrow: '01' },
          { id: 'contact', text: 'contact', href: '#contact', eyebrow: '02' },
          { id: 'client', text: 'client portal', href: '/client-portal/', eyebrow: '04' }
        ];
      }

      this.updateNavigationDOM(navigationItems);
      this.detectCurrentPage();
    } catch (error) {
      console.error('Error loading navigation data:', error);
      // Continue with empty navigation rather than crashing
      this.detectCurrentPage();
    }
  }

  /**
   * Update navigation DOM with data
   */
  private updateNavigationDOM(navigationItems: any[]): void {
    if (!this.menuLinks) return;

    navigationItems.forEach((item, index) => {
      const menuLink = this.menuLinks?.[index] as HTMLAnchorElement;
      if (menuLink) {
        const heading = menuLink.querySelector('.menu-link-heading');
        const eyebrow = menuLink.querySelector('.eyebrow');

        // Handle both data formats: {text, href} and {title, path}
        const itemText = item.text || item.title || '';
        const itemHref = item.href || item.path || '#';

        if (heading) {
          heading.textContent = itemText;
          heading.setAttribute('data-text', itemText);
        }

        if (eyebrow) {
          eyebrow.textContent = item.eyebrow || '';
        }

        // Update href for routing
        menuLink.setAttribute('href', itemHref);

        // Handle disabled state
        if (item.disabled) {
          menuLink.classList.add('disabled');
          menuLink.setAttribute('href', '#');
        } else {
          menuLink.classList.remove('disabled');
        }

        // Handle coming soon banner
        const comingSoonBanner = menuLink.querySelector('.coming-soon-banner');
        if (item.comingSoon) {
          if (!comingSoonBanner) {
            const banner = document.createElement('div');
            banner.className = 'coming-soon-banner';
            banner.textContent = 'Coming Soon';
            menuLink.appendChild(banner);
          }
        } else if (comingSoonBanner) {
          comingSoonBanner.remove();
        }
      }
    });
  }

  /**
   * Handle section enter events
   */
  private onSectionEnter(sectionName: string): void {
    this.log(`Entered section: ${sectionName}`);
    this.dispatchEvent('section-entered', { sectionName });
  }

  /**
   * Close menu programmatically
   */
  private closeMenu(): void {
    // Close any open submenus first
    if (this.submenuModule) {
      this.submenuModule.closeAllSubmenus();
    }

    appState.setState({ navOpen: false });
  }

  /**
   * Detect current page and update active state
   */
  private detectCurrentPage(): void {
    const currentPath = window.location.pathname;

    if (this.menuLinks) {
      this.menuLinks.forEach(link => {
        const href = (link as HTMLAnchorElement).getAttribute('href');
        const linkElement = link as HTMLElement;

        // Remove any existing active class
        linkElement.classList.remove('active');

        // Check for exact match or partial match for hash links
        if (href === currentPath ||
            (currentPath === '/' && href?.startsWith('/#')) ||
            (currentPath === '/projects' && href === '/projects') ||
            (currentPath === '/client' && href === '/client')) {
          linkElement.classList.add('active');
        }
      });
    }
  }

  /**
   * Programmatically navigate to section
   */
  navigateToSection(sectionId: string): void {
    if (this.routerService) {
      this.routerService.navigate(`#${sectionId}`);
    }
  }

  /**
   * Get current navigation state
   */
  getNavigationState() {
    return {
      isOpen: appState.getState().navOpen,
      currentRoute: this.routerService?.getCurrentRoute(),
      hasRouter: !!this.routerService
    };
  }

  /**
   * Cleanup on destroy
   */
  protected override onDestroy(): void {
    if (this.unsubscribeNav) {
      this.unsubscribeNav();
    }

    if (this.mainTimeline) {
      this.mainTimeline.kill();
    }

    // Cleanup submenu module
    if (this.submenuModule) {
      this.submenuModule.destroy();
      this.submenuModule = null;
    }

    // Reset body overflow
    document.body.style.overflow = '';
  }
}