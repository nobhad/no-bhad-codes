import * as React from 'react';
import { useState, useEffect } from 'react';
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

interface SavedQuery {
  id: string;
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
}

export function AdHocAnalytics({ onNavigate }: AdHocAnalyticsProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [query, setQuery] = useState('');
  const [queryName, setQueryName] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');

  useEffect(() => {
    loadSavedQueries();
  }, []);

  async function loadSavedQueries() {
    try {
      const response = await fetch('/api/admin/ad-hoc-analytics/queries');
      if (!response.ok) throw new Error('Failed to load saved queries');
      const data = await response.json();
      setSavedQueries(data.queries || []);
    } catch (err) {
      console.error('Failed to load saved queries:', err);
    }
  }

  async function runQuery() {
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/ad-hoc-analytics/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, dateRange }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute query');
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute query');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveQuery() {
    if (!query.trim() || !queryName.trim()) return;

    try {
      const response = await fetch('/api/admin/ad-hoc-analytics/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: queryName, query }),
      });

      if (!response.ok) throw new Error('Failed to save query');

      loadSavedQueries();
      setQueryName('');
    } catch (err) {
      console.error('Failed to save query:', err);
    }
  }

  async function deleteQuery(queryId: string) {
    if (!confirm('Are you sure you want to delete this saved query?')) return;

    try {
      const response = await fetch(`/api/admin/ad-hoc-analytics/queries/${queryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete query');

      setSavedQueries((prev) => prev.filter((q) => q.id !== queryId));
    } catch (err) {
      console.error('Failed to delete query:', err);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className="tw-heading" style={{ fontSize: '16px' }}>Custom Analytics</h2>
        <div className="tw-tab-list" style={{ borderBottom: 'none' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem' }}>
        {/* Saved Queries Sidebar */}
        <div>
          <div className="tw-panel">
            <h3 className="tw-section-title" style={{ marginBottom: '0.75rem' }}>Saved Queries</h3>
            {savedQueries.length === 0 ? (
              <p className="tw-text-muted" style={{ fontSize: '12px' }}>No saved queries yet</p>
            ) : (
              <div>
                {savedQueries.map((sq) => (
                  <div
                    key={sq.id}
                    className="tw-card-hover"
                    style={{ marginBottom: '0.5rem' }}
                    onClick={() => loadQuery(sq)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{sq.name}</span>
                        {sq.lastRun && (
                          <span className="tw-text-muted" style={{ display: 'block', fontSize: '11px' }}>
                            Last run: {formatDate(sq.lastRun)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteQuery(sq.id);
                        }}
                        className="tw-btn-icon"
                      >
                        <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Query Editor */}
          <div className="tw-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Code style={{ width: '1rem', height: '1rem', color: 'var(--portal-text-muted)' }} />
                <span className="tw-section-title">Query</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Query name..."
                  value={queryName}
                  onChange={(e) => setQueryName(e.target.value)}
                  className="tw-input"
                  style={{ width: '200px', padding: '0.25rem 0.5rem', fontSize: '12px' }}
                />
                <button className="tw-btn-secondary" onClick={saveQuery} disabled={!query || !queryName}>
                  <Save style={{ width: '1rem', height: '1rem' }} />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <span className="tw-text-muted" style={{ fontSize: '11px' }}>
                Use SQL-like syntax to query your data
              </span>
              <button className="tw-btn-primary" onClick={runQuery} disabled={isLoading || !query}>
                <Play style={{ width: '1rem', height: '1rem', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                {isLoading ? 'Running...' : 'Run Query'}
              </button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="tw-error">{error}</div>
          )}

          {/* Results */}
          {result && (
            <div className="tw-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '14px' }}>
                  <span>{result.rowCount} rows</span>
                  <span className="tw-text-muted">Executed in {result.executionTime}ms</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div className="tw-tab-list" style={{ borderBottom: 'none' }}>
                    <button
                      onClick={() => setViewMode('table')}
                      className={viewMode === 'table' ? 'tw-tab-active' : 'tw-tab'}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      <Table style={{ width: '1rem', height: '1rem' }} />
                    </button>
                    <button
                      onClick={() => setViewMode('chart')}
                      className={viewMode === 'chart' ? 'tw-tab-active' : 'tw-tab'}
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      <BarChart3 style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </div>
                  <button className="tw-btn-secondary" onClick={exportResults}>
                    <Download style={{ width: '1rem', height: '1rem' }} />
                    Export
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div style={{ overflowX: 'auto' }}>
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
                            <td key={col} className="tw-table-cell">{String(row[col] ?? '-')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.rowCount > 100 && (
                    <p className="tw-text-muted" style={{ fontSize: '11px', marginTop: '0.5rem', textAlign: 'center' }}>
                      Showing first 100 of {result.rowCount} rows
                    </p>
                  )}
                </div>
              ) : (
                <div className="tw-empty-state" style={{ height: '16rem' }}>
                  <BarChart3 style={{ width: '3rem', height: '3rem', opacity: 0.3 }} />
                  <p>Chart visualization</p>
                  <p className="tw-text-muted" style={{ fontSize: '11px' }}>Select numeric columns to visualize</p>
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
