/**
 * ===============================================
 * AUTOMATIONS TYPES & CONSTANTS
 * ===============================================
 * @file src/react/features/admin/automations/types.ts
 *
 * Type definitions and label/icon mappings for the
 * automation builder system.
 */

// ============================================
// ACTION TYPES
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

export type AutomationStatus = 'active' | 'inactive';

// ============================================
// ENTITY INTERFACES
// ============================================

export interface AutomationAction {
  id: number;
  automationId: number;
  actionOrder: number;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  condition: Record<string, unknown> | null;
}

export interface Automation {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  triggerEvent: string;
  triggerConditions: Record<string, unknown>[];
  stopOnError: boolean;
  maxRunsPerEntity: number | null;
  actions: AutomationAction[];
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface AutomationRun {
  id: number;
  automationId: number;
  triggerEvent: string;
  triggerEntityType: string;
  triggerEntityId: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface AutomationActionLog {
  id: number;
  runId: number;
  actionId: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  executedAt: string | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
}

// ============================================
// LABEL & ICON MAPS
// ============================================

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  send_email: 'Send Email',
  create_task: 'Create Task',
  update_status: 'Update Status',
  send_notification: 'Send Notification',
  wait: 'Wait',
  enroll_sequence: 'Enroll in Sequence',
  create_invoice: 'Create Invoice',
  assign_questionnaire: 'Assign Questionnaire',
  webhook: 'Webhook',
  add_tag: 'Add Tag',
  add_note: 'Add Note'
};

/**
 * Maps action types to lucide-react icon component names.
 * Components should import the icons directly from lucide-react
 * and use this map for rendering the correct icon per action type.
 */
export const ACTION_TYPE_ICONS: Record<ActionType, string> = {
  send_email: 'Mail',
  create_task: 'ListTodo',
  update_status: 'RefreshCw',
  send_notification: 'Bell',
  wait: 'Clock',
  enroll_sequence: 'Mail',
  create_invoice: 'Receipt',
  assign_questionnaire: 'ClipboardList',
  webhook: 'Globe',
  add_tag: 'Tag',
  add_note: 'StickyNote'
};

// ============================================
// TRIGGER EVENT GROUPS
// ============================================

export const TRIGGER_EVENT_GROUPS: Array<{
  label: string;
  events: Array<{ value: string; label: string }>;
}> = [
  {
    label: 'Lead',
    events: [
      { value: 'lead.created', label: 'Lead Created' },
      { value: 'lead.stage_changed', label: 'Lead Stage Changed' },
      { value: 'lead.converted', label: 'Lead Converted' }
    ]
  },
  {
    label: 'Project',
    events: [
      { value: 'project.created', label: 'Project Created' },
      { value: 'project.started', label: 'Project Started' },
      { value: 'project.completed', label: 'Project Completed' },
      { value: 'project.status_changed', label: 'Project Status Changed' }
    ]
  },
  {
    label: 'Invoice',
    events: [
      { value: 'invoice.created', label: 'Invoice Created' },
      { value: 'invoice.sent', label: 'Invoice Sent' },
      { value: 'invoice.paid', label: 'Invoice Paid' },
      { value: 'invoice.overdue', label: 'Invoice Overdue' }
    ]
  },
  {
    label: 'Contract',
    events: [
      { value: 'contract.created', label: 'Contract Created' },
      { value: 'contract.sent', label: 'Contract Sent' },
      { value: 'contract.signed', label: 'Contract Signed' }
    ]
  },
  {
    label: 'Proposal',
    events: [
      { value: 'proposal.created', label: 'Proposal Created' },
      { value: 'proposal.sent', label: 'Proposal Sent' },
      { value: 'proposal.accepted', label: 'Proposal Accepted' },
      { value: 'proposal.rejected', label: 'Proposal Rejected' }
    ]
  },
  {
    label: 'Task',
    events: [
      { value: 'task.created', label: 'Task Created' },
      { value: 'task.completed', label: 'Task Completed' },
      { value: 'task.overdue', label: 'Task Overdue' }
    ]
  },
  {
    label: 'Other',
    events: [
      { value: 'message.created', label: 'Message Created' },
      { value: 'deliverable.approved', label: 'Deliverable Approved' },
      { value: 'questionnaire.completed', label: 'Questionnaire Completed' },
      { value: 'agreement.completed', label: 'Agreement Completed' }
    ]
  }
];
