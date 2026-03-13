/**
 * ===============================================
 * AD HOC REQUESTS — CLIENT ROUTES
 * ===============================================
 * Client-facing endpoints: list own requests,
 * submit new requests, approve/decline quotes.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import {
  adHocRequestService,
  type AdHocRequestStatus,
  type AdHocRequestType
} from '../../services/ad-hoc-request-service.js';
import { emailService } from '../../services/email-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { logger } from '../../services/logger.js';
import { AdHocValidationSchemas } from './shared.js';

const router = express.Router();

/**
 * @swagger
 * /api/ad-hoc-requests/my-requests:
 *   get:
 *     tags: [Ad-hoc Requests]
 *     summary: Get client ad hoc requests
 *     description: Returns all ad hoc requests for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: requestType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of client requests
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my-requests',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const status = req.query.status as string | undefined;
    const requestType = req.query.requestType as string | undefined;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.UNAUTHORIZED);
    }

    if (status && !adHocRequestService.isValidStatus(status)) {
      return errorResponse(res, 'Invalid request status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (requestType && !adHocRequestService.isValidType(requestType)) {
      return errorResponse(res, 'Invalid request type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const requests = await adHocRequestService.getRequests({
      clientId,
      status: status as AdHocRequestStatus,
      requestType: requestType as AdHocRequestType
    });

    sendSuccess(res, { requests });
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/my-requests:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Submit ad hoc request (client)
 *     description: Submits a new ad hoc request from a client.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, title, description, requestType]
 *             properties:
 *               projectId:
 *                 type: integer
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               requestType:
 *                 type: string
 *               priority:
 *                 type: string
 *               urgency:
 *                 type: string
 *               attachmentFileId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Request submitted
 *       400:
 *         description: Validation error
 *       404:
 *         description: Project not found
 */
router.post(
  '/my-requests',
  authenticateToken,
  validateRequest(AdHocValidationSchemas.clientSubmit, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const { projectId, title, description, requestType, priority, urgency, attachmentFileId } =
      req.body;

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.UNAUTHORIZED);
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
      return errorResponse(res, 'Invalid request type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (priority && !adHocRequestService.isValidPriority(priority)) {
      return errorResponse(res, 'Invalid request priority', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (urgency && !adHocRequestService.isValidUrgency(urgency)) {
      return errorResponse(res, 'Invalid request urgency', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const project = await db.get(
      'SELECT id FROM projects WHERE id = ? AND client_id = ? AND deleted_at IS NULL',
      [Number(projectId), clientId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (attachmentFileId) {
      const attachment = await db.get('SELECT id FROM files WHERE id = ? AND project_id = ? AND deleted_at IS NULL', [
        Number(attachmentFileId),
        Number(projectId)
      ]);
      if (!attachment) {
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
      clientId,
      title,
      description,
      requestType,
      priority,
      urgency,
      status: 'submitted',
      attachmentFileId: attachmentFileId ? Number(attachmentFileId) : null
    });

    // Send admin notification (non-blocking)
    try {
      const clientInfo = await db.get(
        'SELECT contact_name, company_name, email FROM clients WHERE id = ?',
        [clientId]
      ) as { contact_name?: string; company_name?: string; email?: string } | undefined;

      const projectInfo = await db.get(
        'SELECT project_name FROM projects WHERE id = ?',
        [Number(projectId)]
      ) as { project_name?: string } | undefined;

      const clientDisplayName = clientInfo?.contact_name || clientInfo?.company_name || clientInfo?.email || 'Unknown client';
      const projectDisplayName = projectInfo?.project_name || `Project #${projectId}`;

      await emailService.sendAdminNotification('New Ad-Hoc Request Submitted', {
        type: 'ad-hoc-request',
        message: `New ad-hoc request from ${clientDisplayName}: ${title}`,
        details: {
          requestId: request.id,
          clientId,
          clientName: clientDisplayName,
          projectId: Number(projectId),
          projectName: projectDisplayName,
          title,
          requestType,
          priority: priority || 'medium',
          urgency: urgency || 'normal'
        }
      });
    } catch (notificationError) {
      await logger.error('[AdHocRequests] Admin notification failed:', {
        error: notificationError instanceof Error ? notificationError : undefined,
        category: 'AD_HOC'
      });
    }

    sendCreated(res, { request }, 'Request submitted');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/my-requests/{requestId}/approve:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Approve ad hoc request quote (client)
 *     description: Client approves the quoted price for an ad hoc request.
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
 *         description: Quote approved
 *       400:
 *         description: Quote not available for approval
 *       404:
 *         description: Request not found
 */
router.post(
  '/my-requests/:requestId/approve',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const requestId = Number(req.params.requestId);

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.UNAUTHORIZED);
    }

    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (request.clientId !== clientId) {
      return errorResponse(res, 'Request not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (request.status !== 'quoted') {
      return errorResponse(res, 'Quote is not available for approval', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const updatedRequest = await adHocRequestService.updateRequest(requestId, {
      status: 'approved'
    });
    sendSuccess(res, { request: updatedRequest }, 'Quote approved');
  })
);

/**
 * @swagger
 * /api/ad-hoc-requests/my-requests/{requestId}/decline:
 *   post:
 *     tags: [Ad-hoc Requests]
 *     summary: Decline ad hoc request quote (client)
 *     description: Client declines the quoted price for an ad hoc request.
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
 *         description: Quote declined
 *       400:
 *         description: Quote not available for decline
 *       404:
 *         description: Request not found
 */
router.post(
  '/my-requests/:requestId/decline',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.id;
    const requestId = Number(req.params.requestId);

    if (!clientId) {
      return errorResponse(res, 'Not authenticated', 401, ErrorCodes.UNAUTHORIZED);
    }

    if (Number.isNaN(requestId) || requestId <= 0) {
      return errorResponse(res, 'Invalid request ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const request = await adHocRequestService.getRequest(requestId);

    if (request.clientId !== clientId) {
      return errorResponse(res, 'Request not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (request.status !== 'quoted') {
      return errorResponse(res, 'Quote is not available for decline', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const updatedRequest = await adHocRequestService.updateRequest(requestId, {
      status: 'declined'
    });
    sendSuccess(res, { request: updatedRequest }, 'Quote declined');
  })
);

export default router;
