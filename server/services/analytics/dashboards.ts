/**
 * ===============================================
 * ANALYTICS — DASHBOARDS, KPI SNAPSHOTS & METRIC ALERTS
 * ===============================================
 * Widget CRUD, preset management, KPI capture, and alert triggers.
 */

import { getDatabase } from '../../database/init.js';
import { logger } from '../logger.js';
import { safeJsonParseArray, safeJsonParseObject } from '../../utils/safe-json.js';
import type {
  WidgetType,
  DataSource,
  AlertCondition,
  SqlParam,
  DateRange,
  DashboardWidget,
  DashboardWidgetRow,
  DashboardPreset,
  KPISnapshot,
  KPISnapshotRow,
  MetricAlert,
  MetricAlertRow
} from './types.js';
import {
  DASHBOARD_WIDGET_COLUMNS,
  DASHBOARD_PRESET_COLUMNS,
  KPI_SNAPSHOT_COLUMNS,
  METRIC_ALERT_COLUMNS
} from './types.js';

// ============================================
// DASHBOARD WIDGETS
// ============================================

export async function getWidgets(userEmail: string): Promise<DashboardWidget[]> {
  const db = getDatabase();
  const widgets = await db.all(
    `SELECT ${DASHBOARD_WIDGET_COLUMNS} FROM dashboard_widgets
     WHERE user_email = ? AND is_visible = TRUE
     ORDER BY position_y, position_x`,
    [userEmail]
  );

  return widgets.map((w: DashboardWidgetRow) => ({
    ...w,
    config: safeJsonParseObject(w.config, 'widget config')
  }));
}

export async function createWidget(data: {
  user_email: string;
  widget_type: WidgetType;
  title?: string;
  data_source: DataSource;
  config?: Record<string, unknown>;
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

  return getWidget(result.lastID!);
}

export async function getWidget(widgetId: number): Promise<DashboardWidget> {
  const db = getDatabase();
  const widget = await db.get(`SELECT ${DASHBOARD_WIDGET_COLUMNS} FROM dashboard_widgets WHERE id = ?`, [widgetId]);

  if (!widget) {
    throw new Error('Widget not found');
  }

  return {
    ...(widget as unknown as DashboardWidget),
    config: safeJsonParseObject(widget.config as string, 'widget config')
  };
}

export async function updateWidget(
  widgetId: number,
  data: Partial<{
    title: string;
    config: Record<string, unknown>;
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
  const values: SqlParam[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.config !== undefined) {
    updates.push('config = ?');
    values.push(JSON.stringify(data.config));
  }
  if (data.position_x !== undefined) {
    updates.push('position_x = ?');
    values.push(data.position_x);
  }
  if (data.position_y !== undefined) {
    updates.push('position_y = ?');
    values.push(data.position_y);
  }
  if (data.width !== undefined) {
    updates.push('width = ?');
    values.push(data.width);
  }
  if (data.height !== undefined) {
    updates.push('height = ?');
    values.push(data.height);
  }
  if (data.refresh_interval !== undefined) {
    updates.push('refresh_interval = ?');
    values.push(data.refresh_interval);
  }
  if (data.is_visible !== undefined) {
    updates.push('is_visible = ?');
    values.push(data.is_visible);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(widgetId);
    await db.run(`UPDATE dashboard_widgets SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  return getWidget(widgetId);
}

export async function deleteWidget(widgetId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM dashboard_widgets WHERE id = ?', [widgetId]);
}

export async function saveWidgetLayout(
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

export async function applyPreset(userEmail: string, presetId: number): Promise<DashboardWidget[]> {
  const db = getDatabase();

  const preset = await db.get(`SELECT ${DASHBOARD_PRESET_COLUMNS} FROM dashboard_presets WHERE id = ?`, [presetId]);
  if (!preset) {
    throw new Error('Preset not found');
  }

  // Delete existing widgets
  await db.run('DELETE FROM dashboard_widgets WHERE user_email = ?', [userEmail]);

  // Create widgets from preset
  interface PresetWidgetConfig {
    type: WidgetType;
    title: string;
    data_source: DataSource;
    config?: Record<string, unknown>;
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const widgetConfigs = safeJsonParseArray<PresetWidgetConfig>(preset.widgets as string, 'preset widgets');
  const widgets: DashboardWidget[] = [];

  for (const config of widgetConfigs) {
    const widget = await createWidget({
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

export async function getPresets(): Promise<DashboardPreset[]> {
  const db = getDatabase();
  const presets = await db.all(
    'SELECT id, name, description, is_default FROM dashboard_presets WHERE is_active = TRUE ORDER BY is_default DESC, name'
  );
  return presets;
}

// ============================================
// KPI SNAPSHOTS
// ============================================

export async function captureSnapshot(): Promise<number> {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const kpis = await calculateKPIs();

  const existing = await db.get('SELECT id FROM kpi_snapshots WHERE snapshot_date = ? LIMIT 1', [
    today
  ]);

  await db.transaction(async (ctx) => {
    if (existing) {
      for (const kpi of kpis) {
        await ctx.run(
          `UPDATE kpi_snapshots SET value = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
           WHERE snapshot_date = ? AND kpi_type = ?`,
          [kpi.value, JSON.stringify(kpi.metadata || {}), today, kpi.type]
        );
      }
    } else {
      for (const kpi of kpis) {
        const prevRow = await ctx.get<{ value: number }>(
          `SELECT value FROM kpi_snapshots
           WHERE kpi_type = ? AND snapshot_date < ?
           ORDER BY snapshot_date DESC LIMIT 1`,
          [kpi.type, today]
        );

        const previousValue = prevRow?.value !== undefined ? Number(prevRow.value) : null;
        const changePercent =
          previousValue !== null && previousValue !== 0
            ? ((kpi.value - previousValue) / previousValue) * 100
            : null;

        await ctx.run(
          `INSERT INTO kpi_snapshots (snapshot_date, kpi_type, value, previous_value, change_percent, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            today,
            kpi.type,
            kpi.value,
            previousValue,
            changePercent,
            JSON.stringify(kpi.metadata ?? {})
          ]
        );
      }
    }
  });

  logger.info(`[Analytics] KPI snapshot captured for ${today}: ${kpis.length} metrics`, {
    category: 'analytics',
    metadata: { date: today, metricCount: kpis.length, mode: existing ? 'update' : 'insert' }
  });

  return kpis.length;
}

