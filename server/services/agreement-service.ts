/**
 * ===============================================
 * AGREEMENT SERVICE
 * ===============================================
 * @file server/services/agreement-service.ts
 *
 * Manages the unified project agreement flow:
 * proposal review → contract signing → deposit payment → questionnaire
 * all in a single step-by-step experience.
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

// ============================================
// Constants
// ============================================

/** Default agreement expiry: 30 days from send */
const DEFAULT_EXPIRY_DAYS = 30;
const REMINDER_7D_THRESHOLD_DAYS = 7;
const REMINDER_3D_THRESHOLD_DAYS = 3;

import type {
  AgreementRow,
  AgreementStepRow,
  CreateAgreementParams,
  CreateFromTemplateParams,
  EnrichedAgreement,
  EnrichedAgreementStep
} from './agreement-types.js';

// ============================================
// CRUD
// ============================================

/**
 * Create a new agreement with steps.
 */
async function createAgreement(params: CreateAgreementParams): Promise<number> {
  const db = getDatabase();

  const result = await db.run(
    `INSERT INTO project_agreements
     (project_id, client_id, name, status, proposal_id, contract_id, questionnaire_id,
      welcome_message, current_step, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
    [
      params.projectId,
      params.clientId,
      params.name || 'Project Agreement',
      params.proposalId || null,
      params.contractId || null,
      params.questionnaireId || null,
      params.welcomeMessage || null
    ]
  );

  const agreementId = result.lastID!;

  // Insert steps in order
  for (let i = 0; i < params.steps.length; i++) {
    const step = params.steps[i];
    await db.run(
      `INSERT INTO agreement_steps
       (agreement_id, step_type, step_order, status, entity_id, custom_title, custom_content, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        agreementId,
        step.stepType,
        i,
        step.entityId || null,
        step.customTitle || null,
        step.customContent || null
      ]
    );
  }

  logger.info('Created agreement', {
    category: 'agreements',
    metadata: { agreementId, projectId: params.projectId, stepCount: params.steps.length }
  });

  return agreementId;
}

/**
 * Create an agreement from a template type.
 * Auto-detects proposal, contract, and questionnaire from the project.
 */
async function createFromTemplate(params: CreateFromTemplateParams): Promise<number> {
  const { projectId, clientId, templateType = 'standard' } = params;
  const db = getDatabase();

  // Detect existing entities for the project
  const proposal = (await db.get(
    'SELECT id FROM proposal_requests WHERE project_id = ? AND status IN (\'sent\', \'viewed\') ORDER BY created_at DESC LIMIT 1',
    [projectId]
  )) as { id: number } | undefined;

  const contract = (await db.get(
    'SELECT id FROM contracts WHERE project_id = ? AND status IN (\'draft\', \'sent\', \'viewed\') AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
    [projectId]
  )) as { id: number } | undefined;

  const questionnaire = (await db.get(
    'SELECT qr.questionnaire_id as id FROM questionnaire_responses qr WHERE qr.project_id = ? AND qr.status = \'pending\' ORDER BY qr.created_at ASC LIMIT 1',
    [projectId]
  )) as { id: number } | undefined;

  // Find first unpaid invoice for deposit
  const depositInvoice = (await db.get(
    'SELECT id FROM invoices WHERE project_id = ? AND status IN (\'draft\', \'sent\', \'pending\', \'overdue\') AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
    [projectId]
  )) as { id: number } | undefined;

  // Build steps based on template
  const steps: CreateAgreementParams['steps'] = [];

  if (templateType === 'standard') {
    // Welcome message
    steps.push({
      stepType: 'welcome',
      customTitle: 'Welcome',
      customContent: 'Thank you for choosing to work with us! Please complete the following steps to get your project started.'
    });

    // Proposal review (if exists)
    if (proposal) {
      steps.push({ stepType: 'proposal_review', entityId: proposal.id });
    }
  }

  // Contract signing (if exists)
  if (contract) {
    steps.push({ stepType: 'contract_sign', entityId: contract.id });
  }

  // Deposit payment (if exists)
  if (depositInvoice) {
    steps.push({ stepType: 'deposit_payment', entityId: depositInvoice.id });
  }

  // Questionnaire (if exists)
  if (questionnaire) {
    steps.push({ stepType: 'questionnaire', entityId: questionnaire.id });
  }

  return createAgreement({
    projectId,
    clientId,
    name: 'Project Agreement',
    proposalId: proposal?.id,
    contractId: contract?.id,
    questionnaireId: questionnaire?.id,
    steps
  });
}

