/**
 * ===============================================
 * PORTAL APPROVALS MODULE
 * ===============================================
 * @file src/features/client/modules/portal-approvals.ts
 *
 * Client-facing approval functionality.
 * Delegates all rendering to the React portalApprovals component.
 */

import { apiPost } from '../../../utils/api-client';
import { showToast } from '../../../utils/toast-notifications';
import { getReactComponent } from '../../../react/registry';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('PortalApprovals');

// Track React unmount function
let reactApprovalsUnmountFn: (() => void) | null = null;

/**
 * Cleanup React portal approvals
 */
export function cleanupPortalApprovals(): void {
  if (reactApprovalsUnmountFn) {
    reactApprovalsUnmountFn();
    reactApprovalsUnmountFn = null;
  }
}

// ============================================
// CONSTANTS
// ============================================

const APPROVALS_API = API_ENDPOINTS.APPROVALS;

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
 * Load pending approvals - mounts React component
 */
export async function loadClientApprovals(): Promise<void> {
  const section = document.getElementById('pending-approvals-section');
  const list = document.getElementById('client-approvals-list');
  if (!section || !list) return;

  const component = getReactComponent('portalApprovals');
  if (component) {
    const unmountResult = component.mount(list as HTMLElement, {
      showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
        showToast(message, type);
      }
    });

    if (typeof unmountResult === 'function') {
      reactApprovalsUnmountFn = unmountResult;
    }

    return;
  }

  logger.error('React component not found');
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
    logger.error('Decision error:', error);
    showToast(error instanceof Error ? error.message : 'Error submitting decision', 'error');
    return false;
  }
}
