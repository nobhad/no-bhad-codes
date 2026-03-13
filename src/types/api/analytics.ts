/**
 * ===============================================
 * API TYPES — ANALYTICS
 * ===============================================
 */

// ============================================
// Analytics API Types
// ============================================

/**
 * Analytics data response
 */
export interface AnalyticsResponse {
  visitors: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
  topPages: PageAnalytics[];
  deviceBreakdown: DeviceAnalytics[];
  geoDistribution: GeoAnalytics[];
}

/**
 * Page analytics
 */
export interface PageAnalytics {
  url: string;
  views: number;
  avgTime: number;
}

/**
 * Device analytics
 */
export interface DeviceAnalytics {
  device: string;
  count: number;
  percentage: number;
}

/**
 * Geographic analytics
 */
export interface GeoAnalytics {
  country: string;
  count: number;
  percentage: number;
}


// ============================================
// Analytics & Reporting Enhancement API Types
// ============================================

/**
 * Report types
 */
export type ReportType =
  | 'revenue'
  | 'pipeline'
  | 'project'
  | 'client'
  | 'team'
  | 'lead'
  | 'invoice';

/**
 * Chart types
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'table' | 'funnel' | 'gauge';

/**
 * Saved report
 */
export interface SavedReport {
  id: number;
  name: string;
  description: string | null;
  reportType: ReportType;
  filters: Record<string, unknown> | null;
  columns: string[] | null;
  sortBy: string | null;
  sortOrder: 'ASC' | 'DESC';
  chartType: ChartType | null;
  isFavorite: boolean;
  isShared: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saved report response (snake_case for API)
 */
export interface SavedReportResponse {
  id: number;
  name: string;
  description: string | null;
  report_type: ReportType;
  filters: Record<string, unknown> | null;
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

/**
 * Report schedule frequency
 */
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

/**
 * Report format
 */
export type ReportFormat = 'pdf' | 'csv' | 'excel' | 'json';

/**
 * Report schedule
 */
export interface ReportSchedule {
  id: number;
  reportId: number;
  name: string | null;
  frequency: ScheduleFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  timezone: string;
  recipients: { email: string; name?: string }[];
  format: ReportFormat;
  includeCharts: boolean;
  lastSentAt: string | null;
  nextSendAt: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Report schedule response (snake_case for API)
 */
export interface ReportScheduleResponse {
  id: number;
  report_id: number;
  name: string | null;
  frequency: ScheduleFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  timezone: string;
  recipients: { email: string; name?: string }[];
  format: ReportFormat;
  include_charts: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

/**
 * Widget types
 */
export type WidgetType = 'metric' | 'chart' | 'list' | 'table' | 'progress' | 'calendar' | 'funnel';

/**
 * Widget data sources
 */
export type WidgetDataSource =
  | 'revenue'
  | 'projects'
  | 'clients'
  | 'leads'
  | 'invoices'
  | 'tasks'
  | 'milestones'
  | 'time';

/**
 * Dashboard widget
 */
export interface DashboardWidget {
  id: number;
  userEmail: string;
  widgetType: WidgetType;
  title: string | null;
  dataSource: WidgetDataSource;
  config: Record<string, unknown> | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  refreshInterval: number | null;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dashboard widget response (snake_case for API)
 */
export interface DashboardWidgetResponse {
  id: number;
  user_email: string;
  widget_type: WidgetType;
  title: string | null;
  data_source: WidgetDataSource;
  config: Record<string, unknown> | null;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  refresh_interval: number | null;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Dashboard preset
 */
export interface DashboardPreset {
  id: number;
  name: string;
  description: string | null;
  widgets: WidgetConfig[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

/**
 * Dashboard preset response (snake_case for API)
 */
export interface DashboardPresetResponse {
  id: number;
  name: string;
  description: string | null;
  widgets: WidgetConfig[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * Widget configuration for presets
 */
export interface WidgetConfig {
  type: WidgetType;
  title: string;
  data_source: WidgetDataSource;
  config?: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * KPI types
 */
export type KPIType =
  | 'revenue'
  | 'pipeline_value'
  | 'client_count'
  | 'project_count'
  | 'conversion_rate'
  | 'avg_project_value'
  | 'outstanding_invoices'
  | 'paid_invoices'
  | 'active_leads'
  | 'closed_leads';

/**
 * KPI snapshot
 */
export interface KPISnapshot {
  id: number;
  snapshotDate: string;
  kpiType: KPIType;
  value: number;
  previousValue: number | null;
  changePercent: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * KPI snapshot response (snake_case for API)
 */
export interface KPISnapshotResponse {
  id: number;
  snapshot_date: string;
  kpi_type: KPIType;
  value: number;
  previous_value: number | null;
  change_percent: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * KPI trend data point
 */
export interface KPITrendPoint {
  date: string;
  value: number;
  changePercent: number | null;
}

/**
 * KPI trend
 */
export interface KPITrend {
  kpiType: KPIType;
  points: KPITrendPoint[];
  currentValue: number;
  previousValue: number | null;
  overallChange: number | null;
}

/**
 * Alert condition types
 */
export type AlertCondition = 'above' | 'below' | 'equals' | 'change_above' | 'change_below';

/**
 * Metric alert
 */
export interface MetricAlert {
  id: number;
  name: string;
  kpiType: KPIType;
  condition: AlertCondition;
  thresholdValue: number;
  notificationEmails: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  createdBy: string | null;
  createdAt: string;
}

/**
 * Metric alert response (snake_case for API)
 */
export interface MetricAlertResponse {
  id: number;
  name: string;
  kpi_type: KPIType;
  condition: AlertCondition;
  threshold_value: number;
  notification_emails: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string | null;
  created_at: string;
}

/**
 * Report run status
 */
export type ReportRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Report run type
 */
export type ReportRunType = 'manual' | 'scheduled';

/**
 * Report run history
 */
export interface ReportRun {
  id: number;
  reportId: number | null;
  scheduleId: number | null;
  runType: ReportRunType;
  status: ReportRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  rowCount: number | null;
  filePath: string | null;
  errorMessage: string | null;
  runBy: string | null;
  createdAt: string;
}

/**
 * Report run response (snake_case for API)
 */
export interface ReportRunResponse {
  id: number;
  report_id: number | null;
  schedule_id: number | null;
  run_type: ReportRunType;
  status: ReportRunStatus;
  started_at: string | null;
  completed_at: string | null;
  row_count: number | null;
  file_path: string | null;
  error_message: string | null;
  run_by: string | null;
  created_at: string;
}

/**
 * Revenue analytics data
 */
export interface RevenueAnalytics {
  totalRevenue: number;
  paidRevenue: number;
  outstandingRevenue: number;
  overdueRevenue: number;
  revenueByMonth: { month: string; revenue: number; paid: number }[];
  revenueByClient: { clientId: number; clientName: string; revenue: number }[];
  avgInvoiceValue: number;
  avgDaysToPayment: number;
}

/**
 * Pipeline analytics data
 */
export interface PipelineAnalytics {
  totalValue: number;
  weightedValue: number;
  leadCount: number;
  conversionRate: number;
  byStage: { stageId: number; stageName: string; value: number; count: number }[];
  bySource: { sourceId: number; sourceName: string; value: number; count: number }[];
  avgLeadScore: number;
  avgDaysToClose: number;
}

/**
 * Project analytics data
 */
export interface ProjectAnalytics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  avgCompletionTime: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  completionTrend: { month: string; completed: number; started: number }[];
}

/**
 * Client analytics data
 */
export interface ClientAnalytics {
  totalClients: number;
  activeClients: number;
  newClientsThisMonth: number;
  avgLifetimeValue: number;
  byIndustry: { industry: string; count: number }[];
  bySize: { size: string; count: number }[];
  topClients: { clientId: number; clientName: string; revenue: number; projects: number }[];
  healthDistribution: { status: string; count: number }[];
}

/**
 * Team analytics data
 */
export interface TeamAnalytics {
  totalHours: number;
  billableHours: number;
  billablePercent: number;
  revenue: number;
  byMember: { name: string; hours: number; billableHours: number; revenue: number }[];
  byProject: { projectId: number; projectName: string; hours: number }[];
  hoursTrend: { week: string; hours: number; billableHours: number }[];
}

/**
 * Create saved report request
 */
export interface CreateSavedReportRequest {
  name: string;
  description?: string;
  report_type: ReportType;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  chart_type?: ChartType;
}

/**
 * Update saved report request
 */
export interface UpdateSavedReportRequest {
  name?: string;
  description?: string;
  filters?: Record<string, unknown>;
  columns?: string[];
  sort_by?: string;
  sort_order?: 'ASC' | 'DESC';
  chart_type?: ChartType;
  is_shared?: boolean;
}

/**
 * Create report schedule request
 */
export interface CreateReportScheduleRequest {
  name?: string;
  frequency: ScheduleFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time_of_day?: string;
  timezone?: string;
  recipients: { email: string; name?: string }[];
  format?: ReportFormat;
  include_charts?: boolean;
}

/**
 * Update report schedule request
 */
export interface UpdateReportScheduleRequest {
  name?: string;
  frequency?: ScheduleFrequency;
  day_of_week?: number;
  day_of_month?: number;
  time_of_day?: string;
  timezone?: string;
  recipients?: { email: string; name?: string }[];
  format?: ReportFormat;
  include_charts?: boolean;
  is_active?: boolean;
}

/**
 * Create dashboard widget request
 */
export interface CreateDashboardWidgetRequest {
  widget_type: WidgetType;
  title?: string;
  data_source: WidgetDataSource;
  config?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
}

/**
 * Update dashboard widget request
 */
export interface UpdateDashboardWidgetRequest {
  title?: string;
  config?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
  is_visible?: boolean;
}

/**
 * Widget layout update
 */
export interface WidgetLayoutUpdate {
  id: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

/**
 * Create metric alert request
 */
export interface CreateMetricAlertRequest {
  name: string;
  kpi_type: KPIType;
  condition: AlertCondition;
  threshold_value: number;
  notification_emails: string[];
}

/**
 * Update metric alert request
 */
export interface UpdateMetricAlertRequest {
  name?: string;
  condition?: AlertCondition;
  threshold_value?: number;
  notification_emails?: string[];
  is_active?: boolean;
}

/**
 * Latest KPIs response
 */
export interface LatestKPIsResponse {
  [key: string]: {
    value: number;
    previousValue: number | null;
    changePercent: number | null;
    date: string;
  };
}

/**
 * Triggered alert info
 */
export interface TriggeredAlert {
  alertId: number;
  alertName: string;
  kpiType: KPIType;
  currentValue: number;
  thresholdValue: number;
  condition: AlertCondition;
  triggeredAt: string;
}
