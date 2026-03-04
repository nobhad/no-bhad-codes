/**
 * PortalDocumentRequests
 * Main document requests view for the client portal
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_DOCREQUESTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { useFadeIn } from '@react/hooks/useGsap';
import { DocumentRequestCard, type DocumentRequest } from './DocumentRequestCard';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('PortalDocumentRequests');

export interface PortalDocumentRequestsProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface DocumentRequestSummary {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  rejected: number;
}

interface ApiResponse {
  success?: boolean;
  requests?: DocumentRequest[];
  error?: string;
}

/**
 * Custom hook for fetching document requests
 */
function useDocumentRequests(getAuthToken?: () => string | null) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      const token = getAuthToken?.();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_ENDPOINTS.DOCUMENT_REQUESTS_MY, {
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch document requests');
      }

      const data: ApiResponse = unwrapApiData<ApiResponse>(await response.json());

      if (data.requests) {
        setRequests(data.requests);
      } else {
        setRequests([]);
      }
    } catch (err) {
      logger.error('[useDocumentRequests] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load document requests');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    isLoading,
    error,
    refetch: fetchRequests
  };
}

/**
 * Calculate summary statistics from requests
 */
function calculateSummary(requests: DocumentRequest[]): DocumentRequestSummary {
  return {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    submitted: requests.filter(r => r.status === 'submitted').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  };
}

/**
 * Filter document request by search and status
 */
function filterDocRequest(
  request: DocumentRequest,
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

/**
 * PortalDocumentRequests Component
 */
export function PortalDocumentRequests({
  getAuthToken,
  showNotification
}: PortalDocumentRequestsProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const { requests, isLoading, error, refetch } = useDocumentRequests(getAuthToken);
  const summary = calculateSummary(requests);

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters
  } = useTableFilters<DocumentRequest>({
    storageKey: 'portal_document_requests',
    filters: PORTAL_DOCREQUESTS_FILTER_CONFIG,
    filterFn: filterDocRequest
  });

  const filteredRequests = useMemo(() => applyFilters(requests), [applyFilters, requests]);

  // Handle upload success
  const handleUploadSuccess = useCallback((_requestId: number) => {
    // Refetch to get updated status
    refetch();
  }, [refetch]);

  // Separate requests by action needed
  const actionNeeded = filteredRequests.filter(r => r.status === 'pending' || r.status === 'rejected');
  const inReview = filteredRequests.filter(r => r.status === 'submitted');
  const completed = filteredRequests.filter(r => r.status === 'approved');

  return (
    <TableLayout
      containerRef={containerRef}
      title="DOCUMENT REQUESTS"
      stats={
        <TableStats items={[
          { value: summary.total, label: 'total' },
          { value: summary.pending + summary.rejected, label: 'action needed', variant: 'pending', hideIfZero: true },
          { value: summary.submitted, label: 'in review', hideIfZero: true },
          { value: summary.approved, label: 'approved', variant: 'completed', hideIfZero: true }
        ]} />
      }
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search requests..." />
          <FilterDropdown
            sections={PORTAL_DOCREQUESTS_FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={refetch} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading document requests..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={<FileText className="icon-lg" />}
          message={requests.length === 0
            ? 'No document requests yet. Requests will appear here when your project team needs documents from you.'
            : 'No document requests match the current filters.'
          }
        />
      ) : (
        <div className="portal-cards-list">
          {/* Action Needed Section */}
          {actionNeeded.length > 0 && (
            <div className="tw-section">
              <div className="portal-card-header">
                <h3 className="section-title">Action Needed</h3>
                <span className="tw-badge">{actionNeeded.length}</span>
              </div>
              <div className="tw-section">
                {actionNeeded.map(request => (
                  <DocumentRequestCard
                    key={request.id}
                    request={request}
                    onUploadSuccess={handleUploadSuccess}
                    getAuthToken={getAuthToken}
                    showNotification={showNotification}
                  />
                ))}
              </div>
            </div>
          )}

          {/* In Review Section */}
          {inReview.length > 0 && (
            <div className="tw-section">
              <h3 className="section-title">In Review</h3>
              <div className="tw-section">
                {inReview.map(request => (
                  <DocumentRequestCard
                    key={request.id}
                    request={request}
                    onUploadSuccess={handleUploadSuccess}
                    getAuthToken={getAuthToken}
                    showNotification={showNotification}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {completed.length > 0 && (
            <div className="tw-section">
              <h3 className="section-title">Completed</h3>
              <div className="tw-section">
                {completed.map(request => (
                  <DocumentRequestCard
                    key={request.id}
                    request={request}
                    onUploadSuccess={handleUploadSuccess}
                    getAuthToken={getAuthToken}
                    showNotification={showNotification}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </TableLayout>
  );
}
