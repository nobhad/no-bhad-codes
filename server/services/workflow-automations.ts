/**
 * ===============================================
 * WORKFLOW AUTOMATIONS
 * ===============================================
 * @file server/services/workflow-automations.ts
 *
 * Business logic handlers for workflow events.
 * Implements automations that execute when specific events occur:
 * - Proposal accepted -> Create project + auto-generate contract + auto-create payment schedule
 * - Contract signed -> Update project status to active
 * - Project created -> Auto-assign questionnaires
 * - Milestone completed -> Create draft invoice (if payment milestone)
 */

import { getDatabase } from '../database/init.js';
import { workflowTriggerService } from './workflow-trigger-service.js';
import { generateProjectCode } from '../utils/project-code.js';
import { invoiceService } from './invoice-service.js';
import { generateDefaultMilestones as _generateDefaultMilestones } from './milestone-generator.js';
import { generateTierMilestones } from './tier-milestone-generator.js';
import { getString, getNumber } from '../database/row-helpers.js';
import { logger } from './logger.js';
import { emailService } from './email-service.js';
import { getPortalUrl } from '../config/environment.js';
import { EMAIL_COLORS, EMAIL_TYPOGRAPHY } from '../config/email-styles.js';
import { BUSINESS_INFO } from '../config/business.js';

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
async function handleProposalAccepted(data: {
  entityId?: number | null;
  triggeredBy?: string;
}): Promise<void> {
  const proposalId = data.entityId;
  if (!proposalId) {
    logger.warn('[WorkflowAutomation] proposal.accepted: No proposalId provided');
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
      logger.warn(`[WorkflowAutomation] proposal.accepted: Proposal ${proposalId} not found`);
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
      maintenance_option:
        getString(proposalRow as Record<string, unknown>, 'maintenance_option') || null
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
        [proposal.final_price, proposal.project_type, proposal.description, proposal.project_id]
      );

      return;
    }

    // Create new project from proposal
    const projectName =
      proposal.project_name ||
      `${proposal.project_type || 'Web'} Project - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;

    // Look up client name for project code generation
    const client = await db.get<{ company_name: string | null; contact_name: string }>(
      'SELECT company_name, contact_name FROM clients WHERE id = ?',
      [proposal.client_id]
    );
    const clientLabel = client?.company_name || client?.contact_name || 'unknown';
    const projectCode = await generateProjectCode(clientLabel);

    const result = await db.run(
      `INSERT INTO projects (
        client_id, project_name, project_type, description, status, price,
        project_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        proposal.client_id,
        projectName,
        proposal.project_type,
        proposal.description,
        proposal.final_price,
        projectCode
      ]
    );

    const projectId = result.lastID;

    // Link proposal to the new project
    await db.run('UPDATE proposal_requests SET project_id = ? WHERE id = ?', [
      projectId,
      proposalId
    ]);

    logger.info('proposal.accepted: Created project from proposal', {
      category: 'workflow',
      metadata: { projectId, proposalId }
    });

    // Generate tier-aware milestones and tasks (idempotent — skip if milestones already exist)
    try {
      const existingMilestone = await db.get(
        'SELECT id FROM milestones WHERE project_id = ? LIMIT 1',
        [projectId]
      ) as { id: number } | undefined;

      if (existingMilestone) {
        logger.info('proposal.accepted: Milestones already exist, skipping generation', {
          category: 'workflow',
          metadata: { projectId, existingMilestoneId: existingMilestone.id }
        });
      } else {
      // Fetch proposal features for tier-aware generation
        const { proposalService } = await import('./proposal-service.js');
        const features = await proposalService.getProposalFeatures(proposalId);

        const milestoneResult = await generateTierMilestones(
        projectId!,
        proposal.project_type || 'other',
        proposal.selected_tier || 'good',
        features as Array<{
          feature_name: string;
          feature_category?: string | null;
          is_addon?: number | boolean;
        }>,
        { startDate: new Date() }
        );
        logger.info('proposal.accepted: Generated tier-aware milestones and tasks', {
          category: 'workflow',
          metadata: {
            projectId,
            tier: proposal.selected_tier || 'good',
            milestonesCreated: milestoneResult.milestonesCreated,
            tasksCreated: milestoneResult.tasksCreated
          }
        });
      } // end else (no existing milestones)
    } catch (milestoneError) {
      logger.error('[WorkflowAutomation] proposal.accepted: Failed to generate milestones', {
        error: milestoneError instanceof Error ? milestoneError : undefined
      });
      // Don't fail the automation if milestone generation fails
    }

    // Auto-generate contract from proposal
    try {
      if (!projectId) throw new Error('No projectId after project creation');

      const { contractService } = await import('./contract-service.js');

      // Check if contract already exists for this project
      const existingContract = await db.get(
        'SELECT id FROM contracts WHERE project_id = ? AND status != \'cancelled\' AND deleted_at IS NULL LIMIT 1',
        [projectId]
      );

      if (!existingContract) {
        // Get the default contract template
        const template = (await db.get(
          'SELECT id, content FROM contract_templates WHERE is_default = 1 AND is_active = 1 LIMIT 1'
        )) as { id: number; content: string } | undefined;

        if (template) {
          // Get client info for variable substitution
          const clientInfo = (await db.get(
            `SELECT COALESCE(billing_name, contact_name) as contact_name,
                    COALESCE(billing_email, email) as email,
                    COALESCE(billing_company, company_name) as company_name
             FROM active_clients WHERE id = ?`,
            [proposal.client_id]
          )) as Record<string, unknown> | undefined;

          // Substitute variables in template content
          let content = template.content || '';
          const today = new Date().toISOString().split('T')[0];
          content = content
            .replace(/\{\{client_name\}\}/g, String(clientInfo?.contact_name || ''))
            .replace(/\{\{client_email\}\}/g, String(clientInfo?.email || ''))
            .replace(/\{\{company_name\}\}/g, String(clientInfo?.company_name || ''))
            .replace(/\{\{project_name\}\}/g, projectName)
            .replace(/\{\{project_type\}\}/g, proposal.project_type || '')
            .replace(
              /\{\{price\}\}/g,
              proposal.final_price ? `$${Number(proposal.final_price).toLocaleString()}` : ''
            )
            .replace(/\{\{date\}\}/g, today)
            .replace(/\{\{start_date\}\}/g, today);

          const contract = await contractService.createContract({
            projectId,
            clientId: proposal.client_id,
            content,
            status: 'draft',
            templateId: template.id
          });

          logger.info('proposal.accepted: Auto-generated draft contract', {
            category: 'workflow',
            metadata: { projectId, contractId: contract.id, templateId: template.id }
          });

          // Emit contract.created event
          await workflowTriggerService.emit('contract.created', {
            entityId: contract.id,
            triggeredBy: 'workflow-automation',
            projectId,
            clientId: proposal.client_id
          });
        } else {
          logger.info(
            'proposal.accepted: No default contract template found, skipping auto-generation',
            {
              category: 'workflow'
            }
          );
        }
      }
    } catch (contractError) {
      logger.error('[WorkflowAutomation] proposal.accepted: Failed to auto-generate contract', {
        error: contractError instanceof Error ? contractError : undefined
      });
      // Non-critical — don't fail the automation
    }

    // Auto-create payment schedule from proposal pricing
    try {
      if (proposal.final_price && Number(proposal.final_price) > 0) {
        const { paymentScheduleService } = await import('./payment-schedule-service.js');

        // Check if payment schedule already exists
        const existingSchedule = (await db.get(
          'SELECT id FROM payment_schedule_installments WHERE project_id = ? LIMIT 1',
          [projectId]
        )) as { id: number } | undefined;

        if (!existingSchedule) {
          const totalPrice = Number(proposal.final_price);
          const tier = proposal.selected_tier || 'good';
          const today = new Date();

          // Default payment split: 50/50 (deposit + final)
          // Larger projects (best tier or >$5000): 50/25/25 (deposit + midpoint + final)
          let splits: Array<{ label: string; percent: number; offsetDays: number }>;

          if (tier === 'best' || totalPrice > 5000) {
            // 50/25/25 split for premium projects
            splits = [
              { label: 'Deposit (50%)', percent: 50, offsetDays: 0 },
              { label: 'Midpoint Payment (25%)', percent: 25, offsetDays: 30 },
              { label: 'Final Payment (25%)', percent: 25, offsetDays: 60 }
            ];
          } else {
            // Default: 50/50 split
            splits = [
              { label: 'Deposit (50%)', percent: 50, offsetDays: 0 },
              { label: 'Final Payment (50%)', percent: 50, offsetDays: 30 }
            ];
          }

          const startDate = today.toISOString().split('T')[0];

          await paymentScheduleService.createFromSplit(
            projectId!,
            proposal.client_id,
            totalPrice,
            splits,
            startDate
          );

          logger.info('proposal.accepted: Auto-created payment schedule', {
            category: 'workflow',
            metadata: {
              projectId,
              totalPrice,
              tier,
              installments: splits.length
            }
          });
        }
      }
    } catch (scheduleError) {
      logger.error(
        '[WorkflowAutomation] proposal.accepted: Failed to auto-create payment schedule',
        {
          error: scheduleError instanceof Error ? scheduleError : undefined
        }
      );
      // Non-critical — don't fail the automation
    }

    // Store maintenance tier on project if selected
    try {
      if (proposal.maintenance_option && proposal.maintenance_option !== 'diy' && projectId) {
        const isBestTier = proposal.selected_tier === 'best';
        const includedMonths = isBestTier ? 3 : 0;

        await db.run(
          `UPDATE projects SET
            maintenance_tier = ?,
            maintenance_status = 'pending',
            maintenance_included_months = ?
          WHERE id = ?`,
          [proposal.maintenance_option, includedMonths, projectId]
        );

        logger.info('proposal.accepted: Stored maintenance tier on project', {
          category: 'workflow',
          metadata: { projectId, tier: proposal.maintenance_option, includedMonths }
        });
      }
    } catch (maintenanceError) {
      logger.error('[WorkflowAutomation] proposal.accepted: Failed to store maintenance tier', {
        error: maintenanceError instanceof Error ? maintenanceError : undefined
      });
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
    logger.error('[WorkflowAutomation] proposal.accepted: Error creating project', {
      error: error instanceof Error ? error : undefined
    });
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
    const contract = await db.get('SELECT project_id FROM active_contracts WHERE id = ?', [data.entityId]);
    if (contract) {
      projectId = getNumber(contract as Record<string, unknown>, 'project_id');
    }
  }

  if (!projectId) {
    logger.warn('[WorkflowAutomation] contract.signed: No projectId available');
    return;
  }

  try {
    // Get current project status
    const project = await db.get('SELECT id, status, project_name FROM active_projects WHERE id = ?', [
      projectId
    ]);

    if (!project) {
      logger.warn('contract.signed: Project not found', {
        category: 'workflow',
        metadata: { projectId }
      });
      return;
    }

    const previousStatus = getString(project as Record<string, unknown>, 'status');

    // Only update if not already active or completed
    if (
      previousStatus === 'active' ||
      previousStatus === 'completed' ||
      previousStatus === 'in-progress'
    ) {
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
    logger.error('[WorkflowAutomation] contract.signed: Error updating project status', {
      error: error instanceof Error ? error : undefined
    });
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
    logger.warn('[WorkflowAutomation] project.milestone_completed: No milestoneId provided');
    return;
  }

  const db = getDatabase();

  try {
    // Get milestone details with project and client info
    const milestone = (await db.get(
      `SELECT m.id, m.project_id, m.title, m.description, m.due_date,
              m.deliverables, p.client_id, p.project_name, p.price as project_price
       FROM milestones m
       JOIN active_projects p ON m.project_id = p.id
       WHERE m.id = ?`,
      [milestoneId]
    )) as Record<string, unknown> | undefined;

    if (!milestone) {
      logger.warn(
        `[WorkflowAutomation] project.milestone_completed: Milestone ${milestoneId} not found`
      );
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
        logger.debug('[WorkflowAutomations] Failed to parse deliverables JSON', {
          error: _e instanceof Error ? _e : undefined
        });
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
      const isPaymentMilestone = paymentKeywords.some((keyword) =>
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
      logger.info(
        'project.milestone_completed: Payment milestone has no amounts, manual invoice required',
        {
          category: 'workflow',
          metadata: { milestoneId, milestoneTitle }
        }
      );
      return;
    }

    // Check if an invoice already exists for this milestone
    const existingInvoice = await db.get('SELECT id FROM active_invoices WHERE milestone_id = ?', [
      milestoneId
    ]);

    if (existingInvoice) {
      logger.info('project.milestone_completed: Invoice already exists for milestone', {
        category: 'workflow',
        metadata: { milestoneId }
      });
      return;
    }

    // Create draft invoice
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
    logger.error('[WorkflowAutomation] project.milestone_completed: Error creating invoice', {
      error: error instanceof Error ? error : undefined
    });
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
  const client = (await db.get(
    'SELECT COALESCE(billing_email, email) as email, COALESCE(billing_name, contact_name) as contact_name, COALESCE(billing_company, company_name) as company_name FROM active_clients WHERE id = ?',
    [clientId]
  )) as Record<string, unknown> | undefined;

  if (!client || !client.email) return null;

  return {
    email: String(client.email),
    name: String(client.contact_name || client.company_name || 'Valued Client')
  };
}

/**
 * Send notification email to client
 */
/**
 * Substitute {{variable}} placeholders in a template string.
 */
function substituteVariables(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? ''),
    template
  );
}

