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
      return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!clientEmail) {
      return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    if (!uploaderEmail) {
      return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(401).json({ error: 'Not authenticated' });
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
      return res.status(400).json({ error: 'Invalid client ID' });
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
      return res.status(400).json({ error: 'Invalid project ID' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const request = await documentRequestService.getRequest(id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
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
      return res.status(400).json({ error: 'client_id and title are required' });
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
      return res.status(400).json({ error: 'client_id and template_ids array are required' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
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
      return res.status(400).json({ error: 'Invalid request ID' });
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
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const template = await documentRequestService.getTemplate(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
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
      return res.status(400).json({ error: 'name and title are required' });
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
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const template = await documentRequestService.updateTemplate(id, req.body);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
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
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    await documentRequestService.deleteTemplate(id);
    res.json({
      success: true,
      message: 'Template deleted'
    });
  })
);

export { router as documentRequestsRouter };
export default router;
