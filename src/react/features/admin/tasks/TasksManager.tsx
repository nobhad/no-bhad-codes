import * as React from 'react';
import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { PortalButton } from '@react/components/portal/PortalButton';
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
import { formatDate } from '@react/utils/formatDate';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { TASKS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id: number | null;
  assignee_name: string | null;
  client_name: string | null;
  project_name: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface TasksManagerProps {
  clientId?: string;
  projectId?: string;
  assigneeId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type ViewMode = 'list' | 'board';

const PRIORITY_ORDER: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'var(--color-text-tertiary)',
  medium: 'var(--status-info)',
  high: 'var(--status-warning)',
  urgent: 'var(--status-danger)'
};

function filterTask(
  task: Task,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !task.title.toLowerCase().includes(query) &&
      !(task.description && task.description.toLowerCase().includes(query)) &&
      !(task.assignee_name && task.assignee_name.toLowerCase().includes(query)) &&
      !task.tags.some((tag) => tag.toLowerCase().includes(query))
    ) {
      return false;
    }
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(task.status)) return false;
  }

  const priorityFilter = filters.priority;
  if (priorityFilter && priorityFilter.length > 0) {
    if (!priorityFilter.includes(task.priority)) return false;
  }

  return true;
}

function sortTasks(a: Task, b: Task, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  case 'status':
    return multiplier * a.status.localeCompare(b.status);
  case 'priority':
    return multiplier * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  case 'assignee_name':
    return multiplier * (a.assignee_name || '').toLowerCase().localeCompare((b.assignee_name || '').toLowerCase());
  case 'due_date':
    return multiplier * (a.due_date || '').localeCompare(b.due_date || '');
  case 'created_at':
    return multiplier * a.created_at.localeCompare(b.created_at);
  default:
    return 0;
  }
}

