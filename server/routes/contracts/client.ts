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
    const clientId = req.user?.id;

    if (!clientId || req.user?.type === 'admin') {
      return sendSuccess(res, { contracts: [] });
    }

    const contracts = await contractService.getClientContracts(clientId);
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

    const projectId = await contractService.getContractProjectId(contractId);
    if (projectId === null) {
      return errorResponse(res, 'Contract not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const logs = await contractService.getContractActivity(contractId, projectId);
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
    const contract = await contractService.getContractForSigning(contractId);

    if (!contract) {
      return errorResponse(res, 'Contract not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    // Verify the contract belongs to this client
    if (getNumber(contract, 'client_id') !== clientId) {
      return errorResponse(res, 'Access denied', 403, ErrorCodes.ACCESS_DENIED);
    }

    // Verify contract status is 'sent' (awaiting signature)
    const status = getString(contract, 'status');
    if (status !== 'sent' && status !== 'viewed') {
      const message = contract.signed_at
        ? 'This contract has already been signed.'
        : 'This contract is not available for signing.';
      return errorResponse(res, message, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const projectId = getNumber(contract, 'project_id');
    const projectName = getString(contract, 'project_name');
    const clientEmail = req.user?.email || '';
    const signerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const signerUserAgent = (req.get('user-agent') || 'unknown').substring(0, 500);
    const signedAt = new Date().toISOString();

    // --- Execute signing via service ---
    await contractService.signContractFromPortal({
      contractId,
      projectId: projectId || null,
      signedAt,
      signerName,
      clientEmail,
      signerIp,
      signerUserAgent,
      signatureData
    });

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
