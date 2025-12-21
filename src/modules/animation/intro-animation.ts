/**
 * ===============================================
 * INTRO ANIMATION MODULE
 * ===============================================
 * @file src/modules/intro-animation.ts
 * @extends BaseModule
 *
 * OVERVIEW:
 * This module creates a stylized coyote paw intro animation where
 * the paw clutches a business card, releases it with morphing fingers,
 * and retracts diagonally off-screen, leaving the card in place.
 *
 * DESIGN:
 * - Desktop: Full paw morph animation with SVG path morphing
 * - Mobile: Simple card flip fallback (no paw overlay)
 * - Enter key skips animation at any point
 * - Header fades in after animation completes
 * - Animation replays if 20+ minutes since last view (stored in localStorage)
 *
 * ANIMATION SEQUENCE (Desktop):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Phase 0: ENTRY (0.8s)                                           │
 * │   - Paw + card enter from top-left (-800, -600)                 │
 * │   - Animate to center position (0, 0)                           │
 * │   - All layers move together: behindCardGroup, aboveCardGroup,  │
 * │     and svg-business-card                                       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 1: CLUTCH HOLD (0.8s)                                     │
 * │   - Paw grips the card motionless                               │
 * │   - Fingers visible in Position 1 (clutching)                   │
 * │   - Thumb is hidden (not visible until release)                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 2: FINGER RELEASE (0.5s)                                  │
 * │   - All fingers morph simultaneously: Position 1 → Position 2  │
 * │   - Thumb appears instantly (opacity 0 → 1) behind card         │
 * │   - Fingers are still over the card during this phase           │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 3: RETRACTION + FINAL MORPH (1.6s)                        │
 * │   - Starts 0.02s after Phase 2 completes                        │
 * │   - Paw retracts diagonally to top-left (-1500, -1200)          │
 * │   - All fingers morph: Position 2 → Position 3 (fully open)    │
 * │   - Finger A: 0.08s, Finger B: 0.08s, Finger C: 0.2s            │
 * │   - Morphs complete while fingers still visible over card       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 4: COMPLETION                                             │
 * │   - Paw fully exits off-screen (no fade, just movement)         │
 * │   - Actual business card remains visible underneath             │
 * │   - Overlay becomes non-interactive (pointer-events: none)      │
 * │   - Header fades in                                             │
 * │   - intro-complete class added to document                      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * EXIT ANIMATION (when navigating away from intro page):
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ DESIGN DECISIONS (INTENTIONAL):                                 │
 * │   - Header/nav stays visible during exit (overlay below header) │
 * │   - Nav links fade immediately on click (0.15s)                 │
 * │   - SVG is cached after intro to eliminate fetch delay          │
 * │   - about-hero-desktop hidden to prevent text showing through   │
 * │   - Uses intro-morph-overlay, NOT page-transition-overlay       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 1: PAW ENTERS (0.8s)                                      │
 * │   - Paw enters from off-screen (-1500, -1200)                   │
 * │   - Fingers in Position 3 (open), morph to Position 2 near end  │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 2: FINGER MORPH (0.3s)                                    │
 * │   - Fingers morph: Position 2 → Position 1 (clutching)          │
 * │   - Thumb fades out as it goes behind card                      │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 3: CLUTCH HOLD (0.4s)                                     │
 * │   - Paw grips card motionless                                   │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Phase 4: EXIT (0.6s)                                            │
 * │   - Paw + card exit together to (-1500, -1200)                  │
 * │   - Must fully exit viewport before animation completes         │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * SVG STRUCTURE (coyote_paw.svg):
 * The SVG contains multiple position states for morphing:
 *
 *   Arm_Base     - The arm/forearm (behind card, retracts with paw)
 *   Position_1   - Fingers A, B, C in clutching position (NO thumb)
 *   Position_2   - Fingers A, B, C releasing + Thumb appears
 *   Position_3   - Fingers A, B, C fully open + Thumb
 *   Card         - Business card rectangle (stays in place)
 *
 * LAYER ORDER (bottom to top):
 *   1. behindCardGroup (retracts)
 *      - Arm_Base
 *      - Thumb (from Position_2, starts hidden)
 *   2. svg-business-card (stays in place, then hidden)
 *   3. aboveCardGroup (retracts)
 *      - Fingers from Position_1 (morph during animation)
 *
 * FINGER PATH IDs:
 *   Position 1 (morph source):
 *     - Finger A: #_1_Morph_Above_Card_-_Fingers_
 *     - Finger B: #_FInger_B_-_Above_Card_ (group) → path inside
 *     - Finger C: #_FInger_C-_Above_Card_ (group) → path inside
 *
 *   Position 2 (morph target):
 *     - Finger A: #_FInger_A_-_Above_Card_-2
 *     - Finger B: #_FInger_B-_Above_Card_
 *     - Finger C: #_FInger_C_-_Above_Card_
 *     - Thumb:    #_Thumb_Behind_Card_
 *
 *   Position 3 (morph target):
 *     - Finger A: #_FInger_A_-_Above_Card_-3
 *     - Finger B: #_FInger_B-_Above_Card_-2
 *     - Finger C: #_FInger_C_-_Above_Card_-2
 *     - Thumb:    #_Thumb_Behind_Card_-2
 *
 * ALIGNMENT:
 * The SVG is scaled and positioned to align perfectly with the actual
 * business card element on the page. The alignment formula:
 *
 *   scale = actualCardRect.width / SVG_CARD.width
 *   translateX = actualCardRect.left - (SVG_CARD.x * scale)
 *   translateY = actualCardRect.top - (SVG_CARD.y * scale)
 *
 * SKIP CONDITIONS:
 * The animation is skipped when:
 *   1. Less than 20 minutes since last animation (timestamp in localStorage)
 *   2. prefers-reduced-motion: reduce is set
 *   3. Required SVG elements not found (falls back to card flip)
 *   4. User presses Enter key during animation
 *
 * DEPENDENCIES:
 *   - GSAP Core: Animation timeline and transforms
 *   - MorphSVGPlugin: SVG path morphing (GSAP premium plugin)
 *
 * RELATED FILES:
 *   - public/images/coyote_paw.svg - SVG artwork with all positions
 *   - docs/design/COYOTE_PAW_ANIMATION.md - Design documentation
 *
 * NOTE: SVG constants below are extracted from coyote_paw.svg
 *       Card_Outline rect. Update these if the SVG changes.
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { ModuleOptions } from '../../types/modules';
import {
  SVG_PATH,
  SVG_CARD,
  SVG_ELEMENT_IDS,
  DOM_ELEMENT_IDS,
  REPLAY_CONFIG
} from '../../config/intro-animation-config';
import { ANIMATION_CONSTANTS, calculateShadowOffset } from '../../config/animation-constants';

// Import extracted intro animation modules
import * as SvgBuilder from './intro/svg-builder';
import * as MorphTimeline from './intro/morph-timeline';

// Register MorphSVG plugin with GSAP
gsap.registerPlugin(MorphSVGPlugin);

// ============================================================================
// DERIVED CONSTANTS
// ============================================================================

/** SVG file path with cache-busting timestamp */
const PAW_SVG = `${SVG_PATH}?v=${Date.now()}`;

