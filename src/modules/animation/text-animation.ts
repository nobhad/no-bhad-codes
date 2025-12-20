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

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../../types/modules';

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Blur-in animation constants - subtle and fast
const BLUR_AMOUNT = 4;
const BLUR_DURATION = 0.3;

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

    // Set initial blur state for blur-in effect (desktop only)
    const isMobileCheck = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobileCheck) {
      gsap.set(this.svg, {
        opacity: 0,
        filter: `blur(${BLUR_AMOUNT}px)`
      });
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

    // Toggle scroll-snap on main container to prevent conflicts with GSAP pinning
    const setScrollSnap = (enabled: boolean) => {
      if (isMobile && scrollContainer) {
        const main = scrollContainer as HTMLElement;
        if (enabled) {
          main.style.scrollSnapType = 'y mandatory';
          this.log('Mobile: Scroll-snap re-enabled');
        } else {
          main.style.scrollSnapType = 'none';
          this.log('Mobile: Scroll-snap disabled for hero animation');
        }
      }
    };

    // Hold at animation boundaries (both mobile and desktop)
    let isHolding = false;
    const HOLD_DURATION = 100; // 0.1 seconds

    // Store original styles to restore after hold
    let savedContainerStyles: { overflow: string; overflowY: string; touchAction: string } | null = null;
    let savedBodyStyles: { overflow: string; touchAction: string } | null = null;

    const triggerHold = (position: 'start' | 'end') => {
      if (isHolding) return;

      isHolding = true;
      this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Starting ${HOLD_DURATION}ms hold at ${position}`);

      // Mobile: block container scroll. Desktop: block body scroll only
      if (isMobile && scrollContainer) {
        const container = scrollContainer as HTMLElement;
        savedContainerStyles = {
          overflow: container.style.overflow,
          overflowY: container.style.overflowY,
          touchAction: container.style.touchAction
        };
        container.style.overflow = 'hidden';
        container.style.touchAction = 'none';
      }

      savedBodyStyles = {
        overflow: document.body.style.overflow,
        touchAction: document.body.style.touchAction
      };
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      setTimeout(() => {
        isHolding = false;

        // Restore container styles (mobile only)
        if (isMobile && scrollContainer && savedContainerStyles) {
          const container = scrollContainer as HTMLElement;
          container.style.overflow = savedContainerStyles.overflow;
          container.style.overflowY = savedContainerStyles.overflowY;
          container.style.touchAction = savedContainerStyles.touchAction;
        }

        // Restore body styles
        if (savedBodyStyles) {
          document.body.style.overflow = savedBodyStyles.overflow;
          document.body.style.touchAction = savedBodyStyles.touchAction;
        }

        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Hold complete, scroll re-enabled`);
      }, HOLD_DURATION);
    };

    // Mobile: start at top, Desktop: start at top
    const startPosition = 'top top';

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: scrollContainer || undefined,
      start: startPosition,
      end: scrollDistance,
      pin: true, // Pin on both mobile and desktop so animation completes before scroll continues
      pinSpacing: true,
      scrub: scrubValue,
      animation: this.timeline,
      onEnter: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation active`);
        setScrollSnap(false);
        // Blur-in effect when section enters (desktop only)
        if (!isMobile && this.svg) {
          gsap.to(this.svg, {
            opacity: 1,
            filter: 'blur(0px)',
            duration: BLUR_DURATION,
            ease: 'power2.out'
          });
        }
      },
      onLeave: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation complete`);
        setScrollSnap(true);
        // Blur-out when leaving section (desktop only)
        if (!isMobile && this.svg) {
          gsap.to(this.svg, {
            opacity: 0,
            filter: `blur(${BLUR_AMOUNT}px)`,
            duration: BLUR_DURATION * 0.7,
            ease: 'power2.in'
          });
        }
        // Hold AFTER animation completes (scrolling down)
        triggerHold('end');
      },
      onEnterBack: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation reversing`);
        setScrollSnap(false);
        // Blur-in when entering back (desktop only)
        if (!isMobile && this.svg) {
          gsap.to(this.svg, {
            opacity: 1,
            filter: 'blur(0px)',
            duration: BLUR_DURATION,
            ease: 'power2.out'
          });
        }
      },
      onLeaveBack: () => {
        console.log('>>> onLeaveBack FIRED <<<', { isMobile, isHolding });
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Section left backwards`);
        setScrollSnap(true);
        // Blur-out when leaving back (desktop only)
        if (!isMobile && this.svg) {
          gsap.to(this.svg, {
            opacity: 0,
            filter: `blur(${BLUR_AMOUNT}px)`,
            duration: BLUR_DURATION * 0.7,
            ease: 'power2.in'
          });
        }
        // Hold AFTER reverse animation completes (scrolling up)
        triggerHold('start');
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
