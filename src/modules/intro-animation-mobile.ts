/**
 * ===============================================
 * MOBILE INTRO ANIMATION MODULE
 * ===============================================
 * @file src/modules/intro-animation-mobile.ts
 * @extends BaseModule
 *
 * OVERVIEW:
 * This module handles the coyote paw intro animation for mobile devices.
 * Same animation concept as desktop but optimized for smaller screens
 * and touch interactions.
 *
 * DESIGN:
 * - Coyote paw clutches business card
 * - Fingers morph open to release
 * - Paw retracts diagonally off-screen
 * - Optimized positioning for mobile viewports
 * - Touch-to-skip functionality
 *
 * ANIMATION SEQUENCE (same as desktop):
 * - Phase 0: Entry (0.8s) - Paw enters from top-left
 * - Phase 1: Clutch Hold (0.8s) - Paw grips card
 * - Phase 2: Finger Release (0.5s) - Fingers morph 1→2
 * - Phase 3: Retraction (1.6s) - Paw exits, fingers morph 2→3
 * - Phase 4: Completion - Header fades in
 *
 * DEPENDENCIES:
 * - GSAP Core: Animation timeline
 * - MorphSVGPlugin: SVG path morphing (GSAP premium plugin)
 *
 * RELATED FILES:
 * - src/modules/intro-animation.ts - Desktop version
 * - public/images/coyote_paw.svg - SVG artwork
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { ModuleOptions } from '../types/modules';

// Register MorphSVG plugin with GSAP
gsap.registerPlugin(MorphSVGPlugin);

// ============================================================================
// SVG CONSTANTS
// ============================================================================
// Uses the SAME SVG as desktop, scaled to match mobile card size.
// ============================================================================

/** SVG file path (same as desktop) */
const PAW_SVG = `/images/coyote_paw.svg?v=${Date.now()}`;

/** X position of card rectangle in SVG coordinates */
const SVG_CARD_X = 1256.15;

/** Y position of card rectangle in SVG coordinates */
const SVG_CARD_Y = 1031.85;

/** Width of card rectangle in SVG coordinates */
const SVG_CARD_WIDTH = 1062.34;

// ============================================================================
// MOBILE INTRO ANIMATION MODULE CLASS
// ============================================================================

export class MobileIntroAnimationModule extends BaseModule {
  /** GSAP timeline controlling the animation sequence */
  private timeline: gsap.core.Timeline | null = null;

  /** Flag indicating if animation has completed or been skipped */
  private isComplete = false;

  /** Touch/click event handler for skip functionality */
  private skipHandler: ((event: Event) => void) | null = null;

  /** Reference to the overlay element */
  private morphOverlay: HTMLElement | null = null;

  constructor(options: ModuleOptions = {}) {
    super('MobileIntroAnimationModule', { debug: true, ...options });

    // Bind methods
    this.handleSkip = this.handleSkip.bind(this);
    this.handleTap = this.handleTap.bind(this);
  }

  /**
   * Initialize the mobile intro animation module
   */
  override async init(): Promise<void> {
    await super.init();

    this.log('Mobile intro animation initializing...');

    // ========================================================================
    // SESSION CHECK
    // ========================================================================
    const introShown = sessionStorage.getItem('introShown');
    if (introShown === 'true') {
      this.log('Intro already shown this session - skipping');
      this.skipIntroImmediately();
      return;
    }

    // ========================================================================
    // REDUCED MOTION CHECK
    // ========================================================================
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.log('Reduced motion preferred - skipping animation');
      this.skipIntroImmediately();
      return;
    }

