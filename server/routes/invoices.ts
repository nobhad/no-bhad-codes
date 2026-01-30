/**
 * ===============================================
 * INVOICE ROUTES
 * ===============================================
 * @file server/routes/invoices.ts
 *
 * Invoice management endpoints for creating, viewing, and updating invoices
 */

import express from 'express';
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { InvoiceService, InvoiceCreateData, InvoiceLineItem, Invoice } from '../services/invoice-service.js';
import { emailService } from '../services/email-service.js';
import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';

// Business info from environment variables
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || 'No Bhad Codes',
  owner: process.env.BUSINESS_OWNER || 'Noelle Bhaduri',
  contact: process.env.BUSINESS_CONTACT || 'Noelle Bhaduri',
  tagline: process.env.BUSINESS_TAGLINE || 'Web Development & Design',
  email: process.env.BUSINESS_EMAIL || 'nobhaduri@gmail.com',
  website: process.env.BUSINESS_WEBSITE || 'nobhad.codes',
  venmoHandle: process.env.VENMO_HANDLE || '@nobhaduri',
  zelleEmail: process.env.ZELLE_EMAIL || 'nobhaduri@gmail.com'
};

const router = express.Router();

// Lazy-load invoice service after database is initialized
function getInvoiceService() {
  return InvoiceService.getInstance();
}

/**
 * Transform Invoice object to snake_case for frontend compatibility
 */
function toSnakeCaseInvoice(invoice: Invoice): Record<string, unknown> {
  return {
    id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    project_id: invoice.projectId,
    client_id: invoice.clientId,
    amount_total: invoice.amountTotal,
    amount_paid: invoice.amountPaid || 0,
    currency: invoice.currency,
    status: invoice.status,
    due_date: invoice.dueDate,
    issued_date: invoice.issuedDate,
    paid_date: invoice.paidDate,
    payment_method: invoice.paymentMethod,
    payment_reference: invoice.paymentReference,
    line_items: invoice.lineItems,
    notes: invoice.notes,
    terms: invoice.terms,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
    // Additional fields for display
    business_name: invoice.businessName,
    business_email: invoice.businessEmail,
    venmo_handle: invoice.venmoHandle,
    paypal_email: invoice.paypalEmail, // Legacy field, using Zelle now
    services_title: invoice.servicesTitle,
    services_description: invoice.servicesDescription,
    deliverables: invoice.deliverables,
    bill_to_name: invoice.billToName,
    bill_to_email: invoice.billToEmail
  };
}

/**
 * @swagger
 * /api/invoices/test:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Test invoice endpoint
 *     responses:
 *       200:
 *         description: Invoice system is working
 */
