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
import { PDFDocument as PDFLibDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
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
import { errorResponse, errorResponseWithPayload, sendSuccess, sendCreated } from '../utils/api-response.js';
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
 * GET /api/proposals/config/:projectType
 * Get tier configuration for a specific project type
 *
 * Note: Tier configurations are defined on the frontend in proposal-builder-data.ts
 * This endpoint is for future server-side configuration if needed
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
 * POST /api/proposals
 * Create a new proposal request
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const submission: ProposalSubmission = req.body;

    // Validate required fields
    const requiredFields = ['projectId', 'clientId', 'projectType', 'selectedTier', 'basePrice', 'finalPrice'];
    const missingFields = requiredFields.filter(field => !(field in submission));

    if (missingFields.length > 0) {
      return errorResponseWithPayload(res, 'Missing required fields', 400, 'VALIDATION_ERROR', {
        missingFields
      });
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

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [submission.projectId]);
    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Verify client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [submission.clientId]);
    if (!client) {
      return errorResponse(res, 'Client not found', 404, 'RESOURCE_NOT_FOUND');
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

    console.log(`[Proposals] Created proposal request ${result} for project ${submission.projectId}`);
  await logger.info(`[Proposals] Created proposal request ${result} for project ${submission.projectId}`, { category: 'PROPOSALS' });

    // Emit workflow event for proposal creation
    await workflowTriggerService.emit('proposal.created', {
      entityId: result,
      triggeredBy: 'client',
      projectId: submission.projectId,
      clientId: submission.clientId,
      selectedTier: submission.selectedTier,
      finalPrice: submission.finalPrice
    });

    sendCreated(res, {
      proposalId: result,
      projectId: submission.projectId,
      selectedTier: submission.selectedTier,
      finalPrice: submission.finalPrice
    }, 'Proposal submitted successfully');
  })
);

/**
 * GET /api/proposals/:id
 * Get a specific proposal by ID
 * Requires authentication - only admin or owning client can view
 */
router.get(
  '/:id',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = getDatabase();

    const proposal = await db.get(
      `SELECT pr.*, p.project_name, c.contact_name as client_name, c.email as client_email, c.company_name
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id AND ${notDeleted('p')}
       JOIN clients c ON pr.client_id = c.id AND ${notDeleted('c')}
       WHERE pr.id = ? AND ${notDeleted('pr')}`,
      [id]
    ) as ProposalRow | undefined;

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Authorization check: only admin or owning client can view
    const proposalClientId = getNumber(proposal as unknown as Record<string, unknown>, 'client_id');
    if (req.user!.type !== 'admin' && req.user!.id !== proposalClientId) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    // Get feature selections
    const features = await db.all(
      'SELECT * FROM proposal_feature_selections WHERE proposal_request_id = ?',
      [id]
    ) as unknown as FeatureRow[];

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
      features: features.map(f => {
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
 * DELETE /api/proposals/:id
 * Soft delete a proposal (admin only) - 30-day recovery period
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const deletedBy = req.user?.email || 'admin';

    const result = await softDeleteService.softDeleteProposal(proposalId, deletedBy);

    if (!result.success) {
      return errorResponse(res, result.message, 404, 'PROPOSAL_NOT_FOUND');
    }

    sendSuccess(res, undefined, result.message);
  })
);

/**
 * GET /api/admin/proposals
 * List all proposals (admin only)
 */
router.get(
  '/admin/list',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    const { status, limit = '50', offset = '0' } = req.query;

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
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const proposals = await db.all(query, params) as unknown as ProposalRow[];

    // Get total count (excluding soft-deleted)
    let countQuery = `SELECT COUNT(*) as count FROM proposal_requests WHERE ${notDeleted()}`;
    const countParams: string[] = [];
    if (status && VALID_STATUSES.includes(status as string)) {
      countQuery += ' AND status = ?';
      countParams.push(status as string);
    }
    const countResult = await db.get(countQuery, countParams) as { count: number };

    sendSuccess(res, {
      proposals: proposals.map(proposal => {
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
      }),
      total: countResult.count,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    });
  })
);

