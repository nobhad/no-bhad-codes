/**
 * PortalProposals
 * Main proposals list view for client portal.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_PROPOSALS_FILTER_CONFIG } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { ProposalCard } from './ProposalCard';
import type { PortalProposal, PortalProposalsResponse } from './types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalProposals');

export interface PortalProposalsProps {
  getAuthToken?: () => string | null;
  onNavigate?: (entityType: string, entityId: string) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function filterProposal(
  proposal: PortalProposal,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      proposal.title?.toLowerCase().includes(s) ||
      proposal.projectType?.toLowerCase().includes(s) ||
      proposal.selectedTier?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (proposal.status !== filters.status) return false;
  }

  return true;
}

export function PortalProposals({
  getAuthToken,
  onNavigate,
}: PortalProposalsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  const [proposals, setProposals] = useState<PortalProposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = getAuthToken?.();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(API_ENDPOINTS.PROPOSALS_MY, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch proposals');

      const json = await response.json();
      const data: PortalProposalsResponse = json.data || json;
      setProposals(data.proposals || []);
    } catch (err) {
      logger.error('Error fetching proposals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const filteredProposals = useMemo(() => applyFilters(proposals), [applyFilters, proposals]);

  const countByStatus = proposals.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <TableLayout
      containerRef={containerRef}
      title="PROPOSALS"
      stats={
        <TableStats
          items={[
            { value: proposals.length, label: 'total' },
            { value: countByStatus.sent || 0, label: 'sent', variant: 'pending', hideIfZero: true },
            { value: countByStatus.viewed || 0, label: 'viewed', hideIfZero: true },
            { value: countByStatus.accepted || 0, label: 'accepted', variant: 'completed', hideIfZero: true },
            { value: countByStatus.declined || 0, label: 'declined', variant: 'cancelled', hideIfZero: true }
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
          <IconButton action="refresh" onClick={fetchProposals} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading proposals..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProposals} />
      ) : filteredProposals.length === 0 ? (
        <EmptyState
          icon={<FileText className="icon-lg" />}
          message={
            proposals.length === 0
              ? 'No proposals yet'
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
