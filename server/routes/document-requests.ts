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
import { documentRequestService, RequestStatus } from '../services/document-request-service.js';
import { workflowTriggerService } from '../services/workflow-trigger-service.js';
import { errorResponse, sendSuccess, sendCreated } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// CLIENT ENDPOINTS
// =====================================================

/**
 * Get all document requests for the authenticated client
 */
router.get(
  '/my-requests',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;
    const status = req.query.status as RequestStatus | undefined;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const requests = await documentRequestService.getClientRequests(clientId, status);
    const stats = await documentRequestService.getClientStats(clientId);

    sendSuccess(res, { requests, stats });
  })
);

/**
 * Mark a request as viewed by client
 */
router.post(
  '/:id/view',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const clientEmail = req.user?.email;

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    if (!clientEmail) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const request = await documentRequestService.markViewed(id, clientEmail);
    sendSuccess(res, { request });
  })
);

/**
 * Upload a document for a request
 */
router.post(
  '/:id/upload',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const { fileId } = req.body;
    const uploaderEmail = req.user?.email;

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    if (!fileId) {
      return errorResponse(res, 'fileId is required', 400);
    }

    if (!uploaderEmail) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const request = await documentRequestService.uploadDocument(id, fileId, uploaderEmail);
    sendSuccess(res, { request }, 'Document uploaded successfully');
  })
);

/**
 * Get pending document requests for the authenticated client (unfulfilled)
 */
router.get(
  '/my-pending',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = req.user?.id;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401);
    }

    const requests = await documentRequestService.getClientPendingRequests(clientId);
    sendSuccess(res, { requests });
  })
);

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

/**
 * Get all pending document requests (admin)
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
 * Get requests needing review (admin)
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
 * Get overdue requests (admin)
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
 * Get requests for a specific client (admin)
 */
router.get(
  '/client/:clientId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const clientId = parseInt(req.params.clientId);
    const status = req.query.status as RequestStatus | undefined;

    if (isNaN(clientId)) {
      return errorResponse(res, 'Invalid client ID', 400);
    }

    const requests = await documentRequestService.getClientRequests(clientId, status);
    const stats = await documentRequestService.getClientStats(clientId);

    sendSuccess(res, { requests, stats });
  })
);

/**
 * Get pending document requests for a specific project (admin)
 */
router.get(
  '/project/:projectId/pending',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return errorResponse(res, 'Invalid project ID', 400);
    }

    const requests = await documentRequestService.getProjectPendingRequests(projectId);
    sendSuccess(res, { requests });
  })
);

/**
 * Get a specific request (admin)
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    const request = await documentRequestService.getRequest(id);
    if (!request) {
      return errorResponse(res, 'Request not found', 404);
    }

    const history = await documentRequestService.getRequestHistory(id);

    sendSuccess(res, { request, history });
  })
);

/**
 * Create a new document request (admin)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
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
      return errorResponse(res, 'client_id and title are required', 400);
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
 * Create requests from templates (admin)
 */
router.post(
  '/from-templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { client_id, template_ids, project_id } = req.body;

    if (!client_id || !template_ids || !Array.isArray(template_ids)) {
      return errorResponse(res, 'client_id and template_ids array are required', 400);
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
 * Start review of a request (admin)
 */
router.post(
  '/:id/start-review',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const reviewerEmail = req.user?.email || 'admin';

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    const request = await documentRequestService.startReview(id, reviewerEmail);
    sendSuccess(res, { request }, 'Review started');
  })
);

/**
 * Approve a request (admin)
 * - Copies uploaded file to Files tab (Forms folder)
 * - Marks original request complete with file reference
 * - Emits document_request.approved workflow event
 */
router.post(
  '/:id/approve',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const { notes } = req.body;
    const reviewerEmail = req.user?.email || 'admin';

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    // Approve the request - this also copies the file to the Files tab
    const { request, approvedFileId } = await documentRequestService.approveRequest(id, reviewerEmail, notes);

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
 * Reject a request (admin)
 * - Emits document_request.rejected workflow event
 */
router.post(
  '/:id/reject',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    const reviewerEmail = req.user?.email || 'admin';

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    if (!reason) {
      return errorResponse(res, 'Rejection reason is required', 400);
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
 * Send reminder for a request (admin)
 */
router.post(
  '/:id/remind',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    const request = await documentRequestService.sendReminder(id);
    sendSuccess(res, { request }, 'Reminder sent');
  })
);

/**
 * Delete a request (admin)
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid request ID', 400);
    }

    await documentRequestService.deleteRequest(id);
    sendSuccess(res, undefined, 'Document request deleted');
  })
);

// =====================================================
// TEMPLATE ENDPOINTS
// =====================================================

/**
 * Get all templates
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
 * Get a template
 */
router.get(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    const template = await documentRequestService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    sendSuccess(res, { template });
  })
);

/**
 * Create a template
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, title, description, document_type, is_required, days_until_due } = req.body;

    if (!name || !title) {
      return errorResponse(res, 'name and title are required', 400);
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
 * Update a template
 */
router.put(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    const template = await documentRequestService.updateTemplate(id, req.body);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    sendSuccess(res, { template }, 'Template updated');
  })
);

/**
 * Delete a template
 */
router.delete(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    await documentRequestService.deleteTemplate(id);
    sendSuccess(res, undefined, 'Template deleted');
  })
);

// =====================================================
// TEMPLATE CATEGORY ENDPOINTS
// =====================================================

/**
 * Get templates grouped by category
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
 * Get templates for a specific project type
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
 * Bulk request documents by project type
 */
router.post(
  '/bulk-request',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { client_id, project_type, project_id, required_only } = req.body;

    if (!client_id || !project_type) {
      return errorResponse(res, 'client_id and project_type are required', 400);
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
