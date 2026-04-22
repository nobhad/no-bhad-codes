/**
 * ===============================================
 * CUSTOM AUTOMATION ENGINE
 * ===============================================
 * @file server/services/automation-engine.ts
 *
 * Event-driven automation engine that listens for system
 * events, evaluates trigger conditions, and executes
 * configurable action chains (email, tasks, webhooks, etc.).
 *
 * Usage:
 *   import { automationEngine } from './automation-engine.js';
 *   await automationEngine.handleEvent('project.created', { project_name: '...', ... });
 */

import { getDatabase } from '../database/init.js';
import { logger } from './logger.js';
import { emailService } from './email-service.js';
import type {
  CustomAutomationRow,
  AutomationActionRow,
  AutomationRunRow,
  AutomationActionLogRow,
  AutomationScheduledActionRow,
  AutomationWithActions,
  CreateAutomationParams,
  CreateActionParams,
  ProcessScheduledResult,
  DryRunResult
} from './automation-engine-types.js';
import { ACTION_TYPE_LABELS } from './automation-engine-types.js';
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js';
import { getCircuitBreaker } from '../utils/circuit-breaker.js';

const userWebhookBreaker = getCircuitBreaker({
  name: 'tenant-webhook',
  failureThreshold: 10,
  cooldownMs: 60_000
});

// ============================================
// Constants
// ============================================

const LOG_CATEGORY = 'automation-engine';

const AUTOMATION_COLUMNS = `
  id, name, description, is_active, trigger_event, trigger_conditions,
  stop_on_error, max_runs_per_entity, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

const ACTION_COLUMNS = `
  id, automation_id, action_order, action_type, action_config,
  condition, created_at
`.replace(/\s+/g, ' ').trim();

const RUN_COLUMNS = `
  id, automation_id, trigger_event, trigger_entity_type, trigger_entity_id,
  status, started_at, completed_at, error_message
`.replace(/\s+/g, ' ').trim();

const ACTION_LOG_COLUMNS = `
  id, run_id, action_id, status, executed_at, result, error_message
`.replace(/\s+/g, ' ').trim();

const SCHEDULED_ACTION_COLUMNS = `
  id, run_id, action_id, execute_at, status, created_at
`.replace(/\s+/g, ' ').trim();

const MILLISECONDS_PER_DAY = 86400000;
const MILLISECONDS_PER_HOUR = 3600000;
const PROCESS_BATCH_SIZE = 50;

/**
 * Map entity type strings to their database table names.
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  lead: 'leads',
  client: 'clients',
  contact: 'contact_submissions',
  project: 'projects',
  invoice: 'invoices'
};

// ============================================
// Condition Evaluation
// ============================================

/**
 * Evaluate trigger/action conditions against context.
 * All condition fields must match the corresponding context values.
 */
function evaluateConditions(
  conditions: Record<string, unknown>,
  context: Record<string, unknown>
): boolean {
  for (const [field, expected] of Object.entries(conditions)) {
    if (context[field] !== expected) return false;
  }
  return true;
}

/**
 * Safely parse a JSON string into a Record, returning an empty object on failure.
 */
function safeParseJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// ============================================
// Variable Substitution
// ============================================

/**
 * Replace {{key}} patterns in a template string with values from context.
 * Supports flat keys only (no dot notation). Missing keys are left as-is.
 */
function resolveVariables(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = context[trimmedKey];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

// ============================================
// CRUD — Automations
// ============================================

/**
 * Create a new automation with its action chain.
 */
async function create(params: CreateAutomationParams): Promise<number> {
  const db = getDatabase();
  const triggerConditionsJson = JSON.stringify(params.triggerConditions || {});

  const result = await db.run(
    `INSERT INTO custom_automations
     (name, description, is_active, trigger_event, trigger_conditions, stop_on_error, max_runs_per_entity)
     VALUES (?, ?, 0, ?, ?, ?, ?)`,
    [
      params.name,
      params.description || null,
      params.triggerEvent,
      triggerConditionsJson,
      params.stopOnError ? 1 : 0,
      params.maxRunsPerEntity ?? null
    ]
  );

  const automationId = result.lastID!;

  for (let i = 0; i < params.actions.length; i++) {
    const action = params.actions[i];
    await db.run(
      `INSERT INTO automation_actions (automation_id, action_order, action_type, action_config, condition)
       VALUES (?, ?, ?, ?, ?)`,
      [
        automationId,
        i + 1,
        action.actionType,
        JSON.stringify(action.actionConfig),
        action.condition ? JSON.stringify(action.condition) : null
      ]
    );
  }

  logger.info('Created custom automation', {
    category: LOG_CATEGORY,
    metadata: { automationId, name: params.name, actionCount: params.actions.length }
  });

  return automationId;
}

/**
 * Update automation metadata (does not modify actions).
 */
async function update(
  id: number,
  params: Partial<Pick<CreateAutomationParams, 'name' | 'description' | 'triggerEvent' | 'triggerConditions' | 'stopOnError' | 'maxRunsPerEntity'>>
): Promise<void> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }
  if (params.description !== undefined) {
    updates.push('description = ?');
    values.push(params.description ?? null);
  }
  if (params.triggerEvent !== undefined) {
    updates.push('trigger_event = ?');
    values.push(params.triggerEvent);
  }
  if (params.triggerConditions !== undefined) {
    updates.push('trigger_conditions = ?');
    values.push(JSON.stringify(params.triggerConditions));
  }
  if (params.stopOnError !== undefined) {
    updates.push('stop_on_error = ?');
    values.push(params.stopOnError ? 1 : 0);
  }
  if (params.maxRunsPerEntity !== undefined) {
    updates.push('max_runs_per_entity = ?');
    values.push(params.maxRunsPerEntity ?? null);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = datetime(\'now\')');
  values.push(id);

  await db.run(
    `UPDATE custom_automations SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  logger.info('Updated custom automation', {
    category: LOG_CATEGORY,
    metadata: { automationId: id }
  });
}

