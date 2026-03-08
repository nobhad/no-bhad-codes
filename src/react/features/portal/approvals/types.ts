/**
 * Portal Approvals Types
 * Types for the client portal approvals workflow
 */

/** Entity types that can require approval */
export type ApprovalEntityType = 'proposal' | 'invoice' | 'contract' | 'deliverable' | 'project';

/** Approval request status */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/** Approval response action */
export type ApprovalAction = 'approve' | 'reject';

/** Pending approval request from API */
export interface PendingApproval {
  id: number;
  entity_type: ApprovalEntityType;
  entity_id: number;
  entity_name?: string;
  description?: string;
  status: ApprovalStatus;
  requested_at: string;
  requested_by?: string;
  due_by?: string;
  amount?: number;
  project_name?: string;
}

/** Response payload for approval action */
export interface ApprovalResponse {
  action: ApprovalAction;
  comment?: string;
}

/** API response for pending approvals */
export interface PendingApprovalsResponse {
  approvals: PendingApproval[];
  total: number;
}

/** Approval status configuration for display */
export const APPROVAL_STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'var(--status-pending)' },
  approved: { label: 'Approved', color: 'var(--status-completed)' },
  rejected: { label: 'Rejected', color: 'var(--status-cancelled)' },
  expired: { label: 'Expired', color: 'var(--color-text-tertiary)' }
};
