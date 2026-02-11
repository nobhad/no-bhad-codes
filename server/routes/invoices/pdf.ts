/**
 * ===============================================
 * INVOICE PDF GENERATION ROUTES
 * ===============================================
 * @file server/routes/invoices/pdf.ts
 *
 * PDF generation for invoices including preview functionality
 */

import express from 'express';
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { InvoiceLineItem } from '../../services/invoice-service.js';
import { getDatabase } from '../../database/init.js';
import { getString } from '../../database/row-helpers.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../../config/business.js';
import { errorResponse } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';
import {
  PdfPageContext,
  ensureSpace,
  addPageNumbers,
  PAGE_MARGINS
} from '../../utils/pdf-utils.js';

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
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });
    context.y -= 20;
  };

  const leftMargin = ctx.leftMargin;
  const rightMargin = ctx.rightMargin;

  // === HEADER ===
  const logoHeight = 100;
  const titleText = 'INVOICE';
  page().drawText(titleText, {
    x: leftMargin,
    y: ctx.y - 20,
    size: 28,
    font: helveticaBold,
    color: rgb(0.15, 0.15, 0.15)
  });

  let textStartX = rightMargin - 180;
  const logoBytes = getPdfLogoBytes();
  if (logoBytes) {
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    const logoX = rightMargin - logoWidth - 150;
    page().drawImage(logoImage, {
      x: logoX,
      y: ctx.y - logoHeight + 10,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = logoX + logoWidth + 18;
  }

  page().drawText(BUSINESS_INFO.name, { x: textStartX, y: ctx.y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page().drawText(BUSINESS_INFO.owner, { x: textStartX, y: ctx.y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  page().drawText(BUSINESS_INFO.tagline, { x: textStartX, y: ctx.y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  page().drawText(BUSINESS_INFO.email, { x: textStartX, y: ctx.y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  page().drawText(BUSINESS_INFO.website, { x: textStartX, y: ctx.y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

  ctx.y -= 120;

  // Divider
  page().drawLine({
    start: { x: leftMargin, y: ctx.y },
    end: { x: rightMargin, y: ctx.y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  ctx.y -= 21;

  // === BILL TO & INVOICE DETAILS ===
  const detailsX = width / 2 + 36;

  page().drawText('BILL TO:', { x: leftMargin, y: ctx.y, size: 11, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page().drawText(data.clientName, { x: leftMargin, y: ctx.y - 14, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });

  let clientLineY = ctx.y - 25;
  if (data.clientCompany) {
    page().drawText(data.clientCompany, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    clientLineY -= 11;
  }
  if (data.clientAddress) {
    page().drawText(data.clientAddress, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    clientLineY -= 11;
  }
  if (data.clientCityStateZip) {
    page().drawText(data.clientCityStateZip, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    clientLineY -= 11;
  }
  page().drawText(data.clientEmail, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  clientLineY -= 11;
  if (data.clientPhone) {
    page().drawText(data.clientPhone, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  }

  const drawRightAligned = (text: string, yPos: number, font: typeof helvetica, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    page().drawText(text, { x: rightMargin - w, y: yPos, size, font, color: rgb(0, 0, 0) });
  };

  page().drawText('INVOICE #:', { x: detailsX, y: ctx.y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  drawRightAligned(data.invoiceNumber, ctx.y, helvetica, 9);
  page().drawText('INVOICE DATE:', { x: detailsX, y: ctx.y - 14, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  drawRightAligned(data.issuedDate, ctx.y - 14, helvetica, 9);
  page().drawText('DUE DATE:', { x: detailsX, y: ctx.y - 28, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  drawRightAligned(data.dueDate || 'Upon Receipt', ctx.y - 28, helvetica, 9);

  if (data.projectId) {
    page().drawText('PROJECT #:', { x: detailsX, y: ctx.y - 42, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    drawRightAligned(`#${data.projectId}`, ctx.y - 42, helvetica, 9);
  }

  ctx.y -= 90;

  // === LINE ITEMS TABLE ===
  page().drawRectangle({
    x: leftMargin,
    y: ctx.y - 2,
    width: rightMargin - leftMargin,
    height: 18,
    color: rgb(0.25, 0.25, 0.25)
  });

  page().drawText('DESCRIPTION', { x: leftMargin + 7, y: ctx.y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  page().drawText('QTY', { x: rightMargin - 144, y: ctx.y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  page().drawText('RATE', { x: rightMargin - 94, y: ctx.y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  const amountLabel = 'AMOUNT';
  const amountLabelW = helveticaBold.widthOfTextAtSize(amountLabel, 10);
  page().drawText(amountLabel, { x: rightMargin - 7 - amountLabelW, y: ctx.y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });

  ctx.y -= 22;

  for (const item of data.lineItems) {
    const estimatedItemHeight = 14 + (item.details?.length || 0) * 11 + 7;
    ensureSpace(ctx, estimatedItemHeight, drawContinuationHeader);

    page().drawText(item.description, { x: leftMargin + 7, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page().drawText(String(item.quantity), { x: rightMargin - 144, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    const rateText = `$${item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    page().drawText(rateText, { x: rightMargin - 94, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    const amountText = `$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const amountW = helveticaBold.widthOfTextAtSize(amountText, 10);
    page().drawText(amountText, { x: rightMargin - amountW, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });

    ctx.y -= 14;

    if (item.details && item.details.length > 0) {
      const detailStartX = leftMargin + 18;
      const detailMaxWidth = (rightMargin - 154) - detailStartX;
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
            page().drawText(line, { x: detailStartX, y: ctx.y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
            ctx.y -= detailLineHeight;
            line = isFirstLine ? `  ${word}` : `  ${word}`;
            isFirstLine = false;
          } else {
            line = testLine;
          }
        }
        if (line && line !== '• ') {
          ensureSpace(ctx, detailLineHeight, drawContinuationHeader);
          page().drawText(line, { x: detailStartX, y: ctx.y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
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
    color: rgb(0.7, 0.7, 0.7)
  });

  page().drawText('Subtotal:', { x: totalsX, y: ctx.y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  const subtotalText = `$${data.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const subtotalW = helvetica.widthOfTextAtSize(subtotalText, 10);
  page().drawText(subtotalText, { x: rightMargin - subtotalW, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });

  if (data.discount && data.discount > 0) {
    ctx.y -= 16;
    page().drawText('Discount:', { x: totalsX, y: ctx.y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    const discountText = `-$${data.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const discountW = helvetica.widthOfTextAtSize(discountText, 10);
    page().drawText(discountText, { x: rightMargin - discountW, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
  }

  if (data.tax && data.tax > 0) {
    ctx.y -= 16;
    page().drawText('Tax:', { x: totalsX, y: ctx.y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    const taxText = `$${data.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const taxW = helvetica.widthOfTextAtSize(taxText, 10);
    page().drawText(taxText, { x: rightMargin - taxW, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
  }

  if (data.credits && data.credits.length > 0) {
    ctx.y -= 24;
    page().drawText('DEPOSIT CREDITS APPLIED:', { x: totalsX - 40, y: ctx.y, size: 9, font: helveticaBold, color: rgb(0.2, 0.5, 0.2) });
    ctx.y -= 14;

    for (const credit of data.credits) {
      const creditLabel = `Deposit ${credit.depositInvoiceNumber}`;
      page().drawText(creditLabel, { x: totalsX, y: ctx.y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      const creditText = `-$${credit.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      const creditW = helvetica.widthOfTextAtSize(creditText, 9);
      page().drawText(creditText, { x: rightMargin - creditW, y: ctx.y, size: 9, font: helvetica, color: rgb(0.2, 0.5, 0.2) });
      ctx.y -= 12;
    }
  }

  ctx.y -= 32;

  page().drawLine({
    start: { x: totalsX - 14, y: ctx.y + 18 },
    end: { x: rightMargin, y: ctx.y + 18 },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2)
  });

  const finalTotal = data.totalCredits ? data.total - data.totalCredits : data.total;
  const totalLabel = data.totalCredits && data.totalCredits > 0 ? 'AMOUNT DUE:' : 'TOTAL:';
  page().drawText(totalLabel, { x: totalsX, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  const totalText = `$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const totalW = helveticaBold.widthOfTextAtSize(totalText, 16);
  page().drawText(totalText, { x: rightMargin - totalW, y: ctx.y, size: 16, font: helveticaBold, color: rgb(0, 0, 0) });

  const amtDueText = 'Amount Due (USD)';
  const amtDueW = helvetica.widthOfTextAtSize(amtDueText, 9);
  page().drawText(amtDueText, { x: rightMargin - amtDueW, y: ctx.y - 16, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

  ctx.y -= 50;

  // === PAYMENT INSTRUCTIONS ===
  ensureSpace(ctx, 80, drawContinuationHeader);

  page().drawText('PAYMENT INSTRUCTIONS', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page().drawLine({
    start: { x: leftMargin, y: ctx.y - 4 },
    end: { x: leftMargin + 144, y: ctx.y - 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  });
  ctx.y -= 18;

  const paymentInstructions = [
    '• Payment due within 30 days of invoice date',
    `• Zelle: ${BUSINESS_INFO.zelleEmail}`,
    `• Venmo: ${BUSINESS_INFO.venmoHandle}`,
    '• Bank transfer details available upon request'
  ];

  for (const line of paymentInstructions) {
    page().drawText(line, { x: leftMargin, y: ctx.y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    ctx.y -= 11;
  }

  // === FOOTER ===
  page().drawLine({
    start: { x: leftMargin, y: 72 },
    end: { x: rightMargin, y: 72 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  const thankYouText = 'Thank you for your business!';
  const thankYouW = helvetica.widthOfTextAtSize(thankYouText, 10);
  page().drawText(thankYouText, {
    x: (width - thankYouW) / 2,
    y: 54,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  const footerText = `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`;
  const footerW = helvetica.widthOfTextAtSize(footerText, 7);
  page().drawText(footerText, {
    x: (width - footerW) / 2,
    y: 36,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5)
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

    if (!projectId || !clientId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return errorResponse(res, 'Missing required fields', 400, 'MISSING_FIELDS');
    }

    const db = getDatabase();

    const client = await db.get(
      'SELECT contact_name, company_name, email, phone FROM clients WHERE id = ?',
      [clientId]
    );

    if (!client) {
      return errorResponse(res, 'Client not found', 404, 'CLIENT_NOT_FOUND');
    }

    const project = await db.get('SELECT project_name FROM projects WHERE id = ?', [projectId]);

    const subtotal = lineItems.reduce((sum: number, item: InvoiceLineItem) => sum + (item.amount || 0), 0);

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
      clientName: getString(client, 'contact_name') || 'Client',
      clientCompany: getString(client, 'company_name') || undefined,
      clientEmail: getString(client, 'email') || '',
      clientPhone: getString(client, 'phone') || undefined,
      projectId: projectId,
      lineItems: lineItems.map((item: InvoiceLineItem) => ({
        description: item.description || '',
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        amount: item.amount || 0,
        details: (project ? [`Project: ${getString(project, 'project_name')}`] : undefined)
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
      console.error('[Invoices] Preview PDF generation error:', error);
      errorResponse(res, 'Failed to generate preview', 500, 'PDF_GENERATION_FAILED');
    }
  })
);

export { router as pdfRouter };
