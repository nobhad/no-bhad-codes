/**
 * ===============================================
 * INTAKE CHECKLIST SERVICE
 * ===============================================
 * @file server/services/intake-checklist-service.ts
 *
 * Tracks what project information has been collected vs what's
 * still needed. Helps admin manage email-initiated projects where
 * clients didn't fill out the structured intake form.
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';

/** Categories of intake information */
const INTAKE_FIELDS = {
  // Essential -- needed to start work
  essential: [
    { field: 'project_type', label: 'Project Type', source: 'project' },
    { field: 'description', label: 'Project Description', source: 'project' },
    { field: 'budget_range', label: 'Budget Range', source: 'project' },
    { field: 'timeline', label: 'Timeline / Deadline', source: 'project' },
    { field: 'contact_name', label: 'Client Name', source: 'client' },
    { field: 'email', label: 'Client Email', source: 'client' }
  ],
  // Important -- needed for proposal & planning
  important: [
    { field: 'phone', label: 'Phone Number', source: 'client' },
    { field: 'company_name', label: 'Company / Business Name', source: 'client' },
    { field: 'features', label: 'Desired Features', source: 'project' },
    { field: 'page_count', label: 'Number of Pages', source: 'project' },
    { field: 'design_level', label: 'Design Complexity', source: 'project' },
    { field: 'content_status', label: 'Content Status (have copy/photos?)', source: 'project' },
    { field: 'current_site', label: 'Current Website URL', source: 'project' },
    { field: 'inspiration', label: 'Design Inspiration / Examples', source: 'project' }
  ],
  // Nice to have -- improves proposal quality
  niceToHave: [
    { field: 'tech_comfort', label: 'Technical Comfort Level', source: 'project' },
    { field: 'hosting_preference', label: 'Hosting Preference', source: 'project' },
    { field: 'brand_assets', label: 'Brand Assets (logo, colors, fonts)', source: 'project' },
    { field: 'integrations', label: 'Third-Party Integrations Needed', source: 'project' },
    { field: 'challenges', label: 'Current Pain Points / Challenges', source: 'project' },
    { field: 'referral_source', label: 'How They Found You', source: 'project' },
    { field: 'billing_name', label: 'Billing Name', source: 'client' },
    { field: 'billing_address', label: 'Billing Address', source: 'client' }
  ]
} as const;

export interface IntakeChecklistItem {
  field: string;
  label: string;
  category: 'essential' | 'important' | 'niceToHave';
  collected: boolean;
  value: string | null;
  source: string;
}

export interface IntakeChecklist {
  projectId: number;
  projectName: string;
  clientName: string;
  summary: {
    total: number;
    collected: number;
    missing: number;
    percentComplete: number;
    essentialMissing: number;
    importantMissing: number;
  };
  items: IntakeChecklistItem[];
}

/**
 * Get the intake information checklist for a project
 */
export async function getIntakeChecklist(projectId: number): Promise<IntakeChecklist | null> {
  const db = getDatabase();

  // Get project + client data
  const row = await db.get(
    `SELECT p.id, p.project_name, p.project_type, p.description, p.budget_range,
            p.timeline, p.features, p.page_count, p.design_level, p.content_status,
            p.current_site, p.inspiration, p.tech_comfort, p.hosting_preference,
            p.brand_assets, p.integrations, p.challenges, p.referral_source, p.notes,
            c.contact_name, c.email, c.phone, c.company_name,
            c.billing_name, c.billing_address
     FROM active_projects p
     JOIN active_clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [projectId]
  ) as Record<string, unknown> | undefined;

  if (!row) return null;

  const items: IntakeChecklistItem[] = [];
  let collected = 0;
  let essentialMissing = 0;
  let importantMissing = 0;

  for (const [category, fields] of Object.entries(INTAKE_FIELDS)) {
    for (const fieldDef of fields) {
      const value = row[fieldDef.field];
      const hasValue = value !== null && value !== undefined && String(value).trim() !== '';

      if (hasValue) collected++;
      if (!hasValue && category === 'essential') essentialMissing++;
      if (!hasValue && category === 'important') importantMissing++;

      items.push({
        field: fieldDef.field,
        label: fieldDef.label,
        category: category as 'essential' | 'important' | 'niceToHave',
        collected: hasValue,
        value: hasValue ? String(value) : null,
        source: fieldDef.source
      });
    }
  }

  // Also check questionnaire completion
  const questionnaireCount = await db.get(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM questionnaire_responses WHERE project_id = ?`,
    [projectId]
  ) as { total: number; completed: number };

  if (questionnaireCount.total > 0) {
    items.push({
      field: 'questionnaires',
      label: `Questionnaires (${questionnaireCount.completed}/${questionnaireCount.total} completed)`,
      category: 'important',
      collected: questionnaireCount.completed === questionnaireCount.total && questionnaireCount.total > 0,
      value: questionnaireCount.completed > 0 ? `${questionnaireCount.completed} of ${questionnaireCount.total} completed` : null,
      source: 'questionnaire'
    });
    if (questionnaireCount.completed < questionnaireCount.total) importantMissing++;
    if (questionnaireCount.completed === questionnaireCount.total && questionnaireCount.total > 0) collected++;
  }

  const total = items.length;
  const missing = total - collected;
  const percentComplete = total > 0 ? Math.round((collected / total) * 100) : 0;

  return {
    projectId,
    projectName: String(row.project_name || ''),
    clientName: String(row.contact_name || ''),
    summary: { total, collected, missing, percentComplete, essentialMissing, importantMissing },
    items
  };
}

