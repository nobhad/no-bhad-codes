/**
 * ===============================================
 * CONTRACT ROUTES
 * ===============================================
 * @file server/routes/contracts.ts
 *
 * API endpoints for contract templates.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { canAccessContract } from '../middleware/access-control.js';
import { contractService, type ContractStatus } from '../services/contract-service.js';
import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { BUSINESS_INFO } from '../config/business.js';
import { sendSuccess, sendCreated, errorResponse } from '../utils/api-response.js';
import { workflowTriggerService } from '../services/workflow-trigger-service.js';
import { getBaseUrl } from '../config/environment.js';
import { validateRequest, ValidationSchema } from '../middleware/validation.js';

const router = express.Router();

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const CONTRACT_CONTENT_MAX_LENGTH = 100000;
const CONTRACT_NAME_MAX_LENGTH = 200;
const CONTRACT_STATUS_VALUES = ['draft', 'sent', 'signed', 'expired', 'cancelled', 'active', 'renewed'];
const TEMPLATE_TYPE_VALUES = ['service-agreement', 'nda', 'scope-of-work', 'maintenance', 'custom'];
const BULK_DELETE_MAX_IDS = 100;

const ContractValidationSchemas = {
  create: {
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    clientId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    content: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
    ],
    status: {
      type: 'string' as const,
      allowedValues: CONTRACT_STATUS_VALUES
    }
  } as ValidationSchema,

  update: {
    content: { type: 'string' as const, maxLength: CONTRACT_CONTENT_MAX_LENGTH },
    status: {
      type: 'string' as const,
      allowedValues: CONTRACT_STATUS_VALUES
    }
  } as ValidationSchema,

  fromTemplate: {
    templateId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    projectId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    clientId: [
      { type: 'required' as const },
      { type: 'number' as const, min: 1 }
    ],
    status: {
      type: 'string' as const,
      allowedValues: CONTRACT_STATUS_VALUES
    },
    expiresAt: { type: 'string' as const, maxLength: 30 }
  } as ValidationSchema,

  bulkDelete: {
    contractIds: [
      { type: 'required' as const },
      { type: 'array' as const, minLength: 1, maxLength: BULK_DELETE_MAX_IDS }
    ]
  } as ValidationSchema,

  createTemplate: {
    name: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: CONTRACT_NAME_MAX_LENGTH }
    ],
    type: [
      { type: 'required' as const },
      { type: 'string' as const, allowedValues: TEMPLATE_TYPE_VALUES }
    ],
    content: [
      { type: 'required' as const },
      { type: 'string' as const, minLength: 1, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
    ]
  } as ValidationSchema,

  updateTemplate: {
    name: { type: 'string' as const, minLength: 1, maxLength: CONTRACT_NAME_MAX_LENGTH },
    type: { type: 'string' as const, allowedValues: TEMPLATE_TYPE_VALUES },
    content: { type: 'string' as const, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
  } as ValidationSchema,

  amendment: {
    content: { type: 'string' as const, maxLength: CONTRACT_CONTENT_MAX_LENGTH }
  } as ValidationSchema
};

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
      return errorResponse(res, 'Invalid contract status', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'contractIds array is required', 400, 'VALIDATION_ERROR');
    }

    let deleted = 0;
    for (const contractId of contractIds) {
      const id = typeof contractId === 'string' ? parseInt(contractId, 10) : contractId;
      if (isNaN(id)) continue;

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
      return errorResponse(res, 'Invalid contract status', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    // Authorization check: verify user can access this contract
    if (!(await canAccessContract(req, contractId))) {
      return errorResponse(res, 'Contract not found', 404, 'RESOURCE_NOT_FOUND');
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
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();

    const contract = await db.get('SELECT project_id FROM contracts WHERE id = ?', [contractId]);
    if (!contract) {
      return errorResponse(res, 'Contract not found', 404, 'RESOURCE_NOT_FOUND');
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
      return errorResponse(res, 'Invalid contract status', 400, 'VALIDATION_ERROR');
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
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    if (req.body?.status && !contractService.isValidContractStatus(req.body.status)) {
      return errorResponse(res, 'Invalid contract status', 400, 'VALIDATION_ERROR');
    }

    const contract = await contractService.updateContract(contractId, req.body);
    sendSuccess(res, { contract }, 'Contract updated successfully');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}/send:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Send contract for signature
 *     description: Email the contract to the client with a signature link. Admin only.
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
 *         description: Contract sent for signature
 *       400:
 *         description: Invalid contract ID or missing client email
 *       404:
 *         description: Project not found
 */
