import { logger } from '../services/logger.js';
/**
 * ===============================================
 * EMAIL TEMPLATE ROUTES
 * ===============================================
 * @file server/routes/email-templates.ts
 *
 * API endpoints for managing email templates
 */

import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import {
  emailTemplateService,
  type EmailTemplateCategory,
  type CreateTemplateData,
  type UpdateTemplateData
} from '../services/email-template-service.js';
import { sendSuccess, sendCreated, errorResponse, ErrorCodes } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// TEMPLATE MANAGEMENT
// =====================================================

/**
 * @swagger
 * /api/email-templates:
 *   get:
 *     tags: [Email Templates]
 *     summary: Get all email templates
 *     description: Returns all email templates with optional category filtering.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by template category
 *     responses:
 *       200:
 *         description: List of email templates
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const category = req.query.category as EmailTemplateCategory | undefined;
    const templates = await emailTemplateService.getTemplates(category);
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/email-templates/categories:
 *   get:
 *     tags: [Email Templates]
 *     summary: Get template categories
 *     description: Returns all available email template categories.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get(
  '/categories',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const categories = emailTemplateService.getCategories();
    sendSuccess(res, { categories });
  })
);

/**
 * @swagger
 * /api/email-templates/{id}:
 *   get:
 *     tags: [Email Templates]
 *     summary: Get a specific template
 *     description: Returns a specific email template by ID.
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
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await emailTemplateService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    sendSuccess(res, { template });
  })
);

/**
 * @swagger
 * /api/email-templates:
 *   post:
 *     tags: [Email Templates]
 *     summary: Create a new email template
 *     description: Creates a new email template with subject, HTML body, and optional variables.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, subject, body_html]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               subject:
 *                 type: string
 *               body_html:
 *                 type: string
 *               body_text:
 *                 type: string
 *               variables:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Template created
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, category, subject, body_html, body_text, variables, is_active } =
      req.body;

    if (!name || !subject || !body_html) {
      return errorResponse(res, 'name, subject, and body_html are required', 400);
    }

    const data: CreateTemplateData = {
      name,
      description,
      category,
      subject,
      body_html,
      body_text,
      variables,
      is_active
    };

    const template = await emailTemplateService.createTemplate(data, req.user?.email);

    sendCreated(res, { template }, 'Template created');
  })
);

/**
 * @swagger
 * /api/email-templates/{id}:
 *   put:
 *     tags: [Email Templates]
 *     summary: Update an email template
 *     description: Updates an existing email template.
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
 *       403:
 *         description: Cannot modify system template
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const {
      name,
      description,
      category,
      subject,
      body_html,
      body_text,
      variables,
      is_active,
      change_reason
    } = req.body;

    const data: UpdateTemplateData = {
      name,
      description,
      category,
      subject,
      body_html,
      body_text,
      variables,
      is_active
    };

    try {
      const template = await emailTemplateService.updateTemplate(
        id,
        data,
        req.user?.email,
        change_reason
      );
      if (!template) {
        return errorResponse(res, 'Template not found', 404);
      }

      sendSuccess(res, { template }, 'Template updated');
    } catch (error) {
      if (error instanceof Error && error.message.includes('system template')) {
        return errorResponse(res, error.message, 403);
      }
      throw error;
    }
  })
);

/**
 * @swagger
 * /api/email-templates/{id}:
 *   delete:
 *     tags: [Email Templates]
 *     summary: Delete an email template
 *     description: Deletes an email template. System templates cannot be deleted.
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
 *       404:
 *         description: Template not found
 *       403:
 *         description: Cannot delete system template
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const deleted = await emailTemplateService.deleteTemplate(id);
      if (!deleted) {
        return errorResponse(res, 'Template not found', 404);
      }

      sendSuccess(res, undefined, 'Template deleted');
    } catch (error) {
      if (error instanceof Error && error.message.includes('system template')) {
        return errorResponse(res, error.message, 403);
      }
      throw error;
    }
  })
);

// =====================================================
// VERSIONING
// =====================================================

/**
 * @swagger
 * /api/email-templates/{id}/versions:
 *   get:
 *     tags: [Email Templates]
 *     summary: Get version history
 *     description: Returns the version history for an email template.
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
 *         description: List of template versions
 */
router.get(
  '/:id/versions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const versions = await emailTemplateService.getVersions(id);
    sendSuccess(res, { versions });
  })
);

/**
 * @swagger
 * /api/email-templates/{id}/versions/{version}:
 *   get:
 *     tags: [Email Templates]
 *     summary: Get a specific version
 *     description: Returns a specific version of an email template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template version details
 *       404:
 *         description: Version not found
 */
router.get(
  '/:id/versions/:version',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const version = parseInt(req.params.version, 10);

    if (isNaN(id) || id <= 0 || isNaN(version) || version <= 0) {
      return errorResponse(res, 'Invalid template ID or version', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const v = await emailTemplateService.getVersion(id, version);
    if (!v) {
      return errorResponse(res, 'Version not found', 404);
    }

    sendSuccess(res, { version: v });
  })
);

