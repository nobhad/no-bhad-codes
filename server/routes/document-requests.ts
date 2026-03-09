/**
 * ===============================================
 * DOCUMENT REQUEST ROUTES
 * ===============================================
 * @file server/routes/document-requests.ts
 *
 * API endpoints for managing document requests
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';
import { documentRequestService, RequestStatus } from '../services/document-request-service.js';
import { workflowTriggerService } from '../services/workflow-trigger-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../utils/api-response.js';
import { validateRequest, ValidationSchema } from '../middleware/validation.js';

const router = express.Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const DOC_REQUEST_TITLE_MAX_LENGTH = 200;
const DOC_REQUEST_DESCRIPTION_MAX_LENGTH = 5000;
const DOC_TYPE_MAX_LENGTH = 100;
const DOC_PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'];
const BULK_DELETE_MAX_IDS = 100;
const TEMPLATE_NAME_MAX_LENGTH = 200;
const MAX_TEMPLATE_IDS = 50;
const REJECTION_REASON_MAX_LENGTH = 2000;
const REVIEW_NOTES_MAX_LENGTH = 2000;
const DAYS_UNTIL_DUE_MAX = 365;

const DocRequestValidationSchemas = {
  create: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: DOC_REQUEST_TITLE_MAX_LENGTH }
    ],
    project_id: { type: 'number' as const, min: 1 },
    description: { type: 'string' as const, maxLength: DOC_REQUEST_DESCRIPTION_MAX_LENGTH },
    document_type: { type: 'string' as const, maxLength: DOC_TYPE_MAX_LENGTH },
    priority: { type: 'string' as const, allowedValues: DOC_PRIORITY_VALUES },
    due_date: { type: 'string' as const, maxLength: 30 },
    is_required: { type: 'boolean' as const }
  } as ValidationSchema,

  fromTemplates: {
    client_id: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    template_ids: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: MAX_TEMPLATE_IDS }
    ],
    project_id: { type: 'number' as const, min: 1 }
  } as ValidationSchema,

  upload: {
    fileId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ]
  } as ValidationSchema,

  approve: {
    notes: { type: 'string' as const, maxLength: REVIEW_NOTES_MAX_LENGTH }
  } as ValidationSchema,

  reject: {
    reason: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: REJECTION_REASON_MAX_LENGTH }
    ]
  } as ValidationSchema,

  bulkDelete: {
    requestIds: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema,

  createTemplate: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: TEMPLATE_NAME_MAX_LENGTH }
    ],
    title: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: DOC_REQUEST_TITLE_MAX_LENGTH }
    ],
    description: { type: 'string' as const, maxLength: DOC_REQUEST_DESCRIPTION_MAX_LENGTH },
    document_type: { type: 'string' as const, maxLength: DOC_TYPE_MAX_LENGTH },
    is_required: { type: 'boolean' as const },
    days_until_due: { type: 'number' as const, min: 1, max: DAYS_UNTIL_DUE_MAX }
  } as ValidationSchema,

  updateTemplate: {
    name: { type: 'string' as const, minLength: 1, maxLength: TEMPLATE_NAME_MAX_LENGTH },
    title: { type: 'string' as const, minLength: 1, maxLength: DOC_REQUEST_TITLE_MAX_LENGTH },
    description: { type: 'string' as const, maxLength: DOC_REQUEST_DESCRIPTION_MAX_LENGTH },
    document_type: { type: 'string' as const, maxLength: DOC_TYPE_MAX_LENGTH },
    is_required: { type: 'boolean' as const },
    days_until_due: { type: 'number' as const, min: 1, max: DAYS_UNTIL_DUE_MAX }
  } as ValidationSchema
};

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/document-requests/my-requests:
 *   get:
 *     tags: [Documents]
 *     summary: Get client document requests
 *     description: Returns all document requests for the authenticated client with stats.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client document requests with stats
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my-requests',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const status = req.query.status as RequestStatus | undefined;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const requests = await documentRequestService.getClientRequests(clientId, status);
    const stats = await documentRequestService.getClientStats(clientId);

    sendSuccess(res, { requests, stats });
  })
);

/**
 * @swagger
 * /api/document-requests/{id}/view:
 *   post:
 *     tags: [Documents]
 *     summary: Mark request as viewed
 *     description: Marks a document request as viewed by the client.
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
 *         description: Request marked as viewed
 */
router.post(
  '/:id/view',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const clientEmail = req.user?.email;

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!clientEmail) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const request = await documentRequestService.markViewed(id, clientEmail);
    sendSuccess(res, { request });
  })
);

/**
 * @swagger
 * /api/document-requests/{id}/upload:
 *   post:
 *     tags: [Documents]
 *     summary: Upload document for a request
 *     description: Uploads a document to fulfill a document request.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileId]
 *             properties:
 *               fileId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Document uploaded
 *       400:
 *         description: Validation error
 */
