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
import { errorResponse, sendSuccess, sendCreated, ErrorCodes } from '../../utils/api-response.js';
import { proposalService } from '../../services/proposal-service.js';

const router = express.Router();

/**
 * GET /api/admin/proposals - Get all proposals for admin
 */
router.get(
  '/proposals',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: express.Response) => {
    const proposals = await proposalService.getAllProposalsForAdmin();

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

    const updated = await proposalService.sendProposalToClient(proposalId);

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

    const { original, duplicate } = await proposalService.duplicateProposal(proposalId);
    if (!original) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.NOT_FOUND);
    }

    sendCreated(res, { proposal: duplicate });
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

    const { updated, proposal } = await proposalService.updateProposalFields(
      proposalId,
      { status, admin_notes }
    );

    if (!updated) {
      return errorResponse(res, 'No fields to update', 400, ErrorCodes.NO_FIELDS);
    }

    sendSuccess(res, { proposal });
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

    await proposalService.softDeleteProposal(proposalId);

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

    const deleted = await proposalService.bulkSoftDeleteProposals(proposalIds);

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
