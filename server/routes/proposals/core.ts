/**
 * ===============================================
 * PROPOSAL CORE ROUTES
 * ===============================================
 * @file server/routes/proposals/core.ts
 *
 * Core proposal CRUD and admin management endpoints.
 */

import express, { Request, Response } from 'express';
import {
  asyncHandler,
  authenticateToken,
  requireAdmin,
  canAccessProject,
  canAccessProposal,
  isUserAdmin,
  getString,
  getNumber,
  proposalService,
  userService,
  softDeleteService,
  workflowTriggerService,
  logger,
  ErrorCodes,
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  sendPaginated,
  parsePaginationQuery,
  VALID_PROJECT_TYPES,
  VALID_TIERS,
  VALID_MAINTENANCE,
  VALID_STATUSES
} from './helpers.js';
import { invalidateCache } from '../../middleware/cache.js';
import type {
  AuthenticatedRequest,
  ProposalSubmission
} from './helpers.js';

const router = express.Router();

/**
 * @swagger
 * /api/proposals/config/{projectType}:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/config/:projectType
 *     description: GET /api/proposals/config/:projectType.
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
 *         description: Success
 */
router.get(
  '/config/:projectType',
  asyncHandler(async (req: Request, res: Response) => {
    const { projectType } = req.params;

    if (!VALID_PROJECT_TYPES.includes(projectType)) {
      return errorResponseWithPayload(res, 'Invalid project type', 400, ErrorCodes.VALIDATION_ERROR, {
        validTypes: VALID_PROJECT_TYPES
      });
    }

    // Configuration is handled on the frontend
    // This endpoint can be used for future server-side overrides
    sendSuccess(res, { projectType }, 'Configuration is managed client-side');
  })
);

