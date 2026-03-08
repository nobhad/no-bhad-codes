/**
 * PortalDeliverables
 * Main deliverables list view for client portal.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Package } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_DELIVERABLES_FILTER_CONFIG, createFilterFn } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { countByField } from '@react/utils/cardFormatters';
import { DeliverableCard } from './DeliverableCard';
import type { PortalDeliverable, PortalDeliverablesResponse } from './types';
import type { PortalViewProps } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

export interface PortalDeliverablesProps extends PortalViewProps {
  onNavigate?: (entityType: string, entityId: string) => void;
}

const filterDeliverable = createFilterFn<PortalDeliverable>(['title', 'type', 'project_name']);

export function PortalDeliverables({
  getAuthToken,
  onNavigate
}: PortalDeliverablesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_DEFAULT);

  const { data: deliverables, isLoading, error, refetch } = usePortalData<PortalDeliverable[]>({
    getAuthToken,
    url: API_ENDPOINTS.DELIVERABLES_MY,
    transform: (raw) => (raw as PortalDeliverablesResponse).deliverables || []
  });
  const items = deliverables ?? [];

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<PortalDeliverable>({
    storageKey: 'portal_deliverables',
    filters: PORTAL_DELIVERABLES_FILTER_CONFIG,
    filterFn: filterDeliverable
  });

  const filteredDeliverables = useMemo(() => applyFilters(items), [applyFilters, items]);

  const countByStatus = countByField(items);

  return (
    <TableLayout
      containerRef={containerRef}
      title="DELIVERABLES"
      stats={
        <TableStats
          items={[
            { value: items.length, label: 'total' },
            { value: countByStatus.in_review || 0, label: 'in review', variant: 'pending' },
            { value: countByStatus.approved || 0, label: 'approved', variant: 'completed' },
            { value: countByStatus.revision_requested || 0, label: 'revisions', variant: 'overdue' }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search deliverables..." />
          <FilterDropdown
            sections={PORTAL_DELIVERABLES_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading deliverables..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filteredDeliverables.length === 0 ? (
        <EmptyState
          icon={<Package className="icon-lg" />}
          message={
            items.length === 0
              ? 'No deliverables yet. Deliverables will appear here as your project progresses.'
              : 'No deliverables match the current filters.'
          }
        />
      ) : (
        <div ref={listRef} className="portal-cards-list">
          {filteredDeliverables.map((deliverable) => (
            <DeliverableCard
              key={deliverable.id}
              deliverable={deliverable}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </TableLayout>
  );
}
