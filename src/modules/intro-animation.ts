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

    // Both mobile and desktop: flip the actual business card
    try {
      this.runCardFlip();
    } catch (error) {
      this.error('Failed to initialize intro animation:', error);
      this.completeIntro();
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
    // Scroll to top so header is visible
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    // Force scroll to top again after a frame
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    const cardInner = document.getElementById('business-card-inner');

    if (!cardInner) {
      // Card not found, just complete
      this.completeIntro();
      return;
    }

    // Start with back showing (rotated 180deg)
    gsap.set(cardInner, { rotationY: 180 });

    // Setup Enter key to skip animation
    this.skipHandler = this.handleKeyPress;
    document.addEventListener('keydown', this.skipHandler);

    // Create timeline for card flip
    this.timeline = gsap.timeline({
      onComplete: () => this.completeIntro()
    });

    this.timeline
      .to({}, { duration: 1.0 }) // Pause showing back
      .call(() => {
        // Show header/footer as card starts to flip
        document.documentElement.classList.remove('intro-loading');
        document.documentElement.classList.add('intro-complete');
      })
      .to(cardInner, {
        rotationY: 0,
        duration: 0.8,
        ease: 'power2.inOut'
      }); // Flip to front
  }


  /**
   * Complete the intro and clean up
   */
  private completeIntro(): void {
    this.isComplete = true;

    // Ensure main page content is visible (in case animation was skipped)
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Scroll to top so header is visible
    window.scrollTo(0, 0);

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
