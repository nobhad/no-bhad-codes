/**
 * ===============================================
 * INVOICE PDF GENERATION ROUTES
 * ===============================================
 * @file server/routes/invoices/pdf.ts
 *
 * PDF generation for invoices including preview functionality
 */

import express from 'express';
import { PDFDocument as PDFLibDocument, StandardFonts } from 'pdf-lib';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { InvoiceLineItem } from '../../services/invoice-service.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { PDF_COLORS, PDF_TYPOGRAPHY } from '../../config/pdf-styles.js';
import { ErrorCodes, errorResponse } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';
import {
  PdfPageContext,
  ensureSpace,
  addPageNumbers,
  PAGE_MARGINS,
  drawPdfDocumentHeader,
  drawPdfFooter
} from '../../utils/pdf-utils.js';
import { logger } from '../../services/logger.js';
import { getInvoiceService } from './helpers.js';

const router = express.Router();

// ============================================
// TYPES
// ============================================

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedDate: string;
  dueDate?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail: string;
  clientAddress?: string;
  clientCityStateZip?: string;
  clientPhone?: string;
  projectId?: number;
  lineItems: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    details?: string[];
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  notes?: string;
  terms?: string;
  isDeposit?: boolean;
  depositPercentage?: number;
  credits?: Array<{
    depositInvoiceNumber: string;
    amount: number;
  }>;
  totalCredits?: number;
}

// ============================================
// PDF GENERATION
// ============================================

