/**
 * Centralized Table Filter Configurations
 * Eliminates duplication across table components
 *
 * Status labels are derived from the canonical *_CONFIG / *_LABELS
 * definitions in ../types.ts so there is one source of truth.
 */

import {
  PROJECT_STATUS_CONFIG,
  INVOICE_STATUS_CONFIG,
  LEAD_STATUS_CONFIG,
  CLIENT_STATUS_CONFIG,
  PAYMENT_INSTALLMENT_STATUS_CONFIG,
  CONTENT_REQUEST_ITEM_STATUS_CONFIG,
  configToFilterOptions,
  labelsToFilterOptions,
  LEAD_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
  CLIENT_TYPE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_CATEGORY_LABELS
} from '../types';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
}

// ============================================
// SHARED "ALL" OPTIONS
// ============================================

export const STATUS_ALL_OPTION: FilterOption = { value: 'all', label: 'All Statuses' };
const TYPE_ALL_OPTION: FilterOption = { value: 'all', label: 'All Types' };
const SOURCE_ALL_OPTION: FilterOption = { value: 'all', label: 'All Sources' };

// ============================================
// STATUS FILTER OPTIONS (derived from types.ts)
// ============================================

export const COMMON_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(CLIENT_STATUS_CONFIG)
];

/** Invoice filter uses a subset of statuses relevant to admin filtering */
export const INVOICE_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(INVOICE_STATUS_CONFIG, [
    'draft',
    'pending',
    'sent',
    'paid',
    'overdue',
    'cancelled'
  ])
];

export const LEAD_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(LEAD_STATUS_CONFIG, [
    'new',
    'contacted',
    'qualified',
    'in-progress',
    'converted',
    'lost',
    'on-hold'
  ])
];

export const LEAD_SOURCE_OPTIONS: FilterOption[] = [
  SOURCE_ALL_OPTION,
  ...labelsToFilterOptions(LEAD_SOURCE_LABELS, [
    'website',
    'referral',
    'social',
    'direct',
    'ad-campaign'
  ])
];

export const CLIENT_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(CLIENT_STATUS_CONFIG)
];

export const PROJECT_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(PROJECT_STATUS_CONFIG)
];

export const PROJECT_TYPE_OPTIONS: FilterOption[] = [
  TYPE_ALL_OPTION,
  ...labelsToFilterOptions(PROJECT_TYPE_LABELS, [
    'simple-site',
    'business-site',
    'portfolio',
    'e-commerce',
    'web-app',
    'browser-extension'
  ])
];

export const QUESTIONNAIRE_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' }
];

export const PROPOSAL_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' }
];

export const TASK_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' }
];

export const TASK_PRIORITY_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
];

export const EMAIL_TEMPLATE_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const CONTRACT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'signed', label: 'Signed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const CONTACT_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

export const GLOBAL_TASK_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const GLOBAL_TASK_PRIORITY_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

export const WORKFLOW_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

// ============================================
// TYPE FILTER OPTIONS
// ============================================

export const CLIENT_TYPE_OPTIONS: FilterOption[] = [
  TYPE_ALL_OPTION,
  ...labelsToFilterOptions(CLIENT_TYPE_LABELS, ['personal', 'business'])
];

// ============================================
// COMPLETE FILTER CONFIGS PER TABLE
// ============================================

export const CLIENTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: CLIENT_STATUS_OPTIONS },
  { key: 'type', label: 'TYPE', options: CLIENT_TYPE_OPTIONS }
];

export const INVOICES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: INVOICE_STATUS_OPTIONS }
];

export const LEADS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: LEAD_STATUS_OPTIONS },
  { key: 'source', label: 'SOURCE', options: LEAD_SOURCE_OPTIONS }
];

export const PROJECTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PROJECT_STATUS_OPTIONS },
  { key: 'type', label: 'TYPE', options: PROJECT_TYPE_OPTIONS }
];

export const QUESTIONNAIRES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: QUESTIONNAIRE_STATUS_OPTIONS }
];

export const PROPOSALS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PROPOSAL_STATUS_OPTIONS }
];

export const CONTRACTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: CONTRACT_STATUS_OPTIONS }
];

export const CONTACTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: CONTACT_STATUS_OPTIONS }
];

export const DOCUMENT_REQUESTS_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' }
];

export const DOCUMENT_REQUESTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: DOCUMENT_REQUESTS_STATUS_OPTIONS }
];

