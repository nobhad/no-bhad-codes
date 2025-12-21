/**
 * ===============================================
 * PAGE HERO MODULE
 * ===============================================
 * @file src/modules/animation/page-hero.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Unified hero text animation for virtual pages (about, contact)
 * - Uses SAME animation for all pages - consistent UX
 * - Wheel-driven animation (virtual pages have no actual scroll)
 * - Uses GSAP smooth interpolation: gsap.to([tl, tl2], { progress })
 * - When animation completes, hero fades out and page content fades in
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

interface PageHeroOptions extends ModuleOptions {
  /** Selector for hero containers (with data-hero-page attribute) */
  heroSelector?: string;
  /** Animation duration in timeline units */
  duration?: number;
}

interface HeroInstance {
  hero: HTMLElement;
  svg: SVGElement;
  leftGroup: Element;
  rightGroup: Element;
  textElements: NodeListOf<SVGTextElement>;
  content: HTMLElement | null;
  groupTimeline: gsap.core.Timeline;
  textTimeline: gsap.core.Timeline;
  isRevealed: boolean;
  targetProgress: number;
}

export class PageHeroModule extends BaseHeroAnimation {
  private heroes: Map<string, HeroInstance> = new Map();
  private activePageId: string | null = null;

  // Configuration
  private heroSelector: string;

  // Bound handlers
  private handleWheelBound: (e: WheelEvent) => void;

  constructor(options: PageHeroOptions = {}) {
    super('PageHeroModule', { duration: options.duration || 2, ...options });

    this.heroSelector = options.heroSelector || '.page-hero-desktop';
    this.handleWheelBound = this.handleWheel.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    if (this.shouldSkipAnimation()) {
      this.showAllContentImmediately();
      return;
    }

    this.setupHeroes();
    this.setupEventListeners();

    this.log(`Page hero module initialized with ${this.heroes.size} heroes`);
  }

  /**
   * Setup all hero instances on the page
   */
  private setupHeroes(): void {
    const heroElements = document.querySelectorAll(this.heroSelector);

    heroElements.forEach((heroEl) => {
      const hero = heroEl as HTMLElement;
      const pageId = hero.dataset.heroPage;

      if (!pageId) {
        this.warn('Hero element missing data-hero-page attribute');
        return;
      }

      const svg = hero.querySelector('.text-animation-svg') as SVGElement;
      if (!svg) {
        this.warn(`SVG not found in hero for page: ${pageId}`);
        return;
      }

      const leftGroup = svg.querySelector('.text-left');
      const rightGroup = svg.querySelector('.text-right');
      const textElements = svg.querySelectorAll('text');

      if (!leftGroup || !rightGroup || textElements.length === 0) {
        this.warn(`Required SVG elements not found for page: ${pageId}`);
        return;
      }

      // Find content element for this page
      const section = hero.closest('section');
      const content = section?.querySelector(`.${pageId}-content`) as HTMLElement | null;

      // Initially hide content
      if (content) {
        gsap.set(content, { opacity: 0 });
      }

      // Create timelines using base class method
      const { groupTimeline, textTimeline } = this.createTimelines(
        leftGroup,
        rightGroup,
        textElements
      );

      // Store hero instance
      this.heroes.set(pageId, {
        hero,
        svg,
        leftGroup,
        rightGroup,
        textElements,
        content,
        groupTimeline,
        textTimeline,
        isRevealed: false,
        targetProgress: 0
      });

      this.log(`Hero setup complete for page: ${pageId}`);
    });
  }


  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for page transitions
    this.on('PageTransitionModule:page-changed', ((event: CustomEvent) => {
      const { to, from } = event.detail || {};

      // If we're leaving a page with hero, stop wheel listener
      if (from && this.heroes.has(from)) {
        window.removeEventListener('wheel', this.handleWheelBound);
        this.activePageId = null;
      }

      // If we're entering a page with hero, reset instantly (no transition) and start
      if (to && this.heroes.has(to)) {
        this.activePageId = to;
        this.resetHeroInstant(to);
        window.addEventListener('wheel', this.handleWheelBound, { passive: false });
      }
    }) as EventListener);

    // Add click handlers to heroes for quick reveal (user can click to skip wheel animation)
    this.heroes.forEach((instance, pageId) => {
      instance.hero.addEventListener('click', () => {
        if (!instance.isRevealed) {
          this.log(`Hero clicked - revealing ${pageId}`);
          this.revealContent(pageId);
        }
      });
    });

    // Check if we're starting on a page with hero
    const hash = window.location.hash;
    let initialPage: string | null = null;

    if (hash === '#/about') {
      initialPage = 'about';
    } else if (hash === '#/contact') {
      initialPage = 'contact';
    }