async function calculateKPIs(): Promise<
  { type: string; value: number; metadata?: Record<string, unknown> }[]
  > {
  const db = getDatabase();
  const kpis: { type: string; value: number; metadata?: Record<string, unknown> }[] = [];

  const revenue = await db.get(
    'SELECT COALESCE(SUM(total_amount), 0) as total FROM active_invoices WHERE status = \'paid\''
  );
  kpis.push({ type: 'total_revenue', value: Number(revenue?.total ?? 0) });

  const monthlyRevenue = await db.get(
    `SELECT COALESCE(SUM(total_amount), 0) as total FROM active_invoices
     WHERE status = 'paid' AND paid_at >= date('now', 'start of month')`
  );
  kpis.push({ type: 'monthly_revenue', value: Number(monthlyRevenue?.total ?? 0) });

  const activeClients = await db.get(
    'SELECT COUNT(*) as count FROM active_clients WHERE status = \'active\''
  );
  kpis.push({ type: 'active_clients', value: Number(activeClients?.count ?? 0) });

  const activeProjects = await db.get(
    'SELECT COUNT(*) as count FROM active_projects WHERE status IN (\'in_progress\', \'active\')'
  );
  kpis.push({ type: 'active_projects', value: Number(activeProjects?.count ?? 0) });

  const pipelineValue = await db.get(
    `SELECT COALESCE(SUM(expected_value), 0) as total FROM active_projects
     WHERE status = 'pending' AND expected_value IS NOT NULL`
  );
  kpis.push({ type: 'pipeline_value', value: Number(pipelineValue?.total ?? 0) });

  const newLeads = await db.get(
    `SELECT COUNT(*) as count FROM active_projects
     WHERE status = 'pending' AND created_at >= date('now', 'start of month')`
  );
  kpis.push({ type: 'new_leads_monthly', value: Number(newLeads?.count ?? 0) });

  const outstanding = await db.get(
    `SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as total
     FROM active_invoices WHERE status IN ('sent', 'overdue')`
  );
  kpis.push({ type: 'outstanding_invoices', value: Number(outstanding?.total ?? 0) });

  const overdue = await db.get(
    `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
     FROM active_invoices WHERE status = 'overdue'`
  );
  kpis.push({
    type: 'overdue_invoices',
    value: Number(overdue?.total ?? 0),
    metadata: { count: Number(overdue?.count ?? 0) }
  });

  const conversion = await db.get(
    `SELECT
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as won,
      COUNT(CASE WHEN status IN ('completed', 'cancelled') THEN 1 END) as total_closed
     FROM active_projects`
  );
  const totalClosed = Number(conversion?.total_closed ?? 0);
  const won = Number(conversion?.won ?? 0);
  const conversionRate = totalClosed > 0 ? (won / totalClosed) * 100 : 0;
  kpis.push({ type: 'conversion_rate', value: conversionRate });

  return kpis;
}

