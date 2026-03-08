/**
 * ===============================================
 * Z-INDEX CONSTANTS
 * ===============================================
 * @file src/constants/z-index.ts
 *
 * Centralized z-index values for JavaScript-driven styling.
 * For CSS-only z-index, use CSS variables (--z-header, --z-nav, --z-modal)
 * defined in src/styles/variables.css.
 *
 * These constants are for use in GSAP animations and
 * programmatic DOM manipulation where CSS variables
 * cannot be applied directly.
 */

/**
 * Z-index layers for contact form animation stacking.
 * Higher values appear on top. Name field sits on top
 * of the stack so cascading fields slide behind it.
 */
export const Z_INDEX_CONTACT_FORM = {
  NAME_FIELD: 5,
  COMPANY_FIELD: 4,
  EMAIL_FIELD: 3,
  MESSAGE_FIELD: 2,
  SUBMIT_BUTTON: 10
} as const;

/**
 * Z-index for the consent banner overlay.
 * Must sit above all other page content including modals.
 */
export const Z_INDEX_CONSENT_BANNER = 10001;

/**
 * Z-index for the about hero avatar container.
 * Positions the avatar above the SVG text animation.
 */
export const Z_INDEX_ABOUT_HERO_AVATAR = 10;
