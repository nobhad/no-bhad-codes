/**
 * ===============================================
 * PDF STYLES CONFIGURATION
 * ===============================================
 * @file server/config/pdf-styles.ts
 *
 * Single source of truth for ALL PDF styling.
 * Mirrors portal design system: black foreground, thick borders,
 * uppercase headings, monospace feel.
 *
 * Every PDF generator imports from here. NO inline values.
 */

import { rgb } from 'pdf-lib';

const c = (r: number, g: number, b: number) => rgb(r, g, b);

// ============================================
// COLORS — black foreground, white background
// ============================================

export const PDF_COLORS = {
  /** All foreground text */
  black: c(0, 0, 0),
  /** White (table header text, backgrounds) */
  white: c(1, 1, 1),

  // Aliases — every token resolves to black for consistency
  title: c(0, 0, 0),
  subtitle: c(0, 0, 0),
  body: c(0, 0, 0),
  bodyLight: c(0, 0, 0),
  muted: c(0, 0, 0),
  faint: c(0, 0, 0),
  whisper: c(0, 0, 0),
  sectionHeading: c(0, 0, 0),
  brandGreen: c(0, 0, 0),
  watermarkGreen: c(0, 0, 0),
  signatureBlue: c(0, 0, 0),
  paymentGreen: c(0, 0, 0),
  continuationHeader: c(0, 0, 0),
  pageHeader: c(0, 0, 0),

  // Lines — all black
  divider: c(0, 0, 0),
  dividerLight: c(0, 0, 0),
  dividerVeryLight: c(0, 0, 0),
  pricingDivider: c(0, 0, 0),

  // Table header — dark bg, white text (matches portal .admin-table-header)
  tableHeaderBg: c(0, 0, 0),
  tableHeaderText: c(1, 1, 1),

  // Backgrounds
  boxHeaderBg: c(0, 0, 0),
  signatureBoxBg: c(1, 1, 1),
  boxBorder: c(0, 0, 0),
  signatureBoxBorder: c(0, 0, 0)
} as const;

// ============================================
// TYPOGRAPHY — matches portal tokens
// ============================================

export const PDF_TYPOGRAPHY = {
  /** Document title: "INVOICE", "CONTRACT" etc. Matches portal --font-size-2xl (~28pt) */
  titleSize: 28,
  /** Business name in header. Matches portal --font-size-lg (~15pt) */
  businessNameSize: 15,

  /** ALL body text, labels, values, list items. ONE size everywhere.
   *  Matches portal --font-size-2xs (~10pt) */
  bodySize: 10,

  /** Footer business info line */
  footerSize: 7,

  // Legacy aliases — all resolve to bodySize for uniformity
  titleLargeSize: 22,
  sectionHeadingSize: 10,
  subHeadingSize: 10,
  sowSectionSize: 10,
  labelSize: 10,
  smallSize: 10,
  finePrintSize: 8,
  pageNumberSize: 8,
  amountSize: 10,
  paymentHeaderSize: 10,
  typedSignatureSize: 24,
  watermarkSize: 72
} as const;

// ============================================
// SPACING — matches portal spacing tokens
// ============================================

export const PDF_SPACING = {
  // --- Line heights ---
  /** Standard line height (matches portal --space-2 = 16px, but tighter for print) */
  lineHeight: 14,
  /** Compact line height */
  lineHeightCompact: 12,
  /** Tight line height */
  lineHeightTight: 11,

  // --- Section spacing ---
  /** Gap after section label underline before content */
  sectionGap: 20,
  /** Gap between major sections */
  sectionSpacing: 25,
  /** Gap below a label before its content (e.g., "BILL TO:" then client info) */
  labelGap: 18,

  // --- Indentation ---
  indent: 10,
  indentDouble: 20,

  // --- Underlines — ONE thickness everywhere ---
  /** ALL underline thickness (consistent across every PDF) */
  underlineThickness: 1,
  /** Alias — same as underlineThickness */
  underlineThin: 1,

  // --- Dividers ---
  /** HR thickness (matches portal --border-width: 2px) */
  dividerThickness: 1,
  dividerThin: 0.5,
  dividerVeryThin: 0.25,

  // --- Table header ---
  /** Height of dark table header bar */
  tableHeaderHeight: 18,
  /** Text Y offset inside table header bar */
  tableHeaderTextOffset: 4,
  /** Padding inside table header bar */
  tableHeaderPadding: 7,

  // --- Two-column layout (matches invoice BILL TO / INVOICE DETAILS) ---
  /** Right column X offset from page center */
  rightColumnOffset: 36,
  /** Label column width in right-side detail pairs */
  detailLabelWidth: 100,

  // --- Footer ---
  footerY: 72,
  footerTextY: 54,
  legalTextY: 40,
  pageNumberMarginBottom: 30,

  // --- Header ---
  logoHeight: 100,

  // --- Legacy (kept for backward compat) ---
  sowLogoHeight: 50,
  maxSignatureWidth: 200,
  maxSignatureHeight: 50,
  pricingValueOffset: 180,
  receiptDetailOffset: 150,
  receiptBoxHeight: 140,
  receiptBoxHeaderHeight: 25,
  afterUnderline: 15,
  underlineLength: 200,
  pricingRowHeight: 16,
  paymentRowHeight: 18
} as const;

// ============================================
// CONVENIENCE
// ============================================

export const PDF_STYLES = {
  colors: PDF_COLORS,
  typography: PDF_TYPOGRAPHY,
  spacing: PDF_SPACING
} as const;
