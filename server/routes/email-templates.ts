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
import { sendSuccess, sendCreated, errorResponse } from '../utils/api-response.js';

const router = express.Router();

// =====================================================
// TEMPLATE MANAGEMENT
// =====================================================

/**
 * Get all email templates
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
 * Get template categories
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
 * Get a specific template
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    const template = await emailTemplateService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    sendSuccess(res, { template });
  })
);

/**
 * Create a new template
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, category, subject, body_html, body_text, variables, is_active } = req.body;

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
 * Update a template
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    const { name, description, category, subject, body_html, body_text, variables, is_active, change_reason } = req.body;

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
      const template = await emailTemplateService.updateTemplate(id, data, req.user?.email, change_reason);
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
 * Delete a template
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
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
 * Get version history for a template
 */
router.get(
  '/:id/versions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    const versions = await emailTemplateService.getVersions(id);
    sendSuccess(res, { versions });
  })
);

/**
 * Get a specific version
 */
router.get(
  '/:id/versions/:version',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const version = parseInt(req.params.version);

    if (isNaN(id) || isNaN(version)) {
      return errorResponse(res, 'Invalid template ID or version', 400);
    }

    const v = await emailTemplateService.getVersion(id, version);
    if (!v) {
      return errorResponse(res, 'Version not found', 404);
    }

    sendSuccess(res, { version: v });
  })
);

/**
 * Restore a previous version
 */
router.post(
  '/:id/versions/:version/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    const version = parseInt(req.params.version);

    if (isNaN(id) || isNaN(version)) {
      return errorResponse(res, 'Invalid template ID or version', 400);
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
 * Preview a template with sample data
 */
router.post(
  '/:id/preview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
    }

    const template = await emailTemplateService.getTemplate(id);
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    // Use provided sample data or generate from variables
    const sampleData = req.body.sample_data ||
      emailTemplateService.generateSampleData(template.variables);

    const preview = await emailTemplateService.previewTemplate(id, sampleData);

    sendSuccess(res, { preview, sample_data: sampleData });
  })
);

/**
 * Preview raw content (before saving)
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
    const data = sample_data ||
      emailTemplateService.generateSampleData(variables || []);

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
 * Send a test email
 */
router.post(
  '/:id/test',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return errorResponse(res, 'Invalid template ID', 400);
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
    const data = sample_data ||
      emailTemplateService.generateSampleData(template.variables);

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
    console.log(`[EmailTemplates] Test email sent to ${to_email}`);
    console.log(`Subject: ${preview.subject}`);

    sendSuccess(res, { preview }, `Test email sent to ${to_email}`);
  })
);

// =====================================================
// SEND LOGS
// =====================================================

/**
 * Get send logs
 */
router.get(
  '/logs/sends',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templateId = req.query.templateId ? parseInt(req.query.templateId as string) : undefined;
    const recipientEmail = req.query.recipientEmail as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

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
