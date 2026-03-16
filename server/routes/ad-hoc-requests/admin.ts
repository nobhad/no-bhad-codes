/**
 * ===============================================
 * AD HOC REQUESTS — ADMIN ROUTES
 * ===============================================
 * Admin-facing endpoints: CRUD, time tracking,
 * invoicing, quote sending, task conversion, bulk ops.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  adHocRequestService,
  type AdHocRequestStatus,
  type AdHocRequestType,
  type AdHocRequestPriority,
  type AdHocRequestUrgency
} from '../../services/ad-hoc-request-service.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { projectService } from '../../services/project-service.js';
import type { InvoiceLineItem } from '../../services/invoice-service.js';
import {
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  ErrorCodes
} from '../../utils/api-response.js';
import { getBaseUrl } from '../../config/environment.js';
import { validateRequest } from '../../middleware/validation.js';
import { invalidateCache } from '../../middleware/cache.js';
import { logger } from '../../services/logger.js';
import {
  AdHocValidationSchemas,
  getInvoiceService,
  mapTaskPriority,
  buildTaskDescription,
  buildAdHocLineItem,
  getAdHocTimeSummary
} from './shared.js';

const router = express.Router();

/**
 * @swagger
 * /api/ad-hoc-requests:
 *   get:
 *     tags: [Ad-hoc Requests]
 *     summary: Get all ad hoc requests (admin)
 *     description: Returns all ad hoc requests with optional filtering.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *       - in: query
 *         name: urgency
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all ad hoc requests
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const status = req.query.status as string | undefined;
    const requestType = req.query.requestType as string | undefined;
    const priority = req.query.priority as string | undefined;
    const urgency = req.query.urgency as string | undefined;

    if (status && !adHocRequestService.isValidStatus(status)) {
      return errorResponse(res, 'Invalid request status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (requestType && !adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const requests = await adHocRequestService.getRequests({
      projectId,
      clientId,
      status: status as AdHocRequestStatus,
      requestType: requestType as AdHocRequestType,
      priority: priority as AdHocRequestPriority,
      urgency: urgency as AdHocRequestUrgency
    });

    sendSuccess(res, { requests });
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}/time-entries:
 *   get:
 *     tags: [Ad-hoc Requests]
 *     summary: Get time entries for a request (admin)
 *     description: Returns time entries linked to an ad hoc request task.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of time entries
 */
router.get(
  '/:requestId/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);
    if (!request.taskId) {
      return sendSuccess(res, { entries: [] });
    }

    const entries = await projectService.getTimeEntries(request.projectId, {
      taskId: request.taskId
    });
    sendSuccess(res, { entries });
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}/time-entries:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Log time for a request (admin)
 *     description: Logs a time entry for an ad hoc request task.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userName, hours, date]
 *             properties:
 *               userName:
 *                 type: string
 *               hours:
 *                 type: number
 *               date:
 *                 type: string
 *               description:
 *                 type: string
 *               billable:
 *                 type: boolean
 *               hourlyRate:
 *                 type: number
 *     responses:
 *       201:
 *         description: Time logged
 *       400:
 *         description: Request not linked to task
 */
