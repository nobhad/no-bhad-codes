/**
 * ===============================================
 * TABLE DEFINITIONS
 * ===============================================
 * @file src/config/table-definitions.ts
 *
 * Shared column definitions and feature flags for EJS hybrid tables.
 * Used by both server-side EJS rendering and client-side TableManager.
 * No React dependencies — pure TypeScript.
 */

import type { StatusConfig } from './status-configs';
import {
  CLIENT_STATUS_CONFIG,
  INVOICE_STATUS_CONFIG,
  PROJECT_STATUS_CONFIG,
  LEAD_STATUS_CONFIG
} from './status-configs';

// ============================================
// TYPES
// ============================================

/** Cell display type determines how the value is formatted */
export type CellType =
  | 'text'
  | 'date'
  | 'currency'
  | 'status'
  | 'count'
  | 'email'
  | 'phone'
  | 'link'
  | 'name'
  | 'boolean'
  | 'filesize';

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Column definition for a table */
export interface ColumnDef {
  /** Unique column identifier (matches data property key) */
  id: string;
  /** Column header label */
  label: string;
  /** Cell display type */
  type: CellType;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** CSS class(es) for the column (e.g., 'name-col', 'status-col') */
  className?: string;
  /** Status config for status-type columns */
  statusConfig?: StatusConfig;
  /** Whether this column is the primary/clickable column */
  primary?: boolean;
  /** Whether to hide on mobile */
  hideMobile?: boolean;
  /** Whether to hide on tablet */
  hideTablet?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Secondary data key (shown below primary text) */
  secondaryKey?: string;
  /** Format options passed to the formatter */
  formatOptions?: Record<string, unknown>;
}

/** Features toggles for a table */
export interface TableFeatures {
  /** Enable client-side search */
  search?: boolean;
  /** Enable column sorting */
  sort?: boolean;
  /** Enable pagination */
  paginate?: boolean;
  /** Enable row selection / bulk actions */
  select?: boolean;
  /** Enable CSV export */
  export?: boolean;
  /** Enable filter dropdowns */
  filter?: boolean;
  /** Enable refresh button */
  refresh?: boolean;
  /** Enable row click navigation */
  rowClick?: boolean;
}

/** Filter definition for dropdowns */
export interface FilterDef {
  /** Filter identifier (matches data property key) */
  id: string;
  /** Display label */
  label: string;
  /** Available options */
  options: { value: string; label: string }[];
}

/** Complete table definition */
export interface TableDef {
  /** Unique table identifier */
  id: string;
  /** Display title */
  title: string;
  /** Column definitions */
  columns: ColumnDef[];
  /** Feature flags */
  features: TableFeatures;
  /** Default sort configuration */
  defaultSort?: { column: string; direction: SortDirection };
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state icon name (Lucide icon) */
  emptyIcon?: string;
  /** API endpoint for data fetching (used by server route) */
  apiEndpoint?: string;
  /** Default page size */
  pageSize?: number;
  /** Row click navigation target (e.g., 'client-detail') */
  rowClickTarget?: string;
  /** Filter definitions */
  filters?: FilterDef[];
  /** Portal type this table belongs to */
  portal: 'admin' | 'client' | 'both';
}

// ============================================
// TABLE DEFINITIONS
// ============================================

const DEFAULT_PAGE_SIZE = 25;

