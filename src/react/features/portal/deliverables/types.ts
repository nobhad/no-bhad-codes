/**
 * Portal Deliverables Types
 * Types for the client portal deliverable views
 */

/** Deliverable statuses visible to clients */
export type PortalDeliverableStatus = 'draft' | 'in_review' | 'approved' | 'revision_requested' | 'locked';

/** Client-facing deliverable from API */
export interface PortalDeliverable {
  id: number;
  title: string;
  type: string;
  status: string;
  approval_status: string;
  review_deadline: string | null;
  round_number: number;
  project_name: string | null;
  created_at: string;
}

/** API response for client deliverables */
export interface PortalDeliverablesResponse {
  deliverables: PortalDeliverable[];
}

/** Deliverable status display config */
export const DELIVERABLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--portal-text-muted)' },
  in_review: { label: 'In Review', color: 'var(--status-pending)' },
  approved: { label: 'Approved', color: 'var(--status-completed)' },
  revision_requested: { label: 'Revision Requested', color: 'var(--status-overdue)' },
  locked: { label: 'Locked', color: 'var(--status-completed)' }
};
