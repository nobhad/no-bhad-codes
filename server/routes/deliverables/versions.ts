/**
 * ===============================================
 * DELIVERABLES — VERSIONS
 * ===============================================
 * Upload new version, list versions, get latest version.
 */

import { Router, Response } from 'express';
import { deliverableService } from '../../services/deliverable-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validation.js';
import { invalidateCache } from '../../middleware/cache.js';
import { DeliverableValidationSchemas, canAccessDeliverable } from './shared.js';

const router = Router();

/**
 * @swagger
 * /api/deliverables/{id}/versions:
 *   post:
 *     tags: [Deliverables]
 *     summary: Upload new version
 *     description: Uploads a new version of a deliverable.
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
 *             required: [filePath, fileName, uploadedById]
 *             properties:
 *               filePath:
 *                 type: string
 *               fileName:
 *                 type: string
 *               fileSize:
 *                 type: number
 *               fileType:
 *                 type: string
 *               uploadedById:
 *                 type: integer
 *               changeNotes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Version uploaded
 *       404:
 *         description: Deliverable not found
 */
router.post('/:id/versions', validateRequest(DeliverableValidationSchemas.uploadVersion, { allowUnknownFields: true }), invalidateCache(['deliverables']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const deliverableId = parseInt(id, 10);
    if (isNaN(deliverableId) || deliverableId <= 0) {
      return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check authorization
    if (!(await canAccessDeliverable(req, deliverableId))) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { filePath, fileName, fileSize, fileType, uploadedById, changeNotes } = req.body;

    if (!filePath || !fileName || !uploadedById) {
      return errorResponse(res, 'Missing required fields', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const version = await deliverableService.uploadVersion(
      deliverableId,
      filePath,
      fileName,
      fileSize,
      fileType,
      uploadedById,
      changeNotes
    );

    sendCreated(res, { version });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}/versions:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get all versions
 *     description: Returns all versions of a deliverable.
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
 *         description: List of versions
 */
router.get('/:id/versions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const versions = await deliverableService.getDeliverableVersions(deliverableId);
  sendSuccess(res, { versions });
}));

/**
 * @swagger
 * /api/deliverables/{id}/versions/latest:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get latest version
 *     description: Returns the latest version of a deliverable.
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
 *         description: Latest version details
 *       404:
 *         description: No versions found
 */
router.get('/:id/versions/latest', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const version = await deliverableService.getLatestVersion(deliverableId);

  if (!version) {
    return errorResponse(res, 'No versions found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  sendSuccess(res, { version });
}));

export default router;
