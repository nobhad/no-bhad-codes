/**
 * ===============================================
 * DOCUMENT REQUEST ROUTES - TEMPLATES
 * ===============================================
 * @file server/routes/document-requests/templates.ts
 *
 * Template CRUD endpoints for document requests
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { documentRequestService } from '../../services/document-request-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { DocRequestValidationSchemas } from './shared.js';

const router = express.Router();

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

export default router;
