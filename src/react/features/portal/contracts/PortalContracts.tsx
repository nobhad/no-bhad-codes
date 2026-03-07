/**
 * PortalContracts
 * Main contracts list view for client portal.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileSignature } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_CONTRACTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { ContractCard } from './ContractCard';
import type { PortalContract, PortalContractsResponse } from './types';
import type { PortalViewProps } from '../types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalContracts');

export interface PortalContractsProps extends PortalViewProps {
  onNavigate?: (entityType: string, entityId: string) => void;
}

function filterContract(
  contract: PortalContract,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch = contract.projectName?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (contract.status !== filters.status) return false;
  }

  return true;
}

export function PortalContracts({
  getAuthToken,
  onNavigate
}: PortalContractsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  const [contracts, setContracts] = useState<PortalContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<PortalContract>({
    storageKey: 'portal_contracts',
    filters: PORTAL_CONTRACTS_FILTER_CONFIG,
    filterFn: filterContract
  });

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = getAuthToken?.();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(API_ENDPOINTS.CONTRACTS_MY, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch contracts');

      const json = await response.json();
      const data: PortalContractsResponse = json.data || json;
      setContracts(data.contracts || []);
    } catch (err) {
      logger.error('Error fetching contracts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const filteredContracts = useMemo(() => applyFilters(contracts), [applyFilters, contracts]);

  const countByStatus = contracts.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <TableLayout
      containerRef={containerRef}
      title="CONTRACTS"
      stats={
        <TableStats
          items={[
            { value: contracts.length, label: 'total' },
            { value: countByStatus.sent || 0, label: 'sent', variant: 'pending' },
            { value: countByStatus.signed || 0, label: 'signed', variant: 'completed' },
            { value: countByStatus.active || 0, label: 'active', variant: 'active' },
            { value: countByStatus.expired || 0, label: 'expired', variant: 'cancelled' }
          ]}
        />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search contracts..." />
          <FilterDropdown
            sections={PORTAL_CONTRACTS_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={fetchContracts} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading contracts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchContracts} />
      ) : filteredContracts.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="icon-lg" />}
          message={
            contracts.length === 0
              ? 'No contracts yet. Contracts will appear here once they are sent to you.'
              : 'No contracts match the current filters.'
          }
        />
      ) : (
        <div ref={listRef} className="portal-cards-list">
          {filteredContracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </TableLayout>
  );
}
