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
import {
  canAccessInvoice,
  canAccessProject,
  isUserAdmin
} from '../../utils/access-control.js';
import { InvoiceCreateData, InvoiceLineItem } from '../../services/invoice-service.js';
import type { InvoiceStatus } from '../../types/invoice-types.js';
import { emailService } from '../../services/email-service.js';
import { getDatabase } from '../../database/init.js';
import { getString } from '../../database/row-helpers.js';
import { generateInvoicePdf, InvoicePdfData } from './pdf.js';
import { getPdfCacheKey, getCachedPdf, cachePdf } from '../../utils/pdf-utils.js';
import { getInvoiceService, toSnakeCaseInvoice } from './helpers.js';
import {
  ErrorCodes,
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  sendPaginated,
  sanitizeErrorMessage,
  parsePaginationQuery
} from '../../utils/api-response.js';
import { sendPdfResponse } from '../../utils/pdf-generator.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { receiptService } from '../../services/receipt-service.js';
import { logger } from '../../services/logger.js';
import { validateRequest } from '../../middleware/validation.js';
import { getPortalUrl } from '../../config/environment.js';
import { BUSINESS_INFO } from '../../config/business.js';

const router = express.Router();

// Invoice validation schemas
const InvoiceValidationSchemas = {
  create: {
    projectId: [{ type: 'required' as const }, { type: 'number' as const, min: 1 }],
    clientId: [{ type: 'required' as const }, { type: 'number' as const, min: 1 }],
    lineItems: [
      { type: 'required' as const },
      {
        type: 'array' as const,
        minLength: 1,
        maxLength: 100,
        customValidator: (items: unknown) => {
          if (!Array.isArray(items)) return 'Line items must be an array';
          for (const item of items) {
            if (typeof item !== 'object' || item === null) return 'Each line item must be an object';
            const entry = item as Record<string, unknown>;
            if (!entry.description || typeof entry.description !== 'string') {
              return 'Each line item must have a description';
            }
            if (typeof entry.quantity !== 'number' || entry.quantity <= 0) {
              return 'Each line item must have a positive quantity';
            }
            if (typeof entry.rate !== 'number' || entry.rate < 0) {
              return 'Each line item must have a valid rate';
            }
          }
          return true;
        }
      }
    ],
    notes: { type: 'string' as const, maxLength: 2000 },
    terms: { type: 'string' as const, maxLength: 2000 },
    dueDate: { type: 'string' as const, maxLength: 20 },
    invoiceType: {
      type: 'string' as const,
      allowedValues: ['standard', 'deposit', 'recurring', 'credit']
    }
  },
  updateStatus: {
    status: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled']
      }
    ],
    paymentData: { type: 'object' as const }
  },
  recordPayment: {
    amountPaid: [{ type: 'required' as const }, { type: 'number' as const, min: 0.01 }],
    paymentMethod: [
      { type: 'required' as const },
      {
        type: 'string' as const,
        allowedValues: ['credit_card', 'bank_transfer', 'check', 'cash', 'stripe', 'other']
      }
    ],
    paymentReference: { type: 'string' as const, maxLength: 255 }
  }
};