/**
 * Try to load an email template from the DB by slug.
 * Returns null if not found — caller falls back to hardcoded.
 */
async function loadEmailTemplate(
  slug: string,
  vars: Record<string, string>
): Promise<{ subject: string; html: string; text: string } | null> {
  try {
    const db = getDatabase();
    const template = (await db.get(
      'SELECT subject, body_html, body_text FROM email_templates WHERE name = ? AND is_active = 1 LIMIT 1',
      [slug]
    )) as { subject: string; body_html: string; body_text: string | null } | undefined;

    if (!template) return null;

    return {
      subject: substituteVariables(template.subject, vars),
      html: substituteVariables(template.body_html, vars),
      text: substituteVariables(template.body_text || '', vars)
    };
  } catch {
    return null; // Template system failure should never block notifications
  }
}

/**
 * Dispatch event to configured Slack/Discord webhooks.
 * Non-blocking — failures are logged but never thrown.
 */
async function dispatchWebhooks(eventType: string, data: Record<string, unknown>): Promise<void> {
  try {
    const db = getDatabase();
    const configs = await db.all(
      'SELECT id, platform, webhook_url, channel FROM notification_integrations WHERE is_active = 1 AND events LIKE ?',
      [`%${eventType}%`]
    ) as Array<{ id: number; platform: string; webhook_url: string; channel: string | null }>;

    if (configs.length === 0) return;

    const {
      sendSlackNotification,
      sendDiscordNotification,
      formatSlackMessage,
      formatDiscordMessage
    } = await import('./integrations/slack-service.js');

    for (const config of configs) {
      try {
        if (config.platform === 'slack') {
          const msg = formatSlackMessage(eventType, data, { channel: config.channel || undefined });
          await sendSlackNotification(config.webhook_url, msg);
        } else if (config.platform === 'discord') {
          const msg = formatDiscordMessage(eventType, data);
          await sendDiscordNotification(config.webhook_url, msg);
        }

        // Log success
        await db.run(
          'INSERT INTO notification_delivery_logs (integration_id, event_type, payload, status) VALUES (?, ?, ?, ?)',
          [config.id, eventType, JSON.stringify(data), 'success']
        );
      } catch (err) {
        // Log failure per webhook — don't stop processing others
        await db.run(
          'INSERT INTO notification_delivery_logs (integration_id, event_type, payload, status, error_message) VALUES (?, ?, ?, ?, ?)',
          [config.id, eventType, JSON.stringify(data), 'failed', String(err)]
        ).catch(() => { /* ignore logging failures */ });

        logger.error(`Webhook dispatch failed for ${config.platform}`, {
          category: 'workflow',
          metadata: { integrationId: config.id, eventType, error: String(err) }
        });
      }
    }
  } catch (error) {
    logger.error('Webhook dispatch error', {
      category: 'workflow',
      metadata: { eventType, error: String(error) }
    });
  }
}

