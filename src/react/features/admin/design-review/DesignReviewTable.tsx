import * as React from 'react';
import { useMemo } from 'react';
import {
  Palette,
  MessageSquare,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
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
import { useTableFilters } from '@react/hooks/useTableFilters';
import { DESIGN_REVIEWS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

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

const DEFAULT_STATS: DesignReviewStats = {
  total: 0,
  pending: 0,
  inReview: 0,
  approved: 0,
  needsRevision: 0,
  avgReviewTime: '0'
};

interface DesignReviewTableProps {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function filterReview(
  review: DesignReview,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !review.title.toLowerCase().includes(query) &&
      !review.projectName.toLowerCase().includes(query) &&
      !review.clientName.toLowerCase().includes(query)
    ) {
      return false;
    }
  }
  if (filters.status && filters.status !== 'all') {
    if (review.status !== filters.status) return false;
  }
  return true;
}

function sortReviews(a: DesignReview, b: DesignReview, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'project':
    return multiplier * a.projectName.localeCompare(b.projectName);
  case 'submittedAt':
    return multiplier * a.submittedAt.localeCompare(b.submittedAt);
  default:
    return 0;
  }
}

export function DesignReviewTable({ projectId, onNavigate, getAuthToken, showNotification: _showNotification }: DesignReviewTableProps) {
  const containerRef = useFadeIn();

  const endpoint = projectId
    ? `${API_ENDPOINTS.ADMIN.DESIGN_REVIEWS}?projectId=${encodeURIComponent(projectId)}`
    : API_ENDPOINTS.ADMIN.DESIGN_REVIEWS;

  const { data, isLoading, error, refetch } = useListFetch<DesignReview, DesignReviewStats>({
    endpoint,
    getAuthToken,
    defaultStats: DEFAULT_STATS,
    itemsKey: 'reviews',
    deps: [projectId]
  });

  const reviews = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_STATS, [data]);

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<DesignReview>({
    storageKey: 'admin_design_reviews',
    filters: DESIGN_REVIEWS_FILTER_CONFIG,
    filterFn: filterReview,
    sortFn: sortReviews
  });

  const filteredReviews = useMemo(() => applyFilters(reviews), [applyFilters, reviews]);

  const pagination = usePagination({ storageKey: 'admin_design_review_pagination', totalItems: filteredReviews.length });
  const paginatedReviews = filteredReviews.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DESIGN REVIEWS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.inReview, label: 'in review', variant: 'active' },
            { value: stats.approved, label: 'approved', variant: 'completed' },
            { value: stats.needsRevision, label: 'needs revision', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.inReview} In Review • ${stats.approved} Approved • Avg: ${stats.avgReviewTime}`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search reviews..."
          />
          <FilterDropdown
            sections={DESIGN_REVIEWS_FILTER_CONFIG}
            values={filterValues}
            onChange={setFilter}
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
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={refetch} />
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
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
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
