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
 * Key values are configurable via environment variables
 * with sensible defaults for the No Bhad Codes brand.
 */

// ============================================
// COLOR TOKENS
// ============================================

/**
 * Semantic color constants for email templates.
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
  /** Dark header background (e.g. #1a1a2e) */
  headerBg: process.env.EMAIL_HEADER_BG || '#1a1a2e',
  /** Gradient end for the dark header */
  headerBgGradientEnd: process.env.EMAIL_HEADER_BG_END || '#16213e',
  /** Header text color */
  headerText: process.env.EMAIL_HEADER_TEXT || '#ffffff',

  /** Primary brand accent (neon green) */
  brandAccent: process.env.EMAIL_BRAND_ACCENT || '#7ff709',
  /** Alternate brand accent used in simple templates */
  brandAccentAlt: process.env.EMAIL_BRAND_ACCENT_ALT || '#00ff41',

  /** Primary body text */
  bodyText: '#333333',
  /** Secondary body text (labels, descriptions) */
  bodyTextLight: '#555555',
  /** Muted body text (footers, fine print) */
  bodyTextMuted: '#666666',
  /** Near-black body text (strong values) */
  bodyTextDark: '#222222',

  /** Email outer background */
  outerBg: '#f5f5f5',
  /** Main content area background */
  contentBg: '#f9f9f9',
  /** Alternate content background (info boxes, code blocks) */
  contentBgAlt: '#f8f9fa',
  /** Card / box background */
  cardBg: '#ffffff',
  /** Footer background */
  footerBg: '#f0f0f0',

  /** Standard border / divider */
  border: '#eeeeee',
  /** Heavier border for inputs / boxes */
  borderMedium: '#dddddd',

  /** Hyperlink color */
  link: '#0066cc',

  /** Primary button background — uses the brand accent */
  buttonPrimaryBg: process.env.EMAIL_BUTTON_COLOR || '#00ff41',
  /** Primary button text */
  buttonPrimaryText: '#000000',
  /** Secondary button background — uses dark header color */
  buttonSecondaryBg: process.env.EMAIL_BUTTON_SECONDARY || '#1a1a2e',
  /** Secondary button text */
  buttonSecondaryText: '#ffffff',
  /** Contract / neutral button */
  buttonContractBg: process.env.EMAIL_BUTTON_CONTRACT || '#00aff0',
  /** Contract button text */
  buttonContractText: '#ffffff',

  /** Section heading border accent (brand green line) */
  sectionBorder: '#7ff709',

  /** Feature badge / tag background */
  featureBadgeBg: '#e8f5e9',
  /** Feature badge / tag text */
  featureBadgeText: '#2e7d32',

  /** Highlight / warning box background */
  highlightBg: '#fff3cd',
  /** Highlight / warning box border */
  highlightBorder: '#ffc107',

  /** Info box background (admin action items) */
  infoBg: '#e7f5ff',
  /** Info box border */
  infoBorder: '#0066cc',

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
 */
export const EMAIL_LAYOUT = {
  /** Maximum width of the email container */
  containerMaxWidth: 600,
  /** Standard content padding */
  contentPadding: '20px',
  /** Header padding */
  headerPadding: '30px 20px',
  /** Standard border radius */
  borderRadius: '8px',
  /** Button border radius */
  buttonRadius: '4px',
  /** Contract button border radius */
  buttonContractRadius: '6px'
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

/**
 * Standard font stacks and sizes for email templates.
 */
export const EMAIL_TYPOGRAPHY = {
  /** Primary font stack (email-safe) */
  fontFamily: 'Arial, sans-serif',
  /** Enhanced font stack for modern clients */
  fontFamilyFull: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif',
  /** Standard line height */
  lineHeight: '1.6',
  /** Footer font size */
  footerFontSize: '0.9em',
  /** Small text (fine print, legal) */
  smallFontSize: '14px',
  /** Feature badge font size */
  badgeFontSize: '14px'
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
