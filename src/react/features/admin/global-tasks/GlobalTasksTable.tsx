import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  Calendar,
  User,
  Briefcase,
  Inbox,
  LayoutGrid,
  List,
  ChevronDown
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDateShort } from '@react/utils/formatDate';
import { cn } from '@react/lib/utils';
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
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { GLOBAL_TASKS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

const logger = createLogger('GlobalTasksTable');

interface Task {
  id: number;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: number;
  projectName?: string;
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

const TASK_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  pending: { label: 'To Do', icon: <Circle className="icon-sm" /> },
  in_progress: { label: 'In Progress', icon: <Clock className="icon-sm" /> },
  completed: { label: 'Done', icon: <CheckCircle className="icon-sm" /> },
  blocked: { label: 'Blocked', icon: <AlertTriangle className="icon-sm" /> },
  cancelled: { label: 'Cancelled', icon: <Circle className="icon-sm" /> }
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'var(--status-cancelled)' },
  high: { label: 'High', color: 'var(--status-pending)' },
  medium: { label: 'Medium', color: 'var(--status-active)' },
  low: { label: 'Low', color: 'var(--portal-text-muted)' }
};

interface GlobalTasksTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

// Filter function
function filterTask(
  task: Task,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(searchLower) ||
      task.description?.toLowerCase().includes(searchLower) ||
      task.projectName?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (task.status !== filters.status) return false;
  }

  if (filters.priority && filters.priority !== 'all') {
    if (task.priority !== filters.priority) return false;
  }

  return true;
}

// Sort function
function sortTasks(a: Task, b: Task, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'priority': {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return multiplier * ((priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
  }
  case 'dueDate':
    return multiplier * ((a.dueDate || '').localeCompare(b.dueDate || ''));
  case 'status':
    return multiplier * a.status.localeCompare(b.status);
  default:
    return 0;
  }
}

export function GlobalTasksTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: GlobalTasksTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);

  // Build headers helper with auth token
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
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  });
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Filtering and sorting
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Task>({
    storageKey: overviewMode ? undefined : 'admin_global_tasks',
    filters: GLOBAL_TASKS_FILTER_CONFIG,
    filterFn: filterTask,
    sortFn: sortTasks,
    defaultSort: { column: 'dueDate', direction: 'asc' }
  });

  // Apply filters
  const filteredTasks = useMemo(() => applyFilters(tasks), [applyFilters, tasks]);

  // Pagination - overview mode disables persistence
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_global_tasks_pagination',
    totalItems: filteredTasks.length,
    defaultPageSize
  });

  const paginatedTasks = useMemo(
    () => pagination.paginate(filteredTasks),
    [pagination, filteredTasks]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (task: Task) => task.id,
    items: paginatedTasks
  });

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.TASKS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load tasks');

      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setTasks((payload.tasks as Task[]) || []);
      setStats((payload.stats as TaskStats) || {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Status change handler
  const handleStatusChange = useCallback(async (taskId: number, newStatus: string) => {
    try {
      const response = await fetch(buildEndpoint.adminTask(taskId), {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update task');

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: newStatus as Task['status'] } : task
        )
      );
      showNotification?.('Task status updated', 'success');
    } catch (err) {
      logger.error('Failed to update task status:', err);
      showNotification?.('Failed to update task status', 'error');
    }
  }, [getHeaders, showNotification]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((t) => t.id);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.TASKS_BULK_DELETE, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Failed to delete tasks');

      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} task${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to delete tasks:', err);
      showNotification?.('Failed to delete tasks', 'error');
    }
  }, [selection, getHeaders, showNotification]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(TASK_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`
      })),
    []
  );

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      for (const task of selection.selectedItems) {
        await handleStatusChange(task.id, newStatus);
      }
      selection.clearSelection();
    },
    [selection, handleStatusChange]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="TASKS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'to do', variant: 'pending' },
            { value: stats.inProgress, label: 'in progress', variant: 'active' },
            { value: stats.overdue, label: 'overdue', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total - ${stats.pending} To Do - ${stats.inProgress} In Progress - ${stats.completed} Done${stats.overdue > 0 ? ` - ${stats.overdue} Overdue` : ''}`}
        />
      }
      actions={
        <>
          <div className="view-toggle">
            <button
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'active' : ''}
              title="List view"
            >
              <List className="icon-sm" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={viewMode === 'kanban' ? 'active' : ''}
              title="Board view"
            >
              <LayoutGrid className="icon-sm" />
            </button>
          </div>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search tasks..."
          />
          <FilterDropdown
            sections={GLOBAL_TASKS_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredTasks.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" title="Add Task" />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredTasks.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredTasks)}
          allSelected={selection.allSelected && selection.selectedCount === filteredTasks.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
      }
      pagination={
        viewMode === 'list' && !isLoading && filteredTasks.length > 0 ? (
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
      {viewMode === 'list' ? (
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleSelectAll}
                  aria-label="Select all"
                />
              </PortalTableHead>
              <PortalTableHead
                className="name-col"
                sortable
                sortDirection={sort?.column === 'title' ? sort.direction : null}
                onClick={() => toggleSort('title')}
              >
                Task
              </PortalTableHead>
              <PortalTableHead className="project-col">Project</PortalTableHead>
              <PortalTableHead
                className="priority-col"
                sortable
                sortDirection={sort?.column === 'priority' ? sort.direction : null}
                onClick={() => toggleSort('priority')}
              >
                Priority
              </PortalTableHead>
              <PortalTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'dueDate' ? sort.direction : null}
                onClick={() => toggleSort('dueDate')}
              >
                Due Date
              </PortalTableHead>
              <PortalTableHead className="actions-col">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={loadTasks} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : paginatedTasks.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
              />
            ) : (
              paginatedTasks.map((task) => (
                <PortalTableRow
                  key={task.id}
                  clickable
                  selected={selection.isSelected(task)}
                >
                  <PortalTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(task)}
                      onCheckedChange={() => selection.toggleSelection(task)}
                      aria-label={`Select ${task.title}`}
                    />
                  </PortalTableCell>
                  <PortalTableCell className="primary-cell name-cell">
                    <div className="cell-content">
                      {task.projectName && (
                        <span className="project-stacked">{task.projectName}</span>
                      )}
                      <span className="cell-title">{task.title}</span>
                      {task.description && (
                        <span className="cell-subtitle">{task.description}</span>
                      )}
                      <span className="priority-stacked">
                        <span
                          className="priority-indicator"
                          style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color }}
                        />
                        {PRIORITY_CONFIG[task.priority]?.label}
                      </span>
                      {task.dueDate && (
                        <span className="date-stacked">{formatDateShort(task.dueDate)}</span>
                      )}
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="project-cell">
                    {task.projectName && (
                      <span
                        onClick={() => onNavigate?.('projects', task.projectId != null ? String(task.projectId) : undefined)}
                        className="table-link"
                      >
                        {task.projectName}
                      </span>
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="priority-cell">
                    <div className="cell-with-icon">
                      <span
                        className="priority-indicator"
                        style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color }}
                      />
                      <span>{PRIORITY_CONFIG[task.priority]?.label}</span>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="status-dropdown-trigger">
                          <StatusBadge status={getStatusVariant(task.status)}>
                            {TASK_STATUS_CONFIG[task.status]?.label || task.status}
                          </StatusBadge>
                          <ChevronDown className="status-dropdown-caret" />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent sideOffset={0} align="start">
                        {Object.entries(TASK_STATUS_CONFIG)
                          .filter(([status]) => status !== task.status)
                          .map(([status, config]) => (
                            <PortalDropdownItem
                              key={status}
                              onClick={() => handleStatusChange(task.id, status)}
                            >
                              <StatusBadge status={getStatusVariant(status)} size="sm">
                                {config.label}
                              </StatusBadge>
                            </PortalDropdownItem>
                          ))}
                      </PortalDropdownContent>
                    </PortalDropdown>
                  </PortalTableCell>
                  <PortalTableCell className="date-cell">
                    {task.dueDate && (
                      <span
                        className={cn(
                          'date-value',
                          new Date(task.dueDate) < new Date() && task.status !== 'completed'
                            ? 'overdue'
                            : ''
                        )}
                      >
                        {formatDateShort(task.dueDate)}
                      </span>
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <IconButton action="view" title="View" />
                      <IconButton action="edit" title="Edit" />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      ) : (
        <TasksKanbanView
          tasks={filteredTasks}
          onStatusChange={handleStatusChange}
          isLoading={isLoading}
        />
      )}
    </TableLayout>
  );
}

