/**
 * ===============================================
 * INVOICE CORE ROUTES
 * ===============================================
 * @file server/routes/invoices/core.ts
 *
 * Core invoice CRUD and search endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessInvoice } from '../../middleware/access-control.js';
import { InvoiceCreateData, InvoiceLineItem } from '../../services/invoice-service.js';
import { emailService } from '../../services/email-service.js';
import { getDatabase } from '../../database/init.js';
import { getString } from '../../database/row-helpers.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { generateInvoicePdf, InvoicePdfData } from './pdf.js';
import { getPdfCacheKey, getCachedPdf, cachePdf } from '../../utils/pdf-utils.js';
import { getInvoiceService, toSnakeCaseInvoice } from './helpers.js';
import { errorResponse, errorResponseWithPayload } from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';

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
      errorResponseWithPayload(res, 'Failed to retrieve invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

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
      errorResponseWithPayload(res, 'Failed to create test invoice', 500, 'TEST_CREATION_FAILED', { message });
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
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      res.json({ success: true, invoice });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to retrieve invoice', 500, 'RETRIEVAL_FAILED', {
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
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'MISSING_FIELDS', {
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
      return errorResponseWithPayload(res, 'Invalid line items', 400, 'INVALID_LINE_ITEMS', {
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
      errorResponseWithPayload(res, 'Failed to create invoice', 500, 'CREATION_FAILED', { message });
    }
  })
);

// PDF generation function imported from ./invoices/pdf.js
// See: server/routes/invoices/pdf.ts for generateInvoicePdf and InvoicePdfData

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
      return errorResponse(res, 'Missing required fields', 400, 'MISSING_FIELDS');
    }

    const db = getDatabase();

    // Get client info
    const client = await db.get(
      'SELECT contact_name, company_name, email, phone FROM clients WHERE id = ?',
      [clientId]
    );

    if (!client) {
      return errorResponse(res, 'Client not found', 404, 'CLIENT_NOT_FOUND');
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
      errorResponseWithPayload(res, 'Failed to search invoices', 500, 'SEARCH_FAILED', {
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
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400, 'INVALID_ID');
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
      errorResponseWithPayload(res, 'Failed to retrieve client invoices', 500, 'RETRIEVAL_FAILED', {
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
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400, 'INVALID_ID');
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
      errorResponseWithPayload(res, 'Failed to retrieve project invoices', 500, 'RETRIEVAL_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
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
 *       - in: query
 *         name: preview
 *         required: false
 *         schema:
 *           type: boolean
 *         description: When true, returns inline preview instead of attachment
 */
router.get(
  '/:id/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);

      if (!(await canAccessInvoice(req, invoiceId))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }

      const cacheKey = getPdfCacheKey('invoice', invoiceId, invoice.updatedAt || invoice.createdAt);
      const cached = getCachedPdf(cacheKey);
      const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';
      const filename = `${invoice.invoiceNumber || 'invoice'}.pdf`;

      if (cached) {
        return sendPdfResponse(res, cached, { filename, disposition, cacheStatus: 'HIT' });
      }

      const db = getDatabase();
      const clientRow = await db.get(
        'SELECT contact_name, company_name, email, phone FROM clients WHERE id = ?',
        [invoice.clientId]
      );

      const lineItems: InvoicePdfData['lineItems'] = Array.isArray(invoice.lineItems)
        ? invoice.lineItems.map((item: InvoiceLineItem) => ({
          description: item.description || '',
          quantity: item.quantity || 1,
          rate: item.rate || item.amount || 0,
          amount: item.amount || 0
        }))
        : [];

      const invoiceCredits = await getInvoiceService().getInvoiceCredits(invoiceId);
      const totalCredits = await getInvoiceService().getTotalCredits(invoiceId);

      const formatDate = (dateStr?: string): string => {
        if (!dateStr) {
          return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      };

      const pdfData: InvoicePdfData = {
        invoiceNumber: invoice.invoiceNumber,
        issuedDate: formatDate(invoice.issuedDate || invoice.createdAt),
        dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : undefined,
        clientName: invoice.billToName || (clientRow ? getString(clientRow, 'contact_name') : '') || 'Client',
        clientCompany: clientRow ? getString(clientRow, 'company_name') : undefined,
        clientEmail: invoice.billToEmail || (clientRow ? getString(clientRow, 'email') : '') || '',
        clientPhone: clientRow ? getString(clientRow, 'phone') : undefined,
        projectId: invoice.projectId,
        lineItems,
        subtotal: invoice.subtotal ?? invoice.amountTotal ?? 0,
        tax: invoice.taxAmount,
        discount: invoice.discountAmount,
        total: invoice.amountTotal ?? 0,
        notes: invoice.notes,
        terms: invoice.terms,
        isDeposit: invoice.invoiceType === 'deposit',
        depositPercentage: invoice.depositPercentage,
        credits: invoiceCredits.map((credit) => ({
          depositInvoiceNumber: credit.depositInvoiceNumber || `INV-${credit.depositInvoiceId}`,
          amount: credit.amount
        })),
        totalCredits
      };

      const pdfBytes = await generateInvoicePdf(pdfData);
      cachePdf(cacheKey, pdfBytes, invoice.updatedAt || invoice.createdAt);

      return sendPdfResponse(res, pdfBytes, { filename, disposition, cacheStatus: 'MISS' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to generate invoice PDF', 500, 'PDF_FAILED', { message });
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
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);
    const { status, paymentData } = req.body;

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    const validStatuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return errorResponseWithPayload(res, 'Invalid status', 400, 'INVALID_STATUS', { validStatuses });
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
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to update invoice status', 500, 'UPDATE_FAILED', {
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
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id);

    if (isNaN(invoiceId)) {
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
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
          'SELECT u.email, u.display_name FROM invoices i JOIN users u ON i.client_id = u.id WHERE i.id = ?',
          [invoiceId]
        );

        if (!clientRow) {
          throw new Error('Client not found');
        }

        const clientEmail = getString(clientRow, 'email');
        const clientName = getString(clientRow, 'display_name');
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
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to send invoice', 500, 'SEND_FAILED', {
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
      return errorResponse(res, 'Invalid invoice ID', 400, 'INVALID_ID');
    }

    if (!amountPaid || !paymentMethod) {
      return errorResponseWithPayload(res, 'Missing payment data', 400, 'MISSING_PAYMENT_DATA', {
        required: ['amountPaid', 'paymentMethod']
      });
    }

    try {
      const existingInvoice = await getInvoiceService().getInvoiceById(invoiceId);
      if (!(await canAccessInvoice(req, invoiceId))) {
        return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
      }
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
        return errorResponse(res, 'Invoice not found', 404, 'NOT_FOUND');
      }
      errorResponseWithPayload(res, 'Failed to process payment', 500, 'PAYMENT_FAILED', {
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
      errorResponseWithPayload(res, 'Failed to retrieve invoice statistics', 500, 'STATS_FAILED', {
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export { router as coreRouter };
export default router;
