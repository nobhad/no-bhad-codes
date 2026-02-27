import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  CheckCircle,
  Circle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  Calendar,
  User,
  Briefcase,
  Inbox,
  LayoutGrid,
  List,
} from 'lucide-react';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDateShort } from '@react/utils/formatDate';
import { cn } from '@react/lib/utils';
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
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId?: string;
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
  cancelled: { label: 'Cancelled', icon: <Circle className="icon-sm" /> },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'var(--status-cancelled)' },
  high: { label: 'High', color: 'var(--status-pending)' },
  medium: { label: 'Medium', color: 'var(--status-active)' },
  low: { label: 'Low', color: 'var(--portal-text-muted)' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Done' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

interface GlobalTasksTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function GlobalTasksTable({ onNavigate }: GlobalTasksTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  // Sorting
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/tasks');
      if (!response.ok) throw new Error('Failed to load tasks');

      const data = await response.json();
      setTasks(data.tasks || []);
      setStats(data.stats || {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.projectName?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((task) => task.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((task) => task.priority === priorityFilter);
    }

    // Sort
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (sort.column) {
          case 'title':
            aVal = a.title;
            bVal = b.title;
            break;
          case 'priority':
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            aVal = priorityOrder[a.priority] ?? 4;
            bVal = priorityOrder[b.priority] ?? 4;
            break;
          case 'dueDate':
            aVal = a.dueDate || '';
            bVal = b.dueDate || '';
            break;
          case 'status':
            aVal = a.status;
            bVal = b.status;
            break;
        }

        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tasks, searchQuery, statusFilter, priorityFilter, sort]);

  const pagination = usePagination({ totalItems: filteredTasks.length });
  const paginatedTasks = filteredTasks.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function toggleSort(column: string) {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc'
          ? { column, direction: 'desc' }
          : null;
      }
      return { column, direction: 'asc' };
    });
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update task');

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: newStatus as Task['status'] } : task
        )
      );
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  }

  function handleFilterChange(key: string, value: string) {
    if (key === 'status') {
      setStatusFilter(value);
    } else if (key === 'priority') {
      setPriorityFilter(value);
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="TASKS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'to do', variant: 'pending', hideIfZero: true },
            { value: stats.inProgress, label: 'in progress', variant: 'active', hideIfZero: true },
            { value: stats.overdue, label: 'overdue', variant: 'overdue', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total - ${stats.pending} To Do - ${stats.inProgress} In Progress - ${stats.completed} Done${stats.overdue > 0 ? ` - ${stats.overdue} Overdue` : ''}`}
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
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
              { key: 'priority', label: 'PRIORITY', options: PRIORITY_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter, priority: priorityFilter }}
            onChange={handleFilterChange}
          />
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
          <PortalButton variant="primary" size="sm">
            <Plus className="btn-icon" />
            Add Task
          </PortalButton>
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadTasks}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead
                sortable
                sortDirection={sort?.column === 'title' ? sort.direction : null}
                onClick={() => toggleSort('title')}
              >
                Task
              </AdminTableHead>
              <AdminTableHead>Project</AdminTableHead>
              <AdminTableHead
                sortable
                sortDirection={sort?.column === 'priority' ? sort.direction : null}
                onClick={() => toggleSort('priority')}
              >
                Priority
              </AdminTableHead>
              <AdminTableHead
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </AdminTableHead>
              <AdminTableHead>Assigned To</AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'dueDate' ? sort.direction : null}
                onClick={() => toggleSort('dueDate')}
              >
                Due Date
              </AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={7} rows={5} />
            ) : paginatedTasks.length === 0 ? (
              <AdminTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
              />
            ) : (
              paginatedTasks.map((task) => (
                <AdminTableRow key={task.id} clickable>
                  <AdminTableCell className="primary-cell">
                    <div className="cell-content">
                      <span className="cell-title">{task.title}</span>
                      {task.description && (
                        <span className="cell-subtitle">{task.description}</span>
                      )}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    {task.projectName ? (
                      <button
                        onClick={() => onNavigate?.('projects', task.projectId)}
                        className="link-btn"
                      >
                        {task.projectName}
                      </button>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="cell-with-icon">
                      <span
                        className="priority-indicator"
                        style={{ backgroundColor: PRIORITY_CONFIG[task.priority]?.color }}
                      />
                      <span>{PRIORITY_CONFIG[task.priority]?.label}</span>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="status-trigger-btn">
                          <StatusBadge status={getStatusVariant(task.status)}>
                            {TASK_STATUS_CONFIG[task.status]?.label || task.status}
                          </StatusBadge>
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent>
                        {Object.entries(TASK_STATUS_CONFIG).map(([status, config]) => (
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
                  </AdminTableCell>
                  <AdminTableCell>
                    {task.assignedToName || (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="date-cell">
                    {task.dueDate ? (
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
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <button className="icon-btn">
                        <MoreHorizontal />
                      </button>
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
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
  onStatusChange,
  isLoading,
}: {
  tasks: Task[];
  onStatusChange: (taskId: string, status: string) => void;
  isLoading: boolean;
}) {
  const columns = [
    { id: 'pending', label: 'To Do', color: 'var(--portal-text-secondary)' },
    { id: 'in_progress', label: 'In Progress', color: 'var(--status-active)' },
    { id: 'blocked', label: 'Blocked', color: 'var(--status-pending)' },
    { id: 'completed', label: 'Done', color: 'var(--status-completed)' },
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

export default GlobalTasksTable;
