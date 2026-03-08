import { logger } from '../services/logger.js';
/**
 * ===============================================
 * PROPOSAL ROUTES
 * ===============================================
 * @file server/routes/proposals.ts
 *
 * API endpoints for proposal builder functionality.
 * Handles tier configurations, proposal submissions, and admin management.
 */

import express, { Request, Response } from 'express';
import { createRateLimiter } from '../middleware/rate-limiter.js';

// Rate limiter for public signature endpoints (strict: 10 requests per 15 min)
const signatureRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  blockDurationMs: 60 * 60 * 1000 // 1 hour block
});

// Explicit column lists for SELECT queries (avoid SELECT *)
const FEATURE_SELECTION_COLUMNS = `
  id, proposal_request_id, feature_id, feature_name, feature_price,
  feature_category, is_included_in_tier, is_addon, created_at
`.replace(/\s+/g, ' ').trim();

const PROPOSAL_SIGNATURE_COLUMNS = `
  id, proposal_id, signer_name, signer_email, signer_title, signer_company,
  signature_method, signature_data, ip_address, user_agent, signed_at
`.replace(/\s+/g, ' ').trim();
import { PDFDocument as PDFLibDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessProject, canAccessProposal, isUserAdmin } from '../middleware/access-control.js';
import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { proposalService } from '../services/proposal-service.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';
import {
  getPdfCacheKey,
  getCachedPdf,
  cachePdf,
  PdfPageContext,
  ensureSpace,
  addPageNumbers,
  PAGE_MARGINS
} from '../utils/pdf-utils.js';
import { notDeleted } from '../database/query-helpers.js';
import { userService } from '../services/user-service.js';
import { softDeleteService } from '../services/soft-delete-service.js';
import {
  errorResponse,
  errorResponseWithPayload,
  sendSuccess,
  sendCreated,
  sendPaginated,
  parsePaginationQuery
} from '../utils/api-response.js';
import { workflowTriggerService } from '../services/workflow-trigger-service.js';

const router = express.Router();

/**
 * Project type constants (matches frontend)
 */
const VALID_PROJECT_TYPES = [
  'simple-site',
  'business-site',
  'portfolio',
  'e-commerce',
  'ecommerce', // Legacy support
  'web-app',
  'browser-extension',
  'other'
];

/**
 * Valid tier IDs
 */
const VALID_TIERS = ['good', 'better', 'best'];

/**
 * Valid maintenance options
 */
const VALID_MAINTENANCE = ['diy', 'essential', 'standard', 'premium'];

/**
 * Proposal status constants
 */
const VALID_STATUSES = ['pending', 'reviewed', 'accepted', 'rejected', 'converted'];

interface ProposalSubmission {
  projectId: number;
  clientId: number;
  projectType: string;
  selectedTier: string;
  basePrice: number;
  finalPrice: number;
  maintenanceOption?: string | null;
  clientNotes?: string;
  features: Array<{
    featureId: string;
    featureName: string;
    featurePrice: number;
    featureCategory?: string;
    isIncludedInTier: boolean;
    isAddon: boolean;
  }>;
}

interface ProposalRow {
  id: number;
  project_id: number;
  client_id: number;
  project_type: string;
  selected_tier: string;
  base_price: number;
  final_price: number;
  maintenance_option: string | null;
  status: string;
  client_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  signed_at?: string | null;
  terms_and_conditions?: string | null;
  contract_terms?: string | null;
  default_deposit_percentage?: number | null;
  // Joined fields
  project_name?: string;
  client_name?: string;
  client_email?: string;
  company_name?: string;
}

