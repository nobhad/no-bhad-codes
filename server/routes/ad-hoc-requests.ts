/**
 * ===============================================
 * AD HOC REQUEST ROUTES
 * ===============================================
 * @file server/routes/ad-hoc-requests.ts
 *
 * API endpoints for ad hoc requests.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';
import { adHocRequestService, type AdHocRequest } from '../services/ad-hoc-request-service.js';
import { BUSINESS_INFO } from '../config/business.js';
import { projectService } from '../services/project-service.js';
import { InvoiceService, type InvoiceLineItem } from '../services/invoice-service.js';
import { errorResponse, errorResponseWithPayload } from '../utils/api-response.js';

const router = express.Router();

function getInvoiceService() {
  return InvoiceService.getInstance();
}

function mapTaskPriority(priority?: string | null): 'low' | 'medium' | 'high' | 'urgent' {
  switch (priority) {
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    case 'urgent':
      return 'urgent';
    default:
      return 'medium';
  }
}

function buildTaskDescription(request: AdHocRequest): string {
  const summaryParts = [
    `Ad hoc request #${request.id}`,
    `Type: ${request.requestType}`,
    `Priority: ${request.priority}`,
    `Urgency: ${request.urgency}`
  ];

  const quoteParts: string[] = [];
  if (request.estimatedHours !== null) quoteParts.push(`Estimated hours: ${request.estimatedHours}`);
  if (request.hourlyRate !== null) quoteParts.push(`Hourly rate: $${request.hourlyRate.toFixed(2)}`);
  if (request.flatRate !== null) quoteParts.push(`Flat rate: $${request.flatRate.toFixed(2)}`);
  if (request.quotedPrice !== null) quoteParts.push(`Quoted total: $${request.quotedPrice.toFixed(2)}`);

  return [
    request.description,
    '',
    summaryParts.join(' | '),
    quoteParts.length ? `Quote: ${quoteParts.join(' | ')}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`;
}

function buildAdHocLineItem(request: AdHocRequest, data: {
  useTimeEntries: boolean;
  totalHours?: number | null;
  totalAmount?: number | null;
}): InvoiceLineItem {
  if (data.useTimeEntries && data.totalHours && data.totalAmount !== null && data.totalAmount !== undefined) {
    const rate = data.totalHours > 0 ? data.totalAmount / data.totalHours : 0;
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: Number(data.totalHours.toFixed(2)),
      rate: Number(rate.toFixed(2)),
      amount: Number(data.totalAmount.toFixed(2))
    };
  }

  if (request.quotedPrice !== null) {
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: 1,
      rate: Number(request.quotedPrice.toFixed(2)),
      amount: Number(request.quotedPrice.toFixed(2))
    };
  }

  if (request.flatRate !== null) {
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: 1,
      rate: Number(request.flatRate.toFixed(2)),
      amount: Number(request.flatRate.toFixed(2))
    };
  }

  if (request.estimatedHours !== null && request.hourlyRate !== null) {
    const amount = request.estimatedHours * request.hourlyRate;
    return {
      description: `Ad hoc request #${request.id}: ${request.title}`,
      quantity: Number(request.estimatedHours.toFixed(2)),
      rate: Number(request.hourlyRate.toFixed(2)),
      amount: Number(amount.toFixed(2))
    };
  }

  throw new Error('No pricing data available to create invoice line item');
}

async function getAdHocTimeSummary(request: AdHocRequest): Promise<{ totalHours: number; totalAmount: number }> {
  if (!request.taskId) {
    return { totalHours: 0, totalAmount: 0 };
  }

  const entries = await projectService.getTimeEntries(request.projectId, { taskId: request.taskId });
  const billableEntries = entries.filter((entry) => entry.billable);

  const totalHours = billableEntries.reduce((sum, entry) => sum + entry.hours, 0);
  const totalAmount = billableEntries.reduce((sum, entry) => {
    if (entry.hourlyRate) {
      return sum + entry.hours * entry.hourlyRate;
    }
    if (request.hourlyRate) {
      return sum + entry.hours * request.hourlyRate;
    }
    return sum;
  }, 0);

  return { totalHours, totalAmount };
}

// ===================================
// AD HOC REQUEST ENDPOINTS
// ===================================

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

// Get ad hoc requests for the authenticated client
router.get(
  '/my-requests',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const status = req.query.status as string | undefined;
    const requestType = req.query.requestType as string | undefined;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    if (status && !adHocRequestService.isValidStatus(status)) {
      return errorResponse(res, 'Invalid request status', 400, 'VALIDATION_ERROR');
    }

    if (requestType && !adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, 'VALIDATION_ERROR');
    }

    const requests = await adHocRequestService.getRequests({
      clientId,
      status: status as any,
      requestType: requestType as any
    });

    res.json({ success: true, requests });
  })
);

// Submit ad hoc request (client)
router.post(
  '/my-requests',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const {
      projectId,
      title,
      description,
      requestType,
      priority,
      urgency,
      attachmentFileId
    } = req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    if (!projectId || !title || !description || !requestType) {
      return errorResponse(
        res,
        'projectId, title, description, and requestType are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (!adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, 'VALIDATION_ERROR');
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, 'VALIDATION_ERROR');
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();
    const project = await db.get(
      'SELECT id FROM projects WHERE id = ? AND client_id = ? AND deleted_at IS NULL',
      [Number(projectId), clientId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found for this client', 403, 'ACCESS_DENIED');
    }

    if (attachmentFileId) {
      const attachment = await db.get(
        'SELECT id FROM files WHERE id = ? AND project_id = ?',
        [Number(attachmentFileId), Number(projectId)]
      );
      if (!attachment) {
        return errorResponse(res, 'Attachment must belong to the selected project', 400, 'VALIDATION_ERROR');
      }
    }

    const request = await adHocRequestService.createRequest({
      projectId: Number(projectId),
      clientId,
      title,
      description,
      requestType,
      priority,
      urgency,
      status: 'submitted',
      attachmentFileId: attachmentFileId ? Number(attachmentFileId) : null
    });

    res.status(201).json({ success: true, message: 'Request submitted', request });
  })
);

// Approve ad hoc request quote (client)
router.post(
  '/my-requests/:requestId/approve',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const requestId = Number(req.params.requestId);

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (request.clientId !== clientId) {
      return errorResponse(res, 'Request not found for this client', 403, 'ACCESS_DENIED');
    }

    if (request.status !== 'quoted') {
      return errorResponse(res, 'Quote is not available for approval', 400, 'VALIDATION_ERROR');
    }

    const updatedRequest = await adHocRequestService.updateRequest(requestId, { status: 'approved' });
    res.json({ success: true, message: 'Quote approved', request: updatedRequest });
  })
);

// Decline ad hoc request quote (client)
router.post(
  '/my-requests/:requestId/decline',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const requestId = Number(req.params.requestId);

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, 'UNAUTHORIZED');
    }

    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (request.clientId !== clientId) {
      return errorResponse(res, 'Request not found for this client', 403, 'ACCESS_DENIED');
    }

    if (request.status !== 'quoted') {
      return errorResponse(res, 'Quote is not available for decline', 400, 'VALIDATION_ERROR');
    }

    const updatedRequest = await adHocRequestService.updateRequest(requestId, { status: 'declined' });
    res.json({ success: true, message: 'Quote declined', request: updatedRequest });
  })
);

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

// Get all ad hoc requests
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
      return errorResponse(res, 'Invalid request status', 400, 'VALIDATION_ERROR');
    }

    if (requestType && !adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, 'VALIDATION_ERROR');
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, 'VALIDATION_ERROR');
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, 'VALIDATION_ERROR');
    }

    const requests = await adHocRequestService.getRequests({
      projectId,
      clientId,
      status: status as any,
      requestType: requestType as any,
      priority: priority as any,
      urgency: urgency as any
    });

    res.json({ success: true, requests });
  })
);

// Get time entries for an ad hoc request
router.get(
  '/:requestId/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);
    if (!request.taskId) {
      return res.json({ success: true, entries: [] });
    }

    const entries = await projectService.getTimeEntries(request.projectId, { taskId: request.taskId });
    res.json({ success: true, entries });
  })
);

// Log time for an ad hoc request
router.post(
  '/:requestId/time-entries',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);
    if (!request.taskId) {
      return errorResponse(res, 'Request is not linked to a task yet', 400, 'VALIDATION_ERROR');
    }

    const { userName, hours, date, description, billable, hourlyRate } = req.body;
    if (!userName || !hours || !date) {
      return errorResponse(res, 'userName, hours, and date are required', 400, 'VALIDATION_ERROR');
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

    res.status(201).json({ success: true, message: 'Time logged', entry });
  })
);

// Get single ad hoc request
router.get(
  '/:requestId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    const request = await adHocRequestService.getRequest(requestId);
    res.json({ success: true, request });
  })
);

// Create ad hoc request
router.post(
  '/',
  authenticateToken,
  requireAdmin,
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
      return errorResponse(res, 'Invalid request status', 400, 'VALIDATION_ERROR');
    }

    if (!adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, 'VALIDATION_ERROR');
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, 'VALIDATION_ERROR');
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, 'VALIDATION_ERROR');
    }

    if (attachmentFileId && projectId) {
      const db = getDatabase();
      const attachment = await db.get(
        'SELECT id FROM files WHERE id = ? AND project_id = ?',
        [Number(attachmentFileId), Number(projectId)]
      );
      if (!attachment) {
        return errorResponse(res, 'Attachment must belong to the selected project', 400, 'VALIDATION_ERROR');
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

    res.status(201).json({ success: true, message: 'Ad hoc request created', request });
  })
);

// Update ad hoc request
router.put(
  '/:requestId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    const {
      status,
      requestType,
      priority,
      urgency
    } = req.body;

    if (status && !adHocRequestService.isValidStatus(status)) {
      return errorResponse(res, 'Invalid request status', 400, 'VALIDATION_ERROR');
    }

    if (requestType && !adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, 'VALIDATION_ERROR');
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, 'VALIDATION_ERROR');
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.updateRequest(requestId, req.body);
    res.json({ success: true, message: 'Ad hoc request updated', request });
  })
);

// Send quote to client
router.post(
  '/:requestId/send-quote',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);

    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (!request.clientEmail) {
      return errorResponse(res, 'Client email not found', 400, 'VALIDATION_ERROR');
    }

    const hasQuoteDetails =
      request.quotedPrice !== null ||
      request.flatRate !== null ||
      (request.estimatedHours !== null && request.hourlyRate !== null);

    if (!hasQuoteDetails) {
      return errorResponse(res, 'Quote details are required before sending', 400, 'VALIDATION_ERROR');
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
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const portalUrl = `${baseUrl}/client/portal`;

    const { emailService } = await import('../services/email-service.js');
    await emailService.sendEmail({
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
${BUSINESS_INFO.email}
      `.trim(),
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
</html>
      `.trim()
    });

    const updatedRequest = request.status === 'quoted'
      ? request
      : await adHocRequestService.updateRequest(requestId, { status: 'quoted' });

    res.json({ success: true, message: 'Quote sent', request: updatedRequest });
  })
);

// Generate invoice from a completed ad hoc request
router.post(
  '/:requestId/invoice',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);
    if (request.status !== 'completed') {
      return errorResponse(res, 'Request must be completed before generating an invoice', 400, 'VALIDATION_ERROR');
    }

    const { useTimeEntries = true, dueDate, notes, terms } = req.body || {};
    const summary = useTimeEntries ? await getAdHocTimeSummary(request) : { totalHours: null, totalAmount: null };
    const lineItem = buildAdHocLineItem(request, {
      useTimeEntries,
      totalHours: summary.totalHours,
      totalAmount: summary.totalAmount
    });

    const invoice = await getInvoiceService().createInvoice({
      projectId: request.projectId,
      clientId: request.clientId,
      lineItems: [lineItem],
      notes: notes || `Ad hoc request #${request.id}: ${request.title}`,
      terms: terms || undefined,
      dueDate: dueDate || undefined,
      servicesTitle: 'Ad Hoc Work',
      servicesDescription: request.description
    });

    const db = getDatabase();
    await db.run(
      `INSERT INTO ad_hoc_request_invoices (request_id, invoice_id, amount)
       VALUES (?, ?, ?)`
      , [request.id, invoice.id, lineItem.amount]
    );

    res.status(201).json({
      success: true,
      message: 'Invoice created',
      invoice,
      lineItem
    });
  })
);

// Bundle multiple ad hoc requests into a single invoice
router.post(
  '/invoice/bundle',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { requestIds, useTimeEntries = true, dueDate, notes, terms } = req.body || {};

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return errorResponse(res, 'requestIds is required', 400, 'VALIDATION_ERROR');
    }

    const requests = await Promise.all(requestIds.map((id: number) => adHocRequestService.getRequest(Number(id))));

    const [first] = requests;
    const sameProject = requests.every((req) => req.projectId === first.projectId);
    const sameClient = requests.every((req) => req.clientId === first.clientId);

    if (!sameProject || !sameClient) {
      return errorResponse(res, 'All requests must belong to the same project and client', 400, 'VALIDATION_ERROR');
    }

    const incomplete = requests.find((req) => req.status !== 'completed');
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
      const summary = useTimeEntries ? await getAdHocTimeSummary(reqItem) : { totalHours: null, totalAmount: null };
      lineItems.push(buildAdHocLineItem(reqItem, {
        useTimeEntries,
        totalHours: summary.totalHours,
        totalAmount: summary.totalAmount
      }));
    }

    const invoice = await getInvoiceService().createInvoice({
      projectId: first.projectId,
      clientId: first.clientId,
      lineItems,
      notes: notes || `Ad hoc requests bundled: ${requests.map((r) => `#${r.id}`).join(', ')}`,
      terms: terms || undefined,
      dueDate: dueDate || undefined,
      servicesTitle: 'Ad Hoc Work (Bundle)'
    });

    const db = getDatabase();
    for (let i = 0; i < requests.length; i += 1) {
      await db.run(
        `INSERT INTO ad_hoc_request_invoices (request_id, invoice_id, amount)
         VALUES (?, ?, ?)`
        , [requests[i].id, invoice.id, lineItems[i].amount]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Invoice created',
      invoice,
      lineItems
    });
  })
);

// Monthly ad hoc summary for recurring clients
router.get(
  '/summary/monthly',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const months = req.query.months ? Number(req.query.months) : 6;
    const clientId = req.query.clientId ? Number(req.query.clientId) : undefined;
    const db = getDatabase();

    const params: Array<number | string> = [];
    let where = '1=1';

    if (clientId) {
      where += ' AND r.client_id = ?';
      params.push(clientId);
    }

    where += " AND i.issued_date >= date('now', ?)";
    params.push(`-${months} months`);

    const rows = await db.all(
      `SELECT
        r.client_id,
        c.contact_name as client_name,
        c.company_name as company_name,
        strftime('%Y-%m', i.issued_date) as month,
        COUNT(DISTINCT r.id) as request_count,
        SUM(ai.amount) as total_amount
       FROM ad_hoc_request_invoices ai
       JOIN ad_hoc_requests r ON ai.request_id = r.id
       JOIN invoices i ON ai.invoice_id = i.id
       JOIN clients c ON r.client_id = c.id
       WHERE ${where}
       GROUP BY r.client_id, month
       ORDER BY month DESC, total_amount DESC`,
      params
    );

    res.json({ success: true, summary: rows });
  })
);

// Convert approved ad hoc request to task(s)
router.post(
  '/:requestId/convert-to-task',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);

    if (Number.isNaN(requestId)) {
      return errorResponse(res, 'Invalid request ID', 400, 'VALIDATION_ERROR');
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (request.status !== 'approved') {
      return errorResponse(res, 'Request must be approved before converting to a task', 400, 'VALIDATION_ERROR');
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

    const {
      title,
      description,
      milestoneId,
      assignedTo,
      dueDate,
      priority,
      subtasks
    } = req.body || {};

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

    res.status(201).json({
      success: true,
      message: 'Request converted to task',
      task,
      subtasks: createdSubtasks,
      request: updatedRequest
    });
  })
);

// Soft delete ad hoc request
router.delete(
  '/:requestId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const requestId = Number(req.params.requestId);
    const deletedBy = req.user?.email || String(req.user?.id || 'system');
    await adHocRequestService.softDeleteRequest(requestId, deletedBy);
    res.json({ success: true, message: 'Ad hoc request deleted' });
  })
);

export default router;
