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
const BLUR_AMOUNT = 20; // pixels - visible blur effect during fade animations

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
    const initialPageId = this.isMobile ? 'intro' : (this.getPageIdFromHash(hash) || 'intro');

    this.pages.forEach((page, id) => {
      if (!page.element) return;

      if (id === initialPageId) {
        page.element.classList.add('page-active');
        page.element.classList.remove('page-hidden');
        this.currentPageId = id;
      } else {
        page.element.classList.add('page-hidden');
        page.element.classList.remove('page-active');
      }
    });

    if (this.isMobile && hash && hash !== '#/' && hash !== '#') {
      window.history.replaceState({}, '', '#/');
    }

    this.log(`Initial page: ${this.currentPageId}`);
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
      if (this.isTransitioning) return;

      const { pageId } = event.detail || {};
      if (pageId && this.introComplete) {
        if (pageId === this.currentPageId) return;
        this.transitionTo(pageId);
      } else if (!this.introComplete) {
        this.warn('Navigation blocked - intro not complete');
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
   * Handle animating the initial page if it's not intro and needs blur animation
   */
  private async handleInitialPageAnimation(): Promise<void> {
    if (!this.currentPageId || this.currentPageId === 'intro') return;

    const currentPage = this.pages.get(this.currentPageId);
    if (!currentPage?.useFadeOnly || !currentPage.element) return;

    currentPage.element.classList.remove('page-hidden');
    currentPage.element.classList.add('page-active');

    const displayValue = (this.currentPageId === 'contact' || this.currentPageId === 'about') ? 'grid' : undefined;
    gsap.set(currentPage.element, {
      visibility: 'visible',
      opacity: 0,
      ...(displayValue && { display: displayValue })
    });

    const children = this.getAnimatableChildren(currentPage);
    if (children.length > 0) {
      gsap.set(children, {
        opacity: 0,
        filter: `blur(${BLUR_AMOUNT}px)`,
        webkitFilter: `blur(${BLUR_AMOUNT}px)`
      });
    }

    await this.animateIn(currentPage);
  }

  /**
   * Listen for intro animation completion
   */
  private listenForIntroComplete(): void {
    const handleIntroComplete = (async () => {
      this.introComplete = true;
      this.log('Intro complete - page transitions enabled');
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
    if (pageId === this.currentPageId || this.isTransitioning) return;
    if (this.isMobile && !this.enableOnMobile) return;

    const targetPage = this.pages.get(pageId);
    const currentPage = this.pages.get(this.currentPageId);

    if (!targetPage || !targetPage.element) {
      this.warn(`Target page not found: ${pageId}`);
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
      if (this.currentPageId === 'intro') {
        await this.playIntroExitAnimation();
      } else if (currentPage && currentPage.element) {
        await this.animateOut(currentPage);
      }

      // Hide current page after animation
      if (currentPage && currentPage.element) {
        currentPage.element.classList.add('page-hidden');
        currentPage.element.classList.remove('page-active');
      }

      // Show and prepare target page
      if (pageId !== 'intro') {
        this.prepareTargetPage(targetPage, pageId);
      }
      if (targetPage.skipAnimation) {
        targetPage.element.style.display = '';
        targetPage.element.style.visibility = '';
        targetPage.element.style.opacity = '';
      }

      // Animate in target page
      if (pageId === 'intro') {
        await this.playIntroEntryAnimation();
      } else {
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
   */
  private prepareTargetPage(targetPage: PageConfig, pageId: string): void {
    if (!targetPage.element) return;

    targetPage.element.classList.remove('page-hidden');
    targetPage.element.classList.add('page-active');

    const displayValue = (pageId === 'contact' || pageId === 'about') ? 'grid' : undefined;
    gsap.set(targetPage.element, {
      visibility: 'visible',
      opacity: 0,
      ...(displayValue && { display: displayValue })
    });

    if (targetPage.useFadeOnly) {
      const children = this.getAnimatableChildren(targetPage);
      if (children.length > 0) {
        gsap.set(children, {
          opacity: 0,
          filter: `blur(${BLUR_AMOUNT}px)`,
          webkitFilter: `blur(${BLUR_AMOUNT}px)`
        });
      }
    }
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
        gsap.set(introPage.element, { clearProps: 'display,visibility,opacity,zIndex,pointerEvents' });

        const introChildren = introPage.element.querySelectorAll('.business-card-container, .business-card, .intro-nav');
        if (introChildren.length > 0) {
          gsap.set(introChildren, { clearProps: 'opacity,visibility,display' });
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
    if (introNav) introNav.style.opacity = '1';
  }

  /**
   * Animate page out (blur-out + optional drop-out)
   */
  private async animateOut(page: PageConfig): Promise<void> {
    if (!page.element || page.skipAnimation) return;

    if (this.reducedMotion) {
      gsap.set(page.element, { opacity: 0, visibility: 'hidden' });
      return;
    }

    const useFadeOnly = page.useFadeOnly === true;

    // Add .leaving class to CSS-animated stagger items for exit animations
    const staggerItems = page.element.querySelectorAll('.stagger-item, .stagger-blur, .intro-nav-link, .input-item, .p-wrapper p, .heading-wrapper h2');
    staggerItems.forEach(item => item.classList.add('leaving'));

    const children = this.getAnimatableChildren(page);

    // Ensure children start in correct state (visible, no blur) before exit animation
    // This ensures the reverse animation (blur then fade) works correctly
    if (children.length > 0 && useFadeOnly) {
      gsap.set(children, {
        opacity: 1,
        filter: 'blur(0px)',
        webkitFilter: 'blur(0px)'
      });
    }

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

      // Animate children out
      if (children.length > 0) {
        if (useFadeOnly) {
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
      }

      // Fade out container
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
   */
  private async animateIn(page: PageConfig): Promise<void> {
    if (!page.element) return;

    if (page.skipAnimation || this.reducedMotion) {
      gsap.set(page.element, { opacity: 1, visibility: 'visible', filter: 'none' });
      return;
    }

    const children = this.getAnimatableChildren(page);
    const useFadeOnly = page.useFadeOnly === true;

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

          // Dispatch event when contact page blur animation completes
          // This allows ContactAnimationModule to start form animations
          if (page.id === 'contact') {
            this.dispatchEvent('contact-page-ready', { pageId: page.id });
            console.log('[PageTransition] Contact page blur animation complete - form animations can start');
          }

          resolve();
        }
      });

      // Fade in container FIRST to ensure it's visible before children animation
      // CSS handles display via .page-active class
      tl.set(page.element, {
        visibility: 'visible'
        // display is handled by CSS .page-active rules
      });
      tl.set(page.element, {
        opacity: 1
      }, 0);

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
            }, 0.1); // Start slightly after page element is visible

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
            // Desktop: fade in while blurred, pause, then clear blur
            tl.to(children, {
              opacity: 1,
              duration: 0.6,
              stagger: STAGGER_DELAY,
              ease: 'power2.out'
            }, 0.1);

            tl.to({}, { duration: 0.4 });

            tl.to(children, {
              filter: 'blur(0px)',
              webkitFilter: 'blur(0px)',
              duration: 0.7,
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
