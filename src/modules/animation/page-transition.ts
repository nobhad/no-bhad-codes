/**
 * ===============================================
 * PAGE TRANSITION MODULE
 * ===============================================
 * @file src/modules/animation/page-transition.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Virtual pages architecture like salcosta.dev
 * - One full-viewport "page" visible at a time
 * - Hash-based URLs: #/, #/about, #/contact
 * - GSAP blur-in/out + drop-in/out animations
 * - Desktop only - mobile keeps scroll behavior
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { container } from '../../core/container';
import type { IntroAnimationModule } from './intro-animation';

// Animation timing constants (from salcosta.dev analysis)
const ANIMATION_DURATION_IN = 0.5;
const ANIMATION_DURATION_OUT = 0.4;
const STAGGER_DELAY = 0.1;
const EASE_CURVE = 'cubic-bezier(.3, .9, .3, .9)';

interface PageConfig {
  id: string;
  route: string;
  title: string;
  element: HTMLElement | null;
  childSelectors: string[];
  /** Skip PageTransition animations - let another module handle it */
  skipAnimation?: boolean;
}

interface PageTransitionOptions extends ModuleOptions {
  /** Selector for the main content container */
  containerSelector?: string;
  /** Whether to enable on mobile */
  enableOnMobile?: boolean;
}

export class PageTransitionModule extends BaseModule {
  private container: HTMLElement | null = null;
  private pages: Map<string, PageConfig> = new Map();
  private currentPageId: string = '';
  private isTransitioning: boolean = false;
  private introComplete: boolean = false;

  // Configuration
  private containerSelector: string;
  private enableOnMobile: boolean;
  private isMobile: boolean = false;

  constructor(options: PageTransitionOptions = {}) {
    super('PageTransitionModule', { debug: true, ...options });

    this.containerSelector = options.containerSelector || '#main-content';
    this.enableOnMobile = options.enableOnMobile || false;
  }

  override async init(): Promise<void> {
    await super.init();

    // Check if mobile
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    // Skip on mobile unless explicitly enabled
    if (this.isMobile && !this.enableOnMobile) {
      this.log('Mobile detected - virtual pages disabled, using scroll behavior');
      return;
    }

    // Skip if reduced motion is preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - using instant transitions');
    }

    this.setupPages();
    this.setupEventListeners();

    // Wait for intro animation to complete before enabling page transitions
    this.listenForIntroComplete();

