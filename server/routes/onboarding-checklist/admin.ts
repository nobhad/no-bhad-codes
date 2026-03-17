/**
 * ===============================================
 * ONBOARDING CHECKLIST ADMIN ROUTES
 * ===============================================
 * @file server/routes/onboarding-checklist/admin.ts
 *
 * Admin endpoints for managing onboarding checklists.
 *
 * GET    /admin/all              — List all checklists
 * GET    /admin/templates        — List templates
 * POST   /admin/create           — Create checklist for a project
 * GET    /admin/:id              — Get checklist by ID
 */

import { Router, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { onboardingChecklistService } from '../../services/onboarding-checklist-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import type { JWTAuthRequest } from '../../types/request.js';

const router = Router();

/**
 * GET /api/onboarding-checklist/admin/all
 * List all onboarding checklists.
 */
router.get(
  '/admin/all',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const checklists = await onboardingChecklistService.getAllChecklists();
    sendSuccess(res, { checklists });
  })
);

/**
 * GET /api/onboarding-checklist/admin/templates
 * List onboarding templates.
 */
router.get(
  '/admin/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: JWTAuthRequest, res: Response) => {
    const templates = await onboardingChecklistService.getTemplates();
    sendSuccess(res, { templates });
  })
);

/**
 * POST /api/onboarding-checklist/admin/create
 * Create an onboarding checklist for a project.
 */
router.post(
  '/admin/create',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const { projectId, clientId, templateId, welcomeText } = req.body;

    if (!projectId || !clientId) {
      errorResponse(res, 'projectId and clientId are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const checklistId = await onboardingChecklistService.createChecklist({
      projectId: Number(projectId),
      clientId: Number(clientId),
      templateId: templateId ? Number(templateId) : undefined,
      welcomeText
    });

    sendCreated(res, { checklistId }, 'Onboarding checklist created');
  })
);

/**
 * GET /api/onboarding-checklist/admin/:id
 * Get a specific checklist with steps.
 */
router.get(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: JWTAuthRequest, res: Response) => {
    const checklistId = Number(req.params.id);
    const checklist = await onboardingChecklistService.getChecklist(checklistId);

    if (!checklist) {
      errorResponse(res, 'Checklist not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    sendSuccess(res, { checklist });
  })
);

export default router;
