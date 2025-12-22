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
const BLUR_AMOUNT = 15; // pixels - increased for visibility

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
      console.error(`[PageTransition] Container "${this.containerSelector}" not found`);
      return;
    }

    console.log('[PageTransition] Container found:', this.container);

    // Define page configurations
    // Note: hero sections are NOT virtual pages
    // - hero is handled by TextAnimationModule (scroll-driven)
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
        // Note: .about-hero-desktop is an overlay animated separately by AboutHeroModule
        // Animate .about-content as single unit (includes tech-stack-desktop)
        childSelectors: ['.about-content'],
        useFadeOnly: true
      },
      {
        id: 'projects',
        route: '#/projects',
        title: 'Projects - No Bhad Codes',
        childSelectors: ['.projects-content', 'h2', '.wip-sign-container', '.wip-sign'],
        useFadeOnly: true
      },
      {
        id: 'portfolio',
        route: '#/portfolio',
        title: 'Portfolio - No Bhad Codes',
        childSelectors: ['.portfolio-content', 'h2', '.wip-sign-container', '.wip-sign'],
        useFadeOnly: true
      },
      {
        id: 'contact',
        route: '#/contact',
        title: 'Contact - No Bhad Codes',
        // Only animate .contact-content wrapper (contains h2 and form)
        // Don't select form separately to avoid double-blur on inputs
        childSelectors: ['.contact-content'],
        useFadeOnly: true
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
        this.log(`Cached page: ${config.id}`, element);
        console.log(`[PageTransition] Cached page: ${config.id}`, element);
      } else {
        this.warn(`Page element not found for: ${config.id}`);
        console.error(`[PageTransition] Page element not found for: ${config.id}. Tried: #${config.id}, .${config.id}-section, section#${config.id}`);
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
    // On mobile, always start at intro (intro animation just completed)
    const initialPageId = this.isMobile ? 'intro' : (this.getPageIdFromHash(hash) || 'intro');

    console.log('[PageTransition] initializePageStates - hash:', hash, 'isMobile:', this.isMobile, 'initialPageId:', initialPageId);

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

    // Clear hash on mobile to match initial page
    if (this.isMobile && hash && hash !== '#/' && hash !== '#') {
      window.history.replaceState({}, '', '#/');
    }

    console.log('[PageTransition] Initial page set to:', this.currentPageId);
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
      // Prevent loops - don't handle if already transitioning
      if (this.isTransitioning) {
        console.log('[PageTransition] router:navigate - already transitioning, ignoring');
        return;
      }

      const { pageId } = event.detail || {};
      this.log(`Router navigate event received - pageId: ${pageId}, introComplete: ${this.introComplete}`);
      if (pageId && this.introComplete) {
        // Skip if already on this page
        if (pageId === this.currentPageId) {
          console.log('[PageTransition] router:navigate - already on page, ignoring');
          return;
        }
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
    if (!this.introComplete) return;

    // Prevent loops - don't handle hashchange if already transitioning
    if (this.isTransitioning) {
      console.log('[PageTransition] handleHashChange - already transitioning, ignoring');
      return;
    }

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
    const handleIntroComplete = (() => {
      console.log('[PageTransition] INTRO COMPLETE EVENT RECEIVED');
      this.introComplete = true;
      this.log('Intro complete - page transitions enabled');
      this.dispatchEvent('ready');
    }) as EventListener;

    // Listen for intro complete event (desktop)
    this.on('IntroAnimationModule:complete', handleIntroComplete);
    console.log('[PageTransition] Listening for IntroAnimationModule:complete');

    // Listen for mobile intro complete event
    this.on('MobileIntroAnimationModule:complete', handleIntroComplete);
    console.log('[PageTransition] Listening for MobileIntroAnimationModule:complete');

    // Also check if intro is already complete (in case we init late)
    const introOverlay = document.getElementById('intro-morph-overlay');
    if (introOverlay && introOverlay.style.display === 'none') {
      console.log('[PageTransition] Intro already complete (overlay hidden)');
      this.introComplete = true;
      this.log('Intro already complete');
    }

    // Check if intro-complete class is set (works for both desktop and mobile)
    if (document.documentElement.classList.contains('intro-complete')) {
      console.log('[PageTransition] Intro already complete (class found)');
      this.introComplete = true;
      this.log('Intro already complete (from class)');
    }

    console.log('[PageTransition] Initial introComplete state:', this.introComplete);

    // Fallback: enable after timeout if no intro event
    setTimeout(() => {
      if (!this.introComplete) {
        this.introComplete = true;
        this.log('Intro timeout - page transitions enabled');
        this.dispatchEvent('ready');
      }
    }, 2000); // Reduced from 5s to 2s for faster mobile fallback
  }

  /**
   * Transition to a page with animations
   */
  async transitionTo(pageId: string): Promise<void> {
    console.log('[PageTransition] transitionTo called:', pageId, 'current:', this.currentPageId, 'isMobile:', this.isMobile, 'enableOnMobile:', this.enableOnMobile);

    // Skip if already on this page or transitioning
    if (pageId === this.currentPageId) {
      console.log('[PageTransition] Already on page, skipping');
      this.log(`Already on page: ${pageId}, skipping transition`);
      return;
    }

    if (this.isTransitioning) {
      console.log('[PageTransition] Already transitioning, skipping');
      this.warn(`Transition already in progress, ignoring request to ${pageId}`);
      return;
    }

    // Skip on mobile
    if (this.isMobile && !this.enableOnMobile) {
      console.log('[PageTransition] Mobile without enableOnMobile, skipping');
      this.log('Mobile mode - skipping page transition');
      return;
    }

    console.log('[PageTransition] Starting transition to:', pageId);

    const targetPage = this.pages.get(pageId);
    const currentPage = this.pages.get(this.currentPageId);

    if (!targetPage || !targetPage.element) {
      this.warn(`Target page not found: ${pageId}`);
      return;
    }

    this.isTransitioning = true;
    this.log(`Transitioning: ${this.currentPageId} -> ${pageId}`);

    // CRITICAL: Hide target page (intro) IMMEDIATELY to prevent flash
    // Do this BEFORE anything else, even before showing overlay
    if (pageId === 'intro' && targetPage && targetPage.element) {
      // Force hide with inline styles and classes IMMEDIATELY
      targetPage.element.classList.add('page-hidden');
      targetPage.element.classList.remove('page-active');
      gsap.set(targetPage.element, {
        display: 'none',
        visibility: 'hidden',
        opacity: 0,
        zIndex: -1,
        pointerEvents: 'none',
        immediateRender: true // Force immediate application
      });
      // Also hide any children immediately to prevent flash
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

    // Show transition overlay - skip for intro (uses intro-morph-overlay instead)
    // Also skip overlay when transitioning TO intro (to see fade out)
    if (this.currentPageId !== 'intro' && pageId !== 'intro') {
      this.showTransitionOverlay();
    }

    try {
      // Step 1: Animate out current page
      // COYOTE PAW ANIMATION: ONLY for home page / business card section
      if (this.currentPageId === 'intro') {
        // Verify we're actually on the intro page with business card section
        const businessCardSection = document.querySelector('#intro.business-card-section');
        if (businessCardSection) {
          // Play coyote paw exit animation (ONLY for home page / business card section)
          console.log('[PageTransition] Leaving intro (business card section), playing coyote paw exit animation');
          await this.playIntroExitAnimation();
          console.log('[PageTransition] Coyote paw exit animation complete');
        } else {
          // Fallback: regular animation if business card section not found
          console.log('[PageTransition] Business card section not found, using regular exit animation');
          if (currentPage && currentPage.element) {
            await this.animateOut(currentPage);
          }
        }
      } else if (currentPage && currentPage.element) {
        // Blur out non-intro pages
        console.log('[PageTransition] Animating out current page:', this.currentPageId);
        await this.animateOut(currentPage);
        console.log('[PageTransition] AnimateOut complete');
      }

      // Step 2: Hide current page AFTER animation completes
      if (currentPage && currentPage.element) {
        console.log('[PageTransition] Hiding current page:', this.currentPageId);
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
      }

      // Step 3: Show target page AFTER current is fully hidden
      console.log('[PageTransition] Showing target page:', pageId);
      console.log('[PageTransition] Target page element:', targetPage.element);
      console.log('[PageTransition] Target page classes before:', targetPage.element.classList.toString());

      // For intro page, keep page-hidden until entry animation starts
      if (pageId !== 'intro') {
        // CRITICAL: Remove page-hidden FIRST to allow display to work
        // page-hidden has display: none !important which overrides inline styles
        targetPage.element.classList.remove('page-hidden');
        targetPage.element.classList.add('page-active');
        console.log('[PageTransition] Target page classes after:', targetPage.element.classList.toString());

        // CSS handles display via .page-active class rules
        // But set display inline for contact/about to ensure grid is applied (overrides any previous block)
        const displayValue = (pageId === 'contact' || pageId === 'about') ? 'grid' : undefined;
        gsap.set(targetPage.element, {
          visibility: 'visible',
          opacity: 0, // Will be animated to 1 in animateIn
          ...(displayValue && { display: displayValue }) // Only set if contact/about
        });
      } else if (targetPage && targetPage.element) {
        // For intro, keep page-hidden class - entry animation will remove it
        // This prevents any flash from CSS page-active visibility rules
        // Don't remove page-hidden or add page-active yet
      }
      console.log('[PageTransition] Target page classes updated');
      // Clear any inline styles from previous hide (for skipAnimation pages)
      if (targetPage.skipAnimation) {
        targetPage.element.style.display = '';
        targetPage.element.style.visibility = '';
        targetPage.element.style.opacity = '';
      }

      // Animate in target page
      // COYOTE PAW ANIMATION: ONLY for home page / business card section
      if (pageId === 'intro') {
        // Verify we're actually entering the intro page with business card section
        const businessCardSection = document.querySelector('#intro.business-card-section');
        if (businessCardSection) {
          // Play coyote paw entry animation (ONLY for home page / business card section)
          console.log('[PageTransition] Entering intro (business card section), playing coyote paw entry animation');
          await this.playIntroEntryAnimation();
          console.log('[PageTransition] Coyote paw entry animation complete');
        } else {
          // Fallback: regular animation if business card section not found
          console.log('[PageTransition] Business card section not found, using regular entry animation');
          await this.animateIn(targetPage);
        }
      } else {
        // Regular blur/fade animation for other pages
        console.log('[PageTransition] About to animate in:', pageId);
        await this.animateIn(targetPage);
        console.log('[PageTransition] AnimateIn complete for:', pageId);
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

      console.log('[PageTransition] Transition complete! Current page:', this.currentPageId);
    } catch (error) {
      console.error('[PageTransition] Transition failed:', error);
      this.error('Transition failed:', error);
      // Hide overlay even on error
      this.hideTransitionOverlay();
    } finally {
      this.isTransitioning = false;
      console.log('[PageTransition] isTransitioning set to false');
    }
  }

  /**
   * Play the coyote paw exit animation when leaving the intro page
   * NOTE: This animation is ONLY for the home page / business card section.
   * It should NOT be used for any other pages or sections.
   */
  private async playIntroExitAnimation(): Promise<void> {
    try {
      // Both desktop and mobile are registered as 'IntroAnimationModule'
      const moduleName = 'IntroAnimationModule';
      console.log('[PageTransition] Resolving intro module:', moduleName);
      const introModule = await container.resolve(moduleName) as IntroAnimationModule;
      console.log('[PageTransition] Resolved module:', introModule);
      console.log('[PageTransition] Module type:', typeof introModule);
      console.log('[PageTransition] Has playExitAnimation:', typeof introModule?.playExitAnimation);

      if (introModule && typeof introModule.playExitAnimation === 'function') {
        console.log('[PageTransition] >>> CALLING playExitAnimation NOW <<<');
        this.log('Playing intro exit animation');
        await introModule.playExitAnimation();
        console.log('[PageTransition] >>> playExitAnimation FINISHED <<<');
        this.log('Intro exit animation complete');
      } else {
        console.log('[PageTransition] Intro module has no playExitAnimation method');
        console.log('[PageTransition] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(introModule)));
      }
    } catch (error) {
      console.log('[PageTransition] IntroAnimationModule not available:', error);
      this.log('IntroAnimationModule not available for exit animation:', error);
    }
  }

  /**
   * Play the coyote paw entry animation when entering the intro page
   * NOTE: This animation is ONLY for the home page / business card section.
   * It should NOT be used for any other pages or sections.
   */
  private async playIntroEntryAnimation(): Promise<void> {
    try {
      const introPage = this.pages.get('intro');
      if (introPage && introPage.element) {
        // Clear inline styles that were hiding the intro page
        gsap.set(introPage.element, { clearProps: 'display,visibility,opacity,zIndex,pointerEvents' });
        // Also clear children styles
        const introChildren = introPage.element.querySelectorAll('.business-card-container, .business-card, .intro-nav');
        if (introChildren.length > 0) {
          gsap.set(introChildren, { clearProps: 'opacity,visibility,display' });
        }

        // Use double requestAnimationFrame to ensure browser has processed style clears
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // NOW remove page-hidden and add page-active - do this in the same frame as animation start
        // The CSS rule will handle the transition from hidden to visible
        introPage.element.classList.remove('page-hidden');
        introPage.element.classList.add('page-active');

        // One more frame to ensure class changes are applied
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

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
   * Animate page out (blur-out + optional drop-out)
   * Uses fade-only for pages with useFadeOnly: true
   * Adds .leaving class to CSS-animated elements for staggered exits
   */
  private async animateOut(page: PageConfig): Promise<void> {
    console.log('[PageTransition] animateOut called for page:', page.id);

    if (!page.element) {
      console.log('[PageTransition] animateOut - no element, returning');
      return;
    }

    // Skip animation if page handles its own (e.g., contact)
    // Don't hide - let the page module handle its own out animation
    if (page.skipAnimation) {
      console.log('[PageTransition] animateOut - skipAnimation true, returning');
      return;
    }

    if (this.reducedMotion) {
      console.log('[PageTransition] animateOut - reducedMotion, instant hide');
      gsap.set(page.element, { opacity: 0, visibility: 'hidden' });
      return;
    }

    const useFadeOnly = page.useFadeOnly === true;
    console.log('[PageTransition] animateOut - useFadeOnly:', useFadeOnly);

    // Add .leaving class to CSS-animated stagger items for exit animations
    const staggerItems = page.element.querySelectorAll('.stagger-item, .stagger-blur, .intro-nav-link, .input-item, .p-wrapper p, .heading-wrapper h2');
    staggerItems.forEach(item => item.classList.add('leaving'));

    const children = this.getAnimatableChildren(page);

    // Ensure page element is visible and on top during animation
    // This prevents it from being hidden by page-hidden class or other pages
    // Use correct display value: grid for contact/about, block for others
    const displayValue = (page.id === 'contact' || page.id === 'about') ? 'grid' : 'block';
    gsap.set(page.element, {
      display: displayValue,
      visibility: 'visible',
      zIndex: 200 // High z-index to ensure it's on top during fade out
    });

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Clean up .leaving classes after animation
          staggerItems.forEach(item => item.classList.remove('leaving'));
          // Reset z-index after animation
          gsap.set(page.element, { zIndex: 'auto' });
          resolve();
        }
      });

      // Animate children out - blur + fade for useFadeOnly, drop-out otherwise
      // Blur is applied to CHILDREN (not container) to work on mobile scrollable sections
      if (children.length > 0) {
        console.log('[PageTransition] animateOut - animating', children.length, 'children, useFadeOnly:', useFadeOnly);
        if (useFadeOnly) {
          // Mobile non-intro pages: blur in (longer), then fade out (shorter) - reverse of enter
          const isMobileNonIntro = this.isMobile && this.enableOnMobile && page.id !== 'intro';

          if (isMobileNonIntro) {
            // Step 1: Blur children FIRST (longer duration for mobile)
            tl.to(children, {
              filter: `blur(${BLUR_AMOUNT}px)`,
              webkitFilter: `blur(${BLUR_AMOUNT}px)`,
              duration: 0.6, // Longer blur on mobile
              stagger: STAGGER_DELAY * 0.5,
              ease: 'power2.in'
            }, 0);

            // Step 2: Brief pause - blur lingers
            tl.to({}, { duration: 0.1 });

            // Step 3: THEN fade out (shorter duration - reverse of enter)
            tl.to(children, {
              opacity: 0,
              duration: 0.25, // Shorter fade on mobile
              stagger: STAGGER_DELAY,
              ease: 'power2.in'
            });
          } else {
            // Desktop or intro: original timing
            // Step 1: Blur children FIRST while still visible
            tl.to(children, {
              filter: `blur(${BLUR_AMOUNT}px)`,
              webkitFilter: `blur(${BLUR_AMOUNT}px)`,
              duration: 0.4,
              stagger: STAGGER_DELAY * 0.5,
              ease: 'power2.in'
            }, 0);

            // Step 2: Brief pause - blur lingers
            tl.to({}, { duration: 0.2 });

            // Step 3: THEN fade out (while blurred)
            tl.to(children, {
              opacity: 0,
              duration: 0.3,
              stagger: STAGGER_DELAY,
              ease: 'power2.in'
            });
          }
        } else {
          // Drop out children with stagger
          tl.to(children, {
            y: '105%',
            duration: ANIMATION_DURATION_OUT,
            stagger: STAGGER_DELAY,
            ease: EASE_CURVE
          }, 0);
        }
      } else {
        console.log('[PageTransition] animateOut - no children found for page');
      }

      // Fade out container - for mobile non-intro, fade out after blur completes
      const isMobileNonIntro = this.isMobile && this.enableOnMobile && page.id !== 'intro';
      if (isMobileNonIntro && useFadeOnly) {
        // Fade out container after blur and fade of children
        tl.to(page.element, {
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in'
        }, '-=0.1'); // Start slightly before children fade completes
      } else {
        // Desktop: fade out container after children animation starts
        tl.to(page.element, {
          opacity: 0,
          duration: 0.2,
          ease: 'power2.in'
        }, ANIMATION_DURATION_OUT - 0.1);
      }

      this.addTimeline(tl);
    });
  }

  /**
   * Animate page in (blur-in + optional drop-in)
   * Uses fade-only for pages with useFadeOnly: true
   */
  private async animateIn(page: PageConfig): Promise<void> {
    console.log('[PageTransition] animateIn called for page:', page.id);

    if (!page.element) {
      console.log('[PageTransition] animateIn - no element, returning');
      return;
    }

    // Skip animation if page handles its own (e.g., contact)
    if (page.skipAnimation || this.reducedMotion) {
      console.log('[PageTransition] animateIn - skipAnimation or reducedMotion, instant show');
      gsap.set(page.element, { opacity: 1, visibility: 'visible', filter: 'none' });
      return;
    }

    const children = this.getAnimatableChildren(page);
    const useFadeOnly = page.useFadeOnly === true;
    console.log('[PageTransition] animateIn - useFadeOnly:', useFadeOnly, 'children:', children.length);

    // On mobile, scrollable sections have -webkit-overflow-scrolling: touch which
    // creates compositing layers that bypass filter effects on the container.
    // Solution: Apply blur to CHILDREN instead of container on mobile.
    const isMobile = this.isMobile;
    console.log('[PageTransition] animateIn - isMobile:', isMobile, 'useFadeOnly:', useFadeOnly);

    // Set initial state
    // For contact/about sections, set display: grid inline to ensure it's correct
    // Other sections use CSS .page-active rules
    const displayValue = (page.id === 'contact' || page.id === 'about') ? 'grid' : undefined;
    gsap.set(page.element, {
      opacity: 0,
      visibility: 'visible',
      ...(displayValue && { display: displayValue, minHeight: '100%' }) // Set grid and min-height for contact/about
    });

    // For fade-only: children start invisible AND blurred (blur on children works on mobile)
    // For drop-in: children start above
    if (children.length > 0) {
      if (useFadeOnly) {
        // Mobile non-intro pages: ensure children start blurred and invisible
        // This resets any existing opacity that might have been set by other modules (e.g., AboutHeroModule)

        // Apply blur to children (works on mobile scrollable sections)
        gsap.set(children, {
          opacity: 0,
          filter: `blur(${BLUR_AMOUNT}px)`,
          webkitFilter: `blur(${BLUR_AMOUNT}px)` // Safari compatibility
        });
      } else {
        gsap.set(children, { y: '-105%' });
      }
    }

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Clear filter property after animation
          if (children.length > 0 && useFadeOnly) {
            gsap.set(children, { filter: 'none', webkitFilter: 'none' });
          }
          // Ensure page element is fully visible after animation
          // For contact/about, ensure display: grid and min-height are set
          const finalDisplayValue = (page.id === 'contact' || page.id === 'about') ? 'grid' : undefined;
          gsap.set(page.element, {
            opacity: 1,
            visibility: 'visible',
            ...(finalDisplayValue && { display: finalDisplayValue, minHeight: '100%' }) // Ensure grid and min-height for contact/about
          });
          resolve();
        }
      });

      // Fade in container
      // CSS handles display via .page-active class
      tl.set(page.element, {
        visibility: 'visible'
        // display is handled by CSS .page-active rules
      });
      tl.to(page.element, {
        opacity: 1,
        duration: 0.15,
        ease: 'power2.out'
      });

      // Animate children
      if (children.length > 0) {
        if (useFadeOnly) {
          // Mobile non-intro pages: fade in blurred (shorter), then blur clears (longer)
          const isMobileNonIntro = this.isMobile && this.enableOnMobile && page.id !== 'intro';

          if (isMobileNonIntro) {
            // Step 1: Fade in children while KEEPING blur (shorter fade duration for mobile)
            tl.to(children, {
              opacity: 1,
              // Keep blur at BLUR_AMOUNT - don't change it yet
              duration: 0.3, // Shorter fade on mobile
              stagger: STAGGER_DELAY,
              ease: 'power2.out'
            }, 0);

            // Step 2: Brief pause - blur lingers after fade complete
            tl.to({}, { duration: 0.2 });

            // Step 3: NOW remove the blur (longer duration - blur lasts longer than fade)
            tl.to(children, {
              filter: 'blur(0px)',
              webkitFilter: 'blur(0px)',
              duration: 0.7, // Longer blur clear on mobile
              stagger: STAGGER_DELAY * 0.5,
              ease: 'power2.out'
            });
          } else {
            // Desktop or intro: original timing
            // Step 1: Fade in children while KEEPING blur (blur visible during fade)
            tl.to(children, {
              opacity: 1,
              // Keep blur at BLUR_AMOUNT - don't change it yet
              duration: 0.4,
              stagger: STAGGER_DELAY,
              ease: 'power2.out'
            }, 0);

            // Step 2: Brief pause - blur lingers after fade complete
            tl.to({}, { duration: 0.3 });

            // Step 3: NOW remove the blur (content comes into focus)
            tl.to(children, {
              filter: 'blur(0px)',
              webkitFilter: 'blur(0px)',
              duration: 0.5,
              stagger: STAGGER_DELAY * 0.5,
              ease: 'power2.out'
            });
          }
        } else {
          // Drop in children with stagger
          tl.to(children, {
            y: 0,
            duration: ANIMATION_DURATION_IN,
            stagger: STAGGER_DELAY,
            ease: EASE_CURVE
          }, STAGGER_DELAY);
        }
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
