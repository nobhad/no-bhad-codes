/**
 * ===============================================
 * PERFORMANCE SERVICE
 * ===============================================
 * @file server/services/performance-service.ts
 *
 * Database operations for admin performance metrics.
 * Extracted from server/routes/admin/performance.ts.
 */

import { getDatabase } from '../database/init.js';

// =====================================================
// TYPES
// =====================================================

/** Valid period values */
export type PerformancePeriod = 'week' | 'month' | 'quarter' | 'year';

/** Map period to number of days */
const PERIOD_DAYS: Record<PerformancePeriod, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365
};

/** Map period to display label */
const PERIOD_LABELS: Record<PerformancePeriod, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year'
};

const TREND_THRESHOLD = 0.01;

interface ValueRow { value: number }
interface OnTimeRow { total: number; on_time: number }

interface TeamMemberRow {
  name: string;
  projects_completed: number;
  tasks_completed: number;
  total_hours: number;
}

interface TeamRevenueRow {
  name: string;
  revenue: number;
}

interface ProjectPerformanceRow {
  id: number;
  name: string;
  client_name: string;
  budget: number;
  spent: number;
  progress: number;
  status: string;
  estimated_end_date: string;
}

export interface KPI {
  id: string;
  name: string;
  value: number;
  target: number;
  previousValue: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  icon: string;
}

export interface FormattedTeamMember {
  id: string;
  name: string;
  role: string;
  projectsCompleted: number;
  revenueGenerated: number;
  tasksCompleted: number;
  avgResponseTime: string;
  rating: number;
}

export interface FormattedProjectPerformance {
  id: number;
  name: string;
  clientName: string;
  budget: number;
  spent: number;
  progress: number;
  onTrack: boolean;
  dueDate: string;
}

export interface PerformanceData {
  kpis: KPI[];
  teamMembers: FormattedTeamMember[];
  projectPerformance: FormattedProjectPerformance[];
  period: string;
}

// =====================================================
// HELPERS
// =====================================================

function determineTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  if (previous === 0) return current > 0 ? 'up' : 'stable';
  const changeRatio = (current - previous) / previous;
  if (changeRatio > TREND_THRESHOLD) return 'up';
  if (changeRatio < -TREND_THRESHOLD) return 'down';
  return 'stable';
}

type SafeQueryParam = string | number | boolean | null | undefined;

async function safeQuery<T>(
  db: ReturnType<typeof getDatabase>,
  query: string,
  params: SafeQueryParam[] = [],
  fallback: T
): Promise<T> {
  try {
    const result = await db.get(query, params);
    return (result as T) ?? fallback;
  } catch {
    return fallback;
  }
}

async function safeQueryAll<T>(
  db: ReturnType<typeof getDatabase>,
  query: string,
  params: SafeQueryParam[] = []
): Promise<T[]> {
  try {
    const results = await db.all(query, params);
    return (results as T[]) ?? [];
  } catch {
    return [];
  }
}

function isValidPeriod(value: string): value is PerformancePeriod {
  return (Object.keys(PERIOD_DAYS) as string[]).includes(value);
}

// =====================================================
// SERVICE
// =====================================================

class PerformanceService {
  /**
   * Get full performance dashboard data for a given period
   */
  async getPerformanceMetrics(periodParam: string): Promise<PerformanceData> {
    const db = getDatabase();
    const period: PerformancePeriod = isValidPeriod(periodParam)
      ? periodParam
      : 'month';

    const days = PERIOD_DAYS[period];
    const currentStartStr = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const previousStartStr = new Date(Date.now() - days * 2 * 86400000).toISOString().split('T')[0];
    const nowStr = new Date().toISOString().split('T')[0];

    // ── KPI Data ──────────────────────────────────────
    const kpis = await this.fetchKPIs(db, currentStartStr, previousStartStr, nowStr);

    // ── Team Members ──────────────────────────────────
    const teamMembers = await this.fetchTeamMembers(db);

    // ── Project Performance ───────────────────────────
    const projectPerformance = await this.fetchProjectPerformance(db);

    return {
      kpis,
      teamMembers,
      projectPerformance,
      period: PERIOD_LABELS[period]
    };
  }

