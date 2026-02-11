/**
 * ===============================================
 * ADMIN WORKFLOWS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-workflows.ts
 *
 * Workflow automation management for admin dashboard.
 * Includes Approval Workflows and Event Triggers.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut, apiDelete, parseJsonResponse } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { confirmDanger } from '../../../utils/confirm-dialog';
import { showToast } from '../../../utils/toast-notifications';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { createPortalModal, type PortalModalInstance } from '../../../components/portal-modal';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { getStatusDotHTML } from '../../../components/status-badge';
import { getPortalCheckboxHTML } from '../../../components/portal-checkbox';
import { loadEmailTemplatesData } from './admin-email-templates';

// ============================================
// TYPES
// ============================================

// Approval Types
interface WorkflowDefinition {
  id: number;
  name: string;
  description: string | null;
  entity_type: EntityType;
  workflow_type: WorkflowType;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkflowStep {
  id: number;
  workflow_definition_id: number;
  step_order: number;
  approver_type: 'user' | 'role' | 'client';
  approver_value: string;
  is_optional: boolean;
  auto_approve_after_hours: number | null;
  created_at: string;
}

type EntityType = 'proposal' | 'invoice' | 'contract' | 'deliverable' | 'project';
type WorkflowType = 'sequential' | 'parallel' | 'any_one';

// Trigger Types
interface WorkflowTrigger {
  id: number;
  name: string;
  description: string | null;
  event_type: string;
  conditions: Record<string, unknown> | null;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

type ActionType = 'send_email' | 'create_task' | 'update_status' | 'webhook' | 'notify';

interface TriggerOptions {
  eventTypes: string[];
  actionTypes: { type: ActionType; description: string }[];
}

// Trigger Execution Log
interface TriggerExecutionLog {
  id: number;
  trigger_id: number;
  trigger_name: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  action_result: 'success' | 'failed' | 'skipped';
  error_message: string | null;
  execution_time_ms: number;
  created_at: string;
}

// Pending Approval Instance (from getActiveWorkflows)
interface ApprovalInstance {
  id: number;
  workflow_definition_id: number;
  entity_type: EntityType;
  entity_id: number;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
  current_step: number;
  initiated_by: string;
  initiated_at: string;
  completed_at: string | null;
  notes: string | null;
  // Joined from workflow definition
  workflow_name: string;
  workflow_type: WorkflowType;
}

// ============================================
// CONSTANTS
// ============================================

const APPROVALS_API = '/api/approvals';
const TRIGGERS_API = '/api/triggers';

const ENTITY_TYPES: EntityType[] = ['proposal', 'invoice', 'contract', 'deliverable', 'project'];
const WORKFLOW_TYPES: WorkflowType[] = ['sequential', 'parallel', 'any_one'];

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  proposal: 'Proposal',
  invoice: 'Invoice',
  contract: 'Contract',
  deliverable: 'Deliverable',
  project: 'Project'
};

const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  sequential: 'Sequential (one at a time)',
  parallel: 'Parallel (all at once)',
  any_one: 'Any One (first approval wins)'
};

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  send_email: 'Send Email',
  create_task: 'Create Task',
  update_status: 'Update Status',
  webhook: 'Call Webhook',
  notify: 'Send Notification'
};

// ============================================
// STATE
// ============================================

let _storedContext: AdminDashboardContext | null = null;
let currentSubtab: 'approvals' | 'triggers' | 'email-templates' = 'approvals';
let cachedWorkflows: WorkflowDefinition[] = [];
let cachedTriggers: WorkflowTrigger[] = [];
let triggerOptions: TriggerOptions | null = null;
let cachedApprovalInstances: ApprovalInstance[] = [];
let currentApprovalFilter: 'all' | 'proposals' | 'urgent' = 'all';
const selectedApprovalIds: Set<number> = new Set();

// Modal instances
let workflowModal: PortalModalInstance | null = null;
let stepModal: PortalModalInstance | null = null;
let triggerModal: PortalModalInstance | null = null;
let triggerLogsModal: PortalModalInstance | null = null;
let workflowPreviewModal: PortalModalInstance | null = null;

// ============================================
// DOM HELPERS
// ============================================

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeHtml(text: string): string {
  return SanitizationUtils.escapeHtml(text);
}

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function loadWorkflowsData(ctx: AdminDashboardContext): Promise<void> {
  _storedContext = ctx;

  // Setup subtab navigation if not already done
  setupSubtabNavigation();
  setupPendingApprovalsHandlers();

  // Load data for current subtab
  if (currentSubtab === 'approvals') {
    await Promise.all([
      loadApprovalWorkflows(),
      loadPendingApprovals()
    ]);
  } else {
    await loadTriggers();
  }
}

// ============================================
// SUBTAB NAVIGATION
// ============================================

function setupSubtabNavigation(): void {
  const container = el('workflows-subtabs');
  if (!container || container.dataset.initialized === 'true') return;

  container.dataset.initialized = 'true';

  container.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('[data-subtab]') as HTMLElement;
    if (!btn) return;

    const subtab = btn.dataset.subtab as 'approvals' | 'triggers' | 'email-templates';
    if (subtab === currentSubtab) return;

    // Update active state
    container.querySelectorAll('[data-subtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show/hide content
    el('pending-approvals-section')?.classList.toggle('hidden', subtab !== 'approvals');
    el('workflows-approvals-content')?.classList.toggle('hidden', subtab !== 'approvals');
    el('workflows-triggers-content')?.classList.toggle('hidden', subtab !== 'triggers');
    el('workflows-email-templates-content')?.classList.toggle('hidden', subtab !== 'email-templates');

    currentSubtab = subtab;

    // Load data
    if (subtab === 'approvals') {
      await loadApprovalWorkflows();
    } else if (subtab === 'triggers') {
      await loadTriggers();
    } else if (subtab === 'email-templates' && _storedContext) {
      await loadEmailTemplatesData(_storedContext);
    }
  });
}

// ============================================
// APPROVAL WORKFLOWS
// ============================================

async function loadApprovalWorkflows(): Promise<void> {
  const tbody = el('workflows-table-body');
  if (!tbody) return;

  showTableLoading(tbody, 6, 'Loading workflows...');

  try {
    const res = await apiFetch(`${APPROVALS_API}/workflows`);
    if (!res.ok) throw new Error('Failed to load workflows');

    const data = await parseJsonResponse<{ workflows: WorkflowDefinition[] }>(res);
    cachedWorkflows = data.workflows || [];

    renderWorkflowsTable();
    setupWorkflowHandlers();
  } catch (error) {
    console.error('[AdminWorkflows] Error loading workflows:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Error loading workflows</td></tr>';
    }
  }
}

function renderWorkflowsTable(): void {
  const tbody = el('workflows-table-body');
  if (!tbody) return;

  if (cachedWorkflows.length === 0) {
    showTableEmpty(tbody, 6, 'No approval workflows defined yet.');
    return;
  }

  tbody.innerHTML = cachedWorkflows.map(w => {
    const entityLabel = ENTITY_TYPE_LABELS[w.entity_type] || w.entity_type;
    const typeLabel = WORKFLOW_TYPE_LABELS[w.workflow_type] || w.workflow_type;
    const statusBadge = getStatusDotHTML(w.is_active ? 'active' : 'inactive');
    // Purple star icon for default indicator
    const defaultIcon = w.is_default ? `
      <span class="default-indicator" title="Default workflow for ${entityLabel}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
        </svg>
      </span>` : '';

    return `
      <tr data-id="${w.id}">
        <td class="name-cell">${escapeHtml(w.name)}${defaultIcon}</td>
        <td class="type-cell entity-type-cell">
          ${entityLabel}
          <span class="type-stacked">${typeLabel}</span>
        </td>
        <td class="type-cell workflow-type-cell">${typeLabel}</td>
        <td class="status-cell">
          ${statusBadge}
          <span class="date-stacked">${formatDate(w.updated_at)}</span>
        </td>
        <td class="date-cell">${formatDate(w.updated_at)}</td>
        <td class="actions-cell">
          <div class="table-actions">
            <button type="button" class="icon-btn workflow-edit" data-id="${w.id}" title="Edit workflow" aria-label="Edit workflow">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button type="button" class="icon-btn workflow-steps" data-id="${w.id}" title="Manage steps" aria-label="Manage approval steps">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn-danger workflow-delete" data-id="${w.id}" data-name="${escapeHtml(w.name)}" title="Delete" aria-label="Delete workflow">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupWorkflowHandlers(): void {
  const tbody = el('workflows-table-body');
  if (!tbody || tbody.dataset.handlersAttached === 'true') return;
  tbody.dataset.handlersAttached = 'true';

  // Table row actions
  tbody.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;

    const id = parseInt(btn.dataset.id || '0', 10);
    if (!id) return;

    if (btn.classList.contains('workflow-edit')) {
      await openWorkflowModal(id);
    } else if (btn.classList.contains('workflow-steps')) {
      await openStepsModal(id);
    } else if (btn.classList.contains('workflow-delete')) {
      const name = btn.dataset.name || 'this workflow';
      await deleteWorkflow(id, name);
    }
  });

  // Create button
  const createBtn = el('create-workflow-btn');
  if (createBtn && !createBtn.dataset.bound) {
    createBtn.dataset.bound = 'true';
    createBtn.addEventListener('click', () => openWorkflowModal());
  }

  // Refresh button
  const refreshBtn = el('workflows-refresh');
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', () => loadApprovalWorkflows());
  }
}

async function openWorkflowModal(id?: number): Promise<void> {
  const isEdit = !!id;
  let workflow: WorkflowDefinition | null = null;

  if (isEdit) {
    workflow = cachedWorkflows.find(w => w.id === id) || null;
    if (!workflow) return;
  }

  // Create modal if not exists
  if (!workflowModal) {
    workflowModal = createPortalModal({
      id: 'workflow-modal',
      titleId: 'workflow-modal-title',
      title: 'Create Workflow',
      onClose: () => workflowModal?.hide()
    });

    workflowModal.body.innerHTML = `
      <form id="workflow-form" class="modal-form">
        <input type="hidden" id="workflow-id" />
        <div class="form-group">
          <label for="workflow-name">Name *</label>
          <input type="text" id="workflow-name" class="form-input" required maxlength="100" />
        </div>
        <div class="form-group">
          <label for="workflow-description">Description</label>
          <textarea id="workflow-description" class="form-input" rows="2"></textarea>
        </div>
        <div class="form-group">
          <label for="workflow-entity-type">Entity Type *</label>
          <select id="workflow-entity-type" class="form-input" required>
            ${ENTITY_TYPES.map(t => `<option value="${t}">${ENTITY_TYPE_LABELS[t]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="workflow-type">Workflow Type *</label>
          <select id="workflow-type" class="form-input" required>
            ${WORKFLOW_TYPES.map(t => `<option value="${t}">${WORKFLOW_TYPE_LABELS[t]}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-group-inline">
          <label>
            <input type="checkbox" id="workflow-is-default" />
            Set as default for this entity type
          </label>
        </div>
      </form>
    `;

    workflowModal.footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="workflow-cancel-btn">CANCEL</button>
      <button type="button" class="btn btn-outline" id="workflow-preview-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        PREVIEW
      </button>
      <button type="submit" form="workflow-form" class="btn btn-primary">SAVE</button>
    `;

    // Cancel button
    el('workflow-cancel-btn')?.addEventListener('click', () => workflowModal?.hide());

    // Preview button
    el('workflow-preview-btn')?.addEventListener('click', async () => {
      await previewWorkflow();
    });

    // Form submit
    el('workflow-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveWorkflow();
    });
  }

  // Set title and populate form
  workflowModal.setTitle(isEdit ? 'Edit Workflow' : 'Create Workflow');

  (el('workflow-id') as HTMLInputElement).value = workflow?.id?.toString() || '';
  (el('workflow-name') as HTMLInputElement).value = workflow?.name || '';
  (el('workflow-description') as HTMLTextAreaElement).value = workflow?.description || '';
  (el('workflow-entity-type') as HTMLSelectElement).value = workflow?.entity_type || 'proposal';
  (el('workflow-type') as HTMLSelectElement).value = workflow?.workflow_type || 'sequential';
  (el('workflow-is-default') as HTMLInputElement).checked = workflow?.is_default || false;

  workflowModal.show();
  manageFocusTrap(workflowModal.overlay);
}

async function saveWorkflow(): Promise<void> {
  const id = (el('workflow-id') as HTMLInputElement).value;
  const isEdit = !!id;

  const payload = {
    name: (el('workflow-name') as HTMLInputElement).value.trim(),
    description: (el('workflow-description') as HTMLTextAreaElement).value.trim() || null,
    entity_type: (el('workflow-entity-type') as HTMLSelectElement).value,
    workflow_type: (el('workflow-type') as HTMLSelectElement).value,
    is_default: (el('workflow-is-default') as HTMLInputElement).checked
  };

  try {
    const res = isEdit
      ? await apiPut(`${APPROVALS_API}/workflows/${id}`, payload)
      : await apiPost(`${APPROVALS_API}/workflows`, payload);

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save workflow');
    }

    showToast(isEdit ? 'Workflow updated' : 'Workflow created', 'success');
    workflowModal?.hide();
    await loadApprovalWorkflows();
  } catch (error) {
    console.error('[AdminWorkflows] Save error:', error);
    showToast(error instanceof Error ? error.message : 'Error saving workflow', 'error');
  }
}

async function previewWorkflow(): Promise<void> {
  const workflowId = (el('workflow-id') as HTMLInputElement)?.value;

  // Get current form values
  const name = (el('workflow-name') as HTMLInputElement)?.value.trim() || 'Untitled Workflow';
  const description = (el('workflow-description') as HTMLTextAreaElement)?.value.trim() || 'No description';
  const entityType = (el('workflow-entity-type') as HTMLSelectElement)?.value as EntityType;
  const workflowType = (el('workflow-type') as HTMLSelectElement)?.value as WorkflowType;
  const isDefault = (el('workflow-is-default') as HTMLInputElement)?.checked || false;

  // Create preview modal if not exists
  if (!workflowPreviewModal) {
    workflowPreviewModal = createPortalModal({
      id: 'workflow-preview-modal',
      titleId: 'workflow-preview-modal-title',
      title: 'Workflow Preview',
      contentClassName: 'workflow-preview-modal-content modal-content-wide',
      onClose: () => workflowPreviewModal?.hide()
    });
  }

  // Show loading state
  workflowPreviewModal.body.innerHTML = '<div class="loading-message">Loading preview...</div>';
  workflowPreviewModal.setTitle(`Preview: ${escapeHtml(name)}`);
  workflowPreviewModal.show();
  manageFocusTrap(workflowPreviewModal.overlay);

  // Fetch steps if editing existing workflow
  let steps: WorkflowStep[] = [];
  if (workflowId) {
    try {
      const res = await apiFetch(`${APPROVALS_API}/workflows/${workflowId}`);
      if (res.ok) {
        const data = await parseJsonResponse<{ workflow: WorkflowDefinition; steps: WorkflowStep[] }>(res);
        steps = data.steps || [];
      }
    } catch {
      // Ignore errors, just show preview without steps
    }
  }

  // Render preview content
  const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;
  const typeLabel = WORKFLOW_TYPE_LABELS[workflowType] || workflowType;

  workflowPreviewModal.body.innerHTML = `
    <div class="workflow-preview">
      <div class="preview-section">
        <h4>Workflow Configuration</h4>
        <div class="preview-info-grid">
          <div class="preview-info-item">
            <span class="preview-label">Name</span>
            <span class="preview-value">${escapeHtml(name)}</span>
          </div>
          <div class="preview-info-item">
            <span class="preview-label">Description</span>
            <span class="preview-value">${escapeHtml(description)}</span>
          </div>
          <div class="preview-info-item">
            <span class="preview-label">Entity Type</span>
            <span class="preview-value">${entityLabel}</span>
          </div>
          <div class="preview-info-item">
            <span class="preview-label">Workflow Type</span>
            <span class="preview-value">${typeLabel}</span>
          </div>
          <div class="preview-info-item">
            <span class="preview-label">Default</span>
            <span class="preview-value">${isDefault ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      <hr class="modal-divider" />

      <div class="preview-section">
        <h4>Workflow Type Behavior</h4>
        <div class="preview-behavior">
          ${renderWorkflowTypeBehavior(workflowType)}
        </div>
      </div>

      <hr class="modal-divider" />

      <div class="preview-section">
        <h4>Approval Steps (${steps.length})</h4>
        ${steps.length > 0 ? renderPreviewSteps(steps, workflowType) : `
          <div class="empty-message">
            ${workflowId ? 'No steps configured yet. Add steps after saving.' : 'Save the workflow first, then add approval steps.'}
          </div>
        `}
      </div>

      ${steps.length > 0 ? `
        <hr class="modal-divider" />

        <div class="preview-section">
          <h4>Simulation</h4>
          <div class="preview-simulation">
            <p>When a <strong>${entityLabel}</strong> enters this workflow:</p>
            <ol class="simulation-steps">
              ${renderSimulationSteps(steps, workflowType)}
            </ol>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderWorkflowTypeBehavior(workflowType: WorkflowType): string {
  switch (workflowType) {
  case 'sequential':
    return `
        <div class="behavior-card">
          <div class="behavior-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <div class="behavior-content">
            <strong>Sequential</strong>
            <p>Approvers must approve in order. Each step waits for the previous to complete.</p>
          </div>
        </div>
      `;
  case 'parallel':
    return `
        <div class="behavior-card">
          <div class="behavior-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </div>
          <div class="behavior-content">
            <strong>Parallel</strong>
            <p>All approvers are notified at once. All must approve for the workflow to complete.</p>
          </div>
        </div>
      `;
  case 'any_one':
    return `
        <div class="behavior-card">
          <div class="behavior-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="behavior-content">
            <strong>Any One</strong>
            <p>All approvers are notified. Only one approval is required to complete the workflow.</p>
          </div>
        </div>
      `;
  default:
    return '';
  }
}

function renderPreviewSteps(steps: WorkflowStep[], workflowType: WorkflowType): string {
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

  return `
    <div class="preview-steps-list ${workflowType === 'sequential' ? 'sequential' : 'parallel'}">
      ${sortedSteps.map((step, index) => `
        <div class="preview-step-item">
          <div class="preview-step-order">${step.step_order}</div>
          <div class="preview-step-content">
            <div class="preview-step-approver">
              <span class="approver-type">${step.approver_type}</span>:
              <span class="approver-value">${escapeHtml(step.approver_value)}</span>
              ${step.is_optional ? '<span class="optional-badge">Optional</span>' : ''}
            </div>
            ${step.auto_approve_after_hours ? `
              <div class="preview-step-auto">
                Auto-approves after ${step.auto_approve_after_hours} hours
              </div>
            ` : ''}
          </div>
          ${workflowType === 'sequential' && index < sortedSteps.length - 1 ? `
            <div class="step-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderSimulationSteps(steps: WorkflowStep[], workflowType: WorkflowType): string {
  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);

  if (workflowType === 'sequential') {
    return sortedSteps.map((step, index) => `
      <li>
        ${index === 0 ? 'First, ' : 'Then, '}
        <strong>${step.approver_value}</strong> (${step.approver_type}) receives approval request
        ${step.is_optional ? ' (optional)' : ''}
        ${step.auto_approve_after_hours ? `, auto-approves after ${step.auto_approve_after_hours}h if no response` : ''}
      </li>
    `).join('');
  } else if (workflowType === 'parallel') {
    return `
      <li>All approvers receive requests simultaneously:
        <ul>
          ${sortedSteps.map(step => `
            <li><strong>${step.approver_value}</strong> (${step.approver_type})${step.is_optional ? ' (optional)' : ''}</li>
          `).join('')}
        </ul>
      </li>
      <li>Workflow completes when <strong>all</strong> required approvers approve</li>
    `;
  }
  return `
      <li>All approvers receive requests simultaneously:
        <ul>
          ${sortedSteps.map(step => `
            <li><strong>${step.approver_value}</strong> (${step.approver_type})</li>
          `).join('')}
        </ul>
      </li>
      <li>Workflow completes when <strong>any one</strong> approver approves</li>
    `;

}

async function deleteWorkflow(id: number, name: string): Promise<void> {
  const confirmed = await confirmDanger(
    `Are you sure you want to delete "${name}"? This cannot be undone.`,
    'Delete',
    'Delete Workflow'
  );

  if (!confirmed) return;

  try {
    const res = await apiDelete(`${APPROVALS_API}/workflows/${id}`);
    if (!res.ok) throw new Error('Failed to delete workflow');

    showToast('Workflow deleted', 'success');
    await loadApprovalWorkflows();
  } catch (error) {
    console.error('[AdminWorkflows] Delete error:', error);
    showToast('Error deleting workflow', 'error');
  }
}

// ============================================
// WORKFLOW STEPS MODAL
// ============================================

async function openStepsModal(workflowId: number): Promise<void> {
  const workflow = cachedWorkflows.find(w => w.id === workflowId);
  if (!workflow) return;

  // Fetch workflow with steps
  try {
    const res = await apiFetch(`${APPROVALS_API}/workflows/${workflowId}`);
    if (!res.ok) throw new Error('Failed to load workflow');

    const data = await parseJsonResponse<{ workflow: WorkflowDefinition; steps: WorkflowStep[] }>(res);

    // Create modal if not exists
    if (!stepModal) {
      stepModal = createPortalModal({
        id: 'steps-modal',
        titleId: 'steps-modal-title',
        title: 'Approval Steps',
        contentClassName: 'modal-content-wide',
        onClose: () => stepModal?.hide()
      });

      stepModal.footer.innerHTML = `
        <button type="button" class="btn btn-secondary" id="steps-close-btn">CLOSE</button>
      `;

      el('steps-close-btn')?.addEventListener('click', () => stepModal?.hide());
    }

    stepModal.setTitle(`Approval Steps: ${escapeHtml(workflow.name)}`);

    // Render steps
    const steps = data.steps || [];
    stepModal.body.innerHTML = `
      <div class="steps-list">
        ${steps.length === 0 ? '<p class="empty-message">No steps defined. Add steps below.</p>' : ''}
        ${steps.map((s, i) => `
          <div class="step-item" data-id="${s.id}">
            <div class="step-order">${i + 1}</div>
            <div class="step-details">
              <strong>${s.approver_type === 'user' ? 'User' : s.approver_type === 'role' ? 'Role' : 'Client'}:</strong>
              ${escapeHtml(s.approver_value)}
              ${s.is_optional ? getStatusDotHTML('pending', { label: 'Optional' }) : ''}
              ${s.auto_approve_after_hours ? `<span class="step-auto">Auto-approve after ${s.auto_approve_after_hours}h</span>` : ''}
            </div>
            <button type="button" class="icon-btn icon-btn-danger step-delete" data-id="${s.id}" title="Remove step">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      <hr class="modal-divider" />
      <h4>Add New Step</h4>
      <form id="add-step-form" class="add-step-form">
        <input type="hidden" id="step-workflow-id" value="${workflowId}" />
        <div class="form-row">
          <div class="form-group">
            <label for="step-approver-type">Approver Type</label>
            <select id="step-approver-type" class="form-input" required>
              <option value="user">User (Email)</option>
              <option value="role">Role</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div class="form-group">
            <label for="step-approver-value">Approver</label>
            <input type="text" id="step-approver-value" class="form-input" required placeholder="email@example.com or role name" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group form-group-inline">
            <label>
              <input type="checkbox" id="step-optional" />
              Optional step
            </label>
          </div>
          <div class="form-group">
            <label for="step-auto-hours">Auto-approve after (hours)</label>
            <input type="number" id="step-auto-hours" class="form-input" min="0" placeholder="Leave empty to disable" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-sm">ADD STEP</button>
      </form>
    `;

    // Handle step deletion
    stepModal.body.querySelectorAll('.step-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const stepId = parseInt((btn as HTMLElement).dataset.id || '0', 10);
        if (stepId) {
          await deleteStep(workflowId, stepId);
        }
      });
    });

    // Handle add step form
    el('add-step-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addStep(workflowId);
    });

    stepModal.show();
    manageFocusTrap(stepModal.overlay);
  } catch (error) {
    console.error('[AdminWorkflows] Error loading steps:', error);
    showToast('Error loading workflow steps', 'error');
  }
}

async function addStep(workflowId: number): Promise<void> {
  const payload = {
    step_order: 999, // Will be normalized server-side
    approver_type: (el('step-approver-type') as HTMLSelectElement).value,
    approver_value: (el('step-approver-value') as HTMLInputElement).value.trim(),
    is_optional: (el('step-optional') as HTMLInputElement).checked,
    auto_approve_after_hours: parseInt((el('step-auto-hours') as HTMLInputElement).value, 10) || null
  };

  try {
    const res = await apiPost(`${APPROVALS_API}/workflows/${workflowId}/steps`, payload);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to add step');
    }

    showToast('Step added', 'success');
    await openStepsModal(workflowId); // Refresh
  } catch (error) {
    console.error('[AdminWorkflows] Add step error:', error);
    showToast(error instanceof Error ? error.message : 'Error adding step', 'error');
  }
}

async function deleteStep(workflowId: number, stepId: number): Promise<void> {
  try {
    const res = await apiDelete(`${APPROVALS_API}/workflows/${workflowId}/steps/${stepId}`);
    if (!res.ok) throw new Error('Failed to delete step');

    showToast('Step removed', 'success');
    await openStepsModal(workflowId); // Refresh
  } catch (error) {
    console.error('[AdminWorkflows] Delete step error:', error);
    showToast('Error removing step', 'error');
  }
}

// ============================================
// TRIGGERS
// ============================================

async function loadTriggers(): Promise<void> {
  const tbody = el('triggers-table-body');
  if (!tbody) return;

  showTableLoading(tbody, 6, 'Loading triggers...');

  try {
    // Load triggers and options in parallel
    const [triggersRes, optionsRes] = await Promise.all([
      apiFetch(TRIGGERS_API),
      apiFetch(`${TRIGGERS_API}/options`)
    ]);

    if (!triggersRes.ok) throw new Error('Failed to load triggers');

    const triggersData = await parseJsonResponse<{ triggers: WorkflowTrigger[] }>(triggersRes);
    cachedTriggers = triggersData.triggers || [];

    if (optionsRes.ok) {
      triggerOptions = await parseJsonResponse<TriggerOptions>(optionsRes);
    }

    renderTriggersTable();
    setupTriggerHandlers();
  } catch (error) {
    console.error('[AdminWorkflows] Error loading triggers:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Error loading triggers</td></tr>';
    }
  }
}

function renderTriggersTable(): void {
  const tbody = el('triggers-table-body');
  if (!tbody) return;

  if (cachedTriggers.length === 0) {
    showTableEmpty(tbody, 6, 'No triggers defined yet.');
    return;
  }

  tbody.innerHTML = cachedTriggers.map(t => {
    const actionLabel = ACTION_TYPE_LABELS[t.action_type] || t.action_type;
    const statusBadge = getStatusDotHTML(t.is_active ? 'active' : 'inactive');

    return `
      <tr data-id="${t.id}">
        <td class="name-cell">${escapeHtml(t.name)}</td>
        <td class="type-cell"><code>${escapeHtml(t.event_type)}</code></td>
        <td class="type-cell">${actionLabel}</td>
        <td class="status-cell">
          ${statusBadge}
          <span class="date-stacked">${formatDate(t.updated_at)}</span>
        </td>
        <td class="date-cell">${formatDate(t.updated_at)}</td>
        <td class="actions-cell">
          <div class="table-actions">
            <button type="button" class="icon-btn trigger-toggle" data-id="${t.id}" title="${t.is_active ? 'Disable' : 'Enable'}" aria-label="${t.is_active ? 'Disable' : 'Enable'} trigger">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${t.is_active
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
}
              </svg>
            </button>
            <button type="button" class="icon-btn trigger-edit" data-id="${t.id}" title="Edit trigger" aria-label="Edit trigger">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn-danger trigger-delete" data-id="${t.id}" data-name="${escapeHtml(t.name)}" title="Delete" aria-label="Delete trigger">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupTriggerHandlers(): void {
  const tbody = el('triggers-table-body');
  if (!tbody || tbody.dataset.handlersAttached === 'true') return;
  tbody.dataset.handlersAttached = 'true';

  // Table row actions
  tbody.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;

    const id = parseInt(btn.dataset.id || '0', 10);
    if (!id) return;

    if (btn.classList.contains('trigger-toggle')) {
      await toggleTrigger(id);
    } else if (btn.classList.contains('trigger-edit')) {
      await openTriggerModal(id);
    } else if (btn.classList.contains('trigger-delete')) {
      const name = btn.dataset.name || 'this trigger';
      await deleteTrigger(id, name);
    }
  });

  // View logs button
  const viewLogsBtn = el('view-trigger-logs-btn');
  if (viewLogsBtn && !viewLogsBtn.dataset.bound) {
    viewLogsBtn.dataset.bound = 'true';
    viewLogsBtn.addEventListener('click', () => openTriggerLogsModal());
  }

  // Create button
  const createBtn = el('create-trigger-btn');
  if (createBtn && !createBtn.dataset.bound) {
    createBtn.dataset.bound = 'true';
    createBtn.addEventListener('click', () => openTriggerModal());
  }

  // Refresh button
  const refreshBtn = el('triggers-refresh');
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = 'true';
    refreshBtn.addEventListener('click', () => loadTriggers());
  }
}

async function openTriggerModal(id?: number): Promise<void> {
  const isEdit = !!id;
  let trigger: WorkflowTrigger | null = null;

  if (isEdit) {
    trigger = cachedTriggers.find(t => t.id === id) || null;
    if (!trigger) return;
  }

  // Create modal if not exists
  if (!triggerModal) {
    triggerModal = createPortalModal({
      id: 'trigger-modal',
      titleId: 'trigger-modal-title',
      title: 'Create Trigger',
      contentClassName: 'modal-content-wide',
      onClose: () => triggerModal?.hide()
    });

    const eventOptions = triggerOptions?.eventTypes?.map(e => `<option value="${e}">${e}</option>`).join('') || '';
    const actionOptions = triggerOptions?.actionTypes?.map(a => `<option value="${a.type}">${a.description}</option>`).join('') || '';

    triggerModal.body.innerHTML = `
      <form id="trigger-form" class="modal-form">
        <input type="hidden" id="trigger-id" />
        <div class="form-group">
          <label for="trigger-name">Name *</label>
          <input type="text" id="trigger-name" class="form-input" required maxlength="100" />
        </div>
        <div class="form-group">
          <label for="trigger-description">Description</label>
          <textarea id="trigger-description" class="form-input" rows="2"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="trigger-event-type">Event Type *</label>
            <select id="trigger-event-type" class="form-input" required>
              ${eventOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="trigger-action-type">Action Type *</label>
            <select id="trigger-action-type" class="form-input" required>
              ${actionOptions}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="trigger-action-config">Action Configuration (JSON)</label>
          <textarea id="trigger-action-config" class="form-input code-input" rows="4" placeholder='{"template": "welcome", "to": "client"}'></textarea>
        </div>
        <div class="form-group">
          <label for="trigger-conditions">Conditions (JSON, optional)</label>
          <textarea id="trigger-conditions" class="form-input code-input" rows="2" placeholder='{"status": "active"}'></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="trigger-priority">Priority</label>
            <input type="number" id="trigger-priority" class="form-input" value="0" min="0" />
          </div>
          <div class="form-group form-group-inline">
            <label>
              <input type="checkbox" id="trigger-active" checked />
              Active
            </label>
          </div>
        </div>
      </form>
    `;

    triggerModal.footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="trigger-cancel-btn">CANCEL</button>
      <button type="button" class="btn btn-outline" id="trigger-test-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        TEST
      </button>
      <button type="submit" form="trigger-form" class="btn btn-primary">SAVE</button>
    `;

    // Cancel button
    el('trigger-cancel-btn')?.addEventListener('click', () => triggerModal?.hide());

    // Test button
    el('trigger-test-btn')?.addEventListener('click', async () => {
      await testTrigger();
    });

    // Form submit
    el('trigger-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveTrigger();
    });
  }

  // Set title and populate form
  triggerModal.setTitle(isEdit ? 'Edit Trigger' : 'Create Trigger');

  (el('trigger-id') as HTMLInputElement).value = trigger?.id?.toString() || '';
  (el('trigger-name') as HTMLInputElement).value = trigger?.name || '';
  (el('trigger-description') as HTMLTextAreaElement).value = trigger?.description || '';
  (el('trigger-event-type') as HTMLSelectElement).value = trigger?.event_type || '';
  (el('trigger-action-type') as HTMLSelectElement).value = trigger?.action_type || '';
  (el('trigger-action-config') as HTMLTextAreaElement).value = trigger?.action_config ? JSON.stringify(trigger.action_config, null, 2) : '';
  (el('trigger-conditions') as HTMLTextAreaElement).value = trigger?.conditions ? JSON.stringify(trigger.conditions, null, 2) : '';
  (el('trigger-priority') as HTMLInputElement).value = (trigger?.priority ?? 0).toString();
  (el('trigger-active') as HTMLInputElement).checked = trigger?.is_active ?? true;

  triggerModal.show();
  manageFocusTrap(triggerModal.overlay);
}

async function saveTrigger(): Promise<void> {
  const id = (el('trigger-id') as HTMLInputElement).value;
  const isEdit = !!id;

  // Parse JSON fields
  let actionConfig: Record<string, unknown> = {};
  let conditions: Record<string, unknown> | null = null;

  try {
    const configStr = (el('trigger-action-config') as HTMLTextAreaElement).value.trim();
    if (configStr) {
      actionConfig = JSON.parse(configStr);
    }

    const conditionsStr = (el('trigger-conditions') as HTMLTextAreaElement).value.trim();
    if (conditionsStr) {
      conditions = JSON.parse(conditionsStr);
    }
  } catch {
    showToast('Invalid JSON in configuration or conditions', 'error');
    return;
  }

  const payload = {
    name: (el('trigger-name') as HTMLInputElement).value.trim(),
    description: (el('trigger-description') as HTMLTextAreaElement).value.trim() || null,
    event_type: (el('trigger-event-type') as HTMLSelectElement).value,
    action_type: (el('trigger-action-type') as HTMLSelectElement).value,
    action_config: actionConfig,
    conditions,
    priority: parseInt((el('trigger-priority') as HTMLInputElement).value, 10) || 0,
    is_active: (el('trigger-active') as HTMLInputElement).checked
  };

  try {
    const res = isEdit
      ? await apiPut(`${TRIGGERS_API}/${id}`, payload)
      : await apiPost(TRIGGERS_API, payload);

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save trigger');
    }

    showToast(isEdit ? 'Trigger updated' : 'Trigger created', 'success');
    triggerModal?.hide();
    await loadTriggers();
  } catch (error) {
    console.error('[AdminWorkflows] Save trigger error:', error);
    showToast(error instanceof Error ? error.message : 'Error saving trigger', 'error');
  }
}

async function testTrigger(): Promise<void> {
  const eventType = (el('trigger-event-type') as HTMLSelectElement)?.value;

  if (!eventType) {
    showToast('Please select an event type first', 'warning');
    return;
  }

  // Validate JSON fields first
  let actionConfig: Record<string, unknown> = {};
  let conditions: Record<string, unknown> | null = null;

  try {
    const configStr = (el('trigger-action-config') as HTMLTextAreaElement).value.trim();
    if (configStr) {
      actionConfig = JSON.parse(configStr);
    }

    const conditionsStr = (el('trigger-conditions') as HTMLTextAreaElement).value.trim();
    if (conditionsStr) {
      conditions = JSON.parse(conditionsStr);
    }
  } catch {
    showToast('Invalid JSON in configuration or conditions', 'error');
    return;
  }

  const testBtn = el('trigger-test-btn') as HTMLButtonElement;
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      Testing...
    `;
  }

  try {
    // Generate test context based on event type
    const context = generateTestContext(eventType, conditions, actionConfig);

    const res = await apiPost(`${TRIGGERS_API}/test-emit`, {
      event_type: eventType,
      context
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Test failed');
    }

    showToast(`Test event "${eventType}" emitted successfully. Check execution logs.`, 'success');

    // If logs modal is available, refresh it
    if (triggerLogsModal) {
      await loadTriggerLogs();
    }
  } catch (error) {
    console.error('[AdminWorkflows] Test trigger error:', error);
    showToast(error instanceof Error ? error.message : 'Error testing trigger', 'error');
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        TEST
      `;
    }
  }
}

/**
 * Generate sample context data for testing triggers
 */