/**
 * PUT /api/admin/proposals/:id
 * Update proposal status (admin only)
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

    await db.run(
      `UPDATE proposal_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    console.log(`[Proposals] Updated proposal ${id} - status: ${status || 'unchanged'}`);
  await logger.info(`[Proposals] Updated proposal ${id} - status: ${status || 'unchanged'}`, { category: 'PROPOSALS' });

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
 * POST /api/admin/proposals/:id/convert
 * Convert approved proposal to invoice (admin only)
 */
router.post(
  '/admin/:id/convert',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = getDatabase();

    // Get proposal with full details
    const proposal = await db.get(
      `SELECT pr.*, p.id as project_id, c.id as client_id
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id
       JOIN clients c ON pr.client_id = c.id
       WHERE pr.id = ?`,
      [id]
    ) as ProposalRow | undefined;

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    if (getString(proposal as unknown as Record<string, unknown>, 'status') !== 'accepted') {
      return errorResponse(res, 'Only accepted proposals can be converted to invoices', 400, 'VALIDATION_ERROR');
    }

    // Get feature selections for line items
    const features = await db.all(
      'SELECT * FROM proposal_feature_selections WHERE proposal_request_id = ?',
      [id]
    ) as unknown as FeatureRow[];

    // Create line items from features
    const lineItems = features.map(f => {
      const fr = f as unknown as Record<string, unknown>;
      return {
        description: getString(fr, 'feature_name'),
        quantity: 1,
        unitPrice: getNumber(fr, 'feature_price'),
        total: getNumber(fr, 'feature_price')
      };
    });

    // Generate invoice number
    const invoiceCount = await db.get('SELECT COUNT(*) as count FROM invoices') as { count: number };
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

    console.log(`[Proposals] Converted proposal ${id} to invoice ${invoiceNumber}`);
  await logger.info(`[Proposals] Converted proposal ${id} to invoice ${invoiceNumber}`, { category: 'PROPOSALS' });

    sendSuccess(res, { invoiceId, invoiceNumber }, 'Proposal converted to invoice');
  })
);

/**
 * GET /api/proposals/:id/pdf
 * Generate PDF for a proposal
 */
