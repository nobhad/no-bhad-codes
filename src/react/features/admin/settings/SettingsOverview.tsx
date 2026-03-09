/**
 * SettingsOverview
 * Lightweight snapshot cards for each settings subtab.
 * No tables, no pagination — just key stats and recent items.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CreditCard,
  GitBranch,
  Mail,
  Shield,
  Activity,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { LoadingState } from '@react/factories';
import { apiFetch, unwrapApiData } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatTimeAgo } from '@/utils/time-utils';

interface SettingsOverviewProps {
  getAuthToken?: () => string | null;
  onSubtabNavigate?: (subtab: string) => void;
}

interface OverviewData {
  config: { businessName: string; ownerName: string; email: string; website: string; venmo: string; zelle: string; paypal: string } | null;
  workflows: { total: number; active: number; inactive: number; items: Array<{ name: string; status: string; trigger: string }> };
  templates: { total: number; active: number; inactive: number; items: Array<{ name: string; category: string; is_active: boolean }> };
  auditLog: { total: number; items: Array<{ action: string; user_email: string; entity_type: string; created_at: string }> };
  systemStatus: { status: string; services: number; healthy: number };
}

const INITIAL_DATA: OverviewData = {
  config: null,
  workflows: { total: 0, active: 0, inactive: 0, items: [] },
  templates: { total: 0, active: 0, inactive: 0, items: [] },
  auditLog: { total: 0, items: [] },
  systemStatus: { status: 'operational', services: 0, healthy: 0 }
};

export function SettingsOverview({ onSubtabNavigate }: SettingsOverviewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const [data, setData] = useState<OverviewData>(INITIAL_DATA);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [configRes, workflowsRes, templatesRes, auditRes, statusRes] = await Promise.allSettled([
        apiFetch(API_ENDPOINTS.ADMIN.SETTINGS_BUSINESS_INFO),
        apiFetch(API_ENDPOINTS.ADMIN.WORKFLOWS),
        apiFetch(API_ENDPOINTS.ADMIN.EMAIL_TEMPLATES),
        apiFetch(`${API_ENDPOINTS.ADMIN.AUDIT_LOG}?limit=5`),
        apiFetch(API_ENDPOINTS.ADMIN.SYSTEM_STATUS)
      ]);

      const next = { ...INITIAL_DATA };

      if (configRes.status === 'fulfilled' && configRes.value.ok) {
        const raw = unwrapApiData<Record<string, unknown>>(await configRes.value.json());
        const cfg = (raw.config ?? raw) as Record<string, string>;
        next.config = {
          businessName: cfg.business_name || cfg.businessName || '',
          ownerName: cfg.owner_name || cfg.ownerName || '',
          email: cfg.email || '',
          website: cfg.website || '',
          venmo: cfg.venmo_handle || cfg.venmo || '',
          zelle: cfg.zelle_email || cfg.zelle || '',
          paypal: cfg.paypal_email || cfg.paypal || ''
        };
      }

      if (workflowsRes.status === 'fulfilled' && workflowsRes.value.ok) {
        const raw = unwrapApiData<Record<string, unknown>>(await workflowsRes.value.json());
        const items = (raw.workflows ?? raw.items ?? []) as Array<{ name: string; status: string; trigger: string }>;
        const stats = (raw.stats ?? {}) as Record<string, number>;
        next.workflows = {
          total: stats.total ?? items.length,
          active: stats.active ?? items.filter(w => w.status === 'active').length,
          inactive: stats.inactive ?? items.filter(w => w.status === 'inactive').length,
          items: items.slice(0, 5)
        };
      }

      if (templatesRes.status === 'fulfilled' && templatesRes.value.ok) {
        const raw = unwrapApiData<Record<string, unknown>>(await templatesRes.value.json());
        const items = (raw.templates ?? raw.items ?? []) as Array<{ name: string; category: string; is_active: boolean }>;
        const stats = (raw.stats ?? {}) as Record<string, number>;
        next.templates = {
          total: stats.total ?? items.length,
          active: stats.active ?? items.filter(t => t.is_active).length,
          inactive: (stats.total ?? items.length) - (stats.active ?? items.filter(t => t.is_active).length),
          items: items.slice(0, 5)
        };
      }

      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const raw = unwrapApiData<Record<string, unknown>>(await auditRes.value.json());
        const items = (raw.entries ?? raw.items ?? []) as OverviewData['auditLog']['items'];
        next.auditLog = {
          total: (raw.total as number) ?? items.length,
          items: items.slice(0, 5)
        };
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const raw = unwrapApiData<Record<string, unknown>>(await statusRes.value.json());
        const services = (raw.services ?? []) as Array<{ status: string }>;
        const healthy = services.filter(s => s.status === 'operational' || s.status === 'healthy').length;
        next.systemStatus = {
          status: (raw.overallStatus as string) ?? (healthy === services.length ? 'operational' : 'degraded'),
          services: services.length,
          healthy
        };
      }

      setData(next);
    } catch {
      // Partial data is fine — cards will show what loaded
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (isLoading) {
    return <LoadingState message="Loading settings overview..." />;
  }

  return (
    <div ref={containerRef} className="settings-overview">
      {/* Top row: Config + System Status */}
      <div className="settings-overview-row">
        <SnapshotCard
          title="Configuration"
          icon={<Building2 />}
          onViewAll={() => onSubtabNavigate?.('configuration')}
        >
          {data.config ? (
            <div className="snapshot-fields">
              <SnapshotField label="Business" value={data.config.businessName} />
              <SnapshotField label="Owner" value={data.config.ownerName} />
              <SnapshotField label="Email" value={data.config.email} />
              <SnapshotField label="Website" value={data.config.website} />
              <div className="snapshot-divider" />
              <div className="snapshot-section-label">
                <CreditCard className="icon-xs" />
                Payment Methods
              </div>
              <SnapshotField label="Venmo" value={data.config.venmo} />
              <SnapshotField label="Zelle" value={data.config.zelle} />
              <SnapshotField label="PayPal" value={data.config.paypal} />
            </div>
          ) : (
            <span className="text-muted">Not configured</span>
          )}
        </SnapshotCard>

        <SnapshotCard
          title="System Health"
          icon={<Activity />}
          onViewAll={() => onSubtabNavigate?.('system-health')}
          badge={
            <StatusBadge status={data.systemStatus.status === 'operational' ? 'completed' : 'pending'} size="sm">
              {data.systemStatus.status === 'operational' ? 'Operational' : 'Degraded'}
            </StatusBadge>
          }
        >
          <div className="snapshot-stat-row">
            <span className="snapshot-stat">
              <span className="snapshot-stat-value">{data.systemStatus.services}</span>
              <span className="snapshot-stat-label">Services</span>
            </span>
            <span className="snapshot-stat">
              <span className="snapshot-stat-value">{data.systemStatus.healthy}</span>
              <span className="snapshot-stat-label">Healthy</span>
            </span>
          </div>
        </SnapshotCard>
      </div>

      {/* Middle row: Workflows + Email Templates */}
      <div className="settings-overview-row">
        <SnapshotCard
          title="Workflows"
          icon={<GitBranch />}
          onViewAll={() => onSubtabNavigate?.('workflows')}
          badge={
            <span className="snapshot-count">{data.workflows.total} total</span>
          }
        >
          <div className="snapshot-stat-row">
            <span className="snapshot-stat">
              <span className="snapshot-stat-value">{data.workflows.active}</span>
              <span className="snapshot-stat-label">Active</span>
            </span>
            <span className="snapshot-stat">
              <span className="snapshot-stat-value">{data.workflows.inactive}</span>
              <span className="snapshot-stat-label">Inactive</span>
            </span>
          </div>
          {data.workflows.items.length > 0 && (
            <ul className="snapshot-list">
              {data.workflows.items.map((w, i) => (
                <li key={i} className="snapshot-list-item">
                  <span className="snapshot-list-name">{w.name}</span>
                  <StatusBadge status={getStatusVariant(w.status)} size="sm">
                    {w.status === 'active' ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SnapshotCard>

        <SnapshotCard
          title="Email Templates"
          icon={<Mail />}
          onViewAll={() => onSubtabNavigate?.('email-templates')}
          badge={
            <span className="snapshot-count">{data.templates.total} total</span>
          }
        >
          <div className="snapshot-stat-row">
            <span className="snapshot-stat">
              <span className="snapshot-stat-value">{data.templates.active}</span>
              <span className="snapshot-stat-label">Active</span>
            </span>
            <span className="snapshot-stat">
              <span className="snapshot-stat-value">{data.templates.inactive}</span>
              <span className="snapshot-stat-label">Inactive</span>
            </span>
          </div>
          {data.templates.items.length > 0 && (
            <ul className="snapshot-list">
              {data.templates.items.map((t, i) => (
                <li key={i} className="snapshot-list-item">
                  <span className="snapshot-list-name">{t.name}</span>
                  {t.is_active ? (
                    <CheckCircle className="icon-xs snapshot-icon-success" />
                  ) : (
                    <XCircle className="icon-xs snapshot-icon-muted" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </SnapshotCard>
      </div>

      {/* Audit Log */}
      <SnapshotCard
        title="Audit Log"
        icon={<Shield />}
        onViewAll={() => onSubtabNavigate?.('audit-log')}
        badge={
          <span className="snapshot-count">{data.auditLog.total} entries</span>
        }
      >
        {data.auditLog.items.length > 0 ? (
          <ul className="snapshot-list">
            {data.auditLog.items.map((entry, i) => (
              <li key={i} className="snapshot-list-item">
                <span className="snapshot-list-name">
                  <StatusBadge status={getStatusVariant(entry.action)} size="sm">
                    {entry.action}
                  </StatusBadge>
                  <span className="snapshot-list-detail">
                    {entry.entity_type} by {entry.user_email}
                  </span>
                </span>
                <span className="snapshot-list-time">{formatTimeAgo(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">No recent activity</span>
        )}
      </SnapshotCard>
    </div>
  );
}

/* ---- Sub-components ---- */

function SnapshotCard({ title, icon, badge, onViewAll, children }: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  onViewAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="snapshot-card">
      <div className="snapshot-card-header">
        <div className="snapshot-card-title">
          {icon}
          <span className="field-label">{title}</span>
          {badge}
        </div>
        {onViewAll && (
          <button onClick={onViewAll} className="overview-panel-action">
            View <ArrowRight className="panel-icon" />
          </button>
        )}
      </div>
      <div className="snapshot-card-body">
        {children}
      </div>
    </div>
  );
}

function SnapshotField({ label, value }: { label: string; value: string }) {
  return (
    <div className="snapshot-field">
      <span className="snapshot-field-label">{label}</span>
      <span className="snapshot-field-value">{value || 'Not set'}</span>
    </div>
  );
}
