/**
 * ===============================================
 * PORTAL RETAINERS
 * ===============================================
 * @file src/react/features/portal/retainers/PortalRetainers.tsx
 *
 * Client-facing read-only view of their retainer agreements.
 * Displays a card per retainer with utilization progress,
 * rollover info, and period details.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Clock, RefreshCw, Calendar } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { useFadeIn } from '@react/hooks/useGsap';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatCurrency } from '@react/factories/formatters';
import type { PortalViewProps } from '../types';

// ============================================
// TYPES
// ============================================

interface RetainerPeriod {
  id: number;
  allocated_hours: number | null;
  used_hours: number;
  rollover_hours: number;
  total_available: number | null;
  period_start: string;
  period_end: string;
  status: string;
}

interface Retainer {
  id: number;
  retainer_type: string;
  status: string;
  monthly_hours: number | null;
  monthly_amount: number;
  rollover_enabled: number;
  max_rollover_hours: number | null;
  billing_day: number;
  clientName: string;
  projectName: string;
  currentPeriod?: RetainerPeriod;
}

export interface PortalRetainersProps extends PortalViewProps {}

// ============================================
// CONSTANTS
// ============================================

const TYPE_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  fixed_scope: 'Fixed Scope'
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

const UTILIZATION_GREEN_MAX = 0.6;
const UTILIZATION_YELLOW_MAX = 0.8;

// ============================================
// HELPERS
// ============================================

function getDaysRemaining(periodEnd: string): number {
  const end = new Date(periodEnd);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ============================================
// UTILIZATION BAR
// ============================================

function UtilizationBar({ used, total }: { used: number; total: number | null }) {
  if (total === null || total === 0) {
    return <span style={{ color: 'var(--app-color-text-muted)', fontSize: '0.85rem' }}>N/A</span>;
  }

  const ratio = used / total;
  const pct = Math.min(ratio * 100, 100);

  let barColor = 'var(--app-color-success)';
  if (ratio >= UTILIZATION_YELLOW_MAX) {
    barColor = 'var(--app-color-danger)';
  } else if (ratio >= UTILIZATION_GREEN_MAX) {
    barColor = 'var(--app-color-warning)';
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.85rem' }}>
          {used.toFixed(1)} of {total.toFixed(1)} hours used
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--app-color-text-muted)' }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: 10,
          borderRadius: 5,
          backgroundColor: 'var(--app-color-border)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 5,
            backgroundColor: barColor,
            transition: 'width 0.3s ease'
          }}
        />
      </div>
    </div>
  );
}

// ============================================
// RETAINER CARD
// ============================================

function RetainerCard({ retainer }: { retainer: Retainer }) {
  const period = retainer.currentPeriod;
  const daysRemaining = period ? getDaysRemaining(period.period_end) : 0;

  return (
    <div className="portal-card" style={{ padding: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem' }}>{retainer.projectName}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--app-color-text-muted)' }}>
            {TYPE_LABELS[retainer.retainer_type] ?? retainer.retainer_type}
          </span>
        </div>
        <StatusBadge status={getStatusVariant(retainer.status)}>
          {STATUS_LABELS[retainer.status] ?? retainer.status}
        </StatusBadge>
      </div>

      {/* Monthly Amount */}
      <div className="stat-card" style={{ marginBottom: '1rem' }}>
        <span className="stat-label">Monthly Amount</span>
        <span className="stat-value">{formatCurrency(retainer.monthly_amount)}</span>
      </div>

      {/* Utilization */}
      {period && (
        <div style={{ marginBottom: '1rem' }}>
          <UtilizationBar used={period.used_hours} total={period.total_available} />
        </div>
      )}

      {/* Meta info row */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--app-color-text-muted)' }}>
        {/* Rollover */}
        {retainer.rollover_enabled === 1 && period && period.rollover_hours > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={14} />
            <span>{period.rollover_hours.toFixed(1)}h rollover</span>
          </div>
        )}

        {/* Days remaining */}
        {period && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={14} />
            <span>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
          </div>
        )}

        {/* Billing day */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Clock size={14} />
          <span>Bills on day {retainer.billing_day}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PortalRetainers(_props: PortalRetainersProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  const { data, isLoading, error, refetch } = usePortalData<{ retainers: Retainer[] }>({
    url: API_ENDPOINTS.RETAINERS_MY ?? '/api/retainers/my',
    transform: (raw) => raw as { retainers: Retainer[] }
  });

  const retainers = useMemo(() => data?.retainers ?? [], [data]);

  if (isLoading) return <div ref={containerRef}><LoadingState message="Loading retainers..." /></div>;
  if (error) return <div ref={containerRef}><ErrorState message={error} onRetry={refetch} /></div>;
  if (retainers.length === 0) {
    return <div ref={containerRef}><EmptyState message="No retainer agreements yet." /></div>;
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {retainers.map((retainer) => (
        <RetainerCard key={retainer.id} retainer={retainer} />
      ))}
    </div>
  );
}
