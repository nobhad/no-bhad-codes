/**
 * ===============================================
 * AGREEMENTS LIST
 * ===============================================
 * @file src/react/features/portal/agreements/AgreementsList.tsx
 *
 * Client-facing list of their agreements.
 */

import * as React from 'react';
import { useCallback } from 'react';
import { FileCheck, ArrowRight } from 'lucide-react';
import { usePortalData } from '../../../hooks/usePortalFetch';
import { useFadeIn } from '../../../hooks/useGsap';
import { LoadingState, EmptyState, ErrorState } from '../../../components/portal/EmptyState';
import { StatusBadge } from '../../../components/portal/StatusBadge';
import { StatusIcon } from '../../../components/portal/StatusIcon';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import type { Agreement, AgreementsListProps } from './types';
import type { StatusVariant } from '../../../components/portal/StatusBadge';

// ============================================
// HELPERS
// ============================================

const STATUS_VARIANT_MAP: Record<string, StatusVariant> = {
  completed: 'completed',
  in_progress: 'active',
  viewed: 'active',
  sent: 'pending',
  draft: 'pending',
  cancelled: 'cancelled',
  expired: 'inactive'
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  sent: 'Awaiting Review',
  viewed: 'In Progress',
  draft: 'Draft',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

// ============================================
// COMPONENT
// ============================================

export function AgreementsList({
  getAuthToken,
  onNavigate
}: AgreementsListProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const { data, isLoading, error } = usePortalData<{ agreements: Agreement[] }>({
    getAuthToken,
    url: API_ENDPOINTS.AGREEMENTS_MY,
    transform: (raw) => raw as { agreements: Agreement[] }
  });

  const agreements = data?.agreements || [];

  const handleOpen = useCallback((id: number) => {
    onNavigate?.('agreements', String(id));
  }, [onNavigate]);

  if (isLoading) {
    return <div ref={containerRef}><LoadingState message="Loading agreements..." /></div>;
  }

  if (error) {
    return <div ref={containerRef}><ErrorState message={error} /></div>;
  }

  if (agreements.length === 0) {
    return (
      <div ref={containerRef}>
        <EmptyState
          icon={<FileCheck className="icon-lg" />}
          message="No agreements yet"
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="card-list">
      {agreements.map((agreement) => {
        const completedSteps = agreement.steps?.filter((s) => s.status === 'completed').length || 0;
        const totalSteps = agreement.steps?.length || 0;
        const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
        const isActionable = ['sent', 'viewed', 'in_progress'].includes(agreement.status);
        const variant = STATUS_VARIANT_MAP[agreement.status] || 'pending';

        return (
          <div
            key={agreement.id}
            className="portal-card clickable"
            onClick={() => handleOpen(agreement.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleOpen(agreement.id); }}
          >
            <div className="portal-card-header">
              <span>{agreement.name}</span>
              <div className="action-group">
                {<StatusIcon status={agreement.status} />}
                <StatusBadge status={variant} size="sm">
                  {STATUS_LABELS[agreement.status] || agreement.status}
                </StatusBadge>
              </div>
            </div>

            {totalSteps > 0 && (
              <div className="portal-card-body">
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-muted text-sm">
                  {completedSteps} of {totalSteps} steps
                </span>
              </div>
            )}

            {isActionable && (
              <div className="portal-card-body">
                <button className="btn-primary btn-sm" type="button" onClick={(e) => { e.stopPropagation(); handleOpen(agreement.id); }}>
                  Continue <ArrowRight className="icon-xs" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