router.get(
  '/:id/pdf',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const db = getDatabase();

    // Get proposal with full details including deposit percentage
    const proposal = await db.get(
      `SELECT pr.*, p.project_name, p.description as project_description,
              p.default_deposit_percentage,
              c.contact_name as client_name, c.email as client_email, c.company_name
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id
       JOIN clients c ON pr.client_id = c.id
       WHERE pr.id = ?`,
      [id]
    ) as ProposalRow | undefined;

    if (!proposal) {
      return errorResponse(res, 'Proposal not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Check cache first (proposals use created_at as they don't have updated_at)
    const cacheKey = getPdfCacheKey('proposal', id, proposal.created_at);
    const cachedPdf = getCachedPdf(cacheKey);
    if (cachedPdf) {
      const projectName = (proposal.project_name || 'proposal').toString().replace(/[^a-zA-Z0-9]/g, '-');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="proposal-${projectName}-${id}.pdf"`);
      res.setHeader('Content-Length', cachedPdf.length);
      res.setHeader('X-PDF-Cache', 'HIT');
      return res.send(Buffer.from(cachedPdf));
    }

    // Cast proposal for helper functions
    const p = proposal as unknown as Record<string, unknown>;

    // Authorization check: only admin or owning client can download PDF
    const proposalClientId = getNumber(p, 'client_id');
    if (req.user!.type !== 'admin' && req.user!.id !== proposalClientId) {
      return errorResponse(res, 'Access denied', 403, 'ACCESS_DENIED');
    }

    // Get feature selections
    const features = await db.all(
      'SELECT * FROM proposal_feature_selections WHERE proposal_request_id = ?',
      [id]
    ) as unknown as FeatureRow[];

    // Get signature data if proposal is signed
    const signature = (proposal as any).signed_at ? await db.get(
      'SELECT * FROM proposal_signatures WHERE proposal_id = ? ORDER BY signed_at DESC LIMIT 1',
      [id]
    ) as { signer_name?: string; signer_email?: string; signer_title?: string; signature_data?: string; signature_method?: string; signed_at?: string; ip_address?: string } | undefined : undefined;

    // Check if proposal is signed for watermark
    const isSigned = Boolean((proposal as any).signed_at);

    // Helper functions
    const formatDate = (dateStr: string | undefined | null): string => {
      if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const formatTier = (tier: string): string => {
      const tierNames: Record<string, string> = { 'good': 'GOOD', 'better': 'BETTER', 'best': 'BEST' };
      return tierNames[tier] || tier.toUpperCase();
    };

    const formatMaintenance = (option: string | null): string => {
      if (!option) return 'None';
      const maintenanceNames: Record<string, string> = {
        'diy': 'DIY (Self-Managed)', 'essential': 'Essential Plan', 'standard': 'Standard Plan', 'premium': 'Premium Plan'
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
    page().drawText(titleText, { x: leftMargin, y: ctx.y - 20, size: 28, font: helveticaBold, color: rgb(0.15, 0.15, 0.15) });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const logoBytes = getPdfLogoBytes();
    if (logoBytes) {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = rightMargin - logoWidth - 150;
      page().drawImage(logoImage, { x: logoX, y: ctx.y - logoHeight + 10, width: logoWidth, height: logoHeight });
      textStartX = logoX + logoWidth + 18;
    }

    // Business info (left-aligned, to right of logo)
    page().drawText(BUSINESS_INFO.name, { x: textStartX, y: ctx.y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page().drawText(BUSINESS_INFO.owner, { x: textStartX, y: ctx.y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    page().drawText(BUSINESS_INFO.tagline, { x: textStartX, y: ctx.y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page().drawText(BUSINESS_INFO.email, { x: textStartX, y: ctx.y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page().drawText(BUSINESS_INFO.website, { x: textStartX, y: ctx.y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    ctx.y -= 120; // Account for 100pt logo height

    // Divider line
    page().drawLine({ start: { x: leftMargin, y: ctx.y }, end: { x: rightMargin, y: ctx.y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    ctx.y -= 21;

    // === PROPOSAL INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Prepared For
    page().drawText('Prepared For:', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page().drawText(getString(p, 'client_name') || 'Client', { x: leftMargin, y: ctx.y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    let clientLineY = ctx.y - 30;
    if (proposal.company_name) {
      page().drawText(proposal.company_name, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      clientLineY -= 15;
    }
    page().drawText(getString(p, 'client_email') || '', { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    // Right side - Prepared By & Date
    page().drawText('Prepared By:', { x: rightCol, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page().drawText(BUSINESS_INFO.name, { x: rightCol, y: ctx.y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page().drawText('Date:', { x: rightCol, y: ctx.y - 45, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page().drawText(formatDate(getString(p, 'created_at')), { x: rightCol, y: ctx.y - 60, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    ctx.y -= 90;

    // === PROJECT DETAILS ===
    page().drawText('Project Details', { x: leftMargin, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    ctx.y -= 18;

    page().drawText('Project:', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page().drawText(getString(p, 'project_name'), { x: leftMargin + 55, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.y -= 15;

    page().drawText('Project Type:', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page().drawText(getString(p, 'project_type').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), { x: leftMargin + 80, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.y -= 25;

    // === SELECTED PACKAGE ===
    page().drawText('Selected Package', { x: leftMargin, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    ctx.y -= 18;

    const selectedTier = formatTier(getString(p, 'selected_tier'));
    page().drawText(`${selectedTier} Tier`, { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.y -= 15;
    page().drawText(`Base Price: $${getNumber(p, 'base_price').toLocaleString()}`, { x: leftMargin, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.y -= 20;

    // === INCLUDED FEATURES ===
    const includedFeatures = features.filter(f => f.is_included_in_tier);
    if (includedFeatures.length > 0) {
      page().drawText('Included Features:', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      ctx.y -= 15;
      for (const f of includedFeatures) {
        // Check for page break before each feature
        ensureSpace(ctx, 12, drawContinuationHeader);
        const fr = f as unknown as Record<string, unknown>;
        page().drawText(`• ${getString(fr, 'feature_name')}`, { x: leftMargin + 10, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
        ctx.y -= 12;
      }
      ctx.y -= 8;
    }

    // === ADD-ONS ===
    const addons = features.filter(f => f.is_addon);
    if (addons.length > 0) {
      // Check for page break before add-ons section
      ensureSpace(ctx, 30, drawContinuationHeader);
      page().drawText('Add-Ons:', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      ctx.y -= 15;
      for (const f of addons) {
        // Check for page break before each add-on
        ensureSpace(ctx, 12, drawContinuationHeader);
        const fr = f as unknown as Record<string, unknown>;
        const price = getNumber(fr, 'feature_price');
        page().drawText(`• ${getString(fr, 'feature_name')} - $${price.toLocaleString()}`, { x: leftMargin + 10, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
        ctx.y -= 12;
      }
      ctx.y -= 8;
    }

    // === MAINTENANCE OPTION ===
    if (proposal.maintenance_option) {
      ensureSpace(ctx, 40, drawContinuationHeader);
      page().drawText('Maintenance Plan:', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      ctx.y -= 15;
      page().drawText(formatMaintenance(proposal.maintenance_option), { x: leftMargin + 10, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      ctx.y -= 20;
    }

    // === PRICING SUMMARY ===
    // Ensure pricing summary fits on current page
    ensureSpace(ctx, 100, drawContinuationHeader);
    ctx.y -= 10;
    page().drawText('Pricing Summary', { x: leftMargin, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    ctx.y -= 18;

    page().drawText('Base Package Price:', { x: leftMargin, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    const basePriceText = `$${getNumber(p, 'base_price').toLocaleString()}`;
    page().drawText(basePriceText, { x: rightMargin - helvetica.widthOfTextAtSize(basePriceText, 10), y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.y -= 15;

    if (addons.length > 0) {
      const addonsTotal = addons.reduce((sum, f) => sum + (f.feature_price || 0), 0);
      page().drawText('Add-Ons:', { x: leftMargin, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      const addonsTotalText = `$${addonsTotal.toLocaleString()}`;
      page().drawText(addonsTotalText, { x: rightMargin - helvetica.widthOfTextAtSize(addonsTotalText, 10), y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      ctx.y -= 15;
    }

    // Line
    ctx.y -= 5;
    page().drawLine({ start: { x: leftMargin, y: ctx.y }, end: { x: rightMargin, y: ctx.y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    ctx.y -= 15;

    // Total
    page().drawText('Total:', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
    const totalText = `$${getNumber(p, 'final_price').toLocaleString()}`;
    page().drawText(totalText, { x: rightMargin - helveticaBold.widthOfTextAtSize(totalText, 12), y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });

    // === PAYMENT SCHEDULE ===
    ctx.y -= 35;
    ensureSpace(ctx, 100, drawContinuationHeader);
    page().drawText('Payment Schedule', { x: leftMargin, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    ctx.y -= 20;

    // Calculate payment amounts based on deposit percentage (default 50%)
    const finalPrice = getNumber(p, 'final_price');
    const depositPercentage = ((proposal as any).default_deposit_percentage as number) || 50;
    const depositAmount = Math.round(finalPrice * (depositPercentage / 100));
    const finalPayment = finalPrice - depositAmount;

    // Draw payment schedule table
    const colWidth = ctx.contentWidth / 3;
    const paymentRowHeight = 18;

    // Table header
    page().drawText('Payment', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page().drawText('When Due', { x: leftMargin + colWidth, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    page().drawText('Amount', { x: rightMargin - 70, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    ctx.y -= 5;

    // Header underline
    page().drawLine({ start: { x: leftMargin, y: ctx.y }, end: { x: rightMargin, y: ctx.y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    ctx.y -= paymentRowHeight;

    // Row 1: Deposit
    page().drawText('1. Deposit', { x: leftMargin, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page().drawText('Upon contract signing', { x: leftMargin + colWidth, y: ctx.y, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    const depositText = `$${depositAmount.toLocaleString()}`;
    page().drawText(depositText, { x: rightMargin - helvetica.widthOfTextAtSize(depositText, 10), y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.y -= 5;

    // Row separator
    page().drawLine({ start: { x: leftMargin, y: ctx.y }, end: { x: rightMargin, y: ctx.y }, thickness: 0.25, color: rgb(0.85, 0.85, 0.85) });
    ctx.y -= paymentRowHeight;

    // Row 2: Final Payment
    page().drawText('2. Final Payment', { x: leftMargin, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page().drawText('Upon project completion', { x: leftMargin + colWidth, y: ctx.y, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    const finalPaymentText = `$${finalPayment.toLocaleString()}`;
    page().drawText(finalPaymentText, { x: rightMargin - helvetica.widthOfTextAtSize(finalPaymentText, 10), y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    ctx.y -= 5;

    // Bottom line
    page().drawLine({ start: { x: leftMargin, y: ctx.y }, end: { x: rightMargin, y: ctx.y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    ctx.y -= paymentRowHeight;

    // Total row
    page().drawText('Total Project Investment', { x: leftMargin, y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    const totalInvestmentText = `$${finalPrice.toLocaleString()}`;
    page().drawText(totalInvestmentText, { x: rightMargin - helveticaBold.widthOfTextAtSize(totalInvestmentText, 10), y: ctx.y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    ctx.y -= 15;

    // Payment note
    page().drawText(`Deposit (${depositPercentage}%) required to begin work. Balance due upon delivery.`, {
      x: leftMargin,
      y: ctx.y,
      size: 8,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5)
    });

    // === CLIENT NOTES ===
    if (proposal.client_notes) {
      ctx.y -= 35;
      ensureSpace(ctx, 30, drawContinuationHeader);
      page().drawText('Client Notes:', { x: leftMargin, y: ctx.y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      ctx.y -= 15;
      page().drawText(proposal.client_notes, { x: leftMargin + 10, y: ctx.y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    }

    // === TERMS & CONDITIONS ===
    const termsText = (proposal as any).terms_and_conditions || (proposal as any).contract_terms;
    if (termsText) {
      ctx.y -= 35;
      ensureSpace(ctx, 80, drawContinuationHeader);
      page().drawText('Terms & Conditions', { x: leftMargin, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
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
            page().drawText(currentLine, { x: leftMargin + 10, y: ctx.y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
            ctx.y -= 12;
            ensureSpace(ctx, 12, drawContinuationHeader);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          page().drawText(currentLine, { x: leftMargin + 10, y: ctx.y, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
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
      page().drawText('Authorization & Signature', { x: leftMargin, y: ctx.y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
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
          await logger.error('[PDF] Failed to embed signature image:', { error: sigError instanceof Error ? sigError : undefined, category: 'PROPOSALS' });
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

      page().drawText(signature.signer_name || 'Unknown', { x: detailsX, y: detailsY, size: 11, font: helveticaBold, color: rgb(0, 0, 0) });
      detailsY -= 14;

      if (signature.signer_title) {
        page().drawText(signature.signer_title, { x: detailsX, y: detailsY, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
        detailsY -= 12;
      }

      if (signature.signer_email) {
        page().drawText(signature.signer_email, { x: detailsX, y: detailsY, size: 9, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
        detailsY -= 12;
      }

      // Signed date
      const signedDate = signature.signed_at ? formatDate(signature.signed_at) : formatDate(proposal.signed_at);
      page().drawText(`Signed: ${signedDate}`, { x: detailsX, y: detailsY, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

      ctx.y = sigBoxY - sigBoxHeight - 15;

      // Legal binding notice
      page().drawText('This document constitutes a legally binding agreement between the parties.', {
        x: leftMargin,
        y: ctx.y,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5)
      });
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
    page().drawText(footerText1, { x: (width - helvetica.widthOfTextAtSize(footerText1, 9)) / 2, y: footerY, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page().drawText(footerText2, { x: (width - helvetica.widthOfTextAtSize(footerText2, 9)) / 2, y: footerY - 12, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    // Add page numbers if multiple pages
    if (ctx.pageNumber > 1) {
      await addPageNumbers(pdfDoc, {
        format: (p, t) => `Page ${p} of ${t}`,
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
    res.setHeader('Content-Disposition', `attachment; filename="proposal-${projectName}-${id}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('X-PDF-Cache', 'MISS');
    res.send(Buffer.from(pdfBytes));
  })
);

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

