/**
 * ===============================================
 * CONTACT SECTION ANIMATION MODULE
 * ===============================================
 * @file src/modules/contact-animation.ts
 * @extends BaseModule
 *
 * THREE-TIER ANIMATION STRATEGY:
 * Breakpoints match CSS layout breakpoints for consistency.
 *
 * DESKTOP (>1100px):
 * - Full blur-in animation with form field cascade
 * - Submit button scales up with blur clear
 * - Avatar blurb animates in
 *
 * TABLET (600-1100px):
 * - Simple fade-in animation only (no transforms)
 * - CSS handles all positioning (grid layout)
 * - No button roll or position transforms
 *
 * MOBILE (<600px):
 * - No GSAP animation - PageTransitionModule handles page transitions
 * - CSS handles stacked layout
 * - Elements shown immediately
 *
 * ANIMATION SEQUENCE (Desktop):
 * 1. Navigate to contact page (hash #/contact)
 * 2. h2 "contact" blur in
 * 3. Contact options text shows immediately
 * 4. Card column blur in
 * 5. Form fields + Submit button + Avatar blurb all animate together (synced)
 * 6. Labels and placeholders fade in
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { ANIMATION_CONSTANTS } from '../../config/animation-constants';
import { getDebugMode } from '../../core/env';
import { createDOMCache } from '../../utils/dom-cache';

// DOM element keys for caching
type ContactAnimationDOMKeys = Record<string, string>;

// ============================================================================
// CONTACT ANIMATION MODULE CLASS
// ============================================================================

export class ContactAnimationModule extends BaseModule {
  private container: HTMLElement | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private blurAnimationComplete = false; // Track if blur animation has completed

  /** DOM element cache */
  private domCache = createDOMCache<ContactAnimationDOMKeys>();

  constructor(options: ModuleOptions = {}) {
    super('ContactAnimationModule', { debug: getDebugMode(), ...options });

    // Register DOM element selectors
    this.domCache.register({
      contactSection: '.contact-section',
      nameInput: '#name',
      companyInput: '#company',
      emailInput: '#email',
      messageInput: '#message'
    });
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
    // THREE-TIER ANIMATION: Match CSS layout breakpoints
    // Desktop (>1100px): Full animation
    // Tablet (600-1100px): Simple fade-in only
    // Mobile (<600px): No animation - PageTransitionModule handles it
    // ========================================================================
    const viewportWidth = window.innerWidth;
    const isDesktop = viewportWidth >= 1100;
    const isTablet = viewportWidth >= 600 && viewportWidth < 1100;
    const isMobile = viewportWidth < 600;

    this.log(`Viewport: ${viewportWidth}px | Desktop: ${isDesktop}, Tablet: ${isTablet}, Mobile: ${isMobile}`);

    if (isDesktop) {
      this.setupAnimation();
    } else if (isTablet) {
      this.setupTabletAnimation();
    } else {
      this.setupMobileAnimation();
    }
  }

  /**
   * Set up the contact section animation
   */
  private setupAnimation(): void {
    this.log('Setting up DESKTOP contact form animation...');

    // Kill any existing timeline to prevent state accumulation
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.container = this.domCache.get('contactSection');
    if (!this.container) {
      this.log('Contact section not found');
      return;
    }

    // Get animatable elements
    const heading = this.container.querySelector('h2');
    const hr = this.container.querySelector('hr');
    const contactOptions = this.container.querySelector('.contact-options');
    const cardColumn = this.container.querySelector('.contact-card-column');
    const avatarBlurb = this.container.querySelector('.avatar-blurb-container');

    // Debug: log what elements were found
    this.log(`Elements found - h2: ${!!heading}, hr: ${!!hr}, contactOptions: ${!!contactOptions}, cardColumn: ${!!cardColumn}, avatarBlurb: ${!!avatarBlurb}`);

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.log('Contact form animation complete');
      }
    });

    // ========================================================================
    // PHASE 1: h2 and card BLUR IN (fade in while blurred, then clear blur)
    // Ultra-fast timing for snappy feel
    // ========================================================================
    const blurAmount = 4;
    const blurFadeDuration = 0.15; // Very fast fade in
    const blurClearDuration = 0.15; // Very fast blur clear
    const blurPause = 0; // No pause
    const dropDuration = blurFadeDuration + blurPause + blurClearDuration; // Total blur phase duration (~0.3s)

    // Set initial blur state with will-change hint for GPU acceleration
    if (heading) {
      gsap.set(heading, {
        opacity: 0,
        filter: `blur(${blurAmount}px)`,
        willChange: 'filter, opacity' // GPU acceleration hint
      });
    }
    // Hide hr initially so it doesn't appear before h2
    if (hr) {
      gsap.set(hr, { opacity: 0 });
    }
    // Contact options (nav links) show immediately - no animation delay
    if (contactOptions) {
      gsap.set(contactOptions, {
        opacity: 1,
        filter: 'blur(0px)'
      });
    }
    if (cardColumn) {
      gsap.set(cardColumn, {
        opacity: 0,
        filter: `blur(${blurAmount}px)`,
        willChange: 'filter, opacity'
      });
    }
    // Avatar blurb starts scaled down, blurred, and invisible
    if (avatarBlurb) {
      gsap.set(avatarBlurb, {
        opacity: 0,
        scale: 0.8,
        filter: `blur(${blurAmount}px)`,
        transformOrigin: 'center center'
      });
    }

    // Fade in while blurred
    if (heading) {
      this.timeline.to(heading, {
        opacity: 1,
        duration: blurFadeDuration,
        ease: 'power2.out'
      }, 0);
    }
    // contactOptions already visible - no animation needed
    if (cardColumn) {
      this.timeline.to(cardColumn, {
        opacity: 1,
        duration: blurFadeDuration,
        ease: 'power2.out'
      }, 0);
    }

    // Brief pause then clear blur
    this.timeline.to({}, { duration: blurPause });

    if (heading) {
      this.timeline.to(heading, {
        filter: 'blur(0px)',
        duration: blurClearDuration,
        ease: 'power2.out'
      }, '>');
    }
    // contactOptions already visible - no blur animation
    if (cardColumn) {
      this.timeline.to(cardColumn, {
        filter: 'blur(0px)',
        duration: blurClearDuration,
        ease: 'power2.out'
      }, '<');
    }

    // Clean up will-change after blur animations complete
    this.timeline.set([heading, cardColumn].filter(Boolean), {
      willChange: 'auto'
    });

    // Fade in hr after h2 animation completes (appears after h2 is fully visible)
    if (hr) {
      this.timeline.to(hr, {
        opacity: 1,
        duration: blurClearDuration,
        ease: 'power2.out'
      }, '>');
    }

    // ========================================================================
    // PHASE 3: Form fields cascade animation
    // PERFORMANCE: Batch all DOM reads before writes to prevent layout thrashing
    // ========================================================================

    // === BATCH 1: DOM QUERIES (no layout forcing) ===
    const nameField = this.domCache.get('nameInput')?.closest('.input-item');
    const companyField = this.domCache.get('companyInput')?.closest('.input-item');
    const emailField = this.domCache.get('emailInput')?.closest('.input-item');
    const messageField = this.domCache.get('messageInput')?.closest('.input-item') ||
                         this.container.querySelector('textarea')?.closest('.input-item');
    const submitButton = this.container.querySelector('button[type="submit"]') ||
                         this.container.querySelector('.contact-submit');
    const _formContainer = this.container.querySelector('.contact-form') ||
                          this.container.querySelector('.contact-form-column');
    const textarea = messageField?.querySelector('textarea') as HTMLTextAreaElement | null;
    const wrapper = messageField?.querySelector('.input-wrapper') || messageField;
    const nameLabel = nameField?.querySelector('label');
    const companyLabel = companyField?.querySelector('label');
    const emailLabel = emailField?.querySelector('label');
    const messageLabel = messageField?.querySelector('label');
    const nameInput = nameField?.querySelector('input') as HTMLInputElement | null;
    const companyInput = companyField?.querySelector('input') as HTMLInputElement | null;
    const emailInput = emailField?.querySelector('input') as HTMLInputElement | null;

    // === BATCH 2: LAYOUT-FORCING READS (do all at once) ===
    const finalSectionHeight = this.container.offsetHeight;
    const rootStyles = window.getComputedStyle(document.documentElement);
    const textareaHeightVar = rootStyles.getPropertyValue('--contact-textarea-height').trim();

    // === BATCH 3: CALCULATIONS (no DOM access) ===
    const inputFieldHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_HEIGHT;
    const compressedHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_COMPRESSED;
    const finalTextareaHeight = parseInt(textareaHeightVar, 10) || 155;
    const finalMessageFieldHeight = finalTextareaHeight + 20; // Add padding

    this.log(`Message field target height: ${finalTextareaHeight}px`);

    // === BATCH 4: DOM WRITES (all gsap.set calls together) ===
    // Lock section to final height
    // NOTE: Don't set overflow:hidden on formContainer - it clips the button during width animation
    gsap.set(this.container, { minHeight: finalSectionHeight });

    // Set up z-index - name on TOP of stack (highest z-index)
    if (nameField) gsap.set(nameField, { zIndex: 5, position: 'relative' });
    if (companyField) gsap.set(companyField, { zIndex: 4, position: 'relative' });
    if (emailField) gsap.set(emailField, { zIndex: 3, position: 'relative' });
    if (messageField) gsap.set(messageField, { zIndex: 2, position: 'relative' });
    // Button needs higher z-index to stay visible during form width animation
    if (submitButton) gsap.set(submitButton, { zIndex: 10, opacity: 0, scale: 0.8, filter: `blur(${blurAmount}px)` });

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

    // Avatar blurb scales up and clears blur in sync with form fields cascade
    if (avatarBlurb) {
      this.timeline.to(avatarBlurb, {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.5,
        ease: 'back.out(1.4)'
      }, formStartTime);

      // Star glow animation - starts after avatar blurb appears
      const starGlow = avatarBlurb.querySelector('#STAR_GLOW') as SVGPathElement | null;

      if (starGlow) {
        // Glow starts invisible
        gsap.set(starGlow, {
          opacity: 0
        });

        // Fade in star glow
        this.timeline.to(starGlow, {
          opacity: 1,
          duration: 0.8,
          ease: 'power2.out'
        }, formStartTime + 0.5);

        // Continuous pulsing glow animation (glow overflows beyond star shape)
        const glowTimeline = gsap.timeline({ repeat: -1, repeatDelay: 0 });
        glowTimeline
          .to(starGlow, {
            opacity: 0.7,
            duration: 1.5,
            ease: 'sine.inOut'
          })
          .to(starGlow, {
            opacity: 1,
            duration: 1.5,
            ease: 'sine.inOut'
          });

        // Start glow pulse animation after fade-in
        this.timeline.add(glowTimeline, formStartTime + 1.3);
      }
    }

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
        duration: 0.2,
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
        duration: 0.25,
        ease: 'sine.inOut'
      }, expandStart);
    }
    if (nameInput) {
      this.timeline.to(nameInput, { height: inputFieldHeight, opacity: 1, duration: 0.25, ease: 'sine.inOut' }, '<');
    }

    if (companyField) {
      this.timeline.to(companyField, {
        height: inputFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.25,
        ease: 'sine.inOut'
      }, expandStart + stagger);
    }
    if (companyInput) {
      this.timeline.to(companyInput, { height: inputFieldHeight, opacity: 1, duration: 0.25, ease: 'sine.inOut' }, '<');
    }

    if (emailField) {
      this.timeline.to(emailField, {
        height: inputFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.25,
        ease: 'sine.inOut'
      }, expandStart + stagger * 2);
    }
    if (emailInput) {
      this.timeline.to(emailInput, { height: inputFieldHeight, opacity: 1, duration: 0.25, ease: 'sine.inOut' }, '<');
    }

    // Message field expands to its final height
    if (messageField) {
      this.timeline.to(messageField, {
        height: finalMessageFieldHeight,
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.25,
        ease: 'sine.inOut'
      }, expandStart + stagger * 3);
    }
    if (textarea) {
      this.timeline.to(textarea, {
        height: finalTextareaHeight,
        minHeight: finalTextareaHeight,
        opacity: 1,
        duration: 0.25,
        ease: 'sine.inOut'
      }, '<');
    }
    if (wrapper && wrapper !== messageField) {
      this.timeline.to(wrapper, {
        height: 'auto',
        overflow: 'visible',
        clearProps: 'borderRadius',
        duration: 0.25,
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

    // Message field expands to full width (640px)
    const messageFullWidth = ANIMATION_CONSTANTS.DIMENSIONS.FORM_MESSAGE_WIDTH_FULL;
    if (messageField) {
      this.timeline.to(messageField, {
        width: messageFullWidth,
        duration: totalDuration * 0.8,
        ease: 'sine.inOut'
      }, formStartTime);
    }

    // 6. Labels and placeholders fade in early (during field expansion)
    const allLabels = [nameLabel, companyLabel, emailLabel, messageLabel].filter(Boolean);
    const allInputsWithPlaceholders = [nameInput, companyInput, emailInput, textarea].filter(Boolean);

    // Start text fade-in during field expansion
    const textFadeStart = formStartTime + 0.2;

    if (allLabels.length > 0) {
      this.timeline.to(allLabels, { opacity: 1, duration: 0.3, ease: 'power1.out' }, textFadeStart);
    }

    if (allInputsWithPlaceholders.length > 0) {
      this.timeline.to(allInputsWithPlaceholders, {
        '--placeholder-opacity': 1,
        duration: 0.3,
        ease: 'power1.out'
      }, textFadeStart);
    }

    // Button scales up and clears blur in sync with form fields and avatar blurb
    if (submitButton) {
      this.timeline.to(submitButton, {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.5,
        ease: 'back.out(1.4)'
      }, formStartTime);
    }

    // Restore section height after animation
    this.timeline.set(this.container, { minHeight: 'auto' });

    // Set final state for placeholders and labels to ensure they stay visible
    if (allLabels.length > 0) {
      this.timeline.set(allLabels, { opacity: 1 });
    }
    if (allInputsWithPlaceholders.length > 0) {
      this.timeline.set(allInputsWithPlaceholders, { '--placeholder-opacity': 1 });
    }

    // Keep all container dimensions locked permanently - do not clear

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
    // Don't kill timeline - just pause it so it can be restarted
    // Killing prevents restart() from working on re-entry
    this.timeline?.pause();
    this.timeline?.progress(0);
    this.resetAnimatedElements();
  }

  /**
   * Reset all animated elements to their initial animation state
   */
  private resetAnimatedElements(): void {
    if (!this.container) return;

    const blurAmount = 4; // Match setupAnimation blur amount
    const fieldBorderRadius = '0 50px 50px 50px';
    const startWidth = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_WIDTH_START;
    const compressedHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_COMPRESSED;

    // Reset header elements to blur state with will-change for GPU acceleration
    const heading = this.container.querySelector('h2');
    const hr = this.container.querySelector('hr');
    const contactOptions = this.container.querySelector('.contact-options');
    const cardColumn = this.container.querySelector('.contact-card-column');

    if (heading) gsap.set(heading, { opacity: 0, filter: `blur(${blurAmount}px)`, willChange: 'filter, opacity' });
    // Hide hr so it doesn't appear before h2 - hr should appear after h2 or not animate
    if (hr) gsap.set(hr, { opacity: 0 });
    // Contact options (nav links) show immediately - no animation
    if (contactOptions) gsap.set(contactOptions, { opacity: 1, filter: 'blur(0px)' });
    if (cardColumn) gsap.set(cardColumn, { opacity: 0, filter: `blur(${blurAmount}px)`, willChange: 'filter, opacity' });

    // Reset avatar blurb to initial scaled-down, blurred state
    const avatarBlurb = this.container.querySelector('.avatar-blurb-container');
    if (avatarBlurb) gsap.set(avatarBlurb, { opacity: 0, scale: 0.8, filter: `blur(${blurAmount}px)`, transformOrigin: 'center center' });

    // Get form container reference (no overflow changes - causes button clipping)
    const _formContainer = this.container.querySelector('.contact-form') ||
                          this.container.querySelector('.contact-form-column');

    // Reset form fields
    const fields = [
      this.domCache.get('nameInput')?.closest('.input-item'),
      this.domCache.get('companyInput')?.closest('.input-item'),
      this.domCache.get('emailInput')?.closest('.input-item'),
      this.domCache.get('messageInput')?.closest('.input-item') ||
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
    if (submitButton) gsap.set(submitButton, { zIndex: 10, opacity: 0, scale: 0.8, filter: `blur(${blurAmount}px)` });
  }

  /**
   * Set up tablet-specific contact animation (600-1100px)
   * Simple fade-in with avatar blurb animation - no transforms on button
   * CSS handles grid layout positioning
   */
  private setupTabletAnimation(): void {
    this.log('Setting up TABLET contact form animation...');

    // Kill any existing timeline to prevent state accumulation
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.container = this.domCache.get('contactSection');
    if (!this.container) {
      this.log('Contact section not found');
      return;
    }

    // Get animatable elements
    const heading = this.container.querySelector('h2');
    const contactOptions = this.container.querySelector('.contact-options');
    const cardColumn = this.container.querySelector('.contact-card-column');
    const avatarBlurb = this.container.querySelector('.avatar-blurb-container');
    const submitButton = this.container.querySelector('.submit-button') as HTMLElement;
    const formFields = this.container.querySelectorAll('.input-item');
    const labels = this.container.querySelectorAll('.input-item label');

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.log('Tablet contact form animation complete');
      }
    });

    const blurAmount = 4;
    const fadeDuration = 0.3;

    // Set initial states - opacity/blur only, NO transforms on positioned elements
    if (heading) gsap.set(heading, { opacity: 0, filter: `blur(${blurAmount}px)` });
    if (contactOptions) gsap.set(contactOptions, { opacity: 1 }); // Show immediately
    if (cardColumn) gsap.set(cardColumn, { opacity: 0, filter: `blur(${blurAmount}px)` });

    // Avatar blurb - scale animation is OK here since it's not grid-positioned
    if (avatarBlurb) {
      gsap.set(avatarBlurb, {
        opacity: 0,
        scale: 0.8,
        filter: `blur(${blurAmount}px)`,
        transformOrigin: 'center center'
      });
    }

    // Form fields - just opacity, no height/width transforms
    formFields.forEach(field => {
      gsap.set(field, { opacity: 0 });
    });
    labels.forEach(label => {
      gsap.set(label, { opacity: 0 });
    });

    // Submit button - opacity only, NO x/rotation transforms (CSS handles position)
    if (submitButton) {
      gsap.set(submitButton, { opacity: 0, filter: `blur(${blurAmount}px)` });
    }

    // PHASE 1: Heading and card column fade in
    if (heading) {
      this.timeline.to(heading, { opacity: 1, filter: 'blur(0px)', duration: fadeDuration, ease: 'power2.out' }, 0);
    }
    if (cardColumn) {
      this.timeline.to(cardColumn, { opacity: 1, filter: 'blur(0px)', duration: fadeDuration, ease: 'power2.out' }, 0);
    }

    // PHASE 2: Avatar blurb scales up (the key animation user wants)
    if (avatarBlurb) {
      this.timeline.to(avatarBlurb, {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.5,
        ease: 'back.out(1.4)'
      }, 0.1);
    }

    // PHASE 3: Form fields and button fade in
    this.timeline.to(formFields, {
      opacity: 1,
      duration: fadeDuration,
      stagger: 0.05,
      ease: 'power2.out'
    }, 0.15);

    this.timeline.to(labels, {
      opacity: 1,
      duration: fadeDuration,
      ease: 'power2.out'
    }, 0.2);

    if (submitButton) {
      this.timeline.to(submitButton, {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.4,
        ease: 'power2.out'
      }, 0.2);
    }

    // Pause timeline - wait for page transition
    this.timeline.pause();

    // Listen for page transition events
    this.on('PageTransitionModule:contact-page-ready', (() => {
      this.blurAnimationComplete = true;
      this.timeline?.restart();
    }) as EventListener);

    this.on('PageTransitionModule:page-changed', ((event: CustomEvent) => {
      const { to, from } = event.detail || {};
      if (from === 'contact') {
        this.timeline?.pause();
        this.timeline?.progress(0);
        this.blurAnimationComplete = false;
      }
      if (to === 'contact' && !this.blurAnimationComplete) {
        setTimeout(() => {
          if (!this.blurAnimationComplete && !this.timeline?.isActive()) {
            this.blurAnimationComplete = true;
            this.timeline?.restart();
          }
        }, 3000);
      }
    }) as EventListener);

    // Check if already on contact page
    const currentHash = window.location.hash;
    if (currentHash === '#/contact' || currentHash === '#contact') {
      setTimeout(() => {
        if (!this.blurAnimationComplete && !this.timeline?.isActive()) {
          this.blurAnimationComplete = true;
          this.timeline?.restart();
        }
      }, 500);
    }

    this.log('Contact animation initialized (tablet - fade-in with avatar blurb)');
  }

  /**
   * Set up mobile-specific contact animation (<600px)
   * No GSAP animation - PageTransitionModule handles page transitions
   * Just ensure elements are visible
   */
  private setupMobileAnimation(): void {
    this.log('Setting up MOBILE contact - no GSAP animation');

    // Kill any existing timeline
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.container = this.domCache.get('contactSection');
    if (!this.container) {
      this.log('Contact section not found');
      return;
    }

    // Mobile: Ensure all elements are visible - no animation
    // PageTransitionModule handles page transitions
    const allElements = this.container.querySelectorAll(
      'h2, .contact-options, .contact-card-column, .avatar-blurb-container, ' +
      '.input-item, .input-wrapper, .submit-button, label'
    );

    gsap.set(allElements, {
      opacity: 1,
      visibility: 'visible',
      filter: 'blur(0px)',
      transform: 'none',
      clearProps: 'scale,x,y,rotation'
    });

    this.log('Contact animation initialized (mobile - elements visible, no animation)');
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
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }

    this.container = null;

    await super.destroy();
  }
}
