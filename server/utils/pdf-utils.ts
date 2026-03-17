/**
 * ===============================================
 * PDF UTILITIES
 * ===============================================
 * @file server/utils/pdf-utils.ts
 *
 * Shared utilities for PDF generation including:
 * - In-memory caching with TTL
 * - Multi-page support helpers
 * - PDF/A compliance helpers
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import { PDF_COLORS, PDF_TYPOGRAPHY, PDF_SPACING } from '../config/pdf-styles.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';

// ============================================
// FONT LOADING — Inconsolata (portal monospace)
// ============================================

/** Cached font bytes to avoid repeated disk reads */
let _regularFontBytes: Buffer | null = null;
let _boldFontBytes: Buffer | null = null;

/**
 * Get Inconsolata Regular font bytes (cached after first read)
 */
export function getRegularFontBytes(): Buffer {
  if (!_regularFontBytes) {
    _regularFontBytes = readFileSync(join(process.cwd(), 'public/fonts/Inconsolata/Inconsolata-Regular.ttf'));
  }
  return _regularFontBytes;
}

/**
 * Get Inconsolata Bold font bytes (cached after first read)
 */
export function getBoldFontBytes(): Buffer {
  if (!_boldFontBytes) {
    _boldFontBytes = readFileSync(join(process.cwd(), 'public/fonts/Inconsolata/Inconsolata-Bold.ttf'));
  }
  return _boldFontBytes;
}

/**
 * Register fontkit on a PDFDocument (required before embedding custom fonts).
 * Safe to call multiple times — pdf-lib ignores duplicate registrations.
 */
export function registerFontkit(pdfDoc: PDFDocument): void {
  pdfDoc.registerFontkit(fontkit);
}

// ============================================
// PDF CACHING
// ============================================

interface CacheEntry {
  data: Uint8Array;
  createdAt: number;
  updatedAt: number; // Source document's updated_at timestamp
}

/**
 * Simple in-memory PDF cache with TTL
 * Key format: "{type}:{id}:{updatedAt}"
 */
const pdfCache = new Map<string, CacheEntry>();

/** Cache TTL in milliseconds (default: 5 minutes) */
const CACHE_TTL_MS = parseInt(process.env.PDF_CACHE_TTL_MS || '300000', 10);

/** Maximum cache entries (prevents memory bloat) */
const MAX_CACHE_ENTRIES = parseInt(process.env.PDF_CACHE_MAX_ENTRIES || '100', 10);

/**
 * Generate cache key for a PDF document
 * @param type - Document type (invoice, proposal, contract, intake)
 * @param id - Document ID
 * @param updatedAt - Last updated timestamp of source data
 */
export function getPdfCacheKey(
  type: string,
  id: number | string,
  updatedAt?: string | Date
): string {
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : 0;
  return `${type}:${id}:${timestamp}`;
}

/**
 * Get cached PDF if available and not expired
 * @param cacheKey - Cache key from getPdfCacheKey()
 * @returns Cached PDF bytes or null if not found/expired
 */
export function getCachedPdf(cacheKey: string): Uint8Array | null {
  const entry = pdfCache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.createdAt > CACHE_TTL_MS) {
    // Expired, remove from cache
    pdfCache.delete(cacheKey);
    return null;
  }

  return entry.data;
}

/**
 * Store PDF in cache
 * @param cacheKey - Cache key from getPdfCacheKey()
 * @param data - PDF bytes to cache
 * @param updatedAt - Source document's updated_at timestamp
 */
export function cachePdf(cacheKey: string, data: Uint8Array, updatedAt?: string | Date): void {
  // Enforce max cache size (LRU-style: remove oldest entries)
  if (pdfCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = pdfCache.keys().next().value;
    if (oldestKey) pdfCache.delete(oldestKey);
  }

  pdfCache.set(cacheKey, {
    data,
    createdAt: Date.now(),
    updatedAt: updatedAt ? new Date(updatedAt).getTime() : Date.now()
  });
}

