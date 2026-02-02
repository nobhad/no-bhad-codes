/**
 * ===============================================
 * ANALYTICS SERVICE
 * ===============================================
 * Handles reports, dashboards, KPIs, and business analytics.
 */

import { getDatabase } from '../database/init.js';

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

    const result = await db.run(
      `INSERT INTO saved_reports (
        name, description, report_type, filters, columns, sort_by, sort_order, chart_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.description || null,
        data.report_type,
        JSON.stringify(data.filters || {}),
        data.columns ? JSON.stringify(data.columns) : null,
        data.sort_by || null,
        data.sort_order || 'DESC',
        data.chart_type || null,
        data.created_by || null
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
      `UPDATE report_schedules SET last_sent_at = CURRENT_TIMESTAMP, next_send_at = ? WHERE id = ?`,
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

      case 'weekly':
        const targetDay = dayOfWeek ?? 1; // Default to Monday
        while (next.getDay() !== targetDay) {
          next.setDate(next.getDate() + 1);
        }
        break;

      case 'monthly':
        const targetDate = dayOfMonth ?? 1;
        next.setDate(targetDate);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
        }
        break;

      case 'quarterly':
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
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'paid'`
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
      `SELECT COUNT(*) as count FROM clients WHERE status = 'active'`
    );
    kpis.push({ type: 'active_clients', value: Number(activeClients?.count ?? 0) });

    // Active projects
    const activeProjects = await db.get(
      `SELECT COUNT(*) as count FROM projects WHERE status IN ('in_progress', 'active')`
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

    let query = `SELECT * FROM kpi_snapshots WHERE kpi_type = ?`;
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
          `UPDATE metric_alerts SET last_triggered_at = CURRENT_TIMESTAMP, trigger_count = trigger_count + 1 WHERE id = ?`,
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

    let query = `
      SELECT
        strftime('%Y-%m', paid_at) as month,
        COUNT(*) as invoice_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_invoice
      FROM invoices
      WHERE status = 'paid'
    `;
    const params: string[] = [];

    if (filters.dateRange?.start) {
      query += ' AND paid_at >= ?';
      params.push(filters.dateRange.start);
    }
    if (filters.dateRange?.end) {
      query += ' AND paid_at <= ?';
      params.push(filters.dateRange.end);
    }

    query += ' GROUP BY month ORDER BY month';

    const data = await db.all(query, params);

    const summary = await db.get(`
      SELECT
        SUM(total_amount) as total_revenue,
        COUNT(*) as total_invoices,
        AVG(total_amount) as avg_invoice
      FROM invoices WHERE status = 'paid'
    `);

    return { data, summary: summary ?? {} };
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
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
        SUM(actual_hours) as total_hours
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
        user_name,
        SUM(hours) as total_hours,
        COUNT(DISTINCT project_id) as projects_worked,
        SUM(CASE WHEN billable = TRUE THEN hours ELSE 0 END) as billable_hours
      FROM time_entries
      WHERE date >= date('now', '-30 days')
      GROUP BY user_name
      ORDER BY total_hours DESC
    `);

    const summary = await db.get(`
      SELECT
        SUM(hours) as total_hours,
        SUM(CASE WHEN billable = TRUE THEN hours ELSE 0 END) as billable_hours,
        COUNT(DISTINCT user_name) as team_members
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
    return this.generateReportData('revenue', { dateRange });
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
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
