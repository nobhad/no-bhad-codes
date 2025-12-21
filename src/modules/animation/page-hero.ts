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

import { BaseModule } from '../core/base';
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

export class PageHeroModule extends BaseModule {
  private heroes: Map<string, HeroInstance> = new Map();
  private activePageId: string | null = null;
  private isMobile: boolean = false;

  // Configuration
  private heroSelector: string;
  private duration: number;

  // Bound handlers
  private handleWheelBound: (e: WheelEvent) => void;

  constructor(options: PageHeroOptions = {}) {
    super('PageHeroModule', { debug: true, ...options });

    this.heroSelector = options.heroSelector || '.page-hero-desktop';
    this.duration = options.duration || 2;

    this.handleWheelBound = this.handleWheel.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // Check if mobile
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (this.isMobile) {
      this.log('Mobile detected - page hero disabled');
      this.showAllContentImmediately();
      return;
    }

    // Skip if reduced motion preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - showing content directly');
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

      // Create timelines
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
   * Create animation timelines for a hero
   * Using two separate timelines like the reference implementation
   */
  private createTimelines(
    leftGroup: Element,
    rightGroup: Element,
    textElements: NodeListOf<SVGTextElement>
  ): { groupTimeline: gsap.core.Timeline; textTimeline: gsap.core.Timeline } {
    // Timeline 1: Group skew/transform animation
    const groupTimeline = gsap.timeline({
      paused: true,
      defaults: {
        duration: this.duration,
        ease: 'power2.inOut'
      }
    });

    groupTimeline.fromTo(
      [leftGroup, rightGroup],
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
    groupTimeline.progress(0);

    // Timeline 2: Text slide-in animation
    const textTimeline = gsap.timeline({ paused: true });

    textElements.forEach((text, i) => {
      textTimeline.add(
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

    // Start text timeline at 0
    textTimeline.progress(0);

    return { groupTimeline, textTimeline };
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

      // If we're entering a page with hero, reset and start
      if (to && this.heroes.has(to)) {
        this.activePageId = to;
        this.resetHero(to);
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
      this.resetHero(initialPage);
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

    // Prevent default scroll
    event.preventDefault();

    // Update target progress based on wheel delta
    const delta = event.deltaY / 2000;
    instance.targetProgress = Math.max(0, Math.min(1, instance.targetProgress + delta));

    // Use GSAP to smoothly animate to target progress
    gsap.to([instance.groupTimeline, instance.textTimeline], {
      progress: instance.targetProgress,
      duration: 0.5,
      ease: 'power4',
      overwrite: 'auto'
    });

    // Check if animation is complete (scrolled to end)
    if (instance.targetProgress >= 0.95) {
      this.revealContent(this.activePageId);
    }
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

    // Fade out hero, fade in content
    const tl = gsap.timeline({
      onComplete: () => {
        instance.hero.classList.add('hero-revealed');
        this.dispatchEvent('revealed', { pageId });
      }
    });

    // Fade out the hero
    tl.to(instance.hero, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out'
    });

    // Fade in the content
    if (instance.content) {
      tl.to(instance.content, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out'
      }, '-=0.3');
    }

    this.addTimeline(tl);
  }

  /**
   * Reset hero to initial state (for page navigation)
   */
  resetHero(pageId: string): void {
    const instance = this.heroes.get(pageId);
    if (!instance) return;

    this.log(`Resetting hero for page: ${pageId}`);

    instance.isRevealed = false;
    instance.targetProgress = 0;
    instance.hero.classList.remove('hero-revealed');

    // Kill and recreate timelines
    instance.groupTimeline.kill();
    instance.textTimeline.kill();

    // Reset hero visibility
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
    gsap.set([instance.leftGroup, instance.rightGroup], {
      svgOrigin: '640 500',
      clearProps: 'skewY,scaleX,x'
    });

    // Reset text elements
    instance.textElements.forEach((text) => {
      gsap.set(text, {
        clearProps: 'xPercent,x'
      });
    });

    // Recreate the animation timelines
    const { groupTimeline, textTimeline } = this.createTimelines(
      instance.leftGroup,
      instance.rightGroup,
      instance.textElements
    );

    instance.groupTimeline = groupTimeline;
    instance.textTimeline = textTimeline;

    this.log(`Hero reset complete for page: ${pageId}`);
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
