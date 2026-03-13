import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

// Get all templates
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const { projectType, includeInactive } = req.query;
    const templates = await projectService.getTemplates(
      projectType as string | undefined,
      includeInactive === 'true'
    );
    sendSuccess(res, { templates });
  })
);

// Get single template
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);
    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const template = await projectService.getTemplate(templateId);

    if (!template) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.TEMPLATE_NOT_FOUND);
    }

    sendSuccess(res, { template });
  })
);

// Create template
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const { name } = req.body;

    if (!name) {
      return errorResponse(res, 'Template name is required', 400, ErrorCodes.MISSING_NAME);
    }

    const template = await projectService.createTemplate(req.body);
    sendCreated(res, { template }, 'Template created successfully');
  })
);

// Update template
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);
    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const existing = await projectService.getTemplate(templateId);
    if (!existing) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.TEMPLATE_NOT_FOUND);
    }

    const template = await projectService.updateTemplate(templateId, req.body);
    sendSuccess(res, { template }, 'Template updated successfully');
  })
);

// Delete template
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);
    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const existing = await projectService.getTemplate(templateId);
    if (!existing) {
      return errorResponse(res, 'Template not found', 404, ErrorCodes.TEMPLATE_NOT_FOUND);
    }

    await projectService.deleteTemplate(templateId);
    sendSuccess(res, null, 'Template deleted successfully');
  })
);

// Create project from template
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const { templateId, clientId, projectName, startDate, selectedTier, totalAmount } = req.body;

    if (!templateId || !clientId || !projectName || !startDate) {
      return errorResponse(
        res,
        'templateId, clientId, projectName, and startDate are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const result = await projectService.createProjectFromTemplate(
      templateId,
      clientId,
      projectName,
      startDate,
      { selectedTier, totalAmount }
    );

    sendCreated(res, {
      projectId: result.projectId,
      milestoneIds: result.milestoneIds,
      taskIds: result.taskIds,
      checklistId: result.checklistId,
      paymentInstallmentIds: result.paymentInstallmentIds,
      contractId: result.contractId
    }, 'Project created from template successfully');
  })
);

export default router;
