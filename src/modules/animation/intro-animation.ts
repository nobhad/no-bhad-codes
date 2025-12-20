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

  /** Flag indicating if animation has completed or been skipped */
  private isComplete = false;

  /** Keyboard event handler for Enter key skip functionality */
  private skipHandler: ((event: KeyboardEvent) => void) | null = null;

  /** Reference to the overlay element containing the SVG animation */
  private morphOverlay: HTMLElement | null = null;

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
    // TIME-BASED CHECK
    // Skip animation if shown within the last 20 minutes
    // ========================================================================
    const lastIntroTimestamp = localStorage.getItem(REPLAY_CONFIG.timestampKey);
    if (lastIntroTimestamp) {
      const timeSinceLastIntro = Date.now() - parseInt(lastIntroTimestamp, 10);
      if (timeSinceLastIntro < REPLAY_CONFIG.replayInterval) {
        this.log(`Intro shown ${Math.round(timeSinceLastIntro / 1000 / 60)} min ago - skipping (replays after 20 min)`);
        this.skipIntroImmediately();
        return;
      }
      this.log('20+ minutes since last intro - playing animation');
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
    // Fetch the SVG file and parse it into a DOM structure
    // ========================================================================
    this.log('Loading SVG file...');
    const response = await fetch(PAW_SVG);
    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // ========================================================================
    // EXTRACT SVG ELEMENTS
    // Get references to the key groups in the SVG structure
    // ========================================================================
    const armBase = svgDoc.getElementById(SVG_ELEMENT_IDS.armBase);
    const position1 = svgDoc.getElementById(SVG_ELEMENT_IDS.position1);
    const position2 = svgDoc.getElementById(SVG_ELEMENT_IDS.position2);
    const position3 = svgDoc.getElementById(SVG_ELEMENT_IDS.position3);
    const cardGroup = svgDoc.getElementById(SVG_ELEMENT_IDS.cardGroup);

    if (!position1 || !position2) {
      this.error('Position groups not found in SVG');
      this.runCardFlip();
      return;
    }

    this.log('Loaded SVG elements: armBase, position1, position2, position3, cardGroup');

    // ========================================================================
    // CALCULATE ALIGNMENT
    // Scale and position SVG to match the actual business card on screen
    // ========================================================================
    const cardRect = businessCard.getBoundingClientRect();
    const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
    const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;

    // Uniform scale based on card width (preserves aspect ratio)
    const scale = actualCardRect.width / SVG_CARD.width;

    // Set viewBox to match viewport for proper positioning
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    morphSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    morphSvg.setAttribute('preserveAspectRatio', 'none');

    // Calculate translation to align SVG card with screen position
    const translateX = actualCardRect.left - (SVG_CARD.x * scale);
    const translateY = actualCardRect.top - (SVG_CARD.y * scale);

    this.log('Alignment:', { scale, translateX, translateY });

    // ========================================================================
    // PREPARE SVG CONTAINER
    // Remove placeholder elements, we'll add our own structure
    // ========================================================================
    morphSvg.removeChild(morphCardGroup);
    morphSvg.removeChild(morphPaw);

    // ========================================================================
    // CREATE LAYER STRUCTURE
    // Build the SVG layer hierarchy for proper z-ordering
    //
    // Layer order (bottom to top):
    //   1. behindCardGroup - Arm and thumb (behind card, retracts)
    //   2. svg-business-card - Card graphic (stays in place)
    //   3. aboveCardGroup - Fingers (above card, retracts)
    // ========================================================================

    // ========================================================================
    // ADD CARD SHADOW FILTER
    // Drop shadow matching the business card CSS: 0 10px 30px rgba(0,0,0,0.3)
    // ========================================================================
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'card-shadow');
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    dropShadow.setAttribute('dx', '0');
    dropShadow.setAttribute('dy', '10');
    dropShadow.setAttribute('stdDeviation', '15');
    dropShadow.setAttribute('flood-color', 'rgba(0, 0, 0, 0.3)');

    filter.appendChild(dropShadow);
    defs.appendChild(filter);
    morphSvg.appendChild(defs);

    // Main wrapper with transform for scaling and positioning
    const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformWrapper.setAttribute('id', 'intro-layers-wrapper');
    transformWrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

    // Group for elements BEHIND the card (arm + thumb)
    const behindCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    behindCardGroup.setAttribute('id', 'behind-card-group');
    behindCardGroup.setAttribute('filter', 'url(#card-shadow)');

    // Group for elements ABOVE the card (fingers)
    const aboveCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    aboveCardGroup.setAttribute('id', 'above-card-group');
    aboveCardGroup.setAttribute('filter', 'url(#card-shadow)');

    // ========================================================================
    // ASSEMBLE BEHIND-CARD LAYER
    // ========================================================================

    // Add arm base (behind card, retracts with paw)
    if (armBase) {
      const clonedArm = armBase.cloneNode(true) as Element;
      clonedArm.setAttribute('id', 'arm-group');
      behindCardGroup.appendChild(clonedArm);
    }

    // Add thumb from Position 2 (behind card, starts hidden)
    // Thumb appears instantly when fingers start releasing
    const thumbElement = position2.querySelector(`#${SVG_ELEMENT_IDS.thumb2}`);
    let clonedThumb: Element | null = null;
    if (thumbElement) {
      clonedThumb = thumbElement.cloneNode(true) as Element;
      clonedThumb.setAttribute('id', 'thumb-behind-card');
      (clonedThumb as SVGSVGElement).style.opacity = '0'; // Hidden initially
      behindCardGroup.appendChild(clonedThumb);
    }

    // Add behind-card group to wrapper (layer 1)
    transformWrapper.appendChild(behindCardGroup);

    // ========================================================================
    // ASSEMBLE CARD LAYER
    // ========================================================================

    // Add business card graphic (stays in place, layer 2)
    if (cardGroup) {
      const clonedCard = cardGroup.cloneNode(true) as Element;
      clonedCard.setAttribute('id', 'svg-business-card');
      clonedCard.setAttribute('filter', 'url(#card-shadow)');
      transformWrapper.appendChild(clonedCard);
    }

    // ========================================================================
    // ASSEMBLE ABOVE-CARD LAYER
    // ========================================================================

    // Add fingers from Position 1 (above card, visible initially)
    // These will morph to Position 2, then Position 3
    const clonedPos1 = position1.cloneNode(true) as Element;
    clonedPos1.setAttribute('id', 'position-1');
    aboveCardGroup.appendChild(clonedPos1);

    // Add above-card group to wrapper (layer 3 - top)
    transformWrapper.appendChild(aboveCardGroup);

    // ========================================================================
    // COPY SVG STYLES
    // Ensure CSS classes from source SVG work in our assembled structure
    // ========================================================================
    const sourceStyles = svgDoc.querySelector('style');
    if (sourceStyles) {
      const clonedStyles = sourceStyles.cloneNode(true) as Element;
      morphSvg.insertBefore(clonedStyles, morphSvg.firstChild);
    }

    // Add completed wrapper to the SVG element
    morphSvg.appendChild(transformWrapper);

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
    // CREATE ANIMATION TIMELINE
    // Main GSAP timeline that orchestrates all animation phases
    // ========================================================================
    this.timeline = gsap.timeline({
      onComplete: () => this.completeMorphAnimation()
    });

    const header = document.querySelector('.header') as HTMLElement;

    // ========================================================================
    // ANIMATION TIMING CONSTANTS
    // All durations in seconds
    // ========================================================================
    const entryDuration = 0.8;   // Phase 0: Paw + card entering from top-left
    const clutchHold = 0.8;      // Phase 1: Hold while clutching (motionless)
    const releaseDuration = 0.5; // Phase 2: Fingers morphing 1→2
    const _openDuration = 0.6;   // Phase 3: Fingers morphing 2→3 (unused, individual timings below)
    const retractDuration = 1.6; // Phase 3: Paw sliding off screen
    const fadeEase = 'power2.inOut';

    // ========================================================================
    // GET FINGER PATH REFERENCES
    // We need references to finger paths in each position for morphing
    // ========================================================================

    // Position 1: Fingers in clutching pose (morph SOURCE)
    // Note: Some fingers are in groups, need to select path inside
    const fingerA1 = clonedPos1.querySelector(`#${SVG_ELEMENT_IDS.fingerA1}`) as SVGPathElement;
    const fingerB1 = clonedPos1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerB1Container}"] path`) as SVGPathElement;
    const fingerC1 = clonedPos1.querySelector(`[id="${SVG_ELEMENT_IDS.fingerC1Container}"] path`) as SVGPathElement;

    // Position 2: Fingers releasing (morph TARGET 1)
    const fingerA2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerA2}`) as SVGPathElement;
    const fingerB2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerB2}`) as SVGPathElement;
    const fingerC2 = position2.querySelector(`#${SVG_ELEMENT_IDS.fingerC2}`) as SVGPathElement;

    // Position 3: Fingers fully open (morph TARGET 2)
    const fingerA3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerA3}`) as SVGPathElement;
    const fingerB3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerB3}`) as SVGPathElement;
    const fingerC3 = position3?.querySelector(`#${SVG_ELEMENT_IDS.fingerC3}`) as SVGPathElement;

    // Extract path data (the 'd' attribute) for morph targets
    const fingerA2PathData = fingerA2?.getAttribute('d');
    const fingerA3PathData = fingerA3?.getAttribute('d');
    const fingerB2PathData = fingerB2?.getAttribute('d');
    const fingerB3PathData = fingerB3?.getAttribute('d');
    const fingerC2PathData = fingerC2?.getAttribute('d');
    const fingerC3PathData = fingerC3?.getAttribute('d');

    // ========================================================================
    // PHASE 0: ENTRY
    // Paw and card enter from top-left, animate to center
    // ========================================================================

    // Set initial position off-screen (top-left corner)
    gsap.set(behindCardGroup, { x: -800, y: -600 });
    gsap.set(aboveCardGroup, { x: -800, y: -600 });
    gsap.set('#svg-business-card', { x: -800, y: -600 });

    // Animate all layers to center position (0, 0)
    // All three animations run simultaneously with '<' position marker
    this.timeline.to(behindCardGroup, {
      x: 0,
      y: 0,
      duration: entryDuration,
      ease: 'power2.out'
    });
    this.timeline.to(aboveCardGroup, {
      x: 0,
      y: 0,
      duration: entryDuration,
      ease: 'power2.out'
    }, '<'); // '<' means start at same time as previous
    this.timeline.to('#svg-business-card', {
      x: 0,
      y: 0,
      duration: entryDuration,
      ease: 'power2.out'
    }, '<');

    // ========================================================================
    // PHASE 1: CLUTCH HOLD
    // Paw grips the card motionless
    // ========================================================================
    this.timeline.to({}, { duration: clutchHold });

    // ========================================================================
    // PHASE 2: FINGER RELEASE (Position 1 → Position 2)
    // All fingers morph simultaneously while still over the card
    // Thumb appears instantly when release begins
    // ========================================================================

    // Finger A: Position 1 → 2
    if (fingerA1 && fingerA2PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      });
    }

    // Finger B: Position 1 → 2 (simultaneous with A)
    if (fingerB1 && fingerB2PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      }, '<');
    }

    // Finger C: Position 1 → 2 (simultaneous with A and B)
    if (fingerC1 && fingerC2PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      }, '<');
    }

    // Thumb: Appear instantly when fingers start releasing
    // No fade - instant visibility change
    if (clonedThumb) {
      this.timeline.set(clonedThumb, { opacity: 1 }, '<');
    }

    // ========================================================================
    // PHASE 3: RETRACTION + FINAL MORPH
    // Paw retracts diagonally to top-left while fingers complete morphing
    // ========================================================================

    // Start retraction 0.02s after Phase 2 completes
    // Retract to (-1500, -1200) - far off-screen to prevent any flash
    this.timeline.to(behindCardGroup, {
      x: -1500,
      y: -1200,
      duration: retractDuration,
      ease: 'power2.in' // Accelerate as it exits
    }, '+=0.02');

    // Above-card group retracts simultaneously
    this.timeline.to(aboveCardGroup, {
      x: -1500,
      y: -1200,
      duration: retractDuration,
      ease: 'power2.in'
    }, '<');

    // ========================================================================
    // FINAL FINGER MORPHS (Position 2 → Position 3)
    // All fingers morph to fully open position during retraction
    // Individual timings for natural feel:
    //   - Finger A: 0.08s (fastest)
    //   - Finger B: 0.08s (fast)
    //   - Finger C: 0.2s (slowest, trails behind)
    // ========================================================================

    // Finger A: Position 2 → 3 (during retraction)
    if (fingerA1 && fingerA3PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA3PathData, shapeIndex: 'auto' },
        duration: 0.08,
        ease: 'power1.out'
      }, '<');
    }

    // Finger B: Position 2 → 3 (during retraction)
    if (fingerB1 && fingerB3PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB3PathData, shapeIndex: 'auto' },
        duration: 0.08,
        ease: 'power1.out'
      }, '<');
    }

    // Finger C: Position 2 → 3 (during retraction, slightly slower)
    if (fingerC1 && fingerC3PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC3PathData, shapeIndex: 'auto' },
        duration: 0.2,
        ease: 'power1.out'
      }, '<');
    }

    // ========================================================================
    // PHASE 4: COMPLETION
    // After retraction, update classes and animate header
    // IMPORTANT: No hiding of elements to prevent flash
    // The paw simply exits off-screen naturally
    // ========================================================================
    this.timeline.call(() => {
      // Remove loading state, add complete state
      document.documentElement.classList.remove('intro-loading');
      document.documentElement.classList.add('intro-complete');

      // Make overlay non-interactive but don't change visibility
      // This prevents any flash from hiding/showing elements
      if (this.morphOverlay) {
        this.morphOverlay.style.pointerEvents = 'none';
      }

      // Fade in header content
      if (header) {
        this.animateHeaderIn(header);
      }
    });
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

          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (isMobile && header) {
            header.style.removeProperty('opacity');
            header.style.removeProperty('visibility');
          } else if (header) {
            this.animateHeaderIn(header);
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
   */
  override async destroy(): Promise<void> {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    await super.destroy();
  }
}
