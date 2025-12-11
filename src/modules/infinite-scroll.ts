/**
 * ===============================================
 * INFINITE SCROLL MODULE
 * ===============================================
 * @file src/modules/infinite-scroll.ts
 * @extends BaseModule
 *
 * Creates infinite scrolling by showing a "scroll to continue" indicator
 * at the end, which smoothly transitions back to start.
 *
 * IMPORTANT: This module is designed to work WITH ScrollTrigger-based
 * animations (like TextAnimationModule) by:
 * 1. Waiting for all ScrollTrigger animations to complete
 * 2. Only triggering loop when user explicitly continues past the end
 * 3. Using a fade transition to hide the scroll jump
 *
 * DESKTOP ONLY - disabled on mobile for better UX.
 */

import { BaseModule } from './base';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../types/modules';

interface InfiniteScrollOptions extends ModuleOptions {
  /** Selector for the scroll container (default: 'main') */
  containerSelector?: string;
  /** Selector for the last section (trigger point) */
  lastSectionSelector?: string;
  /** Enable/disable infinite scroll (default: true) */
  enabled?: boolean;
}

export class InfiniteScrollModule extends BaseModule {
  private container: HTMLElement | null = null;
  private lastSection: HTMLElement | null = null;
  private topSpacer: HTMLElement | null = null;
  private isEnabled = true;
  private isTransitioning = false;
  private hasTriggeredLoop = false;
  private lastLogTime = 0;

  // Configuration
  private containerSelector: string;
  private lastSectionSelector: string;

  constructor(options: InfiniteScrollOptions = {}) {
    super('InfiniteScrollModule', { debug: true, ...options });

    this.containerSelector = options.containerSelector || 'main';
    this.lastSectionSelector = options.lastSectionSelector || '.contact-section';
    this.isEnabled = options.enabled !== false;
  }

  override async init(): Promise<void> {
    await super.init();

    // MOBILE: Disable infinite scroll completely
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      this.log('Mobile detected - infinite scroll disabled');
      return;
    }

    // Skip if reduced motion is preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - disabling infinite scroll');
      return;
    }

    if (!this.isEnabled) {
      this.log('Infinite scroll disabled via options');
      return;
    }

    this.setupInfiniteScroll();
  }

  /**
   * Set up infinite scroll behavior
   */
  private setupInfiniteScroll(): void {
    // Get scroll container
    this.container = document.querySelector(this.containerSelector) as HTMLElement;
    if (!this.container) {
      this.warn(`Container "${this.containerSelector}" not found`);
      return;
    }

    // Get last section
    this.lastSection = document.querySelector(this.lastSectionSelector) as HTMLElement;
    if (!this.lastSection) {
      this.warn(`Last section "${this.lastSectionSelector}" not found`);
      return;
    }

    // Get top spacer element
    this.topSpacer = document.getElementById('loop-spacer') as HTMLElement;
    if (!this.topSpacer) {
      this.warn('Top spacer not found');
    }

    // Log initial dimensions
    this.log(`Container dimensions: scrollHeight=${this.container.scrollHeight}, clientHeight=${this.container.clientHeight}, scrollTop=${this.container.scrollTop}`);

    // Add scroll listener to detect when we hit the bottom
    this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });

    this.log('Infinite scroll initialized - scroll listener attached');
  }

  /**
   * Handle scroll events to detect bottom
   */
  private handleScroll(): void {
    if (!this.container || this.isTransitioning) return;

    const scrollTop = this.container.scrollTop;
    const scrollHeight = this.container.scrollHeight;
    const clientHeight = this.container.clientHeight;

    // Check if we're at the bottom (within 50px threshold)
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Throttled debug logging (every 500ms)
    const now = Date.now();
    if (now - this.lastLogTime > 500) {
      this.lastLogTime = now;
      this.log(`Scroll: distFromBottom=${Math.round(distanceFromBottom)}, scrollTop=${Math.round(scrollTop)}, scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`);
    }

    if (distanceFromBottom <= 50 && !this.hasTriggeredLoop) {
      this.log(`TRIGGERING LOOP: At bottom! distFromBottom=${distanceFromBottom}`);
      this.hasTriggeredLoop = true;
      this.loopToStart();
    } else if (distanceFromBottom > 200) {
      // Reset when scrolled back up
      this.hasTriggeredLoop = false;
    }
  }

  /**
   * Loop back to start
   * 1. Activate top spacer (adds 100vh before business card)
   * 2. Jump to top (user sees spacer, card is below viewport)
   * 3. User scrolls naturally, card comes up from below
   */
  private loopToStart(): void {
    if (!this.container || this.isTransitioning) return;

    this.isTransitioning = true;
    this.log('Looping to start...');

    // Activate top spacer - this adds 100vh BEFORE business card section
    if (this.topSpacer) {
      this.topSpacer.classList.add('active');
      this.log('Top spacer activated');
    }

    // Jump to top of scroll container
    // User now sees the spacer (empty), business card is 100vh below
    this.container.scrollTop = 0;

    this.log('Scrolled to top - spacer visible, card below viewport');

    // Refresh ScrollTrigger after layout change
    setTimeout(() => {
      ScrollTrigger.refresh();
      this.log('ScrollTrigger refreshed');

      this.isTransitioning = false;
      this.hasTriggeredLoop = false;
    }, 100);
  }

  /**
   * Enable infinite scroll
   */
  enable(): void {
    this.isEnabled = true;
    this.log('Infinite scroll enabled');
  }

  /**
   * Disable infinite scroll
   */
  disable(): void {
    this.isEnabled = false;
    this.log('Infinite scroll disabled');
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      enabled: this.isEnabled,
      isTransitioning: this.isTransitioning
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    this.container = null;
    this.lastSection = null;

    await super.destroy();
  }
}