interface FeatureRow {
  id: number;
  proposal_request_id: number;
  feature_id: string;
  feature_name: string;
  feature_price: number;
  feature_category: string | null;
  is_included_in_tier: number;
  is_addon: number;
}

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
      return errorResponseWithPayload(res, 'Invalid project type', 400, 'VALIDATION_ERROR', {
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
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'VALIDATION_ERROR', {
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
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Authorization check: verify user can access the project
    if (!(await canAccessProject(req, submission.projectId))) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // For non-admins, verify clientId matches the project's actual client
    if (!(await isUserAdmin(req))) {
      const projectClientId = (project as { client_id: number }).client_id;
      if (projectClientId !== submission.clientId) {
        return errorResponse(
          res,
          'Client ID must match the project owner',
          400,
          'VALIDATION_ERROR'
        );
      }
    }

    // Verify client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [submission.clientId]);
    if (!client) {
      return errorResponse(res, 'Client not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Validate project type
    if (!VALID_PROJECT_TYPES.includes(submission.projectType)) {
      return errorResponse(res, 'Invalid project type', 400, 'VALIDATION_ERROR');
    }

    // Validate tier
    if (!VALID_TIERS.includes(submission.selectedTier)) {
      return errorResponse(res, 'Invalid tier selection', 400, 'VALIDATION_ERROR');
    }

    // Validate maintenance option if provided
    if (submission.maintenanceOption && !VALID_MAINTENANCE.includes(submission.maintenanceOption)) {
      return errorResponse(res, 'Invalid maintenance option', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check: only admin or owning client can view
    if (!(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
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
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
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
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteProposal(proposalId, deletedBy);

    if (!result.success) {
      return errorResponse(res, result.message, 404, 'PROPOSAL_NOT_FOUND');
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
      return errorResponseWithPayload(res, 'Invalid status', 400, 'INVALID_STATUS', {
        validStatuses: VALID_STATUSES
      });
    }

    // Verify proposal exists
    const proposal = await db.get('SELECT id FROM proposal_requests WHERE id = ?', [id]);
    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
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
      return errorResponse(res, 'No updates provided', 400, 'NO_UPDATES');
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
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    if (getString(proposal as unknown as Record<string, unknown>, 'status') !== 'accepted') {
      return errorResponse(
        res,
        'Only accepted proposals can be converted to invoices',
        400,
        'VALIDATION_ERROR'
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

/**
 * @swagger
 * /api/proposals/{id}/pdf:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/:id/pdf
 *     description: GET /api/proposals/:id/pdf.
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
  '/:id/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const proposalId = parseInt(id, 10);

    // Validate ID
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check: only admin or owning client can download PDF
    if (!(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const db = getDatabase();

    // Get proposal with full details including deposit percentage
    const proposal = (await db.get(
      `SELECT pr.*, p.project_name, p.description as project_description,
              p.default_deposit_percentage,
              c.contact_name as client_name, c.email as client_email, c.company_name
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id
       JOIN clients c ON pr.client_id = c.id
       WHERE pr.id = ?`,
      [proposalId]
    )) as ProposalRow | undefined;

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Check cache first (proposals use created_at as they don't have updated_at)
    const cacheKey = getPdfCacheKey('proposal', id, proposal.created_at);
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const projectName = (proposal.project_name || 'proposal')
        .toString()
        .replace(/[^a-zA-Z0-9]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="proposal-${projectName}-${proposalId}.pdf"`
      );
      res.setHeader('Content-Length', cachedPdf.length);
      res.setHeader('X-PDF-Cache', 'HIT');
      return res.send(Buffer.from(cachedPdf));
    }

    // Cast proposal for helper functions
    const p = proposal as unknown as Record<string, unknown>;

    // Get feature selections
    const features = (await db.all(
      `SELECT ${FEATURE_SELECTION_COLUMNS} FROM proposal_feature_selections WHERE proposal_request_id = ?`,
      [id]
    )) as unknown as FeatureRow[];

    // Get signature data if proposal is signed
    const signature = proposal.signed_at
      ? ((await db.get(
        `SELECT ${PROPOSAL_SIGNATURE_COLUMNS} FROM proposal_signatures WHERE proposal_id = ? ORDER BY signed_at DESC LIMIT 1`,
        [id]
      )) as
          | {
              signer_name?: string;
              signer_email?: string;
              signer_title?: string;
              signature_data?: string;
              signature_method?: string;
              signed_at?: string;
              ip_address?: string;
            }
          | undefined)
      : undefined;

    // Check if proposal is signed for watermark
    const isSigned = Boolean(proposal.signed_at);

    // Helper functions
    const formatDate = (dateStr: string | undefined | null): string => {
      if (!dateStr) {
        return new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatTier = (tier: string): string => {
      const tierNames: Record<string, string> = { good: 'GOOD', better: 'BETTER', best: 'BEST' };
      return tierNames[tier] || tier.toUpperCase();
    };

    const formatMaintenance = (option: string | null): string => {
      if (!option) return 'None';
      const maintenanceNames: Record<string, string> = {
        diy: 'DIY (Self-Managed)',
        essential: 'Essential Plan',
        standard: 'Standard Plan',
        premium: 'Premium Plan'
      };
      return maintenanceNames[option] || option;
    };

    // Create PDF document using pdf-lib with multi-page support
    const pdfDoc = await PDFLibDocument.create();
    pdfDoc.setTitle(`Proposal - ${getString(p, 'project_name')}`);
    pdfDoc.setAuthor(BUSINESS_INFO.name);

    // Embed fonts first
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Create multi-page context
    const pageWidth = 612;
    const pageHeight = 792;
    const currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    const { width, height } = currentPage.getSize();

    // Build context for page break detection
    const ctx: PdfPageContext = {
      pdfDoc,
      currentPage,
      pageNumber: 1,
      y: height - 43,
      width: pageWidth,
      height: pageHeight,
      leftMargin: PAGE_MARGINS.left,
      rightMargin: pageWidth - PAGE_MARGINS.right,
      topMargin: PAGE_MARGINS.top,
      bottomMargin: PAGE_MARGINS.bottom,
      contentWidth: pageWidth - PAGE_MARGINS.left - PAGE_MARGINS.right,
      fonts: { regular: helvetica, bold: helveticaBold }
    };

    // Helper to get current page
    const page = () => ctx.currentPage;

    // Helper for continuation header on new pages
    const drawContinuationHeader = (context: PdfPageContext) => {
      context.currentPage.drawText('Proposal (continued)', {
        x: ctx.leftMargin,
        y: context.y,
        size: 10,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4)
      });
      context.y -= 20;
    };

    // Layout constants
    const leftMargin = ctx.leftMargin;
    const rightMargin = ctx.rightMargin;

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100; // ~1.4 inch for prominent branding

    // PROPOSAL title on left: 28pt
    const titleText = 'PROPOSAL';
    page().drawText(titleText, {
      x: leftMargin,
      y: ctx.y - 20,
      size: 28,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15)
    });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const logoBytes = getPdfLogoBytes();
    if (logoBytes) {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = rightMargin - logoWidth - 150;
      page().drawImage(logoImage, {
        x: logoX,
        y: ctx.y - logoHeight + 10,
        width: logoWidth,
        height: logoHeight
      });
      textStartX = logoX + logoWidth + 18;
    }

    // Business info (left-aligned, to right of logo)
    page().drawText(BUSINESS_INFO.name, {
      x: textStartX,
      y: ctx.y - 11,
      size: 15,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    page().drawText(BUSINESS_INFO.owner, {
      x: textStartX,
      y: ctx.y - 34,
      size: 10,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2)
    });
    page().drawText(BUSINESS_INFO.tagline, {
      x: textStartX,
      y: ctx.y - 54,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });
    page().drawText(BUSINESS_INFO.email, {
      x: textStartX,
      y: ctx.y - 70,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });
    page().drawText(BUSINESS_INFO.website, {
      x: textStartX,
      y: ctx.y - 86,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });

    ctx.y -= 120; // Account for 100pt logo height

    // Divider line
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    });
    ctx.y -= 21;

    // === PROPOSAL INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Prepared For
    page().drawText('Prepared For:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });
    page().drawText(getString(p, 'client_name') || 'Client', {
      x: leftMargin,
      y: ctx.y - 15,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    let clientLineY = ctx.y - 30;
    if (proposal.company_name) {
      page().drawText(proposal.company_name, {
        x: leftMargin,
        y: clientLineY,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0)
      });
      clientLineY -= 15;
    }
    page().drawText(getString(p, 'client_email') || '', {
      x: leftMargin,
      y: clientLineY,
      size: 10,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3)
    });

    // Right side - Prepared By & Date
    page().drawText('Prepared By:', {
      x: rightCol,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });
    page().drawText(BUSINESS_INFO.name, {
      x: rightCol,
      y: ctx.y - 15,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    page().drawText('Date:', {
      x: rightCol,
      y: ctx.y - 45,
      size: 10,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2)
    });
    page().drawText(formatDate(getString(p, 'created_at')), {
      x: rightCol,
      y: ctx.y - 60,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });

    ctx.y -= 90;

    // === PROJECT DETAILS ===
    page().drawText('Project Details', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0.4, 0.8)
    });
    ctx.y -= 18;

    page().drawText('Project:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    page().drawText(getString(p, 'project_name'), {
      x: leftMargin + 55,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 15;

    page().drawText('Project Type:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    page().drawText(
      getString(p, 'project_type')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      { x: leftMargin + 80, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) }
    );
    ctx.y -= 25;

    // === SELECTED PACKAGE ===
    page().drawText('Selected Package', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0.4, 0.8)
    });
    ctx.y -= 18;

    const selectedTier = formatTier(getString(p, 'selected_tier'));
    page().drawText(`${selectedTier} Tier`, {
      x: leftMargin,
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 15;
    page().drawText(`Base Price: $${getNumber(p, 'base_price').toLocaleString()}`, {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 20;

    // === INCLUDED FEATURES ===
    const includedFeatures = features.filter((f) => f.is_included_in_tier);
    if (includedFeatures.length > 0) {
      page().drawText('Included Features:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
      ctx.y -= 15;
      for (const f of includedFeatures) {
        // Check for page break before each feature
        ensureSpace(ctx, 12, drawContinuationHeader);
        const fr = f as unknown as Record<string, unknown>;
        page().drawText(`• ${getString(fr, 'feature_name')}`, {
          x: leftMargin + 10,
          y: ctx.y,
          size: 10,
          font: helvetica,
          color: rgb(0, 0, 0)
        });
        ctx.y -= 12;
      }
      ctx.y -= 8;
    }

    // === ADD-ONS ===
    const addons = features.filter((f) => f.is_addon);
    if (addons.length > 0) {
      // Check for page break before add-ons section
      ensureSpace(ctx, 30, drawContinuationHeader);
      page().drawText('Add-Ons:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
      ctx.y -= 15;
      for (const f of addons) {
        // Check for page break before each add-on
        ensureSpace(ctx, 12, drawContinuationHeader);
        const fr = f as unknown as Record<string, unknown>;
        const price = getNumber(fr, 'feature_price');
        page().drawText(`• ${getString(fr, 'feature_name')} - $${price.toLocaleString()}`, {
          x: leftMargin + 10,
          y: ctx.y,
          size: 10,
          font: helvetica,
          color: rgb(0, 0, 0)
        });
        ctx.y -= 12;
      }
      ctx.y -= 8;
    }

    // === MAINTENANCE OPTION ===
    if (proposal.maintenance_option) {
      ensureSpace(ctx, 40, drawContinuationHeader);
      page().drawText('Maintenance Plan:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
      ctx.y -= 15;
      page().drawText(formatMaintenance(proposal.maintenance_option), {
        x: leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0)
      });
      ctx.y -= 20;
    }

    // === PRICING SUMMARY ===
    // Ensure pricing summary fits on current page
    ensureSpace(ctx, 100, drawContinuationHeader);
    ctx.y -= 10;
    page().drawText('Pricing Summary', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0.4, 0.8)
    });
    ctx.y -= 18;

    page().drawText('Base Package Price:', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    const basePriceText = `$${getNumber(p, 'base_price').toLocaleString()}`;
    page().drawText(basePriceText, {
      x: rightMargin - helvetica.widthOfTextAtSize(basePriceText, 10),
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 15;

    if (addons.length > 0) {
      const addonsTotal = addons.reduce((sum, f) => sum + (f.feature_price || 0), 0);
      page().drawText('Add-Ons:', {
        x: leftMargin,
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0)
      });
      const addonsTotalText = `$${addonsTotal.toLocaleString()}`;
      page().drawText(addonsTotalText, {
        x: rightMargin - helvetica.widthOfTextAtSize(addonsTotalText, 10),
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0)
      });
      ctx.y -= 15;
    }

    // Line
    ctx.y -= 5;
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: 1,
      color: rgb(0.2, 0.2, 0.2)
    });
    ctx.y -= 15;

    // Total
    page().drawText('Total:', {
      x: leftMargin,
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    const totalText = `$${getNumber(p, 'final_price').toLocaleString()}`;
    page().drawText(totalText, {
      x: rightMargin - helveticaBold.widthOfTextAtSize(totalText, 12),
      y: ctx.y,
      size: 12,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });

    // === PAYMENT SCHEDULE ===
    ctx.y -= 35;
    ensureSpace(ctx, 100, drawContinuationHeader);
    page().drawText('Payment Schedule', {
      x: leftMargin,
      y: ctx.y,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0.4, 0.8)
    });
    ctx.y -= 20;

    // Calculate payment amounts based on deposit percentage (default 50%)
    const finalPrice = getNumber(p, 'final_price');
    const depositPercentage = proposal.default_deposit_percentage || 50;
    const depositAmount = Math.round(finalPrice * (depositPercentage / 100));
    const finalPayment = finalPrice - depositAmount;

    // Draw payment schedule table
    const colWidth = ctx.contentWidth / 3;
    const paymentRowHeight = 18;

    // Table header
    page().drawText('Payment', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    page().drawText('When Due', {
      x: leftMargin + colWidth,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    page().drawText('Amount', {
      x: rightMargin - 70,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3)
    });
    ctx.y -= 5;

    // Header underline
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    ctx.y -= paymentRowHeight;

    // Row 1: Deposit
    page().drawText('1. Deposit', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    page().drawText('Upon contract signing', {
      x: leftMargin + colWidth,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });
    const depositText = `$${depositAmount.toLocaleString()}`;
    page().drawText(depositText, {
      x: rightMargin - helvetica.widthOfTextAtSize(depositText, 10),
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 5;

    // Row separator
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: 0.25,
      color: rgb(0.85, 0.85, 0.85)
    });
    ctx.y -= paymentRowHeight;

    // Row 2: Final Payment
    page().drawText('2. Final Payment', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    page().drawText('Upon project completion', {
      x: leftMargin + colWidth,
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });
    const finalPaymentText = `$${finalPayment.toLocaleString()}`;
    page().drawText(finalPaymentText, {
      x: rightMargin - helvetica.widthOfTextAtSize(finalPaymentText, 10),
      y: ctx.y,
      size: 10,
      font: helvetica,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 5;

    // Bottom line
    page().drawLine({
      start: { x: leftMargin, y: ctx.y },
      end: { x: rightMargin, y: ctx.y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });
    ctx.y -= paymentRowHeight;

    // Total row
    page().drawText('Total Project Investment', {
      x: leftMargin,
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    const totalInvestmentText = `$${finalPrice.toLocaleString()}`;
    page().drawText(totalInvestmentText, {
      x: rightMargin - helveticaBold.widthOfTextAtSize(totalInvestmentText, 10),
      y: ctx.y,
      size: 10,
      font: helveticaBold,
      color: rgb(0, 0, 0)
    });
    ctx.y -= 15;

    // Payment note
    page().drawText(
      `Deposit (${depositPercentage}%) required to begin work. Balance due upon delivery.`,
      {
        x: leftMargin,
        y: ctx.y,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      }
    );

    // === CLIENT NOTES ===
    if (proposal.client_notes) {
      ctx.y -= 35;
      ensureSpace(ctx, 30, drawContinuationHeader);
      page().drawText('Client Notes:', {
        x: leftMargin,
        y: ctx.y,
        size: 12,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
      ctx.y -= 15;
      page().drawText(proposal.client_notes, {
        x: leftMargin + 10,
        y: ctx.y,
        size: 10,
        font: helvetica,
        color: rgb(0, 0, 0)
      });
    }

    // === TERMS & CONDITIONS ===
    const termsText = proposal.terms_and_conditions || proposal.contract_terms;
    if (termsText) {
      ctx.y -= 35;
      ensureSpace(ctx, 80, drawContinuationHeader);
      page().drawText('Terms & Conditions', {
        x: leftMargin,
        y: ctx.y,
        size: 14,
        font: helveticaBold,
        color: rgb(0, 0.4, 0.8)
      });
      ctx.y -= 18;

      // Split terms into lines and render each
      const termsLines = termsText.split('\n').filter((line: string) => line.trim());
      for (const line of termsLines) {
        ensureSpace(ctx, 14, drawContinuationHeader);
        // Wrap long lines
        const maxLineWidth = ctx.contentWidth - 20;
        const words = line.trim().split(' ');
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = helvetica.widthOfTextAtSize(testLine, 9);
          if (testWidth > maxLineWidth && currentLine) {
            page().drawText(currentLine, {
              x: leftMargin + 10,
              y: ctx.y,
              size: 9,
              font: helvetica,
              color: rgb(0.3, 0.3, 0.3)
            });
            ctx.y -= 12;
            ensureSpace(ctx, 12, drawContinuationHeader);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          page().drawText(currentLine, {
            x: leftMargin + 10,
            y: ctx.y,
            size: 9,
            font: helvetica,
            color: rgb(0.3, 0.3, 0.3)
          });
          ctx.y -= 12;
        }
      }
      ctx.y -= 10;
    }

    // === SIGNATURE BLOCK (if signed) ===
    if (isSigned && signature) {
      ctx.y -= 25;
      ensureSpace(ctx, 120, drawContinuationHeader);

      // Signature section header
      page().drawText('Authorization & Signature', {
        x: leftMargin,
        y: ctx.y,
        size: 14,
        font: helveticaBold,
        color: rgb(0, 0.4, 0.8)
      });
      ctx.y -= 20;

      // Draw signature box
      const sigBoxY = ctx.y;
      const sigBoxHeight = 80;
      page().drawRectangle({
        x: leftMargin,
        y: sigBoxY - sigBoxHeight,
        width: ctx.contentWidth,
        height: sigBoxHeight,
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98)
      });

      // Embed signature image if available (drawn signature)
      if (signature.signature_data && signature.signature_method === 'drawn') {
        try {
          // signature_data is base64 PNG data
          const sigDataUrl = signature.signature_data;
          const base64Data = sigDataUrl.replace(/^data:image\/png;base64,/, '');
          const sigImageBytes = Buffer.from(base64Data, 'base64');
          const sigImage = await pdfDoc.embedPng(sigImageBytes);

          // Scale signature to fit in box (max 200x50)
          const maxSigWidth = 200;
          const maxSigHeight = 50;
          const sigAspect = sigImage.width / sigImage.height;
          let sigWidth = Math.min(sigImage.width, maxSigWidth);
          let sigHeight = sigWidth / sigAspect;
          if (sigHeight > maxSigHeight) {
            sigHeight = maxSigHeight;
            sigWidth = sigHeight * sigAspect;
          }

          // Center signature in left portion of box
          const sigX = leftMargin + 20;
          const sigY = sigBoxY - sigBoxHeight / 2 - sigHeight / 2 + 10;
          page().drawImage(sigImage, { x: sigX, y: sigY, width: sigWidth, height: sigHeight });
        } catch (sigError) {
          await logger.error('[PDF] Failed to embed signature image:', {
            error: sigError instanceof Error ? sigError : undefined,
            category: 'PROPOSALS'
          });
        }
      } else if (signature.signature_data && signature.signature_method === 'typed') {
        // Typed signature - render as stylized text
        const typedSig = signature.signature_data;
        page().drawText(typedSig, {
          x: leftMargin + 20,
          y: sigBoxY - 45,
          size: 24,
          font: helvetica,
          color: rgb(0, 0, 0.6)
        });
      }

      // Signer details on right side of box
      const detailsX = leftMargin + ctx.contentWidth / 2 + 20;
      let detailsY = sigBoxY - 20;

      page().drawText(signature.signer_name || 'Unknown', {
        x: detailsX,
        y: detailsY,
        size: 11,
        font: helveticaBold,
        color: rgb(0, 0, 0)
      });
      detailsY -= 14;

      if (signature.signer_title) {
        page().drawText(signature.signer_title, {
          x: detailsX,
          y: detailsY,
          size: 9,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3)
        });
        detailsY -= 12;
      }

      if (signature.signer_email) {
        page().drawText(signature.signer_email, {
          x: detailsX,
          y: detailsY,
          size: 9,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3)
        });
        detailsY -= 12;
      }

      // Signed date
      const signedDate = signature.signed_at
        ? formatDate(signature.signed_at)
        : formatDate(proposal.signed_at);
      page().drawText(`Signed: ${signedDate}`, {
        x: detailsX,
        y: detailsY,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4)
      });

      ctx.y = sigBoxY - sigBoxHeight - 15;

      // Legal binding notice
      page().drawText(
        'This document constitutes a legally binding agreement between the parties.',
        {
          x: leftMargin,
          y: ctx.y,
          size: 8,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5)
        }
      );
      ctx.y -= 12;

      if (signature.ip_address) {
        page().drawText(`Signed from IP: ${signature.ip_address}`, {
          x: leftMargin,
          y: ctx.y,
          size: 7,
          font: helvetica,
          color: rgb(0.6, 0.6, 0.6)
        });
      }
    }

    // === FOOTER (on last page) ===
    const footerY = 60;
    const footerText1 = isSigned
      ? 'This signed proposal is a legally binding contract.'
      : 'This proposal is valid for 30 days from the date above.';
    const footerText2 = `Questions? Contact us at ${BUSINESS_INFO.email}`;
    page().drawText(footerText1, {
      x: (width - helvetica.widthOfTextAtSize(footerText1, 9)) / 2,
      y: footerY,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });
    page().drawText(footerText2, {
      x: (width - helvetica.widthOfTextAtSize(footerText2, 9)) / 2,
      y: footerY - 12,
      size: 9,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4)
    });

    // Add page numbers if multiple pages
    if (ctx.pageNumber > 1) {
      await addPageNumbers(pdfDoc, {
        format: (pageNum, total) => `Page ${pageNum} of ${total}`,
        fontSize: 8,
        marginBottom: 20
      });
    }

    // === ADD "SIGNED" WATERMARK TO ALL PAGES (if signed) ===
    if (isSigned) {
      const pages = pdfDoc.getPages();
      for (const pg of pages) {
        const { width: pgWidth, height: pgHeight } = pg.getSize();

        // Draw diagonal "SIGNED" watermark
        pg.drawText('SIGNED', {
          x: pgWidth / 2 - 120,
          y: pgHeight / 2 - 30,
          size: 72,
          font: helveticaBold,
          color: rgb(0, 0.6, 0.2),
          opacity: 0.08,
          rotate: degrees(-35)
        });
      }
    }

    // Generate PDF bytes and send
    const pdfBytes = await pdfDoc.save();
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');

    // Cache the generated PDF
    cachePdf(cacheKey, pdfBytes, proposal.created_at);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="proposal-${projectName}-${id}.pdf"`
    );
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('X-PDF-Cache', 'MISS');
    res.send(Buffer.from(pdfBytes));
  })
);

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/templates:
 *   get:
 *     tags: [Proposals]
 *     summary: Get all templates
 *     description: Get all templates.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectType } = req.query;
    const templates = await proposalService.getTemplates(projectType as string | undefined);
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/proposals/templates/{templateId}:
 *   get:
 *     tags: [Proposals]
 *     summary: Get single template
 *     description: Get single template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, 'VALIDATION_ERROR');
    }

    const template = await proposalService.getTemplate(templateId);
    sendSuccess(res, { template });
  })
);

/**
 * @swagger
 * /api/proposals/templates:
 *   post:
 *     tags: [Proposals]
 *     summary: Create template
 *     description: Create template.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;
    if (!name) {
      return errorResponse(res, 'Template name is required', 400, 'VALIDATION_ERROR');
    }
    const template = await proposalService.createTemplate(req.body);
    sendCreated(res, { template }, 'Template created successfully');
  })
);

/**
 * @swagger
 * /api/proposals/templates/{templateId}:
 *   put:
 *     tags: [Proposals]
 *     summary: Update template
 *     description: Update template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, 'VALIDATION_ERROR');
    }

    const template = await proposalService.updateTemplate(templateId, req.body);
    sendSuccess(res, { template }, 'Template updated successfully');
  })
);

/**
 * @swagger
 * /api/proposals/templates/{templateId}:
 *   delete:
 *     tags: [Proposals]
 *     summary: Delete template
 *     description: Delete template.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.deleteTemplate(templateId);
    sendSuccess(res, undefined, 'Template deleted successfully');
  })
);

// ===================================
// VERSIONING ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/versions:
 *   get:
 *     tags: [Proposals]
 *     summary: Get versions for a proposal
 *     description: Get versions for a proposal.
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
  '/:id/versions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const versions = await proposalService.getVersions(proposalId);
    sendSuccess(res, { versions });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/versions:
 *   post:
 *     tags: [Proposals]
 *     summary: Create a new version
 *     description: Create a new version.
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
  '/:id/versions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const { notes } = req.body;
    const version = await proposalService.createVersion(proposalId, req.user?.email, notes);
    sendCreated(res, { version }, 'Version created successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/versions/{versionId}/restore:
 *   post:
 *     tags: [Proposals]
 *     summary: Restore a version
 *     description: Restore a version.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/:id/versions/:versionId/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);

    if (isNaN(proposalId) || proposalId <= 0 || isNaN(versionId) || versionId <= 0) {
      return errorResponse(res, 'Invalid proposal or version ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.restoreVersion(proposalId, versionId);
    sendSuccess(res, undefined, 'Version restored successfully');
  })
);

/**
 * @swagger
 * /api/proposals/versions/compare:
 *   get:
 *     tags: [Proposals]
 *     summary: Compare two versions
 *     description: Compare two versions.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/versions/compare',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { version1, version2 } = req.query;
    if (!version1 || !version2) {
      return errorResponse(
        res,
        'version1 and version2 query params required',
        400,
        'VALIDATION_ERROR'
      );
    }
    const comparison = await proposalService.compareVersions(
      parseInt(version1 as string),
      parseInt(version2 as string)
    );
    sendSuccess(res, { comparison });
  })
);

// ===================================
// E-SIGNATURE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/request-signature:
 *   post:
 *     tags: [Proposals]
 *     summary: Request a signature
 *     description: Request a signature.
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
  '/:id/request-signature',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const { signerEmail, signerName, expiresInDays } = req.body;
    if (!signerEmail) {
      return errorResponse(res, 'signerEmail is required', 400, 'VALIDATION_ERROR');
    }
    const request = await proposalService.requestSignature(
      proposalId,
      signerEmail,
      signerName,
      expiresInDays
    );
    sendCreated(res, { request }, 'Signature requested successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/sign:
 *   post:
 *     tags: [Proposals]
 *     summary: Record a signature (public endpoint with rate limiting)
 *     description: Record a signature (public endpoint with rate limiting).
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
  '/:id/sign',
  signatureRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    // Validate proposal ID
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const signatureData = req.body;
    if (!signatureData.signerName || !signatureData.signerEmail || !signatureData.signatureData) {
      return errorResponse(
        res,
        'signerName, signerEmail, and signatureData are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signatureData.signerEmail)) {
      return errorResponse(res, 'Invalid email format', 400, 'VALIDATION_ERROR');
    }

    // Add IP and user agent (truncate user agent to prevent log bloat)
    signatureData.ipAddress = req.ip;
    const userAgent = req.get('User-Agent') || '';
    signatureData.userAgent = userAgent.substring(0, 500);

    const signature = await proposalService.recordSignature(proposalId, signatureData);
    sendCreated(res, { signature }, 'Proposal signed successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/signature-status:
 *   get:
 *     tags: [Proposals]
 *     summary: Get signature status
 *     description: Get signature status.
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
  '/:id/signature-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const status = await proposalService.getSignatureStatus(proposalId);
    sendSuccess(res, status);
  })
);

/**
 * @swagger
 * /api/proposals/sign/{token}:
 *   get:
 *     tags: [Proposals]
 *     summary: Get signature by token (public with rate limiting)
 *     description: Get signature by token (public with rate limiting).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/sign/:token',
  signatureRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // Validate token format (should be a valid hex string)
    if (!token || !/^[a-f0-9]{32,64}$/i.test(token)) {
      return errorResponse(res, 'Invalid signature request', 404, 'RESOURCE_NOT_FOUND');
    }

    const request = await proposalService.getSignatureRequestByToken(token);
    if (!request) {
      return errorResponse(res, 'Invalid or expired signature request', 404, 'RESOURCE_NOT_FOUND');
    }

    // Check if token has expired
    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      return errorResponse(res, 'Signature request has expired', 410, 'SIGNATURE_EXPIRED');
    }

    // Check if already signed or declined
    if (request.status === 'signed') {
      return errorResponse(res, 'This proposal has already been signed', 400, 'ALREADY_SIGNED');
    }
    if (request.status === 'declined') {
      return errorResponse(res, 'This signature request was declined', 400, 'SIGNATURE_DECLINED');
    }

    // Mark as viewed
    await proposalService.markSignatureViewed(token);
    sendSuccess(res, { request });
  })
);

/**
 * @swagger
 * /api/proposals/sign/{token}/decline:
 *   post:
 *     tags: [Proposals]
 *     summary: Decline signature (public with rate limiting)
 *     description: Decline signature (public with rate limiting).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/sign/:token/decline',
  signatureRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // Validate token format
    if (!token || !/^[a-f0-9]{32,64}$/i.test(token)) {
      return errorResponse(res, 'Invalid signature request', 404, 'RESOURCE_NOT_FOUND');
    }

    const { reason } = req.body;

    // Validate reason length if provided
    if (reason && typeof reason === 'string' && reason.length > 2000) {
      return errorResponse(res, 'Reason is too long (max 2000 characters)', 400, 'VALIDATION_ERROR');
    }

    await proposalService.declineSignature(token, reason);
    sendSuccess(res, undefined, 'Signature declined');
  })
);

// ===================================
// COMMENT ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/comments:
 *   get:
 *     tags: [Proposals]
 *     summary: Get comments for a proposal
 *     description: Get comments for a proposal.
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
  '/:id/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const includeInternal = req.user!.type === 'admin' && req.query.includeInternal === 'true';
    const comments = await proposalService.getComments(proposalId, includeInternal);
    sendSuccess(res, { comments });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/comments:
 *   post:
 *     tags: [Proposals]
 *     summary: Add comment
 *     description: Add comment.
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
  '/:id/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const { content, isInternal, parentCommentId } = req.body;
    if (!content) {
      return errorResponse(res, 'Comment content is required', 400, 'VALIDATION_ERROR');
    }
    const comment = await proposalService.addComment(
      proposalId,
      req.user!.type === 'admin' ? 'admin' : 'client',
      req.user!.email,
      content,
      req.user!.email,
      isInternal && req.user!.type === 'admin',
      parentCommentId
    );
    sendCreated(res, { comment }, 'Comment added successfully');
  })
);

/**
 * @swagger
 * /api/proposals/comments/{commentId}:
 *   delete:
 *     tags: [Proposals]
 *     summary: Delete comment
 *     description: Delete comment.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/comments/:commentId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const commentId = parseInt(req.params.commentId, 10);

    if (isNaN(commentId) || commentId <= 0) {
      return errorResponse(res, 'Invalid comment ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.deleteComment(commentId);
    sendSuccess(res, undefined, 'Comment deleted successfully');
  })
);

// ===================================
// ACTIVITY ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/activities:
 *   get:
 *     tags: [Proposals]
 *     summary: Get activities for a proposal
 *     description: Get activities for a proposal.
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
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await proposalService.getActivities(proposalId, limit);
    sendSuccess(res, { activities });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/track-view:
 *   post:
 *     tags: [Proposals]
 *     summary: Track view (public with rate limiting)
 *     description: Track view (public with rate limiting).
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
  '/:id/track-view',
  signatureRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    // Validate proposal ID
    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Truncate user agent to prevent log bloat
    const userAgent = req.get('User-Agent') || '';
    await proposalService.trackView(proposalId, req.ip, userAgent.substring(0, 500));
    sendSuccess(res, undefined, 'View tracked');
  })
);

// ===================================
// CUSTOM ITEMS ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/custom-items:
 *   get:
 *     tags: [Proposals]
 *     summary: Get custom items for a proposal
 *     description: Get custom items for a proposal.
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
  '/:id/custom-items',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const items = await proposalService.getCustomItems(proposalId);
    sendSuccess(res, { items });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/custom-items:
 *   post:
 *     tags: [Proposals]
 *     summary: Add custom item
 *     description: Add custom item.
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
  '/:id/custom-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const { description, unitPrice } = req.body;
    if (!description || unitPrice === undefined) {
      return errorResponse(res, 'description and unitPrice are required', 400, 'VALIDATION_ERROR');
    }
    const item = await proposalService.addCustomItem(proposalId, req.body);
    sendCreated(res, { item }, 'Custom item added successfully');
  })
);

/**
 * @swagger
 * /api/proposals/custom-items/{itemId}:
 *   put:
 *     tags: [Proposals]
 *     summary: Update custom item
 *     description: Update custom item.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 */
router.put(
  '/custom-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);

    if (isNaN(itemId) || itemId <= 0) {
      return errorResponse(res, 'Invalid item ID', 400, 'VALIDATION_ERROR');
    }

    const item = await proposalService.updateCustomItem(itemId, req.body);
    sendSuccess(res, { item }, 'Custom item updated successfully');
  })
);

/**
 * @swagger
 * /api/proposals/custom-items/{itemId}:
 *   delete:
 *     tags: [Proposals]
 *     summary: Delete custom item
 *     description: Delete custom item.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 */
router.delete(
  '/custom-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId, 10);

    if (isNaN(itemId) || itemId <= 0) {
      return errorResponse(res, 'Invalid item ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.deleteCustomItem(itemId);
    sendSuccess(res, undefined, 'Custom item deleted successfully');
  })
);

// ===================================
// DISCOUNT ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/discount:
 *   post:
 *     tags: [Proposals]
 *     summary: Apply discount
 *     description: Apply discount.
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
  '/:id/discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const { type, value, reason } = req.body;
    if (!type || value === undefined) {
      return errorResponse(res, 'type and value are required', 400, 'VALIDATION_ERROR');
    }
    if (!['percentage', 'fixed'].includes(type)) {
      return errorResponse(res, 'type must be percentage or fixed', 400, 'VALIDATION_ERROR');
    }
    await proposalService.applyDiscount(proposalId, type, value, reason);
    sendSuccess(res, undefined, 'Discount applied successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/discount:
 *   delete:
 *     tags: [Proposals]
 *     summary: Remove discount
 *     description: Remove discount.
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
  '/:id/discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.removeDiscount(proposalId);
    sendSuccess(res, undefined, 'Discount removed successfully');
  })
);

// ===================================
// EXPIRATION & SEND ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/proposals/{id}/expiration:
 *   put:
 *     tags: [Proposals]
 *     summary: Set expiration date
 *     description: Set expiration date.
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
  '/:id/expiration',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const { expirationDate } = req.body;
    if (!expirationDate) {
      return errorResponse(res, 'expirationDate is required', 400, 'VALIDATION_ERROR');
    }
    await proposalService.setExpiration(proposalId, expirationDate);
    sendSuccess(res, undefined, 'Expiration date set successfully');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/send:
 *   post:
 *     tags: [Proposals]
 *     summary: Mark proposal as sent
 *     description: Mark proposal as sent.
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
  '/:id/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.markProposalSent(proposalId, req.user!.email);
    sendSuccess(res, undefined, 'Proposal marked as sent');
  })
);

/**
 * @swagger
 * /api/proposals/{id}/access-token:
 *   post:
 *     tags: [Proposals]
 *     summary: Generate access token for client viewing
 *     description: Generate access token for client viewing.
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
  '/:id/access-token',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    const token = await proposalService.generateAccessToken(proposalId);
    sendSuccess(res, { accessToken: token });
  })
);

/**
 * @swagger
 * /api/proposals/view/{token}:
 *   get:
 *     tags: [Proposals]
 *     summary: Get proposal by access token (public)
 *     description: Get proposal by access token (public).
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/view/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const proposalId = await proposalService.getProposalByAccessToken(token);
    if (!proposalId) {
      return errorResponse(res, 'Invalid access token', 404, 'RESOURCE_NOT_FOUND');
    }
    // Track view (truncate User-Agent to prevent log bloat)
    const userAgent = (req.get('User-Agent') || '').substring(0, 500);
    await proposalService.trackView(proposalId, req.ip, userAgent);
    sendSuccess(res, { proposalId });
  })
);

/**
 * @swagger
 * /api/proposals/process-expired:
 *   post:
 *     tags: [Proposals]
 *     summary: Process expired proposals (admin or scheduler)
 *     description: Process expired proposals (admin or scheduler).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201:
 *         description: Created successfully
 */
router.post(
  '/process-expired',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await proposalService.processExpiredProposals();
    sendSuccess(res, { count }, `Processed ${count} expired proposal(s)`);
  })
);

/**
 * @swagger
 * /api/proposals/due-for-reminder:
 *   get:
 *     tags: [Proposals]
 *     summary: Get proposals due for reminder
 *     description: Get proposals due for reminder.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/due-for-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysOldParam = req.query.daysOld ? parseInt(req.query.daysOld as string, 10) : 7;
    const daysOld = isNaN(daysOldParam) || daysOldParam < 1 || daysOldParam > 365 ? 7 : daysOldParam;
    const proposalIds = await proposalService.getProposalsDueForReminder(daysOld);
    sendSuccess(res, { proposalIds });
  })
);

/**
 * @swagger
 * /api/proposals/{id}/reminder-sent:
 *   post:
 *     tags: [Proposals]
 *     summary: Mark reminder sent
 *     description: Mark reminder sent.
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
  '/:id/reminder-sent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'VALIDATION_ERROR');
    }

    await proposalService.markReminderSent(proposalId);
    sendSuccess(res, undefined, 'Reminder marked as sent');
  })
);

// ===================================
// CLIENT-FACING PROPOSALS
// ===================================

/**
 * @swagger
 * /api/proposals/my:
 *   get:
 *     tags: [Proposals]
 *     summary: GET /api/proposals/my - Get proposals for the authenticated client
 *     description: GET /api/proposals/my - Get proposals for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get(
  '/my',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    const clientId = req.user?.id;

    if (!clientId || req.user?.type === 'admin') {
      return sendSuccess(res, { proposals: [] });
    }

    const proposals = await db.all(`
      SELECT
        pr.id,
        COALESCE(p.project_name, 'Proposal #' || pr.id) as title,
        pr.status,
        pr.final_price as amount,
        pr.project_type as projectType,
        pr.selected_tier as selectedTier,
        pr.sent_at as sentAt,
        pr.valid_until as validUntil,
        pr.created_at as createdAt
      FROM proposal_requests pr
      LEFT JOIN projects p ON pr.project_id = p.id
      WHERE pr.client_id = ?
        AND pr.deleted_at IS NULL
        AND pr.status != 'pending'
      ORDER BY pr.created_at DESC
    `, [clientId]);

    sendSuccess(res, { proposals });
  })
);

export default router;