export const TABLE_DEFS: Record<string, TableDef> = {
  'admin-clients': {
    id: 'admin-clients',
    title: 'Clients',
    portal: 'admin',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No clients found',
    emptyIcon: 'Inbox',
    rowClickTarget: 'client-detail',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: {
      search: true,
      sort: true,
      paginate: true,
      select: true,
      export: true,
      filter: true,
      refresh: true,
      rowClick: true
    },
    filters: [
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: 'All Statuses' },
          ...CLIENT_STATUS_CONFIG.options.map((o) => ({ value: o.value, label: o.label }))
        ]
      },
      {
        id: 'type',
        label: 'Type',
        options: [
          { value: 'all', label: 'All Types' },
          { value: 'business', label: 'Business' },
          { value: 'personal', label: 'Personal' }
        ]
      }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'select-col' },
      {
        id: 'name',
        label: 'Name',
        type: 'name',
        sortable: true,
        primary: true,
        className: 'name-col',
        secondaryKey: 'email'
      },
      { id: 'email', label: 'Email', type: 'email', sortable: true, className: 'email-col', hideMobile: true },
      { id: 'phone', label: 'Phone', type: 'phone', hideMobile: true, className: 'phone-col' },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: CLIENT_STATUS_CONFIG, className: 'status-col' },
      { id: 'client_type', label: 'Type', type: 'text', sortable: true, className: 'type-col', hideTablet: true },
      { id: 'projectCount', label: 'Projects', type: 'count', sortable: true, align: 'right', className: 'count-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'actions-col' }
    ]
  },

  'admin-contacts': {
    id: 'admin-contacts',
    title: 'Contacts',
    portal: 'admin',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No contacts found',
    emptyIcon: 'Inbox',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: {
      search: true,
      sort: true,
      paginate: true,
      select: true,
      export: true,
      refresh: true
    },
    columns: [
      { id: '_select', label: '', type: 'text', className: 'select-col' },
      {
        id: 'name',
        label: 'Name',
        type: 'name',
        sortable: true,
        primary: true,
        className: 'name-col',
        secondaryKey: 'role'
      },
      { id: 'email', label: 'Email', type: 'email', sortable: true, className: 'email-col' },
      { id: 'phone', label: 'Phone', type: 'phone', className: 'phone-col', hideMobile: true },
      { id: 'company', label: 'Company', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'isPrimary', label: 'Primary', type: 'boolean', className: 'type-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'actions-col' }
    ]
  },

  'portal-invoices': {
    id: 'portal-invoices',
    title: 'Invoices',
    portal: 'client',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No invoices yet',
    emptyIcon: 'FileText',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: {
      search: true,
      sort: true,
      paginate: true,
      select: false,
      export: false,
      refresh: true,
      rowClick: false
    },
    columns: [
      {
        id: 'invoice_number',
        label: 'Invoice #',
        type: 'text',
        sortable: true,
        primary: true,
        className: 'name-col'
      },
      { id: 'project_name', label: 'Project', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: INVOICE_STATUS_CONFIG, className: 'status-col' },
      { id: 'amount', label: 'Amount', type: 'currency', sortable: true, align: 'right', className: 'amount-col' },
      { id: 'due_date', label: 'Due Date', type: 'date', sortable: true, className: 'date-col', hideMobile: true },
      { id: 'created_at', label: 'Issued', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'actions-col' }
    ]
  },

  'admin-invoices': {
    id: 'admin-invoices',
    title: 'Invoices',
    portal: 'admin',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No invoices found',
    emptyIcon: 'FileText',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: {
      search: true,
      sort: true,
      paginate: true,
      select: true,
      export: true,
      filter: true,
      refresh: true,
      rowClick: true
    },
    filters: [
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: 'All Statuses' },
          ...INVOICE_STATUS_CONFIG.options.map((o) => ({ value: o.value, label: o.label }))
        ]
      }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'select-col' },
      {
        id: 'invoice_number',
        label: 'Invoice #',
        type: 'text',
        sortable: true,
        primary: true,
        className: 'name-col',
        secondaryKey: 'client_name'
      },
      { id: 'client_name', label: 'Client', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: INVOICE_STATUS_CONFIG, className: 'status-col' },
      { id: 'amount', label: 'Amount', type: 'currency', sortable: true, align: 'right', className: 'amount-col' },
      { id: 'due_date', label: 'Due Date', type: 'date', sortable: true, className: 'date-col', hideMobile: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'actions-col' }
    ]
  },

  'admin-projects': {
    id: 'admin-projects',
    title: 'Projects',
    portal: 'admin',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No projects found',
    emptyIcon: 'Inbox',
    rowClickTarget: 'project-detail',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: {
      search: true,
      sort: true,
      paginate: true,
      select: true,
      export: true,
      filter: true,
      refresh: true,
      rowClick: true
    },
    filters: [
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: 'All Statuses' },
          ...PROJECT_STATUS_CONFIG.options.map((o) => ({ value: o.value, label: o.label }))
        ]
      }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'select-col' },
      {
        id: 'name',
        label: 'Project',
        type: 'text',
        sortable: true,
        primary: true,
        className: 'name-col',
        secondaryKey: 'client_name'
      },
      { id: 'client_name', label: 'Client', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: PROJECT_STATUS_CONFIG, className: 'status-col' },
      { id: 'budget', label: 'Budget', type: 'currency', sortable: true, align: 'right', className: 'amount-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'actions-col' }
    ]
  },

  'admin-leads': {
    id: 'admin-leads',
    title: 'Leads',
    portal: 'admin',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No leads found',
    emptyIcon: 'Inbox',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: {
      search: true,
      sort: true,
      paginate: true,
      select: true,
      export: true,
      filter: true,
      refresh: true
    },
    filters: [
      {
        id: 'status',
        label: 'Status',
        options: [
          { value: 'all', label: 'All Statuses' },
          ...LEAD_STATUS_CONFIG.options.map((o) => ({ value: o.value, label: o.label }))
        ]
      }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'select-col' },
      { id: 'name', label: 'Name', type: 'name', sortable: true, primary: true, className: 'name-col', secondaryKey: 'company' },
      { id: 'email', label: 'Email', type: 'email', sortable: true, className: 'email-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: LEAD_STATUS_CONFIG, className: 'status-col' },
      { id: 'source', label: 'Source', type: 'text', sortable: true, className: 'type-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'actions-col' }
    ]
  }
};

// ============================================
// LOOKUP HELPERS
// ============================================

/** Get a table definition by ID */
export function getTableDef(tableId: string): TableDef | undefined {
  return TABLE_DEFS[tableId];
}

/** Get all table IDs for a portal type */
export function getTableIdsForPortal(portal: 'admin' | 'client'): string[] {
  return Object.keys(TABLE_DEFS).filter(
    (id) => TABLE_DEFS[id].portal === portal || TABLE_DEFS[id].portal === 'both'
  );
}

/** Check if a tab has an EJS table definition */
export function hasEjsTable(tabId: string): boolean {
  return tabId in TABLE_DEFS;
}
