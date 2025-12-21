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

import { BaseHeroAnimation } from './base-hero-animation';
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

export class AboutHeroModule extends BaseHeroAnimation {
  private hero: HTMLElement | null = null;
  private svg: SVGElement | null = null;
  private aboutContent: HTMLElement | null = null;
  private leftGroup: Element | null = null;
  private rightGroup: Element | null = null;
  private textElements: NodeListOf<SVGTextElement> | null = null;
  private isRevealed: boolean = false;

  // Two timelines like the reference implementation
  private groupTimeline: gsap.core.Timeline | null = null;
  private textTimeline: gsap.core.Timeline | null = null;
  private isOnAboutPage: boolean = false;

  // Configuration
  private heroSelector: string;
  private svgSelector: string;
  private contentSelector: string;

  // Wheel-driven progress
  private targetProgress: number = 0; // Start at 0 - text all the way to the right

  constructor(options: AboutHeroOptions = {}) {
    super('AboutHeroModule', { duration: options.duration || 2, ...options });

    this.heroSelector = options.heroSelector || '.about-hero-desktop';
    this.svgSelector = options.svgSelector || '.text-animation-svg';
    this.contentSelector = options.contentSelector || '.about-content';

    // Bind methods
    this.handleWheel = this.handleWheel.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    if (this.shouldSkipAnimation()) {
      // On mobile, make sure content is visible
      const content = document.querySelector(`.about-section ${this.contentSelector}`) as HTMLElement;
      if (content) {
        content.style.opacity = '1';
      }
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

    // Use base class method to create timelines
    const { groupTimeline, textTimeline } = this.createTimelines(
      this.leftGroup,
      this.rightGroup,
      this.textElements
    );

    this.groupTimeline = groupTimeline;
    this.textTimeline = textTimeline;

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

    // Use base class wheel handling
    const progressRef = { value: this.targetProgress };
    this.handleWheelAnimation(
      event,
      this.groupTimeline,
      this.textTimeline,
      progressRef,
      () => this.revealContent()
    );

    // Update progress (handleWheelAnimation modifies the object)
    this.targetProgress = progressRef.value;
  }

  /**
   * Reveal the about content with fade animation
   */
  private revealContent(): void {
    if (this.isRevealed || !this.hero || !this.aboutContent) return;

    this.isRevealed = true;

    // Stop wheel listener
    window.removeEventListener('wheel', this.handleWheel);

    // Use base class reveal method
    super.revealHeroContent(
      this.hero,
      this.aboutContent,
      () => {
        this.hero?.classList.add('hero-revealed');
        this.dispatchEvent('revealed');
      }
    );
  }


  /**
   * Reset hero to initial state (for page navigation)
   */
  resetHero(): void {
    if (!this.hero || !this.svg) return;

    this.isRevealed = false;
    this.targetProgress = 0; // Reset to start

    // Use base class reset method
    this.resetHeroAnimation(
      this.hero,
      this.leftGroup,
      this.rightGroup,
      this.textElements,
      this.aboutContent,
      this.groupTimeline,
      this.textTimeline,
      () => {
        if (!this.leftGroup || !this.rightGroup || !this.textElements) {
          return { groupTimeline: this.groupTimeline!, textTimeline: this.textTimeline! };
        }
        const { groupTimeline, textTimeline } = this.createTimelines(
          this.leftGroup!,
          this.rightGroup!,
          this.textElements!
        );
        this.groupTimeline = groupTimeline;
        this.textTimeline = textTimeline;
        return { groupTimeline, textTimeline };
      }
    );
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
