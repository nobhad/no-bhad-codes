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

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import type { ModuleOptions } from '../../types/modules';
import { SVG_PATH, SVG_VIEWBOX, REPLAY_CONFIG } from '../../config/intro-animation-config';
import * as SvgBuilder from './intro/svg-builder';

// Register MorphSVG plugin with GSAP
gsap.registerPlugin(MorphSVGPlugin);

// ============================================================================
// SVG CONSTANTS
// ============================================================================
// Uses the SAME SVG as desktop, scaled to match mobile card size.
// ============================================================================

/** SVG file path - uses browser cache, preload in index.html ensures fast loading */
const PAW_SVG = SVG_PATH;

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
    super('MobileIntroAnimationModule', { debug: false, ...options });

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
    // PAGE CHECK - ONLY RUN ON INTRO/HOME PAGE
    // The coyote paw animation is ONLY for the home page / business card section
    // Skip if we're on any other page (contact, about, projects, etc.)
    // ========================================================================
    const hash = window.location.hash;
    const isIntroPage = !hash || hash === '#' || hash === '#/' || hash === '#/intro' || hash === '#/home';
    if (!isIntroPage) {
      this.log(`Not on intro page (hash: ${hash}) - skipping coyote paw animation`);
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
    // Uses shared cache from SvgBuilder (preload in index.html ensures fast loading)
    // ========================================================================
    this.log('Loading SVG file...');
    const svgDoc = await SvgBuilder.fetchAndParseSvg(PAW_SVG);

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
    // SET SVG VIEWBOX FIRST (before alignment calculation)
    // Must match SVG_VIEWBOX for calculateSvgAlignment() to work correctly
    // ========================================================================
    // Use original SVG viewBox to maintain correct proportions
    morphSvg.setAttribute('viewBox', `0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`);
    morphSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // ========================================================================
    // CALCULATE ALIGNMENT
    // Scale SVG to match mobile card size
    // ========================================================================
    // Calculate pixel-perfect alignment using shared function
    // CRITICAL: Pass overlay element so alignment accounts for header offset
    // This assumes viewBox is SVG_VIEWBOX (which we just set above)
    const alignment = SvgBuilder.calculateSvgAlignment(businessCard, this.morphOverlay);
    const { scale, translateX, translateY, viewportWidth, viewportHeight } = alignment;

    this.log('Mobile pixel-perfect alignment:', { scale, translateX, translateY, viewportWidth, viewportHeight });

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

    // Add thumb (hidden initially, appears at Phase 2)
    // Use thumb from Position 1 to match desktop behavior
    const thumbElement = position1.querySelector('#_Thumb_Behind_Card_-1');
    let clonedThumb: Element | null = null;
    if (thumbElement) {
      clonedThumb = thumbElement.cloneNode(true) as Element;
      clonedThumb.setAttribute('id', 'thumb-behind-card');
      (clonedThumb as SVGSVGElement).style.opacity = '0';
      behindCardGroup.appendChild(clonedThumb);
    }

    transformWrapper.appendChild(behindCardGroup);

    // Add card
    let clonedCard: Element | null = null;
    if (cardGroup) {
      clonedCard = cardGroup.cloneNode(true) as Element;
      clonedCard.setAttribute('id', 'svg-business-card');

      // Ensure card has solid fill background to hide thumb behind it
      const cardRectElement = clonedCard.querySelector('rect');
      if (cardRectElement) {
        cardRectElement.setAttribute('fill', '#ffffff');
        cardRectElement.setAttribute('fill-opacity', '1');
      }

      transformWrapper.appendChild(clonedCard);
    }

    // Add fingers
    const clonedPos1 = position1.cloneNode(true) as Element;
    clonedPos1.setAttribute('id', 'position-1');

    // Remove thumb from this clone - it should only be in behindCardGroup
    const thumbInPos1 = clonedPos1.querySelector('#_Thumb_Behind_Card_-1');
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

    // ========================================================================
    // CREATE SHADOW FILTER (same as desktop)
    // ========================================================================
    SvgBuilder.createShadowFilter(morphSvg, scale);

    // Apply shadow filter to groups and card (same as desktop)
    behindCardGroup.setAttribute('filter', 'url(#card-shadow)');
    aboveCardGroup.setAttribute('filter', 'url(#card-shadow)');
    if (clonedCard) {
      clonedCard.setAttribute('filter', 'url(#card-shadow)');
    }

    morphSvg.appendChild(transformWrapper);

    this.log('SVG layers assembled for mobile with shadows');

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

    // Thumb path data for morphing
    const thumb2 = position2.querySelector('#_Thumb_Behind_Card_') as SVGPathElement;
    const thumb3 = position3?.querySelector('#_Thumb_Behind_Card_-3') as SVGPathElement;
    const thumb2PathData = thumb2?.getAttribute('d');
    const thumb3PathData = thumb3?.getAttribute('d');

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
    // Using linear easing for smoother SVG vertex interpolation
    // ========================================================================
    if (fingerA1 && fingerA2PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: 'none', // Linear for smooth SVG morphing
        force3D: true // GPU acceleration
      });
    }

    if (fingerB1 && fingerB2PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: 'none',
        force3D: true
      }, '<');
    }

    if (fingerC1 && fingerC2PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: 'none',
        force3D: true
      }, '<');
    }

    // Thumb appears and morphs 1→2 at Phase 2
    if (clonedThumb && thumb2PathData) {
      this.timeline.set(clonedThumb, { opacity: 1 }, '<');
      this.timeline.to(clonedThumb, {
        morphSVG: { shape: thumb2PathData, shapeIndex: 'auto' },
        duration: releaseDuration,
        ease: 'none',
        force3D: true
      }, '<');
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
    // Using linear easing for smoother SVG vertex interpolation
    if (fingerA1 && fingerA3PathData) {
      this.timeline.to(fingerA1, {
        morphSVG: { shape: fingerA3PathData, shapeIndex: 'auto' },
        duration: 0.08,
        ease: 'none', // Linear for smooth SVG morphing
        force3D: true
      }, '<');
    }

    if (fingerB1 && fingerB3PathData) {
      this.timeline.to(fingerB1, {
        morphSVG: { shape: fingerB3PathData, shapeIndex: 'auto' },
        duration: 0.08,
        ease: 'none',
        force3D: true
      }, '<');
    }

    if (fingerC1 && fingerC3PathData) {
      this.timeline.to(fingerC1, {
        morphSVG: { shape: fingerC3PathData, shapeIndex: 'auto' },
        duration: 0.2,
        ease: 'none',
        force3D: true
      }, '<');
    }

    // Thumb morphs 2→3 during retraction
    if (clonedThumb && thumb3PathData) {
      this.timeline.to(clonedThumb, {
        morphSVG: { shape: thumb3PathData, shapeIndex: 'auto' },
        duration: 0.2,
        ease: 'none',
        force3D: true
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
    // CRITICAL: Reveal business card inner FIRST (clear inline visibility:hidden;opacity:0)
    // Must happen before hiding overlay to prevent flash
    const cardInner = document.getElementById('business-card-inner');
    if (cardInner) {
      cardInner.style.visibility = 'visible';
      cardInner.style.opacity = '1';
    }

    if (this.morphOverlay) {
      this.morphOverlay.style.visibility = 'hidden';
    }
    this.completeIntro();
  }

  /**
   * Animate header fading in
   *
   * NOTE: Header is now kept visible during animations - no hiding/fading
   * This method ensures any inline styles that might hide the header are removed.
   */
  private animateHeaderIn(header: HTMLElement): void {
    const headerChildren = header.children;

    // Keep header visible - remove any inline styles that might hide it
    Array.from(headerChildren).forEach((child) => {
      (child as HTMLElement).style.removeProperty('opacity');
      (child as HTMLElement).style.removeProperty('visibility');
    });

    // Also ensure header itself is visible
    header.style.removeProperty('opacity');
    header.style.removeProperty('visibility');
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

    // Reveal business card inner (clear inline visibility:hidden;opacity:0)
    const cardInner = document.getElementById('business-card-inner');
    if (cardInner) {
      cardInner.style.visibility = 'visible';
      cardInner.style.opacity = '1';
    }

    // Make intro nav visible immediately
    const introNav = document.querySelector('.intro-nav') as HTMLElement;
    if (introNav) {
      gsap.set(introNav, { opacity: 1 });
      const navLinks = introNav.querySelectorAll('.intro-nav-link');
      if (navLinks.length > 0) {
        gsap.set(navLinks, { opacity: 1 });
      }
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

    // Dispatch completion event
    this.dispatchEvent('complete');
  }

  /**
   * Play the entry animation when entering the home page
   * Called by PageTransitionModule when navigating TO intro from another page
   *
   * Uses the same paw animation as desktop by delegating to IntroAnimationModule
   */
  async playEntryAnimation(): Promise<void> {
    this.log('[MobileIntro] playEntryAnimation called - using paw animation');
    this.log('Playing paw entry animation (same as desktop)');

    try {
      // Dynamically import the desktop IntroAnimationModule for the paw entry animation
      const { IntroAnimationModule } = await import('./intro-animation');

      // Create a temporary instance for the entry animation
      const desktopModule = new IntroAnimationModule();

      // Call the desktop entry animation with bypassMobileCheck=true
      await desktopModule.playEntryAnimation(true);

      this.log('[MobileIntro] Paw entry animation complete');
      this.log('Paw entry animation complete');
    } catch (error) {
      console.error('[MobileIntro] Failed to load desktop entry animation:', error);
      this.log('Failed to load paw animation, falling back to simple fade');

      // Fallback to simple fade if paw animation fails
      this.playEntryAnimationFallback();
    }
  }

  /**
   * Fallback entry animation if paw animation fails
   */
  private playEntryAnimationFallback(): void {
    // Show the intro section
    const introSection = document.querySelector('.business-card-section') as HTMLElement;
    if (introSection) {
      introSection.classList.remove('page-hidden');
      introSection.classList.add('page-active');
      gsap.set(introSection, {
        clearProps: 'display,visibility,opacity,zIndex,pointerEvents',
        display: 'grid',
        visibility: 'visible',
        opacity: 1
      });
    }

    // CRITICAL: Reveal card inner first (clear inline visibility:hidden;opacity:0)
    const cardInner = document.getElementById('business-card-inner');
    if (cardInner) {
      cardInner.style.visibility = 'visible';
      cardInner.style.opacity = '1';
    }

    // Show business card with animation
    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      gsap.fromTo(businessCard,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: 'power2.out' }
      );
    }

    // Show intro nav with animation
    const introNav = document.querySelector('.intro-nav') as HTMLElement;
    if (introNav) {
      gsap.set(introNav, { opacity: 0 });
      gsap.to(introNav, {
        opacity: 1,
        duration: 1.2,
        ease: 'sine.inOut',
        delay: 0.3
      });
      const navLinks = introNav.querySelectorAll('.intro-nav-link');
      if (navLinks.length > 0) {
        gsap.set(navLinks, { opacity: 0 });
        gsap.to(navLinks, {
          opacity: 1,
          duration: 1.2,
          ease: 'sine.inOut',
          stagger: 0.15,
          delay: 0.3
        });
      }
    }
  }

  /**
   * Play exit animation when leaving intro page
   * Called by PageTransitionModule when navigating away from intro
   *
   * Uses the same paw animation as desktop by delegating to IntroAnimationModule
   *
   * NOTE: This animation is ONLY for the home page / business card section.
   * It should NOT be used for any other pages or sections.
   */
  async playExitAnimation(): Promise<void> {
    this.log('[MobileIntro] playExitAnimation called - ONLY for home page / business card section');
    this.log('Playing paw exit animation (same as desktop)');

    try {
      // Dynamically import the desktop IntroAnimationModule for the paw exit animation
      const { IntroAnimationModule } = await import('./intro-animation');

      // Create a temporary instance just for the exit animation
      // The exit animation is self-contained and fetches what it needs from the DOM
      const desktopModule = new IntroAnimationModule();

      // The desktop module's playExitAnimation has the full paw animation
      // We pass through to it since it now works on both mobile and desktop
      await desktopModule.playExitAnimation();

      this.log('[MobileIntro] Paw exit animation complete');
      this.log('Paw exit animation complete');
    } catch (error) {
      console.error('[MobileIntro] Failed to load desktop exit animation:', error);
      this.log('Failed to load paw animation, falling back to simple fade');

      // Fallback to simple fade if paw animation fails
      return new Promise((resolve) => {
        const businessCard = document.getElementById('business-card');
        const introNav = document.querySelector('.intro-nav') as HTMLElement;

        const exitTimeline = gsap.timeline({
          onComplete: () => {
            this.log('Fallback exit animation complete');
            resolve();
          }
        });

        if (businessCard) {
          exitTimeline.to(businessCard, {
            opacity: 0,
            scale: 0.95,
            duration: 0.8,
            ease: 'power2.inOut'
          });
        }

        if (introNav) {
          exitTimeline.to(introNav, {
            opacity: 0,
            y: 20,
            duration: 0.8,
            ease: 'power2.inOut'
          }, '<');
        }

        if (!businessCard && !introNav) {
          resolve();
        }
      });
    }
  }

  /**
   * Complete intro and cleanup
   */
  private completeIntro(): void {
    if (this.isComplete) return;

    this.isComplete = true;

    // Store timestamp for replay logic (same as desktop)
    localStorage.setItem(REPLAY_CONFIG.timestampKey, String(Date.now()));

    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    const businessCard = document.getElementById('business-card');
    if (businessCard) {
      businessCard.style.opacity = '1';
    }

    // Reveal business card inner (clear inline visibility:hidden;opacity:0)
    const cardInner = document.getElementById('business-card-inner');
    if (cardInner) {
      cardInner.style.visibility = 'visible';
      cardInner.style.opacity = '1';
    }

    // Fade in intro nav with GSAP - matching desktop timing
    const introNav = document.querySelector('.intro-nav') as HTMLElement;
    if (introNav) {
      gsap.to(introNav, {
        opacity: 1,
        duration: 1.2,
        ease: 'sine.inOut'
      });
      // Also animate the individual nav links with stagger
      const navLinks = introNav.querySelectorAll('.intro-nav-link');
      if (navLinks.length > 0) {
        gsap.to(navLinks, {
          opacity: 1,
          duration: 1.2,
          ease: 'sine.inOut',
          stagger: 0.15
        });
      }
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

    // Dispatch complete event for PageTransitionModule
    this.log('[MobileIntro] Dispatching complete event');
    this.dispatchEvent('complete');
    this.log('[MobileIntro] Complete event dispatched');

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
