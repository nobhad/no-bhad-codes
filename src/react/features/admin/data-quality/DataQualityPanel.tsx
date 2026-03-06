/**
 * ===============================================
 * DATA QUALITY PANEL
 * ===============================================
 * @file src/react/features/admin/data-quality/DataQualityPanel.tsx
 *
 * Admin panel for data quality management with tabs:
 * - Duplicate Detection
 * - Metrics & History
 * - Validation Errors
 * - Rate Limiting
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  BarChart3,
  AlertTriangle,
  Shield,
  Play,
  RefreshCw,
  Ban,
  Unlock,
  X,
  Merge,
  Filter
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('DataQualityPanel');

// ============================================
// TYPES
// ============================================

interface DataQualityPanelProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

type DataQualityTab = 'duplicates' | 'metrics' | 'validation' | 'rate-limits';

interface DuplicateRecord {
  id: string;
  entityType: string;
  entity1Id: string;
  entity1Name: string;
  entity2Id: string;
  entity2Name: string;
  confidence: number;
  matchFields: string[];
  status: 'pending' | 'merged' | 'dismissed';
  detectedAt: string;
}

interface DataQualityMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  lastCalculated: string;
}

interface MetricHistoryEntry {
  id: string;
  metricName: string;
  value: number;
  calculatedAt: string;
}

interface ValidationError {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  errorType: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
}

interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  activeBlocks: number;
  topOffenders: Array<{
    ip: string;
    requestCount: number;
    blocked: boolean;
    lastRequest: string;
  }>;
}

// ============================================
// TAB CONFIGURATION
// ============================================

const TAB_CONFIG: Array<{ key: DataQualityTab; label: string; icon: React.ReactNode }> = [
  { key: 'duplicates', label: 'Duplicate Detection', icon: <Copy size={16} /> },
  { key: 'metrics', label: 'Metrics & History', icon: <BarChart3 size={16} /> },
  { key: 'validation', label: 'Validation Errors', icon: <AlertTriangle size={16} /> },
  { key: 'rate-limits', label: 'Rate Limiting', icon: <Shield size={16} /> }
];

// ============================================
// CONFIDENCE THRESHOLD
// ============================================

const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

// ============================================
// HELPERS
// ============================================

function getConfidenceBadgeVariant(confidence: number): string {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return 'danger';
  if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) return 'warning';
  return 'info';
}

function getSeverityBadgeVariant(severity: string): string {
  const variantMap: Record<string, string> = {
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'neutral'
  };
  return variantMap[severity] || 'neutral';
}

function getMetricStatusVariant(status: string): string {
  const variantMap: Record<string, string> = {
    good: 'active',
    warning: 'warning',
    critical: 'danger'
  };
  return variantMap[status] || 'neutral';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function fetchWithAuth<T>(url: string, getAuthToken?: () => string | null, options?: RequestInit): Promise<T> {
  const token = getAuthToken?.();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const response = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }
  const json = await response.json();
  return unwrapApiData<T>(json);
}

// ============================================
// DUPLICATE DETECTION TAB
// ============================================

function DuplicateDetectionTab({
  getAuthToken,
  showNotification
}: Pick<DataQualityPanelProps, 'getAuthToken' | 'showNotification'>) {
  const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const loadDuplicates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<DuplicateRecord[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_HISTORY,
        getAuthToken
      );
      setDuplicates(data);
    } catch (err) {
      logger.error('Failed to load duplicates history:', err);
      showNotification?.('Failed to load duplicate history', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadDuplicates();
  }, [loadDuplicates]);

  const handleScan = useCallback(async () => {
    try {
      setScanning(true);
      const data = await fetchWithAuth<DuplicateRecord[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_SCAN,
        getAuthToken,
        { method: 'POST' }
      );
      setDuplicates(data);
      showNotification?.(`Scan complete. Found ${data.length} potential duplicate(s).`, 'success');
    } catch (err) {
      logger.error('Duplicate scan failed:', err);
      showNotification?.('Duplicate scan failed', 'error');
    } finally {
      setScanning(false);
    }
  }, [getAuthToken, showNotification]);

  const handleMerge = useCallback(async (duplicateId: string) => {
    try {
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_MERGE,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ duplicateId }) }
      );
      setDuplicates(prev => prev.map(d =>
        d.id === duplicateId ? { ...d, status: 'merged' as const } : d
      ));
      showNotification?.('Records merged successfully', 'success');
    } catch (err) {
      logger.error('Merge failed:', err);
      showNotification?.('Failed to merge records', 'error');
    }
  }, [getAuthToken, showNotification]);

  const handleDismiss = useCallback(async (duplicateId: string) => {
    try {
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_DUPLICATES_DISMISS,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ duplicateId }) }
      );
      setDuplicates(prev => prev.map(d =>
        d.id === duplicateId ? { ...d, status: 'dismissed' as const } : d
      ));
      showNotification?.('Duplicate dismissed', 'info');
    } catch (err) {
      logger.error('Dismiss failed:', err);
      showNotification?.('Failed to dismiss duplicate', 'error');
    }
  }, [getAuthToken, showNotification]);

  const pendingDuplicates = duplicates.filter(d => d.status === 'pending');

  return (
    <div className="portal-card">
      <div className="section-header-with-actions">
        <h3 className="section-title">Duplicate Detection</h3>
        <button
          className="btn btn-primary"
          onClick={handleScan}
          disabled={scanning}
        >
          <Play size={14} />
          {scanning ? 'Scanning...' : 'Run Duplicate Scan'}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading duplicates...</div>
      ) : pendingDuplicates.length === 0 ? (
        <div className="empty-state">No pending duplicates found.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity Type</th>
              <th>Record 1</th>
              <th>Record 2</th>
              <th>Confidence</th>
              <th>Match Fields</th>
              <th>Detected</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingDuplicates.map(dup => (
              <tr key={dup.id}>
                <td>
                  <span className="status-badge status-badge-info">{dup.entityType}</span>
                </td>
                <td>{dup.entity1Name}</td>
                <td>{dup.entity2Name}</td>
                <td>
                  <span className={`status-badge status-badge-${getConfidenceBadgeVariant(dup.confidence)}`}>
                    {Math.round(dup.confidence * 100)}%
                  </span>
                </td>
                <td>{dup.matchFields.join(', ')}</td>
                <td>{formatDate(dup.detectedAt)}</td>
                <td className="actions-cell">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleMerge(dup.id)}
                    title="Merge records"
                  >
                    <Merge size={14} />
                    Merge
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDismiss(dup.id)}
                    title="Dismiss duplicate"
                  >
                    <X size={14} />
                    Dismiss
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================
// METRICS & HISTORY TAB
// ============================================

function MetricsHistoryTab({
  getAuthToken,
  showNotification
}: Pick<DataQualityPanelProps, 'getAuthToken' | 'showNotification'>) {
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
        <div className="section-header-with-actions">
          <h3 className="section-title">Current Metrics</h3>
          <button
            className="btn btn-primary"
            onClick={handleRecalculate}
            disabled={calculating}
          >
            <RefreshCw size={14} />
            {calculating ? 'Calculating...' : 'Recalculate Metrics'}
          </button>
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
        <div className="section-header-with-actions">
          <h3 className="section-title">Metric History</h3>
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

// ============================================
// VALIDATION ERRORS TAB
// ============================================

function ValidationErrorsTab({
  getAuthToken,
  showNotification
}: Pick<DataQualityPanelProps, 'getAuthToken' | 'showNotification'>) {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorTypeFilter, setErrorTypeFilter] = useState('');

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<ValidationError[]>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_VALIDATION_ERRORS,
        getAuthToken
      );
      setErrors(data);
    } catch (err) {
      logger.error('Failed to load validation errors:', err);
      showNotification?.('Failed to load validation errors', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  const errorTypes = React.useMemo(() => {
    const types = new Set(errors.map(e => e.errorType));
    return Array.from(types).sort();
  }, [errors]);

  const filteredErrors = React.useMemo(() => {
    if (!errorTypeFilter) return errors;
    return errors.filter(e => e.errorType === errorTypeFilter);
  }, [errors, errorTypeFilter]);

  return (
    <div className="portal-card">
      <div className="section-header-with-actions">
        <h3 className="section-title">Validation Errors</h3>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <div className="filter-inline">
            <Filter size={14} />
            <select
              className="form-input"
              value={errorTypeFilter}
              onChange={e => setErrorTypeFilter(e.target.value)}
            >
              <option value="">All Error Types</option>
              {errorTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading validation errors...</div>
      ) : filteredErrors.length === 0 ? (
        <div className="empty-state">
          {errorTypeFilter ? 'No errors match the selected filter.' : 'No validation errors found.'}
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Entity Type</th>
              <th>Entity</th>
              <th>Error Type</th>
              <th>Message</th>
              <th>Severity</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {filteredErrors.map(error => (
              <tr key={error.id}>
                <td>{error.entityType}</td>
                <td>{error.entityName}</td>
                <td>
                  <span className="status-badge status-badge-neutral">{error.errorType}</span>
                </td>
                <td>{error.message}</td>
                <td>
                  <span className={`status-badge status-badge-${getSeverityBadgeVariant(error.severity)}`}>
                    {error.severity}
                  </span>
                </td>
                <td>{formatDate(error.detectedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================
// RATE LIMITING TAB
// ============================================

function RateLimitingTab({
  getAuthToken,
  showNotification
}: Pick<DataQualityPanelProps, 'getAuthToken' | 'showNotification'>) {
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockIp, setBlockIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [unblockIp, setUnblockIp] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchWithAuth<RateLimitStats>(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_RATE_LIMITS_STATS,
        getAuthToken
      );
      setStats(data);
    } catch (err) {
      logger.error('Failed to load rate limit stats:', err);
      showNotification?.('Failed to load rate limit stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showNotification]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleBlock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockIp.trim()) return;

    try {
      setActionLoading(true);
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_RATE_LIMITS_BLOCK,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ ip: blockIp.trim(), reason: blockReason.trim() }) }
      );
      showNotification?.(`IP ${blockIp} blocked successfully`, 'success');
      setBlockIp('');
      setBlockReason('');
      loadStats();
    } catch (err) {
      logger.error('Failed to block IP:', err);
      showNotification?.('Failed to block IP', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [blockIp, blockReason, getAuthToken, showNotification, loadStats]);

  const handleUnblock = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unblockIp.trim()) return;

    try {
      setActionLoading(true);
      await fetchWithAuth(
        API_ENDPOINTS.ADMIN.DATA_QUALITY_RATE_LIMITS_UNBLOCK,
        getAuthToken,
        { method: 'POST', body: JSON.stringify({ ip: unblockIp.trim() }) }
      );
      showNotification?.(`IP ${unblockIp} unblocked successfully`, 'success');
      setUnblockIp('');
      loadStats();
    } catch (err) {
      logger.error('Failed to unblock IP:', err);
      showNotification?.('Failed to unblock IP', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [unblockIp, getAuthToken, showNotification, loadStats]);

  if (loading) {
    return <div className="loading-state">Loading rate limit stats...</div>;
  }

  return (
    <>
      {stats && (
        <div className="portal-card">
          <div className="section-header-with-actions">
            <h3 className="section-title">Rate Limit Overview</h3>
            <button className="btn btn-secondary" onClick={loadStats}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalRequests.toLocaleString()}</div>
              <div className="stat-label">Total Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.blockedRequests.toLocaleString()}</div>
              <div className="stat-label">Blocked Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.activeBlocks}</div>
              <div className="stat-label">Active Blocks</div>
            </div>
          </div>

          {stats.topOffenders.length > 0 && (
            <>
              <h4 className="section-title" style={{ marginTop: 'var(--spacing-lg)' }}>Top Offenders</h4>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>IP Address</th>
                    <th>Request Count</th>
                    <th>Status</th>
                    <th>Last Request</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topOffenders.map(offender => (
                    <tr key={offender.ip}>
                      <td><code>{offender.ip}</code></td>
                      <td>{offender.requestCount.toLocaleString()}</td>
                      <td>
                        <span className={`status-badge status-badge-${offender.blocked ? 'danger' : 'active'}`}>
                          {offender.blocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td>{formatDate(offender.lastRequest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      <div className="portal-card">
        <h3 className="section-title">Block / Unblock IP</h3>

        <div className="rate-limit-forms">
          <form onSubmit={handleBlock} className="rate-limit-form">
            <h4 className="field-label">Block an IP Address</h4>
            <div className="form-group">
              <label className="field-label" htmlFor="block-ip">IP Address</label>
              <input
                id="block-ip"
                className="form-input"
                type="text"
                placeholder="e.g. 192.168.1.1"
                value={blockIp}
                onChange={e => setBlockIp(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="field-label" htmlFor="block-reason">Reason (optional)</label>
              <input
                id="block-reason"
                className="form-input"
                type="text"
                placeholder="Reason for blocking"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
              />
            </div>
            <button className="btn btn-danger" type="submit" disabled={actionLoading || !blockIp.trim()}>
              <Ban size={14} />
              Block IP
            </button>
          </form>

          <form onSubmit={handleUnblock} className="rate-limit-form">
            <h4 className="field-label">Unblock an IP Address</h4>
            <div className="form-group">
              <label className="field-label" htmlFor="unblock-ip">IP Address</label>
              <input
                id="unblock-ip"
                className="form-input"
                type="text"
                placeholder="e.g. 192.168.1.1"
                value={unblockIp}
                onChange={e => setUnblockIp(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-secondary" type="submit" disabled={actionLoading || !unblockIp.trim()}>
              <Unlock size={14} />
              Unblock IP
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

// ============================================
// MAIN PANEL
// ============================================

export function DataQualityPanel({ getAuthToken, showNotification, onNavigate }: DataQualityPanelProps) {
  const containerRef = useFadeIn();
  const [activeTab, setActiveTab] = useState<DataQualityTab>('duplicates');

  const sharedProps = { getAuthToken, showNotification, onNavigate };

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="data-quality-panel">
      <div className="view-toggle">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            className={`view-toggle-btn${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="data-quality-content">
        {activeTab === 'duplicates' && <DuplicateDetectionTab {...sharedProps} />}
        {activeTab === 'metrics' && <MetricsHistoryTab {...sharedProps} />}
        {activeTab === 'validation' && <ValidationErrorsTab {...sharedProps} />}
        {activeTab === 'rate-limits' && <RateLimitingTab {...sharedProps} />}
      </div>
    </div>
  );
}

export default DataQualityPanel;