    if (initialPage && this.heroes.has(initialPage)) {
      this.activePageId = initialPage;
      this.resetHeroInstant(initialPage);
      window.addEventListener('wheel', this.handleWheelBound, { passive: false });
    }
  }

  /**
   * Handle wheel events to control animation
   * Uses GSAP smooth interpolation
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.activePageId) return;

    const instance = this.heroes.get(this.activePageId);
    if (!instance || instance.isRevealed) return;

    // Use base class wheel handling
    const progressRef = { value: instance.targetProgress };
    this.handleWheelAnimation(
      event,
      instance.groupTimeline,
      instance.textTimeline,
      progressRef,
      () => {
        if (this.activePageId) {
          this.revealContent(this.activePageId);
        }
      }
    );

    // Update instance progress (handleWheelAnimation modifies the object)
    instance.targetProgress = progressRef.value;
  }

  /**
   * Reveal the page content with fade animation
   */
  private revealContent(pageId: string): void {
    const instance = this.heroes.get(pageId);
    if (!instance || instance.isRevealed) return;

    instance.isRevealed = true;
    this.log(`Revealing content for page: ${pageId}`);

    // Stop wheel listener
    window.removeEventListener('wheel', this.handleWheelBound);

    // Use base class reveal method
    super.revealHeroContent(
      instance.hero,
      instance.content,
      () => this.dispatchEvent('revealed', { pageId })
    );
  }

  /**
   * Reset hero to initial state (for page navigation)
   */
  resetHero(pageId: string): void {
    const instance = this.heroes.get(pageId);
    if (!instance) return;

    instance.isRevealed = false;
    instance.targetProgress = 0;

    // Use base class reset method
    this.resetHeroAnimation(
      instance.hero,
      instance.leftGroup,
      instance.rightGroup,
      instance.textElements,
      instance.content,
      instance.groupTimeline,
      instance.textTimeline,
      () => {
        const { groupTimeline, textTimeline } = this.createTimelines(
          instance.leftGroup,
          instance.rightGroup,
          instance.textElements
        );
        instance.groupTimeline = groupTimeline;
        instance.textTimeline = textTimeline;
        return { groupTimeline, textTimeline };
      }
    );
  }

  /**
   * Reset hero instantly without transition animation
   */
  private resetHeroInstant(pageId: string): void {
    const instance = this.heroes.get(pageId);
    if (!instance) return;

    instance.isRevealed = false;
    instance.targetProgress = 0;

    // Kill existing timelines
    if (instance.groupTimeline) {
      instance.groupTimeline.kill();
    }
    if (instance.textTimeline) {
      instance.textTimeline.kill();
    }

    // Reset hero visibility - show instantly without fade
    gsap.set(instance.hero, {
      opacity: 1,
      visibility: 'visible',
      pointerEvents: 'auto'
    });

    // Reset content
    if (instance.content) {
      gsap.set(instance.content, { opacity: 0 });
    }

    // Reset SVG group transforms
    if (instance.leftGroup && instance.rightGroup) {
      gsap.set([instance.leftGroup, instance.rightGroup], {
        svgOrigin: '640 500',
        clearProps: 'skewY,scaleX,x'
      });
    }

    // Reset text elements
    if (instance.textElements) {
      instance.textElements.forEach((text) => {
        gsap.set(text, {
          clearProps: 'xPercent,x'
        });
      });
    }

    // Recreate the animation timelines
    const { groupTimeline, textTimeline } = this.createTimelines(
      instance.leftGroup,
      instance.rightGroup,
      instance.textElements
    );
    instance.groupTimeline = groupTimeline;
    instance.textTimeline = textTimeline;

    this.log(`Hero reset instantly (no transition) for ${pageId}`);
  }

  /**
   * Show all content immediately (for reduced motion or mobile)
   */
  private showAllContentImmediately(): void {
    const heroElements = document.querySelectorAll(this.heroSelector);

    heroElements.forEach((heroEl) => {
      const hero = heroEl as HTMLElement;
      const pageId = hero.dataset.heroPage;

      hero.style.display = 'none';

      if (pageId) {
        const section = hero.closest('section');
        const content = section?.querySelector(`.${pageId}-content`) as HTMLElement | null;
        if (content) {
          content.style.opacity = '1';
        }
      }
    });
  }

  /**
   * Check if a specific hero is revealed
   */
  isHeroRevealed(pageId: string): boolean {
    return this.heroes.get(pageId)?.isRevealed ?? false;
  }

  /**
   * Get module status
   */
  override getStatus() {
    const heroStatuses: Record<string, { isRevealed: boolean; progress: number }> = {};
    this.heroes.forEach((instance, pageId) => {
      heroStatuses[pageId] = {
        isRevealed: instance.isRevealed,
        progress: instance.targetProgress
      };
    });

    return {
      ...super.getStatus(),
      heroCount: this.heroes.size,
      activePageId: this.activePageId,
      isMobile: this.isMobile,
      heroes: heroStatuses
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    window.removeEventListener('wheel', this.handleWheelBound);

    this.heroes.forEach((instance) => {
      instance.groupTimeline.kill();
      instance.textTimeline.kill();
    });

    this.heroes.clear();
    this.activePageId = null;

    await super.destroy();
  }
}
