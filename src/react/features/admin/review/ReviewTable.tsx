/**
 * ReviewTable
 * Client-facing view of design reviews assigned to the client.
 * Fetches from API_ENDPOINTS.ADMIN.DESIGN_REVIEWS filtered by client.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { formatDate } from '@react/utils/formatDate';
import { useListFetch } from '@react/factories/useDataFetch';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

// ============================================================================
// TYPES
// ============================================================================

interface ReviewItem {
  id: number;
  projectName: string;
  title: string;
  status: string;
  date: string;
  url?: string;
}

export interface ReviewTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// STATUS BADGE MAP
// ============================================================================

const STATUS_CLASS_MAP: Record<string, string> = {
  pending: 'status-badge status-badge-warning',
  'in-review': 'status-badge status-badge-info',
  approved: 'status-badge status-badge-active',
  'changes-requested': 'status-badge status-badge-danger',
  completed: 'status-badge status-badge-active'
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewTable({ getAuthToken, showNotification: _showNotification, onNavigate }: ReviewTableProps) {
  const containerRef = useFadeIn();

  const { data, isLoading, error, refetch } = useListFetch<ReviewItem>({
    endpoint: `${API_ENDPOINTS.ADMIN.DESIGN_REVIEWS}?scope=client`,
    getAuthToken,
    itemsKey: 'reviews'
  });
  const reviews = useMemo(() => data?.items ?? [], [data]);

  function handleViewReview(review: ReviewItem) {
    if (review.url) {
      window.open(review.url, '_blank', 'noopener,noreferrer');
    } else {
      onNavigate?.('review', String(review.id));
    }
  }

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading design reviews..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      <div className="perf-header">
        <h2 className="heading perf-heading">Design Reviews</h2>
        <button className="btn btn-secondary" onClick={refetch}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          message="You have no design reviews assigned at this time."
        />
      ) : (
        <div className="panel">
          <div className="analytics-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-header">Project</th>
                  <th className="table-header">Review Title</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((item) => (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell">{item.projectName}</td>
                    <td className="table-cell">{item.title}</td>
                    <td className="table-cell">
                      <span className={STATUS_CLASS_MAP[item.status] || 'status-badge'}>
                        {item.status}
                      </span>
                    </td>
                    <td className="table-cell">{formatDate(item.date)}</td>
                    <td className="table-cell">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleViewReview(item)}
                        aria-label={`View review: ${item.title}`}
                      >
                        <Eye className="btn-icon-left" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewTable;
