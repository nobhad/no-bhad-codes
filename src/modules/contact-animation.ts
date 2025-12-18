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

import { BaseModule } from './base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../types/modules';

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// ANIMATION CONSTANTS
// ============================================================================

/** Duration for main text animations */
const TEXT_DURATION = 0.8;

/** Duration for form fade-in */
const FORM_DURATION = 0.6;

/** Duration for card slide-in */
const CARD_DURATION = 1.0;

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
    const heading = this.container.querySelector('h2');
    const contactOptions = this.container.querySelector('.contact-options');
    const cardColumn = this.container.querySelector('.contact-card-column');
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
    // LEFT SIDE FIRST - Heading, contact options, card
    // ========================================================================

    // Heading slides in from left
    if (heading) {
      this.timeline.from(heading, {
        x: -100,
        opacity: 0,
        duration: TEXT_DURATION,
        ease: 'power2.out'
      });
    }

    // Contact options slides in from left
    if (contactOptions) {
      this.timeline.from(contactOptions, {
        x: -100,
        opacity: 0,
        duration: TEXT_DURATION,
        ease: 'power2.out'
      }, '-=0.5');
    }

    // Card column slides in from left
    if (cardColumn) {
      this.timeline.from(cardColumn, {
        x: -100,
        opacity: 0,
        duration: CARD_DURATION,
        ease: 'power3.out'
      }, '-=0.4');
    }

    // Business card slides in from left with 3D rotation
    if (businessCard) {
      this.timeline.from(businessCard, {
        x: -50,
        opacity: 0,
        rotateY: 15,
        duration: CARD_DURATION,
        ease: 'power3.out'
      }, '<');

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

    // Name field slides in from right
    if (nameField) {
      this.timeline.from(nameField, {
        x: 100,
        opacity: 0,
        duration: FORM_DURATION,
        ease: 'power2.out'
      }, '-=0.3');
    }

    // Company field slides in from right
    if (companyField) {
      this.timeline.from(companyField, {
        x: 100,
        opacity: 0,
        duration: FORM_DURATION,
        ease: 'power2.out'
      }, '-=0.4');
    }

    // Email field slides in from right
    if (emailField) {
      this.timeline.from(emailField, {
        x: 100,
        opacity: 0,
        duration: FORM_DURATION,
        ease: 'power2.out'
      }, '-=0.4');
    }

    // Message field slides in from right
    if (messageField) {
      this.timeline.from(messageField, {
        x: 100,
        opacity: 0,
        duration: FORM_DURATION,
        ease: 'power2.out'
      }, '-=0.4');
    }

    // Submit button slides in fast from off-screen right and overshoots to hit form fields
    if (submitButton) {
      this.timeline.fromTo(submitButton,
        {
          x: '100vw'
        },
        {
          x: -BUTTON_OVERSHOOT,
          duration: 0.6,
          ease: 'power3.in'
        }, '-=0.4');
    }

    // ========================================================================
    // BUMP EFFECT - Form fields react to button impact
    // Company field (middle) gets hit the hardest
    // ========================================================================
    if (submitButton) {
      const bumpLabel = 'bump';

      // Name field - light bump
      if (nameField) {
        this.timeline.to(nameField, {
          x: -BUMP_DISTANCE * 0.5,
          duration: BUMP_DURATION,
          ease: 'power2.out'
        }, bumpLabel);
      }

      // Company field - travels left to physically hit the business card
      if (companyField && businessCard) {
        // Calculate distance to reach the card (with buffer so it just touches)
        const companyRect = (companyField as HTMLElement).getBoundingClientRect();
        const cardRect = (businessCard as HTMLElement).getBoundingClientRect();
        const distanceToCard = companyRect.left - cardRect.right + 50; // Generous buffer

        this.timeline.to(companyField, {
          x: -Math.max(distanceToCard * 0.6, BUMP_DISTANCE), // Travel less far left
          duration: BUMP_DURATION * 1.5,
          ease: 'power2.out'
        }, bumpLabel);

        // Trigger flip when company field hits card (at end of bump)
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
        });
      }

      // Email field - medium bump
      if (emailField) {
        this.timeline.to(emailField, {
          x: -BUMP_DISTANCE * 0.7,
          duration: BUMP_DURATION,
          ease: 'power2.out'
        }, bumpLabel);
      }

      // Button starts bouncing back
      this.timeline.to(submitButton, {
        x: 0,
        duration: 0.3,
        ease: 'power2.out'
      });

      // Name and email fields bounce back normally
      this.timeline.to([nameField, emailField].filter(Boolean), {
        x: 0,
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)',
        stagger: 0.03
      }, '-=0.2');

      // Company field bounces back and gently nudges the button
      if (companyField) {
        this.timeline.to(companyField, {
          x: BUMP_DISTANCE * 0.4, // Gentle nudge right
          duration: 0.35,
          ease: 'power2.out'
        }, '-=0.4');
      }

      // Button gets knocked to right (less forceful)
      if (submitButton) {
        this.timeline.to(submitButton, {
          x: '50vw',
          rotation: '+=180', // Half spin as it flies
          duration: 0.5,
          ease: 'power2.out'
        }, '-=0.2');
      }

      // Company field settles back to normal (subtle)
      if (companyField) {
        this.timeline.to(companyField, {
          x: 0,
          duration: 0.5,
          ease: 'power2.out'
        }, '-=0.3');
      }

      // Button rolls back into place, spinning as it rolls (like a wheel)
      // Rotation must end at original position: +180 (knock) - 540 (roll) = -360 (full circle back to start)
      if (submitButton) {
        this.timeline.to(submitButton, {
          x: 0,
          rotation: '-=540', // 1.5 rotations to end arrow in correct position
          duration: 2,
          ease: 'linear' // Linear so spin matches movement
        });
      }
    }

    // ========================================================================
    // CREATE SCROLL TRIGGER
    // Triggers animation when contact section scrolls into view
    // ========================================================================
    const scrollContainer = document.querySelector('main');

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: scrollContainer || undefined,
      start: 'top 90%', // Start when top of section hits 90% down viewport (earlier trigger)
      end: 'bottom top',
      toggleActions: 'play none none reverse', // play on enter, reverse on leave back
      animation: this.timeline,
      onEnter: () => {
        this.log('Contact section entered viewport - playing animation');
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
    this.cardClickHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Determine flip direction based on click position
      const rect = card.getBoundingClientRect();
      const clickX = e.clientX;
      const cardCenterX = rect.left + rect.width / 2;
      const flipDirection = clickX < cardCenterX ? -180 : 180;

      gsap.to(cardInner, {
        rotationY: `+=${flipDirection}`,
        duration: 0.8,
        ease: 'power2.inOut'
      });

      this.log(`Contact card flipped ${flipDirection > 0 ? 'right' : 'left'} via click`);
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
