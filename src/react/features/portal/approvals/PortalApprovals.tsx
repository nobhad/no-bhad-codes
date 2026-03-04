/**
 * PortalApprovals
 * Main approvals list view for client portal.
 * Filter select + refresh are in the data-table-header actions row.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_APPROVALS_FILTER_CONFIG } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { ApprovalCard } from './ApprovalCard';
import type { PendingApproval, PendingApprovalsResponse } from './types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

const logger = createLogger('PortalApprovals');

export interface PortalApprovalsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback to navigate to entity detail */
  onNavigate?: (entityType: string, entityId: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * Filter approval by search and entity type
 */
function filterApproval(
  approval: PendingApproval,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      approval.entity_type?.toLowerCase().includes(s) ||
      approval.entity_name?.toLowerCase().includes(s) ||
      approval.description?.toLowerCase().includes(s) ||
      approval.project_name?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.entityType && filters.entityType !== 'all') {
    if (approval.entity_type !== filters.entityType) return false;
  }

  return true;
}

/**
 * PortalApprovals Component
 *
 * Layout:
 * - data-table-card bordered content box
 * - data-table-header with title + stats + filter select + refresh (all inline)
 * - Cards content inside the box
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

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<PendingApproval>({
    storageKey: 'portal_approvals',
    filters: PORTAL_APPROVALS_FILTER_CONFIG,
    filterFn: filterApproval
  });

  const fetchApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = getAuthToken?.();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(API_ENDPOINTS.APPROVALS_PENDING, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch approvals');

      const data = unwrapApiData<PendingApprovalsResponse>(await response.json());
      setApprovals(data.approvals || []);
    } catch (err) {
      logger.error('Error fetching approvals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  const submitResponse = useCallback(
    async (id: number, action: 'approve' | 'reject', comment?: string) => {
      setSubmittingIds((prev) => new Set(prev).add(id));

      try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        const token = getAuthToken?.();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(buildEndpoint.approvalRespond(id), {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ action, comment })
        });

        if (!response.ok) throw new Error(`Failed to ${action} request`);

        setApprovals((prev) => prev.filter((a) => a.id !== id));
        showNotification?.(
          action === 'approve' ? 'Request approved successfully' : 'Request rejected successfully',
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
    async (id: number, comment?: string) => submitResponse(id, 'approve', comment),
    [submitResponse]
  );

  const handleReject = useCallback(
    async (id: number, comment?: string) => submitResponse(id, 'reject', comment),
    [submitResponse]
  );

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const filteredApprovals = useMemo(() => applyFilters(approvals), [applyFilters, approvals]);

  // Count by entity type for stats
  const countByType = approvals.reduce(
    (acc, a) => {
      acc[a.entity_type] = (acc[a.entity_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <TableLayout
      containerRef={containerRef}
      title="APPROVALS"
      stats={
        <TableStats
          items={[
            { value: approvals.length, label: 'total' },
            { value: countByType.proposal || 0, label: 'proposals', variant: 'pending', hideIfZero: true },
            { value: countByType.invoice || 0, label: 'invoices', hideIfZero: true },
            { value: countByType.contract || 0, label: 'contracts', hideIfZero: true },
            { value: countByType.deliverable || 0, label: 'deliverables', hideIfZero: true }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search approvals..." />
          <FilterDropdown
            sections={PORTAL_APPROVALS_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={fetchApprovals} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading approvals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchApprovals} />
      ) : filteredApprovals.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message={
            approvals.length === 0
              ? 'No pending approvals'
              : 'No approvals match the current filters.'
          }
        />
      ) : (
        <div ref={listRef} className="portal-cards-list">
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
    </TableLayout>
  );
}