/**
 * Invalidate cached PDF(s)
 * @param type - Document type to invalidate
 * @param id - Optional specific document ID (if omitted, invalidates all of type)
 */
export function invalidatePdfCache(type: string, id?: number | string): void {
  const prefix = id ? `${type}:${id}:` : `${type}:`;
  for (const key of pdfCache.keys()) {
    if (key.startsWith(prefix)) {
      pdfCache.delete(key);
    }
  }
}

/**
 * Clear entire PDF cache
 */
export function clearPdfCache(): void {
  pdfCache.clear();
}

/**
 * Get cache statistics
 */
export function getPdfCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return {
    size: pdfCache.size,
    maxSize: MAX_CACHE_ENTRIES,
    ttlMs: CACHE_TTL_MS
  };
}

// ============================================
// MULTI-PAGE SUPPORT
// ============================================

/** Standard page dimensions */
export const PAGE_DIMENSIONS = {
  LETTER: { width: 612, height: 792 },
  A4: { width: 595, height: 842 }
};

/** Standard margins (0.75 inch = 54 points) */
export const PAGE_MARGINS = {
  top: 54,
  bottom: 54,
  left: 54,
  right: 54
};

/**
 * Multi-page PDF context for tracking position and auto-page-breaks
 */
export interface PdfPageContext {
  pdfDoc: PDFDocument;
  currentPage: PDFPage;
  pageNumber: number;
  y: number;
  width: number;
  height: number;
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
  contentWidth: number;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
}

/**
 * Create a new PDF page context with standard layout
 */
export async function createPdfContext(
  pdfDoc: PDFDocument,
  options?: {
    pageSize?: 'LETTER' | 'A4';
    margins?: Partial<typeof PAGE_MARGINS>;
  }
): Promise<PdfPageContext> {
  const pageSize = PAGE_DIMENSIONS[options?.pageSize || 'LETTER'];
  const margins = { ...PAGE_MARGINS, ...options?.margins };

  const page = pdfDoc.addPage([pageSize.width, pageSize.height]);

  // Register fontkit for custom font embedding
  pdfDoc.registerFontkit(fontkit);

  // Embed Inconsolata (portal monospace font)
  const regular = await pdfDoc.embedFont(getRegularFontBytes());
  const bold = await pdfDoc.embedFont(getBoldFontBytes());

  return {
    pdfDoc,
    currentPage: page,
    pageNumber: 1,
    y: pageSize.height - margins.top,
    width: pageSize.width,
    height: pageSize.height,
    leftMargin: margins.left,
    rightMargin: pageSize.width - margins.right,
    topMargin: margins.top,
    bottomMargin: margins.bottom,
    contentWidth: pageSize.width - margins.left - margins.right,
    fonts: { regular, bold }
  };
}

/**
 * Check if we need a new page and create one if necessary
 * @param ctx - PDF page context
 * @param requiredSpace - Space needed for next content block (in points)
 * @param onNewPage - Optional callback when new page is created (for headers/footers)
 * @returns Updated context (may have new page)
 */
export function ensureSpace(
  ctx: PdfPageContext,
  requiredSpace: number,
  onNewPage?: (ctx: PdfPageContext) => void
): PdfPageContext {
  if (ctx.y - requiredSpace < ctx.bottomMargin) {
    // Need new page
    const newPage = ctx.pdfDoc.addPage([ctx.width, ctx.height]);
    ctx.currentPage = newPage;
    ctx.pageNumber++;
    ctx.y = ctx.height - ctx.topMargin;

    // Call new page callback (for headers, page numbers, etc.)
    if (onNewPage) {
      onNewPage(ctx);
    }
  }
  return ctx;
}

/**
 * Draw text with automatic word wrapping and page breaks
 * @param ctx - PDF page context
 * @param text - Text to draw
 * @param options - Drawing options
 * @returns Updated Y position
 */