// ============================================
// Queries
// ============================================

/**
 * Get agreements for a client.
 */
async function getClientAgreements(clientId: number): Promise<AgreementRow[]> {
  const db = getDatabase();
  return (await db.all(
    `SELECT * FROM project_agreements
     WHERE client_id = ? AND status != 'cancelled'
     ORDER BY created_at DESC`,
    [clientId]
  )) as AgreementRow[];
}

/**
 * Get agreements for admin (all or by project).
 */
async function getAgreements(projectId?: number): Promise<AgreementRow[]> {
  const db = getDatabase();
  if (projectId) {
    return (await db.all(
      'SELECT * FROM project_agreements WHERE project_id = ? ORDER BY created_at DESC',
      [projectId]
    )) as AgreementRow[];
  }
  return (await db.all(
    'SELECT * FROM project_agreements ORDER BY created_at DESC LIMIT 100'
  )) as AgreementRow[];
}

/**
 * Get a single agreement with enriched step data.
 */
async function getEnrichedAgreement(agreementId: number, clientId?: number): Promise<EnrichedAgreement | null> {
  const db = getDatabase();

  let query = 'SELECT * FROM project_agreements WHERE id = ?';
  const queryParams: (string | number | null)[] = [agreementId];
  if (clientId) {
    query += ' AND client_id = ?';
    queryParams.push(clientId);
  }

  const agreement = (await db.get(query, queryParams)) as AgreementRow | undefined;
  if (!agreement) return null;

  // Get steps
  const steps = (await db.all(
    'SELECT * FROM agreement_steps WHERE agreement_id = ? ORDER BY step_order ASC',
    [agreementId]
  )) as AgreementStepRow[];

  // Get project and client info
  const project = (await db.get(
    'SELECT project_name as name, status FROM projects WHERE id = ?',
    [agreement.project_id]
  )) as { name: string; status: string } | undefined;

  const client = (await db.get(
    'SELECT COALESCE(contact_name, company_name) as name, email FROM clients WHERE id = ?',
    [agreement.client_id]
  )) as { name: string; email: string } | undefined;

  // Enrich steps with entity data
  const enrichedSteps: EnrichedAgreementStep[] = await Promise.all(
    steps.map(async (step) => {
      const enriched: EnrichedAgreementStep = { ...step };

      if (step.entity_id) {
        try {
          switch (step.step_type) {
          case 'proposal_review': {
            const proposal = await db.get(
              'SELECT id, project_type, selected_tier, final_price, status FROM proposal_requests WHERE id = ?',
              [step.entity_id]
            );
            enriched.entityData = (proposal as Record<string, unknown>) || undefined;
            break;
          }
          case 'contract_sign': {
            const contract = await db.get(
              'SELECT id, status, signed_at FROM contracts WHERE id = ?',
              [step.entity_id]
            );
            enriched.entityData = (contract as Record<string, unknown>) || undefined;
            break;
          }
          case 'deposit_payment': {
            const invoice = await db.get(
              'SELECT id, total_amount, status, invoice_number FROM invoices WHERE id = ?',
              [step.entity_id]
            );
            enriched.entityData = (invoice as Record<string, unknown>) || undefined;
            break;
          }
          case 'questionnaire': {
            const qr = await db.get(
              'SELECT qr.id, qr.status, q.name FROM questionnaire_responses qr JOIN questionnaires q ON qr.questionnaire_id = q.id WHERE qr.questionnaire_id = ?',
              [step.entity_id]
            );
            enriched.entityData = (qr as Record<string, unknown>) || undefined;
            break;
          }
          }
        } catch {
          // Non-critical enrichment failure
        }
      }

      return enriched;
    })
  );

  return {
    ...agreement,
    steps: enrichedSteps,
    project: project || undefined,
    client: client || undefined
  };
}

// ============================================
// Step Completion
// ============================================

/**
 * Mark a step as completed and advance the agreement.
 */