    // ========================================================================
    // RUN PAW MORPH ANIMATION
    // ========================================================================
    try {
      await this.runMorphAnimation();
    } catch (error) {
      this.error('Failed to initialize mobile intro animation:', error);
      this.completeIntro();
    }
  }

  /**
   * Run the paw morph animation (adapted for mobile)
   */
  private async runMorphAnimation(): Promise<void> {
    // ========================================================================
    // SCROLL RESET
    // ========================================================================
    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);

    // ========================================================================
    // GET OVERLAY ELEMENTS
    // ========================================================================
    this.morphOverlay = document.getElementById('intro-morph-overlay');
    const morphSvg = document.getElementById('intro-morph-svg') as SVGSVGElement | null;
    const morphPaw = document.getElementById('morph-paw');
    const morphCardGroup = document.getElementById('morph-card-group');

    if (!this.morphOverlay || !morphSvg || !morphPaw || !morphCardGroup) {
      this.log('Morph overlay elements not found');
      this.completeIntro();
      return;
    }

    // Make overlay visible on mobile (CSS hides it by default)
    this.morphOverlay.style.display = 'flex';
    this.morphOverlay.style.opacity = '1';
    this.morphOverlay.style.visibility = 'visible';
    this.morphOverlay.classList.remove('hidden');

    // ========================================================================
    // GET BUSINESS CARD FOR ALIGNMENT
    // ========================================================================
    const businessCard = document.getElementById('business-card');
    if (!businessCard) {
      this.log('Business card element not found');
      this.completeIntro();
      return;
    }

    // ========================================================================
    // LOAD AND PARSE SVG
    // ========================================================================
    this.log('Loading SVG file...');
    const response = await fetch(PAW_SVG);
    const svgText = await response.text();
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');

    // ========================================================================
    // EXTRACT SVG ELEMENTS
    // ========================================================================
    const armBase = svgDoc.getElementById('Arm_Base');
    const position1 = svgDoc.getElementById('Position_1');
    const position2 = svgDoc.getElementById('Position_2');
    const position3 = svgDoc.getElementById('Position_3');
    const cardGroup = svgDoc.getElementById('Card');

    if (!position1 || !position2) {
      this.error('Position groups not found in SVG');
      this.completeIntro();
      return;
    }

    this.log('Loaded SVG elements');

    // ========================================================================
    // CALCULATE ALIGNMENT
    // Scale SVG to match mobile card size
    // ========================================================================
    const cardRect = businessCard.getBoundingClientRect();
    const cardFront = businessCard.querySelector('.business-card-front') as HTMLElement;
    const actualCardRect = cardFront ? cardFront.getBoundingClientRect() : cardRect;

    // Scale based on mobile card width
    const scale = actualCardRect.width / SVG_CARD_WIDTH;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    morphSvg.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`);
    morphSvg.setAttribute('preserveAspectRatio', 'none');

    // Align SVG card with actual card position
    const translateX = actualCardRect.left - (SVG_CARD_X * scale);
    const translateY = actualCardRect.top - (SVG_CARD_Y * scale);

    this.log('Mobile alignment:', { scale, translateX, translateY, viewportWidth, viewportHeight });

    // ========================================================================
    // PREPARE SVG CONTAINER
    // ========================================================================
    morphSvg.removeChild(morphCardGroup);
    morphSvg.removeChild(morphPaw);

    // ========================================================================
    // CREATE LAYER STRUCTURE
    // ========================================================================
    const transformWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformWrapper.setAttribute('id', 'intro-layers-wrapper');
    transformWrapper.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

    const behindCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    behindCardGroup.setAttribute('id', 'behind-card-group');

    const aboveCardGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    aboveCardGroup.setAttribute('id', 'above-card-group');

    // Add arm base
    if (armBase) {
      const clonedArm = armBase.cloneNode(true) as Element;
      clonedArm.setAttribute('id', 'arm-group');
      behindCardGroup.appendChild(clonedArm);
    }

    // Add thumb (hidden initially)
    const thumbElement = position2.querySelector('#_Thumb_Behind_Card_');
    let clonedThumb: Element | null = null;
    if (thumbElement) {
      clonedThumb = thumbElement.cloneNode(true) as Element;
      clonedThumb.setAttribute('id', 'thumb-behind-card');
      (clonedThumb as SVGSVGElement).style.opacity = '0';
      behindCardGroup.appendChild(clonedThumb);
    }

    transformWrapper.appendChild(behindCardGroup);

    // Add card
    if (cardGroup) {
      const clonedCard = cardGroup.cloneNode(true) as Element;
      clonedCard.setAttribute('id', 'svg-business-card');
      transformWrapper.appendChild(clonedCard);
    }

    // Add fingers
    const clonedPos1 = position1.cloneNode(true) as Element;
    clonedPos1.setAttribute('id', 'position-1');
    aboveCardGroup.appendChild(clonedPos1);

    transformWrapper.appendChild(aboveCardGroup);

    // Copy styles
    const sourceStyles = svgDoc.querySelector('style');
    if (sourceStyles) {
      const clonedStyles = sourceStyles.cloneNode(true) as Element;
      morphSvg.insertBefore(clonedStyles, morphSvg.firstChild);
    }

    morphSvg.appendChild(transformWrapper);

    this.log('SVG layers assembled for mobile');

    // ========================================================================
    // SETUP TAP-TO-SKIP
    // ========================================================================
    this.skipHandler = this.handleTap;
    this.morphOverlay.addEventListener('click', this.skipHandler);
    this.morphOverlay.addEventListener('touchend', this.skipHandler);

    // ========================================================================
    // CREATE ANIMATION TIMELINE
    // ========================================================================
    this.timeline = gsap.timeline({
      onComplete: () => this.completeMorphAnimation()
    });

    const header = document.querySelector('.header') as HTMLElement;

    // Animation timing
    const entryDuration = 0.8;
    const clutchHold = 0.8;
    const releaseDuration = 0.5;
    const retractDuration = 1.6;
    const fadeEase = 'power2.inOut';

    // ========================================================================
    // GET FINGER PATH REFERENCES
    // ========================================================================
    const fingerA1 = clonedPos1.querySelector('#_1_Morph_Above_Card_-_Fingers_') as SVGPathElement;
    const fingerB1 = clonedPos1.querySelector('[id="_FInger_B_-_Above_Card_"] path') as SVGPathElement;
    const fingerC1 = clonedPos1.querySelector('[id="_FInger_C-_Above_Card_"] path') as SVGPathElement;

    const fingerA2 = position2.querySelector('#_FInger_A_-_Above_Card_-2') as SVGPathElement;
    const fingerB2 = position2.querySelector('#_FInger_B-_Above_Card_') as SVGPathElement;
    const fingerC2 = position2.querySelector('#_FInger_C_-_Above_Card_') as SVGPathElement;

    const fingerA3 = position3?.querySelector('#_FInger_A_-_Above_Card_-3') as SVGPathElement;
    const fingerB3 = position3?.querySelector('#_FInger_B-_Above_Card_-2') as SVGPathElement;
    const fingerC3 = position3?.querySelector('#_FInger_C_-_Above_Card_-2') as SVGPathElement;

    const fingerA2PathData = fingerA2?.getAttribute('d');
    const fingerA3PathData = fingerA3?.getAttribute('d');
    const fingerB2PathData = fingerB2?.getAttribute('d');
    const fingerB3PathData = fingerB3?.getAttribute('d');
    const fingerC2PathData = fingerC2?.getAttribute('d');
    const fingerC3PathData = fingerC3?.getAttribute('d');

    // ========================================================================
    // PHASE 0: ENTRY
    // ========================================================================
    gsap.set(behindCardGroup, { x: -800, y: -600 });
    gsap.set(aboveCardGroup, { x: -800, y: -600 });
    gsap.set('#svg-business-card', { x: -800, y: -600 });

    this.timeline.to(behindCardGroup, {
      x: 0, y: 0,
      duration: entryDuration,
      ease: 'power2.out'
    });
    this.timeline.to(aboveCardGroup, {
      x: 0, y: 0,
      duration: entryDuration,
      ease: 'power2.out'
    }, '<');
    this.timeline.to('#svg-business-card', {
      x: 0, y: 0,
      duration: entryDuration,
      ease: 'power2.out'
    }, '<');

    // ========================================================================
    // PHASE 1: CLUTCH HOLD
    // ========================================================================
    this.timeline.to({}, { duration: clutchHold });

    // ========================================================================
    // PHASE 2: FINGER RELEASE (1→2)
    // ========================================================================
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
      }, '<');
    }

    if (fingerC1 && fingerC2PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: fadeEase
      }, '<');
    }

    if (clonedThumb) {
      this.timeline.set(clonedThumb, { opacity: 1 }, '<');
    }

    // ========================================================================
    // PHASE 3: RETRACTION + FINAL MORPH
    // ========================================================================
    this.timeline.to(behindCardGroup, {
      x: -1500, y: -1200,
      duration: retractDuration,
      ease: 'power2.in'
    }, '+=0.02');

    this.timeline.to(aboveCardGroup, {
      x: -1500, y: -1200,
      duration: retractDuration,
      ease: 'power2.in'
    }, '<');

    // Final finger morphs (2→3)
    if (fingerA1 && fingerA3PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA3PathData, shapeIndex: 'auto' },
        duration: 0.08,
        ease: 'power1.out'
      }, '<');
    }

    if (fingerB1 && fingerB3PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB3PathData, shapeIndex: 'auto' },
        duration: 0.08,
        ease: 'power1.out'
      }, '<');
    }

    if (fingerC1 && fingerC3PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC3PathData, shapeIndex: 'auto' },
        duration: 0.2,
        ease: 'power1.out'
      }, '<');
    }

    // ========================================================================
    // PHASE 4: COMPLETION
    // ========================================================================
    this.timeline.call(() => {
      document.documentElement.classList.remove('intro-loading');
      document.documentElement.classList.add('intro-complete');

      if (this.morphOverlay) {
        this.morphOverlay.style.pointerEvents = 'none';
      }

      if (header) {
        this.animateHeaderIn(header);
      }
    });
  }

  /**
   * Complete the morph animation
   */
  private completeMorphAnimation(): void {
    if (this.morphOverlay) {
      this.morphOverlay.style.visibility = 'hidden';
    }
    this.completeIntro();
  }

  /**
   * Animate header fading in
   */
  private animateHeaderIn(header: HTMLElement): void {
    const headerChildren = header.children;

    Array.from(headerChildren).forEach((child) => {
      (child as HTMLElement).style.setProperty('opacity', '0', 'important');
      (child as HTMLElement).style.setProperty('visibility', 'visible', 'important');
    });

    const proxy = { opacity: 0 };
    gsap.to(proxy, {
      opacity: 1,
      duration: 1.0,
      ease: 'power2.out',
      onUpdate: () => {
        Array.from(headerChildren).forEach((child) => {
          (child as HTMLElement).style.setProperty('opacity', String(proxy.opacity), 'important');
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
   * Handle tap for skip
   */
  private handleTap(event: Event): void {
    event.preventDefault();
    if (!this.isComplete) {
      this.handleSkip();
    }
  }

  /**
   * Skip to end
   */
  private handleSkip(): void {
    if (this.timeline && !this.isComplete) {
      this.timeline.progress(1);
    } else if (!this.isComplete) {
      this.completeIntro();
    }
  }

  /**
   * Skip intro immediately
   */
  private skipIntroImmediately(): void {
    this.isComplete = true;

    const morphOverlay = document.getElementById('intro-morph-overlay');
    if (morphOverlay) {
      morphOverlay.classList.add('hidden');
      morphOverlay.style.display = 'none';
    }

    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete', 'intro-finished');

    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

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

  /**
   * Complete intro and cleanup
   */
  private completeIntro(): void {
    if (this.isComplete) return;

    this.isComplete = true;
    sessionStorage.setItem('introShown', 'true');

    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    const mainContainer = document.querySelector('main') as HTMLElement;
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
    window.scrollTo(0, 0);

    setTimeout(() => {
      document.documentElement.classList.add('intro-finished');
    }, 600);

    // Cleanup event listeners
    if (this.skipHandler && this.morphOverlay) {
      this.morphOverlay.removeEventListener('click', this.skipHandler);
      this.morphOverlay.removeEventListener('touchend', this.skipHandler);
      this.skipHandler = null;
    }

    if (typeof window !== 'undefined' && (window as any).NBW_STATE) {
      (window as any).NBW_STATE.setState({ introAnimating: false });
    }

    this.log('Mobile intro animation complete');
  }

  override getStatus() {
    return {
      ...super.getStatus(),
      isComplete: this.isComplete,
      timelineProgress: this.timeline?.progress() || 0
    };
  }

  override async destroy(): Promise<void> {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    if (this.skipHandler && this.morphOverlay) {
      this.morphOverlay.removeEventListener('click', this.skipHandler);
      this.morphOverlay.removeEventListener('touchend', this.skipHandler);
      this.skipHandler = null;
    }

    await super.destroy();
  }
}
