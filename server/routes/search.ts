/**
 * ===============================================
 * GLOBAL SEARCH ROUTES
 * ===============================================
 * @file server/routes/search.ts
 *
 * Unified search endpoint that queries across
 * projects, clients, messages, and invoices.
 * Used by the command palette for entity search.
 */

import express from 'express';
import { getDatabase } from '../database/init.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';
import { sendSuccess, errorResponse, ErrorCodes } from '../utils/api-response.js';

const router = express.Router();

// ============================================
// CONSTANTS
// ============================================

const MAX_RESULTS_PER_TYPE = 5;
const MIN_QUERY_LENGTH = 2;

// ============================================
// TYPES
// ============================================

interface SearchResult {
  type: 'project' | 'client' | 'message' | 'invoice';
  id: number;
  title: string;
  subtitle: string;
  path: string;
}

// ============================================
// GLOBAL SEARCH
// ============================================

/**
 * GET /api/search?q=<query>
 * Searches across projects, clients, messages, and invoices.
 * Results are permission-scoped.
 */
router.get(
  '/',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const query = (req.query.q as string || '').trim();

    if (query.length < MIN_QUERY_LENGTH) {
      return errorResponse(res, `Query must be at least ${MIN_QUERY_LENGTH} characters`, 400, ErrorCodes.VALIDATION_ERROR);
    }

    const db = getDatabase();
    const user = req.user!;
    const isAdmin = user.type === 'admin';
    const searchPattern = `%${query}%`;
    const results: SearchResult[] = [];

    // --- Projects ---
    const projectQuery = isAdmin
      ? `SELECT id, project_name, status FROM active_projects
         WHERE project_name LIKE ? OR description LIKE ?
         ORDER BY updated_at DESC LIMIT ?`
      : `SELECT id, project_name, status FROM active_projects
         WHERE client_id = ? AND (project_name LIKE ? OR description LIKE ?)
         ORDER BY updated_at DESC LIMIT ?`;

    const projectParams = isAdmin
      ? [searchPattern, searchPattern, MAX_RESULTS_PER_TYPE]
      : [user.id, searchPattern, searchPattern, MAX_RESULTS_PER_TYPE];

    const projects = await db.all(projectQuery, projectParams);
    for (const p of projects) {
      results.push({
        type: 'project',
        id: p.id as number,
        title: p.project_name as string,
        subtitle: (p.status as string) || 'project',
        path: isAdmin ? `/projects/${p.id}` : `/projects`
      });
    }

    // --- Messages ---
    const messageQuery = isAdmin
      ? `SELECT mt.id, mt.subject, mt.last_message_at
         FROM active_message_threads mt
         WHERE mt.subject LIKE ?
         ORDER BY mt.last_message_at DESC LIMIT ?`
      : `SELECT mt.id, mt.subject, mt.last_message_at
         FROM active_message_threads mt
         WHERE mt.client_id = ? AND mt.subject LIKE ?
         ORDER BY mt.last_message_at DESC LIMIT ?`;

    const messageParams = isAdmin
      ? [searchPattern, MAX_RESULTS_PER_TYPE]
      : [user.id, searchPattern, MAX_RESULTS_PER_TYPE];

    const threads = await db.all(messageQuery, messageParams);
    for (const t of threads) {
      results.push({
        type: 'message',
        id: t.id as number,
        title: t.subject as string,
        subtitle: 'message thread',
        path: `/messages`
      });
    }

    // --- Invoices ---
    const invoiceQuery = isAdmin
      ? `SELECT i.id, i.invoice_number, i.status, i.total_amount
         FROM active_invoices i
         WHERE i.invoice_number LIKE ? OR CAST(i.total_amount AS TEXT) LIKE ?
         ORDER BY i.created_at DESC LIMIT ?`
      : `SELECT i.id, i.invoice_number, i.status, i.total_amount
         FROM active_invoices i
         JOIN active_projects p ON i.project_id = p.id
         WHERE p.client_id = ? AND (i.invoice_number LIKE ? OR CAST(i.total_amount AS TEXT) LIKE ?)
         ORDER BY i.created_at DESC LIMIT ?`;

    const invoiceParams = isAdmin
      ? [searchPattern, searchPattern, MAX_RESULTS_PER_TYPE]
      : [user.id, searchPattern, searchPattern, MAX_RESULTS_PER_TYPE];

    const invoices = await db.all(invoiceQuery, invoiceParams);
    for (const inv of invoices) {
      results.push({
        type: 'invoice',
        id: inv.id as number,
        title: (inv.invoice_number as string) || `Invoice #${inv.id}`,
        subtitle: (inv.status as string) || 'invoice',
        path: `/invoices`
      });
    }

    // --- Clients (admin only) ---
    if (isAdmin) {
      const clients = await db.all(
        `SELECT id, contact_name, company_name, email
         FROM active_clients
         WHERE contact_name LIKE ? OR company_name LIKE ? OR email LIKE ?
         ORDER BY updated_at DESC LIMIT ?`,
        [searchPattern, searchPattern, searchPattern, MAX_RESULTS_PER_TYPE]
      );
      for (const c of clients) {
        results.push({
          type: 'client',
          id: c.id as number,
          title: (c.company_name as string) || (c.contact_name as string) || (c.email as string),
          subtitle: 'client',
          path: `/clients/${c.id}`
        });
      }
    }

    sendSuccess(res, { results, query });
  })
);

export { router as searchRouter };
export default router;