    this.log('Page transition module initialized');
  }

  /**
   * Setup page configurations and cache elements
   */
  private setupPages(): void {
    this.container = document.querySelector(this.containerSelector) as HTMLElement;

    if (!this.container) {
      this.warn(`Container "${this.containerSelector}" not found`);
      return;
    }

    // Define page configurations
    // Note: hero and tech-stack sections are NOT virtual pages
    // - hero is handled by TextAnimationModule (scroll-driven)
    // - tech-stack is mobile-only
    const pageConfigs: Omit<PageConfig, 'element'>[] = [
      {
        id: 'intro',
        route: '#/',
        title: 'No Bhad Codes',
        childSelectors: ['.business-card-container', '.business-card', '.intro-nav']
      },
      {
        id: 'about',
        route: '#/about',
        title: 'About - No Bhad Codes',
        // Note: .about-hero-desktop is an overlay animated separately by AboutHeroModule
        childSelectors: ['.about-content', '.about-text-wrapper', 'h2', 'p', '.tech-stack-desktop']
      },
      {
        id: 'contact',
        route: '#/contact',
        title: 'Contact - No Bhad Codes',
        // ContactAnimationModule handles all animations for contact
        childSelectors: [],
        skipAnimation: true
      }
    ];

    // Cache page elements
    pageConfigs.forEach((config) => {
      // Try multiple selector strategies
      const element =
        document.getElementById(config.id) ||
        document.querySelector(`.${config.id}-section`) ||
        document.querySelector(`section#${config.id}`);

      if (element) {
        this.pages.set(config.id, {
          ...config,
          element: element as HTMLElement
        });
        this.log(`Cached page: ${config.id}`);
      } else {
        this.warn(`Page element not found for: ${config.id}`);
      }
    });

    // Initialize page states
    this.initializePageStates();
  }

  /**
   * Initialize all pages - show intro, hide others
   */
  private initializePageStates(): void {
    this.pages.forEach((page, id) => {
      if (!page.element) return;

      if (id === 'intro') {
        // Intro is visible by default
        page.element.classList.add('page-active');
        page.element.classList.remove('page-hidden');
        this.currentPageId = 'intro';
      } else {
        // All other pages hidden initially
        page.element.classList.add('page-hidden');
        page.element.classList.remove('page-active');
      }
    });

    this.log(`Initial page: ${this.currentPageId}`);
  }

  /**
   * Setup event listeners for navigation
   */
  private setupEventListeners(): void {
    // Listen for router navigation events
    this.on('router:navigate', ((event: CustomEvent) => {
      const { pageId } = event.detail || {};
      if (pageId && this.introComplete) {
        this.transitionTo(pageId);
      }
    }) as EventListener);

    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange.bind(this));

    // Listen for resize to toggle mobile behavior
    window.addEventListener('resize', this.handleResize.bind(this));

    // Setup click handlers for navigation links
    this.setupNavLinkHandlers();
  }

  /**
   * Setup click handlers for navigation links with data-nav-link attribute
   * This ensures reliable page transitions for intro-nav and other nav links
   */
  private setupNavLinkHandlers(): void {
    // Find all nav links that should trigger page transitions
    const navLinks = document.querySelectorAll('[data-nav-link], a[href^="#/"]');

    navLinks.forEach((link) => {
      link.addEventListener('click', (event: Event) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.getAttribute('href');

        if (!href || !href.startsWith('#')) return;

        // Prevent default to handle navigation ourselves
        event.preventDefault();

        const pageId = this.getPageIdFromHash(href);
        this.log(`Nav link clicked: ${href} -> pageId: ${pageId}`);

        if (pageId) {
          // Update the URL hash
          window.history.pushState({ pageId }, '', href);

          // Trigger the transition
          if (this.introComplete) {
            this.transitionTo(pageId);
          } else {
            this.log('Intro not complete, waiting...');
            // Wait for intro to complete, then navigate
            const checkIntro = setInterval(() => {
              if (this.introComplete) {
                clearInterval(checkIntro);
                this.transitionTo(pageId);
              }
            }, 100);
            // Timeout after 3 seconds
            setTimeout(() => clearInterval(checkIntro), 3000);
          }
        }
      });
    });

    this.log(`Setup click handlers for ${navLinks.length} nav links`);
  }

  /**
   * Handle hash changes for navigation
   */
  private handleHashChange(): void {
    if (!this.introComplete) return;

    const hash = window.location.hash;
    const pageId = this.getPageIdFromHash(hash);

    if (pageId && pageId !== this.currentPageId) {
      this.transitionTo(pageId);
    }
  }

  /**
   * Convert hash to page ID
   * #/ -> intro
   * #/about -> about
   * #/contact -> contact
   */
  private getPageIdFromHash(hash: string): string | null {
    // Handle salcosta-style hashes: #/, #/about, #/contact
    if (!hash || hash === '#/' || hash === '#') {
      return 'intro';
    }

    // Remove #/ prefix and get page name
    const path = hash.replace('#/', '').replace('#', '');

    // Map hash paths to page IDs
    // Note: hero is not a virtual page (handled by TextAnimationModule)
    const hashToPage: Record<string, string> = {
      '': 'intro',
      'intro': 'intro',
      'home': 'intro',
      'about': 'about',
      'contact': 'contact'
    };

    return hashToPage[path] || null;
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    // Toggle behavior if crossing breakpoint
    if (wasMobile !== this.isMobile) {
      this.log(`Breakpoint crossed - now ${this.isMobile ? 'mobile' : 'desktop'}`);

      if (this.isMobile && !this.enableOnMobile) {
        // Switched to mobile - show all pages for scroll
        this.enableScrollMode();
      } else {
        // Switched to desktop - enable virtual pages
        this.enableVirtualPageMode();
      }
    }
  }

  /**
   * Enable scroll mode (mobile)
   */
  private enableScrollMode(): void {
    this.pages.forEach((page) => {
      if (page.element) {
        page.element.classList.remove('page-hidden', 'page-active');
        gsap.set(page.element, { clearProps: 'all' });
      }
    });
    this.log('Scroll mode enabled');
  }

  /**
   * Enable virtual page mode (desktop)
   */
  private enableVirtualPageMode(): void {
    this.initializePageStates();
    this.log('Virtual page mode enabled');
  }

  /**
   * Listen for intro animation completion
   */
  private listenForIntroComplete(): void {
    // Listen for intro complete event
    this.on('IntroAnimationModule:complete', (() => {
      this.introComplete = true;
      this.log('Intro complete - page transitions enabled');
      this.dispatchEvent('ready');
    }) as EventListener);

    // Also check if intro is already complete (in case we init late)
    const introOverlay = document.getElementById('intro-morph-overlay');
    if (introOverlay && introOverlay.style.display === 'none') {
      this.introComplete = true;
      this.log('Intro already complete');
    }

    // Fallback: enable after timeout if no intro event
    setTimeout(() => {
      if (!this.introComplete) {
        this.introComplete = true;
        this.log('Intro timeout - page transitions enabled');
        this.dispatchEvent('ready');
      }
    }, 5000);
  }

  /**
   * Transition to a page with animations
   */
  async transitionTo(pageId: string): Promise<void> {
    // Skip if already on this page or transitioning
    if (pageId === this.currentPageId || this.isTransitioning) {
      return;
    }

    // Skip on mobile
    if (this.isMobile && !this.enableOnMobile) {
      return;
    }

    const targetPage = this.pages.get(pageId);
    const currentPage = this.pages.get(this.currentPageId);

    if (!targetPage || !targetPage.element) {
      this.warn(`Target page not found: ${pageId}`);
      return;
    }

    this.isTransitioning = true;
    this.log(`Transitioning: ${this.currentPageId} -> ${pageId}`);

    try {
      // Special handling for leaving intro page - play coyote paw exit animation
      if (this.currentPageId === 'intro') {
        await this.playIntroExitAnimation();
      }

      // Animate out current page (skip for intro - already handled by exit animation)
      if (currentPage && currentPage.element && this.currentPageId !== 'intro') {
        await this.animateOut(currentPage);
      } else if (currentPage && currentPage.element && this.currentPageId === 'intro') {
        // Just hide intro page immediately after exit animation
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
      }

      // Show target page
      targetPage.element.classList.remove('page-hidden');
      targetPage.element.classList.add('page-active');

      // Animate in target page
      await this.animateIn(targetPage);

      // Hide old page (if not intro, already hidden above)
      if (currentPage && currentPage.element && this.currentPageId !== 'intro') {
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
      }

      // Update state
      this.currentPageId = pageId;

      // Update document title
      if (targetPage.title) {
        document.title = targetPage.title;
      }

      // Dispatch page changed event
      this.dispatchEvent('page-changed', {
        from: currentPage?.id,
        to: pageId
      });

    } catch (error) {
      this.error('Transition failed:', error);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Play the coyote paw exit animation when leaving the intro page
   */
  private async playIntroExitAnimation(): Promise<void> {
    try {
      const introModule = await container.resolve('IntroAnimationModule') as IntroAnimationModule;
      if (introModule && typeof introModule.playExitAnimation === 'function') {
        this.log('Playing intro exit animation');
        await introModule.playExitAnimation();
        this.log('Intro exit animation complete');
      }
    } catch (error) {
      this.log('IntroAnimationModule not available for exit animation:', error);
    }
  }

  /**
   * Animate page out (blur-out + drop-out)
   */
  private async animateOut(page: PageConfig): Promise<void> {
    if (!page.element) return;

    // Skip animation if page handles its own (e.g., contact)
    // Don't hide - let the page module handle its own out animation
    if (page.skipAnimation) {
      return;
    }

    if (this.reducedMotion) {
      gsap.set(page.element, { opacity: 0, visibility: 'hidden' });
      return;
    }

    const children = this.getAnimatableChildren(page);

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: resolve
      });

      // Blur out the page
      tl.to(page.element, {
        opacity: 0,
        filter: 'blur(8px)',
        duration: ANIMATION_DURATION_OUT,
        ease: EASE_CURVE
      });

      // Drop out children with stagger
      if (children.length > 0) {
        tl.to(children, {
          y: '105%',
          duration: ANIMATION_DURATION_OUT,
          stagger: STAGGER_DELAY,
          ease: EASE_CURVE
        }, 0);
      }

      this.addTimeline(tl);
    });
  }

  /**
   * Animate page in (blur-in + drop-in)
   */
  private async animateIn(page: PageConfig): Promise<void> {
    if (!page.element) return;

    // Skip animation if page handles its own (e.g., contact)
    if (page.skipAnimation || this.reducedMotion) {
      gsap.set(page.element, { opacity: 1, visibility: 'visible', filter: 'none' });
      return;
    }

    const children = this.getAnimatableChildren(page);

    // Set initial state
    gsap.set(page.element, {
      opacity: 0,
      filter: 'blur(8px)',
      visibility: 'visible'
    });

    if (children.length > 0) {
      gsap.set(children, { y: '-105%' });
    }

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: resolve
      });

      // Blur in the page
      tl.to(page.element, {
        opacity: 1,
        filter: 'blur(0px)',
        duration: ANIMATION_DURATION_IN,
        ease: EASE_CURVE
      });

      // Drop in children with stagger
      if (children.length > 0) {
        tl.to(children, {
          y: 0,
          duration: ANIMATION_DURATION_IN,
          stagger: STAGGER_DELAY,
          ease: EASE_CURVE
        }, STAGGER_DELAY);
      }

      this.addTimeline(tl);
    });
  }

  /**
   * Get animatable children elements from a page
   */
  private getAnimatableChildren(page: PageConfig): Element[] {
    if (!page.element) return [];

    const children: Element[] = [];

    page.childSelectors.forEach((selector) => {
      const elements = page.element!.querySelectorAll(selector);
      elements.forEach((el) => children.push(el));
    });

    return children;
  }

  /**
   * Navigate to a page programmatically (updates hash)
   */
  navigateTo(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page) {
      // Update URL hash
      window.history.pushState({ pageId }, '', page.route);

      // Trigger transition
      this.transitionTo(pageId);
    }
  }

  /**
   * Get current page ID
   */
  getCurrentPage(): string {
    return this.currentPageId;
  }

  /**
   * Check if page transitions are ready
   */
  isReady(): boolean {
    return super.isReady() && this.introComplete && !this.isTransitioning;
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      currentPage: this.currentPageId,
      pageCount: this.pages.size,
      introComplete: this.introComplete,
      isTransitioning: this.isTransitioning,
      isMobile: this.isMobile
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    window.removeEventListener('hashchange', this.handleHashChange.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this));

    // Clear all page styling
    this.pages.forEach((page) => {
      if (page.element) {
        gsap.set(page.element, { clearProps: 'all' });
        page.element.classList.remove('page-active', 'page-hidden');
      }
    });

    this.pages.clear();
    this.container = null;

    await super.destroy();
  }
}