/**
 * Delete an automation. Stops any active/waiting runs first.
 */
async function deleteAutomation(id: number): Promise<void> {
  const db = getDatabase();

  await db.run(
    `UPDATE automation_runs
     SET status = 'failed', completed_at = datetime('now'), error_message = 'Automation deleted'
     WHERE automation_id = ? AND status IN ('running', 'waiting')`,
    [id]
  );

  await db.run('DELETE FROM custom_automations WHERE id = ?', [id]);

  logger.info('Deleted custom automation', {
    category: LOG_CATEGORY,
    metadata: { automationId: id }
  });
}

/**
 * List all automations with action counts and run statistics.
 *
 * Previously N+1: two queries per automation (actions + run stats).
 * Now two prefetch queries with IN-lists, grouped client-side —
 * constant-time regardless of automation count.
 */
async function list(): Promise<AutomationWithActions[]> {
  const db = getDatabase();

  const automations = await db.all<CustomAutomationRow>(
    `SELECT ${AUTOMATION_COLUMNS} FROM custom_automations ORDER BY created_at DESC`
  );

  if (automations.length === 0) return [];

  const ids = automations.map((a) => a.id);
  const placeholders = ids.map(() => '?').join(',');

  const [allActions, allStats] = await Promise.all([
    db.all<AutomationActionRow>(
      `SELECT ${ACTION_COLUMNS}
         FROM automation_actions
        WHERE automation_id IN (${placeholders})
        ORDER BY automation_id, action_order`,
      ids
    ),
    db.all<{ automation_id: number; run_count: number; last_run_at: string | null }>(
      `SELECT automation_id,
              COUNT(*) AS run_count,
              MAX(started_at) AS last_run_at
         FROM automation_runs
        WHERE automation_id IN (${placeholders})
        GROUP BY automation_id`,
      ids
    )
  ]);

  const actionsByAutomation = new Map<number, AutomationActionRow[]>();
  for (const action of allActions) {
    const bucket = actionsByAutomation.get(action.automation_id);
    if (bucket) bucket.push(action);
    else actionsByAutomation.set(action.automation_id, [action]);
  }

  const statsByAutomation = new Map<number, { run_count: number; last_run_at: string | null }>();
  for (const row of allStats) {
    statsByAutomation.set(row.automation_id, {
      run_count: row.run_count,
      last_run_at: row.last_run_at
    });
  }

  return automations.map((auto) => ({
    ...auto,
    actions: actionsByAutomation.get(auto.id) ?? [],
    runCount: statsByAutomation.get(auto.id)?.run_count ?? 0,
    lastRunAt: statsByAutomation.get(auto.id)?.last_run_at ?? null
  }));
}

/**
 * Get a single automation by ID with full actions and run stats.
 */
async function getById(id: number): Promise<AutomationWithActions | null> {
  const db = getDatabase();

  const auto = await db.get<CustomAutomationRow>(
    `SELECT ${AUTOMATION_COLUMNS} FROM custom_automations WHERE id = ?`,
    [id]
  );

  if (!auto) return null;

  const actions = await db.all<AutomationActionRow>(
    `SELECT ${ACTION_COLUMNS} FROM automation_actions WHERE automation_id = ? ORDER BY action_order`,
    [id]
  );

  const runStats = await db.get<{ run_count: number; last_run_at: string | null }>(
    `SELECT
       COUNT(*) as run_count,
       MAX(started_at) as last_run_at
     FROM automation_runs
     WHERE automation_id = ?`,
    [id]
  );

  return {
    ...auto,
    actions,
    runCount: runStats?.run_count || 0,
    lastRunAt: runStats?.last_run_at || null
  };
}

/**
 * Activate an automation.
 */
async function activate(id: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE custom_automations SET is_active = 1, updated_at = datetime(\'now\') WHERE id = ?',
    [id]
  );
  logger.info('Activated automation', { category: LOG_CATEGORY, metadata: { automationId: id } });
}

/**
 * Deactivate an automation.
 */
async function deactivate(id: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE custom_automations SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?',
    [id]
  );
  logger.info('Deactivated automation', { category: LOG_CATEGORY, metadata: { automationId: id } });
}

// ============================================
// CRUD — Actions
// ============================================

/**
 * Add an action to an automation at the next available order position.
 */
