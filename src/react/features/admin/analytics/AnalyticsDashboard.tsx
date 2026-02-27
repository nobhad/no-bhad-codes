import * as React from 'react';
import { useState, useEffect } from 'react';
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
}

export function AnalyticsDashboard({ onNavigate }: AnalyticsDashboardProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [activeSubtab, setActiveSubtab] = useState<'overview' | 'revenue' | 'leads' | 'projects'>(
    'overview'
  );

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  async function loadAnalytics() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/analytics?range=${dateRange}`);
      if (!response.ok) throw new Error('Failed to load analytics');

      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
            <RefreshCw style={{ width: '1rem', height: '1rem', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>

          <button className="tw-btn-secondary">
            <Download style={{ width: '1rem', height: '1rem' }} />
            Export
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <button className="tw-btn-secondary" onClick={loadAnalytics} style={{ marginLeft: '1rem' }}>
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
          <div className="tw-grid-stats" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {kpis.map((kpi) => (
              <div key={kpi.id} className="tw-stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: kpi.color }}>{kpi.icon}</span>
                  <span className="tw-stat-label">{kpi.label}</span>
                </div>
                <div className="tw-stat-value">{kpi.value}</div>
                {kpi.change !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', fontSize: '11px' }}>
                    {kpi.change >= 0 ? (
                      <TrendingUp style={{ width: '0.75rem', height: '0.75rem' }} />
                    ) : (
                      <TrendingDown style={{ width: '0.75rem', height: '0.75rem' }} />
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
          <div className="tw-grid-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {/* Revenue Chart */}
            <div className="tw-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 className="tw-section-title">Revenue Over Time</h3>
                <LineChart style={{ width: '1rem', height: '1rem', color: 'var(--portal-text-muted)' }} />
              </div>
              <div style={{ height: '16rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChartPlaceholder data={data?.revenueChart} type="line" />
              </div>
            </div>

            {/* Projects Chart */}
            <div className="tw-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 className="tw-section-title">Projects by Status</h3>
                <PieChart style={{ width: '1rem', height: '1rem', color: 'var(--portal-text-muted)' }} />
              </div>
              <div style={{ height: '16rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChartPlaceholder data={data?.projectsChart} type="pie" />
              </div>
            </div>

            {/* Leads Chart */}
            <div className="tw-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 className="tw-section-title">Lead Funnel</h3>
                <BarChart3 style={{ width: '1rem', height: '1rem', color: 'var(--portal-text-muted)' }} />
              </div>
              <div style={{ height: '16rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChartPlaceholder data={data?.leadsChart} type="bar" />
              </div>
            </div>

            {/* Source Breakdown */}
            <div className="tw-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 className="tw-section-title">Lead Sources</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data?.sourceBreakdown?.map((source, index) => (
                  <div key={source.source}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px', marginBottom: '0.25rem' }}>
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
                  <div className="tw-empty-state" style={{ padding: '2rem 0' }}>
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
    <div className="tw-empty-state" style={{ padding: 0 }}>
      <BarChart3 style={{ width: '3rem', height: '3rem', opacity: 0.3 }} />
      <p>Chart visualization</p>
      <p className="tw-text-muted" style={{ fontSize: '11px' }}>
        {data?.labels?.length || 0} data points
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="tw-loading" style={{ flexDirection: 'column', padding: '4rem 0' }}>
      <div style={{ opacity: 0.3 }}>Loading analytics data...</div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
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
