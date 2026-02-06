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
import { PDFDocument as PDFLibDocument, StandardFonts, rgb } from 'pdf-lib';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { proposalService } from '../services/proposal-service.js';
import { BUSINESS_INFO, getPdfLogoBytes } from '../config/business.js';
import { getPdfCacheKey, getCachedPdf, cachePdf } from '../utils/pdf-utils.js';
import { notDeleted } from '../database/query-helpers.js';
import { softDeleteService } from '../services/soft-delete-service.js';

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
      return res.status(400).json({
        success: false,
        message: 'Invalid project type',
        validTypes: VALID_PROJECT_TYPES
      });
    }

    // Configuration is handled on the frontend
    // This endpoint can be used for future server-side overrides
    res.json({
      success: true,
      message: 'Configuration is managed client-side',
      projectType
    });
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
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Validate project type
    if (!VALID_PROJECT_TYPES.includes(submission.projectType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project type'
      });
    }

    // Validate tier
    if (!VALID_TIERS.includes(submission.selectedTier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier selection'
      });
    }

    // Validate maintenance option if provided
    if (submission.maintenanceOption && !VALID_MAINTENANCE.includes(submission.maintenanceOption)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid maintenance option'
      });
    }

    const db = getDatabase();

    // Verify project exists
    const project = await db.get('SELECT id FROM projects WHERE id = ?', [submission.projectId]);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify client exists
    const client = await db.get('SELECT id FROM clients WHERE id = ?', [submission.clientId]);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
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

    res.status(201).json({
      success: true,
      message: 'Proposal submitted successfully',
      data: {
        proposalId: result,
        projectId: submission.projectId,
        selectedTier: submission.selectedTier,
        finalPrice: submission.finalPrice
      }
    });
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
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Authorization check: only admin or owning client can view
    const proposalClientId = getNumber(proposal as unknown as Record<string, unknown>, 'client_id');
    if (req.user!.type !== 'admin' && req.user!.id !== proposalClientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get feature selections
    const features = await db.all(
      `SELECT * FROM proposal_feature_selections WHERE proposal_request_id = ?`,
      [id]
    ) as unknown as FeatureRow[];

    // Cast proposal for helper functions
    const p = proposal as unknown as Record<string, unknown>;

    res.json({
      success: true,
      data: {
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
      }
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
      return res.status(404).json({
        success: false,
        message: result.message,
        code: 'PROPOSAL_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: result.message
    });
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

    res.json({
      success: true,
      data: {
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
      }
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
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        validStatuses: VALID_STATUSES
      });
    }

    // Verify proposal exists
    const proposal = await db.get('SELECT id FROM proposal_requests WHERE id = ?', [id]);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    // Build update query
    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
      updates.push('reviewed_at = datetime(\'now\')');
      updates.push('reviewed_by = ?');
      params.push(req.user?.email || 'admin');
    }

    if (adminNotes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(adminNotes);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    params.push(parseInt(id, 10));

    await db.run(
      `UPDATE proposal_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    console.log(`[Proposals] Updated proposal ${id} - status: ${status || 'unchanged'}`);

    res.json({
      success: true,
      message: 'Proposal updated successfully'
    });
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
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
    }

    if (getString(proposal as unknown as Record<string, unknown>, 'status') !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Only accepted proposals can be converted to invoices'
      });
    }

    // Get feature selections for line items
    const features = await db.all(
      `SELECT * FROM proposal_feature_selections WHERE proposal_request_id = ?`,
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
        `UPDATE proposal_requests SET status = 'converted', reviewed_at = datetime('now') WHERE id = ?`,
        [id]
      );

      return result.lastID!;
    });

    console.log(`[Proposals] Converted proposal ${id} to invoice ${invoiceNumber}`);

    res.json({
      success: true,
      message: 'Proposal converted to invoice',
      data: {
        invoiceId,
        invoiceNumber
      }
    });
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

    // Get proposal with full details
    const proposal = await db.get(
      `SELECT pr.*, p.project_name, p.description as project_description,
              c.contact_name as client_name, c.email as client_email, c.company_name
       FROM proposal_requests pr
       JOIN projects p ON pr.project_id = p.id
       JOIN clients c ON pr.client_id = c.id
       WHERE pr.id = ?`,
      [id]
    ) as ProposalRow | undefined;

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found'
      });
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
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get feature selections
    const features = await db.all(
      `SELECT * FROM proposal_feature_selections WHERE proposal_request_id = ?`,
      [id]
    ) as unknown as FeatureRow[];

    // Helper functions
    const formatDate = (dateStr: string | undefined): string => {
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

    // Create PDF document using pdf-lib
    const pdfDoc = await PDFLibDocument.create();
    pdfDoc.setTitle(`Proposal - ${getString(p, 'project_name')}`);
    pdfDoc.setAuthor(BUSINESS_INFO.name);

    const page = pdfDoc.addPage([612, 792]); // LETTER size
    const { width, height } = page.getSize();

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Layout constants (0.75 inch margins per template)
    const leftMargin = 54;
    const rightMargin = width - 54;

    // Start from top - template uses 0.6 inch from top
    let y = height - 43;

    // === HEADER - Title on left, logo and business info on right ===
    const logoHeight = 100; // ~1.4 inch for prominent branding

    // PROPOSAL title on left: 28pt
    const titleText = 'PROPOSAL';
    page.drawText(titleText, { x: leftMargin, y: y - 20, size: 28, font: helveticaBold, color: rgb(0.15, 0.15, 0.15) });

    // Logo and business info on right (logo left of text, text left-aligned)
    let textStartX = rightMargin - 180;
    const logoBytes = getPdfLogoBytes();
    if (logoBytes) {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
      const logoX = rightMargin - logoWidth - 150;
      page.drawImage(logoImage, { x: logoX, y: y - logoHeight + 10, width: logoWidth, height: logoHeight });
      textStartX = logoX + logoWidth + 18;
    }

    // Business info (left-aligned, to right of logo)
    page.drawText(BUSINESS_INFO.name, { x: textStartX, y: y - 11, size: 15, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(BUSINESS_INFO.owner, { x: textStartX, y: y - 34, size: 10, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.tagline, { x: textStartX, y: y - 54, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.email, { x: textStartX, y: y - 70, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(BUSINESS_INFO.website, { x: textStartX, y: y - 86, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    y -= 120; // Account for 100pt logo height

    // Divider line
    page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
    y -= 21;

    // === PROPOSAL INFO - Two columns ===
    const rightCol = width / 2 + 36;

    // Left side - Prepared For
    page.drawText('Prepared For:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(getString(p, 'client_name') || 'Client', { x: leftMargin, y: y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    let clientLineY = y - 30;
    if (proposal.company_name) {
      page.drawText(proposal.company_name, { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      clientLineY -= 15;
    }
    page.drawText(getString(p, 'client_email') || '', { x: leftMargin, y: clientLineY, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });

    // Right side - Prepared By & Date
    page.drawText('Prepared By:', { x: rightCol, y: y, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(BUSINESS_INFO.name, { x: rightCol, y: y - 15, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    page.drawText('Date:', { x: rightCol, y: y - 45, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(formatDate(getString(p, 'created_at')), { x: rightCol, y: y - 60, size: 10, font: helvetica, color: rgb(0, 0, 0) });

    y -= 90;

    // === PROJECT DETAILS ===
    page.drawText('Project Details', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    y -= 18;

    page.drawText('Project:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawText(getString(p, 'project_name'), { x: leftMargin + 55, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 15;

    page.drawText('Project Type:', { x: leftMargin, y: y, size: 10, font: helveticaBold, color: rgb(0, 0, 0) });
    page.drawText(getString(p, 'project_type').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), { x: leftMargin + 80, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 25;

    // === SELECTED PACKAGE ===
    page.drawText('Selected Package', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    y -= 18;

    const selectedTier = formatTier(getString(p, 'selected_tier'));
    page.drawText(`${selectedTier} Tier`, { x: leftMargin, y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
    y -= 15;
    page.drawText(`Base Price: $${getNumber(p, 'base_price').toLocaleString()}`, { x: leftMargin, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 20;

    // === INCLUDED FEATURES ===
    const includedFeatures = features.filter(f => f.is_included_in_tier);
    if (includedFeatures.length > 0) {
      page.drawText('Included Features:', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      y -= 15;
      for (const f of includedFeatures) {
        const fr = f as unknown as Record<string, unknown>;
        page.drawText(`• ${getString(fr, 'feature_name')}`, { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
        y -= 12;
      }
      y -= 8;
    }

    // === ADD-ONS ===
    const addons = features.filter(f => f.is_addon);
    if (addons.length > 0) {
      page.drawText('Add-Ons:', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      y -= 15;
      for (const f of addons) {
        const fr = f as unknown as Record<string, unknown>;
        const price = getNumber(fr, 'feature_price');
        page.drawText(`• ${getString(fr, 'feature_name')} - $${price.toLocaleString()}`, { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
        y -= 12;
      }
      y -= 8;
    }

    // === MAINTENANCE OPTION ===
    if (proposal.maintenance_option) {
      page.drawText('Maintenance Plan:', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      y -= 15;
      page.drawText(formatMaintenance(proposal.maintenance_option), { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 20;
    }

    // === PRICING SUMMARY ===
    y -= 10;
    page.drawText('Pricing Summary', { x: leftMargin, y: y, size: 14, font: helveticaBold, color: rgb(0, 0.4, 0.8) });
    y -= 18;

    page.drawText('Base Package Price:', { x: leftMargin, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    const basePriceText = `$${getNumber(p, 'base_price').toLocaleString()}`;
    page.drawText(basePriceText, { x: rightMargin - helvetica.widthOfTextAtSize(basePriceText, 10), y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    y -= 15;

    if (addons.length > 0) {
      const addonsTotal = addons.reduce((sum, f) => sum + (f.feature_price || 0), 0);
      page.drawText('Add-Ons:', { x: leftMargin, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      const addonsTotalText = `$${addonsTotal.toLocaleString()}`;
      page.drawText(addonsTotalText, { x: rightMargin - helvetica.widthOfTextAtSize(addonsTotalText, 10), y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
      y -= 15;
    }

    // Line
    y -= 5;
    page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    y -= 15;

    // Total
    page.drawText('Total:', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
    const totalText = `$${getNumber(p, 'final_price').toLocaleString()}`;
    page.drawText(totalText, { x: rightMargin - helveticaBold.widthOfTextAtSize(totalText, 12), y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });

    // === CLIENT NOTES ===
    if (proposal.client_notes) {
      y -= 35;
      page.drawText('Client Notes:', { x: leftMargin, y: y, size: 12, font: helveticaBold, color: rgb(0, 0, 0) });
      y -= 15;
      page.drawText(proposal.client_notes, { x: leftMargin + 10, y: y, size: 10, font: helvetica, color: rgb(0, 0, 0) });
    }

    // === FOOTER ===
    const footerY = 60;
    const footerText1 = 'This proposal is valid for 30 days from the date above.';
    const footerText2 = `Questions? Contact us at ${BUSINESS_INFO.email}`;
    page.drawText(footerText1, { x: (width - helvetica.widthOfTextAtSize(footerText1, 9)) / 2, y: footerY, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(footerText2, { x: (width - helvetica.widthOfTextAtSize(footerText2, 9)) / 2, y: footerY - 12, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

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
    res.json({ success: true, templates });
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
    res.json({ success: true, template });
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
      return res.status(400).json({ success: false, message: 'Template name is required' });
    }
    const template = await proposalService.createTemplate(req.body);
    res.status(201).json({ success: true, message: 'Template created successfully', template });
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
    res.json({ success: true, message: 'Template updated successfully', template });
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
    res.json({ success: true, message: 'Template deleted successfully' });
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
    res.json({ success: true, versions });
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
    res.status(201).json({ success: true, message: 'Version created successfully', version });
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
    res.json({ success: true, message: 'Version restored successfully' });
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
      return res.status(400).json({ success: false, message: 'version1 and version2 query params required' });
    }
    const comparison = await proposalService.compareVersions(
      parseInt(version1 as string),
      parseInt(version2 as string)
    );
    res.json({ success: true, comparison });
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
      return res.status(400).json({ success: false, message: 'signerEmail is required' });
    }
    const request = await proposalService.requestSignature(proposalId, signerEmail, signerName, expiresInDays);
    res.status(201).json({ success: true, message: 'Signature requested successfully', request });
  })
);

// Record a signature
router.post(
  '/:id/sign',
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const signatureData = req.body;
    if (!signatureData.signerName || !signatureData.signerEmail || !signatureData.signatureData) {
      return res.status(400).json({ success: false, message: 'signerName, signerEmail, and signatureData are required' });
    }
    // Add IP and user agent
    signatureData.ipAddress = req.ip;
    signatureData.userAgent = req.get('User-Agent');
    const signature = await proposalService.recordSignature(proposalId, signatureData);
    res.status(201).json({ success: true, message: 'Proposal signed successfully', signature });
  })
);

// Get signature status
router.get(
  '/:id/signature-status',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const proposalId = parseInt(req.params.id);
    const status = await proposalService.getSignatureStatus(proposalId);
    res.json({ success: true, ...status });
  })
);

// Get signature by token (public)
router.get(
  '/sign/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const request = await proposalService.getSignatureRequestByToken(token);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Invalid or expired signature request' });
    }
    // Mark as viewed
    await proposalService.markSignatureViewed(token);
    res.json({ success: true, request });
  })
);

// Decline signature
router.post(
  '/sign/:token/decline',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const { reason } = req.body;
    await proposalService.declineSignature(token, reason);
    res.json({ success: true, message: 'Signature declined' });
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
    res.json({ success: true, comments });
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
      return res.status(400).json({ success: false, message: 'Comment content is required' });
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
    res.status(201).json({ success: true, message: 'Comment added successfully', comment });
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
    res.json({ success: true, message: 'Comment deleted successfully' });
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
    res.json({ success: true, activities });
  })
);

// Track view (public with access token)
router.post(
  '/:id/track-view',
  asyncHandler(async (req: Request, res: Response) => {
    const proposalId = parseInt(req.params.id);
    await proposalService.trackView(proposalId, req.ip, req.get('User-Agent'));
    res.json({ success: true, message: 'View tracked' });
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
    res.json({ success: true, items });
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
      return res.status(400).json({ success: false, message: 'description and unitPrice are required' });
    }
    const item = await proposalService.addCustomItem(proposalId, req.body);
    res.status(201).json({ success: true, message: 'Custom item added successfully', item });
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
    res.json({ success: true, message: 'Custom item updated successfully', item });
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
    res.json({ success: true, message: 'Custom item deleted successfully' });
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
      return res.status(400).json({ success: false, message: 'type and value are required' });
    }
    if (!['percentage', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be percentage or fixed' });
    }
    await proposalService.applyDiscount(proposalId, type, value, reason);
    res.json({ success: true, message: 'Discount applied successfully' });
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
    res.json({ success: true, message: 'Discount removed successfully' });
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
      return res.status(400).json({ success: false, message: 'expirationDate is required' });
    }
    await proposalService.setExpiration(proposalId, expirationDate);
    res.json({ success: true, message: 'Expiration date set successfully' });
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
    res.json({ success: true, message: 'Proposal marked as sent' });
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
    res.json({ success: true, accessToken: token });
  })
);

// Get proposal by access token (public)
router.get(
  '/view/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;
    const proposalId = await proposalService.getProposalByAccessToken(token);
    if (!proposalId) {
      return res.status(404).json({ success: false, message: 'Invalid access token' });
    }
    // Track view
    await proposalService.trackView(proposalId, req.ip, req.get('User-Agent'));
    res.json({ success: true, proposalId });
  })
);

// Process expired proposals (admin or scheduler)
router.post(
  '/process-expired',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const count = await proposalService.processExpiredProposals();
    res.json({ success: true, message: `Processed ${count} expired proposal(s)` });
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
    res.json({ success: true, proposalIds });
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
    res.json({ success: true, message: 'Reminder marked as sent' });
  })
);

export default router;