// Get all templates
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

// Get single template
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId);
    const template = await proposalService.getTemplate(templateId);
    sendSuccess(res, { template });
  })
);

// Create template
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

// Update template
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId);
    const template = await proposalService.updateTemplate(templateId, req.body);
    sendSuccess(res, { template }, 'Template updated successfully');
  })
);

// Delete template
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId);
    await proposalService.deleteTemplate(templateId);
    sendSuccess(res, undefined, 'Template deleted successfully');
  })
);

// ===================================
// VERSIONING ENDPOINTS
// ===================================

// Get versions for a proposal
router.get(
  '/:id/versions',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const versions = await proposalService.getVersions(proposalId);
    sendSuccess(res, { versions });
  })
);

// Create a new version
router.post(
  '/:id/versions',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const { notes } = req.body;
    const version = await proposalService.createVersion(proposalId, req.user?.email, notes);
    sendCreated(res, { version }, 'Version created successfully');
  })
);

// Restore a version
router.post(
  '/:id/versions/:versionId/restore',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const versionId = parseInt(req.params.versionId);
    await proposalService.restoreVersion(proposalId, versionId);
    sendSuccess(res, undefined, 'Version restored successfully');
  })
);

// Compare two versions
router.get(
  '/versions/compare',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { version1, version2 } = req.query;
    if (!version1 || !version2) {
      return errorResponse(res, 'version1 and version2 query params required', 400, 'VALIDATION_ERROR');
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

// Request a signature
router.post(
  '/:id/request-signature',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const { signerEmail, signerName, expiresInDays } = req.body;
    if (!signerEmail) {
      return errorResponse(res, 'signerEmail is required', 400, 'VALIDATION_ERROR');
    }
    const request = await proposalService.requestSignature(proposalId, signerEmail, signerName, expiresInDays);
    sendCreated(res, { request }, 'Signature requested successfully');
  })
);

