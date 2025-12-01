/**
 * ===============================================
 * BUSINESS CARD INTERACTIONS MODULE
 * ===============================================
 * @file src/modules/business-card-interactions.ts
 * @extends BaseModule
 *
 * Handles ONLY business card interactions:
 * - Mouse following/tracking
 * - Card flipping on click
 * - 3D tilt animations
 * - Hover effects
 *
 * Requires a BusinessCardRenderer to be initialized first
 * ===============================================
 */

import { BaseModule } from './base';
import type { BusinessCardRenderer } from './business-card-renderer';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../types/modules';

export class BusinessCardInteractions extends BaseModule {
  // Renderer reference
  private renderer: BusinessCardRenderer;

  // Interaction state
  private isFlipped = false;
  private isHovering = false;
  private isAnimating = false;
  private isEnabled = false;

  // Animation configuration
  private cardFlipDuration = 0.8;
  private tiltDuration = 0.3;
  private hoverLiftHeight = 10; // pixels to lift on hover
  private maxTiltAngle = 12; // maximum tilt angle in degrees
  private globalTiltAngle = 3; // subtle global mouse following
  private magneticRange = 200; // range for magnetic attraction effect

  // Cached elements from renderer
  private businessCard: HTMLElement | null = null;
  private businessCardInner: HTMLElement | null = null;

  // Card elements
  private cardFront: HTMLElement | null = null;
  private cardBack: HTMLElement | null = null;
  private cardContainer: HTMLElement | null = null;

  // Animation timelines
  private cardFlipTimeline: any = null;
  private hoverTimeline: any = null;

  // Callback functions
  private onCardFlip: ((flipped: boolean) => void) | null = null;
  private onCardHover: ((hovering: boolean) => void) | null = null;
  private onCardInteraction: ((type: string) => void) | null = null;

  constructor(renderer: BusinessCardRenderer, options: ModuleOptions = {}) {
    super('BusinessCardInteractions', { debug: true, ...options });
    this.renderer = renderer;
    this.cardFront = null;
    this.cardBack = null;
    this.cardContainer = null;

    // ==========================================
    // ANIMATION TIMELINES
    // ==========================================
    this.cardFlipTimeline = null;
    this.hoverTimeline = null;

    // ==========================================
    // EVENT CALLBACKS
    // ==========================================
    this.onCardFlip = null;
    this.onCardHover = null;
    this.onCardInteraction = null;

    // Bind methods
    this.handleCardClick = this.handleCardClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleGlobalMouseMove = this.handleGlobalMouseMove.bind(this);
    this.handleMouseEnter = this.handleMouseEnter.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);

