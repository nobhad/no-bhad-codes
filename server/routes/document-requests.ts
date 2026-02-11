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
import { errorResponse } from '../utils/api-response.js';

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

    res.json({ requests, stats });
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
    res.json({ success: true, request });
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
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      request
    });
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
    res.json({ requests });
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
    res.json({ requests });
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
    res.json({ requests });
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
    res.json({ requests });
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

    res.json({ requests, stats });
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
    res.json({ requests });
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

    res.json({ request, history });
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

    res.status(201).json({
      success: true,
      message: 'Document request created',
      request
    });
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

    res.status(201).json({
      success: true,
      message: `${requests.length} document request(s) created`,
      requests
    });
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
    res.json({
      success: true,
      message: 'Review started',
      request
    });
  })
);

/**
 * Approve a request (admin)
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

    const request = await documentRequestService.approveRequest(id, reviewerEmail, notes);
    res.json({
      success: true,
      message: 'Document request approved',
      request
    });
  })
);

/**
 * Reject a request (admin)
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
    res.json({
      success: true,
      message: 'Document request rejected',
      request
    });
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
    res.json({
      success: true,
      message: 'Reminder sent',
      request
    });
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
    res.json({
      success: true,
      message: 'Document request deleted'
    });
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
    res.json({ templates });
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

    res.json({ template });
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

    res.status(201).json({
      success: true,
      message: 'Template created',
      template
    });
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

    res.json({
      success: true,
      message: 'Template updated',
      template
    });
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
    res.json({
      success: true,
      message: 'Template deleted'
    });
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
    res.json({ templatesByCategory });
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
    res.json({ templates });
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

    res.status(201).json({
      success: true,
      message: `${requests.length} document request(s) created`,
      requests
    });
  })
);

export { router as documentRequestsRouter };
export default router;
