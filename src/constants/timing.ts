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

  /** Toast notification display duration */
  TOAST_DURATION: 3000,

  /** Dropdown close delay */
  DROPDOWN_CLOSE_DELAY: 150,

  /** Input focus delay after render */
  INPUT_FOCUS_DELAY: 100,

  /** Skeleton loading minimum display time */
  SKELETON_MIN_DISPLAY: 500,

  /** Overlay fade out duration */
  OVERLAY_FADE: 150,

  /** Suggestion dropdown hide delay */
  SUGGESTION_HIDE_DELAY: 200,

  /** Long press detection threshold */
  LONG_PRESS_DURATION: 500,

  /** Message send debounce */
  MESSAGE_DEBOUNCE: 300
} as const;

export type TimingKey = keyof typeof TIMING;