function generateTestContext(eventType: string, conditions: Record<string, unknown> | null, _actionConfig: Record<string, unknown>): Record<string, unknown> {
  // Base context that applies to all events
  const base: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    triggeredBy: 'admin@test.com'
  };

  // Parse the entity type from event (e.g., 'invoice.created' -> 'invoice')
  const [entityType] = eventType.split('.');

  // Generate entity-specific test data
  switch (entityType) {
  case 'invoice':
    return {
      ...base,
      entityId: 1,
      invoice: {
        id: 1,
        number: 'INV-TEST-001',
        amount: 1000,
        status: conditions?.status || 'draft',
        client_name: 'Test Client',
        client_email: 'client@test.com'
      }
    };
  case 'contract':
    return {
      ...base,
      entityId: 1,
      contract: {
        id: 1,
        name: 'Test Contract',
        status: conditions?.status || 'draft'
      },
      project: {
        id: 1,
        name: 'Test Project'
      },
      client: {
        id: 1,
        name: 'Test Client',
        email: 'client@test.com'
      }
    };
  case 'project':
    return {
      ...base,
      entityId: 1,
      project: {
        id: 1,
        name: 'Test Project',
        status: conditions?.status || 'active',
        type: 'website'
      },
      client: {
        id: 1,
        name: 'Test Client',
        email: 'client@test.com'
      }
    };
  case 'client':
    return {
      ...base,
      entityId: 1,
      client: {
        id: 1,
        name: 'Test Client',
        email: 'client@test.com',
        company: 'Test Company'
      }
    };
  case 'message':
    return {
      ...base,
      entityId: 1,
      message: {
        id: 1,
        preview: 'This is a test message preview...',
        sender: 'admin@test.com'
      }
    };
  default:
    return base;
  }
}

