/**
 * ===============================================
 * SCROLL SNAP MODULE
 * ===============================================
 * @file src/modules/scroll-snap.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Uses GSAP ScrollTrigger for smooth section snapping
 * - Snaps to closest section when scrolling stops
 * - DESKTOP ONLY - completely disabled on mobile for free scrolling
 * - Respects reduced motion preferences
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import type { ModuleOptions } from '../types/modules';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

interface ScrollSnapOptions extends ModuleOptions {
  /** Selector for the scroll container (default: 'main') */
  containerSelector?: string;
  /** Selector for sections to snap to */
  sectionSelector?: string;
  /** Duration of snap animation in seconds */
  snapDuration?: number;
  /** Easing function for snap animation */
  snapEase?: string;
  /** Delay before snapping after scroll stops (ms) */
  snapDelay?: number;
}

export class ScrollSnapModule extends BaseModule {
  private container: HTMLElement | null = null;
  private sections: HTMLElement[] = [];
  private scrollTriggers: ScrollTrigger[] = [];
  private snapTimeout: ReturnType<typeof setTimeout> | null = null;
  private isSnapping = false;
  private lastScrollTop = 0;
  private scrollHandler: (() => void) | null = null;
  private useWindowScroll = false; // True when scrolling happens on window instead of container

  // Layout dimensions (read from CSS variables)
  private headerHeight = 60;
  private footerHeight = 40;

  // Configuration
  private containerSelector: string;
  private sectionSelector: string;
  private snapDuration: number;
  private snapEase: string;
  private snapDelay: number;

  constructor(options: ScrollSnapOptions = {}) {
    super('ScrollSnapModule', { debug: true, ...options });

    // Set configuration with defaults (desktop only - mobile is disabled in init())
    this.containerSelector = options.containerSelector || 'main';
    this.sectionSelector = options.sectionSelector || '.business-card-section, .about-section, .contact-section';
    this.snapDuration = options.snapDuration || 0.6;
    this.snapEase = options.snapEase || 'power2.inOut';
    this.snapDelay = options.snapDelay || 150;

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.handleScrollEnd = this.handleScrollEnd.bind(this);
    this.snapToClosestSection = this.snapToClosestSection.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  override async init(): Promise<void> {
    await super.init();

    // STACKED/MOBILE: Disable scroll snap completely - free scrolling on stacked/mobile layouts
    // Use 1300px to match CSS stacked layout breakpoint
    const isStackedOrMobile = window.matchMedia('(max-width: 1300px)').matches;
    if (isStackedOrMobile) {
      this.log('Stacked/mobile layout detected - scroll snap disabled');
      return;
    }

    // Skip if reduced motion is preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - disabling scroll snap');
      return;
    }

    this.setupScrollSnap();
  }

