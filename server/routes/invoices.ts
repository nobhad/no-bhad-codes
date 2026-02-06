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

/**
 * GET /api/invoices
 * Admin invoice listing. Returns an array of invoices (snake_case fields).
 * Supports optional filters via query params (status, clientId, projectId, search, dateFrom, dateTo, minAmount, maxAmount, invoiceType, limit, offset)
 */
// Admin invoice listing added later after router initialization
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import {
  InvoiceService,
  InvoiceCreateData,
  InvoiceLineItem,
  Invoice,
  InvoiceCredit,
  DepositSummary,
  PaymentPlanTemplate,
  ScheduledInvoice,
  RecurringInvoice,
  InvoiceReminder,
  PaymentTermsPreset,
  InvoicePayment,
  InvoiceAgingReport
} from '../services/invoice-service.js';
import { emailService } from '../services/email-service.js';
import { getDatabase } from '../database/init.js';
import { getString } from '../database/row-helpers.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';
import { getPdfCacheKey, getCachedPdf, cachePdf, setPdfMetadata } from '../utils/pdf-utils.js';
import { notDeleted } from '../database/query-helpers.js';
import { softDeleteService } from '../services/soft-delete-service.js';

const router = express.Router();

// GET /api/invoices
// Admin invoice listing. Returns an array of invoices (snake_case fields).
// Supports optional filters via query params (status, clientId, projectId, search, dateFrom, dateTo, minAmount, maxAmount, invoiceType, limit, offset)
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    try {
      // If filters provided, delegate to searchInvoices for advanced filtering
      const hasFilters = !!(
        req.query.status ||
        req.query.clientId ||
        req.query.projectId ||
        req.query.search ||
        req.query.dateFrom ||
        req.query.dateTo ||
        req.query.minAmount ||
        req.query.maxAmount ||
        req.query.invoiceType
      );

      if (hasFilters) {
        const filters: any = {
          clientId: req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined,
          projectId: req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined,
          status: req.query.status as string | undefined,
          invoiceType: req.query.invoiceType as 'standard' | 'deposit' | undefined,
          search: req.query.search as string | undefined,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
          minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
          maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
          limit,
          offset
        };

        const result = await getInvoiceService().searchInvoices(filters);
        // Return plain array (frontend expects direct array)
        return res.json(result.invoices.map(toSnakeCaseInvoice));
      }

      const invoices = await getInvoiceService().getAllInvoices(limit, offset);
      res.json(invoices.map(toSnakeCaseInvoice));
    } catch (error: unknown) {
      res.status(500).json({ error: 'Failed to retrieve invoices', code: 'RETRIEVAL_FAILED', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  })
);

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
    bill_to_email: invoice.billToEmail,
    // Deposit invoice fields
    invoice_type: invoice.invoiceType,
    deposit_for_project_id: invoice.depositForProjectId,
    deposit_percentage: invoice.depositPercentage,
    // Advanced features - Tax
    subtotal: invoice.subtotal,
    tax_rate: invoice.taxRate,
    tax_amount: invoice.taxAmount,
    // Advanced features - Discount
    discount_type: invoice.discountType,
    discount_value: invoice.discountValue,
    discount_amount: invoice.discountAmount,
    // Advanced features - Late fees
    late_fee_rate: invoice.lateFeeRate,
    late_fee_type: invoice.lateFeeType,
    late_fee_amount: invoice.lateFeeAmount,
    late_fee_applied_at: invoice.lateFeeAppliedAt,
    // Advanced features - Payment terms
    payment_terms_id: invoice.paymentTermsId,
    payment_terms_name: invoice.paymentTermsName,
    // Advanced features - Internal notes
    internal_notes: invoice.internalNotes,
    // Advanced features - Invoice number customization
    invoice_prefix: invoice.invoicePrefix,
    invoice_sequence: invoice.invoiceSequence
  };
}

/**
 * Transform InvoiceCredit to snake_case for frontend
 */
function toSnakeCaseCredit(credit: InvoiceCredit): Record<string, unknown> {
  return {
    id: credit.id,
    invoice_id: credit.invoiceId,
    deposit_invoice_id: credit.depositInvoiceId,
    deposit_invoice_number: credit.depositInvoiceNumber,
    amount: credit.amount,
    applied_at: credit.appliedAt,
    applied_by: credit.appliedBy
  };
}

/**
 * Transform DepositSummary to snake_case for frontend
 */
function toSnakeCaseDeposit(deposit: DepositSummary): Record<string, unknown> {
  return {
    invoice_id: deposit.invoiceId,
    invoice_number: deposit.invoiceNumber,
    total_amount: deposit.totalAmount,
    amount_applied: deposit.amountApplied,
    available_amount: deposit.availableAmount,
    paid_date: deposit.paidDate
  };
}

/**
 * Transform PaymentPlanTemplate to snake_case for frontend
 */
function toSnakeCasePaymentPlan(plan: PaymentPlanTemplate): Record<string, unknown> {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    payments: plan.payments,
    is_default: plan.isDefault,
    created_at: plan.createdAt
  };
}

/**
 * Transform ScheduledInvoice to snake_case for frontend
 */
function toSnakeCaseScheduledInvoice(scheduled: ScheduledInvoice): Record<string, unknown> {
  return {
    id: scheduled.id,
    project_id: scheduled.projectId,
    client_id: scheduled.clientId,
    scheduled_date: scheduled.scheduledDate,
    trigger_type: scheduled.triggerType,
    trigger_milestone_id: scheduled.triggerMilestoneId,
    line_items: scheduled.lineItems,
    notes: scheduled.notes,
    terms: scheduled.terms,
    status: scheduled.status,
    generated_invoice_id: scheduled.generatedInvoiceId,
    created_at: scheduled.createdAt
  };
}

/**
 * Transform RecurringInvoice to snake_case for frontend
 */