async function addAction(automationId: number, params: CreateActionParams): Promise<number> {
  const db = getDatabase();

  const maxOrderRow = await db.get<{ max_order: number | null }>(
    'SELECT MAX(action_order) as max_order FROM automation_actions WHERE automation_id = ?',
    [automationId]
  );
  const nextOrder = (maxOrderRow?.max_order || 0) + 1;

  const result = await db.run(
    `INSERT INTO automation_actions (automation_id, action_order, action_type, action_config, condition)
     VALUES (?, ?, ?, ?, ?)`,
    [
      automationId,
      nextOrder,
      params.actionType,
      JSON.stringify(params.actionConfig),
      params.condition ? JSON.stringify(params.condition) : null
    ]
  );

  await touchAutomationUpdatedAt(automationId);
  return result.lastID!;
}

/**
 * Update an existing action's configuration.
 */
async function updateAction(actionId: number, params: Partial<CreateActionParams>): Promise<void> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: (string | null)[] = [];

  if (params.actionType !== undefined) {
    updates.push('action_type = ?');
    values.push(params.actionType);
  }
  if (params.actionConfig !== undefined) {
    updates.push('action_config = ?');
    values.push(JSON.stringify(params.actionConfig));
  }
  if (params.condition !== undefined) {
    updates.push('condition = ?');
    values.push(params.condition ? JSON.stringify(params.condition) : null);
  }

  if (updates.length === 0) return;

  values.push(String(actionId));

  await db.run(
    `UPDATE automation_actions SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  const action = await db.get<AutomationActionRow>(
    'SELECT automation_id FROM automation_actions WHERE id = ?',
    [actionId]
  );
  if (action) {
    await touchAutomationUpdatedAt(action.automation_id);
  }
}

/**
 * Delete an action by ID.
 */
async function deleteAction(actionId: number): Promise<void> {
  const db = getDatabase();

  const action = await db.get<AutomationActionRow>(
    'SELECT automation_id FROM automation_actions WHERE id = ?',
    [actionId]
  );

  await db.run('DELETE FROM automation_actions WHERE id = ?', [actionId]);

  if (action) {
    await touchAutomationUpdatedAt(action.automation_id);
  }
}

/**
 * Reorder actions by providing an array of action IDs in the desired order.
 */
async function reorderActions(automationId: number, actionIds: number[]): Promise<void> {
  const db = getDatabase();

  for (let i = 0; i < actionIds.length; i++) {
    await db.run(
      'UPDATE automation_actions SET action_order = ? WHERE id = ? AND automation_id = ?',
      [i + 1, actionIds[i], automationId]
    );
  }

  await touchAutomationUpdatedAt(automationId);
}

// ============================================
// Event Handling
// ============================================

/**
 * Handle a system event by finding all matching active automations
 * and executing their action chains.
 */
async function handleEvent(
  eventType: string,
  context: Record<string, unknown>
): Promise<void> {
  const db = getDatabase();

  const matchingAutomations = await db.all<CustomAutomationRow>(
    `SELECT ${AUTOMATION_COLUMNS} FROM custom_automations
     WHERE trigger_event = ? AND is_active = 1`,
    [eventType]
  );

  for (const automation of matchingAutomations) {
    const triggerConditions = safeParseJson(automation.trigger_conditions);

    if (Object.keys(triggerConditions).length > 0 && !evaluateConditions(triggerConditions, context)) {
      continue;
    }

    // Check max_runs_per_entity limit
    if (automation.max_runs_per_entity !== null && context.entity_type && context.entity_id) {
      const existingRunCount = await db.get<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM automation_runs
         WHERE automation_id = ? AND trigger_entity_type = ? AND trigger_entity_id = ?`,
        [automation.id, String(context.entity_type), Number(context.entity_id)]
      );

      if (existingRunCount && existingRunCount.cnt >= automation.max_runs_per_entity) {
        logger.info('Skipping automation: max runs per entity reached', {
          category: LOG_CATEGORY,
          metadata: {
            automationId: automation.id,
            entityType: context.entity_type,
            entityId: context.entity_id,
            maxRuns: automation.max_runs_per_entity
          }
        });
        continue;
      }
    }

    try {
      const entityType = context.entity_type ? String(context.entity_type) : undefined;
      const entityId = context.entity_id ? Number(context.entity_id) : undefined;

      await executeAutomation(automation.id, context, entityType, entityId);
    } catch (execError) {
      logger.error('Failed to execute automation from event', {
        category: LOG_CATEGORY,
        metadata: {
          automationId: automation.id,
          eventType,
          error: execError instanceof Error ? execError.message : String(execError)
        }
      });
    }
  }
}

// ============================================
// Execution Engine
// ============================================

/**
 * Execute an automation's action chain.
 * Creates a run record and processes each action in order.
 *
 * Returns the run ID for tracking.
 */