async function completeStep(agreementId: number, stepId: number, clientId?: number): Promise<void> {
  const db = getDatabase();

  // Validate agreement ownership
  const agreement = (await db.get(
    clientId
      ? 'SELECT * FROM project_agreements WHERE id = ? AND client_id = ?'
      : 'SELECT * FROM project_agreements WHERE id = ?',
    clientId ? [agreementId, clientId] : [agreementId]
  )) as AgreementRow | undefined;

  if (!agreement) throw new Error('Agreement not found');
  if (['completed', 'cancelled', 'expired'].includes(agreement.status)) {
    throw new Error(`Agreement is already ${agreement.status}`);
  }

  // Check expiration
  if (agreement.expires_at && new Date(agreement.expires_at) < new Date()) {
    await db.run(
      'UPDATE project_agreements SET status = \'expired\', updated_at = datetime(\'now\') WHERE id = ?',
      [agreementId]
    );
    throw new Error('Agreement has expired');
  }

  // Validate and complete the step
  const step = (await db.get(
    'SELECT * FROM agreement_steps WHERE id = ? AND agreement_id = ?',
    [stepId, agreementId]
  )) as AgreementStepRow | undefined;

  if (!step) throw new Error('Step not found');
  if (step.status === 'completed') return; // Idempotent

  await db.run(
    'UPDATE agreement_steps SET status = \'completed\', completed_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
    [stepId]
  );

  // Check if all steps are completed
  const pendingSteps = (await db.get(
    'SELECT COUNT(*) as count FROM agreement_steps WHERE agreement_id = ? AND status != \'completed\' AND status != \'skipped\'',
    [agreementId]
  )) as { count: number };

  if (pendingSteps.count === 0) {
    // All steps done — mark agreement as completed
    await db.run(
      'UPDATE project_agreements SET status = \'completed\', completed_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
      [agreementId]
    );

    logger.info('Agreement completed', {
      category: 'agreements',
      metadata: { agreementId, projectId: agreement.project_id }
    });

    // Emit workflow event
    try {
      const { workflowTriggerService } = await import('./workflow-trigger-service.js');
      await workflowTriggerService.emit('agreement.completed', {
        entityId: agreementId,
        triggeredBy: 'agreement-flow',
        clientId: agreement.client_id,
        projectId: agreement.project_id
      });
    } catch {
      // Non-critical
    }
  } else {
    // Advance current_step to next pending step
    const nextStep = (await db.get(
      'SELECT step_order FROM agreement_steps WHERE agreement_id = ? AND status = \'pending\' ORDER BY step_order ASC LIMIT 1',
      [agreementId]
    )) as { step_order: number } | undefined;

    if (nextStep) {
      await db.run(
        'UPDATE project_agreements SET current_step = ?, status = \'in_progress\', updated_at = datetime(\'now\') WHERE id = ?',
        [nextStep.step_order, agreementId]
      );
    }
  }
}

// ============================================
// Status Updates
// ============================================

/**
 * Send agreement to client (updates status and sent_at).
 */
async function sendAgreement(agreementId: number, expiresInDays?: number): Promise<void> {
  const db = getDatabase();
  const expiryDays = expiresInDays ?? DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  await db.run(
    `UPDATE project_agreements
     SET status = 'sent', sent_at = datetime('now'),
         expires_at = COALESCE(expires_at, ?),
         updated_at = datetime('now')
     WHERE id = ? AND status = 'draft'`,
    [expiresAt, agreementId]
  );

  // Mark first step as active
  const firstStep = (await db.get(
    'SELECT id FROM agreement_steps WHERE agreement_id = ? ORDER BY step_order ASC LIMIT 1',
    [agreementId]
  )) as { id: number } | undefined;

  if (firstStep) {
    await db.run(
      'UPDATE agreement_steps SET status = \'active\', started_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
      [firstStep.id]
    );
  }

  logger.info('Agreement sent', { category: 'agreements', metadata: { agreementId } });
}

/**
 * Record that a client viewed the agreement.
 */
async function recordView(agreementId: number, clientId: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    `UPDATE project_agreements
     SET viewed_at = COALESCE(viewed_at, datetime('now')),
         status = CASE WHEN status = 'sent' THEN 'in_progress' ELSE status END,
         updated_at = datetime('now')
     WHERE id = ? AND client_id = ?`,
    [agreementId, clientId]
  );
}

/**
 * Cancel an agreement.
 */
async function cancelAgreement(agreementId: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE project_agreements SET status = \'cancelled\', updated_at = datetime(\'now\') WHERE id = ?',
    [agreementId]
  );
}

/**
 * Auto-complete a step by entity type and ID (called from webhook/workflow handlers).
 */