router.get('/test', (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'Invoice system is operational',
    timestamp: new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/invoices/test-create:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Test invoice creation (development only)
 *     description: Creates a test invoice without authentication for development testing
 *     responses:
 *       201:
 *         description: Test invoice created successfully
 */
router.post(
  '/test-create',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const testInvoiceData: InvoiceCreateData = {
      projectId: 1,
      clientId: 1,
      lineItems: [
        {
          description: 'Website Design & Development',
          quantity: 1,
          rate: 3500,
          amount: 3500
        },
        {
          description: 'Content Management System Setup',
          quantity: 1,
          rate: 1000,
          amount: 1000
        }
      ],
      notes: 'Test invoice created for development testing',
      terms: 'Payment due within 30 days'
    };

    try {
      const invoice = await getInvoiceService().createInvoice(testInvoiceData);

      res.status(201).json({
        success: true,
        message: 'Test invoice created successfully',
        invoice
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to create test invoice',
        code: 'TEST_CREATION_FAILED',
        message
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/test-get/{id}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Test get invoice by ID (development only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/test-get/:id',
  asyncHandler(async (req: express.Request, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      res.json({ success: true, invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve invoice',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a new invoice
 *     description: Create a new invoice for a project
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - clientId
 *               - lineItems
 *             properties:
 *               projectId:
 *                 type: integer
 *                 example: 1
 *               clientId:
 *                 type: integer
 *                 example: 1
 *               lineItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     rate:
 *                       type: number
 *                     amount:
 *                       type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *               terms:
 *                 type: string
 *               currency:
 *                 type: string
 *                 default: USD
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 */
router.post(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceData: InvoiceCreateData = req.body;

    // Validate required fields
    if (!invoiceData.projectId || !invoiceData.clientId || !invoiceData.lineItems?.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'lineItems']
      });
    }

    // Validate line items
    const invalidLineItems = invoiceData.lineItems.filter(
      (item) =>
        !item.description ||
        typeof item.quantity !== 'number' ||
        typeof item.rate !== 'number' ||
        typeof item.amount !== 'number'
    );

    if (invalidLineItems.length > 0) {
      return res.status(400).json({
        error: 'Invalid line items',
        code: 'INVALID_LINE_ITEMS',
        message: 'Each line item must have description, quantity, rate, and amount'
      });
    }

    try {
      const invoice = await getInvoiceService().createInvoice(invoiceData);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to create invoice',
        code: 'CREATION_FAILED',
        message
      });
    }
  })
);

// ============================================
// INVOICE PDF GENERATION HELPER
// ============================================

interface InvoicePdfData {
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
}

/**
 * Generate invoice PDF using pdf-lib (matches template format)
 */
async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFLibDocument.create();

  // Set PDF metadata
  pdfDoc.setTitle(`Invoice ${data.invoiceNumber}`);
  pdfDoc.setAuthor(BUSINESS_INFO.name);
  pdfDoc.setSubject('Invoice');
  pdfDoc.setCreator('NoBhadCodes');

  const page = pdfDoc.addPage([612, 792]); // LETTER size
  const { width, height } = page.getSize();

  // Embed fonts
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Layout constants (0.75 inch margins)
  const leftMargin = 54;
  const rightMargin = width - 54;

  // Start from top - template uses 0.6 inch from top = 43.2pt
  let y = height - 43;

  // === HEADER - Logo on left, business info next to it, INVOICE title on right ===
  const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');
  let textStartX = leftMargin;
  const logoHeight = 75; // ~1 inch, 50% larger than template baseline

  if (existsSync(logoPath)) {
    const logoBytes = readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    // Preserve aspect ratio
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    page.drawImage(logoImage, {
      x: leftMargin,
      y: y - logoHeight,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = leftMargin + logoWidth + 18; // 0.25 inch gap
  }

  // Business name: 16pt Helvetica-Bold
  page.drawText(BUSINESS_INFO.name, {
    x: textStartX,
    y: y,
    size: 16,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  // Owner name: 10pt - scaled spacing for 75pt logo
  page.drawText(BUSINESS_INFO.owner, {
    x: textStartX,
    y: y - 20,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.2, 0.2)
  });

  // Tagline: 9pt
  page.drawText(BUSINESS_INFO.tagline, {
    x: textStartX,
    y: y - 36,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4)
  });

  // Email: 9pt
  page.drawText(BUSINESS_INFO.email, {
    x: textStartX,
    y: y - 50,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4)
  });

  // Website: 9pt
  page.drawText(BUSINESS_INFO.website, {
    x: textStartX,
    y: y - 64,
    size: 9,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4)
  });

  // INVOICE title on right: 28pt, vertically centered with logo
  const titleText = 'INVOICE';
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 28);
  page.drawText(titleText, {
    x: rightMargin - titleWidth,
    y: y - 25,
    size: 28,
    font: helveticaBold,
    color: rgb(0.15, 0.15, 0.15)
  });

  y -= 95; // Account for 75pt logo height

  // === DIVIDER LINE ===
  page.drawLine({
    start: { x: leftMargin, y: y },
    end: { x: rightMargin, y: y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 21;

  // === BILL TO (left) and INVOICE DETAILS (right) ===
  const detailsX = width / 2 + 36;

  // Left side - BILL TO:
  page.drawText('BILL TO:', {
    x: leftMargin,
    y: y,
    size: 11,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2)
  });

  // Client name (bold)
  page.drawText(data.clientName, {
    x: leftMargin,
    y: y - 14,
    size: 10,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });

  let clientLineY = y - 25;
  if (data.clientCompany) {
    page.drawText(data.clientCompany, {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    clientLineY -= 11;
  }

  if (data.clientAddress) {
    page.drawText(data.clientAddress, {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    clientLineY -= 11;
  }

  if (data.clientCityStateZip) {
    page.drawText(data.clientCityStateZip, {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    clientLineY -= 11;
  }

  page.drawText(data.clientEmail, {
    x: leftMargin,
    y: clientLineY,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3)
  });
  clientLineY -= 11;

  if (data.clientPhone) {
    page.drawText(data.clientPhone, {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3)
    });
  }

  // Right side - Invoice details
  const drawRightAligned = (text: string, yPos: number, font: typeof helvetica, size: number) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: rightMargin - w, y: yPos, size, font, color: rgb(0, 0, 0) });
  };

  page.drawText('INVOICE #:', { x: detailsX, y: y, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  drawRightAligned(data.invoiceNumber, y, helvetica, 9);

  page.drawText('INVOICE DATE:', { x: detailsX, y: y - 14, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  drawRightAligned(data.issuedDate, y - 14, helvetica, 9);

  page.drawText('DUE DATE:', { x: detailsX, y: y - 28, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
  drawRightAligned(data.dueDate || 'Upon Receipt', y - 28, helvetica, 9);

  if (data.projectId) {
    page.drawText('PROJECT #:', { x: detailsX, y: y - 42, size: 9, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    drawRightAligned(`#${data.projectId}`, y - 42, helvetica, 9);
  }

  y -= 90;

  // === LINE ITEMS TABLE ===
  // Header background
  page.drawRectangle({
    x: leftMargin,
    y: y - 2,
    width: rightMargin - leftMargin,
    height: 18,
    color: rgb(0.25, 0.25, 0.25)
  });

  // Header text (white)
  page.drawText('DESCRIPTION', { x: leftMargin + 7, y: y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  page.drawText('QTY', { x: rightMargin - 144, y: y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  page.drawText('RATE', { x: rightMargin - 94, y: y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });
  const amountLabel = 'AMOUNT';
  const amountLabelW = helveticaBold.widthOfTextAtSize(amountLabel, 10);
  page.drawText(amountLabel, { x: rightMargin - 7 - amountLabelW, y: y + 4, size: 10, font: helveticaBold, color: rgb(1, 1, 1) });

  y -= 22;

  // Line items
  for (const item of data.lineItems) {
    // Description (bold)
    page.drawText(item.description, { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });

    // Quantity
    page.drawText(String(item.quantity), { x: rightMargin - 144, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // Rate
    const rateText = `$${item.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    page.drawText(rateText, { x: rightMargin - 94, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    // Amount (right-aligned, bold)
    const amountText = `$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const amountW = helveticaBold.widthOfTextAtSize(amountText, 10);
    page.drawText(amountText, { x: rightMargin - amountW, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });

    y -= 14;

    // Details (bullet points)
    if (item.details && item.details.length > 0) {
      for (const detail of item.details) {
        page.drawText(`• ${detail}`, { x: leftMargin + 11, y: y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
        y -= 11;
      }
      y -= 7;
    }
  }

  y -= 14;

  // === TOTALS SECTION ===
  const totalsX = rightMargin - 144;

  // Line above totals
  page.drawLine({
    start: { x: totalsX - 14, y: y + 18 },
    end: { x: rightMargin, y: y + 18 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  });

  // Subtotal
  page.drawText('Subtotal:', { x: totalsX, y: y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  const subtotalText = `$${data.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const subtotalW = helvetica.widthOfTextAtSize(subtotalText, 10);
  page.drawText(subtotalText, { x: rightMargin - subtotalW, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
  y -= 14;

  // Discount (if any)
  if (data.discount && data.discount > 0) {
    page.drawText('Discount:', { x: totalsX, y: y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    const discountText = `-$${data.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const discountW = helvetica.widthOfTextAtSize(discountText, 10);
    page.drawText(discountText, { x: rightMargin - discountW, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 14;
  }

  // Tax (if any)
  if (data.tax && data.tax > 0) {
    page.drawText('Tax:', { x: totalsX, y: y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    const taxText = `$${data.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const taxW = helvetica.widthOfTextAtSize(taxText, 10);
    page.drawText(taxText, { x: rightMargin - taxW, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 14;
  }

  // Total line
  page.drawLine({
    start: { x: totalsX - 14, y: y + 4 },
    end: { x: rightMargin, y: y + 4 },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2)
  });
  y -= 4;

  // TOTAL
  page.drawText('TOTAL:', { x: totalsX, y: y - 14, size: 14, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  const totalText = `$${data.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const totalW = helveticaBold.widthOfTextAtSize(totalText, 16);
  page.drawText(totalText, { x: rightMargin - totalW, y: y - 14, size: 16, font: helveticaBold, color: rgb(0, 0, 0) });

  // Amount Due label
  const amtDueText = 'Amount Due (USD)';
  const amtDueW = helvetica.widthOfTextAtSize(amtDueText, 9);
  page.drawText(amtDueText, { x: rightMargin - amtDueW, y: y - 28, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

  y -= 50;

  // === PAYMENT INSTRUCTIONS ===
  page.drawText('PAYMENT INSTRUCTIONS', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawLine({
    start: { x: leftMargin, y: y - 4 },
    end: { x: leftMargin + 144, y: y - 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7)
  });
  y -= 18;

  const paymentInstructions = [
    '• Payment due within 30 days of invoice date',
    `• Zelle: ${BUSINESS_INFO.zelleEmail}`,
    `• Venmo: ${BUSINESS_INFO.venmoHandle}`,
    '• Bank transfer details available upon request'
  ];

  for (const line of paymentInstructions) {
    page.drawText(line, { x: leftMargin, y: y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    y -= 11;
  }

  // === FOOTER ===
  // Footer separator line
  page.drawLine({
    start: { x: leftMargin, y: 72 },
    end: { x: rightMargin, y: 72 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8)
  });

  // Thank you message
  const thankYouText = 'Thank you for your business!';
  const thankYouW = helvetica.widthOfTextAtSize(thankYouText, 10);
  page.drawText(thankYouText, {
    x: (width - thankYouW) / 2,
    y: 54,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Footer contact info
  const footerText = `${BUSINESS_INFO.name} • ${BUSINESS_INFO.owner} • ${BUSINESS_INFO.email} • ${BUSINESS_INFO.website}`;
  const footerW = helvetica.widthOfTextAtSize(footerText, 7);
  page.drawText(footerText, {
    x: (width - footerW) / 2,
    y: 36,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5)
  });

  return await pdfDoc.save();
}

/**
 * @swagger
 * /api/invoices/preview:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Preview invoice PDF without saving
 */
router.post(
  '/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, lineItems, notes, terms } = req.body;

    if (!projectId || !clientId || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS'
      });
    }

    const db = getDatabase();

    // Get client info
    const client = await db.get(
      'SELECT contact_name, company_name, email, phone FROM clients WHERE id = ?',
      [clientId]
    );

    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'CLIENT_NOT_FOUND' });
    }

    // Get project info
    const project = await db.get('SELECT project_name FROM projects WHERE id = ?', [projectId]);

    // Calculate totals
    const subtotal = lineItems.reduce((sum: number, item: InvoiceLineItem) => sum + (item.amount || 0), 0);

    // Format date
    const formatDate = (d: Date): string => {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);

    // Generate preview invoice number
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

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="invoice-preview.pdf"');
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error('[Invoices] Preview PDF generation error:', error);
      res.status(500).json({ error: 'Failed to generate preview', code: 'PDF_GENERATION_FAILED' });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      res.json({ success: true, invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve invoice',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/number/{invoiceNumber}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by invoice number
 */
router.get(
  '/number/:invoiceNumber',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { invoiceNumber } = req.params;

    try {
      const invoice = await getInvoiceService().getInvoiceByNumber(invoiceNumber);
      res.json({ success: true, invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve invoice',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/me:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all invoices for the authenticated client
 *     description: Returns invoices for the currently logged-in client with summary stats
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Client invoices retrieved successfully
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      const invoices = await getInvoiceService().getClientInvoices(clientId);

      // Calculate summary stats
      let totalOutstanding = 0;
      let totalPaid = 0;

      invoices.forEach((invoice) => {
        if (invoice.status === 'paid') {
          totalPaid += invoice.amountTotal || 0;
        } else if (['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status)) {
          totalOutstanding += invoice.amountTotal || 0;
          // Subtract any partial payments
          if (invoice.amountPaid) {
            totalOutstanding -= invoice.amountPaid || 0;
            totalPaid += invoice.amountPaid || 0;
          }
        }
      });

      // Transform invoices to snake_case for frontend compatibility
      const transformedInvoices = invoices.map(toSnakeCaseInvoice);

      res.json({
        success: true,
        invoices: transformedInvoices,
        count: invoices.length,
        summary: {
          totalOutstanding,
          totalPaid
        }
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/client/{clientId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all invoices for a client
 */
router.get(
  '/client/:clientId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return res.status(400).json({
        error: 'Invalid client ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoices = await getInvoiceService().getClientInvoices(clientId);
      const transformedInvoices = invoices.map(toSnakeCaseInvoice);
      res.json({
        success: true,
        invoices: transformedInvoices,
        count: invoices.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve client invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/project/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all invoices for a project
 */
router.get(
  '/project/:projectId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        error: 'Invalid project ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoices = await getInvoiceService().getProjectInvoices(projectId);
      const transformedInvoices = invoices.map(toSnakeCaseInvoice);
      res.json({
        success: true,
        invoices: transformedInvoices,
        count: invoices.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve project invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/status:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update invoice status
 */
router.put(
  '/:id/status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { status, paymentData } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    const validStatuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        code: 'INVALID_STATUS',
        validStatuses
      });
    }

    try {
      const invoice = await getInvoiceService().updateInvoiceStatus(invoiceId, status, paymentData);
      res.json({
        success: true,
        message: 'Invoice status updated successfully',
        invoice
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to update invoice status',
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/send:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Send invoice to client
 */
router.post(
  '/:id/send',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().sendInvoice(invoiceId);

      // Send email notification to client
      try {
        // Get client email from database
        const db = getDatabase();
        const clientRow = await db.get(
          'SELECT u.email, u.name FROM invoices i JOIN users u ON i.client_id = u.id WHERE i.id = ?',
          [invoiceId]
        );

        if (!clientRow) {
          throw new Error('Client not found');
        }

        const clientEmail = getString(clientRow, 'email');
        const clientName = getString(clientRow, 'name');
        const client = { email: clientEmail, name: clientName };

        const invoiceUrl = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:3000/client/portal'}?invoice=${invoiceId}`;

        // Send invoice email
        await emailService.sendEmail({
          to: clientEmail,
          subject: `Invoice #${invoice.invoiceNumber} from No Bhad Codes`,
          text: `
            Hi ${client.name},

            Your invoice #${invoice.invoiceNumber} is now available.

            Amount Due: $${invoice.amountTotal}
            Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon receipt'}

            View and pay your invoice here:
            ${invoiceUrl}

            If you have any questions, please don't hesitate to contact us.

            Best regards,
            No Bhad Codes Team
          `,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .invoice-header { background: #00ff41; color: #000; padding: 20px; text-align: center; }
                .invoice-details { background: #f5f5f5; padding: 20px; margin: 20px 0; }
                .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="invoice-header">
                  <h2>Invoice #${invoice.invoiceNumber}</h2>
                </div>
                <p>Hi ${client.name},</p>
                <p>Your invoice is now available for review and payment.</p>
                <div class="invoice-details">
                  <p><strong>Amount Due:</strong> $${invoice.amountTotal}</p>
                  <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon receipt'}</p>
                  <p><strong>Status:</strong> ${invoice.status}</p>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${invoiceUrl}" class="button">View Invoice</a>
                </p>
                <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
                <p>Best regards,<br>No Bhad Codes Team</p>
              </div>
            </body>
            </html>
          `
        });

        console.log(`Invoice email sent to ${client.email} for invoice #${invoiceId}`);
      } catch (emailError) {
        console.error('Failed to send invoice email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: 'Invoice sent successfully',
        invoice
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to send invoice',
        code: 'SEND_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/pay:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Mark invoice as paid
 */
router.post(
  '/:id/pay',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { amountPaid, paymentMethod, paymentReference } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    if (!amountPaid || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing payment data',
        code: 'MISSING_PAYMENT_DATA',
        required: ['amountPaid', 'paymentMethod']
      });
    }

    try {
      const invoice = await getInvoiceService().markInvoiceAsPaid(invoiceId, {
        amountPaid: parseFloat(amountPaid),
        paymentMethod,
        paymentReference
      });

      res.json({
        success: true,
        message: 'Invoice marked as paid',
        invoice
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to process payment',
        code: 'PAYMENT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/stats:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice statistics
 */
router.get(
  '/stats',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    try {
      const stats = await getInvoiceService().getInvoiceStats(clientId);
      res.json({
        success: true,
        stats
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve invoice statistics',
        code: 'STATS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/generate/intake/{intakeId}:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Generate invoice from client intake
 */
router.post(
  '/generate/intake/:intakeId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const intakeId = parseInt(req.params.intakeId);

    if (isNaN(intakeId)) {
      return res.status(400).json({
        error: 'Invalid intake ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().generateInvoiceFromIntake(intakeId);

      res.status(201).json({
        success: true,
        message: 'Invoice generated from intake successfully',
        invoice
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('not found')) {
        return res.status(404).json({
          error: 'Intake not found',
          code: 'NOT_FOUND'
        });
      }

      if (errorMessage.includes('must be converted')) {
        return res.status(400).json({
          error: 'Intake not ready for invoice generation',
          code: 'INTAKE_NOT_CONVERTED',
          message: errorMessage
        });
      }

      res.status(500).json({
        error: 'Failed to generate invoice from intake',
        code: 'GENERATION_FAILED',
        message: errorMessage
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/pdf:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Download invoice as PDF
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get(
  '/:id/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      const db = getDatabase();

      // Get client info
      const client = await db.get(
        'SELECT contact_name, company_name, email, client_type FROM clients WHERE id = ?',
        [invoice.clientId]
      );

      // Helper function to format date as "Month Day, Year"
      const formatDate = (dateStr: string | undefined): string => {
        if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      // Build line items from invoice data
      const lineItems: InvoicePdfData['lineItems'] = Array.isArray(invoice.lineItems)
        ? invoice.lineItems.map((item: InvoiceLineItem) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            rate: item.rate || item.amount || 0,
            amount: item.amount || 0
          }))
        : [];

      // Build PDF data object
      const pdfData: InvoicePdfData = {
        invoiceNumber: invoice.invoiceNumber,
        issuedDate: formatDate(invoice.issuedDate || invoice.createdAt),
        dueDate: 'Within 14 days',
        clientName: invoice.billToName || (client ? getString(client, 'contact_name') : '') || 'Client',
        clientCompany: client ? getString(client, 'company_name') : '',
        clientEmail: invoice.billToEmail || (client ? getString(client, 'email') : '') || '',
        projectId: invoice.projectId,
        lineItems,
        subtotal: invoice.amountTotal || 0,
        total: invoice.amountTotal || 0,
        notes: invoice.notes,
        terms: invoice.terms
      };

      // Generate PDF using pdf-lib (template-matching version)
      const pdfBytes = await generateInvoicePdf(pdfData);

      // Check if preview mode (inline) or download mode (attachment)
      const isPreview = req.query.preview === 'true';
      const disposition = isPreview ? 'inline' : 'attachment';

      // Set response headers and send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${invoice.invoiceNumber}.pdf"`
      );
      res.setHeader('Content-Length', pdfBytes.length);
      res.send(Buffer.from(pdfBytes));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to generate PDF',
        code: 'PDF_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as invoicesRouter };
export default router;
