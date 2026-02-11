import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { projectService } from '../../services/project-service.js';
import { errorResponse } from '../../utils/api-response.js';

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
    const { projectType } = req.query;
    const templates = await projectService.getTemplates(projectType as string | undefined);
    res.json({ templates });
  })
);

// Get single template
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const templateId = parseInt(req.params.templateId);
    const template = await projectService.getTemplate(templateId);

    if (!template) {
      return errorResponse(res, 'Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    res.json({ template });
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
      return errorResponse(res, 'Template name is required', 400, 'MISSING_NAME');
    }

    const template = await projectService.createTemplate(req.body);
    res.status(201).json({ message: 'Template created successfully', template });
  })
);

// Create project from template
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: express.Request, res: Response) => {
    const { templateId, clientId, projectName, startDate } = req.body;

    if (!templateId || !clientId || !projectName || !startDate) {
      return errorResponse(res, 'templateId, clientId, projectName, and startDate are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const result = await projectService.createProjectFromTemplate(
      templateId,
      clientId,
      projectName,
      startDate
    );

    res.status(201).json({
      message: 'Project created from template successfully',
      projectId: result.projectId,
      milestoneIds: result.milestoneIds,
      taskIds: result.taskIds
    });
  })
);

export default router;
