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
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';

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
      status: mapStatus(p.status as string)
    }));

    // Calculate stats
    const stats = {
      total: proposals.length,
      draft: mappedProposals.filter((p: { status: string }) => p.status === 'draft').length,
      sent: mappedProposals.filter((p: { status: string }) => p.status === 'sent').length,
      viewed: mappedProposals.filter((p: { status: string }) => p.status === 'viewed').length,
      accepted: mappedProposals.filter((p: { status: string }) => p.status === 'accepted').length,
      declined: mappedProposals.filter((p: { status: string }) => p.status === 'declined').length
    };

    sendSuccess(res, { proposals: mappedProposals, stats });
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
    const proposalId = parseInt(req.params.proposalId, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Update the proposal status and sent_at
    await db.run(`
      UPDATE proposal_requests
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [proposalId]);

    const updated = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);

    sendSuccess(res, { proposal: updated });
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
    const proposalId = parseInt(req.params.proposalId, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Get the original proposal
    const original = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);
    if (!original) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.NOT_FOUND);
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

    sendCreated(res, { proposal: newProposal });
  })
);

/**
 * PUT /api/admin/proposals/:proposalId - Update a proposal
 */
router.put(
  '/proposals/:proposalId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const proposalId = parseInt(req.params.proposalId, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.INVALID_ID);
    }

    const { status, admin_notes } = req.body;

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      values.push(admin_notes);
    }

    if (updates.length === 0) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.NO_FIELDS);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(proposalId);

    const db = getDatabase();

    await db.run(
      `UPDATE proposal_requests SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await db.get(`SELECT ${PROPOSAL_REQUEST_COLUMNS} FROM proposal_requests WHERE id = ?`, [proposalId]);

    sendSuccess(res, { proposal: updated });
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
    const proposalId = parseInt(req.params.proposalId, 10);

    if (isNaN(proposalId) || proposalId <= 0) {
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.INVALID_ID);
    }

    const db = getDatabase();

    // Soft delete
    await db.run(`
      UPDATE proposal_requests
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [proposalId]);

    sendSuccess(res);
  })
);

/**
 * POST /api/admin/proposals/bulk-delete - Bulk delete proposals
 */
router.post(
  '/proposals/bulk-delete',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { proposalIds } = req.body;

    if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
      return errorResponse(res, 'proposalIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    const db = getDatabase();
    let deleted = 0;

    for (const proposalId of proposalIds) {
      const id = typeof proposalId === 'string' ? parseInt(proposalId, 10) : proposalId;
      if (isNaN(id) || id <= 0) continue;

      const result = await db.run(
        'UPDATE proposals SET deleted_at = datetime(\'now\') WHERE id = ? AND deleted_at IS NULL',
        [id]
      );
      if (result.changes && result.changes > 0) {
        deleted++;
      }
    }

    sendSuccess(res, { deleted });
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
    'expired': 'expired'
  };

  return statusMap[dbStatus] || 'draft';
}

export default router;
