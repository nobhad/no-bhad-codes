import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Briefcase,
  FileText,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatCurrencyCompact as formatCurrency } from '../../../../utils/format-utils';

interface KPI {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

interface AnalyticsData {
  kpis: {
    revenue: { value: number; change: number };
    clients: { value: number; change: number };
    projects: { value: number; change: number };
    invoices: { value: number; change: number };
    conversionRate: { value: number; change: number };
    avgProjectValue: { value: number; change: number };
  };
  revenueChart: ChartData;
  projectsChart: ChartData;
  leadsChart: ChartData;
  sourceBreakdown: { source: string; count: number; percentage: number }[];
}

interface AnalyticsDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AnalyticsDashboard({ onNavigate, getAuthToken, showNotification }: AnalyticsDashboardProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [activeSubtab, setActiveSubtab] = useState<'overview' | 'revenue' | 'leads' | 'projects'>(
    'overview'
  );

  // Auth headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/analytics?range=${dateRange}`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load analytics');

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, getHeaders]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const kpis: KPI[] = data
    ? [
        {
          id: 'revenue',
          label: 'Revenue',
          value: formatCurrency(data.kpis.revenue.value),
          change: data.kpis.revenue.change,
          changeLabel: 'vs last period',
          icon: <DollarSign className="tw-h-5 tw-w-5" />,
          color: 'var(--status-completed)',
        },
        {
          id: 'clients',
          label: 'Total Clients',
          value: data.kpis.clients.value,
          change: data.kpis.clients.change,
          changeLabel: 'new this period',
          icon: <Users className="tw-h-5 tw-w-5" />,
          color: 'var(--status-active)',
        },
        {
          id: 'projects',
          label: 'Active Projects',
          value: data.kpis.projects.value,
          change: data.kpis.projects.change,
          changeLabel: 'vs last period',
          icon: <Briefcase className="tw-h-5 tw-w-5" />,
          color: 'var(--color-brand-primary)',
        },
        {
          id: 'invoices',
          label: 'Invoices Sent',
          value: data.kpis.invoices.value,
          change: data.kpis.invoices.change,
          changeLabel: 'this period',
          icon: <FileText className="tw-h-5 tw-w-5" />,
          color: 'var(--status-pending)',
        },
        {
          id: 'conversion',
          label: 'Conversion Rate',
          value: `${data.kpis.conversionRate.value}%`,
          change: data.kpis.conversionRate.change,
          changeLabel: 'vs last period',
          icon: <TrendingUp className="tw-h-5 tw-w-5" />,
          color: 'var(--status-qualified)',
        },
        {
          id: 'avgValue',
          label: 'Avg Project Value',
          value: formatCurrency(data.kpis.avgProjectValue.value),
          change: data.kpis.avgProjectValue.change,
          changeLabel: 'vs last period',
          icon: <BarChart3 className="tw-h-5 tw-w-5" />,
          color: 'var(--status-new)',
        },
      ]
    : [];

  const subtabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'leads', label: 'Leads' },
    { id: 'projects', label: 'Projects' },
  ];

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="tw-section">
      {/* Header */}
      <div className="perf-header">
        {/* Subtabs */}
        <div className="tw-tab-list">
          {subtabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubtab(tab.id as typeof activeSubtab)}
              className={activeSubtab === tab.id ? 'tw-tab-active' : 'tw-tab'}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="perf-controls">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="tw-select"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button className="tw-btn-secondary" onClick={loadAnalytics} disabled={isLoading}>
            <RefreshCw className={cn('status-panel-refresh-icon', isLoading && 'status-panel-refresh-icon-spin')} />
            Refresh
          </button>

          <button className="tw-btn-secondary">
            <Download className="analytics-action-icon" />
            Export
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <button className="tw-btn-secondary status-retry-btn" onClick={loadAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          {/* KPIs Grid */}
          <div className="tw-grid-stats tw-grid-6-cols">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="tw-stat-card">
                <div className="perf-kpi-header">
                  <span style={{ color: kpi.color }}>{kpi.icon}</span>
                  <span className="tw-stat-label">{kpi.label}</span>
                </div>
                <div className="tw-stat-value">{kpi.value}</div>
                {kpi.change !== undefined && (
                  <div className="perf-kpi-trend">
                    {kpi.change >= 0 ? (
                      <TrendingUp className="perf-trend-icon" />
                    ) : (
                      <TrendingDown className="perf-trend-icon" />
                    )}
                    <span className="tw-text-muted">
                      {kpi.change >= 0 ? '+' : ''}
                      {kpi.change}% {kpi.changeLabel}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="tw-grid-cards tw-grid-2-cols">
            {/* Revenue Chart */}
            <div className="tw-card perf-card">
              <div className="perf-card-header">
                <h3 className="tw-section-title">Revenue Over Time</h3>
                <LineChart className="perf-card-icon" />
              </div>
              <div className="analytics-chart-empty tw-flex tw-items-center tw-justify-center">
                <ChartPlaceholder data={data?.revenueChart} type="line" />
              </div>
            </div>

            {/* Projects Chart */}
            <div className="tw-card perf-card">
              <div className="perf-card-header">
                <h3 className="tw-section-title">Projects by Status</h3>
                <PieChart className="perf-card-icon" />
              </div>
              <div className="analytics-chart-empty tw-flex tw-items-center tw-justify-center">
                <ChartPlaceholder data={data?.projectsChart} type="pie" />
              </div>
            </div>

            {/* Leads Chart */}
            <div className="tw-card perf-card">
              <div className="perf-card-header">
                <h3 className="tw-section-title">Lead Funnel</h3>
                <BarChart3 className="perf-card-icon" />
              </div>
              <div className="analytics-chart-empty tw-flex tw-items-center tw-justify-center">
                <ChartPlaceholder data={data?.leadsChart} type="bar" />
              </div>
            </div>

            {/* Source Breakdown */}
            <div className="tw-card perf-card">
              <div className="perf-card-header">
                <h3 className="tw-section-title">Lead Sources</h3>
              </div>
              <div className="perf-projects-list">
                {data?.sourceBreakdown?.map((source, index) => (
                  <div key={source.source}>
                    <div className="perf-kpi-trend-row">
                      <span>{source.source}</span>
                      <span className="tw-text-muted">
                        {source.count} ({source.percentage}%)
                      </span>
                    </div>
                    <div className="tw-progress-track">
                      <div
                        className="tw-progress-bar"
                        style={{ width: `${source.percentage}%`, backgroundColor: getSourceColor(index) }}
                      />
                    </div>
                  </div>
                )) || (
                  <div className="tw-empty-state tw-py-8">
                    No data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChartPlaceholder({
  data,
  type,
}: {
  data?: ChartData;
  type: 'line' | 'bar' | 'pie';
}) {
  // Placeholder for chart visualization
  // In production, you would use Chart.js or similar
  return (
    <div className="tw-empty-state tw-p-0">
      <BarChart3 className="analytics-chart-icon" />
      <p>Chart visualization</p>
      <p className="tw-text-muted analytics-chart-hint">
        {data?.labels?.length || 0} data points
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="tw-loading tw-flex-col tw-py-16">
      <div className="tw-opacity-30">Loading analytics data...</div>
    </div>
  );
}


function getSourceColor(index: number): string {
  const colors = [
    'var(--color-brand-primary)',
    'var(--status-completed)',
    'var(--status-pending)',
    'var(--status-active)',
    'var(--status-qualified)',
    'var(--status-new)',
  ];
  return colors[index % colors.length];
}

export default AnalyticsDashboard;
