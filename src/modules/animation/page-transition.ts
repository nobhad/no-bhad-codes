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

/**
 * Neighbor graph for wheel + keyboard navigation. v1 keeps it simple:
 * the center tile (intro) connects to all four outer tiles, and outer
 * tiles only connect back to center. Diagonal hops (e.g., about → projects)
 * have to route through center via two inputs. Adding lateral neighbors
 * later is purely additive.
 */
type Direction = 'up' | 'down' | 'left' | 'right';

const NEIGHBORS: Record<string, Partial<Record<Direction, string>>> = {
  // 4-tile horizontal carousel including the landing page. Cycles forever
  // in both directions through every section:
  //
  //   forward (right):  intro → about → projects → contact → intro → ...
  //   backward (left):  intro → contact → projects → about → intro → ...
  //
  // Vertical from intro still enters projects directly (down) so users
  // who want the gallery without horizontal cycling can jump straight in.
  // Projects vertical channel-surfs the CRT TV (wraps within the list).
  // Landing page: horizontal-only. No vertical exit — the user
  // explicitly does NOT want scrolling down to drag them off the
  // business card. Use left/right (or the menu) to leave the page.
  intro: { left: 'contact', right: 'about' },
  about: { left: 'intro', right: 'projects' },
  contact: { left: 'projects', right: 'intro' },
  hero: { right: 'intro' },
  // projects: horizontal exits left/right to about/contact (the new chain);
  // vertical channel-surfs the TV (handled dynamically in
  // tryNavigateDirection). Up past the first channel exits back to intro;
  // down past the last channel wraps around within the TV list.
  projects: { left: 'about', right: 'contact' }
  // project-detail navigation is handled dynamically in tryNavigateDirection
  // because the previous/next neighbor depends on which slug is active.
  // Project-detail is entered by clicking a project card on the TV; it
  // isn't on the wheel/swipe path from projects anymore.
};

/**
 * Minimum |delta| (px) on a wheel event before it counts as a navigation
 * intent. Filters out tiny accidental trackpad twitches.
 */
const WHEEL_DELTA_THRESHOLD = 12;

/**
 * Cooldown (ms) after a transition before the next wheel event can fire
 * another navigation. Prevents trackpad flicks from chaining transitions.
 */
const WHEEL_COOLDOWN_MS = 250;

/**
 * How many recent hashes to remember for back/forward direction inference.
 * Two is enough to detect the most common case (user clicks back to the
 * previous page); the cap stops the stack from growing unbounded across
 * a long session.
 */
const NAV_HISTORY_CAP = 8;

/**
 * Swipe gesture thresholds. A finger has to travel at least this many
 * pixels in one direction AND complete the gesture within this many ms
 * for it to count as a navigation swipe. Slower or shorter gestures fall
 * through to native scrolling so users can still pan tile content.
 */
const SWIPE_DISTANCE_MIN_PX = 50;
const SWIPE_TIME_MAX_MS = 600;

export class PageTransitionModule extends BaseModule {
  private container: HTMLElement | null = null;
  private siteMap: HTMLElement | null = null;
  private pages: Map<string, PageConfig> = new Map();
  private currentPageId: string = '';
  private isTransitioning: boolean = false;
  private introComplete: boolean = false;

  /**
   * Phase D — paw plays only on the very first intro exit per session.
   * Initialized in initializePageStates: false if landing on intro (paw
   * entry will play and first exit gets paw), true if deep-linking to
   * any other page (no paw context exists, skip paw on intro exits).
   * Flipped to true after the first paw exit completes.
   */
  private hasPawHandoffOccurred: boolean = false;

  // Configuration
  private containerSelector: string;
  private enableOnMobile: boolean;
  private isMobile: boolean = false;

  // Debounced resize handler
  private debouncedHandleResize: (() => void) | null = null;

  // Bound handler for proper cleanup
  private boundHandleHashChange: (() => void) | null = null;
  private boundHandleWheel: ((event: WheelEvent) => void) | null = null;
  private boundHandleKeydown: ((event: KeyboardEvent) => void) | null = null;
  private boundHandleTouchStart: ((event: TouchEvent) => void) | null = null;
  private boundHandleTouchEnd: ((event: TouchEvent) => void) | null = null;

  /**
   * Touch tracking for swipe gesture recognition. Tracks start position
   * and time so handleTouchEnd can decide if the gesture was a real swipe
   * (fast enough + far enough in one direction) vs. a tap or slow drag.
   */
  private touchStart: { x: number; y: number; t: number } | null = null;

  /** Phase C: cooldown timestamp — wheel events before this are ignored. */
  private wheelCooldownUntil: number = 0;

  /**
   * Direction of the next hash-driven navigation when triggered by wheel or
   * keyboard input. Pinned to the target hash that set it so handleHashChange
   * can recognize a stale direction (set, then overwritten by a different
   * navigation, then the original hash event finally fires) and refuse to
   * use it. The freshness check is what makes rapid double-input safe.
   */
  private pendingSlideDirection: Direction | null = null;
  private pendingSlideForHash: string | null = null;

  /**
   * False until the user has navigated at least once after intro completes.
   * Used to scope the compass first-paint hint to a single forward cue
   * (so the affordance is "scroll DOWN to start" instead of a confusing
   * four-arrow puzzle). Flipped to true at the start of the first
   * transitionTo call.
   */
  private hasNavigated: boolean = false;

  /**
   * Set the pending slide direction together with the target hash it was
   * intended for. handleHashChange uses both fields to verify the direction
   * is fresh (matches the hash that just fired) before applying it. Any
   * mismatch means a newer navigation overwrote the field after the
   * original was set, so we discard the stale value.
   */
  private setPendingSlide(direction: Direction, targetHash: string): void {
    this.pendingSlideDirection = direction;
    this.pendingSlideForHash = targetHash;
  }

  /**
   * Recent navigation entries — each remembers the hash AND the direction
   * we slid in to reach it. On popstate (browser back/forward) we look up
   * the LEAVING entry's arrival direction and slide the OPPOSITE way, so
   * "back" always feels like a backward swipe. Without this, back from a
   * detail page would slide forward — exactly the gesture the user is
   * trying to undo.
   */
  private navHistory: { hash: string; arrivedVia: Direction | null }[] = [];

  /**
   * One-shot flag set by the popstate listener and consumed by the very
   * next handleHashChange. Lets us infer a backward slide direction for
   * user-initiated browser back/forward without affecting programmatic
   * hash changes (which never fire popstate).
   */
  private popstateInFlight: boolean = false;

  /**
   * Index of the project channel currently shown on the CRT TV when the
   * projects tile is active. Tracked here (not in ProjectsModule) because
   * vertical scroll on projects is gated through tryNavigateDirection,
   * which needs to know whether scrolling past the boundary should exit
   * the tile or just cycle the TV.
   */
  private currentTvIndex: number = 0;

