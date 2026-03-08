/**
 * ===============================================
 * PROPOSAL VERSIONING ROUTES
 * ===============================================
 * @file server/routes/proposals/versions.ts
 *
 * Version CRUD endpoints for proposal versioning.
 */

import express, { Response } from 'express';
import {
  asyncHandler,
  authenticateToken,
  requireAdmin,
  canAccessProposal,
  proposalService,
  ErrorCodes,
  errorResponse,
  sendSuccess,
  sendCreated
} from './helpers.js';
import type { AuthenticatedRequest } from './helpers.js';

const router = express.Router();

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
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check for non-admin users
    if (req.user?.type !== 'admin' && !(await canAccessProposal(req, proposalId))) {
      return errorResponse(res, 'Proposal not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
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
      return errorResponse(res, 'Invalid proposal ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid proposal or version ID', 400, ErrorCodes.VALIDATION_ERROR);
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
        ErrorCodes.VALIDATION_ERROR
      );
    }
    const comparison = await proposalService.compareVersions(
      parseInt(version1 as string),
      parseInt(version2 as string)
    );
    sendSuccess(res, { comparison });
  })
);

export { router as versionsRouter };
