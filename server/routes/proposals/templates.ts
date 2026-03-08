/**
 * ===============================================
 * PROPOSAL TEMPLATE ROUTES
 * ===============================================
 * @file server/routes/proposals/templates.ts
 *
 * Template CRUD endpoints for proposal templates.
 */

import express, { Response } from 'express';
import {
  asyncHandler,
  authenticateToken,
  requireAdmin,
  proposalService,
  ErrorCodes,
  errorResponse,
  sendSuccess,
  sendCreated
} from './helpers.js';
import type { AuthenticatedRequest } from './helpers.js';

const router = express.Router();

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/templates:
 *   get:
 *     tags: [Proposals]
 *     summary: Get all templates
 *     description: Get all templates.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectType } = req.query;
    const templates = await proposalService.getTemplates(projectType as string | undefined);
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/proposals/templates/{templateId}:
 *   get:
 *     tags: [Proposals]
 *     summary: Get single template
 *     description: Get single template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await proposalService.getTemplate(templateId);
    sendSuccess(res, { template });
  })
);

/**
 * @swagger
 * /api/proposals/templates:
 *   post:
 *     tags: [Proposals]
 *     summary: Create template
 *     description: Create template.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;
    if (!name) {
      return errorResponse(res, 'Template name is required', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const template = await proposalService.createTemplate(req.body);
    sendCreated(res, { template }, 'Template created successfully');
  })
);

/**
 * @swagger
 * /api/proposals/templates/{templateId}:
 *   put:
 *     tags: [Proposals]
 *     summary: Update template
 *     description: Update template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await proposalService.updateTemplate(templateId, req.body);
    sendSuccess(res, { template }, 'Template updated successfully');
  })
);

/**
 * @swagger
 * /api/proposals/templates/{templateId}:
 *   delete:
 *     tags: [Proposals]
 *     summary: Delete template
 *     description: Delete template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await proposalService.deleteTemplate(templateId);
    sendSuccess(res, undefined, 'Template deleted successfully');
  })
);

export { router as templatesRouter };
