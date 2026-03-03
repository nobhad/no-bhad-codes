import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Save,
  Download,
  BarChart3,
  Table,
  Code,
  Trash2,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

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

export function AdHocAnalytics({ onNavigate, getAuthToken, showNotification }: AdHocAnalyticsProps) {
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
      'Content-Type': 'application/json',
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
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load saved queries');
      const data = await response.json();
      const payload = data.data || data;
      setSavedQueries(payload.queries || []);
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
        body: JSON.stringify({ query, dateRange }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute query');
      }

      const data = await response.json();
      const payload = data.data || data;
      setResult(payload.result);
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
        body: JSON.stringify({ name: queryName, query }),
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
        credentials: 'include',
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
      ...result.rows.map((row) => result.columns.map((col) => JSON.stringify(row[col] ?? '')).join(',')),
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
      year: 'numeric',
    });
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="tw-section">
      {/* Header */}
      <div className="perf-header">
        <h2 className="tw-heading perf-heading">Custom Analytics</h2>
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
            <h3 className="tw-section-title analytics-section-title">Saved Queries</h3>
            {savedQueries.length === 0 ? (
              <p className="tw-text-muted analytics-empty-text">No saved queries yet</p>
            ) : (
              <div>
                {savedQueries.map((sq) => (
                  <div
                    key={sq.id}
                    className="tw-card-hover analytics-query-card"
                    onClick={() => loadQuery(sq)}
                  >
                    <div className="analytics-query-header">
                      <div className="analytics-query-content">
                        <span className="analytics-query-name">{sq.name}</span>
                        {sq.lastRun && (
                          <span className="tw-text-muted analytics-query-date">
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
                <span className="tw-section-title">Query</span>
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
              <span className="tw-text-muted analytics-hint">
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
            <div className="error-state">{error}</div>
          )}

          {/* Results */}
          {result && (
            <div className="tw-panel">
              <div className="analytics-results-header">
                <div className="analytics-results-stats">
                  <span>{result.rowCount} rows</span>
                  <span className="tw-text-muted">Executed in {result.executionTime}ms</span>
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
                    <p className="tw-text-muted analytics-pagination">
                      Showing first 100 of {result.rowCount} rows
                    </p>
                  )}
                </div>
              ) : (
                <div className="empty-state analytics-chart-empty">
                  <BarChart3 className="analytics-chart-icon" />
                  <p>Chart visualization</p>
                  <p className="tw-text-muted analytics-chart-hint">Select numeric columns to visualize</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdHocAnalytics;