/**
 * @swagger
 * /api/email-templates/{id}/versions/{version}/restore:
 *   post:
 *     tags: [Email Templates]
 *     summary: Restore a previous version
 *     description: Restores an email template to a previous version.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: version
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template restored to specified version
 *       404:
 *         description: Version not found
 */
router.post(
  '/:id/versions/:version/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    const version = parseInt(req.params.version, 10);

    if (isNaN(id) || id <= 0 || isNaN(version) || version <= 0) {
      return errorResponse(res, 'Invalid template ID or version', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await emailTemplateService.restoreVersion(id, version, req.user?.email);
    if (!template) {
      return errorResponse(res, 'Version not found', 404);
    }

    sendSuccess(res, { template }, `Template restored to version ${version}`);
  })
);

// =====================================================
// PREVIEW AND TESTING
// =====================================================

/**
 * @swagger
 * /api/email-templates/{id}/preview:
 *   post:
 *     tags: [Email Templates]
 *     summary: Preview a template
 *     description: Renders a preview of an email template with sample data.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sample_data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Template preview with rendered content
 *       404:
 *         description: Template not found
 */
router.post(
  '/:id/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const template = await emailTemplateService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    // Use provided sample data or generate from variables
    const sampleData =
      req.body.sample_data || emailTemplateService.generateSampleData(template.variables);

    const preview = await emailTemplateService.previewTemplate(id, sampleData);

    sendSuccess(res, { preview, sample_data: sampleData });
  })
);

/**
 * @swagger
 * /api/email-templates/preview:
 *   post:
 *     tags: [Email Templates]
 *     summary: Preview raw template content
 *     description: Renders a preview of raw template content before saving.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, body_html]
 *             properties:
 *               subject:
 *                 type: string
 *               body_html:
 *                 type: string
 *               body_text:
 *                 type: string
 *               variables:
 *                 type: array
 *                 items:
 *                   type: string
 *               sample_data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Rendered preview
 *       400:
 *         description: Missing required fields
 */
router.post(
  '/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { subject, body_html, body_text, variables, sample_data } = req.body;

    if (!subject || !body_html) {
      return errorResponse(res, 'subject and body_html are required', 400);
    }

    // Generate sample data from variables if not provided
    const data = sample_data || emailTemplateService.generateSampleData(variables || []);

    const preview = emailTemplateService.previewContent(
      subject,
      body_html,
      body_text || null,
      data
    );

    sendSuccess(res, { preview, sample_data: data });
  })
);

/**
 * @swagger
 * /api/email-templates/{id}/test:
 *   post:
 *     tags: [Email Templates]
 *     summary: Send a test email
 *     description: Sends a test email using the template with sample data.
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
 *             required: [to_email]
 *             properties:
 *               to_email:
 *                 type: string
 *               sample_data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Test email sent
 *       404:
 *         description: Template not found
 */
router.post(
  '/:id/test',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { to_email, sample_data } = req.body;

    if (!to_email) {
      return errorResponse(res, 'to_email is required', 400);
    }

    const template = await emailTemplateService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    // Generate preview content
    const data = sample_data || emailTemplateService.generateSampleData(template.variables);

    const preview = await emailTemplateService.previewTemplate(id, data);
    if (!preview) {
      return errorResponse(res, 'Failed to generate preview', 500);
    }

    // Log the send attempt (actual sending would use email service)
    await emailTemplateService.logSend(
      template.name,
      to_email,
      null,
      preview.subject,
      'sent', // In production, this would be 'pending' until confirmed
      undefined,
      { is_test: true, sent_by: req.user?.email }
    );

    // In production, this would call the email service to send
    await logger.info(`[EmailTemplates] Test email sent to ${to_email}`, { category: 'EMAIL' });
    await logger.info(`Subject: ${preview.subject}`, { category: 'EMAIL' });

    sendSuccess(res, { preview }, `Test email sent to ${to_email}`);
  })
);

// =====================================================
// SEND LOGS
// =====================================================

/**
 * @swagger
 * /api/email-templates/logs/sends:
 *   get:
 *     tags: [Email Templates]
 *     summary: Get email send logs
 *     description: Returns email send logs with optional filtering.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: templateId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: recipientEmail
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: List of send logs
 */
router.get(
  '/logs/sends',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templateId = req.query.templateId ? parseInt(req.query.templateId as string, 10) : undefined;
    const recipientEmail = req.query.recipientEmail as string | undefined;
    const status = req.query.status as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    // Validate numeric parameters
    if (templateId !== undefined && (isNaN(templateId) || templateId <= 0)) {
      return errorResponse(res, 'Invalid templateId', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const limit = isNaN(limitParam) || limitParam < 1 ? 100 : Math.min(limitParam, 1000);

    const logs = await emailTemplateService.getSendLogs({
      templateId,
      recipientEmail,
      status,
      limit
    });

    sendSuccess(res, { logs });
  })
);

export { router as emailTemplatesRouter };
export default router;
