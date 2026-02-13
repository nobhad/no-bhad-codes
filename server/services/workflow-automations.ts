/**
 * ===============================================
 * WORKFLOW AUTOMATIONS
 * ===============================================
 * @file server/services/workflow-automations.ts
 *
 * Business logic handlers for workflow events.
 * Implements automations that execute when specific events occur:
 * - Proposal accepted -> Create project
 * - Contract signed -> Update project status to active
 * - Milestone completed -> Create draft invoice (if payment milestone)
 */

import { getDatabase } from '../database/init.js';
import { workflowTriggerService } from './workflow-trigger-service.js';
import { InvoiceService } from './invoice-service.js';
import { generateDefaultMilestones } from './milestone-generator.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { logger } from './logger.js';
import { emailService } from './email-service.js';

// ============================================
// Types
// ============================================

interface ProposalData {
  id: number;
  project_id: number | null;
  client_id: number;
  project_type: string | null;
  selected_tier: string | null;
  final_price: number | null;
  description: string | null;
  project_name: string | null;
  maintenance_option: string | null;
}

// MilestoneData type for future use when milestones have payment fields
interface _MilestoneData {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  invoice_amount: number | null;
  is_payment_milestone: boolean;
}

// ============================================
// Automation Handlers
// ============================================

/**
 * Handler: Proposal Accepted -> Create Project
 *
 * When a proposal is accepted:
 * 1. Check if project already exists (proposal may be linked to existing project)
 * 2. If no project, create new project record
 * 3. Set project status to 'pending' (awaiting contract)
 * 4. Copy relevant data from proposal (client_id, price, description)
 * 5. Generate default milestones
 * 6. Emit project.created event
 */