/**
 * @swagger
 * /api/proposals:
 *   post:
 *     tags: [Proposals]
 *     summary: POST /api/proposals
 *     description: POST /api/proposals.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/',
  authenticateToken,
  invalidateCache(['proposals']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const submission: ProposalSubmission = req.body;

    // Validate required fields
    const requiredFields = [
      'projectId',
      'clientId',
      'projectType',
      'selectedTier',
      'basePrice',
      'finalPrice'
    ];
    const missingFields = requiredFields.filter((field) => !(field in submission));

    if (missingFields.length > 0) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, ErrorCodes.VALIDATION_ERROR, {
        missingFields
      });
    }

    // Verify project exists and get its client_id in one query
    const project = await proposalService.getProjectForProposal(submission.projectId);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Authorization check: verify user can access the project
    if (!(await canAccessProject(req, submission.projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // For non-admins, verify clientId matches the project's actual client
    if (!(await isUserAdmin(req))) {
      if (project.client_id !== submission.clientId) {
        return errorResponse(
          res,
          'Client ID must match the project owner',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // Verify client exists
    if (!(await proposalService.clientExists(submission.clientId))) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Validate pricing
    if (typeof submission.basePrice !== 'number' || submission.basePrice < 0) {
      return errorResponse(res, 'Base price must be a non-negative number', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (typeof submission.finalPrice !== 'number' || submission.finalPrice < 0) {
      return errorResponse(res, 'Final price must be a non-negative number', 400, ErrorCodes.VALIDATION_ERROR);
    }
    if (submission.finalPrice > submission.basePrice * 10) {
      return errorResponse(res, 'Final price seems unreasonably high', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Check for existing active proposal on same project
    const { getDatabase } = await import('../../database/init.js');
    const db = getDatabase();
    const existingProposal = await db.get(
      `SELECT id FROM proposal_requests
       WHERE project_id = ? AND status NOT IN ('rejected', 'expired') AND deleted_at IS NULL
       LIMIT 1`,
      [submission.projectId]
    );
    if (existingProposal) {
      return errorResponse(
        res,
        'An active proposal already exists for this project',
        409,
        ErrorCodes.DUPLICATE_RESOURCE
      );
    }

    // Validate project type
    if (!VALID_PROJECT_TYPES.includes(submission.projectType)) {
      return errorResponse(res, 'Invalid project type', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate tier
    if (!VALID_TIERS.includes(submission.selectedTier)) {
      return errorResponse(res, 'Invalid tier selection', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate maintenance option if provided
    if (submission.maintenanceOption && !VALID_MAINTENANCE.includes(submission.maintenanceOption)) {
      return errorResponse(res, 'Invalid maintenance option', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create proposal in transaction
    const result = await proposalService.createProposal({
      projectId: submission.projectId,
      clientId: submission.clientId,
      projectType: submission.projectType,
      selectedTier: submission.selectedTier,
      basePrice: submission.basePrice,
      finalPrice: submission.finalPrice,
      maintenanceOption: submission.maintenanceOption,
      clientNotes: submission.clientNotes,
      features: submission.features
    });

    await logger.info(
      `[Proposals] Created proposal request ${result} for project ${submission.projectId}`,
      { category: 'PROPOSALS' }
    );

    // Emit workflow event for proposal creation
    await workflowTriggerService.emit('proposal.created', {
      entityId: result,
      triggeredBy: 'client',
      projectId: submission.projectId,
      clientId: submission.clientId,
      selectedTier: submission.selectedTier,
      finalPrice: submission.finalPrice
    });

    sendCreated(
      res,
      {
        proposalId: result,
        projectId: submission.projectId,
        selectedTier: submission.selectedTier,
        finalPrice: submission.finalPrice
      },
      'Proposal submitted successfully'
    );
  })
);

// =====================================================
// CREATE FROM TEMPLATE
// =====================================================

/**
 * @swagger
 * /api/proposals/from-template:
 *   post:
 *     tags: [Proposals]
 *     summary: POST /api/proposals/from-template
 *     description: Create a proposal from the template configuration.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/from-template',
  authenticateToken,
  invalidateCache(['proposals']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId, clientId, projectType, selectedTier, selectedAddonIds, maintenanceOption, clientNotes, budget } = req.body;

    if (!projectId || !clientId || !projectType || !selectedTier || !budget) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, ErrorCodes.VALIDATION_ERROR, {
        required: ['projectId', 'clientId', 'projectType', 'selectedTier', 'budget']
      });
    }

    // Validate budget object
    if (typeof budget.min !== 'number' || typeof budget.max !== 'number' || budget.min < 0 || budget.max < budget.min) {
      return errorResponse(res, 'Budget must have valid min and max numbers (min >= 0, max >= min)', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate project type
    if (!VALID_PROJECT_TYPES.includes(projectType)) {
      return errorResponseWithPayload(res, 'Invalid project type', 400, ErrorCodes.VALIDATION_ERROR, {
        validTypes: VALID_PROJECT_TYPES
      });
    }

    // Validate tier
    if (!VALID_TIERS.includes(selectedTier)) {
      return errorResponse(res, 'Invalid tier selection', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate maintenance option if provided
    if (maintenanceOption && !VALID_MAINTENANCE.includes(maintenanceOption)) {
      return errorResponse(res, 'Invalid maintenance option', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify project exists and user has access
    const project = await proposalService.getProjectForProposal(projectId);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    if (!(await canAccessProject(req, projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Verify client exists
    if (!(await proposalService.clientExists(clientId))) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Check for existing active proposal on same project
    const { getDatabase } = await import('../../database/init.js');
    const db = getDatabase();
    const existingProposal = await db.get(
      `SELECT id FROM proposal_requests
       WHERE project_id = ? AND status NOT IN ('rejected', 'expired') AND deleted_at IS NULL
       LIMIT 1`,
      [projectId]
    );
    if (existingProposal) {
      return errorResponse(
        res,
        'An active proposal already exists for this project',
        409,
        ErrorCodes.DUPLICATE_RESOURCE
      );
    }

    // Build proposal from template
    const { buildProposalFromTemplate } = await import('../../config/proposal-templates.js');
    const templateResult = buildProposalFromTemplate({
      projectType,
      tier: selectedTier,
      budget: { min: budget.min, max: budget.max },
      selectedAddonIds: selectedAddonIds || [],
      maintenanceOption
    });

    if (!templateResult) {
      return errorResponse(res, 'Invalid project type or tier for template', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Create proposal
    const result = await proposalService.createProposal({
      projectId,
      clientId,
      projectType,
      selectedTier,
      basePrice: templateResult.tierPrice,
      finalPrice: templateResult.finalPrice,
      maintenanceOption: templateResult.maintenanceOption,
      clientNotes: clientNotes || null,
      features: templateResult.features
    });

    await logger.info(
      `[Proposals] Created proposal from template ${result} for project ${projectId} (${projectType}/${selectedTier})`,
      { category: 'PROPOSALS' }
    );

    // Emit workflow event for proposal creation
    await workflowTriggerService.emit('proposal.created', {
      entityId: result,
      triggeredBy: 'admin',
      projectId,
      clientId,
      selectedTier,
      finalPrice: templateResult.finalPrice
    });

    sendCreated(
      res,
      {
        proposalId: result,
        projectId,
        selectedTier,
        tierPrice: templateResult.tierPrice,
        finalPrice: templateResult.finalPrice,
        allTierPrices: templateResult.allTierPrices,
        featuresCount: templateResult.features.length
      },
      'Proposal created from template'
    );
  })
);

// =====================================================
// PROPOSAL EXPORT
// =====================================================

/**
 * GET /api/proposals/:id/export
 * Export full proposal data as JSON
 */
