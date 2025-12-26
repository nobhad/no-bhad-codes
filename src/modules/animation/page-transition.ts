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
 * - GSAP flip-clock and slide animations
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
        // Get h2/hr elements FIRST
        const h2 = page.element.querySelector('h2') as HTMLElement;
        const hr = page.element.querySelector('hr') as HTMLElement;

        // Set h2/hr to hidden starting positions BEFORE making page visible
        // This prevents the flash of visible elements
        if (h2 && id !== 'intro') {
          gsap.set(h2, { yPercent: -105, clipPath: 'inset(0 0 0 0)' });
        }
        if (hr && id !== 'intro') {
          gsap.set(hr, { scale: 0, transformOrigin: 'bottom left' });
        }

        // Now show the initial page
        page.element.classList.remove('page-hidden');
        page.element.classList.add('page-active');
        gsap.set(page.element, { opacity: 1, filter: 'none', visibility: 'visible' });
        this.currentPageId = id;
        this.log(`Showing initial page: ${id}`);

        // About page: UNIFORM h2/hr + flip-clock animation on initial load
        if (id === 'about') {
          const textWrapper = page.element.querySelector('.about-text-wrapper') as HTMLElement;
          const techStack = page.element.querySelector('.tech-stack-desktop') as HTMLElement;

          // h2 drops in from above (already set to hidden position above)
          if (h2) {
            gsap.to(h2, {
              yPercent: 0,
              duration: this.TRANSITION_DURATION,
              delay: 0.4,
              ease: this.TRANSITION_EASE
            });
          }

          // hr scales in from left - starts 0.1s after h2 for better visual sequence
          if (hr) {
            gsap.to(hr, {
              scale: 1,
              duration: this.TRANSITION_DURATION_LONG,
              delay: 0.5,
              ease: this.TRANSITION_EASE
            });
          }

          // Text wrapper flips down from top
          if (textWrapper) {
            gsap.set(textWrapper, {
              rotateX: -90,
              opacity: 1,
              transformOrigin: 'top center',
              transformStyle: 'preserve-3d'
            });
            gsap.to(textWrapper, {
              rotateX: 0,
              duration: this.TRANSITION_DURATION_LONG,
              delay: 0.5,
              ease: this.TRANSITION_EASE
            });
          }

          // Tech stack flips up from bottom
          if (techStack) {
            gsap.set(techStack, {
              rotateX: 90,
              opacity: 1,
              transformOrigin: 'bottom center',
              transformStyle: 'preserve-3d'
            });
            gsap.to(techStack, {
              rotateX: 0,
              duration: this.TRANSITION_DURATION_LONG,
              delay: 0.6,
              ease: this.TRANSITION_EASE
            });
          }
        }

        // Projects page: UNIFORM h2/hr + blur-in content on initial load
        if (id === 'projects') {
          const projectsContent = page.element.querySelector('.projects-content') as HTMLElement;

          // h2 drops in from above (already set to hidden position above)
          if (h2) {
            gsap.to(h2, {
              yPercent: 0,
              duration: this.TRANSITION_DURATION,
              delay: 0.4,
              ease: this.TRANSITION_EASE
            });
          }

          // hr scales in from left - starts 0.1s after h2 for better visual sequence
          if (hr) {
            gsap.to(hr, {
              scale: 1,
              duration: this.TRANSITION_DURATION_LONG,
              delay: 0.5,
              ease: this.TRANSITION_EASE
            });
          }

          // Content blurs in (excluding h2/hr)
          if (projectsContent) {
            const otherContent = projectsContent.querySelectorAll(':scope > *:not(h2):not(hr)');
            otherContent.forEach((el) => {
              gsap.set(el, { opacity: 0, filter: `blur(${this.BLUR_AMOUNT}px)` });
              gsap.to(el, {
                opacity: 1,
                filter: 'blur(0px)',
                duration: this.TRANSITION_DURATION_LONG,
                delay: 0.5,
                ease: this.TRANSITION_EASE
              });
            });
          }
        }

        // Contact page: UNIFORM h2/hr + blur-in content on initial load
        if (id === 'contact') {
          const contactLayout = page.element.querySelector('.contact-layout') as HTMLElement;

          // h2 drops in from above (already set to hidden position above)
          if (h2) {
            gsap.to(h2, {
              yPercent: 0,
              duration: this.TRANSITION_DURATION,
              delay: 0.4,
              ease: this.TRANSITION_EASE
            });
          }

          // hr scales in from left - starts 0.1s after h2 for better visual sequence
          if (hr) {
            gsap.to(hr, {
              scale: 1,
              duration: this.TRANSITION_DURATION_LONG,
              delay: 0.5,
              ease: this.TRANSITION_EASE
            });
          }

          // Contact layout blurs in
          if (contactLayout) {
            gsap.set(contactLayout, { opacity: 0, filter: `blur(${this.BLUR_AMOUNT}px)` });
            gsap.to(contactLayout, {
              opacity: 1,
              filter: 'blur(0px)',
              duration: this.TRANSITION_DURATION_LONG,
              delay: 0.6,
              ease: this.TRANSITION_EASE
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

    // Show transition overlay - skip for intro and about (about has visible exit animation)
    if (this.currentPageId !== 'intro' && this.currentPageId !== 'about' && pageId !== 'intro') {
      this.showTransitionOverlay();
    }

    try {
      // Special case: about ↔ contact (seamless overlapping transitions)
      if (this.currentPageId === 'about' && pageId === 'contact') {
        await this.playAboutToContactTransition(currentPage!, targetPage);
      } else if (this.currentPageId === 'contact' && pageId === 'about') {
        await this.playContactToAboutTransition(currentPage!, targetPage);
      } else {
        // Hide target page during exit animation to prevent it showing through
        if (targetPage.element && pageId !== 'intro') {
          gsap.set(targetPage.element, { visibility: 'hidden', opacity: 0 });
        }

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

  // Page transition animation constants
  private readonly TRANSITION_EASE = 'power2.out';
  private readonly TRANSITION_EASE_EXIT = 'power2.in';
  private readonly TRANSITION_DURATION = 0.5;
  private readonly TRANSITION_DURATION_LONG = 0.8;
  private readonly BLUR_AMOUNT = 8;

  /**
   * Animate page out with uniform h2/hr animations + page-specific content
   * UNIFORM: h2 drop-out with clipPath, hr scale-out from bottom left
   */
  private async animateOut(page: PageConfig): Promise<void> {
    if (!page.element || page.skipAnimation) return;

    // Get common elements (uniform across all pages)
    const h2 = page.element.querySelector('h2') as HTMLElement;
    const hr = page.element.querySelector('hr') as HTMLElement;

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });

      // === UNIFORM: h2 drops out with clipPath ===
      if (h2) {
        gsap.set(h2, { clipPath: 'inset(0 0 0 0)' }); // Reset before animating out
        tl.to(h2, {
          yPercent: 105,
          clipPath: 'inset(100% 0 0 0)',
          duration: this.TRANSITION_DURATION,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // === UNIFORM: hr scales out from bottom left ===
      if (hr) {
        gsap.set(hr, { transformOrigin: 'bottom left' });
        tl.to(hr, {
          scale: 0,
          duration: this.TRANSITION_DURATION,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // === PAGE-SPECIFIC CONTENT ANIMATIONS ===
      if (page.id === 'about') {
        const textWrapper = page.element!.querySelector('.about-text-wrapper') as HTMLElement;
        const techStack = page.element!.querySelector('.tech-stack-desktop') as HTMLElement;

        // Text wrapper flips out
        if (textWrapper) {
          gsap.set(textWrapper, { transformOrigin: 'top center', transformStyle: 'preserve-3d' });
          tl.to(textWrapper, {
            rotateX: -90,
            duration: this.TRANSITION_DURATION,
            ease: this.TRANSITION_EASE_EXIT
          }, 0);
        }

        // Tech stack flips out
        if (techStack) {
          gsap.set(techStack, { transformOrigin: 'bottom center', transformStyle: 'preserve-3d' });
          tl.to(techStack, {
            rotateX: 90,
            duration: this.TRANSITION_DURATION,
            ease: this.TRANSITION_EASE_EXIT
          }, 0);
        }
      } else if (page.id === 'contact') {
        // Get all contact form elements
        const inputItems = page.element!.querySelectorAll('.input-item');
        const submitButton = page.element!.querySelector('.submit-button') as HTMLElement;
        const businessCard = page.element!.querySelector('.contact-card-column') as HTMLElement;
        const contactOptions = page.element!.querySelector('.contact-options') as HTMLElement;

        // Input fields drop out with staggered delays
        if (inputItems.length > 0) {
          inputItems.forEach((item, index) => {
            const el = item as HTMLElement;
            tl.to(el, {
              yPercent: 105,
              duration: 0.5,
              ease: this.TRANSITION_EASE
            }, index * 0.05); // 0ms, 0.05s, 0.1s, 0.15s stagger
          });
        }

        // Submit button slides out to right (0.8s duration, 0ms delay)
        if (submitButton) {
          tl.to(submitButton, {
            x: 800,
            opacity: 0,
            duration: 0.8,
            ease: this.TRANSITION_EASE
          }, 0);
        }

        // Contact options text fades out with blur (0.5s duration, 0ms delay)
        if (contactOptions) {
          tl.to(contactOptions, {
            opacity: 0,
            filter: 'blur(8px)',
            duration: 0.5,
            ease: this.TRANSITION_EASE
          }, 0);
        }

        // Business card column fades out with blur (0.5s duration, 0ms delay)
        if (businessCard) {
          tl.to(businessCard, {
            opacity: 0,
            filter: 'blur(8px)',
            duration: 0.5,
            ease: this.TRANSITION_EASE
          }, 0);
        }
      } else if (page.id === 'projects') {
        const projectsContent = page.element!.querySelector('.projects-content') as HTMLElement;

        // Projects content blurs out (excluding h2/hr which are handled above)
        if (projectsContent) {
          // Find elements that are NOT h2 or hr
          const otherContent = projectsContent.querySelectorAll(':scope > *:not(h2):not(hr)');
          otherContent.forEach((el) => {
            tl.to(el, {
              opacity: 0,
              filter: `blur(${this.BLUR_AMOUNT}px)`,
              duration: this.TRANSITION_DURATION,
              ease: this.TRANSITION_EASE
            }, 0);
          });
        }
      } else {
        // === DEFAULT: blur out content ===
        const content = page.element!.querySelector('[class*="-content"]') as HTMLElement;
        if (content) {
          tl.to(content, {
            opacity: 0,
            filter: `blur(${this.BLUR_AMOUNT}px)`,
            duration: this.TRANSITION_DURATION,
            ease: this.TRANSITION_EASE
          }, 0);
        }
      }
    });

    gsap.set(page.element, { opacity: 0, visibility: 'hidden' });
  }

  /**
   * Animate page in with UNIFORM h2/hr animations + page-specific content
   * UNIFORM: h2 drop-in, hr scale-in from bottom left
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

    // Get common elements (uniform across all pages)
    const h2 = sectionEl.querySelector('h2') as HTMLElement;
    const hr = sectionEl.querySelector('hr') as HTMLElement;

    // === UNIFORM: Clear any lingering properties from exit animations ===
    if (h2) {
      gsap.set(h2, { clearProps: 'clipPath,yPercent' });
    }
    if (hr) {
      gsap.set(hr, { clearProps: 'scale,transformOrigin' });
    }

    // === ABOUT PAGE: UNIFORM h2/hr + flip-clock for content ===
    if (page.id === 'about') {
      const textWrapper = sectionEl.querySelector('.about-text-wrapper') as HTMLElement;
      const techStack = sectionEl.querySelector('.tech-stack-desktop') as HTMLElement;

      // === UNIFORM: h2 drops in from above ===
      if (h2) {
        gsap.set(h2, { yPercent: -105, clipPath: 'inset(0 0 0 0)' });
        gsap.to(h2, {
          yPercent: 0,
          duration: this.TRANSITION_DURATION,
          delay: 0,
          ease: this.TRANSITION_EASE
        });
      }

      // === UNIFORM: hr scales in from bottom left ===
      if (hr) {
        gsap.set(hr, { scale: 0, transformOrigin: 'bottom left' });
        gsap.to(hr, {
          scale: 1,
          duration: this.TRANSITION_DURATION_LONG,
          delay: 0,
          ease: this.TRANSITION_EASE
        });
      }

      // Text wrapper flips down from top
      if (textWrapper) {
        gsap.set(textWrapper, {
          rotateX: -90,
          opacity: 1,
          transformOrigin: 'top center',
          transformStyle: 'preserve-3d'
        });
        gsap.to(textWrapper, {
          rotateX: 0,
          duration: this.TRANSITION_DURATION_LONG,
          delay: 0.1,
          ease: this.TRANSITION_EASE
        });
      }

      // Tech stack flips up from bottom
      if (techStack) {
        gsap.set(techStack, {
          rotateX: 90,
          opacity: 1,
          transformOrigin: 'bottom center',
          transformStyle: 'preserve-3d'
        });
        gsap.to(techStack, {
          rotateX: 0,
          duration: this.TRANSITION_DURATION_LONG,
          delay: 0.2,
          ease: this.TRANSITION_EASE
        });
      }
    }

    // === PROJECTS PAGE: UNIFORM h2/hr + blur-in content ===
    if (page.id === 'projects') {
      const projectsContent = sectionEl.querySelector('.projects-content') as HTMLElement;

      // === UNIFORM: h2 drops in from above ===
      if (h2) {
        gsap.set(h2, { yPercent: -105, clipPath: 'inset(0 0 0 0)' });
        gsap.to(h2, {
          yPercent: 0,
          duration: this.TRANSITION_DURATION,
          delay: 0.4,
          ease: this.TRANSITION_EASE
        });
      }

      // === UNIFORM: hr scales in from bottom left ===
      if (hr) {
        gsap.set(hr, { scale: 0, transformOrigin: 'bottom left' });
        gsap.to(hr, {
          scale: 1,
          duration: this.TRANSITION_DURATION_LONG,
          delay: 0.4,
          ease: this.TRANSITION_EASE
        });
      }

      // Content blurs in (excluding h2/hr)
      if (projectsContent) {
        const otherContent = projectsContent.querySelectorAll(':scope > *:not(h2):not(hr)');
        otherContent.forEach((el) => {
          gsap.set(el, { opacity: 0, filter: `blur(${this.BLUR_AMOUNT}px)` });
          gsap.to(el, {
            opacity: 1,
            filter: 'blur(0px)',
            duration: this.TRANSITION_DURATION_LONG,
            delay: 0.5,
            ease: this.TRANSITION_EASE
          });
        });
      }
    }

    // === CONTACT PAGE: Detailed staggered entry animations ===
    if (page.id === 'contact') {
      // Get all contact form elements
      const inputItems = sectionEl.querySelectorAll('.input-item');
      const submitButton = sectionEl.querySelector('.submit-button') as HTMLElement;
      const businessCard = sectionEl.querySelector('.contact-card-column') as HTMLElement;
      const contactOptions = sectionEl.querySelector('.contact-options') as HTMLElement;

      // h2 drops in from -110% (0.5s duration, 0.4s delay)
      if (h2) {
        gsap.set(h2, { yPercent: -110, clipPath: 'inset(0 0 0 0)' });
        gsap.to(h2, {
          yPercent: 0,
          duration: 0.5,
          delay: 0.4,
          ease: this.TRANSITION_EASE
        });
      }

      // hr scales in from left (0.8s duration, 0.4s delay)
      if (hr) {
        gsap.set(hr, { scaleX: 0, transformOrigin: 'left center' });
        gsap.to(hr, {
          scaleX: 1,
          duration: 0.8,
          delay: 0.4,
          ease: this.TRANSITION_EASE
        });
      }

      // Input fields drop in with staggered delays
      // Name: 0.5s, Company/Email: 0.6s, Email: 0.7s (based on order in DOM)
      if (inputItems.length > 0) {
        inputItems.forEach((item, index) => {
          const el = item as HTMLElement;
          const wrapper = el.closest('.input-wrapper') as HTMLElement;
          if (wrapper) {
            gsap.set(wrapper, { overflow: 'hidden' });
          }
          gsap.set(el, { yPercent: -105 });
          gsap.to(el, {
            yPercent: 0,
            duration: 0.5,
            delay: 0.5 + (index * 0.1), // 0.5s, 0.6s, 0.7s, 0.8s
            ease: this.TRANSITION_EASE
          });
        });
      }

      // Submit button slides in from right (0.8s duration, 0.8s delay)
      if (submitButton) {
        gsap.set(submitButton, { x: 800, opacity: 0 });
        gsap.to(submitButton, {
          x: 0,
          opacity: 1,
          duration: 0.8,
          delay: 0.8,
          ease: this.TRANSITION_EASE
        });
      }

      // Contact options text fades in with blur (0.5s duration, 1.2s delay)
      if (contactOptions) {
        gsap.set(contactOptions, { opacity: 0, filter: 'blur(8px)' });
        gsap.to(contactOptions, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          delay: 1.2,
          ease: this.TRANSITION_EASE
        });
      }

      // Business card column fades in with blur (0.5s duration, 1.2s delay)
      if (businessCard) {
        gsap.set(businessCard, { opacity: 0, filter: 'blur(8px)' });
        gsap.to(businessCard, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          delay: 1.2,
          ease: this.TRANSITION_EASE
        });
      }

      this.dispatchEvent('contact-page-ready', { pageId: page.id });
    }
  }

  /**
   * Seamless about → contact transition with overlapping animations
   */
  private async playAboutToContactTransition(
    aboutPage: PageConfig,
    contactPage: PageConfig
  ): Promise<void> {
    this.log('[PageTransitionModule] Playing seamless about→contact transition');

    const aboutEl = aboutPage.element!;
    const contactEl = contactPage.element!;

    // About elements
    const textWrapper = aboutEl.querySelector('.about-text-wrapper') as HTMLElement;
    const techStack = aboutEl.querySelector('.tech-stack-desktop') as HTMLElement;

    // Contact elements
    const h2 = contactEl.querySelector('h2') as HTMLElement;
    const hr = contactEl.querySelector('hr') as HTMLElement;
    const inputItems = contactEl.querySelectorAll('.input-item');
    const submitButton = contactEl.querySelector('.submit-button') as HTMLElement;
    const businessCard = contactEl.querySelector('.contact-card-column') as HTMLElement;
    const contactOptions = contactEl.querySelector('.contact-options') as HTMLElement;

    // Prepare contact page (visible but elements hidden in starting positions)
    contactEl.classList.remove('page-hidden');
    contactEl.classList.add('page-active');
    gsap.set(contactEl, { opacity: 1, visibility: 'visible' });

    // Clear and set starting positions for all contact elements
    if (h2) gsap.set(h2, { clearProps: 'clipPath,yPercent', yPercent: -110, clipPath: 'inset(0 0 0 0)' });
    if (hr) gsap.set(hr, { clearProps: 'scaleX', scaleX: 0, transformOrigin: 'left center' });
    inputItems.forEach((item) => {
      const wrapper = (item as HTMLElement).closest('.input-wrapper') as HTMLElement;
      if (wrapper) gsap.set(wrapper, { overflow: 'hidden' });
      gsap.set(item, { yPercent: -105 });
    });
    if (submitButton) gsap.set(submitButton, { x: 800, opacity: 0 });
    if (contactOptions) gsap.set(contactOptions, { opacity: 0, filter: 'blur(8px)' });
    if (businessCard) gsap.set(businessCard, { opacity: 0, filter: 'blur(8px)' });

    const overlapOffset = 0.2; // Start contact entry before about exit finishes

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });

      // === ABOUT EXIT (at position 0) ===
      // Text wrapper flips back up
      if (textWrapper) {
        gsap.set(textWrapper, { transformOrigin: 'top center', transformStyle: 'preserve-3d' });
        tl.to(textWrapper, {
          rotateX: -90,
          duration: this.TRANSITION_DURATION,
          ease: this.TRANSITION_EASE_EXIT
        }, 0);
      }

      // Tech stack flips back down
      if (techStack) {
        gsap.set(techStack, { transformOrigin: 'bottom center', transformStyle: 'preserve-3d' });
        tl.to(techStack, {
          rotateX: 90,
          duration: this.TRANSITION_DURATION,
          ease: this.TRANSITION_EASE_EXIT
        }, 0);
      }

      // === CONTACT ENTRY (overlapped - detailed staggered animations) ===
      const entryStart = this.TRANSITION_DURATION - overlapOffset;

      // h2 drops in from -110% (0.5s duration)
      if (h2) {
        tl.to(h2, {
          yPercent: 0,
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, entryStart);
      }

      // hr scales in from left (0.8s duration)
      if (hr) {
        tl.to(hr, {
          scaleX: 1,
          duration: 0.8,
          ease: this.TRANSITION_EASE
        }, entryStart);
      }

      // Input fields drop in with staggered delays
      inputItems.forEach((item, index) => {
        tl.to(item, {
          yPercent: 0,
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, entryStart + 0.1 + (index * 0.1));
      });

      // Submit button slides in from right
      if (submitButton) {
        tl.to(submitButton, {
          x: 0,
          opacity: 1,
          duration: 0.8,
          ease: this.TRANSITION_EASE
        }, entryStart + 0.4);
      }

      // Contact options text fades in with blur
      if (contactOptions) {
        tl.to(contactOptions, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, entryStart + 0.8);
      }

      // Business card fades in with blur
      if (businessCard) {
        tl.to(businessCard, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, entryStart + 0.8);
      }

      // Hide about page partway through
      tl.call(() => {
        gsap.set(aboutEl, { clearProps: 'all' });
        aboutEl.classList.add('page-hidden');
        aboutEl.classList.remove('page-active');
      }, [], this.TRANSITION_DURATION);
    });

    this.dispatchEvent('contact-page-ready', { pageId: 'contact' });
  }

  /**
   * Seamless contact → about transition with overlapping animations
   */
  private async playContactToAboutTransition(
    contactPage: PageConfig,
    aboutPage: PageConfig
  ): Promise<void> {
    this.log('[PageTransitionModule] Playing seamless contact→about transition');

    const contactEl = contactPage.element!;
    const aboutEl = aboutPage.element!;

    // Contact elements
    const h2 = contactEl.querySelector('h2') as HTMLElement;
    const hr = contactEl.querySelector('hr') as HTMLElement;
    const inputItems = contactEl.querySelectorAll('.input-item');
    const submitButton = contactEl.querySelector('.submit-button') as HTMLElement;
    const businessCard = contactEl.querySelector('.contact-card-column') as HTMLElement;
    const contactOptions = contactEl.querySelector('.contact-options') as HTMLElement;

    // About elements
    const textWrapper = aboutEl.querySelector('.about-text-wrapper') as HTMLElement;
    const techStack = aboutEl.querySelector('.tech-stack-desktop') as HTMLElement;

    // Prepare about page
    aboutEl.classList.remove('page-hidden');
    aboutEl.classList.add('page-active');
    gsap.set(aboutEl, { opacity: 1, visibility: 'visible' });

    // Set about elements to their starting positions
    if (textWrapper) {
      gsap.set(textWrapper, {
        rotateX: -90,
        opacity: 1,
        transformOrigin: 'top center',
        transformStyle: 'preserve-3d'
      });
    }
    if (techStack) {
      gsap.set(techStack, {
        rotateX: 90,
        opacity: 1,
        transformOrigin: 'bottom center',
        transformStyle: 'preserve-3d'
      });
    }

    const overlapOffset = 0.2;

    await new Promise<void>((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });

      // === CONTACT EXIT (detailed staggered animations) ===
      // h2 drops out with clipPath (0.5s duration, 0ms delay)
      if (h2) {
        gsap.set(h2, { clipPath: 'inset(0 0 0 0)' });
        tl.to(h2, {
          yPercent: 105,
          clipPath: 'inset(100% 0 0 0)',
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // hr scales out from left (0.5s duration, 0ms delay)
      if (hr) {
        gsap.set(hr, { transformOrigin: 'left center' });
        tl.to(hr, {
          scaleX: 0,
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // Input fields drop out with staggered delays
      inputItems.forEach((item, index) => {
        tl.to(item, {
          yPercent: 105,
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, index * 0.05);
      });

      // Submit button slides out to right (0.8s duration, 0ms delay)
      if (submitButton) {
        tl.to(submitButton, {
          x: 800,
          opacity: 0,
          duration: 0.8,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // Contact options text fades out with blur (0.5s duration, 0ms delay)
      if (contactOptions) {
        tl.to(contactOptions, {
          opacity: 0,
          filter: 'blur(8px)',
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // Business card fades out with blur (0.5s duration, 0ms delay)
      if (businessCard) {
        tl.to(businessCard, {
          opacity: 0,
          filter: 'blur(8px)',
          duration: 0.5,
          ease: this.TRANSITION_EASE
        }, 0);
      }

      // === ABOUT ENTRY (overlapped) ===
      const entryStart = this.TRANSITION_DURATION - overlapOffset;

      // Text wrapper flips down
      if (textWrapper) {
        tl.to(textWrapper, {
          rotateX: 0,
          duration: this.TRANSITION_DURATION_LONG,
          ease: this.TRANSITION_EASE
        }, entryStart);
      }

      // Tech stack flips up
      if (techStack) {
        tl.to(techStack, {
          rotateX: 0,
          duration: this.TRANSITION_DURATION_LONG,
          ease: this.TRANSITION_EASE
        }, entryStart + 0.1);
      }

      // Hide contact page partway through
      tl.call(() => {
        gsap.set(contactEl, { clearProps: 'all' });
        contactEl.classList.add('page-hidden');
        contactEl.classList.remove('page-active');
      }, [], this.TRANSITION_DURATION);
    });
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
