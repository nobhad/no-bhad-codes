/**
 * ===============================================
 * CONTACT SECTION ANIMATION MODULE
 * ===============================================
 * @file src/modules/contact-animation.ts
 * @extends BaseModule
 *
 * ANIMATION SEQUENCE (all screen sizes):
 * 1. Navigate to contact page (hash #/contact)
 * 2. h2 "contact" blur in
 * 3. Contact options text + HR fade in
 * 4. Card column blur in (hidden on mobile via CSS — no visual effect)
 * 5. Form fields cascade: appear staggered, expand height, expand width
 * 6. Submit button scales up with blur clear
 * 7. Labels and placeholders fade in
 *
 * Width reads are lazy (getInputWidth called at tween time, not setup time)
 * to handle SPA — section is hidden when init() runs, offsetWidth would
 * return 0. The lazy getter reads the correct width when the section is visible.
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
import { ANIMATION_CONSTANTS } from '../../config/animation-constants';
import { getDebugMode } from '../../core/env';
import { createDOMCache } from '../../utils/dom-cache';
import { Z_INDEX_CONTACT_FORM } from '../../constants/z-index';

// DOM element keys for caching
type ContactAnimationDOMKeys = Record<string, string>;

// ============================================================================
// CONTACT ANIMATION MODULE CLASS
// ============================================================================

export class ContactAnimationModule extends BaseModule {
  private container: HTMLElement | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private blurAnimationComplete = false; // Track if blur animation has completed
  private starGlowAnimation: gsap.core.Tween | null = null; // Independent star glow pulse

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

    this.setupAnimation();
  }

  /**
   * Set up the contact section animation
   */
  private setupAnimation(): void {
    this.log('Setting up contact form animation...');

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
    this.log(
      `Elements found - h2: ${!!heading}, hr: ${!!hr}, contactOptions: ${!!contactOptions}, cardColumn: ${!!cardColumn}, avatarBlurb: ${!!avatarBlurb}`
    );

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
    // Contact options start hidden - animate in after hr
    if (contactOptions) {
      gsap.set(contactOptions, { opacity: 0 });
    }
    if (cardColumn) {
      gsap.set(cardColumn, {
        opacity: 0,
        filter: `blur(${blurAmount}px)`,
        willChange: 'filter, opacity'
      });
    }
    // Avatar blurb — visible immediately (CSS controls opacity: 0.09 on parent)
    if (avatarBlurb) {
      gsap.set(avatarBlurb, {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)'
      });
    }

    // Fade in while blurred
    if (heading) {
      this.timeline.to(
        heading,
        {
          opacity: 1,
          duration: blurFadeDuration,
          ease: 'power2.out'
        },
        0
      );
    }
    // contactOptions animates in later with hr - skip in this phase
    if (cardColumn) {
      this.timeline.to(
        cardColumn,
        {
          opacity: 1,
          duration: blurFadeDuration,
          ease: 'power2.out'
        },
        0
      );
    }

    // Brief pause then clear blur
    this.timeline.to({}, { duration: blurPause });

    if (heading) {
      this.timeline.to(
        heading,
        {
          filter: 'blur(0px)',
          duration: blurClearDuration,
          ease: 'power2.out'
        },
        '>'
      );
    }
    // contactOptions animates in later - skip blur animation here
    if (cardColumn) {
      this.timeline.to(
        cardColumn,
        {
          filter: 'blur(0px)',
          duration: blurClearDuration,
          ease: 'power2.out'
        },
        '<'
      );
    }

    // Clean up will-change after blur animations complete
    this.timeline.set([heading, cardColumn].filter(Boolean), {
      willChange: 'auto'
    });

    // Fade in hr after h2 animation completes (appears after h2 is fully visible)
    if (hr) {
      this.timeline.to(
        hr,
        {
          opacity: 1,
          duration: blurClearDuration,
          ease: 'power2.out'
        },
        '>'
      );
    }

    // Contact options fade in with hr
    if (contactOptions) {
      this.timeline.to(
        contactOptions,
        {
          opacity: 1,
          duration: blurClearDuration,
          ease: 'power2.out'
        },
        '<'
      );
    }

    // ========================================================================
    // PHASE 3: Form fields cascade animation
    // PERFORMANCE: Batch all DOM reads before writes to prevent layout thrashing
    // ========================================================================

    // === BATCH 1: DOM QUERIES (no layout forcing) ===
    const nameField = this.domCache.get('nameInput')?.closest('.input-item');
    const companyField = this.domCache.get('companyInput')?.closest('.input-item');
    const emailField = this.domCache.get('emailInput')?.closest('.input-item');
    const messageField =
      this.domCache.get('messageInput')?.closest('.input-item') ||
      this.container.querySelector('textarea')?.closest('.input-item');
    const submitButton =
      this.container.querySelector('button[type="submit"]') ||
      this.container.querySelector('.contact-submit');
    const _formContainer =
      this.container.querySelector('.contact-form') ||
      this.container.querySelector('.contact-form-column');
    const formColumn = this.container.querySelector('.contact-form-column') as HTMLElement | null;
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
    const inputHeightVar = rootStyles.getPropertyValue('--contact-input-height').trim();

    // Resolve CSS height values to pixels via a sentinel element.
    // This handles any valid CSS value: px, rem, clamp(), calc(), etc.
    // Appended to documentElement so it inherits :root custom properties.
    const resolveCSSHeight = (cssValue: string, fallback: number): number => {
      if (!cssValue) return fallback;
      const sentinel = document.createElement('div');
      sentinel.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:${cssValue}`;
      document.documentElement.appendChild(sentinel);
      const resolved = sentinel.offsetHeight;
      sentinel.remove();
      return resolved > 0 ? resolved : fallback;
    };

    // === BATCH 3: CALCULATIONS (no DOM access) ===
    const inputFieldHeight = resolveCSSHeight(
      inputHeightVar,
      ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_HEIGHT
    );
    const compressedHeight = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_COMPRESSED;
    const finalTextareaHeight = resolveCSSHeight(textareaHeightVar, 155);
    const finalMessageFieldHeight = finalTextareaHeight + 20; // Add padding

    this.log(`Message field target height: ${finalTextareaHeight}px`);

    // === BATCH 4: DOM WRITES (all gsap.set calls together) ===
    // Lock section to final height
    // NOTE: Don't set overflow:hidden on formContainer - it clips the button during width animation
    gsap.set(this.container, { minHeight: finalSectionHeight });

    // Set up z-index - name on TOP of stack (highest z-index)
    if (nameField) gsap.set(nameField, { zIndex: Z_INDEX_CONTACT_FORM.NAME_FIELD, position: 'relative' });
    if (companyField) gsap.set(companyField, { zIndex: Z_INDEX_CONTACT_FORM.COMPANY_FIELD, position: 'relative' });
    if (emailField) gsap.set(emailField, { zIndex: Z_INDEX_CONTACT_FORM.EMAIL_FIELD, position: 'relative' });
    if (messageField) gsap.set(messageField, { zIndex: Z_INDEX_CONTACT_FORM.MESSAGE_FIELD, position: 'relative' });
    // Button needs higher z-index to stay visible during form width animation
    if (submitButton) {
      gsap.set(submitButton, {
        zIndex: Z_INDEX_CONTACT_FORM.SUBMIT_BUTTON,
        opacity: 0,
        scale: 0.8,
        filter: `blur(${blurAmount}px)`
      });
    }

    // Shared border-radius for all fields during cascade
    const fieldBorderRadius = '0 50px 50px 50px';
    const startWidth = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_WIDTH_START;
    const inputWidthMax = ANIMATION_CONSTANTS.DIMENSIONS.FORM_FIELD_WIDTH_FULL; // 520px cap
    // Lazy width getter — called when the tween runs (page is visible), not at setup time
    // Prevents reading offsetWidth=0 when the section is hidden during SPA init.
    // Falls back to inputWidthMax when offsetWidth=0 (section still display:none during intro).
    const getInputWidth = () => {
      if (!formColumn) return inputWidthMax;
      const w = formColumn.offsetWidth;
      return w > 0 ? Math.min(w, inputWidthMax) : inputWidthMax;
    };

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

    // Avatar blurb is always visible — CSS controls opacity via parent .contact-bg-avatar
    // Star glow pulses independently — not tied to main timeline so it always shows
    if (avatarBlurb) {
      const starGlow = avatarBlurb.querySelector('#STAR_GLOW') as SVGPathElement | null;

      if (starGlow) {
        // Kill any previous glow animation before creating a new one
        if (this.starGlowAnimation) {
          this.starGlowAnimation.kill();
        }

        // Independent pulsing — starts immediately, not dependent on main timeline
        this.starGlowAnimation = gsap.fromTo(
          starGlow,
          { opacity: 0.6 },
          {
            opacity: 1,
            duration: 1.5,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            repeatDelay: 0
          }
        );
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
      this.timeline?.to(
        field,
        {
          height: compressedHeight,
          duration: 0.2,
          ease: 'sine.out'
        },
        formStartTime + i * stagger
      );
    });

    // Phase 2: All fields expand height together (compressed → full) - starts after first field appears
    const expandStart = formStartTime + stagger; // Start when second field begins appearing

    // Input fields expand to inputFieldHeight
    if (nameField) {
      this.timeline.to(
        nameField,
        {
          height: inputFieldHeight,
          overflow: 'visible',
          clearProps: 'borderRadius',
          duration: 0.25,
          ease: 'sine.inOut'
        },
        expandStart
      );
    }
    if (nameInput) {
      this.timeline.to(
        nameInput,
        { height: inputFieldHeight, opacity: 1, duration: 0.25, ease: 'sine.inOut' },
        '<'
      );
    }

    if (companyField) {
      this.timeline.to(
        companyField,
        {
          height: inputFieldHeight,
          overflow: 'visible',
          clearProps: 'borderRadius',
          duration: 0.25,
          ease: 'sine.inOut'
        },
        expandStart + stagger
      );
    }
    if (companyInput) {
      this.timeline.to(
        companyInput,
        { height: inputFieldHeight, opacity: 1, duration: 0.25, ease: 'sine.inOut' },
        '<'
      );
    }

    if (emailField) {
      this.timeline.to(
        emailField,
        {
          height: inputFieldHeight,
          overflow: 'visible',
          clearProps: 'borderRadius',
          duration: 0.25,
          ease: 'sine.inOut'
        },
        expandStart + stagger * 2
      );
    }
    if (emailInput) {
      this.timeline.to(
        emailInput,
        { height: inputFieldHeight, opacity: 1, duration: 0.25, ease: 'sine.inOut' },
        '<'
      );
    }

    // Message field expands to its final height
    if (messageField) {
      this.timeline.to(
        messageField,
        {
          height: finalMessageFieldHeight,
          overflow: 'visible',
          clearProps: 'borderRadius',
          duration: 0.25,
          ease: 'sine.inOut'
        },
        expandStart + stagger * 3
      );
    }
    if (textarea) {
      this.timeline.to(
        textarea,
        {
          height: finalTextareaHeight,
          minHeight: finalTextareaHeight,
          opacity: 1,
          duration: 0.25,
          ease: 'sine.inOut'
        },
        '<'
      );
    }
    if (wrapper && wrapper !== messageField) {
      this.timeline.to(
        wrapper,
        {
          height: 'auto',
          overflow: 'visible',
          clearProps: 'borderRadius',
          duration: 0.25,
          ease: 'sine.inOut'
        },
        '<'
      );
    }

    // WIDTH: One continuous expansion for ALL fields together (runs throughout form phase)
    // getInputWidth() is called lazily at tween time when the section is visible
    this.timeline.to(
      [nameField, companyField, emailField].filter(Boolean),
      {
        width: getInputWidth,
        duration: totalDuration * 0.8,
        ease: 'sine.inOut'
      },
      formStartTime
    );

    if (messageField) {
      this.timeline.to(
        messageField,
        {
          width: getInputWidth, // Same lazy-read — all fields same width
          duration: totalDuration * 0.8,
          ease: 'sine.inOut'
        },
        formStartTime
      );
    }

    // 6. Labels and placeholders fade in early (during field expansion)
    const allLabels = [nameLabel, companyLabel, emailLabel, messageLabel].filter(Boolean);
    const allInputsWithPlaceholders = [nameInput, companyInput, emailInput, textarea].filter(
      Boolean
    );

    // Start text fade-in during field expansion
    const textFadeStart = formStartTime + 0.2;

    if (allLabels.length > 0) {
      this.timeline.to(allLabels, { opacity: 1, duration: 0.3, ease: 'power1.out' }, textFadeStart);
    }

    if (allInputsWithPlaceholders.length > 0) {
      this.timeline.to(
        allInputsWithPlaceholders,
        {
          '--placeholder-opacity': 1,
          duration: 0.3,
          ease: 'power1.out'
        },
        textFadeStart
      );
    }

    // Button scales up and clears blur in sync with form fields and avatar blurb
    if (submitButton) {
      this.timeline.to(
        submitButton,
        {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 0.5,
          ease: 'back.out(1.4)'
        },
        formStartTime
      );
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

    // Pre-transition signal — fires BEFORE the slide/blur animation runs.
    // For slide arrivals (map scroll), pre-set the form to its end state
    // NOW so the contact tile slides in showing a fully-grown form
    // instead of the initial small one that snaps to full size after.
    // Without this the user sees the form "grow" on every scroll arrival
    // even though we're not playing the entrance animation.
    this.on('PageTransitionModule:page-entering', ((event: CustomEvent) => {
      const { to, mode } = event.detail || {};
      if (to !== 'contact') return;
      if (mode === 'slide' && this.timeline) {
        this.skipToEndState();
        this.blurAnimationComplete = true;
      }
    }) as EventListener);

    // Single page-changed listener — handles enter, exit, and the safety-net
    // fallback all in one place. Mode-gated: any non-blur arrival
    // (camera/slide map scroll) skips the form-grow animation entirely;
    // the form sits fully expanded.
    this.on('PageTransitionModule:page-changed', ((event: CustomEvent) => {
      const { to, from, mode } = event.detail || {};

      if (from === 'contact') {
        this.playOutAnimation();
        this.blurAnimationComplete = false;
      }

      if (to !== 'contact') return;

      if (mode === 'blur') {
        // Direct nav: reset to start state, then let contact-page-ready
        // play the animation. Fallback timer in case that event doesn't
        // fire for some reason.
        this.resetAnimatedElements();
        this.blurAnimationComplete = false;
        setTimeout(() => {
          if (!this.blurAnimationComplete && !this.timeline?.isActive()) {
            this.blurAnimationComplete = true;
            this.playFormAnimation();
          }
        }, 600);
      } else {
        // Camera or slide (map scroll arrival). Snap the timeline to its
        // end state — full-size form, no entrance choreography. Setting
        // blurAnimationComplete=true also defangs any stale fallback timer.
        this.skipToEndState();
        this.blurAnimationComplete = true;
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
      }, 300);
    }

    this.log('Contact animation initialized (cascade — all screen sizes)');
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
   * Snap the form straight to its end state (full size, all fields visible).
   * Used when the user arrives at contact via map scroll — they don't want
   * the cascading grow-in animation; they just want a usable form.
   */
  private skipToEndState(): void {
    if (!this.container || !this.timeline) return;

    const contactContent = this.container.querySelector('.contact-content');
    if (contactContent) {
      gsap.set(contactContent, { opacity: 1 });
    }

    // Jump the timeline to its very end so all the .to() tweens have already
    // landed (heading visible, fields full-width, labels shown, etc).
    this.timeline.progress(1);
    this.timeline.pause();
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

    if (heading) {
      gsap.set(heading, {
        opacity: 0,
        filter: `blur(${blurAmount}px)`,
        willChange: 'filter, opacity'
      });
    }
    // Hide hr so it doesn't appear before h2 - hr should appear after h2 or not animate
    if (hr) gsap.set(hr, { opacity: 0 });
    // Contact options start hidden - animate in with hr
    if (contactOptions) gsap.set(contactOptions, { opacity: 0 });
    if (cardColumn) {
      gsap.set(cardColumn, {
        opacity: 0,
        filter: `blur(${blurAmount}px)`,
        willChange: 'filter, opacity'
      });
    }

    // Avatar blurb stays visible — CSS controls opacity via parent .contact-bg-avatar
    const avatarBlurb = this.container.querySelector('.avatar-blurb-container');
    if (avatarBlurb) {
      gsap.set(avatarBlurb, { opacity: 1, scale: 1, filter: 'blur(0px)' });
    }

    // Get form container reference (no overflow changes - causes button clipping)
    const _formContainer =
      this.container.querySelector('.contact-form') ||
      this.container.querySelector('.contact-form-column');

    // Reset form fields
    const fields = [
      this.domCache.get('nameInput')?.closest('.input-item'),
      this.domCache.get('companyInput')?.closest('.input-item'),
      this.domCache.get('emailInput')?.closest('.input-item'),
      this.domCache.get('messageInput')?.closest('.input-item') ||
        this.container.querySelector('textarea')?.closest('.input-item')
    ];

    const fieldZIndices = [
      Z_INDEX_CONTACT_FORM.NAME_FIELD,
      Z_INDEX_CONTACT_FORM.COMPANY_FIELD,
      Z_INDEX_CONTACT_FORM.EMAIL_FIELD,
      Z_INDEX_CONTACT_FORM.MESSAGE_FIELD
    ];

    fields.forEach((field, i) => {
      if (!field) return;

      gsap.set(field, {
        height: 0,
        width: startWidth,
        overflow: 'hidden',
        borderRadius: fieldBorderRadius,
        zIndex: fieldZIndices[i],
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
    if (submitButton) {
      gsap.set(submitButton, {
        zIndex: Z_INDEX_CONTACT_FORM.SUBMIT_BUTTON,
        opacity: 0,
        scale: 0.8,
        filter: `blur(${blurAmount}px)`
      });
    }
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

    if (this.starGlowAnimation) {
      this.starGlowAnimation.kill();
      this.starGlowAnimation = null;
    }

    this.container = null;

    await super.destroy();
  }
}
