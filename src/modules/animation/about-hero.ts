/**
 * ===============================================
 * ABOUT HERO MODULE
 * ===============================================
 * @file src/modules/animation/about-hero.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Full viewport "NO BHAD CODES" text animation on about page
 * - Wheel-driven animation (virtual pages have no actual scroll)
 * - Uses GSAP smooth interpolation like reference: gsap.to([tl, tl2], { progress })
 * - When animation completes, hero fades out and about content fades in
 * - Desktop only - mobile shows content directly
 *
 * ANIMATION (reference: codepen split-text effect):
 * - Left group: skewY -30 to -15, scaleX 0.6 to 0.85, x 200 to -200
 * - Right group: skewY 15 to 30, scaleX 0.85 to 0.6, x 200 to -200
 * - Text elements: xPercent -100 to 0, x 700 to 575 (slide in from left)
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';

interface AboutHeroOptions extends ModuleOptions {
  /** Selector for the hero container */
  heroSelector?: string;
  /** Selector for the SVG element */
  svgSelector?: string;
  /** Selector for the about content */
  contentSelector?: string;
  /** Animation duration in timeline units */
  duration?: number;
}

export class AboutHeroModule extends BaseModule {
  private hero: HTMLElement | null = null;
  private svg: SVGElement | null = null;
  private aboutContent: HTMLElement | null = null;
  private leftGroup: Element | null = null;
  private rightGroup: Element | null = null;
  private textElements: NodeListOf<SVGTextElement> | null = null;
  private isRevealed: boolean = false;
  private isMobile: boolean = false;

  // Two timelines like the reference implementation
  private groupTimeline: gsap.core.Timeline | null = null;
  private textTimeline: gsap.core.Timeline | null = null;
  private isOnAboutPage: boolean = false;

  // Configuration
  private heroSelector: string;
  private svgSelector: string;
  private contentSelector: string;
  private duration: number;

  // Wheel-driven progress
  private targetProgress: number = 0; // Start at 0 - text all the way to the right

  constructor(options: AboutHeroOptions = {}) {
    super('AboutHeroModule', { debug: true, ...options });

    this.heroSelector = options.heroSelector || '.about-hero-desktop';
    this.svgSelector = options.svgSelector || '.text-animation-svg';
    this.contentSelector = options.contentSelector || '.about-content';
    this.duration = options.duration || 2;

    // Bind methods
    this.handleWheel = this.handleWheel.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // Check if mobile
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (this.isMobile) {
      this.log('Mobile detected - about hero disabled');
      // On mobile, make sure content is visible
      const content = document.querySelector(this.contentSelector) as HTMLElement;
      if (content) {
        content.style.opacity = '1';
      }
      return;
    }

    // Skip if reduced motion preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - showing content directly');
      this.showContentImmediately();
      return;
    }

    this.setupElements();
    if (this.hero && this.svg) {
      this.setupAnimation();
      this.setupEventListeners();
    }