async function toggleTrigger(id: number): Promise<void> {
  try {
    const res = await apiPost(`${TRIGGERS_API}/${id}/toggle`, {});
    if (!res.ok) throw new Error('Failed to toggle trigger');

    const data = await parseJsonResponse<{ trigger: WorkflowTrigger }>(res);
    showToast(`Trigger ${data.trigger.is_active ? 'enabled' : 'disabled'}`, 'success');
    await loadTriggers();
  } catch (error) {
    console.error('[AdminWorkflows] Toggle error:', error);
    showToast('Error toggling trigger', 'error');
  }
}

async function deleteTrigger(id: number, name: string): Promise<void> {
  const confirmed = await confirmDanger(
    `Are you sure you want to delete "${name}"? This cannot be undone.`,
    'Delete',
    'Delete Trigger'
  );

  if (!confirmed) return;

  try {
    const res = await apiDelete(`${TRIGGERS_API}/${id}`);
    if (!res.ok) throw new Error('Failed to delete trigger');

    showToast('Trigger deleted', 'success');
    await loadTriggers();
  } catch (error) {
    console.error('[AdminWorkflows] Delete trigger error:', error);
    showToast('Error deleting trigger', 'error');
  }
}

// ============================================
// TRIGGER EXECUTION LOGS
// ============================================

