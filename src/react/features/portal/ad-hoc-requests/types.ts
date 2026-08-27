/**
 * Portal Ad-Hoc Request Types
 * Types for client-facing ad-hoc request management
 *
 * Field names mirror what `/api/ad-hoc-requests/my-requests` actually returns —
 * the camelCase entity produced by `toAdHocRequest` (server/database/entities/
 * ad-hoc-request.ts). There is no quotes table: the quote is the flat
 * estimatedHours / hourlyRate / flatRate / quotedPrice columns on the request.
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type AdHocRequestStatus =
  | 'submitted'
  | 'reviewing'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'declined';

export type AdHocRequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AdHocRequestType = 'feature' | 'change' | 'bug_fix' | 'enhancement' | 'support';

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface AdHocRequest {
  id: number;
  title: string;
  description: string;
  status: AdHocRequestStatus;
  priority: AdHocRequestPriority;
  requestType: AdHocRequestType;
  projectId?: number;
  projectName?: string | null;
  /** Quote fields — present once the request has been priced */
  estimatedHours?: number | null;
  hourlyRate?: number | null;
  flatRate?: number | null;
  quotedPrice?: number | null;
  /** Single attachment, referencing a file already stored against the project */
  attachmentFileId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface NewAdHocRequestPayload {
  title: string;
  description: string;
  priority: AdHocRequestPriority;
  requestType: AdHocRequestType;
  projectId: number;
  /** Uploaded to the project first, then sent as attachmentFileId */
  attachment?: File;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface AdHocRequestsListResponse {
  requests: AdHocRequest[];
  total: number;
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

export const AD_HOC_REQUEST_STATUS_CONFIG: Record<
  AdHocRequestStatus,
  { label: string; color: string }
> = {
  submitted: { label: 'Submitted', color: 'var(--status-pending)' },
  reviewing: { label: 'In Review', color: 'var(--status-pending)' },
  quoted: { label: 'Quote Sent', color: 'var(--color-brand-primary)' },
  approved: { label: 'Approved', color: 'var(--status-completed)' },
  in_progress: { label: 'In Progress', color: 'var(--status-active)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' }
};

export const AD_HOC_REQUEST_PRIORITY_CONFIG: Record<
  AdHocRequestPriority,
  { label: string; color: string }
> = {
  low: { label: 'Low', color: 'var(--color-text-tertiary)' },
  normal: { label: 'Normal', color: 'var(--status-active)' },
  high: { label: 'High', color: 'var(--status-pending)' },
  urgent: { label: 'Urgent', color: 'var(--status-cancelled)' }
};

export const AD_HOC_REQUEST_TYPE_CONFIG: Record<AdHocRequestType, { label: string }> = {
  feature: { label: 'New feature' },
  change: { label: 'Change' },
  enhancement: { label: 'Improvement' },
  bug_fix: { label: 'Something broken' },
  support: { label: 'Help / question' }
};
