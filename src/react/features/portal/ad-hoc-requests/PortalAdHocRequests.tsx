/**
 * PortalAdHocRequests
 * Main ad-hoc requests view for the client portal with list and form
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { PortalModal } from '@react/components/portal/PortalModal';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_ADHOC_FILTER_CONFIG, createFilterFn } from '../shared/filterConfigs';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { AdHocRequestCard } from './AdHocRequestCard';
import { NewRequestForm } from './NewRequestForm';
import type { AdHocRequest, NewAdHocRequestPayload } from './types';
import type { PortalViewProps } from '../types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalAdHocRequests');

const filterAdHocRequest = createFilterFn<AdHocRequest>(['title', 'description']);

export interface PortalAdHocRequestsProps extends PortalViewProps {}

/**
 * PortalAdHocRequests Component
 */
export function PortalAdHocRequests({
  getAuthToken,
  showNotification
}: PortalAdHocRequestsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05, 0.1);

  // Primary data fetch via shared hook
  const {
    data: requests,
    isLoading,
    error,
    refetch,
    buildHeaders,
    portalFetch
  } = usePortalData<AdHocRequest[]>({
    getAuthToken,
    url: API_ENDPOINTS.AD_HOC_REQUESTS_MY,
    transform: (raw) => (raw as Record<string, unknown>).requests as AdHocRequest[] || []
  });
  const items = requests ?? [];

  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<AdHocRequest>({
    storageKey: 'portal_adhoc_requests',
    filters: PORTAL_ADHOC_FILTER_CONFIG,
    filterFn: filterAdHocRequest
  });

  const filteredRequests = useMemo(() => applyFilters(items), [applyFilters, items]);

  /**
   * Fetch available projects for dropdown
   */
  const fetchProjects = useCallback(async () => {
    try {
      const data = await portalFetch<Record<string, unknown>>(API_ENDPOINTS.PORTAL.PROJECTS);
      setProjects((data.projects as Array<{ id: number; name: string }>) || []);
    } catch (err) {
      // Projects are optional, don't fail the whole component
      logger.warn('Could not fetch projects:', err);
    }
  }, [portalFetch]);

  /**
   * Submit new request
   */
  const handleSubmit = async (payload: NewAdHocRequestPayload) => {
    setIsSubmitting(true);

    try {
      // Use FormData if there are attachments
      if (payload.attachments && payload.attachments.length > 0) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('description', payload.description);
        formData.append('priority', payload.priority);
        if (payload.project_id) {
          formData.append('project_id', String(payload.project_id));
        }
        payload.attachments.forEach((file) => {
          formData.append('attachments', file);
        });

        // Don't set Content-Type for FormData - browser will set it with boundary
        const authHeaders = buildHeaders();
        const requestHeaders: Record<string, string> = {};
        if (authHeaders['Authorization']) {
          requestHeaders['Authorization'] = authHeaders['Authorization'];
        }

        const response = await fetch(API_ENDPOINTS.AD_HOC_REQUESTS_MY, {
          method: 'POST',
          headers: requestHeaders,
          credentials: 'include',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error((errorData as { error?: string }).error || 'Failed to submit request');
        }
      } else {
        await portalFetch(API_ENDPOINTS.AD_HOC_REQUESTS_MY, {
          method: 'POST',
          body: {
            title: payload.title,
            description: payload.description,
            priority: payload.priority,
            project_id: payload.project_id
          }
        });
      }

      showNotification?.('Request submitted successfully', 'success');
      setIsModalOpen(false);

      // Refresh the list
      await refetch();
    } catch (err) {
      logger.error('Error submitting request:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to submit request',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Approve a quote
   */
  const handleApprove = async (requestId: number) => {
    try {
      await portalFetch(buildEndpoint.adHocRequestApprove(requestId), { method: 'POST' });
      showNotification?.('Quote approved successfully', 'success');
      await refetch();
    } catch (err) {
      logger.error('Error approving quote:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to approve quote',
        'error'
      );
      throw err; // Re-throw for the card to handle
    }
  };

  /**
   * Decline a quote
   */
  const handleDecline = async (requestId: number) => {
    try {
      await portalFetch(buildEndpoint.adHocRequestDecline(requestId), { method: 'POST' });
      showNotification?.('Quote declined', 'info');
      await refetch();
    } catch (err) {
      logger.error('Error declining quote:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to decline quote',
        'error'
      );
      throw err; // Re-throw for the card to handle
    }
  };

  // Fetch projects on mount (requests fetched automatically by usePortalData)
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <>
      <TableLayout
        containerRef={containerRef}
        title="AD-HOC REQUESTS"
        stats={<TableStats items={[{ value: items.length, label: 'total' }]} />}
        actions={
          <>
            <SearchFilter value={search} onChange={setSearch} placeholder="Search requests..." />
            <FilterDropdown
              sections={PORTAL_ADHOC_FILTER_CONFIG}
              values={filterValues}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton action="add" onClick={() => setIsModalOpen(true)} title="New Request" />
            <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
          </>
        }
      >
        {isLoading ? (
          <LoadingState message="Loading requests..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="icon-lg" />}
            message={items.length === 0
              ? 'No requests yet. Click \'+\' to submit your first ad-hoc request.'
              : 'No requests match the current filters.'
            }
          />
        ) : (
          <div ref={listRef} className="portal-cards-list">
            {filteredRequests.map((request) => (
              <AdHocRequestCard
                key={request.id}
                request={request}
                onApprove={handleApprove}
                onDecline={handleDecline}
              />
            ))}
          </div>
        )}
      </TableLayout>

      {/* New Request Modal */}
      <PortalModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="New Ad-Hoc Request"
        description="Describe what you need and we'll provide a quote"
        size="lg"
      >
        <NewRequestForm
          onSubmit={handleSubmit}
          onCancel={() => setIsModalOpen(false)}
          loading={isSubmitting}
          projects={projects}
        />
      </PortalModal>
    </>
  );
}
