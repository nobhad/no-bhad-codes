/**
 * ===============================================
 * ANALYTICS — ADMIN DASHBOARD DATA
 * ===============================================
 * Database queries for the admin analytics dashboard endpoint.
 * Provides KPIs, chart data, and source breakdowns.
 */

import { getDatabase } from '../../database/init.js';

// ── Types ─────────────────────────────────────

interface ScalarRow {
  value: number;
}

interface ConversionRow {
  total: number;
  converted: number;
}

interface RevenueChartRow {
  date: string;
  revenue: number;
}

interface StatusCountRow {
  status: string;
  count: number;
}

interface SourceCountRow {
  source: string;
  count: number;
}

export interface SourceBreakdownItem {
  source: string;
  count: number;
  percentage: number;
}

export interface ChartDataset {
  label: string;
  data: number[];
  color: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface KPI {
  value: number;
  change: number;
}

export interface AdminAnalyticsData {
  kpis: {
    revenue: KPI;
    clients: KPI;
    projects: KPI;
    invoices: KPI;
    conversionRate: KPI;
    avgProjectValue: KPI;
  };
  revenueChart: ChartData;
  projectsChart: ChartData;
  leadsChart: ChartData;
  sourceBreakdown: SourceBreakdownItem[];
}

// ── Revenue queries ───────────────────────────

export async function getRevenueForPeriod(
  startDate: string,
  endDate: string
): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COALESCE(SUM(amount_total), 0) as value
    FROM invoices
    WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) <= ?
  `, [startDate, endDate]);
  return row?.value || 0;
}

export async function getRevenueForPeriodExclusive(
  startDate: string,
  endDate: string
): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COALESCE(SUM(amount_total), 0) as value
    FROM invoices
    WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) < ?
  `, [startDate, endDate]);
  return row?.value || 0;
}

// ── Client queries ────────────────────────────

export async function getTotalClients(): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL
  `);
  return row?.value || 0;
}

export async function getNewClientsSince(startDate: string): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM clients
    WHERE deleted_at IS NULL AND DATE(created_at) >= ?
  `, [startDate]);
  return row?.value || 0;
}

export async function getNewClientsInRange(
  startDate: string,
  endDate: string
): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM clients
    WHERE deleted_at IS NULL AND DATE(created_at) >= ? AND DATE(created_at) < ?
  `, [startDate, endDate]);
  return row?.value || 0;
}

// ── Project queries ───────────────────────────

export async function getActiveProjectCount(): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM projects
    WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL
  `);
  return row?.value || 0;
}

export async function getNewProjectsSince(startDate: string): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM projects
    WHERE deleted_at IS NULL AND DATE(created_at) >= ?
  `, [startDate]);
  return row?.value || 0;
}

export async function getNewProjectsInRange(
  startDate: string,
  endDate: string
): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM projects
    WHERE deleted_at IS NULL AND DATE(created_at) >= ? AND DATE(created_at) < ?
  `, [startDate, endDate]);
  return row?.value || 0;
}

// ── Invoice queries ───────────────────────────

export async function getInvoicesSentSince(startDate: string): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM invoices WHERE DATE(created_at) >= ?
  `, [startDate]);
  return row?.value || 0;
}

export async function getInvoicesSentInRange(
  startDate: string,
  endDate: string
): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COUNT(*) as value FROM invoices
    WHERE DATE(created_at) >= ? AND DATE(created_at) < ?
  `, [startDate, endDate]);
  return row?.value || 0;
}

// ── Conversion / leads queries ────────────────

export async function getLeadsConversionStats(): Promise<ConversionRow> {
  const db = getDatabase();
  const row = await db.get<ConversionRow>(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status IN ('active', 'in-progress', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0) as converted
    FROM projects
    WHERE deleted_at IS NULL
  `);
  return { total: row?.total || 0, converted: row?.converted || 0 };
}

export async function getLeadsConversionStatsBefore(
  beforeDate: string
): Promise<ConversionRow> {
  const db = getDatabase();
  const row = await db.get<ConversionRow>(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status IN ('active', 'in-progress', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0) as converted
    FROM projects
    WHERE deleted_at IS NULL AND DATE(created_at) < ?
  `, [beforeDate]);
  return { total: row?.total || 0, converted: row?.converted || 0 };
}

// ── Average project value queries ─────────────

export async function getAvgProjectValue(): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COALESCE(AVG(expected_value), 0) as value
    FROM projects WHERE deleted_at IS NULL AND expected_value > 0
  `);
  return row?.value || 0;
}

export async function getAvgProjectValueBefore(
  beforeDate: string
): Promise<number> {
  const db = getDatabase();
  const row = await db.get<ScalarRow>(`
    SELECT COALESCE(AVG(expected_value), 0) as value
    FROM projects WHERE deleted_at IS NULL AND expected_value > 0 AND DATE(created_at) < ?
  `, [beforeDate]);
  return row?.value || 0;
}

// ── Chart data queries ────────────────────────

export async function getRevenueChartData(
  startDate: string
): Promise<RevenueChartRow[]> {
  const db = getDatabase();
  return db.all<RevenueChartRow>(`
    SELECT
      strftime('%Y-%m-%d', COALESCE(paid_date, updated_at)) as date,
      SUM(amount_total) as revenue
    FROM invoices
    WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ?
    GROUP BY strftime('%Y-%m-%d', COALESCE(paid_date, updated_at))
    ORDER BY date ASC
  `, [startDate]);
}

export async function getProjectsByStatus(): Promise<StatusCountRow[]> {
  const db = getDatabase();
  return db.all<StatusCountRow>(`
    SELECT status, COUNT(*) as count
    FROM projects WHERE deleted_at IS NULL
    GROUP BY status
  `);
}

export async function getLeadFunnelData(): Promise<StatusCountRow[]> {
  const db = getDatabase();
  return db.all<StatusCountRow>(`
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
}

export async function getSourceBreakdown(): Promise<SourceCountRow[]> {
  const db = getDatabase();
  return db.all<SourceCountRow>(`
    SELECT 'Direct' as source, COUNT(*) as count
    FROM projects
    WHERE deleted_at IS NULL
  `);
}
