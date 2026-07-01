import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { IconButton } from '@react/factories';
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
import { formatDuration, isPortalUrl, trafficSource, urlPath } from './helpers';
import type { TrafficViewProps, TrafficSummaryResponse } from './types';

const RANGE_OPTIONS = [7, 30, 90] as const;

export function TrafficOverview({ showNotification }: TrafficViewProps) {
  const containerRef = useFadeIn();
  const [days, setDays] = useState<number>(30);
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, error, refetch } = useDataFetch<TrafficSummaryResponse | null, number>({
    fetchFn: async (params, _headers, signal) => {
      const res = await apiFetch(`${API_ENDPOINTS.ANALYTICS_SUMMARY}?days=${params}`, { signal });
      if (!res.ok) throw new Error('Failed to load traffic summary');
      return unwrapApiData<TrafficSummaryResponse>(await res.json());
    },
    params: days,
    deps: [days],
    initialData: null
  });

  const summary = data?.summary ?? {};
  const topPages = useMemo(() => data?.topPages ?? [], [data]);
  const daily = useMemo(() => data?.daily ?? [], [data]);

  // Main-site vs portal split, summed from top pages by URL.
  const split = useMemo(() => {
    let main = 0;
    let portal = 0;
    for (const page of topPages) {
      if (isPortalUrl(page.url)) portal += page.views;
      else main += page.views;
    }
    return { main, portal };
  }, [topPages]);

  const maxDailyViews = useMemo(
    () => Math.max(1, ...daily.map((d) => d.page_views)),
    [daily]
  );

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await apiFetch(`${API_ENDPOINTS.ANALYTICS_EXPORT}?days=${days}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `traffic-export-${days}d.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      showNotification?.('Traffic data exported', 'success');
    } catch {
      showNotification?.('Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [days, showNotification]);

  if (isLoading && !data) {
    return <LoadingState message="Loading traffic..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="subsection">
      {/* Toolbar: date range + actions */}
      <div className="traffic-toolbar">
        <div className="traffic-range" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`traffic-range-btn ${days === option ? 'is-active' : ''}`}
              onClick={() => setDays(option)}
            >
              {option}d
            </button>
          ))}
        </div>
        <div className="traffic-toolbar-actions">
          <IconButton action="refresh" title="Refresh" onClick={() => refetch()} disabled={isLoading} />
          <IconButton action="download" title="Export traffic data" onClick={handleExport} disabled={isExporting} />
        </div>
      </div>

      {/* Headline metrics */}
      <div className="traffic-stats">
        <StatCard label="Page Views" value={summary.total_page_views ?? 0} />
        <StatCard label="Unique Visitors" value={summary.unique_visitors ?? 0} />
        <StatCard label="Sessions" value={summary.total_sessions ?? 0} />
        <StatCard
          label="Avg. Session"
          value={formatDuration(summary.avg_session_duration)}
          meta={`Bounce ${Math.round(summary.bounce_rate ?? 0)}%`}
        />
      </div>

      {/* Main site vs portal split */}
      <div className="traffic-stats traffic-stats--split">
        <StatCard label="Main Site views" value={split.main} meta="Public pages" />
        <StatCard label="Portal views" value={split.portal} meta="Dashboard & auth" />
      </div>

      {/* Views over time */}
      <section className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span className="field-label">Page Views · last {days} days</span>
          </div>
        </div>
        <div className="panel-body">
          {daily.length === 0 ? (
            <p className="traffic-empty-line">No page views recorded in this range.</p>
          ) : (
            <div className="traffic-trend" role="img" aria-label="Page views over time">
              {daily.map((d) => (
                <div
                  key={d.date}
                  className="traffic-trend-bar"
                  style={{ height: `${Math.round((d.page_views / maxDailyViews) * 100)}%` }}
                  title={`${d.date}: ${d.page_views} views`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Top pages */}
      <TableLayout title="Top Pages" nested>
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead>Page</PortalTableHead>
              <PortalTableHead>Source</PortalTableHead>
              <PortalTableHead>Views</PortalTableHead>
              <PortalTableHead>Unique</PortalTableHead>
              <PortalTableHead>Avg. Time</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>
          <PortalTableBody>
            {topPages.length === 0 ? (
              <PortalTableEmpty colSpan={5} message="No page views yet" />
            ) : (
              topPages.map((page) => (
                <PortalTableRow key={page.url}>
                  <PortalTableCell className="traffic-cell-path">{urlPath(page.url)}</PortalTableCell>
                  <PortalTableCell>
                    <span
                      className={`traffic-source-badge ${isPortalUrl(page.url) ? 'is-portal' : 'is-main'}`}
                    >
                      {trafficSource(page.url)}
                    </span>
                  </PortalTableCell>
                  <PortalTableCell>{page.views}</PortalTableCell>
                  <PortalTableCell>{page.unique_views}</PortalTableCell>
                  <PortalTableCell>{formatDuration(page.avg_time)}</PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>
    </div>
  );
}
