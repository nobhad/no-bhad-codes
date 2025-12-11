/**
 * ===============================================
 * INFINITE SCROLL MODULE
 * ===============================================
 * @file src/modules/infinite-scroll.ts
 * @extends BaseModule
 *
 * Creates seamless infinite scrolling by cloning sections
 * and repositioning scroll when boundaries are reached.
 * DESKTOP ONLY - disabled on mobile for better UX.
 */

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../types/modules';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

interface InfiniteScrollOptions extends ModuleOptions {
  /** Selector for the scroll container (default: 'main') */
  containerSelector?: string;
  /** Selector for sections to include in infinite scroll */
  sectionSelector?: string;
  /** Enable/disable infinite scroll (default: true) */
  enabled?: boolean;
}

export class InfiniteScrollModule extends BaseModule {
  private container: HTMLElement | null = null;
  private sections: HTMLElement[] = [];
  private clonedSections: HTMLElement[] = [];
  private isEnabled = true;
  private scrollHandler: (() => void) | null = null;
  private isRepositioning = false;

  // Layout dimensions
  private headerHeight = 60;
  private footerHeight = 40;

  // Configuration
  private containerSelector: string;
  private sectionSelector: string;

  constructor(options: InfiniteScrollOptions = {}) {
    super('InfiniteScrollModule', { debug: true, ...options });

    this.containerSelector = options.containerSelector || 'main';
    this.sectionSelector = options.sectionSelector || '.business-card-section, .about-section, .contact-section';
    this.isEnabled = options.enabled !== false;

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
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

    // Read header/footer heights from CSS variables
    const rootStyles = window.getComputedStyle(document.documentElement);
    const headerVar = rootStyles.getPropertyValue('--header-height').trim();
    const footerVar = rootStyles.getPropertyValue('--footer-height').trim();

    this.headerHeight = parseInt(headerVar, 10) || 60;
    this.footerHeight = parseInt(footerVar, 10) || 40;

    // Get all sections
    this.sections = Array.from(
      document.querySelectorAll(this.sectionSelector)
    ) as HTMLElement[];

    if (this.sections.length === 0) {
      this.warn('No sections found for infinite scroll');
      return;
    }

    this.log(`Found ${this.sections.length} sections for infinite scroll`);

    // Clone sections for seamless looping
    this.cloneSections();

    // Set up scroll listener
    this.scrollHandler = this.handleScroll;
    this.container.addEventListener('scroll', this.scrollHandler, { passive: true });

    // Handle window resize
    window.addEventListener('resize', this.handleResize);

    // Wait for intro animation to complete
    this.waitForIntroComplete();

    this.log('Infinite scroll initialized');
  }

  /**
   * Clone sections for seamless infinite loop
   */
  private cloneSections(): void {
    if (!this.container || this.sections.length === 0) return;

    // Clone all sections and append to end
    this.sections.forEach((section, index) => {
      const clone = section.cloneNode(true) as HTMLElement;
      clone.classList.add('infinite-scroll-clone');
      clone.setAttribute('data-clone-index', index.toString());
      clone.setAttribute('aria-hidden', 'true'); // Hide from screen readers

      // Remove IDs from cloned elements to avoid duplicates
      clone.removeAttribute('id');
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

      this.container!.appendChild(clone);
      this.clonedSections.push(clone);
    });

    this.log(`Cloned ${this.clonedSections.length} sections`);
  }

  /**
   * Handle scroll events - check for loop boundaries
   */
  private handleScroll(): void {
    if (!this.container || this.isRepositioning) return;

    const scrollTop = this.container.scrollTop;
    // Reserved for future use (reverse infinite scroll)
    const _scrollHeight = this.container.scrollHeight;
    const _clientHeight = this.container.clientHeight;

    // Calculate the height of original content (before clones)
    const originalContentHeight = this.getOriginalContentHeight();

    // When scrolled past original content, jump back to start
    if (scrollTop >= originalContentHeight) {
      this.repositionScroll(scrollTop - originalContentHeight);
    } else if (scrollTop <= 0) {
      // When scrolled before start (if we ever allow reverse), jump to end
      // For now, just prevent negative scroll
      // Could implement reverse infinite scroll here
    }
  }