async function executeAutomation(
  automationId: number,
  context: Record<string, unknown>,
  triggerEntityType?: string,
  triggerEntityId?: number
): Promise<number> {
  const db = getDatabase();

  const automation = await db.get<CustomAutomationRow>(
    `SELECT ${AUTOMATION_COLUMNS} FROM custom_automations WHERE id = ?`,
    [automationId]
  );

  if (!automation) {
    throw new Error(`Automation not found: ${automationId}`);
  }

  // Create the run record
  const runResult = await db.run(
    `INSERT INTO automation_runs (automation_id, trigger_event, trigger_entity_type, trigger_entity_id, status)
     VALUES (?, ?, ?, ?, 'running')`,
    [
      automationId,
      automation.trigger_event,
      triggerEntityType || null,
      triggerEntityId || null
    ]
  );

  const runId = runResult.lastID!;

  // Get actions ordered by action_order
  const actions = await db.all<AutomationActionRow>(
    `SELECT ${ACTION_COLUMNS} FROM automation_actions WHERE automation_id = ? ORDER BY action_order`,
    [automationId]
  );

  const stopOnError = automation.stop_on_error === 1;

  for (const action of actions) {
    // Evaluate action-level condition
    if (action.condition) {
      const actionConditions = safeParseJson(action.condition);
      if (Object.keys(actionConditions).length > 0 && !evaluateConditions(actionConditions, context)) {
        await logActionResult(runId, action.id, 'skipped', 'Condition not met', null);
        continue;
      }
    }

    // Handle 'wait' action type — schedule and pause the run
    if (action.action_type === 'wait') {
      try {
        const waitResult = await executeWait(
          safeParseJson(action.action_config),
          runId,
          action.id
        );
        await logActionResult(runId, action.id, 'waiting', waitResult, null);
      } catch (waitError) {
        const errorMsg = waitError instanceof Error ? waitError.message : String(waitError);
        await logActionResult(runId, action.id, 'failed', null, errorMsg);
        if (stopOnError) {
          await markRunStatus(runId, 'failed', errorMsg);
          return runId;
        }
      }

      // Set run to 'waiting' and stop processing remaining actions
      await markRunStatus(runId, 'waiting', null);
      return runId;
    }

    // Execute the action
    try {
      const result = await executeAction(action, context, runId);
      await logActionResult(runId, action.id, 'executed', result, null);
    } catch (actionError) {
      const errorMsg = actionError instanceof Error ? actionError.message : String(actionError);
      await logActionResult(runId, action.id, 'failed', null, errorMsg);

      if (stopOnError) {
        await markRunStatus(runId, 'failed', errorMsg);
        return runId;
      }
    }
  }

  // All actions completed (no wait encountered)
  await markRunStatus(runId, 'completed', null);
  return runId;
}

/**
 * Dispatch a single action to the appropriate executor.
 */
async function executeAction(
  action: AutomationActionRow,
  context: Record<string, unknown>,
  _runId: number
): Promise<string> {
  const config = safeParseJson(action.action_config);

  switch (action.action_type) {
  case 'send_email':
    return executeSendEmail(config, context);
  case 'create_task':
    return executeCreateTask(config, context);
  case 'update_status':
    return executeUpdateStatus(config, context);
  case 'send_notification':
    return executeSendNotification(config, context);
  case 'enroll_sequence':
    return executeEnrollSequence(config, context);
  case 'webhook':
    return executeWebhook(config, context);
  case 'add_note':
    return executeAddNote(config, context);
  case 'add_tag':
    return executeAddTag(config, context);
  case 'create_invoice':
    return executeCreateInvoice(config, context);
  case 'assign_questionnaire':
    return executeAssignQuestionnaire(config, context);
  default:
    return `Unsupported action type: ${action.action_type}`;
  }
}

// ============================================
// Action Executors
// ============================================

/**
 * Send an email with variable substitution.
 */
async function executeSendEmail(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const to = resolveVariables(String(config.to || ''), context);
  const subject = resolveVariables(String(config.subject || ''), context);
  const body = resolveVariables(String(config.body || ''), context);

  if (!to) {
    throw new Error('Email recipient (to) is required');
  }

  const htmlBody = body.replace(/\n/g, '<br>');

  const result = await emailService.sendEmail({
    to,
    subject,
    text: body,
    html: htmlBody
  });

  if (!result.success) {
    throw new Error(`Email send failed: ${result.message}`);
  }

  return `Email sent to ${to}`;
}

/**
 * Create a task in the tasks table.
 */
async function executeCreateTask(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const db = getDatabase();

  const title = resolveVariables(String(config.title || ''), context);
  const description = resolveVariables(String(config.description || ''), context);
  const dueDaysFromNow = Number(config.dueDaysFromNow || 0);

  const dueDate = new Date(Date.now() + dueDaysFromNow * MILLISECONDS_PER_DAY).toISOString();

  const projectId = config.projectId ? Number(config.projectId) : (context.project_id ? Number(context.project_id) : null);
  const clientId = config.clientId ? Number(config.clientId) : (context.client_id ? Number(context.client_id) : null);

  const result = await db.run(
    `INSERT INTO tasks (title, description, status, due_date, project_id, client_id, created_at)
     VALUES (?, ?, 'pending', ?, ?, ?, datetime('now'))`,
    [title, description, dueDate, projectId, clientId]
  );

  return `Task created: "${title}" (ID: ${result.lastID})`;
}

/**
 * Update an entity's status field.
 */
async function executeUpdateStatus(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const db = getDatabase();

  const entityType = resolveVariables(String(config.entityType || ''), context);
  const entityId = Number(config.entityId || context.entity_id);
  const newStatus = resolveVariables(String(config.status || ''), context);

  const tableName = ENTITY_TABLE_MAP[entityType];
  if (!tableName) {
    throw new Error(`Unknown entity type for status update: ${entityType}`);
  }

  if (!entityId || !newStatus) {
    throw new Error('entityId and status are required for update_status');
  }

  await db.run(
    `UPDATE ${tableName} SET status = ? WHERE id = ?`,
    [newStatus, entityId]
  );

  return `Updated ${entityType} #${entityId} status to "${newStatus}"`;
}

