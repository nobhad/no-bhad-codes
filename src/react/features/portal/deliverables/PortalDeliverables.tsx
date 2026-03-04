/**
 * PortalDeliverables
 * Main deliverables list view for client portal.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_DELIVERABLES_FILTER_CONFIG } from '../shared/filterConfigs';
import { IconButton } from '@react/factories';
import { useStaggerChildren, useFadeIn } from '@react/hooks/useGsap';
import { DeliverableCard } from './DeliverableCard';
import type { PortalDeliverable, PortalDeliverablesResponse } from './types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalDeliverables');

export interface PortalDeliverablesProps {
  getAuthToken?: () => string | null;
  onNavigate?: (entityType: string, entityId: string) => void;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function filterDeliverable(
  deliverable: PortalDeliverable,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      deliverable.title?.toLowerCase().includes(s) ||
      deliverable.type?.toLowerCase().includes(s) ||
      deliverable.project_name?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (deliverable.status !== filters.status) return false;
  }

  return true;
}

export function PortalDeliverables({
  getAuthToken,
  onNavigate
}: PortalDeliverablesProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  const [deliverables, setDeliverables] = useState<PortalDeliverable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchDeliverables = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      const token = getAuthToken?.();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(API_ENDPOINTS.DELIVERABLES_MY, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch deliverables');

      const json = await response.json();
      const data: PortalDeliverablesResponse = json.data || json;
      setDeliverables(data.deliverables || []);
    } catch (err) {
      logger.error('Error fetching deliverables:', err);
      setError(err instanceof Error ? err.message : 'Failed to load deliverables');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  const filteredDeliverables = useMemo(() => applyFilters(deliverables), [applyFilters, deliverables]);

  const countByStatus = deliverables.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <TableLayout
      containerRef={containerRef}
      title="DELIVERABLES"
      stats={
        <TableStats
          items={[
            { value: deliverables.length, label: 'total' },
            { value: countByStatus.in_review || 0, label: 'in review', variant: 'pending', hideIfZero: true },
            { value: countByStatus.approved || 0, label: 'approved', variant: 'completed', hideIfZero: true },
            { value: countByStatus.revision_requested || 0, label: 'revisions', variant: 'overdue', hideIfZero: true }
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
          <IconButton action="refresh" onClick={fetchDeliverables} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading deliverables..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDeliverables} />
      ) : filteredDeliverables.length === 0 ? (
        <EmptyState
          icon={<Package className="icon-lg" />}
          message={
            deliverables.length === 0
              ? 'No deliverables yet'
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
