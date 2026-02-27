import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Inbox, CheckSquare, LayoutList, LayoutGrid } from 'lucide-react';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
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
import { formatDate } from '@react/utils/formatDate';
import { usePagination } from '@react/hooks/usePagination';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee_id: string | null;
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
}

type SortField = 'title' | 'status' | 'priority' | 'assignee_name' | 'due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'board';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'var(--portal-text-muted)',
  medium: 'var(--status-info)',
  high: 'var(--status-warning)',
  urgent: 'var(--status-danger)',
};

export function TasksManager({ clientId, projectId, assigneeId, onNavigate }: TasksManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const containerRef = useFadeIn<HTMLDivElement>();

  useEffect(() => {
    fetchTasks();
  }, [clientId, projectId, assigneeId]);

  async function fetchTasks() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (clientId) params.append('client_id', clientId);
      if (projectId) params.append('project_id', projectId);
      if (assigneeId) params.append('assignee_id', assigneeId);

      const response = await fetch(`/api/admin/tasks?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.description && t.description.toLowerCase().includes(query)) ||
          (t.assignee_name && t.assignee_name.toLowerCase().includes(query)) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter && priorityFilter !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }

    filtered.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          aVal = priorityOrder[a.priority];
          bVal = priorityOrder[b.priority];
          break;
        case 'assignee_name':
          aVal = (a.assignee_name || '').toLowerCase();
          bVal = (b.assignee_name || '').toLowerCase();
          break;
        case 'due_date':
          aVal = a.due_date || '';
          bVal = b.due_date || '';
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortField, sortDirection]);

  const pagination = usePagination({ totalItems: filteredTasks.length });
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
      blocked: [],
    };

    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function getStatusLabel(status: Task['status']): string {
    const labels: Record<Task['status'], string> = {
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'In Review',
      completed: 'Completed',
      blocked: 'Blocked',
    };
    return labels[status];
  }

  function getPriorityLabel(priority: Task['priority']): string {
    const labels: Record<Task['priority'], string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
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

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || priorityFilter !== 'all';

  function handleFilterChange(key: string, value: string) {
    if (key === 'status') {
      setStatusFilter(value);
    } else if (key === 'priority') {
      setPriorityFilter(value);
    }
  }

  function renderBoardView() {
    const statusColumns: Task['status'][] = ['todo', 'in_progress', 'review', 'completed', 'blocked'];

    return (
      <div className="board-view">
        {statusColumns.map((status) => (
          <div key={status} className="board-column">
            <div className="board-column-header">
              <h3 className="board-column-title">{getStatusLabel(status)}</h3>
              <span className="board-column-count">{tasksByStatus[status].length}</span>
            </div>
            <div className="board-column-content">
              {tasksByStatus[status].map((task) => (
                <div
                  key={task.id}
                  className="board-card"
                  onClick={() => onNavigate?.('task-detail', task.id)}
                >
                  <div className="board-card-header">
                    <div
                      className="priority-dot"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                    />
                    <span className="board-card-title">{task.title}</span>
                  </div>
                  {task.due_date && (
                    <div className={`board-card-due ${isOverdue(task) ? 'text-danger' : ''}`}>
                      Due: {formatDate(task.due_date)}
                    </div>
                  )}
                  {task.assignee_name && (
                    <div className="board-card-assignee">{task.assignee_name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
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
            { value: stats.inProgress, label: 'in progress', variant: 'pending', hideIfZero: true },
            { value: stats.completed, label: 'completed', variant: 'completed', hideIfZero: true },
            { value: stats.blocked, label: 'blocked', variant: 'cancelled', hideIfZero: true },
            { value: stats.overdue, label: 'overdue', variant: 'overdue', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.todo} To Do • ${stats.inProgress} In Progress • ${stats.completed} Completed • ${stats.blocked} Blocked • ${stats.overdue} Overdue`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search tasks..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_OPTIONS },
              { key: 'priority', label: 'PRIORITY', options: PRIORITY_OPTIONS },
            ]}
            values={{ status: statusFilter, priority: priorityFilter }}
            onChange={handleFilterChange}
          />
          <div className="view-toggle">
            <button
              className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <LayoutList />
            </button>
            <button
              className={`icon-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
              title="Board view"
            >
              <LayoutGrid />
            </button>
          </div>
          <PortalButton variant="primary" size="sm" onClick={() => onNavigate?.('task-create')}>
            <CheckSquare className="btn-icon" />
            Create Task
          </PortalButton>
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={fetchTasks}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        viewMode === 'list' && !loading && filteredTasks.length > 0 ? (
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
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead
                sortable
                sortDirection={sortField === 'title' ? sortDirection : null}
                onClick={() => handleSort('title')}
              >
                Task
              </AdminTableHead>
              <AdminTableHead
                sortable
                sortDirection={sortField === 'status' ? sortDirection : null}
                onClick={() => handleSort('status')}
              >
                Status
              </AdminTableHead>
              <AdminTableHead
                sortable
                sortDirection={sortField === 'priority' ? sortDirection : null}
                onClick={() => handleSort('priority')}
              >
                Priority
              </AdminTableHead>
              <AdminTableHead
                sortable
                sortDirection={sortField === 'assignee_name' ? sortDirection : null}
                onClick={() => handleSort('assignee_name')}
              >
                Assignee
              </AdminTableHead>
              <AdminTableHead>Project</AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sortField === 'due_date' ? sortDirection : null}
                onClick={() => handleSort('due_date')}
              >
                Due Date
              </AdminTableHead>
              <AdminTableHead className="text-right">Hours</AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!loading}>
            {loading ? (
              <AdminTableLoading colSpan={8} rows={5} />
            ) : paginatedTasks.length === 0 ? (
              <AdminTableEmpty
                colSpan={8}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
              />
            ) : (
              paginatedTasks.map((task) => (
                <AdminTableRow key={task.id} clickable>
                  <AdminTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <div
                        className="priority-dot"
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
                  </AdminTableCell>
                  <AdminTableCell className="status-cell">
                    <StatusBadge status={getStatusVariant(task.status)} size="sm">
                      {getStatusLabel(task.status)}
                    </StatusBadge>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span
                      className="priority-label"
                      style={{ color: PRIORITY_COLORS[task.priority] }}
                    >
                      {getPriorityLabel(task.priority)}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>
                    {task.assignee_name || <span className="text-muted">Unassigned</span>}
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="cell-content">
                      {task.client_name && (
                        <span className="cell-subtitle">{task.client_name}</span>
                      )}
                      <span className="cell-title">{task.project_name || '-'}</span>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="date-cell">
                    <span className={isOverdue(task) ? 'text-danger' : ''}>
                      {formatDate(task.due_date)}
                      {isOverdue(task) && <span className="overdue-label">Overdue</span>}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell className="text-right">
                    <span className="text-muted">
                      {task.actual_hours !== null ? `${task.actual_hours}` : '-'}
                      {task.estimated_hours !== null && (
                        <span>/{task.estimated_hours}h</span>
                      )}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <PortalButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate?.('task-detail', task.id)}
                      >
                        View
                      </PortalButton>
                      <PortalButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onNavigate?.('task-edit', task.id)}
                      >
                        Edit
                      </PortalButton>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      ) : (
        renderBoardView()
      )}
    </TableLayout>
  );
}
