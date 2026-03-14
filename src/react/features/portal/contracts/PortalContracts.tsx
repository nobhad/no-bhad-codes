/**
 * PortalContracts
 * Main contracts list view for client portal.
 */

import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { FileSignature } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_CONTRACTS_FILTER_CONFIG, createFilterFn } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { GSAP } from '@react/config/portal-constants';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { countByField } from '@react/utils/cardFormatters';
import { ContractCard } from './ContractCard';
import { ContractSignModal } from './ContractSignModal';
import type { PortalContract, PortalContractsResponse } from './types';
import type { PortalViewProps } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

export interface PortalContractsProps extends PortalViewProps {
  onNavigate?: (entityType: string, entityId: string) => void;
}

const filterContract = createFilterFn<PortalContract>(['projectName']);

export function PortalContracts({
  getAuthToken,
  onNavigate
}: PortalContractsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(GSAP.STAGGER_DEFAULT);

  const { data: contracts, isLoading, error, refetch } = usePortalData<PortalContract[]>({
    getAuthToken,
    url: API_ENDPOINTS.CONTRACTS_MY,
    transform: (raw) => (raw as PortalContractsResponse).contracts || []
  });
  const items = useMemo(() => contracts ?? [], [contracts]);

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

  const filteredContracts = useMemo(() => applyFilters(items), [applyFilters, items]);

  const countByStatus = countByField(items);

  // Sign modal state
  const [signingContract, setSigningContract] = useState<PortalContract | null>(null);

  const handleSignClick = useCallback((contract: PortalContract) => {
    setSigningContract(contract);
  }, []);

  const handleSignModalClose = useCallback((open: boolean) => {
    if (!open) setSigningContract(null);
  }, []);

  const handleSigned = useCallback(() => {
    setSigningContract(null);
    refetch();
  }, [refetch]);

  return (
    <div ref={containerRef} className="section">
      <TableLayout nested
        title="CONTRACTS"
        stats={
          <TableStats
            items={[
              { value: items.length, label: 'total' },
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
            <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
          </>
        }
      >
        {isLoading ? (
          <LoadingState message="Loading contracts..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredContracts.length === 0 ? (
          <EmptyState
            icon={<FileSignature className="icon-lg" />}
            message={
              items.length === 0
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
                onSign={handleSignClick}
              />
            ))}
          </div>
        )}
      </TableLayout>

      {/* Contract signing modal */}
      {signingContract && (
        <ContractSignModal
          open={true}
          onOpenChange={handleSignModalClose}
          contract={signingContract}
          getAuthToken={getAuthToken}
          onSigned={handleSigned}
        />
      )}
    </div>
  );
}
