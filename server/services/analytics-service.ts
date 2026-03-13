/**
 * ===============================================
 * ANALYTICS SERVICE — BARREL
 * ===============================================
 * Composes sub-modules into the `analyticsService` singleton.
 *
 * Sub-modules:
 *   analytics/types.ts       — Shared types and column constants
 *   analytics/reports.ts     — Saved reports, schedules, report data generation
 *   analytics/dashboards.ts  — Widgets, presets, KPI snapshots, metric alerts
 *   analytics/insights.ts    — Business intelligence, client insights, operational reports
 */

import * as reports from './analytics/reports.js';
import * as dashboards from './analytics/dashboards.js';
import * as insights from './analytics/insights.js';
import { logger } from './logger.js';
import type { ReportDataResult } from './analytics/types.js';

// Re-export all types for consumers that import from this file
export type {
  ReportType,
  ChartType,
  WidgetType,
  DataSource,
  Frequency,
  AlertCondition,
  SqlParam,
  DateRange,
  ReportFilters,
  SavedReport,
  ReportSchedule,
  DashboardWidget,
  KPISnapshot,
  ReportDataResult,
  DashboardPreset,
  ReportRun,
  MetricAlert,
} from './analytics/types.js';

/**
 * Singleton analytics service exposing route-compatible method names.
 *
 * Route files import `{ analyticsService }` and call methods directly.
 * Each method delegates to the appropriate sub-module function.
 */
export const analyticsService = {
  // ── Reports ───────────────────────────────────
  getSavedReports(_type?: string, _favorites?: boolean) {
    return reports.getReports();
  },
  createSavedReport(data: Parameters<typeof reports.createReport>[0]) {
    return reports.createReport(data);
  },
  getSavedReport(reportId: number) {
    return reports.getReport(reportId);
  },
  updateSavedReport(reportId: number, data: Parameters<typeof reports.updateReport>[1]) {
    return reports.updateReport(reportId, data);
  },
  deleteSavedReport(reportId: number) {
    return reports.deleteReport(reportId);
  },
  toggleReportFavorite(reportId: number) {
    return reports.toggleFavorite(reportId);
  },
  async runReport(reportId: number): Promise<ReportDataResult> {
    const report = await reports.getReport(reportId);
    return reports.generateReportData(report.report_type, report.filters || {});
  },

  // ── Schedules ─────────────────────────────────
  getReportSchedules(reportId?: number) {
    return reports.getSchedules(reportId);
  },
  createReportSchedule(data: Parameters<typeof reports.createSchedule>[0]) {
    return reports.createSchedule(data);
  },
  updateReportSchedule(scheduleId: number, data: Parameters<typeof reports.updateSchedule>[1]) {
    return reports.updateSchedule(scheduleId, data);
  },
  deleteReportSchedule(scheduleId: number) {
    return reports.deleteSchedule(scheduleId);
  },
  async processDueSchedules() {
    const dueSchedules = await reports.getDueSchedules();
    let processed = 0;
    const errors: string[] = [];

    for (const schedule of dueSchedules) {
      try {
        await reports.markScheduleSent(schedule.id);
        processed++;
      } catch (err) {
        errors.push(
          `Schedule ${schedule.id}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    return { processed, errors };
  },

  // ── Widgets ───────────────────────────────────
  getDashboardWidgets(userEmail: string) {
    return dashboards.getWidgets(userEmail);
  },
  createDashboardWidget(data: Parameters<typeof dashboards.createWidget>[0]) {
    return dashboards.createWidget(data);
  },
  updateDashboardWidget(widgetId: number, data: Parameters<typeof dashboards.updateWidget>[1]) {
    return dashboards.updateWidget(widgetId, data);
  },
  deleteDashboardWidget(widgetId: number) {
    return dashboards.deleteWidget(widgetId);
  },
  updateWidgetLayout(
    userEmail: string,
    layout: { id: number; x: number; y: number; w: number; h: number }[]
  ) {
    return dashboards.saveWidgetLayout(
      userEmail,
      layout.map((l) => ({ id: l.id, position_x: l.x, position_y: l.y, width: l.w, height: l.h }))
    );
  },
  getDashboardPresets() {
    return dashboards.getPresets();
  },
  applyDashboardPreset(userEmail: string, presetId: number) {
    return dashboards.applyPreset(userEmail, presetId);
  },

  // ── KPIs ──────────────────────────────────────
  captureKPISnapshot() {
    return dashboards.captureSnapshot();
  },
  getLatestKPIs() {
    return dashboards.getLatestKPIs();
  },
  getKPITrend(...args: Parameters<typeof dashboards.getKPITrend>) {
    return dashboards.getKPITrend(...args);
  },

  // ── Alerts ────────────────────────────────────
  getMetricAlerts() {
    return dashboards.getAlerts();
  },
  createMetricAlert(data: Parameters<typeof dashboards.createAlert>[0]) {
    return dashboards.createAlert(data);
  },
  updateMetricAlert(alertId: number, data: Parameters<typeof dashboards.updateAlert>[1]) {
    return dashboards.updateAlert(alertId, data);
  },
  deleteMetricAlert(alertId: number) {
    return dashboards.deleteAlert(alertId);
  },
  checkAlertTriggers() {
    return dashboards.checkAlerts();
  },

  // ── Quick Analytics ───────────────────────────
  async getRevenueAnalytics(days?: number): Promise<ReportDataResult> {
    const dateRange = reports.daysToDateRange(days);
    try {
      return await reports.generateReportData('revenue', { dateRange });
    } catch (err) {
      logger.error('Failed to generate revenue analytics', {
        category: 'analytics',
        metadata: { error: err, dateRange }
      });
      throw new Error('Revenue analytics generation failed');
    }
  },
  getPipelineAnalytics() {
    return reports.generateReportData('pipeline', {});
  },
  getProjectAnalytics(days?: number) {
    const dateRange = reports.daysToDateRange(days);
    return reports.generateReportData('project', { dateRange });
  },
  getClientAnalytics() {
    return reports.generateReportData('client', {});
  },
  getTeamAnalytics(days?: number) {
    const dateRange = reports.daysToDateRange(days);
    return reports.generateReportData('team', { dateRange });
  },
  getReportRuns(reportId?: number, limit?: number) {
    return reports.getReportRuns(reportId, limit);
  },

  // ── Business Intelligence ─────────────────────
  getRevenueByPeriod: insights.getRevenueByPeriod,
  getProjectPipelineValue: insights.getProjectPipelineValue,
  getAcquisitionFunnel: insights.getAcquisitionFunnel,
  getProjectStatistics: insights.getProjectStatistics,

  // ── Client Insights ───────────────────────────
  getClientLifetimeValue: insights.getClientLifetimeValue,
  getClientActivityScores: insights.getClientActivityScores,
  getUpsellOpportunities: insights.getUpsellOpportunities,

  // ── Operational Reports ───────────────────────
  getOverdueInvoicesReport: insights.getOverdueInvoicesReport,
  getPendingApprovalsReport: insights.getPendingApprovalsReport,
  getDocumentRequestsStatusReport: insights.getDocumentRequestsStatusReport,
  getProjectHealthSummary: insights.getProjectHealthSummary,
};