async function handleProposalAccepted(data: { entityId?: number | null; triggeredBy?: string }): Promise<void> {
  const proposalId = data.entityId;
  if (!proposalId) {
    console.warn('[WorkflowAutomation] proposal.accepted: No proposalId provided');
    return;
  }

  const db = getDatabase();

  try {
    // Get the proposal details
    const proposalRow = await db.get(
      `SELECT id, project_id, client_id, project_type, selected_tier, final_price,
              description, project_name, maintenance_option
       FROM proposal_requests WHERE id = ?`,
      [proposalId]
    );

    if (!proposalRow) {
      console.warn(`[WorkflowAutomation] proposal.accepted: Proposal ${proposalId} not found`);
      return;
    }

    const proposal: ProposalData = {
      id: getNumber(proposalRow as Record<string, unknown>, 'id'),
      project_id: (proposalRow as Record<string, unknown>).project_id as number | null,
      client_id: getNumber(proposalRow as Record<string, unknown>, 'client_id'),
      project_type: getString(proposalRow as Record<string, unknown>, 'project_type') || null,
      selected_tier: getString(proposalRow as Record<string, unknown>, 'selected_tier') || null,
      final_price: (proposalRow as Record<string, unknown>).final_price as number | null,
      description: getString(proposalRow as Record<string, unknown>, 'description') || null,
      project_name: getString(proposalRow as Record<string, unknown>, 'project_name') || null,
      maintenance_option: getString(proposalRow as Record<string, unknown>, 'maintenance_option') || null
    };

    // Check if project already exists
    if (proposal.project_id) {
      logger.info('proposal.accepted: Project already exists', {
        category: 'workflow',
        metadata: { projectId: proposal.project_id, proposalId }
      });

      // Update existing project with proposal data if needed
      await db.run(
        `UPDATE projects SET
          price = COALESCE(?, price),
          project_type = COALESCE(?, project_type),
          description = COALESCE(?, description),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          proposal.final_price,
          proposal.project_type,
          proposal.description,
          proposal.project_id
        ]
      );

      return;
    }

    // Create new project from proposal
    const projectName = proposal.project_name ||
      `${proposal.project_type || 'Web'} Project - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

    const result = await db.run(
      `INSERT INTO projects (
        client_id, project_name, project_type, description, status, price,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        proposal.client_id,
        projectName,
        proposal.project_type,
        proposal.description,
        proposal.final_price
      ]
    );

    const projectId = result.lastID;

    // Link proposal to the new project
    await db.run(
      'UPDATE proposal_requests SET project_id = ? WHERE id = ?',
      [projectId, proposalId]
    );

    logger.info('proposal.accepted: Created project from proposal', {
      category: 'workflow',
      metadata: { projectId, proposalId }
    });

    // Generate default milestones for the project
    try {
      const milestoneResult = await generateDefaultMilestones(projectId!, proposal.project_type);
      logger.info('proposal.accepted: Generated milestones and tasks', {
        category: 'workflow',
        metadata: {
          projectId,
          milestonesCreated: milestoneResult.milestonesCreated,
          tasksCreated: milestoneResult.tasksCreated
        }
      });
    } catch (milestoneError) {
      console.error('[WorkflowAutomation] proposal.accepted: Failed to generate milestones:', milestoneError);
      // Don't fail the automation if milestone generation fails
    }

    // Emit project.created event
    await workflowTriggerService.emit('project.created', {
      entityId: projectId,
      triggeredBy: data.triggeredBy || 'workflow-automation',
      clientId: proposal.client_id,
      projectType: proposal.project_type,
      proposalId: proposalId
    });

  } catch (error) {
    console.error('[WorkflowAutomation] proposal.accepted: Error creating project:', error);
    throw error;
  }
}

/**
 * Handler: Contract Signed -> Update Project Status
 *
 * When a contract is signed:
 * 1. Update linked project status to 'active'
 * 2. Log the status change in contract_signature_log
 * 3. Emit contract.signed event
 */
async function handleContractSigned(data: {
  entityId?: number | null;
  triggeredBy?: string;
  projectId?: number;
  signerName?: string;
  signerEmail?: string;
}): Promise<void> {
  const db = getDatabase();

  // Get project ID from event data or contract
  let projectId = data.projectId;

  if (!projectId && data.entityId) {
    // entityId might be the contract ID, get the project from it
    const contract = await db.get(
      'SELECT project_id FROM contracts WHERE id = ?',
      [data.entityId]
    );
    if (contract) {
      projectId = getNumber(contract as Record<string, unknown>, 'project_id');
    }
  }

  if (!projectId) {
    console.warn('[WorkflowAutomation] contract.signed: No projectId available');
    return;
  }

  try {
    // Get current project status
    const project = await db.get(
      'SELECT id, status, project_name FROM projects WHERE id = ?',
      [projectId]
    );

    if (!project) {
      logger.warn('contract.signed: Project not found', {
        category: 'workflow',
        metadata: { projectId }
      });
      return;
    }

    const previousStatus = getString(project as Record<string, unknown>, 'status');

    // Only update if not already active or completed
    if (previousStatus === 'active' || previousStatus === 'completed' || previousStatus === 'in-progress') {
      logger.info('contract.signed: Project already in active state, skipping', {
        category: 'workflow',
        metadata: { projectId, previousStatus }
      });
      return;
    }

    // Update project status to 'active'
    await db.run(
      `UPDATE projects SET
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [projectId]
    );

    logger.info('contract.signed: Updated project status to active', {
      category: 'workflow',
      metadata: { projectId }
    });

    // Log to contract_signature_log
    await db.run(
      `INSERT INTO contract_signature_log (project_id, action, actor_email, details)
       VALUES (?, 'project_activated', ?, ?)`,
      [
        projectId,
        data.triggeredBy || 'workflow-automation',
        JSON.stringify({
          previousStatus,
          newStatus: 'active',
          signerName: data.signerName,
          activatedAt: new Date().toISOString()
        })
      ]
    );

    // Emit project.status_changed event
    await workflowTriggerService.emit('project.status_changed', {
      entityId: projectId,
      triggeredBy: data.triggeredBy || 'workflow-automation',
      previousStatus,
      newStatus: 'active',
      reason: 'contract_signed'
    });

  } catch (error) {
    console.error('[WorkflowAutomation] contract.signed: Error updating project status:', error);
    throw error;
  }
}

/**
 * Handler: Milestone Completed -> Create Draft Invoice
 *
 * When a milestone is marked complete:
 * 1. Check if milestone has an associated payment amount
 * 2. If payment milestone, create a draft invoice automatically
 * 3. Link invoice to the milestone
 */
async function handleMilestoneCompleted(data: {
  entityId?: number | null;
  triggeredBy?: string;
  projectId?: number;
  milestoneTitle?: string;
}): Promise<void> {
  const milestoneId = data.entityId;
  if (!milestoneId) {
    console.warn('[WorkflowAutomation] project.milestone_completed: No milestoneId provided');
    return;
  }

  const db = getDatabase();

  try {
    // Get milestone details with project and client info
    const milestone = await db.get(
      `SELECT m.id, m.project_id, m.title, m.description, m.due_date,
              m.deliverables, p.client_id, p.project_name, p.price as project_price
       FROM milestones m
       JOIN projects p ON m.project_id = p.id
       WHERE m.id = ?`,
      [milestoneId]
    ) as Record<string, unknown> | undefined;

    if (!milestone) {
      console.warn(`[WorkflowAutomation] project.milestone_completed: Milestone ${milestoneId} not found`);
      return;
    }

    const projectId = getNumber(milestone, 'project_id');
    const clientId = getNumber(milestone, 'client_id');
    const milestoneTitle = getString(milestone, 'title');
    const projectName = getString(milestone, 'project_name');

    // Check if this milestone has deliverables with payment info
    let deliverables: { name: string; price?: number }[] = [];
    const deliverablesStr = getString(milestone, 'deliverables');
    if (deliverablesStr) {
      try {
        deliverables = JSON.parse(deliverablesStr);
      } catch (_e) {
        deliverables = [];
      }
    }

    // Calculate invoice amount from deliverables with prices
    let invoiceAmount = 0;
    const lineItems: { description: string; quantity: number; rate: number; amount: number }[] = [];

    for (const deliverable of deliverables) {
      if (deliverable.price && deliverable.price > 0) {
        invoiceAmount += deliverable.price;
        lineItems.push({
          description: deliverable.name || milestoneTitle,
          quantity: 1,
          rate: deliverable.price,
          amount: deliverable.price
        });
      }
    }

    // If no deliverables with prices, check if milestone title indicates payment
    // (e.g., "Deposit", "Final Payment", "50% Payment", etc.)
    if (invoiceAmount === 0) {
      const paymentKeywords = ['deposit', 'payment', 'invoice', 'billing', 'final payment'];
      const isPaymentMilestone = paymentKeywords.some(keyword =>
        milestoneTitle.toLowerCase().includes(keyword)
      );

      if (!isPaymentMilestone) {
        logger.info('project.milestone_completed: Not a payment milestone, skipping invoice', {
          category: 'workflow',
          metadata: { milestoneId, milestoneTitle }
        });
        return;
      }

      // For payment milestones without explicit amounts, we just log and skip
      // Admin should manually create the invoice with proper amounts
      logger.info('project.milestone_completed: Payment milestone has no amounts, manual invoice required', {
        category: 'workflow',
        metadata: { milestoneId, milestoneTitle }
      });
      return;
    }

    // Check if an invoice already exists for this milestone
    const existingInvoice = await db.get(
      'SELECT id FROM invoices WHERE milestone_id = ?',
      [milestoneId]
    );

    if (existingInvoice) {
      logger.info('project.milestone_completed: Invoice already exists for milestone', {
        category: 'workflow',
        metadata: { milestoneId }
      });
      return;
    }

    // Create draft invoice
    const invoiceService = InvoiceService.getInstance();
    const description = milestone.description as string | undefined;
    const invoice = await invoiceService.createMilestoneInvoice(milestoneId, {
      projectId,
      clientId,
      lineItems,
      notes: `${projectName} - ${milestoneTitle}\n\n${description || 'Invoice for milestone completion.'}`,
      terms: 'Payment due within 14 days of receipt.'
    });

    logger.info('project.milestone_completed: Created draft invoice for milestone', {
      category: 'workflow',
      metadata: { invoiceId: invoice.id, milestoneId, amount: invoiceAmount }
    });

    // Emit invoice.created event
    await workflowTriggerService.emit('invoice.created', {
      entityId: invoice.id,
      triggeredBy: data.triggeredBy || 'workflow-automation',
      projectId,
      clientId,
      milestoneId,
      amount: invoiceAmount
    });

  } catch (error) {
    console.error('[WorkflowAutomation] project.milestone_completed: Error creating invoice:', error);
    throw error;
  }
}

// ============================================
// Client Notification Handlers
// ============================================

/**
 * Helper function to get client email from various sources
 */
async function getClientEmail(clientId: number): Promise<{ email: string; name: string } | null> {
  const db = getDatabase();
  const client = await db.get(
    'SELECT email, contact_name, company_name FROM clients WHERE id = ?',
    [clientId]
  ) as Record<string, unknown> | undefined;

  if (!client || !client.email) return null;

  return {
    email: String(client.email),
    name: String(client.contact_name || client.company_name || 'Valued Client')
  };
}

/**
 * Send notification email to client
 */
async function sendClientNotification(
  clientId: number,
  subject: string,
  message: string,
  ctaText?: string,
  ctaUrl?: string
): Promise<void> {
  const client = await getClientEmail(clientId);
  if (!client) {
    logger.warn('sendClientNotification: Client email not found', {
      category: 'workflow',
      metadata: { clientId }
    });
    return;
  }

  const portalUrl = process.env.WEBSITE_URL || 'http://localhost:3000';
  const finalCtaUrl = ctaUrl || `${portalUrl}/client/portal`;

  try {
    await emailService.sendEmail({
      to: client.email,
      subject,
      text: `Hi ${client.name},\n\n${message}\n\n${ctaText ? `${ctaText}: ${finalCtaUrl}` : ''}\n\nBest regards,\nNo Bhad Codes Team`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a2e; color: #fff; padding: 20px; text-align: center; }
            .header h1 { margin: 0; color: #7ff709; font-size: 20px; }
            .content { padding: 30px 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #7ff709; color: #000; text-decoration: none; border-radius: 4px; font-weight: bold; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>No Bhad Codes</h1></div>
            <div class="content">
              <p>Hi ${client.name},</p>
              <p>${message}</p>
              ${ctaText ? `<p style="text-align: center; margin-top: 30px;"><a href="${finalCtaUrl}" class="button">${ctaText}</a></p>` : ''}
            </div>
            <div class="footer">No Bhad Codes - Professional Web Solutions</div>
          </div>
        </body>
        </html>
      `
    });

    logger.info('Client notification sent', {
      category: 'workflow',
      metadata: { clientId, subject }
    });
  } catch (error) {
    logger.error('Failed to send client notification', {
      category: 'workflow',
      metadata: { clientId, subject, error: String(error) }
    });
  }
}

/**
 * Notify client when their proposal is accepted
 */
async function notifyProposalAccepted(data: { entityId?: number | null; projectId?: number }): Promise<void> {
  const proposalId = data.entityId;
  if (!proposalId) return;

  const db = getDatabase();
  const proposal = await db.get(
    `SELECT p.project_name, p.client_id, c.email, c.contact_name
     FROM proposal_requests p
     JOIN clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [proposalId]
  ) as Record<string, unknown> | undefined;

  if (!proposal) return;

  const clientId = getNumber(proposal, 'client_id');
  const projectName = getString(proposal, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Great News! Your Proposal Has Been Accepted',
    `Your proposal for "${projectName}" has been accepted! The next step is to review and sign the contract to get started.`,
    'View Your Portal',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal`
  );
}

/**
 * Notify client when contract is signed (project is now active)
 */
async function notifyContractSigned(data: { entityId?: number | null; projectId?: number }): Promise<void> {
  const projectId = data.projectId || data.entityId;
  if (!projectId) return;

  const db = getDatabase();
  const project = await db.get(
    'SELECT project_name, client_id FROM projects WHERE id = ?',
    [projectId]
  ) as Record<string, unknown> | undefined;

  if (!project) return;

  const clientId = getNumber(project, 'client_id');
  const projectName = getString(project, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Contract Signed - Project Now Active!',
    `The contract for "${projectName}" has been signed and your project is now active! You can track progress, view milestones, and communicate with us through your portal.`,
    'View Project Status',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal#projects`
  );
}

/**
 * Notify client when a deliverable is approved
 */
async function notifyDeliverableApproved(data: { entityId?: number | null; projectId?: number }): Promise<void> {
  const deliverableId = data.entityId;
  if (!deliverableId) return;

  const db = getDatabase();
  const deliverable = await db.get(
    `SELECT d.title, p.client_id, p.project_name
     FROM deliverables d
     JOIN projects p ON d.project_id = p.id
     WHERE d.id = ?`,
    [deliverableId]
  ) as Record<string, unknown> | undefined;

  if (!deliverable) return;

  const clientId = getNumber(deliverable, 'client_id');
  const title = getString(deliverable, 'title') || 'A deliverable';
  const projectName = getString(deliverable, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Deliverable Approved and Ready!',
    `"${title}" for "${projectName}" has been approved and is now available in your Files. You can download it from your portal.`,
    'View Files',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal#files`
  );
}

/**
 * Notify client when a questionnaire is completed (by admin review)
 */
async function notifyQuestionnaireCompleted(data: { entityId?: number | null }): Promise<void> {
  const questionnaireId = data.entityId;
  if (!questionnaireId) return;

  const db = getDatabase();
  const questionnaire = await db.get(
    `SELECT q.title, p.client_id, p.project_name
     FROM questionnaires q
     JOIN projects p ON q.project_id = p.id
     WHERE q.id = ?`,
    [questionnaireId]
  ) as Record<string, unknown> | undefined;

  if (!questionnaire) return;

  const clientId = getNumber(questionnaire, 'client_id');
  const title = getString(questionnaire, 'title') || 'Your questionnaire';
  const projectName = getString(questionnaire, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Questionnaire Completed - Thank You!',
    `Thank you for completing "${title}" for "${projectName}". Your responses have been received and a PDF summary has been added to your project files.`,
    'View Your Portal',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal`
  );
}

/**
 * Notify client when a document request is approved
 */
async function notifyDocumentRequestApproved(data: { entityId?: number | null }): Promise<void> {
  const requestId = data.entityId;
  if (!requestId) return;

  const db = getDatabase();
  const docRequest = await db.get(
    `SELECT dr.title, p.client_id, p.project_name
     FROM document_requests dr
     JOIN projects p ON dr.project_id = p.id
     WHERE dr.id = ?`,
    [requestId]
  ) as Record<string, unknown> | undefined;

  if (!docRequest) return;

  const clientId = getNumber(docRequest, 'client_id');
  const title = getString(docRequest, 'title') || 'Your document';
  const projectName = getString(docRequest, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Document Approved!',
    `Your submitted document "${title}" for "${projectName}" has been approved. It has been added to your project files.`,
    'View Files',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal#files`
  );
}

/**
 * Notify client when an invoice is paid
 */
async function notifyInvoicePaid(data: { entityId?: number | null }): Promise<void> {
  const invoiceId = data.entityId;
  if (!invoiceId) return;

  const db = getDatabase();
  const invoice = await db.get(
    `SELECT i.invoice_number, i.total_amount, i.client_id, p.project_name
     FROM invoices i
     LEFT JOIN projects p ON i.project_id = p.id
     WHERE i.id = ?`,
    [invoiceId]
  ) as Record<string, unknown> | undefined;

  if (!invoice) return;

  const clientId = getNumber(invoice, 'client_id');
  const invoiceNumber = getString(invoice, 'invoice_number') || String(invoiceId);
  const amount = invoice.total_amount as number || 0;
  const projectName = getString(invoice, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Payment Received - Thank You!',
    `We've received your payment of $${amount.toFixed(2)} for Invoice #${invoiceNumber} (${projectName}). A receipt has been generated and is available in your portal.`,
    'View Receipt',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal#invoices`
  );
}

/**
 * Notify client when a milestone is completed
 */
async function notifyMilestoneCompleted(data: { entityId?: number | null; milestoneTitle?: string }): Promise<void> {
  const milestoneId = data.entityId;
  if (!milestoneId) return;

  const db = getDatabase();
  const milestone = await db.get(
    `SELECT m.title, p.client_id, p.project_name
     FROM milestones m
     JOIN projects p ON m.project_id = p.id
     WHERE m.id = ?`,
    [milestoneId]
  ) as Record<string, unknown> | undefined;

  if (!milestone) return;

  const clientId = getNumber(milestone, 'client_id');
  const title = getString(milestone, 'title') || data.milestoneTitle || 'A milestone';
  const projectName = getString(milestone, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Milestone Completed!',
    `Great news! The milestone "${title}" for "${projectName}" has been completed. Check your portal for updated project progress.`,
    'View Project Progress',
    `${process.env.WEBSITE_URL || 'http://localhost:3000'}/client/portal#projects`
  );
}

// ============================================
// Registration
// ============================================

/**
 * Register all workflow automation handlers
 * Call this function during server startup
 */
export function registerWorkflowAutomations(): void {
  logger.info('Registering automation handlers', { category: 'workflow' });

  // Business Logic Automations
  // Proposal accepted -> Create project
  workflowTriggerService.on('proposal.accepted', handleProposalAccepted);

  // Contract signed -> Update project status
  workflowTriggerService.on('contract.signed', handleContractSigned);

  // Milestone completed -> Create draft invoice (if payment milestone)
  workflowTriggerService.on('project.milestone_completed', handleMilestoneCompleted);

  // Client Notification Handlers
  workflowTriggerService.on('proposal.accepted', notifyProposalAccepted);
  workflowTriggerService.on('contract.signed', notifyContractSigned);
  workflowTriggerService.on('deliverable.approved', notifyDeliverableApproved);
  workflowTriggerService.on('questionnaire.completed', notifyQuestionnaireCompleted);
  workflowTriggerService.on('document_request.approved', notifyDocumentRequestApproved);
  workflowTriggerService.on('invoice.paid', notifyInvoicePaid);
  workflowTriggerService.on('project.milestone_completed', notifyMilestoneCompleted);

  logger.info('Registered 10 automation handlers', {
    category: 'workflow',
    metadata: {
      handlers: [
        'proposal.accepted -> Create project',
        'proposal.accepted -> Notify client',
        'contract.signed -> Update project status',
        'contract.signed -> Notify client',
        'project.milestone_completed -> Create invoice',
        'project.milestone_completed -> Notify client',
        'deliverable.approved -> Notify client',
        'questionnaire.completed -> Notify client',
        'document_request.approved -> Notify client',
        'invoice.paid -> Notify client'
      ]
    }
  });
}

// Export handlers for testing
export {
  handleProposalAccepted,
  handleContractSigned,
  handleMilestoneCompleted
};
