/**
 * ===============================================
 * INTRO ANIMATION MODULE
 * ===============================================
 * @file src/modules/intro-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Flips the actual business card in the section
 * - Starts with back of card showing, flips to front
 * - Enter key skips animation
 * - Header fades in as card flips
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../types/modules';

export class IntroAnimationModule extends BaseModule {
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

    // MOBILE: Ensure header is visible from the very start (no intro effect on header)
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      const header = document.querySelector('.header') as HTMLElement;
      if (header) {
        // Ensure header itself is visible
        header.style.removeProperty('opacity');
        header.style.removeProperty('visibility');
        // Ensure header children are visible
        Array.from(header.children).forEach(child => {
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

    // Both mobile and desktop: flip the actual business card
    try {
      this.runCardFlip();
    } catch (error) {
      this.error('Failed to initialize intro animation:', error);
      this.completeIntro();
    }
  }

  /**
   * Skip intro immediately (for returning visitors in same session)
   */
  private skipIntroImmediately(): void {
    this.isComplete = true;

    // Remove intro classes and show content immediately
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete', 'intro-finished');

    // Make sure card is showing front
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
   * Run card flip animation (no overlay, flip actual card in section)
   */
  private runCardFlip(): void {
    // Only scroll to top if user hasn't navigated away (check if near top)
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    if (currentScroll < 100) {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }

    const cardInner = document.getElementById('business-card-inner');

    if (!cardInner) {
      // Card not found, just complete
      this.completeIntro();
      return;
    }

    // Get parent container for perspective
    const cardContainer = cardInner.parentElement;

    // Force disable CSS transitions and set initial state
    cardInner.style.transition = 'none';
    cardInner.style.transform = 'rotateY(180deg)';

    // Ensure parent has perspective for 3D effect
    if (cardContainer) {
      cardContainer.style.perspective = '1000px';
    }

    // Setup Enter key to skip animation
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // Create timeline for card flip - 100% GSAP controlled
    this.timeline = gsap.timeline({
      onComplete: () => this.completeIntro()
    });

    // Get header element for direct animation
    const header = document.querySelector('.header') as HTMLElement;

    this.timeline
      .to({}, { duration: 3.0 }) // Pause showing back (longer delay before flip)
      .to(cardInner, {
        rotationY: 0,
        duration: 2.0,
        ease: 'power2.inOut',
        force3D: true,
        overwrite: true,
        onComplete: () => {
          // Remove intro-loading class FIRST so CSS !important rules don't block GSAP
          document.documentElement.classList.remove('intro-loading');
          document.documentElement.classList.add('intro-complete');

          // MOBILE: Skip header animation - header is always visible on mobile (no intro effect)
          const isMobile = window.matchMedia('(max-width: 767px)').matches;
          if (isMobile) {
            // Just ensure header is visible, no animation
            if (header) {
              header.style.removeProperty('opacity');
              header.style.removeProperty('visibility');
            }
            return;
          }

          // DESKTOP ONLY: Animate header CONTENT (not header itself, to prevent layout shift)
          if (header) {
            const headerChildren = header.children;

            // Set initial state on children with !important
            Array.from(headerChildren).forEach(child => {
              (child as HTMLElement).style.setProperty('opacity', '0', 'important');
              (child as HTMLElement).style.setProperty('visibility', 'visible', 'important');
            });

            // Animate using proxy object since GSAP can't set !important directly
            const proxy = { opacity: 0 };
            gsap.to(proxy, {
              opacity: 1,
              duration: 1.5,
              ease: 'power2.out',
              onUpdate: () => {
                Array.from(headerChildren).forEach(child => {
                  (child as HTMLElement).style.setProperty('opacity', String(proxy.opacity), 'important');
                });
              },
              onComplete: () => {
                // Clear inline styles so CSS takes over
                Array.from(headerChildren).forEach(child => {
                  (child as HTMLElement).style.removeProperty('opacity');
                  (child as HTMLElement).style.removeProperty('visibility');
                });
              }
            });
          }
        }
      }); // Flip to front with smooth 3D rotation
  }

  /**
   * Complete the intro and clean up
   */
  private completeIntro(): void {
    // Prevent multiple completions
    if (this.isComplete) return;

    this.isComplete = true;

    // Mark intro as shown for this session (skip on subsequent page loads)
    sessionStorage.setItem('introShown', 'true');

    // Ensure main page content is visible (in case animation was skipped)
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Only scroll to top on initial page load (not on subsequent navigations)
    // Check if user hasn't scrolled yet (still at top)
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    if (currentScroll < 100) {
      window.scrollTo(0, 0);
    }

    // After transition completes, add intro-finished to stop future transitions
    setTimeout(() => {
      document.documentElement.classList.add('intro-finished');
    }, 600); // Wait for intro-complete transition to finish

    // Clean up event listeners
    if (this.skipHandler) {
      document.removeEventListener('keydown', this.skipHandler);
      this.skipHandler = null;
    }

    // Update app state to indicate intro is complete
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
