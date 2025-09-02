/**
 * ===============================================
 * PORTFOLIO CAROUSEL MODULE
 * ===============================================
 * @file src/modules/portfolio-carousel.ts
 * @extends BaseModule
 *
 * Handles portfolio carousel functionality with smooth transitions,
 * keyboard navigation, touch support, and auto-play capabilities.
 */

import { BaseModule } from './base';
import type { ModuleOptions } from '../types/modules';

export interface PortfolioCarouselOptions extends ModuleOptions {
  autoplay?: boolean;
  autoplayInterval?: number;
  enableKeyboard?: boolean;
  enableTouch?: boolean;
}

export class PortfolioCarouselModule extends BaseModule {
  private carousel: HTMLElement | null = null;
  private track: HTMLElement | null = null;
  private slides: NodeListOf<Element> | null = null;
  private prevBtn: HTMLElement | null = null;
  private nextBtn: HTMLElement | null = null;
  private indicators: NodeListOf<Element> | null = null;

  private currentSlide = 0;
  private totalSlides = 0;
  private autoplayTimer: number | null = null;
  private isAnimating = false;

  // Touch/swipe support
  private startX = 0;
  private currentX = 0;
  private isDragging = false;

  // Options
  private options: PortfolioCarouselOptions;

  constructor(options: PortfolioCarouselOptions = {}) {
    super('PortfolioCarouselModule', options);

    this.options = {
      autoplay: false,
      autoplayInterval: 5000,
      enableKeyboard: true,
      enableTouch: true,
      ...options
    };
  }

  protected override async onInit(): Promise<void> {
    await this.cacheElements();

    if (!this.carousel || !this.slides) {
      this.log('Portfolio carousel not found on this page');
      return;
    }

    this.setupCarousel();
    this.setupEventListeners();

    if (this.options.autoplay) {
      this.startAutoplay();
    }

    this.log('Portfolio carousel initialized');
  }

  /**
   * Cache carousel elements
   */
  private async cacheElements(): Promise<void> {
    this.carousel = document.querySelector('[data-portfolio-carousel]');
    this.track = document.querySelector('.portfolio-carousel-track');
    this.slides = document.querySelectorAll('.portfolio-slide');
    this.prevBtn = document.querySelector('[data-carousel-prev]');
    this.nextBtn = document.querySelector('[data-carousel-next]');
    this.indicators = document.querySelectorAll('.indicator');
  }

  /**
   * Setup carousel initial state
   */
  private setupCarousel(): void {
    if (!this.slides) return;

    this.totalSlides = this.slides.length;
    this.currentSlide = 0;

    // Set initial active slide
    this.updateActiveSlide();
    this.updateIndicators();
    this.updateButtons();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Navigation buttons
    if (this.prevBtn) {
      this.addEventListener(this.prevBtn, 'click', () => this.previousSlide());
    }

    if (this.nextBtn) {
      this.addEventListener(this.nextBtn, 'click', () => this.nextSlide());
    }

    // Indicators
    if (this.indicators) {
      this.indicators.forEach((indicator, index) => {
        this.addEventListener(indicator, 'click', () => this.goToSlide(index));
      });
    }

    // Keyboard navigation
    if (this.options.enableKeyboard) {
      this.addEventListener(document.documentElement, 'keydown', (event: Event) => {
        const keyEvent = event as KeyboardEvent;
        if (keyEvent.key === 'ArrowLeft') {
          keyEvent.preventDefault();
          this.previousSlide();
        } else if (keyEvent.key === 'ArrowRight') {
          keyEvent.preventDefault();
          this.nextSlide();
        }
      });
    }

    // Touch/swipe support
    if (this.options.enableTouch && this.carousel) {
      this.setupTouchEvents();
    }

    // Pause autoplay on hover
    if (this.options.autoplay && this.carousel) {
      this.addEventListener(this.carousel, 'mouseenter', () => this.pauseAutoplay());
      this.addEventListener(this.carousel, 'mouseleave', () => this.startAutoplay());
    }

    // Handle visibility change (pause when tab is not active)
    this.addEventListener(document.documentElement, 'visibilitychange', () => {
      if (document.hidden) {
        this.pauseAutoplay();
      } else if (this.options.autoplay) {
        this.startAutoplay();
      }
    });
  }

