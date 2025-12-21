/**
 * ===============================================
 * INTRO ANIMATION TIMELINE
 * ===============================================
 * @file src/modules/animation/intro/morph-timeline.ts
 *
 * GSAP timeline creation and animation orchestration
 */

/* global SVGGElement */

import { gsap } from 'gsap';
import { ANIMATION_CONSTANTS, ANIMATION_POSITIONS } from '../../../config/animation-constants';
import type {
  FingerPathReferences,
  CompleteMorphPathData
} from './intro-types';

/**
 * Create main animation timeline
 */
export function createMainTimeline(
  onCompleteCallback: () => void
): gsap.core.Timeline {
  return gsap.timeline({
    onComplete: onCompleteCallback
  });
}

/**
 * Phase 0: Entry animation (paw + card enter from top-left)
 */
export function addEntryPhase(
  timeline: gsap.core.Timeline,
  behindCardGroup: SVGGElement,
  aboveCardGroup: SVGGElement,
  cardLayer: SVGGElement
): void {
  const { x: startX, y: startY } = ANIMATION_POSITIONS.INTRO_ENTRY_START;
  const { x: centerX, y: centerY } = ANIMATION_POSITIONS.INTRO_CENTER;
  const duration = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.ENTRY_DURATION;

  // Set initial position off-screen
  gsap.set(behindCardGroup, { x: startX, y: startY });
  gsap.set(aboveCardGroup, { x: startX, y: startY });
  gsap.set(cardLayer, { x: startX, y: startY });

  // Animate all layers to center position
  timeline.to(behindCardGroup, {
    x: centerX,
    y: centerY,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.HERO_REVEAL
  });

  timeline.to(aboveCardGroup, {
    x: centerX,
    y: centerY,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.HERO_REVEAL
  }, '<');

  timeline.to(cardLayer, {
    x: centerX,
    y: centerY,
    duration,
    ease: ANIMATION_CONSTANTS.EASING.HERO_REVEAL
  }, '<');
}

/**
 * Phase 1: Clutch hold (paw grips card motionless)
 */
export function addClutchPhase(
  timeline: gsap.core.Timeline
): void {
  const duration = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.CLUTCH_HOLD;
  timeline.to({}, { duration });
}

/**
 * Phase 2: Finger release (morph Position 1 → Position 2)
 */
export function addFingerReleasePhase(
  timeline: gsap.core.Timeline,
  fingerRefs: FingerPathReferences,
  pathData: CompleteMorphPathData,
  clonedThumb: Element | null
): void {
  const duration = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.FINGER_RELEASE;
  const ease = ANIMATION_CONSTANTS.EASING.MORPH;

  // Finger A: Position 1 → 2
  if (fingerRefs.fingerA1 && pathData.a2) {
    timeline.to(fingerRefs.fingerA1, {
      morphSVG: { shape: pathData.a2, shapeIndex: 'auto' },
      duration,
      ease
    });
  }

  // Finger B: Position 1 → 2 (simultaneous with A)
  if (fingerRefs.fingerB1 && pathData.b2) {
    timeline.to(fingerRefs.fingerB1, {
      morphSVG: { shape: pathData.b2, shapeIndex: 'auto' },
      duration,
      ease
    }, '<');
  }

  // Finger C: Position 1 → 2 (simultaneous with A and B)
  if (fingerRefs.fingerC1 && pathData.c2) {
    timeline.to(fingerRefs.fingerC1, {
      morphSVG: { shape: pathData.c2, shapeIndex: 'auto' },
      duration,
      ease
    }, '<');
  }

  // Thumb: Position 1 → 2 (morphs with fingers)
  if (clonedThumb && pathData.thumb2) {
    timeline.to(clonedThumb, {
      morphSVG: { shape: pathData.thumb2, shapeIndex: 'auto' },
      duration,
      ease
    }, '<');
  }
}

/**
 * Phase 3: Retraction (paw exits diagonally off-screen)
 */
