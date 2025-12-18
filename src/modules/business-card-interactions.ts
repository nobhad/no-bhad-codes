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
  private currentRotationY = 0; // Track actual rotation value for directional flips

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
    this.handleKeyDown = this.handleKeyDown.bind(this);
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

    // Start with back showing (rotated 180 degrees)
    this.currentRotationY = 180;
    this.isFlipped = true;
    gsap.set(this.businessCardInner, {
      rotationY: 180
    });

    // Flip to front when card becomes visible
    this.setupInitialFlipOnVisible();

    this.log('Card interaction setup completed');
  }

  /**
   * Setup observer to flip card when it becomes visible
   */
  private setupInitialFlipOnVisible() {
    if (!this.businessCard) return;

    const isContactCard = this.businessCard.id === 'contact-business-card';
    const isMobile = window.matchMedia('(max-width: 767px)').matches;

    if (isContactCard && isMobile) {
      // Mobile contact card: wait for scroll-snap to complete
      this.setupScrollSnapDetection();
    } else if (isContactCard) {
      // Contact card on desktop: flip every time section is scrolled into view
      this.setupContactCardScrollFlip();
    } else {
      // Main card: flip once when visible
      const threshold = 0.3;
      const delay = 300;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && this.isFlipped) {
              setTimeout(() => {
                this.flipCard('right');
              }, delay);
              observer.disconnect();
            }
          });
        },
        { threshold }
      );
      observer.observe(this.businessCard);
    }
  }

  /**
   * Setup scroll-triggered flip for contact card (flips every time section enters)
   */
  private setupContactCardScrollFlip() {
    if (!this.businessCard) return;

    const contactSection = document.querySelector('.contact-section');
    if (!contactSection) return;

    // Track whether section has left viewport so we can flip on re-entry
    let wasOutOfView = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && wasOutOfView && !this.isAnimating) {
            // Section entering viewport - flip from whatever side it's on
            wasOutOfView = false;
            setTimeout(() => {
              this.flipCard('right');
            }, 300);
          } else if (!entry.isIntersecting) {
            // Section left viewport - allow flip on next entry
            wasOutOfView = true;
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(contactSection);
  }

  /**
   * Detect when scroll-snap completes on contact section (mobile)
   * Flips each time the section is snapped into view
   */
  private setupScrollSnapDetection() {
    const scrollContainer = document.querySelector('main');
    const contactSection = document.querySelector('.contact-section');

    if (!scrollContainer || !contactSection) return;

    // Capture references for use in nested functions (TypeScript narrowing)
    const container = scrollContainer;
    const section = contactSection;
    const self = this;

    let scrollTimeout: number | null = null;
    let wasSnapped = false;

    // Using function declarations for hoisting (avoids use-before-define)
    function checkIfSnapped() {
      if (self.isAnimating) return;

      const rect = section.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Check if contact section is snapped (top aligned with container top, with small tolerance)
      const isSnapped = Math.abs(rect.top - containerRect.top) < 50;

      if (isSnapped && !wasSnapped) {
        // Section just snapped into view - flip the card
        wasSnapped = true;
        setTimeout(() => {
          self.flipCard('right');
        }, 200);
      } else if (!isSnapped) {
        // Section is not snapped - allow flip on next snap
        wasSnapped = false;
      }
    }

    function onScroll() {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = window.setTimeout(checkIfSnapped, 150);
    }

    function onScrollEnd() {
      checkIfSnapped();
    }

    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('scrollend', onScrollEnd, { passive: true });
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

    // Make card focusable for keyboard accessibility
    this.businessCard.setAttribute('tabindex', '0');
    this.businessCard.setAttribute('role', 'button');
    this.businessCard.setAttribute('aria-label', 'Business card - press Enter or Space to flip');
    this.businessCard.setAttribute('aria-pressed', String(this.isFlipped));

    // Mouse events
    this.businessCard.addEventListener('click', this.handleCardClick, { passive: false });
    this.businessCard.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    this.businessCard.addEventListener('mouseenter', this.handleMouseEnter, { passive: true });
    this.businessCard.addEventListener('mouseleave', this.handleMouseLeave, { passive: true });

    // Keyboard events for accessibility
    this.businessCard.addEventListener('keydown', this.handleKeyDown, { passive: false });

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

    // Keyboard events
    this.businessCard.removeEventListener('keydown', this.handleKeyDown);

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

    // Determine flip direction based on click position
    const rect = this.businessCard?.getBoundingClientRect();
    if (!rect) return;

    const clickX = event.clientX;
    const cardCenterX = rect.left + rect.width / 2;
    const flipDirection = clickX < cardCenterX ? 'left' : 'right';

    this.log(`Card clicked on ${flipDirection} side - flipping ${flipDirection}`);
    this.flipCard(flipDirection);

    // Update ARIA state
    this.updateAriaState();

    // Trigger interaction callback
    if (this.onCardInteraction) {
      this.onCardInteraction('click');
    }
  }

  /**
   * Handle keyboard events for accessibility
   * Enter or Space flips the card
   */
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isEnabled || this.isAnimating) {
      this.log('Card keydown ignored - interactions disabled or animating');
      return;
    }

    // Flip on Enter or Space
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();

      this.log('Card flipped via keyboard');
      this.flipCard('right');

      // Update ARIA state
      this.updateAriaState();

      // Trigger interaction callback
      if (this.onCardInteraction) {
        this.onCardInteraction('keyboard');
      }
    }
  }

  /**
   * Update ARIA pressed state after flip
   */
  private updateAriaState() {
    if (this.businessCard) {
      this.businessCard.setAttribute('aria-pressed', String(this.isFlipped));
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
      rotationY: rotateY + this.currentRotationY,
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
        rotationY: this.currentRotationY,
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
      rotationY: rotateY + this.currentRotationY,
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
      rotationY: this.currentRotationY,
      ease: 'power2.out'
    });

    // Trigger hover callback
    if (this.onCardHover) {
      this.onCardHover(false);
    }
  }

  private touchStartX: number | null = null;

  handleTouchStart(event: TouchEvent) {
    if (!this.isEnabled || this.isAnimating) return;

    event.preventDefault();
    // Store touch start position for direction detection
    if (event.touches.length > 0) {
      this.touchStartX = event.touches[0].clientX;
    }
    this.log('Touch started on card');
  }

  handleTouchEnd(event: TouchEvent) {
    if (!this.isEnabled || this.isAnimating) return;

    event.preventDefault();

    // Determine flip direction based on touch position
    const rect = this.businessCard?.getBoundingClientRect();
    if (!rect) return;

    // Use changedTouches for touchend, fallback to stored touchStartX
    const touchX = event.changedTouches.length > 0
      ? event.changedTouches[0].clientX
      : this.touchStartX ?? (rect.left + rect.width / 2);

    const cardCenterX = rect.left + rect.width / 2;
    const flipDirection = touchX < cardCenterX ? 'left' : 'right';

    this.log(`Touch ended on card - flipping ${flipDirection}`);
    this.flipCard(flipDirection);

    this.touchStartX = null;

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
  flipCard(direction: 'left' | 'right' = 'right') {
    if (!this.businessCardInner || this.isAnimating) {
      this.log('Cannot flip card - element missing or animating');
      return;
    }

    this.log(`Starting card flip animation (direction: ${direction})`);
    this.isAnimating = true;

    // Kill existing flip timeline
    if (this.cardFlipTimeline) {
      this.cardFlipTimeline.kill();
    }

    // Toggle flip state
    this.isFlipped = !this.isFlipped;

    // Calculate new rotation based on direction
    // Left click = flip left (subtract 180), Right click = flip right (add 180)
    if (direction === 'left') {
      this.currentRotationY -= 180;
    } else {
      this.currentRotationY += 180;
    }

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
      rotationY: this.currentRotationY,
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
    this.currentRotationY = 0;

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