  private async fetchKPIs(
    db: ReturnType<typeof getDatabase>,
    currentStartStr: string,
    previousStartStr: string,
    nowStr: string
  ): Promise<KPI[]> {
    // Revenue (current period)
    const currentRevenue = await safeQuery<ValueRow>(
      db,
      `SELECT COALESCE(SUM(amount_paid), 0) as value FROM invoices
       WHERE status = 'paid' AND deleted_at IS NULL
       AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) <= ?`,
      [currentStartStr, nowStr],
      { value: 0 }
    );
    const previousRevenue = await safeQuery<ValueRow>(
      db,
      `SELECT COALESCE(SUM(amount_paid), 0) as value FROM invoices
       WHERE status = 'paid' AND deleted_at IS NULL
       AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) < ?`,
      [previousStartStr, currentStartStr],
      { value: 0 }
    );

    // Active projects count
    const currentActiveProjects = await safeQuery<ValueRow>(
      db,
      `SELECT COUNT(*) as value FROM projects
       WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL`,
      [],
      { value: 0 }
    );
    const previousActiveProjects = await safeQuery<ValueRow>(
      db,
      `SELECT COUNT(*) as value FROM projects
       WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL
       AND DATE(created_at) < ?`,
      [currentStartStr],
      { value: 0 }
    );

    // Tasks completed (current period)
    const currentTasksCompleted = await safeQuery<ValueRow>(
      db,
      `SELECT COUNT(*) as value FROM project_tasks
       WHERE status = 'completed' AND deleted_at IS NULL AND DATE(completed_at) >= ? AND DATE(completed_at) <= ?`,
      [currentStartStr, nowStr],
      { value: 0 }
    );
    const previousTasksCompleted = await safeQuery<ValueRow>(
      db,
      `SELECT COUNT(*) as value FROM project_tasks
       WHERE status = 'completed' AND deleted_at IS NULL AND DATE(completed_at) >= ? AND DATE(completed_at) < ?`,
      [previousStartStr, currentStartStr],
      { value: 0 }
    );

    // Client count
    const currentClients = await safeQuery<ValueRow>(
      db,
      'SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL',
      [],
      { value: 0 }
    );
    const previousClients = await safeQuery<ValueRow>(
      db,
      `SELECT COUNT(*) as value FROM clients
       WHERE deleted_at IS NULL AND DATE(created_at) < ?`,
      [currentStartStr],
      { value: 0 }
    );

    // On-time delivery rate
    const onTimeDelivery = await safeQuery<OnTimeRow>(
      db,
      `SELECT
         COUNT(*) as total,
         COALESCE(SUM(CASE
           WHEN actual_end_date <= estimated_end_date THEN 1
           ELSE 0
         END), 0) as on_time
       FROM projects
       WHERE status = 'completed' AND deleted_at IS NULL
       AND actual_end_date IS NOT NULL AND estimated_end_date IS NOT NULL`,
      [],
      { total: 0, on_time: 0 }
    );
    const previousOnTimeDelivery = await safeQuery<OnTimeRow>(
      db,
      `SELECT
         COUNT(*) as total,
         COALESCE(SUM(CASE
           WHEN actual_end_date <= estimated_end_date THEN 1
           ELSE 0
         END), 0) as on_time
       FROM projects
       WHERE status = 'completed' AND deleted_at IS NULL
       AND actual_end_date IS NOT NULL AND estimated_end_date IS NOT NULL
       AND DATE(actual_end_date) < ?`,
      [currentStartStr],
      { total: 0, on_time: 0 }
    );

    const onTimeRate = onTimeDelivery.total > 0
      ? Math.round((onTimeDelivery.on_time / onTimeDelivery.total) * 100)
      : 0;
    const previousOnTimeRate = previousOnTimeDelivery.total > 0
      ? Math.round((previousOnTimeDelivery.on_time / previousOnTimeDelivery.total) * 100)
      : 0;

    // Average project value
    const avgValue = await safeQuery<ValueRow>(
      db,
      `SELECT COALESCE(AVG(expected_value), 0) as value
       FROM projects WHERE deleted_at IS NULL AND expected_value > 0`,
      [],
      { value: 0 }
    );
    const previousAvgValue = await safeQuery<ValueRow>(
      db,
      `SELECT COALESCE(AVG(expected_value), 0) as value
       FROM projects WHERE deleted_at IS NULL AND expected_value > 0
       AND DATE(created_at) < ?`,
      [currentStartStr],
      { value: 0 }
    );

    return [
      {
        id: 'revenue',
        name: 'Revenue',
        value: currentRevenue.value,
        target: Math.round(currentRevenue.value * 1.2),
        previousValue: previousRevenue.value,
        unit: '$',
        trend: determineTrend(currentRevenue.value, previousRevenue.value),
        icon: 'DollarSign'
      },
      {
        id: 'active-projects',
        name: 'Active Projects',
        value: currentActiveProjects.value,
        target: Math.max(currentActiveProjects.value, previousActiveProjects.value + 2),
        previousValue: previousActiveProjects.value,
        unit: '',
        trend: determineTrend(currentActiveProjects.value, previousActiveProjects.value),
        icon: 'Briefcase'
      },
      {
        id: 'tasks-completed',
        name: 'Tasks Completed',
        value: currentTasksCompleted.value,
        target: Math.round(currentTasksCompleted.value * 1.1) || 10,
        previousValue: previousTasksCompleted.value,
        unit: '',
        trend: determineTrend(currentTasksCompleted.value, previousTasksCompleted.value),
        icon: 'CheckCircle'
      },
      {
        id: 'clients',
        name: 'Total Clients',
        value: currentClients.value,
        target: Math.max(currentClients.value, previousClients.value + 5),
        previousValue: previousClients.value,
        unit: '',
        trend: determineTrend(currentClients.value, previousClients.value),
        icon: 'Users'
      },
      {
        id: 'on-time-delivery',
        name: 'On-Time Delivery',
        value: onTimeRate,
        target: 95,
        previousValue: previousOnTimeRate,
        unit: '%',
        trend: determineTrend(onTimeRate, previousOnTimeRate),
        icon: 'Clock'
      },
      {
        id: 'avg-project-value',
        name: 'Avg Project Value',
        value: Math.round(avgValue.value),
        target: Math.round(avgValue.value * 1.15) || 5000,
        previousValue: Math.round(previousAvgValue.value),
        unit: '$',
        trend: determineTrend(avgValue.value, previousAvgValue.value),
        icon: 'TrendingUp'
      }
    ];
  }