  /**
   * Snapshot of the project-detail element captured before content swap, used
   * to slide the OLD card off-screen while the (re-rendered) real element
   * slides the NEW card in. Without this, project-detail → project-detail
   * navigation is single-element so you only see one card move at a time.
   */
  private outgoingDetailGhost: HTMLElement | null = null;

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
   * Hide the body-level intro morph overlay (the SVG that holds the
   * card-to-paw morph). The overlay should only be visible while the
   * intro animation is actively running — every other page state needs
   * it dismissed, otherwise its card content bleeds through onto other
   * tiles. Called from initializePageStates on deep-links and from
   * transitionTo whenever we settle on a non-intro page.
   */
  private hideMorphOverlay(): void {
    const morphOverlay = document.getElementById('intro-morph-overlay');
    if (!morphOverlay) return;
    morphOverlay.classList.add('hidden');
    morphOverlay.style.visibility = 'hidden';
    morphOverlay.style.pointerEvents = 'none';
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
   * Snap the intro tile's card + nav back to their visible center state
   * without replaying the paw entry animation. Used when the camera tweens
   * back to the intro tile from another map tile after a previous paw exit
   * left the card translated off-screen.
   */
  private restoreIntroCardState(): void {
    // Reset the morphing SVG card back to center (exit animation translated it
    // off-screen with the paw at x: -1500, y: -1200).
    const svgCard = document.getElementById('svg-business-card');
    if (svgCard) {
      gsap.set(svgCard, { x: 0, y: 0, opacity: 1, visibility: 'visible' });
    }

    // The host business-card element shouldn't have been transformed, but
    // make sure it's visible in case any earlier code stashed it.
    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      gsap.set(businessCard, { opacity: 1, visibility: 'visible' });
    }

    // The card-inner holds the actual front/back SVG images and starts with
    // inline visibility:hidden;opacity:0. Without restoring it, the slide
    // brings in an empty intro tile and reads as "just a fade-out".
    const businessCardInner = document.getElementById('business-card-inner');
    if (businessCardInner) {
      gsap.set(businessCardInner, { opacity: 1, visibility: 'visible' });
    }

    // Restore intro-nav visibility (exit animation faded the nav links out).
    const introNav = document.querySelector('.intro-nav') as HTMLElement | null;
    if (introNav) {
      gsap.set(introNav, { opacity: 1, visibility: 'visible', display: 'flex' });
      const navLinks = introNav.querySelectorAll('.intro-nav-link');
      if (navLinks.length > 0) {
        gsap.set(navLinks, { opacity: 1 });
      }
    }
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
   * Reflect the current page's navigable directions in the compass cues
   * (the corner arrows that hint at scroll-map navigation). Each cue
   * gets data-can="true" if scrolling that direction would lead somewhere.
   * Reads the same NEIGHBORS graph the input handlers use, plus the
   * dynamic project-detail / projects-tile rules so the cues don't lie.
   *
   * First-paint refinement: until the user has navigated once, we only
   * surface the FORWARD cue from the landing page. The full vertical
   * loop means intro.up technically navigates (to about, going backward
   * around the loop), but on first arrival that cue would distract from
   * the intended "scroll down to start" gesture. After any navigation
   * the constraint drops and all valid cues light up normally.
   */
  private updateCompass(): void {
    const compass = document.querySelector('[data-map-compass]') as HTMLElement | null;
    if (!compass) return;

    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    const navigable = new Set<Direction>();

    for (const dir of directions) {
      if (this.canNavigate(dir)) navigable.add(dir);
    }

    // On the projects tile, vertical input cycles the TV channel — that
    // gesture is communicated by the channel-list highlight on the
    // screen, not by tiny ↑↓ arrows in the corners. Hide those cues so
    // the compass only shows ←→ (the actual navigation exits).
    if (this.currentPageId === 'projects') {
      navigable.delete('up');
      navigable.delete('down');
    }

    // Until the user has scrolled / navigated once, narrow the cue set
    // to the forward direction(s) of the current page so the affordance
    // reads as a single "go this way to start" hint instead of a four-
    // arrow puzzle. After first navigation, show every valid direction.
    if (!this.hasNavigated) {
      const forward = this.forwardDirectionsForFirstPaint(this.currentPageId);
      navigable.forEach((dir) => {
        if (!forward.has(dir)) navigable.delete(dir);
      });
    }

    compass.querySelectorAll<HTMLElement>('.map-compass__cue').forEach((cue) => {
      const dir = cue.dataset.cue as Direction | undefined;
      cue.dataset.can = dir && navigable.has(dir) ? 'true' : 'false';
    });
  }

  /**
   * The "natural forward" direction(s) from a given page on first paint.
   * Used to filter compass cues so the user sees only the intended entry
   * gesture before they've scrolled. For most pages this is one direction;
   * the projects tile gets two (down to cycle TV, right to enter carousel).
   */
  private forwardDirectionsForFirstPaint(pageId: string): Set<Direction> {
    switch (pageId) {
    case 'intro':
      // Landing page: down enters projects (primary), left/right enter
      // about/contact (secondary horizontal-loop entries). Hide up
      // initially so the affordance reads as "scroll down to start".
      return new Set(['down', 'left', 'right']);
    case 'projects':
      // All four directions are useful here: ↑↓ cycle the TV channel,
      // ←→ navigate to about/contact. Showing all from the first paint
      // tells the user "you can scroll any direction here."
      return new Set(['up', 'down', 'left', 'right']);
    case 'project-detail':
      return new Set(['left', 'right']);
    case 'about':
    case 'contact':
      return new Set(['left', 'right']);
    default:
      return new Set(['up', 'down', 'left', 'right']);
    }
  }

  /**
   * Pure check: would scrolling in this direction from the current page
   * navigate somewhere? Mirrors the gating logic in tryNavigateDirection
   * without actually firing any navigation, so the compass UI stays in
   * sync with reality.
   */
  private canNavigate(direction: Direction): boolean {
    // Projects tile: vertical always works (cycles TV or exits at bound),
    // horizontal works if there's a project-detail destination.
    if (this.currentPageId === 'projects') {
      if (direction === 'up' || direction === 'down') return true;
      return NEIGHBORS.projects?.[direction] != null;
    }
    // Project-detail: only horizontal navigates (carousel); vertical falls
    // through to native scroll on tall case studies.
    if (this.currentPageId === 'project-detail') {
      return direction === 'left' || direction === 'right';
    }
    // Map tiles: static graph.
    return NEIGHBORS[this.currentPageId]?.[direction] != null;
  }

  /**
   * Trigger the first-paint pulse on the compass — a subtle one-time
   * animation that nudges each navigable arrow in its direction so the
   * user notices the affordance. Auto-removes after the pulse cycles
   * complete so the compass stays passive afterward.
   */
  private startCompassHint(): void {
    const compass = document.querySelector('[data-map-compass]') as HTMLElement | null;
    if (!compass) return;
    compass.classList.add('is-hinting');
    // Pulse plays 3 iterations × 1.6s = ~4.8s; clear class slightly after.
    setTimeout(() => compass.classList.remove('is-hinting'), 5200);
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

    // Phase D: deep-links skip the intro animation entirely, so the paw
    // handoff is considered already done — no paw plays on any subsequent
    // intro exit. Only landing on intro arms the first paw exit.
    this.hasPawHandoffOccurred = initialPageId !== 'intro';

    // Position the scroll-map camera + show/hide .site-map based on initial
    if (this.isMapPage(initialPageId)) {
      this.setSiteMapVisibility(true);
      this.moveCamera(MAP_TILES[initialPageId as keyof typeof MAP_TILES], false);
    } else {
      this.setSiteMapVisibility(false);
    }

    // Card morph overlay is body-level + position:fixed. The pre-JS
    // critical CSS hides it for non-intro pages but stops applying once
    // .js-ready is set, and intro-animation only hides it after a played
    // animation (skipped on deep-links). Force-hide here for any non-intro
    // initial page so the morph card doesn't bleed onto other tiles.
    if (initialPageId !== 'intro') {
      this.hideMorphOverlay();
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
        // Consume pending slide direction (set by wheel/keyboard before hash
        // change) OR infer one. Without this, when router:navigate fires
        // BEFORE handleHashChange, the pending direction is dropped and
        // transitions involving project-detail fall back to blur.
        let slideDir = this.pendingSlideDirection;
        this.pendingSlideDirection = null;
        this.pendingSlideForHash = null;
        if (!slideDir) slideDir = this.inferSlideDirection(pageId);
        if (slideDir) {
          void this.transitionTo(pageId, 'slide', slideDir);
        } else {
          void this.transitionTo(pageId);
        }
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

    // Phase C: wheel + keyboard input drive the camera between map tiles.
    // Both handlers gate themselves on isMapPage(currentPageId) so off-map
    // pages keep their normal scrolling behavior.
    this.boundHandleWheel = this.handleWheel.bind(this);
    // Non-passive so the handler can preventDefault() when it navigates.
    // Without this, the browser also scrolls in addition to firing the
    // map navigation — user reports "the page is scrolling" while
    // simultaneously seeing the slide. Native scroll inside scrollable
    // tiles still works because the early-return paths (canScrollDown /
    // scrollTop > 0) skip preventDefault.
    window.addEventListener('wheel', this.boundHandleWheel, { passive: false });

    this.boundHandleKeydown = this.handleKeydown.bind(this);
    window.addEventListener('keydown', this.boundHandleKeydown);

    // Touch / swipe support — picks up the same map navigation as the
    // wheel handler on tablet (iPad) and other touch devices. Passive
    // listeners so we never block native scroll on tile content; the
    // navigation only fires when the gesture meets the swipe threshold.
    this.boundHandleTouchStart = this.handleTouchStart.bind(this);
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    window.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
    window.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });

    // popstate fires for browser back/forward (but not programmatic
    // hash changes). Mark the next handleHashChange so it can infer a
    // slide direction from history instead of falling through to blur.
    window.addEventListener('popstate', () => {
      this.popstateInFlight = true;
    });

    // Keep our TV index in sync with whatever project-detail slug is
    // actually rendered. ProjectsModule dispatches this whenever it
    // populates the detail page — covers direct hash changes, deep
    // links, and browser history that bypass tryNavigateDirection.
    window.addEventListener('projects:active-slug-changed', ((event: CustomEvent) => {
      const idx = event.detail?.index;
      if (typeof idx === 'number') this.currentTvIndex = idx;
    }) as EventListener);

    // Compass arrow clicks act as a touch-friendly nav fallback —
    // delegated so we don't have to re-bind on each navigation. The CSS
    // disables pointer-events on non-navigable cues so this only fires
    // for arrows that actually lead somewhere.
    const compass = document.querySelector('[data-map-compass]') as HTMLElement | null;
    if (compass) {
      compass.addEventListener('click', (event: Event) => {
        const target = event.target as HTMLElement | null;
        const cue = target?.closest('.map-compass__cue') as HTMLElement | null;
        const dir = cue?.dataset.cue as Direction | undefined;
        if (!dir || !this.canNavigate(dir)) return;
        if (this.isTransitioning) return;
        this.tryNavigateDirection(dir);
      });
    }
  }

