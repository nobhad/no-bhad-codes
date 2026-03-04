/**
 * Portal Table Filter Configurations
 * Mirrors admin pattern from admin/shared/filterConfigs.ts
 */

import type { FilterConfig } from '../../admin/shared/filterConfigs';

export type { FilterConfig };
export type { FilterOption } from '../../admin/shared/filterConfigs';

// ============================================
// SHARED OPTIONS
// ============================================

const STATUS_ALL_OPTION = { value: 'all', label: 'All Statuses' };
const TYPE_ALL_OPTION = { value: 'all', label: 'All Types' };

// ============================================
// INVOICE FILTERS
// ============================================

export const PORTAL_INVOICE_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' }
];

export const PORTAL_INVOICES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_INVOICE_STATUS_OPTIONS }
];

// ============================================
// PROJECT FILTERS
// ============================================

export const PORTAL_PROJECT_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'active', label: 'Active' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' }
];

export const PORTAL_PROJECTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_PROJECT_STATUS_OPTIONS }
];

// ============================================
// DOCUMENT REQUEST FILTERS
// ============================================

export const PORTAL_DOCREQUEST_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

export const PORTAL_DOCREQUESTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_DOCREQUEST_STATUS_OPTIONS }
];

// ============================================
// QUESTIONNAIRE FILTERS
// ============================================

export const PORTAL_QUESTIONNAIRE_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Needs Revision' }
];

export const PORTAL_QUESTIONNAIRES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_QUESTIONNAIRE_STATUS_OPTIONS }
];

// ============================================
// AD-HOC REQUEST FILTERS
// ============================================

export const PORTAL_ADHOC_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Pending' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' }
];

export const PORTAL_ADHOC_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_ADHOC_STATUS_OPTIONS }
];

// ============================================
// FILE FILTERS
// ============================================

export const PORTAL_FILE_TYPE_OPTIONS = [
  TYPE_ALL_OPTION,
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'archive', label: 'Archives' }
];

export const PORTAL_FILES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'fileType', label: 'FILE TYPE', options: PORTAL_FILE_TYPE_OPTIONS }
];

// ============================================
// APPROVAL FILTERS
// ============================================

export const PORTAL_APPROVAL_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'proposal', label: 'Proposals' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'contract', label: 'Contracts' },
  { value: 'deliverable', label: 'Deliverables' }
];

export const PORTAL_APPROVALS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'entityType', label: 'TYPE', options: PORTAL_APPROVAL_TYPE_OPTIONS }
];
