/**
 * ===============================================
 * ONBOARDING CHECKLIST SERVICE
 * ===============================================
 * @file server/services/onboarding-checklist-service.ts
 *
 * Manages post-agreement onboarding checklists for clients.
 * Steps auto-complete when workflow events fire (contract signed, invoice paid, etc.).
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import type {
  OnboardingChecklistRow,
  OnboardingStepRow,
  OnboardingTemplateRow,
  TemplateStepConfig,
  CreateChecklistParams,
  ChecklistWithSteps
} from './onboarding-checklist-types.js';

// ============================================
// CRUD
// ============================================

/**
 * Create an onboarding checklist from a template.
 * If no templateId, uses the default template matching project type or the first default.
 */
async function createChecklist(params: CreateChecklistParams): Promise<number> {
  const { projectId, clientId, templateId, welcomeText } = params;
  const db = getDatabase();

  // Check for existing active checklist
  const existing = (await db.get(
    'SELECT id FROM onboarding_checklists WHERE project_id = ? AND status = \'active\' LIMIT 1',
    [projectId]
  )) as { id: number } | undefined;

  if (existing) return existing.id; // Idempotent

  // Find template
  let template: OnboardingTemplateRow | undefined;
  if (templateId) {
    template = (await db.get(
      'SELECT * FROM onboarding_templates WHERE id = ?',
      [templateId]
    )) as OnboardingTemplateRow | undefined;
  }

  if (!template) {
    // Get project type for template matching
    const project = (await db.get(
      'SELECT project_type FROM projects WHERE id = ?',
      [projectId]
    )) as { project_type: string | null } | undefined;

    // Try to find a template matching project type
    if (project?.project_type) {
      template = (await db.get(
        'SELECT * FROM onboarding_templates WHERE project_type = ? LIMIT 1',
        [project.project_type]
      )) as OnboardingTemplateRow | undefined;
    }

    // Fall back to default template
    if (!template) {
      template = (await db.get(
        'SELECT * FROM onboarding_templates WHERE is_default = 1 LIMIT 1'
      )) as OnboardingTemplateRow | undefined;
    }
  }

  if (!template) {
    throw new Error('No onboarding template found');
  }

  // Parse steps config
  let stepsConfig: TemplateStepConfig[];
  try {
    stepsConfig = JSON.parse(template.steps_config) as TemplateStepConfig[];
  } catch {
    throw new Error('Invalid template steps configuration');
  }

  // Create checklist
  const result = await db.run(
    `INSERT INTO onboarding_checklists
     (project_id, client_id, status, welcome_text, created_at)
     VALUES (?, ?, 'active', ?, datetime('now'))`,
    [projectId, clientId, welcomeText || null]
  );

  const checklistId = result.lastID!;

  // Resolve entity IDs for auto-detect steps
  for (let i = 0; i < stepsConfig.length; i++) {
    const stepConfig = stepsConfig[i];
    let entityId: number | null = null;
    let navigateEntityId: number | null = null;

    if (stepConfig.auto_detect && stepConfig.entity_type) {
      const resolved = await resolveEntityId(projectId, stepConfig.entity_type);
      entityId = resolved;
      navigateEntityId = resolved;
    }

    await db.run(
      `INSERT INTO onboarding_steps
       (checklist_id, step_type, label, description, step_order, status, entity_type, entity_id,
        auto_detect, navigate_tab, navigate_entity_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        checklistId,
        stepConfig.step_type,
        stepConfig.label,
        stepConfig.description || null,
        i,
        stepConfig.entity_type || null,
        entityId,
        stepConfig.auto_detect ? 1 : 0,
        stepConfig.navigate_tab || null,
        navigateEntityId
      ]
    );
  }

  logger.info('Created onboarding checklist', {
    category: 'onboarding',
    metadata: { checklistId, projectId, templateId: template.id, stepCount: stepsConfig.length }
  });

  return checklistId;
}

/**
 * Resolve the entity ID for a given entity type and project.
 */
async function resolveEntityId(projectId: number, entityType: string): Promise<number | null> {
  const db = getDatabase();

  switch (entityType) {
  case 'proposal': {
    const row = (await db.get(
      'SELECT id FROM proposal_requests WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
      [projectId]
    )) as { id: number } | undefined;
    return row?.id ?? null;
  }
  case 'contract': {
    const row = (await db.get(
      'SELECT id FROM contracts WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [projectId]
    )) as { id: number } | undefined;
    return row?.id ?? null;
  }
  case 'invoice': {
    const row = (await db.get(
      'SELECT id FROM invoices WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
      [projectId]
    )) as { id: number } | undefined;
    return row?.id ?? null;
  }
  case 'questionnaire': {
    const row = (await db.get(
      'SELECT id FROM questionnaire_responses WHERE project_id = ? ORDER BY created_at ASC LIMIT 1',
      [projectId]
    )) as { id: number } | undefined;
    return row?.id ?? null;
  }
  default:
    return null;
  }
}

// ============================================
// Queries
// ============================================

/**
 * Get active checklist for a client (with steps and progress).
 */
async function getClientChecklist(clientId: number): Promise<ChecklistWithSteps | null> {
  const db = getDatabase();

  const checklist = (await db.get(
    'SELECT * FROM onboarding_checklists WHERE client_id = ? AND status = \'active\' ORDER BY created_at DESC LIMIT 1',
    [clientId]
  )) as OnboardingChecklistRow | undefined;

  if (!checklist) return null;

  return enrichChecklist(checklist);
}

/**
 * Get checklist by ID (admin or client).
 */
async function getChecklist(checklistId: number): Promise<ChecklistWithSteps | null> {
  const db = getDatabase();

  const checklist = (await db.get(
    'SELECT * FROM onboarding_checklists WHERE id = ?',
    [checklistId]
  )) as OnboardingChecklistRow | undefined;

  if (!checklist) return null;

  return enrichChecklist(checklist);
}

/**
 * Get all checklists for admin view.
 */
async function getAllChecklists(): Promise<OnboardingChecklistRow[]> {
  const db = getDatabase();
  return (await db.all(
    'SELECT * FROM onboarding_checklists ORDER BY created_at DESC LIMIT 100'
  )) as OnboardingChecklistRow[];
}

async function enrichChecklist(checklist: OnboardingChecklistRow): Promise<ChecklistWithSteps> {
  const db = getDatabase();

  const steps = (await db.all(
    'SELECT * FROM onboarding_steps WHERE checklist_id = ? ORDER BY step_order ASC',
    [checklist.id]
  )) as OnboardingStepRow[];

  const completed = steps.filter((s) => s.status === 'completed').length;

  return {
    ...checklist,
    steps,
    progress: {
      total: steps.length,
      completed,
      percentage: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0
    }
  };
}

// ============================================
// Step Completion
// ============================================

/**
 * Manually complete a step.
 */
async function completeStep(stepId: number, clientId?: number): Promise<void> {
  const db = getDatabase();

  // Validate ownership if clientId provided
  if (clientId) {
    const step = (await db.get(
      `SELECT s.id FROM onboarding_steps s
       JOIN onboarding_checklists c ON s.checklist_id = c.id
       WHERE s.id = ? AND c.client_id = ?`,
      [stepId, clientId]
    )) as { id: number } | undefined;

    if (!step) throw new Error('Step not found');
  }

  await db.run(
    'UPDATE onboarding_steps SET status = \'completed\', completed_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ? AND status != \'completed\'',
    [stepId]
  );

  // Check if all steps are completed
  const step = (await db.get(
    'SELECT checklist_id FROM onboarding_steps WHERE id = ?',
    [stepId]
  )) as { checklist_id: number } | undefined;

  if (step) {
    await checkChecklistCompletion(step.checklist_id);
  }
}

/**
 * Auto-complete steps by entity type/ID (called from workflow events).
 */
async function autoCompleteByEntity(entityType: string, entityId: number): Promise<void> {
  const db = getDatabase();

  const steps = (await db.all(
    `SELECT s.id, s.checklist_id FROM onboarding_steps s
     JOIN onboarding_checklists c ON s.checklist_id = c.id
     WHERE s.entity_type = ? AND s.entity_id = ? AND s.auto_detect = 1
     AND s.status = 'pending' AND c.status = 'active'`,
    [entityType, entityId]
  )) as Array<{ id: number; checklist_id: number }>;

  for (const step of steps) {
    await db.run(
      'UPDATE onboarding_steps SET status = \'completed\', completed_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?',
      [step.id]
    );
    await checkChecklistCompletion(step.checklist_id);
  }

  if (steps.length > 0) {
    logger.info('Auto-completed onboarding steps', {
      category: 'onboarding',
      metadata: { entityType, entityId, stepsCompleted: steps.length }
    });
  }
}

/**
 * Check if all steps in a checklist are completed and update status.
 */
async function checkChecklistCompletion(checklistId: number): Promise<void> {
  const db = getDatabase();

  const pending = (await db.get(
    'SELECT COUNT(*) as count FROM onboarding_steps WHERE checklist_id = ? AND status = \'pending\'',
    [checklistId]
  )) as { count: number };

  if (pending.count === 0) {
    await db.run(
      'UPDATE onboarding_checklists SET status = \'completed\', completed_at = datetime(\'now\') WHERE id = ?',
      [checklistId]
    );

    logger.info('Onboarding checklist completed', {
      category: 'onboarding',
      metadata: { checklistId }
    });
  }
}

/**
 * Dismiss a checklist (client hides it).
 */
async function dismissChecklist(checklistId: number, clientId: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    'UPDATE onboarding_checklists SET status = \'dismissed\', dismissed_at = datetime(\'now\') WHERE id = ? AND client_id = ?',
    [checklistId, clientId]
  );
}

/**
 * Get templates (admin view).
 */
async function getTemplates(): Promise<OnboardingTemplateRow[]> {
  const db = getDatabase();
  return (await db.all(
    'SELECT * FROM onboarding_templates ORDER BY is_default DESC, name ASC'
  )) as OnboardingTemplateRow[];
}

// ============================================
// Singleton Export
// ============================================

export const onboardingChecklistService = {
  createChecklist,
  getClientChecklist,
  getChecklist,
  getAllChecklists,
  getTemplates,
  completeStep,
  autoCompleteByEntity,
  dismissChecklist
};
