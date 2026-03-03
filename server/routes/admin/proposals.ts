/**
 * ===============================================
 * ADMIN PROPOSALS ROUTES
 * ===============================================
 * @file server/routes/admin/proposals.ts
 *
 * Admin-specific proposal management endpoints.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { getDatabase } from '../../database/init.js';
import { errorResponse } from '../../utils/api-response.js';

// Explicit column lists for SELECT queries (avoid SELECT *)
const PROPOSAL_REQUEST_COLUMNS = `
  id, project_id, client_id, project_type, selected_tier, base_price, final_price,
  maintenance_option, status, client_notes, admin_notes, created_at, reviewed_at, reviewed_by,
  sent_at, updated_at
`.replace(/\s+/g, ' ').trim();

const router = express.Router();

/**
 * GET /api/admin/proposals - Get all proposals for admin
 */
router.get(
  '/proposals',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const db = getDatabase();

    const proposals = await db.all(`
      SELECT
        pr.id,
        COALESCE(p.project_name, 'Proposal #' || pr.id) as title,
        pr.client_id as clientId,
        COALESCE(c.company_name, c.contact_name) as clientName,
        pr.project_type as projectType,
        pr.status,
        pr.final_price as amount,
        pr.valid_until as validUntil,
        pr.created_at as createdAt,
        pr.sent_at as sentAt,
        pr.viewed_at as viewedAt,
        pr.accepted_at as acceptedAt
      FROM proposal_requests pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN clients c ON pr.client_id = c.id
      WHERE pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC
    `);

    // Map database statuses to frontend statuses
    const mappedProposals = proposals.map((p: Record<string, unknown>) => ({
      ...p,
      status: mapStatus(p.status as string),
    }));

    // Calculate stats
    const stats = {
      total: proposals.length,
      draft: mappedProposals.filter((p: { status: string }) => p.status === 'draft').length,
      sent: mappedProposals.filter((p: { status: string }) => p.status === 'sent').length,
      viewed: mappedProposals.filter((p: { status: string }) => p.status === 'viewed').length,
      accepted: mappedProposals.filter((p: { status: string }) => p.status === 'accepted').length,
      declined: mappedProposals.filter((p: { status: string }) => p.status === 'declined').length,
    };

    res.json({ proposals: mappedProposals, stats });
  })
);

/**
 * POST /api/admin/proposals/:proposalId/send - Send a proposal to client
 */
router.post(
  '/proposals/:proposalId/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const proposalId = parseInt(req.params.proposalId);

    if (isNaN(proposalId)) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Update the proposal status and sent_at
    await db.run(`
      UPDATE proposal_requests
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [proposalId]);

    const updated = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);

    res.json({ success: true, proposal: updated });
  })
);

/**
 * POST /api/admin/proposals/:proposalId/duplicate - Duplicate a proposal
 */
router.post(
  '/proposals/:proposalId/duplicate',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const proposalId = parseInt(req.params.proposalId);

    if (isNaN(proposalId)) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Get the original proposal
    const original = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);
    if (!original) {
      return errorResponse(res, 'Proposal not found', 404, 'NOT_FOUND');
    }

    // Create a duplicate
    const result = await db.run(`
      INSERT INTO proposal_requests (
        project_id, client_id, project_type, selected_tier,
        base_price, final_price, maintenance_option, client_notes,
        status, created_at, updated_at
      )
      SELECT
        project_id, client_id, project_type, selected_tier,
        base_price, final_price, maintenance_option, client_notes,
        'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM proposal_requests WHERE id = ?
    `, [proposalId]);

    const newProposal = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [result.lastID]);

    res.json({ success: true, proposal: newProposal });
  })
);

/**
 * DELETE /api/admin/proposals/:proposalId - Delete a proposal
 */
router.delete(
  '/proposals/:proposalId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const proposalId = parseInt(req.params.proposalId);

    if (isNaN(proposalId)) {
      return errorResponse(res, 'Invalid proposal ID', 400, 'INVALID_ID');
    }

    const db = getDatabase();

    // Soft delete
    await db.run(`
      UPDATE proposal_requests
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [proposalId]);

    res.json({ success: true });
  })
);

/**
 * Map database status to frontend status
 */
function mapStatus(dbStatus: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'draft',
    'reviewed': 'viewed',
    'accepted': 'accepted',
    'rejected': 'declined',
    'converted': 'accepted',
    'sent': 'sent',
    'viewed': 'viewed',
    'draft': 'draft',
    'declined': 'declined',
    'expired': 'expired',
  };

  return statusMap[dbStatus] || 'draft';
}

export default router;
