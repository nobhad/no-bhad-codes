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

import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';

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
export function getPdfCacheKey(type: string, id: number | string, updatedAt?: string | Date): string {
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

  // Import standard fonts
  const { StandardFonts } = await import('pdf-lib');
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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
    color = rgb(0, 0, 0),
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
  const { StandardFonts } = await import('pdf-lib');
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const format = options?.format || ((p, t) => `Page ${p} of ${t}`);
  const fontSize = options?.fontSize || 9;
  const marginBottom = options?.marginBottom || 30;

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
      color: rgb(0.5, 0.5, 0.5)
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
