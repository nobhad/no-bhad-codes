import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
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
  Shield
} from 'lucide-react';
import { cn } from '@react/lib/utils';
import { useFadeIn } from '@react/hooks/useGsap';
import { Checkbox } from '@react/components/ui/checkbox';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TIMING } from '../../../../constants/timing';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

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
  server: <Server className="icon-lg" />,
  database: <Database className="icon-lg" />,
  cloud: <Cloud className="icon-lg" />,
  mail: <Mail className="icon-lg" />,
  payment: <CreditCard className="icon-lg" />,
  storage: <HardDrive className="icon-lg" />,
  api: <Wifi className="icon-lg" />,
  auth: <Shield className="icon-lg" />
};

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
    return <CheckCircle className="icon-md" />;
  case 'degraded':
  case 'warning':
  case 'monitoring':
  case 'identified':
    return <AlertCircle className="icon-md" />;
  case 'outage':
  case 'critical':
  case 'investigating':
    return <XCircle className="icon-md" />;
  case 'maintenance':
    return <Clock className="icon-md" />;
  default:
    return <Activity className="icon-md" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function SystemStatusPanel({ onNavigate: _onNavigate, getAuthToken, showNotification }: SystemStatusPanelProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [data, setData] = useState<SystemStatusData>({
    services: [],
    metrics: [],
    incidents: [],
    overallStatus: 'operational',
    lastUpdated: new Date().toISOString()
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  const loadStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.SYSTEM_STATUS, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load system status');
      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setData({
        services: Array.isArray(payload.services) ? payload.services : [],
        metrics: Array.isArray(payload.metrics) ? payload.metrics : [],
        incidents: Array.isArray(payload.incidents) ? payload.incidents : [],
        overallStatus: (payload.overallStatus as SystemStatusData['overallStatus']) || 'operational',
        lastUpdated: (payload.lastUpdated as string) || new Date().toISOString()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system status');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  const handleClearCache = useCallback(async () => {
    setIsClearingCache(true);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.CACHE_CLEAR, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to clear cache');
      showNotification?.('Cache cleared successfully', 'success');
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : 'Failed to clear cache', 'error');
    } finally {
      setIsClearingCache(false);
    }
  }, [getHeaders, showNotification]);

  const handleTestEmail = useCallback(async () => {
    setIsSendingTestEmail(true);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.TEST_EMAIL, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to send test email');
      const payload = unwrapApiData<{ to: string }>(await response.json());
      showNotification?.(`Test email sent to ${payload.to}`, 'success');
    } catch (err) {
      showNotification?.(err instanceof Error ? err.message : 'Failed to send test email', 'error');
    } finally {
      setIsSendingTestEmail(false);
    }
  }, [getHeaders, showNotification]);

  useEffect(() => {
    loadStatus();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(loadStatus, TIMING.STATUS_REFRESH);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, loadStatus]);

  const overallLabel = data.overallStatus === 'operational'
    ? 'All Systems Operational'
    : `System ${data.overallStatus}`;

  return (
    <TableLayout
      containerRef={containerRef as React.Ref<HTMLDivElement>}
      title="SYSTEM STATUS"
      stats={
        <TableStats items={[
          { value: overallLabel, label: '', variant: data.overallStatus === 'operational' ? 'completed' : 'pending' },
          { value: data.services.length, label: 'services' },
          { value: data.incidents.length, label: 'incidents', variant: 'pending', hideIfZero: true }
        ]} />
      }
      actions={
        <>
          <IconButton
            icon="trash-2"
            onClick={handleClearCache}
            title="Clear Cache"
            loading={isClearingCache}
            disabled={isClearingCache}
          />
          <IconButton
            icon="send"
            onClick={handleTestEmail}
            title="Test Email"
            loading={isSendingTestEmail}
            disabled={isSendingTestEmail}
          />
          <label className="status-auto-refresh-label">
            <Checkbox
              checked={autoRefresh}
              onCheckedChange={(checked) => setAutoRefresh(checked === true)}
            />
            <span className="status-auto-refresh-text">Auto-refresh</span>
          </label>
          <IconButton action="refresh" onClick={loadStatus} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading system status..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadStatus} />
      ) : (
        <div className="status-content">
          {/* Services */}
          {data.services.length > 0 && (
            <div className="status-section">
              <h4 className="status-section-title">Services</h4>
              <div className="status-services-grid">
                {data.services.map((service) => (
                  <div key={service.id} className="status-service-card">
                    <div className="status-service-header">
                      <div className="status-service-name-row">
                        <span className="status-service-icon" style={{ color: getStatusColor(service.status) }}>
                          {SERVICE_ICONS[service.icon] || <Server className="icon-lg" />}
                        </span>
                        <span className="status-service-name">{service.name}</span>
                      </div>
                      <span style={{ color: getStatusColor(service.status) }}>
                        {getStatusIcon(service.status)}
                      </span>
                    </div>
                    <div className="status-service-details">
                      <div className="status-detail-row">
                        <span className="status-detail-label">Status</span>
                        <span className="status-text-capitalize" style={{ color: getStatusColor(service.status) }}>
                          {service.status}
                        </span>
                      </div>
                      {service.latency !== undefined && (
                        <div className="status-detail-row">
                          <span className="status-detail-label">Latency</span>
                          <span>{service.latency}ms</span>
                        </div>
                      )}
                      <div className="status-detail-row">
                        <span className="status-detail-label">Uptime</span>
                        <span>{service.uptime}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          {data.metrics.length > 0 && (
            <div className="status-section">
              <h4 className="status-section-title">System Metrics</h4>
              <div className="status-metrics-grid">
                {data.metrics.map((metric) => (
                  <div key={metric.id} className="status-metric-card">
                    <div className="status-metric-header">
                      <span className="status-metric-name">{metric.name}</span>
                      <span style={{ color: getStatusColor(metric.status) }}>
                        {getStatusIcon(metric.status)}
                      </span>
                    </div>
                    <div className="status-metric-value">
                      {metric.value}{metric.unit}
                    </div>
                    <div className="status-progress-track">
                      <div
                        className="status-progress-bar"
                        style={{
                          width: `${Math.min((metric.value / metric.threshold) * 100, 100)}%`,
                          backgroundColor: getStatusColor(metric.status)
                        }}
                      />
                    </div>
                    <span className="status-metric-threshold">
                      Threshold: {metric.threshold}{metric.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Incidents */}
          {data.incidents.length > 0 && (
            <div className="status-section">
              <h4 className="status-section-title">Recent Incidents</h4>
              <div className="status-incidents-list">
                {data.incidents.map((incident) => (
                  <div key={incident.id} className="status-incident-card">
                    <div className="status-incident-main">
                      <div className="status-incident-info">
                        <span className={cn('status-incident-severity', `severity-${incident.severity}`)}>
                          {incident.severity}
                        </span>
                        <span className="status-incident-title">{incident.title}</span>
                      </div>
                      <div className="status-incident-meta">
                        <span>Started: {formatDate(incident.startedAt)}</span>
                        {incident.resolvedAt && <span>Resolved: {formatDate(incident.resolvedAt)}</span>}
                        <span>Affected: {incident.affectedServices.join(', ')}</span>
                      </div>
                    </div>
                    <div className="status-incident-status" style={{ color: getStatusColor(incident.status) }}>
                      {getStatusIcon(incident.status)}
                      <span className="status-text-capitalize">{incident.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when no services or metrics */}
          {data.services.length === 0 && data.metrics.length === 0 && data.incidents.length === 0 && (
            <div className="status-empty">
              <CheckCircle className="icon-lg" style={{ color: 'var(--status-completed)' }} />
              <span>All systems operational. No services to display.</span>
            </div>
          )}
        </div>
      )}
    </TableLayout>
  );
}

export default SystemStatusPanel;
