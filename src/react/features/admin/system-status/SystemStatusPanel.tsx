import * as React from 'react';
import { useState, useEffect } from 'react';
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

export function SystemStatusPanel({ onNavigate }: SystemStatusPanelProps) {
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

  useEffect(() => {
    loadStatus();
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(loadStatus, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  async function loadStatus() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/system-status');
      if (!response.ok) throw new Error('Failed to load system status');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system status');
    } finally {
      setIsLoading(false);
    }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="tw-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
            <span style={{ color: getStatusColor(data.overallStatus) }}>
              {getStatusIcon(data.overallStatus)}
            </span>
            <span style={{ textTransform: 'capitalize' }}>
              {data.overallStatus === 'operational' ? 'All Systems Operational' : `System ${data.overallStatus}`}
            </span>
          </div>
          <span className="tw-text-muted" style={{ fontSize: '12px' }}>
            Last updated: {formatDate(data.lastUpdated)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px' }} className="tw-text-muted">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="tw-checkbox"
            />
            Auto-refresh
          </label>
          <button className="tw-btn-secondary" onClick={loadStatus} disabled={isLoading}>
            <RefreshCw style={{ width: '1rem', height: '1rem', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tw-error">
          {error}
          <button className="tw-btn-secondary" onClick={loadStatus} style={{ marginLeft: '1rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Services Grid */}
      <div>
        <h3 className="tw-section-title" style={{ marginBottom: '1rem' }}>Services</h3>
        <div className="tw-grid-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {data.services.map((service) => (
            <div key={service.id} className="tw-stat-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="tw-text-muted">
                    {SERVICE_ICONS[service.icon] || <Server style={{ width: '1.25rem', height: '1.25rem' }} />}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>{service.name}</span>
                </div>
                <span style={{ color: getStatusColor(service.status) }}>
                  {getStatusIcon(service.status)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="tw-text-muted">Status</span>
                  <span style={{ textTransform: 'capitalize', color: getStatusColor(service.status) }}>
                    {service.status}
                  </span>
                </div>
                {service.latency !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="tw-text-muted">Latency</span>
                    <span>{service.latency}ms</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
        <h3 className="tw-section-title" style={{ marginBottom: '1rem' }}>System Metrics</h3>
        <div className="tw-grid-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {data.metrics.map((metric) => (
            <div key={metric.id} className="tw-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="tw-stat-label">{metric.name}</span>
                <span style={{ color: getStatusColor(metric.status) }}>
                  {getStatusIcon(metric.status)}
                </span>
              </div>
              <div className="tw-stat-value" style={{ marginBottom: '0.5rem' }}>
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
              <div className="tw-text-muted" style={{ fontSize: '11px', marginTop: '0.25rem' }}>
                Threshold: {metric.threshold}{metric.unit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Incidents */}
      {data.incidents.length > 0 && (
        <div>
          <h3 className="tw-section-title" style={{ marginBottom: '1rem' }}>Recent Incidents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.incidents.map((incident) => (
              <div key={incident.id} className="tw-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span className="tw-badge" style={{ textTransform: 'uppercase' }}>
                        {incident.severity}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>
                        {incident.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '12px' }} className="tw-text-muted">
                      <span>Started: {formatDate(incident.startedAt)}</span>
                      {incident.resolvedAt && (
                        <span>Resolved: {formatDate(incident.resolvedAt)}</span>
                      )}
                      <span>Affected: {incident.affectedServices.join(', ')}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: getStatusColor(incident.status) }}>
                      {getStatusIcon(incident.status)}
                    </span>
                    <span style={{ fontSize: '12px', textTransform: 'capitalize', color: getStatusColor(incident.status) }}>
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