  /**
   * Handle hash changes for navigation
   */
  private handleHashChange(): void {
    if (!this.introComplete || this.isTransitioning) return;

    const hash = window.location.hash;
    const pageId = this.getPageIdFromHash(hash);

    // Special case: project-detail → project-detail (carousel between slugs)
    // has the same pageId but different content, so the standard
    // pageId !== currentPageId check would skip it and the carousel slide
    // would never run. Detect by comparing slugs.
    const isCarousel =
      pageId === 'project-detail' && this.currentPageId === 'project-detail';

    if (pageId && (pageId !== this.currentPageId || isCarousel)) {
      // Race protection: a stale pendingSlideDirection from a navigation
      // that got dropped (e.g., wheel set direction → second wheel set a
      // new direction → old hash fires) would slide the wrong way. We
      // pin the direction to its target hash at set-time and only honour
      // it here if (a) it's not from popstate AND (b) the pinned hash
      // matches the hash that just fired. Anything else gets dropped to
      // inference.
      const fromPopstate = this.popstateInFlight;
      this.popstateInFlight = false;

      const pinnedHash = this.pendingSlideForHash;
      const pinnedDir = this.pendingSlideDirection;
      this.pendingSlideDirection = null;
      this.pendingSlideForHash = null;

      let slideDir: Direction | null = null;
      if (!fromPopstate && pinnedDir && pinnedHash === hash) {
        slideDir = pinnedDir;
      }

      // Fallback inference. For popstate (browser back/forward), check
      // history first to figure out direction; otherwise fall back to the
      // project-detail-aware default.
      if (!slideDir && fromPopstate) slideDir = this.inferDirectionFromHistory(hash);
      if (!slideDir) slideDir = this.inferSlideDirection(pageId);

      // Push current hash + arrival direction to nav history so a future
      // popstate can look up "how did the user reach this page?" and slide
      // the opposite way to reverse it.
      this.navHistory.push({ hash, arrivedVia: slideDir });
      if (this.navHistory.length > NAV_HISTORY_CAP) {
        this.navHistory.splice(0, this.navHistory.length - NAV_HISTORY_CAP);
      }

      if (slideDir) {
        void this.transitionTo(pageId, 'slide', slideDir);
      } else {
        void this.transitionTo(pageId);
      }
    }
  }

