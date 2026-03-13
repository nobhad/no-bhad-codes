/**
 * ===============================================
 * ANALYTICS — SAVED REPORTS, SCHEDULES & DATA GENERATION
 * ===============================================
 * CRUD for saved reports, report schedules, and report data generators.
 */

import { getDatabase } from '../../database/init.js';
import { logger } from '../logger.js';
import { userService } from '../user-service.js';
import { safeJsonParseArray, safeJsonParseObject } from '../../utils/safe-json.js';
import type {
  ReportType,
  ChartType,
  Frequency,
  SqlParam,
  DateRange,
  ReportFilters,
  SavedReport,
  SavedReportRow,
  ReportSchedule,
  ReportScheduleRow,
  ReportDataResult,
  ReportRun
} from './types.js';
import {
  SAVED_REPORT_COLUMNS,
  REPORT_SCHEDULE_COLUMNS,
  REPORT_RUN_COLUMNS
} from './types.js';

// ============================================
// SAVED REPORTS
// ============================================

export async function createReport(data: {
  name: string;
  description?: string;
  report_type: ReportType;
  filters?: ReportFilters;
  columns?: string[];
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  chart_type?: ChartType;
  created_by?: string;
}): Promise<SavedReport> {
  const db = getDatabase();

  const createdByUserId = await userService.getUserIdByEmail(data.created_by);

  const result = await db.run(
    `INSERT INTO saved_reports (
      name, description, report_type, filters, columns, sort_by, sort_order, chart_type, created_by, created_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description || null,
      data.report_type,
      JSON.stringify(data.filters || {}),
      data.columns ? JSON.stringify(data.columns) : null,
      data.sort_by || null,
      data.sort_order || 'DESC',
      data.chart_type || null,
      data.created_by || null,
      createdByUserId
    ]
  );

  return getReport(result.lastID!);
}

export async function getReports(userEmail?: string): Promise<SavedReport[]> {
  const db = getDatabase();

  let query = `SELECT ${SAVED_REPORT_COLUMNS} FROM saved_reports WHERE 1=1`;
  const params: string[] = [];

  if (userEmail) {
    query += ' AND (created_by = ? OR is_shared = TRUE)';
    params.push(userEmail);
  }

  query += ' ORDER BY is_favorite DESC, updated_at DESC';

  const reports = await db.all(query, params);

  return reports.map((r: SavedReportRow) => ({
    ...r,
    filters: safeJsonParseObject(r.filters, 'report filters'),
    columns: r.columns ? safeJsonParseArray<string>(r.columns, 'report columns') : null
  }));
}

export async function getReport(reportId: number): Promise<SavedReport> {
  const db = getDatabase();
  const report = await db.get(`SELECT ${SAVED_REPORT_COLUMNS} FROM saved_reports WHERE id = ?`, [reportId]);

  if (!report) {
    throw new Error('Report not found');
  }

  return {
    ...(report as unknown as SavedReport),
    filters: safeJsonParseObject(report.filters as string, 'report filters'),
    columns: report.columns ? safeJsonParseArray<string>(report.columns as string, 'report columns') : null
  };
}

export async function updateReport(
  reportId: number,
  data: Partial<{
    name: string;
    description: string;
    filters: ReportFilters;
    columns: string[];
    sort_by: string;
    sort_order: 'ASC' | 'DESC';
    chart_type: ChartType;
    is_favorite: boolean;
    is_shared: boolean;
  }>
): Promise<SavedReport> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: SqlParam[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  if (data.filters !== undefined) {
    updates.push('filters = ?');
    values.push(JSON.stringify(data.filters));
  }
  if (data.columns !== undefined) {
    updates.push('columns = ?');
    values.push(JSON.stringify(data.columns));
  }
  if (data.sort_by !== undefined) {
    updates.push('sort_by = ?');
    values.push(data.sort_by);
  }
  if (data.sort_order !== undefined) {
    updates.push('sort_order = ?');
    values.push(data.sort_order);
  }
  if (data.chart_type !== undefined) {
    updates.push('chart_type = ?');
    values.push(data.chart_type);
  }
  if (data.is_favorite !== undefined) {
    updates.push('is_favorite = ?');
    values.push(data.is_favorite);
  }
  if (data.is_shared !== undefined) {
    updates.push('is_shared = ?');
    values.push(data.is_shared);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(reportId);
    await db.run(`UPDATE saved_reports SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  return getReport(reportId);
}

export async function deleteReport(reportId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM saved_reports WHERE id = ?', [reportId]);
}

export async function toggleFavorite(reportId: number): Promise<SavedReport> {
  const db = getDatabase();
  const report = await getReport(reportId);
  await db.run(
    'UPDATE saved_reports SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [!report.is_favorite, reportId]
  );
  return getReport(reportId);
}

// ============================================
// REPORT SCHEDULES
// ============================================

export async function createSchedule(data: {
  report_id: number;
  name?: string;
  frequency: Frequency;
  day_of_week?: number;
  day_of_month?: number;
  time_of_day?: string;
  timezone?: string;
  recipients: { email: string; name?: string }[];
  format?: 'pdf' | 'csv' | 'excel';
  include_charts?: boolean;
  created_by?: string;
}): Promise<ReportSchedule> {
  const db = getDatabase();

  const nextSendAt = calculateNextSendTime(
    data.frequency,
    data.day_of_week,
    data.day_of_month,
    data.time_of_day || '09:00'
  );

  const result = await db.run(
    `INSERT INTO report_schedules (
      report_id, name, frequency, day_of_week, day_of_month, time_of_day,
      timezone, recipients, format, include_charts, next_send_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.report_id,
      data.name || null,
      data.frequency,
      data.day_of_week ?? null,
      data.day_of_month ?? null,
      data.time_of_day || '09:00',
      data.timezone || 'America/New_York',
      JSON.stringify(data.recipients),
      data.format || 'pdf',
      data.include_charts !== false,
      nextSendAt,
      data.created_by || null
    ]
  );

  return getSchedule(result.lastID!);
}

export async function getSchedules(reportId?: number): Promise<ReportSchedule[]> {
  const db = getDatabase();

  let query = `SELECT ${REPORT_SCHEDULE_COLUMNS} FROM report_schedules`;
  const params: number[] = [];

  if (reportId) {
    query += ' WHERE report_id = ?';
    params.push(reportId);
  }

  query += ' ORDER BY next_send_at ASC';

  const schedules = await db.all(query, params);

  return schedules.map((s: ReportScheduleRow) => ({
    ...s,
    recipients: safeJsonParseArray(s.recipients, 'schedule recipients')
  }));
}

export async function getSchedule(scheduleId: number): Promise<ReportSchedule> {
  const db = getDatabase();
  const schedule = await db.get(`SELECT ${REPORT_SCHEDULE_COLUMNS} FROM report_schedules WHERE id = ?`, [scheduleId]);

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  return {
    ...(schedule as unknown as ReportSchedule),
    recipients: safeJsonParseArray(schedule.recipients as string, 'schedule recipients')
  };
}

export async function updateSchedule(
  scheduleId: number,
  data: Partial<{
    name: string;
    frequency: Frequency;
    day_of_week: number;
    day_of_month: number;
    time_of_day: string;
    timezone: string;
    recipients: { email: string; name?: string }[];
    format: 'pdf' | 'csv' | 'excel';
    include_charts: boolean;
    is_active: boolean;
  }>
): Promise<ReportSchedule> {
  const db = getDatabase();

  const updates: string[] = [];
  const values: SqlParam[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.frequency !== undefined) {
    updates.push('frequency = ?');
    values.push(data.frequency);
  }
  if (data.day_of_week !== undefined) {
    updates.push('day_of_week = ?');
    values.push(data.day_of_week);
  }
  if (data.day_of_month !== undefined) {
    updates.push('day_of_month = ?');
    values.push(data.day_of_month);
  }
  if (data.time_of_day !== undefined) {
    updates.push('time_of_day = ?');
    values.push(data.time_of_day);
  }
  if (data.timezone !== undefined) {
    updates.push('timezone = ?');
    values.push(data.timezone);
  }
  if (data.recipients !== undefined) {
    updates.push('recipients = ?');
    values.push(JSON.stringify(data.recipients));
  }
  if (data.format !== undefined) {
    updates.push('format = ?');
    values.push(data.format);
  }
  if (data.include_charts !== undefined) {
    updates.push('include_charts = ?');
    values.push(data.include_charts);
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(data.is_active);
  }

  if (updates.length > 0) {
    values.push(scheduleId);
    await db.run(`UPDATE report_schedules SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  return getSchedule(scheduleId);
}

export async function deleteSchedule(scheduleId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM report_schedules WHERE id = ?', [scheduleId]);
}

export async function getDueSchedules(): Promise<ReportSchedule[]> {
  const db = getDatabase();
  const schedules = await db.all(
    `SELECT ${REPORT_SCHEDULE_COLUMNS} FROM report_schedules
     WHERE is_active = TRUE AND next_send_at <= datetime('now')
     ORDER BY next_send_at ASC`
  );

  return schedules.map((s: ReportScheduleRow) => ({
    ...s,
    recipients: safeJsonParseArray(s.recipients, 'schedule recipients')
  }));
}

export async function markScheduleSent(scheduleId: number): Promise<void> {
  const db = getDatabase();
  const schedule = await getSchedule(scheduleId);

  const nextSendAt = calculateNextSendTime(
    schedule.frequency,
    schedule.day_of_week,
    schedule.day_of_month,
    schedule.time_of_day
  );

  await db.run(
    'UPDATE report_schedules SET last_sent_at = CURRENT_TIMESTAMP, next_send_at = ? WHERE id = ?',
    [nextSendAt, scheduleId]
  );
}

function calculateNextSendTime(
  frequency: Frequency,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  timeOfDay: string = '09:00'
): string {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  switch (frequency) {
  case 'daily':
    break;

  case 'weekly': {
    const targetDay = dayOfWeek ?? 1;
    while (next.getDay() !== targetDay) {
      next.setDate(next.getDate() + 1);
    }
    break;
  }

  case 'monthly': {
    const targetDate = dayOfMonth ?? 1;
    next.setDate(targetDate);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    break;
  }

  case 'quarterly': {
    const targetQuarterDate = dayOfMonth ?? 1;
    next.setDate(targetQuarterDate);
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const nextQuarterMonth = (currentQuarter + 1) * 3;
    if (nextQuarterMonth > 11) {
      next.setFullYear(next.getFullYear() + 1);
      next.setMonth(0);
    } else {
      next.setMonth(nextQuarterMonth);
    }
    break;
  }
  }

  return next.toISOString();
}

// ============================================
// REPORT DATA GENERATION
// ============================================

export async function generateReportData(
  reportType: ReportType,
  filters: ReportFilters = {}
): Promise<ReportDataResult> {
  switch (reportType) {
  case 'revenue':
    return generateRevenueReport(filters);
  case 'pipeline':
    return generatePipelineReport(filters);
  case 'project':
    return generateProjectReport(filters);
  case 'client':
    return generateClientReport(filters);
  case 'team':
    return generateTeamReport(filters);
  case 'lead':
    return generateLeadReport(filters);
  case 'invoice':
    return generateInvoiceReport(filters);
  default:
    throw new Error(`Unknown report type: ${reportType}`);
  }
}

async function generateRevenueReport(
  filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();
  try {
    let query = `
      SELECT
        strftime('%Y-%m', paid_date) as month,
        COUNT(*) as invoice_count,
        SUM(amount_total) as total_revenue,
        AVG(amount_total) as avg_invoice
      FROM active_invoices
      WHERE status = 'paid'
    `;
    const params: string[] = [];

    if (filters.dateRange?.start) {
      query += ' AND paid_date >= ?';
      params.push(filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
      query += ' AND paid_date <= ?';
      params.push(filters.dateRange.end);
    }

    query += ' GROUP BY month ORDER BY month';

    const data = await db.all(query, params);

    const summary = await db.get(`
      SELECT
        SUM(amount_total) as total_revenue,
        COUNT(*) as total_invoices,
        AVG(amount_total) as avg_invoice
      FROM active_invoices WHERE status = 'paid'
    `);

    return { data, summary: summary ?? {} };
  } catch (err) {
    logger.error('Error generating revenue report', {
      category: 'analytics',
      metadata: { error: err, filters }
    });
    throw err;
  }
}

async function generatePipelineReport(
  _filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();

  const data = await db.all(`
    SELECT
      ps.name as stage_name,
      ps.sort_order,
      COUNT(p.id) as project_count,
      COALESCE(SUM(p.expected_value), 0) as total_value,
      ps.win_probability
    FROM pipeline_stages ps
    LEFT JOIN active_projects p ON ps.id = p.pipeline_stage_id
    GROUP BY ps.id
    ORDER BY ps.sort_order
  `);

  const summary = await db.get(`
    SELECT
      COUNT(*) as total_leads,
      SUM(expected_value) as total_pipeline_value,
      COUNT(CASE WHEN pipeline_stage_id = (SELECT id FROM pipeline_stages WHERE is_won = TRUE) THEN 1 END) as won_count
    FROM active_projects WHERE status = 'pending' OR pipeline_stage_id IS NOT NULL
  `);

  return { data, summary: summary ?? {} };
}

async function generateProjectReport(
  filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();

  let query = `
    SELECT
      p.*,
      c.company_name,
      c.contact_name
    FROM active_projects p
    LEFT JOIN active_clients c ON p.client_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filters.status) {
    query += ' AND p.status = ?';
    params.push(filters.status);
  }
  if (filters.clientId) {
    query += ' AND p.client_id = ?';
    params.push(filters.clientId);
  }

  query += ' ORDER BY p.created_at DESC';

  const data = await db.all(query, params);

  const summary = await db.get(`
    SELECT
      COUNT(*) as total_projects,
      COUNT(CASE WHEN status IN ('active', 'in-progress') THEN 1 END) as active_projects,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
      COALESCE(SUM(actual_hours), 0) as total_hours
    FROM active_projects
  `);

  return { data, summary: summary ?? {} };
}

async function generateClientReport(
  _filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();

  const data = await db.all(`
    SELECT
      c.*,
      COUNT(DISTINCT p.id) as project_count,
      COALESCE(SUM(i.total_amount), 0) as total_revenue,
      COUNT(DISTINCT CASE WHEN i.status = 'paid' THEN i.id END) as paid_invoices
    FROM active_clients c
    LEFT JOIN active_projects p ON c.id = p.client_id
    LEFT JOIN active_invoices i ON c.id = i.client_id AND i.status = 'paid'
    GROUP BY c.id
    ORDER BY total_revenue DESC
  `);

  const summary = await db.get(`
    SELECT
      COUNT(*) as total_clients,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
      AVG(lifetime_value) as avg_lifetime_value
    FROM active_clients
  `);

  return { data, summary: summary ?? {} };
}

async function generateTeamReport(
  _filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();

  const data = await db.all(`
    SELECT
      u.display_name as user_name,
      SUM(te.hours) as total_hours,
      COUNT(DISTINCT te.project_id) as projects_worked,
      SUM(CASE WHEN te.billable = TRUE THEN te.hours ELSE 0 END) as billable_hours
    FROM time_entries te
    LEFT JOIN users u ON te.user_id = u.id
    WHERE te.date >= date('now', '-30 days')
    GROUP BY te.user_id, u.display_name
    ORDER BY total_hours DESC
  `);

  const summary = await db.get(`
    SELECT
      SUM(hours) as total_hours,
      SUM(CASE WHEN billable = TRUE THEN hours ELSE 0 END) as billable_hours,
      COUNT(DISTINCT user_id) as team_members
    FROM time_entries
    WHERE date >= date('now', '-30 days')
  `);

  return { data, summary: summary ?? {} };
}

async function generateLeadReport(
  _filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();

  const data = await db.all(`
    SELECT
      p.*,
      c.company_name,
      c.contact_name,
      ps.name as stage_name,
      ls.name as source_name
    FROM active_projects p
    LEFT JOIN active_clients c ON p.client_id = c.id
    LEFT JOIN pipeline_stages ps ON p.pipeline_stage_id = ps.id
    LEFT JOIN lead_sources ls ON p.lead_source_id = ls.id
    WHERE p.status = 'pending' OR p.pipeline_stage_id IS NOT NULL
    ORDER BY p.lead_score DESC, p.created_at DESC
  `);

  const summary = await db.get(`
    SELECT
      COUNT(*) as total_leads,
      AVG(lead_score) as avg_score,
      SUM(expected_value) as total_value
    FROM active_projects
    WHERE status = 'pending' OR pipeline_stage_id IS NOT NULL
  `);

  return { data, summary: summary ?? {} };
}

async function generateInvoiceReport(
  filters: ReportFilters
): Promise<ReportDataResult> {
  const db = getDatabase();

  let query = `
    SELECT
      i.*,
      c.company_name,
      c.contact_name,
      p.project_name
    FROM active_invoices i
    LEFT JOIN active_clients c ON i.client_id = c.id
    LEFT JOIN active_projects p ON i.project_id = p.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filters.status) {
    query += ' AND i.status = ?';
    params.push(filters.status);
  }
  if (filters.clientId) {
    query += ' AND i.client_id = ?';
    params.push(filters.clientId);
  }

  query += ' ORDER BY i.created_at DESC';

  const data = await db.all(query, params);

  const summary = await db.get(`
    SELECT
      COUNT(*) as total_invoices,
      SUM(total_amount) as total_amount,
      SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
      SUM(CASE WHEN status IN ('sent', 'overdue') THEN total_amount ELSE 0 END) as outstanding_amount
    FROM active_invoices
  `);

  return { data, summary: summary ?? {} };
}

// ============================================
// REPORT RUNS & HELPERS
// ============================================

export async function getReportRuns(reportId?: number, _limit?: number): Promise<ReportRun[]> {
  const db = getDatabase();
  let query = `SELECT ${REPORT_RUN_COLUMNS} FROM report_runs`;
  const params: number[] = [];

  if (reportId) {
    query += ' WHERE report_id = ?';
    params.push(reportId);
  }

  query += ' ORDER BY created_at DESC LIMIT 100';
  return db.all(query, params);
}

export function daysToDateRange(days?: number): DateRange | undefined {
  if (!days) return undefined;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}