function toSnakeCaseRecurringInvoice(recurring: RecurringInvoice): Record<string, unknown> {
  return {
    id: recurring.id,
    project_id: recurring.projectId,
    client_id: recurring.clientId,
    frequency: recurring.frequency,
    day_of_month: recurring.dayOfMonth,
    day_of_week: recurring.dayOfWeek,
    line_items: recurring.lineItems,
    notes: recurring.notes,
    terms: recurring.terms,
    start_date: recurring.startDate,
    end_date: recurring.endDate,
    next_generation_date: recurring.nextGenerationDate,
    last_generated_at: recurring.lastGeneratedAt,
    is_active: recurring.isActive,
    created_at: recurring.createdAt
  };
}

/**
 * Transform InvoiceReminder to snake_case for frontend
 */
function toSnakeCaseReminder(reminder: InvoiceReminder): Record<string, unknown> {
  return {
    id: reminder.id,
    invoice_id: reminder.invoiceId,
    reminder_type: reminder.reminderType,
    scheduled_date: reminder.scheduledDate,
    sent_at: reminder.sentAt,
    status: reminder.status,
    created_at: reminder.createdAt
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
  // Deposit invoice fields
  isDeposit?: boolean;
  depositPercentage?: number;
  // Credits applied to this invoice
  credits?: Array<{
    depositInvoiceNumber: string;
    amount: number;
  }>;
  totalCredits?: number;
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

  // === HEADER - Title on left, logo and business info on right ===
  const logoHeight = 100; // ~1.4 inch for prominent branding

  // INVOICE title on left: 28pt (same for all invoice types)
  const titleText = 'INVOICE';
  page.drawText(titleText, {
    x: leftMargin,
    y: y - 20,
    size: 28,
    font: helveticaBold,
    color: rgb(0.15, 0.15, 0.15)
  });

  // Logo and business info on right (logo left of text, text left-aligned)
  let textStartX = rightMargin - 180; // Default position for text
  const logoBytes = getPdfLogoBytes();
  if (logoBytes) {
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
    const logoX = rightMargin - logoWidth - 150; // Logo position
    page.drawImage(logoImage, {
      x: logoX,
      y: y - logoHeight + 10,
      width: logoWidth,
      height: logoHeight
    });
    textStartX = logoX + logoWidth + 18; // Text starts after logo + gap
  }

  // Business info (left-aligned, to right of logo)
  page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

  y -= 120; // Account for 100pt logo height

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
    // Description (bold) - 7pt padding to align with header
    page.drawText(item.description, { x: leftMargin + 7, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });

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

    // Details (bullet points) - indented from description, with word wrapping
    if (item.details && item.details.length > 0) {
      const detailStartX = leftMargin + 18;
      const detailMaxWidth = (rightMargin - 154) - detailStartX; // Stay within description column
      const detailLineHeight = 11;

      for (const detail of item.details) {
        // Word wrap each detail line
        const words = detail.split(' ');
        let line = '• ';
        let isFirstLine = true;

        for (const word of words) {
          const testLine = line + (line === '• ' ? '' : ' ') + word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, 9);

          if (testWidth > detailMaxWidth && line !== '• ') {
            page.drawText(line, { x: detailStartX, y: y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
            y -= detailLineHeight;
            // Continuation lines indent slightly more (no bullet)
            line = isFirstLine ? '  ' + word : '  ' + word;
            isFirstLine = false;
          } else {
            line = testLine;
          }
        }
        // Draw remaining text
        if (line && line !== '• ') {
          page.drawText(line, { x: detailStartX, y: y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
          y -= detailLineHeight;
        }
      }
      y -= 7;
    }
  }

  // === TOTALS SECTION ===
  const totalsX = rightMargin - 144;

  y -= 24; // Space above subtotal section

  // Line above subtotal (well above text)
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

  // Discount (if any)
  if (data.discount && data.discount > 0) {
    y -= 16;
    page.drawText('Discount:', { x: totalsX, y: y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    const discountText = `-$${data.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const discountW = helvetica.widthOfTextAtSize(discountText, 10);
    page.drawText(discountText, { x: rightMargin - discountW, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
  }

  // Tax (if any)
  if (data.tax && data.tax > 0) {
    y -= 16;
    page.drawText('Tax:', { x: totalsX, y: y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    const taxText = `$${data.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const taxW = helvetica.widthOfTextAtSize(taxText, 10);
    page.drawText(taxText, { x: rightMargin - taxW, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
  }

  // Credits applied (if any)
  if (data.credits && data.credits.length > 0) {
    y -= 24;

    // Credits section header
    page.drawText('DEPOSIT CREDITS APPLIED:', { x: totalsX - 40, y: y, size: 9, font: helveticaBold, color: rgb(0.2, 0.5, 0.2) });
    y -= 14;

    // List each credit
    for (const credit of data.credits) {
      const creditLabel = `Deposit ${credit.depositInvoiceNumber}`;
      page.drawText(creditLabel, { x: totalsX, y: y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
      const creditText = `-$${credit.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
      const creditW = helvetica.widthOfTextAtSize(creditText, 9);
      page.drawText(creditText, { x: rightMargin - creditW, y: y, size: 9, font: helvetica, color: rgb(0.2, 0.5, 0.2) });
      y -= 12;
    }
  }

  y -= 32; // Space above total section

  // Line above total (matching subtotal spacing: 18pt below line to text)
  page.drawLine({
    start: { x: totalsX - 14, y: y + 18 },
    end: { x: rightMargin, y: y + 18 },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2)
  });

  // Calculate final total (after credits)
  const finalTotal = data.totalCredits ? data.total - data.totalCredits : data.total;

  // TOTAL (or AMOUNT DUE if credits were applied)
  const totalLabel = data.totalCredits && data.totalCredits > 0 ? 'AMOUNT DUE:' : 'TOTAL:';
  page.drawText(totalLabel, { x: totalsX, y: y, size: 14, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  const totalText = `$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const totalW = helveticaBold.widthOfTextAtSize(totalText, 16);
  page.drawText(totalText, { x: rightMargin - totalW, y: y, size: 16, font: helveticaBold, color: rgb(0, 0, 0) });

  // Amount Due label
  const amtDueText = 'Amount Due (USD)';
  const amtDueW = helvetica.widthOfTextAtSize(amtDueText, 9);
  page.drawText(amtDueText, { x: rightMargin - amtDueW, y: y - 16, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

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

// ============================================
// INVOICE SEARCH
// ============================================
// NOTE: This route MUST be defined before /:id to avoid /:id matching "search" as an ID

/**
 * @swagger
 * /api/invoices/search:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Search invoices with filters
 *     description: Search and filter invoices with pagination
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Single status or comma-separated statuses (draft, sent, viewed, partial, paid, overdue, cancelled)
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Search results
 */
router.get(
  '/search',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    // Define valid statuses for type checking
    type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
    const validStatuses: InvoiceStatus[] = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];

    // Parse status - can be single value or comma-separated
    let status: InvoiceStatus | InvoiceStatus[] | undefined;
    if (req.query.status) {
      const statusStr = req.query.status as string;
      if (statusStr.includes(',')) {
        const statuses = statusStr.split(',').filter(s => validStatuses.includes(s as InvoiceStatus)) as InvoiceStatus[];
        status = statuses.length > 0 ? statuses : undefined;
      } else if (validStatuses.includes(statusStr as InvoiceStatus)) {
        status = statusStr as InvoiceStatus;
      }
    }

    const filters = {
      clientId: req.query.clientId ? parseInt(req.query.clientId as string) : undefined,
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
      status,
      invoiceType: req.query.invoiceType as 'standard' | 'deposit' | undefined,
      search: req.query.search as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      dueDateFrom: req.query.dueDateFrom as string | undefined,
      dueDateTo: req.query.dueDateTo as string | undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    try {
      const result = await getInvoiceService().searchInvoices(filters);

      res.json({
        success: true,
        invoices: result.invoices.map(toSnakeCaseInvoice),
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to search invoices',
        code: 'SEARCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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

      // Schedule payment reminders
      try {
        await getInvoiceService().scheduleReminders(invoiceId);
        console.log(`[Invoices] Scheduled reminders for invoice #${invoiceId}`);
      } catch (reminderError) {
        console.error('[Invoices] Failed to schedule reminders:', reminderError);
        // Don't fail the send operation if reminders fail
      }

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

// ============================================
// DEPOSIT INVOICE ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/deposit:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a deposit invoice
 *     description: Create a special deposit invoice for a project
 */
router.post(
  '/deposit',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, amount, percentage, description } = req.body;

    if (!projectId || !clientId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'amount']
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive number'
      });
    }

    try {
      const invoice = await getInvoiceService().createDepositInvoice(
        projectId,
        clientId,
        amount,
        percentage,
        description
      );

      res.status(201).json({
        success: true,
        message: 'Deposit invoice created successfully',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      console.error('[Invoices] Error creating deposit invoice:', error);
      res.status(500).json({
        error: 'Failed to create deposit invoice',
        code: 'CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/deposits/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get available deposits for a project
 *     description: Returns paid deposit invoices that have available credit
 */
router.get(
  '/deposits/:projectId',
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
      const deposits = await getInvoiceService().getAvailableDeposits(projectId);
      res.json({
        success: true,
        deposits: deposits.map(toSnakeCaseDeposit),
        count: deposits.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve available deposits',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/apply-credit:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Apply deposit credit to an invoice
 *     description: Apply credit from a paid deposit invoice to reduce the amount due
 */
router.post(
  '/:id/apply-credit',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { depositInvoiceId, amount } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    if (!depositInvoiceId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['depositInvoiceId', 'amount']
      });
    }

    try {
      const credit = await getInvoiceService().applyDepositCredit(
        invoiceId,
        depositInvoiceId,
        parseFloat(amount),
        req.user?.email
      );

      res.json({
        success: true,
        message: 'Credit applied successfully',
        credit: toSnakeCaseCredit(credit)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('Insufficient') || message.includes('Invalid')) {
        return res.status(400).json({
          error: message,
          code: 'INVALID_CREDIT'
        });
      }

      res.status(500).json({
        error: 'Failed to apply credit',
        code: 'CREDIT_FAILED',
        message
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/credits:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get credits applied to an invoice
 */
router.get(
  '/:id/credits',
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
      const credits = await getInvoiceService().getInvoiceCredits(invoiceId);
      const totalCredits = await getInvoiceService().getTotalCredits(invoiceId);

      res.json({
        success: true,
        credits: credits.map(toSnakeCaseCredit),
        total_credits: totalCredits
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve credits',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// PAYMENT PLAN TEMPLATE ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/payment-plans:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all payment plan templates
 */
router.get(
  '/payment-plans',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const templates = await getInvoiceService().getPaymentPlanTemplates();
      res.json({
        success: true,
        templates: templates.map(toSnakeCasePaymentPlan),
        count: templates.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve payment plan templates',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/payment-plans:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a new payment plan template
 */
router.post(
  '/payment-plans',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, payments, isDefault } = req.body;

    if (!name || !payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['name', 'payments']
      });
    }

    try {
      const template = await getInvoiceService().createPaymentPlanTemplate({
        name,
        description,
        payments,
        isDefault: isDefault || false
      });

      res.status(201).json({
        success: true,
        message: 'Payment plan template created',
        template: toSnakeCasePaymentPlan(template)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to create payment plan template',
        code: 'CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/payment-plans/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Delete a payment plan template
 */
router.delete(
  '/payment-plans/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
      return res.status(400).json({
        error: 'Invalid template ID',
        code: 'INVALID_ID'
      });
    }

    try {
      await getInvoiceService().deletePaymentPlanTemplate(templateId);
      res.json({
        success: true,
        message: 'Payment plan template deleted'
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to delete payment plan template',
        code: 'DELETION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/generate-from-plan:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Generate invoices from a payment plan template
 */
router.post(
  '/generate-from-plan',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, templateId, totalAmount } = req.body;

    if (!projectId || !clientId || !templateId || !totalAmount) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'templateId', 'totalAmount']
      });
    }

    try {
      const invoices = await getInvoiceService().generateInvoicesFromTemplate(
        projectId,
        clientId,
        templateId,
        totalAmount
      );

      res.status(201).json({
        success: true,
        message: `Generated ${invoices.length} invoices from payment plan`,
        invoices: invoices.map(toSnakeCaseInvoice),
        count: invoices.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to generate invoices from plan',
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// MILESTONE-LINKED INVOICE ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/milestone/{milestoneId}:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create an invoice linked to a milestone
 */
router.post(
  '/milestone/:milestoneId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const milestoneId = parseInt(req.params.milestoneId);

    if (isNaN(milestoneId)) {
      return res.status(400).json({
        error: 'Invalid milestone ID',
        code: 'INVALID_ID'
      });
    }

    const invoiceData: InvoiceCreateData = req.body;

    if (!invoiceData.projectId || !invoiceData.clientId || !invoiceData.lineItems?.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'lineItems']
      });
    }

    try {
      const invoice = await getInvoiceService().createMilestoneInvoice(milestoneId, invoiceData);

      res.status(201).json({
        success: true,
        message: 'Milestone invoice created',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to create milestone invoice',
        code: 'CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/milestone/{milestoneId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoices linked to a milestone
 */
router.get(
  '/milestone/:milestoneId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const milestoneId = parseInt(req.params.milestoneId);

    if (isNaN(milestoneId)) {
      return res.status(400).json({
        error: 'Invalid milestone ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoices = await getInvoiceService().getInvoicesByMilestone(milestoneId);

      res.json({
        success: true,
        invoices: invoices.map(toSnakeCaseInvoice),
        count: invoices.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve milestone invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/link-milestone:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Link an existing invoice to a milestone
 */
router.put(
  '/:id/link-milestone',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { milestoneId } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    if (!milestoneId) {
      return res.status(400).json({
        error: 'Missing milestone ID',
        code: 'MISSING_FIELDS',
        required: ['milestoneId']
      });
    }

    try {
      const invoice = await getInvoiceService().linkInvoiceToMilestone(invoiceId, milestoneId);

      res.json({
        success: true,
        message: 'Invoice linked to milestone',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to link invoice to milestone',
        code: 'LINK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// SCHEDULED INVOICE ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/schedule:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Schedule an invoice for future generation
 */
router.post(
  '/schedule',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, scheduledDate, triggerType, triggerMilestoneId, lineItems, notes, terms } = req.body;

    if (!projectId || !clientId || !scheduledDate || !lineItems?.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'scheduledDate', 'lineItems']
      });
    }

    try {
      const scheduled = await getInvoiceService().scheduleInvoice({
        projectId,
        clientId,
        scheduledDate,
        triggerType,
        triggerMilestoneId,
        lineItems,
        notes,
        terms
      });

      res.status(201).json({
        success: true,
        message: 'Invoice scheduled',
        scheduled_invoice: toSnakeCaseScheduledInvoice(scheduled)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to schedule invoice',
        code: 'SCHEDULING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/scheduled:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all scheduled invoices
 */
router.get(
  '/scheduled',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const scheduled = await getInvoiceService().getScheduledInvoices();

      res.json({
        success: true,
        scheduled_invoices: scheduled.map(toSnakeCaseScheduledInvoice),
        count: scheduled.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve scheduled invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/scheduled/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get scheduled invoices for a project
 */
router.get(
  '/scheduled/:projectId',
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
      const scheduled = await getInvoiceService().getScheduledInvoices(projectId);

      res.json({
        success: true,
        scheduled_invoices: scheduled.map(toSnakeCaseScheduledInvoice),
        count: scheduled.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve scheduled invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/scheduled/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Cancel a scheduled invoice
 */
router.delete(
  '/scheduled/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const scheduledId = parseInt(req.params.id);

    if (isNaN(scheduledId)) {
      return res.status(400).json({
        error: 'Invalid scheduled invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      await getInvoiceService().cancelScheduledInvoice(scheduledId);

      res.json({
        success: true,
        message: 'Scheduled invoice cancelled'
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to cancel scheduled invoice',
        code: 'CANCELLATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// RECURRING INVOICE ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/recurring:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a recurring invoice pattern
 */
router.post(
  '/recurring',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, frequency, dayOfMonth, dayOfWeek, lineItems, notes, terms, startDate, endDate } = req.body;

    if (!projectId || !clientId || !frequency || !lineItems?.length || !startDate) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'frequency', 'lineItems', 'startDate']
      });
    }

    const validFrequencies = ['weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        error: 'Invalid frequency',
        code: 'INVALID_FREQUENCY',
        validFrequencies
      });
    }

    try {
      const recurring = await getInvoiceService().createRecurringInvoice({
        projectId,
        clientId,
        frequency,
        dayOfMonth,
        dayOfWeek,
        lineItems,
        notes,
        terms,
        startDate,
        endDate
      });

      res.status(201).json({
        success: true,
        message: 'Recurring invoice pattern created',
        recurring_invoice: toSnakeCaseRecurringInvoice(recurring)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to create recurring invoice',
        code: 'CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all recurring invoices
 */
router.get(
  '/recurring',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const recurring = await getInvoiceService().getRecurringInvoices();

      res.json({
        success: true,
        recurring_invoices: recurring.map(toSnakeCaseRecurringInvoice),
        count: recurring.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve recurring invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{projectId}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get recurring invoices for a project
 */
router.get(
  '/recurring/:projectId',
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
      const recurring = await getInvoiceService().getRecurringInvoices(projectId);

      res.json({
        success: true,
        recurring_invoices: recurring.map(toSnakeCaseRecurringInvoice),
        count: recurring.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve recurring invoices',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update a recurring invoice pattern
 */
router.put(
  '/recurring/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return res.status(400).json({
        error: 'Invalid recurring invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const recurring = await getInvoiceService().updateRecurringInvoice(recurringId, req.body);

      res.json({
        success: true,
        message: 'Recurring invoice updated',
        recurring_invoice: toSnakeCaseRecurringInvoice(recurring)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to update recurring invoice',
        code: 'UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}/pause:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Pause a recurring invoice
 */
router.post(
  '/recurring/:id/pause',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return res.status(400).json({
        error: 'Invalid recurring invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      await getInvoiceService().pauseRecurringInvoice(recurringId);

      res.json({
        success: true,
        message: 'Recurring invoice paused'
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to pause recurring invoice',
        code: 'PAUSE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}/resume:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Resume a paused recurring invoice
 */
router.post(
  '/recurring/:id/resume',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return res.status(400).json({
        error: 'Invalid recurring invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      await getInvoiceService().resumeRecurringInvoice(recurringId);

      res.json({
        success: true,
        message: 'Recurring invoice resumed'
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to resume recurring invoice',
        code: 'RESUME_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/recurring/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Delete a recurring invoice pattern
 */
router.delete(
  '/recurring/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const recurringId = parseInt(req.params.id);

    if (isNaN(recurringId)) {
      return res.status(400).json({
        error: 'Invalid recurring invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      await getInvoiceService().deleteRecurringInvoice(recurringId);

      res.json({
        success: true,
        message: 'Recurring invoice deleted'
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to delete recurring invoice',
        code: 'DELETION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// PAYMENT REMINDER ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/reminders:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get reminders for an invoice
 */
router.get(
  '/:id/reminders',
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
      const reminders = await getInvoiceService().getInvoiceReminders(invoiceId);

      res.json({
        success: true,
        reminders: reminders.map(toSnakeCaseReminder),
        count: reminders.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve reminders',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/reminders/{id}/skip:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Skip a scheduled reminder
 */
router.post(
  '/reminders/:id/skip',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const reminderId = parseInt(req.params.id);

    if (isNaN(reminderId)) {
      return res.status(400).json({
        error: 'Invalid reminder ID',
        code: 'INVALID_ID'
      });
    }

    try {
      await getInvoiceService().skipReminder(reminderId);

      res.json({
        success: true,
        message: 'Reminder skipped'
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to skip reminder',
        code: 'SKIP_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// INVOICE EDIT ENDPOINT
// ============================================

/**
 * @swagger
 * /api/invoices/{id}:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update a draft invoice
 *     description: Update invoice details (only draft invoices can be edited)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    // Handle status-only updates (backwards compatibility)
    if (req.body.status && Object.keys(req.body).length === 1) {
      const validStatuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({
          error: 'Invalid status',
          code: 'INVALID_STATUS',
          validStatuses
        });
      }

      try {
        const invoice = await getInvoiceService().updateInvoiceStatus(invoiceId, req.body.status);
        res.json({
          success: true,
          message: 'Invoice status updated',
          invoice: toSnakeCaseInvoice(invoice)
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('not found')) {
          return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
        }
        res.status(500).json({ error: 'Failed to update invoice', code: 'UPDATE_FAILED', message });
      }
      return;
    }

    // Full invoice update (draft only)
    try {
      const updateData: Partial<InvoiceCreateData> = {};

      if (req.body.lineItems) {
        updateData.lineItems = req.body.lineItems;
      }
      if (req.body.line_items) {
        updateData.lineItems = req.body.line_items;
      }
      if (req.body.dueDate !== undefined || req.body.due_date !== undefined) {
        updateData.dueDate = req.body.dueDate || req.body.due_date;
      }
      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }
      if (req.body.terms !== undefined) {
        updateData.terms = req.body.terms;
      }
      if (req.body.billToName !== undefined || req.body.bill_to_name !== undefined) {
        updateData.billToName = req.body.billToName || req.body.bill_to_name;
      }
      if (req.body.billToEmail !== undefined || req.body.bill_to_email !== undefined) {
        updateData.billToEmail = req.body.billToEmail || req.body.bill_to_email;
      }
      if (req.body.servicesTitle !== undefined || req.body.services_title !== undefined) {
        updateData.servicesTitle = req.body.servicesTitle || req.body.services_title;
      }
      if (req.body.servicesDescription !== undefined || req.body.services_description !== undefined) {
        updateData.servicesDescription = req.body.servicesDescription || req.body.services_description;
      }
      if (req.body.deliverables !== undefined) {
        updateData.deliverables = req.body.deliverables;
      }

      const invoice = await getInvoiceService().updateInvoice(invoiceId, updateData);

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' });
      }
      if (message.includes('Only draft')) {
        return res.status(400).json({ error: message, code: 'NOT_EDITABLE' });
      }

      res.status(500).json({
        error: 'Failed to update invoice',
        code: 'UPDATE_FAILED',
        message
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

      // Check cache first
      const cacheKey = getPdfCacheKey('invoice', invoiceId, invoice.updatedAt);
      const cachedPdf = getCachedPdf(cacheKey);
      if (cachedPdf) {
        const isPreview = req.query.preview === 'true';
        const disposition = isPreview ? 'inline' : 'attachment';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${disposition}; filename="${invoice.invoiceNumber}.pdf"`);
        res.setHeader('Content-Length', cachedPdf.length);
        res.setHeader('X-PDF-Cache', 'HIT');
        return res.send(Buffer.from(cachedPdf));
      }

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

      // Get credits applied to this invoice (if any)
      const invoiceCredits = await getInvoiceService().getInvoiceCredits(invoiceId);
      const totalCredits = await getInvoiceService().getTotalCredits(invoiceId);

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
        terms: invoice.terms,
        // Deposit invoice fields
        isDeposit: invoice.invoiceType === 'deposit',
        depositPercentage: invoice.depositPercentage,
        // Credits applied
        credits: invoiceCredits.map((c) => ({
          depositInvoiceNumber: c.depositInvoiceNumber || `INV-${c.depositInvoiceId}`,
          amount: c.amount
        })),
        totalCredits
      };

      // Generate PDF using pdf-lib (template-matching version)
      const pdfBytes = await generateInvoicePdf(pdfData);

      // Cache the generated PDF
      cachePdf(cacheKey, pdfBytes, invoice.updatedAt);

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
      res.setHeader('X-PDF-Cache', 'MISS');
      res.send(Buffer.from(pdfBytes));
    } catch (error: unknown) {
      console.error('[Invoices] PDF generation error:', error);
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

/**
 * @swagger
 * /api/invoices/{id}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by ID
 *     description: Retrieve a single invoice by its ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully
 *       404:
 *         description: Invoice not found
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
        code: 'RETRIEVAL_FAILED'
      });
    }
  })
);

// ============================================
// DELETE / VOID INVOICE
// ============================================

/**
 * @swagger
 * /api/invoices/{id}:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Delete or void an invoice
 *     description: |
 *       Draft/Cancelled invoices are permanently deleted.
 *       Sent/Viewed/Partial/Overdue invoices are voided (status changed to cancelled).
 *       Paid invoices cannot be deleted or voided.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invoice deleted or voided
 *       400:
 *         description: Cannot delete paid invoice
 *       404:
 *         description: Invoice not found
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const deletedBy = req.user?.email || 'admin';
      const result = await softDeleteService.softDeleteInvoice(invoiceId, deletedBy);

      if (!result.success) {
        // Check if it's a "cannot delete paid" error
        if (result.message.includes('paid')) {
          return res.status(400).json({
            error: result.message,
            code: 'CANNOT_DELETE_PAID'
          });
        }
        return res.status(404).json({
          error: result.message,
          code: 'NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: result.message,
        action: 'soft_deleted'
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      res.status(500).json({
        error: 'Failed to delete invoice',
        code: 'DELETE_FAILED',
        message
      });
    }
  })
);

// ============================================
// DUPLICATE / CLONE INVOICE
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/duplicate:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Duplicate an invoice
 *     description: Creates a new draft invoice as a copy of an existing invoice
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Invoice duplicated successfully
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/:id/duplicate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const newInvoice = await getInvoiceService().duplicateInvoice(invoiceId);

      res.status(201).json({
        success: true,
        message: 'Invoice duplicated successfully',
        invoice: toSnakeCaseInvoice(newInvoice)
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
        error: 'Failed to duplicate invoice',
        code: 'DUPLICATE_FAILED',
        message
      });
    }
  })
);

// ============================================
// RECORD PAYMENT
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/record-payment:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Record a payment on an invoice
 *     description: Records a partial or full payment. Status auto-updates to 'partial' or 'paid'.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentMethod
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 500
 *               paymentMethod:
 *                 type: string
 *                 example: "bank_transfer"
 *               paymentReference:
 *                 type: string
 *                 example: "TXN-12345"
 *     responses:
 *       200:
 *         description: Payment recorded successfully
 *       400:
 *         description: Invalid payment data
 */
router.post(
  '/:id/record-payment',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentReference } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid payment amount',
        code: 'INVALID_AMOUNT'
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        error: 'Payment method is required',
        code: 'MISSING_PAYMENT_METHOD'
      });
    }

    try {
      const invoice = await getInvoiceService().recordPayment(
        invoiceId,
        amount,
        paymentMethod,
        paymentReference
      );

      res.json({
        success: true,
        message: invoice.status === 'paid'
          ? 'Payment recorded - invoice is now fully paid'
          : 'Partial payment recorded successfully',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND'
        });
      }

      if (message.includes('already fully paid') || message.includes('cancelled')) {
        return res.status(400).json({
          error: message,
          code: 'PAYMENT_NOT_ALLOWED'
        });
      }

      res.status(500).json({
        error: 'Failed to record payment',
        code: 'PAYMENT_FAILED',
        message
      });
    }
  })
);

// ============================================
// CHECK AND MARK OVERDUE (ADMIN TRIGGER)
// ============================================

/**
 * @swagger
 * /api/invoices/check-overdue:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Check and mark overdue invoices
 *     description: Manually trigger the overdue check (also runs automatically via scheduler)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue check completed
 */
router.post(
  '/check-overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const count = await getInvoiceService().checkAndMarkOverdue();

      res.json({
        success: true,
        message: count > 0
          ? `Marked ${count} invoice(s) as overdue`
          : 'No invoices needed to be marked as overdue',
        count
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to check overdue invoices',
        code: 'CHECK_OVERDUE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// MANUAL SEND REMINDER
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/send-reminder:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Send a payment reminder email
 *     description: Manually send a payment reminder for an outstanding invoice
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reminder sent successfully
 *       400:
 *         description: Invoice is already paid
 */
router.post(
  '/:id/send-reminder',
  authenticateToken,
  requireAdmin,
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

      if (invoice.status === 'paid') {
        return res.status(400).json({
          error: 'Cannot send reminder for a paid invoice',
          code: 'INVOICE_PAID'
        });
      }

      if (invoice.status === 'cancelled') {
        return res.status(400).json({
          error: 'Cannot send reminder for a cancelled invoice',
          code: 'INVOICE_CANCELLED'
        });
      }

      // Get client email
      const db = getDatabase();
      const clientRow = await db.get(
        'SELECT email, contact_name FROM clients WHERE id = ?',
        [invoice.clientId]
      ) as { email?: string; contact_name?: string } | undefined;

      if (!clientRow || !clientRow.email) {
        return res.status(400).json({
          error: 'Client email not found',
          code: 'NO_CLIENT_EMAIL'
        });
      }

      const clientEmail = clientRow.email;
      const clientName = clientRow.contact_name || 'Valued Client';

      // Determine reminder urgency
      const today = new Date();
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const daysOverdue = dueDate ? Math.ceil((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000)) : 0;

      let subject: string;
      let urgencyMessage = '';

      if (daysOverdue > 14) {
        subject = `URGENT: Invoice #${invoice.invoiceNumber} is ${daysOverdue} days overdue`;
        urgencyMessage = 'Immediate payment is required.';
      } else if (daysOverdue > 0) {
        subject = `Payment Overdue: Invoice #${invoice.invoiceNumber}`;
        urgencyMessage = `This invoice is ${daysOverdue} day(s) overdue.`;
      } else {
        subject = `Payment Reminder: Invoice #${invoice.invoiceNumber}`;
        urgencyMessage = dueDate
          ? `Payment is due on ${dueDate.toLocaleDateString()}.`
          : 'Payment is due upon receipt.';
      }

      const outstandingAmount = invoice.amountTotal - (invoice.amountPaid || 0);
      const portalUrl = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:3000/client/portal'}?invoice=${invoiceId}`;

      await emailService.sendEmail({
        to: clientEmail,
        subject,
        text: `
Hi ${clientName},

This is a reminder regarding invoice #${invoice.invoiceNumber}.

Amount Outstanding: $${outstandingAmount.toFixed(2)}
${urgencyMessage}

View and pay your invoice here: ${portalUrl}

If you have already submitted payment, please disregard this message.

Best regards,
${BUSINESS_INFO.name}
        `,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${daysOverdue > 0 ? '#dc3545' : '#00ff41'}; color: ${daysOverdue > 0 ? '#fff' : '#000'}; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .amount { font-size: 24px; font-weight: bold; color: #333; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #00ff41; color: #000; text-decoration: none; border-radius: 4px; }
    .urgency { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
    .footer { padding: 20px; text-align: center; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${subject}</h2>
    </div>
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>This is a reminder regarding invoice #${invoice.invoiceNumber}.</p>
      ${urgencyMessage ? `<div class="urgency"><strong>${urgencyMessage}</strong></div>` : ''}
      <div class="amount">Amount Outstanding: $${outstandingAmount.toFixed(2)}</div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${portalUrl}" class="button">View Invoice & Pay</a>
      </p>
      <p><small>If you have already submitted payment, please disregard this message.</small></p>
    </div>
    <div class="footer">
      <p>Best regards,<br>${BUSINESS_INFO.name}</p>
    </div>
  </div>
</body>
</html>
        `
      });

      res.json({
        success: true,
        message: 'Payment reminder sent successfully',
        sentTo: clientEmail
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
        error: 'Failed to send reminder',
        code: 'SEND_REMINDER_FAILED',
        message
      });
    }
  })
);

// ============================================
// PAYMENT TERMS PRESETS
// ============================================

/**
 * Transform PaymentTermsPreset to snake_case for frontend
 */
function toSnakeCasePaymentTerms(terms: PaymentTermsPreset): Record<string, unknown> {
  return {
    id: terms.id,
    name: terms.name,
    days_until_due: terms.daysUntilDue,
    description: terms.description,
    late_fee_rate: terms.lateFeeRate,
    late_fee_type: terms.lateFeeType,
    late_fee_flat_amount: terms.lateFeeFlatAmount,
    grace_period_days: terms.gracePeriodDays,
    is_default: terms.isDefault,
    created_at: terms.createdAt
  };
}

/**
 * Transform InvoicePayment to snake_case for frontend
 */
function toSnakeCasePayment(payment: InvoicePayment): Record<string, unknown> {
  return {
    id: payment.id,
    invoice_id: payment.invoiceId,
    amount: payment.amount,
    payment_method: payment.paymentMethod,
    payment_reference: payment.paymentReference,
    payment_date: payment.paymentDate,
    notes: payment.notes,
    created_at: payment.createdAt
  };
}

/**
 * @swagger
 * /api/invoices/payment-terms:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all payment terms presets
 *     description: Returns all available payment terms (Net 15, Net 30, etc.)
 */
router.get(
  '/payment-terms',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const terms = await getInvoiceService().getPaymentTermsPresets();
      res.json({
        success: true,
        terms: terms.map(toSnakeCasePaymentTerms)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve payment terms',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/payment-terms:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a custom payment terms preset
 */
router.post(
  '/payment-terms',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, daysUntilDue, description, lateFeeRate, lateFeeType, lateFeeFlatAmount, gracePeriodDays, isDefault } = req.body;

    if (!name || daysUntilDue === undefined) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['name', 'daysUntilDue']
      });
    }

    try {
      const terms = await getInvoiceService().createPaymentTermsPreset({
        name,
        daysUntilDue,
        description,
        lateFeeRate,
        lateFeeType,
        lateFeeFlatAmount,
        gracePeriodDays,
        isDefault
      });

      res.status(201).json({
        success: true,
        message: 'Payment terms preset created',
        terms: toSnakeCasePaymentTerms(terms)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to create payment terms',
        code: 'CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/apply-terms:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Apply payment terms to an invoice
 */
router.post(
  '/:id/apply-terms',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { termsId } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    if (!termsId) {
      return res.status(400).json({
        error: 'Missing termsId',
        code: 'MISSING_FIELDS',
        required: ['termsId']
      });
    }

    try {
      const invoice = await getInvoiceService().applyPaymentTerms(invoiceId, termsId);
      res.json({
        success: true,
        message: 'Payment terms applied',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice or payment terms not found',
          code: 'NOT_FOUND'
        });
      }
      res.status(500).json({
        error: 'Failed to apply payment terms',
        code: 'UPDATE_FAILED',
        message
      });
    }
  })
);

// ============================================
// TAX AND DISCOUNT
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/tax-discount:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update invoice tax and discount
 */
router.put(
  '/:id/tax-discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { taxRate, discountType, discountValue } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().updateInvoiceTaxAndDiscount(
        invoiceId,
        taxRate,
        discountType,
        discountValue
      );

      res.json({
        success: true,
        message: 'Tax and discount updated',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('draft')) {
        return res.status(400).json({
          error: 'Only draft invoices can be modified',
          code: 'INVALID_STATUS'
        });
      }
      res.status(500).json({
        error: 'Failed to update tax/discount',
        code: 'UPDATE_FAILED',
        message
      });
    }
  })
);

// ============================================
// LATE FEES
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/late-fee:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Calculate late fee for an invoice
 */
router.get(
  '/:id/late-fee',
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
      const lateFee = getInvoiceService().calculateLateFee(invoice);

      res.json({
        success: true,
        invoiceId,
        lateFee,
        alreadyApplied: !!invoice.lateFeeAppliedAt,
        lateFeeAppliedAt: invoice.lateFeeAppliedAt
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
        error: 'Failed to calculate late fee',
        code: 'CALCULATION_FAILED',
        message
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/apply-late-fee:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Apply late fee to an overdue invoice
 */
router.post(
  '/:id/apply-late-fee',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().applyLateFee(invoiceId);
      res.json({
        success: true,
        message: 'Late fee applied',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('already been applied')) {
        return res.status(400).json({
          error: 'Late fee already applied',
          code: 'ALREADY_APPLIED'
        });
      }
      if (message.includes('No late fee applicable')) {
        return res.status(400).json({
          error: 'No late fee applicable',
          code: 'NOT_APPLICABLE'
        });
      }
      res.status(500).json({
        error: 'Failed to apply late fee',
        code: 'APPLY_FAILED',
        message
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/process-late-fees:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Process late fees for all eligible invoices
 */
router.post(
  '/process-late-fees',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const count = await getInvoiceService().processLateFees();
      res.json({
        success: true,
        message: `Late fees applied to ${count} invoices`,
        count
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to process late fees',
        code: 'PROCESS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// PAYMENT HISTORY
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/payments:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get payment history for an invoice
 */
router.get(
  '/:id/payments',
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
      const payments = await getInvoiceService().getPaymentHistory(invoiceId);
      res.json({
        success: true,
        payments: payments.map(toSnakeCasePayment)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve payment history',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/{id}/record-payment-with-history:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Record a payment and add to payment history
 */
router.post(
  '/:id/record-payment-with-history',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentReference, notes } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    if (!amount || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['amount', 'paymentMethod']
      });
    }

    try {
      const result = await getInvoiceService().recordPaymentWithHistory(
        invoiceId,
        amount,
        paymentMethod,
        paymentReference,
        notes
      );

      res.json({
        success: true,
        message: 'Payment recorded',
        invoice: toSnakeCaseInvoice(result.invoice),
        payment: toSnakeCasePayment(result.payment)
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to record payment',
        code: 'RECORD_FAILED',
        message
      });
    }
  })
);

/**
 * @swagger
 * /api/invoices/all-payments:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get all payments across all invoices
 */
router.get(
  '/all-payments',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    try {
      const payments = await getInvoiceService().getAllPayments(dateFrom, dateTo);
      res.json({
        success: true,
        payments: payments.map(toSnakeCasePayment),
        count: payments.length
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve payments',
        code: 'RETRIEVAL_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// INVOICE AGING REPORT
// ============================================

/**
 * @swagger
 * /api/invoices/aging-report:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get accounts receivable aging report
 */
router.get(
  '/aging-report',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;

    try {
      const report = await getInvoiceService().getAgingReport(clientId);

      // Transform the report for frontend
      const transformedReport = {
        generated_at: report.generatedAt,
        total_outstanding: report.totalOutstanding,
        buckets: report.buckets.map(bucket => ({
          bucket: bucket.bucket,
          count: bucket.count,
          total_amount: bucket.totalAmount,
          invoices: bucket.invoices.map(toSnakeCaseInvoice)
        }))
      };

      res.json({
        success: true,
        report: transformedReport
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to generate aging report',
        code: 'REPORT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// INTERNAL NOTES
// ============================================

/**
 * @swagger
 * /api/invoices/{id}/internal-notes:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update internal notes on an invoice
 */
router.put(
  '/:id/internal-notes',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { internalNotes } = req.body;

    if (isNaN(invoiceId)) {
      return res.status(400).json({
        error: 'Invalid invoice ID',
        code: 'INVALID_ID'
      });
    }

    try {
      const invoice = await getInvoiceService().updateInternalNotes(invoiceId, internalNotes || '');
      res.json({
        success: true,
        message: 'Internal notes updated',
        invoice: toSnakeCaseInvoice(invoice)
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
        error: 'Failed to update internal notes',
        code: 'UPDATE_FAILED',
        message
      });
    }
  })
);

// ============================================
// COMPREHENSIVE STATISTICS
// ============================================

/**
 * @swagger
 * /api/invoices/comprehensive-stats:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get comprehensive invoice statistics
 */
router.get(
  '/comprehensive-stats',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    try {
      const stats = await getInvoiceService().getComprehensiveStats(dateFrom, dateTo);

      res.json({
        success: true,
        stats: {
          total_invoices: stats.totalInvoices,
          total_revenue: stats.totalRevenue,
          total_outstanding: stats.totalOutstanding,
          total_overdue: stats.totalOverdue,
          average_invoice_amount: stats.averageInvoiceAmount,
          average_days_to_payment: stats.averageDaysToPayment,
          status_breakdown: stats.statusBreakdown,
          monthly_revenue: stats.monthlyRevenue
        }
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        code: 'STATS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// ============================================
// CUSTOM INVOICE NUMBER
// ============================================

/**
 * @swagger
 * /api/invoices/with-custom-number:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create invoice with custom number prefix
 */
router.post(
  '/with-custom-number',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { prefix, ...invoiceData } = req.body;

    if (!invoiceData.projectId || !invoiceData.clientId || !invoiceData.lineItems?.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
        required: ['projectId', 'clientId', 'lineItems']
      });
    }

    try {
      const invoice = await getInvoiceService().createInvoiceWithCustomNumber({
        ...invoiceData,
        prefix
      });

      res.status(201).json({
        success: true,
        message: 'Invoice created with custom number',
        invoice: toSnakeCaseInvoice(invoice)
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: 'Failed to create invoice',
        code: 'CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as invoicesRouter };
export default router;
