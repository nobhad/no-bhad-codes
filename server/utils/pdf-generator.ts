/**
 * ===============================================
 * PDF RESPONSE HELPERS
 * ===============================================
 * @file server/utils/pdf-generator.ts
 *
 * Shared helpers for sending PDF responses with
 * consistent headers and cache metadata.
 */

import { Response } from 'express';

type PdfDisposition = 'inline' | 'attachment';

interface PdfResponseOptions {
  filename: string;
  disposition?: PdfDisposition;
  cacheStatus?: string;
  contentType?: string;
}

export function sendPdfResponse(
  res: Response,
  pdfBytes: Uint8Array,
  options: PdfResponseOptions
): Response {
  const {
    filename,
    disposition = 'attachment',
    cacheStatus,
    contentType = 'application/pdf'
  } = options;

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBytes.length);
  if (cacheStatus) {
    res.setHeader('X-PDF-Cache', cacheStatus);
  }

  return res.send(Buffer.from(pdfBytes));
}