/**
 * Escape HTML special characters to prevent XSS in email content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send a "missing information" request email to the client
 */
export async function sendInfoRequestEmail(
  projectId: number,
  missingFields: string[],
  customMessage?: string
): Promise<{ success: boolean; message: string }> {
  const db = getDatabase();

  const row = await db.get(
    `SELECT p.project_name,
            COALESCE(c.billing_name, c.contact_name) as client_name,
            COALESCE(c.billing_email, c.email) as client_email
     FROM active_projects p
     JOIN active_clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [projectId]
  ) as { project_name: string; client_name: string; client_email: string } | undefined;

  if (!row || !row.client_email) {
    return { success: false, message: 'Project or client email not found' };
  }

  // Map field names to friendly labels
  const allFields = [...INTAKE_FIELDS.essential, ...INTAKE_FIELDS.important, ...INTAKE_FIELDS.niceToHave];
  const fieldLabels = missingFields.map(f => {
    const def = allFields.find(d => d.field === f);
    return def ? def.label : f;
  });

  try {
    const { emailService } = await import('./email-service.js');
    const { BUSINESS_INFO } = await import('../config/business.js');

    const itemsList = fieldLabels.map(l => `- ${l}`).join('\n');
    const htmlItemsList = fieldLabels.map(l => `<li>${escapeHtml(l)}</li>`).join('');

    const safeClientName = escapeHtml(row.client_name);
    const safeProjectName = escapeHtml(row.project_name);
    const safeOwner = escapeHtml(BUSINESS_INFO.owner);
    const safeBusinessName = escapeHtml(BUSINESS_INFO.name);
    const safeCustomMessage = customMessage ? escapeHtml(customMessage) : '';

    await emailService.sendEmail({
      to: row.client_email,
      subject: `Information Needed for ${row.project_name} - ${BUSINESS_INFO.name}`,
      text: `Hi ${row.client_name},\n\nTo keep your project "${row.project_name}" moving forward, we need a few more details from you:\n\n${itemsList}\n\n${customMessage ? `${customMessage  }\n\n` : ''}You can provide this information by logging into the client portal or replying to this email.\n\nThank you!\n${BUSINESS_INFO.owner}\n${BUSINESS_INFO.name}`,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Information Needed</h2>
        <p>Hi ${safeClientName},</p>
        <p>To keep your project <strong>&ldquo;${safeProjectName}&rdquo;</strong> moving forward, we need a few more details from you:</p>
        <ul>${htmlItemsList}</ul>
        ${safeCustomMessage ? `<p>${safeCustomMessage}</p>` : ''}
        <p>You can provide this information by logging into the client portal or replying directly to this email.</p>
        <p style="margin-top: 30px;">Thank you!<br>${safeOwner}<br><em>${safeBusinessName}</em></p>
      </div>`
    });

    logger.info(`[IntakeChecklist] Sent info request email for project ${projectId}`, {
      category: 'projects',
      metadata: { fields: missingFields.length, to: row.client_email }
    });

    return { success: true, message: `Information request sent to ${row.client_email}` };
  } catch (error) {
    logger.error('[IntakeChecklist] Failed to send info request email:', {
      error: error instanceof Error ? error : undefined
    });
    return { success: false, message: 'Failed to send email' };
  }
}