/**
 * Send a notification email to admin or a specific recipient.
 */
async function executeSendNotification(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const toTarget = String(config.to || 'admin');
  const subject = resolveVariables(String(config.subject || 'Automation Notification'), context);
  const body = resolveVariables(String(config.body || ''), context);

  let recipientEmail: string;

  if (toTarget === 'admin') {
    recipientEmail = String(context.admin_email || process.env.ADMIN_EMAIL || '');
  } else if (toTarget === 'client') {
    recipientEmail = String(context.client_email || '');
  } else {
    recipientEmail = resolveVariables(toTarget, context);
  }

  if (!recipientEmail) {
    throw new Error('Could not determine notification recipient email');
  }

  const htmlBody = body.replace(/\n/g, '<br>');

  const result = await emailService.sendEmail({
    to: recipientEmail,
    subject,
    text: body,
    html: htmlBody
  });

  if (!result.success) {
    throw new Error(`Notification send failed: ${result.message}`);
  }

  return `Notification sent to ${toTarget} (${recipientEmail})`;
}

/**
 * Schedule a future action by calculating execute_at and inserting
 * into automation_scheduled_actions.
 */
async function executeWait(
  config: Record<string, unknown>,
  runId: number,
  actionId: number
): Promise<string> {
  const db = getDatabase();

  const delayDays = Number(config.delayDays || 0);
  const delayHours = Number(config.delayHours || 0);
  const totalDelayMs = (delayDays * MILLISECONDS_PER_DAY) + (delayHours * MILLISECONDS_PER_HOUR);

  if (totalDelayMs <= 0) {
    throw new Error('Wait action requires delayDays or delayHours > 0');
  }

  const executeAt = new Date(Date.now() + totalDelayMs).toISOString();

  await db.run(
    `INSERT INTO automation_scheduled_actions (run_id, action_id, execute_at, status)
     VALUES (?, ?, ?, 'pending')`,
    [runId, actionId, executeAt]
  );

  return `Scheduled wait until ${executeAt}`;
}

/**
 * Enroll an entity into an email sequence.
 */
async function executeEnrollSequence(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const { sequenceService } = await import('./sequence-service.js');

  const sequenceId = Number(config.sequenceId);
  const entityType = String(config.entityType || context.entity_type || 'client');
  const entityId = Number(config.entityId || context.entity_id);
  const entityEmail = String(config.entityEmail || context.client_email || '');
  const entityName = String(config.entityName || context.client_name || '');

  if (!sequenceId || !entityId || !entityEmail) {
    throw new Error('sequenceId, entityId, and entityEmail are required for enroll_sequence');
  }

  const enrollmentId = await sequenceService.enrollEntity({
    sequenceId,
    entityType,
    entityId,
    entityEmail,
    entityName: entityName || undefined
  });

  return `Enrolled entity in sequence ${sequenceId} (enrollment: ${enrollmentId})`;
}

/**
 * Call an external webhook URL with the automation context.
 */
async function executeWebhook(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const url = resolveVariables(String(config.url || ''), context);
  const method = String(config.method || 'POST').toUpperCase();
  const headers = (config.headers as Record<string, string>) || {};

  if (!url) {
    throw new Error('Webhook URL is required');
  }

  const WEBHOOK_TIMEOUT_MS = 30000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await userWebhookBreaker.execute(() =>
      fetchWithTimeout(url, {
        timeoutMs: 10000,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: method !== 'GET' ? JSON.stringify(context) : undefined,
        signal: controller.signal
      })
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`);
    }

    return `Webhook ${method} ${url} returned ${response.status}`;
  } catch (fetchError) {
    clearTimeout(timeoutId);
    throw fetchError;
  }
}

/**
 * Add a note to client_notes or as a project note.
 */
async function executeAddNote(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const db = getDatabase();

  const noteContent = resolveVariables(String(config.content || config.note || ''), context);
  const clientId = Number(config.clientId || context.client_id);

  if (!clientId || !noteContent) {
    throw new Error('clientId and content are required for add_note');
  }

  const result = await db.run(
    `INSERT INTO client_notes (client_id, note, created_by, created_at)
     VALUES (?, ?, 'automation', datetime('now'))`,
    [clientId, noteContent]
  );

  return `Note added to client #${clientId} (note ID: ${result.lastID})`;
}

/**
 * Add a tag to an entity.
 * Tags are stored as comma-separated values in the entity's tags column.
 */
async function executeAddTag(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const db = getDatabase();

  const tag = resolveVariables(String(config.tag || ''), context);
  const entityType = String(config.entityType || context.entity_type || 'client');
  const entityId = Number(config.entityId || context.entity_id);

  const tableName = ENTITY_TABLE_MAP[entityType];
  if (!tableName) {
    throw new Error(`Unknown entity type for add_tag: ${entityType}`);
  }

  if (!tag || !entityId) {
    throw new Error('tag and entityId are required for add_tag');
  }

  // Get current tags
  const entity = await db.get<{ tags: string | null }>(
    `SELECT tags FROM ${tableName} WHERE id = ?`,
    [entityId]
  );

  const currentTags = entity?.tags ? entity.tags.split(',').map(t => t.trim()) : [];

  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    await db.run(
      `UPDATE ${tableName} SET tags = ? WHERE id = ?`,
      [currentTags.join(', '), entityId]
    );
  }

  return `Tag "${tag}" added to ${entityType} #${entityId}`;
}