export const AD_HOC_REQUESTS_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const AD_HOC_REQUESTS_PRIORITY_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

export const AD_HOC_REQUESTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: AD_HOC_REQUESTS_STATUS_OPTIONS },
  { key: 'priority', label: 'PRIORITY', options: AD_HOC_REQUESTS_PRIORITY_OPTIONS }
];

export const GLOBAL_TASKS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: GLOBAL_TASK_STATUS_OPTIONS },
  { key: 'priority', label: 'PRIORITY', options: GLOBAL_TASK_PRIORITY_OPTIONS }
];

export const DELIVERABLES_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'delivered', label: 'Delivered' }
];

export const DELIVERABLES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: DELIVERABLES_STATUS_OPTIONS }
];

export const DELETED_ITEMS_TYPE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Types' },
  { value: 'client', label: 'Clients' },
  { value: 'project', label: 'Projects' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'file', label: 'Files' },
  { value: 'message', label: 'Messages' },
  { value: 'contact', label: 'Contacts' }
];

export const DELETED_ITEMS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'type', label: 'TYPE', options: DELETED_ITEMS_TYPE_OPTIONS }
];

// ============================================
// DESIGN REVIEW FILTER OPTIONS
// ============================================

export const DESIGN_REVIEW_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'revision-requested', label: 'Needs Revision' },
  { value: 'rejected', label: 'Rejected' }
];

export const DESIGN_REVIEWS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: DESIGN_REVIEW_STATUS_OPTIONS }
];

// ============================================
// FILE TYPE FILTER OPTIONS
// ============================================

export const FILE_TYPE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Types' },
  { value: 'folder', label: 'Folders' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' }
];

export const FILES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'type', label: 'TYPE', options: FILE_TYPE_OPTIONS }
];

// ============================================
// TIME TRACKING FILTER OPTIONS
// ============================================

export const TIME_TRACKING_BILLABLE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Entries' },
  { value: 'billable', label: 'Billable' },
  { value: 'non-billable', label: 'Non-Billable' }
];

export const TIME_TRACKING_DATE_RANGE_OPTIONS: FilterOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' }
];

export const TIME_TRACKING_FILTER_CONFIG: FilterConfig[] = [
  { key: 'billable', label: 'BILLABLE', options: TIME_TRACKING_BILLABLE_OPTIONS }
];

// ============================================
// ARTICLE FILTER OPTIONS
// ============================================

export const ARTICLE_STATUS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Status' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' }
];

export const ARTICLES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'category', label: 'CATEGORY', options: [{ value: 'all', label: 'All Categories' }] },
  { key: 'status', label: 'STATUS', options: ARTICLE_STATUS_OPTIONS }
];

export const EMAIL_TEMPLATES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'category', label: 'CATEGORY', options: [{ value: 'all', label: 'All Categories' }] },
  { key: 'status', label: 'STATUS', options: EMAIL_TEMPLATE_STATUS_OPTIONS }
];

export const TASKS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: TASK_STATUS_OPTIONS },
  { key: 'priority', label: 'PRIORITY', options: TASK_PRIORITY_OPTIONS }
];

// ============================================
// PAYMENT SCHEDULE FILTER OPTIONS
// ============================================

export const PAYMENT_INSTALLMENT_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(PAYMENT_INSTALLMENT_STATUS_CONFIG)
];

export const PAYMENT_SCHEDULES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PAYMENT_INSTALLMENT_STATUS_OPTIONS }
];

// ============================================
// CONTENT REQUEST FILTER OPTIONS
// ============================================

export const CONTENT_REQUEST_ITEM_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(CONTENT_REQUEST_ITEM_STATUS_CONFIG)
];

export const CONTENT_TYPE_OPTIONS: FilterOption[] = [
  TYPE_ALL_OPTION,
  ...labelsToFilterOptions(CONTENT_TYPE_LABELS)
];

export const CONTENT_CATEGORY_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Categories' },
  ...labelsToFilterOptions(CONTENT_CATEGORY_LABELS)
];

export const CONTENT_REQUESTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: CONTENT_REQUEST_ITEM_STATUS_OPTIONS },
  { key: 'content_type', label: 'TYPE', options: CONTENT_TYPE_OPTIONS },
  { key: 'category', label: 'CATEGORY', options: CONTENT_CATEGORY_OPTIONS }
];
