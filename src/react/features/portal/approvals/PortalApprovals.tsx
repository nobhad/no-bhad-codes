/**
 * PortalApprovals
 * Main approvals list view for client portal
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Inbox, Filter, RefreshCw } from 'lucide-react';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { EmptyState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { ApprovalCard } from './ApprovalCard';
import type { PendingApproval, ApprovalEntityType, PendingApprovalsResponse } from './types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalApprovals');

export interface PortalApprovalsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to navigate to entity detail */
  onNavigate?: (entityType: string, entityId: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/** Filter options for entity types */
const ENTITY_FILTER_OPTIONS: { value: ApprovalEntityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'proposal', label: 'Proposals' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'contract', label: 'Contracts' },
  { value: 'deliverable', label: 'Deliverables' },
  { value: 'project', label: 'Projects' }
];

/**
 * PortalApprovals Component
 */
export function PortalApprovals({
  getAuthToken,
  onNavigate,
  showNotification
}: PortalApprovalsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingIds, setSubmittingIds] = useState<Set<number>>(new Set());
  const [entityFilter, setEntityFilter] = useState<ApprovalEntityType | 'all'>('all');

  /**
   * Fetch pending approvals from API
   */
  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.APPROVALS_PENDING, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch approvals');
      }

      const data: PendingApprovalsResponse = await response.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      logger.error('Error fetching approvals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  /**
   * Submit approval response
   */
  const submitResponse = useCallback(
    async (id: number, action: 'approve' | 'reject', comment?: string) => {
      setSubmittingIds((prev) => new Set(prev).add(id));

      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };

        const token = getAuthToken?.();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(buildEndpoint.approvalRespond(id), {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ action, comment })
        });

        if (!response.ok) {
          throw new Error(`Failed to ${action} request`);
        }

        // Remove from list on success
        setApprovals((prev) => prev.filter((a) => a.id !== id));

        showNotification?.(
          action === 'approve'
            ? 'Request approved successfully'
            : 'Request rejected successfully',
          'success'
        );
      } catch (err) {
        logger.error(`Error ${action}ing approval:`, err);
        showNotification?.(
          err instanceof Error ? err.message : `Failed to ${action} request`,
          'error'
        );
        throw err;
      } finally {
        setSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [getAuthToken, showNotification]
  );

  const handleApprove = useCallback(
    async (id: number, comment?: string) => {
      await submitResponse(id, 'approve', comment);
    },
    [submitResponse]
  );

  const handleReject = useCallback(
    async (id: number, comment?: string) => {
      await submitResponse(id, 'reject', comment);
    },
    [submitResponse]
  );

  // Fetch approvals on mount
  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Filter approvals by entity type
  const filteredApprovals =
    entityFilter === 'all'
      ? approvals
      : approvals.filter((a) => a.entity_type === entityFilter);

  // Count by entity type for filter badges
  const countByType = approvals.reduce(
    (acc, a) => {
      acc[a.entity_type] = (acc[a.entity_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-state">
        <RefreshCw className="tw-h-5 tw-w-5 tw-animate-spin" />
        <span>Loading approvals...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-state">
        <div className="tw-text-center tw-mb-4">{error}</div>
        <button className="btn-secondary" onClick={fetchApprovals}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      {/* Header with filter */}
      <div className="approvals-header">
        <div className="approvals-filter">
          <Filter className="tw-h-4 tw-w-4" />
          <div className="tw-tab-list approvals-tabs">
            {ENTITY_FILTER_OPTIONS.map((option) => {
              const count = option.value === 'all' ? approvals.length : countByType[option.value] || 0;
              const isActive = entityFilter === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => setEntityFilter(option.value)}
                  className={cn(isActive ? 'tw-tab-active' : 'tw-tab', 'approvals-tab')}
                >
                  {option.label}
                  {count > 0 && <span className="approvals-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Refresh button */}
        <IconButton action="refresh" onClick={fetchApprovals} title="Refresh" />
      </div>

      {/* Empty state */}
      {filteredApprovals.length === 0 ? (
        <EmptyState
          icon={<Inbox className="tw-h-6 tw-w-6" />}
          message={approvals.length === 0 ? 'No pending approvals' : `No ${entityFilter} approvals pending`}
        />
      ) : (
        /* Approvals list */
        <div ref={listRef} className="tw-section">
          {filteredApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onReject={handleReject}
              onNavigate={onNavigate}
              isSubmitting={submittingIds.has(approval.id)}
            />
          ))}
        </div>
      )}

      {/* Summary footer */}
      {approvals.length > 0 && (
        <div className="tw-panel approvals-summary">
          <span className="tw-text-muted tw-text-xs">
            {filteredApprovals.length} of {approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