async function openTriggerLogsModal(triggerId?: number): Promise<void> {
  // Create modal if needed
  if (!triggerLogsModal) {
    triggerLogsModal = createPortalModal({
      id: 'trigger-logs-modal',
      titleId: 'trigger-logs-modal-title',
      title: 'Trigger Execution Logs',
      contentClassName: 'trigger-logs-modal-content modal-content-wide',
      onClose: () => triggerLogsModal?.hide()
    });

    triggerLogsModal.body.innerHTML = `
        <div class="trigger-logs-controls">
          <div class="form-group">
            <label for="logs-trigger-filter">Filter by Trigger</label>
            <select id="logs-trigger-filter" class="portal-input">
              <option value="">All Triggers</option>
            </select>
          </div>
          <div class="form-group">
            <label for="logs-result-filter">Result</label>
            <select id="logs-result-filter" class="portal-input">
              <option value="">All Results</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
          <button type="button" class="btn btn-sm btn-secondary" id="logs-refresh-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            Refresh
          </button>
        </div>
        <div class="trigger-logs-list" id="trigger-logs-list">
          <div class="loading-message">Loading logs...</div>
        </div>
      `;

    // Set up filter handlers
    const triggerFilter = el('logs-trigger-filter');
    const resultFilter = el('logs-result-filter');
    const refreshBtn = el('logs-refresh-btn');

    if (triggerFilter) {
      triggerFilter.addEventListener('change', () => loadTriggerLogs());
    }
    if (resultFilter) {
      resultFilter.addEventListener('change', () => loadTriggerLogs());
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadTriggerLogs());
    }
  }

  // Populate trigger filter dropdown
  const triggerSelect = el('logs-trigger-filter') as HTMLSelectElement;
  if (triggerSelect) {
    triggerSelect.innerHTML = '<option value="">All Triggers</option>';
    for (const trigger of cachedTriggers) {
      const option = document.createElement('option');
      option.value = trigger.id.toString();
      option.textContent = trigger.name;
      triggerSelect.appendChild(option);
    }
    if (triggerId) {
      triggerSelect.value = triggerId.toString();
    }
  }

  triggerLogsModal.show();
  manageFocusTrap(triggerLogsModal.overlay);
  await loadTriggerLogs();
}

