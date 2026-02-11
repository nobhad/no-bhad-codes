/**
 * ===============================================
 * ADMIN AD HOC REVENUE ANALYTICS MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-ad-hoc-analytics.ts
 *
 * Analytics dashboard widget for ad hoc revenue tracking.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch } from '../../../utils/api-client';
import { SanitizationUtils } from '../../../utils/sanitization-utils';

interface AdHocRevenueData {
  invoiceCount: number;
  totalRevenue: number;
  averageAmount: number;
  largestAmount: number;
  previousRevenue: number;
  change: string;
  timeperiod: string;
}

interface MonthlyAdHocData {
  month: string;
  revenue: number;
  invoiceCount: number;
}

interface ClientAdHocData {
  clientName: string;
  clientId: number;
  totalRevenue: number;
  invoiceCount: number;
  lastInvoiceDate: string;
}

const ANALYTICS_API = '/api/ad-hoc-requests';

const DEFAULT_METRICS: AdHocRevenueData = {
  invoiceCount: 0,
  totalRevenue: 0,
  averageAmount: 0,
  largestAmount: 0,
  previousRevenue: 0,
  change: '0',
  timeperiod: 'month'
};

async function fetchAdHocRevenueMetrics(): Promise<AdHocRevenueData> {
  try {
    const response = await apiFetch(`${ANALYTICS_API}/summary/monthly?days=30`);
    const data = await response.json();

    if (!response.ok || !data.success || !data.data) {
      console.warn('[AdHocAnalytics] Metrics API not ready, using defaults');
      return DEFAULT_METRICS;
    }

    return { ...DEFAULT_METRICS, ...data.data } as AdHocRevenueData;
  } catch {
    console.warn('[AdHocAnalytics] Metrics API not available');
    return DEFAULT_METRICS;
  }
}

async function fetchMonthlyAdHocRevenue(): Promise<MonthlyAdHocData[]> {
  try {
    const response = await apiFetch(`${ANALYTICS_API}/summary/monthly?groupBy=month&limit=12`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn('[AdHocAnalytics] Monthly API not ready');
      return [];
    }

    return (data.data || []) as MonthlyAdHocData[];
  } catch {
    console.warn('[AdHocAnalytics] Monthly API not available');
    return [];
  }
}

async function fetchTopClientsAdHoc(): Promise<ClientAdHocData[]> {
  try {
    const response = await apiFetch(`${ANALYTICS_API}/summary/monthly?groupBy=client&limit=10`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      console.warn('[AdHocAnalytics] Clients API not ready');
      return [];
    }

    return (data.data || []) as ClientAdHocData[];
  } catch {
    console.warn('[AdHocAnalytics] Clients API not available');
    return [];
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0.00';
  return `$${value.toFixed(2)}`;
}

function formatPercentage(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

export async function loadAdHocAnalytics(_ctx: AdminDashboardContext): Promise<void> {
  const container = document.getElementById('ad-hoc-analytics-widget');
  if (!container) {
    console.log('[AdHocAnalytics] Widget container not found');
    return;
  }

  try {
    // Fetch metrics in parallel
    const [metrics, monthlyData, clientData] = await Promise.all([
      fetchAdHocRevenueMetrics(),
      fetchMonthlyAdHocRevenue(),
      fetchTopClientsAdHoc()
    ]);

    // Check if we have any real data (with safety check for undefined metrics)
    const hasData = (metrics?.invoiceCount ?? 0) > 0 || monthlyData.length > 0 || clientData.length > 0;

    if (!hasData) {
      container.innerHTML = `
        <div class="ad-hoc-analytics-empty">
          <p class="text-muted">No ad hoc request data available yet.</p>
        </div>
      `;
      return;
    }

    // Use defaults if metrics is undefined
    const safeMetrics = metrics ?? DEFAULT_METRICS;

    // Render main metrics card
    const metricsHtml = `
      <div class="ad-hoc-metrics-cards">
        <div class="ad-hoc-metric-card">
          <div class="ad-hoc-metric-value">${formatCurrency(safeMetrics.totalRevenue)}</div>
          <div class="ad-hoc-metric-label">MTD Revenue</div>
          <div class="ad-hoc-metric-change ${parseFloat(safeMetrics.change) >= 0 ? 'positive' : 'negative'}">
            ${formatPercentage(safeMetrics.change)} vs last month
          </div>
        </div>
        <div class="ad-hoc-metric-card">
          <div class="ad-hoc-metric-value">${safeMetrics.invoiceCount}</div>
          <div class="ad-hoc-metric-label">Invoices</div>
          <div class="ad-hoc-metric-note">Generated this month</div>
        </div>
        <div class="ad-hoc-metric-card">
          <div class="ad-hoc-metric-value">${formatCurrency(safeMetrics.averageAmount)}</div>
          <div class="ad-hoc-metric-label">Average Invoice</div>
          <div class="ad-hoc-metric-note">Per invoice value</div>
        </div>
        <div class="ad-hoc-metric-card">
          <div class="ad-hoc-metric-value">${formatCurrency(safeMetrics.largestAmount)}</div>
          <div class="ad-hoc-metric-label">Largest Invoice</div>
          <div class="ad-hoc-metric-note">Highest single invoice</div>
        </div>
      </div>
    `;

    container.innerHTML = metricsHtml;

    // Add monthly revenue section
    if (monthlyData.length > 0) {
      const monthlySection = document.createElement('div');
      monthlySection.className = 'ad-hoc-monthly-section';
      monthlySection.innerHTML = `
        <h4>Monthly Trend</h4>
        <div class="ad-hoc-monthly-list">
          ${monthlyData
    .map(
      (month) => `
            <div class="ad-hoc-monthly-row">
              <span class="ad-hoc-monthly-label">${SanitizationUtils.escapeHtml(month.month)}</span>
              <span class="ad-hoc-monthly-value">${formatCurrency(month.revenue)}</span>
              <span class="ad-hoc-monthly-count">${month.invoiceCount} invoices</span>
            </div>
          `
    )
    .join('')}
        </div>
      `;
      container.appendChild(monthlySection);
    }

    // Add top clients section
    if (clientData.length > 0) {
      const clientsSection = document.createElement('div');
      clientsSection.className = 'ad-hoc-clients-section';
      clientsSection.innerHTML = `
        <h4>Top Clients (Ad Hoc)</h4>
        <div class="ad-hoc-clients-list">
          ${clientData
    .map(
      (client) => `
            <div class="ad-hoc-client-row">
              <div class="ad-hoc-client-info">
                <span class="ad-hoc-client-name">${SanitizationUtils.escapeHtml(client.clientName)}</span>
                <span class="ad-hoc-client-date">${formatDate(client.lastInvoiceDate)}</span>
              </div>
              <div class="ad-hoc-client-stats">
                <span class="ad-hoc-client-revenue">${formatCurrency(client.totalRevenue)}</span>
                <span class="ad-hoc-client-count">${client.invoiceCount}</span>
              </div>
            </div>
          `
    )
    .join('')}
        </div>
      `;
      container.appendChild(clientsSection);
    }
  } catch (error) {
    console.error('[AdHocAnalytics] Failed to load analytics:', error);
    container.innerHTML = `
      <div class="ad-hoc-analytics-error">
        <p>Unable to load ad hoc analytics. Please try again.</p>
      </div>
    `;
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}
