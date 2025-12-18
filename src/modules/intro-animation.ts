/**
 * ===============================================
 * INTRO ANIMATION MODULE
 * ===============================================
 * @file src/modules/intro-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Desktop: Paw morph animation with aligned business card
 * - Mobile: Simple card flip (no morph overlay)
 * - Enter key skips animation
 * - Header fades in after animation completes
 *
 * TODO: [Code Review Dec 2025] This file is 400+ lines.
 *       Consider extracting SVG loading/parsing into a separate
 *       utility module (e.g., svg-loader.ts).
 *
 * NOTE: SVG constants below are extracted from coyote_paw.svg
 *       Card_Outline rect. Update these if the SVG changes.
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { ModuleOptions } from '../types/modules';

// Register MorphSVG plugin
gsap.registerPlugin(MorphSVGPlugin);

// SVG file containing all paw variations (cache bust with timestamp)
const PAW_SVG = `/images/coyote_paw.svg?v=${Date.now()}`;

// SVG card position/dimensions (from coyote_paw.svg Card_Outline)
// Card rect: x="1256.15" y="1031.85" width="1062.34" height="591.3"
const SVG_CARD_X = 1256.15;
const SVG_CARD_Y = 1031.85;
const SVG_CARD_WIDTH = 1062.34;
const _SVG_CARD_HEIGHT = 591.3;
const _SVG_VIEWBOX_WIDTH = 2316.99;  // Full viewBox width
const _SVG_VIEWBOX_HEIGHT = 1801.19; // Full viewBox height

export class IntroAnimationModule extends BaseModule {
  private timeline: gsap.core.Timeline | null = null;
  private isComplete = false;
  private skipHandler: ((event: KeyboardEvent) => void) | null = null;
  private morphOverlay: HTMLElement | null = null;

  constructor(options: ModuleOptions = {}) {
    super('IntroAnimationModule', { debug: true, ...options });

    // Bind methods
    this.handleSkip = this.handleSkip.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // MOBILE: Ensure header is visible from the very start (no intro effect on header)
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

    // Check if intro has already been shown this session
    const introShown = sessionStorage.getItem('introShown');
    if (introShown === 'true') {
      this.log('Intro already shown this session - skipping');
      this.skipIntroImmediately();
      return;
    }

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.log('Reduced motion preferred - skipping animation');
      this.skipIntroImmediately();
      return;
    }

    try {
      if (isMobile) {
        // Mobile: Simple card flip only
        this.runCardFlip();
      } else {
        // Desktop: Paw morph animation
        await this.runMorphAnimation();
      }
    } catch (error) {
      this.error('Failed to initialize intro animation:', error);
      this.completeIntro();
    }
  }

  /**
   * Run paw morph animation (desktop only)
   * Animation: fingers morph from position 1 → 2, then paw retracts diagonally up
   */
  private async runMorphAnimation(): Promise<void> {
    // Scroll to top - reset both window and main container
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // Get overlay elements
    this.morphOverlay = document.getElementById('intro-morph-overlay');
    const morphSvg = document.getElementById('intro-morph-svg') as SVGSVGElement | null;
    const morphPaw = document.getElementById('morph-paw');
    const morphCardGroup = document.getElementById('morph-card-group');

    if (!this.morphOverlay || !morphSvg || !morphPaw || !morphCardGroup) {
      this.log('Morph overlay elements not found, falling back to card flip');
      this.runCardFlip();
      return;
    }

    // Get the actual business card element for alignment
    const businessCard = document.getElementById('business-card');
    if (!businessCard) {
      this.log('Business card element not found, falling back to card flip');
      this.runCardFlip();
      return;
    }

    // Load SVG and extract elements
    this.log('Loading SVG file...');
    const response = await fetch(PAW_SVG);
    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // Get paw elements using actual IDs from coyote_paw.svg
    // New structure: Arm_Base, Position_1, Position_2, Position_3, Card groups
    const armBase = svgDoc.getElementById('Arm_Base');
    const position1 = svgDoc.getElementById('Position_1');
    const position2 = svgDoc.getElementById('Position_2');
    const position3 = svgDoc.getElementById('Position_3');
    const cardGroup = svgDoc.getElementById('Card');

    if (!position1 || !position2) {
      this.error('Position groups not found in SVG');
      this.runCardFlip();
      return;
    }

    this.log('Loaded SVG elements: armBase, position1, position2, position3, cardGroup');

    // Get business card screen position for pixel-perfect alignment
    const cardRect = businessCard.getBoundingClientRect();
    const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
    const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;

    // Calculate uniform scale based on card width (proportions preserved)
    const scale = actualCardRect.width / SVG_CARD_WIDTH;

    // ViewBox matches viewport - we'll scale content uniformly with transform
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    morphSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    morphSvg.setAttribute('preserveAspectRatio', 'none');

    // Calculate translation: position scaled SVG card to match screen card position
    const translateX = actualCardRect.left - (SVG_CARD_X * scale);
    const translateY = actualCardRect.top - (SVG_CARD_Y * scale);

    this.log('Alignment:', { scale, translateX, translateY });

    // Remove existing placeholder elements from morphSvg
    morphSvg.removeChild(morphCardGroup);
    morphSvg.removeChild(morphPaw);

    // Create wrapper for all layers - this will be animated for the retraction
    const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformWrapper.setAttribute('id', 'intro-layers-wrapper');
    transformWrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

    // Create group for elements that will retract together
    const pawGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pawGroup.setAttribute('id', 'paw-retract-group');

    // Layer order (bottom to top):
    // 1. Arm base (behind everything)
    // 2. Position groups (crossfade between 1, 2, 3)
    // 3. Business card (static, stays in place - added last so it's on top)

    // Add arm base (behind card)
    if (armBase) {
      const clonedArm = armBase.cloneNode(true) as Element;
      clonedArm.setAttribute('id', 'arm-group');
      pawGroup.appendChild(clonedArm);
    }

    // Add position 1 (clutching) - visible initially
    const clonedPos1 = position1.cloneNode(true) as Element;
    clonedPos1.setAttribute('id', 'position-1');
    pawGroup.appendChild(clonedPos1);

    // Add position 2 (releasing) - hidden initially
    const clonedPos2 = position2.cloneNode(true) as Element;
    clonedPos2.setAttribute('id', 'position-2');
    clonedPos2.setAttribute('opacity', '0');
    pawGroup.appendChild(clonedPos2);

    // Add position 3 (fully open) - hidden initially
    let clonedPos3: Element | null = null;
    if (position3) {
      clonedPos3 = position3.cloneNode(true) as Element;
      clonedPos3.setAttribute('id', 'position-3');
      clonedPos3.setAttribute('opacity', '0');
      pawGroup.appendChild(clonedPos3);
    }

    // Add paw group to wrapper
    transformWrapper.appendChild(pawGroup);

    // Add business card group (stays in place, on top of paw)
    if (cardGroup) {
      const clonedCard = cardGroup.cloneNode(true) as Element;
      clonedCard.setAttribute('id', 'svg-business-card');
      transformWrapper.appendChild(clonedCard);
    }

    // Copy styles from source SVG to ensure classes work
    const sourceStyles = svgDoc.querySelector('style');
    if (sourceStyles) {
      const clonedStyles = sourceStyles.cloneNode(true) as Element;
      morphSvg.insertBefore(clonedStyles, morphSvg.firstChild);
    }

    // Add wrapper to SVG
    morphSvg.appendChild(transformWrapper);

    this.log('SVG layers assembled: thumbFiller → thumbPalm → card → arm + fingers');

    // Hide actual business card during morph animation
    businessCard.style.opacity = '0';

    // Setup Enter key to skip animation
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // Create animation timeline
    this.timeline = gsap.timeline({
      onComplete: () => this.completeMorphAnimation()
    });

    const header = document.querySelector('.header') as HTMLElement;

    // Animation timing
    const clutchHold = 0.6;      // Hold while clutching
    const releaseDuration = 0.5; // Fingers opening (1→2)
    const openDuration = 0.4;    // Fingers fully open (2→3)
    const retractDuration = 0.5; // Paw sliding off screen
    const fadeEase = 'power2.inOut';

    // Get finger paths from each position for morphing
    // Position 1: Fingers are in groups, need to select path inside
    const fingerA1 = clonedPos1.querySelector('#_1_Morph_Above_Card_-_Fingers_') as SVGPathElement;
    const fingerB1 = clonedPos1.querySelector('[id="_FInger_B_-_Above_Card_"] path') as SVGPathElement;
    const fingerC1 = clonedPos1.querySelector('[id="_FInger_C-_Above_Card_"] path') as SVGPathElement;

    // Position 2: Paths have direct IDs
    const fingerA2 = position2.querySelector('#_FInger_A_-_Above_Card_-2') as SVGPathElement;
    const fingerB2 = position2.querySelector('#_FInger_B-_Above_Card_') as SVGPathElement;
    const fingerC2 = position2.querySelector('#_FInger_C_-_Above_Card_') as SVGPathElement;

    // Position 3: Paths have direct IDs
    const fingerA3 = position3?.querySelector('#_FInger_A_-_Above_Card_-3') as SVGPathElement;
    const fingerB3 = position3?.querySelector('#_FInger_B-_Above_Card_-2') as SVGPathElement;
    const fingerC3 = position3?.querySelector('#_FInger_C_-_Above_Card_-2') as SVGPathElement;

    // Get path data for morph targets
    const fingerA2PathData = fingerA2?.getAttribute('d');
    const fingerA3PathData = fingerA3?.getAttribute('d');
    const fingerB2PathData = fingerB2?.getAttribute('d');
    const fingerB3PathData = fingerB3?.getAttribute('d');
    const fingerC2PathData = fingerC2?.getAttribute('d');
    const fingerC3PathData = fingerC3?.getAttribute('d');

    // Phase 1: CLUTCHING - paw gripping the card (position 1 visible)
    this.timeline.to({}, { duration: clutchHold });

    // Phase 2: RELEASING - morph all fingers from position 1 → 2
    if (fingerA1 && fingerA2PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      });
    }
    if (fingerB1 && fingerB2PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      }, '<'); // Same time as finger A
    }
    if (fingerC1 && fingerC2PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      }, '<'); // Same time as finger A
    }

    // Phase 3: FULLY OPEN - morph all fingers from position 2 → 3
    if (fingerA1 && fingerA3PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA3PathData, shapeIndex: 'auto' },
        duration: openDuration,
        ease: 'power1.out'
      });
    }
    if (fingerB1 && fingerB3PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB3PathData, shapeIndex: 'auto' },
        duration: openDuration,
        ease: 'power1.out'
      }, '<');
    }
    if (fingerC1 && fingerC3PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC3PathData, shapeIndex: 'auto' },
        duration: openDuration,
        ease: 'power1.out'
      }, '<');
    }

    // Brief hold showing fully released paw
    this.timeline.to({}, { duration: 0.2 });

    // Phase 4: RETRACTION - paw slides diagonally up and left off screen
    // The arm comes from top-left, so it retracts back that direction
    this.timeline.to(pawGroup, {
      x: -1000,
      y: -800,
      duration: retractDuration,
      ease: 'power2.in'
    });

    // Fade out the SVG card as paw retracts, reveal actual business card
    this.timeline.to('#svg-business-card', {
      opacity: 0,
      duration: retractDuration * 0.6,
      ease: 'power2.out',
      onComplete: () => {
        // Show the actual business card
        businessCard.style.opacity = '1';
      }
    }, '<0.1'); // Slight delay so card doesn't disappear too early

    // Fade out overlay completely
    this.timeline.to(this.morphOverlay, {
      opacity: 0,
      duration: 0.4,
      ease: 'power2.out',
      onComplete: () => {
        // Remove intro-loading class
        document.documentElement.classList.remove('intro-loading');
        document.documentElement.classList.add('intro-complete');

        // Fade in header content
        if (header) {
          this.animateHeaderIn(header);
        }
      }
    });
  }

  /**
   * Complete morph animation and clean up
   */
  private completeMorphAnimation(): void {
    // Hide overlay completely
    if (this.morphOverlay) {
      this.morphOverlay.style.visibility = 'hidden';
    }

    this.completeIntro();
  }

  /**
   * Animate header content in (desktop only)
   */
  private animateHeaderIn(header: HTMLElement): void {
    const headerChildren = header.children;

    // Set initial state
    Array.from(headerChildren).forEach((child) => {
      (child as HTMLElement).style.setProperty('opacity', '0', 'important');
      (child as HTMLElement).style.setProperty('visibility', 'visible', 'important');
    });

    // Animate with proxy
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
        Array.from(headerChildren).forEach((child) => {
          (child as HTMLElement).style.removeProperty('opacity');
          (child as HTMLElement).style.removeProperty('visibility');
        });
      }
    });
  }

  /**
   * Skip intro immediately (for returning visitors in same session)
   */
  private skipIntroImmediately(): void {
    this.isComplete = true;

    // Hide morph overlay
    const morphOverlay = document.getElementById('intro-morph-overlay');
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
    }

    // Remove intro classes and show content immediately
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete', 'intro-finished');

    // Make sure card is visible
    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    const cardInner = document.getElementById('business-card-inner');
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
   * Handle keyboard input (Enter to skip)
   */
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isComplete) {
      this.handleSkip();
    }
  }

  /**
   * Skip to end of animation
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
   */
  private runCardFlip(): void {
    // Hide morph overlay on mobile
    const morphOverlay = document.getElementById('intro-morph-overlay');
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
    }

    // Scroll to top - reset both window and main container
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    const cardInner = document.getElementById('business-card-inner');

    if (!cardInner) {
      this.completeIntro();
      return;
    }

    const cardContainer = cardInner.parentElement;

    // Set initial state - showing back
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
   */
  private completeIntro(): void {
    if (this.isComplete) return;

    this.isComplete = true;

    // Mark intro as shown for this session
    sessionStorage.setItem('introShown', 'true');

    // Ensure main page content is visible
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Ensure business card is visible
    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    // Scroll to top - reset both window and main container
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // Add intro-finished after transition completes
    setTimeout(() => {
      document.documentElement.classList.add('intro-finished');
    }, 600);

    // Clean up event listeners
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    // Update app state
    if (typeof window !== 'undefined' && (window as any).NBW_STATE) {
      (window as any).NBW_STATE.setState({ introAnimating: false });
    }
  }

  /**
   * Get current status
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
