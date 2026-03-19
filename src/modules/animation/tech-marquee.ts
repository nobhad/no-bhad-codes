/**
 * ===============================================
 * TECH STACK MARQUEE MODULE
 * ===============================================
 * @file src/modules/animation/tech-marquee.ts
 * @extends BaseModule
 *
 * Infinite scrolling marquee for the tech stack section.
 * Uses GSAP for smooth, performant animation.
 * Duplicates items at init for seamless looping.
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { ANIMATION_SEQUENCES, ANIMATION_EASING } from '../../config/animation-constants';

const MARQUEE_SELECTOR = '.tech-marquee';
const TRACK_SELECTOR = '.tech-marquee-track';
const ITEM_SELECTOR = '.tech-marquee-item';

export class TechMarqueeModule extends BaseModule {
  private marquee: HTMLElement | null = null;
  private track: HTMLElement | null = null;
  private tween: gsap.core.Tween | null = null;

  constructor(options: ModuleOptions = {}) {
    super('TechMarqueeModule', options);
  }

  override async init(): Promise<void> {
    await super.init();

    this.marquee = document.querySelector(MARQUEE_SELECTOR);
    this.track = document.querySelector(TRACK_SELECTOR);

    if (!this.marquee || !this.track) {
      this.log('Marquee elements not found, skipping');
      return;
    }

    this.duplicateItems();
    this.startAnimation();

    this.log('Tech marquee initialized');
  }

  /**
   * Duplicate all marquee items to create a seamless infinite loop.
   * The track content is doubled so that when GSAP translates by -50%,
   * it loops back to the start without a visible seam.
   */
  private duplicateItems(): void {
    if (!this.track) return;

    const items = this.track.querySelectorAll(ITEM_SELECTOR);
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      fragment.appendChild(item.cloneNode(true));
    });

    this.track.appendChild(fragment);
  }

  /**
   * Start the infinite scroll animation using GSAP.
   * Measures the width of the original items (before duplication)
   * and scrolls by that exact pixel amount for a seamless loop.
   */
  private startAnimation(): void {
    if (!this.track) return;

    if (this.reducedMotion) {
      this.log('Reduced motion preferred, skipping animation');
      return;
    }

    const { DURATION } = ANIMATION_SEQUENCES.TECH_MARQUEE;

    this.tween = gsap.to(this.track, {
      xPercent: -50,
      duration: DURATION,
      ease: ANIMATION_EASING.LINEAR,
      repeat: -1
    });

    this.timelines.add(this.tween);
  }

  override getStatus() {
    return {
      ...super.getStatus(),
      hasMarquee: !!this.marquee,
      hasTrack: !!this.track,
      isAnimating: !!this.tween && this.tween.isActive()
    };
  }

  override async destroy(): Promise<void> {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }

    this.marquee = null;
    this.track = null;

    await super.destroy();
  }
}