// ============================================================================
// INTRO ANIMATION MODULE CLASS
// ============================================================================

export class IntroAnimationModule extends BaseModule {
  /** GSAP timeline controlling the animation sequence */
  private timeline: gsap.core.Timeline | null = null;

  /** GSAP timeline for exit animation (paw grabs card and exits) */
  private exitTimeline: gsap.core.Timeline | null = null;

  /** GSAP timeline for entry animation (paw brings card back) */
  private entryTimeline: gsap.core.Timeline | null = null;

  /** Flag indicating if animation has completed or been skipped */
  private isComplete = false;

  /** Keyboard event handler for Enter key skip functionality */
  private skipHandler: ((event: KeyboardEvent) => void) | null = null;

  /** Reference to the overlay element containing the SVG animation */
  private morphOverlay: HTMLElement | null = null;

  /** Cached SVG content to avoid re-fetching on exit/entry animations */
  private cachedSvgText: string | null = null;

  constructor(options: ModuleOptions = {}) {
    super('IntroAnimationModule', { debug: true, ...options });

    // Bind methods to maintain correct 'this' context
    this.handleSkip = this.handleSkip.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  /**
   * Initialize the intro animation module
   *
   * Checks device type, session state, and motion preferences before
   * deciding which animation to run (or whether to skip entirely).
   */
  override async init(): Promise<void> {
    await super.init();

    // ========================================================================
    // MOBILE HEADER FIX
    // On mobile, ensure header is visible from the start (no intro effect)
    // ========================================================================
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      const header = document.querySelector('.header') as HTMLElement;
      if (header) {
        header.style.removeProperty('opacity');
        header.style.removeProperty('visibility');
        Array.from(header.children).forEach((child) => {
          (child as HTMLElement).style.removeProperty('opacity');
          (child as HTMLElement).style.removeProperty('visibility');
        });
      }
    }

    // ========================================================================
    // REDUCED MOTION CHECK
    // Respect user's motion preferences for accessibility
    // ========================================================================
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.log('Reduced motion preferred - skipping animation');
      this.skipIntroImmediately();
      return;
    }

