/**
 * ===============================================
 * CONTRACT CLIENT ROUTES
 * ===============================================
 * @file server/routes/contracts/client.ts
 *
 * Client-facing contract endpoints and activity timeline.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { canAccessContract } from '../../utils/access-control.js';
import { contractService } from '../../services/contract-service.js';
import { getDatabase } from '../../database/init.js';
import { getNumber } from '../../database/row-helpers.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../../utils/api-response.js';

const router = express.Router();

// ===================================
// CLIENT-FACING CONTRACTS
// ===================================

/**
 * @swagger
 * /api/contracts/my:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: Get client contracts
 *     description: Retrieve all non-cancelled contracts for the authenticated client.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Client contracts list
 *       401:
 *         description: Not authenticated
 */
router.get(
  '/my',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = getDatabase();
    const clientId = req.user?.id;

    if (!clientId || req.user?.type === 'admin') {
      return sendSuccess(res, { contracts: [] });
    }

    const contracts = await db.all(`
      SELECT
        c.id,
        c.project_id as projectId,
        p.project_name as projectName,
        c.status,
        c.signed_at as signedAt,
        c.created_at as createdAt,
        c.expires_at as expiresAt
      FROM contracts c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.client_id = ?
        AND c.status != 'cancelled'
      ORDER BY c.created_at DESC
    `, [clientId]);

    sendSuccess(res, { contracts });
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: Get a contract by ID
 *     description: Retrieve a single contract. Requires authorization to access the contract.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract details
 *       400:
 *         description: Invalid contract ID
 *       404:
 *         description: Contract not found
 */
router.get(
  '/:contractId',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    // Validate contractId is a valid number
    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Authorization check: verify user can access this contract
    if (!(await canAccessContract(req, contractId))) {
      return errorResponse(res, 'Contract not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const contract = await contractService.getContract(contractId);
    sendSuccess(res, { contract });
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}/activity:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: Get contract activity timeline
 *     description: Retrieve the signature and activity log for a contract. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Activity timeline
 *       400:
 *         description: Invalid contract ID
 *       404:
 *         description: Contract not found
 */
router.get(
  '/:contractId/activity',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    // Validate contract ID
    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();

    const contract = await db.get('SELECT project_id FROM contracts WHERE id = ?', [contractId]);
    if (!contract) {
      return errorResponse(res, 'Contract not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const projectId = getNumber(contract as Record<string, unknown>, 'project_id');
    // Filter by BOTH project_id AND contract_id for proper isolation
    const logs = await db.all(
      `SELECT id, action, actor_email, actor_ip, actor_user_agent, details, created_at
       FROM contract_signature_log
       WHERE project_id = ? AND contract_id = ?
       ORDER BY created_at DESC`,
      [projectId, contractId]
    );

    sendSuccess(res, { activity: logs });
  })
);

export { router as clientRouter };
export default router;