  /**
   * Get the total height of original (non-cloned) content
   */
  private getOriginalContentHeight(): number {
    let totalHeight = 0;
    this.sections.forEach(section => {
      totalHeight += section.offsetHeight;
    });
    return totalHeight;
  }

  /**
   * Reposition scroll to create seamless loop
   */
  private repositionScroll(newScrollTop: number): void {
    if (!this.container) return;

    this.isRepositioning = true;

    // Instantly reposition without animation
    this.container.scrollTop = newScrollTop;

    // Small delay before allowing scroll handling again
    requestAnimationFrame(() => {
      this.isRepositioning = false;
    });

    this.log(`Repositioned scroll to ${newScrollTop}`);
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    // Refresh ScrollTrigger on resize
    ScrollTrigger.refresh();
  }

  /**
   * Wait for intro animation to complete
   */
  private waitForIntroComplete(): void {
    const html = document.documentElement;

    if (html.classList.contains('intro-complete') ||
        html.classList.contains('intro-finished') ||
        !html.classList.contains('intro-loading')) {
      this.log('Intro complete, infinite scroll ready');
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (html.classList.contains('intro-complete') || html.classList.contains('intro-finished')) {
            observer.disconnect();
            this.log('Intro animation complete');
            ScrollTrigger.refresh();
            return;
          }
        }
      }
    });

    observer.observe(html, { attributes: true });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      ScrollTrigger.refresh();
    }, 10000);
  }

  /**
   * Scroll to a specific section by index (original sections only)
   */
  scrollToSection(index: number): void {
    if (index < 0 || index >= this.sections.length || !this.container) {
      this.warn(`Invalid section index: ${index}`);
      return;
    }

    const section = this.sections[index];
    if (!section) return;

    const sectionTop = section.offsetTop;

    gsap.to(this.container, {
      scrollTop: sectionTop,
      duration: 0.6,
      ease: 'power2.inOut'
    });
  }

  /**
   * Get current section index (within original sections)
   */
  getCurrentSectionIndex(): number {
    if (!this.container || this.sections.length === 0) return -1;

    const scrollTop = this.container.scrollTop;
    const originalHeight = this.getOriginalContentHeight();

    // Normalize scroll position to within original content
    const normalizedScroll = scrollTop % originalHeight;

    let accumulatedHeight = 0;
    for (let i = 0; i < this.sections.length; i++) {
      accumulatedHeight += this.sections[i].offsetHeight;
      if (normalizedScroll < accumulatedHeight) {
        return i;
      }
    }

    return this.sections.length - 1;
  }

  /**
   * Enable infinite scroll
   */
  enable(): void {
    this.isEnabled = true;
    if (!this.scrollHandler && this.container) {
      this.scrollHandler = this.handleScroll;
      this.container.addEventListener('scroll', this.scrollHandler, { passive: true });
    }
    this.log('Infinite scroll enabled');
  }

  /**
   * Disable infinite scroll
   */
  disable(): void {
    this.isEnabled = false;
    if (this.scrollHandler && this.container) {
      this.container.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }
    this.log('Infinite scroll disabled');
  }

  /**
   * Remove cloned sections
   */
  private removeClones(): void {
    this.clonedSections.forEach(clone => clone.remove());
    this.clonedSections = [];
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      enabled: this.isEnabled,
      sectionCount: this.sections.length,
      cloneCount: this.clonedSections.length,
      currentSection: this.getCurrentSectionIndex()
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    if (this.scrollHandler && this.container) {
      this.container.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    window.removeEventListener('resize', this.handleResize);

    // Remove cloned sections
    this.removeClones();

    this.container = null;
    this.sections = [];

    await super.destroy();
  }
}
