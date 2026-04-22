/**
 * ===============================================
 * DOCUMENT REQUEST ROUTES - CLIENT
 * ===============================================
 * @file server/routes/document-requests/client.ts
 *
 * Client-facing endpoints for document requests
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { documentRequestService, RequestStatus } from '../../services/document-request-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { DocRequestValidationSchemas } from './shared.js';

const router = express.Router();

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

    // Ownership gate — without this, any authenticated client can mark
    // any other client's request as viewed. Fetch first, 404 on mismatch
    // so existence isn't leaked.
    const existing = await documentRequestService.getRequest(id);
    if (!existing || existing.client_id !== req.user?.id) {
      return errorResponse(res, 'Request not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
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

    // Ownership gate — without this, any authenticated client could
    // attach files to any other client's request. 404 (not 403) so
    // existence of unrelated requests isn't leaked.
    const existing = await documentRequestService.getRequest(id);
    if (!existing || existing.client_id !== req.user?.id) {
      return errorResponse(res, 'Request not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
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

export default router;
