/**
 * ===============================================
 * BASE HERO ANIMATION
 * ===============================================
 * @file src/modules/animation/base-hero-animation.ts
 *
 * Shared base class for hero text animations.
 * Extracted duplicate logic from page-hero.ts and about-hero.ts (~400 lines).
 *
 * ANIMATION (reference: codepen split-text effect):
 * - Left group: skewY -30 to -15, scaleX 0.6 to 0.85, x 200 to -200
 * - Right group: skewY 15 to 30, scaleX 0.85 to 0.6, x 200 to -200
 * - Text elements: xPercent -100 to 0, x 700 to 575 (slide in from left)
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { getDebugMode } from '../../core/env';

export interface HeroTimelines {
  groupTimeline: gsap.core.Timeline;
  textTimeline: gsap.core.Timeline;
}

export interface HeroElements {
  hero: HTMLElement;
  svg: SVGElement;
  leftGroup: Element;
  rightGroup: Element;
  textElements: NodeListOf<SVGTextElement>;
  content: HTMLElement | null;
}

/**
 * Base class for hero animations with shared timeline creation and wheel handling
 */
export abstract class BaseHeroAnimation extends BaseModule {
  protected isMobile: boolean = false;
  protected duration: number;

  constructor(name: string, options: ModuleOptions & { duration?: number } = {}) {
    super(name, { debug: getDebugMode(), ...options });
    this.duration = options.duration || 2;
  }

  /**
   * Check if mobile or reduced motion - show content immediately
   */
  protected shouldSkipAnimation(): boolean {
    this.isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (this.isMobile) {
      this.log('Mobile detected - hero animation disabled');
      return true;
    }

    if (this.reducedMotion) {
      this.log('Reduced motion preferred - showing content directly');
      return true;
    }

    return false;
  }

  /**
   * Create animation timelines for a hero
   * Using two separate timelines like the reference implementation
   * This is the core shared animation logic (~100 lines)
   */
  protected createTimelines(
    leftGroup: Element,
    rightGroup: Element,
    textElements: NodeListOf<SVGTextElement>
  ): HeroTimelines {
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
   * Handle wheel events to control animation
   * Uses GSAP smooth interpolation: gsap.to([tl, tl2], { progress })
   * Shared wheel handling logic (~30 lines)
   */
  protected handleWheelAnimation(
    event: WheelEvent,
    groupTimeline: gsap.core.Timeline | null,
    textTimeline: gsap.core.Timeline | null,
    targetProgress: { value: number },
    onComplete?: () => void
  ): void {
    if (!groupTimeline || !textTimeline) return;

    // Prevent default scroll
    event.preventDefault();

    // Update target progress based on wheel delta
    const delta = event.deltaY / 2000;
    targetProgress.value = Math.max(0, Math.min(1, targetProgress.value + delta));

    // Use GSAP to smoothly animate to target progress
    gsap.to([groupTimeline, textTimeline], {
      progress: targetProgress.value,
      duration: 0.5,
      ease: 'power4',
      overwrite: 'auto'
    });

    // Check if animation is complete (scrolled to end)
    if (targetProgress.value >= 0.95 && onComplete) {
      onComplete();
    }
  }

  /**
   * Reveal the page content with fade animation
   * Shared reveal logic (~30 lines)
   */
  protected revealHeroContent(
    hero: HTMLElement,
    content: HTMLElement | null,
    onComplete?: () => void
  ): void {
    this.log('Revealing content');

    // Fade out hero, fade in content
    const tl = gsap.timeline({
      onComplete: () => {
        hero.classList.add('hero-revealed');
        if (onComplete) {
          onComplete();
        }
      }
    });

    // Fade out the hero
    tl.to(hero, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out'
    });

    // Fade in the content
    if (content) {
      tl.to(content, {
        opacity: 1,
        duration: 0.5,
        ease: 'power2.out'
      }, '-=0.3');
    }

    this.addTimeline(tl);
  }

  /**
   * Reset hero to initial state (for page navigation)
   * Shared reset logic (~60 lines)
   */
  protected resetHeroAnimation(
    hero: HTMLElement,
    leftGroup: Element | null,
    rightGroup: Element | null,
    textElements: NodeListOf<SVGTextElement> | null,
    content: HTMLElement | null,
    groupTimeline: gsap.core.Timeline | null,
    textTimeline: gsap.core.Timeline | null,
    recreateTimelines: () => HeroTimelines
  ): void {
    this.log('Resetting hero...');

    hero.classList.remove('hero-revealed');

    // Kill existing timelines
    if (groupTimeline) {
      groupTimeline.kill();
    }
    if (textTimeline) {
      textTimeline.kill();
    }

    // Reset hero visibility - keep hidden initially
    gsap.set(hero, {
      opacity: 0,
      visibility: 'visible',
      pointerEvents: 'auto'
    });

    // Fade in hero after a small delay to ensure page transition completes
    gsap.to(hero, {
      opacity: 1,
      duration: 0.3,
      delay: 0.1,
      ease: 'power2.out'
    });

    // Reset content
    if (content) {
      gsap.set(content, { opacity: 0 });
    }

    // Reset SVG group transforms
    if (leftGroup && rightGroup) {
      gsap.set([leftGroup, rightGroup], {
        svgOrigin: '640 500',
        clearProps: 'skewY,scaleX,x'
      });
    }

    // Reset text elements
    if (textElements) {
      textElements.forEach((text) => {
        gsap.set(text, {
          clearProps: 'xPercent,x'
        });
      });
    }

    // Recreate the animation timelines
    recreateTimelines();

    this.log('Hero reset complete');
  }

  /**
   * Show content immediately (for reduced motion or mobile)
   * Note: Don't set opacity here - let PageTransitionModule handle blur animation
   */
  protected showContentImmediately(
    heroSelector: string,
    _contentSelector: string | ((hero: HTMLElement) => HTMLElement | null)
  ): void {
    const hero = document.querySelector(heroSelector) as HTMLElement;
    if (!hero) return;

    // Hide hero on mobile - content will be animated by PageTransitionModule
    hero.style.display = 'none';
  }
}