/**
 * Create an invoice (placeholder — logs intent, actual logic depends on invoice service).
 */
async function executeCreateInvoice(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const db = getDatabase();

  const clientId = Number(config.clientId || context.client_id);
  const amount = Number(config.amount || 0);
  const description = resolveVariables(String(config.description || 'Automated invoice'), context);

  if (!clientId || !amount) {
    throw new Error('clientId and amount are required for create_invoice');
  }

  const result = await db.run(
    `INSERT INTO invoices (client_id, amount, status, description, created_at, updated_at)
     VALUES (?, ?, 'draft', ?, datetime('now'), datetime('now'))`,
    [clientId, amount, description]
  );

  return `Invoice created for client #${clientId}, amount: ${amount} (ID: ${result.lastID})`;
}

/**
 * Assign a questionnaire to a client (placeholder — inserts a record).
 */
async function executeAssignQuestionnaire(
  config: Record<string, unknown>,
  context: Record<string, unknown>
): Promise<string> {
  const db = getDatabase();

  const questionnaireId = Number(config.questionnaireId);
  const clientId = Number(config.clientId || context.client_id);

  if (!questionnaireId || !clientId) {
    throw new Error('questionnaireId and clientId are required for assign_questionnaire');
  }

  const result = await db.run(
    `INSERT INTO questionnaire_responses (questionnaire_id, client_id, status, created_at, updated_at)
     VALUES (?, ?, 'pending', datetime('now'), datetime('now'))`,
    [questionnaireId, clientId]
  );

  return `Questionnaire ${questionnaireId} assigned to client #${clientId} (response ID: ${result.lastID})`;
}

// ============================================
// Scheduled Action Processing
// ============================================

/**
 * Process pending scheduled actions whose execute_at has arrived.
 * For each, resumes the automation run from the action after the wait.
 */
async function processScheduledActions(): Promise<ProcessScheduledResult> {
  const db = getDatabase();
  const nowIso = new Date().toISOString();

  const result: ProcessScheduledResult = {
    executed: 0,
    failed: 0
  };

  const pendingActions = await db.all<AutomationScheduledActionRow>(
    `SELECT ${SCHEDULED_ACTION_COLUMNS} FROM automation_scheduled_actions
     WHERE status = 'pending' AND execute_at <= ?
     ORDER BY execute_at ASC
     LIMIT ?`,
    [nowIso, PROCESS_BATCH_SIZE]
  );

  if (pendingActions.length === 0) return result;

  logger.info('Processing scheduled automation actions', {
    category: LOG_CATEGORY,
    metadata: { count: pendingActions.length }
  });

  for (const scheduled of pendingActions) {
    try {
      await resumeRunFromAction(scheduled);

      await db.run(
        'UPDATE automation_scheduled_actions SET status = \'executed\' WHERE id = ?',
        [scheduled.id]
      );

      result.executed++;
    } catch (processError) {
      logger.error('Failed to process scheduled action', {
        category: LOG_CATEGORY,
        metadata: {
          scheduledId: scheduled.id,
          runId: scheduled.run_id,
          error: processError instanceof Error ? processError.message : String(processError)
        }
      });

      await db.run(
        'UPDATE automation_scheduled_actions SET status = \'failed\' WHERE id = ?',
        [scheduled.id]
      );

      result.failed++;
    }
  }

  logger.info('Scheduled action processing complete', {
    category: LOG_CATEGORY,
    metadata: { executed: result.executed, failed: result.failed }
  });

  return result;
}

/**
 * Resume a run from the action following the wait action.
 * Rebuilds context from the run's entity info and processes remaining actions.
 */
