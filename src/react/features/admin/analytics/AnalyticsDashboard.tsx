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
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

interface KPI {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
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

type AnalyticsSubtab = 'overview' | 'revenue' | 'leads' | 'projects';

export function AnalyticsDashboard({ getAuthToken }: AnalyticsDashboardProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [activeSubtab, setActiveSubtab] = useState<AnalyticsSubtab>('overview');

  // Listen for subtab change events from header (standardized pattern)
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as AnalyticsSubtab;
      if (['overview', 'revenue', 'leads', 'projects'].includes(subtab)) {
        setActiveSubtab(subtab);
      }
    }

    document.addEventListener('analyticsSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('analyticsSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

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
      const response = await fetch(`${API_ENDPOINTS.ADMIN.ANALYTICS}?range=${dateRange}`, {
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
          icon: <DollarSign className="icon-lg" />,
        },
        {
          id: 'clients',
          label: 'Total Clients',
          value: data.kpis.clients.value,
          change: data.kpis.clients.change,
          changeLabel: 'new this period',
          icon: <Users className="icon-lg" />,
        },
        {
          id: 'projects',
          label: 'Active Projects',
          value: data.kpis.projects.value,
          change: data.kpis.projects.change,
          changeLabel: 'vs last period',
          icon: <Briefcase className="icon-lg" />,
        },
        {
          id: 'invoices',
          label: 'Invoices Sent',
          value: data.kpis.invoices.value,
          change: data.kpis.invoices.change,
          changeLabel: 'this period',
          icon: <FileText className="icon-lg" />,
        },
        {
          id: 'conversion',
          label: 'Conversion Rate',
          value: `${data.kpis.conversionRate.value}%`,
          change: data.kpis.conversionRate.change,
          changeLabel: 'vs last period',
          icon: <TrendingUp className="icon-lg" />,
        },
        {
          id: 'avgValue',
          label: 'Avg Project Value',
          value: formatCurrency(data.kpis.avgProjectValue.value),
          change: data.kpis.avgProjectValue.change,
          changeLabel: 'vs last period',
          icon: <BarChart3 className="icon-lg" />,
        },
      ]
    : [];

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
  ];

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="analytics-view">
      {/* Actions Bar - page-level controls */}
      <div className="analytics-actions-bar action-bar">
        {/* Date range selector - button group on desktop, dropdown on mobile */}
        <div className="date-range-selector">
          {dateRangeOptions.map((option) => (
            <button
              key={option.value}
              className={cn('btn-secondary', dateRange === option.value && 'active')}
              onClick={() => setDateRange(option.value as typeof dateRange)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={loadAnalytics} disabled={isLoading}>
          <RefreshCw className={cn('icon-sm', isLoading && 'animate-spin')} />
          Refresh
        </button>
        <button className="btn-secondary">
          <Download className="icon-sm" />
          Export
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-state">
          {error}
          <button className="btn-secondary" onClick={loadAnalytics}>
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="loading-state">Loading analytics data...</div>
      ) : (
        <>
          {/* Overview Subtab - Show all KPIs and charts */}
          {activeSubtab === 'overview' && (
            <>
              {/* KPIs Grid */}
              <div className="kpi-cards-row">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="kpi-card">
                    <div className="kpi-card-icon">{kpi.icon}</div>
                    <span className="kpi-card-label">{kpi.label}</span>
                    <div className="kpi-card-value">{kpi.value}</div>
                    {kpi.change !== undefined && (
                      <div className={cn('kpi-card-change', kpi.change >= 0 ? 'positive' : 'negative')}>
                        {kpi.change >= 0 ? (
                          <TrendingUp className="icon-xs" />
                        ) : (
                          <TrendingDown className="icon-xs" />
                        )}
                        <span className="change-value">
                          {kpi.change >= 0 ? '+' : ''}
                          {kpi.change}%
                        </span>
                        <span className="change-label">{kpi.changeLabel}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Charts Grid */}
              <div className="analytics-card-grid">
                <div className="analytics-chart-card">
                  <div className="analytics-card-header">
                    <h3>Revenue Over Time</h3>
                    <LineChart className="icon-md" />
                  </div>
                  <ChartPlaceholder data={data?.revenueChart} type="line" />
                </div>

                <div className="analytics-chart-card">
                  <div className="analytics-card-header">
                    <h3>Projects by Status</h3>
                    <PieChart className="icon-md" />
                  </div>
                  <ChartPlaceholder data={data?.projectsChart} type="pie" />
                </div>

                <div className="analytics-chart-card">
                  <div className="analytics-card-header">
                    <h3>Lead Funnel</h3>
                    <BarChart3 className="icon-md" />
                  </div>
                  <ChartPlaceholder data={data?.leadsChart} type="bar" />
                </div>

                <div className="analytics-chart-card">
                  <h3>Lead Sources</h3>
                  <div className="source-list">
                    {data?.sourceBreakdown?.map((source, index) => (
                      <div key={source.source} className="source-item">
                        <div className="source-row">
                          <span>{source.source}</span>
                          <span className="source-value">
                            {source.count} ({source.percentage}%)
                          </span>
                        </div>
                        <div className="source-progress-track">
                          <div
                            className="source-progress-bar"
                            style={{ width: `${source.percentage}%`, backgroundColor: getSourceColor(index) }}
                          />
                        </div>
                      </div>
                    )) || <div className="empty-state">No data available</div>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Revenue Subtab */}
          {activeSubtab === 'revenue' && (
            <>
              <div className="kpi-cards-row kpi-cards-row--3">
                {kpis
                  .filter((kpi) => ['revenue', 'invoices', 'avgValue'].includes(kpi.id))
                  .map((kpi) => (
                    <div key={kpi.id} className="kpi-card">
                      <div className="kpi-card-icon">{kpi.icon}</div>
                      <span className="kpi-card-label">{kpi.label}</span>
                      <div className="kpi-card-value">{kpi.value}</div>
                      {kpi.change !== undefined && (
                        <div className={cn('kpi-card-change', kpi.change >= 0 ? 'positive' : 'negative')}>
                          {kpi.change >= 0 ? (
                            <TrendingUp className="icon-xs" />
                          ) : (
                            <TrendingDown className="icon-xs" />
                          )}
                          <span className="change-value">
                            {kpi.change >= 0 ? '+' : ''}
                            {kpi.change}%
                          </span>
                          <span className="change-label">{kpi.changeLabel}</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <div className="analytics-chart-card">
                <div className="analytics-card-header">
                  <h3>Revenue Over Time</h3>
                  <LineChart className="icon-md" />
                </div>
                <ChartPlaceholder data={data?.revenueChart} type="line" />
              </div>
            </>
          )}

          {/* Leads Subtab */}
          {activeSubtab === 'leads' && (
            <>
              <div className="kpi-cards-row kpi-cards-row--2">
                {kpis
                  .filter((kpi) => ['clients', 'conversion'].includes(kpi.id))
                  .map((kpi) => (
                    <div key={kpi.id} className="kpi-card">
                      <div className="kpi-card-icon">{kpi.icon}</div>
                      <span className="kpi-card-label">{kpi.label}</span>
                      <div className="kpi-card-value">{kpi.value}</div>
                      {kpi.change !== undefined && (
                        <div className={cn('kpi-card-change', kpi.change >= 0 ? 'positive' : 'negative')}>
                          {kpi.change >= 0 ? (
                            <TrendingUp className="icon-xs" />
                          ) : (
                            <TrendingDown className="icon-xs" />
                          )}
                          <span className="change-value">
                            {kpi.change >= 0 ? '+' : ''}
                            {kpi.change}%
                          </span>
                          <span className="change-label">{kpi.changeLabel}</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <div className="analytics-card-grid">
                <div className="analytics-chart-card">
                  <div className="analytics-card-header">
                    <h3>Lead Funnel</h3>
                    <BarChart3 className="icon-md" />
                  </div>
                  <ChartPlaceholder data={data?.leadsChart} type="bar" />
                </div>

                <div className="analytics-chart-card">
                  <h3>Lead Sources</h3>
                  <div className="source-list">
                    {data?.sourceBreakdown?.map((source, index) => (
                      <div key={source.source} className="source-item">
                        <div className="source-row">
                          <span>{source.source}</span>
                          <span className="source-value">
                            {source.count} ({source.percentage}%)
                          </span>
                        </div>
                        <div className="source-progress-track">
                          <div
                            className="source-progress-bar"
                            style={{ width: `${source.percentage}%`, backgroundColor: getSourceColor(index) }}
                          />
                        </div>
                      </div>
                    )) || <div className="empty-state">No data available</div>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Projects Subtab */}
          {activeSubtab === 'projects' && (
            <>
              <div className="kpi-cards-row kpi-cards-row--2">
                {kpis
                  .filter((kpi) => ['projects', 'avgValue'].includes(kpi.id))
                  .map((kpi) => (
                    <div key={kpi.id} className="kpi-card">
                      <div className="kpi-card-icon">{kpi.icon}</div>
                      <span className="kpi-card-label">{kpi.label}</span>
                      <div className="kpi-card-value">{kpi.value}</div>
                      {kpi.change !== undefined && (
                        <div className={cn('kpi-card-change', kpi.change >= 0 ? 'positive' : 'negative')}>
                          {kpi.change >= 0 ? (
                            <TrendingUp className="icon-xs" />
                          ) : (
                            <TrendingDown className="icon-xs" />
                          )}
                          <span className="change-value">
                            {kpi.change >= 0 ? '+' : ''}
                            {kpi.change}%
                          </span>
                          <span className="change-label">{kpi.changeLabel}</span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <div className="analytics-chart-card">
                <div className="analytics-card-header">
                  <h3>Projects by Status</h3>
                  <PieChart className="icon-md" />
                </div>
                <ChartPlaceholder data={data?.projectsChart} type="pie" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ChartPlaceholder({
  data,
}: {
  data?: ChartData;
  type: 'line' | 'bar' | 'pie';
}) {
  return (
    <div className="chart-placeholder">
      <BarChart3 className="icon-xl tw-text-muted" />
      <p className="tw-text-muted">{data?.labels?.length || 0} data points</p>
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
