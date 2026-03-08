/**
 * PortalProposals
 * Main proposals list view for client portal.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_PROPOSALS_FILTER_CONFIG, createFilterFn } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { countByField } from '@react/utils/cardFormatters';
import { ProposalCard } from './ProposalCard';
import type { PortalProposal, PortalProposalsResponse } from './types';
import type { PortalViewProps } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

export interface PortalProposalsProps extends PortalViewProps {
  onNavigate?: (entityType: string, entityId: string) => void;
}

const filterProposal = createFilterFn<PortalProposal>(['title', 'projectType', 'selectedTier']);

export function PortalProposals({
  getAuthToken,
  onNavigate
}: PortalProposalsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_DEFAULT);

  const { data: proposals, isLoading, error, refetch } = usePortalData<PortalProposal[]>({
    getAuthToken,
    url: API_ENDPOINTS.PROPOSALS_MY,
    transform: (raw) => (raw as PortalProposalsResponse).proposals || []
  });
  const items = proposals ?? [];

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<PortalProposal>({
    storageKey: 'portal_proposals',
    filters: PORTAL_PROPOSALS_FILTER_CONFIG,
    filterFn: filterProposal
  });

  const filteredProposals = useMemo(() => applyFilters(items), [applyFilters, items]);

  const countByStatus = countByField(items);

  return (
    <TableLayout
      containerRef={containerRef}
      title="PROPOSALS"
      stats={
        <TableStats
          items={[
            { value: items.length, label: 'total' },
            { value: countByStatus.sent || 0, label: 'sent', variant: 'pending' },
            { value: countByStatus.viewed || 0, label: 'viewed' },
            { value: countByStatus.accepted || 0, label: 'accepted', variant: 'completed' },
            { value: countByStatus.declined || 0, label: 'declined', variant: 'cancelled' }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search proposals..." />
          <FilterDropdown
            sections={PORTAL_PROPOSALS_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading proposals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filteredProposals.length === 0 ? (
        <EmptyState
          icon={<FileText className="icon-lg" />}
          message={
            items.length === 0
              ? 'No proposals yet. Proposals will appear here once they are sent to you.'
              : 'No proposals match the current filters.'
          }
        />
      ) : (
        <div ref={listRef} className="portal-cards-list">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </TableLayout>
  );
}
