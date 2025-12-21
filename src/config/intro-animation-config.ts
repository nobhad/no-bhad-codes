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

/**
 * SVG_CARD represents the VISIBLE bounds of the card in coyote_paw.svg (including stroke).
 *
 * The card rectangle is at (1256.2, 1031.8) with size 1060.5 x 590.3.
 * The stroke is 9px (4.5px on each side), so the visible bounds are:
 * - x: 1256.2 - 4.5 = 1251.7
 * - y: 1031.8 - 4.5 = 1027.3
 * - width: 1060.5 + 9 = 1069.5
 * - height: 590.3 + 9 = 599.3
 *
 * This matches business-card_front.svg viewBox (1069.5 x 599.3) for pixel-perfect alignment.
 */
export const SVG_CARD = {
  /** X position of visible card bounds (rectangle x - stroke/2) */
  x: 1251.7,
  /** Y position of visible card bounds (rectangle y - stroke/2) */
  y: 1027.3,
  /** Width of visible card bounds (rectangle width + stroke) */
  width: 1069.5,
  /** Height of visible card bounds (rectangle height + stroke) */
  height: 599.3
} as const;

export const SVG_VIEWBOX = {
  /** Full SVG viewBox width - matches coyote_paw.svg */
  width: 2331.1,
  /** Full SVG viewBox height - matches coyote_paw.svg */
  height: 1798.6
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
  thumb1: '_Thumb_Behind_Card_-1',

  /** Finger elements - Position 2 (releasing) */
  fingerA2: '_FInger_A_-_Above_Card_-2',
  fingerB2: '_FInger_B-_Above_Card_',
  fingerC2: '_FInger_C_-_Above_Card_',
  thumb2: '_Thumb_Behind_Card_',

  /** Finger elements - Position 3 (fully open) */
  fingerA3: '_FInger_A_-_Above_Card_-3',
  fingerB3: '_FInger_B-_Above_Card_-2',
  fingerC3: '_FInger_C_-_Above_Card_-2',
  thumb3: '_Thumb_Behind_Card_-3'
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
  /** Time in milliseconds before intro animation replays (0 = always play) */
  replayInterval: 0,
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
