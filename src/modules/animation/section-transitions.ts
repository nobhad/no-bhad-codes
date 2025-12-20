/**
 * ===============================================
 * SECTION TRANSITIONS MODULE
 * ===============================================
 * @file src/modules/animation/section-transitions.ts
 * @extends BaseModule
 *
 * DESIGN:
 * - Implements salcosta.dev-style blur-in/drop-in transitions
 * - Blur-in: blur(8px) → blur(0) + opacity: 0 → 1
 * - Drop-in: Child elements translateY(-30px) → 0 with stagger
 * - Timing: 0.6s entrance, 0.4s exit, 100ms stagger
 * - Desktop only - mobile disabled for performance
 * - Respects prefers-reduced-motion
 */

import { BaseModule } from '../core/base';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { ModuleOptions } from '../../types/modules';

// Register ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// Animation constants (using CSS variable values)
const BLUR_AMOUNT = 8;
const DROP_DISTANCE = 30;
const ENTER_DURATION = 0.6;
const EXIT_DURATION = 0.4;
const STAGGER_DELAY = 0.1;
const EASE_IN = 'power2.out';
const EASE_OUT = 'power2.in';

interface SectionConfig {
  selector: string;
  childSelectors: string[];
  skipBlur?: boolean;
}

export class SectionTransitionsModule extends BaseModule {
  private scrollTriggers: ScrollTrigger[] = [];
  private sectionTimelines: gsap.core.Timeline[] = [];

  // Section configuration
  private sections: SectionConfig[] = [
    {
      selector: '.about-section',
      childSelectors: ['.about-text-wrapper h2', '.about-text-wrapper p', '.tech-stack']
    },
    {
      selector: '.tech-stack-section',
      childSelectors: ['h2', '.tech-stack', '.tech-list']
    }
  ];

  constructor(options: ModuleOptions = {}) {
    super('SectionTransitionsModule', { debug: true, ...options });
  }

  override async init(): Promise<void> {
    await super.init();

    // Desktop only
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) {
      this.log('Mobile detected - skipping section transitions');
      return;
    }

    // Skip if reduced motion is preferred
    if (this.reducedMotion) {
      this.log('Reduced motion preferred - skipping transitions');
      return;
    }

    this.setupTransitions();
  }

  /**
   * Set up scroll-triggered transitions for each section
   */
  private setupTransitions(): void {
    const scrollContainer = document.querySelector('main');

    this.sections.forEach((config) => {
      const section = document.querySelector(config.selector) as HTMLElement;
      if (!section) {
        this.log(`Section "${config.selector}" not found`);
        return;
      }

      // Get child elements to animate
      const children = config.childSelectors
        .map((sel) => section.querySelectorAll(sel))
        .flatMap((nodeList) => Array.from(nodeList))
        .filter((el) => el !== null);

      if (children.length === 0) {
        this.log(`No children found for "${config.selector}"`);
        return;
      }

      // Set initial state: hidden with blur
      if (!config.skipBlur) {
        gsap.set(section, {
          opacity: 0,
          filter: `blur(${BLUR_AMOUNT}px)`
        });
      }

      // Set children initial state: translated up
      gsap.set(children, {
        y: -DROP_DISTANCE,
        opacity: 0
      });

      // Create enter timeline
      const enterTimeline = gsap.timeline({ paused: true });

      // Blur-in the section container
      if (!config.skipBlur) {
        enterTimeline.to(section, {
          opacity: 1,
          filter: 'blur(0px)',
          duration: ENTER_DURATION,
          ease: EASE_IN
        }, 0);
      }

      // Drop-in children with stagger
      enterTimeline.to(children, {
        y: 0,
        opacity: 1,
        duration: ENTER_DURATION,
        stagger: STAGGER_DELAY,
        ease: EASE_IN
      }, config.skipBlur ? 0 : 0.1);

      this.sectionTimelines.push(enterTimeline);

      // Create ScrollTrigger
      const trigger = ScrollTrigger.create({
        trigger: section,
        scroller: scrollContainer || undefined,
        start: 'top 70%',
        end: 'bottom 30%',
        onEnter: () => {
          this.log(`Entering "${config.selector}"`);
          enterTimeline.play();
        },
        onLeave: () => {
          this.log(`Leaving "${config.selector}"`);
          // Fast exit animation
          gsap.to(section, {
            opacity: 0,
            filter: `blur(${BLUR_AMOUNT}px)`,
            duration: EXIT_DURATION,
            ease: EASE_OUT
          });
          gsap.to(children, {
            y: DROP_DISTANCE,
            opacity: 0,
            duration: EXIT_DURATION,
            stagger: STAGGER_DELAY / 2,
            ease: EASE_OUT
          });
        },
        onEnterBack: () => {
          this.log(`Entering back "${config.selector}"`);
          // Reset and play enter animation
          gsap.set(section, { opacity: 0, filter: `blur(${BLUR_AMOUNT}px)` });
          gsap.set(children, { y: DROP_DISTANCE, opacity: 0 });
          enterTimeline.restart();
        },
        onLeaveBack: () => {
          this.log(`Leaving back "${config.selector}"`);
          // Fast exit animation (upward)
          gsap.to(section, {
            opacity: 0,
            filter: `blur(${BLUR_AMOUNT}px)`,
            duration: EXIT_DURATION,
            ease: EASE_OUT
          });
          gsap.to(children, {
            y: -DROP_DISTANCE,
            opacity: 0,
            duration: EXIT_DURATION,
            stagger: STAGGER_DELAY / 2,
            ease: EASE_OUT
          });
        }
      });

      this.scrollTriggers.push(trigger);
      this.log(`Transition set up for "${config.selector}"`);
    });

    this.log(`Section transitions initialized for ${this.sections.length} sections`);
  }

  /**
   * Get module status
   */
  override getStatus() {
    return {
      ...super.getStatus(),
      sectionsConfigured: this.sections.length,
      scrollTriggersActive: this.scrollTriggers.length,
      timelinesActive: this.sectionTimelines.length
    };
  }

  /**
   * Cleanup on destroy
   */
  override async destroy(): Promise<void> {
    // Kill all ScrollTriggers
    this.scrollTriggers.forEach((trigger) => trigger.kill());
    this.scrollTriggers = [];

    // Kill all timelines
    this.sectionTimelines.forEach((tl) => tl.kill());
    this.sectionTimelines = [];

    await super.destroy();
  }
}
