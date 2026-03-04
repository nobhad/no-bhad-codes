import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Palette,
  MessageSquare,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
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
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

interface DesignReview {
  id: number;
  title: string;
  description?: string;
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  status: 'pending' | 'in-review' | 'approved' | 'revision-requested' | 'rejected';
  version: number;
  comments: number;
  attachments: number;
  reviewer?: string;
  dueDate?: string;
  submittedAt: string;
  reviewedAt?: string;
  createdAt: string;
}

interface DesignReviewStats {
  total: number;
  pending: number;
  inReview: number;
  approved: number;
  needsRevision: number;
  avgReviewTime: string;
}

interface DesignReviewPanelProps {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'revision-requested', label: 'Needs Revision' },
  { value: 'rejected', label: 'Rejected' }
];

export function DesignReviewPanel({ projectId, onNavigate, getAuthToken, showNotification: _showNotification }: DesignReviewPanelProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<DesignReview[]>([]);
  const [stats, setStats] = useState<DesignReviewStats>({
    total: 0,
    pending: 0,
    inReview: 0,
    approved: 0,
    needsRevision: 0,
    avgReviewTime: '0'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // Auth headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`${API_ENDPOINTS.ADMIN.DESIGN_REVIEWS}?${params}`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load design reviews');
      const data = await response.json();
      const payload = data.data || data;
      setReviews(payload.reviews || []);
      setStats(payload.stats || { total: 0, pending: 0, approved: 0, inRevision: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load design reviews');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, getHeaders]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const filteredReviews = useMemo(() => {
    let result = [...reviews];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.projectName.toLowerCase().includes(query) ||
          r.clientName.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
        case 'title': aVal = a.title; bVal = b.title; break;
        case 'project': aVal = a.projectName; bVal = b.projectName; break;
        case 'submittedAt': aVal = a.submittedAt; bVal = b.submittedAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [reviews, searchQuery, statusFilter, sort]);

  const pagination = usePagination({ storageKey: 'admin_design_review_pagination', totalItems: filteredReviews.length });
  const paginatedReviews = filteredReviews.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function toggleSort(column: string) {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DESIGN REVIEWS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.inReview, label: 'in review', variant: 'active', hideIfZero: true },
            { value: stats.approved, label: 'approved', variant: 'completed', hideIfZero: true },
            { value: stats.needsRevision, label: 'needs revision', variant: 'overdue', hideIfZero: true }
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.inReview} In Review • ${stats.approved} Approved • Avg: ${stats.avgReviewTime}`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search reviews..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS }
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <IconButton action="add" title="Submit for Review" />
        </>
      }
      pagination={
        !isLoading && filteredReviews.length > 0 ? (
          <TablePagination
            pageInfo={pagination.pageInfo}
            page={pagination.page}
            pageSize={pagination.pageSize}
            pageSizeOptions={pagination.pageSizeOptions}
            canGoPrev={pagination.canGoPrev}
            canGoNext={pagination.canGoNext}
            onPageSizeChange={pagination.setPageSize}
            onFirstPage={pagination.firstPage}
            onPrevPage={pagination.prevPage}
            onNextPage={pagination.nextPage}
            onLastPage={pagination.lastPage}
          />
        ) : undefined
      }
    >
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Design
            </PortalTableHead>
            <PortalTableHead
              sortable
              sortDirection={sort?.column === 'project' ? sort.direction : null}
              onClick={() => toggleSort('project')}
            >
              Project
            </PortalTableHead>
            <PortalTableHead>Status</PortalTableHead>
            <PortalTableHead className="text-center">Ver</PortalTableHead>
            <PortalTableHead className="text-right">Comments</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'submittedAt' ? sort.direction : null}
              onClick={() => toggleSort('submittedAt')}
            >
              Submitted
            </PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={loadReviews} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={7} rows={5} />
          ) : paginatedReviews.length === 0 ? (
            <PortalTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No reviews match your filters' : 'No design reviews yet'}
            />
          ) : (
            paginatedReviews.map((review) => (
              <PortalTableRow key={review.id} clickable>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Palette className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{review.title}</span>
                      <span className="cell-subtitle">
                        {review.attachments} files - {review.clientName}
                      </span>
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('projects', String(review.projectId));
                    }}
                    className="link-btn"
                  >
                    {review.projectName}
                  </button>
                </PortalTableCell>
                <PortalTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(review.status)} size="sm">
                    {review.status.replace('-', ' ')}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className="text-center">v{review.version}</PortalTableCell>
                <PortalTableCell className="text-right">
                  {review.comments > 0 && (
                    <span className="cell-with-icon-inline">
                      <MessageSquare className="cell-icon-sm" />
                      {review.comments}
                    </span>
                  )}
                </PortalTableCell>
                <PortalTableCell className="date-cell">{formatDate(review.submittedAt)}</PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    {review.status === 'in-review' && (
                      <>
                        <IconButton action="approve" title="Approve" />
                        <IconButton action="reject" title="Request Revision" />
                      </>
                    )}
                    <IconButton icon="image" title="View Files" />
                    <IconButton action="copy-link" title="Share Link" />
                    <IconButton action="message" title="Add Comment" />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}

export default DesignReviewPanel;
