/**
 * ===============================================
 * INVOICE ROUTES
 * ===============================================
 * @file server/routes/invoices.ts
 *
 * Invoice management endpoints for creating, viewing, and updating invoices
 */

import express from 'express';
import PDFDocument from 'pdfkit';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { InvoiceService, InvoiceCreateData } from '../services/invoice-service.js';
import { emailService } from '../services/email-service.js';
import { getDatabase } from '../database/init.js';
import { auditLogger } from '../services/audit-logger.js';

const router = express.Router();

// Lazy-load invoice service after database is initialized
function getInvoiceService() {
  return InvoiceService.getInstance();
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
    timestamp: new Date().toISOString(),
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
          amount: 3500,
        },
        {
          description: 'Content Management System Setup',
          quantity: 1,
          rate: 1000,
          amount: 1000,
        },
      ],
      notes: 'Test invoice created for development testing',
      terms: 'Payment due within 30 days',
    };

    try {
      const invoice = await getInvoiceService().createInvoice(testInvoiceData);

      res.status(201).json({
        success: true,
        message: 'Test invoice created successfully',
        invoice,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to create test invoice',
        code: 'TEST_CREATION_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      res.json({ success: true, invoice });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve invoice',
        code: 'RETRIEVAL_FAILED',
        message: error.message,
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
        required: ['projectId', 'clientId', 'lineItems'],
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
        message: 'Each line item must have description, quantity, rate, and amount',
      });
    }

    try {
      const invoice = await getInvoiceService().createInvoice(invoiceData);

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to create invoice',
        code: 'CREATION_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      res.json({ success: true, invoice });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve invoice',
        code: 'RETRIEVAL_FAILED',
        message: error.message,
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
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to retrieve invoice',
        code: 'RETRIEVAL_FAILED',
        message: error.message,
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
        code: 'AUTH_REQUIRED',
      });
    }

    try {
      const invoices = await getInvoiceService().getClientInvoices(clientId);

      // Calculate summary stats
      let totalOutstanding = 0;
      let totalPaid = 0;

      invoices.forEach((invoice: any) => {
        if (invoice.status === 'paid') {
          totalPaid += parseFloat(invoice.amount_total) || 0;
        } else if (['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status)) {
          totalOutstanding += parseFloat(invoice.amount_total) || 0;
          // Subtract any partial payments
          if (invoice.amount_paid) {
            totalOutstanding -= parseFloat(invoice.amount_paid) || 0;
            totalPaid += parseFloat(invoice.amount_paid) || 0;
          }
        }
      });

      res.json({
        success: true,
        invoices,
        count: invoices.length,
        summary: {
          totalOutstanding,
          totalPaid,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to retrieve invoices',
        code: 'RETRIEVAL_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    try {
      const invoices = await getInvoiceService().getClientInvoices(clientId);
      res.json({
        success: true,
        invoices,
        count: invoices.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to retrieve client invoices',
        code: 'RETRIEVAL_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    try {
      const invoices = await getInvoiceService().getProjectInvoices(projectId);
      res.json({
        success: true,
        invoices,
        count: invoices.length,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to retrieve project invoices',
        code: 'RETRIEVAL_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    const validStatuses = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        code: 'INVALID_STATUS',
        validStatuses,
      });
    }

    try {
      const invoice = await getInvoiceService().updateInvoiceStatus(invoiceId, status, paymentData);
      res.json({
        success: true,
        message: 'Invoice status updated successfully',
        invoice,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to update invoice status',
        code: 'UPDATE_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
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

        const client = { email: clientRow.email, name: clientRow.name };

        const invoiceUrl = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:3000/client/portal'}?invoice=${invoiceId}`;

        // Send invoice email
        await emailService.sendEmail({
          to: client.email,
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
          `,
        });

        console.log(`Invoice email sent to ${client.email} for invoice #${invoiceId}`);
      } catch (emailError) {
        console.error('Failed to send invoice email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: 'Invoice sent successfully',
        invoice,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to send invoice',
        code: 'SEND_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    if (!amountPaid || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing payment data',
        code: 'MISSING_PAYMENT_DATA',
        required: ['amountPaid', 'paymentMethod'],
      });
    }

    try {
      const invoice = await getInvoiceService().markInvoiceAsPaid(invoiceId, {
        amountPaid: parseFloat(amountPaid),
        paymentMethod,
        paymentReference,
      });

      res.json({
        success: true,
        message: 'Invoice marked as paid',
        invoice,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to process payment',
        code: 'PAYMENT_FAILED',
        message: error.message,
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
        stats,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to retrieve invoice statistics',
        code: 'STATS_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    try {
      const invoice = await getInvoiceService().generateInvoiceFromIntake(intakeId);

      res.status(201).json({
        success: true,
        message: 'Invoice generated from intake successfully',
        invoice,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Intake not found',
          code: 'NOT_FOUND',
        });
      }

      if (error.message.includes('must be converted')) {
        return res.status(400).json({
          error: 'Intake not ready for invoice generation',
          code: 'INTAKE_NOT_CONVERTED',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Failed to generate invoice from intake',
        code: 'GENERATION_FAILED',
        message: error.message,
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
        code: 'INVALID_ID',
      });
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);
      const db = getDatabase();

      // Get client info
      const client = await db.get(
        'SELECT contact_name, company_name, email FROM clients WHERE id = ?',
        [invoice.clientId]
      );

      // Get project info
      const project = await db.get('SELECT name FROM projects WHERE id = ?', [invoice.projectId]);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`
      );

      // Pipe PDF to response
      doc.pipe(res);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });
      doc.text(
        `Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`,
        { align: 'right' }
      );
      if (invoice.dueDate) {
        doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
      }

      doc.moveDown(2);

      // Company info (left side)
      const companyName = process.env.COMPANY_NAME || 'No Bhad Codes';
      const supportEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || '';
      doc.fontSize(14).font('Helvetica-Bold').text(companyName, { continued: false });
      doc.fontSize(10).font('Helvetica').text('Web Development Services');
      if (supportEmail) doc.text(supportEmail);

      doc.moveDown(2);

      // Bill To section
      doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
      doc.fontSize(10).font('Helvetica');
      if (client?.company_name) doc.text(client.company_name);
      if (client?.contact_name) doc.text(client.contact_name);
      if (client?.email) doc.text(client.email);

      doc.moveDown(2);

      // Project info
      if (project?.name) {
        doc.fontSize(10).font('Helvetica-Bold').text('Project: ', { continued: true });
        doc.font('Helvetica').text(project.name);
        doc.moveDown();
      }

      // Line items table header
      const tableTop = doc.y + 20;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Qty', 300, tableTop, { width: 50, align: 'right' });
      doc.text('Rate', 360, tableTop, { width: 70, align: 'right' });
      doc.text('Amount', 440, tableTop, { width: 70, align: 'right' });

      // Line under header
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(510, tableTop + 15)
        .stroke();

      // Line items
      let y = tableTop + 25;
      doc.font('Helvetica');

      const lineItems =
        typeof invoice.lineItems === 'string'
          ? JSON.parse(invoice.lineItems)
          : invoice.lineItems || [];

      lineItems.forEach((item: any) => {
        doc.text(item.description || '', 50, y, { width: 240 });
        doc.text(item.quantity?.toString() || '1', 300, y, { width: 50, align: 'right' });
        doc.text(`$${(item.rate || 0).toFixed(2)}`, 360, y, { width: 70, align: 'right' });
        doc.text(`$${(item.amount || 0).toFixed(2)}`, 440, y, { width: 70, align: 'right' });
        y += 20;
      });

      // Totals
      y += 20;
      doc.moveTo(300, y).lineTo(510, y).stroke();
      y += 10;

      doc.font('Helvetica-Bold');
      doc.text('Total:', 360, y, { width: 70, align: 'right' });
      doc.text(`$${(invoice.amountTotal || 0).toFixed(2)}`, 440, y, { width: 70, align: 'right' });

      if (invoice.amountPaid > 0) {
        y += 15;
        doc.font('Helvetica');
        doc.text('Paid:', 360, y, { width: 70, align: 'right' });
        doc.text(`$${(invoice.amountPaid || 0).toFixed(2)}`, 440, y, { width: 70, align: 'right' });

        y += 15;
        doc.font('Helvetica-Bold');
        doc.text('Balance Due:', 360, y, { width: 70, align: 'right' });
        doc.text(
          `$${((invoice.amountTotal || 0) - (invoice.amountPaid || 0)).toFixed(2)}`,
          440,
          y,
          {
            width: 70,
            align: 'right',
          }
        );
      }

      // Notes
      if (invoice.notes) {
        doc.moveDown(3);
        doc.fontSize(10).font('Helvetica-Bold').text('Notes:');
        doc.font('Helvetica').text(invoice.notes);
      }

      // Terms
      if (invoice.terms) {
        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold').text('Terms:');
        doc.font('Helvetica').text(invoice.terms);
      }

      // Footer
      doc.fontSize(8).text('Thank you for your business!', 50, 750, { align: 'center' });

      // Finalize PDF
      doc.end();
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Invoice not found',
          code: 'NOT_FOUND',
        });
      }

      res.status(500).json({
        error: 'Failed to generate PDF',
        code: 'PDF_GENERATION_FAILED',
        message: error.message,
      });
    }
  })
);

export { router as invoicesRouter };
export default router;