async function resumeRunFromAction(scheduled: AutomationScheduledActionRow): Promise<void> {
  const db = getDatabase();

  const run = await db.get<AutomationRunRow>(
    `SELECT ${RUN_COLUMNS} FROM automation_runs WHERE id = ?`,
    [scheduled.run_id]
  );

  if (!run || run.status !== 'waiting') {
    return;
  }

  // Get the wait action to find its order
  const waitAction = await db.get<AutomationActionRow>(
    `SELECT ${ACTION_COLUMNS} FROM automation_actions WHERE id = ?`,
    [scheduled.action_id]
  );

  if (!waitAction) return;

  // Mark the wait action log as executed
  await logActionResult(run.id, waitAction.id, 'executed', 'Wait completed', null);

  // Update run status back to running
  await db.run(
    'UPDATE automation_runs SET status = \'running\' WHERE id = ?',
    [run.id]
  );

  // Get the automation for stop_on_error setting
  const automation = await db.get<CustomAutomationRow>(
    `SELECT ${AUTOMATION_COLUMNS} FROM custom_automations WHERE id = ?`,
    [run.automation_id]
  );

  if (!automation) return;

  const stopOnError = automation.stop_on_error === 1;

  // Rebuild context from run entity info
  const context = await buildContextFromRun(run);

  // Get remaining actions (those after the wait action)
  const remainingActions = await db.all<AutomationActionRow>(
    `SELECT ${ACTION_COLUMNS} FROM automation_actions
     WHERE automation_id = ? AND action_order > ?
     ORDER BY action_order`,
    [run.automation_id, waitAction.action_order]
  );

  for (const action of remainingActions) {
    // Evaluate action condition
    if (action.condition) {
      const actionConditions = safeParseJson(action.condition);
      if (Object.keys(actionConditions).length > 0 && !evaluateConditions(actionConditions, context)) {
        await logActionResult(run.id, action.id, 'skipped', 'Condition not met', null);
        continue;
      }
    }

    // Handle nested wait
    if (action.action_type === 'wait') {
      try {
        const waitResult = await executeWait(
          safeParseJson(action.action_config),
          run.id,
          action.id
        );
        await logActionResult(run.id, action.id, 'waiting', waitResult, null);
      } catch (waitError) {
        const errorMsg = waitError instanceof Error ? waitError.message : String(waitError);
        await logActionResult(run.id, action.id, 'failed', null, errorMsg);
        if (stopOnError) {
          await markRunStatus(run.id, 'failed', errorMsg);
          return;
        }
      }

      await markRunStatus(run.id, 'waiting', null);
      return;
    }

    try {
      const actionResult = await executeAction(action, context, run.id);
      await logActionResult(run.id, action.id, 'executed', actionResult, null);
    } catch (actionError) {
      const errorMsg = actionError instanceof Error ? actionError.message : String(actionError);
      await logActionResult(run.id, action.id, 'failed', null, errorMsg);

      if (stopOnError) {
        await markRunStatus(run.id, 'failed', errorMsg);
        return;
      }
    }
  }

  // All remaining actions completed
  await markRunStatus(run.id, 'completed', null);
}

// ============================================
// Execution History
// ============================================

/**
 * Get run history for an automation.
 */
async function getRuns(automationId: number, limit?: number): Promise<AutomationRunRow[]> {
  const db = getDatabase();
  const DEFAULT_RUN_LIMIT = 50;
  const effectiveLimit = limit || DEFAULT_RUN_LIMIT;

  return db.all<AutomationRunRow>(
    `SELECT ${RUN_COLUMNS} FROM automation_runs
     WHERE automation_id = ?
     ORDER BY started_at DESC
     LIMIT ?`,
    [automationId, effectiveLimit]
  );
}

/**
 * Get per-action logs for a specific run.
 */
async function getRunLogs(runId: number): Promise<AutomationActionLogRow[]> {
  const db = getDatabase();

  return db.all<AutomationActionLogRow>(
    `SELECT ${ACTION_LOG_COLUMNS} FROM automation_action_logs
     WHERE run_id = ?
     ORDER BY id ASC`,
    [runId]
  );
}

// ============================================
// Dry Run
// ============================================

/**
 * Evaluate an automation against sample context without executing.
 * Returns what would happen if the automation were triggered.
 */
