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

    this.containerSelector = options.containerSelector || '.text-animation-section';
    this.duration = options.duration || 2;
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

    // Detect mobile vs desktop for scroll container
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const scrollContainer = document.querySelector('main');

    // On mobile, use window scroll (no scroller option)
    // On desktop, use the main container which has position:fixed and overflow:auto
    const useWindowScroll = isMobile || !scrollContainer;

    this.log(`Using ${useWindowScroll ? 'window' : 'container'} scroll for animation`);

    // Create master timeline with all animations
    this.timeline = gsap.timeline({
      paused: true
    });

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
        ease: 'none' // Linear for smooth scrubbing
      },
      0 // Start at beginning
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
          ease: 'none' // Linear for smooth scrubbing
        },
        (i % 3) * 0.1 // Slight stagger
      );
    });

    // Set up ScrollTrigger with scrub - animation tied directly to scroll
    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: useWindowScroll ? undefined : scrollContainer,
      start: 'top top',
      end: '+=100%', // Pin for 100vh of scrolling
      pin: true,
      pinSpacing: true,
      scrub: 0.5, // Smooth scrubbing - animation follows scroll with slight smoothing
      animation: this.timeline,
      onEnter: () => {
        this.log('Section pinned - scroll-driven animation active');
      },
      onLeave: () => {
        this.log('Section unpinned - animation complete');
      },
      onEnterBack: () => {
        this.log('Section re-entered - animation reversing');
      },
      onLeaveBack: () => {
        this.log('Section left backwards');
      }
    });

    this.log('Text animation initialized - tied to scroll behavior');
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
