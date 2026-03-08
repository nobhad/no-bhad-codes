/**
 * ===============================================
 * ADMIN PERFORMANCE ROUTES
 * ===============================================
 * @file server/routes/admin/performance.ts
 *
 * Performance metrics endpoint for the admin dashboard.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';

const router = express.Router();

/** Valid period values */
type Period = 'week' | 'month' | 'quarter' | 'year';

/** Map period to number of days */
const PERIOD_DAYS: Record<Period, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365
};

/** Map period to display label */
const PERIOD_LABELS: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year'
};

/** Determine trend direction from current vs previous values */
function determineTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
  const TREND_THRESHOLD = 0.01;
  if (previous === 0) return current > 0 ? 'up' : 'stable';
  const changeRatio = (current - previous) / previous;
  if (changeRatio > TREND_THRESHOLD) return 'up';
  if (changeRatio < -TREND_THRESHOLD) return 'down';
  return 'stable';
}

/** Safely query the database, returning a fallback on error */
async function safeQuery<T>(db: ReturnType<typeof getDatabase>, query: string, params: (string | number | boolean | null | undefined)[] = [], fallback: T): Promise<T> {
  try {
    const result = await db.get(query, params);
    return (result as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Safely query all rows, returning empty array on error */
async function safeQueryAll<T>(db: ReturnType<typeof getDatabase>, query: string, params: (string | number | boolean | null | undefined)[] = []): Promise<T[]> {
  try {
    const results = await db.all(query, params);
    return (results as T[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * GET /api/admin/performance - Get performance metrics
 * Accepts ?period=week|month|quarter|year (defaults to month)
 */
router.get(
  '/performance',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const db = getDatabase();
      const periodParam = (req.query.period as string) || 'month';
      const period: Period = (Object.keys(PERIOD_DAYS) as Period[]).includes(periodParam as Period)
        ? (periodParam as Period)
        : 'month';

      const days = PERIOD_DAYS[period];
      const currentStartStr = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      const previousStartStr = new Date(Date.now() - days * 2 * 86400000).toISOString().split('T')[0];
      const nowStr = new Date().toISOString().split('T')[0];

      // ── KPI Data ──────────────────────────────────────

      // Revenue (current period)
      const currentRevenue = await safeQuery<{ value: number }>(
        db,
        `SELECT COALESCE(SUM(amount_paid), 0) as value FROM invoices
         WHERE status = 'paid' AND deleted_at IS NULL
         AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) <= ?`,
        [currentStartStr, nowStr],
        { value: 0 }
      );
      const previousRevenue = await safeQuery<{ value: number }>(
        db,
        `SELECT COALESCE(SUM(amount_paid), 0) as value FROM invoices
         WHERE status = 'paid' AND deleted_at IS NULL
         AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) < ?`,
        [previousStartStr, currentStartStr],
        { value: 0 }
      );

      // Active projects count
      const currentActiveProjects = await safeQuery<{ value: number }>(
        db,
        `SELECT COUNT(*) as value FROM projects
         WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL`,
        [],
        { value: 0 }
      );
      const previousActiveProjects = await safeQuery<{ value: number }>(
        db,
        `SELECT COUNT(*) as value FROM projects
         WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL
         AND DATE(created_at) < ?`,
        [currentStartStr],
        { value: 0 }
      );

      // Tasks completed (current period)
      const currentTasksCompleted = await safeQuery<{ value: number }>(
        db,
        `SELECT COUNT(*) as value FROM project_tasks
         WHERE status = 'completed' AND deleted_at IS NULL AND DATE(completed_at) >= ? AND DATE(completed_at) <= ?`,
        [currentStartStr, nowStr],
        { value: 0 }
      );
      const previousTasksCompleted = await safeQuery<{ value: number }>(
        db,
        `SELECT COUNT(*) as value FROM project_tasks
         WHERE status = 'completed' AND deleted_at IS NULL AND DATE(completed_at) >= ? AND DATE(completed_at) < ?`,
        [previousStartStr, currentStartStr],
        { value: 0 }
      );

      // Client count
      const currentClients = await safeQuery<{ value: number }>(
        db,
        'SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL',
        [],
        { value: 0 }
      );
      const previousClients = await safeQuery<{ value: number }>(
        db,
        `SELECT COUNT(*) as value FROM clients
         WHERE deleted_at IS NULL AND DATE(created_at) < ?`,
        [currentStartStr],
        { value: 0 }
      );

      // On-time delivery rate (projects completed on or before estimated_end_date)
      const onTimeDelivery = await safeQuery<{ total: number; on_time: number }>(
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
      const previousOnTimeDelivery = await safeQuery<{ total: number; on_time: number }>(
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
      const avgValue = await safeQuery<{ value: number }>(
        db,
        `SELECT COALESCE(AVG(expected_value), 0) as value
         FROM projects WHERE deleted_at IS NULL AND expected_value > 0`,
        [],
        { value: 0 }
      );
      const previousAvgValue = await safeQuery<{ value: number }>(
        db,
        `SELECT COALESCE(AVG(expected_value), 0) as value
         FROM projects WHERE deleted_at IS NULL AND expected_value > 0
         AND DATE(created_at) < ?`,
        [currentStartStr],
        { value: 0 }
      );

      const kpis = [
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

      // ── Team Members ──────────────────────────────────

      // Aggregate performance per assigned team member from project_tasks + time_entries
      const teamMembers = await safeQueryAll<{
        name: string;
        projects_completed: number;
        tasks_completed: number;
        total_hours: number;
      }>(
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

      // Get revenue per team member from invoices tied to their projects
      const teamMemberRevenue = await safeQueryAll<{ name: string; revenue: number }>(
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

      const formattedTeamMembers = teamMembers.map((member, index) => ({
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

      // ── Project Performance ───────────────────────────

      const projectPerformance = await safeQueryAll<{
        id: number;
        name: string;
        client_name: string;
        budget: number;
        spent: number;
        progress: number;
        status: string;
        estimated_end_date: string;
      }>(
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

      const formattedProjectPerformance = projectPerformance.map(project => ({
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

      sendSuccess(res, {
        kpis,
        teamMembers: formattedTeamMembers,
        projectPerformance: formattedProjectPerformance,
        period: PERIOD_LABELS[period]
      });
    } catch (error) {
      console.error('[Performance Error]', error);
      return errorResponse(res, 'Failed to load performance data', 500, ErrorCodes.PERFORMANCE_ERROR);
    }
  })
);

export default router;
