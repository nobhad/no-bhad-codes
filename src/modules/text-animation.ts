/**
 * ===============================================
 * TEXT ANIMATION MODULE
 * ===============================================
 * @file src/modules/text-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Uses GSAP for smooth split-text skew animation
 * - Animation tied directly to scroll position (scrub)
 * - Desktop: Scroll-driven animation with pinning
 * - Respects reduced motion preferences
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../types/modules';

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

interface TextAnimationOptions extends ModuleOptions {
  /** Selector for the animation container */
  containerSelector?: string;
  /** Duration of the animation */
  duration?: number;
}

export class TextAnimationModule extends BaseModule {
  private container: HTMLElement | null = null;
  private svg: Element | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private scrollTrigger: ScrollTrigger | null = null;

  // Configuration
  private containerSelector: string;
  private duration: number;

  constructor(options: TextAnimationOptions = {}) {
    super('TextAnimationModule', { debug: true, ...options });

    this.containerSelector = options.containerSelector || '.hero-section';
    this.duration = options.duration || 5;
  }

  override async init(): Promise<void> {
    await super.init();

    // Skip if reduced motion is preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - disabling text animation');
      return;
    }

    this.setupAnimation();
  }

  /**
   * Set up the text animation - scroll-driven on desktop
   */
  private setupAnimation(): void {
    this.container = document.querySelector(this.containerSelector) as HTMLElement;
    if (!this.container) {
      this.log(`Container "${this.containerSelector}" not found`);
      return;
    }

    this.svg = this.container.querySelector('.text-animation-svg') as Element;
    if (!this.svg) {
      this.warn('SVG element not found');
      return;
    }

    const leftGroup = this.svg.querySelector('.text-left') as Element;
    const rightGroup = this.svg.querySelector('.text-right') as Element;
    const textElements = this.svg.querySelectorAll('text');

    if (!leftGroup || !rightGroup || textElements.length === 0) {
      this.warn('Required SVG elements not found');
      return;
    }

    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const scrollContainer = document.querySelector('main');

    this.log(`Setting up animation for ${isMobile ? 'mobile' : 'desktop'}`);

    // Create master timeline with all animations
    this.timeline = gsap.timeline({
      paused: true
    });

    // Hold durations - keep minimal, actual pause is time-based (2 sec)
    // Higher value = more scroll distance before/after animation plays
    const startHold = isMobile ? 2 : 6;
    const endHold = isMobile ? 2 : 6;

    // Add hold at the start for reverse scroll
    this.timeline.to({}, { duration: startHold });

    // Add skew animation to timeline (same animation for mobile and desktop)
    this.timeline.fromTo(
      [leftGroup, rightGroup],
      {
        svgOrigin: '640 500',
        skewY: (i: number) => [-30, 15][i],
        scaleX: (i: number) => [0.6, 0.85][i],
        x: 200
      },
      {
        duration: this.duration,
        skewY: (i: number) => [-15, 30][i],
        scaleX: (i: number) => [0.85, 0.6][i],
        x: -200,
        ease: 'none'
      },
      0
    );

    // Add text slide-in animations at same time
    textElements.forEach((text, i) => {
      this.timeline!.fromTo(
        text,
        {
          xPercent: -100,
          x: 700
        },
        {
          duration: this.duration,
          xPercent: 0,
          x: 575,
          ease: 'none'
        },
        (i % 3) * 0.1
      );
    });

    // Add hold at the end (creates pause after animation completes)
    // Mobile: longer rest period before transitioning to next section
    this.timeline.to({}, { duration: endHold });

    // Both mobile and desktop use scroll-driven animation with pinning
    const scrollDistance = isMobile ? '+=200%' : '+=200%';

    // Mobile needs smoother scrub for touch scrolling
    const scrubValue = isMobile ? 1.5 : 0.5;

    // MOBILE: Keep scroll-snap disabled entirely to prevent conflicts
    // Scroll-snap fights with GSAP and causes jumping/looping behavior
    const setScrollSnap = (_enabled: boolean) => {
      // No-op on mobile - keep scroll-snap disabled
      if (isMobile) {
        // Do nothing on mobile
      }
    };

    // Mobile: 2 second hold at animation end (both directions)
    let isHolding = false;
    let hasTriggeredEndHold = false;
    let hasTriggeredStartHold = false;
    const HOLD_DURATION = 2000; // 2 seconds

    const triggerHold = (direction: 'end' | 'start') => {
      if (!isMobile || isHolding) return;

      isHolding = true;
      this.log(`Mobile: Starting ${HOLD_DURATION}ms hold at ${direction}`);

      // Prevent ALL scrolling on mobile during hold
      if (scrollContainer) {
        const container = scrollContainer as HTMLElement;
        container.style.overflow = 'hidden';
        container.style.touchAction = 'none';
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
      }

      setTimeout(() => {
        isHolding = false;
        if (scrollContainer) {
          const container = scrollContainer as HTMLElement;
          container.style.overflow = '';
          container.style.overflowY = 'scroll';
          container.style.touchAction = '';
          document.body.style.overflow = '';
          document.body.style.touchAction = '';
        }
        this.log('Mobile: Hold complete, scroll re-enabled');

        // Reset triggers after hold completes
        if (direction === 'end') hasTriggeredEndHold = false;
        if (direction === 'start') hasTriggeredStartHold = false;
      }, HOLD_DURATION);
    };

    // Mobile: start when centered, Desktop: start at top
    const startPosition = isMobile ? 'center center' : 'top top';

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: scrollContainer || undefined,
      start: startPosition,
      end: scrollDistance,
      pin: !isMobile, // Disable pinning on mobile - causes scroll issues
      pinSpacing: !isMobile,
      scrub: scrubValue,
      animation: this.timeline,
      onUpdate: (self) => {
        // Mobile: trigger hold at animation boundaries
        if (isMobile) {
          // At end of animation (progress >= 0.98)
          if (self.progress >= 0.98 && !hasTriggeredEndHold && self.direction === 1) {
            hasTriggeredEndHold = true;
            triggerHold('end');
          }
          // At start of animation when scrolling backwards (progress <= 0.02)
          if (self.progress <= 0.02 && !hasTriggeredStartHold && self.direction === -1) {
            hasTriggeredStartHold = true;
            triggerHold('start');
          }
        }
      },
      onEnter: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation active`);
        setScrollSnap(false);
      },
      onLeave: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation complete`);
        setScrollSnap(true);
      },
      onEnterBack: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation reversing`);
        setScrollSnap(false);
      },
      onLeaveBack: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Section left backwards`);
        setScrollSnap(true);
      }
    });
    this.log(`Animation initialized - scroll-driven on ${isMobile ? 'mobile' : 'desktop'}`);
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      hasContainer: !!this.container,
      hasSvg: !!this.svg,
      hasTimeline: !!this.timeline,
      hasScrollTrigger: !!this.scrollTrigger
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    if (this.scrollTrigger) {
      this.scrollTrigger.kill();
      this.scrollTrigger = null;
    }

    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.container = null;
    this.svg = null;

    await super.destroy();
  }
}
