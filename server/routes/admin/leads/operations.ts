/**
 * ===============================================
 * LEAD ROUTES — OPERATIONS
 * ===============================================
 * Sources, assignment, duplicate detection,
 * bulk operations, and analytics.
 */

import express from 'express';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../../middleware/auth.js';
import { leadService } from '../../../services/lead-service.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../../utils/api-response.js';

const router = express.Router();

// =====================================================
// LEAD SOURCES
// =====================================================

/**
 * @swagger
 * /api/admin/leads/sources:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/sources
 *     description: Get all lead sources.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/sources',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    const sources = await leadService.getLeadSources(includeInactive);
    sendSuccess(res, { sources });
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/source:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/:id/source
 *     description: Set the source for a specific lead.
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
 *         description: Success
 */
router.post(
  '/leads/:id/source',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { sourceId } = req.body;

    if (!sourceId) {
      return errorResponse(res, 'sourceId is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    await leadService.setLeadSource(projectId, sourceId);
    sendSuccess(res, undefined, 'Lead source updated');
  })
);

// =====================================================
// ASSIGNMENT
// =====================================================

/**
 * @swagger
 * /api/admin/leads/{id}/assign:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/:id/assign
 *     description: Assign a lead to a team member.
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
 *         description: Success
 */
router.post(
  '/leads/:id/assign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { assignee } = req.body;

    if (!assignee) {
      return errorResponse(res, 'assignee is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    await leadService.assignLead(projectId, assignee);
    sendSuccess(res, undefined, 'Lead assigned');
  })
);

/**
 * @swagger
 * /api/admin/leads/my-leads:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/my-leads
 *     description: Get leads assigned to the current user.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/my-leads',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const leads = await leadService.getMyLeads(req.user?.email || '');
    sendSuccess(res, { leads });
  })
);

/**
 * @swagger
 * /api/admin/leads/unassigned:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/unassigned
 *     description: Get all unassigned leads.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/unassigned',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const leads = await leadService.getUnassignedLeads();
    sendSuccess(res, { leads });
  })
);

// =====================================================
// DUPLICATE DETECTION
// =====================================================

/**
 * @swagger
 * /api/admin/leads/duplicates:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/duplicates
 *     description: Get all pending duplicate leads.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/duplicates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const duplicates = await leadService.getAllPendingDuplicates();
    sendSuccess(res, { duplicates });
  })
);

/**
 * @swagger
 * /api/admin/leads/{id}/duplicates:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/:id/duplicates
 *     description: Find duplicate leads for a specific lead.
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
 *         description: Success
 */
router.get(
  '/leads/:id/duplicates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const duplicates = await leadService.findDuplicates(projectId);
    sendSuccess(res, { duplicates });
  })
);

/**
 * @swagger
 * /api/admin/leads/duplicates/{id}/resolve:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/duplicates/:id/resolve
 *     description: Resolve a duplicate lead entry.
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
 *         description: Success
 */
router.post(
  '/leads/duplicates/:id/resolve',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const duplicateId = parseInt(req.params.id, 10);
    if (isNaN(duplicateId) || duplicateId <= 0) {
      return errorResponse(res, 'Invalid duplicate ID', 400, ErrorCodes.VALIDATION_ERROR);
    }
    const { status } = req.body;

    if (!status || !['merged', 'not_duplicate', 'dismissed'].includes(status)) {
      return errorResponse(
        res,
        'Valid status is required (merged, not_duplicate, dismissed)',
        400,
        ErrorCodes.INVALID_STATUS
      );
    }

    await leadService.resolveDuplicate(duplicateId, status, req.user?.email || 'admin');
    sendSuccess(res, undefined, 'Duplicate resolved');
  })
);

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * @swagger
 * /api/admin/leads/bulk/status:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/bulk/status
 *     description: Bulk update lead statuses.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/bulk/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, status } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !status) {
      return errorResponse(
        res,
        'projectIds array and status are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const count = await leadService.bulkUpdateStatus(projectIds, status);
    sendSuccess(res, { count }, `Updated ${count} leads`);
  })
);

/**
 * @swagger
 * /api/admin/leads/bulk/assign:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/bulk/assign
 *     description: Bulk assign leads to a team member.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/bulk/assign',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, assignee } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !assignee) {
      return errorResponse(
        res,
        'projectIds array and assignee are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const count = await leadService.bulkAssign(projectIds, assignee);
    sendSuccess(res, { count }, `Assigned ${count} leads`);
  })
);

/**
 * @swagger
 * /api/admin/leads/bulk/move-stage:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/bulk/move-stage
 *     description: Bulk move leads to a pipeline stage.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/bulk/move-stage',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { projectIds, stageId } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || !stageId) {
      return errorResponse(
        res,
        'projectIds array and stageId are required',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const count = await leadService.bulkMoveToStage(projectIds, stageId);
    sendSuccess(res, { count }, `Moved ${count} leads`);
  })
);

/**
 * @swagger
 * /api/admin/leads/bulk/delete:
 *   post:
 *     tags:
 *       - Admin
 *     summary: POST /api/admin/leads/bulk/delete
 *     description: Bulk soft delete leads.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.post(
  '/leads/bulk/delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { leadIds } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return errorResponse(
        res,
        'leadIds array is required and must not be empty',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELDS
      );
    }

    const deletedBy = req.user?.email || 'admin';
    const deleted = await leadService.bulkSoftDeleteLeads(leadIds, deletedBy);

    sendSuccess(res, { deleted }, `Deleted ${deleted} leads`);
  })
);

// =====================================================
// ANALYTICS
// =====================================================

/**
 * @swagger
 * /api/admin/leads/analytics:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/analytics
 *     description: Get lead analytics data.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const analytics = await leadService.getLeadAnalytics();
    sendSuccess(res, { analytics });
  })
);

/**
 * @swagger
 * /api/admin/leads/conversion-funnel:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/conversion-funnel
 *     description: Get lead conversion funnel data.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/conversion-funnel',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const funnel = await leadService.getConversionFunnel();
    sendSuccess(res, { funnel });
  })
);

/**
 * @swagger
 * /api/admin/leads/source-performance:
 *   get:
 *     tags:
 *       - Admin
 *     summary: GET /api/admin/leads/source-performance
 *     description: Get lead source performance data.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/leads/source-performance',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const sources = await leadService.getSourcePerformance();
    sendSuccess(res, { sources });
  })
);

export default router;