router.post(
  '/:id/upload',
  authenticateToken,
  validateRequest(DocRequestValidationSchemas.upload),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const { fileId } = req.body;
    const uploaderEmail = req.user?.email;

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!fileId) {
      return errorResponse(res, 'fileId is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    if (!uploaderEmail) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const request = await documentRequestService.uploadDocument(id, fileId, uploaderEmail);
    sendSuccess(res, { request }, 'Document uploaded successfully');
  })
);

/**
 * @swagger
 * /api/document-requests/my-pending:
 *   get:
 *     tags: [Documents]
 *     summary: Get pending client requests
 *     description: Returns unfulfilled document requests for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my-pending',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.NOT_AUTHENTICATED);
    }

    const requests = await documentRequestService.getClientPendingRequests(clientId);
    sendSuccess(res, { requests });
  })
);

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/document-requests:
 *   get:
 *     tags: [Documents]
 *     summary: Get all document requests (admin)
 *     description: Returns all document requests with optional status filtering and stats.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All document requests with stats
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const status = req.query.status as RequestStatus | undefined;
    const requests = await documentRequestService.getAllRequests(status);
    const stats = await documentRequestService.getAdminStats();

    sendSuccess(res, { requests, stats });
  })
);

/**
 * @swagger
 * /api/document-requests/pending:
 *   get:
 *     tags: [Documents]
 *     summary: Get all pending requests (admin)
 *     description: Returns all pending document requests.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests
 */
router.get(
  '/pending',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requests = await documentRequestService.getPendingRequests();
    sendSuccess(res, { requests });
  })
);

/**
 * @swagger
 * /api/document-requests/for-review:
 *   get:
 *     tags: [Documents]
 *     summary: Get requests needing review (admin)
 *     description: Returns document requests that need admin review.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of requests needing review
 */
router.get(
  '/for-review',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requests = await documentRequestService.getRequestsForReview();
    sendSuccess(res, { requests });
  })
);

/**
 * @swagger
 * /api/document-requests/overdue:
 *   get:
 *     tags: [Documents]
 *     summary: Get overdue requests (admin)
 *     description: Returns document requests that are past their due date.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue requests
 */
router.get(
  '/overdue',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const requests = await documentRequestService.getOverdueRequests();
    sendSuccess(res, { requests });
  })
);

/**
 * @swagger
 * /api/document-requests/client/{clientId}:
 *   get:
 *     tags: [Documents]
 *     summary: Get requests for a specific client (admin)
 *     description: Returns document requests for a specific client with stats.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Client document requests with stats
 */
router.get(
  '/client/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId, 10);
    const status = req.query.status as RequestStatus | undefined;

    if (isNaN(clientId) || clientId <= 0) {
      return errorResponse(res, 'Invalid client ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const requests = await documentRequestService.getClientRequests(clientId, status);
    const stats = await documentRequestService.getClientStats(clientId);

    sendSuccess(res, { requests, stats });
  })
);

/**
 * @swagger
 * /api/document-requests/project/{projectId}/pending:
 *   get:
 *     tags: [Documents]
 *     summary: Get pending requests for a project (admin)
 *     description: Returns pending document requests for a specific project.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of pending requests for project
 */
router.get(
  '/project/:projectId/pending',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const requests = await documentRequestService.getProjectPendingRequests(projectId);
    sendSuccess(res, { requests });
  })
);

/**
 * @swagger
 * /api/document-requests/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Get a specific request (admin)
 *     description: Returns a specific document request with its history.
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
 *         description: Document request with history
 *       404:
 *         description: Request not found
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await documentRequestService.getRequest(id);
    if (!request) {
      return errorResponse(res, 'Request not found', 404, ErrorCodes.NOT_FOUND);
    }

    const history = await documentRequestService.getRequestHistory(id);

    sendSuccess(res, { request, history });
  })
);

/**
 * PUT /api/document-requests/:id - Update a document request status
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { status } = req.body;

    if (!status) {
      return errorResponse(res, 'Status is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const db = getDatabase();

    await db.run(
      'UPDATE document_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    const updated = await db.get(
      `SELECT id, client_id, project_id, requested_by, title, description, document_type,
              priority, status, due_date, file_id, uploaded_by, uploaded_at, reviewed_by,
              reviewed_at, review_notes, rejection_reason, is_required, created_at, updated_at
       FROM document_requests WHERE id = ?`,
      [id]
    );

    if (!updated) {
      return errorResponse(res, 'Document request not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { request: updated });
  })
);

/**
 * @swagger
 * /api/document-requests:
 *   post:
 *     tags: [Documents]
 *     summary: Create a new document request (admin)
 *     description: Creates a new document request for a client.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, title]
 *             properties:
 *               client_id:
 *                 type: integer
 *               title:
 *                 type: string
 *               project_id:
 *                 type: integer
 *               description:
 *                 type: string
 *               document_type:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               due_date:
 *                 type: string
 *               is_required:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Document request created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.create, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const {
      client_id,
      project_id,
      title,
      description,
      document_type,
      priority,
      due_date,
      is_required
    } = req.body;

    if (!client_id || !title) {
      return errorResponse(res, 'client_id and title are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const requestedBy = req.user?.email || 'admin';

    const request = await documentRequestService.createRequest({
      client_id,
      project_id,
      requested_by: requestedBy,
      title,
      description,
      document_type,
      priority,
      due_date,
      is_required
    });

    sendCreated(res, { request }, 'Document request created');
  })
);

/**
 * @swagger
 * /api/document-requests/from-templates:
 *   post:
 *     tags: [Documents]
 *     summary: Create requests from templates (admin)
 *     description: Creates document requests from selected templates for a client.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, template_ids]
 *             properties:
 *               client_id:
 *                 type: integer
 *               template_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *               project_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Document requests created from templates
 */
