/**
 * ===============================================
 * CONTACT SECTION ANIMATION MODULE
 * ===============================================
 * @file src/modules/animation/contact-animation.ts
 * @extends BaseModule
 *
 * ANIMATION SEQUENCE (all screen sizes):
 * 1. Navigate to contact page (hash #/contact)
 * 2. h2 "contact" blur in
 * 3. Card column blur in (hidden on mobile via CSS — no visual effect)
 * 4. HR + contact-options fade in (after h2 lands)
 * 5. Submit button scales up with blur clear (focal call-to-action)
 *
 * Form FIELDS are intentionally NOT animated — they render at their
 * CSS default (full-size, visible labels + placeholders) from first
 * paint. The cascade grow-in / width expansion / placeholder fade-in
 * that used to live here was distracting on every arrival. The
 * background (h2, hr, contactOptions, cardColumn) and the submit
 * button still animate; the form itself is static.
 *
 * The avatar's star-glow SVG pulses continuously via an independent
 * tween outside the main timeline.
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import type { ModuleOptions } from '../../types/modules';
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

    // Small mobile: skip the GSAP entrance entirely. The cascading blur
    // + filter tweens are the single biggest source of jank on phones,
    // and on the new vertical-scroll mobile architecture the user just
    // scrolls down to the form — they don't get the dramatic-entrance
    // beat that the animation was designed to deliver. CSS already
    // renders the form visible by default, so skipping leaves a fully
    // usable form with no extra work.
    if (window.matchMedia('(max-width: 479px)').matches) {
      this.log('Small mobile - skipping contact form animation');
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
    // PHASE 3: Submit-button entrance + star-glow pulse
    // Form FIELDS are NOT animated — they render at their CSS default
    // (full-size, visible labels + placeholders) from first paint. The
    // cascade grow-in / width expansion / placeholder fade-in that used
    // to live here was removed because it was distracting on every
    // arrival. Only the submit button still pops in (since it's a focal
    // call-to-action) and the avatar's star-glow continues to pulse
    // ambiently.
    // ========================================================================

    const submitButton =
      this.container.querySelector('button[type="submit"]') ||
      this.container.querySelector('.contact-submit');

    // Lock section to its measured final height so the submit-button
    // scale-up doesn't reflow the section. Restored after the timeline
    // completes (see end of this method).
    gsap.set(this.container, { minHeight: this.container.offsetHeight });

    if (submitButton) {
      gsap.set(submitButton, {
        zIndex: Z_INDEX_CONTACT_FORM.SUBMIT_BUTTON,
        opacity: 0,
        scale: 0.8,
        filter: `blur(${blurAmount}px)`
      });
    }

    const formStartTime = dropDuration; // Button entrance starts AFTER h2/card drop completes

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

    // Submit button is the only form-area element that still animates:
    // scales up + clears blur in sync with the heading/card drop. Fires
    // at formStartTime (just after the heading blur clears) so the
    // button "pops in" as the user's eye lands on the form area.
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

    // Restore section height after animation completes.
    this.timeline.set(this.container, { minHeight: 'auto' });

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
   * Reset all animated elements to their initial animation state.
   * Form fields are NOT reset — they're never animated, so they stay
   * at their CSS-default visible state across every page entry/exit.
   * Only the header elements (heading, hr, contactOptions, cardColumn)
   * and the submit button get reset to their pre-tween hidden state.
   */
  private resetAnimatedElements(): void {
    if (!this.container) return;

    const blurAmount = 4; // Match setupAnimation blur amount

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