    this.log('BusinessCardInteractions constructor completed');
  }

  protected override async onInit() {
    this.log('BusinessCardInteractions initialization started');

    try {
      // Ensure renderer is available
      if (!this.renderer) {
        this.error('No renderer provided - interactions cannot be initialized');
        return;
      }

      // Get elements from renderer
      const elements = this.renderer.getCardElements();
      if (!elements || !elements.businessCard) {
        this.error('Renderer has no card elements - interactions cannot be initialized');
        return;
      }

      // Cache elements
      this.businessCard = elements.businessCard;
      this.businessCardInner = elements.businessCardInner;
      this.cardFront = elements.cardFront;
      this.cardBack = elements.cardBack;
      this.cardContainer = elements.cardContainer;

      this.log('Got elements from renderer:', {
        businessCard: !!this.businessCard,
        businessCardInner: !!this.businessCardInner,
        cardFront: !!this.cardFront,
        cardBack: !!this.cardBack,
        cardContainer: !!this.cardContainer
      });

      // Check GSAP availability
      if (typeof gsap === 'undefined') {
        this.error('GSAP not loaded - interactions cannot be initialized');
        return;
      }

      // Setup interaction system
      this.setupInteractions();
      this.checkReducedMotion();

      // Enable interactions
      this.enableInteractions();

      this.log('BusinessCardInteractions initialization completed');
    } catch (error) {
      this.error('BusinessCardInteractions initialization failed:', error);
    }
  }

  /**
   * ==========================================
   * INTERACTION SETUP
   * ==========================================
   */
  setupInteractions() {
    this.log('Setting up card interactions...');

    if (!this.businessCard || !this.businessCardInner) {
      this.error('Cannot setup interactions - required elements missing');
      return;
    }

    // Setup 3D perspective for interactions
    gsap.set(this.businessCard, {
      perspective: 1000
    });

    gsap.set(this.businessCardInner, {
      transformStyle: 'preserve-3d'
    });

    this.log('Card interaction setup completed');
  }

  /**
   * ==========================================
   * ENABLE/DISABLE INTERACTIONS
   * ==========================================
   */
  enableInteractions() {
    if (!this.businessCard) {
      this.error('Cannot enable interactions - card element missing');
      return;
    }

    this.log('Enabling card interactions...');

    this.addEventListeners();
    this.setCardCursor();
    this.isEnabled = true;

    this.log('Card interactions enabled');
  }

  disableInteractions() {
    if (!this.businessCard) {
      this.warn('Cannot disable interactions - card element missing');
      return;
    }

    this.log('Disabling card interactions...');

    this.removeEventListeners();
    this.resetCardCursor();
    this.isEnabled = false;

    this.log('Card interactions disabled');
  }

  /**
   * ==========================================
   * EVENT LISTENER MANAGEMENT
   * ==========================================
   */
  addEventListeners() {
    if (!this.businessCard) return;

    this.log('Adding card event listeners...');

    // Mouse events
    this.businessCard.addEventListener('click', this.handleCardClick, { passive: false });
    this.businessCard.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    this.businessCard.addEventListener('mouseenter', this.handleMouseEnter, { passive: true });
    this.businessCard.addEventListener('mouseleave', this.handleMouseLeave, { passive: true });

    // Global mouse tracking for subtle following
    document.addEventListener('mousemove', this.handleGlobalMouseMove, { passive: true });

    // Touch events for mobile
    this.businessCard.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.businessCard.addEventListener('touchend', this.handleTouchEnd, { passive: false });

    this.log('Card event listeners added');
  }

  removeEventListeners() {
    if (!this.businessCard) return;

    this.log('Removing card event listeners...');

    // Mouse events
    this.businessCard.removeEventListener('click', this.handleCardClick);
    this.businessCard.removeEventListener('mousemove', this.handleMouseMove);
    this.businessCard.removeEventListener('mouseenter', this.handleMouseEnter);
    this.businessCard.removeEventListener('mouseleave', this.handleMouseLeave);

    // Global mouse tracking
    document.removeEventListener('mousemove', this.handleGlobalMouseMove);

    // Touch events
    this.businessCard.removeEventListener('touchstart', this.handleTouchStart);
    this.businessCard.removeEventListener('touchend', this.handleTouchEnd);

    this.log('Card event listeners removed');
  }

  /**
   * ==========================================
   * CURSOR MANAGEMENT
   * ==========================================
   */
  setCardCursor() {
    if (!this.businessCard) return;

    this.businessCard.style.cursor = 'pointer';
    this.businessCard.style.pointerEvents = 'auto';

    this.log('Card cursor and pointer events set');
  }

  resetCardCursor() {
    if (!this.businessCard) return;

    this.businessCard.style.cursor = 'default';
    this.businessCard.style.pointerEvents = 'auto';

    this.log('Card cursor reset');
  }

  /**
   * ==========================================
   * EVENT HANDLERS
   * ==========================================
   */
  handleCardClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isEnabled || this.isAnimating) {
      this.log('Card click ignored - interactions disabled or animating');
      return;
    }

    this.log('Card clicked - flipping card');
    this.flipCard();

    // Trigger interaction callback
    if (this.onCardInteraction) {
      this.onCardInteraction('click');
    }
  }

  handleMouseMove(event: MouseEvent) {
    if (!this.isEnabled || this.isAnimating || !this.isHovering) return;

    const rect = this.businessCard?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Calculate rotation based on mouse position
    const rotateX = ((mouseY - centerY) / rect.height) * -this.maxTiltAngle;
    const rotateY = ((mouseX - centerX) / rect.width) * this.maxTiltAngle;

    // Apply 3D tilt animation
    gsap.to(this.businessCardInner, {
      duration: this.tiltDuration * 0.5, // faster response when hovering
      rotationX: rotateX,
      rotationY: rotateY + (this.isFlipped ? 180 : 0),
      ease: 'power2.out'
    });
  }

  handleGlobalMouseMove(event: MouseEvent) {
    if (!this.isEnabled || this.isAnimating || this.isHovering) return;

    if (!this.businessCard || !this.businessCardInner) return;

    const rect = this.businessCard.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Calculate distance from mouse to card center
    const distanceX = mouseX - centerX;
    const distanceY = mouseY - centerY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // Only apply subtle following if mouse is within magnetic range
    if (distance > this.magneticRange) {
      // Reset to neutral position when mouse is far away
      gsap.to(this.businessCardInner, {
        duration: this.tiltDuration * 2,
        rotationX: 0,
        rotationY: this.isFlipped ? 180 : 0,
        ease: 'power2.out'
      });
      return;
    }

    // Calculate subtle rotation based on viewport position
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;

    const normalizedX = (mouseX - viewportCenterX) / (window.innerWidth / 2);
    const normalizedY = (mouseY - viewportCenterY) / (window.innerHeight / 2);

    // Apply subtle global tilt with magnetic attraction effect
    const magneticStrength = 1 - distance / this.magneticRange;
    const rotateX = normalizedY * -this.globalTiltAngle * magneticStrength;
    const rotateY = normalizedX * this.globalTiltAngle * magneticStrength;

    gsap.to(this.businessCardInner, {
      duration: this.tiltDuration * 1.5,
      rotationX: rotateX,
      rotationY: rotateY + (this.isFlipped ? 180 : 0),
      ease: 'power2.out'
    });
  }

  handleMouseEnter(_event: MouseEvent) {
    if (!this.isEnabled) return;

    this.log('Mouse entered card');
    this.isHovering = true;

    // Hover lift animation
    if (this.hoverTimeline) {
      this.hoverTimeline.kill();
    }

    this.hoverTimeline = gsap.timeline();
    this.hoverTimeline.to(this.businessCard, {
      duration: 0.3,
      y: -this.hoverLiftHeight,
      ease: 'power2.out'
    });

    // Trigger hover callback
    if (this.onCardHover) {
      this.onCardHover(true);
    }
  }

  handleMouseLeave(_event: MouseEvent) {
    if (!this.isEnabled) return;

    this.log('Mouse left card');
    this.isHovering = false;

    // Reset position and rotation
    if (this.hoverTimeline) {
      this.hoverTimeline.kill();
    }

    this.hoverTimeline = gsap.timeline();
    this.hoverTimeline.to(this.businessCard, {
      duration: 0.5,
      y: 0,
      ease: 'power2.out'
    });

    gsap.to(this.businessCardInner, {
      duration: 0.5,
      rotationX: 0,
      rotationY: this.isFlipped ? 180 : 0,
      ease: 'power2.out'
    });

    // Trigger hover callback
    if (this.onCardHover) {
      this.onCardHover(false);
    }
  }

  handleTouchStart(event: TouchEvent) {
    if (!this.isEnabled || this.isAnimating) return;

    event.preventDefault();
    this.log('Touch started on card');
  }

  handleTouchEnd(event: TouchEvent) {
    if (!this.isEnabled || this.isAnimating) return;

    event.preventDefault();
    this.log('Touch ended on card - flipping');
    this.flipCard();

    // Trigger interaction callback
    if (this.onCardInteraction) {
      this.onCardInteraction('touch');
    }
  }

  /**
   * ==========================================
   * CARD FLIP ANIMATION
   * ==========================================
   */
  flipCard() {
    if (!this.businessCardInner || this.isAnimating) {
      this.log('Cannot flip card - element missing or animating');
      return;
    }

    this.log('Starting card flip animation');
    this.isAnimating = true;

    // Kill existing flip timeline
    if (this.cardFlipTimeline) {
      this.cardFlipTimeline.kill();
    }

    // Toggle flip state
    this.isFlipped = !this.isFlipped;

    // Create flip animation
    this.cardFlipTimeline = gsap.timeline({
      onComplete: () => {
        this.isAnimating = false;
        this.log('Card flip animation completed');

        // Trigger flip callback
        if (this.onCardFlip) {
          this.onCardFlip(this.isFlipped);
        }
      }
    });

    this.cardFlipTimeline.to(this.businessCardInner, {
      duration: this.cardFlipDuration,
      rotationY: this.isFlipped ? 180 : 0,
      ease: 'power2.inOut'
    });
  }

  /**
   * ==========================================
   * ACCESSIBILITY
   * ==========================================
   */
  protected override checkReducedMotion(): boolean {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (prefersReducedMotion.matches) {
      this.log('User prefers reduced motion - disabling animations');
      this.cardFlipDuration = 0.1;
      this.tiltDuration = 0.1;
      this.hoverLiftHeight = 2;
      this.maxTiltAngle = 2;
      this.globalTiltAngle = 1; // minimal global following
      this.magneticRange = 100; // smaller magnetic range
    }

    // Listen for changes
    prefersReducedMotion.addEventListener('change', () => {
      this.checkReducedMotion();
    });

    return prefersReducedMotion.matches;
  }

  /**
   * ==========================================
   * PUBLIC API
   * ==========================================
   */
  getCurrentSide() {
    return this.isFlipped ? 'back' : 'front';
  }

  resetCard() {
    if (!this.businessCardInner) return;

    this.log('Resetting card to front');

    this.isFlipped = false;
    this.isAnimating = false;
    this.isHovering = false;

    gsap.set(this.businessCardInner, {
      rotationY: 0,
      rotationX: 0
    });

    gsap.set(this.businessCard, {
      y: 0
    });
  }

  /**
   * ==========================================
   * STATUS & DEBUG
   * ==========================================
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      isEnabled: this.isEnabled,
      isFlipped: this.isFlipped,
      isHovering: this.isHovering,
      isAnimating: this.isAnimating,
      currentSide: this.getCurrentSide(),
      hasRenderer: !!this.renderer,
      hasElements: !!(this.businessCard && this.businessCardInner)
    };
  }

  /**
   * ==========================================
   * CLEANUP
   * ==========================================
   */
  protected override async onDestroy() {
    this.log('BusinessCardInteractions cleanup started');

    // Disable interactions
    this.disableInteractions();

    // Kill timelines
    if (this.cardFlipTimeline) {
      this.cardFlipTimeline.kill();
      this.cardFlipTimeline = null;
    }

    if (this.hoverTimeline) {
      this.hoverTimeline.kill();
      this.hoverTimeline = null;
    }

    // Reset card
    this.resetCard();

    // Clear element references
    this.businessCard = null;
    this.businessCardInner = null;
    this.cardFront = null;
    this.cardBack = null;
    this.cardContainer = null;
    this.renderer = null as any;

    this.log('BusinessCardInteractions cleanup completed');
  }
}
