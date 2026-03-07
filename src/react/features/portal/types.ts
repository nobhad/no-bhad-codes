/**
 * Portal Feature Types
 * Types for client-facing portal React components
 */

// ============================================================================
// BASE VIEW PROPS
// ============================================================================

/**
 * Base props interface for all top-level portal view components.
 * Every portal view that makes API calls should extend this interface.
 */
export interface PortalViewProps {
  /** Function to retrieve auth token for API calls */
  getAuthToken?: () => string | null;
  /** Callback to show toast notifications */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export type PortalInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface PortalInvoice {
  id: number;
  invoice_number: string;
  project_id: number;
  project_name?: string;
  amount_total: number;
  status: PortalInvoiceStatus;
  due_date?: string;
  created_at: string;
  paid_at?: string;
}

export interface PortalInvoiceSummary {
  totalOutstanding: number;
  totalPaid: number;
}

export const PORTAL_INVOICE_STATUS_CONFIG: Record<
  PortalInvoiceStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'var(--portal-text-muted)' },
  sent: { label: 'Sent', color: 'var(--status-pending)' },
  viewed: { label: 'Viewed', color: 'var(--color-brand-primary)' },
  partial: { label: 'Partial', color: 'var(--color-warning-500)' },
  paid: { label: 'Paid', color: 'var(--status-active)' },
  overdue: { label: 'Overdue', color: 'var(--status-cancelled)' },
  cancelled: { label: 'Cancelled', color: 'var(--portal-text-muted)' }
};

// ============================================================================
// FILE TYPES
// ============================================================================

export interface PortalFile {
  id: number;
  filename: string;
  file_size: number;
  file_type: string;
  category?: string;
  uploaded_at: string;
  download_url?: string;
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

export type PortalProjectStatus =
  | 'pending'
  | 'active'
  | 'in-progress'
  | 'on-hold'
  | 'completed'
  | 'cancelled';

export interface PortalProject {
  id: number;
  name: string;
  description?: string;
  status: PortalProjectStatus;
  progress: number;
  start_date?: string;
  end_date?: string;
  preview_url?: string;
  client_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PortalProjectMilestone {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  due_date?: string;
  is_completed: boolean;
  completed_date?: string;
  sort_order?: number;
}

export interface PortalProjectUpdate {
  id: number;
  project_id: number;
  title: string;
  content: string;
  update_type: 'milestone' | 'status' | 'general' | 'deliverable';
  created_at: string;
  created_by?: string;
}

export const PORTAL_PROJECT_STATUS_CONFIG: Record<
  PortalProjectStatus,
  { label: string; color: string }
> = {
  pending: { label: 'Pending', color: 'var(--status-pending)' },
  active: { label: 'Active', color: 'var(--status-active)' },
  'in-progress': { label: 'In Progress', color: 'var(--status-active)' },
  'on-hold': { label: 'On Hold', color: 'var(--status-pending)' },
  completed: { label: 'Completed', color: 'var(--status-completed)' },
  cancelled: { label: 'Cancelled', color: 'var(--status-cancelled)' }
};