async function autoCompleteByEntity(entityType: string, entityId: number): Promise<void> {
  const db = getDatabase();

  const stepTypeMap: Record<string, string> = {
    proposal: 'proposal_review',
    contract: 'contract_sign',
    invoice: 'deposit_payment',
    questionnaire: 'questionnaire'
  };

  const stepType = stepTypeMap[entityType];
  if (!stepType) return;

  // Find pending steps matching this entity
  const steps = (await db.all(
    `SELECT s.id, s.agreement_id FROM agreement_steps s
     JOIN project_agreements a ON s.agreement_id = a.id
     WHERE s.step_type = ? AND s.entity_id = ? AND s.status != 'completed'
     AND a.status NOT IN ('completed', 'cancelled')`,
    [stepType, entityId]
  )) as Array<{ id: number; agreement_id: number }>;

  for (const step of steps) {
    await completeStep(step.agreement_id, step.id);
  }
}

// ============================================
// Expiration & Reminders
// ============================================

/**
 * Set expiration on an agreement (admin action).
 * Defaults to DEFAULT_EXPIRY_DAYS from now if no date provided.
 */
async function setExpiration(agreementId: number, expiresAt?: string): Promise<void> {
  const db = getDatabase();
  const expiry = expiresAt || new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await db.run(
    'UPDATE project_agreements SET expires_at = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [expiry, agreementId]
  );
}

/**
 * Reorder steps within an agreement (admin action for drag-to-reorder).
 * Accepts an array of step IDs in the desired order.
 */
async function reorderSteps(agreementId: number, stepIds: number[]): Promise<void> {
  const db = getDatabase();

  // Validate all steps belong to this agreement
  const existing = (await db.all(
    'SELECT id FROM agreement_steps WHERE agreement_id = ? ORDER BY step_order ASC',
    [agreementId]
  )) as Array<{ id: number }>;

  const existingIds = new Set(existing.map(s => s.id));
  for (const id of stepIds) {
    if (!existingIds.has(id)) throw new Error(`Step ${id} does not belong to agreement ${agreementId}`);
  }

  // Update step_order for each step
  for (let i = 0; i < stepIds.length; i++) {
    await db.run(
      'UPDATE agreement_steps SET step_order = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [i, stepIds[i]]
    );
  }

  logger.info('Reordered agreement steps', {
    category: 'agreements',
    metadata: { agreementId, stepCount: stepIds.length }
  });
}

/**
 * Process agreement expiration reminders and auto-expire.
 * Called by scheduler cron job.
 */
