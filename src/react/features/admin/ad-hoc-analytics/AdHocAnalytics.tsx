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
  Trash2
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, LineController,
  BarElement, BarController, ArcElement, PieController, Tooltip, Legend, Filler
);
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

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
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AdHocAnalytics({ getAuthToken, showNotification }: AdHocAnalyticsProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [query, setQuery] = useState('');
  const [queryName, setQueryName] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');

  // Auth headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const loadSavedQueries = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_QUERIES, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load saved queries');
      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setSavedQueries((payload.queries as SavedQuery[]) || []);
    } catch (err) {
      logger.error('Failed to load saved queries:', err);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  async function runQuery() {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_RUN, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ query, dateRange })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute query');
      }

      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setResult(payload.result as QueryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveQuery() {
    if (!query.trim() || !queryName.trim()) return;

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.AD_HOC_ANALYTICS_QUERIES, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name: queryName, query })
      });

      if (!response.ok) throw new Error('Failed to save query');

      loadSavedQueries();
      setQueryName('');
      showNotification?.('Query saved', 'success');
    } catch (err) {
      logger.error('Failed to save query:', err);
      showNotification?.('Failed to save query', 'error');
    }
  }

  async function deleteQuery(queryId: number) {
    if (!confirm('Are you sure you want to delete this saved query?')) return;

    try {
      const response = await fetch(buildEndpoint.adminAdHocQuery(queryId), {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete query');

      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId));
      showNotification?.('Query deleted', 'success');
    } catch (err) {
      logger.error('Failed to delete query:', err);
      showNotification?.('Failed to delete query', 'error');
    }
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
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="tw-section">
      {/* Header */}
      <div className="perf-header">
        <h2 className="heading perf-heading">Custom Analytics</h2>
        <div className="tw-tab-list perf-tab-list">
          {(['7d', '30d', '90d', 'custom'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={dateRange === range ? 'tw-tab-active' : 'tw-tab'}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-grid">
        {/* Saved Queries Sidebar */}
        <div>
          <div className="tw-panel">
            <h3 className="section-title analytics-section-title">Saved Queries</h3>
            {savedQueries.length === 0 ? (
              <p className="text-muted analytics-empty-text">No saved queries yet</p>
            ) : (
              <div>
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
                          <span className="text-muted analytics-query-date">
                            Last run: {formatDate(sq.lastRun)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuery(sq.id);
                        }}
                        className="btn-icon"
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
          <div className="tw-panel">
            <div className="analytics-editor-header">
              <div className="analytics-editor-title">
                <Code className="analytics-editor-icon" />
                <span className="section-title">Query</span>
              </div>
              <div className="analytics-editor-actions">
                <input
                  type="text"
                  placeholder="Query name..."
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  className="tw-input analytics-name-input"
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
              className="tw-textarea"
            />
            <div className="analytics-editor-footer">
              <span className="text-muted analytics-hint">
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
            <div className="tw-panel">
              <div className="analytics-results-header">
                <div className="analytics-results-stats">
                  <span>{result.rowCount} rows</span>
                  <span className="text-muted">Executed in {result.executionTime}ms</span>
                </div>
                <div className="analytics-results-actions">
                  <div className="tw-tab-list perf-tab-list">
                    <button
                      onClick={() => setViewMode('table')}
                      className={cn(viewMode === 'table' ? 'tw-tab-active' : 'tw-tab', 'analytics-view-toggle')}
                    >
                      <Table className="analytics-action-icon" />
                    </button>
                    <button
                      onClick={() => setViewMode('chart')}
                      className={cn(viewMode === 'chart' ? 'tw-tab-active' : 'tw-tab', 'analytics-view-toggle')}
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
                  <table className="tw-table">
                    <thead>
                      <tr>
                        {result.columns.map((col) => (
                          <th key={col} className="tw-table-header">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="tw-table-row">
                          {result.columns.map((col) => (
                            <td key={col} className="tw-table-cell">{row[col] != null ? String(row[col]) : ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rowCount > 100 && (
                    <p className="text-muted analytics-pagination">
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

/** Chart colors using CSS variable fallbacks */
const CHART_COLORS = [
  'rgba(0, 175, 240, 0.8)',
  'rgba(75, 192, 192, 0.8)',
  'rgba(255, 159, 64, 0.8)',
  'rgba(153, 102, 255, 0.8)',
  'rgba(255, 99, 132, 0.8)',
  'rgba(54, 162, 235, 0.8)',
  'rgba(255, 206, 86, 0.8)',
  'rgba(231, 76, 60, 0.8)'
];

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

    const maxRows = chartType === 'pie' ? 20 : 50;
    const rows = result.rows.slice(0, maxRows);
    const labels = labelCol
      ? rows.map(r => String(r[labelCol] ?? ''))
      : rows.map((_, i) => String(i + 1));

    const datasets = numericCols.slice(0, 5).map((col, idx) => ({
      label: col,
      data: rows.map(r => Number(r[col]) || 0),
      backgroundColor: chartType === 'pie'
        ? rows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
        : CHART_COLORS[idx % CHART_COLORS.length],
      borderColor: chartType === 'line'
        ? CHART_COLORS[idx % CHART_COLORS.length]
        : 'transparent',
      borderWidth: chartType === 'line' ? 2 : 0,
      tension: 0.3,
      fill: chartType === 'line'
    }));

    // For pie charts, only use the first numeric column
    const pieDatasets = chartType === 'pie' ? [datasets[0]] : datasets;

    const computedStyle = getComputedStyle(document.documentElement);
    const textColor = computedStyle.getPropertyValue('--portal-text-secondary').trim() || '#999';
    const gridColor = computedStyle.getPropertyValue('--portal-border-color').trim() || '#333';

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
      <div className="empty-state analytics-chart-empty">
        <BarChart3 className="analytics-chart-icon" />
        <p>No numeric columns to chart</p>
        <p className="text-muted analytics-chart-hint">Query must return at least one numeric column</p>
      </div>
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

export default AdHocAnalytics;