  /**
   * Setup touch/swipe events
   */
  private setupTouchEvents(): void {
    if (!this.carousel) return;

    // Touch events
    this.addEventListener(this.carousel, 'touchstart', (e: Event) => {
      const touchEvent = e as TouchEvent;
      this.startX = touchEvent.touches?.[0]?.clientX || 0;
      this.isDragging = true;
      this.pauseAutoplay();
    });

    this.addEventListener(this.carousel, 'touchmove', (e: Event) => {
      if (!this.isDragging) return;
      const touchEvent = e as TouchEvent;
      this.currentX = touchEvent.touches?.[0]?.clientX || 0;
    });

    this.addEventListener(this.carousel, 'touchend', () => {
      if (!this.isDragging) return;

      const diff = this.startX - this.currentX;
      const threshold = 50; // Minimum swipe distance

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          this.nextSlide();
        } else {
          this.previousSlide();
        }
      }

      this.isDragging = false;
      if (this.options.autoplay) {
        this.startAutoplay();
      }
    });

    // Mouse events for desktop
    this.addEventListener(this.carousel, 'mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      this.startX = mouseEvent.clientX;
      this.isDragging = true;
      this.pauseAutoplay();
    });

    this.addEventListener(this.carousel, 'mousemove', (e: Event) => {
      if (!this.isDragging) return;
      const mouseEvent = e as MouseEvent;
      this.currentX = mouseEvent.clientX;
    });

    this.addEventListener(this.carousel, 'mouseup', () => {
      if (!this.isDragging) return;

      const diff = this.startX - this.currentX;
      const threshold = 50;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          this.nextSlide();
        } else {
          this.previousSlide();
        }
      }

      this.isDragging = false;
      if (this.options.autoplay) {
        this.startAutoplay();
      }
    });

    this.addEventListener(this.carousel, 'mouseleave', () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.options.autoplay) {
          this.startAutoplay();
        }
      }
    });
  }

  /**
   * Go to next slide
   */
  public nextSlide(): void {
    if (this.isAnimating) return;

    this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
    this.updateCarousel();
  }

  /**
   * Go to previous slide
   */
  public previousSlide(): void {
    if (this.isAnimating) return;

    this.currentSlide = this.currentSlide === 0 ? this.totalSlides - 1 : this.currentSlide - 1;
    this.updateCarousel();
  }

  /**
   * Go to specific slide
   */
  public goToSlide(index: number): void {
    if (this.isAnimating || index === this.currentSlide || index < 0 || index >= this.totalSlides) {
      return;
    }

    this.currentSlide = index;
    this.updateCarousel();
  }

  /**
   * Update carousel position and active states
   */
  private updateCarousel(): void {
    this.isAnimating = true;

    this.updateActiveSlide();
    this.updateIndicators();
    this.updateButtons();

    // Reset animation flag after transition
    setTimeout(() => {
      this.isAnimating = false;
    }, 600);
  }

  /**
   * Update active slide
   */
  private updateActiveSlide(): void {
    if (!this.slides || !this.track) return;

    this.slides.forEach((slide, index) => {
      slide.classList.toggle('active', index === this.currentSlide);
    });

    // Transform the track to show current slide
    const translateX = -this.currentSlide * 100;
    this.track.style.transform = `translateX(${translateX}%)`;
  }

  /**
   * Update indicator states
   */
  private updateIndicators(): void {
    if (!this.indicators) return;

    this.indicators.forEach((indicator, index) => {
      indicator.classList.toggle('active', index === this.currentSlide);
    });
  }

  /**
   * Update button states
   */
  private updateButtons(): void {
    // For a carousel, we don't disable buttons - they should loop around
    // Remove any disabled state
    if (this.prevBtn) {
      this.prevBtn.removeAttribute('disabled');
    }

    if (this.nextBtn) {
      this.nextBtn.removeAttribute('disabled');
    }
  }

  /**
   * Start autoplay
   */
  private startAutoplay(): void {
    if (!this.options.autoplay) return;

    this.pauseAutoplay();
    this.autoplayTimer = window.setTimeout(() => {
      this.nextSlide();
      this.startAutoplay();
    }, this.options.autoplayInterval);
  }

  /**
   * Pause autoplay
   */
  private pauseAutoplay(): void {
    if (this.autoplayTimer) {
      clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  /**
   * Get current slide index
   */
  public getCurrentSlide(): number {
    return this.currentSlide;
  }

  /**
   * Get total number of slides
   */
  public getTotalSlides(): number {
    return this.totalSlides;
  }

  /**
   * Enable autoplay
   */
  public enableAutoplay(interval?: number): void {
    this.options.autoplay = true;
    if (interval) {
      this.options.autoplayInterval = interval;
    }
    this.startAutoplay();
  }

  /**
   * Disable autoplay
   */
  public disableAutoplay(): void {
    this.options.autoplay = false;
    this.pauseAutoplay();
  }

  /**
   * Cleanup
   */
  protected override onDestroy(): void {
    this.pauseAutoplay();
    this.carousel = null;
    this.track = null;
    this.slides = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.indicators = null;
  }
}