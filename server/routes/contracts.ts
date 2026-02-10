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
import { contractService, type ContractStatus } from '../services/contract-service.js';
import { getDatabase } from '../database/init.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { BUSINESS_INFO } from '../config/business.js';

const router = express.Router();

// ===================================
// CONTRACT ENDPOINTS
// ===================================

// Get all contracts
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
      return res.status(400).json({ success: false, message: 'Invalid contract status' });
    }

    if (statusParam) {
      status = statusParam as ContractStatus;
    }

    const contracts = await contractService.getContracts({
      projectId,
      clientId,
      status
    });

    res.json({ success: true, contracts });
  })
);

// Create contract from template
router.post(
  '/from-template',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { templateId, projectId, clientId, status, expiresAt } = req.body;

    if (!templateId || !projectId || !clientId) {
      return res.status(400).json({ success: false, message: 'templateId, projectId, and clientId are required' });
    }

    if (status && !contractService.isValidContractStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid contract status' });
    }

    const contract = await contractService.createContractFromTemplate({
      templateId,
      projectId,
      clientId,
      status,
      expiresAt: expiresAt || null
    });

    res.status(201).json({ success: true, message: 'Contract created successfully', contract });
  })
);

// Get single contract
router.get(
  '/:contractId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
    const contract = await contractService.getContract(contractId);
    res.json({ success: true, contract });
  })
);

// Contract activity timeline
router.get(
  '/:contractId/activity',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
    const db = getDatabase();

    const contract = await db.get('SELECT project_id FROM contracts WHERE id = ?', [contractId]);
    if (!contract) {
      return res.status(404).json({ success: false, message: 'Contract not found' });
    }

    const projectId = getNumber(contract as Record<string, unknown>, 'project_id');
    const logs = await db.all(
      `SELECT id, action, actor_email, actor_ip, actor_user_agent, details, created_at
       FROM contract_signature_log
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      [projectId]
    );

    res.json({ success: true, activity: logs });
  })
);

// Create contract
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { projectId, clientId, content, status } = req.body;

    if (!projectId || !clientId || !content) {
      return res.status(400).json({ success: false, message: 'projectId, clientId, and content are required' });
    }

    if (status && !contractService.isValidContractStatus(status)) {
      return res.status(400).json({ success: false, message: 'Invalid contract status' });
    }

    const contract = await contractService.createContract(req.body);
    res.status(201).json({ success: true, message: 'Contract created successfully', contract });
  })
);

// Update contract
router.put(
  '/:contractId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);

    if (req.body?.status && !contractService.isValidContractStatus(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Invalid contract status' });
    }

    const contract = await contractService.updateContract(contractId, req.body);
    res.json({ success: true, message: 'Contract updated successfully', contract });
  })
);

// Resend reminder for unsigned contract
router.post(
  '/:contractId/resend-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
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
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const p = project as Record<string, unknown>;
    const signatureToken = p.contract_signature_token as string | null;
    if (!signatureToken) {
      return res.status(400).json({ success: false, message: 'No active signature token found' });
    }

    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');

    if (!clientEmail) {
      return res.status(400).json({ success: false, message: 'No client email on file' });
    }

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
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
      `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
       VALUES (?, 'reminder_sent', ?, ?)`,
      [contract.projectId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    await db.run(
      `UPDATE contracts SET last_reminder_at = datetime('now'), reminder_count = COALESCE(reminder_count, 0) + 1
       WHERE id = ?`,
      [contractId]
    );

    res.json({ success: true, message: 'Reminder sent successfully' });
  })
);

// Expire contract
router.post(
  '/:contractId/expire',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
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
      `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
       VALUES (?, 'expired', ?, ?)`,
      [contract.projectId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    res.json({ success: true, message: 'Contract expired', contract });
  })
);

// Create amendment linked to original contract
router.post(
  '/:contractId/amendment',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
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

    res.status(201).json({ success: true, message: 'Amendment created', contract: amendment });
  })
);

// Send renewal reminder
router.post(
  '/:contractId/renewal-reminder',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
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
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const p = project as Record<string, unknown>;
    const clientEmail = getString(p, 'email');
    const clientName = getString(p, 'contact_name') || 'there';
    const projectName = getString(p, 'project_name');
    const renewalAt = contract.renewalAt ? new Date(contract.renewalAt).toLocaleDateString('en-US') : 'soon';

    if (!clientEmail) {
      return res.status(400).json({ success: false, message: 'No client email on file' });
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
      `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
       VALUES (?, 'renewal_reminder_sent', ?, ?)`,
      [contract.projectId, req.user?.email || 'admin', JSON.stringify({ contractId })]
    );

    res.json({ success: true, message: 'Renewal reminder sent' });
  })
);

// Cancel contract
router.delete(
  '/:contractId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const contractId = parseInt(req.params.contractId);
    const contract = await contractService.updateContract(contractId, { status: 'cancelled' });
    res.json({ success: true, message: 'Contract cancelled successfully', contract });
  })
);

// ===================================
// TEMPLATE ENDPOINTS
// ===================================

// Get all templates
router.get(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { type } = req.query;

    if (type && typeof type === 'string' && !contractService.isValidTemplateType(type)) {
      return res.status(400).json({ success: false, message: 'Invalid template type' });
    }

    const templates = await contractService.getTemplates(type as string | undefined);
    res.json({ success: true, templates });
  })
);

// Get single template
router.get(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId);
    const template = await contractService.getTemplate(templateId);
    res.json({ success: true, template });
  })
);

// Create template
router.post(
  '/templates',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, type, content } = req.body;

    if (!name || !type || !content) {
      return res.status(400).json({ success: false, message: 'name, type, and content are required' });
    }

    if (!contractService.isValidTemplateType(type)) {
      return res.status(400).json({ success: false, message: 'Invalid template type' });
    }

    const template = await contractService.createTemplate(req.body);
    res.status(201).json({ success: true, message: 'Template created successfully', template });
  })
);

// Update template
router.put(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(req.params.templateId);

    if (req.body?.type && !contractService.isValidTemplateType(req.body.type)) {
      return res.status(400).json({ success: false, message: 'Invalid template type' });
    }

    const template = await contractService.updateTemplate(templateId, req.body);
    res.json({ success: true, message: 'Template updated successfully', template });
  })
);

// Delete template
router.delete(
  '/templates/:templateId',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const templateId = parseInt(_req.params.templateId);
    await contractService.deleteTemplate(templateId);
    res.json({ success: true, message: 'Template deleted successfully' });
  })
);

export default router;
