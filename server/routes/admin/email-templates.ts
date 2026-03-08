/**
 * ===============================================
 * ADMIN EMAIL TEMPLATES ROUTES
 * ===============================================
 * @file server/routes/admin/email-templates.ts
 *
 * Admin-specific email template management endpoints.
 * Returns data in the format expected by EmailTemplatesManager.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import {
  emailTemplateService,
  type EmailTemplateCategory
} from '../../services/email-template-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

/**
 * GET /api/admin/email-templates - Get all email templates with stats
 */
router.get(
  '/email-templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const category = req.query.category as EmailTemplateCategory | undefined;
    const templates = await emailTemplateService.getTemplates(category);
    const categories = emailTemplateService.getCategories();

    // Calculate stats
    const stats = {
      total: templates.length,
      active: templates.filter((t) => t.is_active).length,
      categories: categories
    };

    // Return in format expected by frontend
    sendSuccess(res, { templates, stats });
  })
);

/**
 * GET /api/admin/email-templates/:id - Get a specific template
 */
router.get(
  '/email-templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.INVALID_ID);
    }

    const template = await emailTemplateService.getTemplate(templateId);

    if (!template) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { template });
  })
);

/**
 * PUT /api/admin/email-templates/:id - Update a template
 */
router.put(
  '/email-templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.INVALID_ID);
    }

    const { subject, body_html, category, is_active } = req.body;

    const template = await emailTemplateService.updateTemplate(templateId, {
      subject,
      body_html,
      category,
      is_active
    });

    if (!template) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendSuccess(res, { template });
  })
);

export default router;
