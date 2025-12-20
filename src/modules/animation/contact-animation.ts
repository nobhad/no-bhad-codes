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

// Blur-in animation constants - subtle and fast
const BLUR_AMOUNT = 4;
const BLUR_DURATION = 0.3;

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
    // REDUCED MOTION CHECK
    // ========================================================================
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - skipping animation');
      return;
    }

    // ========================================================================
    // DETECT LAYOUT: Check if button is below message field (mobile layout)
    // ========================================================================
    const messageField = document.querySelector('#message')?.closest('.input-item') ||
                         document.querySelector('.contact-message-row');
    const submitButton = document.querySelector('.submit-button');

    let isButtonBelowMessage = false;
    if (messageField && submitButton) {
      const messageRect = messageField.getBoundingClientRect();
      const buttonRect = submitButton.getBoundingClientRect();
      // Button is below if its top is at or below the message field's bottom
      isButtonBelowMessage = buttonRect.top >= messageRect.bottom - 10;
    }

    if (isButtonBelowMessage) {
      this.setupMobileAnimation();
    } else {
      this.setupAnimation();
    }
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

    // Set initial blur state for section (desktop blur-in effect)
    gsap.set(this.container, {
      opacity: 0,
      filter: `blur(${BLUR_AMOUNT}px)`
    });

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

    // Blur-in the section container first
    this.timeline.to(this.container, {
      opacity: 1,
      filter: 'blur(0px)',
      duration: BLUR_DURATION,
      ease: 'power2.out'
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

    // Get dimensions for animation
    const inputFieldHeight = 60;
    const compressedHeight = 20; // Fields drop at this height, then expand

    // Measure FINAL section height before any transforms (fields at natural size)
    const finalSectionHeight = this.container.offsetHeight;

    // Clip the form container so stacked fields don't overflow above
    const formContainer = this.container.querySelector('.contact-form') ||
                          this.container.querySelector('.contact-form-column');

    // Container dimensions already locked at start - just set overflow
    if (formContainer) gsap.set(formContainer, { overflow: 'hidden' });

    // Lock section to final height during animation
    gsap.set(this.container, { minHeight: finalSectionHeight });

    // Message field - capture final dimensions before resizing
    const textarea = messageField?.querySelector('textarea') as HTMLTextAreaElement | null;
    const wrapper = messageField?.querySelector('.input-wrapper') || messageField;
    const finalTextareaHeight = textarea ? textarea.offsetHeight : 130;
    const finalMessageFieldHeight = messageField ? (messageField as HTMLElement).offsetHeight : 180;

    // Set up z-index - name on TOP of stack (highest z-index)
    if (nameField) gsap.set(nameField, { zIndex: 5, position: 'relative' });
    if (companyField) gsap.set(companyField, { zIndex: 4, position: 'relative' });
    if (emailField) gsap.set(emailField, { zIndex: 3, position: 'relative' });
    if (messageField) gsap.set(messageField, { zIndex: 2, position: 'relative' });
    if (submitButton) gsap.set(submitButton, { zIndex: 1, opacity: 0, scale: 0.8 });

    // Get all labels and inputs to hide text initially
    const nameLabel = nameField?.querySelector('label');
    const companyLabel = companyField?.querySelector('label');
    const emailLabel = emailField?.querySelector('label');
    const messageLabel = messageField?.querySelector('label');

    const nameInput = nameField?.querySelector('input') as HTMLInputElement | null;
    const companyInput = companyField?.querySelector('input') as HTMLInputElement | null;
    const emailInput = emailField?.querySelector('input') as HTMLInputElement | null;

    // Shared border-radius for all fields during cascade
    const fieldBorderRadius = '0 50px 50px 50px';
    const startWidth = 150;
    const inputFullWidth = 460;

    // All fields start at height 0 and narrow width
    // Each field will dynamically match the width of the field above when it appears
    if (nameField) {
      gsap.set(nameField, {
        height: 0,
        width: startWidth,
        overflow: 'hidden',
        borderRadius: fieldBorderRadius
      });
      if (nameInput) {
        gsap.set(nameInput, {
          height: compressedHeight,
          '--placeholder-opacity': 0
        });
      }
      if (nameLabel) gsap.set(nameLabel, { opacity: 0 });
    }
    if (companyField) {
      gsap.set(companyField, {
        height: 0,
        width: startWidth,
        overflow: 'hidden',
        borderRadius: fieldBorderRadius
      });
      if (companyInput) {
        gsap.set(companyInput, {
          height: compressedHeight,
          '--placeholder-opacity': 0
        });
      }
      if (companyLabel) gsap.set(companyLabel, { opacity: 0 });
    }
    if (emailField) {
      gsap.set(emailField, {
        height: 0,
        width: startWidth,
        overflow: 'hidden',
        borderRadius: fieldBorderRadius
      });
      if (emailInput) {
        gsap.set(emailInput, {
          height: compressedHeight,
          '--placeholder-opacity': 0
        });
      }
      if (emailLabel) gsap.set(emailLabel, { opacity: 0 });
    }
    if (messageField) {
      gsap.set(messageField, {
        height: 0,
        width: startWidth,
        overflow: 'hidden',
        borderRadius: fieldBorderRadius
      });
      if (textarea) {
        gsap.set(textarea, {
          height: compressedHeight,
          minHeight: compressedHeight,
          '--placeholder-opacity': 0
        });
      }
      if (wrapper && wrapper !== messageField) {
        gsap.set(wrapper, {
          height: compressedHeight,
          overflow: 'hidden'
        });
      }
      if (messageLabel) gsap.set(messageLabel, { opacity: 0 });
    }

    const totalDuration = 2.5; // Total animation duration
    const stagger = 0.3; // Stagger between each field

    // All fields animate together with stagger
    const allFieldWrappers = [nameField, companyField, emailField, messageField].filter(
      (el): el is Element => el !== null && el !== undefined
    );

    // Single continuous animation: all fields appear, expand height, and expand width together
    // HEIGHT: 0 → compressed → full (staggered per field)
    // WIDTH: startWidth → inputFullWidth (all together)

    // Phase 1: All fields appear (height 0 → compressed) with stagger
    allFieldWrappers.forEach((field, i) => {
      this.timeline?.to(field, {
        height: compressedHeight,
        duration: 0.4,
        ease: 'sine.out'
      }, i * stagger);
    });

    // Phase 2: All fields expand height together (compressed → full) - starts after first field appears
    const expandStart = stagger; // Start when second field begins appearing

    // Input fields expand to inputFieldHeight
    if (nameField) {
      this.timeline.to(nameField, {
        height: inputFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.5,
        ease: 'sine.inOut'
      }, expandStart);
    }
    if (nameInput) {
      this.timeline.to(nameInput, { height: inputFieldHeight, duration: 0.5, ease: 'sine.inOut' }, '<');
    }

    if (companyField) {
      this.timeline.to(companyField, {
        height: inputFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.5,
        ease: 'sine.inOut'
      }, expandStart + stagger);
    }
    if (companyInput) {
      this.timeline.to(companyInput, { height: inputFieldHeight, duration: 0.5, ease: 'sine.inOut' }, '<');
    }

    if (emailField) {
      this.timeline.to(emailField, {
        height: inputFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.5,
        ease: 'sine.inOut'
      }, expandStart + stagger * 2);
    }
    if (emailInput) {
      this.timeline.to(emailInput, { height: inputFieldHeight, duration: 0.5, ease: 'sine.inOut' }, '<');
    }

    // Message field expands to its final height
    if (messageField) {
      this.timeline.to(messageField, {
        height: finalMessageFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.5,
        ease: 'sine.inOut'
      }, expandStart + stagger * 3);
    }
    if (textarea) {
      this.timeline.to(textarea, {
        height: finalTextareaHeight,
        minHeight: finalTextareaHeight,
        duration: 0.5,
        ease: 'sine.inOut'
      }, '<');
    }
    if (wrapper && wrapper !== messageField) {
      this.timeline.to(wrapper, {
        height: 'auto',
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.5,
        ease: 'sine.inOut'
      }, '<');
    }

    // WIDTH: One continuous expansion for ALL fields together (runs throughout)
    // Input fields expand to 460px
    this.timeline.to([nameField, companyField, emailField].filter(Boolean), {
      width: inputFullWidth,
      duration: totalDuration * 0.8,
      ease: 'sine.inOut'
    }, 0);

    // Message field expands to 640px
    if (messageField) {
      this.timeline.to(messageField, {
        width: 640,
        duration: totalDuration * 0.8,
        ease: 'sine.inOut'
      }, 0);
    }

    // 6. Labels and placeholders fade in early (during field expansion)
    const allLabels = [nameLabel, companyLabel, emailLabel, messageLabel].filter(Boolean);
    const allInputsWithPlaceholders = [nameInput, companyInput, emailInput, textarea].filter(Boolean);

    // Start text fade-in during field expansion (at 0.8s into animation)
    const textFadeStart = 0.8;

    if (allLabels.length > 0) {
      this.timeline.to(allLabels, { opacity: 1, duration: 0.6, ease: 'power1.out' }, textFadeStart);
    }

    if (allInputsWithPlaceholders.length > 0) {
      this.timeline.to(allInputsWithPlaceholders, {
        '--placeholder-opacity': 1,
        duration: 0.6,
        ease: 'power1.out'
      }, textFadeStart);
    }

    // Button appears after fields are mostly expanded
    if (submitButton) {
      this.timeline.to(submitButton, {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: 'back.out(1.5)'
      }, '+=0.1');
    }

    // Restore overflow, section height, and clear inline widths after animation
    if (formContainer) {
      this.timeline.set(formContainer, { overflow: 'visible' });
    }
    this.timeline.set(this.container, { minHeight: 'auto' });

    // Keep all container dimensions locked permanently - do not clear

    // ========================================================================
    // BUSINESS CARD - Flip AFTER form and button animation is 100% complete
    // ========================================================================
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
      }, [], '+=0.15');
    }

    // ========================================================================
    // CREATE SCROLL TRIGGER WITH PINNING
    // Pins contact section while animation plays
    // ========================================================================
    const scrollContainer = document.querySelector('main');

    // Pause the timeline initially - we'll play it on trigger
    this.timeline.pause();

    this.scrollTrigger = ScrollTrigger.create({
      trigger: this.container,
      scroller: scrollContainer || undefined,
      start: 'top 25%', // Trigger when section is well into view
      onEnter: () => {
        this.log('Contact section visible - playing animation');
        this.timeline?.play();
      },
      onLeaveBack: () => {
        this.log('Contact section left viewport backwards');
        this.timeline?.reverse();
        // Blur-out when leaving
        if (this.container) {
          gsap.to(this.container, {
            opacity: 0,
            filter: `blur(${BLUR_AMOUNT}px)`,
            duration: BLUR_DURATION * 0.7,
            ease: 'power2.in'
          });
        }
      }
    });

    this.log('Contact animation initialized (desktop only)');
  }

  /**
   * Set up mobile-specific contact animation
   * Mobile: No animations - everything visible immediately
   */
  private setupMobileAnimation(): void {
    this.container = document.querySelector('.contact-section') as HTMLElement;
    if (!this.container) {
      this.log('Contact section not found');
      return;
    }

    // Mobile: Ensure everything is visible immediately - no animations
    gsap.set(this.container, {
      opacity: 1,
      filter: 'none',
      visibility: 'visible'
    });

    // Make sure all form fields are visible
    const allFields = this.container.querySelectorAll('.input-item, .input-wrapper');
    gsap.set(allFields, {
      opacity: 1,
      visibility: 'visible',
      transform: 'none'
    });

    // Make sure button is visible
    const submitButton = this.container.querySelector('.submit-button');
    if (submitButton) {
      gsap.set(submitButton, {
        opacity: 1,
        visibility: 'visible',
        x: 0,
        rotation: 0
      });
    }

    this.log('Contact animation initialized (mobile - no animations)');
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
