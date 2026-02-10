/**
 * ===============================================
 * PORTAL APPROVALS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-approvals.ts
 *
 * Client-facing approval functionality.
 * Shows pending items requiring client review/approval.
 */

import { apiFetch, apiPost, parseJsonResponse } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';

// ============================================
// TYPES
// ============================================

type EntityType = 'proposal' | 'invoice' | 'contract' | 'deliverable' | 'project';

interface PendingApproval {
  instance_id: number;
  request_id: number;
  entity_type: EntityType;
  entity_id: number;
  entity_name: string;
  workflow_name: string;
  requested_at: string;
  due_by: string | null;
}

// ============================================
// CONSTANTS
// ============================================

const APPROVALS_API = '/api/approvals';

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  proposal: 'Proposal',
  invoice: 'Invoice',
  contract: 'Contract',
  deliverable: 'Deliverable',
  project: 'Project'
};

const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
  proposal: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  invoice: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
  contract: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m16 13-3.5 3.5-2-2L8 17"/></svg>',
  deliverable: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  project: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>'
};

// ============================================
// STATE
// ============================================

let cachedApprovals: PendingApproval[] = [];

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

/**
 * Initialize the approvals section on the dashboard
 */
export async function initClientApprovals(): Promise<void> {
  await loadClientApprovals();
}

/**
 * Load pending approvals for the current client
 */
export async function loadClientApprovals(): Promise<void> {
  const section = el('pending-approvals-section');
  const list = el('client-approvals-list');
  if (!section || !list) return;

  try {
    const res = await apiFetch(`${APPROVALS_API}/pending`);
    if (!res.ok) {
      throw new Error('Failed to load pending approvals');
    }

    const data = await parseJsonResponse<{ approvals: PendingApproval[] }>(res);
    cachedApprovals = data.approvals || [];

    // Show/hide section based on whether there are pending items
    if (cachedApprovals.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    updateApprovalCount();
    renderApprovalsList();
    setupApprovalHandlers();
  } catch (error) {
    console.error('[PortalApprovals] Error loading approvals:', error);
    section.classList.add('hidden');
  }
}

// ============================================
// RENDERING
// ============================================

function updateApprovalCount(): void {
  const countEl = el('approval-count');
  if (countEl) {
    countEl.textContent = cachedApprovals.length.toString();
  }
}

function renderApprovalsList(): void {
  const list = el('client-approvals-list');
  if (!list) return;

  list.innerHTML = cachedApprovals.map(approval => {
    const entityLabel = ENTITY_TYPE_LABELS[approval.entity_type] || approval.entity_type;
    const icon = ENTITY_TYPE_ICONS[approval.entity_type] || '';
    const dueLabel = approval.due_by
      ? `<span class="approval-due">Due: ${formatDate(approval.due_by)}</span>`
      : '';

    // Check if overdue
    const isOverdue = approval.due_by && new Date(approval.due_by) < new Date();
    const overdueClass = isOverdue ? 'approval-overdue' : '';

    return `
      <div class="approval-item ${overdueClass}" data-request-id="${approval.request_id}">
        <div class="approval-icon">${icon}</div>
        <div class="approval-details">
          <div class="approval-title">
            ${escapeHtml(approval.entity_name || `${entityLabel} #${approval.entity_id}`)}
          </div>
          <div class="approval-meta">
            <span class="approval-type">${entityLabel}</span>
            <span class="approval-date">Requested ${formatDate(approval.requested_at)}</span>
            ${dueLabel}
          </div>
        </div>
        <div class="approval-actions">
          <button type="button" class="btn btn-primary btn-sm approval-review-btn" data-request-id="${approval.request_id}" data-entity-type="${approval.entity_type}" data-entity-id="${approval.entity_id}">
            Review
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// EVENT HANDLERS
// ============================================

function setupApprovalHandlers(): void {
  const list = el('client-approvals-list');
  if (!list || list.dataset.handlersAttached === 'true') return;
  list.dataset.handlersAttached = 'true';

  list.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button.approval-review-btn');
    if (!btn) return;

    const entityType = (btn as HTMLElement).dataset.entityType as EntityType;
    const entityId = (btn as HTMLElement).dataset.entityId;
    if (!entityType || !entityId) return;

    navigateToApproval(entityType, entityId);
  });
}

function navigateToApproval(entityType: EntityType, entityId: string): void {
  // Navigate to the appropriate view based on entity type
  switch (entityType) {
  case 'proposal':
    // Navigate to proposal signing page
    window.location.href = `/sign-contract?proposal=${entityId}`;
    break;
  case 'contract':
    // Navigate to contract signing page
    window.location.href = `/sign-contract?contract=${entityId}`;
    break;
  case 'invoice':
    document
      .querySelector('.header-subtab-group[data-for-tab="docs"] [data-subtab="invoices"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    break;
  case 'deliverable':
    // Show deliverable review modal or navigate to review page
    showToast('Deliverable review coming soon', 'info');
    break;
  case 'project':
    // Navigate to project details
    showToast('Project review coming soon', 'info');
    break;
  default:
    showToast(`Cannot navigate to ${entityType}`, 'warning');
  }
}

// ============================================
// APPROVAL ACTIONS
// ============================================

/**
 * Submit approval decision
 */
export async function submitApprovalDecision(
  requestId: number,
  decision: 'approved' | 'rejected',
  comment?: string
): Promise<boolean> {
  try {
    const res = await apiPost(`${APPROVALS_API}/requests/${requestId}/respond`, {
      decision,
      comment: comment || (decision === 'approved' ? 'Approved by client' : 'Rejected by client')
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || `Failed to ${decision === 'approved' ? 'approve' : 'reject'}`);
    }

    showToast(decision === 'approved' ? 'Approved successfully' : 'Rejected', 'success');
    await loadClientApprovals(); // Refresh list
    return true;
  } catch (error) {
    console.error('[PortalApprovals] Decision error:', error);
    showToast(error instanceof Error ? error.message : 'Error submitting decision', 'error');
    return false;
  }
}
