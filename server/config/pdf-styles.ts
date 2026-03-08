/**
 * ===============================================
 * PDF STYLES CONFIGURATION
 * ===============================================
 * @file server/config/pdf-styles.ts
 *
 * Single source of truth for all colors, typography,
 * and spacing used in PDF generation (pdf-lib).
 *
 * All PDF services (sow, receipt, proposal, contract)
 * should import from here to ensure consistent styling.
 *
 * Colors are expressed as { r, g, b } objects (0-1 range)
 * matching pdf-lib's rgb() function signature.
 */

import { rgb } from 'pdf-lib';

// ============================================
// HELPER
// ============================================

/** Shorthand to create an rgb color value for pdf-lib */
const c = (r: number, g: number, b: number) => rgb(r, g, b);

// ============================================
// COLOR TOKENS
// ============================================

/**
 * Semantic color constants for PDF rendering.
 *
 * All values are pdf-lib rgb() compatible (0-1 range).
 * Grouped by purpose for easy discovery.
 *
 * @example
 * import { PDF_COLORS } from '../config/pdf-styles.js';
 * page.drawText('Title', { color: PDF_COLORS.title });
 */
export const PDF_COLORS = {
  // --- Text hierarchy ---
  /** Main title text — near-black */
  title: c(0.1, 0.1, 0.1),
  /** Secondary title / project name */
  subtitle: c(0.2, 0.2, 0.2),
  /** Standard body text — near-black */
  body: c(0.1, 0.1, 0.1),
  /** Secondary body text (descriptions, emails) */
  bodyLight: c(0.3, 0.3, 0.3),
  /** Muted text (dates, fine print) */
  muted: c(0.4, 0.4, 0.4),
  /** Very muted text (page numbers, legal) */
  faint: c(0.5, 0.5, 0.5),
  /** Lightest text (watermarks, IP addresses) */
  whisper: c(0.6, 0.6, 0.6),
  /** Pure black */
  black: c(0, 0, 0),

  // --- Section headings (proposals) ---
  /** Blue section heading color used in proposals */
  sectionHeading: c(0, 0.4, 0.8),

  // --- Branding ---
  /** Brand green accent (underlines, highlights) */
  brandGreen: c(0.5, 0.99, 0.04),
  /** Signed watermark green */
  watermarkGreen: c(0, 0.6, 0.2),
  /** Typed signature blue */
  signatureBlue: c(0, 0, 0.6),
  /** Payment confirmed green */
  paymentGreen: c(0.13, 0.55, 0.13),

  // --- Lines & borders ---
  /** Standard divider line */
  divider: c(0.7, 0.7, 0.7),
  /** Light divider (between table rows) */
  dividerLight: c(0.8, 0.8, 0.8),
  /** Very light divider (row separators) */
  dividerVeryLight: c(0.85, 0.85, 0.85),
  /** Section title underline (pricing divider) */
  pricingDivider: c(0.7, 0.7, 0.7),

  // --- Backgrounds ---
  /** Receipt details box header background */
  boxHeaderBg: c(0.95, 0.95, 0.95),
  /** Signature box background */
  signatureBoxBg: c(0.98, 0.98, 0.98),
  /** Receipt box border */
  boxBorder: c(0.8, 0.8, 0.8),
  /** Signature box border */
  signatureBoxBorder: c(0.7, 0.7, 0.7),

  // --- Continuation header ---
  /** Continuation header on subsequent pages */
  continuationHeader: c(0.5, 0.5, 0.5),
  /** Page header on subsequent pages (SOW) */
  pageHeader: c(0.5, 0.5, 0.5),
} as const;

// ============================================
// TYPOGRAPHY TOKENS
// ============================================

/**
 * Standard font sizes (in points) for PDF generation.
 * Grouped by document element for consistency across services.
 */
export const PDF_TYPOGRAPHY = {
  /** Document main title (e.g. "PROPOSAL", "RECEIPT") */
  titleSize: 28,
  /** Large title (SOW "STATEMENT OF WORK") */
  titleLargeSize: 22,
  /** Section heading size */
  sectionHeadingSize: 14,
  /** Sub-section heading size */
  subHeadingSize: 12,
  /** Section heading (SOW numbered sections) */
  sowSectionSize: 12,
  /** Label/field name size */
  labelSize: 11,
  /** Standard body text */
  bodySize: 10,
  /** Small body text (descriptions, terms) */
  smallSize: 9,
  /** Fine print (legal, payment notes) */
  finePrintSize: 8,
  /** Footer text size */
  footerSize: 7,
  /** Page number font size */
  pageNumberSize: 9,
  /** Payment amount display size */
  amountSize: 18,
  /** Payment confirmed header */
  paymentHeaderSize: 16,
  /** Business name in header */
  businessNameSize: 15,
  /** Typed signature size */
  typedSignatureSize: 24,
  /** Watermark text size */
  watermarkSize: 72,
} as const;

// ============================================
// SPACING TOKENS
// ============================================

/**
 * Standard spacing values (in points) for PDF layout.
 */
export const PDF_SPACING = {
  /** Standard line height for body text */
  lineHeight: 14,
  /** Compact line height (terms, descriptions) */
  lineHeightCompact: 12,
  /** Tight line height (terms text) */
  lineHeightTight: 11,
  /** Pricing row height */
  pricingRowHeight: 16,
  /** Payment schedule row height */
  paymentRowHeight: 18,

  /** Gap after section title before content */
  sectionGap: 20,
  /** Gap between major document sections */
  sectionSpacing: 25,
  /** Indent for list items / sub-content */
  indent: 10,
  /** Double indent for nested content */
  indentDouble: 20,

  /** Space after drawing a section underline */
  afterUnderline: 15,
  /** Section underline length */
  underlineLength: 200,
  /** Section underline thickness */
  underlineThickness: 2,

  /** Standard divider thickness */
  dividerThickness: 1,
  /** Thin divider thickness (row separators) */
  dividerThin: 0.5,
  /** Very thin divider (light separators) */
  dividerVeryThin: 0.25,

  /** Footer position from bottom */
  footerY: 72,
  /** Legal text position from bottom */
  legalTextY: 40,
  /** Footer text position from bottom */
  footerTextY: 54,
  /** Page number margin from bottom */
  pageNumberMarginBottom: 30,

  /** Logo height in header */
  logoHeight: 100,
  /** SOW logo height */
  sowLogoHeight: 50,
  /** Max signature image width */
  maxSignatureWidth: 200,
  /** Max signature image height */
  maxSignatureHeight: 50,

  /** Value column X offset from left margin (SOW pricing) */
  pricingValueOffset: 180,
  /** Detail value column X offset in receipt */
  receiptDetailOffset: 150,
  /** Receipt details box height */
  receiptBoxHeight: 140,
  /** Receipt box header height */
  receiptBoxHeaderHeight: 25,
} as const;

// ============================================
// CONVENIENCE EXPORT
// ============================================

/**
 * Combined PDF styles export.
 * Prefer importing individual constants (PDF_COLORS, etc.)
 * for clarity, but this aggregate is available when convenient.
 */
export const PDF_STYLES = {
  colors: PDF_COLORS,
  typography: PDF_TYPOGRAPHY,
  spacing: PDF_SPACING,
} as const;
