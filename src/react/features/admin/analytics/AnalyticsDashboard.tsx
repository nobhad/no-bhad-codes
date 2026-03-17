import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  ArcElement,
  PieController,
  Tooltip,
  Legend,
  Filler,
  type ChartData as ChartJSData,
  type ChartOptions,
  type ChartConfiguration
} from 'chart.js';
import {
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  FileText,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { ChevronDown } from 'lucide-react';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { IconButton } from '@react/factories';
import { StatCard } from '@react/components/portal/StatCard';
import { useFadeIn } from '@react/hooks/useGsap';
import { useActiveSubtab, useSetSubtabActions } from '@react/contexts/SubtabContext';
import { EmptyState, ErrorState, LoadingState } from '@react/factories';
import { formatCurrencyCompact as formatCurrency } from '@/utils/format-utils';
import { apiFetch, unwrapApiData } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatErrorMessage } from '@/utils/error-utils';
import { exportDataToCsv, type ExportConfig } from '@/utils/table-export';

// Register Chart.js components + controllers
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  ArcElement,
  PieController,
  Tooltip,
  Legend,
  Filler
);

// ============================================
// Types
// ============================================

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

interface KPI {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
}

interface AnalyticsDashboardProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type AnalyticsSubtab = 'overview' | 'revenue' | 'leads' | 'projects';
type ChartType = 'line' | 'bar' | 'pie';

// ============================================
// CSS variable resolver
// ============================================

/** Resolve a CSS variable string like "var(--status-active)" to a hex/rgb value. */
function resolveCssVar(value: string): string {
  if (!value.startsWith('var(')) return value;
  const name = value.slice(4, -1).trim();
  // Read from document.body to pick up [data-page="admin"] scoped theme variables
  const resolved = getComputedStyle(document.body).getPropertyValue(name).trim();
  return resolved || value;
}

/** Create a color with alpha from a resolved CSS color (hex or rgb). */
function colorWithAlpha(color: string, alpha: number): string {
  // Hex format: append 2-digit hex alpha
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return `${color}${hex}`;
  }
  // RGB format: convert to rgba
  const rgbMatch = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
  }
  // Fallback
  return color;
}

// ============================================
// ChartWidget — renders a real Chart.js chart
// ============================================

interface ChartWidgetProps {
  data?: ChartData;
  type: ChartType;
}

function ChartWidget({ data, type }: ChartWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // No data — don't render
    if (!data || !data.labels?.length) return;

    // Resolve CSS variable colors
    const textMuted = resolveCssVar('var(--color-text-tertiary)');
    const borderColor = resolveCssVar('var(--color-border-primary)');
    const textSecondary = resolveCssVar('var(--color-text-secondary)');

    const resolvedDatasets = data.datasets.map((ds) => {
      const color = resolveCssVar(ds.color);
      if (type === 'pie') {
        // For pie charts, generate multiple colors from the palette
        const palette = [
          resolveCssVar('var(--color-brand-primary)'),
          resolveCssVar('var(--status-completed)'),
          resolveCssVar('var(--status-pending)'),
          resolveCssVar('var(--status-active)'),
          resolveCssVar('var(--status-qualified)'),
          resolveCssVar('var(--status-new)')
        ];
        return {
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.data.map((_, i) => palette[i % palette.length]),
          borderWidth: 0
        };
      }
      if (type === 'line') {
        return {
          label: ds.label,
          data: ds.data,
          borderColor: color,
          backgroundColor: colorWithAlpha(color, 0.1),
          pointBackgroundColor: color,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          tension: 0.3,
          borderWidth: 1.5
        };
      }
      // bar
      return {
        label: ds.label,
        data: ds.data,
        backgroundColor: colorWithAlpha(color, 0.6),
        borderColor: color,
        borderWidth: 1
      };
    });

    const commonOptions: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: type === 'pie',
          labels: {
            color: textSecondary,
            font: { size: 11 },
            boxWidth: 10
          }
        },
        tooltip: {
          backgroundColor: resolveCssVar('var(--color-bg-tertiary)'),
          titleColor: resolveCssVar('var(--color-text-primary)'),
          bodyColor: textSecondary,
          borderColor: borderColor,
          borderWidth: 1
        }
      }
    };

    const axesOptions =
      type !== 'pie'
        ? {
          x: {
            ticks: { color: textMuted, font: { size: 10 } },
            grid: { color: colorWithAlpha(borderColor, 0.25) },
            border: { color: borderColor }
          },
          y: {
            ticks: { color: textMuted, font: { size: 10 } },
            grid: { color: colorWithAlpha(borderColor, 0.25) },
            border: { color: borderColor }
          }
        }
        : undefined;

    const config: ChartConfiguration = {
      type: type as 'line' | 'bar' | 'pie',
      data: {
        labels: data.labels,
        datasets: resolvedDatasets
      } as ChartJSData,
      options: {
        ...commonOptions,
        ...(axesOptions ? { scales: axesOptions } : {})
      }
    };

    chartRef.current = new ChartJS(canvasRef.current, config);

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data, type]);

  const hasData = data && data.labels?.length > 0;

  if (!hasData) {
    return (
      <div className="chart-placeholder">
        <BarChart3 className="icon-xl text-secondary" />
        <p className="text-secondary">No data available</p>
      </div>
    );
  }

  return (
    <div className="chart-canvas-wrapper">
      <canvas ref={canvasRef} />
    </div>
  );
}

