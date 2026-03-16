/**
 * ReviewTable
 * Client-facing view of design reviews assigned to the client.
 * Fetches from API_ENDPOINTS.ADMIN.DESIGN_REVIEWS filtered by client.
 */

import * as React from 'react';
import { useMemo } from 'react';
import { Eye, RefreshCw, Inbox } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatDate } from '@react/utils/formatDate';
import { useListFetch } from '@react/factories/useDataFetch';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
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

  const COLUMN_COUNT = 5;

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <div className="perf-header">
        <h2 className="heading perf-heading">Design Reviews</h2>
        <button className="btn btn-secondary" onClick={refetch}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      <PortalTable className="data-table">
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead>Project</PortalTableHead>
            <PortalTableHead>Review Title</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="date-col">Date</PortalTableHead>
            <PortalTableHead className="col-actions">Action</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={COLUMN_COUNT} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={COLUMN_COUNT} rows={5} />
          ) : reviews.length === 0 ? (
            <PortalTableEmpty
              colSpan={COLUMN_COUNT}
              icon={<Inbox />}
              message="You have no design reviews assigned at this time."
            />
          ) : (
            reviews.map((item) => (
              <PortalTableRow key={item.id}>
                <PortalTableCell>{item.projectName}</PortalTableCell>
                <PortalTableCell>{item.title}</PortalTableCell>
                <PortalTableCell className="status-col">
                  <span className={STATUS_CLASS_MAP[item.status] || 'status-badge'}>
                    {item.status}
                  </span>
                </PortalTableCell>
                <PortalTableCell className="date-col">{formatDate(item.date)}</PortalTableCell>
                <PortalTableCell className="col-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleViewReview(item)}
                    aria-label={`View review: ${item.title}`}
                  >
                    <Eye className="btn-icon-left" />
                    View
                  </button>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </div>
  );
}

export default ReviewTable;