  /**
   * Set up the scroll snap behavior
   */
  private setupScrollSnap(): void {
    // Get scroll container
    this.container = document.querySelector(this.containerSelector) as HTMLElement;
    if (!this.container) {
      this.warn(`Container "${this.containerSelector}" not found`);
      return;
    }

    // Read header/footer heights from CSS variables
    const rootStyles = window.getComputedStyle(document.documentElement);
    const headerVar = rootStyles.getPropertyValue('--header-height').trim();
    const footerVar = rootStyles.getPropertyValue('--footer-height').trim();

    this.headerHeight = parseInt(headerVar, 10) || 60;
    this.footerHeight = parseInt(footerVar, 10) || 40;
    this.log(`Layout dimensions: header=${this.headerHeight}px, footer=${this.footerHeight}px`);

    // Get all sections
    this.sections = Array.from(
      document.querySelectorAll(this.sectionSelector)
    ) as HTMLElement[];

    if (this.sections.length === 0) {
      this.warn('No sections found for scroll snap');
      return;
    }

    this.log(`Found ${this.sections.length} sections for scroll snap`);

    // On desktop, main has position: fixed with overflow-y: auto
    // Always use container scroll on desktop - don't rely on scrollHeight check
    // which can fail during intro animation when content is hidden
    const containerStyle = window.getComputedStyle(this.container);
    const isContainerFixed = containerStyle.position === 'fixed';
    const hasOverflowScroll =
      containerStyle.overflowY === 'auto' || containerStyle.overflowY === 'scroll';

    // Desktop (fixed container with overflow scroll) = use container scroll
    // Otherwise (static/relative with overflow visible) = use window scroll
    this.useWindowScroll = !(isContainerFixed && hasOverflowScroll);
    this.log(`Using ${this.useWindowScroll ? 'window' : 'container'} scroll (container position: ${containerStyle.position}, overflow: ${containerStyle.overflowY})`);

    // Set up scroll listener
    this.scrollHandler = this.handleScroll;
    if (this.useWindowScroll) {
      window.addEventListener('scroll', this.scrollHandler, { passive: true });
    } else {
      this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    // Handle window resize
    window.addEventListener('resize', this.handleResize);

    // Wait for intro animation to complete, then refresh ScrollTrigger
    // This ensures accurate measurements after all content is visible
    this.waitForIntroComplete();

    // Set up ScrollTrigger for each section
    this.sections.forEach((section, index) => {
      const trigger = ScrollTrigger.create({
        trigger: section,
        scroller: this.useWindowScroll ? undefined : this.container,
        start: 'top center',
        end: 'bottom center',
        onEnter: () => this.log(`Entered section ${index}`),
        onLeave: () => this.log(`Left section ${index}`)
      });
      this.scrollTriggers.push(trigger);
    });

    this.log('Scroll snap initialized');
  }

  /**
   * Handle scroll events
   */
  private handleScroll(): void {
    if (this.isSnapping) return;

    // Clear existing timeout
    if (this.snapTimeout) {
      clearTimeout(this.snapTimeout);
    }

    // Set timeout to detect scroll end
    this.snapTimeout = setTimeout(this.handleScrollEnd, this.snapDelay);
  }

  /**
   * Handle scroll end - trigger snap
   */
  private handleScrollEnd(): void {
    if (this.isSnapping || !this.container) return;

    const currentScrollTop = this.useWindowScroll
      ? window.pageYOffset || document.documentElement.scrollTop
      : this.container.scrollTop;

    // Only snap if we've actually scrolled
    if (Math.abs(currentScrollTop - this.lastScrollTop) < 5) {
      return;
    }

    // Check if we're mostly IN the loop-trigger-zone - let infinite scroll handle it
    // Only skip snapping when loop-trigger-zone center is visible in viewport
    const loopTriggerZone = document.querySelector('.loop-trigger-zone');
    if (loopTriggerZone) {
      const zoneRect = loopTriggerZone.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Only skip snap if the loop-trigger-zone center is visible in viewport
      const zoneCenter = zoneRect.top + zoneRect.height / 2;
      if (zoneCenter > 0 && zoneCenter < viewportHeight) {
        this.log('In loop-trigger-zone, skipping snap to let infinite scroll work');
        this.lastScrollTop = currentScrollTop;
        return;
      }
    }

    this.lastScrollTop = currentScrollTop;
    this.snapToClosestSection();
  }

  /**
   * Get the effective viewport height (accounting for header/footer)
   */
  private getEffectiveViewportHeight(): number {
    if (this.useWindowScroll) {
      // For window scroll (mobile), account for header
      // Footer scrolls with content on mobile, so only subtract header
      return window.innerHeight - this.headerHeight;
    }
    // For container scroll (desktop), the container is already positioned between header/footer
    return this.container?.getBoundingClientRect().height || window.innerHeight;
  }

  /**
   * Get the viewport center Y position (accounting for header offset)
   */
  private getViewportCenterY(): number {
    const effectiveHeight = this.getEffectiveViewportHeight();
    if (this.useWindowScroll) {
      // For window scroll, center is relative to the area below the header
      return this.headerHeight + effectiveHeight / 2;
    }
    // For container scroll, center is just half the container height
    return effectiveHeight / 2;
  }

  /**
   * Find and snap to the closest section
   */
  private snapToClosestSection(): void {
    if (!this.container || this.sections.length === 0) return;

    // Get viewport dimensions accounting for header/footer
    const effectiveHeight = this.getEffectiveViewportHeight();
    const viewportCenterY = this.getViewportCenterY();

    let closestSection: HTMLElement | null = null;
    let closestDistance = Infinity;

    this.sections.forEach((section) => {
      const sectionRect = section.getBoundingClientRect();
      // Calculate distance from section center to viewport center
      const sectionCenter = sectionRect.top + sectionRect.height / 2;
      const distance = Math.abs(sectionCenter - viewportCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSection = section;
      }
    });

    if (!closestSection) return;

    // Calculate target scroll position to center the section
    const targetSection = closestSection as HTMLElement;
    const sectionRect = targetSection.getBoundingClientRect();

    let targetScroll: number;
    let currentScroll: number;

    if (this.useWindowScroll) {
      currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      // sectionRect.top is relative to viewport, add current scroll to get absolute position
      const sectionAbsoluteTop = sectionRect.top + currentScroll;
      // Center section within the effective viewport (below header)
      targetScroll = sectionAbsoluteTop - this.headerHeight - (effectiveHeight - sectionRect.height) / 2;
    } else {
      currentScroll = this.container.scrollTop;
      const containerRect = this.container.getBoundingClientRect();
      const sectionTop = sectionRect.top - containerRect.top + currentScroll;
      targetScroll = sectionTop - (effectiveHeight - sectionRect.height) / 2;
    }

    // Don't snap if we're already very close
    if (Math.abs(currentScroll - targetScroll) < 10) {
      return;
    }

    this.log(`Snapping to section at scroll position ${targetScroll}`);
    this.isSnapping = true;

    // Animate scroll with GSAP
    if (this.useWindowScroll) {
      gsap.to(window, {
        scrollTo: { y: targetScroll, autoKill: false },
        duration: this.snapDuration,
        ease: this.snapEase,
        onComplete: () => {
          this.isSnapping = false;
          this.lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
          this.log('Snap complete');
        }
      });
    } else {
      gsap.to(this.container, {
        scrollTop: targetScroll,
        duration: this.snapDuration,
        ease: this.snapEase,
        onComplete: () => {
          this.isSnapping = false;
          this.lastScrollTop = this.container?.scrollTop || 0;
          this.log('Snap complete');
        }
      });
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    // Refresh ScrollTrigger on resize
    ScrollTrigger.refresh();
  }

  /**
   * Wait for intro animation to complete, then refresh ScrollTrigger
   * This ensures accurate measurements after all content is visible
   */
  private waitForIntroComplete(): void {
    const html = document.documentElement;

    // If intro is already complete or not running, refresh immediately
    if (html.classList.contains('intro-complete') || html.classList.contains('intro-finished')) {
      this.log('Intro already complete, refreshing ScrollTrigger');
      setTimeout(() => ScrollTrigger.refresh(), 100);
      return;
    }

    // If intro-loading is not present, intro is not running
    if (!html.classList.contains('intro-loading')) {
      this.log('No intro animation, refreshing ScrollTrigger');
      setTimeout(() => ScrollTrigger.refresh(), 100);
      return;
    }

    // Set up observer to watch for intro-complete class
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (html.classList.contains('intro-complete') || html.classList.contains('intro-finished')) {
            observer.disconnect();
            this.log('Intro animation complete, refreshing ScrollTrigger');
            // Small delay to ensure all animations have settled
            setTimeout(() => ScrollTrigger.refresh(), 200);
            return;
          }
        }
      }
    });

    observer.observe(html, { attributes: true });

    // Timeout fallback - refresh after 10 seconds regardless
    setTimeout(() => {
      observer.disconnect();
      this.log('Intro timeout reached, refreshing ScrollTrigger');
      ScrollTrigger.refresh();
    }, 10000);
  }

  /**
   * Clean up scroll snap behavior
   */
  private cleanupScrollSnap(): void {
    if (this.snapTimeout) {
      clearTimeout(this.snapTimeout);
      this.snapTimeout = null;
    }

    if (this.scrollHandler) {
      if (this.useWindowScroll) {
        window.removeEventListener('scroll', this.scrollHandler);
      } else if (this.container) {
        this.container.removeEventListener('scroll', this.scrollHandler);
      }
      this.scrollHandler = null;
    }

    // Kill all ScrollTriggers
    this.scrollTriggers.forEach(trigger => trigger.kill());
    this.scrollTriggers = [];
  }

  /**
   * Scroll to a specific section by index
   */
  scrollToSection(index: number): void {
    if (index < 0 || index >= this.sections.length) {
      this.warn(`Invalid section index: ${index}`);
      return;
    }

    const section = this.sections[index];
    if (!section || !this.container) return;

    const sectionRect = section.getBoundingClientRect();
    const effectiveHeight = this.getEffectiveViewportHeight();

    let targetScroll: number;

    if (this.useWindowScroll) {
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      const sectionAbsoluteTop = sectionRect.top + currentScroll;
      // Center section within the effective viewport (below header)
      targetScroll = sectionAbsoluteTop - this.headerHeight - (effectiveHeight - sectionRect.height) / 2;
    } else {
      const containerRect = this.container.getBoundingClientRect();
      const containerScrollTop = this.container.scrollTop;
      const sectionTop = sectionRect.top - containerRect.top + containerScrollTop;
      targetScroll = sectionTop - (effectiveHeight - sectionRect.height) / 2;
    }

    this.isSnapping = true;

    if (this.useWindowScroll) {
      gsap.to(window, {
        scrollTo: { y: targetScroll, autoKill: false },
        duration: this.snapDuration,
        ease: this.snapEase,
        onComplete: () => {
          this.isSnapping = false;
          this.lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        }
      });
    } else {
      gsap.to(this.container, {
        scrollTop: targetScroll,
        duration: this.snapDuration,
        ease: this.snapEase,
        onComplete: () => {
          this.isSnapping = false;
          this.lastScrollTop = this.container?.scrollTop || 0;
        }
      });
    }
  }

  /**
   * Get current section index
   */
  getCurrentSectionIndex(): number {
    if (!this.container || this.sections.length === 0) return -1;

    const viewportCenterY = this.getViewportCenterY();

    let closestIndex = 0;
    let closestDistance = Infinity;

    this.sections.forEach((section, index) => {
      const sectionRect = section.getBoundingClientRect();
      const sectionCenter = sectionRect.top + sectionRect.height / 2;
      const distance = Math.abs(sectionCenter - viewportCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      sectionCount: this.sections.length,
      currentSection: this.getCurrentSectionIndex(),
      isSnapping: this.isSnapping
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    this.cleanupScrollSnap();

    window.removeEventListener('resize', this.handleResize);

    this.container = null;
    this.sections = [];

    await super.destroy();
  }
}