// Record a signature
router.post(
  '/:id/sign',
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const signatureData = req.body;
    if (!signatureData.signerName || !signatureData.signerEmail || !signatureData.signatureData) {
      return errorResponse(
        res,
        'signerName, signerEmail, and signatureData are required',
        400,
        'VALIDATION_ERROR'
      );
    }
    // Add IP and user agent
    signatureData.ipAddress = req.ip;
    signatureData.userAgent = req.get('User-Agent');
    const signature = await proposalService.recordSignature(proposalId, signatureData);
    sendCreated(res, { signature }, 'Proposal signed successfully');
  })
);

// Get signature status
router.get(
  '/:id/signature-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const status = await proposalService.getSignatureStatus(proposalId);
    sendSuccess(res, status);
  })
);

// Get signature by token (public)
router.get(
  '/sign/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const request = await proposalService.getSignatureRequestByToken(token);
    if (!request) {
      return errorResponse(res, 'Invalid or expired signature request', 404, 'RESOURCE_NOT_FOUND');
    }
    // Mark as viewed
    await proposalService.markSignatureViewed(token);
    sendSuccess(res, { request });
  })
);

// Decline signature
router.post(
  '/sign/:token/decline',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { reason } = req.body;
    await proposalService.declineSignature(token, reason);
    sendSuccess(res, undefined, 'Signature declined');
  })
);

