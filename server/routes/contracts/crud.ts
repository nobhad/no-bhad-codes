/**
 * ===============================================
 * CONTRACT CRUD ROUTES
 * ===============================================
 * @file server/routes/contracts/crud.ts
 *
 * Admin CRUD operations for contracts.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { contractService, type ContractStatus } from '../../services/contract-service.js';
import { sendSuccess, sendCreated, errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { workflowTriggerService } from '../../services/workflow-trigger-service.js';
import { validateRequest } from '../../middleware/validation.js';
import { ContractValidationSchemas } from './shared.js';

const router = express.Router();

// ===================================
// CONTRACT ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: List all contracts
 *     description: Retrieve all contracts with optional filtering by project, client, or status. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: integer
 *         description: Filter by client ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, signed, expired, cancelled, active, renewed]
 *         description: Filter by contract status
 *     responses:
 *       200:
 *         description: List of contracts
 *       400:
 *         description: Invalid status parameter
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Admin access required
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string) : undefined;
    const statusParam = req.query.status as string | undefined;
    let status: ContractStatus | undefined;

    if (statusParam && !contractService.isValidContractStatus(statusParam)) {
      return errorResponse(res, 'Invalid contract status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (statusParam) {
      status = statusParam as ContractStatus;
    }

    const contracts = await contractService.getContracts({
      projectId,
      clientId,
      status
    });

    sendSuccess(res, { contracts });
  })
);

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Create a new contract
 *     description: Create a contract with content for a project and client. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - clientId
 *               - content
 *             properties:
 *               projectId:
 *                 type: integer
 *               clientId:
 *                 type: integer
 *               content:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, sent, signed, expired, cancelled, active, renewed]
 *     responses:
 *       201:
 *         description: Contract created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.create, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId, clientId, content, status } = req.body;

    if (!projectId || !clientId || !content) {
      return errorResponse(
        res,
        'projectId, clientId, and content are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (status && !contractService.isValidContractStatus(status)) {
      return errorResponse(res, 'Invalid contract status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const contract = await contractService.createContract(req.body);

    // Emit workflow event for contract creation
    await workflowTriggerService.emit('contract.created', {
      entityId: contract.id,
      triggeredBy: req.user?.email || 'admin',
      projectId,
      clientId
    });

    sendCreated(res, { contract }, 'Contract created successfully');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}:
 *   put:
 *     tags:
 *       - Contracts
 *     summary: Update a contract
 *     description: Update contract content or status. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, sent, signed, expired, cancelled, active, renewed]
 *     responses:
 *       200:
 *         description: Contract updated
 *       400:
 *         description: Invalid contract ID or status
 *       401:
 *         description: Not authenticated
 */
router.put(
  '/:contractId',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.update, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (req.body?.status && !contractService.isValidContractStatus(req.body.status)) {
      return errorResponse(res, 'Invalid contract status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const contract = await contractService.updateContract(contractId, req.body);
    sendSuccess(res, { contract }, 'Contract updated successfully');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}:
 *   delete:
 *     tags:
 *       - Contracts
 *     summary: Cancel a contract
 *     description: Set contract status to cancelled. Admin only.
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
 *         description: Contract cancelled
 *       400:
 *         description: Invalid contract ID
 */
router.delete(
  '/:contractId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const contract = await contractService.updateContract(contractId, { status: 'cancelled' });
    sendSuccess(res, { contract }, 'Contract cancelled successfully');
  })
);

/**
 * @swagger
 * /api/contracts/bulk-delete:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Bulk cancel contracts
 *     description: Cancel multiple contracts at once by setting their status to cancelled. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractIds
 *             properties:
 *               contractIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Contracts cancelled
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/bulk-delete',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.bulkDelete),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { contractIds } = req.body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return errorResponse(res, 'contractIds array is required', 400, ErrorCodes.MISSING_REQUIRED_FIELDS);
    }

    let deleted = 0;
    for (const contractId of contractIds) {
      const id = typeof contractId === 'string' ? parseInt(contractId, 10) : contractId;
      if (isNaN(id) || id <= 0) continue;

      try {
        await contractService.updateContract(id, { status: 'cancelled' });
        deleted++;
      } catch {
        // Skip contracts that don't exist or can't be updated
      }
    }

    sendSuccess(res, { deleted }, `${deleted} contract(s) cancelled`);
  })
);

/**
 * @swagger
 * /api/contracts/from-template:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Create contract from template
 *     description: Create a new contract using an existing template. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - projectId
 *               - clientId
 *             properties:
 *               templateId:
 *                 type: integer
 *               projectId:
 *                 type: integer
 *               clientId:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [draft, sent, signed, expired, cancelled, active, renewed]
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Contract created from template
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.fromTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { templateId, projectId, clientId, status, expiresAt } = req.body;

    if (!templateId || !projectId || !clientId) {
      return errorResponse(
        res,
        'templateId, projectId, and clientId are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (status && !contractService.isValidContractStatus(status)) {
      return errorResponse(res, 'Invalid contract status', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const contract = await contractService.createContractFromTemplate({
      templateId,
      projectId,
      clientId,
      status,
      expiresAt: expiresAt || null
    });

    // Emit workflow event for contract creation
    await workflowTriggerService.emit('contract.created', {
      entityId: contract.id,
      triggeredBy: req.user?.email || 'admin',
      projectId,
      clientId,
      templateId
    });

    sendCreated(res, { contract }, 'Contract created successfully');
  })
);

export { router as crudRouter };
export default router;