router.post(
  '/from-templates',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.fromTemplates),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { client_id, template_ids, project_id } = req.body;

    if (!client_id || !template_ids || !Array.isArray(template_ids)) {
      return errorResponse(res, 'client_id and template_ids array are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const requestedBy = req.user?.email || 'admin';

    const requests = await documentRequestService.createFromTemplates(
      client_id,
      template_ids,
      requestedBy,
      project_id
    );

    sendCreated(res, { requests }, `${requests.length} document request(s) created`);
  })
);

/**
 * @swagger
 * /api/document-requests/{id}/start-review:
 *   post:
 *     tags: [Documents]
 *     summary: Start review of a request (admin)
 *     description: Starts the review process for a document request.
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
 *         description: Review started
 */
router.post(
  '/:id/start-review',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const reviewerEmail = req.user?.email || 'admin';

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await documentRequestService.startReview(id, reviewerEmail);
    sendSuccess(res, { request }, 'Review started');
  })
);

/**
 * @swagger
 * /api/document-requests/{id}/approve:
 *   post:
 *     tags: [Documents]
 *     summary: Approve a document request (admin)
 *     description: Approves a document request, copies file to Files tab, and emits workflow event.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document request approved
 */
router.post(
  '/:id/approve',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.approve, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const { notes } = req.body;
    const reviewerEmail = req.user?.email || 'admin';

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Approve the request - this also copies the file to the Files tab
    const { request, approvedFileId } = await documentRequestService.approveRequest(
      id,
      reviewerEmail,
      notes
    );

    // Emit workflow event for document request approval
    await workflowTriggerService.emit('document_request.approved', {
      entityId: id,
      triggeredBy: reviewerEmail,
      documentRequestId: id,
      clientId: request.client_id,
      projectId: request.project_id,
      title: request.title,
      documentType: request.document_type,
      approvedFileId,
      originalFileId: request.file_id,
      reviewerEmail
    });

    sendSuccess(res, { request, approvedFileId }, 'Document request approved');
  })
);

/**
 * @swagger
 * /api/document-requests/{id}/reject:
 *   post:
 *     tags: [Documents]
 *     summary: Reject a document request (admin)
 *     description: Rejects a document request with a required reason and emits workflow event.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document request rejected
 *       400:
 *         description: Reason required
 */
router.post(
  '/:id/reject',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.reject),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body;
    const reviewerEmail = req.user?.email || 'admin';

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!reason) {
      return errorResponse(res, 'Rejection reason is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const request = await documentRequestService.rejectRequest(id, reviewerEmail, reason);

    // Emit workflow event for document request rejection
    await workflowTriggerService.emit('document_request.rejected', {
      entityId: id,
      triggeredBy: reviewerEmail,
      documentRequestId: id,
      clientId: request.client_id,
      projectId: request.project_id,
      title: request.title,
      documentType: request.document_type,
      rejectionReason: reason,
      reviewerEmail
    });

    sendSuccess(res, { request }, 'Document request rejected');
  })
);

/**
 * @swagger
 * /api/document-requests/{id}/remind:
 *   post:
 *     tags: [Documents]
 *     summary: Send reminder for a request (admin)
 *     description: Sends a reminder notification for a document request.
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
 *         description: Reminder sent
 */
router.post(
  '/:id/remind',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await documentRequestService.sendReminder(id);
    sendSuccess(res, { request }, 'Reminder sent');
  })
);

