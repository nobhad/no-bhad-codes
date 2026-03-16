import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  Filler
} from 'chart.js';
import {
  Play,
  Save,
  Download,
  BarChart3,
  Table,
  Code,
  Trash2,
  TrendingUp
} from 'lucide-react';
import { PageHeader } from '@react/factories/createSection';

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, LineController,
  BarElement, BarController, ArcElement, PieController, Tooltip, Legend, Filler
);
import { cn } from '@react/lib/utils';
import { EmptyState } from '@react/factories';
import { useFadeIn } from '@react/hooks/useGsap';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiFetch, apiPost, apiDelete } from '@/utils/api-client';
import { formatErrorMessage } from '@/utils/error-utils';
import { executeCreateWithToast, executeDeleteWithToast } from '@/utils/api-wrappers';

const logger = createLogger('AdHocAnalytics');

interface SavedQuery {
  id: number;
  name: string;
  description?: string;
  query: string;
  lastRun?: string;
  createdAt: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

interface AdHocAnalyticsProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AdHocAnalytics({ getAuthToken: _getAuthToken, showNotification: _showNotification }: AdHocAnalyticsProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [query, setQuery] = useState('');
  const [queryName, setQueryName] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');

  const loadSavedQueries = useCallback(async () => {
    try {
      const response = await apiFetch(API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_QUERIES);
      if (!response.ok) throw new Error('Failed to load saved queries');
      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setSavedQueries((payload.queries as SavedQuery[]) || []);
    } catch (err) {
      logger.error('Failed to load saved queries:', err);
    }
  }, []);

  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  async function runQuery() {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiPost(API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_RUN, { query, dateRange });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute query');
      }

      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setResult(payload.result as QueryResult);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to execute query'));
    } finally {
      setIsLoading(false);
    }
  }

  async function saveQuery() {
    if (!query.trim() || !queryName.trim()) return;

    await executeCreateWithToast(
      'query',
      () => apiPost(API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_QUERIES, { name: queryName, query }),
      () => {
        loadSavedQueries();
        setQueryName('');
      }
    );
  }

  async function deleteQuery(queryId: number) {
    if (!confirm('Are you sure you want to delete this saved query?')) return;

    await executeDeleteWithToast(
      'query',
      () => apiDelete(buildEndpoint.adminAdHocQuery(queryId)),
      () => setSavedQueries((prev) => prev.filter((q) => q.id !== queryId))
    );
  }

  function loadQuery(savedQuery: SavedQuery) {
    setQuery(savedQuery.query);
    setQueryName(savedQuery.name);
  }

  function exportResults() {
    if (!result) return;

    const csv = [
      result.columns.join(','),
      ...result.rows.map((row) => result.columns.map((col) => JSON.stringify(row[col] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      {/* Header */}
      <PageHeader
        title="Custom Analytics"
        icon={TrendingUp}
        actions={
          <div className="tab-list perf-tab-list">
            {(['7d', '30d', '90d', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={dateRange === range ? 'tab-active' : 'tab'}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'Custom'}
              </button>
            ))}
          </div>
        }
      />

      <div className="analytics-grid">
        {/* Saved Queries Sidebar */}
        <div>
          <div className="panel">
            <div className="data-table-header"><h3><span className="title-full">Saved Queries</span></h3></div>
            {savedQueries.length === 0 ? (
              <p className="analytics-empty-text">No saved queries yet</p>
            ) : (
              <div className="subsection">
                {savedQueries.map((sq) => (
                  <div
                    key={sq.id}
                    className="portal-card card-clickable analytics-query-card"
                    onClick={() => loadQuery(sq)}
                  >
                    <div className="analytics-query-header">
                      <div className="analytics-query-content">
                        <span className="analytics-query-name">{sq.name}</span>
                        {sq.lastRun && (
                          <span className="analytics-query-date">
                            Last run: {formatDate(sq.lastRun)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuery(sq.id);
                        }}
                        className="icon-btn"
                        aria-label="Delete saved query"
                      >
                        <Trash2 className="analytics-trash-icon" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="analytics-main">
          {/* Query Editor */}
          <div className="panel">
            <div className="data-table-header">
              <h3>
                <Code className="icon-sm" />
                <span className="title-full">Query</span>
              </h3>
              <div className="data-table-actions">
                <input
                  type="text"
                  placeholder="Query name..."
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  className="input analytics-name-input"
                  aria-label="Query name"
                />
                <button className="btn-secondary" onClick={saveQuery} disabled={!query || !queryName}>
                  <Save className="analytics-action-icon" />
                  Save
                </button>
              </div>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your analytics query here..."
              rows={6}
              className="textarea"
              aria-label="Analytics query"
            />
            <div className="analytics-editor-footer">
              <span className="analytics-hint">
                Use SQL-like syntax to query your data
              </span>
              <button className="btn-primary" onClick={runQuery} disabled={isLoading || !query}>
                <Play className={cn('analytics-action-icon', isLoading && 'status-panel-refresh-icon-spin')} />
                {isLoading ? 'Running...' : 'Run Query'}
              </button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="error-state">
              {error}
              <button className="btn-secondary" onClick={runQuery}>
                Retry
              </button>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="panel">
              <div className="analytics-results-header">
                <div className="analytics-results-stats">
                  <span>{result.rowCount} rows</span>
                  <span>Executed in {result.executionTime}ms</span>
                </div>
                <div className="analytics-results-actions">
                  <div className="tab-list perf-tab-list">
                    <button
                      onClick={() => setViewMode('table')}
                      className={cn(viewMode === 'table' ? 'tab-active' : 'tab', 'analytics-view-toggle')}
                      aria-label="Table view"
                    >
                      <Table className="analytics-action-icon" />
                    </button>
                    <button
                      onClick={() => setViewMode('chart')}
                      className={cn(viewMode === 'chart' ? 'tab-active' : 'tab', 'analytics-view-toggle')}
                      aria-label="Chart view"
                    >
                      <BarChart3 className="analytics-action-icon" />
                    </button>
                  </div>
                  <button className="btn-secondary" onClick={exportResults}>
                    <Download className="analytics-action-icon" />
                    Export
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div className="analytics-table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        {result.columns.map((col) => (
                          <th key={col} className="table-header">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 100).map((row, i) => (
                        <tr key={`row-${i}-${String(row[result.columns[0]] ?? i)}`} className="table-row">
                          {result.columns.map((col) => (
                            <td key={col} className="table-cell">{row[col] != null ? String(row[col]) : ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rowCount > 100 && (
                    <p className="analytics-pagination">
                      Showing first 100 of {result.rowCount} rows
                    </p>
                  )}
                </div>
              ) : (
                <QueryChart result={result} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chart color CSS variable names - resolved at runtime */
const CHART_COLOR_VARS = [
  '--app-color-primary',
  '--app-color-success',
  '--app-color-warning',
  '--app-color-purple',
  '--app-color-danger',
  '--app-color-info',
  '--app-color-warning-light',
  '--app-color-danger-dark'
] as const;

/** Resolve CSS variables at runtime for Chart.js colors */
function getChartColors(): string[] {
  const style = getComputedStyle(document.documentElement);

  return CHART_COLOR_VARS.map(varName => {
    const color = style.getPropertyValue(varName).trim();
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.8)`;
    }
    return color;
  });
}

/** Detect which columns are numeric */
function getNumericColumns(result: QueryResult): string[] {
  return result.columns.filter((col) => {
    const sample = result.rows.slice(0, 10).map(r => r[col]);
    return sample.some(v => v !== null && v !== undefined && !isNaN(Number(v)));
  });
}

/** Get best label column (first non-numeric string column) */
function getLabelColumn(result: QueryResult, numericCols: string[]): string | null {
  return result.columns.find(c => !numericCols.includes(c)) || null;
}

/** Chart component for query results */
function QueryChart({ result }: { result: QueryResult }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

  const numericCols = getNumericColumns(result);
  const labelCol = getLabelColumn(result, numericCols);

  useEffect(() => {
    if (!canvasRef.current || numericCols.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const chartColors = getChartColors();
    const maxRows = chartType === 'pie' ? 20 : 50;
    const rows = result.rows.slice(0, maxRows);
    const labels = labelCol
      ? rows.map(r => String(r[labelCol] ?? ''))
      : rows.map((_, i) => String(i + 1));

    const datasets = numericCols.slice(0, 5).map((col, idx) => ({
      label: col,
      data: rows.map(r => Number(r[col]) || 0),
      backgroundColor: chartType === 'pie'
        ? rows.map((_, i) => chartColors[i % chartColors.length])
        : chartColors[idx % chartColors.length],
      borderColor: chartType === 'line'
        ? chartColors[idx % chartColors.length]
        : 'transparent',
      borderWidth: chartType === 'line' ? 2 : 0,
      tension: 0.3,
      fill: chartType === 'line'
    }));

    // For pie charts, only use the first numeric column
    const pieDatasets = chartType === 'pie' ? [datasets[0]] : datasets;

    const computedStyle = getComputedStyle(document.documentElement);
    const textColor = computedStyle.getPropertyValue('--color-text-secondary').trim() || computedStyle.getPropertyValue('--color-text-secondary').trim();
    const gridColor = computedStyle.getPropertyValue('--color-border-primary').trim() || computedStyle.getPropertyValue('--color-border').trim();

    chartRef.current = new ChartJS(canvasRef.current, {
      type: chartType,
      data: { labels, datasets: pieDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: numericCols.length > 1 || chartType === 'pie',
            labels: { color: textColor, font: { size: 11 } }
          },
          tooltip: { mode: 'index', intersect: false }
        },
        ...(chartType !== 'pie' && {
          scales: {
            x: {
              ticks: { color: textColor, font: { size: 10 }, maxRotation: 45 },
              grid: { color: gridColor }
            },
            y: {
              ticks: { color: textColor, font: { size: 10 } },
              grid: { color: gridColor },
              beginAtZero: true
            }
          }
        })
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [result, chartType, numericCols, labelCol]);

  if (numericCols.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="analytics-chart-icon" />}
        message="No numeric columns to chart"
        className="analytics-chart-empty"
      >
        <p className="analytics-chart-hint">Query must return at least one numeric column</p>
      </EmptyState>
    );
  }

  return (
    <div className="analytics-chart-container">
      <div className="analytics-chart-type-toggle">
        {(['bar', 'line', 'pie'] as const).map((type) => (
          <button
            key={type}
            className={`config-section-tab ${chartType === type ? 'is-active' : ''}`}
            onClick={() => setChartType(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>
      <div className="analytics-chart-canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