router.post(
  '/:contractId/send',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();

    const contract = await contractService.getContract(contractId);

    // Get project and client info
    const project = await db.get(
      `SELECT p.id, p.project_name, p.contract_signature_token, p.contract_signature_expires_at,
              c.contact_name, c.email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [contract.projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const p = project as Record<string, unknown>;
    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');

    // Validate email exists and has valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailRegex.test(clientEmail)) {
      return errorResponse(res, 'No valid client email on file', 400, 'VALIDATION_ERROR');
    }

    // Generate signature token if not exists
    let signatureToken = p.contract_signature_token as string | null;
    if (!signatureToken) {
      const crypto = await import('crypto');
      signatureToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      const CONTRACT_SIGNATURE_EXPIRY_DAYS = 30;
      expiresAt.setDate(expiresAt.getDate() + CONTRACT_SIGNATURE_EXPIRY_DAYS);

      await db.run(
        'UPDATE projects SET contract_signature_token = ?, contract_signature_expires_at = ? WHERE id = ?',
        [signatureToken, expiresAt.toISOString(), contract.projectId]
      );
    }

    const baseUrl = getBaseUrl();
    const signatureUrl = `${baseUrl}/sign-contract.html?token=${signatureToken}`;
    const contractPreviewUrl = `${baseUrl}/api/projects/${contract.projectId}/contract/pdf`;

    const { emailService } = await import('../services/email-service.js');
    await emailService.sendEmail({
      to: clientEmail,
      subject: `Contract Ready for Signature - ${projectName}`,
      text: `Hi ${clientName},\n\nYour contract for "${projectName}" is ready for review and signature.\n\nSign the contract here:\n${signatureUrl}\n\nPreview the contract here:\n${contractPreviewUrl}\n\nThanks,\n${BUSINESS_INFO.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 8px; }
    .btn { display: inline-block; padding: 12px 24px; background: #00aff0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>Your contract for <strong>"${projectName}"</strong> is ready for review and signature.</p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="${signatureUrl}" class="btn">Sign Contract</a>
      </p>
      <p>Preview the contract here: <a href="${contractPreviewUrl}">${contractPreviewUrl}</a></p>
      <p>Thanks,<br>${BUSINESS_INFO.name}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    // Log the send action
    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, details)
       VALUES (?, ?, 'sent', ?, ?)`,
      [contract.projectId, contractId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    // Update contract status to sent if it's a draft
    let updatedContract = contract;
    if (contract.status === 'draft') {
      updatedContract = await contractService.updateContract(contractId, { status: 'sent' });
    }

    sendSuccess(res, { contract: updatedContract }, 'Contract sent for signature');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}/resend-reminder:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Resend signature reminder
 *     description: Send a reminder email for an unsigned contract. Admin only.
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
 *         description: Reminder sent
 *       400:
 *         description: No active signature token or invalid email
 *       404:
 *         description: Project not found
 */
router.post(
  '/:contractId/resend-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();

    const contract = await contractService.getContract(contractId);
    const project = await db.get(
      `SELECT p.project_name, p.contract_signature_token, p.contract_signature_expires_at,
              c.contact_name, c.email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [contract.projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const p = project as Record<string, unknown>;
    const signatureToken = p.contract_signature_token as string | null;
    if (!signatureToken) {
      return errorResponse(res, 'No active signature token found', 400, 'VALIDATION_ERROR');
    }

    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');

    // Validate email exists and has valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailRegex.test(clientEmail)) {
      return errorResponse(res, 'No valid client email on file', 400, 'VALIDATION_ERROR');
    }

    const baseUrl = getBaseUrl();
    const signatureUrl = `${baseUrl}/sign-contract.html?token=${signatureToken}`;
    const contractPreviewUrl = `${baseUrl}/api/projects/${contract.projectId}/contract/pdf`;
    const expiresAt = p.contract_signature_expires_at as string | null;

    const { emailService } = await import('../services/email-service.js');
    await emailService.sendEmail({
      to: clientEmail,
      subject: `Reminder: Contract Signature Needed - ${projectName}`,
      text: `Hi ${clientName},\n\nThis is a friendly reminder to review and sign the contract for "${projectName}".\n\nSign the contract here:\n${signatureUrl}\n\nPreview the contract here:\n${contractPreviewUrl}\n\n${expiresAt ? `This request expires on ${new Date(expiresAt).toLocaleDateString('en-US')}.` : ''}\n\nThanks,\n${BUSINESS_INFO.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 8px; }
    .btn { display: inline-block; padding: 12px 24px; background: #00aff0; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>This is a friendly reminder to review and sign the contract for <strong>"${projectName}"</strong>.</p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="${signatureUrl}" class="btn">Sign Contract</a>
      </p>
      <p>Preview the contract here: <a href="${contractPreviewUrl}">${contractPreviewUrl}</a></p>
      ${expiresAt ? `<p>This request expires on ${new Date(expiresAt).toLocaleDateString('en-US')}.</p>` : ''}
      <p>Thanks,<br>${BUSINESS_INFO.name}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, details)
       VALUES (?, ?, 'reminder_sent', ?, ?)`,
      [contract.projectId, contractId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    await db.run(
      `UPDATE contracts SET last_reminder_at = datetime('now'), reminder_count = COALESCE(reminder_count, 0) + 1
       WHERE id = ?`,
      [contractId]
    );

    sendSuccess(res, undefined, 'Reminder sent successfully');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}/expire:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Expire a contract
 *     description: Set contract status to expired and invalidate signature token. Admin only.
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
 *         description: Contract expired
 *       400:
 *         description: Invalid contract ID
 */
router.post(
  '/:contractId/expire',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const contract = await contractService.updateContract(contractId, {
      status: 'expired',
      expiresAt: now
    });

    await db.run(
      `UPDATE projects SET
        contract_signature_expires_at = ?,
        contract_signature_token = NULL
       WHERE id = ?`,
      [now, contract.projectId]
    );

    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, details)
       VALUES (?, ?, 'expired', ?, ?)`,
      [contract.projectId, contractId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    sendSuccess(res, { contract }, 'Contract expired');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}/amendment:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Create a contract amendment
 *     description: Create an amendment linked to an existing contract. Admin only.
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
 *     responses:
 *       201:
 *         description: Amendment created
 *       400:
 *         description: Invalid contract ID
 */
router.post(
  '/:contractId/amendment',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.amendment, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const { content } = req.body;

    const original = await contractService.getContract(contractId);
    const amendment = await contractService.createContract({
      templateId: original.templateId || null,
      projectId: original.projectId,
      clientId: original.clientId,
      content: content || original.content,
      status: 'draft',
      variables: original.variables,
      parentContractId: original.id
    });

    sendCreated(res, { contract: amendment }, 'Amendment created');
  })
);

/**
 * @swagger
 * /api/contracts/{contractId}/renewal-reminder:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Send renewal reminder
 *     description: Email a renewal reminder for an expiring contract. Admin only.
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
 *         description: Renewal reminder sent
 *       400:
 *         description: No client email on file
 *       404:
 *         description: Project not found
 */
router.post(
  '/:contractId/renewal-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId, 10);

    if (isNaN(contractId) || contractId <= 0) {
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const db = getDatabase();
    const contract = await contractService.getContract(contractId);

    const project = await db.get(
      `SELECT p.project_name, c.contact_name, c.email
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.id = ?`,
      [contract.projectId]
    );

    if (!project) {
      return errorResponse(res, 'Project not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const p = project as Record<string, unknown>;
    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');
    const renewalAt = contract.renewalAt
      ? new Date(contract.renewalAt).toLocaleDateString('en-US')
      : 'soon';

    if (!clientEmail) {
      return errorResponse(res, 'No client email on file', 400, 'VALIDATION_ERROR');
    }

    const { emailService } = await import('../services/email-service.js');
    await emailService.sendEmail({
      to: clientEmail,
      subject: `Renewal Reminder - ${projectName}`,
      text: `Hi ${clientName},\n\nThis is a reminder that your maintenance agreement for "${projectName}" is up for renewal on ${renewalAt}.\n\nPlease reply to this email if you'd like to renew.\n\nThanks,\n${BUSINESS_INFO.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: #f9f9f9; padding: 24px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <p>Hi ${clientName},</p>
      <p>This is a reminder that your maintenance agreement for <strong>"${projectName}"</strong> is up for renewal on ${renewalAt}.</p>
      <p>Please reply to this email if you'd like to renew.</p>
      <p>Thanks,<br>${BUSINESS_INFO.name}</p>
    </div>
  </div>
</body>
</html>
      `.trim()
    });

    await contractService.updateContract(contractId, {
      renewalReminderSentAt: new Date().toISOString(),
      lastReminderAt: new Date().toISOString(),
      reminderCount: (contract.reminderCount || 0) + 1
    });

    await db.run(
      `INSERT INTO contract_signature_log (project_id, contract_id, action, actor_email, details)
       VALUES (?, ?, 'renewal_reminder_sent', ?, ?)`,
      [contract.projectId, contractId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    sendSuccess(res, undefined, 'Renewal reminder sent');
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
      return errorResponse(res, 'Invalid contract ID', 400, 'VALIDATION_ERROR');
    }

    const contract = await contractService.updateContract(contractId, { status: 'cancelled' });
    sendSuccess(res, { contract }, 'Contract cancelled successfully');
  })
);

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

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

/**
 * @swagger
 * /api/contracts/templates:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: List contract templates
 *     description: Retrieve all contract templates with optional type filter. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [service-agreement, nda, scope-of-work, maintenance, custom]
 *     responses:
 *       200:
 *         description: List of templates
 *       400:
 *         description: Invalid template type
 */
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.query;

    if (type && typeof type === 'string' && !contractService.isValidTemplateType(type)) {
      return errorResponse(res, 'Invalid template type', 400, 'VALIDATION_ERROR');
    }

    const templates = await contractService.getTemplates(type as string | undefined);
    sendSuccess(res, { templates });
  })
);

/**
 * @swagger
 * /api/contracts/templates/{templateId}:
 *   get:
 *     tags:
 *       - Contracts
 *     summary: Get a contract template
 *     description: Retrieve a single contract template by ID. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template details
 *       400:
 *         description: Invalid template ID
 */
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, 'VALIDATION_ERROR');
    }

    const template = await contractService.getTemplate(templateId);
    sendSuccess(res, { template });
  })
);

/**
 * @swagger
 * /api/contracts/templates:
 *   post:
 *     tags:
 *       - Contracts
 *     summary: Create a contract template
 *     description: Create a new reusable contract template. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [service-agreement, nda, scope-of-work, maintenance, custom]
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Template created
 *       400:
 *         description: Validation error
 */
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.createTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, type, content } = req.body;

    if (!name || !type || !content) {
      return errorResponse(res, 'name, type, and content are required', 400, 'VALIDATION_ERROR');
    }

    if (!contractService.isValidTemplateType(type)) {
      return errorResponse(res, 'Invalid template type', 400, 'VALIDATION_ERROR');
    }

    const template = await contractService.createTemplate(req.body);
    sendCreated(res, { template }, 'Template created successfully');
  })
);

/**
 * @swagger
 * /api/contracts/templates/{templateId}:
 *   put:
 *     tags:
 *       - Contracts
 *     summary: Update a contract template
 *     description: Update an existing contract template. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template updated
 *       400:
 *         description: Validation error
 */
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  validateRequest(ContractValidationSchemas.updateTemplate, { allowUnknownFields: true }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, 'VALIDATION_ERROR');
    }

    if (req.body?.type && !contractService.isValidTemplateType(req.body.type)) {
      return errorResponse(res, 'Invalid template type', 400, 'VALIDATION_ERROR');
    }

    const template = await contractService.updateTemplate(templateId, req.body);
    sendSuccess(res, { template }, 'Template updated successfully');
  })
);

/**
 * @swagger
 * /api/contracts/templates/{templateId}:
 *   delete:
 *     tags:
 *       - Contracts
 *     summary: Delete a contract template
 *     description: Delete a contract template by ID. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Template deleted
 *       400:
 *         description: Invalid template ID
 */
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(_req.params.templateId, 10);

    if (isNaN(templateId) || templateId <= 0) {
      return errorResponse(res, 'Invalid template ID', 400, 'VALIDATION_ERROR');
    }

    await contractService.deleteTemplate(templateId);
    sendSuccess(res, undefined, 'Template deleted successfully');
  })
);

export default router;