/**
 * @swagger
 * /api/document-requests/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Delete a document request (admin)
 *     description: Deletes a specific document request.
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
 *         description: Document request deleted
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await documentRequestService.deleteRequest(id);
    sendSuccess(res, undefined, 'Document request deleted');
  })
);

/**
 * @swagger
 * /api/document-requests/bulk-delete:
 *   post:
 *     tags: [Documents]
 *     summary: Bulk delete requests (admin)
 *     description: Deletes multiple document requests at once.
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
 *         description: Document requests deleted
 */
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.bulkDelete),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { requestIds } = req.body;

    if (!requestIds || !Array.isArray(requestIds) || requestIds.length === 0) {
      return errorResponse(res, 'requestIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    let deleted = 0;

    for (const requestId of requestIds) {
      const id = typeof requestId === 'string' ? parseInt(requestId, 10) : requestId;
      if (isNaN(id) || id <= 0) continue;

      try {
        await documentRequestService.deleteRequest(id);
        deleted++;
      } catch {
        // Skip requests that don't exist or can't be deleted
      }
    }

    sendSuccess(res, { deleted }, `${deleted} document request(s) deleted`);
  })
);

// =====================================================
// TEMPLATE ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/document-requests/templates/list:
 *   get:
 *     tags: [Documents]
 *     summary: Get all document request templates
 *     description: Returns all available document request templates.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get(
  '/templates/list',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templates = await documentRequestService.getTemplates();
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/document-requests/templates/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Get a document request template
 *     description: Returns a specific document request template by ID.
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
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await documentRequestService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { template });
  })
);

/**
 * @swagger
 * /api/document-requests/templates:
 *   post:
 *     tags: [Documents]
 *     summary: Create a document request template
 *     description: Creates a new document request template.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, title]
 *             properties:
 *               name:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               document_type:
 *                 type: string
 *               is_required:
 *                 type: boolean
 *               days_until_due:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Template created
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.createTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, title, description, document_type, is_required, days_until_due } = req.body;

    if (!name || !title) {
      return errorResponse(res, 'name and title are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const createdBy = req.user?.email;

    const template = await documentRequestService.createTemplate({
      name,
      title,
      description,
      document_type,
      is_required,
      days_until_due,
      created_by: createdBy
    });

    sendCreated(res, { template }, 'Template created');
  })
);

/**
 * @swagger
 * /api/document-requests/templates/{id}:
 *   put:
 *     tags: [Documents]
 *     summary: Update a document request template
 *     description: Updates an existing document request template.
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
 *         description: Template updated
 *       404:
 *         description: Template not found
 */
router.put(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(DocRequestValidationSchemas.updateTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await documentRequestService.updateTemplate(id, req.body);
    if (!template) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { template }, 'Template updated');
  })
);

/**
 * @swagger
 * /api/document-requests/templates/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Delete a document request template
 *     description: Deletes a document request template.
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
 *         description: Template deleted
 */
router.delete(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await documentRequestService.deleteTemplate(id);
    sendSuccess(res, undefined, 'Template deleted');
  })
);

// =====================================================
// TEMPLATE CATEGORY ENDPOINTS
// =====================================================

/**
 * @swagger
 * /api/document-requests/templates/by-category:
 *   get:
 *     tags: [Documents]
 *     summary: Get templates by category
 *     description: Returns document request templates grouped by category.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Templates grouped by category
 */
router.get(
  '/templates/by-category',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templatesByCategory = await documentRequestService.getTemplatesByCategory();
    sendSuccess(res, { templatesByCategory });
  })
);

/**
 * @swagger
 * /api/document-requests/templates/by-project-type/{projectType}:
 *   get:
 *     tags: [Documents]
 *     summary: Get templates for a project type
 *     description: Returns document request templates applicable to a specific project type.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Templates for project type
 */
router.get(
  '/templates/by-project-type/:projectType',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectType } = req.params;
    const templates = await documentRequestService.getTemplatesByProjectType(projectType);
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/document-requests/bulk-request:
 *   post:
 *     tags: [Documents]
 *     summary: Bulk request documents by project type
 *     description: Creates document requests from all templates matching a project type.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, project_type]
 *             properties:
 *               client_id:
 *                 type: integer
 *               project_type:
 *                 type: string
 *               project_id:
 *                 type: integer
 *               required_only:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Document requests created
 */
router.post(
  '/bulk-request',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { client_id, project_type, project_id, required_only } = req.body;

    if (!client_id || !project_type) {
      return errorResponse(res, 'client_id and project_type are required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const requestedBy = req.user?.email || 'admin';

    const requests = await documentRequestService.bulkRequestByProjectType(
      client_id,
      project_type,
      requestedBy,
      project_id,
      required_only
    );

    sendCreated(res, { requests }, `${requests.length} document request(s) created`);
  })
);

export { router as documentRequestsRouter };
export default router;