/**
 * @swagger
 * /api/invoices:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: GET /api/invoices
 *     description: Admin invoice listing with optional filters.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { page, perPage, limit, offset } = parsePaginationQuery(
      req.query as Record<string, unknown>,
      { perPage: 100 }
    );

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
        const clientId = req.query.clientId
          ? parseInt(req.query.clientId as string, 10)
          : undefined;
        const projectId = req.query.projectId
          ? parseInt(req.query.projectId as string, 10)
          : undefined;
        const minAmount = req.query.minAmount
          ? parseFloat(req.query.minAmount as string)
          : undefined;
        const maxAmount = req.query.maxAmount
          ? parseFloat(req.query.maxAmount as string)
          : undefined;

        // Validate numeric filters
        if (
          (clientId !== undefined && isNaN(clientId)) ||
          (projectId !== undefined && isNaN(projectId)) ||
          (minAmount !== undefined && isNaN(minAmount)) ||
          (maxAmount !== undefined && isNaN(maxAmount))
        ) {
          return errorResponse(res, 'Invalid filter parameters', 400, ErrorCodes.VALIDATION_ERROR);
        }

        // Truncate search to prevent DoS
        const searchParam = req.query.search as string | undefined;
        const search = searchParam ? searchParam.substring(0, 200) : undefined;

        const filters: {
          clientId?: number;
          projectId?: number;
          status?: InvoiceStatus;
          invoiceType?: 'standard' | 'deposit';
          search?: string;
          dateFrom?: string;
          dateTo?: string;
          minAmount?: number;
          maxAmount?: number;
          limit: number;
          offset: number;
        } = {
          clientId,
          projectId,
          status: req.query.status as InvoiceStatus | undefined,
          invoiceType: req.query.invoiceType as 'standard' | 'deposit' | undefined,
          search,
          dateFrom: req.query.dateFrom as string | undefined,
          dateTo: req.query.dateTo as string | undefined,
          minAmount,
          maxAmount,
          limit,
          offset
        };

        const result = await getInvoiceService().searchInvoices(filters);
        return sendPaginated(res, result.invoices.map(toSnakeCaseInvoice), {
          page,
          perPage,
          total: result.total
        });
      }

      const invoices = await getInvoiceService().getAllInvoices(limit, offset);
      sendSuccess(res, { invoices: invoices.map(toSnakeCaseInvoice) });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve invoices', 500, ErrorCodes.RETRIEVAL_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to retrieve invoices')
      });
    }
  })
);

// ============================================
// DEVELOPMENT-ONLY TEST ENDPOINTS
// ============================================
// These endpoints are only available in development mode
// NOTE: Auth is still required even in dev to prevent accidental exposure
if (process.env.NODE_ENV === 'development') {
  router.get('/test', authenticateToken, (req: express.Request, res: express.Response) => {
    sendSuccess(res, { timestamp: new Date().toISOString() }, 'Invoice system is operational');
  });

  router.post(
    '/test-create',
    authenticateToken,
    requireAdmin,
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

        sendCreated(res, { invoice }, 'Test invoice created successfully');
      } catch (error: unknown) {
        errorResponseWithPayload(
          res,
          'Failed to create test invoice',
          500,
          ErrorCodes.TEST_CREATION_FAILED,
          { message: sanitizeErrorMessage(error, 'Failed to create test invoice') }
        );
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
      const invoiceId = parseInt(req.params.id, 10);

      if (isNaN(invoiceId) || invoiceId <= 0) {
        return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
      }

      try {
        const invoice = await getInvoiceService().getInvoiceById(invoiceId);
        sendSuccess(res, { invoice });
      } catch (error: unknown) {
        const rawMessage = error instanceof Error ? error.message : '';
        if (rawMessage.includes('not found')) {
          return errorResponse(res, 'Invoice not found', 404, ErrorCodes.NOT_FOUND);
        }
        errorResponseWithPayload(res, 'Failed to retrieve invoice', 500, ErrorCodes.RETRIEVAL_FAILED, {
          message: sanitizeErrorMessage(error, 'Failed to retrieve test invoice')
        });
      }
    })
  );
} // End development-only test endpoints

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
  // Validate and sanitize input
  validateRequest(InvoiceValidationSchemas.create),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceData: InvoiceCreateData = req.body;

    // Verify project exists and check authorization
    const db = getDatabase();
    const project = await db.get(
      'SELECT id, client_id FROM projects WHERE id = ? AND deleted_at IS NULL',
      [invoiceData.projectId]
    );
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Authorization check: verify user can access the project
    if (!(await canAccessProject(req, invoiceData.projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // For non-admins, verify clientId matches the project's actual client
    if (!(await isUserAdmin(req))) {
      const projectClientId = (project as { client_id: number }).client_id;
      if (projectClientId !== invoiceData.clientId) {
        return errorResponse(
          res,
          'Client ID must match the project owner',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
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
      return errorResponseWithPayload(res, 'Invalid line items', 400, ErrorCodes.INVALID_LINE_ITEMS, {
        message: 'Each line item must have description, quantity, rate, and amount'
      });
    }

    try {
      const invoice = await getInvoiceService().createInvoice(invoiceData);

      // Emit workflow event for invoice creation
      await workflowTriggerService.emit('invoice.created', {
        entityId: invoice.id,
        triggeredBy: req.user?.email || 'system',
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        amountTotal: invoice.amountTotal
      });

      sendCreated(res, { invoice }, 'Invoice created successfully');
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to create invoice', 500, ErrorCodes.CREATION_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to create invoice')
      });
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
  // Validate and sanitize input
  validateRequest(InvoiceValidationSchemas.create),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId, lineItems, notes, terms } = req.body;

    const db = getDatabase();

    // Get client info
    const client = await db.get(
      'SELECT contact_name, company_name, email, phone FROM clients WHERE id = ?',
      [clientId]
    );

    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.CLIENT_NOT_FOUND);
    }

    // Get project info
    const project = await db.get('SELECT project_name FROM projects WHERE id = ?', [projectId]);

    // Calculate totals
    const subtotal = lineItems.reduce(
      (sum: number, item: InvoiceLineItem) => sum + (item.amount || 0),
      0
    );

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
        details: project ? [`Project: ${getString(project, 'project_name')}`] : undefined
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
    type SearchInvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';
    const validStatuses: SearchInvoiceStatus[] = [
      'draft',
      'sent',
      'viewed',
      'partial',
      'paid',
      'overdue',
      'cancelled'
    ];

    // Parse status - can be single value or comma-separated
    let status: SearchInvoiceStatus | SearchInvoiceStatus[] | undefined;
    if (req.query.status) {
      const statusStr = req.query.status as string;
      if (statusStr.includes(',')) {
        const statuses = statusStr
          .split(',')
          .filter((s) => validStatuses.includes(s as SearchInvoiceStatus)) as SearchInvoiceStatus[];
        status = statuses.length > 0 ? statuses : undefined;
      } else if (validStatuses.includes(statusStr as SearchInvoiceStatus)) {
        status = statusStr as SearchInvoiceStatus;
      }
    }

    // Truncate search to prevent DoS
    const searchParam = req.query.search as string | undefined;
    const search = searchParam ? searchParam.substring(0, 200) : undefined;

    const { page, perPage, limit, offset } = parsePaginationQuery(
      req.query as Record<string, unknown>
    );

    const filters = {
      clientId: req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined,
      projectId: req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined,
      status,
      invoiceType: req.query.invoiceType as 'standard' | 'deposit' | undefined,
      search,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      dueDateFrom: req.query.dueDateFrom as string | undefined,
      dueDateTo: req.query.dueDateTo as string | undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined,
      limit,
      offset
    };

    try {
      const result = await getInvoiceService().searchInvoices(filters);

      sendPaginated(res, result.invoices.map(toSnakeCaseInvoice), {
        page,
        perPage,
        total: result.total
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to search invoices', 500, ErrorCodes.SEARCH_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to search invoices')
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
    const clientId = parseInt(req.params.clientId, 10);

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const invoices = await getInvoiceService().getClientInvoices(clientId);
      const transformedInvoices = invoices.map(toSnakeCaseInvoice);
      sendSuccess(res, {
        invoices: transformedInvoices,
        count: invoices.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve client invoices', 500, ErrorCodes.RETRIEVAL_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to retrieve client invoices')
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
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const invoices = await getInvoiceService().getProjectInvoices(projectId);
      const transformedInvoices = invoices.map(toSnakeCaseInvoice);
      sendSuccess(res, {
        invoices: transformedInvoices,
        count: invoices.length
      });
    } catch (error: unknown) {
      errorResponseWithPayload(
        res,
        'Failed to retrieve project invoices',
        500,
        ErrorCodes.RETRIEVAL_FAILED,
        {
          message: sanitizeErrorMessage(error, 'Failed to retrieve project invoices')
        }
      );
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
    const invoiceId = parseInt(req.params.id, 10);

    if (isNaN(invoiceId) || invoiceId <= 0) {
      return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const invoice = await getInvoiceService().getInvoiceById(invoiceId);

      if (!(await canAccessInvoice(req, invoiceId))) {
        return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
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
          return new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const pdfData: InvoicePdfData = {
        invoiceNumber: invoice.invoiceNumber,
        issuedDate: formatDate(invoice.issuedDate || invoice.createdAt),
        dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : undefined,
        clientName:
          invoice.clientName || (clientRow ? getString(clientRow, 'contact_name') : '') || 'Client',
        clientCompany: clientRow ? getString(clientRow, 'company_name') : undefined,
        clientEmail: invoice.clientEmail || (clientRow ? getString(clientRow, 'email') : '') || '',
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
      const rawMessage = error instanceof Error ? error.message : '';
      if (rawMessage.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, ErrorCodes.NOT_FOUND);
      }
      errorResponseWithPayload(res, 'Failed to generate invoice PDF', 500, ErrorCodes.PDF_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to generate invoice PDF')
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
  requireAdmin,
  // Validate and sanitize input
  validateRequest(InvoiceValidationSchemas.updateStatus),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id, 10);
    const { status, paymentData } = req.body;

    if (isNaN(invoiceId) || invoiceId <= 0) {
      return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const invoice = await getInvoiceService().updateInvoiceStatus(invoiceId, status, paymentData);
      sendSuccess(res, { invoice }, 'Invoice status updated successfully');
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      if (rawMessage.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, ErrorCodes.NOT_FOUND);
      }
      errorResponseWithPayload(res, 'Failed to update invoice status', 500, ErrorCodes.UPDATE_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to update invoice status')
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
    const invoiceId = parseInt(req.params.id, 10);

    if (isNaN(invoiceId) || invoiceId <= 0) {
      return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      const invoice = await getInvoiceService().sendInvoice(invoiceId);

      // Schedule payment reminders
      try {
        await getInvoiceService().scheduleReminders(invoiceId);
        logger.info(`[Invoices] Scheduled reminders for invoice #${invoiceId}`);
      } catch (reminderError) {
        logger.error('[Invoices] Failed to schedule reminders:', {
          error: reminderError instanceof Error ? reminderError : undefined
        });
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

        const invoiceUrl = `${getPortalUrl()}?invoice=${invoiceId}`;

        // Send invoice email
        await emailService.sendEmail({
          to: clientEmail,
          subject: `Invoice #${invoice.invoiceNumber} from ${BUSINESS_INFO.name}`,
          text: `
            Hi ${client.name},

            Your invoice #${invoice.invoiceNumber} is now available.

            Amount Due: $${invoice.amountTotal}
            Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon receipt'}

            View and pay your invoice here:
            ${invoiceUrl}

            If you have any questions, please don't hesitate to contact us.

            Best regards,
            ${BUSINESS_INFO.name} Team
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
                <p>Best regards,<br>${BUSINESS_INFO.name} Team</p>
              </div>
            </body>
            </html>
          `
        });

        logger.info(`Invoice email sent to ${client.email} for invoice #${invoiceId}`);
      } catch (emailError) {
        logger.error('Failed to send invoice email:', {
          error: emailError instanceof Error ? emailError : undefined
        });
        // Don't fail the request if email fails
      }

      // Emit workflow event for invoice sent
      await workflowTriggerService.emit('invoice.sent', {
        entityId: invoiceId,
        triggeredBy: req.user?.email || 'system',
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        amountTotal: invoice.amountTotal
      });

      sendSuccess(res, { invoice }, 'Invoice sent successfully');
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      if (rawMessage.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, ErrorCodes.NOT_FOUND);
      }
      errorResponseWithPayload(res, 'Failed to send invoice', 500, ErrorCodes.SEND_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to send invoice')
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
  // Validate and sanitize input
  validateRequest(InvoiceValidationSchemas.recordPayment),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const invoiceId = parseInt(req.params.id, 10);
    const { amountPaid, paymentMethod, paymentReference } = req.body;

    if (isNaN(invoiceId) || invoiceId <= 0) {
      return errorResponse(res, 'Invalid invoice ID', 400, ErrorCodes.INVALID_ID);
    }

    try {
      // Verify invoice exists and user has access
      await getInvoiceService().getInvoiceById(invoiceId);
      if (!(await canAccessInvoice(req, invoiceId))) {
        return errorResponse(res, 'Invoice not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      const invoice = await getInvoiceService().markInvoiceAsPaid(invoiceId, {
        amountPaid: parseFloat(amountPaid),
        paymentMethod,
        paymentReference
      });

      // Auto-generate receipt for the payment
      let receipt = null;
      try {
        receipt = await receiptService.createReceipt(
          invoiceId,
          null, // payment_id - not tracked separately for full payments
          parseFloat(amountPaid),
          {
            paymentMethod,
            paymentReference
          }
        );
        logger.info(
          `[Invoices] Receipt ${receipt.receiptNumber} generated for invoice ${invoice.invoiceNumber}`
        );
      } catch (receiptError) {
        logger.error('[Invoices] Failed to generate receipt:', {
          error: receiptError instanceof Error ? receiptError : undefined
        });
        // Don't fail the payment if receipt generation fails
      }

      // Emit workflow event for invoice paid
      await workflowTriggerService.emit('invoice.paid', {
        entityId: invoiceId,
        triggeredBy: req.user?.email || 'system',
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        amountPaid: parseFloat(amountPaid),
        paymentMethod
      });

      sendSuccess(
        res,
        {
          invoice,
          receipt: receipt
            ? {
              id: receipt.id,
              receipt_number: receipt.receiptNumber,
              amount: receipt.amount
            }
            : null
        },
        'Invoice marked as paid'
      );
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : '';
      if (rawMessage.includes('not found')) {
        return errorResponse(res, 'Invoice not found', 404, ErrorCodes.NOT_FOUND);
      }
      errorResponseWithPayload(res, 'Failed to process payment', 500, ErrorCodes.PAYMENT_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to process invoice payment')
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
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;

    try {
      const stats = await getInvoiceService().getInvoiceStats(clientId);
      sendSuccess(res, { stats });
    } catch (error: unknown) {
      errorResponseWithPayload(res, 'Failed to retrieve invoice statistics', 500, ErrorCodes.STATS_FAILED, {
        message: sanitizeErrorMessage(error, 'Failed to retrieve invoice statistics')
      });
    }
  })
);

export { router as coreRouter };
export default router;