    this.log('About hero module initialized');
  }

  /**
   * Setup DOM element references
   */
  private setupElements(): void {
    this.hero = document.querySelector(this.heroSelector) as HTMLElement;
    this.aboutContent = document.querySelector(`.about-section ${this.contentSelector}`) as HTMLElement;

    if (!this.hero) {
      this.log('Hero element not found');
      return;
    }

    this.svg = this.hero.querySelector(this.svgSelector) as SVGElement;

    if (!this.svg) {
      this.warn('SVG element not found in hero');
      return;
    }

    this.leftGroup = this.svg.querySelector('.text-left');
    this.rightGroup = this.svg.querySelector('.text-right');
    this.textElements = this.svg.querySelectorAll('text');

    if (!this.leftGroup || !this.rightGroup) {
      this.warn('Text groups not found in SVG');
    }

    // Initially hide about content (will fade in after animation)
    if (this.aboutContent) {
      gsap.set(this.aboutContent, { opacity: 0 });
    }

    this.log('Elements cached');
  }

  /**
   * Setup animation timelines
   * Using two separate timelines like the reference implementation
   */
  private setupAnimation(): void {
    if (!this.hero || !this.svg || !this.leftGroup || !this.rightGroup || !this.textElements) {
      return;
    }

    // Timeline 1: Group skew/transform animation (like tl in reference)
    this.groupTimeline = gsap.timeline({
      paused: true,
      defaults: {
        duration: this.duration,
        ease: 'power2.inOut'
      }
    });

    this.groupTimeline.fromTo(
      [this.leftGroup, this.rightGroup],
      {
        svgOrigin: '640 500',
        skewY: (i: number) => [-30, 15][i],
        scaleX: (i: number) => [0.6, 0.85][i],
        x: 200
      },
      {
        skewY: (i: number) => [-15, 30][i],
        scaleX: (i: number) => [0.85, 0.6][i],
        x: -200
      }
    );

    // Start at 0 - text positioned all the way to the right
    this.groupTimeline.progress(0);

    // Timeline 2: Text slide-in animation (like tl2 in reference)
    this.textTimeline = gsap.timeline({ paused: true });

    this.textElements.forEach((text, i) => {
      this.textTimeline!.add(
        gsap.fromTo(
          text,
          {
            xPercent: -100,
            x: 700
          },
          {
            duration: 1,
            xPercent: 0,
            x: 575,
            ease: 'sine.inOut'
          }
        ),
        (i % 3) * 0.2
      );
    });

    // Start text timeline at 0 - text all the way to the right
    this.textTimeline.progress(0);

    this.log('Animation timelines setup complete');
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for page transitions
    this.on('PageTransitionModule:page-changed', ((event: CustomEvent) => {
      const { to, from } = event.detail || {};

      if (to === 'about') {
        this.isOnAboutPage = true;
        this.resetHero();
        // Start listening for wheel events
        window.addEventListener('wheel', this.handleWheel, { passive: false });
      } else if (from === 'about') {
        this.isOnAboutPage = false;
        // Stop listening for wheel events
        window.removeEventListener('wheel', this.handleWheel);
      }
    }) as EventListener);

    // Check if we're starting on about page
    if (window.location.hash === '#/about') {
      this.isOnAboutPage = true;
      this.resetHero();
      window.addEventListener('wheel', this.handleWheel, { passive: false });
    }
  }

  /**
   * Handle wheel events to control animation
   * Uses GSAP smooth interpolation like reference: gsap.to([tl, tl2], { progress })
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.isOnAboutPage || this.isRevealed) return;
    if (!this.groupTimeline || !this.textTimeline) return;

    // Prevent default scroll
    event.preventDefault();

    // Update target progress based on wheel delta
    // Normalize: smaller delta = smoother animation
    const delta = event.deltaY / 2000;
    this.targetProgress = Math.max(0, Math.min(1, this.targetProgress + delta));

    // Use GSAP to smoothly animate to target progress (like reference)
    gsap.to([this.groupTimeline, this.textTimeline], {
      progress: this.targetProgress,
      duration: 0.5,
      ease: 'power4',
      overwrite: true
    });

    // Check if animation is complete (scrolled to end)
    if (this.targetProgress >= 0.95) {
      this.revealContent();
    }
  }

  /**
   * Reveal the about content with fade animation
   */
  private revealContent(): void {
    if (this.isRevealed || !this.hero || !this.aboutContent) return;

    this.isRevealed = true;
    this.log('Revealing about content');

    // Stop wheel listener
    window.removeEventListener('wheel', this.handleWheel);

    // Fade out hero, fade in content
    const tl = gsap.timeline({
      onComplete: () => {
        this.hero?.classList.add('hero-revealed');
        this.dispatchEvent('revealed');
      }
    });

    // Fade out the hero
    tl.to(this.hero, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out'
    });

    // Fade in the about content
    tl.to(this.aboutContent, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out'
    }, '-=0.3');

    this.addTimeline(tl);
  }

  /**
   * Show content immediately (for reduced motion)
   */
  private showContentImmediately(): void {
    const hero = document.querySelector(this.heroSelector) as HTMLElement;
    const content = document.querySelector(`.about-section ${this.contentSelector}`) as HTMLElement;

    if (hero) {
      hero.style.display = 'none';
    }
    if (content) {
      content.style.opacity = '1';
    }
  }

  /**
   * Reset hero to initial state (for page navigation)
   */
  resetHero(): void {
    if (!this.hero || !this.svg) return;

    this.log('Resetting hero...');

    this.isRevealed = false;
    this.targetProgress = 0.5; // Reset to midpoint
    this.hero.classList.remove('hero-revealed');

    // Kill existing timelines
    if (this.groupTimeline) {
      this.groupTimeline.kill();
      this.groupTimeline = null;
    }
    if (this.textTimeline) {
      this.textTimeline.kill();
      this.textTimeline = null;
    }

    // Reset hero visibility
    gsap.set(this.hero, {
      opacity: 1,
      visibility: 'visible',
      pointerEvents: 'auto'
    });

    // Reset about content
    if (this.aboutContent) {
      gsap.set(this.aboutContent, { opacity: 0 });
    }

    // Reset SVG group transforms
    if (this.leftGroup && this.rightGroup) {
      gsap.set([this.leftGroup, this.rightGroup], {
        svgOrigin: '640 500',
        clearProps: 'skewY,scaleX,x'
      });
    }

    // Reset text elements
    if (this.textElements) {
      this.textElements.forEach((text) => {
        gsap.set(text, {
          clearProps: 'xPercent,x'
        });
      });
    }

    // Recreate the animation timelines
    this.setupAnimation();

    this.log('Hero reset complete');
  }

  /**
   * Check if hero is revealed
   */
  isHeroRevealed(): boolean {
    return this.isRevealed;
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      hasHero: !!this.hero,
      hasSvg: !!this.svg,
      isRevealed: this.isRevealed,
      isMobile: this.isMobile,
      isOnAboutPage: this.isOnAboutPage,
      targetProgress: this.targetProgress
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    window.removeEventListener('wheel', this.handleWheel);

    if (this.groupTimeline) {
      this.groupTimeline.kill();
      this.groupTimeline = null;
    }

    if (this.textTimeline) {
      this.textTimeline.kill();
      this.textTimeline = null;
    }

    this.hero = null;
    this.svg = null;
    this.aboutContent = null;
    this.leftGroup = null;
    this.rightGroup = null;
    this.textElements = null;

    await super.destroy();
  }
}