  private async fetchTeamMembers(
    db: ReturnType<typeof getDatabase>
  ): Promise<FormattedTeamMember[]> {
    const teamMembers = await safeQueryAll<TeamMemberRow>(
      db,
      `SELECT
         pt.assigned_to as name,
         COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as projects_completed,
         COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) as tasks_completed,
         COALESCE((SELECT SUM(te.hours) FROM time_entries te WHERE te.user_name = pt.assigned_to), 0) as total_hours
       FROM project_tasks pt
       LEFT JOIN projects p ON pt.project_id = p.id AND p.deleted_at IS NULL
       WHERE pt.assigned_to IS NOT NULL AND pt.assigned_to != '' AND pt.deleted_at IS NULL
       GROUP BY pt.assigned_to
       ORDER BY tasks_completed DESC
       LIMIT 20`
    );

    const teamMemberRevenue = await safeQueryAll<TeamRevenueRow>(
      db,
      `SELECT
         pt.assigned_to as name,
         COALESCE(SUM(i.amount_paid), 0) as revenue
       FROM project_tasks pt
       JOIN invoices i ON i.project_id = pt.project_id AND i.status = 'paid' AND i.deleted_at IS NULL
       WHERE pt.assigned_to IS NOT NULL AND pt.assigned_to != '' AND pt.deleted_at IS NULL
       GROUP BY pt.assigned_to`
    );

    const revenueMap = new Map(teamMemberRevenue.map(r => [r.name, r.revenue]));

    return teamMembers.map((member, index) => ({
      id: `team-${index + 1}`,
      name: member.name,
      role: 'Team Member',
      projectsCompleted: member.projects_completed,
      revenueGenerated: revenueMap.get(member.name) || 0,
      tasksCompleted: member.tasks_completed,
      avgResponseTime: member.total_hours > 0
        ? `${Math.round(member.total_hours)}h logged`
        : 'N/A',
      rating: member.tasks_completed > 0
        ? Math.min(5, Math.round((member.tasks_completed / Math.max(member.tasks_completed, 1)) * 5 * 10) / 10)
        : 0
    }));
  }

  private async fetchProjectPerformance(
    db: ReturnType<typeof getDatabase>
  ): Promise<FormattedProjectPerformance[]> {
    const projectPerformance = await safeQueryAll<ProjectPerformanceRow>(
      db,
      `SELECT
         p.id,
         p.project_name as name,
         COALESCE(c.company_name, c.contact_name, 'Unknown') as client_name,
         COALESCE(p.expected_value, 0) as budget,
         COALESCE((SELECT SUM(i.amount_paid) FROM invoices i WHERE i.project_id = p.id AND i.deleted_at IS NULL), 0) as spent,
         COALESCE(p.progress, 0) as progress,
         p.status,
         p.estimated_end_date
       FROM projects p
       LEFT JOIN clients c ON p.client_id = c.id
       WHERE p.deleted_at IS NULL
       AND p.status IN ('active', 'in-progress', 'in_progress', 'pending', 'in-review')
       ORDER BY p.estimated_end_date ASC NULLS LAST
       LIMIT 20`
    );

    const today = new Date().toISOString().split('T')[0];

    return projectPerformance.map(project => ({
      id: project.id,
      name: project.name,
      clientName: project.client_name,
      budget: project.budget,
      spent: project.spent,
      progress: project.progress,
      onTrack: project.estimated_end_date
        ? project.estimated_end_date >= today || project.progress >= 90
        : true,
      dueDate: project.estimated_end_date || ''
    }));
  }
}

export const performanceService = new PerformanceService();
