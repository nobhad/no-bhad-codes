import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  FileUp,
  FileCheck,
  AlertCircle,
  MoreHorizontal,
  Inbox,
  Send,
  Eye,
  Trash2,
  Download,
} from 'lucide-react';
import { IconButton } from '@react/factories';
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

interface DocumentRequest {
  id: string;
  title: string;
  description?: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';
  dueDate?: string;
  submittedAt?: string;
  documents: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentRequestStats {
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  overdue: number;
}

interface DocumentRequestsTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
];

export function DocumentRequestsTable({ onNavigate }: DocumentRequestsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [stats, setStats] = useState<DocumentRequestStats>({
    total: 0,
    pending: 0,
    submitted: 0,
    approved: 0,
    overdue: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/document-requests');
      if (!response.ok) throw new Error('Failed to load document requests');
      const data = await response.json();
      setRequests(data.requests || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document requests');
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
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'title': aVal = a.title; bVal = b.title; break;
          case 'client': aVal = a.clientName; bVal = b.clientName; break;
          case 'dueDate': aVal = a.dueDate || ''; bVal = b.dueDate || ''; break;
          case 'createdAt': aVal = a.createdAt; bVal = b.createdAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [requests, searchQuery, statusFilter, sort]);

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

  function isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DOCUMENT REQUESTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.submitted, label: 'submitted', variant: 'active', hideIfZero: true },
            { value: stats.approved, label: 'approved', variant: 'completed', hideIfZero: true },
            { value: stats.overdue, label: 'overdue', variant: 'overdue', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.pending} Pending • ${stats.submitted} Submitted • ${stats.approved} Approved • ${stats.overdue} Overdue`}
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
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <IconButton action="export" />
          <PortalButton variant="primary" size="sm">
            <Plus className="btn-icon" />
            New Request
          </PortalButton>
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
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </AdminTableHead>
            <AdminTableHead>Project</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead className="text-right">Docs</AdminTableHead>
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
              message={hasActiveFilters ? 'No requests match your filters' : 'No document requests yet'}
            />
          ) : (
            paginatedRequests.map((request) => (
              <AdminTableRow key={request.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileUp className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{request.title}</span>
                      {request.description && (
                        <span className="cell-subtitle">{request.description}</span>
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
                    className="link-btn"
                  >
                    {request.clientName}
                  </button>
                </AdminTableCell>
                <AdminTableCell>
                  {request.projectName ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('projects', request.projectId);
                      }}
                      className="link-btn"
                    >
                      {request.projectName}
                    </button>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(request.status)} size="sm">
                    {request.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  {request.documents > 0 ? (
                    <span className="cell-with-icon">
                      <FileCheck className="cell-icon-sm" />
                      {request.documents}
                    </span>
                  ) : (
                    '-'
                  )}
                </AdminTableCell>
                <AdminTableCell className="date-cell">
                  {request.dueDate ? (
                    <span
                      className={cn(
                        isOverdue(request.dueDate) && request.status === 'pending' && 'text-danger'
                      )}
                    >
                      {isOverdue(request.dueDate) && request.status === 'pending' && (
                        <AlertCircle className="cell-icon-sm text-danger" />
                      )}
                      {formatDate(request.dueDate)}
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
                          <Send className="dropdown-icon" />
                          Send Reminder
                        </PortalDropdownItem>
                        {request.documents > 0 && (
                          <PortalDropdownItem>
                            <Download className="dropdown-icon" />
                            Download All
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
    </TableLayout>
  );
}

export default DocumentRequestsTable;
