/**
 * ===============================================
 * ADMIN ANALYTICS ROUTES
 * ===============================================
 * @file server/routes/admin/analytics.ts
 *
 * Analytics dashboard data endpoint.
 */

import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../../middleware/auth.js';
import { errorResponse, sendSuccess, ErrorCodes } from '../../utils/api-response.js';
import { getDatabase } from '../../database/init.js';

const router = express.Router();

/** Calculate percentage change between two values */
function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Convert range query param to number of days */
function rangeToDays(range: string): number {
  const rangeMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  return rangeMap[range] || 30;
}

/**
 * GET /api/admin/analytics - Get analytics data
 * Returns KPIs, charts, and source breakdown for the analytics dashboard
 */
router.get(
  '/analytics',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const db = getDatabase();
      const daysBack = rangeToDays(req.query.range as string);

      const now = new Date();
      const currentStart = new Date();
      currentStart.setDate(currentStart.getDate() - daysBack);
      const previousStart = new Date();
      previousStart.setDate(previousStart.getDate() - (daysBack * 2));

      const currentStartStr = currentStart.toISOString().split('T')[0];
      const previousStartStr = previousStart.toISOString().split('T')[0];
      const nowStr = now.toISOString().split('T')[0];

      // Get current period revenue
      const currentRevenue = await db.get(`
        SELECT COALESCE(SUM(amount_total), 0) as value
        FROM invoices
        WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) <= ?
      `, [currentStartStr, nowStr]);

      // Get previous period revenue
      const previousRevenue = await db.get(`
        SELECT COALESCE(SUM(amount_total), 0) as value
        FROM invoices
        WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) < ?
      `, [previousStartStr, currentStartStr]);

      // Client stats
      const currentClients = await db.get(`
        SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL
      `);
      const newClientsCurrentPeriod = await db.get(`
        SELECT COUNT(*) as value FROM clients
        WHERE deleted_at IS NULL AND DATE(created_at) >= ?
      `, [currentStartStr]);
      const newClientsPreviousPeriod = await db.get(`
        SELECT COUNT(*) as value FROM clients
        WHERE deleted_at IS NULL AND DATE(created_at) >= ? AND DATE(created_at) < ?
      `, [previousStartStr, currentStartStr]);

      // Project stats
      const activeProjects = await db.get(`
        SELECT COUNT(*) as value FROM projects
        WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL
      `);
      const newProjectsCurrentPeriod = await db.get(`
        SELECT COUNT(*) as value FROM projects
        WHERE deleted_at IS NULL AND DATE(created_at) >= ?
      `, [currentStartStr]);
      const newProjectsPreviousPeriod = await db.get(`
        SELECT COUNT(*) as value FROM projects
        WHERE deleted_at IS NULL AND DATE(created_at) >= ? AND DATE(created_at) < ?
      `, [previousStartStr, currentStartStr]);

      // Invoice stats
      const invoicesSent = await db.get(`
        SELECT COUNT(*) as value FROM invoices WHERE DATE(created_at) >= ?
      `, [currentStartStr]);
      const invoicesSentPrevious = await db.get(`
        SELECT COUNT(*) as value FROM invoices
        WHERE DATE(created_at) >= ? AND DATE(created_at) < ?
      `, [previousStartStr, currentStartStr]);

      // Conversion rate
      const leadsStats = await db.get(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status IN ('active', 'in-progress', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0) as converted
        FROM projects
        WHERE deleted_at IS NULL
      `);
      const leadsStatsPrevious = await db.get(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status IN ('active', 'in-progress', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0) as converted
        FROM projects
        WHERE deleted_at IS NULL AND DATE(created_at) < ?
      `, [currentStartStr]);

      const currentConversionRate = (leadsStats?.total || 0) > 0
        ? Math.round(((leadsStats?.converted || 0) / leadsStats.total) * 100)
        : 0;
      const previousConversionRate = (leadsStatsPrevious?.total || 0) > 0
        ? Math.round(((leadsStatsPrevious?.converted || 0) / leadsStatsPrevious.total) * 100)
        : 0;

      // Average project value
      const avgProjectValue = await db.get(`
        SELECT COALESCE(AVG(expected_value), 0) as value
        FROM projects WHERE deleted_at IS NULL AND expected_value > 0
      `);
      const avgProjectValuePrevious = await db.get(`
        SELECT COALESCE(AVG(expected_value), 0) as value
        FROM projects WHERE deleted_at IS NULL AND expected_value > 0 AND DATE(created_at) < ?
      `, [currentStartStr]);

      // Revenue chart data
      const revenueChartData = await db.all(`
        SELECT
          strftime('%Y-%m-%d', COALESCE(paid_date, updated_at)) as date,
          SUM(amount_total) as revenue
        FROM invoices
        WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ?
        GROUP BY strftime('%Y-%m-%d', COALESCE(paid_date, updated_at))
        ORDER BY date ASC
      `, [currentStartStr]);

      // Projects by status chart
      const projectsByStatus = await db.all(`
        SELECT status, COUNT(*) as count
        FROM projects WHERE deleted_at IS NULL
        GROUP BY status
      `);

      // Lead funnel data
      const leadFunnelData = await db.all(`
        SELECT status, COUNT(*) as count
        FROM projects
        WHERE deleted_at IS NULL
        GROUP BY status
        ORDER BY
          CASE status
            WHEN 'pending' THEN 1
            WHEN 'active' THEN 2
            WHEN 'in_progress' THEN 3
            WHEN 'in-progress' THEN 3
            WHEN 'completed' THEN 4
            WHEN 'cancelled' THEN 5
            ELSE 6
          END
      `);

      // Source breakdown
      const sourceBreakdownData = await db.all(`
        SELECT 'Direct' as source, COUNT(*) as count
        FROM projects
        WHERE deleted_at IS NULL
      `);

      const totalLeads = sourceBreakdownData.reduce((sum: number, s: { count: number }) => sum + s.count, 0);
      const sourceBreakdown = sourceBreakdownData.map((s: { source: string; count: number }) => ({
        source: s.source,
        count: s.count,
        percentage: totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0
      }));

      const revenueChart = {
        labels: revenueChartData.map((d: { date: string }) => d.date),
        datasets: [{
          label: 'Revenue',
          data: revenueChartData.map((d: { revenue: number }) => d.revenue),
          color: 'var(--status-completed)'
        }]
      };

      const projectsChart = {
        labels: projectsByStatus.map((p: { status: string }) => p.status),
        datasets: [{
          label: 'Projects',
          data: projectsByStatus.map((p: { count: number }) => p.count),
          color: 'var(--color-brand-primary)'
        }]
      };

      const leadsChart = {
        labels: leadFunnelData.map((l: { status: string }) => l.status),
        datasets: [{
          label: 'Leads',
          data: leadFunnelData.map((l: { count: number }) => l.count),
          color: 'var(--status-pending)'
        }]
      };

      sendSuccess(res, {
        kpis: {
          revenue: {
            value: currentRevenue?.value || 0,
            change: calcChange(currentRevenue?.value || 0, previousRevenue?.value || 0)
          },
          clients: {
            value: currentClients?.value || 0,
            change: calcChange(newClientsCurrentPeriod?.value || 0, newClientsPreviousPeriod?.value || 0)
          },
          projects: {
            value: activeProjects?.value || 0,
            change: calcChange(newProjectsCurrentPeriod?.value || 0, newProjectsPreviousPeriod?.value || 0)
          },
          invoices: {
            value: invoicesSent?.value || 0,
            change: calcChange(invoicesSent?.value || 0, invoicesSentPrevious?.value || 0)
          },
          conversionRate: {
            value: currentConversionRate,
            change: currentConversionRate - previousConversionRate
          },
          avgProjectValue: {
            value: Math.round(avgProjectValue?.value || 0),
            change: calcChange(avgProjectValue?.value || 0, avgProjectValuePrevious?.value || 0)
          }
        },
        revenueChart,
        projectsChart,
        leadsChart,
        sourceBreakdown
      });
    } catch (error) {
      console.error('[Analytics Error]', error);
      return errorResponse(res, 'Failed to load analytics data', 500, ErrorCodes.ANALYTICS_ERROR);
    }
  })
);

export default router;
