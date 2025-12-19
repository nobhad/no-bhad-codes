/**
 * ===============================================
 * CONTACT SECTION ANIMATION MODULE
 * ===============================================
 * @file src/modules/contact-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - DESKTOP ONLY - No animation on mobile
 * - Uses GSAP ScrollTrigger for scroll-driven animations
 * - Animates text elements as contact section enters viewport
 * - Staggered reveal animation for visual interest
 *
 * ANIMATION SEQUENCE:
 * 1. Section enters viewport from bottom
 * 2. Heading slides up and fades in
 * 3. Contact options text slides up with stagger
 * 4. Form elements fade in
 * 5. Business card slides in from right
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../../types/modules';

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

/** Duration for bump effect */
const BUMP_DURATION = 0.12;

/** How far button overshoots to hit form fields */
const BUTTON_OVERSHOOT = 50;

/** How far form fields shift on impact */
const BUMP_DISTANCE = 15;

// ============================================================================
// CONTACT ANIMATION MODULE CLASS
// ============================================================================

export class ContactAnimationModule extends BaseModule {
  private container: HTMLElement | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private scrollTrigger: ScrollTrigger | null = null;
  private hasFlippedCard = false;
  private cardClickHandler: ((e: MouseEvent) => void) | null = null;
  private cardMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private cardMouseLeaveHandler: (() => void) | null = null;
  private businessCardEl: HTMLElement | null = null;
  private businessCardInner: HTMLElement | null = null;

  constructor(options: ModuleOptions = {}) {
    super('ContactAnimationModule', { debug: true, ...options });
  }

  override async init(): Promise<void> {
    await super.init();

    // ========================================================================
    // DESKTOP ONLY CHECK
    // ========================================================================
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      this.log('Mobile detected - skipping contact animation');
      return;
    }