async function processExpirations(): Promise<{ reminded7d: number; reminded3d: number; expired: number }> {
  const db = getDatabase();
  const now = new Date();
  let reminded7d = 0;
  let reminded3d = 0;
  let expired = 0;

  // Find active agreements with expiration set
  const agreements = (await db.all(
    `SELECT pa.*, c.email as client_email, COALESCE(c.contact_name, c.company_name) as client_name
     FROM project_agreements pa
     JOIN clients c ON pa.client_id = c.id
     WHERE pa.expires_at IS NOT NULL
       AND pa.status IN ('sent', 'viewed', 'in_progress')
     ORDER BY pa.expires_at ASC`
  )) as Array<AgreementRow & { client_email: string; client_name: string }>;

  for (const agreement of agreements) {
    const expiresAt = new Date(agreement.expires_at!);
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Already expired
    if (daysUntilExpiry <= 0) {
      await db.run(
        'UPDATE project_agreements SET status = \'expired\', updated_at = datetime(\'now\') WHERE id = ?',
        [agreement.id]
      );
      expired++;

      logger.info('Agreement expired', {
        category: 'agreements',
        metadata: { agreementId: agreement.id, clientId: agreement.client_id }
      });

      // Send expiration notification
      try {
        const { emailService } = await import('./email-service.js');
        const { getPortalUrl } = await import('../config/environment.js');
        const { BUSINESS_INFO } = await import('../config/business.js');

        await emailService.sendEmail({
          to: agreement.client_email,
          subject: `Your agreement "${agreement.name}" has expired - ${BUSINESS_INFO.name}`,
          text: `Hi ${agreement.client_name},\n\nYour agreement "${agreement.name}" has expired. Please contact us if you'd like to discuss next steps.\n\nBest regards,\n${BUSINESS_INFO.name}`,
          html: `<p>Hi ${agreement.client_name},</p><p>Your agreement "<strong>${agreement.name}</strong>" has expired.</p><p>Please <a href="${getPortalUrl()}/agreements">log in to your portal</a> or contact us if you'd like to discuss next steps.</p><p>Best regards,<br>${BUSINESS_INFO.name}</p>`
        });
      } catch {
        // Non-critical
      }

      // Emit workflow event
      try {
        const { workflowTriggerService } = await import('./workflow-trigger-service.js');
        await workflowTriggerService.emit('agreement.expired', {
          entityId: agreement.id,
          triggeredBy: 'agreement-expiration-cron',
          clientId: agreement.client_id,
          projectId: agreement.project_id
        });
      } catch {
        // Non-critical
      }
      continue;
    }

    // 7-day reminder
    if (daysUntilExpiry <= REMINDER_7D_THRESHOLD_DAYS && !agreement.reminder_sent_7d) {
      try {
        const { emailService } = await import('./email-service.js');
        const { getPortalUrl } = await import('../config/environment.js');
        const { BUSINESS_INFO } = await import('../config/business.js');

        await emailService.sendEmail({
          to: agreement.client_email,
          subject: `Reminder: Your agreement expires in ${Math.ceil(daysUntilExpiry)} days - ${BUSINESS_INFO.name}`,
          text: `Hi ${agreement.client_name},\n\nYour agreement "${agreement.name}" will expire in ${Math.ceil(daysUntilExpiry)} days. Please complete the remaining steps before it expires.\n\nBest regards,\n${BUSINESS_INFO.name}`,
          html: `<p>Hi ${agreement.client_name},</p><p>Your agreement "<strong>${agreement.name}</strong>" will expire in <strong>${Math.ceil(daysUntilExpiry)} days</strong>.</p><p>Please <a href="${getPortalUrl()}/agreements">complete the remaining steps</a> before it expires.</p><p>Best regards,<br>${BUSINESS_INFO.name}</p>`
        });

        await db.run(
          'UPDATE project_agreements SET reminder_sent_7d = 1, updated_at = datetime(\'now\') WHERE id = ?',
          [agreement.id]
        );
        reminded7d++;
      } catch {
        // Non-critical
      }
    }

    // 3-day reminder
    if (daysUntilExpiry <= REMINDER_3D_THRESHOLD_DAYS && !agreement.reminder_sent_3d) {
      try {
        const { emailService } = await import('./email-service.js');
        const { getPortalUrl } = await import('../config/environment.js');
        const { BUSINESS_INFO } = await import('../config/business.js');

        await emailService.sendEmail({
          to: agreement.client_email,
          subject: `Urgent: Your agreement expires in ${Math.ceil(daysUntilExpiry)} days - ${BUSINESS_INFO.name}`,
          text: `Hi ${agreement.client_name},\n\nYour agreement "${agreement.name}" will expire in ${Math.ceil(daysUntilExpiry)} days. Please complete the remaining steps as soon as possible.\n\nBest regards,\n${BUSINESS_INFO.name}`,
          html: `<p>Hi ${agreement.client_name},</p><p>Your agreement "<strong>${agreement.name}</strong>" will expire in <strong>${Math.ceil(daysUntilExpiry)} days</strong>.</p><p>Please <a href="${getPortalUrl()}/agreements">complete the remaining steps</a> as soon as possible.</p><p>Best regards,<br>${BUSINESS_INFO.name}</p>`
        });

        await db.run(
          'UPDATE project_agreements SET reminder_sent_3d = 1, updated_at = datetime(\'now\') WHERE id = ?',
          [agreement.id]
        );
        reminded3d++;
      } catch {
        // Non-critical
      }
    }
  }

  if (reminded7d > 0 || reminded3d > 0 || expired > 0) {
    logger.info('Processed agreement expirations', {
      category: 'agreements',
      metadata: { reminded7d, reminded3d, expired }
    });
  }

  return { reminded7d, reminded3d, expired };
}

// ============================================
// Singleton Export
// ============================================

export const agreementService = {
  createAgreement,
  createFromTemplate,
  getClientAgreements,
  getAgreements,
  getEnrichedAgreement,
  completeStep,
  sendAgreement,
  recordView,
  cancelAgreement,
  autoCompleteByEntity,
  setExpiration,
  reorderSteps,
  processExpirations
};