/**
 * Generate invoice PDF using pdf-lib with multi-page support
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFLibDocument.create();

  pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
  pdfDoc.setAuthor(BUSINESS_INFO.name);
  pdfDoc.setSubject('Invoice');
  pdfDoc.setCreator('NoBhadCodes');

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  const { width, height } = currentPage.getSize();

  const ctx: PdfPageContext = {
    pdfDoc,
    currentPage,
    pageNumber: 1,
    y: height - 43,
    width: pageWidth,
    height: pageHeight,
    leftMargin: PAGE_MARGINS.left,
    rightMargin: pageWidth - PAGE_MARGINS.right,
    topMargin: PAGE_MARGINS.top,
    bottomMargin: PAGE_MARGINS.bottom,
    contentWidth: pageWidth - PAGE_MARGINS.left - PAGE_MARGINS.right,
    fonts: { regular: helvetica, bold: helveticaBold }
  };

  const page = () => ctx.currentPage;

  const drawContinuationHeader = (context: PdfPageContext) => {
    context.currentPage.drawText(`Invoice ${data.invoiceNumber} (continued)`, {
      x: ctx.leftMargin,
      y: context.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    context.y -= 20;
  };

  const leftMargin = ctx.leftMargin;
  const rightMargin = ctx.rightMargin;

  // === HEADER ===
  ctx.y = await drawPdfDocumentHeader({
    page: page(),
    pdfDoc,
    fonts: { regular: helvetica, bold: helveticaBold },
    startY: ctx.y,
    leftMargin,
    rightMargin,
    title: 'INVOICE'
  });

  // === BILL TO & INVOICE DETAILS ===
  const detailsX = width / 2 + 36;

  page().drawText('BILL TO:', {
    x: leftMargin,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  // Company name first (bold) if present, then contact name below
  let clientLineY = ctx.y - 20;
  if (data.clientCompany) {
    page().drawText(data.clientCompany, {
      x: leftMargin,
      y: clientLineY,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    clientLineY -= 11;
    // Contact name after company (regular weight)
    page().drawText(data.clientName, {
      x: leftMargin,
      y: clientLineY,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    clientLineY -= 11;
  } else {
    // No company — contact name is the primary (bold)
    page().drawText(data.clientName, {
      x: leftMargin,
      y: clientLineY,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    clientLineY -= 11;
  }
  if (data.clientAddress) {
    page().drawText(data.clientAddress, {
      x: leftMargin,
      y: clientLineY,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    clientLineY -= 11;
  }
  if (data.clientCityStateZip) {
    page().drawText(data.clientCityStateZip, {
      x: leftMargin,
      y: clientLineY,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    clientLineY -= 11;
  }
  page().drawText(data.clientEmail, {
    x: leftMargin,
    y: clientLineY,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helvetica,
    color: PDF_COLORS.black
  });
  clientLineY -= 11;
  if (data.clientPhone) {
    page().drawText(data.clientPhone, {
      x: leftMargin,
      y: clientLineY,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
  }

  const drawRightAligned = (text: string, yPos: number, font: typeof helvetica, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    page().drawText(text, { x: rightMargin - w, y: yPos, size, font, color: PDF_COLORS.black });
  };

  page().drawText('INVOICE #:', {
    x: detailsX,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  drawRightAligned(data.invoiceNumber, ctx.y, helvetica, 9);
  page().drawText('INVOICE DATE:', {
    x: detailsX,
    y: ctx.y - 14,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  drawRightAligned(data.issuedDate, ctx.y - 14, helvetica, 9);
  page().drawText('DUE DATE:', {
    x: detailsX,
    y: ctx.y - 28,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  drawRightAligned(data.dueDate || 'Upon Receipt', ctx.y - 28, helvetica, 9);

  if (data.projectId) {
    page().drawText('PROJECT #:', {
      x: detailsX,
      y: ctx.y - 42,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    drawRightAligned(`#${data.projectId}`, ctx.y - 42, helvetica, 9);
  }

  ctx.y -= 90;

  // === LINE ITEMS TABLE ===
  page().drawRectangle({
    x: leftMargin,
    y: ctx.y - 2,
    width: rightMargin - leftMargin,
    height: 18,
    color: PDF_COLORS.tableHeaderBg
  });

  page().drawText('DESCRIPTION', {
    x: leftMargin + 7,
    y: ctx.y + 4,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.tableHeaderText
  });
  page().drawText('QTY', {
    x: rightMargin - 144,
    y: ctx.y + 4,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.tableHeaderText
  });
  page().drawText('RATE', {
    x: rightMargin - 94,
    y: ctx.y + 4,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.tableHeaderText
  });
  const amountLabel = 'AMOUNT';
  const amountLabelW = helveticaBold.widthOfTextAtSize(amountLabel, 10);
  page().drawText(amountLabel, {
    x: rightMargin - 7 - amountLabelW,
    y: ctx.y + 4,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.tableHeaderText
  });

  ctx.y -= 22;

  for (const item of data.lineItems) {
    const estimatedItemHeight = 14 + (item.details?.length || 0) * 11 + 7;
    ensureSpace(ctx, estimatedItemHeight, drawContinuationHeader);

    page().drawText(item.description, {
      x: leftMargin + 7,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    page().drawText(String(item.quantity), {
      x: rightMargin - 144,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });

    const rateText = `$${item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    page().drawText(rateText, {
      x: rightMargin - 94,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });

    const amountText = `$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const amountW = helveticaBold.widthOfTextAtSize(amountText, 10);
    page().drawText(amountText, {
      x: rightMargin - amountW,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });

    ctx.y -= 14;

    if (item.details && item.details.length > 0) {
      const detailStartX = leftMargin + 18;
      const detailMaxWidth = rightMargin - 154 - detailStartX;
      const detailLineHeight = 11;

      for (const detail of item.details) {
        const words = detail.split(' ');
        let line = '• ';
        let isFirstLine = true;

        for (const word of words) {
          const testLine = line + (line === '• ' ? '' : ' ') + word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, 9);

          if (testWidth > detailMaxWidth && line !== '• ') {
            ensureSpace(ctx, detailLineHeight, drawContinuationHeader);
            page().drawText(line, {
              x: detailStartX,
              y: ctx.y,
              size: PDF_TYPOGRAPHY.bodySize,
              font: helvetica,
              color: PDF_COLORS.black
            });
            ctx.y -= detailLineHeight;
            line = isFirstLine ? `  ${word}` : `  ${word}`;
            isFirstLine = false;
          } else {
            line = testLine;
          }
        }
        if (line && line !== '• ') {
          ensureSpace(ctx, detailLineHeight, drawContinuationHeader);
          page().drawText(line, {
            x: detailStartX,
            y: ctx.y,
            size: PDF_TYPOGRAPHY.bodySize,
            font: helvetica,
            color: PDF_COLORS.black
          });
          ctx.y -= detailLineHeight;
        }
      }
      ctx.y -= 7;
    }
  }

  // === TOTALS ===
  ensureSpace(ctx, 150, drawContinuationHeader);
  const totalsX = rightMargin - 144;
  ctx.y -= 24;

  page().drawLine({
    start: { x: totalsX - 14, y: ctx.y + 18 },
    end: { x: rightMargin, y: ctx.y + 18 },
    thickness: 0.5,
    color: PDF_COLORS.divider
  });

  page().drawText('Subtotal:', {
    x: totalsX,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helvetica,
    color: PDF_COLORS.black
  });
  const subtotalText = `$${data.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const subtotalW = helvetica.widthOfTextAtSize(subtotalText, 10);
  page().drawText(subtotalText, {
    x: rightMargin - subtotalW,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helvetica,
    color: PDF_COLORS.black
  });

  if (data.discount && data.discount > 0) {
    ctx.y -= 16;
    page().drawText('Discount:', {
      x: totalsX,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    const discountText = `-$${data.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const discountW = helvetica.widthOfTextAtSize(discountText, 10);
    page().drawText(discountText, {
      x: rightMargin - discountW,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
  }

  if (data.tax && data.tax > 0) {
    ctx.y -= 16;
    page().drawText('Tax:', {
      x: totalsX,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    const taxText = `$${data.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const taxW = helvetica.widthOfTextAtSize(taxText, 10);
    page().drawText(taxText, {
      x: rightMargin - taxW,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
  }

  if (data.credits && data.credits.length > 0) {
    ctx.y -= 24;
    page().drawText('DEPOSIT CREDITS APPLIED:', {
      x: totalsX - 40,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helveticaBold,
      color: PDF_COLORS.black
    });
    ctx.y -= 14;

    for (const credit of data.credits) {
      const creditLabel = `Deposit ${credit.depositInvoiceNumber}`;
      page().drawText(creditLabel, {
        x: totalsX,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: helvetica,
        color: PDF_COLORS.black
      });
      const creditText = `-$${credit.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      const creditW = helvetica.widthOfTextAtSize(creditText, 9);
      page().drawText(creditText, {
        x: rightMargin - creditW,
        y: ctx.y,
        size: PDF_TYPOGRAPHY.bodySize,
        font: helvetica,
        color: PDF_COLORS.black
      });
      ctx.y -= 12;
    }
  }

  ctx.y -= 32;

  page().drawLine({
    start: { x: totalsX - 14, y: ctx.y + 18 },
    end: { x: rightMargin, y: ctx.y + 18 },
    thickness: 2,
    color: PDF_COLORS.divider
  });

  const finalTotal = data.totalCredits ? data.total - data.totalCredits : data.total;
  const totalLabel = data.totalCredits && data.totalCredits > 0 ? 'AMOUNT DUE:' : 'TOTAL:';
  page().drawText(totalLabel, {
    x: totalsX,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  const totalText = `$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const totalW = helveticaBold.widthOfTextAtSize(totalText, PDF_TYPOGRAPHY.bodySize);
  page().drawText(totalText, {
    x: rightMargin - totalW,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });

  const amtDueText = 'Amount Due (USD)';
  const amtDueW = helvetica.widthOfTextAtSize(amtDueText, PDF_TYPOGRAPHY.bodySize);
  page().drawText(amtDueText, {
    x: rightMargin - amtDueW,
    y: ctx.y - 16,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helvetica,
    color: PDF_COLORS.black
  });

  ctx.y -= 50;

  // === PAYMENT INSTRUCTIONS ===
  ensureSpace(ctx, 80, drawContinuationHeader);

  const paymentHeading = 'PAYMENT INSTRUCTIONS';
  page().drawText(paymentHeading, {
    x: leftMargin,
    y: ctx.y,
    size: PDF_TYPOGRAPHY.bodySize,
    font: helveticaBold,
    color: PDF_COLORS.black
  });
  const paymentHeadingW = helveticaBold.widthOfTextAtSize(paymentHeading, PDF_TYPOGRAPHY.bodySize);
  page().drawLine({
    start: { x: leftMargin, y: ctx.y - 4 },
    end: { x: leftMargin + paymentHeadingW, y: ctx.y - 4 },
    thickness: 0.5,
    color: PDF_COLORS.black
  });
  ctx.y -= 18;

  const paymentInstructions = [
    '• Payment due within 30 days of invoice date',
    `• Zelle: ${BUSINESS_INFO.zelleEmail}`,
    `• Venmo: ${BUSINESS_INFO.venmoHandle}`,
    '• Bank transfer details available upon request'
  ];

  for (const line of paymentInstructions) {
    page().drawText(line, {
      x: leftMargin,
      y: ctx.y,
      size: PDF_TYPOGRAPHY.bodySize,
      font: helvetica,
      color: PDF_COLORS.black
    });
    ctx.y -= 11;
  }

  // === FOOTER ===
  drawPdfFooter(page(), {
    leftMargin,
    rightMargin,
    width,
    fonts: { regular: helvetica, bold: helveticaBold }
  });

  if (ctx.pageNumber > 1) {
    await addPageNumbers(pdfDoc, {
      format: (p, t) => `Page ${p} of ${t}`,
      fontSize: 8,
      marginBottom: 20
    });
  }

  return await pdfDoc.save();
}

// ============================================
// ROUTES
// ============================================

/**
 * Preview invoice PDF without saving
 */