export async function getKPITrend(kpiType: string, dateRange?: DateRange): Promise<KPISnapshot[]> {
  const db = getDatabase();

  let query = `SELECT ${KPI_SNAPSHOT_COLUMNS} FROM kpi_snapshots WHERE kpi_type = ?`;
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

  return snapshots.map((s: KPISnapshotRow) => ({
    ...s,
    metadata: safeJsonParseObject(s.metadata, 'snapshot metadata')
  }));
}

export async function getLatestKPIs(): Promise<KPISnapshot[]> {
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

  return snapshots.map((s: KPISnapshotRow) => ({
    ...s,
    metadata: safeJsonParseObject(s.metadata, 'snapshot metadata')
  }));
}

// ============================================
// METRIC ALERTS
// ============================================

export async function createAlert(data: {
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

  return getAlert(result.lastID!);
}

export async function getAlerts(): Promise<MetricAlert[]> {
  const db = getDatabase();
  const alerts = await db.all(`SELECT ${METRIC_ALERT_COLUMNS} FROM metric_alerts ORDER BY name`);

  return alerts.map((a: MetricAlertRow) => ({
    ...a,
    notification_emails: safeJsonParseArray<string>(a.notification_emails, 'alert emails')
  }));
}

export async function getAlert(alertId: number): Promise<MetricAlert> {
  const db = getDatabase();
  const alert = await db.get(`SELECT ${METRIC_ALERT_COLUMNS} FROM metric_alerts WHERE id = ?`, [alertId]);

  if (!alert) {
    throw new Error('Alert not found');
  }

  return {
    ...(alert as unknown as MetricAlert),
    notification_emails: safeJsonParseArray<string>(alert.notification_emails as string, 'alert emails')
  };
}

export async function updateAlert(
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
  const values: SqlParam[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.kpi_type !== undefined) {
    updates.push('kpi_type = ?');
    values.push(data.kpi_type);
  }
  if (data.condition !== undefined) {
    updates.push('condition = ?');
    values.push(data.condition);
  }
  if (data.threshold_value !== undefined) {
    updates.push('threshold_value = ?');
    values.push(data.threshold_value);
  }
  if (data.notification_emails !== undefined) {
    updates.push('notification_emails = ?');
    values.push(JSON.stringify(data.notification_emails));
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(data.is_active);
  }

  if (updates.length > 0) {
    values.push(alertId);
    await db.run(`UPDATE metric_alerts SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  return getAlert(alertId);
}

export async function deleteAlert(alertId: number): Promise<void> {
  const db = getDatabase();
  await db.run('DELETE FROM metric_alerts WHERE id = ?', [alertId]);
}

export async function checkAlerts(): Promise<{ alert: MetricAlert; currentValue: number; triggered: boolean }[]> {
  const alerts = await getAlerts();
  const latestKPIs = await getLatestKPIs();
  const results: { alert: MetricAlert; currentValue: number; triggered: boolean }[] = [];

  for (const alert of alerts) {
    if (!alert.is_active) continue;

    const kpi = latestKPIs.find((k) => k.kpi_type === alert.kpi_type);
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
      const db = getDatabase();
      await db.run(
        'UPDATE metric_alerts SET last_triggered_at = CURRENT_TIMESTAMP, trigger_count = trigger_count + 1 WHERE id = ?',
        [alert.id]
      );
    }
  }

  return results;
}
