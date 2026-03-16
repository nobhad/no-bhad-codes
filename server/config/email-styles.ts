/**
 * ===============================================
 * EMAIL STYLES CONFIGURATION
 * ===============================================
 * @file server/config/email-styles.ts
 *
 * Single source of truth for all colors and styling
 * used in email HTML templates across the application.
 *
 * All email-generating services should import from here
 * to ensure consistent branding and easy theme updates.
 *
 * Matches the portal's brutalist monospace design system:
 * - Monochrome palette (black/white/gray)
 * - No border-radius (sharp corners)
 * - No gradients
 * - Monospace typography
 * - Solid borders, minimal decoration
 *
 * Key values are configurable via environment variables
 * with sensible defaults for the No Bhad Codes brand.
 */

// ============================================
// COLOR TOKENS
// ============================================

/**
 * Semantic color constants for email templates.
 * Aligned with portal-theme.css design tokens.
 *
 * Convention:
 *  - env-backed values: colors that a client deployment may want to change
 *  - static values: standard grays / functional colors unlikely to change
 *
 * @example
 * import { EMAIL_COLORS } from '../config/email-styles.js';
 * const html = `<div style="background: ${EMAIL_COLORS.headerBg};">`;
 */
export const EMAIL_COLORS = {
  /** Header background — matches portal dark mode bg */
  headerBg: process.env.EMAIL_HEADER_BG || '#171717',
  /** Header gradient end — same as headerBg (no gradients in brutalist style) */
  headerBgGradientEnd: process.env.EMAIL_HEADER_BG || '#171717',
  /** Header text color — matches portal dark mode text */
  headerText: process.env.EMAIL_HEADER_TEXT || '#ffffff',

  /** Primary brand accent — matches portal --color-text-primary */
  brandAccent: process.env.EMAIL_BRAND_ACCENT || '#333333',
  /** Alternate brand accent — same as brandAccent (no dual-accent in brutalist) */
  brandAccentAlt: process.env.EMAIL_BRAND_ACCENT || '#333333',

  /** Primary body text — matches portal light --color-text-primary */
  bodyText: '#333333',
  /** Secondary body text (labels, descriptions) */
  bodyTextLight: '#555555',
  /** Muted body text (footers, fine print) */
  bodyTextMuted: '#666666',
  /** Near-black body text (strong values) */
  bodyTextDark: '#222222',

  /** Email outer background — matches portal light --color-bg-primary */
  outerBg: '#e0e0e0',
  /** Main content area background */
  contentBg: '#e0e0e0',
  /** Alternate content background (info boxes, code blocks) */
  contentBgAlt: '#f5f5f5',
  /** Card / box background */
  cardBg: '#ffffff',
  /** Footer background */
  footerBg: '#e0e0e0',

  /** Standard border — matches portal --color-border-primary */
  border: '#333333',
  /** Lighter border for secondary elements */
  borderLight: '#999999',
  /** Medium border — alias for backward compat */
  borderMedium: '#333333',

  /** Hyperlink color — matches portal text (underlined for distinction) */
  link: '#333333',

  /** Primary button background — solid, matches portal btn-primary */
  buttonPrimaryBg: process.env.EMAIL_BUTTON_COLOR || '#333333',
  /** Primary button text — matches portal btn-primary-hover-color */
  buttonPrimaryText: '#ffffff',
  /** Secondary button background — transparent/outlined in portal, solid border here */
  buttonSecondaryBg: process.env.EMAIL_BUTTON_SECONDARY || '#ffffff',
  /** Secondary button text */
  buttonSecondaryText: '#333333',
  /** Secondary button border */
  buttonSecondaryBorder: '#333333',
  /** Contract button — uses primary style in brutalist design */
  buttonContractBg: process.env.EMAIL_BUTTON_COLOR || '#333333',
  /** Contract button text */
  buttonContractText: '#ffffff',

  /** Section heading border accent — solid dark line */
  sectionBorder: '#333333',

  /** Feature badge / tag background */
  featureBadgeBg: '#f5f5f5',
  /** Feature badge / tag text */
  featureBadgeText: '#333333',
  /** Feature badge / tag border */
  featureBadgeBorder: '#333333',

  /** Highlight / warning box background */
  highlightBg: '#f5f5f5',
  /** Highlight / warning box border */
  highlightBorder: '#333333',

  /** Info box background */
  infoBg: '#f5f5f5',
  /** Info box border */
  infoBorder: '#333333',

  /** Danger / error / overdue color */
  danger: '#dc3545',
  /** Success / paid color */
  success: '#28a745'
} as const;

// ============================================
// LAYOUT TOKENS
// ============================================

/**
 * Standard layout values for email templates.
 * Brutalist: no border-radius, solid borders, sharp edges.
 */
export const EMAIL_LAYOUT = {
  /** Maximum width of the email container */
  containerMaxWidth: 600,
  /** Standard content padding */
  contentPadding: '20px',
  /** Header padding */
  headerPadding: '24px 20px',
  /** Border radius — brutalist: 0 everywhere */
  borderRadius: '0',
  /** Button border radius — brutalist: 0 */
  buttonRadius: '0',
  /** Border width — matches portal --border-width */
  borderWidth: '1px'
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

/**
 * Standard font stacks and sizes for email templates.
 * Uses monospace to match the portal's Inconsolata-based system.
 */
export const EMAIL_TYPOGRAPHY = {
  /** Primary font stack — monospace (email-safe fallbacks) */
  fontFamily: '"Inconsolata", "Cascadia Code", "Source Code Pro", Menlo, Consolas, "Courier New", monospace',
  /** Enhanced font stack for modern clients */
  fontFamilyFull: '"Inconsolata", ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "Courier New", monospace',
  /** Standard line height */
  lineHeight: '1.6',
  /** Body font size */
  bodyFontSize: '14px',
  /** Footer font size */
  footerFontSize: '12px',
  /** Small text (fine print, legal) */
  smallFontSize: '12px',
  /** Feature badge font size */
  badgeFontSize: '12px',
  /** Heading font size */
  headingFontSize: '16px',
  /** Letter spacing — matches portal uppercase labels */
  letterSpacingLabel: '0.05em',
  /** Text transform for labels */
  textTransformLabel: 'uppercase'
} as const;

// ============================================
// CONVENIENCE EXPORT
// ============================================

/**
 * Combined email styles export.
 * Prefer importing individual constants (EMAIL_COLORS, etc.)
 * for clarity, but this aggregate is available when convenient.
 */
export const EMAIL_STYLES = {
  colors: EMAIL_COLORS,
  layout: EMAIL_LAYOUT,
  typography: EMAIL_TYPOGRAPHY
} as const;