export function addRetractionPhase(
  timeline: gsap.core.Timeline,
  behindCardGroup: SVGGElement,
  aboveCardGroup: SVGGElement
): void {
  const { x: endX, y: endY } = ANIMATION_POSITIONS.INTRO_RETRACTION_END;
  const duration = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.RETRACTION_DURATION;
  const delay = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.RETRACTION_DELAY;

  // Start retraction after a small delay
  timeline.to(behindCardGroup, {
    x: endX,
    y: endY,
    duration,
    ease: 'power2.in' // Accelerate as it exits
  }, `+=${delay}`);

  // Above-card group retracts simultaneously
  timeline.to(aboveCardGroup, {
    x: endX,
    y: endY,
    duration,
    ease: 'power2.in'
  }, '<');
}

/**
 * Phase 3b: Final finger morphs (Position 2 → Position 3 during retraction)
 */
export function addFinalMorphPhase(
  timeline: gsap.core.Timeline,
  fingerRefs: FingerPathReferences,
  pathData: CompleteMorphPathData,
  clonedThumb: Element | null
): void {
  const durationA = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.FINGER_MORPH_A;
  const durationB = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.FINGER_MORPH_B;
  const durationC = ANIMATION_CONSTANTS.SEQUENCES.INTRO_MORPH.FINGER_MORPH_C;
  const ease = 'power1.out';

  // Finger A: Position 2 → 3 (during retraction)
  if (fingerRefs.fingerA1 && pathData.a3) {
    timeline.to(fingerRefs.fingerA1, {
      morphSVG: { shape: pathData.a3, shapeIndex: 'auto' },
      duration: durationA,
      ease
    }, '<');
  }

  // Finger B: Position 2 → 3 (during retraction)
  if (fingerRefs.fingerB1 && pathData.b3) {
    timeline.to(fingerRefs.fingerB1, {
      morphSVG: { shape: pathData.b3, shapeIndex: 'auto' },
      duration: durationB,
      ease
    }, '<');
  }

  // Finger C: Position 2 → 3 (during retraction, slightly slower)
  if (fingerRefs.fingerC1 && pathData.c3) {
    timeline.to(fingerRefs.fingerC1, {
      morphSVG: { shape: pathData.c3, shapeIndex: 'auto' },
      duration: durationC,
      ease
    }, '<');
  }

  // Thumb: Position 2 → 3 (during retraction)
  if (clonedThumb && pathData.thumb3) {
    timeline.to(clonedThumb, {
      morphSVG: { shape: pathData.thumb3, shapeIndex: 'auto' },
      duration: durationC,
      ease
    }, '<');
  }
}

/**
 * Phase 4: Completion (update classes, make overlay non-interactive)
 */
export function addCompletionPhase(
  timeline: gsap.core.Timeline,
  morphOverlay: HTMLElement | null
): void {
  timeline.call(() => {
    // Remove loading state, add complete state
    document.documentElement.classList.remove('intro-loading');
    document.documentElement.classList.add('intro-complete');

    // Make overlay non-interactive
    if (morphOverlay) {
      morphOverlay.style.pointerEvents = 'none';
    }
  });
}

/**
 * Build complete main animation timeline
 */
export function buildMainAnimationTimeline(
  onCompleteCallback: () => void,
  behindCardGroup: SVGGElement,
  aboveCardGroup: SVGGElement,
  cardLayer: SVGGElement,
  fingerRefs: FingerPathReferences,
  pathData: CompleteMorphPathData,
  clonedThumb: Element | null,
  morphOverlay: HTMLElement | null
): gsap.core.Timeline {
  const timeline = createMainTimeline(onCompleteCallback);

  addEntryPhase(timeline, behindCardGroup, aboveCardGroup, cardLayer);
  addClutchPhase(timeline);
  addFingerReleasePhase(timeline, fingerRefs, pathData, clonedThumb);
  addRetractionPhase(timeline, behindCardGroup, aboveCardGroup);
  addFinalMorphPhase(timeline, fingerRefs, pathData, clonedThumb);
  addCompletionPhase(timeline, morphOverlay);

  return timeline;
}
