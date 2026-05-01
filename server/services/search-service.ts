/**
 * ===============================================
 * SEARCH SERVICE
 * ===============================================
 * @file server/services/search-service.ts
 *
 * Unified search across 9 entity types with
 * relevance scoring and permission scoping.
 * Used by the command palette (Cmd+K).
 */

import { getDatabase } from '../database/init.js';

// ============================================
// CONSTANTS
// ============================================

const MAX_RESULTS_PER_TYPE = 5;

/** Strip LIKE special characters to prevent unintended wildcard matching */
function sanitizeLikeQuery(str: string): string {
  return str.replace(/[%_]/g, '');
}

/** Relevance scoring weights */
const SCORE_EXACT_NAME = 0.9;
const SCORE_PARTIAL_NAME = 0.7;
const SCORE_DESCRIPTION = 0.5;
const SCORE_NOTES = 0.3;
const SCORE_RECENCY_BOOST = 0.1;
const SCORE_ACTIVE_BOOST = 0.05;

const RECENCY_DAYS = 30;

// ============================================
// TYPES
// ============================================

export type SearchEntityType =
  | 'project' | 'client' | 'message' | 'invoice'
  | 'proposal' | 'contract' | 'lead' | 'task' | 'file';

export interface SearchResult {
  type: SearchEntityType;
  id: number;
  title: string;
  subtitle: string;
  path: string;
  relevanceScore: number;
}

interface SearchContext {
  isAdmin: boolean;
  userId: number;
  searchPattern: string;
  query: string;
}

// ============================================
// SCORING HELPER
// ============================================

function calculateRelevance(
  query: string,
  title: string,
  description: string | null,
  updatedAt: string | null,
  isActive: boolean
): number {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = (title || '').toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  let score = 0;

  // Exact name match
  if (lowerTitle === lowerQuery) {
    score = SCORE_EXACT_NAME;
  } else if (lowerTitle.includes(lowerQuery)) {
    score = SCORE_PARTIAL_NAME;
  } else if (lowerDesc.includes(lowerQuery)) {
    score = SCORE_DESCRIPTION;
  } else {
    score = SCORE_NOTES;
  }

  // Recency boost
  if (updatedAt) {
    const daysSince = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < RECENCY_DAYS) {
      score += SCORE_RECENCY_BOOST;
    }
  }

  // Active status boost
  if (isActive) {
    score += SCORE_ACTIVE_BOOST;
  }

  return Math.round(score * 100) / 100;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

async function searchProjects(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const query = ctx.isAdmin
    ? `SELECT id, project_name, status, description, updated_at FROM active_projects
       WHERE project_name LIKE ? OR description LIKE ?
       ORDER BY updated_at DESC LIMIT ?`
    : `SELECT id, project_name, status, description, updated_at FROM active_projects
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
    path: ctx.isAdmin ? `/project-detail/${p.id}` : '/dashboard',
    relevanceScore: calculateRelevance(
      ctx.query, p.project_name as string, p.description as string | null,
      p.updated_at as string | null, (p.status as string) === 'active'
    )
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
    path: '/messages',
    relevanceScore: calculateRelevance(
      ctx.query, t.subject as string, null,
      t.last_message_at as string | null, true
    )
  }));
}

async function searchInvoices(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const query = ctx.isAdmin
    ? `SELECT i.id, i.invoice_number, i.status, i.total_amount, i.created_at
       FROM active_invoices i
       WHERE i.invoice_number LIKE ? OR CAST(i.total_amount AS TEXT) LIKE ?
       ORDER BY i.created_at DESC LIMIT ?`
    : `SELECT i.id, i.invoice_number, i.status, i.total_amount, i.created_at
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
    path: '/invoices',
    relevanceScore: calculateRelevance(
      ctx.query, (inv.invoice_number as string) || '', null,
      inv.created_at as string | null,
      (inv.status as string) === 'sent' || (inv.status as string) === 'paid'
    )
  }));
}

