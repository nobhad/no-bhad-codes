/**
 * Portal Ad-Hoc Request Types
 * Types for client-facing ad-hoc request management
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export type AdHocRequestStatus =
  | 'pending'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled';

export type AdHocRequestPriority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// ENTITY TYPES
// ============================================================================

export interface AdHocRequestAttachment {
  id: number;
  filename: string;
  file_size: number;
  file_type: string;
  uploaded_at: string;
  download_url?: string;
}

export interface AdHocRequestQuote {
  id: number;
  hours_estimated: number;
  hourly_rate: number;
  flat_fee?: number;
  total_amount: number;
  notes?: string;
  expires_at?: string;
  created_at: string;
}

export interface AdHocRequest {
  id: number;
  title: string;
  description: string;
  status: AdHocRequestStatus;
  priority: AdHocRequestPriority;
  project_id?: number;
  project_name?: string;
  quote?: AdHocRequestQuote;
  attachments?: AdHocRequestAttachment[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface NewAdHocRequestPayload {
  title: string;
  description: string;
  priority: AdHocRequestPriority;
  project_id?: number;
  attachments?: File[];
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
  pending: { label: 'Pending Review', color: 'var(--status-pending)' },
  quoted: { label: 'Quote Sent', color: 'var(--color-brand-primary)' },
  approved: { label: 'Approved', color: 'var(--status-completed)' },
  in_progress: { label: 'In Progress', color: 'var(--status-active)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' },
  cancelled: { label: 'Cancelled', color: 'var(--portal-text-muted)' }
};

export const AD_HOC_REQUEST_PRIORITY_CONFIG: Record<
  AdHocRequestPriority,
  { label: string; color: string }
> = {
  low: { label: 'Low', color: 'var(--portal-text-muted)' },
  normal: { label: 'Normal', color: 'var(--status-active)' },
  high: { label: 'High', color: 'var(--status-pending)' },
  urgent: { label: 'Urgent', color: 'var(--status-cancelled)' }
};