    // ========================================================================
    // REDUCED MOTION CHECK
    // ========================================================================
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - skipping animation');
      return;
    }

    this.setupAnimation();
  }

  /**
   * Set up the contact section animation
   */
  private setupAnimation(): void {
    this.container = document.querySelector('.contact-section') as HTMLElement;
    if (!this.container) {
      this.log('Contact section not found');
      return;
    }

    // Get animatable elements
    const businessCard = this.container.querySelector('#contact-business-card');

    // ========================================================================
    // CREATE ANIMATION TIMELINE
    // Using 'from' tweens so elements start visible and animate FROM hidden state
    // Timeline is controlled by ScrollTrigger's toggleActions
    // ========================================================================
    this.timeline = gsap.timeline({
      onComplete: () => {
        this.log('Contact animation complete');
      }
    });

    // ========================================================================
    // LEFT SIDE - Already visible, no entry animation
    // Just set up the business card with back showing
    // ========================================================================
    if (businessCard) {
      const cardInner = businessCard.querySelector('.business-card-inner') as HTMLElement;

      // Start with back showing (rotated 180)
      if (cardInner) {
        gsap.set(cardInner, { rotationY: 180 });
      }

      // Setup click handler for manual card flip
      this.setupCardClickHandler(businessCard as HTMLElement);
    }

    // ========================================================================
    // RIGHT SIDE NEXT - Form fields one at a time
    // ========================================================================
    const nameField = this.container.querySelector('#name')?.closest('.input-item');
    const companyField = this.container.querySelector('#company')?.closest('.input-item');
    const emailField = this.container.querySelector('#email')?.closest('.input-item');
    const messageField = this.container.querySelector('#message')?.closest('.input-item') ||
                         this.container.querySelector('textarea')?.closest('.input-item');
    const submitButton = this.container.querySelector('button[type="submit"]') ||
                         this.container.querySelector('.contact-submit');

    // Name field slides in from off-screen right
    if (nameField) {
      this.timeline.from(nameField, {
        x: '100vw',
        duration: 1,
        ease: 'power2.out'
      });
    }

    // Company field slides in from off-screen right (staggered)
    if (companyField) {
      this.timeline.from(companyField, {
        x: '100vw',
        duration: 1,
        ease: 'power2.out'
      }, '-=0.7');
    }

    // Email field slides in from off-screen right (staggered)
    if (emailField) {
      this.timeline.from(emailField, {
        x: '100vw',
        duration: 1,
        ease: 'power2.out'
      }, '-=0.7');
    }

    // Message field slides in from off-screen right (staggered)
    if (messageField) {
      this.timeline.from(messageField, {
        x: '100vw',
        duration: 1,
        ease: 'power2.out'
      }, '-=0.7');
    }

    // ========================================================================
    // BUMP SEQUENCE - Button hits fields, fields snap back and knock button away
    // ========================================================================
    const formFields = [nameField, companyField, emailField].filter(Boolean);

    if (submitButton && formFields.length > 0) {
      // 1. Button rolls in from off-screen and hits the fields
      gsap.set(submitButton, { transformOrigin: 'center center' });
      this.timeline.fromTo(submitButton,
        { x: '100vw', rotation: -720 },
        { x: -BUTTON_OVERSHOOT, rotation: 0, duration: 1.2, ease: 'none' }
      );

      // 2. All three fields bump left on impact - company moves more
      const bumpLabel = 'bump';
      if (nameField) {
        this.timeline.to(nameField, {
          x: -BUMP_DISTANCE * 2,
          duration: BUMP_DURATION,
          ease: 'power2.out'
        }, bumpLabel);
      }
      if (companyField) {
        this.timeline.to(companyField, {
          x: -BUMP_DISTANCE * 3,
          duration: BUMP_DURATION,
          ease: 'power2.out'
        }, bumpLabel);
      }
      if (emailField) {
        this.timeline.to(emailField, {
          x: -BUMP_DISTANCE * 2,
          duration: BUMP_DURATION,
          ease: 'power2.out'
        }, bumpLabel);
      }

      // Trigger card flip on impact
      if (businessCard) {
        this.timeline.call(() => {
          if (this.hasFlippedCard) return;
          this.hasFlippedCard = true;

          const cardInner = businessCard?.querySelector('.business-card-inner') as HTMLElement;
          if (cardInner) {
            gsap.to(cardInner, {
              rotationY: '+=180',
              duration: 0.8,
              ease: 'power2.inOut'
            });
          }
        }, [], '-=0.1');
      }

      // 3. Name and email snap back with elastic
      this.timeline.to([nameField, emailField].filter(Boolean), {
        x: 0,
        duration: 0.5,
        ease: 'elastic.out(0.8, 0.6)',
        stagger: 0.03
      });

      // 4. Company field snaps back further (overshoots to hit button)
      if (companyField) {
        this.timeline.to(companyField, {
          keyframes: [
            { x: BUMP_DISTANCE * 1.5, duration: 0.15, ease: 'power2.out' },
            { x: 0, duration: 0.4, ease: 'elastic.out(0.5, 0.8)' }
          ]
        }, '-=0.5');
      }

      // 5. Button gets knocked off screen by company field
      this.timeline.to(submitButton, {
        x: '100vw',
        rotation: '+=360',
        duration: 0.6,
        ease: 'power2.out'
      }, '-=0.5');

      // 6. Button rolls back onto screen
      // Rotation math: +360 (knocked) - 340 (roll) - 20 (snap) = 0
      this.timeline.to(submitButton, {
        x: 20,
        rotation: '-=340',
        duration: 1.5,
        ease: 'power1.out'
      });

      // 7. Button snaps into final position
      this.timeline.to(submitButton, {
        x: 0,
        rotation: '-=20',
        duration: 0.15,
        ease: 'back.out(2)'
      });
    }

    // ========================================================================
    // CREATE SCROLL TRIGGER WITH PINNING
    // Pins contact section while animation plays
    // ========================================================================
    const scrollContainer = document.querySelector('main');

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: scrollContainer || undefined,
      start: 'center center', // Pin when section is centered in viewport
      end: '+=100%', // Pin for duration of animation (100vh of scroll distance)
      pin: true,
      pinSpacing: true,
      animation: this.timeline,
      onEnter: () => {
        this.log('Contact section pinned - playing animation');
      },
      onLeave: () => {
        this.log('Contact section unpinned - animation complete');
      },
      onLeaveBack: () => {
        this.log('Contact section left viewport backwards');
      }
    });

    this.log('Contact animation initialized (desktop only)');
  }

  /**
   * Setup click and tilt handlers for contact business card
   */
  private setupCardClickHandler(card: HTMLElement): void {
    const cardInner = card.querySelector('.business-card-inner') as HTMLElement;
    if (!cardInner) return;

    // Store references for tilt effects
    this.businessCardEl = card;
    this.businessCardInner = cardInner;

    // Setup 3D perspective
    gsap.set(card, { perspective: 1000 });
    gsap.set(cardInner, { transformStyle: 'preserve-3d' });

    // Make card clickable
    card.style.cursor = 'pointer';

    // Click handler for flip (direction based on click position)
    // Only flips when clicking corners/edges, not when clicking text/links
    this.cardClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't flip if clicking on links - let links work normally
      if (target.tagName === 'A' || target.closest('a')) {
        return;
      }

      // Check if click is in a corner zone (outside center 60% of card)
      const rect = card.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const cornerZone = 0.2; // 20% from each edge is "corner"

      const inCenterX = clickX > rect.width * cornerZone && clickX < rect.width * (1 - cornerZone);
      const inCenterY = clickY > rect.height * cornerZone && clickY < rect.height * (1 - cornerZone);

      // If click is in center area (not in corner zones), don't flip
      if (inCenterX && inCenterY) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Determine flip direction based on which side of card was clicked
      const cardCenterX = rect.width / 2;
      const flipDirection = clickX < cardCenterX ? -180 : 180;

      gsap.to(cardInner, {
        rotationY: `+=${flipDirection}`,
        duration: 0.8,
        ease: 'power2.inOut'
      });

      this.log(`Contact card flipped ${flipDirection > 0 ? 'right' : 'left'} via corner click`);
    };

    // Mouse move handler for tilt effect
    const maxTiltAngle = 12;
    this.cardMouseMoveHandler = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rotateX = ((e.clientY - centerY) / rect.height) * -maxTiltAngle;
      const rotateY = ((e.clientX - centerX) / rect.width) * maxTiltAngle;

      // Get current base rotation (multiple of 180)
      const currentRotation = gsap.getProperty(cardInner, 'rotationY') as number;
      const baseRotation = Math.round(currentRotation / 180) * 180;

      gsap.to(cardInner, {
        rotationX: rotateX,
        rotationY: baseRotation + rotateY,
        duration: 0.3,
        ease: 'power2.out'
      });
    };

    // Mouse leave handler to reset tilt
    this.cardMouseLeaveHandler = () => {
      const currentRotation = gsap.getProperty(cardInner, 'rotationY') as number;
      const baseRotation = Math.round(currentRotation / 180) * 180;

      gsap.to(cardInner, {
        rotationX: 0,
        rotationY: baseRotation,
        duration: 0.5,
        ease: 'power2.out'
      });
    };

    card.addEventListener('click', this.cardClickHandler);
    card.addEventListener('mousemove', this.cardMouseMoveHandler);
    card.addEventListener('mouseleave', this.cardMouseLeaveHandler);
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      hasContainer: !!this.container,
      hasTimeline: !!this.timeline,
      hasScrollTrigger: !!this.scrollTrigger
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    // Remove card event listeners
    if (this.businessCardEl) {
      if (this.cardClickHandler) {
        this.businessCardEl.removeEventListener('click', this.cardClickHandler);
      }
      if (this.cardMouseMoveHandler) {
        this.businessCardEl.removeEventListener('mousemove', this.cardMouseMoveHandler);
      }
      if (this.cardMouseLeaveHandler) {
        this.businessCardEl.removeEventListener('mouseleave', this.cardMouseLeaveHandler);
      }
    }

    if (this.scrollTrigger) {
      this.scrollTrigger.kill();
      this.scrollTrigger = null;
    }

    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.container = null;
    this.businessCardEl = null;
    this.businessCardInner = null;
    this.cardClickHandler = null;
    this.cardMouseMoveHandler = null;
    this.cardMouseLeaveHandler = null;

    await super.destroy();
  }
}
