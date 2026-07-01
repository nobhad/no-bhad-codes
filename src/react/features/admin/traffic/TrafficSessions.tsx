import * as React from 'react';
import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingState, ErrorState } from '@react/factories';
import { TableLayout } from '@react/components/portal/TableLayout';
import { useFadeIn } from '@react/hooks/useGsap';
import { useDataFetch } from '@react/factories/useDataFetch';
import { apiFetch, unwrapApiData } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { formatDate } from '@react/utils/formatDate';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty
} from '@react/components/portal/PortalTable';
import { formatDuration } from './helpers';
import type { TrafficViewProps, TrafficSessionsResponse } from './types';

const PAGE_SIZE = 50;
const DEFAULT_DAYS = 7;

export function TrafficSessions(_props: TrafficViewProps) {
  const containerRef = useFadeIn();
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useDataFetch<TrafficSessionsResponse | null, number>({
    fetchFn: async (params, _headers, signal) => {
      const res = await apiFetch(
        `${API_ENDPOINTS.ANALYTICS_SESSIONS}?page=${params}&limit=${PAGE_SIZE}&days=${DEFAULT_DAYS}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed to load sessions');
      return unwrapApiData<TrafficSessionsResponse>(await res.json());
    },
    params: page,
    deps: [page],
    initialData: null
  });

  const sessions = data?.sessions ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage((p) => Math.min(totalPages, p + 1)), [totalPages]);

  if (isLoading && !data) {
    return <LoadingState message="Loading sessions..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const location = (city: string, country: string) =>
    [city, country].filter(Boolean).join(', ') || '—';

  const paginationControls = totalPages > 1 ? (
    <div className="traffic-pagination">
      <button
        type="button"
        className="traffic-page-btn"
        onClick={goPrev}
        disabled={page <= 1 || isLoading}
        aria-label="Previous page"
      >
        <ChevronLeft className="icon-sm" />
      </button>
      <span className="traffic-page-info">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="traffic-page-btn"
        onClick={goNext}
        disabled={page >= totalPages || isLoading}
        aria-label="Next page"
      >
        <ChevronRight className="icon-sm" />
      </button>
    </div>
  ) : undefined;

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <TableLayout
        title="Sessions"
        stats={
          <span className="traffic-page-info">
            Last {DEFAULT_DAYS} days{pagination ? ` · ${pagination.total} total` : ''}
          </span>
        }
        pagination={paginationControls}
        nested
      >
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead>Started</PortalTableHead>
              <PortalTableHead>Device / Browser</PortalTableHead>
              <PortalTableHead>Location</PortalTableHead>
              <PortalTableHead>Pages</PortalTableHead>
              <PortalTableHead>Duration</PortalTableHead>
              <PortalTableHead>Bounced</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>
          <PortalTableBody>
            {sessions.length === 0 ? (
              <PortalTableEmpty colSpan={6} message="No sessions in this range" />
            ) : (
              sessions.map((session) => (
                <PortalTableRow key={session.session_id}>
                  <PortalTableCell>{formatDate(session.start_time)}</PortalTableCell>
                  <PortalTableCell>
                    {session.device_type || '—'} · {session.browser || '—'}
                    {session.os ? ` · ${session.os}` : ''}
                  </PortalTableCell>
                  <PortalTableCell>{location(session.city, session.country)}</PortalTableCell>
                  <PortalTableCell>{session.page_views}</PortalTableCell>
                  <PortalTableCell>{formatDuration(session.total_time_on_site)}</PortalTableCell>
                  <PortalTableCell>{session.bounced ? 'Yes' : 'No'}</PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>
    </div>
  );
}
