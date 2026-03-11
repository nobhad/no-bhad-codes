/**
 * ===============================================
 * TIMING CONSTANTS
 * ===============================================
 * @file src/constants/timing.ts
 *
 * Centralized timing constants for animations, delays, and intervals.
 * Use these instead of magic numbers throughout the codebase.
 */

export const TIMING = {
  /** Duration to show copy feedback (e.g., "Copied!") */
  COPY_FEEDBACK: 2000,

  /** Modal animation duration */
  MODAL_ANIMATION: 300,

  /** Search input debounce delay */
  SEARCH_DEBOUNCE: 300,

  /** Status/data refresh interval */
  STATUS_REFRESH: 30000,

  /** Toast notification display duration (default) */
  TOAST_DURATION: 3000,

  /** Toast error notification display duration */
  TOAST_DURATION_ERROR: 5000,

  /** Toast warning notification display duration */
  TOAST_DURATION_WARNING: 4000,

  /** Toast hide animation duration */
  TOAST_ANIMATION: 300,

  /** Dropdown close delay */
  DROPDOWN_CLOSE_DELAY: 150,

  /** Input focus delay after render */
  INPUT_FOCUS_DELAY: 100,

  /** Skeleton loading minimum display time */
  SKELETON_MIN_DISPLAY: 500,

  /** Overlay fade out duration */
  OVERLAY_FADE: 150,

  /** Dialog close animation duration */
  DIALOG_CLOSE_ANIMATION: 150,

  /** Suggestion dropdown hide delay */
  SUGGESTION_HIDE_DELAY: 200,

  /** Long press detection threshold */
  LONG_PRESS_DURATION: 500,

  /** Message send debounce */
  MESSAGE_DEBOUNCE: 300,

  /** Message polling interval when a thread is active */
  MESSAGE_POLL_INTERVAL: 7000,

  /** Page transition duration */
  PAGE_TRANSITION: 600,

  /** Estimated time savings threshold (ms) */
  SAVINGS_THRESHOLD: 500,

  /** Intro loading failsafe timeout (prevents stuck loading state) */
  INTRO_LOADING_FAILSAFE: 10000,

  /** Contact form success message auto-hide duration */
  FORM_SUCCESS_AUTO_HIDE: 5000
} as const;

export type TimingKey = keyof typeof TIMING;

/**
 * Performance metric thresholds
 * Used for scoring and alerting
 */
export const PERFORMANCE_THRESHOLDS = {
  /** First Input Delay threshold (ms) */
  FID: 100,

  /** Time to First Byte threshold (ms) */
  TTFB: 200,

  /** Largest Contentful Paint threshold (ms) */
  LCP: 2500,

  /** Cumulative Layout Shift threshold */
  CLS: 0.1,

  /** Maximum bundle size before warning (bytes) */
  BUNDLE_SIZE: 600 * 1024,

  /** Perfect score baseline */
  PERFECT_SCORE: 100
} as const;

export type PerformanceThresholdKey = keyof typeof PERFORMANCE_THRESHOLDS;
