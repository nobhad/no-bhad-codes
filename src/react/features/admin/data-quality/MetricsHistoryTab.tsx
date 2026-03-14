/**
 * Metrics & History Tab
 * @file src/react/features/admin/data-quality/MetricsHistoryTab.tsx
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import {
  fetchWithAuth,
  formatDate,
  getMetricStatusVariant,
  type TabProps,
  type DataQualityMetric,
  type MetricHistoryEntry
} from './types';

const logger = createLogger('MetricsHistoryTab');

export function MetricsHistoryTab({
  getAuthToken,
  showNotification
}: TabProps) {
  const [metrics, setMetrics] = useState<DataQualityMetric[]>([]);
  const [history, setHistory] = useState<MetricHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsData, historyData] = await Promise.all([
        fetchWithAuth<DataQualityMetric[]>(API_ENDPOINTS.ADMIN.DATA_QUALITY_METRICS, getAuthToken),
        fetchWithAuth<MetricHistoryEntry[]>(API_ENDPOINTS.ADMIN.DATA_QUALITY_METRICS_HISTORY, getAuthToken)
      ]);
      setMetrics(metricsData);
      setHistory(historyData);
    } catch (err) {
      logger.error('Failed to load metrics:', err);
      showNotification?.('Failed to load metrics data', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecalculate = useCallback(async () => {
    try {
      setCalculating(true);
      const data = await fetchWithAuth<DataQualityMetric[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_METRICS_CALCULATE,
        getAuthToken,
        { method: 'POST' }
      );
      setMetrics(data);
      showNotification?.('Metrics recalculated successfully', 'success');
      // Reload history to include the new calculation
      const historyData = await fetchWithAuth<MetricHistoryEntry[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_METRICS_HISTORY,
        getAuthToken
      );
      setHistory(historyData);
    } catch (err) {
      logger.error('Metrics recalculation failed:', err);
      showNotification?.('Failed to recalculate metrics', 'error');
    } finally {
      setCalculating(false);
    }
  }, [getAuthToken, showNotification]);

  if (loading) {
    return <div className="loading-state">Loading metrics...</div>;
  }

  return (
    <>
      <div className="portal-card">
        <div className="data-table-header">
          <h3><span className="title-full">Current Metrics</span></h3>
          <div className="data-table-actions">
            <button
              className="btn btn-primary"
              onClick={handleRecalculate}
              disabled={calculating}
            >
              <RefreshCw />
              {calculating ? 'Calculating...' : 'Recalculate Metrics'}
            </button>
          </div>
        </div>

        {metrics.length === 0 ? (
          <div className="empty-state">No metrics available. Run a calculation to generate metrics.</div>
        ) : (
          <div className="stats-grid">
            {metrics.map(metric => (
              <div className="stat-card" key={metric.name}>
                <span className={`status-badge status-badge-${getMetricStatusVariant(metric.status)}`}>
                  {metric.status}
                </span>
                <div className="stat-value">
                  {metric.value}{metric.unit === '%' ? '%' : ` ${metric.unit}`}
                </div>
                <div className="stat-label">{metric.name}</div>
                <div className="stat-meta">
                  Last calculated: {formatDate(metric.lastCalculated)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="portal-card">
        <div className="data-table-header">
          <h3><span className="title-full">Metric History</span></h3>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">No metric history available.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Calculated At</th>
              </tr>
            </thead>
            <tbody>
              {history.map(entry => (
                <tr key={entry.id}>
                  <td>{entry.metricName}</td>
                  <td>{entry.value}</td>
                  <td>{formatDate(entry.calculatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
