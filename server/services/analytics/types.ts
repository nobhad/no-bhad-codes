/**
 * ===============================================
 * ANALYTICS — SHARED TYPES & COLUMN CONSTANTS
 * ===============================================
 */

// ============================================
// Types
// ============================================

export type ReportType = 'revenue' | 'pipeline' | 'project' | 'client' | 'team' | 'lead' | 'invoice';
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table';
export type WidgetType = 'metric' | 'chart' | 'list' | 'table' | 'progress' | 'calendar';
export type DataSource =
  | 'revenue'
  | 'projects'
  | 'clients'
  | 'leads'
  | 'invoices'
  | 'tasks'
  | 'time'
  | 'milestones';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type AlertCondition = 'above' | 'below' | 'equals' | 'change_above' | 'change_below';

export type SqlParam = string | number | boolean | null;

export interface DateRange {
  start: string;
  end: string;
}

export interface ReportFilters {
  dateRange?: DateRange;
  clientId?: number;
  projectId?: number;
  status?: string;
  [key: string]: string | number | boolean | DateRange | undefined;
}

export interface SavedReport {
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

export interface ReportSchedule {
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

export interface DashboardWidget {
  id: number;
  user_email: string;
  widget_type: WidgetType;
  title: string | null;
  data_source: DataSource;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  refresh_interval: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface KPISnapshot {
  id: number;
  snapshot_date: string;
  kpi_type: string;
  value: number;
  previous_value: number | null;
  change_percent: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ReportDataResult {
  data: Record<string, unknown>[];
  summary: Record<string, unknown>;
}

export interface DashboardPreset {
  id: number;
  name: string;
  description: string | null;
  is_default: boolean;
}

export interface ReportRun {
  id: number;
  report_id: number;
  schedule_id: number | null;
  run_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  row_count: number | null;
  file_path: string | null;
  error_message: string | null;
  run_by: string | null;
  created_at: string;
}

export interface MetricAlert {
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
// Raw DB row types (JSON fields are strings)
// ============================================

export interface SavedReportRow extends Omit<SavedReport, 'filters' | 'columns'> {
  filters: string;
  columns: string | null;
}

export interface ReportScheduleRow extends Omit<ReportSchedule, 'recipients'> {
  recipients: string;
}

export interface DashboardWidgetRow extends Omit<DashboardWidget, 'config'> {
  config: string;
}

export interface KPISnapshotRow extends Omit<KPISnapshot, 'metadata'> {
  metadata: string | null;
}

export interface MetricAlertRow extends Omit<MetricAlert, 'notification_emails'> {
  notification_emails: string;
}

// ============================================
// Column Constants — Explicit column lists for SELECT queries
// ============================================

export const SAVED_REPORT_COLUMNS = `
  id, name, description, report_type, filters, columns, sort_by, sort_order,
  chart_type, is_favorite, is_shared, created_by, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const REPORT_SCHEDULE_COLUMNS = `
  id, report_id, name, frequency, day_of_week, day_of_month, time_of_day,
  timezone, recipients, format, include_charts, last_sent_at, next_send_at,
  is_active, created_by, created_at
`.replace(/\s+/g, ' ').trim();

export const DASHBOARD_WIDGET_COLUMNS = `
  id, user_email, widget_type, title, data_source, config, position_x, position_y,
  width, height, refresh_interval, is_visible, created_at, updated_at
`.replace(/\s+/g, ' ').trim();

export const DASHBOARD_PRESET_COLUMNS = `
  id, name, description, widgets, is_default, is_active, created_at
`.replace(/\s+/g, ' ').trim();

export const KPI_SNAPSHOT_COLUMNS = `
  id, snapshot_date, kpi_type, value, previous_value, change_percent, metadata, created_at
`.replace(/\s+/g, ' ').trim();

export const METRIC_ALERT_COLUMNS = `
  id, name, kpi_type, condition, threshold_value, notification_emails, is_active,
  last_triggered_at, trigger_count, created_by, created_at
`.replace(/\s+/g, ' ').trim();

export const REPORT_RUN_COLUMNS = `
  id, report_id, schedule_id, run_type, status, started_at, completed_at,
  row_count, file_path, error_message, run_by, created_at
`.replace(/\s+/g, ' ').trim();
