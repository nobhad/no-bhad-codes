/**
 * ===============================================
 * STATUS CONFIGURATIONS
 * ===============================================
 * @file src/config/status-configs.ts
 *
 * Shared status configurations used by both server-side EJS rendering
 * and client-side React/TypeScript components.
 * No React dependencies — pure TypeScript.
 */

// ============================================
// TYPES
// ============================================

/** Badge visual variant */
export type StatusVariant =
  | 'active' | 'inactive' | 'pending' | 'completed'
  | 'cancelled' | 'on-hold' | 'new' | 'qualified';

export interface StatusOption {
  /** Status value (stored in database) */
  value: string;
  /** Display label */
  label: string;
  /** Badge variant for styling */
  variant: StatusVariant;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Description text */
  description?: string;
}

export interface StatusConfig {
  /** Available status options */
  options: StatusOption[];
  /** Default variant for unknown statuses */
  defaultVariant?: StatusVariant;
  /** Whether editing is disabled */
  disabled?: boolean;
}

// ============================================
// STATUS CONFIGURATIONS
// ============================================

export const PROJECT_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'active', label: 'Active', variant: 'active' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'on_hold', label: 'On Hold', variant: 'on-hold' },
    { value: 'completed', label: 'Completed', variant: 'completed' },
    { value: 'cancelled', label: 'Cancelled', variant: 'cancelled' }
  ]
};

export const CLIENT_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'active', label: 'Active', variant: 'active' },
    { value: 'inactive', label: 'Inactive', variant: 'inactive' },
    { value: 'prospect', label: 'Prospect', variant: 'new' }
  ]
};

export const INVOICE_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'draft', label: 'Draft', variant: 'inactive' },
    { value: 'sent', label: 'Sent', variant: 'active' },
    { value: 'paid', label: 'Paid', variant: 'completed' },
    { value: 'overdue', label: 'Overdue', variant: 'cancelled' },
    { value: 'cancelled', label: 'Cancelled', variant: 'cancelled' }
  ]
};

export const LEAD_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'new', label: 'New', variant: 'new' },
    { value: 'contacted', label: 'Contacted', variant: 'active' },
    { value: 'qualified', label: 'Qualified', variant: 'qualified' },
    { value: 'proposal', label: 'Proposal', variant: 'active' },
    { value: 'won', label: 'Won', variant: 'completed' },
    { value: 'lost', label: 'Lost', variant: 'cancelled' }
  ]
};

export const TASK_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'pending', label: 'Pending', variant: 'pending' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'completed', label: 'Completed', variant: 'completed' },
    { value: 'blocked', label: 'Blocked', variant: 'on-hold' }
  ]
};

export const DELIVERABLE_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'pending', label: 'Pending', variant: 'pending' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'review', label: 'In Review', variant: 'qualified' },
    { value: 'approved', label: 'Approved', variant: 'completed' },
    { value: 'rejected', label: 'Rejected', variant: 'cancelled' }
  ]
};

export const CONTRACT_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'draft', label: 'Draft', variant: 'inactive' },
    { value: 'sent', label: 'Sent', variant: 'active' },
    { value: 'signed', label: 'Signed', variant: 'completed' },
    { value: 'expired', label: 'Expired', variant: 'cancelled' }
  ]
};

export const DOCUMENT_REQUEST_STATUS_CONFIG: StatusConfig = {
  options: [
    { value: 'pending', label: 'Pending', variant: 'pending' },
    { value: 'uploaded', label: 'Uploaded', variant: 'active' },
    { value: 'under_review', label: 'Under Review', variant: 'qualified' },
    { value: 'approved', label: 'Approved', variant: 'completed' },
    { value: 'rejected', label: 'Rejected', variant: 'cancelled' }
  ]
};

export const PRIORITY_CONFIG: StatusConfig = {
  options: [
    { value: 'low', label: 'Low', variant: 'inactive' },
    { value: 'medium', label: 'Medium', variant: 'pending' },
    { value: 'high', label: 'High', variant: 'on-hold' },
    { value: 'urgent', label: 'Urgent', variant: 'cancelled' }
  ]
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/** Get variant for a status value from a config */
export function getStatusVariant(
  status: string,
  config: StatusConfig
): StatusVariant {
  const option = config.options.find((opt) => opt.value === status);
  return option?.variant || config.defaultVariant || 'pending';
}

/** Get label for a status value from a config */
export function getStatusLabel(status: string, config: StatusConfig): string {
  const option = config.options.find((opt) => opt.value === status);
  return option?.label || status;
}

/** Create a StatusConfig from a simple map */
export function createStatusConfig(
  statuses: Record<string, { label: string; variant: StatusVariant; disabled?: boolean }>
): StatusConfig {
  return {
    options: Object.entries(statuses).map(([value, config]) => ({
      value,
      ...config
    }))
  };
}

// ============================================
// NAMESPACE EXPORT
// ============================================

export const StatusConfigs = {
  project: PROJECT_STATUS_CONFIG,
  client: CLIENT_STATUS_CONFIG,
  invoice: INVOICE_STATUS_CONFIG,
  lead: LEAD_STATUS_CONFIG,
  task: TASK_STATUS_CONFIG,
  deliverable: DELIVERABLE_STATUS_CONFIG,
  contract: CONTRACT_STATUS_CONFIG,
  documentRequest: DOCUMENT_REQUEST_STATUS_CONFIG,
  priority: PRIORITY_CONFIG
};
