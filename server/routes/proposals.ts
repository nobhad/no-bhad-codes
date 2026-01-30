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
import PDFDocument from 'pdfkit';
import { join } from 'path';
import { existsSync } from 'fs';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';

// Business info from environment variables
const BUSINESS_INFO = {
  name: process.env.BUSINESS_NAME || '',
  contact: process.env.BUSINESS_CONTACT || '',
  email: process.env.BUSINESS_EMAIL || '',
  website: process.env.BUSINESS_WEBSITE || ''
};

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
      JOIN projects p ON pr.project_id = p.id
      JOIN clients c ON pr.client_id = c.id
    `;
    const params: (string | number)[] = [];

    if (status && VALID_STATUSES.includes(status as string)) {
      query += ' WHERE pr.status = ?';
      params.push(status as string);
    }

    query += ' ORDER BY pr.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const proposals = await db.all(query, params) as unknown as ProposalRow[];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM proposal_requests';
    const countParams: string[] = [];
    if (status && VALID_STATUSES.includes(status as string)) {
      countQuery += ' WHERE status = ?';
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

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

    // Set response headers
    const projectName = getString(p, 'project_name').replace(/[^a-zA-Z0-9]/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="proposal-${projectName}-${id}.pdf"`
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to format date
    const formatDate = (dateStr: string | undefined): string => {
      if (!dateStr) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Helper to format tier name
    const formatTier = (tier: string): string => {
      const tierNames: Record<string, string> = {
        'good': 'GOOD',
        'better': 'BETTER',
        'best': 'BEST'
      };
      return tierNames[tier] || tier.toUpperCase();
    };

    // Helper to format maintenance option
    const formatMaintenance = (option: string | null): string => {
      if (!option) return 'None';
      const maintenanceNames: Record<string, string> = {
        'diy': 'DIY (Self-Managed)',
        'essential': 'Essential Plan',
        'standard': 'Standard Plan',
        'premium': 'Premium Plan'
      };
      return maintenanceNames[option] || option;
    };

    // === HEADER WITH LOGO ===
    const logoPath = join(process.cwd(), 'public/images/avatar_pdf.png');
    if (existsSync(logoPath)) {
      doc.image(logoPath, (doc.page.width - 60) / 2, 30, { width: 60 });
      doc.moveDown(4);
    }

    // Business header line
    doc.y = 100;
    doc.fontSize(10).font('Helvetica-Bold')
      .text(BUSINESS_INFO.name, { continued: true, align: 'center' })
      .font('Helvetica')
      .text(` | ${BUSINESS_INFO.contact} | ${BUSINESS_INFO.email} | ${BUSINESS_INFO.website}`, { align: 'center' });

    doc.moveDown(2);

    // === PROPOSAL TITLE ===
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0066cc')
      .text('Project Proposal', { align: 'center' });
    doc.fillColor('black');
    doc.moveDown(1);

    // === PROPOSAL INFO ===
    const leftCol = 50;
    const rightCol = 350;
    let currentY = doc.y;

    // Left column: Prepared For
    doc.fontSize(10).font('Helvetica-Bold').text('Prepared For:', leftCol, currentY);
    doc.font('Helvetica').text(getString(p, 'client_name') || 'Client', leftCol, currentY + 15);
    if (proposal.company_name) {
      doc.text(proposal.company_name, leftCol, currentY + 30);
    }
    doc.text(getString(p, 'client_email') || '', leftCol, currentY + (proposal.company_name ? 45 : 30));

    // Right column: Prepared By & Date
    doc.font('Helvetica-Bold').text('Prepared By:', rightCol, currentY);
    doc.font('Helvetica').text(BUSINESS_INFO.name, rightCol, currentY + 15);
    doc.font('Helvetica-Bold').text('Date:', rightCol, currentY + 45);
    doc.font('Helvetica').text(formatDate(getString(p, 'created_at')), rightCol, currentY + 60);

    doc.y = currentY + 90;
    doc.moveDown(1);

    // === PROJECT DETAILS ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('Project Details');
    doc.fillColor('black');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').text('Project: ', { continued: true });
    doc.font('Helvetica').text(getString(p, 'project_name'));

    const projectDesc = p.project_description as string | undefined;
    if (projectDesc) {
      doc.font('Helvetica-Bold').text('Description: ', { continued: true });
      doc.font('Helvetica').text(projectDesc);
    }

    doc.font('Helvetica-Bold').text('Project Type: ', { continued: true });
    doc.font('Helvetica').text(getString(p, 'project_type').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

    doc.moveDown(1);

    // === SELECTED PACKAGE ===
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('Selected Package');
    doc.fillColor('black');
    doc.moveDown(0.5);

    const selectedTier = formatTier(getString(p, 'selected_tier'));
    doc.fontSize(12).font('Helvetica-Bold').text(`${selectedTier} Tier`);
    doc.fontSize(10).font('Helvetica').text(`Base Price: $${getNumber(p, 'base_price').toLocaleString()}`);

    doc.moveDown(1);

    // === INCLUDED FEATURES ===
    const includedFeatures = features.filter(f => f.is_included_in_tier);
    if (includedFeatures.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Included Features:');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      includedFeatures.forEach(f => {
        const fr = f as unknown as Record<string, unknown>;
        doc.text(`• ${getString(fr, 'feature_name')}`, { indent: 10 });
      });
      doc.moveDown(0.5);
    }

    // === ADD-ONS ===
    const addons = features.filter(f => f.is_addon);
    if (addons.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Add-Ons:');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      addons.forEach(f => {
        const fr = f as unknown as Record<string, unknown>;
        const price = getNumber(fr, 'feature_price');
        doc.text(`• ${getString(fr, 'feature_name')} - $${price.toLocaleString()}`, { indent: 10 });
      });
      doc.moveDown(0.5);
    }

    // === MAINTENANCE OPTION ===
    if (proposal.maintenance_option) {
      doc.fontSize(12).font('Helvetica-Bold').text('Maintenance Plan:');
      doc.fontSize(10).font('Helvetica').text(formatMaintenance(proposal.maintenance_option), { indent: 10 });
      doc.moveDown(0.5);
    }

    // === PRICING SUMMARY ===
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc').text('Pricing Summary');
    doc.fillColor('black');
    doc.moveDown(0.5);

    // Table
    const tableLeft = 50;
    const tableRight = 450;
    currentY = doc.y;

    // Base price row
    doc.fontSize(10).font('Helvetica').text('Base Package Price:', tableLeft, currentY);
    doc.text(`$${getNumber(p, 'base_price').toLocaleString()}`, tableRight, currentY, { width: 100, align: 'right' });
    currentY += 18;

    // Add-ons total
    if (addons.length > 0) {
      const addonsTotal = addons.reduce((sum, f) => sum + (f.feature_price || 0), 0);
      doc.text('Add-Ons:', tableLeft, currentY);
      doc.text(`$${addonsTotal.toLocaleString()}`, tableRight, currentY, { width: 100, align: 'right' });
      currentY += 18;
    }

    // Line
    currentY += 5;
    doc.moveTo(tableLeft, currentY).lineTo(550, currentY).stroke();
    currentY += 15;

    // Total
    doc.fontSize(12).font('Helvetica-Bold')
      .text('Total:', tableLeft, currentY);
    doc.text(`$${getNumber(p, 'final_price').toLocaleString()}`, tableRight, currentY, { width: 100, align: 'right' });

    // === CLIENT NOTES ===
    if (proposal.client_notes) {
      doc.y = currentY + 40;
      doc.fontSize(12).font('Helvetica-Bold').text('Client Notes:');
      doc.fontSize(10).font('Helvetica').text(proposal.client_notes, { indent: 10 });
    }

    // === FOOTER ===
    doc.y = doc.page.height - 80;
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text('This proposal is valid for 30 days from the date above.', { align: 'center' });
    doc.text(`Questions? Contact us at ${BUSINESS_INFO.email}`, { align: 'center' });

    // Finalize PDF
    doc.end();
  })
);

export default router;
