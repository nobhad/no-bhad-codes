/**
 * ===============================================
 * PROJECT COMPLETION SERVICE
 * ===============================================
 * @file server/services/project-completion-service.ts
 *
 * Detects when a project is fully complete (all milestones done,
 * all invoices paid) and handles the completion workflow.
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

export interface ProjectCompletionStatus {
  projectId: number;
  isComplete: boolean;
  milestones: { total: number; completed: number };
  invoices: { total: number; paid: number };
  tasks: { total: number; completed: number };
  canAutoComplete: boolean;
  blockers: string[];
}

/**
 * Check if a project is ready for completion
 */
export async function checkProjectCompletion(projectId: number): Promise<ProjectCompletionStatus> {
  const db = getDatabase();
  const blockers: string[] = [];

  // Count milestones
  const milestoneStats = await db.get(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
     FROM milestones WHERE project_id = ?`,
    [projectId]
  ) as { total: number; completed: number };

  // Count tasks
  const taskStats = await db.get(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM project_tasks WHERE project_id = ? AND deleted_at IS NULL AND status != 'cancelled'`,
    [projectId]
  ) as { total: number; completed: number };

  // Count invoices
  const invoiceStats = await db.get(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid
     FROM invoices WHERE project_id = ? AND deleted_at IS NULL AND status != 'cancelled'`,
    [projectId]
  ) as { total: number; paid: number };

  // Determine blockers
  if (milestoneStats.total > 0 && milestoneStats.completed < milestoneStats.total) {
    blockers.push(`${milestoneStats.total - milestoneStats.completed} milestone(s) not completed`);
  }
  if (taskStats.total > 0 && taskStats.completed < taskStats.total) {
    blockers.push(`${taskStats.total - taskStats.completed} task(s) not completed`);
  }
  if (invoiceStats.total > 0 && invoiceStats.paid < invoiceStats.total) {
    blockers.push(`${invoiceStats.total - invoiceStats.paid} invoice(s) not paid`);
  }

  const isComplete = blockers.length === 0 && milestoneStats.total > 0;

  return {
    projectId,
    isComplete,
    milestones: milestoneStats,
    invoices: invoiceStats,
    tasks: taskStats,
    canAutoComplete: isComplete,
    blockers
  };
}

/**
 * Mark a project as completed and trigger completion workflows
 */
export async function completeProject(projectId: number, completedBy: string): Promise<{
  success: boolean;
  message: string;
}> {
  const db = getDatabase();

  // Verify project exists and is active
  const project = await db.get(
    'SELECT id, status, project_name, client_id FROM active_projects WHERE id = ?',
    [projectId]
  ) as Record<string, unknown> | undefined;

  if (!project) {
    return { success: false, message: 'Project not found' };
  }

  if (project.status === 'completed') {
    return { success: false, message: 'Project is already completed' };
  }

  // Update project status
  await db.run(
    `UPDATE projects SET
       status = 'completed',
       actual_end_date = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [projectId]
  );

  await logger.info(`[ProjectCompletion] Project ${projectId} marked as completed by ${completedBy}`, {
    category: 'projects'
  });

  // Send completion notification to client
  try {
    const { emailService } = await import('./email-service.js');
    const { BUSINESS_INFO } = await import('../config/business.js');

    const clientInfo = await db.get(
      `SELECT COALESCE(billing_name, contact_name) as name,
              COALESCE(billing_email, email) as email
       FROM active_clients WHERE id = ?`,
      [Number(project.client_id)]
    ) as { name: string; email: string } | undefined;

    if (clientInfo?.email) {
      await emailService.sendEmail({
        to: clientInfo.email,
        subject: `Project Complete - ${project.project_name} - ${BUSINESS_INFO.name}`,
        text: [
          `Hi ${clientInfo.name},`,
          '',
          `Great news! Your project "${project.project_name}" has been completed.`,
          '',
          'All milestones have been delivered and approved. You can access all your project files and documentation through the client portal.',
          '',
          'If you have any questions or need anything else, don\'t hesitate to reach out.',
          '',
          'Thank you for working with us!',
          '',
          `${BUSINESS_INFO.owner}`,
          `${BUSINESS_INFO.name}`
        ].join('\n'),
        html: [
          '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">',
          '<h2 style="color: #333;">Project Complete!</h2>',
          `<p>Hi ${clientInfo.name},</p>`,
          `<p>Great news! Your project <strong>"${project.project_name}"</strong> has been completed.</p>`,
          '<p>All milestones have been delivered and approved. You can access all your project files and documentation through the client portal.</p>',
          '<p>If you have any questions or need anything else, don\'t hesitate to reach out.</p>',
          '<p style="margin-top: 30px;">Thank you for working with us!</p>',
          `<p>${BUSINESS_INFO.owner}<br><em>${BUSINESS_INFO.name}</em></p>`,
          '</div>'
        ].join('\n')
      });
    }
  } catch (emailError) {
    logger.error('[ProjectCompletion] Failed to send completion email:', {
      error: emailError instanceof Error ? emailError : undefined
    });
  }

  // Emit workflow event
  try {
    const { workflowTriggerService } = await import('./workflow-trigger-service.js');
    await workflowTriggerService.emit('project.status_changed', {
      entityId: projectId,
      triggeredBy: completedBy,
      previousStatus: String(project.status),
      newStatus: 'completed'
    });
  } catch {
    // Non-critical
  }

  return { success: true, message: 'Project completed successfully' };
}