  /**
   * Infer a slide direction for a popstate-driven navigation by reversing
   * the direction the user originally came IN to the leaving page.
   *
   * Example: user on intro swiped DOWN to reach projects (that recorded
   * arrivedVia='down' for projects). They click browser back. Popstate
   * fires with intro as the new hash. We look at the LEAVING entry
   * (projects with arrivedVia='down'), reverse it, and slide 'up' — the
   * back gesture visually undoes the forward swipe.
   *
   * Falls back to a vertical/horizontal heuristic only if the recorded
   * direction isn't usable (e.g., entry came in via a programmatic
   * navigation that didn't record a direction).
   */
  private inferDirectionFromHistory(newHash: string): Direction | null {
    if (this.navHistory.length < 2) return null;
    const last = this.navHistory.length - 1;
    const prev = this.navHistory[last - 1];
    if (prev.hash !== newHash) return null;

    // Recorded direction we used to enter the page we're leaving — the
    // last entry in history is the page about to be unmounted by popstate.
    const leaving = this.navHistory[last];
    if (leaving.arrivedVia) {
      const reverse: Record<Direction, Direction> = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left'
      };
      return reverse[leaving.arrivedVia];
    }

    // No recorded direction — fall back to axis-based heuristic.
    const verticalTargets = new Set(['intro', 'about', 'contact']);
    const targetPageId = this.getPageIdFromHash(newHash);
    return targetPageId && verticalTargets.has(targetPageId) ? 'up' : 'left';
  }

  /**
   * Infer a slide direction for hash-driven / router-driven navigation
   * involving project-detail. Card clicks, browser back, and direct links
   * don't carry an explicit direction, but we still want the gallery pan
   * to play instead of the blur swap.
   *
   * Convention:
   * - Going INTO the carousel (toward project-detail) defaults to 'right'
   *   so the new card slides in from the right (forward feel).
   * - Going OUT of the carousel (away from project-detail) defaults to
   *   'left' so the next page slides in from the left (backward feel).
   *   This makes browser back from a detail page visually flow backward
   *   instead of jarringly sliding forward.
   */
  private inferSlideDirection(pageId: string): Direction | null {
    // Carousel between detail pages — direction is ambiguous via hash;
    // default to forward.
    if (this.currentPageId === 'project-detail' && pageId === 'project-detail') {
      return 'right';
    }
    // Leaving project-detail to anywhere → backward.
    if (this.currentPageId === 'project-detail') return 'left';
    // Entering project-detail from anywhere → forward.
    if (pageId === 'project-detail') return 'right';
    return null;
  }

  /**
   * Snapshot the live project-detail element (with its current content) into
   * a sibling clone, so the OLD card can slide off-screen while the same
   * #project-detail element re-renders and slides the NEW card in. The ghost
   * is removed by runSlideTransition once the slide completes.
   */
  private removeDetailGhost(): void {
    if (this.outgoingDetailGhost) {
      this.outgoingDetailGhost.remove();
      this.outgoingDetailGhost = null;
    }
  }

  private captureDetailGhost(): void {
    this.removeDetailGhost();
    const detail = this.pages.get('project-detail')?.element;
    if (!detail || !detail.parentElement) return;

    const ghost = detail.cloneNode(true) as HTMLElement;
    ghost.id = 'project-detail-ghost';
    ghost.removeAttribute('data-page');
    ghost.classList.remove('page-hidden');
    ghost.classList.add('page-active');
    // Pin ghost to the same viewport box as the real element so they
    // overlap perfectly until the slide separates them.
    ghost.style.position = 'absolute';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.width = '100%';
    ghost.style.height = '100%';
    ghost.style.display = 'flex';
    ghost.style.zIndex = '5';
    ghost.style.pointerEvents = 'none';

    detail.parentElement.appendChild(ghost);
    this.outgoingDetailGhost = ghost;
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
      // First-paint affordance: pulse the compass arrows so the user
      // notices the scroll-map is interactive. Update first so the cues
      // reflect the actual landing page's navigable directions.
      this.updateCompass();
      this.startCompassHint();
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
      this.updateCompass();
      this.startCompassHint();
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
   * Wheel handler — turns vertical/horizontal scrolling into camera moves
   * when the user is at the edge of the active tile's internal scroll.
   * Lets the browser handle in-tile scrolling normally otherwise.
   */
  private handleWheel(event: WheelEvent): void {
    if (this.isMobile && !this.enableOnMobile) return;
    if (!this.introComplete) return;
    // Allow input on map tiles AND on project-detail (so users can scroll
    // back left to projects). Other off-map pages (portal-login, admin)
    // still keep their normal scroll-only behavior.
    if (!this.isMapPage(this.currentPageId) && this.currentPageId !== 'project-detail') return;

    // Tiles that should NEVER scroll natively need to swallow every wheel
    // event whether or not we end up navigating, otherwise cooldown /
    // threshold / transition early-returns let the browser scroll the
    // page underneath. project-detail is intentionally omitted — its
    // case studies are tall and need native vertical scroll.
    const consumesAllWheel = this.currentPageId !== 'project-detail';
    if (consumesAllWheel) event.preventDefault();

    if (this.isTransitioning) return;
    if (performance.now() < this.wheelCooldownUntil) return;

    const dx = event.deltaX;
    const dy = event.deltaY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < WHEEL_DELTA_THRESHOLD) return;

    const currentTile = this.pages.get(this.currentPageId)?.element;
    if (!currentTile) return;

    let direction: Direction | null = null;

    // Universal convention across wheel/touch/keyboard: FINGER direction
    // (or arrow key direction) maps to navigation direction. On macOS
    // with natural scroll on (default), swiping right gives deltaX < 0
    // and swiping down gives deltaY < 0, so we read the OPPOSITE of the
    // delta sign for both axes. Mouse-wheel users (rare in 2026) and
    // non-natural-scroll trackpad users get one inverted axis; touch
    // and natural-scroll trackpad users — the majority — get intuitive
    // gestures across every input device.
    const onProjects = this.currentPageId === 'projects';

    if (absY >= absX) {
      const dirIfDown = 'down' as Direction;
      const dirIfUp = 'up' as Direction;
      // Vertical: swipe DOWN (dy < 0 on natural scroll) → 'down'.
      // For projects: ALWAYS navigate (TV channel cycle) — skip the
      // edge-of-scroll guard since the projects tile shouldn't scroll
      // natively at all.
      // For everything else: edge guards check scroll position so tall
      // content (project-detail case studies) still scrolls natively
      // until the user hits the boundary.
      if (dy < 0) {
        if (!onProjects) {
          const canScrollDown =
            currentTile.scrollHeight - currentTile.scrollTop - currentTile.clientHeight >= 1;
          if (canScrollDown) return;
        }
        direction = dirIfDown;
      } else {
        if (!onProjects && currentTile.scrollTop >= 1) return;
        direction = dirIfUp;
      }
    } else {
      // Horizontal: swipe RIGHT (dx < 0 on natural scroll) → 'right'.
      direction = dx < 0 ? 'right' : 'left';
    }

    // We're about to navigate (or cycle TV) — only consume the wheel
    // event if there's actually a destination, otherwise let the
    // browser scroll natively.
    if (!this.canNavigate(direction)) return;
    event.preventDefault();
    this.tryNavigateDirection(direction);
  }

  /**
   * Keyboard handler — arrow keys drive the camera. Skips when the user is
   * typing in a form input.
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (this.isMobile && !this.enableOnMobile) return;
    if (this.isTransitioning) return;
    if (!this.introComplete) return;
    if (!this.isMapPage(this.currentPageId) && this.currentPageId !== 'project-detail') return;

    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    // Enter on the projects tile opens the currently-highlighted TV
    // channel — same as clicking the row. Lets keyboard users browse
    // with ↑/↓ and "select" with Enter without having to tab through
    // the list to focus an individual row first.
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      this.currentPageId === 'projects'
    ) {
      const slugs = this.getProjectSlugs();
      const slug = slugs[this.currentTvIndex];
      if (slug) {
        event.preventDefault();
        this.setPendingSlide('right', `#/projects/${slug}`);
        window.location.hash = `#/projects/${slug}`;
      }
      return;
    }

    let direction: Direction | null = null;
    switch (event.key) {
    case 'ArrowUp':
      direction = 'up';
      break;
    case 'ArrowDown':
      direction = 'down';
      break;
    case 'ArrowLeft':
      direction = 'left';
      break;
    case 'ArrowRight':
      direction = 'right';
      break;
    default:
      return;
    }

    // Use canNavigate so this stays in lock-step with the wheel handler
    // and the compass — handles dynamic cases (projects ↑↓ cycles TV,
    // project-detail ←→ cycles carousel) that aren't in the static
    // NEIGHBORS graph.
    if (!this.canNavigate(direction)) return;

    event.preventDefault();
    this.tryNavigateDirection(direction);
  }

  /**
   * Touch start — capture the gesture origin so handleTouchEnd can decide
   * if the swipe was decisive enough to count as a navigation.
   */
  private handleTouchStart(event: TouchEvent): void {
    if (this.isMobile && !this.enableOnMobile) return;
    if (this.isTransitioning) return;
    if (!this.introComplete) return;
    if (event.touches.length !== 1) {
      this.touchStart = null;
      return;
    }
    const t = event.touches[0];
    this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
  }

  /**
   * Touch end — compute swipe direction. Distance must beat
   * SWIPE_DISTANCE_MIN_PX in the dominant axis AND the gesture must
   * complete within SWIPE_TIME_MAX_MS, or it falls through (so slow
   * pans through tile content still feel like native scroll).
   */
  private handleTouchEnd(event: TouchEvent): void {
    const start = this.touchStart;
    this.touchStart = null;
    if (!start) return;
    if (this.isTransitioning) return;
    if (performance.now() < this.wheelCooldownUntil) return;
    if (!this.isMapPage(this.currentPageId) && this.currentPageId !== 'project-detail') return;

    // changedTouches has the just-released finger.
    const t = event.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = performance.now() - start.t;
    if (elapsed > SWIPE_TIME_MAX_MS) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_DISTANCE_MIN_PX) return;

    // Finger direction = nav direction. Same convention as the wheel
    // handler (which inverts deltaX so swipe-right always navigates
    // right on natural-scroll trackpads). Aligning these means a touch
    // laptop where BOTH events fire for one gesture won't produce
    // conflicting directions — the user gets the same result regardless
    // of which handler runs first.
    let direction: Direction;
    if (absX >= absY) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    // Mirror handleWheel's edge-of-scroll guard for vertical swipes so
    // tall tiles (project-detail case studies) still scroll natively
    // until the user hits the boundary.
    const currentTile = this.pages.get(this.currentPageId)?.element;
    if (currentTile && (direction === 'up' || direction === 'down')) {
      if (direction === 'down') {
        const canScrollDown =
          currentTile.scrollHeight - currentTile.scrollTop - currentTile.clientHeight >= 1;
        if (canScrollDown) return;
      } else if (currentTile.scrollTop >= 1) {
        return;
      }
    }

    this.tryNavigateDirection(direction);
  }

  /**
   * Resolve a direction against the neighbor graph and start a transition
   * if a neighbor exists in that direction. Sets the wheel cooldown so a
   * trailing trackpad flick doesn't immediately fire another transition
   * after this one finishes.
   */
  private tryNavigateDirection(direction: Direction): void {
    // Projects tile: vertical channel-surfs the CRT TV. Wraps at both
    // ends since horizontal scroll now handles map navigation
    // (about/contact) — there's no need to exit the projects tile via
    // vertical anymore. Users cycle the TV forever in either direction
    // and use left/right to leave for about/contact.
    if (
      this.currentPageId === 'projects' &&
      (direction === 'up' || direction === 'down')
    ) {
      const total = this.getProjectSlugs().length;
      if (total === 0) return;
      const delta = direction === 'down' ? 1 : -1;
      // Modulo wrap so cycling down past last lands on first, and
      // cycling up before first lands on last. Always within bounds.
      this.currentTvIndex = (this.currentTvIndex + delta + total) % total;
      document.dispatchEvent(
        new CustomEvent('projects:set-tv-channel', {
          detail: { index: this.currentTvIndex, direction }
        })
      );
      this.wheelCooldownUntil = performance.now() + WHEEL_COOLDOWN_MS + 200;
      return;
    }

    // Special case: arriving on projects from contact (scrolled up) lands on
    // the LAST project channel; arriving from intro (scrolled down) lands on
    // the FIRST. The actual landing is handled below in transitionTo, but the
    // index is set here in tryNavigateDirection's contact branch via the
    // landing-side bookkeeping (see contact entry).

    // Dynamic case: scrolling on project-detail walks through the project
    // list. left/right cycle between projects (left-from-first → projects,
    // right-from-last → contact). up exits to home. down falls through to
    // native scrolling. Slide direction is set so the upcoming hash-driven
    // transition pans instead of blurring.
    if (this.currentPageId === 'project-detail') {
      const targetHash = this.resolveProjectDetailNeighbor(direction);
      if (!targetHash) return;
      this.wheelCooldownUntil =
        performance.now() + PAGE_ANIMATION.DURATION * 1000 + WHEEL_COOLDOWN_MS;
      // For project-detail → project-detail, snapshot the current rendered
      // card BEFORE the projects module swaps content on hashchange. This
      // ghost slides off while the real element (with new content) slides
      // in, so the user actually sees both cards moving — without it, the
      // single-element animation just snaps the old card off-screen.
      const goingToAnotherDetail = targetHash.startsWith('#/projects/');
      if (goingToAnotherDetail) {
        this.captureDetailGhost();
      }
      this.setPendingSlide(direction, targetHash);
      window.location.hash = targetHash;
      return;
    }

    const targetPageId = NEIGHBORS[this.currentPageId]?.[direction];
    if (!targetPageId) return;

    this.wheelCooldownUntil = performance.now() + PAGE_ANIMATION.DURATION * 1000 + WHEEL_COOLDOWN_MS;

    // Entering projects from outside: only RESET the TV channel on the
    // very first arrival (currentTvIndex still 0 and we never touched it).
    // After that, preserve whatever channel the user was last viewing so
    // returning to projects lands on the same one — this is what the
    // audit found broken: every entry from contact reset to last,
    // every entry from intro reset to first.
    if (targetPageId === 'projects') {
      const slugs = this.getProjectSlugs();
      if (slugs.length > 0) {
        // Clamp in case the project list shrank since last visit.
        if (this.currentTvIndex >= slugs.length) this.currentTvIndex = slugs.length - 1;
        if (this.currentTvIndex < 0) this.currentTvIndex = 0;
        // Sync the TV display to whatever channel we're remembering.
        requestAnimationFrame(() => {
          document.dispatchEvent(
            new CustomEvent('projects:set-tv-channel', {
              detail: { index: this.currentTvIndex, direction }
            })
          );
        });
      }
    }

    // Special case: project-detail isn't a static route — it needs a slug.
    // Use the SAME channel the projects-tile TV is showing so the slide
    // visually continues from what the user was just looking at, instead
    // of jumping to first/last regardless of TV state. Direction is only
    // a tiebreaker for fresh-from-elsewhere entry.
    if (targetPageId === 'project-detail') {
      const slugs = this.getProjectSlugs();
      if (slugs.length === 0) return;
      const fromProjects = this.currentPageId === 'projects';
      let slug: string;
      if (fromProjects) {
        // Carousel continues from current TV channel.
        slug = slugs[this.currentTvIndex] ?? slugs[0];
      } else {
        // First-time entry from anywhere else — pick by direction.
        slug = direction === 'left' ? slugs[slugs.length - 1] : slugs[0];
      }
      const targetHashStr = `#/projects/${slug}`;
      this.setPendingSlide(direction, targetHashStr);
      window.location.hash = targetHashStr;
      return;
    }

    // Map → map: direct transitionTo call (no hash change here), so we
    // don't pin pendingSlideDirection — the direction is passed inline.
    // Slide mode ensures the visual pan ALWAYS matches the scroll direction
    // regardless of where the target sits on the spatial map.
    void this.transitionTo(targetPageId, 'slide', direction);
  }

  /**
   * Read the rendered project list out of the DOM and return slugs in order.
   * Source of truth for the carousel order — same as what the user sees in
   * the projects tile. Project cards are .work-card divs (not anchor tags),
   * so we read data-project-slug rather than href.
   */
  private getProjectSlugs(): string[] {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>('#projects .work-card[data-project-slug]')
    );
    return cards
      .map((card) => card.dataset.projectSlug ?? '')
      .filter((slug) => slug.length > 0);
  }

  /** Slug at the given index in the rendered projects list, or null. */
  private getProjectSlugAt(index: number): string | null {
    const slugs = this.getProjectSlugs();
    return slugs[index] ?? null;
  }

  /** Slug currently shown in the project-detail page (parsed from hash). */
  private getCurrentProjectSlug(): string | null {
    const hash = window.location.hash;
    if (!hash.startsWith('#/projects/')) return null;
    const slug = hash.replace('#/projects/', '').split('?')[0];
    return slug.length > 0 ? slug : null;
  }

  /**
   * Resolve the next hash for project-detail navigation given a direction.
   * - left from first project → back to projects tile
   * - left from other project → previous project
   * - right from non-last project → next project
   * - right from last project → home (carousel wraps back to intro)
   * - up/down → null (vertical scroll stays on the page so users can
   *   read tall case studies; never exits to the map)
   */
  private resolveProjectDetailNeighbor(direction: Direction): string | null {
    if (direction === 'down' || direction === 'up') return null;

    const slugs = this.getProjectSlugs();
    if (slugs.length === 0) return null;

    const currentSlug = this.getCurrentProjectSlug();
    const currentIndex = currentSlug ? slugs.indexOf(currentSlug) : -1;
    if (currentIndex === -1) return null;

    // Infinite horizontal loop INCLUDING the projects tile as a stop in
    // the chain. The full forward gallery ring is:
    //   projects → detail[0] → detail[1] → ... → detail[N-1] → projects → ...
    // Boundary exits return to the projects (TV) tile, and on the way
    // back through projects the TV remembers which channel to show.
    let nextIndex: number;
    if (direction === 'left') {
      if (currentIndex === 0) {
        // Crossing back into projects from the first card — keep the TV
        // showing this card so re-entering carousel feels continuous.
        this.currentTvIndex = 0;
        return '#/projects';
      }
      nextIndex = currentIndex - 1;
    } else {
      if (currentIndex >= slugs.length - 1) {
        this.currentTvIndex = slugs.length - 1;
        return '#/projects';
      }
      nextIndex = currentIndex + 1;
    }
    // Within the carousel: keep TV index synced to the active slug so
    // jumping back to projects via vertical or compass shows the right
    // channel waiting on the screen.
    this.currentTvIndex = nextIndex;
    return `#/projects/${slugs[nextIndex]}`;
  }

  /**
   * Transition to a page.
   *
   * `mode` controls the navigation feel and is the ONLY thing that gates
   * the paw exit animation:
   * - 'blur' (default — used by nav menu, hash change, programmatic
   *   navigateTo): paw exit plays on intro exit, blur fades for everything
   *   else. This matches the pre-scroll-map navigation feel.
   * - 'slide' (all wheel/keyboard/pointer nav): pans `.site-map` and
   *   off-map pages as siblings — the outgoing card slides off one side
   *   while the incoming slides in from the opposite side. NEVER plays
   *   the paw. Requires `slideDirection`.
   */
  async transitionTo(
    pageId: string,
    mode: 'blur' | 'slide' = 'blur',
    slideDirection: Direction | null = null
  ): Promise<void> {
    this.log('[PageTransitionModule] transitionTo called:', pageId, 'mode:', mode);

    // Allow project-detail → project-detail self-transitions (carousel between
    // slugs). They share the pageId but the slug — and the rendered card —
    // is different, so the slide IS meaningful.
    const isCarousel = pageId === 'project-detail' && this.currentPageId === 'project-detail';
    if ((pageId === this.currentPageId && !isCarousel) || this.isTransitioning) {
      this.log('[PageTransitionModule] transitionTo blocked - same page or already transitioning');
      // Drop any orphaned ghost so it doesn't sit on top of the page forever.
      this.removeDetailGhost();
      return;
    }
    if (this.isMobile && !this.enableOnMobile) {
      this.log('[PageTransitionModule] transitionTo blocked - mobile');
      this.removeDetailGhost();
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

    // Pre-transition signal — fires BEFORE any slide/blur animation runs,
    // so listeners (e.g., contact-animation) can pre-set their content to
    // the right state before it slides into view. Without this, contact
    // would slide in showing its initial small form, then snap to full
    // size after — which the user perceives as the form animating on
    // every scroll arrival.
    const preEventDetail = { from: currentPage?.id, to: pageId, mode };
    this.dispatchEvent('page-entering', preEventDetail);
    window.dispatchEvent(new CustomEvent('page-entering', { detail: preEventDetail }));

    try {
      const toIsMap = this.isMapPage(pageId);
      const fromIsIntro = this.currentPageId === 'intro';

      if (mode === 'slide' && slideDirection && this.siteMap) {
        // ============================================
        // SLIDE MODE (all wheel/keyboard/pointer nav) — pan, no paw, no blur
        // ============================================
        await this.runSlideTransition(currentPage, targetPage, slideDirection);
      } else {
        // ============================================
        // BLUR MODE (nav menu / hash / link click) — original-feel transitions
        // ============================================

        // Exit current page: paw on intro exit (first time per session,
        // gated by Phase D handoff), blur otherwise.
        if (fromIsIntro && !this.hasPawHandoffOccurred) {
          await this.playIntroExitAnimation();
          this.hasPawHandoffOccurred = true;
        } else if (currentPage && currentPage.element) {
          await this.animateOut(currentPage);
        }

        // Hide all off-map pages so the target is the only off-map showing
        this.hideOffMapPages();

        if (toIsMap && this.siteMap) {
          // Going TO a map tile (from off-map OR from another map tile via
          // blur). Reset all map tiles' inline opacity/filter/visibility so
          // any tile that was previously animateOut'd to opacity:0 doesn't
          // reappear invisible. Then set the target invisible specifically
          // so the camera snap doesn't flash it at full opacity, snap the
          // camera, and animate the target back in for a smooth blur fade.
          this.pages.forEach((page) => {
            if (page.element && this.isMapPage(page.id)) {
              gsap.set(page.element, { clearProps: 'opacity,filter,visibility' });
            }
          });

          gsap.set(targetPage.element, {
            opacity: 0,
            visibility: 'hidden',
            filter: `blur(${PAGE_ANIMATION.BLUR_AMOUNT}px)`
          });

          this.setSiteMapVisibility(true);
          this.moveCamera(MAP_TILES[pageId as keyof typeof MAP_TILES], false);

          await this.animateIn(targetPage);
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
      // Mark first navigation done so the compass drops the first-paint
      // single-cue restriction and starts surfacing every valid direction.
      this.hasNavigated = true;
      this.updateCompass();

      // Card morph overlay should never be visible outside the intro page;
      // safety hide in case anything left it visible.
      if (pageId !== 'intro') {
        this.hideMorphOverlay();
      }

      // Update document title
      if (targetPage.title) {
        document.title = targetPage.title;
      }

      // Dispatch page changed event (both internally and as window event).
      // Include `mode` so listeners can distinguish direct navigation (blur)
      // from camera/slide map panning, e.g., to skip intrusive entrance
      // animations when the user is just scrolling around.
      const eventDetail = { from: currentPage?.id, to: pageId, mode };
      this.dispatchEvent('page-changed', eventDetail);
      window.dispatchEvent(new CustomEvent('page-changed', { detail: eventDetail }));

      // Dispatch contact-page-ready ONLY for direct navigation (blur). Map
      // scroll arrivals (camera/slide) skip the form-grow animation.
      if (pageId === 'contact' && mode === 'blur') {
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
   * Defensive fallback when slide mode is requested but a required element
   * (.site-map for map-tile transitions) isn't available. Behaves like the
   * old blur-swap path so navigation still works on stripped-down pages.
   */
  private async runBlurFallback(
    currentPage: PageConfig | undefined,
    targetPage: PageConfig
  ): Promise<void> {
    if (currentPage?.element) await this.animateOut(currentPage);
    this.hideOffMapPages();
    if (targetPage.element) {
      targetPage.element.classList.remove('page-hidden');
      targetPage.element.classList.add('page-active');
      gsap.set(targetPage.element, {
        opacity: 0,
        visibility: 'hidden',
        filter: `blur(${PAGE_ANIMATION.BLUR_AMOUNT}px)`
      });
      await this.animateIn(targetPage);
    }
  }

  /**
   * ============================================
   * SLIDE TRANSITION
   * ============================================
   * Full-card pan for project-detail navigation. The outgoing page slides
   * off in the direction of travel and the incoming page slides in from the
   * opposite side as siblings — no blur, no fade. Feels like dragging an
   * interactive map.
   *
   * Implementation: for map-tile sources/targets we translate `.site-map`
   * itself (since the tile lives inside the camera container); for off-map
   * pages (project-detail) we translate the page element directly. The
   * baseline xPercent of `.site-map` is its current camera position
   * (e.g., -100 for projects), so slide offsets stack on top of it.
   *
   * Same-element edge case (project-detail → project-detail carousel): the
   * rendered content is swapped by the projects module before this runs, so
   * we just snap the element to off-screen and slide it back into place.
   */
  private async runSlideTransition(
    currentPage: PageConfig | undefined,
    targetPage: PageConfig,
    direction: Direction
  ): Promise<void> {
    if (!targetPage.element) return;

    const isHorizontal = direction === 'left' || direction === 'right';
    const axisProp: 'xPercent' | 'yPercent' = isHorizontal ? 'xPercent' : 'yPercent';
    // outSign: where outgoing exits relative to viewport.
    // - right scroll → outgoing exits LEFT (-1)
    // - left scroll  → outgoing exits RIGHT (+1)
    // - down scroll  → outgoing exits UP (-1)
    // - up scroll    → outgoing exits DOWN (+1)
    const outSign = direction === 'right' || direction === 'down' ? -1 : 1;
    const inSign = -outSign;

    const fromIsMap = currentPage ? this.isMapPage(currentPage.id) : false;
    const toIsMap = this.isMapPage(targetPage.id);

    // Defensive: if a map tile is involved but .site-map isn't in the DOM
    // (shouldn't happen in production, but possible in stripped-down tests
    // or if the page hasn't been migrated to the scroll-map structure),
    // fall back to a plain blur transition rather than crashing.
    if ((fromIsMap || toIsMap) && !this.siteMap) {
      this.warn('runSlideTransition: site-map missing, falling back to blur');
      return this.runBlurFallback(currentPage, targetPage);
    }

    // Resolve the visual element to translate for each side. Map tiles share
    // a single .site-map container that holds the camera transform.
    const fromElement: HTMLElement | null = fromIsMap
      ? this.siteMap
      : currentPage?.element ?? null;
    const toElement: HTMLElement = (toIsMap ? this.siteMap : targetPage.element) as HTMLElement;

    // Baselines: a map element's resting transform IS its camera position;
    // off-map elements rest at 0.
    const toBaseline = toIsMap
      ? CAMERA_POSITIONS[MAP_TILES[targetPage.id as keyof typeof MAP_TILES]]
      : { x: 0, y: 0 };
    const fromBaseline = fromIsMap && currentPage
      ? CAMERA_POSITIONS[MAP_TILES[currentPage.id as keyof typeof MAP_TILES]]
      : { x: 0, y: 0 };

    const inFinal = isHorizontal ? toBaseline.x : toBaseline.y;
    const inStart = inFinal + inSign * 100;
    const outFinal = (isHorizontal ? fromBaseline.x : fromBaseline.y) + outSign * 100;

    // Prep target visibility BEFORE the slide starts. Critical: when
    // making the off-map target visible, set the off-screen transform BEFORE
    // adding the page-active class — otherwise the element renders one frame
    // at position 0 (full viewport) before snapping off-screen, which the
    // user sees as a flash.
    if (toIsMap && this.siteMap) {
      this.pages.forEach((page) => {
        if (page.element && this.isMapPage(page.id)) {
          gsap.set(page.element, { clearProps: 'opacity,filter,visibility' });
        }
      });
      // When sliding TO intro, the business card may have been left hidden by
      // a previous paw exit. Restore it so the user sees the card slide into
      // view — without this, the slide looks like just a fade because the
      // tile arrives empty.
      if (targetPage.id === 'intro') {
        this.restoreIntroCardState();
      }
      this.setSiteMapVisibility(true);
      this.moveCamera(MAP_TILES[targetPage.id as keyof typeof MAP_TILES], false);
    } else if (!toIsMap) {
      this.hideOffMapPages();
      // Pre-position OFF-SCREEN before becoming visible.
      gsap.killTweensOf(toElement);
      gsap.set(toElement, {
        [axisProp]: isHorizontal ? inSign * 100 : 0,
        yPercent: !isHorizontal ? inSign * 100 : 0,
        opacity: 1,
        visibility: 'visible',
        filter: 'none'
      });
      toElement.classList.remove('page-hidden');
      toElement.classList.add('page-active');
    }

    const sameElement = fromElement === toElement;

    // Same-element carousel (project-detail → project-detail). The element's
    // content was already swapped by ProjectsModule on hashchange, so the
    // real element shows the NEW card. We need to also see the OLD card
    // sliding off — that's what the ghost (cloned before the swap) is for.
    if (sameElement) {
      const ghost = this.outgoingDetailGhost;
      this.outgoingDetailGhost = null;

      // Position the (real) element off-screen at the incoming side and
      // slide it back to 0.
      gsap.killTweensOf(toElement);
      gsap.set(toElement, { [axisProp]: inStart });

      const ghostTween: Promise<void> = ghost
        ? new Promise<void>((resolve) => {
          gsap.killTweensOf(ghost);
          gsap.set(ghost, { [axisProp]: 0 });
          gsap.to(ghost, {
            [axisProp]: outSign * 100,
            duration: PAGE_ANIMATION.SLIDE_DURATION,
            ease: PAGE_ANIMATION.SLIDE_EASE,
            onComplete: () => {
              ghost.remove();
              resolve();
            }
          });
        })
        : Promise.resolve();

      const realTween = new Promise<void>((resolve) => {
        gsap.to(toElement, {
          [axisProp]: inFinal,
          duration: PAGE_ANIMATION.SLIDE_DURATION,
          ease: PAGE_ANIMATION.SLIDE_EASE,
          onComplete: resolve
        });
      });

      await Promise.all([ghostTween, realTween]);
      return;
    }

    // For toIsMap case (off-map → map), position siteMap off-screen at start.
    if (toIsMap) {
      gsap.killTweensOf(toElement);
      gsap.set(toElement, { [axisProp]: inStart });
    }

    const tweens: Promise<void>[] = [];
    if (fromElement) {
      gsap.killTweensOf(fromElement);
      tweens.push(
        new Promise<void>((resolve) => {
          gsap.to(fromElement, {
            [axisProp]: outFinal,
            duration: PAGE_ANIMATION.SLIDE_DURATION,
            ease: PAGE_ANIMATION.SLIDE_EASE,
            onComplete: resolve
          });
        })
      );
    }
    tweens.push(
      new Promise<void>((resolve) => {
        gsap.to(toElement, {
          [axisProp]: inFinal,
          duration: PAGE_ANIMATION.SLIDE_DURATION,
          ease: PAGE_ANIMATION.SLIDE_EASE,
          onComplete: resolve
        });
      })
    );

    await Promise.all(tweens);

    // Cleanup outgoing once slide is done.
    if (fromIsMap && !toIsMap && this.siteMap) {
      // Map slid off, off-map is now visible. Hide site-map and reset its
      // transform to its (previous) camera baseline.
      this.setSiteMapVisibility(false);
      gsap.set(this.siteMap, { xPercent: fromBaseline.x, yPercent: fromBaseline.y });
    } else if (!fromIsMap && currentPage?.element && currentPage.element !== toElement) {
      // Off-map slid off, hide it and clear inline transform.
      gsap.set(currentPage.element, { clearProps: 'transform,opacity,visibility,filter' });
      currentPage.element.classList.add('page-hidden');
      currentPage.element.classList.remove('page-active');
    }
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
    if (this.boundHandleWheel) {
      window.removeEventListener('wheel', this.boundHandleWheel);
      this.boundHandleWheel = null;
    }
    if (this.boundHandleKeydown) {
      window.removeEventListener('keydown', this.boundHandleKeydown);
      this.boundHandleKeydown = null;
    }
    if (this.boundHandleTouchStart) {
      window.removeEventListener('touchstart', this.boundHandleTouchStart);
      this.boundHandleTouchStart = null;
    }
    if (this.boundHandleTouchEnd) {
      window.removeEventListener('touchend', this.boundHandleTouchEnd);
      this.boundHandleTouchEnd = null;
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
