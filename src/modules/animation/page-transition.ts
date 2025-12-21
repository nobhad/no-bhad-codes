/**
 * ===============================================
 * PAGE TRANSITION MODULE
 * ===============================================
 * @file src/modules/animation/page-transition.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Virtual pages architecture - one full-viewport "page" visible at a time
 * - Hash-based URLs: #/, #/about, #/contact
 * - GSAP blur-in/out + drop-in/out animations
 * - Desktop only - mobile keeps scroll behavior
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { container } from '../../core/container';
import type { IntroAnimationModule } from './intro-animation';
import { debounce } from '../../utils/gsap-utilities';
import { ANIMATION_CONSTANTS } from '../../config/animation-constants';

// Animation timing constants
const ANIMATION_DURATION_IN = ANIMATION_CONSTANTS.DURATIONS.STANDARD_LENGTH; // 0.5s
const ANIMATION_DURATION_OUT = ANIMATION_CONSTANTS.DURATIONS.NORMAL; // 0.3s (faster exit)
const STAGGER_DELAY = 0.1;
const EASE_CURVE = ANIMATION_CONSTANTS.EASING.SMOOTH_SAL; // cubic-bezier(0.3, 0.9, 0.3, 0.9)
const BLUR_AMOUNT = 8; // pixels

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
  private transitionOverlay: HTMLElement | null = null;

  // Configuration
  private containerSelector: string;
  private enableOnMobile: boolean;
  private isMobile: boolean = false;

  constructor(options: PageTransitionOptions = {}) {
    super('PageTransitionModule', { debug: true, ...options });

    this.containerSelector = options.containerSelector || '#main-content';
    this.enableOnMobile = options.enableOnMobile || false;

    // Create debounced resize handler for performance
    this.debouncedHandleResize = debounce(
      this.handleResize.bind(this),
      ANIMATION_CONSTANTS.PERFORMANCE.THROTTLE_RESIZE
    );
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
    this.setupTransitionOverlay();
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
        id: 'projects',
        route: '#/projects',
        title: 'Projects - No Bhad Codes',
        childSelectors: ['.projects-content', 'h2', '.wip-sign-container', '.wip-sign']
      },
      {
        id: 'portfolio',
        route: '#/portfolio',
        title: 'Portfolio - No Bhad Codes',
        childSelectors: ['.portfolio-content', 'h2', '.wip-sign-container', '.wip-sign']
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
   * Initialize all pages - show page matching current hash, hide others
   */
  private initializePageStates(): void {
    // Determine initial page from URL hash
    const hash = window.location.hash;
    const initialPageId = this.getPageIdFromHash(hash) || 'intro';

    this.pages.forEach((page, id) => {
      if (!page.element) return;

      if (id === initialPageId) {
        // Show the page matching the current URL
        page.element.classList.add('page-active');
        page.element.classList.remove('page-hidden');
        this.currentPageId = id;
      } else {
        // Hide all other pages
        page.element.classList.add('page-hidden');
        page.element.classList.remove('page-active');
      }
    });

    this.log(`Initial page from hash "${hash}": ${this.currentPageId}`);
  }

  /**
   * Setup the transition overlay element
   * Covers only the main content area (between header and footer)
   */
  private setupTransitionOverlay(): void {
    // Check if overlay already exists
    this.transitionOverlay = document.querySelector('.page-transition-overlay');

    if (!this.transitionOverlay) {
      // Create overlay element
      this.transitionOverlay = document.createElement('div');
      this.transitionOverlay.className = 'page-transition-overlay';
      document.body.appendChild(this.transitionOverlay);
      this.log('Created page transition overlay');
    }
  }

  /**
   * Show the transition overlay
   */
  private showTransitionOverlay(): void {
    if (this.transitionOverlay) {
      this.transitionOverlay.classList.add('transitioning');
    }
  }

  /**
   * Hide the transition overlay
   */
  private hideTransitionOverlay(): void {
    if (this.transitionOverlay) {
      this.transitionOverlay.classList.remove('transitioning');
    }
  }

  /**
   * Setup event listeners for navigation
   */
  private setupEventListeners(): void {
    // Listen for router navigation events
    this.on('router:navigate', ((event: CustomEvent) => {
      const { pageId } = event.detail || {};
      this.log(`Router navigate event received - pageId: ${pageId}, introComplete: ${this.introComplete}`);
      if (pageId && this.introComplete) {
        this.log(`Starting transition to: ${pageId}`);
        this.transitionTo(pageId);
      } else if (!this.introComplete) {
        this.warn('Navigation blocked - intro not complete yet');
      }
    }) as EventListener);

    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange.bind(this));

    // Listen for resize to toggle mobile behavior (debounced for performance)
    if (this.debouncedHandleResize) {
      window.addEventListener('resize', this.debouncedHandleResize);
    }

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

        // Immediately hide the intro-nav links when clicked (before exit animation)
        const introNav = anchor.closest('.intro-nav') as HTMLElement;
        if (introNav) {
          gsap.to(introNav, {
            opacity: 0,
            duration: 0.15,
            ease: 'power2.out'
          });
        }

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
    // Handle hash-based routing: #/, #/about, #/contact
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

  /** Debounced resize handler to prevent excessive calls */
  private debouncedHandleResize: (() => void) | null = null;

  /**
   * Handle window resize (with debouncing for performance)
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
    if (pageId === this.currentPageId) {
      this.log(`Already on page: ${pageId}, skipping transition`);
      return;
    }

    if (this.isTransitioning) {
      this.warn(`Transition already in progress, ignoring request to ${pageId}`);
      return;
    }

    // Skip on mobile
    if (this.isMobile && !this.enableOnMobile) {
      this.log('Mobile mode - skipping page transition');
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

    // Show transition overlay - skip for intro (uses intro-morph-overlay instead)
    if (this.currentPageId !== 'intro') {
      this.showTransitionOverlay();
    }

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
      // Clear any inline styles from previous hide (for skipAnimation pages)
      if (targetPage.skipAnimation) {
        targetPage.element.style.display = '';
        targetPage.element.style.visibility = '';
        targetPage.element.style.opacity = '';
      }

      // Special handling for entering intro page - just show card and nav (no animation)
      if (pageId === 'intro') {
        this.log('Returning to intro page - showing card directly');
        const businessCard = document.getElementById('business-card');
        const introNav = document.querySelector('.intro-nav') as HTMLElement;
        if (businessCard) {
          gsap.set(businessCard, { opacity: 1, visibility: 'visible' });
        }
        if (introNav) {
          gsap.set(introNav, { opacity: 1, visibility: 'visible' });
        }
      } else {
        // Animate in target page (skip for intro - handled above)
        await this.animateIn(targetPage);
      }

      // Hide old page (if not intro, already hidden above)
      // ALWAYS hide the old page - even if it has skipAnimation
      // Pages with skipAnimation handle their own animations but still need to be hidden
      if (currentPage && currentPage.element && this.currentPageId !== 'intro') {
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
        // Force hide with inline styles for pages that handle their own animation
        if (currentPage.skipAnimation) {
          currentPage.element.style.display = 'none';
          currentPage.element.style.visibility = 'hidden';
        }
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

      // Hide transition overlay after animation completes
      this.hideTransitionOverlay();

    } catch (error) {
      this.error('Transition failed:', error);
      // Hide overlay even on error
      this.hideTransitionOverlay();
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
   * Play the coyote paw entry animation when entering the intro page
   */
  private async playIntroEntryAnimation(): Promise<void> {
    try {
      const introModule = await container.resolve('IntroAnimationModule') as IntroAnimationModule;
      if (introModule && typeof introModule.playEntryAnimation === 'function') {
        this.log('Playing intro entry animation');
        await introModule.playEntryAnimation();
        this.log('Intro entry animation complete');
      } else {
        // Fallback: just show the card and nav
        this.log('playEntryAnimation not available, showing card directly');
        const businessCard = document.getElementById('business-card');
        const introNav = document.querySelector('.intro-nav') as HTMLElement;
        if (businessCard) businessCard.style.opacity = '1';
        if (introNav) introNav.style.opacity = '1';
      }
    } catch (error) {
      this.log('IntroAnimationModule not available for entry animation:', error);
      // Fallback: just show the card and nav
      const businessCard = document.getElementById('business-card');
      const introNav = document.querySelector('.intro-nav') as HTMLElement;
      if (businessCard) businessCard.style.opacity = '1';
      if (introNav) introNav.style.opacity = '1';
    }
  }

  /**
   * Animate page out (blur-out + drop-out)
   * Adds .leaving class to CSS-animated elements for staggered exits
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

    // Add .leaving class to CSS-animated stagger items for exit animations
    const staggerItems = page.element.querySelectorAll('.stagger-item, .stagger-blur, .intro-nav-link, .input-item, .p-wrapper p, .heading-wrapper h2');
    staggerItems.forEach(item => item.classList.add('leaving'));

    const children = this.getAnimatableChildren(page);

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Clean up .leaving classes after animation
          staggerItems.forEach(item => item.classList.remove('leaving'));
          resolve();
        }
      });

      // Blur out the page
      tl.to(page.element, {
        opacity: 0,
        filter: `blur(${BLUR_AMOUNT}px)`,
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

    // Set initial state (blur-in)
    gsap.set(page.element, {
      opacity: 0,
      filter: `blur(${BLUR_AMOUNT}px)`,
      visibility: 'visible'
    });

    if (children.length > 0) {
      gsap.set(children, { y: '-105%' });
    }

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: resolve
      });

      // Blur in the page - elements come into focus like camera lens
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
   *
   * PERFORMANCE: Ensures all event listeners are properly removed
   * to prevent memory leaks.
   */
  override async destroy(): Promise<void> {
    // Remove event listeners to prevent memory leaks
    window.removeEventListener('hashchange', this.handleHashChange.bind(this));
    if (this.debouncedHandleResize) {
      window.removeEventListener('resize', this.debouncedHandleResize);
    }
    this.debouncedHandleResize = null;

    // Clear all page styling
    this.pages.forEach((page) => {
      if (page.element) {
        gsap.set(page.element, { clearProps: 'all' });
        page.element.classList.remove('page-active', 'page-hidden');
      }
    });

    // Remove transition overlay
    if (this.transitionOverlay && this.transitionOverlay.parentNode) {
      this.transitionOverlay.parentNode.removeChild(this.transitionOverlay);
    }
    this.transitionOverlay = null;

    this.pages.clear();
    this.container = null;

    await super.destroy();
  }
}
