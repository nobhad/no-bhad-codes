/**
 * ===============================================
 * ANALYTICS SERVICE
 * ===============================================
 * Handles reports, dashboards, KPIs, and business analytics.
 */

import { getDatabase } from '../database/init.js';
import { logger } from '../services/logger.js';
import { userService } from './user-service.js';

// ============================================
// Types
// ============================================

type ReportType = 'revenue' | 'pipeline' | 'project' | 'client' | 'team' | 'lead' | 'invoice';
type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table';
type WidgetType = 'metric' | 'chart' | 'list' | 'table' | 'progress' | 'calendar';
type DataSource = 'revenue' | 'projects' | 'clients' | 'leads' | 'invoices' | 'tasks' | 'time' | 'milestones';
type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type AlertCondition = 'above' | 'below' | 'equals' | 'change_above' | 'change_below';

interface DateRange {
  start: string;
  end: string;
}

interface ReportFilters {
  dateRange?: DateRange;
  clientId?: number;
  projectId?: number;
  status?: string;
  [key: string]: any;
}

interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  report_type: ReportType;
  filters: ReportFilters;
  columns: string[] | null;
  sort_by: string | null;
  sort_order: 'ASC' | 'DESC';
  chart_type: ChartType | null;
  is_favorite: boolean;
  is_shared: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportSchedule {
  id: number;
  report_id: number;
  name: string | null;
  frequency: Frequency;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  recipients: { email: string; name?: string }[];
  format: 'pdf' | 'csv' | 'excel';
  include_charts: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

interface DashboardWidget {
  id: number;
  user_email: string;
  widget_type: WidgetType;
  title: string | null;
  data_source: DataSource;
  config: Record<string, any>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  refresh_interval: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

interface KPISnapshot {
  id: number;
  snapshot_date: string;
  kpi_type: string;
  value: number;
  previous_value: number | null;
  change_percent: number | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface MetricAlert {
  id: number;
  name: string;
  kpi_type: string;
  condition: AlertCondition;
  threshold_value: number;
  notification_emails: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string | null;
  created_at: string;
}

// ============================================
// Analytics Service Class
// ============================================

class AnalyticsService {
  // ============================================
  // SAVED REPORTS
  // ============================================

  /**
   * Create a saved report
   */
  async createReport(data: {
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

    // Look up user ID for created_by during transition period
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

    return this.getReport(result.lastID!);
  }

  /**
   * Get all saved reports
   */
  async getReports(userEmail?: string): Promise<SavedReport[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM saved_reports WHERE 1=1';
    const params: string[] = [];

    if (userEmail) {
      query += ' AND (created_by = ? OR is_shared = TRUE)';
      params.push(userEmail);
    }

    query += ' ORDER BY is_favorite DESC, updated_at DESC';

    const reports = await db.all(query, params);

    return reports.map((r: any) => ({
      ...r,
      filters: r.filters ? JSON.parse(r.filters) : {},
      columns: r.columns ? JSON.parse(r.columns) : null
    }));
  }

  /**
   * Get a single report
   */
  async getReport(reportId: number): Promise<SavedReport> {
    const db = getDatabase();
    const report = await db.get('SELECT * FROM saved_reports WHERE id = ?', [reportId]);

    if (!report) {
      throw new Error('Report not found');
    }

    return {
      ...(report as unknown as SavedReport),
      filters: typeof report.filters === 'string' ? JSON.parse(report.filters) : {},
      columns: typeof report.columns === 'string' ? JSON.parse(report.columns) : null
    };
  }

  /**
   * Update a saved report
   */
  async updateReport(
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
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.filters !== undefined) { updates.push('filters = ?'); values.push(JSON.stringify(data.filters)); }
    if (data.columns !== undefined) { updates.push('columns = ?'); values.push(JSON.stringify(data.columns)); }
    if (data.sort_by !== undefined) { updates.push('sort_by = ?'); values.push(data.sort_by); }
    if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order); }
    if (data.chart_type !== undefined) { updates.push('chart_type = ?'); values.push(data.chart_type); }
    if (data.is_favorite !== undefined) { updates.push('is_favorite = ?'); values.push(data.is_favorite); }
    if (data.is_shared !== undefined) { updates.push('is_shared = ?'); values.push(data.is_shared); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(reportId);
      await db.run(`UPDATE saved_reports SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getReport(reportId);
  }

  /**
   * Delete a saved report
   */
  async deleteReport(reportId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM saved_reports WHERE id = ?', [reportId]);
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(reportId: number): Promise<SavedReport> {
    const db = getDatabase();
    const report = await this.getReport(reportId);
    await db.run(
      'UPDATE saved_reports SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [!report.is_favorite, reportId]
    );
    return this.getReport(reportId);
  }

  // ============================================
  // REPORT SCHEDULES
  // ============================================

  /**
   * Create a report schedule
   */
  async createSchedule(data: {
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

    // Calculate next send time
    const nextSendAt = this.calculateNextSendTime(
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

    return this.getSchedule(result.lastID!);
  }

  /**
   * Get schedules for a report
   */
  async getSchedules(reportId?: number): Promise<ReportSchedule[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM report_schedules';
    const params: number[] = [];

    if (reportId) {
      query += ' WHERE report_id = ?';
      params.push(reportId);
    }

    query += ' ORDER BY next_send_at ASC';

    const schedules = await db.all(query, params);

    return schedules.map((s: any) => ({
      ...s,
      recipients: s.recipients ? JSON.parse(s.recipients) : []
    }));
  }

  /**
   * Get a single schedule
   */
  async getSchedule(scheduleId: number): Promise<ReportSchedule> {
    const db = getDatabase();
    const schedule = await db.get('SELECT * FROM report_schedules WHERE id = ?', [scheduleId]);

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    return {
      ...(schedule as unknown as ReportSchedule),
      recipients: typeof schedule.recipients === 'string' ? JSON.parse(schedule.recipients) : []
    };
  }

  /**
   * Update a schedule
   */
  async updateSchedule(
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
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.frequency !== undefined) { updates.push('frequency = ?'); values.push(data.frequency); }
    if (data.day_of_week !== undefined) { updates.push('day_of_week = ?'); values.push(data.day_of_week); }
    if (data.day_of_month !== undefined) { updates.push('day_of_month = ?'); values.push(data.day_of_month); }
    if (data.time_of_day !== undefined) { updates.push('time_of_day = ?'); values.push(data.time_of_day); }
    if (data.timezone !== undefined) { updates.push('timezone = ?'); values.push(data.timezone); }
    if (data.recipients !== undefined) { updates.push('recipients = ?'); values.push(JSON.stringify(data.recipients)); }
    if (data.format !== undefined) { updates.push('format = ?'); values.push(data.format); }
    if (data.include_charts !== undefined) { updates.push('include_charts = ?'); values.push(data.include_charts); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }

    if (updates.length > 0) {
      values.push(scheduleId);
      await db.run(`UPDATE report_schedules SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getSchedule(scheduleId);
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM report_schedules WHERE id = ?', [scheduleId]);
  }

  /**
   * Get schedules due for execution
   */
  async getDueSchedules(): Promise<ReportSchedule[]> {
    const db = getDatabase();
    const schedules = await db.all(
      `SELECT * FROM report_schedules
       WHERE is_active = TRUE AND next_send_at <= datetime('now')
       ORDER BY next_send_at ASC`
    );

    return schedules.map((s: any) => ({
      ...s,
      recipients: s.recipients ? JSON.parse(s.recipients) : []
    }));
  }

  /**
   * Mark schedule as sent and calculate next send time
   */
  async markScheduleSent(scheduleId: number): Promise<void> {
    const db = getDatabase();
    const schedule = await this.getSchedule(scheduleId);

    const nextSendAt = this.calculateNextSendTime(
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

  /**
   * Calculate next send time based on frequency
   */
  private calculateNextSendTime(
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
      // If time has passed today, start from tomorrow
      next.setDate(next.getDate() + 1);
    }

    switch (frequency) {
    case 'daily':
      // Already set for next occurrence
      break;

    case 'weekly': {
      const targetDay = dayOfWeek ?? 1; // Default to Monday
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
      // Move to first month of next quarter
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
  // DASHBOARD WIDGETS
  // ============================================

  /**
   * Get widgets for a user
   */
  async getWidgets(userEmail: string): Promise<DashboardWidget[]> {
    const db = getDatabase();
    const widgets = await db.all(
      `SELECT * FROM dashboard_widgets
       WHERE user_email = ? AND is_visible = TRUE
       ORDER BY position_y, position_x`,
      [userEmail]
    );

    return widgets.map((w: any) => ({
      ...w,
      config: w.config ? JSON.parse(w.config) : {}
    }));
  }

  /**
   * Create a widget
   */
  async createWidget(data: {
    user_email: string;
    widget_type: WidgetType;
    title?: string;
    data_source: DataSource;
    config?: Record<string, any>;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    refresh_interval?: number;
  }): Promise<DashboardWidget> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO dashboard_widgets (
        user_email, widget_type, title, data_source, config,
        position_x, position_y, width, height, refresh_interval
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_email,
        data.widget_type,
        data.title || null,
        data.data_source,
        JSON.stringify(data.config || {}),
        data.position_x ?? 0,
        data.position_y ?? 0,
        data.width ?? 1,
        data.height ?? 1,
        data.refresh_interval ?? null
      ]
    );

    return this.getWidget(result.lastID!);
  }

  /**
   * Get a single widget
   */
  async getWidget(widgetId: number): Promise<DashboardWidget> {
    const db = getDatabase();
    const widget = await db.get('SELECT * FROM dashboard_widgets WHERE id = ?', [widgetId]);

    if (!widget) {
      throw new Error('Widget not found');
    }

    return {
      ...(widget as unknown as DashboardWidget),
      config: typeof widget.config === 'string' ? JSON.parse(widget.config) : {}
    };
  }

  /**
   * Update a widget
   */
  async updateWidget(
    widgetId: number,
    data: Partial<{
      title: string;
      config: Record<string, any>;
      position_x: number;
      position_y: number;
      width: number;
      height: number;
      refresh_interval: number | null;
      is_visible: boolean;
    }>
  ): Promise<DashboardWidget> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title); }
    if (data.config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(data.config)); }
    if (data.position_x !== undefined) { updates.push('position_x = ?'); values.push(data.position_x); }
    if (data.position_y !== undefined) { updates.push('position_y = ?'); values.push(data.position_y); }
    if (data.width !== undefined) { updates.push('width = ?'); values.push(data.width); }
    if (data.height !== undefined) { updates.push('height = ?'); values.push(data.height); }
    if (data.refresh_interval !== undefined) { updates.push('refresh_interval = ?'); values.push(data.refresh_interval); }
    if (data.is_visible !== undefined) { updates.push('is_visible = ?'); values.push(data.is_visible); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(widgetId);
      await db.run(`UPDATE dashboard_widgets SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getWidget(widgetId);
  }

  /**
   * Delete a widget
   */
  async deleteWidget(widgetId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM dashboard_widgets WHERE id = ?', [widgetId]);
  }

  /**
   * Save widget layout (batch update positions)
   */
  async saveWidgetLayout(
    userEmail: string,
    layouts: { id: number; position_x: number; position_y: number; width: number; height: number }[]
  ): Promise<void> {
    const db = getDatabase();

    for (const layout of layouts) {
      await db.run(
        `UPDATE dashboard_widgets
         SET position_x = ?, position_y = ?, width = ?, height = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_email = ?`,
        [layout.position_x, layout.position_y, layout.width, layout.height, layout.id, userEmail]
      );
    }
  }

  /**
   * Apply a dashboard preset
   */
  async applyPreset(userEmail: string, presetId: number): Promise<DashboardWidget[]> {
    const db = getDatabase();

    const preset = await db.get('SELECT * FROM dashboard_presets WHERE id = ?', [presetId]);
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Delete existing widgets
    await db.run('DELETE FROM dashboard_widgets WHERE user_email = ?', [userEmail]);

    // Create widgets from preset
    const widgetConfigs = JSON.parse(typeof preset.widgets === 'string' ? preset.widgets : '[]');
    const widgets: DashboardWidget[] = [];

    for (const config of widgetConfigs) {
      const widget = await this.createWidget({
        user_email: userEmail,
        widget_type: config.type,
        title: config.title,
        data_source: config.data_source,
        config: config.config || {},
        position_x: config.x,
        position_y: config.y,
        width: config.w,
        height: config.h
      });
      widgets.push(widget);
    }

    return widgets;
  }

  /**
   * Get dashboard presets
   */
  async getPresets(): Promise<any[]> {
    const db = getDatabase();
    const presets = await db.all(
      'SELECT id, name, description, is_default FROM dashboard_presets WHERE is_active = TRUE ORDER BY is_default DESC, name'
    );
    return presets;
  }

  // ============================================
  // KPI SNAPSHOTS
  // ============================================

  /**
   * Capture KPI snapshot
   */
  async captureSnapshot(): Promise<number> {
    const db = getDatabase();
    const today = new Date().toISOString().split('T')[0];

    // Check if snapshot already exists for today
    const existing = await db.get(
      'SELECT id FROM kpi_snapshots WHERE snapshot_date = ? LIMIT 1',
      [today]
    );

    if (existing) {
      // Update existing snapshots
      return this.updateTodaySnapshots(today);
    }

    // Capture various KPIs
    const kpis = await this.calculateKPIs();

    for (const kpi of kpis) {
      // Get previous value
      const previous = await db.get(
        `SELECT value FROM kpi_snapshots
         WHERE kpi_type = ? AND snapshot_date < ?
         ORDER BY snapshot_date DESC LIMIT 1`,
        [kpi.type, today]
      );

      const previousValue = previous?.value !== undefined ? Number(previous.value) : null;
      const changePercent = previousValue !== null
        ? ((kpi.value - previousValue) / previousValue) * 100
        : null;

      await db.run(
        `INSERT INTO kpi_snapshots (snapshot_date, kpi_type, value, previous_value, change_percent, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [today, kpi.type, kpi.value, previousValue, changePercent, JSON.stringify(kpi.metadata ?? {})]
      );
    }

    return kpis.length;
  }

  /**
   * Update today's snapshots
   */
  private async updateTodaySnapshots(date: string): Promise<number> {
    const db = getDatabase();
    const kpis = await this.calculateKPIs();

    for (const kpi of kpis) {
      await db.run(
        `UPDATE kpi_snapshots SET value = ?, metadata = ?
         WHERE snapshot_date = ? AND kpi_type = ?`,
        [kpi.value, JSON.stringify(kpi.metadata || {}), date, kpi.type]
      );
    }

    return kpis.length;
  }

  /**
   * Calculate current KPIs
   */
  private async calculateKPIs(): Promise<{ type: string; value: number; metadata?: Record<string, any> }[]> {
    const db = getDatabase();
    const kpis: { type: string; value: number; metadata?: Record<string, any> }[] = [];

    // Total revenue (paid invoices)
    const revenue = await db.get(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = \'paid\''
    );
    kpis.push({ type: 'total_revenue', value: Number(revenue?.total ?? 0) });

    // Monthly revenue
    const monthlyRevenue = await db.get(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices
       WHERE status = 'paid' AND paid_at >= date('now', 'start of month')`
    );
    kpis.push({ type: 'monthly_revenue', value: Number(monthlyRevenue?.total ?? 0) });

    // Active clients
    const activeClients = await db.get(
      'SELECT COUNT(*) as count FROM clients WHERE status = \'active\''
    );
    kpis.push({ type: 'active_clients', value: Number(activeClients?.count ?? 0) });

    // Active projects
    const activeProjects = await db.get(
      'SELECT COUNT(*) as count FROM projects WHERE status IN (\'in_progress\', \'active\')'
    );
    kpis.push({ type: 'active_projects', value: Number(activeProjects?.count ?? 0) });

    // Pipeline value
    const pipelineValue = await db.get(
      `SELECT COALESCE(SUM(expected_value), 0) as total FROM projects
       WHERE status = 'pending' AND expected_value IS NOT NULL`
    );
    kpis.push({ type: 'pipeline_value', value: Number(pipelineValue?.total ?? 0) });

    // New leads this month
    const newLeads = await db.get(
      `SELECT COUNT(*) as count FROM projects
       WHERE status = 'pending' AND created_at >= date('now', 'start of month')`
    );
    kpis.push({ type: 'new_leads_monthly', value: Number(newLeads?.count ?? 0) });

    // Outstanding invoices
    const outstanding = await db.get(
      `SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as total
       FROM invoices WHERE status IN ('sent', 'overdue')`
    );
    kpis.push({ type: 'outstanding_invoices', value: Number(outstanding?.total ?? 0) });

    // Overdue invoices
    const overdue = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
       FROM invoices WHERE status = 'overdue'`
    );
    kpis.push({
      type: 'overdue_invoices',
      value: Number(overdue?.total ?? 0),
      metadata: { count: Number(overdue?.count ?? 0) }
    });

    // Conversion rate (won / total closed)
    const conversion = await db.get(
      `SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as won,
        COUNT(CASE WHEN status IN ('completed', 'cancelled') THEN 1 END) as total_closed
       FROM projects`
    );
    const totalClosed = Number(conversion?.total_closed ?? 0);
    const won = Number(conversion?.won ?? 0);
    const conversionRate = totalClosed > 0 ? (won / totalClosed) * 100 : 0;
    kpis.push({ type: 'conversion_rate', value: conversionRate });

    return kpis;
  }

  /**
   * Get KPI trend
   */
  async getKPITrend(
    kpiType: string,
    dateRange?: DateRange
  ): Promise<KPISnapshot[]> {
    const db = getDatabase();

    let query = 'SELECT * FROM kpi_snapshots WHERE kpi_type = ?';
    const params: string[] = [kpiType];

    if (dateRange?.start) {
      query += ' AND snapshot_date >= ?';
      params.push(dateRange.start);
    }

    if (dateRange?.end) {
      query += ' AND snapshot_date <= ?';
      params.push(dateRange.end);
    }

    query += ' ORDER BY snapshot_date ASC';

    const snapshots = await db.all(query, params);

    return snapshots.map((s: any) => ({
      ...s,
      metadata: s.metadata ? JSON.parse(s.metadata) : null
    }));
  }

  /**
   * Get latest KPIs
   */
  async getLatestKPIs(): Promise<KPISnapshot[]> {
    const db = getDatabase();

    const snapshots = await db.all(`
      SELECT k1.*
      FROM kpi_snapshots k1
      INNER JOIN (
        SELECT kpi_type, MAX(snapshot_date) as max_date
        FROM kpi_snapshots
        GROUP BY kpi_type
      ) k2 ON k1.kpi_type = k2.kpi_type AND k1.snapshot_date = k2.max_date
      ORDER BY k1.kpi_type
    `);

    return snapshots.map((s: any) => ({
      ...s,
      metadata: s.metadata ? JSON.parse(s.metadata) : null
    }));
  }

  // ============================================
  // METRIC ALERTS
  // ============================================

  /**
   * Create a metric alert
   */
  async createAlert(data: {
    name: string;
    kpi_type: string;
    condition: AlertCondition;
    threshold_value: number;
    notification_emails: string[];
    created_by?: string;
  }): Promise<MetricAlert> {
    const db = getDatabase();

    const result = await db.run(
      `INSERT INTO metric_alerts (name, kpi_type, condition, threshold_value, notification_emails, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.kpi_type,
        data.condition,
        data.threshold_value,
        JSON.stringify(data.notification_emails),
        data.created_by || null
      ]
    );

    return this.getAlert(result.lastID!);
  }

  /**
   * Get all alerts
   */
  async getAlerts(): Promise<MetricAlert[]> {
    const db = getDatabase();
    const alerts = await db.all('SELECT * FROM metric_alerts ORDER BY name');

    return alerts.map((a: any) => ({
      ...a,
      notification_emails: a.notification_emails ? JSON.parse(a.notification_emails) : []
    }));
  }

  /**
   * Get a single alert
   */
  async getAlert(alertId: number): Promise<MetricAlert> {
    const db = getDatabase();
    const alert = await db.get('SELECT * FROM metric_alerts WHERE id = ?', [alertId]);

    if (!alert) {
      throw new Error('Alert not found');
    }

    return {
      ...(alert as unknown as MetricAlert),
      notification_emails: typeof alert.notification_emails === 'string' ? JSON.parse(alert.notification_emails) : []
    };
  }

  /**
   * Update an alert
   */
  async updateAlert(
    alertId: number,
    data: Partial<{
      name: string;
      kpi_type: string;
      condition: AlertCondition;
      threshold_value: number;
      notification_emails: string[];
      is_active: boolean;
    }>
  ): Promise<MetricAlert> {
    const db = getDatabase();

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.kpi_type !== undefined) { updates.push('kpi_type = ?'); values.push(data.kpi_type); }
    if (data.condition !== undefined) { updates.push('condition = ?'); values.push(data.condition); }
    if (data.threshold_value !== undefined) { updates.push('threshold_value = ?'); values.push(data.threshold_value); }
    if (data.notification_emails !== undefined) { updates.push('notification_emails = ?'); values.push(JSON.stringify(data.notification_emails)); }
    if (data.is_active !== undefined) { updates.push('is_active = ?'); values.push(data.is_active); }

    if (updates.length > 0) {
      values.push(alertId);
      await db.run(`UPDATE metric_alerts SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getAlert(alertId);
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: number): Promise<void> {
    const db = getDatabase();
    await db.run('DELETE FROM metric_alerts WHERE id = ?', [alertId]);
  }

  /**
   * Check alerts and return triggered ones
   */
  async checkAlerts(): Promise<{ alert: MetricAlert; currentValue: number; triggered: boolean }[]> {
    const alerts = await this.getAlerts();
    const latestKPIs = await this.getLatestKPIs();
    const results: { alert: MetricAlert; currentValue: number; triggered: boolean }[] = [];

    for (const alert of alerts) {
      if (!alert.is_active) continue;

      const kpi = latestKPIs.find(k => k.kpi_type === alert.kpi_type);
      if (!kpi) continue;

      let triggered = false;
      const value = kpi.value;

      switch (alert.condition) {
      case 'above':
        triggered = value > alert.threshold_value;
        break;
      case 'below':
        triggered = value < alert.threshold_value;
        break;
      case 'equals':
        triggered = value === alert.threshold_value;
        break;
      case 'change_above':
        triggered = (kpi.change_percent || 0) > alert.threshold_value;
        break;
      case 'change_below':
        triggered = (kpi.change_percent || 0) < alert.threshold_value;
        break;
      }

      results.push({ alert, currentValue: value, triggered });

      if (triggered) {
        // Update alert
        const db = getDatabase();
        await db.run(
          'UPDATE metric_alerts SET last_triggered_at = CURRENT_TIMESTAMP, trigger_count = trigger_count + 1 WHERE id = ?',
          [alert.id]
        );
      }
    }

    return results;
  }

  // ============================================
  // REPORT DATA GENERATION
  // ============================================

  /**
   * Generate report data
   */
  async generateReportData(
    reportType: ReportType,
    filters: ReportFilters = {}
  ): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();

    switch (reportType) {
    case 'revenue':
      return this.generateRevenueReport(filters);
    case 'pipeline':
      return this.generatePipelineReport(filters);
    case 'project':
      return this.generateProjectReport(filters);
    case 'client':
      return this.generateClientReport(filters);
    case 'team':
      return this.generateTeamReport(filters);
    case 'lead':
      return this.generateLeadReport(filters);
    case 'invoice':
      return this.generateInvoiceReport(filters);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  private async generateRevenueReport(filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();
    try {
      let query = `
        SELECT
          strftime('%Y-%m', paid_date) as month,
          COUNT(*) as invoice_count,
          SUM(amount_total) as total_revenue,
          AVG(amount_total) as avg_invoice
        FROM invoices
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
        FROM invoices WHERE status = 'paid'
      `);

      return { data, summary: summary ?? {} };
    } catch (err) {
      logger.error('Error generating revenue report', { category: 'analytics', metadata: { error: err, filters } });
      throw err;
    }
  }

  private async generatePipelineReport(_filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();

    const data = await db.all(`
      SELECT
        ps.name as stage_name,
        ps.sort_order,
        COUNT(p.id) as project_count,
        COALESCE(SUM(p.expected_value), 0) as total_value,
        ps.win_probability
      FROM pipeline_stages ps
      LEFT JOIN projects p ON ps.id = p.pipeline_stage_id
      GROUP BY ps.id
      ORDER BY ps.sort_order
    `);

    const summary = await db.get(`
      SELECT
        COUNT(*) as total_leads,
        SUM(expected_value) as total_pipeline_value,
        COUNT(CASE WHEN pipeline_stage_id = (SELECT id FROM pipeline_stages WHERE is_won = TRUE) THEN 1 END) as won_count
      FROM projects WHERE status = 'pending' OR pipeline_stage_id IS NOT NULL
    `);

    return { data, summary: summary ?? {} };
  }

  private async generateProjectReport(filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();

    let query = `
      SELECT
        p.*,
        c.company_name,
        c.contact_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
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
      FROM projects
    `);

    return { data, summary: summary ?? {} };
  }

  private async generateClientReport(_filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();

    const data = await db.all(`
      SELECT
        c.*,
        COUNT(DISTINCT p.id) as project_count,
        COALESCE(SUM(i.total_amount), 0) as total_revenue,
        COUNT(DISTINCT CASE WHEN i.status = 'paid' THEN i.id END) as paid_invoices
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      LEFT JOIN invoices i ON c.id = i.client_id AND i.status = 'paid'
      GROUP BY c.id
      ORDER BY total_revenue DESC
    `);

    const summary = await db.get(`
      SELECT
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
        AVG(lifetime_value) as avg_lifetime_value
      FROM clients
    `);

    return { data, summary: summary ?? {} };
  }

  private async generateTeamReport(_filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
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

  private async generateLeadReport(_filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();

    const data = await db.all(`
      SELECT
        p.*,
        c.company_name,
        c.contact_name,
        ps.name as stage_name,
        ls.name as source_name
      FROM projects p
      LEFT JOIN clients c ON p.client_id = c.id
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
      FROM projects
      WHERE status = 'pending' OR pipeline_stage_id IS NOT NULL
    `);

    return { data, summary: summary ?? {} };
  }

  private async generateInvoiceReport(filters: ReportFilters): Promise<{ data: any[]; summary: Record<string, any> }> {
    const db = getDatabase();

    let query = `
      SELECT
        i.*,
        c.company_name,
        c.contact_name,
        p.project_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
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
      FROM invoices
    `);

    return { data, summary: summary ?? {} };
  }

  // ============================================
  // Route-compatible wrapper methods
  // ============================================

  // Reports
  async getSavedReports(_type?: string, _favorites?: boolean): Promise<SavedReport[]> {
    return this.getReports();
  }

  async createSavedReport(data: Parameters<typeof this.createReport>[0]): Promise<SavedReport> {
    return this.createReport(data);
  }

  async getSavedReport(reportId: number): Promise<SavedReport> {
    return this.getReport(reportId);
  }

  async updateSavedReport(reportId: number, data: Parameters<typeof this.updateReport>[1]): Promise<SavedReport> {
    return this.updateReport(reportId, data);
  }

  async deleteSavedReport(reportId: number): Promise<void> {
    return this.deleteReport(reportId);
  }

  async toggleReportFavorite(reportId: number): Promise<SavedReport> {
    return this.toggleFavorite(reportId);
  }

  async runReport(reportId: number): Promise<{ data: any[]; summary: Record<string, any> }> {
    const report = await this.getReport(reportId);
    return this.generateReportData(report.report_type, report.filters || {});
  }

  // Schedules
  async getReportSchedules(reportId?: number): Promise<ReportSchedule[]> {
    return this.getSchedules(reportId);
  }

  async createReportSchedule(data: Parameters<typeof this.createSchedule>[0]): Promise<ReportSchedule> {
    return this.createSchedule(data);
  }

  async updateReportSchedule(scheduleId: number, data: Parameters<typeof this.updateSchedule>[1]): Promise<ReportSchedule> {
    return this.updateSchedule(scheduleId, data);
  }

  async deleteReportSchedule(scheduleId: number): Promise<void> {
    return this.deleteSchedule(scheduleId);
  }

  async processDueSchedules(): Promise<{ processed: number; errors: string[] }> {
    const dueSchedules = await this.getDueSchedules();
    let processed = 0;
    const errors: string[] = [];

    for (const schedule of dueSchedules) {
      try {
        await this.markScheduleSent(schedule.id);
        processed++;
      } catch (err) {
        errors.push(`Schedule ${schedule.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { processed, errors };
  }

  // Widgets
  async getDashboardWidgets(userEmail: string): Promise<DashboardWidget[]> {
    return this.getWidgets(userEmail);
  }

  async createDashboardWidget(data: Parameters<typeof this.createWidget>[0]): Promise<DashboardWidget> {
    return this.createWidget(data);
  }

  async updateDashboardWidget(widgetId: number, data: Parameters<typeof this.updateWidget>[1]): Promise<DashboardWidget> {
    return this.updateWidget(widgetId, data);
  }

  async deleteDashboardWidget(widgetId: number): Promise<void> {
    return this.deleteWidget(widgetId);
  }

  async updateWidgetLayout(userEmail: string, layout: { id: number; x: number; y: number; w: number; h: number }[]): Promise<void> {
    return this.saveWidgetLayout(
      userEmail,
      layout.map(l => ({ id: l.id, position_x: l.x, position_y: l.y, width: l.w, height: l.h }))
    );
  }

  async getDashboardPresets(): Promise<any[]> {
    return this.getPresets();
  }

  async applyDashboardPreset(userEmail: string, presetId: number): Promise<DashboardWidget[]> {
    return this.applyPreset(userEmail, presetId);
  }

  // KPIs
  async captureKPISnapshot(): Promise<number> {
    return this.captureSnapshot();
  }

  // Alerts
  async getMetricAlerts(): Promise<MetricAlert[]> {
    return this.getAlerts();
  }

  async createMetricAlert(data: Parameters<typeof this.createAlert>[0]): Promise<MetricAlert> {
    return this.createAlert(data);
  }

  async updateMetricAlert(alertId: number, data: Parameters<typeof this.updateAlert>[1]): Promise<MetricAlert> {
    return this.updateAlert(alertId, data);
  }

  async deleteMetricAlert(alertId: number): Promise<void> {
    return this.deleteAlert(alertId);
  }

  async checkAlertTriggers(): Promise<{ alert: MetricAlert; currentValue: number; triggered: boolean }[]> {
    return this.checkAlerts();
  }

  // Quick Analytics
  async getRevenueAnalytics(days?: number): Promise<{ data: any[]; summary: Record<string, any> }> {
    const dateRange = this.daysToDateRange(days);
    try {
      return await this.generateReportData('revenue', { dateRange });
    } catch (err) {
      logger.error('Failed to generate revenue analytics', { category: 'analytics', metadata: { error: err, dateRange } });
      throw new Error('Revenue analytics generation failed');
    }
  }

  async getPipelineAnalytics(): Promise<{ data: any[]; summary: Record<string, any> }> {
    return this.generateReportData('pipeline', {});
  }

  async getProjectAnalytics(days?: number): Promise<{ data: any[]; summary: Record<string, any> }> {
    const dateRange = this.daysToDateRange(days);
    return this.generateReportData('project', { dateRange });
  }

  async getClientAnalytics(): Promise<{ data: any[]; summary: Record<string, any> }> {
    return this.generateReportData('client', {});
  }

  async getTeamAnalytics(days?: number): Promise<{ data: any[]; summary: Record<string, any> }> {
    const dateRange = this.daysToDateRange(days);
    return this.generateReportData('team', { dateRange });
  }

  private daysToDateRange(days?: number): DateRange | undefined {
    if (!days) return undefined;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  }

  async getReportRuns(reportId?: number, _limit?: number): Promise<any[]> {
    const db = getDatabase();
    let query = 'SELECT * FROM report_runs';
    const params: number[] = [];

    if (reportId) {
      query += ' WHERE report_id = ?';
      params.push(reportId);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';
    return db.all(query, params);
  }

  // ============================================
  // SECTION 8.1: BUSINESS INTELLIGENCE
  // ============================================

  /**
   * Get revenue breakdown by time period (month/quarter/year)
   */
  async getRevenueByPeriod(
    period: 'month' | 'quarter' | 'year',
    startDate?: string,
    endDate?: string
  ): Promise<{ period: string; revenue: number; invoiceCount: number; averageInvoice: number }[]> {
    const db = getDatabase();

    let dateFormat: string;
    let groupBy: string;

    switch (period) {
    case 'month':
      dateFormat = '%Y-%m';
      groupBy = 'strftime(\'%Y-%m\', paid_at)';
      break;
    case 'quarter':
      groupBy = 'strftime(\'%Y\', paid_at) || \'-Q\' || ((CAST(strftime(\'%m\', paid_at) AS INTEGER) + 2) / 3)';
      break;
    case 'year':
      dateFormat = '%Y';
      groupBy = 'strftime(\'%Y\', paid_at)';
      break;
    }

    let query = `
      SELECT
        ${groupBy} as period,
        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as revenue,
        COUNT(*) as invoice_count,
        AVG(CASE WHEN status = 'paid' THEN total_amount ELSE NULL END) as average_invoice
      FROM invoices
      WHERE paid_at IS NOT NULL
    `;

    const params: string[] = [];

    if (startDate) {
      query += ' AND paid_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND paid_at <= ?';
      params.push(endDate);
    }

    query += ` GROUP BY ${groupBy} ORDER BY period DESC LIMIT 24`;

    const results = await db.all(query, params) as Array<{
      period: string;
      revenue: number;
      invoice_count: number;
      average_invoice: number | null;
    }>;

    return results.map(r => ({
      period: r.period,
      revenue: r.revenue || 0,
      invoiceCount: r.invoice_count,
      averageInvoice: r.average_invoice || 0
    }));
  }

  /**
   * Get project pipeline value (proposals in progress)
   */
  async getProjectPipelineValue(): Promise<{
    totalValue: number;
    proposalCount: number;
    averageValue: number;
    byStatus: { status: string; value: number; count: number }[];
  }> {
    const db = getDatabase();

    const results = await db.all(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_price) as total_value
      FROM proposals
      WHERE status IN ('draft', 'sent', 'viewed')
      GROUP BY status
    `) as Array<{
      status: string;
      count: number;
      total_value: number | null;
    }>;

    const totalValue = results.reduce((sum, r) => sum + (r.total_value || 0), 0);
    const totalCount = results.reduce((sum, r) => sum + r.count, 0);

    return {
      totalValue,
      proposalCount: totalCount,
      averageValue: totalCount > 0 ? totalValue / totalCount : 0,
      byStatus: results.map(r => ({
        status: r.status,
        value: r.total_value || 0,
        count: r.count
      }))
    };
  }

  /**
   * Get client acquisition funnel metrics
   */
  async getAcquisitionFunnel(startDate?: string, endDate?: string): Promise<{
    contacts: number;
    leads: number;
    proposals: number;
    clients: number;
    conversionRates: {
      contactToLead: number;
      leadToProposal: number;
      proposalToClient: number;
      overall: number;
    };
  }> {
    const db = getDatabase();

    let dateFilter = '';
    const params: string[] = [];

    if (startDate) {
      dateFilter = ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND created_at <= ?';
      params.push(endDate);
    }

    // Since migration 086, leads/intakes are stored in projects table
    const [contacts, leads, proposals, clients] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM projects WHERE status IN ('pending', 'new')${dateFilter}`, params),
      db.get(`SELECT COUNT(*) as count FROM projects WHERE status IN ('pending', 'new', 'in-progress')${dateFilter}`, params),
      db.get(`SELECT COUNT(*) as count FROM proposals WHERE 1=1${dateFilter}`, params),
      db.get(`SELECT COUNT(*) as count FROM clients WHERE 1=1${dateFilter}`, params)
    ]) as Array<{ count: number } | undefined>;

    const contactCount = contacts?.count || 0;
    const leadCount = leads?.count || 0;
    const proposalCount = proposals?.count || 0;
    const clientCount = clients?.count || 0;

    return {
      contacts: contactCount,
      leads: leadCount,
      proposals: proposalCount,
      clients: clientCount,
      conversionRates: {
        contactToLead: contactCount > 0 ? (leadCount / contactCount) * 100 : 0,
        leadToProposal: leadCount > 0 ? (proposalCount / leadCount) * 100 : 0,
        proposalToClient: proposalCount > 0 ? (clientCount / proposalCount) * 100 : 0,
        overall: contactCount > 0 ? (clientCount / contactCount) * 100 : 0
      }
    };
  }

  /**
   * Get project statistics (average value, duration, popular types)
   */
  async getProjectStatistics(): Promise<{
    averageValue: number;
    averageDuration: number;
    popularTypes: { type: string; count: number; totalValue: number }[];
    statusBreakdown: { status: string; count: number }[];
  }> {
    const db = getDatabase();

    const [avgStats, typeStats, statusStats] = await Promise.all([
      db.get(`
        SELECT
          AVG(COALESCE(budget, 0)) as average_value,
          AVG(JULIANDAY(COALESCE(end_date, date('now'))) - JULIANDAY(start_date)) as average_duration
        FROM projects
        WHERE status != 'cancelled' AND start_date IS NOT NULL
      `),
      db.all(`
        SELECT
          project_type as type,
          COUNT(*) as count,
          SUM(COALESCE(budget, 0)) as total_value
        FROM projects
        WHERE status != 'cancelled'
        GROUP BY project_type
        ORDER BY count DESC
        LIMIT 10
      `),
      db.all(`
        SELECT status, COUNT(*) as count
        FROM projects
        GROUP BY status
        ORDER BY count DESC
      `)
    ]) as [
      { average_value: number | null; average_duration: number | null } | undefined,
      Array<{ type: string; count: number; total_value: number }>,
      Array<{ status: string; count: number }>
    ];

    return {
      averageValue: avgStats?.average_value || 0,
      averageDuration: avgStats?.average_duration || 0,
      popularTypes: typeStats.map(t => ({
        type: t.type || 'Unknown',
        count: t.count,
        totalValue: t.total_value || 0
      })),
      statusBreakdown: statusStats.map(s => ({
        status: s.status,
        count: s.count
      }))
    };
  }

  // ============================================
  // SECTION 8.2: CLIENT INSIGHTS
  // ============================================

  /**
   * Calculate client lifetime value
   */
  async getClientLifetimeValue(limit: number = 20): Promise<Array<{
    clientId: number;
    clientName: string;
    totalRevenue: number;
    projectCount: number;
    averageProjectValue: number;
    firstProjectDate: string;
    lastProjectDate: string;
    lifetimeMonths: number;
    monthlyValue: number;
  }>> {
    const db = getDatabase();

    const results = await db.all(`
      SELECT
        c.id as client_id,
        COALESCE(c.contact_name, c.company_name) as client_name,
        SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_revenue,
        COUNT(DISTINCT p.id) as project_count,
        MIN(p.created_at) as first_project_date,
        MAX(p.created_at) as last_project_date
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      LEFT JOIN invoices i ON p.id = i.project_id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, COALESCE(c.contact_name, c.company_name)
      HAVING total_revenue > 0
      ORDER BY total_revenue DESC
      LIMIT ?
    `, [limit]) as Array<{
      client_id: number;
      client_name: string;
      total_revenue: number;
      project_count: number;
      first_project_date: string | null;
      last_project_date: string | null;
    }>;

    return results.map(r => {
      const firstDate = r.first_project_date ? new Date(r.first_project_date) : new Date();
      const lastDate = r.last_project_date ? new Date(r.last_project_date) : new Date();
      const lifetimeMonths = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));

      return {
        clientId: r.client_id,
        clientName: r.client_name,
        totalRevenue: r.total_revenue || 0,
        projectCount: r.project_count,
        averageProjectValue: r.project_count > 0 ? (r.total_revenue || 0) / r.project_count : 0,
        firstProjectDate: r.first_project_date || '',
        lastProjectDate: r.last_project_date || '',
        lifetimeMonths,
        monthlyValue: (r.total_revenue || 0) / lifetimeMonths
      };
    });
  }

  /**
   * Calculate client activity scores
   */
  async getClientActivityScores(limit: number = 20): Promise<Array<{
    clientId: number;
    clientName: string;
    score: number;
    factors: {
      responseTime: number;
      approvalSpeed: number;
      paymentSpeed: number;
      engagement: number;
    };
    lastActivity: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>> {
    const db = getDatabase();

    const results = await db.all(`
      SELECT
        c.id as client_id,
        COALESCE(c.contact_name, c.company_name) as client_name,
        c.updated_at as last_activity,
        (SELECT COUNT(*) FROM messages m JOIN message_threads t ON m.thread_id = t.id WHERE t.client_id = c.id AND m.created_at > datetime('now', '-30 days')) as recent_messages,
        (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id AND i.status = 'paid') as paid_invoices,
        (SELECT AVG(JULIANDAY(i.paid_at) - JULIANDAY(i.due_date))
         FROM invoices i WHERE i.client_id = c.id AND i.status = 'paid' AND i.paid_at IS NOT NULL) as avg_payment_days
      FROM clients c
      WHERE c.deleted_at IS NULL
      ORDER BY c.updated_at DESC
      LIMIT ?
    `, [limit]) as Array<{
      client_id: number;
      client_name: string;
      last_activity: string;
      recent_messages: number;
      paid_invoices: number;
      avg_payment_days: number | null;
    }>;

    return results.map(r => {
      // Calculate factor scores (0-25 each)
      const engagementScore = Math.min(25, (r.recent_messages || 0) * 5);
      const paymentScore = r.avg_payment_days !== null
        ? Math.max(0, 25 - Math.max(0, r.avg_payment_days * 1.5))
        : 12.5;
      const responseScore = 12.5; // Default if no data
      const approvalScore = 12.5; // Default if no data

      const totalScore = responseScore + approvalScore + paymentScore + engagementScore;

      return {
        clientId: r.client_id,
        clientName: r.client_name,
        score: Math.round(totalScore),
        factors: {
          responseTime: Math.round(responseScore),
          approvalSpeed: Math.round(approvalScore),
          paymentSpeed: Math.round(paymentScore),
          engagement: Math.round(engagementScore)
        },
        lastActivity: r.last_activity || '',
        riskLevel: totalScore >= 70 ? 'low' : totalScore >= 40 ? 'medium' : 'high'
      };
    });
  }

  /**
   * Get upsell opportunities (clients without certain services)
   */
  async getUpsellOpportunities(): Promise<Array<{
    clientId: number;
    clientName: string;
    currentServices: string[];
    missingServices: string[];
    recommendedService: string;
    potentialValue: number;
    lastContact: string;
  }>> {
    const db = getDatabase();

    const clients = await db.all(`
      SELECT
        c.id as client_id,
        COALESCE(c.contact_name, c.company_name) as client_name,
        c.updated_at as last_contact,
        GROUP_CONCAT(DISTINCT p.project_type) as project_types,
        (SELECT COUNT(*) FROM projects WHERE client_id = c.id AND project_type = 'maintenance') as has_maintenance
      FROM clients c
      LEFT JOIN projects p ON c.id = p.client_id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, COALESCE(c.contact_name, c.company_name)
      HAVING has_maintenance = 0
    `) as Array<{
      client_id: number;
      client_name: string;
      last_contact: string;
      project_types: string | null;
      has_maintenance: number;
    }>;

    const allServices = ['website', 'web-app', 'mobile', 'branding', 'maintenance', 'seo', 'hosting'];

    return clients.map(c => {
      const currentServices = (c.project_types || '').split(',').filter(Boolean);
      const missingServices = allServices.filter(s => !currentServices.includes(s));

      const recommendedService = !currentServices.includes('maintenance')
        ? 'maintenance'
        : missingServices[0] || 'consultation';

      return {
        clientId: c.client_id,
        clientName: c.client_name,
        currentServices,
        missingServices,
        recommendedService,
        potentialValue: recommendedService === 'maintenance' ? 500 : 2000,
        lastContact: c.last_contact || ''
      };
    });
  }

  // ============================================
  // SECTION 8.3: OPERATIONAL REPORTS
  // ============================================

  /**
   * Get overdue invoices report
   */
  async getOverdueInvoicesReport(): Promise<Array<{
    invoiceId: number;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    dueDate: string;
    daysOverdue: number;
    remindersSent: number;
  }>> {
    const db = getDatabase();

    const results = await db.all(`
      SELECT
        i.id as invoice_id,
        i.invoice_number,
        COALESCE(c.contact_name, c.company_name) as client_name,
        i.total_amount as amount,
        i.due_date,
        CAST(JULIANDAY('now') - JULIANDAY(i.due_date) AS INTEGER) as days_overdue,
        (SELECT COUNT(*) FROM invoice_reminders WHERE invoice_id = i.id) as reminders_sent
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.status IN ('sent', 'overdue')
        AND i.due_date < date('now')
      ORDER BY days_overdue DESC
    `) as Array<{
      invoice_id: number;
      invoice_number: string;
      client_name: string;
      amount: number;
      due_date: string;
      days_overdue: number;
      reminders_sent: number;
    }>;

    return results.map(r => ({
      invoiceId: r.invoice_id,
      invoiceNumber: r.invoice_number || `INV-${r.invoice_id}`,
      clientName: r.client_name,
      amount: r.amount || 0,
      dueDate: r.due_date,
      daysOverdue: r.days_overdue,
      remindersSent: r.reminders_sent || 0
    }));
  }

  /**
   * Get pending approvals aging report
   */
  async getPendingApprovalsReport(): Promise<Array<{
    id: number;
    type: string;
    entityName: string;
    clientName: string;
    requestedDate: string;
    daysWaiting: number;
    remindersSent: number;
  }>> {
    const db = getDatabase();

    const results = await db.all(`
      SELECT
        a.id,
        a.entity_type as type,
        COALESCE(p.project_name, d.name, 'Unknown') as entity_name,
        COALESCE(c.contact_name, c.company_name) as client_name,
        a.created_at as requested_date,
        CAST(JULIANDAY('now') - JULIANDAY(a.created_at) AS INTEGER) as days_waiting,
        (SELECT COUNT(*) FROM approval_reminders WHERE approval_id = a.id) as reminders_sent
      FROM approvals a
      LEFT JOIN projects p ON a.entity_type = 'project' AND a.entity_id = p.id
      LEFT JOIN deliverables d ON a.entity_type = 'deliverable' AND a.entity_id = d.id
      LEFT JOIN clients c ON COALESCE(p.client_id, (SELECT project_id FROM deliverables WHERE id = a.entity_id)) IN (SELECT id FROM projects WHERE client_id = c.id)
      WHERE a.status = 'pending'
      ORDER BY days_waiting DESC
    `) as Array<{
      id: number;
      type: string;
      entity_name: string;
      client_name: string;
      requested_date: string;
      days_waiting: number;
      reminders_sent: number;
    }>;

    return results.map(r => ({
      id: r.id,
      type: r.type,
      entityName: r.entity_name,
      clientName: r.client_name || 'Unknown',
      requestedDate: r.requested_date,
      daysWaiting: r.days_waiting,
      remindersSent: r.reminders_sent || 0
    }));
  }

  /**
   * Get document request status report
   */
  async getDocumentRequestsStatusReport(): Promise<{
    pending: number;
    submitted: number;
    approved: number;
    overdue: number;
    byClient: { clientId: number; clientName: string; pending: number; overdue: number }[];
  }> {
    const db = getDatabase();

    const [statusCounts, byClient] = await Promise.all([
      db.get(`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'pending' AND due_date < date('now') THEN 1 ELSE 0 END) as overdue
        FROM document_requests
      `),
      db.all(`
        SELECT
          c.id as client_id,
          COALESCE(c.contact_name, c.company_name) as client_name,
          SUM(CASE WHEN dr.status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN dr.status = 'pending' AND dr.due_date < date('now') THEN 1 ELSE 0 END) as overdue
        FROM clients c
        JOIN document_requests dr ON dr.client_id = c.id
        GROUP BY c.id, COALESCE(c.contact_name, c.company_name)
        HAVING pending > 0
        ORDER BY overdue DESC, pending DESC
      `)
    ]) as [
      { pending: number; submitted: number; approved: number; overdue: number } | undefined,
      Array<{ client_id: number; client_name: string; pending: number; overdue: number }>
    ];

    return {
      pending: statusCounts?.pending || 0,
      submitted: statusCounts?.submitted || 0,
      approved: statusCounts?.approved || 0,
      overdue: statusCounts?.overdue || 0,
      byClient: byClient.map(c => ({
        clientId: c.client_id,
        clientName: c.client_name,
        pending: c.pending,
        overdue: c.overdue
      }))
    };
  }

  /**
   * Get project health summary
   */
  async getProjectHealthSummary(): Promise<{
    onTrack: number;
    atRisk: number;
    overdue: number;
    projects: Array<{
      projectId: number;
      projectName: string;
      clientName: string;
      status: 'on_track' | 'at_risk' | 'overdue';
      dueDate: string;
      completionPercent: number;
      issues: string[];
    }>;
  }> {
    const db = getDatabase();

    const projects = await db.all(`
      SELECT
        p.id as project_id,
        p.project_name as project_name,
        COALESCE(c.contact_name, c.company_name) as client_name,
        p.status,
        p.estimated_end_date as due_date,
        p.created_at,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as total_tasks,
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status != 'completed' AND due_date < date('now')) as overdue_tasks,
        (SELECT COUNT(*) FROM invoices WHERE project_id = p.id AND status IN ('sent', 'overdue') AND due_date < date('now')) as overdue_invoices
      FROM projects p
      JOIN clients c ON p.client_id = c.id
      WHERE p.status IN ('active', 'in_progress', 'review')
      ORDER BY p.estimated_end_date ASC
    `) as Array<{
      project_id: number;
      project_name: string;
      client_name: string;
      status: string;
      due_date: string | null;
      created_at: string;
      completed_tasks: number;
      total_tasks: number;
      overdue_tasks: number;
      overdue_invoices: number;
    }>;

    let onTrack = 0;
    let atRisk = 0;
    let overdue = 0;

    const projectList = projects.map(p => {
      const completionPercent = p.total_tasks > 0
        ? Math.round((p.completed_tasks / p.total_tasks) * 100)
        : 0;

      const issues: string[] = [];
      let healthStatus: 'on_track' | 'at_risk' | 'overdue' = 'on_track';

      if (p.overdue_tasks > 0) {
        issues.push(`${p.overdue_tasks} overdue task(s)`);
        healthStatus = 'at_risk';
      }

      if (p.overdue_invoices > 0) {
        issues.push(`${p.overdue_invoices} overdue invoice(s)`);
        healthStatus = 'at_risk';
      }

      if (p.due_date && new Date(p.due_date) < new Date()) {
        issues.push('Project past due date');
        healthStatus = 'overdue';
      }

      if (healthStatus === 'on_track') onTrack++;
      else if (healthStatus === 'at_risk') atRisk++;
      else overdue++;

      return {
        projectId: p.project_id,
        projectName: p.project_name,
        clientName: p.client_name,
        status: healthStatus,
        dueDate: p.due_date || '',
        completionPercent,
        issues
      };
    });

    return {
      onTrack,
      atRisk,
      overdue,
      projects: projectList
    };
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
