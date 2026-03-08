/**
 * ===============================================
 * TAB DATA SERVICE
 * ===============================================
 * @file server/services/tab-data-service.ts
 *
 * Server-side data fetching for EJS hybrid tables.
 * Reuses existing database queries from API routes.
 */

import { getDatabase } from '../database/init.js';
import { cacheService } from './cache-service.js';
import { logger } from './logger.js';

// ============================================
// CACHE CONFIGURATION
// ============================================

/** TTL in seconds for admin tab data (shared across all admins) */
const ADMIN_CACHE_TTL_SECONDS = 300; // 5 minutes

/** TTL in seconds for client/portal tab data (user-scoped) */
const CLIENT_CACHE_TTL_SECONDS = 120; // 2 minutes

/** Cache tag used for all tab data entries */
const TAB_DATA_CACHE_TAG = 'tab-data';

// ============================================
// TYPES
// ============================================

export interface TabDataResult {
  rows: Record<string, unknown>[];
  stats: Record<string, number>;
}

interface FetchContext {
  /** User role: 'admin' or 'client' */
  role: 'admin' | 'client';
  /** Authenticated user ID */
  userId: number;
}

// ============================================
// DATA FETCHERS
// ============================================

async function fetchAdminClients(): Promise<TabDataResult> {
  const db = getDatabase();

  const rows = await db.all(`
    SELECT
      c.id,
      c.company_name,
      c.contact_name,
      c.email,
      c.phone,
      c.status,
      c.client_type,
      c.created_at,
      c.updated_at,
      COUNT(DISTINCT p.id) as projectCount,
      COUNT(DISTINCT i.id) as invoiceCount
    FROM clients c
    LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NULL
    LEFT JOIN invoices i ON i.client_id = c.id AND i.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);

  // Compute display name for the 'name' column
  const transformedRows = rows.map((row: Record<string, unknown>) => ({
    ...row,
    name: row.client_type === 'business'
      ? (row.company_name || row.contact_name || '—')
      : (row.contact_name || row.company_name || '—')
  }));

  const stats = {
    total: rows.length,
    active: rows.filter((c: Record<string, unknown>) => c.status === 'active').length,
    inactive: rows.filter((c: Record<string, unknown>) => c.status === 'inactive').length
  };

  return { rows: transformedRows, stats };
}

async function fetchAdminContacts(): Promise<TabDataResult> {
  const db = getDatabase();

  // Get explicit contacts from client_contacts table
  const explicitRows = await db.all(`
    SELECT
      cc.id,
      cc.first_name,
      cc.last_name,
      cc.email,
      cc.phone,
      cc.role,
      cc.is_primary as isPrimary,
      cc.client_id,
      c.company_name as company,
      cc.created_at,
      cc.updated_at
    FROM client_contacts cc
    JOIN clients c ON cc.client_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY cc.is_primary DESC, cc.created_at DESC
  `);

  // Get clients' own contact info
  const clientRows = await db.all(`
    SELECT
      c.id,
      c.contact_name,
      c.email,
      c.phone,
      c.company_name as company,
      c.created_at,
      c.updated_at
    FROM clients c
    WHERE c.deleted_at IS NULL
  `);

  const clientIdsWithContacts = new Set(
    explicitRows.map((r: Record<string, unknown>) => r.client_id)
  );

  // Transform explicit contacts
  const transformedExplicit = explicitRows.map((row: Record<string, unknown>) => ({
    ...row,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ') || '—',
    isPrimary: (row.isPrimary as number) === 1
  }));

  // Transform client rows into contact format
  const transformedClients = clientRows.map((row: Record<string, unknown>) => {
    const contactName = (row.contact_name as string) || '';
    const nameParts = contactName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const isPrimary = !clientIdsWithContacts.has(row.id);

    return {
      id: 100000 + (row.id as number),
      first_name: firstName,
      last_name: lastName,
      name: contactName || '—',
      email: row.email,
      phone: row.phone,
      role: 'client',
      isPrimary,
      client_id: row.id,
      company: row.company,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  });

  const allRows: Record<string, unknown>[] = [...transformedExplicit, ...transformedClients];

  // Sort: primary first, then by creation date
  allRows.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });

  const stats = {
    total: allRows.length,
    primary: allRows.filter((c) => c.isPrimary).length
  };

  return { rows: allRows, stats };
}

async function fetchPortalInvoices(ctx: FetchContext): Promise<TabDataResult> {
  const db = getDatabase();

  const rows = await db.all(`
    SELECT
      i.id,
      i.invoice_number,
      i.status,
      i.amount_total as amount,
      i.due_date,
      i.created_at,
      p.name as project_name
    FROM invoices i
    LEFT JOIN projects p ON i.project_id = p.id
    WHERE i.client_id = ? AND i.deleted_at IS NULL
    ORDER BY i.created_at DESC
  `, [ctx.userId]);

  let totalOutstanding = 0;
  let totalPaid = 0;

  rows.forEach((inv: Record<string, unknown>) => {
    const amount = Number(inv.amount) || 0;
    if (inv.status === 'paid') {
      totalPaid += amount;
    } else if (['sent', 'viewed', 'partial', 'overdue'].includes(inv.status as string)) {
      totalOutstanding += amount;
    }
  });

  const stats = {
    total: rows.length,
    outstanding: totalOutstanding,
    paid: totalPaid
  };

  return { rows: rows as Record<string, unknown>[], stats };
}

async function fetchAdminInvoices(): Promise<TabDataResult> {
  const db = getDatabase();

  const rows = await db.all(`
    SELECT
      i.id,
      i.invoice_number,
      i.status,
      i.amount_total as amount,
      i.due_date,
      i.created_at,
      c.company_name as client_name
    FROM invoices i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.deleted_at IS NULL
    ORDER BY i.created_at DESC
  `);

  let totalAmount = 0;
  let totalPaid = 0;

  rows.forEach((inv: Record<string, unknown>) => {
    const amount = Number(inv.amount) || 0;
    totalAmount += amount;
    if (inv.status === 'paid') totalPaid += amount;
  });

  const stats = {
    total: rows.length,
    totalAmount,
    totalPaid,
    outstanding: totalAmount - totalPaid
  };

  return { rows: rows as Record<string, unknown>[], stats };
}

async function fetchAdminProjects(): Promise<TabDataResult> {
  const db = getDatabase();

  const rows = await db.all(`
    SELECT
      p.id,
      p.name,
      p.status,
      p.budget,
      p.created_at,
      c.company_name as client_name
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.created_at DESC
  `);

  const stats = {
    total: rows.length,
    active: rows.filter((p: Record<string, unknown>) => p.status === 'active' || p.status === 'in_progress').length,
    completed: rows.filter((p: Record<string, unknown>) => p.status === 'completed').length
  };

  return { rows: rows as Record<string, unknown>[], stats };
}

async function fetchAdminLeads(): Promise<TabDataResult> {
  const db = getDatabase();

  // Leads are stored as projects — query projects table with client info
  const rows = await db.all(`
    SELECT
      p.id,
      COALESCE(c.contact_name, c.company_name, 'Unknown') as name,
      c.email,
      c.company_name as company,
      p.status,
      COALESCE(p.source_type, 'direct') as source,
      p.created_at
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.deleted_at IS NULL
    ORDER BY p.created_at DESC
  `);

  // Map project statuses to lead statuses for EJS table display
  const STATUS_MAP: Record<string, string> = {
    'pending': 'new',
    'new': 'new',
    'in-progress': 'contacted',
    'in_progress': 'contacted',
    'in-review': 'qualified',
    'completed': 'won',
    'on-hold': 'contacted',
    'cancelled': 'lost'
  };

  const transformedRows = rows.map((row: Record<string, unknown>) => ({
    ...row,
    status: STATUS_MAP[row.status as string] || (row.status as string)
  }));

  const stats = {
    total: transformedRows.length,
    new: transformedRows.filter((l) => l.status === 'new').length,
    qualified: transformedRows.filter((l) => l.status === 'qualified').length
  };

  return { rows: transformedRows as Record<string, unknown>[], stats };
}

// ============================================
// DISPATCHER
// ============================================

/**
 * Guard that throws if a non-admin user calls an admin fetcher.
 * Belt-and-suspenders alongside the route-level check.
 */
function requireAdminCtx(ctx: FetchContext): void {
  if (ctx.role !== 'admin') {
    throw new Error('Forbidden: admin-only data');
  }
}

/** Map of table IDs to their data fetch functions */
const FETCHERS: Record<string, (ctx: FetchContext) => Promise<TabDataResult>> = {
  'admin-clients': (ctx) => { requireAdminCtx(ctx); return fetchAdminClients(); },
  'admin-contacts': (ctx) => { requireAdminCtx(ctx); return fetchAdminContacts(); },
  'portal-invoices': (ctx) => fetchPortalInvoices(ctx),
  'admin-invoices': (ctx) => { requireAdminCtx(ctx); return fetchAdminInvoices(); },
  'admin-projects': (ctx) => { requireAdminCtx(ctx); return fetchAdminProjects(); },
  'admin-leads': (ctx) => { requireAdminCtx(ctx); return fetchAdminLeads(); }
};

/**
 * Fetch data for an EJS hybrid table.
 *
 * @param tabId - Table definition ID (e.g., 'admin-clients', 'portal-invoices')
 * @param role - User role ('admin' or 'client')
 * @param userId - Authenticated user ID
 * @returns Row data and stats, or null if no fetcher exists
 */
export async function fetchTabData(
  tabId: string,
  role: 'admin' | 'client',
  userId: number
): Promise<TabDataResult | null> {
  const fetcher = FETCHERS[tabId];

  if (!fetcher) {
    logger.warn(`No tab data fetcher for: ${tabId}`);
    return null;
  }

  const isAdmin = role === 'admin';
  const cacheKey = isAdmin
    ? `tab-data:${tabId}`
    : `tab-data:${tabId}:${userId}`;
  const cacheTtl = isAdmin ? ADMIN_CACHE_TTL_SECONDS : CLIENT_CACHE_TTL_SECONDS;

  // Attempt cache read
  const cached = await cacheService.get<TabDataResult>(cacheKey);
  if (cached !== null) {
    logger.debug(`[TabData] Cache hit for ${cacheKey}`);
    return cached;
  }

  try {
    const result = await fetcher({ role, userId });

    // Write-through to cache (fire-and-forget)
    cacheService
      .set(cacheKey, result, { ttl: cacheTtl, tags: [TAB_DATA_CACHE_TAG, `tab-data:${tabId}`] })
      .catch((err: unknown) => {
        logger.warn(`[TabData] Failed to cache ${cacheKey}:`, {
          error: err instanceof Error ? err : new Error(String(err))
        });
      });

    return result;
  } catch (error) {
    logger.error(`Error fetching tab data for ${tabId}:`, {
      error: error instanceof Error ? error : new Error(String(error))
    });
    throw error;
  }
}

/** Check if a tab ID has a registered data fetcher */
export function hasTabDataFetcher(tabId: string): boolean {
  return tabId in FETCHERS;
}

// ============================================
// SERVER-SIDE TABLE DEFINITIONS
// ============================================
// Lightweight table definitions for EJS rendering.
// The full definitions live in src/config/table-definitions.ts (client-side).
// This avoids cross-boundary imports between server/ and src/.

/** Status config for EJS rendering */
interface ServerStatusConfig {
  options: { value: string; label: string; variant: string }[];
}

/** Column definition for EJS rendering */
interface ServerColumnDef {
  id: string;
  label: string;
  type: string;
  sortable?: boolean;
  className?: string;
  statusConfig?: ServerStatusConfig;
  primary?: boolean;
  hideMobile?: boolean;
  hideTablet?: boolean;
  align?: string;
  secondaryKey?: string;
}

/** Table definition for EJS rendering */
export interface ServerTableDef {
  id: string;
  title: string;
  columns: ServerColumnDef[];
  features: Record<string, boolean>;
  defaultSort?: { column: string; direction: string };
  emptyMessage?: string;
  emptyIcon?: string;
  pageSize?: number;
  rowClickTarget?: string;
  filters?: { id: string; label: string; options: { value: string; label: string }[] }[];
  portal: string;
}

const CLIENT_STATUSES: ServerStatusConfig = {
  options: [
    { value: 'active', label: 'Active', variant: 'active' },
    { value: 'inactive', label: 'Inactive', variant: 'inactive' },
    { value: 'prospect', label: 'Prospect', variant: 'new' }
  ]
};

const INVOICE_STATUSES: ServerStatusConfig = {
  options: [
    { value: 'draft', label: 'Draft', variant: 'inactive' },
    { value: 'sent', label: 'Sent', variant: 'active' },
    { value: 'paid', label: 'Paid', variant: 'completed' },
    { value: 'overdue', label: 'Overdue', variant: 'cancelled' },
    { value: 'cancelled', label: 'Cancelled', variant: 'cancelled' }
  ]
};

const PROJECT_STATUSES: ServerStatusConfig = {
  options: [
    { value: 'active', label: 'Active', variant: 'active' },
    { value: 'in_progress', label: 'In Progress', variant: 'active' },
    { value: 'on_hold', label: 'On Hold', variant: 'on-hold' },
    { value: 'completed', label: 'Completed', variant: 'completed' },
    { value: 'cancelled', label: 'Cancelled', variant: 'cancelled' }
  ]
};

const LEAD_STATUSES: ServerStatusConfig = {
  options: [
    { value: 'new', label: 'New', variant: 'new' },
    { value: 'contacted', label: 'Contacted', variant: 'active' },
    { value: 'qualified', label: 'Qualified', variant: 'qualified' },
    { value: 'proposal', label: 'Proposal', variant: 'active' },
    { value: 'won', label: 'Won', variant: 'completed' },
    { value: 'lost', label: 'Lost', variant: 'cancelled' }
  ]
};

const DEFAULT_PAGE_SIZE = 25;

const SERVER_TABLE_DEFS: Record<string, ServerTableDef> = {
  'admin-clients': {
    id: 'admin-clients',
    title: 'Clients',
    portal: 'admin',
    pageSize: DEFAULT_PAGE_SIZE,
    emptyMessage: 'No clients found',
    emptyIcon: 'Inbox',
    rowClickTarget: 'client-detail',
    defaultSort: { column: 'created_at', direction: 'desc' },
    features: { search: true, sort: true, paginate: true, select: true, export: true, filter: true, refresh: true, rowClick: true },
    filters: [
      { id: 'status', label: 'Status', options: [{ value: 'all', label: 'All Statuses' }, ...CLIENT_STATUSES.options.map((o) => ({ value: o.value, label: o.label }))] },
      { id: 'type', label: 'Type', options: [{ value: 'all', label: 'All Types' }, { value: 'business', label: 'Business' }, { value: 'personal', label: 'Personal' }] }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'col-checkbox' },
      { id: 'name', label: 'Name', type: 'name', sortable: true, primary: true, className: 'name-col', secondaryKey: 'email' },
      { id: 'email', label: 'Email', type: 'email', sortable: true, className: 'email-col', hideMobile: true },
      { id: 'phone', label: 'Phone', type: 'phone', className: 'phone-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: CLIENT_STATUSES, className: 'status-col' },
      { id: 'client_type', label: 'Type', type: 'text', sortable: true, className: 'type-col', hideTablet: true },
      { id: 'projectCount', label: 'Projects', type: 'count', sortable: true, align: 'right', className: 'count-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'col-actions' }
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
    features: { search: true, sort: true, paginate: true, select: true, export: true, refresh: true },
    columns: [
      { id: '_select', label: '', type: 'text', className: 'col-checkbox' },
      { id: 'name', label: 'Name', type: 'name', sortable: true, primary: true, className: 'name-col', secondaryKey: 'role' },
      { id: 'email', label: 'Email', type: 'email', sortable: true, className: 'email-col' },
      { id: 'phone', label: 'Phone', type: 'phone', className: 'phone-col', hideMobile: true },
      { id: 'company', label: 'Company', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'isPrimary', label: 'Primary', type: 'boolean', className: 'type-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'col-actions' }
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
    features: { search: true, sort: true, paginate: true, select: false, export: false, refresh: true, rowClick: false },
    columns: [
      { id: 'invoice_number', label: 'Invoice #', type: 'text', sortable: true, primary: true, className: 'name-col' },
      { id: 'project_name', label: 'Project', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: INVOICE_STATUSES, className: 'status-col' },
      { id: 'amount', label: 'Amount', type: 'currency', sortable: true, align: 'right', className: 'amount-col' },
      { id: 'due_date', label: 'Due Date', type: 'date', sortable: true, className: 'date-col', hideMobile: true },
      { id: 'created_at', label: 'Issued', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'col-actions' }
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
    features: { search: true, sort: true, paginate: true, select: true, export: true, filter: true, refresh: true, rowClick: true },
    filters: [
      { id: 'status', label: 'Status', options: [{ value: 'all', label: 'All Statuses' }, ...INVOICE_STATUSES.options.map((o) => ({ value: o.value, label: o.label }))] }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'col-checkbox' },
      { id: 'invoice_number', label: 'Invoice #', type: 'text', sortable: true, primary: true, className: 'name-col', secondaryKey: 'client_name' },
      { id: 'client_name', label: 'Client', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: INVOICE_STATUSES, className: 'status-col' },
      { id: 'amount', label: 'Amount', type: 'currency', sortable: true, align: 'right', className: 'amount-col' },
      { id: 'due_date', label: 'Due Date', type: 'date', sortable: true, className: 'date-col', hideMobile: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'col-actions' }
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
    features: { search: true, sort: true, paginate: true, select: true, export: true, filter: true, refresh: true, rowClick: true },
    filters: [
      { id: 'status', label: 'Status', options: [{ value: 'all', label: 'All Statuses' }, ...PROJECT_STATUSES.options.map((o) => ({ value: o.value, label: o.label }))] }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'col-checkbox' },
      { id: 'name', label: 'Project', type: 'text', sortable: true, primary: true, className: 'name-col', secondaryKey: 'client_name' },
      { id: 'client_name', label: 'Client', type: 'text', sortable: true, className: 'name-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: PROJECT_STATUSES, className: 'status-col' },
      { id: 'budget', label: 'Budget', type: 'currency', sortable: true, align: 'right', className: 'amount-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'col-actions' }
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
    features: { search: true, sort: true, paginate: true, select: true, export: true, filter: true, refresh: true },
    filters: [
      { id: 'status', label: 'Status', options: [{ value: 'all', label: 'All Statuses' }, ...LEAD_STATUSES.options.map((o) => ({ value: o.value, label: o.label }))] }
    ],
    columns: [
      { id: '_select', label: '', type: 'text', className: 'col-checkbox' },
      { id: 'name', label: 'Name', type: 'name', sortable: true, primary: true, className: 'name-col', secondaryKey: 'company' },
      { id: 'email', label: 'Email', type: 'email', sortable: true, className: 'email-col', hideMobile: true },
      { id: 'status', label: 'Status', type: 'status', sortable: true, statusConfig: LEAD_STATUSES, className: 'status-col' },
      { id: 'source', label: 'Source', type: 'text', sortable: true, className: 'type-col', hideTablet: true },
      { id: 'created_at', label: 'Created', type: 'date', sortable: true, className: 'date-col', hideTablet: true },
      { id: '_actions', label: '', type: 'text', className: 'col-actions' }
    ]
  }
};

// ============================================
// CACHE INVALIDATION
// ============================================

/**
 * Invalidate cached tab data for a specific tab.
 * Clears all user-scoped variants for that tab via pattern matching.
 *
 * @param tabId - The tab ID to invalidate (e.g., 'admin-clients', 'portal-invoices')
 */
export async function invalidateTabDataCache(tabId: string): Promise<void> {
  const count = await cacheService.invalidateByPattern(`*tab-data:${tabId}*`);
  logger.info(`[TabData] Invalidated ${count} cache entries for tab: ${tabId}`);
}

/**
 * Invalidate ALL cached tab data across every tab and user.
 * Useful after bulk operations or schema migrations.
 */
export async function invalidateAllTabDataCache(): Promise<void> {
  const count = await cacheService.invalidateByTag(TAB_DATA_CACHE_TAG);
  logger.info(`[TabData] Invalidated ${count} total tab data cache entries`);
}

/**
 * Invalidate cached portal tab data for a specific user.
 * Useful when a single user's data changes (e.g., new invoice created for a client).
 *
 * @param userId - The user whose cached portal data should be cleared
 */
export async function invalidateUserTabDataCache(userId: number): Promise<void> {
  const count = await cacheService.invalidateByPattern(`*tab-data:*:${userId}`);
  logger.info(`[TabData] Invalidated ${count} cache entries for user: ${userId}`);
}

/** Get server-side table definition by ID */
export function getServerTableDef(tabId: string): ServerTableDef | undefined {
  return SERVER_TABLE_DEFS[tabId];
}
