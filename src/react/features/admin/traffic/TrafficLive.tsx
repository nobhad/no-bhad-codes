import * as React from 'react';
import { useEffect } from 'react';
import { LoadingState, ErrorState } from '@react/factories';
import { StatCard } from '@react/components/portal/StatCard';
import { TableLayout } from '@react/components/portal/TableLayout';
import { useFadeIn } from '@react/hooks/useGsap';
import { useDataFetch } from '@react/factories/useDataFetch';
import { apiFetch, unwrapApiData } from '@/utils/api-client';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty
} from '@react/components/portal/PortalTable';
import { formatRelativeTime, isPortalUrl, trafficSource, urlPath } from './helpers';
import type { TrafficViewProps, TrafficRealtimeResponse } from './types';

const REFRESH_INTERVAL_MS = 15000;

export function TrafficLive(_props: TrafficViewProps) {
  const containerRef = useFadeIn();

  const { data, isLoading, error, refetch } = useDataFetch<TrafficRealtimeResponse | null>({
    fetchFn: async (_params, _headers, signal) => {
      const res = await apiFetch(API_ENDPOINTS.ANALYTICS_REALTIME, { signal });
      if (!res.ok) throw new Error('Failed to load live traffic');
      return unwrapApiData<TrafficRealtimeResponse>(await res.json());
    },
    initialData: null
  });

  // Poll while this view is mounted.
  useEffect(() => {
    const timer = setInterval(() => {
      void refetch();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refetch]);

  if (isLoading && !data) {
    return <LoadingState message="Loading live traffic..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const nowMs = Date.now();
  const recentPages = data?.recentPages ?? [];
  const sessions = data?.sessions ?? [];

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      <div className="traffic-stats traffic-stats--split">
        <StatCard label="Active now" value={data?.activeSessions ?? 0} meta="Last few minutes" />
        <StatCard label="Recent views" value={recentPages.length} meta="Most recent pages" />
      </div>

      <TableLayout title="Recent Page Views" nested>
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead>Page</PortalTableHead>
              <PortalTableHead>Source</PortalTableHead>
              <PortalTableHead>Device</PortalTableHead>
              <PortalTableHead>When</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>
          <PortalTableBody>
            {recentPages.length === 0 ? (
              <PortalTableEmpty colSpan={4} message="No recent activity" />
            ) : (
              recentPages.map((view, index) => (
                <PortalTableRow key={`${view.url}-${view.timestamp}-${index}`}>
                  <PortalTableCell className="traffic-cell-path">
                    {view.title || urlPath(view.url)}
                  </PortalTableCell>
                  <PortalTableCell>
                    <span
                      className={`traffic-source-badge ${isPortalUrl(view.url) ? 'is-portal' : 'is-main'}`}
                    >
                      {trafficSource(view.url)}
                    </span>
                  </PortalTableCell>
                  <PortalTableCell>{view.device_type || '—'}</PortalTableCell>
                  <PortalTableCell>{formatRelativeTime(view.timestamp, nowMs)}</PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>

      <TableLayout title="Active Sessions" nested>
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead>Visitor</PortalTableHead>
              <PortalTableHead>Device / Browser</PortalTableHead>
              <PortalTableHead>Pages</PortalTableHead>
              <PortalTableHead>Last Seen</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>
          <PortalTableBody>
            {sessions.length === 0 ? (
              <PortalTableEmpty colSpan={4} message="No one online right now" />
            ) : (
              sessions.map((session) => (
                <PortalTableRow key={session.session_id}>
                  <PortalTableCell className="traffic-cell-path">{session.visitor_id}</PortalTableCell>
                  <PortalTableCell>
                    {session.device_type || '—'} · {session.browser || '—'}
                  </PortalTableCell>
                  <PortalTableCell>{session.page_views}</PortalTableCell>
                  <PortalTableCell>{formatRelativeTime(session.last_activity, nowMs)}</PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>
    </div>
  );
}
