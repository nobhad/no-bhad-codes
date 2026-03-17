import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDateShort } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
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
import { useListFetch } from '@react/factories/useDataFetch';
import { TIME_TRACKING_FILTER_CONFIG, TIME_TRACKING_DATE_RANGE_OPTIONS, TIME_TRACKING_BILLABLE_OPTIONS } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { unwrapApiData, apiPost } from '@/utils/api-client';
import { CreateTimeEntryModal } from '../modals/CreateEntityModals';

const logger = createLogger('TimeTrackingTable');

const DEFAULT_TIME_STATS: TimeStats = {
  totalHours: 0,
  billableHours: 0,
  billedHours: 0,
  unbilledHours: 0,
  totalValue: 0
};

interface TimeEntry {
  id: number;
  description: string;
  projectId?: number;
  projectName?: string;
  taskId?: number;
  taskName?: string;
  userId: number;
  userName: string;
  date: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  billable: boolean;
  billed: boolean;
  hourlyRate?: number;
}

interface TimeStats {
  totalHours: number;
  billableHours: number;
  billedHours: number;
  unbilledHours: number;
  totalValue: number;
}

interface TimeTrackingTableProps {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

function filterTimeEntry(
  entry: TimeEntry,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !entry.description.toLowerCase().includes(query) &&
      !entry.projectName?.toLowerCase().includes(query) &&
      !entry.taskName?.toLowerCase().includes(query)
    ) {
      return false;
    }
  }

  const billableFilter = filters.billable;
  if (billableFilter && billableFilter.length > 0) {
    if (billableFilter.includes('billable') && !entry.billable) return false;
    if (billableFilter.includes('non-billable') && entry.billable) return false;
  }

  return true;
}

function sortTimeEntries(a: TimeEntry, b: TimeEntry, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'date':
    return multiplier * (a.date + a.startTime).localeCompare(b.date + b.startTime);
  case 'duration':
    return multiplier * (a.duration - b.duration);
  case 'project':
    return multiplier * (a.projectName || '').localeCompare(b.projectName || '');
  default:
    return 0;
  }
}

