/**
 * ===============================================
 * STATUS UTILITIES TESTS
 * ===============================================
 * @file tests/unit/utils/status-utils.test.ts
 *
 * Unit tests for all status utility functions.
 * Pure functions - no mocking required.
 */

import { describe, it, expect } from 'vitest';
import {
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  isInvoiceOverdue,
  getDocumentRequestStatusLabel,
  getDocumentRequestStatusVariant,
  getProjectStatusLabel,
  getProjectStatusVariant,
  getAdHocRequestStatusLabel,
  getAdHocRequestStatusVariant,
  getQuestionnaireStatusLabel,
  getQuestionnaireStatusVariant,
  getStatusBadgeClass,
  isCompletedStatus,
  needsAction,
  getPriorityColor
} from '../../../src/utils/status-utils';

// ============================================
// getInvoiceStatusLabel
// ============================================

describe('getInvoiceStatusLabel', () => {
  it('returns "Draft" for "draft"', () => {
    expect(getInvoiceStatusLabel('draft')).toBe('Draft');
  });

  it('returns "Pending" for "pending"', () => {
    expect(getInvoiceStatusLabel('pending')).toBe('Pending');
  });

  it('returns "Sent" for "sent"', () => {
    expect(getInvoiceStatusLabel('sent')).toBe('Sent');
  });

  it('returns "Viewed" for "viewed"', () => {
    expect(getInvoiceStatusLabel('viewed')).toBe('Viewed');
  });

  it('returns "Paid" for "paid"', () => {
    expect(getInvoiceStatusLabel('paid')).toBe('Paid');
  });

  it('returns "Partial" for "partial"', () => {
    expect(getInvoiceStatusLabel('partial')).toBe('Partial');
  });

  it('returns "Overdue" for "overdue"', () => {
    expect(getInvoiceStatusLabel('overdue')).toBe('Overdue');
  });

  it('returns "Cancelled" for "cancelled"', () => {
    expect(getInvoiceStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('returns the input unchanged for unknown status', () => {
    expect(getInvoiceStatusLabel('unknown-status')).toBe('unknown-status');
  });

  it('returns the input unchanged for empty string', () => {
    expect(getInvoiceStatusLabel('')).toBe('');
  });
});

// ============================================
// getInvoiceStatusVariant
// ============================================

describe('getInvoiceStatusVariant', () => {
  it('returns "muted" for "draft"', () => {
    expect(getInvoiceStatusVariant('draft')).toBe('muted');
  });

  it('returns "warning" for "pending"', () => {
    expect(getInvoiceStatusVariant('pending')).toBe('warning');
  });

  it('returns "info" for "sent"', () => {
    expect(getInvoiceStatusVariant('sent')).toBe('info');
  });

  it('returns "info" for "viewed"', () => {
    expect(getInvoiceStatusVariant('viewed')).toBe('info');
  });

  it('returns "success" for "paid"', () => {
    expect(getInvoiceStatusVariant('paid')).toBe('success');
  });

  it('returns "warning" for "partial"', () => {
    expect(getInvoiceStatusVariant('partial')).toBe('warning');
  });

  it('returns "danger" for "overdue"', () => {
    expect(getInvoiceStatusVariant('overdue')).toBe('danger');
  });

  it('returns "muted" for "cancelled"', () => {
    expect(getInvoiceStatusVariant('cancelled')).toBe('muted');
  });

  it('returns "default" for unknown status', () => {
    expect(getInvoiceStatusVariant('unknown')).toBe('default');
  });
});

// ============================================
// isInvoiceOverdue
// ============================================

describe('isInvoiceOverdue', () => {
  it('returns false when status is "paid"', () => {
    expect(isInvoiceOverdue({ due_date: '2020-01-01', status: 'paid' })).toBe(false);
  });

  it('returns false when status is "cancelled"', () => {
    expect(isInvoiceOverdue({ due_date: '2020-01-01', status: 'cancelled' })).toBe(false);
  });

  it('returns true when due_date is in the past and status is "pending"', () => {
    expect(isInvoiceOverdue({ due_date: '2020-01-01', status: 'pending' })).toBe(true);
  });

  it('returns true when due_date is in the past and status is "sent"', () => {
    expect(isInvoiceOverdue({ due_date: '2020-06-15', status: 'sent' })).toBe(true);
  });

  it('returns false when due_date is in the future and status is "pending"', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    expect(
      isInvoiceOverdue({ due_date: futureDate.toISOString(), status: 'pending' })
    ).toBe(false);
  });

  it('returns true for "overdue" status with past due date', () => {
    expect(isInvoiceOverdue({ due_date: '2020-01-01', status: 'overdue' })).toBe(true);
  });

  it('returns true for "partial" status with past due date', () => {
    expect(isInvoiceOverdue({ due_date: '2020-01-01', status: 'partial' })).toBe(true);
  });
});

// ============================================
// getDocumentRequestStatusLabel
// ============================================

describe('getDocumentRequestStatusLabel', () => {
  it('returns "Pending" for "pending"', () => {
    expect(getDocumentRequestStatusLabel('pending')).toBe('Pending');
  });

  it('returns "In Progress" for "in_progress"', () => {
    expect(getDocumentRequestStatusLabel('in_progress')).toBe('In Progress');
  });

  it('returns "Submitted" for "submitted"', () => {
    expect(getDocumentRequestStatusLabel('submitted')).toBe('Submitted');
  });

  it('returns "Approved" for "approved"', () => {
    expect(getDocumentRequestStatusLabel('approved')).toBe('Approved');
  });

  it('returns "Rejected" for "rejected"', () => {
    expect(getDocumentRequestStatusLabel('rejected')).toBe('Rejected');
  });

  it('returns input unchanged for unknown status', () => {
    expect(getDocumentRequestStatusLabel('custom')).toBe('custom');
  });
});

// ============================================
// getDocumentRequestStatusVariant
// ============================================

describe('getDocumentRequestStatusVariant', () => {
  it('returns "warning" for "pending"', () => {
    expect(getDocumentRequestStatusVariant('pending')).toBe('warning');
  });

  it('returns "info" for "in_progress"', () => {
    expect(getDocumentRequestStatusVariant('in_progress')).toBe('info');
  });

  it('returns "info" for "submitted"', () => {
    expect(getDocumentRequestStatusVariant('submitted')).toBe('info');
  });

  it('returns "success" for "approved"', () => {
    expect(getDocumentRequestStatusVariant('approved')).toBe('success');
  });

  it('returns "danger" for "rejected"', () => {
    expect(getDocumentRequestStatusVariant('rejected')).toBe('danger');
  });

  it('returns "default" for unknown status', () => {
    expect(getDocumentRequestStatusVariant('unknown')).toBe('default');
  });
});

// ============================================
// getProjectStatusLabel
// ============================================

describe('getProjectStatusLabel', () => {
  it('returns "Inquiry" for "inquiry"', () => {
    expect(getProjectStatusLabel('inquiry')).toBe('Inquiry');
  });

  it('returns "Proposal" for "proposal"', () => {
    expect(getProjectStatusLabel('proposal')).toBe('Proposal');
  });

  it('returns "Active" for "active"', () => {
    expect(getProjectStatusLabel('active')).toBe('Active');
  });

  it('returns "On Hold" for "on_hold"', () => {
    expect(getProjectStatusLabel('on_hold')).toBe('On Hold');
  });

  it('returns "Completed" for "completed"', () => {
    expect(getProjectStatusLabel('completed')).toBe('Completed');
  });

  it('returns "Cancelled" for "cancelled"', () => {
    expect(getProjectStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('returns input unchanged for unknown status', () => {
    expect(getProjectStatusLabel('mystery')).toBe('mystery');
  });
});

// ============================================
// getProjectStatusVariant
// ============================================

describe('getProjectStatusVariant', () => {
  it('returns "info" for "inquiry"', () => {
    expect(getProjectStatusVariant('inquiry')).toBe('info');
  });

  it('returns "warning" for "proposal"', () => {
    expect(getProjectStatusVariant('proposal')).toBe('warning');
  });

  it('returns "success" for "active"', () => {
    expect(getProjectStatusVariant('active')).toBe('success');
  });

  it('returns "warning" for "on_hold"', () => {
    expect(getProjectStatusVariant('on_hold')).toBe('warning');
  });

  it('returns "muted" for "completed"', () => {
    expect(getProjectStatusVariant('completed')).toBe('muted');
  });

  it('returns "danger" for "cancelled"', () => {
    expect(getProjectStatusVariant('cancelled')).toBe('danger');
  });

  it('returns "default" for unknown status', () => {
    expect(getProjectStatusVariant('unknown')).toBe('default');
  });
});

// ============================================
// getAdHocRequestStatusLabel
// ============================================

describe('getAdHocRequestStatusLabel', () => {
  it('returns "Pending" for "pending"', () => {
    expect(getAdHocRequestStatusLabel('pending')).toBe('Pending');
  });

  it('returns "In Progress" for "in_progress"', () => {
    expect(getAdHocRequestStatusLabel('in_progress')).toBe('In Progress');
  });

  it('returns "Completed" for "completed"', () => {
    expect(getAdHocRequestStatusLabel('completed')).toBe('Completed');
  });

  it('returns "Cancelled" for "cancelled"', () => {
    expect(getAdHocRequestStatusLabel('cancelled')).toBe('Cancelled');
  });

  it('returns input unchanged for unknown status', () => {
    expect(getAdHocRequestStatusLabel('other')).toBe('other');
  });
});

// ============================================
// getAdHocRequestStatusVariant
// ============================================

describe('getAdHocRequestStatusVariant', () => {
  it('returns "warning" for "pending"', () => {
    expect(getAdHocRequestStatusVariant('pending')).toBe('warning');
  });

  it('returns "info" for "in_progress"', () => {
    expect(getAdHocRequestStatusVariant('in_progress')).toBe('info');
  });

  it('returns "success" for "completed"', () => {
    expect(getAdHocRequestStatusVariant('completed')).toBe('success');
  });

  it('returns "muted" for "cancelled"', () => {
    expect(getAdHocRequestStatusVariant('cancelled')).toBe('muted');
  });

  it('returns "default" for unknown status', () => {
    expect(getAdHocRequestStatusVariant('unknown')).toBe('default');
  });
});

// ============================================
// getQuestionnaireStatusLabel
// ============================================

describe('getQuestionnaireStatusLabel', () => {
  it('returns "Draft" for "draft"', () => {
    expect(getQuestionnaireStatusLabel('draft')).toBe('Draft');
  });

  it('returns "Pending" for "pending"', () => {
    expect(getQuestionnaireStatusLabel('pending')).toBe('Pending');
  });

  it('returns "In Progress" for "in_progress"', () => {
    expect(getQuestionnaireStatusLabel('in_progress')).toBe('In Progress');
  });

  it('returns "Submitted" for "submitted"', () => {
    expect(getQuestionnaireStatusLabel('submitted')).toBe('Submitted');
  });

  it('returns "Reviewed" for "reviewed"', () => {
    expect(getQuestionnaireStatusLabel('reviewed')).toBe('Reviewed');
  });

  it('returns input unchanged for unknown status', () => {
    expect(getQuestionnaireStatusLabel('archived')).toBe('archived');
  });
});

// ============================================
// getQuestionnaireStatusVariant
// ============================================

describe('getQuestionnaireStatusVariant', () => {
  it('returns "muted" for "draft"', () => {
    expect(getQuestionnaireStatusVariant('draft')).toBe('muted');
  });

  it('returns "warning" for "pending"', () => {
    expect(getQuestionnaireStatusVariant('pending')).toBe('warning');
  });

  it('returns "info" for "in_progress"', () => {
    expect(getQuestionnaireStatusVariant('in_progress')).toBe('info');
  });

  it('returns "success" for "submitted"', () => {
    expect(getQuestionnaireStatusVariant('submitted')).toBe('success');
  });

  it('returns "success" for "reviewed"', () => {
    expect(getQuestionnaireStatusVariant('reviewed')).toBe('success');
  });

  it('returns "default" for unknown status', () => {
    expect(getQuestionnaireStatusVariant('unknown')).toBe('default');
  });
});

// ============================================
// getStatusBadgeClass
// ============================================

describe('getStatusBadgeClass', () => {
  it('returns "status-badge status-badge--success" for "success"', () => {
    expect(getStatusBadgeClass('success')).toBe('status-badge status-badge--success');
  });

  it('returns "status-badge status-badge--danger" for "danger"', () => {
    expect(getStatusBadgeClass('danger')).toBe('status-badge status-badge--danger');
  });

  it('returns "status-badge status-badge--warning" for "warning"', () => {
    expect(getStatusBadgeClass('warning')).toBe('status-badge status-badge--warning');
  });

  it('returns "status-badge status-badge--info" for "info"', () => {
    expect(getStatusBadgeClass('info')).toBe('status-badge status-badge--info');
  });

  it('returns "status-badge status-badge--muted" for "muted"', () => {
    expect(getStatusBadgeClass('muted')).toBe('status-badge status-badge--muted');
  });

  it('returns "status-badge status-badge--default" for "default"', () => {
    expect(getStatusBadgeClass('default')).toBe('status-badge status-badge--default');
  });

  it('always includes "status-badge" base class', () => {
    const result = getStatusBadgeClass('custom');
    expect(result.startsWith('status-badge ')).toBe(true);
  });
});

// ============================================
// isCompletedStatus
// ============================================

describe('isCompletedStatus', () => {
  it('returns true for "paid"', () => {
    expect(isCompletedStatus('paid')).toBe(true);
  });

  it('returns true for "completed"', () => {
    expect(isCompletedStatus('completed')).toBe(true);
  });

  it('returns true for "approved"', () => {
    expect(isCompletedStatus('approved')).toBe(true);
  });

  it('returns true for "reviewed"', () => {
    expect(isCompletedStatus('reviewed')).toBe(true);
  });

  it('returns false for "pending"', () => {
    expect(isCompletedStatus('pending')).toBe(false);
  });

  it('returns false for "overdue"', () => {
    expect(isCompletedStatus('overdue')).toBe(false);
  });

  it('returns false for "active"', () => {
    expect(isCompletedStatus('active')).toBe(false);
  });

  it('returns false for "cancelled"', () => {
    expect(isCompletedStatus('cancelled')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(isCompletedStatus('draft')).toBe(false);
  });
});

// ============================================
// needsAction
// ============================================

describe('needsAction', () => {
  it('returns true for "pending"', () => {
    expect(needsAction('pending')).toBe(true);
  });

  it('returns true for "overdue"', () => {
    expect(needsAction('overdue')).toBe(true);
  });

  it('returns true for "rejected"', () => {
    expect(needsAction('rejected')).toBe(true);
  });

  it('returns false for "paid"', () => {
    expect(needsAction('paid')).toBe(false);
  });

  it('returns false for "completed"', () => {
    expect(needsAction('completed')).toBe(false);
  });

  it('returns false for "active"', () => {
    expect(needsAction('active')).toBe(false);
  });

  it('returns false for "draft"', () => {
    expect(needsAction('draft')).toBe(false);
  });

  it('returns false for "cancelled"', () => {
    expect(needsAction('cancelled')).toBe(false);
  });

  it('returns false for unknown status', () => {
    expect(needsAction('unknown')).toBe(false);
  });
});

// ============================================
// getPriorityColor
// ============================================

describe('getPriorityColor', () => {
  it('returns success CSS var for "low"', () => {
    expect(getPriorityColor('low')).toBe('var(--color-success)');
  });

  it('returns warning CSS var for "medium"', () => {
    expect(getPriorityColor('medium')).toBe('var(--color-warning)');
  });

  it('returns danger CSS var for "high"', () => {
    expect(getPriorityColor('high')).toBe('var(--color-danger)');
  });

  it('returns danger CSS var for "urgent"', () => {
    expect(getPriorityColor('urgent')).toBe('var(--color-danger)');
  });

  it('returns secondary text CSS var for unknown priority', () => {
    expect(getPriorityColor('unknown')).toBe('var(--color-text-secondary)');
  });

  it('returns secondary text CSS var for empty string', () => {
    expect(getPriorityColor('')).toBe('var(--color-text-secondary)');
  });

  it('all returned values are CSS variable strings', () => {
    const priorities = ['low', 'medium', 'high', 'urgent', 'custom'];
    priorities.forEach((p) => {
      expect(getPriorityColor(p)).toMatch(/^var\(--[\w-]+\)$/);
    });
  });
});
