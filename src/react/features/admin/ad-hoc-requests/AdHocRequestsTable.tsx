import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Zap,
  MoreHorizontal,
  Inbox,
  Eye,
  Edit,
  Trash2,
  Play,
  Pause,
  User,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
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

interface AdHocRequest {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'on-hold';
  estimatedHours?: number;
  actualHours?: number;
  rate?: number;
  assignee?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface AdHocRequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  totalRevenue: number;
  totalHours: number;
}

interface AdHocRequestsTableProps {
  clientId?: string;
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function AdHocRequestsTable({ clientId, projectId, onNavigate }: AdHocRequestsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<AdHocRequest[]>([]);
  const [stats, setStats] = useState<AdHocRequestStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    totalRevenue: 0,
    totalHours: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadRequests();
  }, [clientId, projectId]);

  async function loadRequests() {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`/api/admin/ad-hoc-requests?${params}`);
      if (!response.ok) throw new Error('Failed to load ad-hoc requests');
      const data = await response.json();
      setRequests(data.requests || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ad-hoc requests');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredRequests = useMemo(() => {
    let result = [...requests];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.clientName.toLowerCase().includes(query) ||
          r.projectName?.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter((r) => r.priority === priorityFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'title': aVal = a.title; bVal = b.title; break;
          case 'priority': {
            const order = { urgent: 0, high: 1, medium: 2, low: 3 };
            aVal = order[a.priority];
            bVal = order[b.priority];
            break;
          }
          case 'dueDate': aVal = a.dueDate || ''; bVal = b.dueDate || ''; break;
          case 'createdAt': aVal = a.createdAt; bVal = b.createdAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [requests, searchQuery, statusFilter, priorityFilter, sort]);

  const pagination = usePagination({ totalItems: filteredRequests.length });
  const paginatedRequests = filteredRequests.slice(
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

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent': return 'var(--status-cancelled)';
      case 'high': return 'var(--status-pending)';
      case 'medium': return 'var(--status-active)';
      case 'low': return 'var(--portal-text-muted)';
      default: return 'var(--portal-text-muted)';
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="AD-HOC REQUESTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.inProgress, label: 'in progress', variant: 'active', hideIfZero: true },
            { value: stats.completed, label: 'completed', variant: 'completed', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.inProgress} In Progress • ${stats.completed} Completed • ${stats.totalHours}h Total Hours • ${formatCurrency(stats.totalRevenue)} Revenue`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search requests..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
              { key: 'priority', label: 'PRIORITY', options: PRIORITY_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter, priority: priorityFilter }}
            onChange={(key, value) => {
              if (key === 'status') setStatusFilter(value);
              if (key === 'priority') setPriorityFilter(value);
            }}
          />
          <IconButton action="export" />
          <IconButton action="add" title="New Request" />
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadRequests}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredRequests.length > 0 ? (
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
      {!error && (
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Request
            </AdminTableHead>
            <AdminTableHead>Client</AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'priority' ? sort.direction : null}
              onClick={() => toggleSort('priority')}
            >
              Priority
            </AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead className="text-right">Hours</AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'dueDate' ? sort.direction : null}
              onClick={() => toggleSort('dueDate')}
            >
              Due
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedRequests.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No requests match your filters' : 'No ad-hoc requests yet'}
            />
          ) : (
            paginatedRequests.map((request) => (
              <AdminTableRow key={request.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Zap className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{request.title}</span>
                      {request.assignee && (
                        <span className="cell-subtitle">
                          <User className="cell-icon-sm" />
                          {request.assignee}
                        </span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', request.clientId);
                    }}
                    className="cell-link-btn"
                  >
                    {request.clientName}
                  </button>
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    className="priority-badge"
                    style={{
                      color: getPriorityColor(request.priority),
                      backgroundColor: `color-mix(in srgb, ${getPriorityColor(request.priority)} 15%, transparent)`,
                    }}
                  >
                    {request.priority}
                  </span>
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(request.status)} size="sm">
                    {request.status.replace('-', ' ')}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  {request.actualHours !== undefined ? (
                    <span>
                      {request.actualHours}
                      {request.estimatedHours && (
                        <span className="text-muted">/{request.estimatedHours}h</span>
                      )}
                    </span>
                  ) : request.estimatedHours ? (
                    <span className="text-muted">{request.estimatedHours}h est</span>
                  ) : '-'}
                </AdminTableCell>
                <AdminTableCell className="date-cell">
                  {request.dueDate ? formatDate(request.dueDate) : <span className="text-muted">-</span>}
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal size={16} />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent>
                        <PortalDropdownItem>
                          <Eye className="dropdown-icon" />
                          View
                        </PortalDropdownItem>
                        <PortalDropdownItem>
                          <Edit className="dropdown-icon" />
                          Edit
                        </PortalDropdownItem>
                        {request.status === 'pending' && (
                          <PortalDropdownItem>
                            <Play className="dropdown-icon" />
                            Start
                          </PortalDropdownItem>
                        )}
                        {request.status === 'in-progress' && (
                          <PortalDropdownItem>
                            <Pause className="dropdown-icon" />
                            Put On Hold
                          </PortalDropdownItem>
                        )}
                        <PortalDropdownItem className="text-danger">
                          <Trash2 className="dropdown-icon" />
                          Delete
                        </PortalDropdownItem>
                      </PortalDropdownContent>
                    </PortalDropdown>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>
      )}
    </TableLayout>
  );
}

export default AdHocRequestsTable;
