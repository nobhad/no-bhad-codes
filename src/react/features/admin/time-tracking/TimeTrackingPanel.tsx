import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Clock,
  Play,
  Square,
  Inbox,
} from 'lucide-react';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDateShort } from '@react/utils/formatDate';
import { PortalButton } from '@react/components/portal/PortalButton';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
} from '@react/components/portal/AdminTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';

interface TimeEntry {
  id: string;
  description: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskName?: string;
  userId: string;
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

interface TimeTrackingPanelProps {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

const BILLABLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Entries' },
  { value: 'billable', label: 'Billable' },
  { value: 'non-billable', label: 'Non-Billable' },
];

export function TimeTrackingPanel({ projectId, onNavigate }: TimeTrackingPanelProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<TimeStats>({
    totalHours: 0,
    billableHours: 0,
    billedHours: 0,
    unbilledHours: 0,
    totalValue: 0,
  });

  // Active timer
  const [activeTimer, setActiveTimer] = useState<{
    entryId: string;
    startedAt: Date;
    description: string;
    projectName?: string;
  } | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<string>('week');
  const [billableFilter, setBillableFilter] = useState<string>('all');

  // Sorting
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>({
    column: 'date',
    direction: 'desc',
  });

  useEffect(() => {
    loadTimeEntries();
  }, [projectId, dateRange]);

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

  async function loadTimeEntries() {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      params.set('range', dateRange);

      const response = await fetch(`/api/admin/time-entries?${params}`);
      if (!response.ok) throw new Error('Failed to load time entries');

      const data = await response.json();
      setEntries(data.entries || []);
      setStats(data.stats || {
        totalHours: 0,
        billableHours: 0,
        billedHours: 0,
        unbilledHours: 0,
        totalValue: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time entries');
    } finally {
      setIsLoading(false);
    }
  }

  async function startTimer() {
    try {
      const response = await fetch('/api/admin/time-entries/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) throw new Error('Failed to start timer');

      const data = await response.json();
      setActiveTimer({
        entryId: data.entryId,
        startedAt: new Date(),
        description: '',
        projectName: data.projectName,
      });
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  }

  async function stopTimer() {
    if (!activeTimer) return;

    try {
      const response = await fetch(`/api/admin/time-entries/${activeTimer.entryId}/stop`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to stop timer');

      setActiveTimer(null);
      setTimerDisplay('00:00:00');
      loadTimeEntries();
    } catch (err) {
      console.error('Failed to stop timer:', err);
    }
  }

  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.description.toLowerCase().includes(query) ||
          entry.projectName?.toLowerCase().includes(query) ||
          entry.taskName?.toLowerCase().includes(query)
      );
    }

    if (billableFilter !== 'all') {
      result = result.filter((entry) =>
        billableFilter === 'billable' ? entry.billable : !entry.billable
      );
    }

    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (sort.column) {
          case 'date':
            aVal = a.date + a.startTime;
            bVal = b.date + b.startTime;
            break;
          case 'duration':
            aVal = a.duration;
            bVal = b.duration;
            break;
          case 'project':
            aVal = a.projectName || '';
            bVal = b.projectName || '';
            break;
        }

        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [entries, searchQuery, billableFilter, sort]);

  const pagination = usePagination({ totalItems: filteredEntries.length });
  const paginatedEntries = filteredEntries.slice(
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

  const hasActiveFilters = searchQuery || billableFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="TIME TRACKING"
      stats={
        <TableStats
          items={[
            { value: formatDuration(stats.totalHours * 60), label: 'total' },
            { value: formatDuration(stats.billableHours * 60), label: 'billable', variant: 'completed', hideIfZero: true },
            { value: formatDuration(stats.unbilledHours * 60), label: 'unbilled', variant: 'pending', hideIfZero: true },
            { value: formatCurrency(stats.totalValue), label: 'value' },
          ]}
          tooltip={`${formatDuration(stats.totalHours * 60)} Total • ${formatDuration(stats.billableHours * 60)} Billable • ${formatDuration(stats.unbilledHours * 60)} Unbilled • ${formatCurrency(stats.totalValue)} Value`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search entries..."
          />
          <FilterDropdown
            sections={[
              { key: 'dateRange', label: 'DATE RANGE', options: DATE_RANGE_OPTIONS },
              { key: 'billable', label: 'BILLABLE', options: BILLABLE_FILTER_OPTIONS },
            ]}
            values={{ dateRange, billable: billableFilter }}
            onChange={(key, value) => {
              if (key === 'dateRange') setDateRange(value);
              if (key === 'billable') setBillableFilter(value);
            }}
          />
          {!activeTimer && (
            <PortalButton variant="primary" size="sm" onClick={startTimer}>
              <Play className="btn-icon" />
              Start Timer
            </PortalButton>
          )}
          <PortalButton variant="secondary" size="sm">
            <Plus className="btn-icon" />
            Add Entry
          </PortalButton>
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
            <PortalButton variant="danger" size="sm" onClick={stopTimer}>
              <Square className="btn-icon" />
              Stop
            </PortalButton>
          </div>
        ) : undefined
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadTimeEntries}>
              Retry
            </PortalButton>
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
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead>Description</AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'project' ? sort.direction : null}
              onClick={() => toggleSort('project')}
            >
              Project
            </AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'date' ? sort.direction : null}
              onClick={() => toggleSort('date')}
            >
              Date
            </AdminTableHead>
            <AdminTableHead>Time</AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'duration' ? sort.direction : null}
              onClick={() => toggleSort('duration')}
            >
              Duration
            </AdminTableHead>
            <AdminTableHead className="text-center">Billable</AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedEntries.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No entries match your filters' : 'No time entries yet'}
            />
          ) : (
            paginatedEntries.map((entry) => (
              <AdminTableRow key={entry.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-content">
                    <span className="cell-title">{entry.description || 'No description'}</span>
                    {entry.taskName && <span className="cell-subtitle">{entry.taskName}</span>}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  {entry.projectName ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.('projects', entry.projectId); }}
                      className="link-btn"
                    >
                      {entry.projectName}
                    </button>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="date-cell">{formatDateShort(entry.date)}</AdminTableCell>
                <AdminTableCell className="mono-text">
                  {entry.startTime} - {entry.endTime || 'ongoing'}
                </AdminTableCell>
                <AdminTableCell className="text-right mono-text">{formatDuration(entry.duration)}</AdminTableCell>
                <AdminTableCell className="text-center">
                  <span className={entry.billable ? 'status-dot status-completed' : 'status-dot status-muted'} />
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <button className="icon-btn" title="Edit entry">
                      <Clock />
                    </button>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>
    </TableLayout>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

export default TimeTrackingPanel;
