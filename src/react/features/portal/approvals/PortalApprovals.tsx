/**
 * PortalApprovals
 * Main approvals list view for client portal.
 * Filter select + refresh are in the data-table-header actions row.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_APPROVALS_FILTER_CONFIG, createFilterFn } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { countByField } from '@react/utils/cardFormatters';
import { ApprovalCard } from './ApprovalCard';
import type { PendingApproval, PendingApprovalsResponse } from './types';
import type { PortalViewProps } from '../types';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

export interface PortalApprovalsProps extends PortalViewProps {
  /** Callback to navigate to entity detail */
  onNavigate?: (entityType: string, entityId: string) => void;
}

const filterApproval = createFilterFn<PendingApproval>(
  ['entity_type', 'entity_name', 'description', 'project_name'],
  { entityType: 'entity_type' }
);

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
  const listRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_DEFAULT);

  const { data: approvals, isLoading, error, refetch, portalFetch } = usePortalData<PendingApproval[]>({
    getAuthToken,
    url: API_ENDPOINTS.APPROVALS_PENDING,
    transform: (raw) => (raw as PendingApprovalsResponse).approvals || []
  });
  const items = useMemo(() => approvals ?? [], [approvals]);

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

  const submitResponse = useCallback(
    async (id: number, action: 'approve' | 'reject', comment?: string) => {
      setSubmittingIds((prev) => new Set(prev).add(id));
      try {
        await portalFetch(buildEndpoint.approvalRespond(id), {
          method: 'POST',
          body: { action, comment }
        });
        refetch();
        showNotification?.(
          action === 'approve' ? 'Request approved successfully' : 'Request rejected successfully',
          'success'
        );
      } catch (err) {
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
    [portalFetch, refetch, showNotification]
  );

  const handleApprove = useCallback(
    async (id: number, comment?: string) => submitResponse(id, 'approve', comment),
    [submitResponse]
  );

  const handleReject = useCallback(
    async (id: number, comment?: string) => submitResponse(id, 'reject', comment),
    [submitResponse]
  );

  const filteredApprovals = useMemo(() => applyFilters(items), [applyFilters, items]);

  const countByType = countByField(items, 'entity_type');

  return (
    <TableLayout
      containerRef={containerRef}
      title="APPROVALS"
      stats={
        <TableStats
          items={[
            { value: items.length, label: 'total' },
            { value: countByType.proposal || 0, label: 'proposals', variant: 'pending' },
            { value: countByType.invoice || 0, label: 'invoices' },
            { value: countByType.contract || 0, label: 'contracts' },
            { value: countByType.deliverable || 0, label: 'deliverables' }
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
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading approvals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filteredApprovals.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          message={
            items.length === 0
              ? 'No pending approvals. Items requiring your review will appear here.'
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
