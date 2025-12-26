/**
 * ===============================================
 * CENTRALIZED ANIMATION CONSTANTS
 * ===============================================
 * @file src/config/animation-constants.ts
 *
 * Single source of truth for all GSAP animations
 * Replaces hardcoded values across the codebase
 */

// ============================================
// DURATIONS (seconds)
// ============================================

export const ANIMATION_DURATIONS = {
  INSTANT: 0,
  FAST: 0.2,
  NORMAL: 0.3,
  MEDIUM: 0.5,
  SLOW: 0.8,
  SLOWER: 1.2,
  SLOWEST: 1.6,

  // Component-specific durations
  CARD_FLIP: 0.8,
  CARD_TILT: 0.3,
  FORM_FIELD_DROP: 0.6,
  CONTACT_POPUP_FADE: 0.3,
  PAGE_TRANSITION_IN: 1.4,
  PAGE_TRANSITION_OUT: 0.4,
  HEADER_FADE: 0.5,

  // Semantic timing tokens
  THEME_TRANSITION: 0.4,      // --transition-theme: 0.4s
  MOUSE_INTERACTION: 0.2,      // --transition-mouse: 0.2s
  STANDARD_LENGTH: 0.5,        // --transition-length: 0.5s
  DRAMATIC_ENTRANCE: 0.8       // --transition-long: 0.8s
} as const;

// ============================================
// EASING CURVES
// ============================================

export const ANIMATION_EASING = {
  LINEAR: 'none',
  SMOOTH: 'power2.out',
  SHARP: 'power2.in',
  SMOOTH_IN_OUT: 'power2.inOut',
  ELASTIC: 'elastic.out(1, 0.5)',
  BACK: 'back.out(1.7)',
  BOUNCE: 'bounce.out',

  // Custom curves for specific animations
  PAGE_TRANSITION: 'power3.inOut',
  MORPH: 'power2.inOut',
  SVG_MORPH: 'none', // Linear easing for SVG path morphing - smoother vertex interpolation
  HERO_REVEAL: 'power2.out',

  // Advanced easing curves
  SPRING: 'cubic-bezier(0.25, 0.1, 0.25, 3.5)',      // Overshoot for hover interactions
  SMOOTH_SAL: 'cubic-bezier(0.3, 0.9, 0.3, 0.9)'    // Standard smooth animations
} as const;

// ============================================
// COLORS (for GSAP animations)
// ============================================

export const ANIMATION_COLORS = {
  SHADOW_DEFAULT: 'rgba(0, 0, 0, 0.5)',
  SHADOW_LIGHT: 'rgba(0, 0, 0, 0.3)',
  CARD_FILL: '#ffffff',
  OVERLAY_BG: 'rgba(0, 0, 0, 0.8)'
} as const;

// ============================================
// DIMENSIONS (pixels or degrees)
// ============================================

export const ANIMATION_DIMENSIONS = {
  // Form field dimensions (must match CSS variables in contact.css)
  FORM_FIELD_HEIGHT: 60,
  FORM_FIELD_COMPRESSED: 20,
  FORM_FIELD_WIDTH_START: 150,
  FORM_FIELD_WIDTH_FULL: 460, // --contact-input-width
  FORM_MESSAGE_WIDTH_FULL: 640, // --contact-textarea-width

  // Business card interaction dimensions
  CARD_HOVER_LIFT: 10, // pixels
  CARD_MAX_TILT: 12, // degrees
  CARD_GLOBAL_TILT: 3, // degrees
  CARD_MAGNETIC_RANGE: 200, // pixels

  // Contact animation dimensions
  CONTACT_DROP_DISTANCE: 50, // pixels

  // Hero animation dimensions
  HERO_CORNER_ZONE: 0.2 // 20% from edges
} as const;

// ============================================
// ANIMATION SEQUENCES
// ============================================

export const ANIMATION_SEQUENCES = {
  CONTACT_FORM: {
    TOTAL_DURATION: 1.2, // Balanced form animation
    FIELD_STAGGER: 0.08 // Moderate stagger
  },

  INTRO_MORPH: {
    ENTRY_DURATION: 0.8,
    CLUTCH_HOLD: 0.8,
    FINGER_RELEASE: 0.5,
    RETRACTION_DURATION: 1.6,
    RETRACTION_DELAY: 0.02,
    FINGER_MORPH_A: 0.08,
    FINGER_MORPH_B: 0.08,
    FINGER_MORPH_C: 0.2
  },

  HERO_ANIMATION: {
    DURATION: 2 // timeline units
  }
} as const;

// ============================================
// POSITIONS
// ============================================

export const ANIMATION_POSITIONS = {
  INTRO_ENTRY_START: { x: -800, y: -600 },
  INTRO_CENTER: { x: 0, y: 0 },
  INTRO_RETRACTION_END: { x: -1500, y: -1200 }
} as const;

// ============================================
// SHADOW CALCULATIONS
// ============================================

export const ANIMATION_SHADOWS = {
  // Intro animation shadow values
  SHADOW_BASE_OFFSET: 12,
  SHADOW_BLUR_OFFSET: 18,

  // Card shadow presets
  CARD_REST: '0 10px 30px rgba(0,0,0,0.3)',
  CARD_HOVER: '0 15px 40px rgba(0,0,0,0.4)'
} as const;

// ============================================
// PERFORMANCE
// ============================================

export const ANIMATION_PERFORMANCE = {
  THROTTLE_SCROLL: 16, // ~60fps
  THROTTLE_RESIZE: 100,
  THROTTLE_MOUSE_MOVE: 10,
  DEBOUNCE_WHEEL: 50
} as const;

// ============================================
// COMBINED CONSTANTS OBJECT
// ============================================

export const ANIMATION_CONSTANTS = {
  DURATIONS: ANIMATION_DURATIONS,
  EASING: ANIMATION_EASING,
  COLORS: ANIMATION_COLORS,
  DIMENSIONS: ANIMATION_DIMENSIONS,
  SEQUENCES: ANIMATION_SEQUENCES,
  POSITIONS: ANIMATION_POSITIONS,
  SHADOWS: ANIMATION_SHADOWS,
  PERFORMANCE: ANIMATION_PERFORMANCE
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Helper to get shadow offset values scaled by a multiplier
 * @param multiplier - Scale factor for shadow offset
 * @returns Shadow offset values
 */
export function calculateShadowOffset(multiplier: number = 1) {
  return {
    base: ANIMATION_SHADOWS.SHADOW_BASE_OFFSET * multiplier,
    blur: ANIMATION_SHADOWS.SHADOW_BLUR_OFFSET * multiplier
  };
}

/**
 * Helper to create GSAP timeline defaults with specified easing
 * @param ease - Easing curve key from ANIMATION_EASING
 * @returns Timeline defaults object
 */
export function getTimelineDefaults(ease: keyof typeof ANIMATION_EASING = 'SMOOTH') {
  return {
    ease: ANIMATION_EASING[ease]
  };
}
