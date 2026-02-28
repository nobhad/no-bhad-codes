/**
 * Centralized Table Filter Configurations
 * Eliminates duplication across table components
 */

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
// STATUS FILTER OPTIONS (reusable across tables)
// ============================================

export const STATUS_ALL_OPTION: FilterOption = { value: 'all', label: 'All Statuses' };

export const COMMON_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' }
];

export const INVOICE_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const LEAD_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'on-hold', label: 'On Hold' }
];

export const LEAD_SOURCE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Sources' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social Media' },
  { value: 'direct', label: 'Direct' },
  { value: 'ad-campaign', label: 'Ad Campaign' }
];

export const CLIENT_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' }
];

export const PROJECT_STATUS_OPTIONS: FilterOption[] = [
  STATUS_ALL_OPTION,
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const PROJECT_TYPE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Types' },
  { value: 'simple-site', label: 'Simple Site' },
  { value: 'business-site', label: 'Business Site' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web App' },
  { value: 'browser-extension', label: 'Browser Extension' }
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
  { value: 'all', label: 'All Types' },
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' }
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
  { key: 'status', label: 'STATUS', options: LEAD_STATUS_OPTIONS }
];

export const PROJECTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PROJECT_STATUS_OPTIONS }
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