async function loadTriggerLogs(): Promise<void> {
  const listEl = el('trigger-logs-list');
  if (!listEl) return;

  listEl.innerHTML = '<div class="loading-message">Loading logs...</div>';

  try {
    const triggerFilter = (el('logs-trigger-filter') as HTMLSelectElement)?.value || '';
    const resultFilter = (el('logs-result-filter') as HTMLSelectElement)?.value || '';

    let url = `${TRIGGERS_API}/logs/executions?limit=100`;
    if (triggerFilter) {
      url += `&triggerId=${triggerFilter}`;
    }

    const res = await apiFetch(url);
    if (!res.ok) throw new Error('Failed to load logs');

    const data = await parseJsonResponse<{ logs: TriggerExecutionLog[] }>(res);
    let logs = data.logs || [];

    // Client-side filter by result if needed
    if (resultFilter) {
      logs = logs.filter(log => log.action_result === resultFilter);
    }

    renderTriggerLogs(logs);
  } catch (error) {
    console.error('[AdminWorkflows] Error loading trigger logs:', error);
    if (listEl) {
      listEl.innerHTML = '<div class="empty-message">Error loading logs</div>';
    }
  }
}

function renderTriggerLogs(logs: TriggerExecutionLog[]): void {
  const listEl = el('trigger-logs-list');
  if (!listEl) return;

  if (logs.length === 0) {
    listEl.innerHTML = '<div class="empty-message">No execution logs found</div>';
    return;
  }

  const getResultBadgeClass = (result: string): string => {
    switch (result) {
    case 'success': return 'status-badge--success';
    case 'failed': return 'status-badge--danger';
    case 'skipped': return 'status-badge--muted';
    default: return '';
    }
  };

  const getResultIcon = (result: string): string => {
    switch (result) {
    case 'success':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    case 'failed':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    case 'skipped':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
    default:
      return '';
    }
  };

  listEl.innerHTML = logs.map(log => `
    <div class="trigger-log-entry trigger-log-entry--${log.action_result}">
      <div class="trigger-log-header">
        <div class="trigger-log-title">
          <span class="trigger-log-name">${escapeHtml(log.trigger_name)}</span>
          <span class="status-badge ${getResultBadgeClass(log.action_result)}">
            ${getResultIcon(log.action_result)}
            ${log.action_result}
          </span>
        </div>
        <div class="trigger-log-meta">
          <span class="trigger-log-time">${formatDate(log.created_at, 'datetime')}</span>
          <span class="trigger-log-duration">${log.execution_time_ms}ms</span>
        </div>
      </div>
      <div class="trigger-log-details">
        <div class="trigger-log-event">
          <code>${escapeHtml(log.event_type)}</code>
        </div>
        ${log.error_message ? `
          <div class="trigger-log-error">
            <strong>Error:</strong> ${escapeHtml(log.error_message)}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// ============================================
// PENDING APPROVALS DASHBOARD
// ============================================

async function loadPendingApprovals(): Promise<void> {
  const tbody = el('pending-approvals-table-body');
  if (!tbody) return;

  showTableLoading(tbody, 6, 'Loading pending approvals...');

  try {
    const res = await apiFetch(`${APPROVALS_API}/active`);
    if (!res.ok) throw new Error('Failed to load pending approvals');

    const data = await parseJsonResponse<{ workflows: ApprovalInstance[] }>(res);
    cachedApprovalInstances = data.workflows || [];

    updateApprovalStats();
    renderPendingApprovalsTable();
  } catch (error) {
    console.error('[AdminWorkflows] Error loading pending approvals:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-row">Error loading approvals</td></tr>';
    }
  }
}

function updateApprovalStats(): void {
  const totalEl = el('approvals-total');
  const proposalsEl = el('approvals-proposals');
  const urgentEl = el('approvals-urgent');

  const total = cachedApprovalInstances.length;
  const proposals = cachedApprovalInstances.filter(a => a.entity_type === 'proposal').length;

  // Urgent = older than 24 hours
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const urgent = cachedApprovalInstances.filter(a => {
    const initiated = new Date(a.initiated_at).getTime();
    return initiated < dayAgo;
  }).length;

  if (totalEl) totalEl.textContent = total.toString();
  if (proposalsEl) proposalsEl.textContent = proposals.toString();
  if (urgentEl) urgentEl.textContent = urgent.toString();
}

function filterApprovalInstances(): ApprovalInstance[] {
  if (currentApprovalFilter === 'all') {
    return cachedApprovalInstances;
  }

  if (currentApprovalFilter === 'proposals') {
    return cachedApprovalInstances.filter(a => a.entity_type === 'proposal');
  }

  if (currentApprovalFilter === 'urgent') {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return cachedApprovalInstances.filter(a => {
      const initiated = new Date(a.initiated_at).getTime();
      return initiated < dayAgo;
    });
  }

  return cachedApprovalInstances;
}

function renderPendingApprovalsTable(): void {
  const tbody = el('pending-approvals-table-body');
  if (!tbody) return;

  const filtered = filterApprovalInstances();

  // Clear selection when re-rendering
  selectedApprovalIds.clear();
  updateBulkToolbar();

  if (filtered.length === 0) {
    const message = currentApprovalFilter === 'all'
      ? 'No pending approvals.'
      : `No ${currentApprovalFilter} approvals found.`;
    showTableEmpty(tbody, 7, message);
    // Uncheck select-all
    const selectAll = el('approvals-select-all') as HTMLInputElement;
    if (selectAll) selectAll.checked = false;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    const entityLabel = ENTITY_TYPE_LABELS[a.entity_type] || a.entity_type;
    const statusClass = a.status === 'in_progress' ? 'warning' : 'pending';
    const statusLabel = a.status === 'in_progress' ? 'In Progress' : 'Pending';
    const statusBadge = getStatusDotHTML(statusClass as 'pending' | 'warning', { label: statusLabel });

    // Check if urgent (older than 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const initiated = new Date(a.initiated_at).getTime();
    const isUrgent = initiated < dayAgo;
    const urgentBadge = isUrgent
      ? '<span class="urgent-badge" title="Waiting more than 24 hours">!</span>'
      : '';

    return `
      <tr data-id="${a.id}">
        <td class="checkbox-cell">
          ${getPortalCheckboxHTML({
    ariaLabel: `Select approval ${a.id}`,
    inputClassName: 'approval-checkbox',
    dataAttributes: { id: a.id }
  })}
        </td>
        <td class="name-cell">
          ${escapeHtml(a.workflow_name)}${urgentBadge}
          <span class="type-stacked">${entityLabel} #${a.entity_id}</span>
        </td>
        <td class="type-cell entity-type-cell">${entityLabel}</td>
        <td class="type-cell">#${a.entity_id}</td>
        <td class="status-cell">
          ${statusBadge}
          <span class="date-stacked">Step ${a.current_step}</span>
        </td>
        <td class="date-cell">${formatDate(a.initiated_at)}</td>
        <td class="actions-cell">
          <div class="table-actions">
            <button type="button" class="icon-btn approval-history" data-entity-type="${a.entity_type}" data-entity-id="${a.entity_id}" title="View History" aria-label="View approval history">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </button>
            <button type="button" class="icon-btn approval-view" data-id="${a.id}" data-entity-type="${a.entity_type}" data-entity-id="${a.entity_id}" title="View ${entityLabel}" aria-label="View ${entityLabel}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn-success approval-approve" data-id="${a.id}" title="Approve" aria-label="Approve">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn-danger approval-reject" data-id="${a.id}" title="Reject" aria-label="Reject">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Reset select-all checkbox
  const selectAll = el('approvals-select-all') as HTMLInputElement;
  if (selectAll) selectAll.checked = false;
}

function setupPendingApprovalsHandlers(): void {
  const section = el('pending-approvals-section');
  if (!section || section.dataset.handlersAttached === 'true') return;
  section.dataset.handlersAttached = 'true';

  // Filter stat cards
  section.querySelectorAll('[data-approval-filter]').forEach(card => {
    card.addEventListener('click', () => {
      const filter = (card as HTMLElement).dataset.approvalFilter as 'all' | 'proposals' | 'urgent';
      if (filter === currentApprovalFilter) return;

      // Update active state
      section.querySelectorAll('[data-approval-filter]').forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      currentApprovalFilter = filter;
      renderPendingApprovalsTable();
    });
  });

  // Refresh button
  const refreshBtn = el('approvals-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadPendingApprovals());
  }

  // Select-all checkbox
  const selectAll = el('approvals-select-all') as HTMLInputElement;
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('.approval-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        const id = parseInt(cb.dataset.id || '0', 10);
        if (id) {
          if (selectAll.checked) {
            selectedApprovalIds.add(id);
          } else {
            selectedApprovalIds.delete(id);
          }
        }
      });
      updateBulkToolbar();
    });
  }

  // Bulk action buttons
  const bulkApproveBtn = el('bulk-approve-btn');
  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener('click', () => handleBulkAction('approve'));
  }

  const bulkRejectBtn = el('bulk-reject-btn');
  if (bulkRejectBtn) {
    bulkRejectBtn.addEventListener('click', () => handleBulkAction('reject'));
  }

  const bulkClearBtn = el('bulk-clear-btn');
  if (bulkClearBtn) {
    bulkClearBtn.addEventListener('click', () => {
      selectedApprovalIds.clear();
      const checkboxes = document.querySelectorAll('.approval-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => cb.checked = false);
      const selectAllCb = el('approvals-select-all') as HTMLInputElement;
      if (selectAllCb) selectAllCb.checked = false;
      updateBulkToolbar();
    });
  }

  // Table actions (delegated)
  const tbody = el('pending-approvals-table-body');
  if (tbody) {
    // Handle checkbox changes
    tbody.addEventListener('change', (e) => {
      const checkbox = e.target as HTMLInputElement;
      if (!checkbox.classList.contains('approval-checkbox')) return;

      const id = parseInt(checkbox.dataset.id || '0', 10);
      if (!id) return;

      if (checkbox.checked) {
        selectedApprovalIds.add(id);
      } else {
        selectedApprovalIds.delete(id);
      }
      updateBulkToolbar();
      updateSelectAllState();
    });

    // Handle button clicks
    tbody.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;

      if (btn.classList.contains('approval-history')) {
        const entityType = btn.dataset.entityType as EntityType;
        const entityId = btn.dataset.entityId;
        if (entityType && entityId) {
          await openApprovalHistoryModal(entityType, entityId);
        }
        return;
      }

      const id = parseInt(btn.dataset.id || '0', 10);
      if (!id) return;

      if (btn.classList.contains('approval-view')) {
        const entityType = btn.dataset.entityType as EntityType;
        const entityId = btn.dataset.entityId;
        navigateToEntity(entityType, entityId || '');
      } else if (btn.classList.contains('approval-approve')) {
        await handleApprovalAction(id, 'approve');
      } else if (btn.classList.contains('approval-reject')) {
        await handleApprovalAction(id, 'reject');
      }
    });
  }
}

function updateBulkToolbar(): void {
  const toolbar = el('approvals-bulk-toolbar');
  const countEl = el('approvals-selected-count');

  if (!toolbar) return;

  const count = selectedApprovalIds.size;

  if (count > 0) {
    toolbar.classList.remove('hidden');
    if (countEl) countEl.textContent = count.toString();
  } else {
    toolbar.classList.add('hidden');
  }
}

function updateSelectAllState(): void {
  const selectAll = el('approvals-select-all') as HTMLInputElement;
  if (!selectAll) return;

  const checkboxes = document.querySelectorAll('.approval-checkbox') as NodeListOf<HTMLInputElement>;
  const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
  const someChecked = Array.from(checkboxes).some(cb => cb.checked);

  selectAll.checked = allChecked;
  selectAll.indeterminate = someChecked && !allChecked;
}

async function handleBulkAction(action: 'approve' | 'reject'): Promise<void> {
  const ids = Array.from(selectedApprovalIds);
  if (ids.length === 0) return;

  const actionLabel = action === 'approve' ? 'approve' : 'reject';
  const actionPast = action === 'approve' ? 'approved' : 'rejected';

  if (action === 'reject') {
    const confirmed = await confirmDanger(
      `Are you sure you want to reject ${ids.length} approval(s)? This cannot be undone.`,
      'Reject All',
      'Bulk Reject'
    );
    if (!confirmed) return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const id of ids) {
    try {
      const res = await apiPost(`${APPROVALS_API}/instances/${id}/${action}`, {
        comment: `Bulk ${actionPast} by admin`
      });

      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch {
      failCount++;
    }
  }

  if (successCount > 0) {
    showToast(`${successCount} item(s) ${actionPast}`, 'success');
  }
  if (failCount > 0) {
    showToast(`${failCount} item(s) failed to ${actionLabel}`, 'error');
  }

  // Clear selection and reload
  selectedApprovalIds.clear();
  await loadPendingApprovals();
}

function navigateToEntity(entityType: EntityType, entityId: string): void {
  // Navigate to the appropriate tab/section based on entity type
  switch (entityType) {
  case 'proposal':
    // Switch to proposals tab and open the proposal
    window.dispatchEvent(new CustomEvent('admin:navigate-tab', { detail: { tab: 'proposals' } }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('admin:open-proposal', { detail: { id: entityId } }));
    }, 100);
    break;
  case 'contract':
    window.dispatchEvent(new CustomEvent('admin:navigate-tab', { detail: { tab: 'contracts' } }));
    break;
  case 'invoice':
    window.dispatchEvent(new CustomEvent('admin:navigate-tab', { detail: { tab: 'invoices' } }));
    break;
  case 'project':
    // Open project details page
    window.location.href = `/admin/project/${entityId}`;
    break;
  default:
    showToast(`Cannot navigate to ${entityType}`, 'warning');
  }
}

async function handleApprovalAction(instanceId: number, action: 'approve' | 'reject'): Promise<void> {
  const instance = cachedApprovalInstances.find(a => a.id === instanceId);
  if (!instance) return;

  const entityLabel = ENTITY_TYPE_LABELS[instance.entity_type] || instance.entity_type;
  const actionLabel = action === 'approve' ? 'approve' : 'reject';
  const actionPast = action === 'approve' ? 'approved' : 'rejected';

  if (action === 'reject') {
    const confirmed = await confirmDanger(
      `Are you sure you want to reject this ${entityLabel.toLowerCase()} approval?`,
      'Reject',
      'Reject Approval'
    );
    if (!confirmed) return;
  }

  try {
    const res = await apiPost(`${APPROVALS_API}/instances/${instanceId}/${action}`, {
      comment: action === 'approve' ? 'Approved by admin' : 'Rejected by admin'
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to ${actionLabel}`);
    }

    showToast(`${entityLabel} ${actionPast}`, 'success');
    await loadPendingApprovals();
  } catch (error) {
    console.error(`[AdminWorkflows] ${actionLabel} error:`, error);
    showToast(error instanceof Error ? error.message : `Error ${actionLabel}ing`, 'error');
  }
}