export function drawWrappedText(
  ctx: PdfPageContext,
  text: string,
  options: {
    x?: number;
    fontSize?: number;
    font?: PDFFont;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    maxWidth?: number;
    onNewPage?: (ctx: PdfPageContext) => void;
  } = {}
): number {
  const {
    x = ctx.leftMargin,
    fontSize = 10,
    font = ctx.fonts.regular,
    color = PDF_COLORS.black,
    lineHeight = fontSize * 1.2,
    maxWidth = ctx.contentWidth,
    onNewPage
  } = options;

  const words = text.split(' ');
  let line = '';

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && line) {
      // Check for page break
      ensureSpace(ctx, lineHeight, onNewPage);

      // Draw current line
      ctx.currentPage.drawText(line, {
        x,
        y: ctx.y,
        size: fontSize,
        font,
        color
      });
      ctx.y -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }

  // Draw remaining text
  if (line) {
    ensureSpace(ctx, lineHeight, onNewPage);
    ctx.currentPage.drawText(line, {
      x,
      y: ctx.y,
      size: fontSize,
      font,
      color
    });
    ctx.y -= lineHeight;
  }

  return ctx.y;
}

/**
 * Add page number footer to all pages
 * @param pdfDoc - PDF document
 * @param options - Footer options
 */
export async function addPageNumbers(
  pdfDoc: PDFDocument,
  options?: {
    format?: (pageNum: number, totalPages: number) => string;
    fontSize?: number;
    marginBottom?: number;
  }
): Promise<void> {
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(getRegularFontBytes());
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const format = options?.format || ((p, t) => `Page ${p} of ${t}`);
  const fontSize = options?.fontSize || PDF_TYPOGRAPHY.pageNumberSize;
  const marginBottom = options?.marginBottom || PDF_SPACING.pageNumberMarginBottom;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const text = format(i + 1, totalPages);
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: marginBottom,
      size: fontSize,
      font,
      color: PDF_COLORS.faint
    });
  }
}

// ============================================
// PDF/A COMPLIANCE HELPERS
// ============================================

/**
 * Set PDF/A-compatible metadata
 * Note: Full PDF/A compliance requires font embedding (which pdf-lib does)
 * and XMP metadata (which requires additional processing)
 *
 * @param pdfDoc - PDF document
 * @param metadata - Document metadata
 */
export function setPdfMetadata(
  pdfDoc: PDFDocument,
  metadata: {
    title: string;
    author?: string;
    subject?: string;
    creator?: string;
    keywords?: string[];
    creationDate?: Date;
    modificationDate?: Date;
  }
): void {
  pdfDoc.setTitle(metadata.title);

  if (metadata.author) {
    pdfDoc.setAuthor(metadata.author);
  }

  if (metadata.subject) {
    pdfDoc.setSubject(metadata.subject);
  }

  if (metadata.creator) {
    pdfDoc.setCreator(metadata.creator);
  }

  if (metadata.keywords?.length) {
    pdfDoc.setKeywords(metadata.keywords);
  }

  if (metadata.creationDate) {
    pdfDoc.setCreationDate(metadata.creationDate);
  }

  if (metadata.modificationDate) {
    pdfDoc.setModificationDate(metadata.modificationDate);
  }

  // Set producer to indicate the generating application
  pdfDoc.setProducer('NoBhadCodes PDF Generator (pdf-lib)');
}

// ============================================
// DOCUMENT HEADER
// ============================================

/**
 * Draw the standard document header used by all PDF types:
 * - Title (INVOICE / PROPOSAL / RECEIPT / CONTRACT) on the left
 * - Logo + business info block on the right
 * - Horizontal divider below
 *
 * Based on the invoice header as the canonical style reference.
 *
 * @returns New y position (after the divider, ready for content)
 */
