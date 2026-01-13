/**
 * ===============================================
 * PAGE TRANSITION MODULE
 * ===============================================
 * @file src/modules/animation/page-transition.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Virtual pages architecture - one full-viewport "page" visible at a time
 * - Hash-based URLs: #/, #/about, #/contact, #/projects
 * - Unified blur in/out animations for all pages
 * - Desktop only - mobile keeps scroll behavior
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../../types/modules';
import { container } from '../../core/container';
import type { IntroAnimationModule } from './intro-animation';
import { debounce } from '../../utils/gsap-utilities';
import { ANIMATION_CONSTANTS, PAGE_ANIMATION } from '../../config/animation-constants';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

interface PageConfig {
  id: string;
  route: string;
  title: string;
  element: HTMLElement | null;
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

  // Debounced resize handler
  private debouncedHandleResize: (() => void) | null = null;

  constructor(options: PageTransitionOptions = {}) {
    super('PageTransitionModule', { debug: false, ...options });

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

    this.log('[PageTransitionModule] Init starting...');

    // Check if mobile
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    // Skip on mobile unless explicitly enabled
    if (this.isMobile && !this.enableOnMobile) {
      this.log('[PageTransitionModule] Mobile detected - virtual pages disabled');
      return;
    }

    // Skip if reduced motion is preferred
    if (this.reducedMotion) {
      this.log('[PageTransitionModule] Reduced motion preferred');
    }

    this.setupPages();
    this.setupEventListeners();

    // Mark JS as ready - this disables critical CSS page visibility rules
    // and lets JavaScript control page transitions
    document.documentElement.classList.add('js-ready');

    // Wait for intro animation to complete before enabling page transitions
    this.listenForIntroComplete();

    this.log('[PageTransitionModule] Init complete, pages:', this.pages.size);
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
    const pageConfigs: Omit<PageConfig, 'element'>[] = [
      {
        id: 'intro',
        route: '#/',
        title: 'No Bhad Codes'
      },
      {
        id: 'about',
        route: '#/about',
        title: 'About - No Bhad Codes'
      },
      {
        id: 'projects',
        route: '#/projects',
        title: 'Projects - No Bhad Codes'
      },
      {
        id: 'contact',
        route: '#/contact',
        title: 'Contact - No Bhad Codes'
      }
    ];

    // Cache page elements
    pageConfigs.forEach((config) => {
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
    const hash = window.location.hash;
    const initialPageId = this.getPageIdFromHash(hash) || 'intro';

    this.log(`Initializing page states, hash: ${hash}, initialPageId: ${initialPageId}`);

    this.pages.forEach((page, id) => {
      if (!page.element) return;

      if (id === initialPageId) {
        // Show the initial page
        page.element.classList.remove('page-hidden');
        page.element.classList.add('page-active');
        gsap.set(page.element, { opacity: 1, filter: 'none', visibility: 'visible' });
        this.currentPageId = id;
        this.log(`Showing initial page: ${id}`);
      } else {
        // Hide all other pages
        gsap.set(page.element, { clearProps: 'all' });
        page.element.classList.add('page-hidden');
        page.element.classList.remove('page-active');
      }
    });

    this.log(`Initial page set: ${this.currentPageId}`);
  }

  /**
   * Setup event listeners for navigation
   */
  private setupEventListeners(): void {
    // Listen for router navigation events
    this.on('router:navigate', ((event: CustomEvent) => {
      const { pageId } = event.detail || {};
      this.log('[PageTransitionModule] router:navigate received', { pageId, introComplete: this.introComplete, currentPageId: this.currentPageId });

      if (this.isTransitioning) {
        this.log('[PageTransitionModule] Blocked - already transitioning');
        return;
      }

      if (pageId && this.introComplete) {
        if (pageId === this.currentPageId) {
          this.log('[PageTransitionModule] Blocked - same page');
          return;
        }
        this.log('[PageTransitionModule] Starting transition to:', pageId);
        this.transitionTo(pageId);
      } else if (!this.introComplete) {
        this.log('[PageTransitionModule] Blocked - intro not complete');
      }
    }) as EventListener);

    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange.bind(this));

    // Listen for resize to toggle mobile behavior (debounced for performance)
    if (this.debouncedHandleResize) {
      window.addEventListener('resize', this.debouncedHandleResize);
    }
  }

  /**
   * Handle hash changes for navigation
   */
  private handleHashChange(): void {
    if (!this.introComplete || this.isTransitioning) return;

    const hash = window.location.hash;
    const pageId = this.getPageIdFromHash(hash);

    if (pageId && pageId !== this.currentPageId) {
      this.transitionTo(pageId);
    }
  }

  /**
   * Convert hash to page ID
   */
  private getPageIdFromHash(hash: string): string | null {
    if (!hash || hash === '#/' || hash === '#') {
      return 'intro';
    }

    const path = hash.replace('#/', '').replace('#', '');

    const hashToPage: Record<string, string> = {
      '': 'intro',
      'intro': 'intro',
      'home': 'intro',
      'about': 'about',
      'projects': 'projects',
      'contact': 'contact'
    };

    return hashToPage[path] || null;
  }

  /**
   * Handle window resize (with debouncing for performance)
   */
  private handleResize(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (wasMobile !== this.isMobile) {
      this.log(`Breakpoint crossed - now ${this.isMobile ? 'mobile' : 'desktop'}`);

      if (this.isMobile && !this.enableOnMobile) {
        this.enableScrollMode();
      } else {
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
    const handleIntroComplete = (async () => {
      this.log('[PageTransitionModule] Intro complete event received!');
      this.introComplete = true;
      this.dispatchEvent('ready');
    }) as EventListener;

    this.on('IntroAnimationModule:complete', handleIntroComplete);
    this.on('MobileIntroAnimationModule:complete', handleIntroComplete);

    // Check if intro is already complete
    const introOverlay = document.getElementById('intro-morph-overlay');
    const alreadyComplete =
      (introOverlay && introOverlay.style.display === 'none') ||
      document.documentElement.classList.contains('intro-complete');

    if (alreadyComplete) {
      this.introComplete = true;
    }

    // Fallback timeout
    setTimeout(async () => {
      if (!this.introComplete) {
        this.introComplete = true;
        this.log('Intro timeout - page transitions enabled');
        this.dispatchEvent('ready');
      }
    }, 2000);
  }

  /**
   * Transition to a page with blur animations
   */
  async transitionTo(pageId: string): Promise<void> {
    this.log('[PageTransitionModule] transitionTo called:', pageId);

    if (pageId === this.currentPageId || this.isTransitioning) {
      this.log('[PageTransitionModule] transitionTo blocked - same page or already transitioning');
      return;
    }
    if (this.isMobile && !this.enableOnMobile) {
      this.log('[PageTransitionModule] transitionTo blocked - mobile');
      return;
    }

    const targetPage = this.pages.get(pageId);
    const currentPage = this.pages.get(this.currentPageId);

    if (!targetPage || !targetPage.element) {
      this.log('[PageTransitionModule] Target page not found:', pageId);
      return;
    }

    this.isTransitioning = true;
    this.log(`Transitioning: ${this.currentPageId} -> ${pageId}`);

    try {
      // Special handling for intro page
      if (this.currentPageId === 'intro') {
        // Exiting intro - play coyote paw exit animation
        await this.playIntroExitAnimation();
      } else if (currentPage && currentPage.element) {
        // Regular page exit - blur out
        await this.animateOut(currentPage);
      }

      // Hide current page
      if (currentPage && currentPage.element) {
        gsap.set(currentPage.element, { clearProps: 'all' });
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
      }

      // Show and animate in target page
      if (pageId === 'intro') {
        // ============================================
        // INTRO PAGE: Animation module controls everything
        // ============================================
        // Don't make section visible yet - let intro animation module
        // show elements at the right time during/after animation.

        // Remove page-hidden but DON'T show content yet
        targetPage.element.classList.remove('page-hidden');
        targetPage.element.classList.add('page-active');

        // Keep section invisible - animation module will reveal content
        gsap.set(targetPage.element, {
          opacity: 0,
          visibility: 'hidden'
        });

        // Let intro animation module handle the coyote paw animation
        // The module will make content visible when animation completes
        await this.playIntroEntryAnimation();

        // After animation completes, ensure section is visible
        gsap.set(targetPage.element, {
          opacity: 1,
          visibility: 'visible'
        });
      } else {
        // ============================================
        // PAGE TRANSITION: Blur in from hidden state
        // ============================================
        // All content (including button) animates together as one unit.

        // STEP 1: Add page-entering class FIRST (CSS !important keeps hidden)
        targetPage.element.classList.add('page-entering');

        // STEP 2: Remove page-hidden, add page-active
        // Element stays hidden because page-entering has opacity: 0 !important
        targetPage.element.classList.remove('page-hidden');
        targetPage.element.classList.add('page-active');

        // STEP 3: Set GSAP inline styles for animation start state
        gsap.set(targetPage.element, {
          opacity: 0,
          visibility: 'hidden',
          filter: `blur(${PAGE_ANIMATION.BLUR_AMOUNT}px)`
        });

        // STEP 4: Remove page-entering - GSAP inline styles take over
        targetPage.element.classList.remove('page-entering');

        // STEP 5: Animate in
        await this.animateIn(targetPage);
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

      // Dispatch contact-page-ready if needed
      if (pageId === 'contact') {
        this.dispatchEvent('contact-page-ready', { pageId });
      }

      // Refresh ScrollTrigger after page transition
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        this.log('ScrollTrigger refreshed after page transition');
      });
    } catch (error) {
      this.error('Transition failed:', error);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * ============================================
   * PAGE EXIT ANIMATION
   * ============================================
   * Blurs page out: opacity 1→0, blur 0→12px
   */
  private async animateOut(page: PageConfig): Promise<void> {
    if (!page.element) return;

    // Kill any running animations on this element
    gsap.killTweensOf(page.element);

    return new Promise<void>((resolve) => {
      gsap.to(page.element, {
        opacity: 0,
        filter: `blur(${PAGE_ANIMATION.BLUR_AMOUNT}px)`,
        duration: PAGE_ANIMATION.DURATION,
        ease: PAGE_ANIMATION.EASE_IN,
        onComplete: resolve
      });
    });
  }

  /**
   * ============================================
   * PAGE ENTRY ANIMATION
   * ============================================
   * All content blurs in together as one unit: opacity 0→1, blur 12px→0
   *
   * NOTE: transitionTo() has already set:
   *   - opacity: 0
   *   - visibility: hidden
   *   - filter: blur(12px)
   */
  private async animateIn(page: PageConfig): Promise<void> {
    if (!page.element) return;

    // Kill any running animations on this element
    gsap.killTweensOf(page.element);

    // Animate the entire page from hidden/blurred to visible/clear
    await new Promise<void>((resolve) => {
      gsap.to(page.element, {
        opacity: 1,
        visibility: 'visible',
        filter: 'blur(0px)',
        duration: PAGE_ANIMATION.DURATION,
        ease: PAGE_ANIMATION.EASE_OUT,
        onComplete: () => {
          // Clear inline styles so CSS takes over
          gsap.set(page.element, { clearProps: 'filter,visibility,opacity' });
          resolve();
        }
      });
    });
  }

  /**
   * Play the coyote paw exit animation when leaving the intro page
   */
  private async playIntroExitAnimation(): Promise<void> {
    try {
      const introModule = await container.resolve('IntroAnimationModule') as IntroAnimationModule;
      if (introModule && typeof introModule.playExitAnimation === 'function') {
        await introModule.playExitAnimation();
      }
    } catch {
      this.log('IntroAnimationModule not available for exit animation');
    }
  }

  /**
   * Play the coyote paw entry animation when returning to intro page
   * The intro animation module handles all visibility and animation
   */
  private async playIntroEntryAnimation(): Promise<void> {
    try {
      const introModule = await container.resolve('IntroAnimationModule') as IntroAnimationModule;

      if (introModule && typeof introModule.playEntryAnimation === 'function') {
        await introModule.playEntryAnimation();
      } else {
        this.showIntroPageFallback();
      }
    } catch {
      this.log('IntroAnimationModule not available for entry animation');
      this.showIntroPageFallback();
    }
  }

  /**
   * Fallback to show intro page when animation module unavailable
   */
  private showIntroPageFallback(): void {
    const businessCard = document.getElementById('business-card');
    const introNav = document.querySelector('.intro-nav') as HTMLElement;
    if (businessCard) businessCard.style.opacity = '1';
    if (introNav) {
      gsap.set(introNav, { opacity: 1, visibility: 'visible', display: 'flex' });
      const navLinks = introNav.querySelectorAll('.intro-nav-link');
      if (navLinks.length > 0) {
        gsap.set(navLinks, { opacity: 1 });
      }
    }
  }

  /**
   * Navigate to a page programmatically (updates hash)
   */
  navigateTo(pageId: string): void {
    const page = this.pages.get(pageId);
    if (page) {
      window.history.pushState({ pageId }, '', page.route);
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
    if (this.debouncedHandleResize) {
      window.removeEventListener('resize', this.debouncedHandleResize);
    }
    this.debouncedHandleResize = null;

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