// ============================================
// KpiCard — extracted to avoid repetition
// ============================================

const KpiCard = React.memo(({ kpi }: { kpi: KPI }) => {
  const changeText = kpi.change !== undefined
    ? `${kpi.change >= 0 ? '+' : ''}${kpi.change}% ${kpi.changeLabel ?? ''}`
    : undefined;

  return (
    <StatCard
      label={kpi.label}
      value={kpi.value}
      icon={kpi.icon}
      meta={changeText}
    />
  );
});

// ============================================
// AnalyticsDashboard
// ============================================

export function AnalyticsDashboard({ getAuthToken: _getAuthToken }: AnalyticsDashboardProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const activeSubtab = useActiveSubtab<AnalyticsSubtab>();
  const setSubtabActions = useSetSubtabActions();

  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  const loadAnalytics = useCallback(async (retryCount = 0) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_ENDPOINTS.ADMIN.ANALYTICS}?range=${dateRange}`);

      // Retry on 503 (backend still starting up)
      if (response.status === 503 && retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return loadAnalytics(retryCount + 1);
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `Failed to load analytics (${response.status})`);
      }
      const analyticsData = unwrapApiData<AnalyticsData>(await response.json());
      setData(analyticsData);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to load analytics'));
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const kpis: KPI[] = useMemo(() => data
    ? [
      {
        id: 'revenue',
        label: 'Revenue',
        value: formatCurrency(data.kpis.revenue.value),
        change: data.kpis.revenue.change,
        changeLabel: 'vs last period',
        icon: <DollarSign className="icon-lg" />
      },
      {
        id: 'clients',
        label: 'Total Clients',
        value: data.kpis.clients.value,
        change: data.kpis.clients.change,
        changeLabel: 'new this period',
        icon: <Users className="icon-lg" />
      },
      {
        id: 'projects',
        label: 'Active Projects',
        value: data.kpis.projects.value,
        change: data.kpis.projects.change,
        changeLabel: 'vs last period',
        icon: <Briefcase className="icon-lg" />
      },
      {
        id: 'invoices',
        label: 'Invoices Sent',
        value: data.kpis.invoices.value,
        change: data.kpis.invoices.change,
        changeLabel: 'this period',
        icon: <FileText className="icon-lg" />
      },
      {
        id: 'conversion',
        label: 'Conversion Rate',
        value: `${data.kpis.conversionRate.value}%`,
        change: data.kpis.conversionRate.change,
        changeLabel: 'vs last period',
        icon: <TrendingUp className="icon-lg" />
      },
      {
        id: 'avgValue',
        label: 'Avg Project Value',
        value: formatCurrency(data.kpis.avgProjectValue.value),
        change: data.kpis.avgProjectValue.change,
        changeLabel: 'vs last period',
        icon: <BarChart3 className="icon-lg" />
      }
    ]
    : [], [data]);

  // Export analytics data as CSV
  const handleExport = useCallback(() => {
    if (!data) return;
    const exportRows = kpis.map((kpi) => ({
      metric: kpi.label,
      value: String(kpi.value),
      change: kpi.change !== undefined ? `${kpi.change}%` : ''
    }));
    const config: ExportConfig = {
      filename: `analytics_${dateRange}`,
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
        { key: 'change', label: 'Change' }
      ]
    };
    exportDataToCsv(exportRows, config);
  }, [data, kpis, dateRange]);

  const dateRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' }
  ];

  // Inject actions into the subtab row via context
  useEffect(() => {
    setSubtabActions(
      <div className="data-table-actions">
        <PortalDropdown>
          <PortalDropdownTrigger asChild>
            <button className="dropdown-trigger date-range-trigger">
              {dateRangeOptions.find((o) => o.value === dateRange)?.label}
              <ChevronDown className="dropdown-caret" />
            </button>
          </PortalDropdownTrigger>
          <PortalDropdownContent align="start" sideOffset={0}>
            {dateRangeOptions.map((option) => (
              <PortalDropdownItem
                key={option.value}
                className={cn(dateRange === option.value && 'is-active')}
                onSelect={() => setDateRange(option.value as typeof dateRange)}
              >
                {option.label}
              </PortalDropdownItem>
            ))}
          </PortalDropdownContent>
        </PortalDropdown>
        <IconButton action="refresh" title="Refresh analytics" onClick={() => loadAnalytics()} disabled={isLoading} />
        <IconButton action="download" title="Export analytics" onClick={handleExport} disabled={!data} />
      </div>
    );

    return () => setSubtabActions(null);
  }, [dateRange, isLoading, data, setSubtabActions, handleExport, loadAnalytics]);

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">

      {error && (
        <div className="data-table-card">
          <ErrorState message={error} onRetry={loadAnalytics} />
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading analytics data..." />
      ) : (
        <>
          {activeSubtab === 'overview' && (
            <>
              <div className="kpi-cards-row">
                {kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
              </div>
              <div className="analytics-card-grid">
                <div className="panel analytics-chart-panel">
                  <div className="panel-header">
                    <h3><span className="title-full">Revenue Over Time</span></h3>
                    <LineChart className="icon-md" />
                  </div>
                  <ChartWidget data={data?.revenueChart} type="line" />
                </div>
                <div className="panel analytics-chart-panel">
                  <div className="panel-header">
                    <h3><span className="title-full">Projects by Status</span></h3>
                    <PieChart className="icon-md" />
                  </div>
                  <ChartWidget data={data?.projectsChart} type="pie" />
                </div>
                <div className="panel analytics-chart-panel">
                  <div className="panel-header">
                    <h3><span className="title-full">Lead Funnel</span></h3>
                    <BarChart3 className="icon-md" />
                  </div>
                  <ChartWidget data={data?.leadsChart} type="bar" />
                </div>
                <div className="panel analytics-chart-panel">
                  <div className="panel-header"><h3><span className="title-full">Lead Sources</span></h3></div>
                  <SourceBreakdown sources={data?.sourceBreakdown} />
                </div>
              </div>
            </>
          )}

          {activeSubtab === 'revenue' && (
            <>
              <div className="kpi-cards-row kpi-cards-row--3">
                {kpis
                  .filter((kpi) => ['revenue', 'invoices', 'avgValue'].includes(kpi.id))
                  .map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
              </div>
              <div className="panel analytics-chart-panel">
                <div className="panel-header">
                  <h3><span className="title-full">Revenue Over Time</span></h3>
                  <LineChart className="icon-md" />
                </div>
                <ChartWidget data={data?.revenueChart} type="line" />
              </div>
            </>
          )}

          {activeSubtab === 'leads' && (
            <>
              <div className="kpi-cards-row kpi-cards-row--2">
                {kpis
                  .filter((kpi) => ['clients', 'conversion'].includes(kpi.id))
                  .map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
              </div>
              <div className="analytics-card-grid">
                <div className="panel analytics-chart-panel">
                  <div className="panel-header">
                    <h3><span className="title-full">Lead Funnel</span></h3>
                    <BarChart3 className="icon-md" />
                  </div>
                  <ChartWidget data={data?.leadsChart} type="bar" />
                </div>
                <div className="panel analytics-chart-panel">
                  <div className="panel-header"><h3><span className="title-full">Lead Sources</span></h3></div>
                  <SourceBreakdown sources={data?.sourceBreakdown} />
                </div>
              </div>
            </>
          )}

          {activeSubtab === 'projects' && (
            <>
              <div className="kpi-cards-row kpi-cards-row--2">
                {kpis
                  .filter((kpi) => ['projects', 'avgValue'].includes(kpi.id))
                  .map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
              </div>
              <div className="panel analytics-chart-panel">
                <div className="panel-header">
                  <h3><span className="title-full">Projects by Status</span></h3>
                  <PieChart className="icon-md" />
                </div>
                <ChartWidget data={data?.projectsChart} type="pie" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// SourceBreakdown — lead source progress bars
// ============================================

const SOURCE_COLORS = [
  'var(--color-brand-primary)',
  'var(--status-completed)',
  'var(--status-pending)',
  'var(--status-active)',
  'var(--status-qualified)',
  'var(--status-new)'
];

function SourceBreakdown({
  sources
}: {
  sources?: { source: string; count: number; percentage: number }[];
}) {
  if (!sources?.length) {
    return <EmptyState message="No data available" />;
  }

  return (
    <div className="source-list">
      {sources.map((source, index) => (
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
              style={{
                width: `${source.percentage}%`,
                backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length]
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
