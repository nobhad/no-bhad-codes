/**
 * Portal Table Filter Configurations
 * Mirrors admin pattern from admin/shared/filterConfigs.ts
 *
 * Where portal statuses overlap with admin, options are derived from
 * the canonical *_CONFIG definitions in admin/types.ts.
 */

import type { FilterConfig } from '../../admin/shared/filterConfigs';
import {
  INVOICE_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  configToFilterOptions
} from '../../admin/types';

export type { FilterConfig };
export type { FilterOption } from '../../admin/shared/filterConfigs';

// ============================================
// FILTER FACTORY
// ============================================

/**
 * Creates a reusable filter function for portal list views.
 * Checks search text against specified string fields and
 * matches filter values against item properties.
 *
 * @param searchFields - Array of field names to search against
 * @param filterMappings - Map of filter key to item field (default: { status: 'status' })
 */
export function createFilterFn<T>(
  searchFields: (keyof T)[],
  filterMappings: Record<string, keyof T> = { status: 'status' as keyof T }
): (item: T, filters: Record<string, string[]>, search: string) => boolean {
  return (item: T, filters: Record<string, string[]>, search: string): boolean => {
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      const matchesSearch = searchFields.some((field) => {
        const value = item[field];
        return typeof value === 'string' && value.toLowerCase().includes(s);
      });
      if (!matchesSearch) return false;
    }

    // Multi-select filter matching — empty array means "all"
    for (const [filterKey, itemField] of Object.entries(filterMappings)) {
      const selected = filters[filterKey];
      if (selected && selected.length > 0) {
        if (!selected.includes(String(item[itemField]))) return false;
      }
    }

    return true;
  };
}

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
  ...configToFilterOptions(INVOICE_STATUS_CONFIG, [
    'draft',
    'sent',
    'viewed',
    'partial',
    'paid',
    'overdue',
    'cancelled'
  ])
];

export const PORTAL_INVOICES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_INVOICE_STATUS_OPTIONS }
];

// ============================================
// PROJECT FILTERS
// ============================================

export const PORTAL_PROJECT_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  ...configToFilterOptions(PROJECT_STATUS_CONFIG, [
    'active',
    'in-progress',
    'on-hold',
    'completed',
    'pending'
  ])
];

export const PORTAL_PROJECTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_PROJECT_STATUS_OPTIONS }
];

// ============================================
// DOCUMENT REQUEST FILTERS
// ============================================

export const PORTAL_DOCREQUEST_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'requested', label: 'Requested' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'under_review', label: 'Under Review' },
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

// ============================================
// PROPOSAL FILTERS
// ============================================

export const PORTAL_PROPOSAL_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' }
];

export const PORTAL_PROPOSALS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_PROPOSAL_STATUS_OPTIONS }
];

// ============================================
// DELIVERABLE FILTERS
// ============================================

export const PORTAL_DELIVERABLE_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'revision_requested', label: 'Revision Requested' },
  { value: 'locked', label: 'Locked' }
];

export const PORTAL_DELIVERABLES_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_DELIVERABLE_STATUS_OPTIONS }
];

// ============================================
// CONTRACT FILTERS
// ============================================

export const PORTAL_CONTRACT_STATUS_OPTIONS = [
  STATUS_ALL_OPTION,
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'signed', label: 'Signed' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' }
];

export const PORTAL_CONTRACTS_FILTER_CONFIG: FilterConfig[] = [
  { key: 'status', label: 'STATUS', options: PORTAL_CONTRACT_STATUS_OPTIONS }
];
