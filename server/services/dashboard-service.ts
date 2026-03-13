/**
 * ===============================================
 * DASHBOARD SERVICE
 * ===============================================
 * @file server/services/dashboard-service.ts
 *
 * Service for admin dashboard database queries.
 * Extracts direct DB calls from the dashboard route
 * into typed, testable methods.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

interface CountRow {
  count: number;
}

interface RevenueRow {
  total: number;
}

interface LeadsStatsRow {
  total: number;
  converted: number;
}

export interface SidebarCounts {
  leads: number;
  messages: number;
}

export interface AttentionItems {
  overdueInvoices: number;
  pendingContracts: number;
  newLeadsThisWeek: number;
  unreadMessages: number;
}

export interface DashboardSnapshot {
  activeProjects: number;
  totalClients: number;
  revenueMTD: number;
  conversionRate: number;
}

export interface ActivityRow {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  entityType: string;
  entityId: string;
}

export interface ActiveProjectRow {
  id: number;
  name: string;
  client: string;
  client_id: number;
  status: string;
  progress: number;
  dueDate: string | null;
}

// =====================================================
// SERVICE METHODS
// =====================================================

/**
 * Get counts for sidebar badges (leads + unread messages).
 */
async function getSidebarCounts(): Promise<SidebarCounts> {
  const db = getDatabase();

  const leadsCount = await db.get<CountRow>(`
    SELECT
      (SELECT COUNT(*) FROM active_projects WHERE status = 'pending') +
      (SELECT COUNT(*) FROM contact_submissions WHERE status = 'new') as count
  `);

  // Uses unified messages table with context_type after migration 085
  const messagesCount = await db.get<CountRow>(`
    SELECT COUNT(*) as count
    FROM active_messages
    WHERE context_type = 'general'
      AND read_at IS NULL
      AND sender_type != 'admin'
  `);

  return {
    leads: leadsCount?.count || 0,
    messages: messagesCount?.count || 0
  };
}

/**
 * Get attention items for dashboard header.
 */
async function getAttentionItems(): Promise<AttentionItems> {
  const db = getDatabase();

  const overdueInvoices = await db.get<CountRow>(`
    SELECT COUNT(*) as count FROM active_invoices
    WHERE due_date < date('now') AND status != 'paid'
  `);

  const pendingContracts = await db.get<CountRow>(`
    SELECT COUNT(*) as count FROM active_projects
    WHERE contract_signed_at IS NULL
    AND status NOT IN ('completed', 'cancelled')
  `);

  const newLeadsThisWeek = await db.get<CountRow>(`
    SELECT COUNT(*) as count FROM contact_submissions
    WHERE created_at >= datetime('now', '-7 days')
  `);

  const unreadMessages = await db.get<CountRow>(`
    SELECT COUNT(*) as count FROM active_messages
    WHERE read_at IS NULL AND sender_type != 'admin'
  `);

  return {
    overdueInvoices: overdueInvoices?.count || 0,
    pendingContracts: pendingContracts?.count || 0,
    newLeadsThisWeek: newLeadsThisWeek?.count || 0,
    unreadMessages: unreadMessages?.count || 0
  };
}

/**
 * Get snapshot metrics (active projects, clients, revenue, conversion).
 */
async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const db = getDatabase();

  const activeProjects = await db.get<CountRow>(`
    SELECT COUNT(*) as count FROM active_projects
    WHERE status IN ('active', 'in-progress', 'in_progress')
  `);

  const totalClients = await db.get<CountRow>(`
    SELECT COUNT(*) as count FROM active_clients
  `);

  const revenueMTD = await db.get<RevenueRow>(`
    SELECT COALESCE(SUM(amount_paid), 0) as total FROM active_invoices
    WHERE strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now')
    AND status = 'paid'
  `);

  const leadsStats = await db.get<LeadsStatsRow>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted
    FROM contact_submissions
  `);

  const totalLeads = Number(leadsStats?.total) || 0;
  const convertedLeads = Number(leadsStats?.converted) || 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return {
    activeProjects: activeProjects?.count || 0,
    totalClients: totalClients?.count || 0,
    revenueMTD: revenueMTD?.total || 0,
    conversionRate
  };
}

/**
 * Get recent activity entries from client_activities.
 */
async function getRecentActivity(limit: number = 10): Promise<ActivityRow[]> {
  const db = getDatabase();

  const rows = await db.all<ActivityRow>(`
    SELECT
      'activity' || id as id,
      activity_type as type,
      title as description,
      created_at as timestamp,
      'client' as entityType,
      COALESCE(client_id, '') as entityId
    FROM client_activities
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);

  return rows || [];
}

/**
 * Get active projects list for dashboard.
 */
async function getActiveProjects(limit: number = 5): Promise<ActiveProjectRow[]> {
  const db = getDatabase();

  const rows = await db.all<ActiveProjectRow>(`
    SELECT
      p.id,
      p.project_name as name,
      COALESCE(c.company_name, c.contact_name, '') as client,
      p.client_id,
      p.status,
      COALESCE(p.progress, 0) as progress,
      p.estimated_end_date as dueDate
    FROM active_projects p
    LEFT JOIN active_clients c ON p.client_id = c.id
    WHERE p.status IN ('active', 'in-progress', 'in_progress')
    ORDER BY p.estimated_end_date ASC NULLS LAST
    LIMIT ?
  `, [limit]);

  return rows || [];
}

/**
 * Get full dashboard data (attention, snapshot, activity, projects).
 * Combines multiple queries into a single call for the dashboard endpoint.
 */
async function getFullDashboard(): Promise<{
  attention: AttentionItems;
  snapshot: DashboardSnapshot;
  recentActivity: ActivityRow[];
  activeProjects: ActiveProjectRow[];
}> {
  const [attention, snapshot, recentActivity, activeProjects] = await Promise.all([
    getAttentionItems(),
    getDashboardSnapshot(),
    getRecentActivity(),
    getActiveProjects()
  ]);

  return { attention, snapshot, recentActivity, activeProjects };
}

// =====================================================
// EXPORTED SINGLETON
// =====================================================

export const dashboardService = {
  getSidebarCounts,
  getAttentionItems,
  getDashboardSnapshot,
  getRecentActivity,
  getActiveProjects,
  getFullDashboard
};