// ===================================
// COMMENT ENDPOINTS
// ===================================

// Get comments for a proposal
router.get(
  '/:id/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const includeInternal = req.user!.type === 'admin' && req.query.includeInternal === 'true';
    const comments = await proposalService.getComments(proposalId, includeInternal);
    sendSuccess(res, { comments });
  })
);

// Add comment
router.post(
  '/:id/comments',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
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

// Delete comment
router.delete(
  '/comments/:commentId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const commentId = parseInt(req.params.commentId);
    await proposalService.deleteComment(commentId);
    sendSuccess(res, undefined, 'Comment deleted successfully');
  })
);

// ===================================
// ACTIVITY ENDPOINTS
// ===================================

// Get activities for a proposal
router.get(
  '/:id/activities',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await proposalService.getActivities(proposalId, limit);
    sendSuccess(res, { activities });
  })
);

// Track view (public with access token)
router.post(
  '/:id/track-view',
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id);
    await proposalService.trackView(proposalId, req.ip, req.get('User-Agent'));
    sendSuccess(res, undefined, 'View tracked');
  })
);

// ===================================
// CUSTOM ITEMS ENDPOINTS
// ===================================

// Get custom items for a proposal
router.get(
  '/:id/custom-items',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const items = await proposalService.getCustomItems(proposalId);
    sendSuccess(res, { items });
  })
);

