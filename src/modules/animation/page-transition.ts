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
import { debounce } from '../../utils/dom-utils';
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

/**
 * Map-tile direction for each map page. Pages not in this map are
 * "off-map" (project-detail, portal-login, admin-login) and use the
 * existing blur-swap transition instead of camera tweens.
 */
const MAP_TILES = {
  intro: 'center',
  hero: 'left',
  about: 'up',
  projects: 'right',
  contact: 'down'
} as const;

type MapTile = (typeof MAP_TILES)[keyof typeof MAP_TILES];

/**
 * Camera transform percentages per tile (xPercent, yPercent on .site-map).
 * Translating the container moves whichever tile sits opposite the named
 * direction into the viewport. E.g., camera="up" translates by yPercent: 100,
 * which pushes the container down so the tile positioned at top:-100% becomes
 * visible.
 */
const CAMERA_POSITIONS: Record<MapTile, { x: number; y: number }> = {
  center: { x: 0, y: 0 },
  up: { x: 0, y: 100 },
  down: { x: 0, y: -100 },
  left: { x: 100, y: 0 },
  right: { x: -100, y: 0 }
};

export class PageTransitionModule extends BaseModule {
  private container: HTMLElement | null = null;
  private siteMap: HTMLElement | null = null;
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

  // Bound handler for proper cleanup
  private boundHandleHashChange: (() => void) | null = null;

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