router.get(
  '/:id/export',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const proposal = await proposalService.getProposalWithJoins(proposalId);

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const features = await proposalService.getProposalFeatures(proposalId);

    const p = proposal as unknown as Record<string, unknown>;

    const exportData = {
      exportedAt: new Date().toISOString(),
      proposal: {
        id: getNumber(p, 'id'),
        projectId: getNumber(p, 'project_id'),
        clientId: getNumber(p, 'client_id'),
        projectType: getString(p, 'project_type'),
        selectedTier: getString(p, 'selected_tier'),
        basePrice: getNumber(p, 'base_price'),
        finalPrice: getNumber(p, 'final_price'),
        maintenanceOption: proposal.maintenance_option,
        status: getString(p, 'status'),
        clientNotes: proposal.client_notes,
        adminNotes: proposal.admin_notes,
        createdAt: getString(p, 'created_at'),
        reviewedAt: proposal.reviewed_at,
        reviewedBy: proposal.reviewed_by,
        project: {
          name: getString(p, 'project_name')
        },
        client: {
          name: getString(p, 'client_name'),
          email: getString(p, 'client_email'),
          company: proposal.company_name
        }
      },
      features: features.map((f) => {
        const fr = f as unknown as Record<string, unknown>;
        return {
          featureId: getString(fr, 'feature_id'),
          featureName: getString(fr, 'feature_name'),
          featurePrice: getNumber(fr, 'feature_price'),
          featureCategory: f.feature_category,
          isIncludedInTier: Boolean(f.is_included_in_tier),
          isAddon: Boolean(f.is_addon)
        };
      })
    };

    sendSuccess(res, exportData);
  })
);

// =====================================================
// PROPOSAL PREFILL FROM QUESTIONNAIRES
// =====================================================

/**
 * @swagger
 * /api/proposals/prefill/{projectId}:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/prefill/:projectId
 *     description: Get proposal prefill data from questionnaire responses.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/prefill/:projectId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return errorResponse(res, 'Invalid project ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { generateProposalPrefill } = await import('../../services/proposal-prefill-service.js');
    const prefill = await generateProposalPrefill(projectId);

    if (!prefill) {
      return errorResponse(res, 'Project not found or no questionnaire data available', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    sendSuccess(res, prefill);
  })
);

// =====================================================
// CLIENT PROPOSAL ACCEPTANCE
// =====================================================

/**
 * @swagger
 * /api/proposals/{id}/accept:
 *   post:
 *     tags: [Proposals]
 *     summary: POST /api/proposals/:id/accept
 *     description: Client accepts a proposal (selects a tier).
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
 *         description: Proposal accepted
 *       400:
 *         description: Cannot accept proposal in current status
 *       404:
 *         description: Proposal not found
 */