export async function drawPdfDocumentHeader(params: {
  page: PDFPage;
  pdfDoc: PDFDocument;
  fonts: { regular: PDFFont; bold: PDFFont };
  startY: number;
  leftMargin: number;
  rightMargin: number;
  title: string;
}): Promise<number> {
  const { page, pdfDoc, fonts, startY, leftMargin, rightMargin, title } = params;
  const { regular, bold } = fonts;

  // Title on the left (INVOICE / PROPOSAL / etc.)
  page.drawText(title, {
    x: leftMargin,
    y: startY - 20,
    size: PDF_TYPOGRAPHY.titleSize,
    font: bold,
    color: PDF_COLORS.black
  });

  // Logo + business info on the right (original layout)
  const logoHeight = PDF_SPACING.logoHeight;
  let textStartX = rightMargin - 180;

  const logoBytes = getPdfLogoBytes();
  if (logoBytes) {
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    const logoX = rightMargin - logoWidth - 150;
    page.drawImage(logoImage, {
      x: logoX,
      y: startY - logoHeight + 10,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = logoX + logoWidth + 18;
  }

  // Business info
  const infoSize = PDF_TYPOGRAPHY.bodySize;
  const infoLineHeight = 14;
  let infoY = startY - 11;

  // Business name — ALL CAPS
  page.drawText(BUSINESS_INFO.name.toUpperCase(), {
    x: textStartX,
    y: infoY,
    size: PDF_TYPOGRAPHY.businessNameSize,
    font: bold,
    color: PDF_COLORS.black
  });
  infoY -= 18;

  const infoLines = [
    BUSINESS_INFO.owner,
    BUSINESS_INFO.email,
    BUSINESS_INFO.website
  ].filter(Boolean);

  for (const line of infoLines) {
    page.drawText(line!, {
      x: textStartX,
      y: infoY,
      size: infoSize,
      font: regular,
      color: PDF_COLORS.black
    });
    infoY -= infoLineHeight;
  }

  // HR — just below the logo/info block, with space below for content
  const afterHeader = Math.min(startY - logoHeight - 6, infoY);
  page.drawLine({
    start: { x: leftMargin, y: afterHeader },
    end: { x: rightMargin, y: afterHeader },
    thickness: PDF_SPACING.dividerThickness,
    color: PDF_COLORS.black
  });

  return afterHeader - 21;
}

/**
 * Draw a two-column info section — matches the invoice BILL TO / INVOICE DETAILS layout.
 *
 * Left column: section label (bold uppercase + underline) + stacked values.
 * Right column: label:value pairs with right-aligned values.
 *
 * @returns Updated Y position (below whichever column is tallest).
 */
export function drawTwoColumnInfo(
  page: PDFPage,
  opts: {
    leftMargin: number;
    rightMargin: number;
    width: number;
    y: number;
    fonts: { regular: PDFFont; bold: PDFFont };
    left: {
      /** Bold uppercase label with underline (e.g. "BILL TO:") */
      label: string;
      /** Lines to draw below the label — first line is bold, rest are regular */
      lines: Array<{ text: string; bold?: boolean }>;
    };
    right: {
      /** label:value pairs drawn in the right column */
      pairs: Array<{ label: string; value: string }>;
    };
  }
): number {
  const { leftMargin, rightMargin, width, fonts } = opts;
  const size = PDF_TYPOGRAPHY.bodySize;
  const lineHeight = PDF_SPACING.lineHeight;
  const detailsX = width / 2 + 36;
  let y = opts.y;

  // --- LEFT COLUMN: section label + client lines ---
  const labelText = opts.left.label.toUpperCase();
  page.drawText(labelText, {
    x: leftMargin,
    y,
    size,
    font: fonts.bold,
    color: PDF_COLORS.black
  });
  let leftY = y - 20;
  for (const line of opts.left.lines) {
    if (!line.text) continue;
    page.drawText(line.text, {
      x: leftMargin,
      y: leftY,
      size,
      font: line.bold ? fonts.bold : fonts.regular,
      color: PDF_COLORS.black
    });
    leftY -= 11;
  }

  // --- RIGHT COLUMN: label:value pairs (value right-aligned) ---
  // Minimum gap between label and value to prevent overlap
  const MIN_LABEL_VALUE_GAP = 8;

  const drawRightAligned = (text: string, yPos: number, font: PDFFont, labelEndX: number) => {
    const maxValueWidth = rightMargin - labelEndX - MIN_LABEL_VALUE_GAP;
    let displayText = text;
    // Truncate with ellipsis if value is too wide
    if (font.widthOfTextAtSize(displayText, size) > maxValueWidth) {
      while (displayText.length > 1 && font.widthOfTextAtSize(displayText + '...', size) > maxValueWidth) {
        displayText = displayText.slice(0, -1);
      }
      displayText = displayText.trimEnd() + '...';
    }
    const w = font.widthOfTextAtSize(displayText, size);
    page.drawText(displayText, { x: rightMargin - w, y: yPos, size, font, color: PDF_COLORS.black });
  };

  let rightY = y;
  for (const pair of opts.right.pairs) {
    page.drawText(pair.label, {
      x: detailsX,
      y: rightY,
      size,
      font: fonts.bold,
      color: PDF_COLORS.black
    });
    const labelEndX = detailsX + fonts.bold.widthOfTextAtSize(pair.label, size);
    drawRightAligned(pair.value, rightY, fonts.regular, labelEndX);
    rightY -= lineHeight;
  }

  // Return the lower of the two columns, plus a gap
  return Math.min(leftY, rightY) - 14;
}

/**
 * Draw a section label with text-width underline.
 * Matches invoice "BILL TO:" and "PAYMENT INSTRUCTIONS" exactly.
 * Bold uppercase, bodySize, 0.5pt underline 4px below, sectionGap gap after.
 *
 * @returns Updated Y position (ready for content below the label).
 */
export function drawSectionLabel(
  page: PDFPage,
  label: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
  }
): number {
  const size = PDF_TYPOGRAPHY.sectionHeadingSize;
  const text = label.toUpperCase();

  page.drawText(text, {
    x: opts.x,
    y: opts.y,
    size,
    font: opts.font,
    color: PDF_COLORS.black
  });

  const textW = opts.font.widthOfTextAtSize(text, size);
  page.drawLine({
    start: { x: opts.x, y: opts.y - 4 },
    end: { x: opts.x + textW, y: opts.y - 4 },
    thickness: PDF_SPACING.dividerThin,
    color: PDF_COLORS.black
  });

  return opts.y - PDF_SPACING.sectionGap;
}

/**
 * Draw a section heading — consistent across all PDF types.
 * Renders bold uppercase text with an underline, matching the invoice table heading style.
 */
export function drawSectionHeading(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    font: PDFFont;
    width?: number;
  }
): number {
  const { x, y, font } = opts;
  const size = PDF_TYPOGRAPHY.sectionHeadingSize;

  page.drawText(text.toUpperCase(), {
    x,
    y,
    size,
    font,
    color: PDF_COLORS.black
  });

  const lineY = y - 4;
  const lineEnd = opts.width ? x + opts.width : x + font.widthOfTextAtSize(text.toUpperCase(), size);

  page.drawLine({
    start: { x, y: lineY },
    end: { x: lineEnd, y: lineY },
    thickness: PDF_SPACING.underlineThickness,
    color: PDF_COLORS.black
  });

  return y - PDF_SPACING.sectionGap;
}

