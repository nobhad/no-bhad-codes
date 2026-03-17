/**
 * ===============================================
 * TESTIMONIALS TABLE
 * ===============================================
 * @file src/react/features/admin/feedback/TestimonialsTable.tsx
 *
 * Admin table for managing testimonials — approve,
 * publish, feature, edit, and delete.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquareQuote, Inbox, Star, Award } from 'lucide-react';
import { IconButton } from '@react/factories';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { StatusBadge } from '@react/components/portal/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useFadeIn } from '@react/hooks/useGsap';
import { formatDate } from '@react/utils/formatDate';
import { apiFetch, apiPut, apiDelete } from '@/utils/api-client';
import { showToast } from '@/utils/toast-notifications';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';

// ============================================
// Constants
// ============================================

import type { StatusVariant } from '@react/components/portal/StatusBadge';

const STATUS_MAP: Record<string, StatusVariant> = {
  published: 'completed',
  approved: 'active',
  pending_review: 'pending',
  rejected: 'cancelled'
};

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  published: 'Published',
  rejected: 'Rejected'
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' }
];

const FILTER_CONFIG = [
  { key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS }
];

const TOTAL_STARS = 5;
const MAX_PREVIEW_LENGTH = 80;

// ============================================
// Types
// ============================================

interface Testimonial {
  id: number;
  client_id: number;
  project_id: number | null;
  text: string;
  client_name: string;
  company_name: string | null;
  rating: number | null;
  status: string;
  featured: number;
  published_at: string | null;
  created_at: string;
  project_name: string | null;
}

// ============================================
// Filter / Sort helpers
// ============================================

function filterTestimonial(
  t: Testimonial,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const term = search.toLowerCase();
    const matches =
      t.client_name?.toLowerCase().includes(term) ||
      t.text?.toLowerCase().includes(term) ||
      t.company_name?.toLowerCase().includes(term);
    if (!matches) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0 && !statusFilter.includes(t.status)) {
    return false;
  }

  return true;
}

function sortTestimonials(a: Testimonial, b: Testimonial): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

// ============================================
// Helpers
// ============================================

function renderStars(rating: number | null | undefined): React.ReactNode {
  if (rating == null) return '—';
  return (
    <span className="star-rating" title={`${rating}/5`}>
      {Array.from({ length: TOTAL_STARS }, (_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < rating ? 'var(--app-color-warning)' : 'none'}
          stroke={i < rating ? 'var(--app-color-warning)' : 'var(--app-color-text-muted)'}
        />
      ))}
    </span>
  );
}

// ============================================
// COMPONENT
// ============================================

export function TestimonialsTable() {
  const containerRef = useFadeIn<HTMLDivElement>();

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const deleteDialog = useConfirmDialog();

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Testimonial>({
    storageKey: 'admin_testimonials',
    filters: FILTER_CONFIG,
    filterFn: filterTestimonial,
    sortFn: sortTestimonials,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  const fetchTestimonials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(API_ENDPOINTS.FEEDBACK_TESTIMONIALS);
      if (!res.ok) throw new Error('Failed to load testimonials');
      const json = await res.json();
      setTestimonials(json.data?.testimonials || json.testimonials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load testimonials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const filteredTestimonials = useMemo(() => applyFilters(testimonials), [applyFilters, testimonials]);

  const pagination = usePagination({
    storageKey: 'admin_testimonials_pagination',
    totalItems: filteredTestimonials.length,
    defaultPageSize: 25
  });

  const paginatedTestimonials = useMemo(
    () => pagination.paginate(filteredTestimonials),
    [pagination, filteredTestimonials]
  );

  // Actions
  const handlePublish = useCallback(async (id: number) => {
    try {
      const res = await apiPut(buildEndpoint.testimonialPublish(id), {});
      if (!res.ok) throw new Error('Failed to publish');
      showToast('Testimonial published', 'success');
      fetchTestimonials();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    }
  }, [fetchTestimonials]);

  const handleToggleFeatured = useCallback(async (id: number) => {
    try {
      const res = await apiPut(buildEndpoint.testimonialFeature(id), {});
      if (!res.ok) throw new Error('Failed to toggle');
      showToast('Featured toggled', 'success');
      fetchTestimonials();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle', 'error');
    }
  }, [fetchTestimonials]);

  const handleDeleteConfirm = useCallback(async () => {
    if (pendingDeleteId == null) return;
    try {
      const res = await apiDelete(buildEndpoint.testimonial(pendingDeleteId));
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Testimonial deleted', 'success');
      setPendingDeleteId(null);
      fetchTestimonials();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  }, [pendingDeleteId, fetchTestimonials]);

  const openDeleteConfirm = useCallback((id: number) => {
    setPendingDeleteId(id);
    deleteDialog.open();
  }, [deleteDialog]);

  // Stats
  const stats = useMemo(() => {
    const total = testimonials.length;
    const published = testimonials.filter(t => t.status === 'published').length;
    const pending = testimonials.filter(t => t.status === 'pending_review').length;
    const featured = testimonials.filter(t => t.featured === 1).length;

    return [
      { value: total, label: 'total' },
      { value: published, label: 'published' },
      { value: pending, label: 'pending' },
      { value: featured, label: 'featured' }
    ];
  }, [testimonials]);

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="TESTIMONIALS"
        stats={
          <TableStats
            items={stats}
            tooltip={`${testimonials.length} Testimonials`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search testimonials..."
            />
            <FilterDropdown
              sections={FILTER_CONFIG}
              values={{ status: filterValues.status || 'all' }}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton
              action="refresh"
              onClick={fetchTestimonials}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
        pagination={
          !isLoading && filteredTestimonials.length > 0 ? (
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
              <PortalTableHead className="client-col">Client</PortalTableHead>
              <PortalTableHead className="client-col">Project</PortalTableHead>
              <PortalTableHead className="name-col">Testimonial</PortalTableHead>
              <PortalTableHead className="status-col">Rating</PortalTableHead>
              <PortalTableHead className="status-col">Status</PortalTableHead>
              <PortalTableHead className="status-col">Featured</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={fetchTestimonials} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : paginatedTestimonials.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No testimonials match your filters' : 'No testimonials yet'}
              />
            ) : (
              paginatedTestimonials.map(t => (
                <PortalTableRow key={t.id}>
                  <PortalTableCell className="client-cell">
                    <div>{t.client_name}</div>
                    {t.company_name && (
                      <div className="text-muted text-sm">{t.company_name}</div>
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="client-cell">{t.project_name || '—'}</PortalTableCell>
                  <PortalTableCell className="primary-cell">
                    <span title={t.text}>
                      {t.text.length > MAX_PREVIEW_LENGTH
                        ? `${t.text.slice(0, MAX_PREVIEW_LENGTH)}...`
                        : t.text
                      }
                    </span>
                  </PortalTableCell>
                  <PortalTableCell className="status-col">{renderStars(t.rating)}</PortalTableCell>
                  <PortalTableCell className="status-col">
                    <StatusBadge status={STATUS_MAP[t.status] || t.status}>
                      {STATUS_LABELS[t.status] || t.status}
                    </StatusBadge>
                  </PortalTableCell>
                  <PortalTableCell className="status-col">
                    {t.featured ? (
                      <Award size={16} stroke="var(--app-color-warning)" />
                    ) : '—'}
                  </PortalTableCell>
                  <PortalTableCell className="col-actions">
                    <div className="table-actions">
                      {t.status !== 'published' && (
                        <IconButton
                          action="view"
                          onClick={() => handlePublish(t.id)}
                          title="Publish"
                        />
                      )}
                      <IconButton
                        action="edit"
                        onClick={() => handleToggleFeatured(t.id)}
                        title={t.featured ? 'Unfeature' : 'Feature'}
                      />
                      <IconButton
                        action="delete"
                        onClick={() => openDeleteConfirm(t.id)}
                        title="Delete"
                      />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Testimonial"
        description="Are you sure you want to delete this testimonial? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </>
  );
}