router.post(
  '/:requestId/time-entries',
  authenticateToken,
  requireAdmin,
  validateRequest(AdHocValidationSchemas.logTime, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);
    if (!request.taskId) {
      return errorResponse(res, 'Request is not linked to a task yet', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { userName, hours, date, description, billable, hourlyRate } = req.body;
    if (!userName || !hours || !date) {
      return errorResponse(res, 'userName, hours, and date are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const entry = await projectService.logTime(request.projectId, {
      taskId: request.taskId,
      userName,
      hours,
      date,
      description,
      billable: billable !== false,
      hourlyRate: hourlyRate ?? request.hourlyRate ?? undefined
    });

    sendCreated(res, { entry }, 'Time logged');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}:
 *   get:
 *     tags: [Ad-hoc Requests]
 *     summary: Get a single ad hoc request (admin)
 *     description: Returns details of a specific ad hoc request.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Request details
 */
router.get(
  '/:requestId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    const request = await adHocRequestService.getRequest(requestId);
    sendSuccess(res, { request });
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Create ad hoc request (admin)
 *     description: Admin creates a new ad hoc request with full details.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, clientId, title, description, requestType]
 *             properties:
 *               projectId:
 *                 type: integer
 *               clientId:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               requestType:
 *                 type: string
 *               status:
 *                 type: string
 *               priority:
 *                 type: string
 *               urgency:
 *                 type: string
 *               estimatedHours:
 *                 type: number
 *               flatRate:
 *                 type: number
 *               hourlyRate:
 *                 type: number
 *               quotedPrice:
 *                 type: number
 *     responses:
 *       201:
 *         description: Ad hoc request created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(AdHocValidationSchemas.adminCreate, { allowUnknownFields: true }),
  invalidateCache(['ad-hoc-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      projectId,
      clientId,
      title,
      description,
      status,
      requestType,
      priority,
      urgency,
      estimatedHours,
      flatRate,
      hourlyRate,
      quotedPrice,
      attachmentFileId
    } = req.body;

    if (!projectId || !clientId || !title || !description || !requestType) {
      return errorResponse(
        res,
        'projectId, clientId, title, description, and requestType are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (status && !adHocRequestService.isValidStatus(status)) {
      return errorResponse(res, 'Invalid request status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (attachmentFileId && projectId) {
      const isValid = await adHocRequestService.verifyAttachmentForProject(
        Number(attachmentFileId),
        Number(projectId)
      );
      if (!isValid) {
        return errorResponse(
          res,
          'Attachment must belong to the selected project',
          400,
          'VALIDATION_ERROR'
        );
      }
    }

    const request = await adHocRequestService.createRequest({
      projectId: Number(projectId),
      clientId: Number(clientId),
      title,
      description,
      status,
      requestType,
      priority,
      urgency,
      estimatedHours,
      flatRate,
      hourlyRate,
      quotedPrice,
      attachmentFileId: attachmentFileId ? Number(attachmentFileId) : null
    });

    sendCreated(res, { request }, 'Ad hoc request created');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}:
 *   put:
 *     tags: [Ad-hoc Requests]
 *     summary: Update ad hoc request (admin)
 *     description: Updates an ad hoc request. Auto-creates invoice when completing.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ad hoc request updated
 */
router.put(
  '/:requestId',
  authenticateToken,
  requireAdmin,
  validateRequest(AdHocValidationSchemas.adminUpdate, { allowUnknownFields: true }),
  invalidateCache(['ad-hoc-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    const {
      status,
      requestType,
      priority,
      urgency,
      autoCreateInvoice = true // Default to auto-create invoice on completion
    } = req.body;

    if (status && !adHocRequestService.isValidStatus(status)) {
      return errorResponse(res, 'Invalid request status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (requestType && !adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Get current request to check for status transition
    const currentRequest = await adHocRequestService.getRequest(requestId);
    const isCompletingRequest = status === 'completed' && currentRequest.status !== 'completed';

    const request = await adHocRequestService.updateRequest(requestId, req.body);

    // Auto-create invoice when status changes to completed
    let autoInvoice = null;
    if (isCompletingRequest && autoCreateInvoice) {
      try {
        // Check if request has pricing data
        const hasPricingData =
          request.quotedPrice !== null ||
          request.flatRate !== null ||
          (request.estimatedHours !== null && request.hourlyRate !== null) ||
          request.taskId; // Has time entries via linked task

        if (hasPricingData) {
          const summary = await getAdHocTimeSummary(request);
          const lineItem = buildAdHocLineItem(request, {
            useTimeEntries: !!request.taskId,
            totalHours: summary.totalHours,
            totalAmount: summary.totalAmount
          });

          autoInvoice = await getInvoiceService().createInvoice({
            projectId: request.projectId,
            clientId: request.clientId,
            lineItems: [lineItem],
            notes: `Ad Hoc Work - Request #${request.id}: ${request.title}\n\n${request.description}`
          });

          await adHocRequestService.linkRequestInvoice(request.id!, autoInvoice.id!, lineItem.amount);
        }
      } catch (invoiceError) {
        // Log error but don't fail the request update
        await logger.error('[AdHocRequests] Auto-invoice creation failed:', {
          error: invoiceError instanceof Error ? invoiceError : undefined,
          category: 'AD_HOC'
        });
      }
    }

    const message = autoInvoice
      ? 'Ad hoc request completed and invoice created'
      : 'Ad hoc request updated';
    const data = autoInvoice ? { request, invoice: autoInvoice } : { request };
    sendSuccess(res, data, message);
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}/send-quote:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Send quote to client (admin)
 *     description: Sends the ad hoc request quote to the client via email.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Quote sent
 *       400:
 *         description: No quote details or client email
 */
router.post(
  '/:requestId/send-quote',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);

    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (!request.clientEmail) {
      return errorResponse(res, 'Client email not found', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const hasQuoteDetails =
      request.quotedPrice !== null ||
      request.flatRate !== null ||
      (request.estimatedHours !== null && request.hourlyRate !== null);

    if (!hasQuoteDetails) {
      return errorResponse(
        res,
        'Quote details are required before sending',
        400,
        'VALIDATION_ERROR'
      );
    }

    const formatCurrency = (value: number | null): string =>
      value === null ? '—' : `$${value.toFixed(2)}`;

    const estimatedTotal =
      request.quotedPrice ??
      request.flatRate ??
      (request.estimatedHours !== null && request.hourlyRate !== null
        ? request.estimatedHours * request.hourlyRate
        : null);

    const clientName = request.clientName || 'there';
    const projectName = request.projectName || 'your project';
    const baseUrl = getBaseUrl();
    const portalUrl = `${baseUrl}/client/portal`;

    const { emailService: emailSvc } = await import('../../services/email-service.js');
    await emailSvc.sendEmail({
      to: request.clientEmail,
      subject: `Quote Ready - ${projectName}`,
      text: `Hi ${clientName},

Your ad hoc request "${request.title}" has been reviewed and a quote is ready.

Quote summary:
- Estimated hours: ${request.estimatedHours ?? '—'}
- Hourly rate: ${formatCurrency(request.hourlyRate)}
- Flat rate: ${formatCurrency(request.flatRate)}
- Quoted total: ${formatCurrency(request.quotedPrice)}
- Estimated total: ${formatCurrency(estimatedTotal)}

You can review the request in your client portal:
${portalUrl}

If you'd like to approve this quote or have questions, just reply to this email.

Thanks,
${BUSINESS_INFO.name}
${BUSINESS_INFO.email}`.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 24px; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 8px; }
    .quote-row { margin: 6px 0; }
    .btn { display: inline-block; padding: 12px 20px; background: #00aff0; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${BUSINESS_INFO.name}</h2>
    </div>
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>Your ad hoc request <strong>"${request.title}"</strong> has been reviewed and a quote is ready.</p>
      <div class="quote-row">Estimated hours: <strong>${request.estimatedHours ?? '—'}</strong></div>
      <div class="quote-row">Hourly rate: <strong>${formatCurrency(request.hourlyRate)}</strong></div>
      <div class="quote-row">Flat rate: <strong>${formatCurrency(request.flatRate)}</strong></div>
      <div class="quote-row">Quoted total: <strong>${formatCurrency(request.quotedPrice)}</strong></div>
      <div class="quote-row">Estimated total: <strong>${formatCurrency(estimatedTotal)}</strong></div>
      <p style="margin-top: 20px;">
        <a href="${portalUrl}" class="btn">View in Portal</a>
      </p>
      <p>If you'd like to approve this quote or have questions, just reply to this email.</p>
    </div>
    <div style="text-align:center; margin-top: 20px; color:#666; font-size: 14px;">
      <p>${BUSINESS_INFO.name} · ${BUSINESS_INFO.email}</p>
    </div>
  </div>
</body>
</html>`.trim()
    });

    const updatedRequest =
      request.status === 'quoted'
        ? request
        : await adHocRequestService.updateRequest(requestId, { status: 'quoted' });

    sendSuccess(res, { request: updatedRequest }, 'Quote sent');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}/invoice:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Generate invoice from request (admin)
 *     description: Creates an invoice from a completed ad hoc request.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               useTimeEntries:
 *                 type: boolean
 *                 default: true
 *               dueDate:
 *                 type: string
 *               notes:
 *                 type: string
 *               terms:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invoice created
 *       400:
 *         description: Request must be completed
 */
router.post(
  '/:requestId/invoice',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);
    if (request.status !== 'completed') {
      return errorResponse(
        res,
        'Request must be completed before generating an invoice',
        400,
        'VALIDATION_ERROR'
      );
    }

    const { useTimeEntries = true, dueDate, notes, terms } = req.body || {};
    const summary = useTimeEntries
      ? await getAdHocTimeSummary(request)
      : { totalHours: null, totalAmount: null };
    const lineItem = buildAdHocLineItem(request, {
      useTimeEntries,
      totalHours: summary.totalHours,
      totalAmount: summary.totalAmount
    });

    const invoice = await getInvoiceService().createInvoice({
      projectId: request.projectId,
      clientId: request.clientId,
      lineItems: [lineItem],
      notes:
        notes || `Ad Hoc Work - Request #${request.id}: ${request.title}\n\n${request.description}`,
      terms: terms || undefined,
      dueDate: dueDate || undefined
    });

    await adHocRequestService.linkRequestInvoice(request.id!, invoice.id!, lineItem.amount);

    sendCreated(res, { invoice, lineItem }, 'Invoice created');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/invoice/bundle:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Bundle requests into invoice (admin)
 *     description: Bundles multiple completed ad hoc requests into a single invoice.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestIds]
 *             properties:
 *               requestIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               useTimeEntries:
 *                 type: boolean
 *                 default: true
 *               dueDate:
 *                 type: string
 *               notes:
 *                 type: string
 *               terms:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bundled invoice created
 *       400:
 *         description: All requests must be same project/client and completed
 */
router.post(
  '/invoice/bundle',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestIds, useTimeEntries = true, dueDate, notes, terms } = req.body || {};

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return errorResponse(res, 'requestIds is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const requests = await Promise.all(
      requestIds.map((id: number) => adHocRequestService.getRequest(Number(id)))
    );

    const [first] = requests;
    const sameProject = requests.every((r) => r.projectId === first.projectId);
    const sameClient = requests.every((r) => r.clientId === first.clientId);

    if (!sameProject || !sameClient) {
      return errorResponse(
        res,
        'All requests must belong to the same project and client',
        400,
        'VALIDATION_ERROR'
      );
    }

    const incomplete = requests.find((r) => r.status !== 'completed');
    if (incomplete) {
      return errorResponse(
        res,
        `Request ${incomplete.id} must be completed before invoicing`,
        400,
        'VALIDATION_ERROR'
      );
    }

    const lineItems: InvoiceLineItem[] = [];
    for (const reqItem of requests) {
      const summary = useTimeEntries
        ? await getAdHocTimeSummary(reqItem)
        : { totalHours: null, totalAmount: null };
      lineItems.push(
        buildAdHocLineItem(reqItem, {
          useTimeEntries,
          totalHours: summary.totalHours,
          totalAmount: summary.totalAmount
        })
      );
    }

    const invoice = await getInvoiceService().createInvoice({
      projectId: first.projectId,
      clientId: first.clientId,
      lineItems,
      notes:
        notes ||
        `Ad Hoc Work (Bundle) - Requests bundled: ${requests.map((r) => `#${r.id}`).join(', ')}`,
      terms: terms || undefined,
      dueDate: dueDate || undefined
    });

    for (let i = 0; i < requests.length; i += 1) {
      await adHocRequestService.linkRequestInvoice(requests[i].id!, invoice.id!, lineItems[i].amount);
    }

    sendCreated(res, { invoice, lineItems }, 'Invoice created');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/summary/monthly:
 *   get:
 *     tags: [Ad-hoc Requests]
 *     summary: Get monthly ad hoc summary (admin)
 *     description: Returns monthly ad hoc request invoicing summary grouped by client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Monthly summary data
 */
router.get(
  '/summary/monthly',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const months = req.query.months ? Number(req.query.months) : 6;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;

    const rows = await adHocRequestService.getMonthlySummary({ months, clientId });

    sendSuccess(res, { summary: rows });
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}/convert-to-task:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Convert request to task (admin)
 *     description: Converts an approved ad hoc request into project task(s).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               milestoneId:
 *                 type: integer
 *               assignedTo:
 *                 type: string
 *               dueDate:
 *                 type: string
 *               priority:
 *                 type: string
 *               subtasks:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Request converted to task
 *       400:
 *         description: Request must be approved
 *       409:
 *         description: Already converted
 */
router.post(
  '/:requestId/convert-to-task',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);

    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (request.status !== 'approved') {
      return errorResponse(
        res,
        'Request must be approved before converting to a task',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (request.taskId) {
      return errorResponseWithPayload(
        res,
        'Request already converted to a task',
        409,
        'DUPLICATE_RESOURCE',
        { taskId: request.taskId }
      );
    }

    const { title, description, milestoneId, assignedTo, dueDate, priority, subtasks } =
      req.body || {};

    const task = await projectService.createTask(request.projectId, {
      title: title || request.title,
      description: description || buildTaskDescription(request),
      milestoneId: milestoneId ? Number(milestoneId) : undefined,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      estimatedHours: request.estimatedHours ?? undefined,
      priority: priority ? mapTaskPriority(priority) : mapTaskPriority(request.priority)
    });

    const createdSubtasks = Array.isArray(subtasks)
      ? await Promise.all(
        subtasks
          .filter((item) => item && typeof item.title === 'string' && item.title.trim())
          .map((item) =>
            projectService.createTask(request.projectId, {
              title: item.title,
              description: item.description || undefined,
              milestoneId: milestoneId ? Number(milestoneId) : undefined,
              assignedTo: item.assignedTo || assignedTo || undefined,
              dueDate: item.dueDate || dueDate || undefined,
              estimatedHours: item.estimatedHours ?? undefined,
              priority: mapTaskPriority(item.priority || priority || request.priority),
              parentTaskId: task.id
            })
          )
      )
      : [];

    const updatedRequest = await adHocRequestService.updateRequest(requestId, {
      status: 'in_progress',
      taskId: task.id,
      convertedAt: new Date().toISOString(),
      convertedBy: req.user?.email || String(req.user?.id || 'admin')
    });

    sendCreated(
      res,
      { task, subtasks: createdSubtasks, request: updatedRequest },
      'Request converted to task'
    );
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/bulk-delete:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Bulk delete requests (admin)
 *     description: Soft-deletes multiple ad hoc requests at once.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requestIds]
 *             properties:
 *               requestIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Requests deleted
 */
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  invalidateCache(['ad-hoc-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestIds } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return errorResponse(res, 'requestIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const deletedBy = req.user?.email || String(req.user?.id || 'system');
    let deleted = 0;

    for (const requestId of requestIds) {
      const id = typeof requestId === 'string' ? parseInt(requestId, 10) : requestId;
      if (isNaN(id) || id <= 0) continue;

      try {
        await adHocRequestService.softDeleteRequest(id, deletedBy);
        deleted++;
      } catch {
        // Skip requests that don't exist or can't be deleted
      }
    }

    sendSuccess(res, { deleted }, `${deleted} request(s) deleted`);
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/{requestId}:
 *   delete:
 *     tags: [Ad-hoc Requests]
 *     summary: Delete ad hoc request (admin)
 *     description: Soft-deletes an ad hoc request.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ad hoc request deleted
 */
router.delete(
  '/:requestId',
  authenticateToken,
  requireAdmin,
  invalidateCache(['ad-hoc-requests']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    const deletedBy = req.user?.email || String(req.user?.id || 'system');
    await adHocRequestService.softDeleteRequest(requestId, deletedBy);
    sendSuccess(res, undefined, 'Ad hoc request deleted');
  })
);

export default router;
