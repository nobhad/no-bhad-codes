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
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../../types/modules';
import { container } from '../../core/container';
import type { IntroAnimationModule } from './intro-animation';
import { debounce } from '../../utils/gsap-utilities';
import { ANIMATION_CONSTANTS } from '../../config/animation-constants';

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

interface PageConfig {
  id: string;
  route: string;
  title: string;
  element: HTMLElement | null;
  childSelectors: string[];
  /** Skip PageTransition animations - let another module handle it */
  skipAnimation?: boolean;
  /** Use fade-only animation (no drop-in/out Y movement) */
  useFadeOnly?: boolean;
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
    this.setupTransitionOverlay();
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
        title: 'No Bhad Codes',
        // Intro uses fade animation only (no drop-in)
        childSelectors: ['.business-card-container', '.business-card', '.intro-nav'],
        useFadeOnly: true
      },
      {
        id: 'about',
        route: '#/about',
        title: 'About - No Bhad Codes',
        // Animate .about-content as single unit (same pattern as projects and contact pages)
        childSelectors: ['.about-content'],
        useFadeOnly: true
      },
      {
        id: 'projects',
        route: '#/projects',
        title: 'Projects - No Bhad Codes',
        // Animate .projects-content as single unit (same pattern as about page)
        childSelectors: ['.projects-content'],
        useFadeOnly: true
      },
      {
        id: 'contact',
        route: '#/contact',
        title: 'Contact - No Bhad Codes',
        // Animate .contact-content as single unit (same pattern as about and projects pages)
        childSelectors: ['.contact-content'],
        useFadeOnly: true
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
    // Respect hash on both mobile and desktop - no more forcing intro on mobile
    const initialPageId = this.getPageIdFromHash(hash) || 'intro';

    this.log(`Initializing page states, hash: ${hash}, initialPageId: ${initialPageId}`);

    this.pages.forEach((page, id) => {
      if (!page.element) return;

      if (id === initialPageId) {
        // Show the initial page - set classes AND ensure visible
        page.element.classList.remove('page-hidden');
        page.element.classList.add('page-active');
        gsap.set(page.element, { opacity: 1, filter: 'none', visibility: 'visible' });
        this.currentPageId = id;
        this.log(`Showing initial page: ${id}`);

        // Play flip-clock animation for about page on initial load
        if (id === 'about') {
          const textWrapper = page.element.querySelector('.about-text-wrapper') as HTMLElement;
          const techStack = page.element.querySelector('.tech-stack-desktop') as HTMLElement;

          // Hide tech stack initially - flipped down, hinged at bottom
          if (techStack) {
            gsap.set(techStack, {
              rotateX: 90,
              opacity: 1,
              transformOrigin: 'bottom center',
              transformPerspective: 1200
            });
          }

          // Run both animations at the same time
          if (textWrapper) {
            this.playFlipClockAnimation(textWrapper);
          }
          if (techStack) {
            gsap.to(techStack, {
              rotateX: 0,
              duration: 0.8,
              delay: 0.5,
              ease: 'power2.out'
            });
          }
        }
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

    // Setup click handlers for navigation links
    this.setupNavLinkHandlers();
  }

  /**
   * Setup click handlers for navigation links with data-nav-link attribute
   * DISABLED: Navigation links now handled by Navigation module/router service
   * Page transitions only triggered by hashchange events
   */
  private setupNavLinkHandlers(): void {
    // Navigation links are now handled by Navigation module and router service
    // This prevents duplicate handlers and inconsistent transition behaviors
    this.log('Nav link handlers disabled - navigation handled by Navigation module');
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
      'projects': 'projects',
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
   * Handle initial page setup when navigating directly to a non-intro page
   * No animation on initial load - just ensure page is visible
   */
  private async handleInitialPageAnimation(): Promise<void> {
    if (!this.currentPageId || this.currentPageId === 'intro') return;

    const currentPage = this.pages.get(this.currentPageId);
    if (!currentPage?.element) return;

    // Page is already visible from initializePageStates
    // No animation needed on initial load
    this.log(`Initial page ready: ${this.currentPageId}`);

    if (this.currentPageId === 'contact') {
      this.dispatchEvent('contact-page-ready', { pageId: this.currentPageId });
    }
  }

  /**
   * Listen for intro animation completion
   */
  private listenForIntroComplete(): void {
    const handleIntroComplete = (async () => {
      this.log('[PageTransitionModule] Intro complete event received!');
      this.introComplete = true;
      await this.handleInitialPageAnimation();
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
      this.handleInitialPageAnimation();
    }

    // Fallback timeout
    setTimeout(async () => {
      if (!this.introComplete) {
        this.introComplete = true;
        this.log('Intro timeout - page transitions enabled');
        await this.handleInitialPageAnimation();
        this.dispatchEvent('ready');
      }
    }, 2000);
  }

  /**
   * Transition to a page with animations
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

    // Hide intro page immediately to prevent flash during coyote paw animation
    if (pageId === 'intro') {
      this.hideIntroPageImmediately(targetPage);
    }

    // Show transition overlay - skip for intro (uses intro-morph-overlay instead)
    // Also skip overlay when transitioning TO intro (to see fade out)
    if (this.currentPageId !== 'intro' && pageId !== 'intro') {
      this.showTransitionOverlay();
    }

    try {
      // Animate out current page
      this.log('[PageTransitionModule] Step 1: Animating out current page');
      if (this.currentPageId === 'intro') {
        await this.playIntroExitAnimation();
        this.log('[PageTransitionModule] Intro exit animation complete');
      } else if (currentPage && currentPage.element) {
        await this.animateOut(currentPage);
        this.log('[PageTransitionModule] Page exit animation complete');
      }

      // Hide current page after animation
      this.log('[PageTransitionModule] Step 2: Hiding current page');
      if (currentPage && currentPage.element) {
        gsap.set(currentPage.element, { clearProps: 'all' });
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
      }

      // Show and prepare target page
      this.log('[PageTransitionModule] Step 3: Preparing target page');
      if (pageId !== 'intro') {
        this.prepareTargetPage(targetPage, pageId);
      }
      if (targetPage.skipAnimation) {
        targetPage.element.style.display = '';
        targetPage.element.style.visibility = '';
        targetPage.element.style.opacity = '';
      }

      // Animate in target page
      this.log('[PageTransitionModule] Step 4: Animating in target page');
      if (pageId === 'intro') {
        await this.playIntroEntryAnimation();
      } else {
        await this.animateIn(targetPage);
      }
      this.log('[PageTransitionModule] Step 5: Animation complete');

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

      // Refresh ScrollTrigger after page transition completes
      // This ensures scroll-based animations recalculate positions after content changes
      // Use a small delay to ensure DOM has fully updated
      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        this.log('ScrollTrigger refreshed after page transition');
      });

      this.hideTransitionOverlay();
    } catch (error) {
      this.error('Transition failed:', error);
      this.hideTransitionOverlay();
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Hide intro page immediately to prevent flash
   */
  private hideIntroPageImmediately(targetPage: PageConfig): void {
    if (!targetPage.element) return;

    targetPage.element.classList.add('page-hidden');
    targetPage.element.classList.remove('page-active');
    gsap.set(targetPage.element, {
      display: 'none',
      visibility: 'hidden',
      opacity: 0,
      zIndex: -1,
      pointerEvents: 'none',
      immediateRender: true
    });

    const introChildren = targetPage.element.querySelectorAll('.business-card-container, .business-card, .intro-nav');
    if (introChildren.length > 0) {
      gsap.set(introChildren, {
        opacity: 0,
        visibility: 'hidden',
        display: 'none',
        immediateRender: true
      });
    }
  }

  /**
   * Prepare target page for animation
   * Sets up CSS classes - actual GSAP setup happens in animateIn
   */
  private prepareTargetPage(targetPage: PageConfig, _pageId: string): void {
    if (!targetPage.element) return;

    this.log('[PageTransitionModule] prepareTargetPage - before:', targetPage.element.className);

    // Update CSS classes for page visibility
    targetPage.element.classList.remove('page-hidden');
    targetPage.element.classList.add('page-active');

    // Clear any conflicting inline styles from previous transitions
    gsap.set(targetPage.element, { clearProps: 'zIndex' });

    this.log('[PageTransitionModule] prepareTargetPage - after:', targetPage.element.className);
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
   * Play the coyote paw entry animation when entering the intro page
   */
  private async playIntroEntryAnimation(): Promise<void> {
    try {
      const introPage = this.pages.get('intro');

      if (introPage?.element) {
        // Clear props on the section itself but NOT on children
        // The entry animation will handle showing the card and nav
        gsap.set(introPage.element, { clearProps: 'display,visibility,opacity,zIndex,pointerEvents' });

        // Only clear display/visibility on containers, NOT opacity
        // This prevents flash - entry animation controls opacity
        const containers = introPage.element.querySelectorAll('.business-card-container');
        if (containers.length > 0) {
          gsap.set(containers, { clearProps: 'display,visibility' });
        }

        // Keep business card hidden - entry animation will show it
        const businessCard = introPage.element.querySelector('.business-card');
        const introNav = introPage.element.querySelector('.intro-nav') as HTMLElement;
        if (businessCard) {
          gsap.set(businessCard, { opacity: 0 });
        }
        // Show intro nav immediately - don't wait for paw animation
        if (introNav) {
          gsap.set(introNav, { opacity: 1, visibility: 'visible', display: 'flex' });
          const navLinks = introNav.querySelectorAll('.intro-nav-link');
          if (navLinks.length > 0) {
            gsap.set(navLinks, { opacity: 1 });
          }
        }

        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        introPage.element.classList.remove('page-hidden');
        introPage.element.classList.add('page-active');

        await new Promise(resolve => requestAnimationFrame(resolve));
      }

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
    // Show intro nav immediately
    if (introNav) {
      gsap.set(introNav, { opacity: 1, visibility: 'visible', display: 'flex' });
      const navLinks = introNav.querySelectorAll('.intro-nav-link');
      if (navLinks.length > 0) {
        gsap.set(navLinks, { opacity: 1 });
      }
    }
  }

  /**
   * Animate page out - instant hide (blur/fade disabled)
   * Same animation for all content pages (about/contact/projects)
   */
  private async animateOut(page: PageConfig): Promise<void> {
    if (!page.element || page.skipAnimation) return;

    const el = page.element;

    // Instant hide - no blur/fade animation
    gsap.set(el, { opacity: 0, visibility: 'hidden' });
  }

  /**
   * Animate page in - instant show (blur/fade disabled)
   * Same animation for all content pages (about/contact/projects)
   */
  private async animateIn(page: PageConfig): Promise<void> {
    this.log('[PageTransitionModule] animateIn called for:', page.id);

    if (!page.element) {
      this.log('[PageTransitionModule] animateIn - no element!');
      return;
    }

    const sectionEl = page.element;

    // Update CSS classes to show the section
    sectionEl.classList.remove('page-hidden');
    sectionEl.classList.add('page-active');

    // Instant show section
    gsap.set(sectionEl, { opacity: 1, visibility: 'visible' });

    // About page: flip-clock animation for text wrapper (GIF + text) + tech stack slide
    if (page.id === 'about') {
      const textWrapper = sectionEl.querySelector('.about-text-wrapper') as HTMLElement;
      const techStack = sectionEl.querySelector('.tech-stack-desktop') as HTMLElement;

      // Hide tech stack initially - flipped down, hinged at bottom
      if (techStack) {
        gsap.set(techStack, {
          rotateX: 90,
          opacity: 1,
          transformOrigin: 'bottom center',
          transformPerspective: 1200
        });
      }

      // Run both animations at the same time
      if (textWrapper) {
        this.playFlipClockAnimation(textWrapper);
      }
      if (techStack) {
        gsap.to(techStack, {
          rotateX: 0,
          duration: 0.8,
          delay: 0.5,
          ease: 'power2.out'
        });
      }
    }

    // Dispatch contact page ready event if needed
    if (page.id === 'contact') {
      this.dispatchEvent('contact-page-ready', { pageId: page.id });
    }
  }

  /**
   * Play flip-clock animation - element flips down from behind the hr
   */
  private async playFlipClockAnimation(element: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      // Start hidden behind (flipped back) - hinged at top edge
      gsap.set(element, {
        rotateX: -90,
        opacity: 1,
        transformOrigin: 'top center',
        transformPerspective: 1200
      });

      // Flip down into view - swings out from behind (delay to wait for exit)
      gsap.to(element, {
        rotateX: 0,
        duration: 0.8,
        delay: 0.5,
        ease: 'power2.out',
        onComplete: () => {
          // Small bounce/settle at the end
          gsap.to(element, {
            rotateX: 2,
            duration: 0.08,
            ease: 'power1.out',
            onComplete: () => {
              gsap.to(element, {
                rotateX: 0,
                duration: 0.08,
                ease: 'power1.in',
                onComplete: resolve
              });
            }
          });
        }
      });
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