/**
 * Draw a label: value pair on one line — consistent across all PDF types.
 */
export function drawLabelValue(
  page: PDFPage,
  label: string,
  value: string,
  opts: {
    x: number;
    y: number;
    labelFont: PDFFont;
    valueFont: PDFFont;
    labelWidth?: number;
  }
): number {
  const size = PDF_TYPOGRAPHY.bodySize;
  const labelW = opts.labelWidth || 120;

  page.drawText(label, {
    x: opts.x,
    y: opts.y,
    size,
    font: opts.labelFont,
    color: PDF_COLORS.black
  });

  page.drawText(value, {
    x: opts.x + labelW,
    y: opts.y,
    size,
    font: opts.valueFont,
    color: PDF_COLORS.black
  });

  return opts.y - PDF_SPACING.lineHeight;
}

/**
 * Draw a table header row — dark background with white uppercase text.
 * Matches the invoice line items table header style.
 *
 * @param page - PDF page to draw on
 * @param columns - Array of { label, x } for each column header
 * @param opts - Position and font options
 * @returns Y position after the header
 */
export function drawTableHeader(
  page: PDFPage,
  columns: Array<{ label: string; x: number; align?: 'left' | 'right' }>,
  opts: {
    y: number;
    leftMargin: number;
    rightMargin: number;
    font: PDFFont;
    height?: number;
  }
): number {
  const height = opts.height || 18;
  const textSize = PDF_TYPOGRAPHY.bodySize;

  // Dark background bar
  page.drawRectangle({
    x: opts.leftMargin,
    y: opts.y - 2,
    width: opts.rightMargin - opts.leftMargin,
    height,
    color: PDF_COLORS.tableHeaderBg
  });

  // Column labels in white
  for (const col of columns) {
    const label = col.label.toUpperCase();
    let x = col.x;

    if (col.align === 'right') {
      const w = opts.font.widthOfTextAtSize(label, textSize);
      x = col.x - w;
    }

    page.drawText(label, {
      x,
      y: opts.y + 4,
      size: textSize,
      font: opts.font,
      color: PDF_COLORS.tableHeaderText
    });
  }

  return opts.y - height - 4;
}

