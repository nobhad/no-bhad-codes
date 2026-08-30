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
  about: 'up',
  projects: 'right',
  contact: 'down',
  // Directly below projects, so entering a case study is a vertical camera
  // hop of exactly one viewport — the same set distance the horizontal
  // carousel uses between tiles.
  'project-detail': 'detail'
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
  right: { x: -100, y: 0 },
  detail: { x: -100, y: -100 }
};

/**
 * Tile spatial positions (CSS top/left percents). Inverse of
 * CAMERA_POSITIONS: camera "up" translates world down +100%, but the
 * up-tile itself sits at css top:-100%. Used by the bridge slide path
 * to compute per-tile transforms that fake an axis-locked pan between
 * tiles that aren't on the same row/column of the spatial map.
 */
const TILE_CSS_POSITIONS: Record<MapTile, { x: number; y: number }> = {
  center: { x: 0, y: 0 },
  up: { x: 0, y: -100 },
  down: { x: 0, y: 100 },
  right: { x: 100, y: 0 },
  detail: { x: 100, y: 100 }
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
 * Leaving project-detail by scrolling up requires a DELIBERATE up-scroll while
 * the case study is at the top — not the trackpad momentum of having just
 * scrolled up to reach it. Momentum only ever DECAYS, so a fresh finger push
 * shows up as a re-acceleration: a wheel delta meaningfully larger than the
 * decaying trend (REACCEL_FACTOR). A fresh scroll after DETAIL_GESTURE_GAP_MS of
 * quiet also counts (covers a mouse wheel / a clearly separate pull), but only
 * if its delta isn't smaller than the last — that filters out a lone momentum
 * straggler arriving after a lull. DETAIL_TOP_SETTLE_MS ignores scrolls for a
 * beat right after reaching the top, covering the tail of the reach-the-top swipe.
 */
/**
 * Footer curtain travel: px of vertical input that takes the panel from
 * closed to fully open.
 *
 * The tiles are a fixed camera sized to the viewport, so there is no scroll
 * container to measure past the end of the content — the gesture itself
 * supplies the distance. Roughly one firm trackpad push.
 */
const CURTAIN_TRAVEL_PX = 260;

/**
 * Quiet (ms) after the last curtain input before the band settles to an end.
 *
 * The band used to hold wherever the gesture left it, which meant any push
 * short of CURTAIN_TRAVEL_PX parked it half-open: the wordmark clipped by the
 * viewport bottom, the copyright below the fold, and the page's edge stranded
 * mid-band. A normal trackpad flick banks well under 260px, so that was the
 * common case rather than the edge case. One wheel gesture is a burst of
 * events a few ms apart, so this only has to outlast the gaps inside a burst.
 */
const CURTAIN_SETTLE_MS = 120;

/**
 * How far the band has to travel before a settle commits to the far end
 * rather than returning to where it started.
 *
 * Directional rather than a plain midpoint: a deliberate push down should
 * finish the reveal even if it was a light one, and a deliberate pull up
 * should close it. The band only returns to where it came from when the input
 * barely moved it at all.
 */
const CURTAIN_COMMIT_PROGRESS = 0.15;

/**
 * Slop (px) for deciding a scroller has reached an edge.
 *
 * Scroll heights are fractional — a tile that is visually at its end reports
 * ~0.5-1px remaining and never reaches 0. A 1px test therefore reads as "still
 * scrollable" forever, which is what stopped the footer curtain from ever
 * revealing on a case study: the reveal only fires once the content is done,
 * and by that test it never was.
 */
const SCROLL_EDGE_EPSILON = 2;

const DETAIL_GESTURE_GAP_MS = 250;
const DETAIL_REACCEL_FACTOR = 1.6;
const DETAIL_TOP_SETTLE_MS = 150;

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
  // Small-mobile (<= 479px) skips the camera/wheel/touch interaction
  // entirely — those phones use native vertical scroll between stacked
  // sections (see mobile/layout.css small-mobile block). Module still
  // initializes for hash routing, page-active class management, and
  // project-detail overlay; only the gesture handlers no-op.
  private isSmallMobile: boolean = false;

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

  /** Footer curtain reveal on map tiles, in px of banked vertical input. */
  private curtainTravel = 0;
  /** Last progress handed to FooterCurtainModule; keeps 0 from re-firing. */
  private curtainProgress = 0;
  /** Pending settle-to-an-end, armed by driveCurtain once input goes quiet. */
  private curtainSettleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Which end the pending settle is aiming at. */
  private curtainSettleTarget: 0 | 1 = 0;
  // project-detail scroll-to-leave tracking (see DETAIL_GESTURE_GAP_MS et al).
  // A deliberate up-scroll at the top leaves for projects; the decaying
  // momentum of scrolling up TO the top does not. detailLastAbsDelta is the
  // previous wheel-delta magnitude (to spot a re-acceleration), detailLastWheelAt
  // the previous timestamp (to spot a fresh scroll after a lull), and
  // detailReachedTopAt when the content last arrived at the top (settle window).
  private detailLastWheelAt: number = 0;
  private detailLastAbsDelta: number = 0;
  private detailReachedTopAt: number = 0;

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
  // A hash change that arrived before the intro finished, replayed after it.
  private deferredHash: string | null = null;

  /**
   * Index of the channel currently shown on the CRT TV when the
   * projects tile is active. Channel 01 is the TV guide itself
   * (currentTvIndex === 0); projects start at channel 02 (index 1).
   * Tracked here (not in ProjectsModule) because vertical scroll on
   * projects is gated through tryNavigateDirection, which needs to know
   * whether scrolling past the boundary should exit the tile or just
   * cycle the TV.
   *
   * Conversion to project slug: slugs[currentTvIndex - 1] for 1+,
   * null for 0 (guide). Total channels = slugs.length + 1.
   */
  private currentTvIndex: number = 0;

  /**
   * Set when the user scrolls UP out of a project-detail back to the
   * projects tile. On arrival, the TV plays (tunes in) the channel for the
   * project they were just reading, so the set "resumes" that channel
   * instead of landing on a static frame. Only this scroll-up return sets
   * it — lateral entries (about/contact) and the intro→projects drop stay
   * on the passive sync so they don't flash a tune-in the user didn't ask
   * for. Cleared the moment it's consumed on the projects page-changed.
   */
  private playChannelOnProjectsArrival: boolean = false;

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
    this.isSmallMobile = window.matchMedia('(max-width: 479px)').matches;

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
      },
      {
        id: 'not-found',
        route: '#/404',
        title: '404 - No Bhad Codes'
      }
    ];

    // Off-map pages render via the blur-swap fallback and have no element on
    // the spatial map, so a missing element is EXPECTED for them — log at debug
    // rather than warning. On-map pages with a missing element are real bugs.
    const OFF_MAP_PAGES = new Set(['project-detail', 'admin-login', 'portal-login', 'not-found']);

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
      } else if (OFF_MAP_PAGES.has(config.id)) {
        this.log(`Off-map page (no map element, uses blur-swap): ${config.id}`);
      } else {
        this.warn(`Page element not found for: ${config.id}`);
      }
    });

    // Initialize page states
    this.initializePageStates();
  }

  /**
   * Whether a page is part of the scroll-map (intro/about/projects/contact).
   * Off-map pages (project-detail, portal-login, admin-login) use the blur-swap
   * transition.
   */
  /**
   * Whether the intro is REALLY over, as opposed to `introComplete`, which
   * flips at ~2.2s while the paw is still retracting and the overlay is still
   * up until ~4.5s. Input has to stay locked for the whole of it — the card
   * being handed over is the one moment on the site that should not be
   * scrollable out from under the viewer.
   */
  private introSettled(): boolean {
    if (!this.introComplete) return false;
    if (!document.documentElement.classList.contains('intro-finished')) return false;
    const overlay = document.querySelector('#intro-morph-overlay');
    if (!overlay) return true;
    const cs = getComputedStyle(overlay);
    return cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none';
  }

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
      // x/y: 0 clears any residual px translate GSAP would otherwise inherit
      // from the pre-JS CSS camera transform (the data-initial-page fallback).
      // Without it, a deep-link/refresh onto a map tile applies GSAP's
      // translate(-100%) ON TOP of the inherited translate(-Npx), doubling the
      // pan and pushing the tile off-screen — the blank projects TV on refresh.
      gsap.set(this.siteMap, { x: 0, y: 0, xPercent: pos.x, yPercent: pos.y });
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
   *
   * IMPORTANT: do NOT touch `#svg-business-card` here. That element lives
   * inside the body-level fixed `#intro-morph-overlay`, which is meant to
   * be retired once the intro animation completes. Writing inline
   * `visibility: visible` to that SVG would paint it through the hidden
   * overlay (CSS spec: a child's `visibility: visible` overrides a parent's
   * `visibility: hidden`), so it would float over every subsequent tile.
   * Paw entry/exit animations set their own initial transforms before
   * tweening, so resetting position here is also unnecessary.
   */
  private restoreIntroCardState(): void {
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
   * Canonical hash for a page, or null for routes whose URL is already
   * authoritative: project-detail carries a slug, and every off-map page is
   * only ever reached BY setting the hash in the first place.
   */
  private canonicalHashFor(pageId: string): string | null {
    switch (pageId) {
      case 'intro':
        return '#/';
      case 'about':
        return '#/about';
      case 'projects':
        return '#/projects';
      case 'contact':
        return '#/contact';
      default:
        return null;
    }
  }

  /**
   * Point the URL at the tile the camera actually landed on.
   *
   * Map → map slides call transitionTo directly and never touch the hash
   * (see tryNavigateDirection), so without this the address bar keeps naming
   * the tile the user scrolled away from — and a reload, a bookmark or a
   * shared link takes them back to it.
   *
   * replaceState rather than assigning location.hash: assigning fires
   * hashchange, which would re-enter handleHashChange and re-run the
   * transition that just finished, and it would stack a history entry on
   * every wheel flick.
   */
  private syncUrlToPage(pageId: string, arrivedVia: Direction | null): void {
    const hash = this.canonicalHashFor(pageId);
    if (!hash || window.location.hash === hash) return;

    window.history.replaceState(window.history.state, '', hash);

    // The tail of navHistory describes the entry the URL now points at, so
    // keep it truthful — popstate reads it back to reverse the slide.
    const entry = { hash, arrivedVia };
    if (this.navHistory.length > 0) {
      this.navHistory[this.navHistory.length - 1] = entry;
    } else {
      this.navHistory.push(entry);
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

    // ↓ is a real destination on the curtain tiles even though the neighbor
    // graph has nothing there — what's below them is the footer. It stays lit
    // only while it still leads somewhere: once the tile is scrolled out AND
    // the band is all the way up, ↓ does nothing, and an arrow that does
    // nothing is worse than no arrow. setCurtainProgress re-runs this as the
    // band moves, so the cue fades out as the footer arrives.
    if (this.curtainOwnsVertical()) {
      const moreTileBelow = this.tileScrollRemaining('down') > SCROLL_EDGE_EPSILON;
      if (moreTileBelow || this.curtainProgress < 1) navigable.add('down');
      else navigable.delete('down');
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

    const cues = document.querySelectorAll<HTMLElement>('.map-compass__cue');
    cues.forEach((cue) => {
      const dir = cue.dataset.cue as Direction | undefined;
      cue.dataset.can = dir && navigable.has(dir) ? 'true' : 'false';
    });

    // On a page that scrolls, the vertical cues belong IN the page rather than
    // pinned to the window. The compass is fixed, so on a long case study ↓
    // sat on top of whatever text happened to be at the bottom of the viewport
    // and ↑ hung there the whole way down. Moved into the scroller they behave
    // like the page: ↑ sits at the top and scrolls away as you leave it, ↓
    // waits at the end of the content and arrives when you reach it.
    const tile = this.pages.get(this.currentPageId)?.element;
    if (tile) {
      const scrolls = tile.scrollHeight > tile.clientHeight + 4;
      for (const dir of ['up', 'down'] as const) {
        const cue = document.querySelector<HTMLElement>(`.map-compass__cue--${dir}`);
        if (!cue) continue;
        if (scrolls && cue.parentElement !== tile) {
          tile.appendChild(cue);
          cue.classList.add('map-compass__cue--in-content');
        } else if (!scrolls && cue.parentElement !== compass) {
          compass.appendChild(cue);
          cue.classList.remove('map-compass__cue--in-content');
        }
      }
    }
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
        // Landing page: left/right enter about/contact. Down is the footer
        // curtain, not a way into the site, so it stays out of the opening
        // hint — the first gesture the user is nudged toward should move them
        // through the map, not raise the footer over the business card.
        return new Set(['left', 'right']);
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
    // Project-detail: horizontal cycles between detail pages (looped,
    // never exits to other main pages); up exits back to the projects
    // TV; down falls through to native scroll on tall case studies.
    if (this.currentPageId === 'project-detail') {
      return direction === 'left' || direction === 'right' || direction === 'up';
    }
    // Map tiles: static graph.
    return NEIGHBORS[this.currentPageId]?.[direction] != null;
  }

  /**
   * Tiles whose vertical axis belongs to the footer curtain — every page that
   * has a footer, which is every map tile but projects.
   *
   * The curtain is the one thing that genuinely lives below these tiles, so it
   * gets the axis: vertical input had otherwise been remapped onto the
   * horizontal carousel. Whether the tile scrolls first makes no difference to
   * who owns the axis — the wheel handler runs the tile's own scroll out before
   * it hands anything to the band — so project-detail belongs here alongside
   * the flat tiles rather than on a path of its own.
   *
   * Projects is the exception: its vertical input channel-surfs the CRT TV, and
   * it is the one tile with no footer to raise.
   */
  private curtainOwnsVertical(): boolean {
    return this.isMapPage(this.currentPageId) && this.currentPageId !== 'projects';
  }

  /**
   * How much scroll the active tile has left in `direction`.
   *
   * The curtain only gets the axis once this reaches zero, so every input
   * route — wheel, touch, the compass cue — has to ask the same question of
   * the same element. A flat tile answers 0 both ways and hands the axis over
   * immediately; the case study answers with what the reader has left.
   */
  private tileScrollRemaining(direction: 'up' | 'down'): number {
    const tile = this.pages.get(this.currentPageId)?.element;
    if (!tile) return 0;
    return direction === 'down'
      ? tile.scrollHeight - tile.scrollTop - tile.clientHeight
      : tile.scrollTop;
  }

  /**
   * Move the curtain by `delta` px of input; positive is toward the bottom of
   * the page, where the panel waits.
   *
   * The band scrubs with the gesture while the gesture lasts, then settles to
   * whichever end the input was heading for — it is never left part-open.
   */
  private driveCurtain(delta: number): void {
    const travel = Math.min(CURTAIN_TRAVEL_PX, Math.max(0, this.curtainTravel + delta));
    if (travel === this.curtainTravel) return;
    this.curtainTravel = travel;
    this.setCurtainProgress(travel / CURTAIN_TRAVEL_PX);
    this.scheduleCurtainSettle(delta > 0 ? 1 : 0);
  }

  /**
   * Arm the settle for the end `target`, restarting the clock so it only fires
   * once the gesture has actually stopped rather than between two events of
   * the same push.
   */
  private scheduleCurtainSettle(target: 0 | 1): void {
    this.curtainSettleTarget = target;
    if (this.curtainSettleTimer) clearTimeout(this.curtainSettleTimer);
    this.curtainSettleTimer = setTimeout(() => {
      this.curtainSettleTimer = null;
      const moved =
        this.curtainSettleTarget === 1 ? this.curtainProgress : 1 - this.curtainProgress;
      // Barely moved: treat it as an accidental brush and put the band back
      // where the gesture found it rather than committing to a new state.
      const end =
        moved >= CURTAIN_COMMIT_PROGRESS ? this.curtainSettleTarget : 1 - this.curtainSettleTarget;
      this.curtainTravel = end * CURTAIN_TRAVEL_PX;
      this.setCurtainProgress(end);
    }, CURTAIN_SETTLE_MS);
  }

  private setCurtainProgress(progress: number): void {
    if (progress === this.curtainProgress) return;
    this.curtainProgress = progress;
    window.dispatchEvent(new CustomEvent('footer-curtain:set-progress', { detail: { progress } }));
    // The ↓ cue is lit off this value — see updateCompass.
    this.updateCompass();
  }

  /** Drop the curtain — the page underneath it is about to change. */
  private resetCurtain(): void {
    if (this.curtainSettleTimer) {
      clearTimeout(this.curtainSettleTimer);
      this.curtainSettleTimer = null;
    }
    this.curtainTravel = 0;
    this.setCurtainProgress(0);
  }

  /**
   * FooterCurtainModule closed the band on its own — the scroller left its end
   * by a route the wheel handler never sees (keyboard, scrollbar, anchor jump).
   * Drop the banked travel to match, or the next wheel up would spend itself
   * closing a band that is already down.
   */
  private handleCurtainClosed = (): void => {
    if (this.curtainSettleTimer) {
      clearTimeout(this.curtainSettleTimer);
      this.curtainSettleTimer = null;
    }
    this.curtainTravel = 0;
    this.curtainProgress = 0;
  };

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

    // Seed the nav stack with wherever the visitor landed. A direct load
    // fires no hashchange, so without this the stack stays empty, the first
    // navigation leaves exactly one entry, and the back button — which needs
    // two, the page it is leaving and the page it is returning to — could
    // never work out which way to slide.
    this.navHistory.push({ hash: hash || '#/', arrivedVia: null });

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

    // FooterCurtainModule can close the band without going through us.
    window.addEventListener('footer-curtain:closed', this.handleCurtainClosed);

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

    // Mark the next handleHashChange as history-driven so it infers a slide
    // direction from history instead of trusting a pinned one.
    //
    // Assigning location.hash fires popstate here as well as hashchange, so
    // the event alone does NOT mean back/forward — measured, one popstate per
    // assignment. Taking it at face value marked every one of our own
    // navigations as history-driven, which threw away the pinned direction:
    // the project-detail carousel pinned 'left', this flag discarded it, and
    // inferSlideDirection returned its forward default, so ← slid in from the
    // right. Our own navigations pin the hash they are heading for, so if that
    // is where we just landed, this popstate is ours.
    window.addEventListener('popstate', () => {
      if (this.pendingSlideForHash && this.pendingSlideForHash === window.location.hash) return;
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
        if (!dir) return;
        if (this.isTransitioning) return;
        // ↓ on a curtain tile isn't a navigation — it raises the footer, and
        // raises it the rest of the way if it's already part-open.
        // Drop focus once the cue has done its job. These are real buttons,
        // so a click leaves the focus ring sitting on whichever arrow was
        // last pressed — which reads as "that direction is engaged" while
        // the user is driving with the keyboard in a different direction.
        cue?.blur();
        if (dir === 'down' && this.curtainOwnsVertical()) {
          // Same rule as the wheel: the tile's own scroll comes first. On a
          // case study the cue reads the reader to the end of the page; only
          // once there is nothing left below does ↓ mean the footer.
          const left = this.tileScrollRemaining('down');
          if (left > SCROLL_EDGE_EPSILON) {
            const tile = this.pages.get(this.currentPageId)?.element;
            tile?.scrollTo({
              top: tile.scrollHeight,
              behavior: this.reducedMotion ? 'auto' : 'smooth'
            });
            return;
          }
          this.driveCurtain(CURTAIN_TRAVEL_PX);
          return;
        }
        if (!this.canNavigate(dir)) return;
        this.tryNavigateDirection(dir);
      });
    }
  }

  /**
   * Handle hash changes for navigation
   */
  private handleHashChange(): void {
    // Consume the popstate flag FIRST, before any early return can strand it.
    // It used to be read further down, so a hashchange that arrived while a
    // transition was running bailed out with the flag still true and poisoned
    // the next navigation: entering a case study from the TV left it set, and
    // the ← that followed had its pinned direction discarded and slid in from
    // the right.
    const fromPopstate = this.popstateInFlight;
    this.popstateInFlight = false;

    // A hash that arrives before the intro is over is not discarded: the menu
    // is clickable while the paw is still running, and a deep link can land at
    // any moment. Dropping it left the URL naming one page while the camera
    // sat on another — the same mismatch the map slides used to create. Hold
    // it and replay it once the intro hands over.
    if (!this.introComplete) {
      this.deferredHash = window.location.hash;
      return;
    }
    if (this.isTransitioning) return;

    const hash = window.location.hash;
    const pageId = this.getPageIdFromHash(hash);

    // Special case: project-detail → project-detail (carousel between slugs)
    // has the same pageId but different content, so the standard
    // pageId !== currentPageId check would skip it and the carousel slide
    // would never run. Detect by comparing slugs.
    const isCarousel = pageId === 'project-detail' && this.currentPageId === 'project-detail';

    if (pageId && (pageId !== this.currentPageId || isCarousel)) {
      // Race protection: a stale pendingSlideDirection from a navigation
      // that got dropped (e.g., wheel set direction → second wheel set a
      // new direction → old hash fires) would slide the wrong way. We
      // pin the direction to its target hash at set-time and only honour
      // it here if (a) it's not from popstate AND (b) the pinned hash
      // matches the hash that just fired. Anything else gets dropped to
      // inference.
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
      if (fromPopstate) {
        // Going back: drop the page being left so the stack mirrors the
        // browser's own depth. Pushing here instead made every back look
        // like another step forward, and the stack only ever grew.
        if (
          this.navHistory.length > 1 &&
          this.navHistory[this.navHistory.length - 1].hash !== hash
        ) {
          this.navHistory.pop();
        }
      } else {
        this.navHistory.push({ hash, arrivedVia: slideDir });
        if (this.navHistory.length > NAV_HISTORY_CAP) {
          this.navHistory.splice(0, this.navHistory.length - NAV_HISTORY_CAP);
        }
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
    // Leaving project-detail. Back to the projects tile is the reverse of the
    // way in — the case study drops DOWN from the TV, so returning to it lifts
    // the tile back down over the top, which is what the breadcrumb, the back
    // link and ArrowUp all mean by "back to projects". Anywhere else is just
    // backward along the carousel.
    if (this.currentPageId === 'project-detail') return pageId === 'projects' ? 'up' : 'left';
    // Entering project-detail. From the projects TV it drops DOWN — the TV
    // scrolls up and out while the detail page pushes up from the bottom
    // (matches the Enter-key reveal). From anywhere else, default forward.
    if (pageId === 'project-detail') {
      return this.currentPageId === 'projects' ? 'down' : 'right';
    }
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
      portal: 'portal-login',
      '404': 'not-found',
      'not-found': 'not-found'
    };

    return hashToPage[cleanPath] || 'not-found';
  }

  /**
   * Handle window resize (with debouncing for performance)
   */
  private handleResize(): void {
    const wasMobile = this.isMobile;
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;
    this.isSmallMobile = window.matchMedia('(max-width: 479px)').matches;

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

      // Replay a hash that arrived while the intro was running — a menu click
      // or a deep link — so the page catches up with the URL instead of the
      // two disagreeing for the rest of the session.
      const deferred = this.deferredHash;
      this.deferredHash = null;
      if (deferred && deferred === window.location.hash) {
        const pageId = this.getPageIdFromHash(deferred);
        if (pageId && pageId !== this.currentPageId) this.handleHashChange();
      }
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
    // Small mobile uses native vertical scroll between stacked sections
    // — gesture-driven camera nav is off so the body's natural scroll
    // owns the experience and we don't pay the GSAP tween cost on every
    // swipe.
    if (this.isSmallMobile) return;
    // During the intro animation, swallow ALL wheel events so the browser
    // can't scroll the page horizontally or vertically before the user is
    // released into the spatial map.
    if (!this.introSettled()) {
      event.preventDefault();
      return;
    }
    // Allow input on map tiles AND on project-detail (so users can scroll
    // back left to projects). Other off-map pages (portal-login, admin)
    // still keep their normal scroll-only behavior.
    if (!this.isMapPage(this.currentPageId) && this.currentPageId !== 'project-detail') return;

    // preventDefault is now scoped to cases where we WILL navigate
    // (see the navigation block below). Letting the browser handle
    // native scroll otherwise means tall content (project-detail case
    // studies) scrolls naturally until a boundary is reached, and
    // pages without scrollable content (intro/about/projects/contact —
    // body+section both have overflow:hidden via virtual-pages layer)
    // simply no-op when wheeled in a non-navigable direction. Mirrors
    // the keyboard handler's approach.

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

    // Wheel navigation follows the SCROLL, not the finger: a scroll down
    // or right goes to the next page, exactly as a scroll down moves you
    // down an ordinary document. That is the same sense as ArrowDown /
    // ArrowRight and as the ↓ / → compass cues, so every input agrees —
    // reading the finger instead used to send the wheel one way and the
    // arrow key the other from the same tile.
    //
    // It matches the platform, too. On a natural-scroll trackpad a swipe
    // toward the left gives deltaX > 0, and that is the gesture that
    // advances a carousel everywhere else on the machine; a mouse wheel
    // or a tilt wheel reports the same signs for the same intent.
    if (event.shiftKey) {
      // Shift + wheel = horizontal carousel navigation. A plain mouse has
      // only a vertical wheel, so this is the mouse-user's equivalent of a
      // trackpad horizontal swipe — holding Shift navigates the carousel.
      // Browsers deliver shift-wheel as deltaX (most) or keep it on deltaY
      // (some), so navigate off whichever axis carries the gesture, using
      // the same natural-scroll sign convention as the horizontal branch.
      const primary = absX >= absY ? dx : dy;
      direction = primary > 0 ? 'right' : 'left';
    } else if (absY >= absX) {
      // Vertical wheel — ANY scroll direction navigates the carousel
      // (vertical or horizontal), so the trackpad and a plain mouse wheel
      // both move between pages. One exception:
      //
      //   - Projects: vertical wheel channel-surfs the CRT TV (handled in
      //     tryNavigateDirection). down/forward → next channel, up → prev.
      //     (Leave projects with a horizontal swipe or Shift+wheel.)
      //
      // Every other tile carries the footer, and on those the vertical axis
      // belongs to the curtain — see curtainOwnsVertical().
      if (this.currentPageId === 'projects') {
        // Scrolling down goes down the channel list, like scrolling down
        // any other list; ArrowDown does the same.
        direction = dy > 0 ? 'down' : 'up';
      } else if (this.curtainOwnsVertical()) {
        // ONE rule for every page that has a footer: vertical input belongs to
        // the tile's own scroll until that scroll runs out, and past the end it
        // belongs to the curtain. Tiles that never overflow are at their end
        // from the first notch, so the band answers immediately; the case study
        // answers once the reader is done with it. Same band, same travel, same
        // easing, wherever you are.
        //
        // The two used to be separate branches — project-detail scrubbing the
        // band one way and the flat tiles another — which is how they drifted
        // apart. main is fixed and opaque either way, so scrolling alone can
        // never uncover the band; the reveal always has to be driven.
        const isDetail = this.currentPageId === 'project-detail';

        if (dy > 0) {
          if (isDetail) {
            this.detailLastWheelAt = performance.now();
            this.detailLastAbsDelta = absY;
            this.detailReachedTopAt = 0;
          }
          const canScrollDown =
            currentTile.scrollHeight - currentTile.scrollTop - currentTile.clientHeight >
            SCROLL_EDGE_EPSILON;
          if (canScrollDown) return;
          event.preventDefault();
          this.driveCurtain(absY);
          return;
        }

        // Pull the curtain back down before the content starts moving again,
        // so the band retracts under the same gesture that raised it.
        if (this.curtainProgress > 0) {
          event.preventDefault();
          this.driveCurtain(-absY);
          return;
        }

        // Band is down. Anything still scrollable above scrolls natively; a
        // flat tile has nothing above and nothing to navigate to on this axis,
        // so the wheel stops here rather than being remapped onto the carousel.
        if (!isDetail) return;

        {
          const now = performance.now();
          const atTop = currentTile.scrollTop <= SCROLL_EDGE_EPSILON;
          if (!atTop) {
            this.detailLastWheelAt = now;
            this.detailLastAbsDelta = absY;
            this.detailReachedTopAt = 0;
            return;
          }
          if (this.detailReachedTopAt === 0) this.detailReachedTopAt = now;
          const gap = now - this.detailLastWheelAt;
          const prevAbs = this.detailLastAbsDelta;
          const settled = now - this.detailReachedTopAt > DETAIL_TOP_SETTLE_MS;
          this.detailLastWheelAt = now;
          this.detailLastAbsDelta = absY;
          if (!settled) return;
          const reaccelerated = absY > prevAbs * DETAIL_REACCEL_FACTOR;
          const freshDistinct = gap > DETAIL_GESTURE_GAP_MS && absY >= prevAbs;
          if (!reaccelerated && !freshDistinct) return;
          direction = 'up';
        }
      } else {
        // Remaining map tiles: remap vertical wheel → horizontal carousel nav
        // so up/down scroll moves between pages too. Scrolling down goes
        // forward, the same way ArrowDown would.
        direction = dy > 0 ? 'right' : 'left';
      }
    } else {
      // Horizontal: scrolling right goes right, matching ArrowRight.
      direction = dx > 0 ? 'right' : 'left';
    }

    // We're about to navigate — only consume the wheel event if there's
    // actually a destination, otherwise let the browser scroll natively.
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
    // Small mobile uses native vertical scroll between stacked sections
    // — gesture-driven camera nav is off so the body's natural scroll
    // owns the experience and we don't pay the GSAP tween cost on every
    // swipe.
    if (this.isSmallMobile) return;

    // Form inputs always opt out — arrow keys must move the caret /
    // change select option / etc. Checked first so a focused input stays
    // fully native regardless of which page is active.
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return;
      }
    }

    // preventDefault is now scoped to cases where we WILL navigate
    // (see below — fired only when canNavigate + edge-guards pass).
    // Letting native arrow-scroll work otherwise means tall content
    // (project-detail case studies) can be read with ↑/↓ until the
    // user reaches a scroll boundary, at which point arrows trigger
    // page navigation. Mirrors the wheel handler's behavior.

    if (this.isTransitioning) return;
    if (!this.introSettled()) return;
    if (!this.isMapPage(this.currentPageId) && this.currentPageId !== 'project-detail') return;

    // Enter on the projects tile opens the currently-highlighted TV
    // channel — direct navigation to the project detail page with a
    // vertical reveal: TV scrolls UP off the top of the viewport while
    // the project detail page pushes UP from the bottom. Direction is
    // 'down' in the slide convention here ('down scroll → outgoing
    // exits UP', see runSlideTransition comment), which produces the
    // TV-scrolls-up + detail-from-bottom effect.
    if ((event.key === 'Enter' || event.key === ' ') && this.currentPageId === 'projects') {
      // Resolve the target slug from whichever channel is currently
      // highlighted on the TV. Prefer the DOM's .is-active row (works
      // for click + arrow + tune-in flows uniformly), fall back to
      // currentTvIndex for keyboard-only nav before anything's been
      // clicked. Channel 01 is the guide (no slug) — Enter on the
      // guide is a no-op.
      const slugs = this.getProjectSlugs();
      const activeRow = document.querySelector<HTMLElement>(
        '.crt-tv__channel-row.is-active:not([aria-hidden="true"])'
      );
      const slug =
        activeRow?.dataset.slug ??
        (this.currentTvIndex > 0 ? slugs[this.currentTvIndex - 1] : undefined);
      if (slug) {
        event.preventDefault();
        this.setPendingSlide('down', `#/projects/${slug}`);
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

    // Vertical arrows obey the same precedence as the wheel, the swipe and the
    // compass: the tile's own scroll first, the curtain past the end of it.
    // Tested before the project-detail block below, or ↓ at the end of a case
    // study would be swallowed there as a no-op and the band would be
    // unreachable from the keyboard on the one page that scrolls.
    if ((direction === 'up' || direction === 'down') && this.curtainOwnsVertical()) {
      if (direction === 'down' && this.tileScrollRemaining('down') <= SCROLL_EDGE_EPSILON) {
        event.preventDefault();
        this.driveCurtain(CURTAIN_TRAVEL_PX);
        return;
      }
      if (direction === 'up' && this.curtainProgress > 0) {
        event.preventDefault();
        this.driveCurtain(-CURTAIN_TRAVEL_PX);
        return;
      }
    }

    // Project-detail vertical: explicitly drive scrolling on the
    // section. Required because body has overflow:hidden under the
    // virtual-pages layer, so the browser's default arrow-key scroll
    // target is killed — without this, ↓/↑ would do nothing on the
    // case study even though the section itself has overflow:auto.
    //
    // ↓: always scrolls the section; if already at the bottom, a
    //    further ↓ is a no-op (no neighbor down — see canNavigate).
    // ↑: scrolls upward when mid-read; only exits to the projects TV
    //    when scrollTop is 0 (delegates to tryNavigateDirection).
    if (this.currentPageId === 'project-detail' && (direction === 'up' || direction === 'down')) {
      const detailSection = this.pages.get('project-detail')?.element ?? null;
      if (!detailSection) return;
      const atTop = detailSection.scrollTop <= SCROLL_EDGE_EPSILON;
      const atBottom =
        detailSection.scrollHeight - detailSection.scrollTop - detailSection.clientHeight <=
        SCROLL_EDGE_EPSILON;

      if (direction === 'down') {
        // No exit-down on project-detail (canNavigate('down') is false).
        // Scroll the section by ~one line. preventDefault stops the
        // browser from also trying to scroll a different element.
        if (!atBottom) {
          event.preventDefault();
          detailSection.scrollBy({ top: 40, behavior: 'smooth' });
        }
        return;
      }

      // direction === 'up'
      if (!atTop) {
        event.preventDefault();
        detailSection.scrollBy({ top: -40, behavior: 'smooth' });
        return;
      }
      // At top: fall through to navigation (back to projects TV).
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
    // Small mobile uses native vertical scroll between stacked sections
    // — gesture-driven camera nav is off so the body's natural scroll
    // owns the experience and we don't pay the GSAP tween cost on every
    // swipe.
    if (this.isSmallMobile) return;
    if (this.isTransitioning) return;
    // During intro, swallow touch starts so swipes don't scroll the page.
    if (!this.introComplete) {
      this.touchStart = null;
      event.preventDefault();
      return;
    }
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
    if (this.isSmallMobile) return;
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
    // Same axis split as the wheel. A finger swiping UP drags the page toward
    // its bottom, which is where the curtain is, so that's the opening
    // direction — the inverse of the finger-direction convention below, which
    // moves a camera rather than a page.
    //
    // And the same precedence as the wheel: the tile's own scroll runs out
    // before the band gets the axis, or a swipe through a case study would
    // raise the footer over content the reader has not reached. A flat tile
    // has no scroll left in either direction, so it hands the axis over on the
    // first swipe exactly as it always did.
    if (absY > absX && this.curtainOwnsVertical()) {
      const opening = dy < 0;
      if (opening && this.tileScrollRemaining('down') > SCROLL_EDGE_EPSILON) return;
      if (!opening && this.curtainProgress === 0) return;
      this.driveCurtain(opening ? absY : -absY);
      return;
    }

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
          currentTile.scrollHeight - currentTile.scrollTop - currentTile.clientHeight >
          SCROLL_EDGE_EPSILON;
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
    if (this.currentPageId === 'projects' && (direction === 'up' || direction === 'down')) {
      // +1 to include the TV guide as channel 01 in the cycle. Total
      // channel count = projects + guide. Index 0 = guide, 1+ = projects.
      const total = this.getProjectSlugs().length + 1;
      if (total <= 1) return;
      const delta = direction === 'down' ? 1 : -1;
      // Modulo wrap so cycling down past last lands on guide, and
      // cycling up before guide lands on last project. Always in bounds.
      this.currentTvIndex = (this.currentTvIndex + delta + total) % total;
      document.dispatchEvent(
        new CustomEvent('projects:set-tv-channel', {
          // cycle:true → user-initiated channel change, projects.ts
          // plays the full tune-in. Page-entry and carousel back-nav
          // dispatches omit cycle so they're treated as passive syncs.
          detail: { index: this.currentTvIndex, direction, cycle: true }
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
      // Leaving this detail (up-exit or carousel neighbor) — reset the
      // scroll-to-leave tracking so it can't linger into the next detail.
      this.detailReachedTopAt = 0;
      this.detailLastAbsDelta = 0;
      this.detailLastWheelAt = performance.now();
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
        // Sync the TV channel to the project we're carouseling to, so
        // returning to projects lands on the most-recently-viewed channel
        // (index 0 is the guide, so project slug index i → channel i + 1).
        const nextSlug = targetHash.replace('#/projects/', '');
        const nextIdx = this.getProjectSlugs().indexOf(nextSlug);
        if (nextIdx >= 0) this.currentTvIndex = nextIdx + 1;
      }
      this.setPendingSlide(direction, targetHash);
      window.location.hash = targetHash;
      return;
    }

    const targetPageId = NEIGHBORS[this.currentPageId]?.[direction];
    if (!targetPageId) return;

    this.wheelCooldownUntil =
      performance.now() + PAGE_ANIMATION.DURATION * 1000 + WHEEL_COOLDOWN_MS;

    // Entering projects from outside: only RESET the TV channel on the
    // very first arrival (currentTvIndex still 0 and we never touched it).
    // After that, preserve whatever channel the user was last viewing so
    // returning to projects lands on the same one — this is what the
    // audit found broken: every entry from contact reset to last,
    // every entry from intro reset to first.
    if (targetPageId === 'projects') {
      const slugs = this.getProjectSlugs();
      if (slugs.length > 0) {
        // Clamp to valid channel range. Index 0 = guide (channel 01),
        // 1..N = projects. Max index is slugs.length.
        const maxIdx = slugs.length;
        if (this.currentTvIndex > maxIdx) this.currentTvIndex = maxIdx;
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
        // Carousel continues from current TV channel. If on guide
        // (channel 01 / index 0), default to first project.
        slug = this.currentTvIndex > 0 ? (slugs[this.currentTvIndex - 1] ?? slugs[0]) : slugs[0];
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
    return cards.map((card) => card.dataset.projectSlug ?? '').filter((slug) => slug.length > 0);
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
   * - left from first project → wrap to last project
   * - left from other project → previous project
   * - right from non-last project → next project
   * - right from last project → wrap to first project
   * - up → exit back to projects tile (TV)
   * - down → null (native scroll stays on the page for tall case studies)
   *
   * Horizontal navigation is a closed loop within the detail pages — it
   * never exits to other main pages. Use up to return to the TV; the
   * TV remembers which channel to show via currentTvIndex.
   */
  private resolveProjectDetailNeighbor(direction: Direction): string | null {
    if (direction === 'down') return null;

    const slugs = this.getProjectSlugs();
    if (slugs.length === 0) return null;

    const currentSlug = this.getCurrentProjectSlug();
    const currentIndex = currentSlug ? slugs.indexOf(currentSlug) : -1;
    if (currentIndex === -1) return null;

    // Up: exit back to projects tile. Sync the TV channel to whichever
    // detail the user was on so re-entering shows the same channel, and
    // flag the arrival to PLAY that channel (tune-in) rather than land on
    // a static frame — this is the "scroll up to projects plays that
    // channel" behavior.
    if (direction === 'up') {
      this.currentTvIndex = currentIndex + 1;
      this.playChannelOnProjectsArrival = true;
      return '#/projects';
    }

    // Horizontal: closed-loop carousel within the detail pages — never
    // exits to projects/contact. Wraps at both ends.
    let nextIndex: number;
    if (direction === 'left') {
      nextIndex = currentIndex === 0 ? slugs.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex >= slugs.length - 1 ? 0 : currentIndex + 1;
    }
    // Keep TV channel index synced (offset +1 since channel 01 is the
    // guide, projects start at channel 02).
    this.currentTvIndex = nextIndex + 1;
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
    // Marks the document for the duration of the move. The scrollers keep
    // their overflow — changing it mid-slide would reflow the page — but
    // their scrollbars are hidden, so a bar belonging to the page being left
    // does not ride across the screen with it.
    document.documentElement.dataset.pageTransitioning = 'true';
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

    // Leaving an off-map page (project-detail/portal-login) for a map tile:
    // drop main's data-active-page="project-detail" tag NOW, before the slide,
    // instead of after (updateActivePageAttribute normally runs post-transition).
    // That tag scopes `main { overflow-y: auto }`, which collapses .site-map's
    // flex height to 0 — so if it lingers through the pull-down, the projects TV
    // renders as a thin band pinned to the top and only settles once the
    // attribute updates after the transition. Setting it early keeps the map
    // layout (.site-map full height) correct as the TV pulls down.
    if (!this.isMapPage(this.currentPageId) && this.isMapPage(pageId)) {
      this.updateActivePageAttribute(pageId);
    }

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
      // The curtain belongs to the page it was raised over, and the banked
      // travel with it — leaving either behind would strand the panel open
      // on a tile the user never pushed down on.
      this.resetCurtain();
      this.updateActivePageAttribute(pageId);
      this.syncUrlToPage(pageId, slideDirection);
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

      // Scroll-up return from a project detail: now that the tile has
      // landed (pan complete), play the tune-in for the channel we synced
      // to, so the TV "resumes" that project. Reuses projects:tune-in →
      // playTuneInSequence, which force-replays without navigating. Desktop
      // only — the scroll map is disabled on mobile, and the tune-in's
      // mobile fallback would navigate back into the detail.
      if (pageId === 'projects' && this.playChannelOnProjectsArrival) {
        this.playChannelOnProjectsArrival = false;
        if (!this.isMobile) {
          const slugs = this.getProjectSlugs();
          const slug = this.currentTvIndex > 0 ? slugs[this.currentTvIndex - 1] : undefined;
          if (slug) {
            document.dispatchEvent(new CustomEvent('projects:tune-in', { detail: { slug } }));
          }
        }
      }

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
      // The animation threw partway, but the camera / page classes have
      // already moved toward the target. Sync page state to the target so
      // currentPageId can't be left stale on the SOURCE page. A stale
      // 'projects' here is what lets the wheel keep cycling TV channels —
      // and resume the channel music — while the user is on another page.
      if (this.currentPageId !== pageId) {
        this.currentPageId = pageId;
        this.resetCurtain();
        this.updateActivePageAttribute(pageId);
        this.syncUrlToPage(pageId, slideDirection);
      }
    } finally {
      this.isTransitioning = false;
      delete document.documentElement.dataset.pageTransitioning;
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
      : (currentPage?.element ?? null);
    const toElement: HTMLElement = (toIsMap ? this.siteMap : targetPage.element) as HTMLElement;

    // Baselines: a map element's resting transform IS its camera position;
    // off-map elements rest at 0.
    const toBaseline = toIsMap
      ? CAMERA_POSITIONS[MAP_TILES[targetPage.id as keyof typeof MAP_TILES]]
      : { x: 0, y: 0 };
    const fromBaseline =
      fromIsMap && currentPage
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

    // ============================================
    // NON-ADJACENT MAP → MAP BRIDGE
    // ============================================
    // When source and target tiles aren't on the same row/column of the
    // spatial map (e.g., about (0, -100%) → projects (100%, 0)), the
    // existing siteMap-only slide path makes the camera jump through
    // the intro tile — visible as the business card briefly flashing
    // mid-slide. To match the user's mental model ("right-arrow always
    // slides horizontally"), we bypass the siteMap animation entirely
    // and translate the source + target tiles individually along the
    // user's pressed axis. siteMap transform stays put during the
    // animation, then snaps to target's camera baseline at the end.
    if (
      fromIsMap &&
      toIsMap &&
      currentPage?.element &&
      this.siteMap &&
      currentPage.id !== targetPage.id
    ) {
      const fromTile = MAP_TILES[currentPage.id as keyof typeof MAP_TILES];
      const toTile = MAP_TILES[targetPage.id as keyof typeof MAP_TILES];
      const fromCss = TILE_CSS_POSITIONS[fromTile];
      const toCss = TILE_CSS_POSITIONS[toTile];

      // Apply the bridge to ALL map → map slides — adjacent and
      // non-adjacent. The previous siteMap-only path snapped the
      // source instantly off-screen before sliding the target in, so
      // adjacent slides like intro → about made the source appear to
      // vanish rather than slide off. Bridge animates source AND
      // target individually so both move together.
      //
      // prefers-reduced-motion: skip the slide entirely. Snap siteMap
      // to the target's camera baseline and the new tile is visible
      // without any animation — same accessibility short-circuit
      // moveCamera() already uses for non-bridge paths.
      if (this.reducedMotion) {
        gsap.set(this.siteMap, {
          xPercent: CAMERA_POSITIONS[toTile].x,
          yPercent: CAMERA_POSITIONS[toTile].y
        });
        this.siteMap.setAttribute('data-map-camera', toTile);
        return;
      }
      {
        const sourceEl = currentPage.element;
        const targetEl = targetPage.element;

        // Hide the other (non-source, non-target) map tiles for the
        // duration of the slide so they can't flash into view as the
        // camera-less individual-tile transforms move source/target.
        const hiddenTiles: HTMLElement[] = [];
        this.pages.forEach((page) => {
          if (
            page.element &&
            this.isMapPage(page.id) &&
            page.id !== currentPage.id &&
            page.id !== targetPage.id
          ) {
            hiddenTiles.push(page.element);
            gsap.set(page.element, { autoAlpha: 0 });
          }
        });

        // siteMap stays at the SOURCE's camera position throughout. We
        // animate source/target tiles individually rather than the
        // camera, so the source naturally appears at viewport (0,0) at
        // start and the target's natural viewport position is offset
        // by (toCss - fromCss) from the source's viewport (0,0).
        gsap.set(this.siteMap, {
          xPercent: fromBaseline.x,
          yPercent: fromBaseline.y
        });

        // Compute per-tile transforms.
        // Source: at viewport (0,0) at start, slides to (outSign*100, 0)
        //         on the user's axis at end. natural-viewport = (0,0)
        //         since siteMap is at source's camera baseline.
        const sourceStart = { x: 0, y: 0 };
        const sourceEnd = {
          x: isHorizontal ? outSign * 100 : 0,
          y: !isHorizontal ? outSign * 100 : 0
        };

        // Target: starts at viewport (inSign*100, 0) on user's axis,
        //         ends at viewport (0,0). Target's natural-viewport
        //         (with siteMap at source's baseline) is (toCss.x -
        //         fromCss.x, toCss.y - fromCss.y). Required transform
        //         = desired-viewport - natural-viewport.
        const naturalDx = toCss.x - fromCss.x;
        const naturalDy = toCss.y - fromCss.y;
        const targetStart = {
          x: (isHorizontal ? inSign * 100 : 0) - naturalDx,
          y: (!isHorizontal ? inSign * 100 : 0) - naturalDy
        };
        const targetEnd = { x: -naturalDx, y: -naturalDy };

        // Pre-position both tiles before the tween so the first frame
        // shows source at viewport center and target at incoming edge.
        gsap.killTweensOf([sourceEl, targetEl]);
        gsap.set(sourceEl, { xPercent: sourceStart.x, yPercent: sourceStart.y });
        gsap.set(targetEl, {
          xPercent: targetStart.x,
          yPercent: targetStart.y,
          autoAlpha: 1
        });

        // Run both tile slides in parallel.
        await Promise.all([
          new Promise<void>((resolve) => {
            gsap.to(sourceEl, {
              xPercent: sourceEnd.x,
              yPercent: sourceEnd.y,
              duration: PAGE_ANIMATION.SLIDE_DURATION,
              ease: PAGE_ANIMATION.SLIDE_EASE,
              onComplete: resolve
            });
          }),
          new Promise<void>((resolve) => {
            gsap.to(targetEl, {
              xPercent: targetEnd.x,
              yPercent: targetEnd.y,
              duration: PAGE_ANIMATION.SLIDE_DURATION,
              ease: PAGE_ANIMATION.SLIDE_EASE,
              onComplete: resolve
            });
          })
        ]);

        // Cleanup: snap siteMap to target's real camera baseline,
        // clear individual tile transforms, restore hidden tiles.
        gsap.set(this.siteMap, {
          xPercent: toBaseline.x,
          yPercent: toBaseline.y
        });
        this.siteMap.setAttribute('data-map-camera', toTile);
        gsap.set(sourceEl, { clearProps: 'xPercent,yPercent' });
        gsap.set(targetEl, { clearProps: 'xPercent,yPercent' });
        hiddenTiles.forEach((el) => gsap.set(el, { autoAlpha: 1 }));
        return;
      }
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
    window.removeEventListener('footer-curtain:closed', this.handleCurtainClosed);
    if (this.curtainSettleTimer) {
      clearTimeout(this.curtainSettleTimer);
      this.curtainSettleTimer = null;
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
