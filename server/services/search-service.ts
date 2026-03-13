/**
 * ===============================================
 * SEARCH SERVICE
 * ===============================================
 * @file server/services/search-service.ts
 *
 * Unified search across projects, clients, messages,
 * and invoices. Used by the command palette.
 */

import { getDatabase } from '../database/init.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_RESULTS_PER_TYPE = 5;

// ============================================
// TYPES
// ============================================

export interface SearchResult {
  type: 'project' | 'client' | 'message' | 'invoice';
  id: number;
  title: string;
  subtitle: string;
  path: string;
}

interface SearchContext {
  isAdmin: boolean;
  userId: number;
  searchPattern: string;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

async function searchProjects(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const query = ctx.isAdmin
    ? `SELECT id, project_name, status FROM active_projects
       WHERE project_name LIKE ? OR description LIKE ?
       ORDER BY updated_at DESC LIMIT ?`
    : `SELECT id, project_name, status FROM active_projects
       WHERE client_id = ? AND (project_name LIKE ? OR description LIKE ?)
       ORDER BY updated_at DESC LIMIT ?`;

  const params = ctx.isAdmin
    ? [ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE]
    : [ctx.userId, ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE];

  const rows = await db.all(query, params);
  return rows.map((p) => ({
    type: 'project' as const,
    id: p.id as number,
    title: p.project_name as string,
    subtitle: (p.status as string) || 'project',
    path: ctx.isAdmin ? `/projects/${p.id}` : '/projects'
  }));
}

async function searchMessages(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const query = ctx.isAdmin
    ? `SELECT mt.id, mt.subject, mt.last_message_at
       FROM active_message_threads mt
       WHERE mt.subject LIKE ?
       ORDER BY mt.last_message_at DESC LIMIT ?`
    : `SELECT mt.id, mt.subject, mt.last_message_at
       FROM active_message_threads mt
       WHERE mt.client_id = ? AND mt.subject LIKE ?
       ORDER BY mt.last_message_at DESC LIMIT ?`;

  const params = ctx.isAdmin
    ? [ctx.searchPattern, MAX_RESULTS_PER_TYPE]
    : [ctx.userId, ctx.searchPattern, MAX_RESULTS_PER_TYPE];

  const rows = await db.all(query, params);
  return rows.map((t) => ({
    type: 'message' as const,
    id: t.id as number,
    title: t.subject as string,
    subtitle: 'message thread',
    path: '/messages'
  }));
}

async function searchInvoices(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const query = ctx.isAdmin
    ? `SELECT i.id, i.invoice_number, i.status, i.total_amount
       FROM active_invoices i
       WHERE i.invoice_number LIKE ? OR CAST(i.total_amount AS TEXT) LIKE ?
       ORDER BY i.created_at DESC LIMIT ?`
    : `SELECT i.id, i.invoice_number, i.status, i.total_amount
       FROM active_invoices i
       JOIN active_projects p ON i.project_id = p.id
       WHERE p.client_id = ? AND (i.invoice_number LIKE ? OR CAST(i.total_amount AS TEXT) LIKE ?)
       ORDER BY i.created_at DESC LIMIT ?`;

  const params = ctx.isAdmin
    ? [ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE]
    : [ctx.userId, ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE];

  const rows = await db.all(query, params);
  return rows.map((inv) => ({
    type: 'invoice' as const,
    id: inv.id as number,
    title: (inv.invoice_number as string) || `Invoice #${inv.id}`,
    subtitle: (inv.status as string) || 'invoice',
    path: '/invoices'
  }));
}

async function searchClients(searchPattern: string): Promise<SearchResult[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT id, contact_name, company_name, email
     FROM active_clients
     WHERE contact_name LIKE ? OR company_name LIKE ? OR email LIKE ?
     ORDER BY updated_at DESC LIMIT ?`,
    [searchPattern, searchPattern, searchPattern, MAX_RESULTS_PER_TYPE]
  );

  return rows.map((c) => ({
    type: 'client' as const,
    id: c.id as number,
    title: (c.company_name as string) || (c.contact_name as string) || (c.email as string),
    subtitle: 'client',
    path: `/clients/${c.id}`
  }));
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Run a global search across all entity types.
 * Results are permission-scoped based on user type and ID.
 */
async function globalSearch(
  query: string,
  user: { id: number; type: string }
): Promise<SearchResult[]> {
  const isAdmin = user.type === 'admin';
  const searchPattern = `%${query}%`;
  const ctx: SearchContext = { isAdmin, userId: user.id, searchPattern };

  const [projects, messages, invoices] = await Promise.all([
    searchProjects(ctx),
    searchMessages(ctx),
    searchInvoices(ctx)
  ]);

  const results: SearchResult[] = [...projects, ...messages, ...invoices];

  if (isAdmin) {
    const clients = await searchClients(searchPattern);
    results.push(...clients);
  }

  return results;
}

export const searchService = { globalSearch };
