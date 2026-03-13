/**
 * ===============================================
 * METRICS SERVICE
 * ===============================================
 * @file server/services/metrics-service.ts
 *
 * Gathers aggregate database metrics for the
 * API status endpoint.
 */

import { getDatabase } from '../database/init.js';

// ============================================
// TYPES
// ============================================

export interface DatabaseMetrics {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  totalInvoices: number;
}

// ============================================
// SERVICE
// ============================================

/**
 * Gather aggregate counts from clients, projects, and invoices tables.
 */
async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  const db = getDatabase();

  const [clientsRow, activeClientsRow, projectsRow, activeProjectsRow, invoicesRow] =
    await Promise.all([
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM clients'),
      db.get<{ count: number }>("SELECT COUNT(*) as count FROM clients WHERE status = 'active'"),
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM projects'),
      db.get<{ count: number }>(
        "SELECT COUNT(*) as count FROM projects WHERE status IN ('in-progress', 'pending')"
      ),
      db.get<{ count: number }>('SELECT COUNT(*) as count FROM invoices')
    ]);

  return {
    totalUsers: typeof clientsRow?.count === 'number' ? clientsRow.count : 0,
    activeUsers: typeof activeClientsRow?.count === 'number' ? activeClientsRow.count : 0,
    totalProjects: typeof projectsRow?.count === 'number' ? projectsRow.count : 0,
    activeProjects: typeof activeProjectsRow?.count === 'number' ? activeProjectsRow.count : 0,
    totalInvoices: typeof invoicesRow?.count === 'number' ? invoicesRow.count : 0
  };
}

export const metricsService = { getDatabaseMetrics };