/**
 * Draw the standard PDF footer — HR + thank you + business info.
 * Call this at the bottom of every PDF's last page (or every page).
 *
 * Matches the invoice footer as the canonical style reference.
 */
export function drawPdfFooter(
  page: PDFPage,
  opts: {
    leftMargin: number;
    rightMargin: number;
    width: number;
    fonts: { regular: PDFFont; bold: PDFFont };
    thankYouText?: string;
  }
): void {
  const footerY = PDF_SPACING.footerY;

  // HR
  page.drawLine({
    start: { x: opts.leftMargin, y: footerY },
    end: { x: opts.rightMargin, y: footerY },
    thickness: PDF_SPACING.dividerThin,
    color: PDF_COLORS.dividerLight
  });

  // Thank you text (centered)
  const thankYou = opts.thankYouText || 'Thank you for your business!';
  const thankYouW = opts.fonts.regular.widthOfTextAtSize(thankYou, PDF_TYPOGRAPHY.bodySize);
  page.drawText(thankYou, {
    x: (opts.width - thankYouW) / 2,
    y: PDF_SPACING.footerTextY,
    size: PDF_TYPOGRAPHY.bodySize,
    font: opts.fonts.regular,
    color: PDF_COLORS.black
  });

  // Business info line (centered)
  const bizLine = `${BUSINESS_INFO.name} \u2022 ${BUSINESS_INFO.owner} \u2022 ${BUSINESS_INFO.email} \u2022 ${BUSINESS_INFO.website}`;
  const bizW = opts.fonts.regular.widthOfTextAtSize(bizLine, PDF_TYPOGRAPHY.footerSize);
  page.drawText(bizLine, {
    x: (opts.width - bizW) / 2,
    y: PDF_SPACING.legalTextY,
    size: PDF_TYPOGRAPHY.footerSize,
    font: opts.fonts.regular,
    color: PDF_COLORS.black
  });
}

/**
 * PDF/A compliance checklist (for documentation)
 * Full PDF/A-1b compliance requires:
 * 1. All fonts embedded (pdf-lib does this automatically for standard fonts)
 * 2. No JavaScript or executable content (we don't add any)
 * 3. No external content references (we embed everything)
 * 4. Color space defined (we use RGB which is acceptable)
 * 5. XMP metadata stream (requires additional library for full compliance)
 * 6. PDF version 1.4 or higher (pdf-lib uses 1.7)
 *
 * Current implementation achieves "PDF/A-like" compliance suitable for
 * most archival purposes without requiring additional dependencies.
 */
export const PDF_A_COMPLIANCE_NOTES = {
  fontsEmbedded: true,
  noJavaScript: true,
  noExternalReferences: true,
  colorSpace: 'RGB',
  xmpMetadata: false, // Would require additional library
  pdfVersion: '1.7'
};
