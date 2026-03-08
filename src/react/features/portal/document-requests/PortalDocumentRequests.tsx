/**
 * PortalDocumentRequests
 * Main document requests view for the client portal
 */

import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { IconButton } from '@react/factories';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { PORTAL_DOCREQUESTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { useFadeIn } from '@react/hooks/useGsap';
import { DocumentRequestCard, type DocumentRequest } from './DocumentRequestCard';
import type { PortalViewProps } from '../types';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

export interface PortalDocumentRequestsProps extends PortalViewProps {}

interface DocumentRequestSummary {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  rejected: number;
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
  const { data: requests, isLoading, error, refetch } = usePortalData<DocumentRequest[]>({
    getAuthToken,
    url: API_ENDPOINTS.DOCUMENT_REQUESTS_MY,
    transform: (raw) => (raw as { requests?: DocumentRequest[] }).requests || []
  });
  const items = requests ?? [];
  const summary = calculateSummary(items);

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

  const filteredRequests = useMemo(() => applyFilters(items), [applyFilters, items]);

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
          { value: summary.pending + summary.rejected, label: 'action needed', variant: 'pending' },
          { value: summary.submitted, label: 'in review' },
          { value: summary.approved, label: 'approved', variant: 'completed' }
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
          message={items.length === 0
            ? 'No document requests yet. Requests will appear here when your project team needs documents from you.'
            : 'No document requests match the current filters.'
          }
        />
      ) : (
        <div className="portal-cards-list">
          {/* Action Needed Section */}
          {actionNeeded.length > 0 && (
            <div className="section">
              <div className="portal-card-header">
                <h3 className="section-title">Action Needed</h3>
                <span className="badge">{actionNeeded.length}</span>
              </div>
              <div className="section">
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
            <div className="section">
              <h3 className="section-title">In Review</h3>
              <div className="section">
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
            <div className="section">
              <h3 className="section-title">Completed</h3>
              <div className="section">
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
