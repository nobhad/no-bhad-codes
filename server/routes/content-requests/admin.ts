/**
 * ===============================================
 * CONTENT REQUEST ROUTES - ADMIN
 * ===============================================
 * @file server/routes/content-requests/admin.ts
 *
 * Admin endpoints for managing content request checklists and items.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { contentRequestService } from '../../services/content-request-service.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { validateRequest } from '../../middleware/validation.js';
import { ContentRequestValidationSchemas } from './shared.js';

const router = express.Router();

// =====================================================
// CHECKLISTS
// =====================================================

/**
 * GET /api/content-requests
 * List checklists with optional filters
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectId, clientId } = req.query;

    if (projectId) {
      const checklists = await contentRequestService.getByProject(Number(projectId));
      sendSuccess(res, { checklists });
      return;
    }

    if (clientId) {
      const checklists = await contentRequestService.getByClient(Number(clientId));
      sendSuccess(res, { checklists });
      return;
    }

    // Default: admin overview
    const checklists = await contentRequestService.getAdminOverview();
    sendSuccess(res, { checklists });
  })
);

/**
 * GET /api/content-requests/overview
 * Admin overview of all active checklists with completion stats
 */
router.get(
  '/overview',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const checklists = await contentRequestService.getAdminOverview();
    sendSuccess(res, { checklists });
  })
);

/**
 * GET /api/content-requests/templates
 * List content request templates
 */
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const templates = await contentRequestService.getTemplates(includeInactive);
    sendSuccess(res, { templates });
  })
);

/**
 * POST /api/content-requests/templates
 * Create a content request template
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { name, description, items, project_type } = req.body;
    if (!name || !items) {
      errorResponse(res, 'Name and items are required', 400, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    const template = await contentRequestService.createTemplate({
      name, description, items, projectType: project_type
    });

    sendCreated(res, { template }, 'Template created');
  })
);

/**
 * PUT /api/content-requests/templates/:id
 * Update a content request template
 */
router.put(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const template = await contentRequestService.updateTemplate(Number(req.params.id), {
      name: req.body.name,
      description: req.body.description,
      items: req.body.items,
      projectType: req.body.project_type,
      isActive: req.body.is_active
    });
    sendSuccess(res, { template }, 'Template updated');
  })
);

/**
 * DELETE /api/content-requests/templates/:id
 * Delete a content request template
 */
router.delete(
  '/templates/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    await contentRequestService.deleteTemplate(Number(req.params.id));
    sendSuccess(res, null, 'Template deleted');
  })
);

/**
 * GET /api/content-requests/:id
 * Get a single checklist with items
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const checklist = await contentRequestService.getChecklist(Number(req.params.id));
    if (!checklist) {
      errorResponse(res, 'Checklist not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }
    sendSuccess(res, { checklist });
  })
);

/**
 * POST /api/content-requests
 * Create a new checklist with items
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(ContentRequestValidationSchemas.createChecklist),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { project_id, client_id, name, description, items, template_id } = req.body;

    let checklist;
    if (template_id) {
      checklist = await contentRequestService.createFromTemplate(
        project_id, client_id, template_id, req.body.start_date
      );
    } else {
      checklist = await contentRequestService.createChecklist(
        project_id, client_id,
        { name, description },
        items?.map((item: { title: string; description?: string; content_type: string; category?: string; is_required?: boolean; due_date?: string }, index: number) => ({
          title: item.title,
          description: item.description,
          contentType: item.content_type,
          category: item.category,
          isRequired: item.is_required,
          dueDate: item.due_date,
          sortOrder: index
        }))
      );
    }

    sendCreated(res, { checklist }, 'Content checklist created');
  })
);

/**
 * PUT /api/content-requests/:id
 * Update a checklist
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateRequest(ContentRequestValidationSchemas.updateChecklist),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const checklist = await contentRequestService.updateChecklist(Number(req.params.id), {
      name: req.body.name,
      description: req.body.description,
      status: req.body.status
    });
    sendSuccess(res, { checklist }, 'Checklist updated');
  })
);

/**
 * DELETE /api/content-requests/:id
 * Delete a checklist
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    await contentRequestService.deleteChecklist(Number(req.params.id));
    sendSuccess(res, null, 'Checklist deleted');
  })
);

// =====================================================
// ITEMS (admin)
// =====================================================

/**
 * POST /api/content-requests/:checklistId/items
 * Add an item to a checklist
 */
router.post(
  '/:checklistId/items',
  authenticateToken,
  requireAdmin,
  validateRequest(ContentRequestValidationSchemas.createItem),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const checklist = await contentRequestService.getChecklist(Number(req.params.checklistId));
    if (!checklist) {
      errorResponse(res, 'Checklist not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
      return;
    }

    const item = await contentRequestService.addItem(
      checklist.id, checklist.projectId, checklist.clientId,
      {
        title: req.body.title,
        description: req.body.description,
        contentType: req.body.content_type,
        category: req.body.category,
        isRequired: req.body.is_required,
        dueDate: req.body.due_date
      }
    );

    sendCreated(res, { item }, 'Item added');
  })
);

/**
 * PUT /api/content-requests/items/:itemId
 * Update an item
 */
router.put(
  '/items/:itemId',
  authenticateToken,
  requireAdmin,
  validateRequest(ContentRequestValidationSchemas.updateItem),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const item = await contentRequestService.updateItem(Number(req.params.itemId), {
      title: req.body.title,
      description: req.body.description,
      dueDate: req.body.due_date,
      isRequired: req.body.is_required,
      adminNotes: req.body.admin_notes
    });
    sendSuccess(res, { item }, 'Item updated');
  })
);

/**
 * DELETE /api/content-requests/items/:itemId
 * Delete an item
 */
router.delete(
  '/items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    await contentRequestService.deleteItem(Number(req.params.itemId));
    sendSuccess(res, null, 'Item deleted');
  })
);

/**
 * POST /api/content-requests/items/:itemId/accept
 * Accept a submitted item
 */
router.post(
  '/items/:itemId/accept',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const item = await contentRequestService.acceptItem(Number(req.params.itemId));

    await workflowTriggerService.emit('content_request.accepted', {
      entityId: item.id,
      triggeredBy: req.user?.email,
      checklistId: item.checklistId,
      clientId: item.clientId,
      projectId: item.projectId
    });

    sendSuccess(res, { item }, 'Item accepted');
  })
);

/**
 * POST /api/content-requests/items/:itemId/request-revision
 * Request revision on a submitted item
 */
router.post(
  '/items/:itemId/request-revision',
  authenticateToken,
  requireAdmin,
  validateRequest(ContentRequestValidationSchemas.requestRevision),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const item = await contentRequestService.requestRevision(
      Number(req.params.itemId),
      req.body.notes
    );

    await workflowTriggerService.emit('content_request.revision_needed', {
      entityId: item.id,
      triggeredBy: req.user?.email,
      checklistId: item.checklistId,
      clientId: item.clientId,
      notes: req.body.notes
    });

    sendSuccess(res, { item }, 'Revision requested');
  })
);

export default router;