// Add custom item
router.post(
  '/:id/custom-items',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const { description, unitPrice } = req.body;
    if (!description || unitPrice === undefined) {
      return errorResponse(res, 'description and unitPrice are required', 400, 'VALIDATION_ERROR');
    }
    const item = await proposalService.addCustomItem(proposalId, req.body);
    sendCreated(res, { item }, 'Custom item added successfully');
  })
);

// Update custom item
router.put(
  '/custom-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId);
    const item = await proposalService.updateCustomItem(itemId, req.body);
    sendSuccess(res, { item }, 'Custom item updated successfully');
  })
);

// Delete custom item
router.delete(
  '/custom-items/:itemId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const itemId = parseInt(req.params.itemId);
    await proposalService.deleteCustomItem(itemId);
    sendSuccess(res, undefined, 'Custom item deleted successfully');
  })
);

// ===================================
// DISCOUNT ENDPOINTS
// ===================================

// Apply discount
router.post(
  '/:id/discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
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

// Remove discount
router.delete(
  '/:id/discount',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    await proposalService.removeDiscount(proposalId);
    sendSuccess(res, undefined, 'Discount removed successfully');
  })
);

// ===================================
// EXPIRATION & SEND ENDPOINTS
// ===================================

// Set expiration date
router.put(
  '/:id/expiration',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const { expirationDate } = req.body;
    if (!expirationDate) {
      return errorResponse(res, 'expirationDate is required', 400, 'VALIDATION_ERROR');
    }
    await proposalService.setExpiration(proposalId, expirationDate);
    sendSuccess(res, undefined, 'Expiration date set successfully');
  })
);

// Mark proposal as sent
router.post(
  '/:id/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    await proposalService.markProposalSent(proposalId, req.user!.email);
    sendSuccess(res, undefined, 'Proposal marked as sent');
  })
);

// Generate access token for client viewing
router.post(
  '/:id/access-token',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const token = await proposalService.generateAccessToken(proposalId);
    sendSuccess(res, { accessToken: token });
  })
);

// Get proposal by access token (public)
router.get(
  '/view/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const proposalId = await proposalService.getProposalByAccessToken(token);
    if (!proposalId) {
      return errorResponse(res, 'Invalid access token', 404, 'RESOURCE_NOT_FOUND');
    }
    // Track view
    await proposalService.trackView(proposalId, req.ip, req.get('User-Agent'));
    sendSuccess(res, { proposalId });
  })
);

// Process expired proposals (admin or scheduler)
router.post(
  '/process-expired',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await proposalService.processExpiredProposals();
    sendSuccess(res, { count }, `Processed ${count} expired proposal(s)`);
  })
);

// Get proposals due for reminder
router.get(
  '/due-for-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const daysOld = req.query.daysOld ? parseInt(req.query.daysOld as string) : 7;
    const proposalIds = await proposalService.getProposalsDueForReminder(daysOld);
    sendSuccess(res, { proposalIds });
  })
);

// Mark reminder sent
router.post(
  '/:id/reminder-sent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    await proposalService.markReminderSent(proposalId);
    sendSuccess(res, undefined, 'Reminder marked as sent');
  })
);

export default router;
