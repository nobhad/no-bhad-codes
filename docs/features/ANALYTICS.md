# Analytics & Reporting Feature

**Status:** Complete
**Last Updated:** 2026-02-01

## Overview

The Analytics & Reporting system provides comprehensive business intelligence capabilities including saved reports, scheduled report generation, customizable dashboards, KPI tracking, and metric alerts. This system enables data-driven decision making with enterprise-grade reporting tools.

## Architecture

### Database Tables

**Migration:** `036_analytics_enhancements.sql`

| Table | Description |
|-------|-------------|
| `saved_reports` | Reusable report configurations with filters, columns, and chart types |
| `report_schedules` | Automated report generation schedules with email delivery |
| `dashboard_widgets` | User-customizable dashboard widget configurations |
| `kpi_snapshots` | Historical KPI values for trend analysis |
| `report_runs` | Report execution history and status tracking |
| `dashboard_presets` | Pre-configured dashboard layouts (Executive, Sales, PM) |
| `metric_alerts` | Threshold-based alerts for KPI monitoring |

### Service

**File:** `server/services/analytics-service.ts`

The AnalyticsService class provides all analytics operations:

```typescript
// Saved Reports
getSavedReports(type?: string, favoritesOnly?: boolean): Promise<SavedReport[]>
createSavedReport(data: SavedReportData): Promise<SavedReport>
updateSavedReport(id: number, data: Partial<SavedReportData>): Promise<SavedReport>
deleteSavedReport(id: number): Promise<void>
toggleReportFavorite(id: number): Promise<SavedReport>
runReport(id: number, userEmail: string): Promise<ReportResult>

// Report Schedules
getReportSchedules(reportId: number): Promise<ReportSchedule[]>
createReportSchedule(data: ScheduleData): Promise<ReportSchedule>
updateReportSchedule(id: number, data: Partial<ScheduleData>): Promise<ReportSchedule>
deleteReportSchedule(id: number): Promise<void>
processDueSchedules(): Promise<number>

// Dashboard Widgets
getDashboardWidgets(userEmail: string): Promise<DashboardWidget[]>
createDashboardWidget(data: WidgetData): Promise<DashboardWidget>
updateDashboardWidget(id: number, data: Partial<WidgetData>): Promise<DashboardWidget>
deleteDashboardWidget(id: number): Promise<void>
updateWidgetLayout(userEmail: string, widgets: WidgetLayoutUpdate[]): Promise<void>
getDashboardPresets(): Promise<DashboardPreset[]>
applyDashboardPreset(presetId: number, userEmail: string): Promise<DashboardWidget[]>

// KPI Snapshots
captureKPISnapshot(): Promise<void>
getLatestKPIs(): Promise<LatestKPIs>
getKPITrend(kpiType: string, days: number): Promise<KPITrendPoint[]>

// Metric Alerts
getMetricAlerts(): Promise<MetricAlert[]>
createMetricAlert(data: AlertData): Promise<MetricAlert>
updateMetricAlert(id: number, data: Partial<AlertData>): Promise<MetricAlert>
deleteMetricAlert(id: number): Promise<void>
checkAlertTriggers(): Promise<TriggeredAlert[]>

// Quick Analytics
getRevenueAnalytics(days: number): Promise<RevenueAnalytics>
getPipelineAnalytics(): Promise<PipelineAnalytics>
getProjectAnalytics(days: number): Promise<ProjectAnalytics>
getClientAnalytics(): Promise<ClientAnalytics>
getTeamAnalytics(days: number): Promise<TeamAnalytics>

// Report Runs
getReportRuns(reportId?: number, limit?: number): Promise<ReportRun[]>
```

### Routes

**File:** `server/routes/analytics.ts`

## API Endpoints

### Saved Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/reports` | List all saved reports (optional `?type=` and `?favorites=true`) |
| POST | `/api/analytics/reports` | Create a new saved report |
| GET | `/api/analytics/reports/:id` | Get a specific report |
| PUT | `/api/analytics/reports/:id` | Update a report |
| DELETE | `/api/analytics/reports/:id` | Delete a report |
| POST | `/api/analytics/reports/:id/favorite` | Toggle report favorite status |
| POST | `/api/analytics/reports/:id/run` | Execute a report and get results |

### Report Schedules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/reports/:reportId/schedules` | Get schedules for a report |
| POST | `/api/analytics/reports/:reportId/schedules` | Create a schedule |
| PUT | `/api/analytics/schedules/:id` | Update a schedule |
| DELETE | `/api/analytics/schedules/:id` | Delete a schedule |
| POST | `/api/analytics/schedules/process` | Process all due schedules |

### Dashboard Widgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/widgets` | Get user's dashboard widgets |
| POST | `/api/analytics/widgets` | Create a widget |
| PUT | `/api/analytics/widgets/:id` | Update a widget |
| DELETE | `/api/analytics/widgets/:id` | Delete a widget |
| PUT | `/api/analytics/widgets/layout` | Update widget layout (positions/sizes) |
| GET | `/api/analytics/widgets/presets` | Get available dashboard presets |
| POST | `/api/analytics/widgets/presets/:id/apply` | Apply a dashboard preset |

### KPI Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analytics/kpis/snapshot` | Capture a KPI snapshot |
| GET | `/api/analytics/kpis/latest` | Get latest KPI values |
| GET | `/api/analytics/kpis/:type/trend` | Get KPI trend over time |

