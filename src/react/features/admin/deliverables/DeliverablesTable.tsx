import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Package,
  AlertCircle,
  MoreHorizontal,
  Inbox,
  Eye,
  Edit,
  Trash2,
  Download,
  ExternalLink,
} from 'lucide-react';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
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

interface Deliverable {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  status: 'pending' | 'in-progress' | 'review' | 'approved' | 'delivered';
  dueDate?: string;
  deliveredAt?: string;
  version: number;
  files: number;
  createdAt: string;
  updatedAt: string;
}

interface DeliverableStats {
  total: number;
  pending: number;
  inProgress: number;
  review: number;
  delivered: number;
  overdue: number;
}

interface DeliverablesTableProps {
  projectId?: string;
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'delivered', label: 'Delivered' },
];

export function DeliverablesTable({ projectId, onNavigate }: DeliverablesTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [stats, setStats] = useState<DeliverableStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    review: 0,
    delivered: 0,
    overdue: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadDeliverables();
  }, [projectId]);

  async function loadDeliverables() {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`/api/admin/deliverables?${params}`);
      if (!response.ok) throw new Error('Failed to load deliverables');
      const data = await response.json();
      setDeliverables(data.deliverables || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliverables');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredDeliverables = useMemo(() => {
    let result = [...deliverables];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.projectName.toLowerCase().includes(query) ||
          d.clientName.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'title': aVal = a.title; bVal = b.title; break;
          case 'project': aVal = a.projectName; bVal = b.projectName; break;
          case 'dueDate': aVal = a.dueDate || ''; bVal = b.dueDate || ''; break;
          case 'updatedAt': aVal = a.updatedAt; bVal = b.updatedAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [deliverables, searchQuery, statusFilter, sort]);

  const pagination = usePagination({ totalItems: filteredDeliverables.length });
  const paginatedDeliverables = filteredDeliverables.slice(
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

  function isOverdue(dueDate?: string, status?: string): boolean {
    if (!dueDate || status === 'delivered' || status === 'approved') return false;
    return new Date(dueDate) < new Date();
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DELIVERABLES"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.inProgress, label: 'in progress', variant: 'active', hideIfZero: true },
            { value: stats.review, label: 'review', variant: 'pending', hideIfZero: true },
            { value: stats.delivered, label: 'delivered', variant: 'completed', hideIfZero: true },
            { value: stats.overdue, label: 'overdue', variant: 'overdue', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.inProgress} In Progress • ${stats.review} Review • ${stats.delivered} Delivered`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search deliverables..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <PortalButton variant="primary" size="sm">
            <Plus className="btn-icon" />
            New Deliverable
          </PortalButton>
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadDeliverables}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredDeliverables.length > 0 ? (
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
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Deliverable
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'project' ? sort.direction : null}
              onClick={() => toggleSort('project')}
            >
              Project
            </AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead>Ver</AdminTableHead>
            <AdminTableHead>Files</AdminTableHead>
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
          ) : paginatedDeliverables.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No deliverables match your filters' : 'No deliverables yet'}
            />
          ) : (
            paginatedDeliverables.map((deliverable) => (
              <AdminTableRow key={deliverable.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Package className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{deliverable.title}</span>
                      <span className="cell-subtitle">{deliverable.clientName}</span>
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('projects', deliverable.projectId);
                    }}
                    className="table-link"
                  >
                    {deliverable.projectName}
                  </button>
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(deliverable.status)} size="sm">
                    {deliverable.status.replace('-', ' ')}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>v{deliverable.version}</AdminTableCell>
                <AdminTableCell>{deliverable.files}</AdminTableCell>
                <AdminTableCell className="date-cell">
                  {deliverable.dueDate ? (
                    <span
                      className={cn(
                        'due-date',
                        isOverdue(deliverable.dueDate, deliverable.status) && 'overdue'
                      )}
                    >
                      {isOverdue(deliverable.dueDate, deliverable.status) && (
                        <AlertCircle className="overdue-icon" />
                      )}
                      {formatDate(deliverable.dueDate)}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal size={18} />
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
                        {deliverable.files > 0 && (
                          <PortalDropdownItem>
                            <Download className="dropdown-icon" />
                            Download
                          </PortalDropdownItem>
                        )}
                        <PortalDropdownItem>
                          <ExternalLink className="dropdown-icon" />
                          Share Link
                        </PortalDropdownItem>
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
    </TableLayout>
  );
}

export default DeliverablesTable;
