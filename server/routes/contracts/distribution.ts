/**
 * ===============================================
 * CONTRACT DISTRIBUTION ROUTES
 * ===============================================
 * @file server/routes/contracts/distribution.ts
 *
 * Sending, reminders, expiration, amendments, and renewal reminders.
 */

import express, { Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { contractService } from '../../services/contract-service.js';
import { getDatabase } from '../../database/init.js';
import { getString } from '../../database/row-helpers.js';
import { BUSINESS_INFO } from '../../config/business.js';
import { sendSuccess, sendCreated, errorResponse, ErrorCodes } from '../../utils/api-response.js';
import { getBaseUrl } from '../../config/environment.js';
import { validateRequest } from '../../middleware/validation.js';
import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from '../../config/email-styles.js';
import { ContractValidationSchemas } from './shared.js';

const router = express.Router();

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
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const p = project as Record<string, unknown>;
    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');

    // Validate email exists and has valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailRegex.test(clientEmail)) {
      return errorResponse(res, 'No valid client email on file', 400, ErrorCodes.VALIDATION_ERROR);
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

    const { emailService } = await import('../../services/email-service.js');
    await emailService.sendEmail({
      to: clientEmail,
      subject: `Contract Ready for Signature - ${projectName}`,
      text: `Hi ${clientName},\n\nYour contract for "${projectName}" is ready for review and signature.\n\nSign the contract here:\n${signatureUrl}\n\nPreview the contract here:\n${contractPreviewUrl}\n\nThanks,\n${BUSINESS_INFO.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: ${EMAIL_COLORS.contentBg}; padding: 24px; border-radius: 8px; }
    .btn { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.buttonContractBg}; color: ${EMAIL_COLORS.buttonContractText}; text-decoration: none; border-radius: 6px; font-weight: bold; }
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
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const p = project as Record<string, unknown>;
    const signatureToken = p.contract_signature_token as string | null;
    if (!signatureToken) {
      return errorResponse(res, 'No active signature token found', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');

    // Validate email exists and has valid format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailRegex.test(clientEmail)) {
      return errorResponse(res, 'No valid client email on file', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const baseUrl = getBaseUrl();
    const signatureUrl = `${baseUrl}/sign-contract.html?token=${signatureToken}`;
    const contractPreviewUrl = `${baseUrl}/api/projects/${contract.projectId}/contract/pdf`;
    const expiresAt = p.contract_signature_expires_at as string | null;

    const { emailService } = await import('../../services/email-service.js');
    await emailService.sendEmail({
      to: clientEmail,
      subject: `Reminder: Contract Signature Needed - ${projectName}`,
      text: `Hi ${clientName},\n\nThis is a friendly reminder to review and sign the contract for "${projectName}".\n\nSign the contract here:\n${signatureUrl}\n\nPreview the contract here:\n${contractPreviewUrl}\n\n${expiresAt ? `This request expires on ${new Date(expiresAt).toLocaleDateString('en-US')}.` : ''}\n\nThanks,\n${BUSINESS_INFO.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: ${EMAIL_COLORS.contentBg}; padding: 24px; border-radius: 8px; }
    .btn { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.buttonContractBg}; color: ${EMAIL_COLORS.buttonContractText}; text-decoration: none; border-radius: 6px; font-weight: bold; }
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
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Invalid contract ID', 400, ErrorCodes.VALIDATION_ERROR);
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
      return errorResponse(res, 'Project not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const p = project as Record<string, unknown>;
    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');
    const renewalAt = contract.renewalAt
      ? new Date(contract.renewalAt).toLocaleDateString('en-US')
      : 'soon';

    if (!clientEmail) {
      return errorResponse(res, 'No client email on file', 400, ErrorCodes.VALIDATION_ERROR);
    }

    const { emailService } = await import('../../services/email-service.js');
    await emailService.sendEmail({
      to: clientEmail,
      subject: `Renewal Reminder - ${projectName}`,
      text: `Hi ${clientName},\n\nThis is a reminder that your maintenance agreement for "${projectName}" is up for renewal on ${renewalAt}.\n\nPlease reply to this email if you'd like to renew.\n\nThanks,\n${BUSINESS_INFO.name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .content { background: ${EMAIL_COLORS.contentBg}; padding: 24px; border-radius: 8px; }
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

export { router as distributionRouter };
export default router;