### Metric Alerts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/alerts` | Get all metric alerts |
| POST | `/api/analytics/alerts` | Create an alert |
| PUT | `/api/analytics/alerts/:id` | Update an alert |
| DELETE | `/api/analytics/alerts/:id` | Delete an alert |
| POST | `/api/analytics/alerts/check` | Check all alerts for triggers |

### Quick Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/quick/revenue` | Revenue analytics |
| GET | `/api/analytics/quick/pipeline` | Pipeline analytics |
| GET | `/api/analytics/quick/projects` | Project analytics |
| GET | `/api/analytics/quick/clients` | Client analytics |
| GET | `/api/analytics/quick/team` | Team performance analytics |
| GET | `/api/analytics/report-runs` | Report run history |

## Data Flow

### Report Generation

```text
1. User creates/runs a saved report
2. System fetches report configuration
3. Filters applied to relevant data source
4. Data aggregated and formatted
5. Report run logged in report_runs table
6. Results returned (or emailed if scheduled)
```

### Dashboard Widget Update

```text
1. User configures widget (type, data source, position)
2. Widget saved to dashboard_widgets table
3. On dashboard load, widgets fetched for user
4. Each widget fetches its data from appropriate source
5. Widgets rendered in grid layout
```

### KPI Tracking

```text
1. Scheduler triggers captureKPISnapshot()
2. Current values calculated for each KPI type
3. Compared against previous day's values
4. Change percentages calculated
5. Snapshots stored in kpi_snapshots table
6. Alerts checked against new values
```

## Report Types

### Revenue Report

- Total revenue (by period)
- Paid vs outstanding
- Revenue by client
- Revenue by project type
- Monthly/quarterly trends

### Pipeline Report

- Total pipeline value
- Weighted value (by probability)
- Leads by stage
- Leads by source
- Conversion metrics

### Project Report

- Project status breakdown
- Completion rates
- Average duration
- Projects by type
- Health status distribution

### Client Report

- Active vs inactive clients
- Client acquisition trends
- Lifetime value analysis
- Industry/size breakdown
- Health score distribution

### Team Report

- Hours logged (billable vs non-billable)
- Revenue generated
- Project allocation
- Productivity trends

## Dashboard Presets

### Executive Overview

Widgets: Total Revenue, Active Projects, Total Clients, Pipeline Value, Revenue Trend (line), Project Status (pie)

### Sales Dashboard

Widgets: New Leads, Qualified Leads, Conversion Rate, Won This Month, Pipeline Funnel (bar), Recent Leads (list)

### Project Manager

Widgets: Active Projects, Due This Week, Overdue Tasks, Hours This Week, Project Health (bar), Upcoming Milestones (list)

## KPI Types

| KPI | Description |
|-----|-------------|
| `revenue` | Total invoiced amount |
| `pipeline_value` | Total value of open leads |
| `client_count` | Active client count |
| `project_count` | Active project count |
| `conversion_rate` | Lead to client conversion |
| `avg_project_value` | Average project value |
| `outstanding_invoices` | Unpaid invoice total |
| `paid_invoices` | Paid invoice total |
| `active_leads` | Open lead count |
| `closed_leads` | Won leads this period |

## Metric Alert Conditions

| Condition | Description |
|-----------|-------------|
| `above` | Trigger when value exceeds threshold |
| `below` | Trigger when value falls below threshold |
| `equals` | Trigger when value equals threshold |
| `change_above` | Trigger when change % exceeds threshold |
| `change_below` | Trigger when change % falls below threshold |

## Implementation Details

### Chart Types

- **Bar:** Comparative data (by category)
- **Line:** Trends over time
- **Pie:** Proportional breakdown
- **Area:** Volume over time
- **Table:** Detailed data view
- **Funnel:** Conversion visualization
- **Gauge:** Single metric with target

### Widget Grid System

- Grid units: 4 columns
- Position: (x, y) coordinates
- Size: width and height in grid units
- Responsive layout adjustments

### Schedule Processing

- Runs via scheduler service
- Calculates next run based on frequency
- Supports daily, weekly, monthly, quarterly
- Email delivery with PDF/CSV/Excel attachments

## TypeScript Types

See `src/types/api.ts` for complete type definitions:

- `SavedReport` / `SavedReportResponse`
- `ReportSchedule` / `ReportScheduleResponse`
- `DashboardWidget` / `DashboardWidgetResponse`
- `DashboardPreset` / `DashboardPresetResponse`
- `KPISnapshot` / `KPISnapshotResponse`
- `MetricAlert` / `MetricAlertResponse`
- `ReportRun` / `ReportRunResponse`
- `RevenueAnalytics`, `PipelineAnalytics`, `ProjectAnalytics`
- `ClientAnalytics`, `TeamAnalytics`

## Security

- All endpoints require admin authentication
- Reports scoped to organization
- Shared reports respect permissions
- Scheduled reports use secure email delivery

## Change Log

### 2026-02-01 - Phase 7 Implementation

- Created migration 036_analytics_enhancements.sql
- Created analytics-service.ts with full functionality
- Added 30+ new API endpoints to analytics.ts
- Added TypeScript types for all analytics entities
- Seeded 3 dashboard presets (Executive, Sales, PM)
- Created comprehensive documentation
