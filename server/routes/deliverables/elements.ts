/**
 * ===============================================
 * DELIVERABLES — DESIGN ELEMENTS
 * ===============================================
 * Create, list, and update approval status of design elements.
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
 * /api/deliverables/{id}/elements:
 *   post:
 *     tags: [Deliverables]
 *     summary: Create design element
 *     description: Creates a new design element for a deliverable.
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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Design element created
 */
router.post('/:id/elements', validateRequest(DeliverableValidationSchemas.createElement, { allowUnknownFields: true }), invalidateCache(['deliverables']), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

    const { name, description } = req.body;

    if (!name) {
      return errorResponse(res, 'name is required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const element = await deliverableService.createDesignElement(deliverableId, name, description);
    sendCreated(res, { element });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('not found')) {
      return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/deliverables/{id}/elements:
 *   get:
 *     tags: [Deliverables]
 *     summary: Get all design elements
 *     description: Returns all design elements for a deliverable.
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
 *         description: List of design elements
 */
router.get('/:id/elements', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deliverableId = parseInt(id, 10);
  if (isNaN(deliverableId) || deliverableId <= 0) {
    return errorResponse(res, 'Invalid deliverable ID', 400, ErrorCodes.VALIDATION_ERROR);
  }

  // Check authorization
  if (!(await canAccessDeliverable(req, deliverableId))) {
    return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
  }

  const elements = await deliverableService.getDeliverableElements(deliverableId);
  sendSuccess(res, { elements });
}));

/**
 * @swagger
 * /api/deliverables/{deliverableId}/elements/{elementId}/approval:
 *   patch:
 *     tags: [Deliverables]
 *     summary: Update element approval status
 *     description: Updates the approval status of a design element.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deliverableId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: elementId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, revision_needed]
 *     responses:
 *       200:
 *         description: Element approval status updated
 *       404:
 *         description: Element not found
 */
router.patch(
  '/:deliverableId/elements/:elementId/approval',
  validateRequest(DeliverableValidationSchemas.updateElementApproval),
  invalidateCache(['deliverables']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { deliverableId, elementId } = req.params;
      const parsedDeliverableId = parseInt(deliverableId, 10);
      const parsedElementId = parseInt(elementId, 10);
      if (
        isNaN(parsedDeliverableId) ||
        parsedDeliverableId <= 0 ||
        isNaN(parsedElementId) ||
        parsedElementId <= 0
      ) {
        return errorResponse(res, 'Invalid ID parameters', 400, ErrorCodes.VALIDATION_ERROR);
      }

      // Check authorization
      if (!(await canAccessDeliverable(req, parsedDeliverableId))) {
        return errorResponse(res, 'Deliverable not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      // Verify element belongs to this deliverable
      const existingElement = await deliverableService.getDesignElementById(parsedElementId);
      if (!existingElement || existingElement.deliverable_id !== parsedDeliverableId) {
        return errorResponse(res, 'Design element not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }

      const { status } = req.body;

      if (!['pending', 'approved', 'revision_needed'].includes(status)) {
        return errorResponse(res, 'Invalid approval status', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const element = await deliverableService.updateElementApprovalStatus(parsedElementId, status);
      sendSuccess(res, { element });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(res, 'Design element not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      }
      throw error;
    }
  })
);

export default router;