/**
 * Send a client notification email.
 *
 * 1. Tries to load a DB email template by slug (if templateSlug provided)
 * 2. Falls back to hardcoded HTML template
 * 3. Dispatches to configured Slack/Discord webhooks
 */
async function sendClientNotification(
  clientId: number,
  subject: string,
  message: string,
  ctaText?: string,
  ctaUrl?: string,
  options?: {
    templateSlug?: string;
    templateVars?: Record<string, string>;
    eventType?: string;
    eventData?: Record<string, unknown>;
  }
): Promise<void> {
  const client = await getClientEmail(clientId);
  if (!client) {
    logger.warn('sendClientNotification: Client email not found', {
      category: 'workflow',
      metadata: { clientId }
    });
    return;
  }

  const finalCtaUrl = ctaUrl || getPortalUrl();
  const templateVars: Record<string, string> = {
    client_name: client.name,
    business_name: BUSINESS_INFO.name,
    portal_url: finalCtaUrl,
    cta_text: ctaText || '',
    cta_url: finalCtaUrl,
    message,
    subject,
    ...options?.templateVars
  };

  try {
    // Try DB template first
    const dbTemplate = options?.templateSlug
      ? await loadEmailTemplate(options.templateSlug, templateVars)
      : null;

    if (dbTemplate) {
      await emailService.sendEmail({
        to: client.email,
        subject: dbTemplate.subject,
        text: dbTemplate.text,
        html: dbTemplate.html
      });
    } else {
      // Fallback: hardcoded HTML (backward compatible)
      await emailService.sendEmail({
        to: client.email,
        subject,
        text: `Hi ${client.name},\n\n${message}\n\n${ctaText ? `${ctaText}: ${finalCtaUrl}` : ''}\n\nBest regards,\n${BUSINESS_INFO.name} Team`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: ${EMAIL_TYPOGRAPHY.fontFamily}; line-height: ${EMAIL_TYPOGRAPHY.lineHeight}; color: ${EMAIL_COLORS.bodyText}; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${EMAIL_COLORS.headerBg}; color: ${EMAIL_COLORS.headerText}; padding: 20px; text-align: center; }
              .header h1 { margin: 0; color: ${EMAIL_COLORS.brandAccent}; font-size: 20px; }
              .content { padding: 30px 20px; background: ${EMAIL_COLORS.contentBg}; }
              .button { display: inline-block; padding: 12px 24px; background: ${EMAIL_COLORS.brandAccent}; color: ${EMAIL_COLORS.buttonPrimaryText}; text-decoration: none; border-radius: 4px; font-weight: bold; }
              .footer { padding: 20px; text-align: center; color: ${EMAIL_COLORS.bodyTextMuted}; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h1>${BUSINESS_INFO.name}</h1></div>
              <div class="content">
                <p>Hi ${client.name},</p>
                <p>${message}</p>
                ${ctaText ? `<p style="text-align: center; margin-top: 30px;"><a href="${finalCtaUrl}" class="button">${ctaText}</a></p>` : ''}
              </div>
              <div class="footer">${BUSINESS_INFO.name} - Professional Web Solutions</div>
            </div>
          </body>
          </html>
        `
      });
    }

    logger.info('Client notification sent', {
      category: 'workflow',
      metadata: { clientId, subject, usedTemplate: !!dbTemplate }
    });
  } catch (error) {
    logger.error('Failed to send client notification', {
      category: 'workflow',
      metadata: { clientId, subject, error: String(error) }
    });
  }

  // Dispatch to Slack/Discord webhooks (non-blocking)
  if (options?.eventType) {
    dispatchWebhooks(options.eventType, {
      clientId,
      clientName: client.name,
      subject,
      message,
      ...options?.eventData
    }).catch(() => { /* non-blocking */ });
  }
}

/**
 * Notify client when their proposal is accepted
 */
async function notifyProposalAccepted(data: {
  entityId?: number | null;
  projectId?: number;
}): Promise<void> {
  const proposalId = data.entityId;
  if (!proposalId) return;

  const db = getDatabase();
  const proposal = (await db.get(
    `SELECT p.project_name, p.client_id, c.email, c.contact_name
     FROM proposal_requests p
     JOIN active_clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [proposalId]
  )) as Record<string, unknown> | undefined;

  if (!proposal) return;

  const clientId = getNumber(proposal, 'client_id');
  const projectName = getString(proposal, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Great News! Your Proposal Has Been Accepted',
    `Your proposal for "${projectName}" has been accepted! The next step is to review and sign the contract to get started.`,
    'View Your Portal',
    getPortalUrl(),
    { templateSlug: 'Proposal Accepted', templateVars: { project_name: projectName }, eventType: 'proposal.accepted', eventData: { projectName } }
  );
}

/**
 * Notify client when contract is signed (project is now active)
 */
async function notifyContractSigned(data: {
  entityId?: number | null;
  projectId?: number;
}): Promise<void> {
  const projectId = data.projectId || data.entityId;
  if (!projectId) return;

  const db = getDatabase();
  const project = (await db.get('SELECT project_name, client_id FROM active_projects WHERE id = ?', [
    projectId
  ])) as Record<string, unknown> | undefined;

  if (!project) return;

  const clientId = getNumber(project, 'client_id');
  const projectName = getString(project, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Contract Signed - Project Now Active!',
    `The contract for "${projectName}" has been signed and your project is now active! You can track progress, view milestones, and communicate with us through your portal.`,
    'View Project Status',
    `${getPortalUrl()}#projects`,
    { templateSlug: 'Contract Signed', templateVars: { project_name: projectName }, eventType: 'contract.signed', eventData: { projectName } }
  );
}

/**
 * Notify client when a deliverable is approved
 */
async function notifyDeliverableApproved(data: {
  entityId?: number | null;
  projectId?: number;
}): Promise<void> {
  const deliverableId = data.entityId;
  if (!deliverableId) return;

  const db = getDatabase();
  const deliverable = (await db.get(
    `SELECT d.title, p.client_id, p.project_name
     FROM active_deliverables d
     JOIN active_projects p ON d.project_id = p.id
     WHERE d.id = ?`,
    [deliverableId]
  )) as Record<string, unknown> | undefined;

  if (!deliverable) return;

  const clientId = getNumber(deliverable, 'client_id');
  const title = getString(deliverable, 'title') || 'A deliverable';
  const projectName = getString(deliverable, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Deliverable Approved and Ready!',
    `"${title}" for "${projectName}" has been approved and is now available in your Files. You can download it from your portal.`,
    'View Files',
    `${getPortalUrl()}#files`,
    { templateSlug: 'Deliverable Approved', templateVars: { project_name: projectName, deliverable_title: title }, eventType: 'deliverable.approved', eventData: { projectName, title } }
  );
}

/**
 * Notify client when a questionnaire is completed (by admin review)
 */
async function notifyQuestionnaireCompleted(data: { entityId?: number | null }): Promise<void> {
  const questionnaireId = data.entityId;
  if (!questionnaireId) return;

  const db = getDatabase();
  const questionnaire = (await db.get(
    `SELECT q.title, p.client_id, p.project_name
     FROM questionnaires q
     JOIN active_projects p ON q.project_id = p.id
     WHERE q.id = ?`,
    [questionnaireId]
  )) as Record<string, unknown> | undefined;

  if (!questionnaire) return;

  const clientId = getNumber(questionnaire, 'client_id');
  const title = getString(questionnaire, 'title') || 'Your questionnaire';
  const projectName = getString(questionnaire, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Questionnaire Completed - Thank You!',
    `Thank you for completing "${title}" for "${projectName}". Your responses have been received and a PDF summary has been added to your project files.`,
    'View Your Portal',
    getPortalUrl(),
    { templateSlug: 'Questionnaire Completed', templateVars: { project_name: projectName, questionnaire_title: title }, eventType: 'questionnaire.completed', eventData: { projectName, title } }
  );
}

/**
 * Notify client when a document request is approved
 */
async function notifyDocumentRequestApproved(data: { entityId?: number | null }): Promise<void> {
  const requestId = data.entityId;
  if (!requestId) return;

  const db = getDatabase();
  const docRequest = (await db.get(
    `SELECT dr.title, p.client_id, p.project_name
     FROM active_document_requests dr
     JOIN active_projects p ON dr.project_id = p.id
     WHERE dr.id = ?`,
    [requestId]
  )) as Record<string, unknown> | undefined;

  if (!docRequest) return;

  const clientId = getNumber(docRequest, 'client_id');
  const title = getString(docRequest, 'title') || 'Your document';
  const projectName = getString(docRequest, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Document Approved!',
    `Your submitted document "${title}" for "${projectName}" has been approved. It has been added to your project files.`,
    'View Files',
    `${getPortalUrl()}#files`,
    { templateSlug: 'Document Approved', templateVars: { project_name: projectName, document_title: title }, eventType: 'document_request.approved', eventData: { projectName, title } }
  );
}

/**
 * Notify client when an invoice is paid
 */
async function notifyInvoicePaid(data: { entityId?: number | null }): Promise<void> {
  const invoiceId = data.entityId;
  if (!invoiceId) return;

  const db = getDatabase();
  const invoice = (await db.get(
    `SELECT i.invoice_number, i.total_amount, i.client_id, p.project_name
     FROM active_invoices i
     LEFT JOIN active_projects p ON i.project_id = p.id
     WHERE i.id = ?`,
    [invoiceId]
  )) as Record<string, unknown> | undefined;

  if (!invoice) return;

  const clientId = getNumber(invoice, 'client_id');
  const invoiceNumber = getString(invoice, 'invoice_number') || String(invoiceId);
  const amount = (invoice.total_amount as number) || 0;
  const projectName = getString(invoice, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Payment Received - Thank You!',
    `We've received your payment of $${amount.toFixed(2)} for Invoice #${invoiceNumber} (${projectName}). A receipt has been generated and is available in your portal.`,
    'View Receipt',
    `${getPortalUrl()}#invoices`,
    { templateSlug: 'Invoice Paid', templateVars: { project_name: projectName, invoice_number: invoiceNumber, amount: amount.toFixed(2) }, eventType: 'invoice.paid', eventData: { projectName, invoiceNumber, amount } }
  );
}

/**
 * Notify client when a milestone is completed
 */
async function notifyMilestoneCompleted(data: {
  entityId?: number | null;
  milestoneTitle?: string;
}): Promise<void> {
  const milestoneId = data.entityId;
  if (!milestoneId) return;

  const db = getDatabase();
  const milestone = (await db.get(
    `SELECT m.title, p.client_id, p.project_name
     FROM milestones m
     JOIN active_projects p ON m.project_id = p.id
     WHERE m.id = ?`,
    [milestoneId]
  )) as Record<string, unknown> | undefined;

  if (!milestone) return;

  const clientId = getNumber(milestone, 'client_id');
  const title = getString(milestone, 'title') || data.milestoneTitle || 'A milestone';
  const projectName = getString(milestone, 'project_name') || 'your project';

  await sendClientNotification(
    clientId,
    'Milestone Completed!',
    `Great news! The milestone "${title}" for "${projectName}" has been completed. Check your portal for updated project progress.`,
    'View Project Progress',
    `${getPortalUrl()}#projects`,
    { templateSlug: 'Milestone Completed', templateVars: { project_name: projectName, milestone_title: title }, eventType: 'project.milestone_completed', eventData: { projectName, title } }
  );
}

// ============================================
// Questionnaire Auto-Assignment
// ============================================

/**
 * Handler: Project Created -> Auto-Assign Questionnaires
 *
 * When a new project is created from intake, auto-assign the appropriate
 * questionnaires based on project type.
 */
async function handleAutoAssignQuestionnaires(data: {
  entityId?: number | null;
  triggeredBy?: string;
  clientId?: number;
  projectType?: string;
}): Promise<void> {
  const projectId = data.entityId;
  if (!projectId || !data.clientId) return;

  const db = getDatabase();

  try {
    // Check if questionnaires already assigned
    const existing = (await db.get(
      'SELECT id FROM questionnaire_responses WHERE project_id = ? LIMIT 1',
      [projectId]
    )) as { id: number } | undefined;

    if (existing) return; // Already has questionnaires

    // Find active questionnaires that match the project type or are universal
    const questionnaires = (await db.all(
      `SELECT id, name, project_type FROM questionnaires
       WHERE is_active = 1
       AND (project_type IS NULL OR project_type = '' OR project_type = ?)
       ORDER BY display_order, id`,
      [data.projectType || '']
    )) as Array<{ id: number; name: string; project_type: string | null }>;

    if (questionnaires.length === 0) return;

    let assigned = 0;
    for (const q of questionnaires) {
      try {
        await db.run(
          `INSERT INTO questionnaire_responses (
            questionnaire_id, project_id, client_id, status, created_at, updated_at
          ) VALUES (?, ?, ?, 'pending', datetime('now'), datetime('now'))`,
          [q.id, projectId, data.clientId]
        );
        assigned++;
      } catch {
        // Skip duplicates or errors
      }
    }

    if (assigned > 0) {
      logger.info(`project.created: Auto-assigned ${assigned} questionnaires`, {
        category: 'workflow',
        metadata: { projectId, clientId: data.clientId, assigned }
      });
    }
  } catch (error) {
    logger.error('[WorkflowAutomation] project.created: Failed to auto-assign questionnaires', {
      error: error instanceof Error ? error : undefined
    });
    // Non-critical
  }
}

// ============================================
// Maintenance Tier Activation
// ============================================

/**
 * Handler: Project Completed -> Activate Maintenance
 *
 * When a project status changes to 'completed':
 * 1. Check if project has a maintenance tier (not 'diy')
 * 2. Create a recurring invoice based on tier pricing
 * 3. If Best tier: billing starts after included months
 * 4. Update project maintenance_status to 'active'
 */
async function handleMaintenanceActivation(data: {
  entityId?: number | null;
  triggeredBy?: string;
  newStatus?: string;
}): Promise<void> {
  // Only act on completion
  if (data.newStatus !== 'completed') return;

  const projectId = data.entityId;
  if (!projectId) return;

  const db = getDatabase();

  const project = (await db.get(
    `SELECT id, client_id, project_name, maintenance_tier, maintenance_status,
            maintenance_included_months, maintenance_recurring_invoice_id
     FROM projects WHERE id = ?`,
    [projectId]
  )) as {
    id: number; client_id: number; project_name: string;
    maintenance_tier: string | null; maintenance_status: string;
    maintenance_included_months: number; maintenance_recurring_invoice_id: number | null;
  } | undefined;

  if (!project) return;
  if (!project.maintenance_tier || project.maintenance_tier === 'diy') return;
  if (project.maintenance_status !== 'pending') return; // Already activated or manually managed
  if (project.maintenance_recurring_invoice_id) return; // Idempotency: already has recurring invoice

  try {
    // Look up tier pricing from config
    const { getMaintenanceOptions } = await import('../config/proposal-templates.js');
    const allOptions = getMaintenanceOptions();
    const tierConfig = allOptions[project.maintenance_tier];
    if (!tierConfig || tierConfig.monthlyPrice <= 0) {
      logger.info(`Maintenance tier '${project.maintenance_tier}' has no monthly price, skipping recurring invoice`, {
        category: 'workflow'
      });
      await db.run(
        'UPDATE projects SET maintenance_status = \'active\', maintenance_start_date = ? WHERE id = ?',
        [new Date().toISOString().split('T')[0], projectId]
      );
      return;
    }

    // Calculate billing start date
    const now = new Date();
    let billingStartDate: string;
    if (project.maintenance_included_months > 0) {
      // Best tier: billing starts AFTER included months
      const start = new Date(now);
      start.setMonth(start.getMonth() + project.maintenance_included_months);
      billingStartDate = start.toISOString().split('T')[0];

      // Store when included period ends
      await db.run(
        'UPDATE projects SET maintenance_included_until = ? WHERE id = ?',
        [billingStartDate, projectId]
      );
    } else {
      // Billing starts next month (give 30 days grace after project completion)
      const start = new Date(now);
      start.setDate(start.getDate() + 30);
      billingStartDate = start.toISOString().split('T')[0];
    }

    // Create recurring invoice via invoice service
    const { invoiceService: invSvc } = await import('./invoice-service.js');
    const recurringInvoice = await invSvc.createRecurringInvoice({
      projectId,
      clientId: project.client_id,
      frequency: 'monthly',
      dayOfMonth: 1,
      lineItems: [{
        description: `${tierConfig.displayName} — Monthly Maintenance`,
        quantity: 1,
        rate: tierConfig.monthlyPrice,
        amount: tierConfig.monthlyPrice
      }],
      notes: `Auto-generated maintenance plan for ${project.project_name}`,
      startDate: billingStartDate
    });

    // Update project with maintenance activation
    await db.run(
      `UPDATE projects SET
        maintenance_status = 'active',
        maintenance_start_date = ?,
        maintenance_recurring_invoice_id = ?
      WHERE id = ?`,
      [now.toISOString().split('T')[0], recurringInvoice.id, projectId]
    );

    logger.info(`Maintenance activated for project ${projectId}`, {
      category: 'workflow',
      metadata: {
        projectId,
        tier: project.maintenance_tier,
        monthlyPrice: tierConfig.monthlyPrice,
        billingStartDate,
        includedMonths: project.maintenance_included_months,
        recurringInvoiceId: recurringInvoice.id
      }
    });
  } catch (error) {
    logger.error('[WorkflowAutomation] Failed to activate maintenance', {
      error: error instanceof Error ? error : undefined,
      metadata: { projectId, tier: project.maintenance_tier }
    });
  }
}

// ============================================
// Registration
// ============================================

// ============================================
// Agreement & Onboarding Auto-Complete
// ============================================

/**
 * Map workflow event types to entity types used by agreement/onboarding steps.
 */
const EVENT_TO_ENTITY_TYPE: Record<string, string> = {
  'contract.signed': 'contract',
  'invoice.paid': 'invoice',
  'questionnaire.completed': 'questionnaire',
  'proposal.accepted': 'proposal'
};

/**
 * Handler: Auto-complete agreement steps when matching entities complete.
 */
async function handleAutoCompleteAgreementStep(data: {
  entityId?: number | null;
  triggeredBy?: string;
}): Promise<void> {
  if (!data.entityId || !data.triggeredBy) return;

  const entityType = EVENT_TO_ENTITY_TYPE[data.triggeredBy];
  if (!entityType) return;

  try {
    const { agreementService } = await import('./agreement-service.js');
    await agreementService.autoCompleteByEntity(entityType, data.entityId);
  } catch (error) {
    logger.error('[WorkflowAutomation] Failed to auto-complete agreement step', {
      error: error instanceof Error ? error : undefined
    });
  }
}

/**
 * Handler: Auto-complete onboarding steps when matching entities complete.
 */
async function handleAutoCompleteOnboardingStep(data: {
  entityId?: number | null;
  triggeredBy?: string;
}): Promise<void> {
  if (!data.entityId || !data.triggeredBy) return;

  const entityType = EVENT_TO_ENTITY_TYPE[data.triggeredBy];
  if (!entityType) return;

  try {
    const { onboardingChecklistService } = await import('./onboarding-checklist-service.js');
    await onboardingChecklistService.autoCompleteByEntity(entityType, data.entityId);
  } catch (error) {
    logger.error('[WorkflowAutomation] Failed to auto-complete onboarding step', {
      error: error instanceof Error ? error : undefined
    });
  }
}

/**
 * Handler: Route ALL workflow events to the custom automation engine.
 */
async function handleCustomAutomationEvent(data: {
  entityId?: number | null;
  triggeredBy?: string;
  [key: string]: unknown;
}): Promise<void> {
  if (!data.triggeredBy) return;

  try {
    const { automationEngine } = await import('./automation-engine.js');
    await automationEngine.handleEvent(data.triggeredBy, data);
  } catch (error) {
    logger.error('[WorkflowAutomation] Failed to handle custom automation event', {
      error: error instanceof Error ? error : undefined
    });
  }
}

/**
 * Handler: Route workflow events to the email sequence service for auto-enrollment.
 * Resolves entity info (type, email, name) from the event context before calling the service.
 */
async function handleSequenceEvent(data: {
  entityId?: number | null;
  triggeredBy?: string;
  clientId?: number;
  [key: string]: unknown;
}): Promise<void> {
  if (!data.triggeredBy || !data.entityId) return;

  const db = getDatabase();

  try {
    // Determine entity type and resolve email/name
    let entityType: string;
    let entityEmail: string | undefined;
    let entityName: string | undefined;

    const event = data.triggeredBy;

    if (event.startsWith('lead.')) {
      entityType = 'lead';
      const lead = (await db.get(
        'SELECT email, COALESCE(contact_name, company_name) as name FROM projects WHERE id = ? AND source_type = \'lead\'',
        [data.entityId]
      )) as { email: string; name: string } | undefined;
      entityEmail = lead?.email;
      entityName = lead?.name;
    } else if (event.startsWith('client.')) {
      entityType = 'client';
      const client = (await db.get(
        'SELECT email, COALESCE(contact_name, company_name) as name FROM clients WHERE id = ?',
        [data.clientId || data.entityId]
      )) as { email: string; name: string } | undefined;
      entityEmail = client?.email;
      entityName = client?.name;
    } else if (event.startsWith('proposal.')) {
      entityType = 'lead';
      const proposal = (await db.get(
        'SELECT c.email, COALESCE(c.contact_name, c.company_name) as name, pr.client_id FROM proposal_requests pr JOIN clients c ON pr.client_id = c.id WHERE pr.id = ?',
        [data.entityId]
      )) as { email: string; name: string; client_id: number } | undefined;
      entityEmail = proposal?.email;
      entityName = proposal?.name;
    } else {
      return; // Unknown event prefix
    }

    if (!entityEmail) return; // Can't enroll without email

    const { sequenceService } = await import('./sequence-service.js');
    await sequenceService.handleEvent(data.triggeredBy, {
      entityType,
      entityId: data.entityId,
      entityEmail,
      entityName
    });
  } catch (error) {
    logger.error('[WorkflowAutomation] Failed to handle sequence event', {
      error: error instanceof Error ? error : undefined
    });
  }
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

  // Project created -> Auto-assign questionnaires
  workflowTriggerService.on('project.created', handleAutoAssignQuestionnaires);

  // Project completed -> Activate maintenance tier
  workflowTriggerService.on('project.status_changed', handleMaintenanceActivation);

  // Agreement & Onboarding Auto-Complete Handlers
  workflowTriggerService.on('contract.signed', handleAutoCompleteAgreementStep);
  workflowTriggerService.on('invoice.paid', handleAutoCompleteAgreementStep);
  workflowTriggerService.on('questionnaire.completed', handleAutoCompleteAgreementStep);
  workflowTriggerService.on('proposal.accepted', handleAutoCompleteAgreementStep);

  workflowTriggerService.on('contract.signed', handleAutoCompleteOnboardingStep);
  workflowTriggerService.on('invoice.paid', handleAutoCompleteOnboardingStep);
  workflowTriggerService.on('questionnaire.completed', handleAutoCompleteOnboardingStep);
  workflowTriggerService.on('proposal.accepted', handleAutoCompleteOnboardingStep);

  // Custom Automation Engine (route ALL events)
  const ALL_AUTOMATION_EVENTS = [
    'lead.created', 'lead.stage_changed', 'lead.converted',
    'proposal.created', 'proposal.sent', 'proposal.accepted', 'proposal.rejected',
    'contract.created', 'contract.sent', 'contract.signed', 'contract.expired',
    'project.created', 'project.started', 'project.completed', 'project.status_changed',
    'project.milestone_completed',
    'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.overdue', 'invoice.cancelled',
    'task.created', 'task.completed', 'task.overdue',
    'client.created', 'client.activated',
    'deliverable.approved', 'questionnaire.completed',
    'agreement.completed'
  ] as const;

  for (const event of ALL_AUTOMATION_EVENTS) {
    workflowTriggerService.on(event, handleCustomAutomationEvent);
  }

  // Email Sequence Auto-Enrollment (route events to sequence service)
  const SEQUENCE_TRIGGER_EVENTS = [
    'lead.created', 'lead.stage_changed', 'lead.converted',
    'proposal.sent', 'proposal.accepted', 'proposal.rejected',
    'client.created'
  ] as const;

  for (const event of SEQUENCE_TRIGGER_EVENTS) {
    workflowTriggerService.on(event, handleSequenceEvent);
  }

  // Client Notification Handlers
  workflowTriggerService.on('proposal.accepted', notifyProposalAccepted);
  workflowTriggerService.on('contract.signed', notifyContractSigned);
  workflowTriggerService.on('deliverable.approved', notifyDeliverableApproved);
  workflowTriggerService.on('questionnaire.completed', notifyQuestionnaireCompleted);
  workflowTriggerService.on('document_request.approved', notifyDocumentRequestApproved);
  workflowTriggerService.on('invoice.paid', notifyInvoicePaid);
  workflowTriggerService.on('project.milestone_completed', notifyMilestoneCompleted);

  logger.info('Registered 25 automation handlers', {
    category: 'workflow',
    metadata: {
      handlers: [
        'proposal.accepted -> Create project + contract + payment schedule + store maintenance tier',
        'proposal.accepted -> Notify client',
        'contract.signed -> Update project status',
        'contract.signed -> Notify client',
        'project.created -> Auto-assign questionnaires',
        'project.status_changed (completed) -> Activate maintenance tier + recurring invoice',
        'project.milestone_completed -> Create invoice',
        'project.milestone_completed -> Notify client',
        'deliverable.approved -> Notify client',
        'questionnaire.completed -> Notify client',
        'document_request.approved -> Notify client',
        'invoice.paid -> Notify client',
        'contract.signed -> Auto-complete agreement step',
        'invoice.paid -> Auto-complete agreement step',
        'questionnaire.completed -> Auto-complete agreement step',
        'contract.signed -> Auto-complete onboarding step',
        'invoice.paid -> Auto-complete onboarding step',
        'questionnaire.completed -> Auto-complete onboarding step',
        'lead.created -> Sequence auto-enroll',
        'lead.stage_changed -> Sequence auto-enroll',
        'lead.converted -> Sequence auto-enroll',
        'proposal.sent -> Sequence auto-enroll',
        'proposal.accepted -> Sequence auto-enroll',
        'proposal.rejected -> Sequence auto-enroll',
        'client.created -> Sequence auto-enroll'
      ]
    }
  });
}

// Export handlers for testing
export {
  handleProposalAccepted,
  handleContractSigned,
  handleMilestoneCompleted,
  handleAutoAssignQuestionnaires,
  handleMaintenanceActivation
};
