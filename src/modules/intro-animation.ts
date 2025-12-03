/**
 * ===============================================
 * INTRO ANIMATION MODULE - CLS-SAFE VERSION
 * ===============================================
 * @file src/modules/intro-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - 100% independent of business-card-section
 * - Full page overlay (covers header/footer)
 * - Positions intro card exactly over section card
 * - Simple animation: back -> pause -> flip -> front -> fade out
 * - Enter key skips animation
 * - No layout shifts - uses fixed positioning
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../types/modules';

export class IntroAnimationModule extends BaseModule {
  private overlay: HTMLElement | null = null;
  private introCard: HTMLElement | null = null;
  private cardInner: HTMLElement | null = null;
  private frontFace: HTMLElement | null = null;
  private backFace: HTMLElement | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private isComplete = false;
  private skipHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(options: ModuleOptions = {}) {
    super('IntroAnimationModule', { debug: false, ...options }); // Disable debug to prevent flashing

    // Bind methods
    this.handleSkip = this.handleSkip.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // On mobile, flip the actual business card (no overlay)
    const isMobile = window.innerWidth <= 767;
    if (isMobile) {
      this.runMobileCardFlip();
      return;
    }

    try {
      this.createIntroElements();
      this.setupEventListeners();
      this.startAnimation();
      // Intro animation initialized
    } catch (error) {
      this.error('Failed to initialize intro animation:', error);
      // If intro animation fails, show the page content immediately
      this.completeIntro();
    }
  }

  /**
   * Create intro overlay and card elements
   */
  private createIntroElements(): void {
    // Find the section card to align with
    const sectionCard = document.querySelector('.business-card-container') as HTMLElement;

    // Create full page overlay (desktop only - mobile skips this)
    this.overlay = document.createElement('div');
    this.overlay.id = 'intro-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: var(--color-neutral-300, #f5f5f5);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create intro card container positioned to align with section card
    this.introCard = document.createElement('div');
    this.introCard.id = 'intro-card-container';

    // Get exact position and size from the section card if it exists
    let cardWidth = 525;
    let cardHeight = 299.7;
    const cardPosition = { top: 0, left: 0 };

    if (sectionCard) {
      const rect = sectionCard.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(sectionCard);

      cardWidth = parseInt(computedStyle.width) || rect.width;
      cardHeight = parseInt(computedStyle.height) || rect.height;

      // Calculate position relative to viewport center
      cardPosition.top = rect.top + rect.height / 2 - window.innerHeight / 2;
      cardPosition.left = rect.left + rect.width / 2 - window.innerWidth / 2;

      // Tracked section card position for alignment
    } else {
      // Section card not found, using responsive fallback
      // Fallback to responsive sizing
      const screenWidth = window.innerWidth;
      if (screenWidth <= 480) {
        cardWidth = 350;
        cardHeight = 199.8;
      } else if (screenWidth <= 768) {
        cardWidth = 420;
        cardHeight = 239.9;
      }
    }

    this.introCard.style.cssText = `
      width: ${cardWidth}px;
      height: ${cardHeight}px;
      perspective: 1000px;
      position: relative;
    `;

    // Create card inner (flip container)
    this.cardInner = document.createElement('div');
    this.cardInner.id = 'intro-card-inner';
    this.cardInner.style.cssText = `
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.6s ease-in-out;
    `;

    // Create front face (normal position) - NO ROUNDED CORNERS, CORRECT COLORS
    this.frontFace = document.createElement('div');
    this.frontFace.classList.add('intro-card-face', 'intro-card-front');
    this.frontFace.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      transform: rotateY(0deg);
      border-radius: 0;
      overflow: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      color: #333333;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create back face (180 degrees rotated) - NO ROUNDED CORNERS, CORRECT COLORS
    this.backFace = document.createElement('div');
    this.backFace.classList.add('intro-card-face', 'intro-card-back');
    this.backFace.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      transform: rotateY(180deg);
      border-radius: 0;
      overflow: hidden;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      color: #333333;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Add card images
    const frontImg = document.createElement('img');
    frontImg.src = '/images/business-card_front.svg';
    frontImg.alt = 'Business Card Front';
    frontImg.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    `;

    const backImg = document.createElement('img');
    backImg.src = '/images/business-card_back.svg';
    backImg.alt = 'Business Card Back';
    backImg.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    `;

    // Assemble elements
    this.frontFace.appendChild(frontImg);
    this.backFace.appendChild(backImg);
    this.cardInner.appendChild(this.frontFace);
    this.cardInner.appendChild(this.backFace);
    this.introCard.appendChild(this.cardInner);
    this.overlay.appendChild(this.introCard);

    // Add to DOM
    document.body.appendChild(this.overlay);

    // Intro elements created and added to DOM
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);
  }

  /**
   * Handle keyboard input (Enter to skip)
   */
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !this.isComplete) {
      // Animation skipped via Enter key
      this.handleSkip();
    }
  }

  /**
   * Skip to end of animation
   */
  private handleSkip(): void {
    if (this.timeline && !this.isComplete) {
      this.timeline.progress(1);
      // The timeline's onComplete callback will call completeIntro()
    } else if (!this.isComplete) {
      // If no timeline exists but animation isn't complete, complete it manually
      this.completeIntro();
    }
  }

  /**
   * Start the intro animation sequence
   */
  private startAnimation(): void {
    if (!this.cardInner || !this.overlay) {
      this.error('Missing elements for animation');
      return;
    }

    // Create timeline
    this.timeline = gsap.timeline({
      onComplete: () => this.completeIntro()
    });

    // Start with back face showing - card container rotated 180deg shows back face (which is at 180deg relative to container)
    gsap.set(this.cardInner, { rotationY: 180 });

    // Ensure overlay is visible and card is ready
    gsap.set(this.overlay, { opacity: 1 });

    // Animation sequence: back -> pause -> flip to front -> fade in header/footer -> fade out overlay
    this.timeline
      .to({}, { duration: 1.2 }) // Initial pause showing back of card
      .to(this.cardInner, {
        rotationY: 0,
        duration: 0.8,
        ease: 'power2.inOut'
      }) // Single flip from back to front (180deg to 0deg)
      .to({}, { duration: 0.5 }) // Brief pause showing front
      .call(() => {
        // Start fading in header/footer AFTER card flip completes
        document.documentElement.classList.remove('intro-loading');
        document.documentElement.classList.add('intro-complete');
      })
      .to({}, { duration: 0.6 }) // Wait for header/footer to fade in (0.5s CSS transition + buffer)
      .to(this.overlay, {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut'
      }) // Fade out overlay after header/footer are visible
      .to(this.introCard, {
        opacity: 0,
        scale: 0.9,
        duration: 0.4,
        ease: 'power2.inOut'
      }); // Then fade out the card

    // Intro animation started
  }

  /**
   * Run card flip animation on mobile (no overlay, flip actual card in section)
   */
  private runMobileCardFlip(): void {
    // Scroll to top so header is visible
    window.scrollTo(0, 0);

    // Immediately show header (remove intro-loading class)
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    const cardInner = document.getElementById('business-card-inner');

    if (!cardInner) {
      // Card not found, just complete
      this.completeMobileIntro();
      return;
    }

    // Start with back showing (rotated 180deg)
    gsap.set(cardInner, { rotationY: 180 });

    // Create timeline for mobile card flip
    this.timeline = gsap.timeline({
      onComplete: () => this.completeMobileIntro()
    });

    this.timeline
      .to({}, { duration: 1.0 }) // Pause showing back
      .to(cardInner, {
        rotationY: 0,
        duration: 0.8,
        ease: 'power2.inOut'
      }); // Flip to front
  }

  /**
   * Complete mobile intro (simpler than desktop - no overlay to clean up)
   */
  private completeMobileIntro(): void {
    this.isComplete = true;
    document.documentElement.classList.add('intro-finished');

    // Update app state
    if (typeof window !== 'undefined' && (window as any).NBW_STATE) {
      (window as any).NBW_STATE.setState({ introAnimating: false });
    }
  }

  /**
   * Complete the intro and clean up
   */
  private completeIntro(): void {
    this.isComplete = true;

    // Ensure main page content is visible (in case animation was skipped)
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Scroll to top so header is visible (especially important on mobile)
    window.scrollTo(0, 0);

    // After transition completes, add intro-finished to stop future transitions
    setTimeout(() => {
      document.documentElement.classList.add('intro-finished');
    }, 600); // Wait for intro-complete transition to finish

    // Remove overlay from DOM
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    // Clean up event listeners
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    // Update app state to indicate intro is complete
    if (typeof window !== 'undefined' && (window as any).NBW_STATE) {
      (window as any).NBW_STATE.setState({ introAnimating: false });
    }

    // Intro animation completed and cleaned up
  }

  /**
   * Get current status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      isComplete: this.isComplete,
      hasOverlay: !!this.overlay,
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

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    await super.destroy();
  }
}