    // ========================================================================
    // RUN APPROPRIATE ANIMATION
    // Desktop: Full paw morph animation
    // Mobile: Simple card flip fallback
    // ========================================================================
    try {
      if (isMobile) {
        this.runCardFlip();
      } else {
        await this.runMorphAnimation();
      }
    } catch (error) {
      this.error('Failed to initialize intro animation:', error);
      this.completeIntro();
    }
  }

  /**
   * Run the full paw morph animation (desktop only)
   *
   * This is the main animation method that:
   * 1. Loads and parses the SVG file
   * 2. Assembles layers in correct z-order
   * 3. Aligns SVG card with actual business card
   * 4. Creates GSAP timeline with all animation phases
   * 5. Executes the animation sequence
   *
   * Animation phases:
   * - Entry: Paw enters from top-left
   * - Clutch: Paw holds card motionless
   * - Release: Fingers morph from position 1 to 2
   * - Retract: Paw exits while fingers morph to position 3
   */
  private async runMorphAnimation(): Promise<void> {
    // ========================================================================
    // SCROLL RESET
    // Ensure page is at top before animation starts
    // ========================================================================
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // ========================================================================
    // GET OVERLAY ELEMENTS
    // These are placeholder elements in the HTML that we'll populate
    // ========================================================================
    this.morphOverlay = document.getElementById(DOM_ELEMENT_IDS.morphOverlay);
    const morphSvg = document.getElementById(DOM_ELEMENT_IDS.morphSvg) as SVGSVGElement | null;
    const morphPaw = document.getElementById(DOM_ELEMENT_IDS.morphPaw);
    const morphCardGroup = document.getElementById(DOM_ELEMENT_IDS.morphCardGroup);

    if (!this.morphOverlay || !morphSvg || !morphPaw || !morphCardGroup) {
      this.log('Morph overlay elements not found, falling back to card flip');
      this.runCardFlip();
      return;
    }

    // ========================================================================
    // GET BUSINESS CARD FOR ALIGNMENT
    // We need to align the SVG card with the actual DOM element
    // ========================================================================
    const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
    if (!businessCard) {
      this.log('Business card element not found, falling back to card flip');
      this.runCardFlip();
      return;
    }

    // ========================================================================
    // LOAD AND PARSE SVG
    // Use extracted SVG builder module (with caching)
    // ========================================================================
    this.log('Loading SVG file...');
    const svgDoc = await SvgBuilder.fetchAndParseSvg(PAW_SVG);

    // Cache SVG text for exit/entry animations
    const response = await fetch(PAW_SVG);
    this.cachedSvgText = await response.text();

    // ========================================================================
    // EXTRACT SVG ELEMENTS
    // Use extracted SVG builder module (with caching)
    // ========================================================================
    const elements = SvgBuilder.extractSvgElements(svgDoc, PAW_SVG);

    if (!elements.position1 || !elements.position2) {
      this.error('Position groups not found in SVG');
      this.runCardFlip();
      return;
    }

    this.log('Loaded SVG elements: armBase, position1, position2, position3, cardGroup');

    // ========================================================================
    // CALCULATE ALIGNMENT
    // Use extracted SVG builder module
    // ========================================================================
    const alignment = SvgBuilder.calculateSvgAlignment(businessCard);
    this.log('Alignment:', alignment);

    // ========================================================================
    // PREPARE SVG CONTAINER
    // Remove placeholder elements, we'll add our own structure
    // ========================================================================
    morphSvg.removeChild(morphCardGroup);
    morphSvg.removeChild(morphPaw);

    // ========================================================================
    // ASSEMBLE SVG LAYERS
    // Use extracted SVG builder module to create all layers
    // ========================================================================
    const { layers, clonedPos1, clonedThumb } = SvgBuilder.assembleAllLayers(
      morphSvg,
      elements,
      alignment
    );

    // Copy SVG styles
    SvgBuilder.copySvgStyles(morphSvg, svgDoc);

    this.log('SVG layers assembled: arm → thumb → card → fingers');

    // ========================================================================
    // BUSINESS CARD VISIBILITY
    // Keep actual business card visible underneath SVG
    // This prevents flash when SVG card is hidden at end
    // ========================================================================
    // (No hiding needed - card stays visible)

    // ========================================================================
    // SETUP SKIP HANDLER
    // Allow user to skip animation by pressing Enter
    // ========================================================================
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // ========================================================================
    // GET FINGER PATH REFERENCES AND DATA
    // Use extracted SVG builder functions
    // ========================================================================
    if (!clonedPos1 || !elements.position2) {
      this.error('Missing SVG position elements');
      this.runCardFlip();
      return;
    }

    const fingerRefs = SvgBuilder.getFingerPathReferences(
      clonedPos1,
      elements.position2,
      elements.position3
    );

    const pathData = SvgBuilder.getCompleteMorphPathData(
      fingerRefs,
      elements.position2,
      elements.position3,
      PAW_SVG // Cache key for path data
    );

    // ========================================================================
    // CREATE ANIMATION TIMELINE
    // Use extracted timeline builder functions
    // ========================================================================
    this.timeline = MorphTimeline.buildMainAnimationTimeline(
      () => this.completeMorphAnimation(),
      layers.behindCardGroup,
      layers.aboveCardGroup,
      layers.cardLayer,
      fingerRefs,
      pathData,
      clonedThumb,
      this.morphOverlay
    );
  }

  /**
   * Complete the morph animation and clean up
   *
   * Called when the GSAP timeline completes. Hides the overlay
   * and triggers the common intro completion logic.
   */
  private completeMorphAnimation(): void {
    // Hide overlay completely after animation finishes
    if (this.morphOverlay) {
      this.morphOverlay.style.visibility = 'hidden';
    }

    this.completeIntro();
  }

  /**
   * Animate header content fading in
   *
   * Uses a proxy object to animate opacity across all header children,
   * then removes inline styles to restore CSS control.
   *
   * @param header - The header element to animate
   */
  private animateHeaderIn(header: HTMLElement): void {
    const headerChildren = header.children;

    // Set initial state - invisible but in layout
    Array.from(headerChildren).forEach((child) => {
      (child as HTMLElement).style.setProperty('opacity', '0', 'important');
      (child as HTMLElement).style.setProperty('visibility', 'visible', 'important');
    });

    // Animate using a proxy object for clean updates
    const proxy = { opacity: 0 };
    gsap.to(proxy, {
      opacity: 1,
      duration: 1.0,
      ease: 'power2.out',
      onUpdate: () => {
        Array.from(headerChildren).forEach((child) => {
          (child as HTMLElement).style.setProperty(
            'opacity',
            String(proxy.opacity),
            'important'
          );
        });
      },
      onComplete: () => {
        // Remove inline styles to restore CSS control
        Array.from(headerChildren).forEach((child) => {
          (child as HTMLElement).style.removeProperty('opacity');
          (child as HTMLElement).style.removeProperty('visibility');
        });
      }
    });
  }

  /**
   * Skip intro immediately without any animation
   *
   * Used for returning visitors (same session) and users
   * who prefer reduced motion. Sets all final states directly.
   */
  private skipIntroImmediately(): void {
    this.isComplete = true;

    // Hide morph overlay
    const morphOverlay = document.getElementById(DOM_ELEMENT_IDS.morphOverlay);
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
    }

    // Remove intro classes and show content immediately
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete', 'intro-finished');

    // Make sure card is visible
    const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    // Reset card to front-facing position (no flip)
    const cardInner = document.getElementById(DOM_ELEMENT_IDS.businessCardInner);
    if (cardInner) {
      cardInner.style.transition = 'none';
      cardInner.style.transform = 'rotateY(0deg)';
    }

    // Make header visible immediately
    const header = document.querySelector('.header') as HTMLElement;
    if (header) {
      header.style.removeProperty('opacity');
      header.style.removeProperty('visibility');
    }

    // Dispatch completion event for PageTransitionModule
    // This enables virtual page transitions even when intro is skipped
    this.dispatchEvent('complete');
    this.log('Intro skipped - dispatched complete event');
  }

  /**
   * Handle keyboard input for skip functionality
   *
   * @param event - Keyboard event
   */
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isComplete) {
      this.handleSkip();
    }
  }

  /**
   * Skip to end of animation
   *
   * Jumps the timeline to 100% progress, triggering all
   * onComplete callbacks immediately.
   */
  private handleSkip(): void {
    if (this.timeline && !this.isComplete) {
      this.timeline.progress(1);
    } else if (!this.isComplete) {
      this.completeIntro();
    }
  }

  /**
   * Run card flip animation (mobile fallback)
   *
   * A simpler animation for mobile devices that doesn't use
   * the paw overlay. Shows the card back briefly, then flips
   * to reveal the front.
   */
  private runCardFlip(): void {
    // Hide morph overlay on mobile (not used)
    const morphOverlay = document.getElementById(DOM_ELEMENT_IDS.morphOverlay);
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
    }

    // Scroll to top
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    const cardInner = document.getElementById(DOM_ELEMENT_IDS.businessCardInner);

    if (!cardInner) {
      this.completeIntro();
      return;
    }

    const cardContainer = cardInner.parentElement;

    // Set initial state - showing back of card
    cardInner.style.transition = 'none';
    cardInner.style.transform = 'rotateY(180deg)';

    if (cardContainer) {
      cardContainer.style.perspective = '1000px';
    }

    // Setup Enter key to skip animation
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // Create timeline for card flip
    this.timeline = gsap.timeline({
      onComplete: () => this.completeIntro()
    });

    const header = document.querySelector('.header') as HTMLElement;

    this.timeline
      .to({}, { duration: 2.0 }) // Pause showing back
      .to(cardInner, {
        rotationY: 0,
        duration: 1.5,
        ease: 'power2.inOut',
        force3D: true,
        overwrite: true,
        onComplete: () => {
          document.documentElement.classList.remove('intro-loading');
          document.documentElement.classList.add('intro-complete');

          // Header is always visible with transparent bg during animation
          // Just ensure any inline styles are removed
          if (header) {
            header.style.removeProperty('opacity');
            header.style.removeProperty('visibility');
          }
        }
      });
  }

  /**
   * Complete the intro and clean up
   *
   * Common completion logic for all animation paths:
   * - Sets sessionStorage to prevent replay
   * - Ensures all content is visible
   * - Cleans up event listeners
   * - Updates app state
   * - Dispatches 'complete' event for PageTransitionModule
   */
  private completeIntro(): void {
    if (this.isComplete) return;

    this.isComplete = true;

    // Store timestamp for 20-minute replay logic
    localStorage.setItem(REPLAY_CONFIG.timestampKey, String(Date.now()));

    // Ensure main page content is visible
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Ensure business card is visible
    const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    // Scroll to top
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // Add intro-finished class after transition completes
    setTimeout(() => {
      document.documentElement.classList.add('intro-finished');
    }, 600);

    // Clean up event listeners
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    // Update app state if available
    if (typeof window !== 'undefined' && (window as any).NBW_STATE) {
      (window as any).NBW_STATE.setState({ introAnimating: false });
    }

    // Dispatch completion event for PageTransitionModule
    // This enables virtual page transitions after intro completes
    this.dispatchEvent('complete');
    this.log('Intro complete - dispatched complete event');
  }

  /**
   * Play exit animation (reverse of intro)
   * Called when transitioning away from the home/intro page
   *
   * Animation sequence:
   * 1. Links fade out
   * 2. Paw enters from off-screen
   * 3. Fingers morph to clutching position
   * 4. Paw grabs card
   * 5. Paw + card exit together
   *
   * @returns Promise that resolves when animation completes
   */
  async playExitAnimation(): Promise<void> {
    console.log('[IntroAnimation] playExitAnimation called');

    // Skip on mobile - no paw animation
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      this.log('Mobile - skipping exit animation');
      console.log('[IntroAnimation] Mobile detected - skipping');
      return;
    }

    // Skip if reduced motion preferred
    if (this.reducedMotion) {
      this.log('Reduced motion - skipping exit animation');
      console.log('[IntroAnimation] Reduced motion - skipping');
      return;
    }

    this.log('Playing exit animation (reverse intro)');
    console.log('[IntroAnimation] Starting exit animation');

    // Get overlay and SVG elements
    this.morphOverlay = document.getElementById(DOM_ELEMENT_IDS.morphOverlay);
    const morphSvg = document.getElementById(DOM_ELEMENT_IDS.morphSvg) as SVGSVGElement | null;

    console.log('[IntroAnimation] morphOverlay:', this.morphOverlay);
    console.log('[IntroAnimation] morphSvg:', morphSvg);

    if (!this.morphOverlay || !morphSvg) {
      this.log('Morph overlay not found, skipping exit animation');
      console.log('[IntroAnimation] FAILED: Overlay or SVG not found');
      return;
    }

    // Get business card for alignment
    const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
    console.log('[IntroAnimation] businessCard:', businessCard);
    if (!businessCard) {
      this.log('Business card not found');
      console.log('[IntroAnimation] FAILED: Business card not found');
      return;
    }

    // Get intro nav for fade out
    const introNav = document.querySelector('.intro-nav') as HTMLElement;
    console.log('[IntroAnimation] introNav:', introNav);

    // Use cached SVG if available, otherwise fetch
    let svgText: string;
    if (this.cachedSvgText) {
      console.log('[IntroAnimation] Using cached SVG');
      svgText = this.cachedSvgText;
    } else {
      console.log('[IntroAnimation] Loading SVG from:', PAW_SVG);
      const response = await fetch(PAW_SVG);
      svgText = await response.text();
      this.cachedSvgText = svgText;
    }
    console.log('[IntroAnimation] SVG ready, length:', svgText.length);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // Get SVG elements
    const armBase = svgDoc.getElementById(SVG_ELEMENT_IDS.armBase);
    const position1 = svgDoc.getElementById(SVG_ELEMENT_IDS.position1);
    const position2 = svgDoc.getElementById(SVG_ELEMENT_IDS.position2);
    const position3 = svgDoc.getElementById(SVG_ELEMENT_IDS.position3);
    const cardGroup = svgDoc.getElementById(SVG_ELEMENT_IDS.cardGroup);

    console.log('[IntroAnimation] SVG elements found:',
      { armBase: !!armBase, position1: !!position1, position2: !!position2, position3: !!position3, cardGroup: !!cardGroup });

    if (!position1 || !position2 || !position3) {
      this.log('Position groups not found');
      console.log('[IntroAnimation] FAILED: Position groups missing');
      return;
    }

    return new Promise((resolve) => {

      // Calculate alignment
      const cardRect = businessCard.getBoundingClientRect();
      const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
      const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;
      const scale = actualCardRect.width / SVG_CARD.width;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const translateX = actualCardRect.left - (SVG_CARD.x * scale);
      const translateY = actualCardRect.top - (SVG_CARD.y * scale);

      // Clear and rebuild SVG
      morphSvg.innerHTML = '';
      morphSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
      morphSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Add shadow filter
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', 'card-shadow');
      filter.setAttribute('x', '-50%');
      filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '200%');
      filter.setAttribute('height', '200%');
      const shadow = calculateShadowOffset(1 / scale);
      const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      dropShadow.setAttribute('dx', '0');
      dropShadow.setAttribute('dy', String(shadow.base));
      dropShadow.setAttribute('stdDeviation', String(shadow.blur));
      dropShadow.setAttribute('flood-color', ANIMATION_CONSTANTS.COLORS.SHADOW_DEFAULT);
      filter.appendChild(dropShadow);
      defs.appendChild(filter);
      morphSvg.appendChild(defs);

      // ========================================================================
      // CREATE LAYER STRUCTURE - IDENTICAL TO INTRO ANIMATION
      // ========================================================================

      // Main wrapper with transform for scaling and positioning
      const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      transformWrapper.setAttribute('id', 'exit-layers-wrapper');
      transformWrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

      // Group for elements BEHIND the card (arm + thumb) - SAME AS INTRO
      const behindCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      behindCardGroup.setAttribute('id', 'behind-card-group');
      // NOTE: No filter on behindCardGroup - filters can cause stacking context issues
      // The arm/thumb don't need shadows as prominently as fingers

      // Group for elements ABOVE the card (fingers) - SAME AS INTRO
      const aboveCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      aboveCardGroup.setAttribute('id', 'above-card-group');
      aboveCardGroup.setAttribute('filter', 'url(#card-shadow)');

      // ========================================================================
      // ASSEMBLE BEHIND-CARD LAYER - SAME AS INTRO
      // ========================================================================

      // Add arm base (behind card, retracts with paw)
      if (armBase) {
        const clonedArm = armBase.cloneNode(true) as Element;
        clonedArm.setAttribute('id', 'arm-group');
        behindCardGroup.appendChild(clonedArm);
      }

      // Add thumb from Position 3 (open hand position) for exit animation
      // Starts VISIBLE (paw is off-screen, no overlap with card)
      // Will HIDE before paw reaches card position
      const thumbElement = position3.querySelector(`#${SVG_ELEMENT_IDS.thumb3}`);
      let clonedThumb: Element | null = null;
      if (thumbElement) {
        clonedThumb = thumbElement.cloneNode(true) as Element;
        clonedThumb.setAttribute('id', 'thumb-behind-card');
        (clonedThumb as SVGSVGElement).style.opacity = '1'; // Visible initially (paw off-screen)
        behindCardGroup.appendChild(clonedThumb);
      }

      // Add behind-card group to wrapper (layer 1)
      transformWrapper.appendChild(behindCardGroup);

      // ========================================================================
      // ASSEMBLE CARD LAYER - SAME AS INTRO
      // ========================================================================

      // Add business card graphic (layer 2)
      if (cardGroup) {
        const clonedCard = cardGroup.cloneNode(true) as Element;
        clonedCard.setAttribute('id', 'svg-business-card');
        clonedCard.setAttribute('filter', 'url(#card-shadow)');

        // Ensure card has solid fill background to hide thumb behind it
        const cardRectElement = clonedCard.querySelector('rect');
        if (cardRectElement) {
          cardRectElement.setAttribute('fill', ANIMATION_CONSTANTS.COLORS.CARD_FILL);
          cardRectElement.setAttribute('fill-opacity', '1');
        }

        transformWrapper.appendChild(clonedCard);
      }

      // ========================================================================
      // ASSEMBLE ABOVE-CARD LAYER
      // For EXIT: Start from Position 3 (open), morph to Position 1 (clutching)
      // This is the REVERSE of intro which starts Position 1 and morphs to Position 3
      // ========================================================================

      // Add fingers from Position 3 (above card, visible initially)
      // These will morph: Position 3 → Position 2 → Position 1
      // IMPORTANT: Remove thumb from cloned position3 - thumb is in behindCardGroup
      const clonedPos3 = position3.cloneNode(true) as Element;
      clonedPos3.setAttribute('id', 'position-3-exit');

      // Remove thumb from this clone - it should only be in behindCardGroup
      const thumbInPos3 = clonedPos3.querySelector(`#${SVG_ELEMENT_IDS.thumb3}`);
      if (thumbInPos3) {
        thumbInPos3.remove();
      }

      aboveCardGroup.appendChild(clonedPos3);

      // Add above-card group to wrapper (layer 3 - top)
      transformWrapper.appendChild(aboveCardGroup);

      // ========================================================================
      // COPY SVG STYLES - SAME AS INTRO
      // ========================================================================
      const sourceStyles = svgDoc.querySelector('style');
      if (sourceStyles) {
        const clonedStyles = sourceStyles.cloneNode(true) as Element;
        morphSvg.insertBefore(clonedStyles, morphSvg.firstChild);
      }

      // Add completed wrapper to the SVG element
      morphSvg.appendChild(transformWrapper);

      // Add paw-exit class so overlay doesn't cover header/footer
      // Remove intro-complete/intro-finished so CSS doesn't hide the overlay
      document.documentElement.classList.add('paw-exit');
      document.documentElement.classList.remove('intro-complete', 'intro-finished');

      // Show overlay (we know morphOverlay is not null from earlier check)
      const overlay = this.morphOverlay!;
      console.log('[IntroAnimation] Showing overlay');
      overlay.style.visibility = 'visible';
      overlay.style.pointerEvents = 'auto';
      overlay.classList.remove('hidden');
      overlay.style.display = 'block';
      overlay.style.opacity = '1';

      // Hide actual business card (SVG card will show instead)
      console.log('[IntroAnimation] Hiding business card');
      businessCard.style.opacity = '0';

      // Hide about-hero-desktop so its text doesn't show through during exit
      const aboutHero = document.querySelector('.about-hero-desktop') as HTMLElement;
      if (aboutHero) {
        aboutHero.style.visibility = 'hidden';
      }

      // Get finger paths for morphing
      const fingerA3 = clonedPos3.querySelector(`#${SVG_ELEMENT_IDS.fingerA3}`) as SVGPathElement;
      const fingerB3 = clonedPos3.querySelector(`#${SVG_ELEMENT_IDS.fingerB3}`) as SVGPathElement;
      const fingerC3 = clonedPos3.querySelector(`#${SVG_ELEMENT_IDS.fingerC3}`) as SVGPathElement;

      console.log('[IntroAnimation] Exit - Finger elements from Position 3:',
        { fingerA3: !!fingerA3, fingerB3: !!fingerB3, fingerC3: !!fingerC3 });

      const fingerA2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerA2}`) as SVGPathElement;
      const fingerB2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerB2}`) as SVGPathElement;
      const fingerC2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerC2}`) as SVGPathElement;

      console.log('[IntroAnimation] Exit - Finger elements from Position 2:',
        { fingerA2: !!fingerA2, fingerB2: !!fingerB2, fingerC2: !!fingerC2 });

      const fingerA1 = position1.querySelector(`#${SVG_ELEMENT_IDS.fingerA1}`) as SVGPathElement;
      const fingerB1 = position1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerB1Container}"] path`) as SVGPathElement;
      const fingerC1 = position1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerC1Container}"] path`) as SVGPathElement;

      console.log('[IntroAnimation] Exit - Finger elements from Position 1:',
        { fingerA1: !!fingerA1, fingerB1: !!fingerB1, fingerC1: !!fingerC1 });

      const fingerA2PathData = fingerA2?.getAttribute('d');
      const fingerA1PathData = fingerA1?.getAttribute('d');
      const fingerB2PathData = fingerB2?.getAttribute('d');
      const fingerB1PathData = fingerB1?.getAttribute('d');
      const fingerC2PathData = fingerC2?.getAttribute('d');
      const fingerC1PathData = fingerC1?.getAttribute('d');

      // Thumb morph targets (reverse: 3→2→1)
      const thumb2 = position2.querySelector(`#${SVG_ELEMENT_IDS.thumb2}`) as SVGPathElement;
      const thumb1 = position1.querySelector(`#${SVG_ELEMENT_IDS.thumb1}`) as SVGPathElement;
      const thumb2PathData = thumb2?.getAttribute('d');
      const thumb1PathData = thumb1?.getAttribute('d');

      console.log('[IntroAnimation] Exit - Path data found:',
        { A2: !!fingerA2PathData, A1: !!fingerA1PathData, B2: !!fingerB2PathData, B1: !!fingerB1PathData, C2: !!fingerC2PathData, C1: !!fingerC1PathData, thumb2: !!thumb2PathData, thumb1: !!thumb1PathData });

      // Create exit timeline (kill any existing one first to prevent memory leaks)
      console.log('[IntroAnimation] Creating exit timeline');
      if (this.exitTimeline) {
        this.exitTimeline.kill();
        this.exitTimeline = null;
      }
      this.exitTimeline = gsap.timeline({
        onStart: () => {
          console.log('[IntroAnimation] Exit timeline started');
        },
        onComplete: () => {
          console.log('[IntroAnimation] Exit timeline complete');
          // Hide overlay after animation
          if (this.morphOverlay) {
            this.morphOverlay.style.visibility = 'hidden';
            this.morphOverlay.style.pointerEvents = 'none';
          }
          // Restore about-hero-desktop visibility
          const aboutHeroEl = document.querySelector('.about-hero-desktop') as HTMLElement;
          if (aboutHeroEl) {
            aboutHeroEl.style.visibility = '';
          }
          // Remove paw-exit class and restore intro-complete
          document.documentElement.classList.remove('paw-exit');
          document.documentElement.classList.add('intro-complete');
          resolve();
        }
      });
      this.addTimeline(this.exitTimeline);

      // ========================================================================
      // ANIMATION TIMING CONSTANTS - MATCHED TO INTRO (but reversed)
      // ========================================================================
      const pawEntryDuration = 0.8;           // Fast paw entry (was 1.6)
      const clutchHold = 0.4;                 // Brief hold (was 0.8)
      const releaseDuration = 0.3;            // Quick morph (was 0.5)
      const exitDuration = 0.6;               // Fast exit (was 0.8)
      const fadeEase = 'power2.inOut';

      // ========================================================================
      // SET INITIAL POSITIONS
      // Card is visible at center, paw is off-screen where intro retraction ended
      // ========================================================================
      gsap.set(behindCardGroup, { x: -1500, y: -1200 });
      gsap.set(aboveCardGroup, { x: -1500, y: -1200 });
      gsap.set('#svg-business-card', { x: 0, y: 0 });

      // Nav links already faded by page-transition click handler - no need to fade here

      // ========================================================================
      // PHASE 1: PAW ENTERS (REVERSE of intro Phase 3 retraction)
      // Paw enters from where intro retraction ended
      // Fingers stay OPEN (pos 3) during most of entry
      // Thumb is always visible behind card layer
      // ========================================================================
      this.exitTimeline.to(behindCardGroup, {
        x: 0,
        y: 0,
        duration: pawEntryDuration,
        ease: 'power2.out'  // Reverse of intro's power2.in
      });
      this.exitTimeline.to(aboveCardGroup, {
        x: 0,
        y: 0,
        duration: pawEntryDuration,
        ease: 'power2.out'
      }, '<');

      // Thumb stays visible - card's solid fill naturally hides it when overlapping

      // ========================================================================
      // PHASE 1b: MORPH 3→2 at END of entry (reverse of intro's 2→3 at START of retraction)
      // In intro, morph happens when paw is NEAR card (just started retracting)
      // In exit (reverse), morph happens when paw is NEAR card (almost done entering)
      // ========================================================================
      // Start morph near end of entry (pawEntryDuration - 0.2s)
      if (fingerA3 && fingerA2PathData) {
        this.exitTimeline.to(fingerA3, {
          morphSVG: { shape: fingerA2PathData, shapeIndex: 'auto' },
          duration: 0.08,
          ease: 'power1.out'
        }, `-=${0.2}`);  // Start 0.2s before entry ends
      }
      if (fingerB3 && fingerB2PathData) {
        this.exitTimeline.to(fingerB3, {
          morphSVG: { shape: fingerB2PathData, shapeIndex: 'auto' },
          duration: 0.08,
          ease: 'power1.out'
        }, '<');
      }
      if (fingerC3 && fingerC2PathData) {
        this.exitTimeline.to(fingerC3, {
          morphSVG: { shape: fingerC2PathData, shapeIndex: 'auto' },
          duration: 0.2,
          ease: 'power1.out'
        }, '<');
      }

      // Thumb: Position 3 → 2 (morphs with fingers)
      if (clonedThumb && thumb2PathData) {
        this.exitTimeline.to(clonedThumb, {
          morphSVG: { shape: thumb2PathData, shapeIndex: 'auto' },
          duration: 0.2,
          ease: 'power1.out'
        }, '<');
      }

      // ========================================================================
      // PHASE 2: MORPH 2→1 (REVERSE of intro Phase 2)
      // Fingers and thumb close to clutching position
      // ========================================================================

      // Morph 2→1 (reverse of intro's 1→2)
      if (fingerA3 && fingerA1PathData) {
        this.exitTimeline.to(fingerA3, {
          morphSVG: { shape: fingerA1PathData, shapeIndex: 'auto' },
          duration: releaseDuration,  // 0.5s - matches intro
          ease: fadeEase
        }, '<');
      }
      if (fingerB3 && fingerB1PathData) {
        this.exitTimeline.to(fingerB3, {
          morphSVG: { shape: fingerB1PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: fadeEase
        }, '<');
      }
      if (fingerC3 && fingerC1PathData) {
        this.exitTimeline.to(fingerC3, {
          morphSVG: { shape: fingerC1PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: fadeEase
        }, '<');
      }

      // Thumb: Position 2 → 1 (morphs with fingers)
      if (clonedThumb && thumb1PathData) {
        this.exitTimeline.to(clonedThumb, {
          morphSVG: { shape: thumb1PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: fadeEase
        }, '<');
      }

      // ========================================================================
      // PHASE 3: CLUTCH HOLD (REVERSE of intro Phase 1)
      // Paw grips the card motionless - same duration as intro
      // ========================================================================
      this.exitTimeline.to({}, { duration: clutchHold });

      // ========================================================================
      // PHASE 4: EXIT (Paw + card fully exit off-screen)
      // Move far off-screen so nothing is visible
      // ========================================================================
      this.exitTimeline.to(behindCardGroup, {
        x: -1500,
        y: -1200,
        duration: exitDuration,
        ease: 'power2.in'
      });
      this.exitTimeline.to(aboveCardGroup, {
        x: -1500,
        y: -1200,
        duration: exitDuration,
        ease: 'power2.in'
      }, '<');
      this.exitTimeline.to('#svg-business-card', {
        x: -1500,
        y: -1200,
        duration: exitDuration,
        ease: 'power2.in'
      }, '<');

      this.log('Exit animation started');
    });
  }

  /**
   * Play entry animation (same as intro)
   * Called when transitioning TO the home/intro page
   *
   * Animation sequence:
   * 1. Paw + card enter from off-screen
   * 2. Paw clutches card motionless
   * 3. Fingers release (morph 1 → 2)
   * 4. Paw retracts while fingers open (morph 2 → 3)
   * 5. Nav links fade in
   *
   * @returns Promise that resolves when animation completes
   */
  async playEntryAnimation(): Promise<void> {
    // Skip on mobile - no paw animation
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      this.log('Mobile - skipping entry animation');
      // Just show card and nav
      const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
      const introNav = document.querySelector('.intro-nav') as HTMLElement;
      if (businessCard) businessCard.style.opacity = '1';
      if (introNav) introNav.style.opacity = '1';
      return;
    }

    // Skip if reduced motion preferred
    if (this.reducedMotion) {
      this.log('Reduced motion - skipping entry animation');
      const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
      const introNav = document.querySelector('.intro-nav') as HTMLElement;
      if (businessCard) businessCard.style.opacity = '1';
      if (introNav) introNav.style.opacity = '1';
      return;
    }

    this.log('Playing entry animation (paw brings card in)');

    // Get overlay and SVG elements
    this.morphOverlay = document.getElementById(DOM_ELEMENT_IDS.morphOverlay);
    const morphSvg = document.getElementById(DOM_ELEMENT_IDS.morphSvg) as SVGSVGElement | null;

    if (!this.morphOverlay || !morphSvg) {
      this.log('Morph overlay not found, showing card directly');
      const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
      const introNav = document.querySelector('.intro-nav') as HTMLElement;
      if (businessCard) businessCard.style.opacity = '1';
      if (introNav) introNav.style.opacity = '1';
      return;
    }

    // Get business card for alignment
    const businessCard = document.getElementById(DOM_ELEMENT_IDS.businessCard);
    if (!businessCard) {
      this.log('Business card not found');
      return;
    }

    // Get intro nav for fade in at end
    const introNav = document.querySelector('.intro-nav') as HTMLElement;

    // Hide nav initially
    if (introNav) {
      gsap.set(introNav, { opacity: 0 });
    }

    // Use cached SVG if available, otherwise fetch
    let svgText: string;
    if (this.cachedSvgText) {
      svgText = this.cachedSvgText;
    } else {
      const response = await fetch(PAW_SVG);
      svgText = await response.text();
      this.cachedSvgText = svgText;
    }
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // Get SVG elements
    const armBase = svgDoc.getElementById(SVG_ELEMENT_IDS.armBase);
    const position1 = svgDoc.getElementById(SVG_ELEMENT_IDS.position1);
    const position2 = svgDoc.getElementById(SVG_ELEMENT_IDS.position2);
    const position3 = svgDoc.getElementById(SVG_ELEMENT_IDS.position3);
    const cardGroup = svgDoc.getElementById(SVG_ELEMENT_IDS.cardGroup);

    if (!position1 || !position2) {
      this.log('Position groups not found');
      if (businessCard) businessCard.style.opacity = '1';
      if (introNav) gsap.set(introNav, { opacity: 1 });
      return;
    }

    return new Promise((resolve) => {
      // Calculate alignment
      const cardRect = businessCard.getBoundingClientRect();
      const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
      const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;
      const scale = actualCardRect.width / SVG_CARD.width;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const translateX = actualCardRect.left - (SVG_CARD.x * scale);
      const translateY = actualCardRect.top - (SVG_CARD.y * scale);

      // Clear and rebuild SVG
      morphSvg.innerHTML = '';
      morphSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
      morphSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Add shadow filter
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', 'card-shadow');
      filter.setAttribute('x', '-50%');
      filter.setAttribute('y', '-50%');
      filter.setAttribute('width', '200%');
      filter.setAttribute('height', '200%');
      const shadow = calculateShadowOffset(1 / scale);
      const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
      dropShadow.setAttribute('dx', '0');
      dropShadow.setAttribute('dy', String(shadow.base));
      dropShadow.setAttribute('stdDeviation', String(shadow.blur));
      dropShadow.setAttribute('flood-color', ANIMATION_CONSTANTS.COLORS.SHADOW_DEFAULT);
      filter.appendChild(dropShadow);
      defs.appendChild(filter);
      morphSvg.appendChild(defs);

      // Create layer structure
      const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      transformWrapper.setAttribute('id', 'entry-layers-wrapper');
      transformWrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

      const behindCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      behindCardGroup.setAttribute('id', 'behind-card-group');
      behindCardGroup.setAttribute('filter', 'url(#card-shadow)');

      const aboveCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      aboveCardGroup.setAttribute('id', 'above-card-group');
      aboveCardGroup.setAttribute('filter', 'url(#card-shadow)');

      // Add arm
      if (armBase) {
        const clonedArm = armBase.cloneNode(true) as Element;
        clonedArm.setAttribute('id', 'arm-group');
        behindCardGroup.appendChild(clonedArm);
      }

      // Add thumb from Position 1 (always visible, behind card)
      // MUST use thumb1 from Position 1 since we start in clutching position
      const thumbElement = position1.querySelector(`#${SVG_ELEMENT_IDS.thumb1}`);
      let clonedThumb: Element | null = null;
      if (thumbElement) {
        clonedThumb = thumbElement.cloneNode(true) as Element;
        clonedThumb.setAttribute('id', 'thumb-behind-card');
        // Thumb always visible - card layer occludes it naturally
        behindCardGroup.appendChild(clonedThumb);
      }

      transformWrapper.appendChild(behindCardGroup);

      // Add card
      if (cardGroup) {
        const clonedCard = cardGroup.cloneNode(true) as Element;
        clonedCard.setAttribute('id', 'svg-business-card');
        clonedCard.setAttribute('filter', 'url(#card-shadow)');
        transformWrapper.appendChild(clonedCard);
      }

      // Add fingers from Position 1 (clutching)
      // IMPORTANT: Remove thumb from clone - thumb is in behindCardGroup
      const clonedPos1 = position1.cloneNode(true) as Element;
      clonedPos1.setAttribute('id', 'position-1-entry');

      // Remove thumb from this clone - it should only be in behindCardGroup
      const thumbInPos1 = clonedPos1.querySelector(`#${SVG_ELEMENT_IDS.thumb1}`);
      if (thumbInPos1) {
        thumbInPos1.remove();
      }

      aboveCardGroup.appendChild(clonedPos1);

      transformWrapper.appendChild(aboveCardGroup);

      // Copy styles
      const sourceStyles = svgDoc.querySelector('style');
      if (sourceStyles) {
        const clonedStyles = sourceStyles.cloneNode(true) as Element;
        morphSvg.insertBefore(clonedStyles, morphSvg.firstChild);
      }

      morphSvg.appendChild(transformWrapper);

      // Add paw-exit class so overlay doesn't cover header/footer
      document.documentElement.classList.add('paw-exit');

      // Show overlay
      const overlay = this.morphOverlay!;
      overlay.style.visibility = 'visible';
      overlay.style.pointerEvents = 'auto';
      overlay.classList.remove('hidden');

      // Hide actual business card (SVG card will show instead)
      businessCard.style.opacity = '0';

      // Get finger paths for morphing
      const fingerA1 = clonedPos1.querySelector(`#${SVG_ELEMENT_IDS.fingerA1}`) as SVGPathElement;
      const fingerB1 = clonedPos1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerB1Container}"] path`) as SVGPathElement;
      const fingerC1 = clonedPos1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerC1Container}"] path`) as SVGPathElement;

      const fingerA2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerA2}`) as SVGPathElement;
      const fingerB2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerB2}`) as SVGPathElement;
      const fingerC2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerC2}`) as SVGPathElement;

      const fingerA3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerA3}`) as SVGPathElement;
      const fingerB3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerB3}`) as SVGPathElement;
      const fingerC3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerC3}`) as SVGPathElement;

      const fingerA2PathData = fingerA2?.getAttribute('d');
      const fingerA3PathData = fingerA3?.getAttribute('d');
      const fingerB2PathData = fingerB2?.getAttribute('d');
      const fingerB3PathData = fingerB3?.getAttribute('d');
      const fingerC2PathData = fingerC2?.getAttribute('d');
      const fingerC3PathData = fingerC3?.getAttribute('d');

      // Thumb morph targets (1→2→3)
      const thumb2 = position2.querySelector(`#${SVG_ELEMENT_IDS.thumb2}`) as SVGPathElement;
      const thumb3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.thumb3}`) as SVGPathElement;
      const thumb2PathData = thumb2?.getAttribute('d');
      const thumb3PathData = thumb3?.getAttribute('d');

      // Create entry timeline (kill any existing one first to prevent memory leaks)
      if (this.entryTimeline) {
        this.entryTimeline.kill();
        this.entryTimeline = null;
      }
      this.entryTimeline = gsap.timeline({
        onComplete: () => {
          // Hide overlay after animation
          if (this.morphOverlay) {
            this.morphOverlay.style.visibility = 'hidden';
            this.morphOverlay.style.pointerEvents = 'none';
          }
          // Remove paw-exit class
          document.documentElement.classList.remove('paw-exit');
          // Show actual business card
          businessCard.style.opacity = '1';
          resolve();
        }
      });
      this.addTimeline(this.entryTimeline);

      // Animation timings
      const entryDuration = 0.8;
      const clutchHold = 0.5;
      const releaseDuration = 0.4;
      const retractDuration = 1.2;
      const linkFadeDuration = 0.4;

      // Set initial positions - paw + card off-screen
      gsap.set(behindCardGroup, { x: -800, y: -600 });
      gsap.set(aboveCardGroup, { x: -800, y: -600 });
      gsap.set('#svg-business-card', { x: -800, y: -600 });

      // Phase 1: Paw + card enter from off-screen
      this.entryTimeline.to(behindCardGroup, {
        x: 0,
        y: 0,
        duration: entryDuration,
        ease: 'power2.out'
      });
      this.entryTimeline.to(aboveCardGroup, {
        x: 0,
        y: 0,
        duration: entryDuration,
        ease: 'power2.out'
      }, '<');
      this.entryTimeline.to('#svg-business-card', {
        x: 0,
        y: 0,
        duration: entryDuration,
        ease: 'power2.out'
      }, '<');

      // Phase 2: Clutch hold
      this.entryTimeline.to({}, { duration: clutchHold });

      // Phase 3: Fingers release (morph 1 → 2)
      if (fingerA1 && fingerA2PathData) {
        this.entryTimeline.to(fingerA1, {
          morphSVG: { shape: fingerA2PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: 'power2.inOut'
        });
      }
      if (fingerB1 && fingerB2PathData) {
        this.entryTimeline.to(fingerB1, {
          morphSVG: { shape: fingerB2PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: 'power2.inOut'
        }, '<');
      }
      if (fingerC1 && fingerC2PathData) {
        this.entryTimeline.to(fingerC1, {
          morphSVG: { shape: fingerC2PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: 'power2.inOut'
        }, '<');
      }

      // Thumb: Position 1 → 2 (morphs with fingers)
      if (clonedThumb && thumb2PathData) {
        this.entryTimeline.to(clonedThumb, {
          morphSVG: { shape: thumb2PathData, shapeIndex: 'auto' },
          duration: releaseDuration,
          ease: 'power2.inOut'
        }, '<');
      }

      // Phase 4: Paw retracts while fingers open (morph 2 → 3)
      this.entryTimeline.to(behindCardGroup, {
        x: -1500,
        y: -1200,
        duration: retractDuration,
        ease: 'power2.in'
      }, '+=0.02');
      this.entryTimeline.to(aboveCardGroup, {
        x: -1500,
        y: -1200,
        duration: retractDuration,
        ease: 'power2.in'
      }, '<');

      // Fingers open during retraction
      if (fingerA1 && fingerA3PathData) {
        this.entryTimeline.to(fingerA1, {
          morphSVG: { shape: fingerA3PathData, shapeIndex: 'auto' },
          duration: 0.08,
          ease: 'power1.out'
        }, '<');
      }
      if (fingerB1 && fingerB3PathData) {
        this.entryTimeline.to(fingerB1, {
          morphSVG: { shape: fingerB3PathData, shapeIndex: 'auto' },
          duration: 0.08,
          ease: 'power1.out'
        }, '<');
      }
      if (fingerC1 && fingerC3PathData) {
        this.entryTimeline.to(fingerC1, {
          morphSVG: { shape: fingerC3PathData, shapeIndex: 'auto' },
          duration: 0.2,
          ease: 'power1.out'
        }, '<');
      }

      // Thumb: Position 2 → 3 (morphs during retraction)
      if (clonedThumb && thumb3PathData) {
        this.entryTimeline.to(clonedThumb, {
          morphSVG: { shape: thumb3PathData, shapeIndex: 'auto' },
          duration: 0.2,
          ease: 'power1.out'
        }, '<');
      }

      // Phase 5: Fade in nav links at end
      if (introNav) {
        this.entryTimeline.to(introNav, {
          opacity: 1,
          duration: linkFadeDuration,
          ease: 'power2.out'
        }, '-=0.3');
      }

      this.log('Entry animation started');
    });
  }

  /**
   * Get current module status
   *
   * @returns Status object with completion state and timeline progress
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      isComplete: this.isComplete,
      timelineProgress: this.timeline?.progress() || 0
    };
  }

  /**
   * Cleanup method
   *
   * Kills the GSAP timeline and removes event listeners
   * when the module is destroyed.
   * 
   * PERFORMANCE: Ensures all event listeners are properly removed
   * to prevent memory leaks.
   */
  override async destroy(): Promise<void> {
    // Kill all timelines to prevent memory leaks
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    if (this.exitTimeline) {
      this.exitTimeline.kill();
      this.exitTimeline = null;
    }

    if (this.entryTimeline) {
      this.entryTimeline.kill();
      this.entryTimeline = null;
    }

    // Remove event listeners to prevent memory leaks
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    // Clear cached SVG text
    this.cachedSvgText = null;
    this.morphOverlay = null;

    await super.destroy();
  }
}
