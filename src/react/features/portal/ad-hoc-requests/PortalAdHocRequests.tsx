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
import { PORTAL_ADHOC_FILTER_CONFIG } from '../shared/filterConfigs';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { AdHocRequestCard } from './AdHocRequestCard';
import { NewRequestForm } from './NewRequestForm';
import type { AdHocRequest, NewAdHocRequestPayload } from './types';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalAdHocRequests');

/**
 * Filter ad-hoc request by search and status
 */
function filterAdHocRequest(
  request: AdHocRequest,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      request.title?.toLowerCase().includes(s) ||
      request.description?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (request.status !== filters.status) return false;
  }

  return true;
}

export interface PortalAdHocRequestsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

/**
 * PortalAdHocRequests Component
 */
export function PortalAdHocRequests({
  getAuthToken,
  showNotification
}: PortalAdHocRequestsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const listRef = useStaggerChildren<HTMLDivElement>(0.05, 0.1);

  const [requests, setRequests] = useState<AdHocRequest[]>([]);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const filteredRequests = useMemo(() => applyFilters(requests), [applyFilters, requests]);

  /**
   * Get auth headers for API requests
   */
  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const token = getAuthToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }, [getAuthToken]);

  /**
   * Fetch requests from API
   */
  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.AD_HOC_REQUESTS_MY, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load requests');
      }

      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setRequests((data.requests as AdHocRequest[]) || []);
    } catch (err) {
      logger.error('Error fetching requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  /**
   * Fetch available projects for dropdown
   */
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.PORTAL.PROJECTS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (response.ok) {
        const data = unwrapApiData<Record<string, unknown>>(await response.json());
        setProjects((data.projects as Array<{ id: number; name: string }>) || []);
      }
    } catch (err) {
      // Projects are optional, don't fail the whole component
      logger.warn('Could not fetch projects:', err);
    }
  }, [getHeaders]);

  /**
   * Submit new request
   */
  const handleSubmit = async (payload: NewAdHocRequestPayload) => {
    setIsSubmitting(true);

    try {
      let body: string | FormData;
      let requestHeaders: Record<string, string>;

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
        body = formData;

        // Don't set Content-Type for FormData - browser will set it with boundary
        requestHeaders = {};
        const token = getAuthToken?.();
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
      } else {
        body = JSON.stringify({
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          project_id: payload.project_id
        });
        requestHeaders = getHeaders();
      }

      const response = await fetch(API_ENDPOINTS.AD_HOC_REQUESTS_MY, {
        method: 'POST',
        headers: requestHeaders,
        credentials: 'include',
        body
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit request');
      }

      showNotification?.('Request submitted successfully', 'success');
      setIsModalOpen(false);

      // Refresh the list
      await fetchRequests();
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
      const response = await fetch(buildEndpoint.adHocRequestApprove(requestId), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve quote');
      }

      showNotification?.('Quote approved successfully', 'success');

      // Refresh the list
      await fetchRequests();
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
      const response = await fetch(buildEndpoint.adHocRequestDecline(requestId), {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to decline quote');
      }

      showNotification?.('Quote declined', 'info');

      // Refresh the list
      await fetchRequests();
    } catch (err) {
      logger.error('Error declining quote:', err);
      showNotification?.(
        err instanceof Error ? err.message : 'Failed to decline quote',
        'error'
      );
      throw err; // Re-throw for the card to handle
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRequests();
    fetchProjects();
  }, [fetchRequests, fetchProjects]);

  return (
    <>
      <TableLayout
        containerRef={containerRef}
        title="AD-HOC REQUESTS"
        stats={<TableStats items={[{ value: requests.length, label: 'total' }]} />}
        actions={
          <>
            <SearchFilter value={search} onChange={setSearch} placeholder="Search requests..." />
            <FilterDropdown
              sections={PORTAL_ADHOC_FILTER_CONFIG}
              values={filterValues}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton action="add" onClick={() => setIsModalOpen(true)} title="New Request" />
            <IconButton action="refresh" onClick={fetchRequests} title="Refresh" loading={isLoading} />
          </>
        }
      >
        {isLoading ? (
          <LoadingState message="Loading requests..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchRequests} />
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="icon-lg" />}
            message={requests.length === 0
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