async function dryRun(
  automationId: number,
  sampleContext: Record<string, unknown>
): Promise<DryRunResult> {
  const db = getDatabase();

  const automation = await db.get<CustomAutomationRow>(
    `SELECT ${AUTOMATION_COLUMNS} FROM custom_automations WHERE id = ?`,
    [automationId]
  );

  if (!automation) {
    return {
      automationId,
      wouldExecute: false,
      reason: 'Automation not found',
      actions: []
    };
  }

  // Check trigger conditions
  const triggerConditions = safeParseJson(automation.trigger_conditions);
  const conditionsMet = Object.keys(triggerConditions).length === 0 ||
    evaluateConditions(triggerConditions, sampleContext);

  if (!conditionsMet) {
    return {
      automationId,
      wouldExecute: false,
      reason: 'Trigger conditions not met',
      actions: []
    };
  }

  const actions = await db.all<AutomationActionRow>(
    `SELECT ${ACTION_COLUMNS} FROM automation_actions WHERE automation_id = ? ORDER BY action_order`,
    [automationId]
  );

  const actionResults: DryRunResult['actions'] = [];

  for (const action of actions) {
    const config = safeParseJson(action.action_config);
    const label = ACTION_TYPE_LABELS[action.action_type] || action.action_type;

    let wouldSkip = false;
    let skipReason: string | undefined;

    if (action.condition) {
      const actionConditions = safeParseJson(action.condition);
      if (Object.keys(actionConditions).length > 0 && !evaluateConditions(actionConditions, sampleContext)) {
        wouldSkip = true;
        skipReason = 'Action condition not met';
      }
    }

    // Build a human-readable description
    let description = label;
    if (action.action_type === 'send_email') {
      description = `Send email to ${resolveVariables(String(config.to || ''), sampleContext)}`;
    } else if (action.action_type === 'create_task') {
      description = `Create task: "${resolveVariables(String(config.title || ''), sampleContext)}"`;
    } else if (action.action_type === 'wait') {
      const days = Number(config.delayDays || 0);
      const hours = Number(config.delayHours || 0);
      description = `Wait ${days > 0 ? `${days} day(s)` : ''}${days > 0 && hours > 0 ? ' ' : ''}${hours > 0 ? `${hours} hour(s)` : ''}`;
    } else if (action.action_type === 'send_notification') {
      description = `Send notification to ${config.to || 'admin'}`;
    } else if (action.action_type === 'webhook') {
      description = `Call webhook: ${config.url || '(no URL)'}`;
    } else if (action.action_type === 'update_status') {
      description = `Update ${config.entityType || 'entity'} status to "${config.status || ''}"`;
    } else if (action.action_type === 'add_note') {
      description = 'Add note to client';
    } else if (action.action_type === 'add_tag') {
      description = `Add tag "${config.tag || ''}"`;
    } else if (action.action_type === 'enroll_sequence') {
      description = `Enroll in sequence #${config.sequenceId || '?'}`;
    }

    actionResults.push({
      actionType: action.action_type,
      description,
      wouldSkip,
      skipReason
    });
  }

  return {
    automationId,
    wouldExecute: true,
    actions: actionResults
  };
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Update the updated_at timestamp on an automation.
 */
async function touchAutomationUpdatedAt(automationId: number): Promise<void> {
  const db = getDatabase();
  await db.run(
    'UPDATE custom_automations SET updated_at = datetime(\'now\') WHERE id = ?',
    [automationId]
  );
}

/**
 * Log an action result to the automation_action_logs table.
 */
async function logActionResult(
  runId: number,
  actionId: number,
  status: string,
  result: string | null,
  errorMessage: string | null
): Promise<void> {
  const db = getDatabase();

  await db.run(
    `INSERT INTO automation_action_logs (run_id, action_id, status, executed_at, result, error_message)
     VALUES (?, ?, ?, datetime('now'), ?, ?)`,
    [runId, actionId, status, result, errorMessage]
  );
}

/**
 * Update a run's status and optional error message.
 */
async function markRunStatus(
  runId: number,
  status: string,
  errorMessage: string | null
): Promise<void> {
  const db = getDatabase();

  const completedAt = status === 'completed' || status === 'failed'
    ? 'datetime(\'now\')'
    : 'NULL';

  await db.run(
    `UPDATE automation_runs
     SET status = ?, error_message = ?, completed_at = ${completedAt}
     WHERE id = ?`,
    [status, errorMessage, runId]
  );
}

/**
 * Rebuild a context object from a run's entity information.
 * Used when resuming a run after a wait action.
 */
async function buildContextFromRun(run: AutomationRunRow): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {
    trigger_event: run.trigger_event,
    entity_type: run.trigger_entity_type,
    entity_id: run.trigger_entity_id
  };

  if (!run.trigger_entity_type || !run.trigger_entity_id) {
    return context;
  }

  const db = getDatabase();
  const tableName = ENTITY_TABLE_MAP[run.trigger_entity_type];

  if (!tableName) return context;

  try {
    const entity = await db.get<Record<string, unknown>>(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [run.trigger_entity_id]
    );

    if (entity) {
      // Populate common context fields based on entity type
      if (run.trigger_entity_type === 'project') {
        context.project_name = entity.name || entity.title;
        context.project_id = entity.id;
        context.project_status = entity.status;
        if (entity.client_id) {
          context.client_id = entity.client_id;
          const client = await db.get<Record<string, unknown>>(
            'SELECT * FROM clients WHERE id = ?',
            [Number(entity.client_id)]
          );
          if (client) {
            context.client_name = client.contact_name || client.company_name;
            context.client_email = client.email;
            context.client_company = client.company_name;
          }
        }
      } else if (run.trigger_entity_type === 'client') {
        context.client_name = entity.contact_name || entity.company_name;
        context.client_email = entity.email;
        context.client_company = entity.company_name;
        context.client_id = entity.id;
      } else if (run.trigger_entity_type === 'invoice') {
        context.invoice_number = entity.invoice_number;
        context.invoice_amount = entity.amount;
        context.invoice_due_date = entity.due_date;
        if (entity.client_id) {
          context.client_id = entity.client_id;
          const client = await db.get<Record<string, unknown>>(
            'SELECT * FROM clients WHERE id = ?',
            [Number(entity.client_id)]
          );
          if (client) {
            context.client_name = client.contact_name || client.company_name;
            context.client_email = client.email;
            context.client_company = client.company_name;
          }
        }
      }
    }
  } catch (lookupError) {
    logger.warn('Could not rebuild context from entity', {
      category: LOG_CATEGORY,
      metadata: {
        entityType: run.trigger_entity_type,
        entityId: run.trigger_entity_id,
        error: lookupError instanceof Error ? lookupError.message : String(lookupError)
      }
    });
  }

  return context;
}

// ============================================
// Singleton Export
// ============================================

export const automationEngine = {
  // CRUD — Automations
  create,
  update,
  deleteAutomation,
  list,
  getById,
  activate,
  deactivate,

  // CRUD — Actions
  addAction,
  updateAction,
  deleteAction,
  reorderActions,

  // Event handling
  handleEvent,

  // Execution
  executeAutomation,

  // Variable substitution (exported for testing)
  resolveVariables,

  // Scheduled processing
  processScheduledActions,

  // Execution history
  getRuns,
  getRunLogs,

  // Dry run
  dryRun
};