async function searchClients(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT id, contact_name, company_name, email, name, updated_at
     FROM active_clients
     WHERE contact_name LIKE ? OR company_name LIKE ? OR email LIKE ? OR name LIKE ?
     ORDER BY updated_at DESC LIMIT ?`,
    [ctx.searchPattern, ctx.searchPattern, ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE]
  );

  return rows.map((c) => ({
    type: 'client' as const,
    id: c.id as number,
    title: (c.name as string) || (c.company_name as string) || (c.contact_name as string) || (c.email as string),
    subtitle: 'client',
    path: `/client-detail/${c.id}`,
    relevanceScore: calculateRelevance(
      ctx.query,
      (c.name as string) || (c.company_name as string) || '',
      null, c.updated_at as string | null, true
    )
  }));
}

async function searchProposals(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT p.id, p.title, p.status, p.created_at
     FROM proposals p
     WHERE (p.title LIKE ? OR p.scope LIKE ?)
       AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC LIMIT ?`,
    [ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE]
  );

  return rows.map((p) => ({
    type: 'proposal' as const,
    id: p.id as number,
    title: (p.title as string) || `Proposal #${p.id}`,
    subtitle: (p.status as string) || 'proposal',
    path: '/proposals',
    relevanceScore: calculateRelevance(
      ctx.query, (p.title as string) || '', null,
      p.created_at as string | null,
      (p.status as string) === 'sent' || (p.status as string) === 'draft'
    )
  }));
}

async function searchContracts(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT c.id, c.title, c.status, c.created_at
     FROM contracts c
     WHERE (c.title LIKE ? OR c.scope LIKE ?)
       AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC LIMIT ?`,
    [ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE]
  );

  return rows.map((c) => ({
    type: 'contract' as const,
    id: c.id as number,
    title: (c.title as string) || `Contract #${c.id}`,
    subtitle: (c.status as string) || 'contract',
    path: '/contracts',
    relevanceScore: calculateRelevance(
      ctx.query, (c.title as string) || '', null,
      c.created_at as string | null, (c.status as string) === 'signed'
    )
  }));
}

async function searchLeads(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT l.id, l.name, l.email, l.status, l.updated_at
     FROM leads l
     WHERE (l.name LIKE ? OR l.email LIKE ? OR l.company LIKE ?)
       AND l.deleted_at IS NULL
     ORDER BY l.updated_at DESC LIMIT ?`,
    [ctx.searchPattern, ctx.searchPattern, ctx.searchPattern, MAX_RESULTS_PER_TYPE]
  );

  return rows.map((l) => ({
    type: 'lead' as const,
    id: l.id as number,
    title: (l.name as string) || (l.email as string),
    subtitle: (l.status as string) || 'lead',
    path: '/leads',
    relevanceScore: calculateRelevance(
      ctx.query, (l.name as string) || '', null,
      l.updated_at as string | null,
      (l.status as string) !== 'lost' && (l.status as string) !== 'archived'
    )
  }));
}

async function searchTasks(ctx: SearchContext): Promise<SearchResult[]> {
  const db = getDatabase();

  const rows = await db.all(
    `SELECT t.id, t.title, t.status, t.updated_at
     FROM tasks t
     WHERE t.title LIKE ?
       AND t.deleted_at IS NULL
     ORDER BY t.updated_at DESC LIMIT ?`,
    [ctx.searchPattern, MAX_RESULTS_PER_TYPE]
  );

  return rows.map((t) => ({
    type: 'task' as const,
    id: t.id as number,
    title: t.title as string,
    subtitle: (t.status as string) || 'task',
    path: '/tasks',
    relevanceScore: calculateRelevance(
      ctx.query, t.title as string, null,
      t.updated_at as string | null,
      (t.status as string) !== 'completed' && (t.status as string) !== 'cancelled'
    )
  }));
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Run a global search across all entity types.
 * Results are permission-scoped based on user type and ID.
 * Returns results sorted by relevance score.
 */
async function globalSearch(
  query: string,
  user: { id: number; type: string }
): Promise<SearchResult[]> {
  const isAdmin = user.type === 'admin';
  const searchPattern = `%${sanitizeLikeQuery(query)}%`;
  const ctx: SearchContext = { isAdmin, userId: user.id, searchPattern, query };

  // Run all searches in parallel
  const searches: Promise<SearchResult[]>[] = [
    searchProjects(ctx),
    searchMessages(ctx),
    searchInvoices(ctx)
  ];

  if (isAdmin) {
    searches.push(
      searchClients(ctx),
      searchProposals(ctx),
      searchContracts(ctx),
      searchLeads(ctx),
      searchTasks(ctx)
    );
  }

  const settled = await Promise.allSettled(searches);
  const results: SearchResult[] = [];

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return results;
}

export const searchService = { globalSearch };
