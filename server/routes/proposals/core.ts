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
  getDatabase,
  getString,
  getNumber,
  notDeleted,
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
  FEATURE_SELECTION_COLUMNS,
  VALID_PROJECT_TYPES,
  VALID_TIERS,
  VALID_MAINTENANCE,
  VALID_STATUSES
} from './helpers.js';
import type {
  AuthenticatedRequest,
  ProposalSubmission,
  ProposalRow,
  FeatureRow
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

    const db = getDatabase();

    // Verify project exists and get its client_id in one query
    const project = await db.get(
      'SELECT id, client_id FROM projects WHERE id = ? AND deleted_at IS NULL',
      [submission.projectId]
    );
    if (!project) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Authorization check: verify user can access the project
    if (!(await canAccessProject(req, submission.projectId))) {
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // For non-admins, verify clientId matches the project's actual client
    if (!(await isUserAdmin(req))) {
      const projectClientId = (project as { client_id: number }).client_id;
      if (projectClientId !== submission.clientId) {
        return errorResponse(
          res,
          'Client ID must match the project owner',
          400,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // Verify client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [submission.clientId]);
    if (!client) {
      return errorResponse(res, 'Client not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
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
    const result = await db.transaction(async (ctx) => {
      // Insert proposal request
      const proposalResult = await ctx.run(
        `INSERT INTO proposal_requests (
          project_id, client_id, project_type, selected_tier,
          base_price, final_price, maintenance_option,
          status, client_notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`,
        [
          submission.projectId,
          submission.clientId,
          submission.projectType,
          submission.selectedTier,
          submission.basePrice,
          submission.finalPrice,
          submission.maintenanceOption || null,
          submission.clientNotes || null
        ]
      );

      const proposalId = proposalResult.lastID!;

      // Insert feature selections
      if (submission.features && submission.features.length > 0) {
        for (const feature of submission.features) {
          await ctx.run(
            `INSERT INTO proposal_feature_selections (
              proposal_request_id, feature_id, feature_name,
              feature_price, feature_category, is_included_in_tier, is_addon
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              proposalId,
              feature.featureId,
              feature.featureName,
              feature.featurePrice,
              feature.featureCategory || null,
              feature.isIncludedInTier ? 1 : 0,
              feature.isAddon ? 1 : 0
            ]
          );
        }
      }

      return proposalId;
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

    const db = getDatabase();
    const proposal = (await db.get(
      `SELECT pr.*, p.project_name, c.contact_name as client_name, c.email as client_email, c.company_name
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id AND ${notDeleted('p')}
       JOIN clients c ON pr.client_id = c.id AND ${notDeleted('c')}
       WHERE pr.id = ? AND ${notDeleted('pr')}`,
      [proposalId]
    )) as ProposalRow | undefined;

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Get feature selections
    const features = (await db.all(
      `SELECT ${FEATURE_SELECTION_COLUMNS} FROM proposal_feature_selections WHERE proposal_request_id = ?`,
      [id]
    )) as unknown as FeatureRow[];

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

/**
 * @swagger
 * /api/proposals/admin/list:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/admin/proposals
 *     description: GET /api/admin/proposals.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/admin/list',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    const { status } = req.query;
    const { page, perPage, limit, offset } = parsePaginationQuery(
      req.query as Record<string, unknown>
    );

    let query = `
      SELECT pr.*, p.project_name, c.contact_name as client_name, c.email as client_email, c.company_name
      FROM proposal_requests pr
      JOIN projects p ON pr.project_id = p.id AND ${notDeleted('p')}
      JOIN clients c ON pr.client_id = c.id AND ${notDeleted('c')}
      WHERE ${notDeleted('pr')}
    `;
    const params: (string | number)[] = [];

    if (status && VALID_STATUSES.includes(status as string)) {
      query += ' AND pr.status = ?';
      params.push(status as string);
    }

    query += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const proposals = (await db.all(query, params)) as unknown as ProposalRow[];

    // Get total count (excluding soft-deleted)
    let countQuery = `SELECT COUNT(*) as count FROM proposal_requests WHERE ${notDeleted()}`;
    const countParams: string[] = [];
    if (status && VALID_STATUSES.includes(status as string)) {
      countQuery += ' AND status = ?';
      countParams.push(status as string);
    }
    const countResult = (await db.get(countQuery, countParams)) as { count: number };

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
      total: countResult.count
    });
  })
);

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
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const db = getDatabase();

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      return errorResponseWithPayload(res, 'Invalid status', 400, ErrorCodes.INVALID_STATUS, {
        validStatuses: VALID_STATUSES
      });
    }

    // Verify proposal exists
    const proposal = await db.get('SELECT id FROM proposal_requests WHERE id = ?', [id]);
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Build update query
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (status) {
      const reviewerEmail = req.user?.email || 'admin';
      // Look up user ID for reviewed_by during transition period
      const reviewedByUserId = await userService.getUserIdByEmail(reviewerEmail);

      updates.push('status = ?');
      params.push(status);
      updates.push('reviewed_at = datetime(\'now\')');
      updates.push('reviewed_by = ?');
      params.push(reviewerEmail);
      updates.push('reviewed_by_user_id = ?');
      params.push(reviewedByUserId);
    }

    if (adminNotes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(adminNotes);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No updates provided', 400, ErrorCodes.NO_UPDATES);
    }

    params.push(parseInt(id, 10));

    await db.run(`UPDATE proposal_requests SET ${updates.join(', ')} WHERE id = ?`, params);

    await logger.info(`[Proposals] Updated proposal ${id} - status: ${status || 'unchanged'}`, {
      category: 'PROPOSALS'
    });

    // Emit workflow events for status changes
    if (status === 'accepted') {
      await workflowTriggerService.emit('proposal.accepted', {
        entityId: parseInt(id, 10),
        triggeredBy: req.user?.email || 'admin'
      });
    } else if (status === 'rejected') {
      await workflowTriggerService.emit('proposal.rejected', {
        entityId: parseInt(id, 10),
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
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = getDatabase();

    // Get proposal with full details
    const proposal = (await db.get(
      `SELECT pr.*, p.id as project_id, c.id as client_id
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id
       JOIN clients c ON pr.client_id = c.id
       WHERE pr.id = ?`,
      [id]
    )) as ProposalRow | undefined;

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
    const features = (await db.all(
      `SELECT ${FEATURE_SELECTION_COLUMNS} FROM proposal_feature_selections WHERE proposal_request_id = ?`,
      [id]
    )) as unknown as FeatureRow[];

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

    // Generate invoice number
    const invoiceCount = (await db.get('SELECT COUNT(*) as count FROM invoices')) as {
      count: number;
    };
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCount.count + 1).padStart(4, '0')}`;

    // Calculate due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice in transaction
    const invoiceId = await db.transaction(async (ctx) => {
      const result = await ctx.run(
        `INSERT INTO invoices (
          invoice_number, project_id, client_id, amount_total,
          status, due_date, issued_date, line_items, notes, created_at
        ) VALUES (?, ?, ?, ?, 'draft', ?, date('now'), ?, ?, datetime('now'))`,
        [
          invoiceNumber,
          getNumber(proposal as unknown as Record<string, unknown>, 'project_id'),
          getNumber(proposal as unknown as Record<string, unknown>, 'client_id'),
          getNumber(proposal as unknown as Record<string, unknown>, 'final_price'),
          dueDate.toISOString().split('T')[0],
          JSON.stringify(lineItems),
          `Converted from proposal #${id}`
        ]
      );

      // Update proposal status to converted
      await ctx.run(
        'UPDATE proposal_requests SET status = \'converted\', reviewed_at = datetime(\'now\') WHERE id = ?',
        [id]
      );

      return result.lastID!;
    });

    await logger.info(`[Proposals] Converted proposal ${id} to invoice ${invoiceNumber}`, {
      category: 'PROPOSALS'
    });

    sendSuccess(res, { invoiceId, invoiceNumber }, 'Proposal converted to invoice');
  })
);

export { router as coreRouter };
