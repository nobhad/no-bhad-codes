/**
 * ===============================================
 * CUSTOM AUTOMATION ENGINE — Types
 * ===============================================
 * @file server/services/automation-engine-types.ts
 *
 * Type definitions for the custom automation engine.
 * Covers database row types, API params, action types,
 * and execution result types.
 */

// ============================================
// Action Type Union & Labels
// ============================================

export type ActionType =
  | 'send_email'
  | 'create_task'
  | 'update_status'
  | 'send_notification'
  | 'wait'
  | 'enroll_sequence'
  | 'create_invoice'
  | 'assign_questionnaire'
  | 'webhook'
  | 'add_tag'
  | 'add_note';

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  send_email: 'Send Email',
  create_task: 'Create Task',
  update_status: 'Update Status',
  send_notification: 'Send Notification',
  wait: 'Wait / Delay',
  enroll_sequence: 'Enroll in Email Sequence',
  create_invoice: 'Create Invoice',
  assign_questionnaire: 'Assign Questionnaire',
  webhook: 'Call Webhook',
  add_tag: 'Add Tag',
  add_note: 'Add Note'
};

// ============================================
// DB Row Types
// ============================================

export interface CustomAutomationRow {
  id: number;
  name: string;
  description: string | null;
  is_active: number;
  trigger_event: string;
  trigger_conditions: string;
  stop_on_error: number;
  max_runs_per_entity: number | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationActionRow {
  id: number;
  automation_id: number;
  action_order: number;
  action_type: ActionType;
  action_config: string;
  condition: string | null;
  created_at: string;
}

export interface AutomationRunRow {
  id: number;
  automation_id: number;
  trigger_event: string;
  trigger_entity_type: string | null;
  trigger_entity_id: number | null;
  status: RunStatus;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface AutomationActionLogRow {
  id: number;
  run_id: number;
  action_id: number;
  status: ActionLogStatus;
  executed_at: string | null;
  result: string | null;
  error_message: string | null;
}

export interface AutomationScheduledActionRow {
  id: number;
  run_id: number;
  action_id: number;
  execute_at: string;
  status: ScheduledStatus;
  created_at: string;
}

// ============================================
// Status Types
// ============================================

export type RunStatus = 'running' | 'completed' | 'failed' | 'waiting';
export type ActionLogStatus = 'pending' | 'executed' | 'failed' | 'skipped' | 'waiting';
export type ScheduledStatus = 'pending' | 'executed' | 'failed';

// ============================================
// API Param Types
// ============================================

export interface CreateAutomationParams {
  name: string;
  description?: string;
  triggerEvent: string;
  triggerConditions?: Record<string, unknown>;
  stopOnError?: boolean;
  maxRunsPerEntity?: number;
  actions: CreateActionParams[];
}

export interface CreateActionParams {
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  condition?: Record<string, unknown>;
}

// ============================================
// Enriched / Composite Types
// ============================================

export interface AutomationWithActions extends CustomAutomationRow {
  actions: AutomationActionRow[];
  runCount: number;
  lastRunAt: string | null;
}

// ============================================
// Execution Result Types
// ============================================

export interface ProcessScheduledResult {
  executed: number;
  failed: number;
}

export interface DryRunResult {
  automationId: number;
  wouldExecute: boolean;
  reason?: string;
  actions: Array<{
    actionType: ActionType;
    description: string;
    wouldSkip: boolean;
    skipReason?: string;
  }>;
}

// ============================================
// Template Variables
// ============================================

/**
 * Available variable names that can be used in action configs
 * with {{variable_name}} syntax for dynamic substitution.
 */
export const TEMPLATE_VARIABLES = [
  'client_name',
  'client_email',
  'client_company',
  'project_name',
  'project_id',
  'project_status',
  'invoice_number',
  'invoice_amount',
  'invoice_due_date',
  'contract_name',
  'admin_name',
  'admin_email',
  'portal_url',
  'current_date',
  'trigger_event'
] as const;
