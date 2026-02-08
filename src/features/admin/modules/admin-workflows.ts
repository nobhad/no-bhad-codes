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
let currentSubtab: 'approvals' | 'triggers' = 'approvals';
let cachedWorkflows: WorkflowDefinition[] = [];
let cachedTriggers: WorkflowTrigger[] = [];
let triggerOptions: TriggerOptions | null = null;

// Modal instances
let workflowModal: PortalModalInstance | null = null;
let stepModal: PortalModalInstance | null = null;
let triggerModal: PortalModalInstance | null = null;

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

  // Load data for current subtab
  if (currentSubtab === 'approvals') {
    await loadApprovalWorkflows();
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

    const subtab = btn.dataset.subtab as 'approvals' | 'triggers';
    if (subtab === currentSubtab) return;

    // Update active state
    container.querySelectorAll('[data-subtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show/hide content
    el('workflows-approvals-content')?.classList.toggle('hidden', subtab !== 'approvals');
    el('workflows-triggers-content')?.classList.toggle('hidden', subtab !== 'triggers');

    currentSubtab = subtab;

    // Load data
    if (subtab === 'approvals') {
      await loadApprovalWorkflows();
    } else {
      await loadTriggers();
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
      <button type="submit" form="workflow-form" class="btn btn-primary">SAVE</button>
    `;

    // Cancel button
    el('workflow-cancel-btn')?.addEventListener('click', () => workflowModal?.hide());

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
      <button type="submit" form="trigger-form" class="btn btn-primary">SAVE</button>
    `;

    // Cancel button
    el('trigger-cancel-btn')?.addEventListener('click', () => triggerModal?.hide());

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
