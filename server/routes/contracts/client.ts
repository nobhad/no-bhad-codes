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
import { getNumber, getString } from '../../database/row-helpers.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { logger } from '../../services/logger.js';

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

// ===================================
// AUTHENTICATED CONTRACT SIGNING
// ===================================

/**
 * @swagger
 * /api/contracts/sign:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Sign a contract (authenticated client)
 *     description: >
 *       Allows an authenticated client to sign a contract directly from the portal.
 *       Uses session cookie authentication (not token-based).
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractId, signerName, signatureData, agreedToTerms]
 *             properties:
 *               contractId:
 *                 type: integer
 *               signerName:
 *                 type: string
 *               signatureData:
 *                 type: string
 *                 description: Base64 PNG data URL
 *               agreedToTerms:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contract signed successfully
 *       400:
 *         description: Validation error or contract not signable
 *       403:
 *         description: Contract does not belong to authenticated client
 *       404:
 *         description: Contract not found
 */
router.post(
  '/sign',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { contractId, signerName, signatureData, agreedToTerms } = req.body;
    const db = getDatabase();

    // --- Validation ---
    if (!contractId || !signerName || !signatureData) {
      return errorResponse(
        res,
        'Contract ID, signer name, and signature data are required',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!agreedToTerms) {
      return errorResponse(
        res,
        'You must agree to the terms to sign',
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const clientId = req.user?.id;
    if (!clientId || req.user?.type === 'admin') {
      return errorResponse(res, 'Only clients can sign contracts', 403, ErrorCodes.ACCESS_DENIED);
    }

    // --- Fetch contract and verify ownership ---
    const contract = await db.get(
      `SELECT c.id, c.project_id, c.client_id, c.status, c.signed_at,
              p.project_name
       FROM contracts c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = ?`,
      [contractId]
    );

    if (!contract) {
      return errorResponse(res, 'Contract not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const c = contract as Record<string, unknown>;

    // Verify the contract belongs to this client
    if (getNumber(c, 'client_id') !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Verify contract status is 'sent' (awaiting signature)
    const status = getString(c, 'status');
    if (status !== 'sent' && status !== 'viewed') {
      const message = c.signed_at
        ? 'This contract has already been signed.'
        : 'This contract is not available for signing.';
      return errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const projectId = getNumber(c, 'project_id');
    const projectName = getString(c, 'project_name');
    const clientEmail = req.user?.email || '';
    const signerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const signerUserAgent = (req.get('user-agent') || 'unknown').substring(0, 500);
    const signedAt = new Date().toISOString();

    // --- Update contracts table ---
    await db.run(
      `UPDATE contracts SET
        status = 'signed',
        signed_at = ?,
        signer_name = ?,
        signer_email = ?,
        signer_ip = ?,
        signer_user_agent = ?,
        signature_data = ?,
        signature_token = NULL,
        signature_expires_at = NULL,
        updated_at = datetime('now')
       WHERE id = ?`,
      [signedAt, signerName, clientEmail, signerIp, signerUserAgent, signatureData, contractId]
    );

    // --- Dual-write: update projects table signature fields ---
    if (projectId) {
      await db.run(
        `UPDATE projects SET
          contract_signed_at = ?,
          contract_signature_token = NULL,
          contract_signature_expires_at = NULL,
          contract_signer_name = ?,
          contract_signer_email = ?,
          contract_signer_ip = ?,
          contract_signer_user_agent = ?,
          contract_signature_data = ?
         WHERE id = ?`,
        [signedAt, signerName, clientEmail, signerIp, signerUserAgent, signatureData, projectId]
      );
    }

    // --- Log to contract_signature_log ---
    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, actor_ip, actor_user_agent, details)
       VALUES (?, ?, 'signed', ?, ?, ?, ?)`,
      [
        projectId || null,
        contractId,
        clientEmail,
        signerIp,
        signerUserAgent,
        JSON.stringify({ signerName, signedAt, method: 'portal' })
      ]
    );

    logger.info(
      `[Contract] Contract ${contractId} signed in-portal by ${signerName} (${clientEmail}) for project ${projectId || 'N/A'}`
    );

    sendSuccess(res, {
      signedAt,
      signerName,
      contractId,
      projectName
    }, 'Contract signed successfully');
  })
);

export { router as clientRouter };
export default router;