export function TimeTrackingTable({ projectId, onNavigate, getAuthToken, showNotification }: TimeTrackingTableProps) {
  const containerRef = useFadeIn();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Active timer
  const [activeTimer, setActiveTimer] = useState<{
    entryId: string;
    startedAt: Date;
    description: string;
    projectName?: string;
  } | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  // Date range affects API call, stays outside the hook
  const [dateRange, setDateRange] = useState<string>('week');

  // Build dynamic endpoint with query params
  const timeEntriesEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    params.set('range', dateRange);
    return `${API_ENDPOINTS.ADMIN.TIME_ENTRIES}?${params}`;
  }, [projectId, dateRange]);

  const { data, isLoading, error, refetch } = useListFetch<TimeEntry, TimeStats>({
    endpoint: timeEntriesEndpoint,
    getAuthToken,
    defaultStats: DEFAULT_TIME_STATS,
    itemsKey: 'entries',
    deps: [timeEntriesEndpoint]
  });
  const entries = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_TIME_STATS, [data]);

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<TimeEntry>({
    storageKey: 'admin_time_tracking',
    filters: TIME_TRACKING_FILTER_CONFIG,
    filterFn: filterTimeEntry,
    sortFn: sortTimeEntries,
    defaultSort: { column: 'date', direction: 'desc' }
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeTimer.startedAt.getTime()) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        setTimerDisplay(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  async function startTimer() {
    try {
      const response = await apiPost(API_ENDPOINTS.ADMIN.TIME_ENTRIES_START, { projectId });

      if (!response.ok) throw new Error('Failed to start timer');

      const result = unwrapApiData<Record<string, unknown>>(await response.json());
      setActiveTimer({
        entryId: result.entryId as string,
        startedAt: new Date(),
        description: '',
        projectName: result.projectName as string | undefined
      });
    } catch (err) {
      logger.error('Failed to start timer:', err);
      showNotification?.('Failed to start timer', 'error');
    }
  }

  async function stopTimer() {
    if (!activeTimer) return;

    try {
      const response = await apiPost(buildEndpoint.adminTimeEntryStop(activeTimer.entryId));

      if (!response.ok) throw new Error('Failed to stop timer');

      setActiveTimer(null);
      setTimerDisplay('00:00:00');
      refetch();
      showNotification?.('Timer stopped', 'success');
    } catch (err) {
      logger.error('Failed to stop timer:', err);
      showNotification?.('Failed to stop timer', 'error');
    }
  }

  const filteredEntries = useMemo(() => applyFilters(entries), [applyFilters, entries]);

  const pagination = usePagination({ storageKey: 'admin_time_tracking_pagination', totalItems: filteredEntries.length });
  const paginatedEntries = filteredEntries.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  // Combine hook filter state with external dateRange for FilterDropdown
  function handleFilterChange(key: string, value: string) {
    if (key === 'dateRange') {
      setDateRange(value);
    } else {
      setFilter(key, value);
    }
  }

  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const res = await apiPost(API_ENDPOINTS.ADMIN.TIME_ENTRIES, formData);
      if (res.ok) {
        showNotification?.('Time entry created successfully', 'success');
        setCreateOpen(false);
        refetch();
      } else {
        showNotification?.('Failed to create time entry', 'error');
      }
    } catch {
      showNotification?.('Failed to create time entry', 'error');
    } finally {
      setCreateLoading(false);
    }
  }, [showNotification, refetch]);

  return (
    <div>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="TIME TRACKING"
        stats={
          <TableStats
            items={[
              { value: formatDuration(stats.totalHours * 60), label: 'total' },
              { value: formatDuration(stats.billableHours * 60), label: 'billable', variant: 'completed' },
              { value: formatDuration(stats.unbilledHours * 60), label: 'unbilled', variant: 'pending' },
              { value: formatCurrency(stats.totalValue), label: 'value' }
            ]}
            tooltip={`${formatDuration(stats.totalHours * 60)} Total • ${formatDuration(stats.billableHours * 60)} Billable • ${formatDuration(stats.unbilledHours * 60)} Unbilled • ${formatCurrency(stats.totalValue)} Value`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search entries..."
            />
            <FilterDropdown
              sections={[
                { key: 'dateRange', label: 'DATE RANGE', options: TIME_TRACKING_DATE_RANGE_OPTIONS },
                { key: 'billable', label: 'BILLABLE', options: TIME_TRACKING_BILLABLE_OPTIONS }
              ]}
              values={{ ...filterValues, dateRange: dateRange ? [dateRange] : [] }}
              onChange={handleFilterChange}
            />
            {!activeTimer && (
              <IconButton action="start" onClick={startTimer} title="Start Timer" />
            )}
            <IconButton action="add" onClick={() => setCreateOpen(true)} title="Add Entry" />
          </>
        }
        bulkActions={
          activeTimer ? (
            <div className="active-timer-banner">
              <div className="timer-status">
                <div className="timer-pulse" />
                <div className="timer-info">
                  <div className="timer-display">{timerDisplay}</div>
                  <div className="timer-project">{activeTimer.projectName || 'No project'}</div>
                </div>
              </div>
              <IconButton action="stop" variant="danger" onClick={stopTimer} title="Stop Timer" />
            </div>
          ) : undefined
        }
        pagination={
          !isLoading && filteredEntries.length > 0 ? (
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
              <PortalTableHead>Description</PortalTableHead>
              <PortalTableHead
                sortable
                sortDirection={sort?.column === 'project' ? sort.direction : null}
                onClick={() => toggleSort('project')}
              >
              Project
              </PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'date' ? sort.direction : null}
                onClick={() => toggleSort('date')}
              >
              Date
              </PortalTableHead>
              <PortalTableHead>Time</PortalTableHead>
              <PortalTableHead
                className="text-right"
                sortable
                sortDirection={sort?.column === 'duration' ? sort.direction : null}
                onClick={() => toggleSort('duration')}
              >
              Duration
              </PortalTableHead>
              <PortalTableHead className="text-center">Billable</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : paginatedEntries.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No entries match your filters' : 'No time entries yet'}
              />
            ) : (
              paginatedEntries.map((entry) => (
                <PortalTableRow key={entry.id} clickable>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-content">
                      <span className="cell-title">{entry.description || 'No description'}</span>
                      {entry.taskName && <span className="cell-subtitle">{entry.taskName}</span>}
                    </div>
                  </PortalTableCell>
                  <PortalTableCell>
                    {entry.projectName && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.('projects', entry.projectId != null ? String(entry.projectId) : undefined); }}
                        className="link-btn"
                      >
                        {entry.projectName}
                      </button>
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="date-col">{formatDateShort(entry.date)}</PortalTableCell>
                  <PortalTableCell className="mono-text">
                    {entry.startTime} - {entry.endTime || 'ongoing'}
                  </PortalTableCell>
                  <PortalTableCell className="text-right mono-text">{formatDuration(entry.duration)}</PortalTableCell>
                  <PortalTableCell className="text-center">
                    <span className={entry.billable ? 'status-dot status-completed' : 'status-dot status-muted'} />
                  </PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      <IconButton action="view" title="View entry" onClick={() => onNavigate?.('time-entry', String(entry.id))} />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>
      <CreateTimeEntryModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        loading={createLoading}
        projectOptions={[]}
      />
    </div>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}