// ============================================
// APPROVAL HISTORY MODAL
// ============================================

interface ApprovalHistoryEntry {
  id: number;
  workflow_instance_id: number;
  action: string;
  actor_email: string;
  step_id: number | null;
  comment: string | null;
  created_at: string;
}

interface ApprovalRequest {
  id: number;
  workflow_instance_id: number;
  step_id: number;
  approver_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  decision_at: string | null;
  comment: string | null;
  created_at: string;
}

let historyModal: PortalModalInstance | null = null;

async function openApprovalHistoryModal(entityType: EntityType, entityId: string): Promise<void> {
  const entityLabel = ENTITY_TYPE_LABELS[entityType] || entityType;

  // Create modal if not exists
  if (!historyModal) {
    historyModal = createPortalModal({
      id: 'approval-history-modal',
      titleId: 'approval-history-modal-title',
      title: 'Approval History',
      contentClassName: 'modal-content-wide',
      onClose: () => historyModal?.hide()
    });

    historyModal.footer.innerHTML = `
      <button type="button" class="btn btn-secondary" id="history-modal-close">CLOSE</button>
    `;

    el('history-modal-close')?.addEventListener('click', () => historyModal?.hide());
  }

  historyModal.setTitle(`${entityLabel} #${entityId} - Approval History`);
  historyModal.body.innerHTML = '<div class="loading-row">Loading history...</div>';
  historyModal.show();
  manageFocusTrap(historyModal.overlay);

  try {
    const res = await apiFetch(`${APPROVALS_API}/entity/${entityType}/${entityId}`);
    if (!res.ok) throw new Error('Failed to load approval history');

    const data = await parseJsonResponse<{
      instance: ApprovalInstance | null;
      requests: ApprovalRequest[];
      history: ApprovalHistoryEntry[];
    }>(res);

    if (!data.instance) {
      historyModal.body.innerHTML = `
        <div class="empty-message">
          <p>No approval workflow found for this ${entityLabel.toLowerCase()}.</p>
        </div>
      `;
      return;
    }

    historyModal.body.innerHTML = renderApprovalHistoryContent(data.instance, data.requests, data.history);
  } catch (error) {
    console.error('[AdminWorkflows] Error loading history:', error);
    historyModal.body.innerHTML = '<div class="error-message">Error loading approval history.</div>';
  }
}

