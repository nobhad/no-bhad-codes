import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Server,
  Database,
  Cloud,
  Mail,
  CreditCard,
  HardDrive,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Wifi,
  Shield,
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';

interface ServiceStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'outage' | 'maintenance';
  latency?: number;
  uptime: number;
  lastCheck: string;
  icon: string;
}

interface SystemMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
}

interface Incident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startedAt: string;
  resolvedAt?: string;
  affectedServices: string[];
}

interface SystemStatusData {
  services: ServiceStatus[];
  metrics: SystemMetric[];
  incidents: Incident[];
  overallStatus: 'operational' | 'degraded' | 'outage';
  lastUpdated: string;
}

interface SystemStatusPanelProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  server: <Server className="tw-h-5 tw-w-5" />,
  database: <Database className="tw-h-5 tw-w-5" />,
  cloud: <Cloud className="tw-h-5 tw-w-5" />,
  mail: <Mail className="tw-h-5 tw-w-5" />,
  payment: <CreditCard className="tw-h-5 tw-w-5" />,
  storage: <HardDrive className="tw-h-5 tw-w-5" />,
  api: <Wifi className="tw-h-5 tw-w-5" />,
  auth: <Shield className="tw-h-5 tw-w-5" />,
};

export function SystemStatusPanel({ onNavigate, getAuthToken, showNotification }: SystemStatusPanelProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SystemStatusData>({
    services: [],
    metrics: [],
    incidents: [],
    overallStatus: 'operational',
    lastUpdated: new Date().toISOString(),
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/system-status', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load system status');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system status');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadStatus();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(loadStatus, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadStatus]);

  function getStatusColor(status: string): string {
    switch (status) {
      case 'operational':
      case 'good':
      case 'resolved':
        return 'var(--status-completed)';
      case 'degraded':
      case 'warning':
      case 'monitoring':
      case 'identified':
        return 'var(--status-pending)';
      case 'outage':
      case 'critical':
      case 'investigating':
        return 'var(--status-cancelled)';
      case 'maintenance':
        return 'var(--status-active)';
      default:
        return 'var(--portal-text-muted)';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'operational':
      case 'good':
      case 'resolved':
        return <CheckCircle className="tw-h-4 tw-w-4" />;
      case 'degraded':
      case 'warning':
      case 'monitoring':
      case 'identified':
        return <AlertCircle className="tw-h-4 tw-w-4" />;
      case 'outage':
      case 'critical':
      case 'investigating':
        return <XCircle className="tw-h-4 tw-w-4" />;
      case 'maintenance':
        return <Clock className="tw-h-4 tw-w-4" />;
      default:
        return <Activity className="tw-h-4 tw-w-4" />;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="tw-section">
      {/* Header */}
      <div className="status-panel-header">
        <div className="status-panel-header-left">
          <div className="tw-badge status-panel-badge">
            <span style={{ color: getStatusColor(data.overallStatus) }}>
              {getStatusIcon(data.overallStatus)}
            </span>
            <span className="status-text-capitalize">
              {data.overallStatus === 'operational' ? 'All Systems Operational' : `System ${data.overallStatus}`}
            </span>
          </div>
          <span className="tw-text-muted status-panel-last-update">
            Last updated: {formatDate(data.lastUpdated)}
          </span>
        </div>
        <div className="status-panel-header-right">
          <label className="tw-text-muted status-panel-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="tw-checkbox"
            />
            Auto-refresh
          </label>
          <button className="tw-btn-secondary" onClick={loadStatus} disabled={isLoading}>
            <RefreshCw className={cn('status-panel-refresh-icon', isLoading && 'status-panel-refresh-icon-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <button className="tw-btn-secondary status-retry-btn" onClick={loadStatus}>
            Retry
          </button>
        </div>
      )}

      {/* Services Grid */}
      <div>
        <h3 className="tw-section-title status-section-title">Services</h3>
        <div className="tw-grid-stats tw-grid-4-cols">
          {data.services.map((service) => (
            <div key={service.id} className="tw-stat-card">
              <div className="status-service-header">
                <div className="status-service-title-row">
                  <span className="tw-text-muted">
                    {SERVICE_ICONS[service.icon] || <Server className="status-service-icon" />}
                  </span>
                  <span className="status-service-name">{service.name}</span>
                </div>
                <span style={{ color: getStatusColor(service.status) }}>
                  {getStatusIcon(service.status)}
                </span>
              </div>
              <div className="status-service-details">
                <div className="status-service-row">
                  <span className="tw-text-muted">Status</span>
                  <span className="status-text-capitalize" style={{ color: getStatusColor(service.status) }}>
                    {service.status}
                  </span>
                </div>
                {service.latency !== undefined && (
                  <div className="status-service-row">
                    <span className="tw-text-muted">Latency</span>
                    <span>{service.latency}ms</span>
                  </div>
                )}
                <div className="status-service-row">
                  <span className="tw-text-muted">Uptime</span>
                  <span>{service.uptime}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div>
        <h3 className="tw-section-title status-section-title">System Metrics</h3>
        <div className="tw-grid-stats tw-grid-4-cols">
          {data.metrics.map((metric) => (
            <div key={metric.id} className="tw-stat-card">
              <div className="status-metric-header">
                <span className="tw-stat-label">{metric.name}</span>
                <span style={{ color: getStatusColor(metric.status) }}>
                  {getStatusIcon(metric.status)}
                </span>
              </div>
              <div className="tw-stat-value status-metric-value">
                {metric.value}{metric.unit}
              </div>
              <div className="tw-progress-track">
                <div
                  className="tw-progress-bar"
                  style={{
                    width: `${Math.min((metric.value / metric.threshold) * 100, 100)}%`,
                    backgroundColor: getStatusColor(metric.status),
                  }}
                />
              </div>
              <div className="tw-text-muted status-metric-threshold">
                Threshold: {metric.threshold}{metric.unit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Incidents */}
      {data.incidents.length > 0 && (
        <div>
          <h3 className="tw-section-title status-section-title">Recent Incidents</h3>
          <div className="status-incidents-list">
            {data.incidents.map((incident) => (
              <div key={incident.id} className="tw-card">
                <div className="status-incident-row">
                  <div className="status-incident-content">
                    <div className="status-incident-title-row">
                      <span className="tw-badge status-incident-severity">
                        {incident.severity}
                      </span>
                      <span className="status-incident-title">
                        {incident.title}
                      </span>
                    </div>
                    <div className="tw-text-muted status-incident-meta">
                      <span>Started: {formatDate(incident.startedAt)}</span>
                      {incident.resolvedAt && (
                        <span>Resolved: {formatDate(incident.resolvedAt)}</span>
                      )}
                      <span>Affected: {incident.affectedServices.join(', ')}</span>
                    </div>
                  </div>
                  <div className="status-incident-status">
                    <span style={{ color: getStatusColor(incident.status) }}>
                      {getStatusIcon(incident.status)}
                    </span>
                    <span className="status-incident-status-text" style={{ color: getStatusColor(incident.status) }}>
                      {incident.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemStatusPanel;
