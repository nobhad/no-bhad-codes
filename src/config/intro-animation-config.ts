/**
 * ===============================================
 * INTRO ANIMATION CONFIGURATION
 * ===============================================
 * @file src/config/intro-animation-config.ts
 *
 * Centralized configuration for the intro animation module.
 * All SVG element IDs, alignment constants, and timing values
 * are defined here for easy maintenance.
 */

// ============================================================================
// SVG FILE CONFIGURATION
// ============================================================================

/** SVG file path (cache-busting handled at runtime) */
export const SVG_PATH = '/images/coyote_paw.svg';

// ============================================================================
// SVG CARD ALIGNMENT CONSTANTS
// ============================================================================
// These values are extracted from coyote_paw.svg and must be updated
// if the SVG card position or dimensions change.
// ============================================================================

export const SVG_CARD = {
  /** X position of card rectangle in SVG coordinates */
  x: 1256.15,
  /** Y position of card rectangle in SVG coordinates */
  y: 1031.85,
  /** Width of card rectangle in SVG coordinates */
  width: 1062.34,
  /** Height of card rectangle in SVG coordinates */
  height: 591.3
} as const;

export const SVG_VIEWBOX = {
  /** Full SVG viewBox width */
  width: 2316.99,
  /** Full SVG viewBox height */
  height: 1801.19
} as const;

// ============================================================================
// SVG ELEMENT IDS
// ============================================================================
// Element IDs within coyote_paw.svg for querying specific parts.
// ============================================================================

export const SVG_ELEMENT_IDS = {
  /** Main structural elements */
  armBase: 'Arm_Base',
  position1: 'Position_1',
  position2: 'Position_2',
  position3: 'Position_3',
  cardGroup: 'Card',

  /** Finger elements - Position 1 (clutching) */
  fingerA1: '_1_Morph_Above_Card_-_Fingers_',
  fingerB1Container: '_FInger_B_-_Above_Card_',
  fingerC1Container: '_FInger_C-_Above_Card_',

  /** Finger elements - Position 2 (releasing) */
  fingerA2: '_FInger_A_-_Above_Card_-2',
  fingerB2: '_FInger_B-_Above_Card_',
  fingerC2: '_FInger_C_-_Above_Card_',
  thumb2: '_Thumb_Behind_Card_',

  /** Finger elements - Position 3 (fully open) */
  fingerA3: '_FInger_A_-_Above_Card_-3',
  fingerB3: '_FInger_B-_Above_Card_-2',
  fingerC3: '_FInger_C_-_Above_Card_-2',
  thumb3: '_Thumb_Behind_Card_-2'
} as const;

// ============================================================================
// DOM ELEMENT IDS
// ============================================================================
// Element IDs in the HTML document for the animation overlay.
// ============================================================================

export const DOM_ELEMENT_IDS = {
  morphOverlay: 'intro-morph-overlay',
  morphSvg: 'intro-morph-svg',
  morphPaw: 'morph-paw',
  morphCardGroup: 'morph-card-group',
  businessCard: 'business-card',
  businessCardInner: 'business-card-inner'
} as const;

// ============================================================================
// ANIMATION TIMING CONFIGURATION
// ============================================================================

export const ANIMATION_TIMING = {
  /** Phase 0: Entry animation duration (seconds) */
  entryDuration: 0.8,
  /** Phase 1: Clutch hold duration (seconds) */
  clutchHoldDuration: 0.8,
  /** Phase 2: Finger release morph duration (seconds) */
  fingerReleaseDuration: 0.5,
  /** Phase 3: Retraction animation duration (seconds) */
  retractionDuration: 1.6,
  /** Delay between Phase 2 and Phase 3 (seconds) */
  retractionDelay: 0.02,
  /** Individual finger morph durations during retraction */
  fingerMorphDurations: {
    fingerA: 0.08,
    fingerB: 0.08,
    fingerC: 0.2
  },
  /** Header fade-in duration (seconds) */
  headerFadeDuration: 0.5
} as const;

// ============================================================================
// ANIMATION POSITION CONSTANTS
// ============================================================================

export const ANIMATION_POSITIONS = {
  /** Entry start position (off-screen top-left) */
  entryStart: { x: -800, y: -600 },
  /** Center position (on-screen) */
  center: { x: 0, y: 0 },
  /** Retraction end position (off-screen top-left) */
  retractionEnd: { x: -1500, y: -1200 }
} as const;

// ============================================================================
// REPLAY CONFIGURATION
// ============================================================================

export const REPLAY_CONFIG = {
  /** Time in milliseconds before intro animation replays (10 minutes) */
  replayInterval: 10 * 60 * 1000,
  /** LocalStorage key for intro animation timestamp */
  timestampKey: 'introAnimationTimestamp'
} as const;

// ============================================================================
// MOBILE CONFIGURATION
// ============================================================================

export const MOBILE_CONFIG = {
  /** Breakpoint below which mobile fallback is used (pixels) */
  breakpoint: 768
} as const;