export function TasksManager({ clientId, projectId, assigneeId, onNavigate, getAuthToken, showNotification: _showNotification }: TasksManagerProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');

  // Build endpoint with query params
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (clientId) params.append('client_id', clientId);
    if (projectId) params.append('project_id', projectId);
    if (assigneeId) params.append('assignee_id', assigneeId);
    const qs = params.toString();
    return qs ? `${API_ENDPOINTS.ADMIN.TASKS}?${qs}` : API_ENDPOINTS.ADMIN.TASKS;
  }, [clientId, projectId, assigneeId]);

  const { data, isLoading, error, refetch } = useListFetch<Task>({
    endpoint,
    getAuthToken,
    itemsKey: 'tasks',
    deps: [endpoint]
  });
  const tasks = useMemo(() => data?.items ?? [], [data]);

  const containerRef = useFadeIn<HTMLDivElement>();

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
    storageKey: 'admin_tasks',
    filters: TASKS_FILTER_CONFIG,
    filterFn: filterTask,
    sortFn: sortTasks,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  const filteredTasks = useMemo(() => applyFilters(tasks), [applyFilters, tasks]);

  const pagination = usePagination({ storageKey: 'admin_tasks_pagination', totalItems: filteredTasks.length });
  const paginatedTasks = filteredTasks.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<Task['status'], Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      completed: [],
      blocked: []
    };

    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  function getStatusLabel(status: Task['status']): string {
    const labels: Record<Task['status'], string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'In Review',
      completed: 'Completed',
      blocked: 'Blocked'
    };
    return labels[status];
  }

  function getPriorityLabel(priority: Task['priority']): string {
    const labels: Record<Task['priority'], string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent'
    };
    return labels[priority];
  }

  function isOverdue(task: Task): boolean {
    if (!task.due_date || task.status === 'completed') return false;
    return new Date(task.due_date) < new Date();
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    const overdue = tasks.filter((t) => isOverdue(t)).length;

    return { total, todo, inProgress, completed, blocked, overdue };
  }, [tasks]);

  function renderBoardView() {
    const statusColumns: Task['status'][] = ['todo', 'in_progress', 'review', 'completed', 'blocked'];

    return (
      <div className="kanban-board">
        {statusColumns.map((status) => (
          <div key={status} className="kanban-column" data-status={status}>
            <div className="kanban-column-header">
              <span className="kanban-column-title">{getStatusLabel(status)}</span>
              <span className="kanban-column-count">{tasksByStatus[status].length}</span>
            </div>
            <div className="kanban-column-content">
              {tasksByStatus[status].length === 0 ? (
                <div className="empty-state">No tasks</div>
              ) : (
                tasksByStatus[status].map((task) => (
                  <div
                    key={task.id}
                    className="kanban-card"
                    onClick={() => onNavigate?.('task-detail', String(task.id))}
                  >
                    <div className="kanban-card-type">
                      <div
                        className="priority-dot"
                        data-priority={task.priority}
                        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                      />
                    </div>
                    <div className="kanban-card-title">{task.title}</div>
                    {(task.assignee_name || task.due_date) && (
                      <div className="kanban-card-subtitle">
                        {task.assignee_name}
                        {task.assignee_name && task.due_date && ' · '}
                        {task.due_date && (
                          <span className={isOverdue(task) ? 'text-danger' : ''}>
                            {formatDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="table-loading-state">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="TASKS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.inProgress, label: 'in progress', variant: 'pending' },
            { value: stats.completed, label: 'completed', variant: 'completed' },
            { value: stats.blocked, label: 'blocked', variant: 'cancelled' },
            { value: stats.overdue, label: 'overdue', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total • ${stats.todo} To Do • ${stats.inProgress} In Progress • ${stats.completed} Completed • ${stats.blocked} Blocked • ${stats.overdue} Overdue`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search tasks..."
          />
          <FilterDropdown
            sections={TASKS_FILTER_CONFIG}
            values={filterValues}
            onChange={setFilter}
          />
          <div className="view-toggle">
            <IconButton
              icon="list"
              title="List view"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'active' : undefined}
            />
            <IconButton
              icon="layout-dashboard"
              title="Board view"
              onClick={() => setViewMode('board')}
              className={viewMode === 'board' ? 'active' : undefined}
            />
          </div>
          <IconButton action="add" onClick={() => onNavigate?.('task-create')} title="Create Task" />
        </>
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
              <PortalTableHead
                sortable
                sortDirection={sort?.column === 'title' ? sort.direction : null}
                onClick={() => toggleSort('title')}
              >
                Task
              </PortalTableHead>
              <PortalTableHead
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </PortalTableHead>
              <PortalTableHead
                className="priority-col"
                sortable
                sortDirection={sort?.column === 'priority' ? sort.direction : null}
                onClick={() => toggleSort('priority')}
              >
                Priority
              </PortalTableHead>
              <PortalTableHead className="project-col">Project</PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'due_date' ? sort.direction : null}
                onClick={() => toggleSort('due_date')}
              >
                Due Date
              </PortalTableHead>
              <PortalTableHead className="text-right">Hours</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={refetch} />
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
                <PortalTableRow key={task.id} clickable>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <div
                        className="priority-dot"
                        data-priority={task.priority}
                        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                        title={getPriorityLabel(task.priority)}
                      />
                      <div className="cell-content">
                        <span className="cell-title">{task.title}</span>
                        {task.tags.length > 0 && (
                          <div className="cell-tags">
                            {task.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="tag-badge">{tag}</span>
                            ))}
                            {task.tags.length > 3 && (
                              <span className="tag-more">+{task.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="status-cell">
                    <StatusBadge status={getStatusVariant(task.status)} size="sm">
                      {getStatusLabel(task.status)}
                    </StatusBadge>
                  </PortalTableCell>
                  <PortalTableCell className="priority-cell">
                    <span
                      className="priority-label"
                      data-priority={task.priority}
                      style={{ color: PRIORITY_COLORS[task.priority] }}
                    >
                      {getPriorityLabel(task.priority)}
                    </span>
                  </PortalTableCell>
                  <PortalTableCell className="project-cell">
                    <div className="cell-content">
                      {task.client_name && (
                        <span className="cell-subtitle">{task.client_name}</span>
                      )}
                      {task.project_name && <span className="cell-title">{task.project_name}</span>}
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="date-cell">
                    <span className={isOverdue(task) ? 'text-danger' : ''}>
                      {formatDate(task.due_date)}
                      {isOverdue(task) && <span className="overdue-label">Overdue</span>}
                    </span>
                  </PortalTableCell>
                  <PortalTableCell className="text-right">
                    <span className="text-muted">
                      {task.actual_hours !== null ? `${task.actual_hours}` : ''}
                      {task.estimated_hours !== null && (
                        <span>/{task.estimated_hours}h</span>
                      )}
                    </span>
                  </PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <PortalButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate?.('task-detail', String(task.id))}
                      >
                        View
                      </PortalButton>
                      <PortalButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onNavigate?.('task-edit', String(task.id))}
                      >
                        Edit
                      </PortalButton>
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      ) : (
        renderBoardView()
      )}
    </TableLayout>
  );
}
