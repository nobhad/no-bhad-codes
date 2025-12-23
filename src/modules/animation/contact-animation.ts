/**
 * ===============================================
 * CONTACT SECTION ANIMATION MODULE
 * ===============================================
 * @file src/modules/contact-animation.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - DESKTOP ONLY - No animation on mobile
 * - Triggered by PageTransitionModule navigation events (virtual pages)
 * - Animates elements when navigating TO contact page
 * - Staggered reveal animation for visual interest
 *
 * ANIMATION SEQUENCE:
 * 1. Navigate to contact page (hash #/contact)
 * 2. h2 "contact" drops in from above
 * 3. Contact options text drops in (overlapped)
 * 4. Business card column drops in
 * 5. Form fields cascade: appear → expand height → expand width
 * 6. Labels and placeholders fade in
 * 7. Submit button appears
 * 8. Business card flips from back to front
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { ANIMATION_CONSTANTS } from '../../config/animation-constants';
import { throttle } from '../../utils/gsap-utilities';

// ============================================================================
// CONTACT ANIMATION MODULE CLASS
// ============================================================================

export class ContactAnimationModule extends BaseModule {
  private container: HTMLElement | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private hasFlippedCard = false;
  private cardClickHandler: ((e: MouseEvent) => void) | null = null;
  private cardMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private cardMouseLeaveHandler: (() => void) | null = null;
  private businessCardEl: HTMLElement | null = null;
  private businessCardInner: HTMLElement | null = null;
  private blurAnimationComplete = false; // Track if blur animation has completed

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
    // DETECT LAYOUT: Check viewport width instead of element positioning
    // ========================================================================
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 768;

    this.log(`Viewport width: ${viewportWidth}px, isMobile: ${isMobile}`);

    if (isMobile) {
      this.setupMobileAnimation();
    } else {
      this.setupAnimation();
    }
  }

  /**
   * Set up the contact section animation
   */
  private setupAnimation(): void {
    this.log('Setting up DESKTOP contact form animation...');

    this.container = document.querySelector('.contact-section') as HTMLElement;
    if (!this.container) {
      this.log('Contact section not found');
      return;
    }

    // Get animatable elements
    const heading = this.container.querySelector('h2');
    const contactOptions = this.container.querySelector('.contact-options');
    const businessCard = this.container.querySelector('#contact-business-card');
    const cardColumn = this.container.querySelector('.contact-card-column');

    // Debug: log what elements were found
    this.log(`Elements found - h2: ${!!heading}, contactOptions: ${!!contactOptions}, card: ${!!businessCard}, cardColumn: ${!!cardColumn}`);

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.log('Contact form animation complete');
      }
    });

    // ========================================================================
    // PHASE 1: h2 and card drop in TOGETHER
    // ========================================================================
    const dropDistance = ANIMATION_CONSTANTS.DIMENSIONS.CONTACT_DROP_DISTANCE;
    const dropDuration = ANIMATION_CONSTANTS.DURATIONS.FORM_FIELD_DROP;

    // h2 drops in
    if (heading) {
      this.timeline.fromTo(heading,
        { y: -dropDistance, opacity: 0 },
        { y: 0, opacity: 1, duration: dropDuration, ease: 'power2.out' },
        0
      );
    }

    // Contact options drops in with h2 (if exists - mobile only)
    if (contactOptions) {
      this.timeline.fromTo(contactOptions,
        { y: -dropDistance, opacity: 0 },
        { y: 0, opacity: 1, duration: dropDuration, ease: 'power2.out' },
        0
      );
    }

    // Card column drops in at same time as h2
    if (cardColumn) {
      this.timeline.fromTo(cardColumn,
        { y: -dropDistance, opacity: 0 },
        { y: 0, opacity: 1, duration: dropDuration, ease: 'power2.out' },
        0
      );
    }

    // Business card setup
    if (businessCard) {
      const cardInner = businessCard.querySelector('.business-card-inner') as HTMLElement;

      // Start with back showing (rotated 180) - set immediately
      if (cardInner) {
        gsap.set(cardInner, { rotationY: 180 });
      }

      // Setup click handler for manual card flip
      this.setupCardClickHandler(businessCard as HTMLElement);
    }

    // ========================================================================
    // PHASE 3: Form fields cascade animation
    // ========================================================================
    const nameField = this.container.querySelector('#name')?.closest('.input-item');
    const companyField = this.container.querySelector('#company')?.closest('.input-item');
    const emailField = this.container.querySelector('#email')?.closest('.input-item');
    const messageField = this.container.querySelector('#message')?.closest('.input-item') ||
                         this.container.querySelector('textarea')?.closest('.input-item');
    const submitButton = this.container.querySelector('button[type="submit"]') ||
                         this.container.querySelector('.contact-submit');

    // Get dimensions for animation (from centralized constants)
    const inputFieldHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_HEIGHT;
    const compressedHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_COMPRESSED;

    // Measure FINAL section height before any transforms (fields at natural size)
    const finalSectionHeight = this.container.offsetHeight;

    // Clip the form container so stacked fields don't overflow above
    const formContainer = this.container.querySelector('.contact-form') ||
                          this.container.querySelector('.contact-form-column');

    // Container dimensions already locked at start - just set overflow
    if (formContainer) gsap.set(formContainer, { overflow: 'hidden' });

    // Lock section to final height during animation
    gsap.set(this.container, { minHeight: finalSectionHeight });

    // Message field - use CSS variable for reliable height
    const textarea = messageField?.querySelector('textarea') as HTMLTextAreaElement | null;
    const wrapper = messageField?.querySelector('.input-wrapper') || messageField;

    // Get textarea height from CSS variable or use default
    const rootStyles = window.getComputedStyle(document.documentElement);
    const textareaHeightVar = rootStyles.getPropertyValue('--contact-textarea-height').trim();
    const finalTextareaHeight = parseInt(textareaHeightVar, 10) || 155;
    const finalMessageFieldHeight = finalTextareaHeight + 20; // Add padding

    this.log(`Message field target height: ${finalTextareaHeight}px`);

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
    const startWidth = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_WIDTH_START;
    const inputFullWidth = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_WIDTH_FULL;

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

    const totalDuration = ANIMATION_CONSTANTS.SEQUENCES.CONTACT_FORM.TOTAL_DURATION;
    const stagger = ANIMATION_CONSTANTS.SEQUENCES.CONTACT_FORM.FIELD_STAGGER;
    const formStartTime = dropDuration; // Form starts AFTER h2/card drop completes

    // All fields animate together with stagger
    const allFieldWrappers = [nameField, companyField, emailField, messageField].filter(
      (el): el is Element => el !== null && el !== undefined
    );

    // Single continuous animation: all fields appear, expand height, and expand width together
    // HEIGHT: 0 → compressed → full (staggered per field)
    // WIDTH: startWidth → inputFullWidth (all together)

    // Phase 1: All fields appear (height 0 → compressed) with stagger
    // Starts AFTER h2/card drop animation
    allFieldWrappers.forEach((field, i) => {
      this.timeline?.to(field, {
        height: compressedHeight,
        duration: 0.4,
        ease: 'sine.out'
      }, formStartTime + i * stagger);
    });

    // Phase 2: All fields expand height together (compressed → full) - starts after first field appears
    const expandStart = formStartTime + stagger; // Start when second field begins appearing

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
      this.timeline.to(nameInput, { height: inputFieldHeight, opacity: 1, duration: 0.5, ease: 'sine.inOut' }, '<');
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
      this.timeline.to(companyInput, { height: inputFieldHeight, opacity: 1, duration: 0.5, ease: 'sine.inOut' }, '<');
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
      this.timeline.to(emailInput, { height: inputFieldHeight, opacity: 1, duration: 0.5, ease: 'sine.inOut' }, '<');
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
        opacity: 1,
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

    // WIDTH: One continuous expansion for ALL fields together (runs throughout form phase)
    // Input fields expand to 460px
    this.timeline.to([nameField, companyField, emailField].filter(Boolean), {
      width: inputFullWidth,
      duration: totalDuration * 0.8,
      ease: 'sine.inOut'
    }, formStartTime);

    // Message field expands to 640px
    if (messageField) {
      this.timeline.to(messageField, {
        width: 640,
        duration: totalDuration * 0.8,
        ease: 'sine.inOut'
      }, formStartTime);
    }

    // 6. Labels and placeholders fade in early (during field expansion)
    const allLabels = [nameLabel, companyLabel, emailLabel, messageLabel].filter(Boolean);
    const allInputsWithPlaceholders = [nameInput, companyInput, emailInput, textarea].filter(Boolean);

    // Start text fade-in during field expansion
    const textFadeStart = formStartTime + 0.8;

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

    // Set final state for placeholders and labels to ensure they stay visible
    if (allLabels.length > 0) {
      this.timeline.set(allLabels, { opacity: 1 });
    }
    if (allInputsWithPlaceholders.length > 0) {
      this.timeline.set(allInputsWithPlaceholders, { '--placeholder-opacity': 1 });
    }

    // Keep all container dimensions locked permanently - do not clear

    // ========================================================================
    // BUSINESS CARD - Flip AFTER form and button animation is 100% complete
    // Card flip starts after: dropDuration (0.6) + totalDuration (2.5) + button (0.7) = ~3.8s
    // ========================================================================
    const cardFlipStart = formStartTime + totalDuration + 0.5;

    if (businessCard) {
      const cardInner = businessCard.querySelector('.business-card-inner') as HTMLElement;
      if (cardInner) {
        this.timeline.to(cardInner, {
          rotationY: '+=180',
          duration: 0.8,
          ease: 'power2.inOut',
          onStart: () => {
            this.hasFlippedCard = true;
          }
        }, cardFlipStart);
      }
    }

    this.timeline.pause();

    this.on('PageTransitionModule:contact-page-ready', (() => {
      this.blurAnimationComplete = true;
      this.playFormAnimation();
    }) as EventListener);

    // Fallback listener
    this.on('PageTransitionModule:page-changed', ((event: CustomEvent) => {
      const { to } = event.detail || {};
      if (to === 'contact' && !this.blurAnimationComplete) {
        setTimeout(() => {
          if (!this.blurAnimationComplete && !this.timeline?.isActive()) {
            this.blurAnimationComplete = true;
            this.playFormAnimation();
          }
        }, 3000);
      }
    }) as EventListener);

    this.on('PageTransitionModule:page-changed', ((event: CustomEvent) => {
      const { to, from } = event.detail || {};

      if (from === 'contact') {
        this.playOutAnimation();
        this.blurAnimationComplete = false;
      }

      if (to === 'contact') {
        this.resetAnimatedElements();
        this.blurAnimationComplete = false;
      }
    }) as EventListener);

    const currentHash = window.location.hash;
    if (currentHash === '#/contact' || currentHash === '#contact') {
      this.resetAnimatedElements();
      setTimeout(() => {
        if (!this.blurAnimationComplete && !this.timeline?.isActive()) {
          this.blurAnimationComplete = true;
          this.playFormAnimation();
        }
      }, 10000);
    }

    this.log('Contact animation initialized');
  }

  /**
   * Play the form animation
   */
  private playFormAnimation(): void {
    if (!this.container || !this.timeline) return;

    const contactContent = this.container.querySelector('.contact-content');
    if (contactContent) {
      gsap.set(contactContent, { opacity: 1 });
    }

    this.resetAnimatedElements();

    requestAnimationFrame(() => {
      this.timeline?.restart();
    });
  }

  /**
   * Play out animation when leaving contact page
   */
  private playOutAnimation(): void {
    if (!this.container) return;
    this.timeline?.kill();
    this.resetAnimatedElements();
  }

  /**
   * Reset all animated elements to their initial animation state
   */
  private resetAnimatedElements(): void {
    if (!this.container) return;

    const dropDistance = ANIMATION_CONSTANTS.DIMENSIONS.CONTACT_DROP_DISTANCE;
    const fieldBorderRadius = '0 50px 50px 50px';
    const startWidth = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_WIDTH_START;
    const compressedHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_COMPRESSED;

    // Reset header elements
    const heading = this.container.querySelector('h2');
    const contactOptions = this.container.querySelector('.contact-options');
    const cardColumn = this.container.querySelector('.contact-card-column');

    if (heading) gsap.set(heading, { y: -dropDistance, opacity: 0 });
    if (contactOptions) gsap.set(contactOptions, { y: -dropDistance, opacity: 0 });
    if (cardColumn) gsap.set(cardColumn, { y: -dropDistance, opacity: 0 });

    // Reset form container
    const formContainer = this.container.querySelector('.contact-form') ||
                          this.container.querySelector('.contact-form-column');
    if (formContainer) gsap.set(formContainer, { overflow: 'hidden' });

    // Reset form fields
    const fields = [
      this.container.querySelector('#name')?.closest('.input-item'),
      this.container.querySelector('#company')?.closest('.input-item'),
      this.container.querySelector('#email')?.closest('.input-item'),
      this.container.querySelector('#message')?.closest('.input-item') ||
        this.container.querySelector('textarea')?.closest('.input-item')
    ];

    fields.forEach((field, i) => {
      if (!field) return;

      gsap.set(field, {
        height: 0,
        width: startWidth,
        overflow: 'hidden',
        borderRadius: fieldBorderRadius,
        zIndex: 5 - i,
        position: 'relative'
      });

      const input = field.querySelector('input, textarea');
      if (input) {
        gsap.set(input, {
          height: compressedHeight,
          '--placeholder-opacity': 0,
          opacity: 0
        });
        if (input.tagName === 'TEXTAREA') {
          gsap.set(input, { minHeight: compressedHeight });
        }
      }

      const label = field.querySelector('label');
      if (label) gsap.set(label, { opacity: 0 });
    });

    // Reset button
    const submitButton = this.container.querySelector('.submit-button, button[type="submit"]');
    if (submitButton) gsap.set(submitButton, { zIndex: 1, opacity: 0, scale: 0.8 });

    // Reset business card
    const businessCard = this.container.querySelector('#contact-business-card');
    const cardInner = businessCard?.querySelector('.business-card-inner');
    if (cardInner) gsap.set(cardInner, { rotationY: 180 });

    this.hasFlippedCard = false;
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

    // Setup 3D perspective and clear CSS transition to prevent GSAP conflicts
    gsap.set(card, { perspective: 1000 });
    gsap.set(cardInner, { transformStyle: 'preserve-3d', transition: 'none' });

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

    // Mouse move handler for tilt effect (throttled for performance)
    const maxTiltAngle = 12;
    const handleMouseMove = (e: MouseEvent) => {
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

    // Throttle mousemove handler for performance
    this.cardMouseMoveHandler = throttle(
      handleMouseMove,
      ANIMATION_CONSTANTS.PERFORMANCE.THROTTLE_MOUSE_MOVE
    );

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
      hasTimeline: !!this.timeline
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
