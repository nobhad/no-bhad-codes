/**
 * ===============================================
 * PORTAL CONSTANTS
 * ===============================================
 * @file src/react/config/portal-constants.ts
 *
 * Centralized constants for the portal. Eliminates
 * hardcoded magic numbers, localStorage keys, DOM selectors,
 * and other scattered values.
 */

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebar-collapsed',
  /** Generate scoped pagination page key */
  paginationPage: (storageKey: string) => `${storageKey}_page`,
  /** Generate scoped pagination size key */
  paginationSize: (storageKey: string) => `${storageKey}_pageSize`,
  /** Generate scoped filter key */
  filters: (storageKey: string) => `${storageKey}_filters`,
  /** Generate scoped search key */
  search: (storageKey: string) => `${storageKey}_search`,
  /** Generate scoped sort key */
  sort: (storageKey: string) => `${storageKey}_sort`
} as const;

// ============================================
// DOM SELECTORS
// ============================================

export const PORTAL_SELECTORS = {
  LAYOUT_CONTAINER: '.dashboard-layout',
  PORTAL_CONTAINER: '.portal'
} as const;

// ============================================
// THEME
// ============================================

export const THEME_ATTRIBUTE = 'data-theme';

// ============================================
// UI LIMITS
// ============================================

export const UI_LIMITS = {
  /** Maximum badge count to display before showing "99+" */
  MAX_BADGE_DISPLAY: 99,
  /** Maximum textarea auto-resize height in pixels */
  MAX_TEXTAREA_HEIGHT: 120,
  /** Disabled element opacity */
  DISABLED_OPACITY: 0.5
} as const;

// ============================================
// SIDEBAR
// ============================================

export const SIDEBAR = {
  WIDTH_COLLAPSED: 'sidebar-collapsed-width',
  WIDTH_EXPANDED: 'sidebar-expanded-width',
  TRANSITION: 'sidebar-transition'
} as const;

// ============================================
// ANIMATION DURATIONS (GSAP)
// ============================================

export const GSAP = {
  /** Duration for fast animations (scale-in, modals) */
  DURATION_FAST: 0.3,
  /** Duration for normal animations (fade-in, slide-in, stagger) */
  DURATION_NORMAL: 0.4,
  /** Duration for slow animations (scroll-reveal) */
  DURATION_SLOW: 0.6,
  /** Default easing function */
  EASE_DEFAULT: 'power2.out',
  /** Default fade-in Y offset */
  FADE_Y_OFFSET: 20,
  /** Scroll-reveal Y offset */
  SCROLL_Y_OFFSET: 50,
  /** Scale-in start value */
  SCALE_START: 0.9,
  /** Default stagger timing between items (fast lists, tables) */
  STAGGER_DEFAULT: 0.05,
  /** Medium stagger timing (card grids, feature lists) */
  STAGGER_MEDIUM: 0.06,
  /** Slow stagger timing (project cards, prominent items) */
  STAGGER_SLOW: 0.08,
  /** Default initial delay before stagger begins */
  STAGGER_DELAY_SHORT: 0.1,
  /** Medium initial delay before stagger begins */
  STAGGER_DELAY_MEDIUM: 0.15,
  /** Long initial delay before stagger begins */
  STAGGER_DELAY_LONG: 0.2
} as const;