    // Cache scroll-map container (Phase B). May be null if the page hasn't
    // been migrated to the scroll-map structure — in that case map-page
    // transitions fall back to the existing blur-swap.
    this.siteMap = this.container.querySelector('.site-map') as HTMLElement;

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
        id: 'project-detail',
        route: '#/projects/',
        title: 'Project - No Bhad Codes'
      },
      {
        id: 'contact',
        route: '#/contact',
        title: 'Contact - No Bhad Codes'
      },
      {
        id: 'admin-login',
        route: '#/admin-login',
        title: 'Admin Login - No Bhad Codes'
      },
      {
        id: 'portal-login',
        route: '#/portal',
        title: 'Portal - No Bhad Codes'
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
   * Whether a page is part of the scroll-map (intro/hero/about/projects/contact).
   * Off-map pages (project-detail, portal-login, admin-login) use the blur-swap
   * transition.
   */
  private isMapPage(pageId: string): boolean {
    return pageId in MAP_TILES;
  }

  /**
   * Move the scroll-map camera to a tile direction. When `animated` is false
   * (initial load, off-map → map snap, reduced-motion users), the position
   * is set instantly with no tween. The data-map-camera attribute is also
   * updated so the static CSS fallback stays in sync with the JS-driven state.
   */
  private async moveCamera(tile: MapTile, animated: boolean): Promise<void> {
    if (!this.siteMap) return;

    const pos = CAMERA_POSITIONS[tile];
    this.siteMap.setAttribute('data-map-camera', tile);

    if (!animated || this.reducedMotion) {
      gsap.set(this.siteMap, { xPercent: pos.x, yPercent: pos.y });
      return;
    }

    await new Promise<void>((resolve) => {
      gsap.to(this.siteMap, {
        xPercent: pos.x,
        yPercent: pos.y,
        duration: PAGE_ANIMATION.DURATION,
        ease: PAGE_ANIMATION.EASE_OUT,
        onComplete: resolve
      });
    });
  }

  /**
   * Hide only the off-map pages (project-detail, portal-login). Map tiles
   * stay rendered inside .site-map; the camera transform controls which
   * one is in view.
   */
  private hideOffMapPages(): void {
    this.pages.forEach((page) => {
      if (!page.element || this.isMapPage(page.id)) return;
      gsap.killTweensOf(page.element);
      gsap.set(page.element, { clearProps: 'all' });
      page.element.classList.add('page-hidden');
      page.element.classList.remove('page-active');
    });
  }

  /**
   * Set the scroll-map container's display based on whether the active page
   * is a map tile. When an off-map page is active, hide .site-map entirely
   * so its content doesn't bleed through.
   */
  private setSiteMapVisibility(visible: boolean): void {
    if (!this.siteMap) return;
    if (visible) {
      this.siteMap.style.removeProperty('display');
    } else {
      this.siteMap.style.display = 'none';
    }
  }

  /**
   * Update main's data-active-page attribute. CSS uses this to scope
   * `overflow-y: auto` to off-map pages (map tiles lock vertical scroll
   * because they're viewport-sized and the camera handles navigation).
   */
  private updateActivePageAttribute(pageId: string): void {
    if (this.container) {
      this.container.dataset.activePage = pageId;
    }
  }

  /**
   * Initialize all pages based on current hash. Map tiles always render
   * (camera shows the right one); off-map pages display-swap.
   */
  private initializePageStates(): void {
    const hash = window.location.hash;
    const initialPageId = this.getPageIdFromHash(hash) || 'intro';

    this.log(`Initializing page states, hash: ${hash}, initialPageId: ${initialPageId}`);

    this.pages.forEach((page, id) => {
      if (!page.element) return;

      if (this.isMapPage(id)) {
        // Map tile: always rendered. Strip page-hidden/page-active so the
        // critical CSS rules (which still apply to non-map sections) don't
        // accidentally hide it via inheritance.
        page.element.classList.remove('page-hidden');
        page.element.classList.remove('page-active');
        gsap.set(page.element, { clearProps: 'all' });
      } else if (id === initialPageId) {
        // Off-map page is the initial: show it
        page.element.classList.remove('page-hidden');
        page.element.classList.add('page-active');
        gsap.set(page.element, { opacity: 1, filter: 'none', visibility: 'visible' });
      } else {
        // Off-map page is not initial: hide it
        gsap.set(page.element, { clearProps: 'all' });
        page.element.classList.add('page-hidden');
        page.element.classList.remove('page-active');
      }
    });

    this.currentPageId = initialPageId;

    // Position the scroll-map camera + show/hide .site-map based on initial
    if (this.isMapPage(initialPageId)) {
      this.setSiteMapVisibility(true);
      this.moveCamera(MAP_TILES[initialPageId as keyof typeof MAP_TILES], false);
    } else {
      this.setSiteMapVisibility(false);
    }

    this.updateActivePageAttribute(initialPageId);

    this.log(`Initial page set: ${this.currentPageId}`);
  }

  /**
   * Setup event listeners for navigation
   */
  private setupEventListeners(): void {
    // Listen for router navigation events
    this.on('router:navigate', ((event: CustomEvent) => {
      const { pageId } = event.detail || {};
      this.log('[PageTransitionModule] router:navigate received', {
        pageId,
        introComplete: this.introComplete,
        currentPageId: this.currentPageId
      });

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

    // Listen for hash changes (store bound reference for cleanup)
    this.boundHandleHashChange = this.handleHashChange.bind(this);
    window.addEventListener('hashchange', this.boundHandleHashChange);

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
    // Strip query string from hash path (e.g. 'portal?session=expired' → 'portal')
    const cleanPath = path.split('?')[0];

    // Check for project detail routes (#/projects/slug)
    if (cleanPath.startsWith('projects/') && cleanPath !== 'projects/') {
      return 'project-detail';
    }

    const hashToPage: Record<string, string> = {
      '': 'intro',
      intro: 'intro',
      home: 'intro',
      about: 'about',
      projects: 'projects',
      contact: 'contact',
      'admin-login': 'admin-login',
      'portal': 'portal-login'
    };

    return hashToPage[cleanPath] || null;
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
   * Transition to a page. Branches on whether the from/to pages are part of
   * the scroll-map (intro/hero/about/projects/contact) or off-map (project-
   * detail, portal-login).
   *
   * - map → map: pure camera tween (no blur, no hide). Paw still plays on
   *   intro exits (Phase D will refine this to first-load-only).
   * - off-map involved: existing blur model + show/hide of .site-map.
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
      const fromIsMap = this.isMapPage(this.currentPageId);
      const toIsMap = this.isMapPage(pageId);
      const fromIsIntro = this.currentPageId === 'intro';

      if (fromIsMap && toIsMap && this.siteMap) {
        // ============================================
        // MAP → MAP — pure camera tween
        // ============================================
        // Intro exits still play paw (Phase D will gate to first-load only).
        if (fromIsIntro) {
          await this.playIntroExitAnimation();
        }
        await this.moveCamera(MAP_TILES[pageId as keyof typeof MAP_TILES], true);
      } else {
        // ============================================
        // OFF-MAP INVOLVED — blur model + site-map show/hide
        // ============================================

        // Exit current page: paw if leaving intro, blur otherwise
        if (fromIsIntro) {
          await this.playIntroExitAnimation();
        } else if (currentPage && currentPage.element && !this.isMapPage(this.currentPageId)) {
          await this.animateOut(currentPage);
        } else if (currentPage && currentPage.element && this.isMapPage(this.currentPageId)) {
          // Leaving a map tile to off-map: blur out the visible tile
          await this.animateOut(currentPage);
        }

        // Hide all off-map pages so the target is the only off-map showing
        this.hideOffMapPages();

        if (toIsMap && this.siteMap) {
          // Going TO a map tile from off-map: show .site-map and snap camera
          this.setSiteMapVisibility(true);
          this.moveCamera(MAP_TILES[pageId as keyof typeof MAP_TILES], false);
          // Map tile is already rendered; no animateIn needed.
        } else {
          // Going to off-map: hide .site-map so it doesn't bleed through
          this.setSiteMapVisibility(false);

          // Standard off-map blur-in entry
          targetPage.element.classList.add('page-entering');
          targetPage.element.classList.remove('page-hidden');
          targetPage.element.classList.add('page-active');
          gsap.set(targetPage.element, {
            opacity: 0,
            visibility: 'hidden',
            filter: `blur(${PAGE_ANIMATION.BLUR_AMOUNT}px)`
          });
          targetPage.element.classList.remove('page-entering');
          await this.animateIn(targetPage);
        }
      }

      // Update state
      this.currentPageId = pageId;
      this.updateActivePageAttribute(pageId);

      // Update document title
      if (targetPage.title) {
        document.title = targetPage.title;
      }

      // Dispatch page changed event (both internally and as window event)
      this.dispatchEvent('page-changed', {
        from: currentPage?.id,
        to: pageId
      });
      window.dispatchEvent(
        new CustomEvent('page-changed', {
          detail: { from: currentPage?.id, to: pageId }
        })
      );

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
   * HIDE ALL PAGES
   * ============================================
   * Explicitly hide ALL pages before showing target.
   * This prevents any page (especially intro) from overlapping the target.
   */
  private hideAllPages(): void {
    this.pages.forEach((page) => {
      if (page.element) {
        // Kill any running animations on this page
        gsap.killTweensOf(page.element);
        gsap.set(page.element, { clearProps: 'all' });
        page.element.classList.add('page-hidden');
        page.element.classList.remove('page-active');

        // Special handling for intro page - forcefully hide everything
        if (page.id === 'intro') {
          const businessCardContainer = page.element.querySelector(
            '.business-card-container'
          ) as HTMLElement;
          const introNav = page.element.querySelector('.intro-nav') as HTMLElement;
          const businessCardEl = page.element.querySelector('.business-card') as HTMLElement;

          // Kill all animations on intro children
          if (businessCardContainer) {
            gsap.killTweensOf(businessCardContainer);
            gsap.set(businessCardContainer, { clearProps: 'all' });
            businessCardContainer.style.display = 'none';
            businessCardContainer.style.visibility = 'hidden';
            businessCardContainer.style.opacity = '0';
          }
          if (introNav) {
            gsap.killTweensOf(introNav);
            gsap.set(introNav, { clearProps: 'all' });
            introNav.style.display = 'none';
            introNav.style.visibility = 'hidden';
            introNav.style.opacity = '0';
          }
          if (businessCardEl) {
            gsap.killTweensOf(businessCardEl);
            gsap.set(businessCardEl, { clearProps: 'all' });
            businessCardEl.style.display = 'none';
            businessCardEl.style.visibility = 'hidden';
            businessCardEl.style.opacity = '0';
          }

          // Also forcefully hide the section itself
          page.element.style.display = 'none';
          page.element.style.visibility = 'hidden';
          page.element.style.opacity = '0';
          page.element.style.pointerEvents = 'none';
          page.element.style.zIndex = '-1';
        }
      }
    });
    this.log('All pages hidden');
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
      const introModule = (await container.resolve('IntroAnimationModule')) as IntroAnimationModule;
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
      const introModule = (await container.resolve('IntroAnimationModule')) as IntroAnimationModule;

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
    if (this.boundHandleHashChange) {
      window.removeEventListener('hashchange', this.boundHandleHashChange);
      this.boundHandleHashChange = null;
    }
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