router.post(
  '/:id/accept',
  authenticateToken,
  invalidateCache(['proposals']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Verify client can access this proposal
    if (!(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Get proposal
    const proposal = await proposalService.getProposalWithJoins(proposalId);
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const p = proposal as unknown as Record<string, unknown>;
    const currentStatus = getString(p, 'status');

    // Can only accept proposals that are in 'sent' or 'pending' or 'reviewed' status
    const acceptableStatuses = ['sent', 'pending', 'reviewed'];
    if (!acceptableStatuses.includes(currentStatus)) {
      return errorResponse(
        res,
        `Cannot accept proposal in '${currentStatus}' status`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Update proposal status to accepted
    await proposalService.updateProposal(proposalId, {
      status: 'accepted',
      reviewerEmail: req.user?.email || 'client',
      reviewedByUserId: null
    });

    // Log activity
    try {
      await proposalService.logActivity(
        proposalId,
        'status_changed',
        req.user?.email || 'client',
        'client',
        { previousStatus: currentStatus, newStatus: 'accepted' }
      );
    } catch {
      // Non-critical — activity logging should not block acceptance
    }

    // Emit workflow event — triggers project creation, milestones, contract, payment schedule
    await workflowTriggerService.emit('proposal.accepted', {
      entityId: proposalId,
      triggeredBy: req.user?.email || 'client'
    });

    await logger.info(`[Proposals] Client accepted proposal ${proposalId}`, {
      category: 'PROPOSALS'
    });

    sendSuccess(res, { proposalId, status: 'accepted' }, 'Proposal accepted successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/:id
 *     description: GET /api/proposals/:id.
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
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const proposalId = parseInt(id, 10);

    // Validate ID
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check: only admin or owning client can view
    if (!(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const proposal = await proposalService.getProposalWithJoins(proposalId);

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Get feature selections
    const features = await proposalService.getProposalFeatures(proposalId);

    // Cast proposal for helper functions
    const p = proposal as unknown as Record<string, unknown>;

    sendSuccess(res, {
      id: getNumber(p, 'id'),
      projectId: getNumber(p, 'project_id'),
      clientId: getNumber(p, 'client_id'),
      projectType: getString(p, 'project_type'),
      selectedTier: getString(p, 'selected_tier'),
      basePrice: getNumber(p, 'base_price'),
      finalPrice: getNumber(p, 'final_price'),
      maintenanceOption: proposal.maintenance_option,
      status: getString(p, 'status'),
      clientNotes: proposal.client_notes,
      adminNotes: proposal.admin_notes,
      createdAt: getString(p, 'created_at'),
      reviewedAt: proposal.reviewed_at,
      reviewedBy: proposal.reviewed_by,
      project: {
        name: getString(p, 'project_name')
      },
      client: {
        name: getString(p, 'client_name'),
        email: getString(p, 'client_email'),
        company: proposal.company_name
      },
      features: features.map((f) => {
        const fr = f as unknown as Record<string, unknown>;
        return {
          featureId: getString(fr, 'feature_id'),
          featureName: getString(fr, 'feature_name'),
          featurePrice: getNumber(fr, 'feature_price'),
          featureCategory: f.feature_category,
          isIncludedInTier: Boolean(f.is_included_in_tier),
          isAddon: Boolean(f.is_addon)
        };
      })
    });
  })
);

/**
 * @swagger
 * /api/proposals/{id}:
 *   delete:
 *     tags: [Proposals]
 *     summary: DELETE /api/proposals/:id
 *     description: DELETE /api/proposals/:id.
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
 *         description: Deleted successfully
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['proposals']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteProposal(proposalId, deletedBy);

    if (!result.success) {
      return errorResponse(res, result.message, 404, ErrorCodes.PROPOSAL_NOT_FOUND);
    }

    sendSuccess(res, undefined, result.message);
  })
);

/** Shared handler for admin proposal listing (paginated) */
const adminListHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.query;
  const { page, perPage, limit, offset } = parsePaginationQuery(
    req.query as Record<string, unknown>
  );

  const validStatus = status && VALID_STATUSES.includes(status as string)
    ? (status as string)
    : undefined;

  const { proposals, total } = await proposalService.listProposals({
    status: validStatus,
    limit,
    offset
  });

  const mappedProposals = proposals.map((proposal) => {
    const p = proposal as unknown as Record<string, unknown>;
    return {
      id: getNumber(p, 'id'),
      projectId: getNumber(p, 'project_id'),
      clientId: getNumber(p, 'client_id'),
      projectType: getString(p, 'project_type'),
      selectedTier: getString(p, 'selected_tier'),
      basePrice: getNumber(p, 'base_price'),
      finalPrice: getNumber(p, 'final_price'),
      maintenanceOption: proposal.maintenance_option,
      status: getString(p, 'status'),
      createdAt: getString(p, 'created_at'),
      reviewedAt: proposal.reviewed_at,
      project: {
        name: getString(p, 'project_name')
      },
      client: {
        name: getString(p, 'client_name'),
        email: getString(p, 'client_email'),
        company: proposal.company_name
      }
    };
  });

  sendPaginated(res, mappedProposals, {
    page,
    perPage,
    total
  });
});

/**
 * @swagger
 * /api/proposals:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals
 *     description: List proposals (admin — paginated, filterable by status).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: perPage
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', authenticateToken, requireAdmin, adminListHandler);

/**
 * @swagger
 * /api/proposals/admin/list:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/admin/list
 *     description: List all proposals for admin (paginated).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/admin/list', authenticateToken, requireAdmin, adminListHandler);

/**
 * @swagger
 * /api/proposals/admin/all:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/admin/all
 *     description: List all proposals for admin (paginated). Alias for /admin/list.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/admin/all', authenticateToken, requireAdmin, adminListHandler);

/**
 * @swagger
 * /api/proposals/admin/{id}:
 *   put:
 *     tags: [Proposals]
 *     summary: PUT /api/admin/proposals/:id
 *     description: PUT /api/admin/proposals/:id.
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
router.put(
  '/admin/:id',
  authenticateToken,
  requireAdmin,
  invalidateCache(['proposals']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const proposalId = parseInt(id, 10);

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      return errorResponseWithPayload(res, 'Invalid status', 400, ErrorCodes.INVALID_STATUS, {
        validStatuses: VALID_STATUSES
      });
    }

    // Verify proposal exists
    if (!(await proposalService.proposalExists(proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Build update data
    const reviewerEmail = req.user?.email || 'admin';
    let reviewedByUserId: number | null = null;

    if (status) {
      reviewedByUserId = await userService.getUserIdByEmail(reviewerEmail);
    }

    if (!status && adminNotes === undefined) {
      return errorResponse(res, 'No updates provided', 400, ErrorCodes.NO_UPDATES);
    }

    await proposalService.updateProposal(proposalId, {
      status,
      adminNotes,
      reviewerEmail: status ? reviewerEmail : undefined,
      reviewedByUserId
    });

    await logger.info(`[Proposals] Updated proposal ${id} - status: ${status || 'unchanged'}`, {
      category: 'PROPOSALS'
    });

    // Emit workflow events for status changes
    if (status === 'accepted') {
      await workflowTriggerService.emit('proposal.accepted', {
        entityId: proposalId,
        triggeredBy: req.user?.email || 'admin'
      });
    } else if (status === 'rejected') {
      await workflowTriggerService.emit('proposal.rejected', {
        entityId: proposalId,
        triggeredBy: req.user?.email || 'admin'
      });
    }

    sendSuccess(res, undefined, 'Proposal updated successfully');
  })
);

/**
 * @swagger
 * /api/proposals/admin/{id}/convert:
 *   post:
 *     tags: [Proposals]
 *     summary: POST /api/admin/proposals/:id/convert
 *     description: POST /api/admin/proposals/:id/convert.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/admin/:id/convert',
  authenticateToken,
  requireAdmin,
  invalidateCache(['proposals']),
  invalidateCache(['invoices']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const proposalId = parseInt(id, 10);

    // Get proposal with full details
    const proposal = await proposalService.getProposalForConversion(proposalId);

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (getString(proposal as unknown as Record<string, unknown>, 'status') !== 'accepted') {
      return errorResponse(
        res,
        'Only accepted proposals can be converted to invoices',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // Get feature selections for line items
    const features = await proposalService.getProposalFeatures(proposalId);

    // Create line items from features
    const lineItems = features.map((f) => {
      const fr = f as unknown as Record<string, unknown>;
      return {
        description: getString(fr, 'feature_name'),
        quantity: 1,
        unitPrice: getNumber(fr, 'feature_price'),
        total: getNumber(fr, 'feature_price')
      };
    });

    const { invoiceId, invoiceNumber } = await proposalService.convertProposalToInvoice(
      proposalId,
      proposal,
      lineItems
    );

    await logger.info(`[Proposals] Converted proposal ${id} to invoice ${invoiceNumber}`, {
      category: 'PROPOSALS'
    });

    sendSuccess(res, { invoiceId, invoiceNumber }, 'Proposal converted to invoice');
  })
);

export { router as coreRouter };
