/**
 * ===============================================
 * CONTRACT TEMPLATE ROUTES
 * ===============================================
 * @file server/routes/contracts/templates.ts
 *
 * Template CRUD endpoints for contract templates.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { contractService } from '../../services/contract-service.js';
import { sendSuccess, sendCreated, errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { ContractValidationSchemas } from './shared.js';

const router = express.Router();

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/contracts/templates:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: List contract templates
 *     description: Retrieve all contract templates with optional type filter. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [service-agreement, nda, scope-of-work, maintenance, custom]
 *     responses:
 *       200:
 *         description: List of templates
 *       400:
 *         description: Invalid template type
 */
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.query;

    if (type && typeof type === 'string' && !contractService.isValidTemplateType(type)) {
      return errorResponse(res, 'Invalid template type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const templates = await contractService.getTemplates(type as string | undefined);
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/contracts/templates/{templateId}:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: Get a contract template
 *     description: Retrieve a single contract template by ID. Admin only.
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
 *         description: Template details
 *       400:
 *         description: Invalid template ID
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

    const template = await contractService.getTemplate(templateId);
    sendSuccess(res, { template });
  })
);

/**
 * @swagger
 * /api/contracts/templates:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Create a contract template
 *     description: Create a new reusable contract template. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [service-agreement, nda, scope-of-work, maintenance, custom]
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Template created
 *       400:
 *         description: Validation error
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.createTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, type, content } = req.body;

    if (!name || !type || !content) {
      return errorResponse(res, 'name, type, and content are required', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!contractService.isValidTemplateType(type)) {
      return errorResponse(res, 'Invalid template type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await contractService.createTemplate(req.body);
    sendCreated(res, { template }, 'Template created successfully');
  })
);

/**
 * @swagger
 * /api/contracts/templates/{templateId}:
 *   put:
 *     tags:
 *       - Contracts
 *     summary: Update a contract template
 *     description: Update an existing contract template. Admin only.
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
 *         description: Template updated
 *       400:
 *         description: Validation error
 */
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.updateTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (req.body?.type && !contractService.isValidTemplateType(req.body.type)) {
      return errorResponse(res, 'Invalid template type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await contractService.updateTemplate(templateId, req.body);
    sendSuccess(res, { template }, 'Template updated successfully');
  })
);

/**
 * @swagger
 * /api/contracts/templates/{templateId}:
 *   delete:
 *     tags:
 *       - Contracts
 *     summary: Delete a contract template
 *     description: Delete a contract template by ID. Admin only.
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
 *         description: Template deleted
 *       400:
 *         description: Invalid template ID
 */
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(_req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    await contractService.deleteTemplate(templateId);
    sendSuccess(res, undefined, 'Template deleted successfully');
  })
);

export { router as templatesRouter };
export default router;
