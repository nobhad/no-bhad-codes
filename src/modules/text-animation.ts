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

    // Hold duration at start and end (for both scroll directions)
    // Higher value = more scroll distance before/after animation plays
    const holdDuration = 6;

    // Add hold at the start for reverse scroll
    this.timeline.to({}, { duration: holdDuration });

    // Add skew animation to timeline
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
    this.timeline.to({}, { duration: holdDuration });

    // Both mobile and desktop use scroll-driven animation with pinning
    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: scrollContainer || undefined,
      start: 'top top',
      end: '+=200%',  // Scroll 2x viewport height for full animation
      pin: true,
      pinSpacing: true,
      scrub: 0.5,
      animation: this.timeline,
      onEnter: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation active`);
      },
      onLeave: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation complete`);
      },
      onEnterBack: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Animation reversing`);
      },
      onLeaveBack: () => {
        this.log(`${isMobile ? 'Mobile' : 'Desktop'}: Section left backwards`);
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