router.post(
  '/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, lineItems, notes, terms } = req.body;

    if (
      !projectId ||
      !clientId ||
      !lineItems ||
      !Array.isArray(lineItems) ||
      lineItems.length === 0
    ) {
      return errorResponse(res, 'Missing required fields', 400, ErrorCodes.MISSING_FIELDS);
    }

    const invoiceService = getInvoiceService();

    const clientContact = await invoiceService.getClientContact(clientId);

    if (!clientContact) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    const projectNameRef = await invoiceService.getProjectName(projectId);

    const subtotal = lineItems.reduce(
      (sum: number, item: InvoiceLineItem) => sum + (item.amount || 0),
      0
    );

    const formatDate = (d: Date): string => {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);

    const previewNumber = 'INV-PREVIEW';

    const pdfData: InvoicePdfData = {
      invoiceNumber: previewNumber,
      issuedDate: formatDate(today),
      dueDate: formatDate(dueDate),
      clientName: clientContact.contactName || 'Client',
      clientCompany: clientContact.companyName || undefined,
      clientEmail: clientContact.email || '',
      clientPhone: clientContact.phone || undefined,
      projectId: projectId,
      lineItems: lineItems.map((item: InvoiceLineItem) => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
        details: projectNameRef ? [`Project: ${projectNameRef.projectName}`] : undefined
      })),
      subtotal,
      total: subtotal,
      notes: notes || undefined,
      terms: terms || undefined
    };

    try {
      const pdfBytes = await generateInvoicePdf(pdfData);
      sendPdfResponse(res, pdfBytes, {
        filename: 'invoice-preview.pdf',
        disposition: 'inline'
      });
    } catch (error) {
      logger.error('[Invoices] Preview PDF generation error:', {
        error: error instanceof Error ? error : undefined
      });
      errorResponse(res, 'Failed to generate preview', 500, ErrorCodes.PDF_GENERATION_FAILED);
    }
  })
);

export { router as pdfRouter };