function TasksKanbanView({
  tasks,
  onStatusChange: _onStatusChange,
  isLoading
}: {
  tasks: Task[];
  onStatusChange: (taskId: number, status: string) => void;
  isLoading: boolean;
}) {
  const columns = [
    { id: 'pending', label: 'To Do', color: 'var(--portal-text-secondary)' },
    { id: 'in_progress', label: 'In Progress', color: 'var(--status-active)' },
    { id: 'blocked', label: 'Blocked', color: 'var(--status-pending)' },
    { id: 'completed', label: 'Done', color: 'var(--status-completed)' }
  ];

  if (isLoading) {
    return (
      <div className="kanban-board kanban-loading">
        {columns.map((col) => (
          <div
            key={col.id}
            className="kanban-column kanban-column-skeleton"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="kanban-board">
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);

        return (
          <div
            key={column.id}
            className="kanban-column"
            data-status={column.id}
          >
            <div className="kanban-column-header">
              <div className="kanban-column-title-wrapper">
                <span
                  className="status-dot"
                  style={{ backgroundColor: column.color }}
                />
                <span className="kanban-column-title">
                  {column.label}
                </span>
                <span className="kanban-column-count">
                  {columnTasks.length}
                </span>
              </div>
            </div>
            <div className="kanban-column-content">
              {columnTasks.length === 0 ? (
                <div className="kanban-empty-state">
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="kanban-card"
                  >
                    <div className="kanban-card-header">
                      <span
                        className="priority-indicator"
                        style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color }}
                      />
                      <span className="kanban-card-title">
                        {task.title}
                      </span>
                    </div>
                    {task.projectName && (
                      <div className="kanban-card-project">
                        <Briefcase className="icon-xs" />
                        {task.projectName}
                      </div>
                    )}
                    <div className="task-meta">
                      {task.dueDate && (
                        <span className="task-due-date">
                          <Calendar className="icon-xs" />
                          {formatDateShort(task.dueDate)}
                        </span>
                      )}
                      {task.assignedToName && (
                        <span className="task-assignee">
                          <User className="icon-xs" />
                          {task.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
