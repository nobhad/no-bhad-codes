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
import { getUtilizationColorClass } from '@react/utils/utilization';
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
    return <span className="text-muted text-sm">N/A</span>;
  }

  const ratio = used / total;
  const pct = Math.min(ratio * 100, 100);
  const fillClass = getUtilizationColorClass(ratio);

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm">
          {used.toFixed(1)} of {total.toFixed(1)} hours used
        </span>
        <span className="text-sm text-muted">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="progress-bar progress-sm">
        <div
          className={`progress-fill ${fillClass}`}
          style={{ width: `${pct}%` }}
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
    <div className="portal-card p-3">
      {/* Header */}
      <div className="portal-card-header">
        <div>
          <h3>{retainer.projectName}</h3>
          <span className="text-sm text-muted">
            {TYPE_LABELS[retainer.retainer_type] ?? retainer.retainer_type}
          </span>
        </div>
        <StatusBadge status={getStatusVariant(retainer.status)}>
          {STATUS_LABELS[retainer.status] ?? retainer.status}
        </StatusBadge>
      </div>

      {/* Monthly Amount */}
      <div className="stat-card mb-4">
        <span className="stat-label">Monthly Amount</span>
        <span className="stat-value">{formatCurrency(retainer.monthly_amount)}</span>
      </div>

      {/* Utilization */}
      {period && (
        <div className="mb-4">
          <UtilizationBar used={period.used_hours} total={period.total_available} />
        </div>
      )}

      {/* Meta info row */}
      <div className="portal-card-meta text-sm">
        {/* Rollover */}
        {retainer.rollover_enabled === 1 && period && period.rollover_hours > 0 && (
          <div className="portal-card-meta-item">
            <RefreshCw size={14} />
            <span>{period.rollover_hours.toFixed(1)}h rollover</span>
          </div>
        )}

        {/* Days remaining */}
        {period && (
          <div className="portal-card-meta-item">
            <Calendar size={14} />
            <span>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
          </div>
        )}

        {/* Billing day */}
        <div className="portal-card-meta-item">
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
    <div ref={containerRef} className="portal-cards-list">
      {retainers.map((retainer) => (
        <RetainerCard key={retainer.id} retainer={retainer} />
      ))}
    </div>
  );
}
