/**
 * ===============================================
 * STATUS UTILITIES
 * ===============================================
 * @file src/utils/status-utils.ts
 *
 * Shared status formatting utilities for both admin and client portals.
 * Consolidates duplicate status logic from multiple modules.
 */

// ============================================
// Invoice Status
// ============================================

export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'cancelled';

/**
 * Get display label for invoice status
 */
export function getInvoiceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    sent: 'Sent',
    viewed: 'Viewed',
    paid: 'Paid',
    partial: 'Partial',
    overdue: 'Overdue',
    cancelled: 'Cancelled'
  };
  return labels[status] || status;
}

/**
 * Get badge variant for invoice status
 */
export function getInvoiceStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    draft: 'muted',
    pending: 'warning',
    sent: 'info',
    viewed: 'info',
    paid: 'success',
    partial: 'warning',
    overdue: 'danger',
    cancelled: 'muted'
  };
  return variants[status] || 'default';
}

/**
 * Check if an invoice is overdue
 */
export function isInvoiceOverdue(invoice: { due_date: string; status: string }): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    return false;
  }
  const dueDate = new Date(invoice.due_date);
  return dueDate < new Date();
}

// ============================================
// Document Request Status
// ============================================

export type DocumentRequestStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';

/**
 * Get display label for document request status
 */
export function getDocumentRequestStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected'
  };
  return labels[status] || status;
}

/**
 * Get badge variant for document request status
 */
export function getDocumentRequestStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    pending: 'warning',
    in_progress: 'info',
    submitted: 'info',
    approved: 'success',
    rejected: 'danger'
  };
  return variants[status] || 'default';
}

// ============================================
// Project Status
// ============================================

export type ProjectStatus = 'inquiry' | 'proposal' | 'active' | 'on_hold' | 'completed' | 'cancelled';

/**
 * Get display label for project status
 */
export function getProjectStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    inquiry: 'Inquiry',
    proposal: 'Proposal',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  return labels[status] || status;
}

/**
 * Get badge variant for project status
 */
export function getProjectStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    inquiry: 'info',
    proposal: 'warning',
    active: 'success',
    on_hold: 'warning',
    completed: 'muted',
    cancelled: 'danger'
  };
  return variants[status] || 'default';
}

// ============================================
// Ad Hoc Request Status
// ============================================

export type AdHocRequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Get display label for ad hoc request status
 */
export function getAdHocRequestStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  return labels[status] || status;
}

/**
 * Get badge variant for ad hoc request status
 */
export function getAdHocRequestStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    pending: 'warning',
    in_progress: 'info',
    completed: 'success',
    cancelled: 'muted'
  };
  return variants[status] || 'default';
}

// ============================================
// Questionnaire Status
// ============================================

export type QuestionnaireStatus = 'draft' | 'pending' | 'in_progress' | 'submitted' | 'reviewed';

/**
 * Get display label for questionnaire status
 */
export function getQuestionnaireStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    in_progress: 'In Progress',
    submitted: 'Submitted',
    reviewed: 'Reviewed'
  };
  return labels[status] || status;
}

/**
 * Get badge variant for questionnaire status
 */
export function getQuestionnaireStatusVariant(status: string): string {
  const variants: Record<string, string> = {
    draft: 'muted',
    pending: 'warning',
    in_progress: 'info',
    submitted: 'success',
    reviewed: 'success'
  };
  return variants[status] || 'default';
}

// ============================================
// Generic Status Utilities
// ============================================

/**
 * Get CSS class for status badge
 */
export function getStatusBadgeClass(variant: string): string {
  return `status-badge status-badge--${variant}`;
}

/**
 * Check if status indicates completion
 */
export function isCompletedStatus(status: string): boolean {
  const completedStatuses = ['paid', 'completed', 'approved', 'reviewed'];
  return completedStatuses.includes(status);
}

/**
 * Check if status indicates action needed
 */
export function needsAction(status: string): boolean {
  const actionStatuses = ['pending', 'overdue', 'rejected'];
  return actionStatuses.includes(status);
}

/**
 * Get priority color based on urgency
 */
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'var(--color-success)',
    medium: 'var(--color-warning)',
    high: 'var(--color-danger)',
    urgent: 'var(--color-danger)'
  };
  return colors[priority] || 'var(--color-text-secondary)';
}
