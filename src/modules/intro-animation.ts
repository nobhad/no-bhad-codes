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
// Card rect: x="1250.15" y="1029.85" width="1062.34" height="591.3"
const SVG_CARD_X = 1250.15;
const SVG_CARD_Y = 1029.85;
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
    const fingers1 = svgDoc.getElementById('_1_Morph_Above_Card_-_Fingers_');
    const fingers2 = svgDoc.getElementById('_2_Morph_Above_Card_-_Fingers_');
    const fingers3 = svgDoc.getElementById('_3_Morph_Above_Card_-_Fingers_');
    const arm = svgDoc.getElementById('_Arm_-_Align_Perfectly_with_Card_');
    const thumbFiller = svgDoc.getElementById('_2_Morph_Behind_Card_-_Thumb_Filler_');
    const thumbPalm = svgDoc.getElementById('_3_Morph_Behind_Card_-_Thumb_Palm_');
    const businessCardGroup = svgDoc.getElementById('Business_Card');

    if (!fingers1 || !fingers2) {
      this.error('Finger morph paths not found in SVG');
      this.runCardFlip();
      return;
    }

    this.log('Loaded SVG elements: fingers1, fingers2, arm, thumbFiller, thumbPalm, businessCard');

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

    // Create separate group for paw elements that go BEHIND card (will retract)
    const pawGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pawGroup.setAttribute('id', 'paw-retract-group');

    // Layer order (bottom to top):
    // 1. Thumb filler (behind card, in pawGroup)
    // 2. Thumb/palm (behind card, in pawGroup)
    // 3. Business card (static, stays in place)
    // 4. Arm (above card, in fingersGroup - stays connected to fingers)
    // 5. Fingers (above card, in fingersGroup - crossfade between positions)

    // Add thumb filler behind card
    if (thumbFiller) {
      const clonedThumbFiller = thumbFiller.cloneNode(true) as Element;
      pawGroup.appendChild(clonedThumbFiller);
    }

    // Add thumb/palm behind card
    if (thumbPalm) {
      const clonedThumbPalm = thumbPalm.cloneNode(true) as Element;
      pawGroup.appendChild(clonedThumbPalm);
    }

    // NOTE: Arm is added to fingersGroup instead (above card, with fingers)
    // so it stays visually connected to the fingers at the top

    // Add paw group to wrapper (thumb, palm - behind card)
    transformWrapper.appendChild(pawGroup);

    // Add business card group (stays in place, above paw body but below fingers)
    // Apply inline styles since CSS classes from source SVG don't transfer
    if (businessCardGroup) {
      const clonedCard = businessCardGroup.cloneNode(true) as Element;
      clonedCard.setAttribute('id', 'svg-business-card');

      // Fix card outline - white fill with dark stroke (cls-1 style)
      const cardOutline = clonedCard.querySelector('rect');
      if (cardOutline) {
        cardOutline.setAttribute('fill', '#fff');
        cardOutline.setAttribute('stroke', '#231f20');
        cardOutline.setAttribute('stroke-width', '9');
        cardOutline.setAttribute('stroke-miterlimit', '10');
      }

      // Fix text paths - black fill (cls-3 style)
      const textPaths = clonedCard.querySelectorAll('path.cls-3, g path');
      textPaths.forEach(path => {
        path.setAttribute('fill', '#231f20');
      });

      transformWrapper.appendChild(clonedCard);
    }

    // Create separate group for fingers AND arm (will retract together, rendered on top of card)
    // The arm connects to fingers at the top, so they must be in the same group
    const fingersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    fingersGroup.setAttribute('id', 'fingers-retract-group');

    // Add arm to fingers group FIRST (so it renders behind fingers but above card)
    // This keeps the arm visually connected to the fingers at the top
    if (arm) {
      const clonedArmForFingers = arm.cloneNode(true) as Element;
      clonedArmForFingers.setAttribute('id', 'arm-above-card');
      fingersGroup.appendChild(clonedArmForFingers);
    }

    // Add fingers position 1 - this will be morphed through positions 2 and 3
    const clonedFingers = fingers1.cloneNode(true) as SVGPathElement;
    clonedFingers.setAttribute('id', 'fingers-morphing');
    fingersGroup.appendChild(clonedFingers);

    // Get the 'd' attribute paths for morph targets
    const fingers2PathData = fingers2.getAttribute('d');
    const fingers3PathData = fingers3?.getAttribute('d');

    // Add fingers group to wrapper (on top of everything)
    transformWrapper.appendChild(fingersGroup);

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

    // Phase 1: CLUTCHING - paw gripping the card (fingers position 1 visible)
    this.timeline.to({}, { duration: clutchHold });

    // Phase 2: RELEASING - morph fingers from position 1 → 2
    if (fingers2PathData) {
      this.timeline.to(clonedFingers, {
        morphSVG: {
          shape: fingers2PathData,
          shapeIndex: 'auto'
        },
        duration: releaseDuration,
        ease: fadeEase
      });
    }

    // Phase 3: FULLY OPEN - morph fingers from position 2 → 3
    if (fingers3PathData) {
      this.timeline.to(clonedFingers, {
        morphSVG: {
          shape: fingers3PathData,
          shapeIndex: 'auto'
        },
        duration: openDuration,
        ease: 'power1.out'
      });
    }

    // Brief hold showing fully released paw
    this.timeline.to({}, { duration: 0.2 });

    // Phase 4: RETRACTION - paw slides diagonally up and left off screen
    // The arm comes from top-left, so it retracts back that direction
    // Both pawGroup (thumb, palm, arm) and fingersGroup retract together
    this.timeline.to(pawGroup, {
      x: -1000,
      y: -800,
      duration: retractDuration,
      ease: 'power2.in'
    });

    // Fingers retract at the same time as the rest of the paw
    this.timeline.to(fingersGroup, {
      x: -1000,
      y: -800,
      duration: retractDuration,
      ease: 'power2.in'
    }, '<'); // '<' = same time as previous

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