function renderApprovalHistoryContent(
  instance: ApprovalInstance,
  requests: ApprovalRequest[],
  history: ApprovalHistoryEntry[]
): string {
  const workflowTypeLabel = WORKFLOW_TYPE_LABELS[instance.workflow_type] || instance.workflow_type;

  // Instance status badge
  const statusClass = instance.status === 'pending' ? 'warning'
    : instance.status === 'in_progress' ? 'info'
      : instance.status === 'approved' ? 'success'
        : instance.status === 'rejected' ? 'danger'
          : 'muted';

  const instanceSection = `
    <div class="history-instance-info">
      <div class="history-info-row">
        <span class="history-label">Workflow:</span>
        <span class="history-value">${escapeHtml(instance.workflow_name)}</span>
      </div>
      <div class="history-info-row">
        <span class="history-label">Type:</span>
        <span class="history-value">${workflowTypeLabel}</span>
      </div>
      <div class="history-info-row">
        <span class="history-label">Status:</span>
        <span class="status-badge status-badge--${statusClass}">${instance.status.replace('_', ' ')}</span>
      </div>
      <div class="history-info-row">
        <span class="history-label">Started:</span>
        <span class="history-value">${formatDate(instance.initiated_at)}</span>
      </div>
      ${instance.completed_at ? `
        <div class="history-info-row">
          <span class="history-label">Completed:</span>
          <span class="history-value">${formatDate(instance.completed_at)}</span>
        </div>
      ` : ''}
    </div>
  `;

  // Requests section
  const requestsHtml = requests.length === 0 ? '<p class="empty-message">No approval requests.</p>' : `
    <div class="history-requests-list">
      ${requests.map(r => {
    const reqStatusClass = r.status === 'pending' ? 'warning'
      : r.status === 'approved' ? 'success'
        : r.status === 'rejected' ? 'danger'
          : 'muted';
    return `
          <div class="history-request-item">
            <div class="history-request-approver">
              <span class="approver-email">${escapeHtml(r.approver_email)}</span>
              <span class="status-badge status-badge--${reqStatusClass}">${r.status}</span>
            </div>
            ${r.decision_at ? `<div class="history-request-date">Decided: ${formatDate(r.decision_at)}</div>` : ''}
            ${r.comment ? `<div class="history-request-comment">"${escapeHtml(r.comment)}"</div>` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `;

  // History section
  const historyHtml = history.length === 0 ? '<p class="empty-message">No history entries.</p>' : `
    <div class="history-timeline">
      ${history.map(h => {
    const actionIcon = h.action === 'approved' ? '&#10003;'
      : h.action === 'rejected' ? '&#10007;'
        : h.action === 'initiated' ? '&#9658;'
          : '&#8226;';
    const actionClass = h.action === 'approved' ? 'success'
      : h.action === 'rejected' ? 'danger'
        : 'neutral';
    return `
          <div class="history-entry history-entry--${actionClass}">
            <div class="history-entry-icon">${actionIcon}</div>
            <div class="history-entry-content">
              <div class="history-entry-action">${escapeHtml(h.action)}</div>
              <div class="history-entry-meta">
                by ${escapeHtml(h.actor_email)} on ${formatDate(h.created_at)}
              </div>
              ${h.comment ? `<div class="history-entry-comment">"${escapeHtml(h.comment)}"</div>` : ''}
            </div>
          </div>
        `;
  }).join('')}
    </div>
  `;

  return `
    <div class="approval-history-modal-content">
      <section class="history-section">
        <h4>Workflow Details</h4>
        ${instanceSection}
      </section>
      <hr class="modal-divider" />
      <section class="history-section">
        <h4>Approval Requests</h4>
        ${requestsHtml}
      </section>
      <hr class="modal-divider" />
      <section class="history-section">
        <h4>Activity Timeline</h4>
        ${historyHtml}
      </section>
    </div>
  `;
}
