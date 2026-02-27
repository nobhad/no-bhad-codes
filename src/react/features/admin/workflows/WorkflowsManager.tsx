import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  GitBranch,
  Play,
  Pause,
  Settings,
  MoreHorizontal,
  Inbox,
  Copy,
  Trash2,
  Zap,
  Download,
} from 'lucide-react';
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

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: string;
  status: 'active' | 'inactive' | 'draft';
  lastRun?: string;
  runCount: number;
  successRate: number;
  steps: number;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStats {
  total: number;
  active: number;
  inactive: number;
  totalRuns: number;
  avgSuccessRate: number;
}

interface WorkflowsManagerProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'draft', label: 'Draft' },
];

export function WorkflowsManager({ onNavigate }: WorkflowsManagerProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState<WorkflowStats>({
    total: 0,
    active: 0,
    inactive: 0,
    totalRuns: 0,
    avgSuccessRate: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/workflows');
      if (!response.ok) throw new Error('Failed to load workflows');
      const data = await response.json();
      setWorkflows(data.workflows || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredWorkflows = useMemo(() => {
    let result = [...workflows];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description?.toLowerCase().includes(query) ||
          w.trigger.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((w) => w.status === statusFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'runCount': aVal = a.runCount; bVal = b.runCount; break;
          case 'successRate': aVal = a.successRate; bVal = b.successRate; break;
          case 'updatedAt': aVal = a.updatedAt; bVal = b.updatedAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [workflows, searchQuery, statusFilter, sort]);

  const pagination = usePagination({ totalItems: filteredWorkflows.length });
  const paginatedWorkflows = filteredWorkflows.slice(
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

  async function toggleWorkflowStatus(workflowId: string, currentStatus: string) {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await fetch(`/api/admin/workflows/${workflowId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error('Failed to update workflow status');
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, status: newStatus as Workflow['status'] } : w))
      );
    } catch (err) {
      console.error('Failed to toggle workflow status:', err);
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="WORKFLOWS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'completed', hideIfZero: true },
            { value: stats.inactive, label: 'inactive', variant: 'cancelled', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.inactive} Inactive • ${stats.totalRuns} Runs`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search workflows..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <button className="icon-btn" title="Export">
            <Download size={18} />
          </button>
          <PortalButton variant="primary" size="sm">
            <Plus className="btn-icon" />
            New Workflow
          </PortalButton>
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadWorkflows}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredWorkflows.length > 0 ? (
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
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Workflow
            </AdminTableHead>
            <AdminTableHead>Trigger</AdminTableHead>
            <AdminTableHead>Steps</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'runCount' ? sort.direction : null}
              onClick={() => toggleSort('runCount')}
            >
              Runs
            </AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'successRate' ? sort.direction : null}
              onClick={() => toggleSort('successRate')}
            >
              Success
            </AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updatedAt' ? sort.direction : null}
              onClick={() => toggleSort('updatedAt')}
            >
              Updated
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={8} rows={5} />
          ) : paginatedWorkflows.length === 0 ? (
            <AdminTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No workflows match your filters' : 'No workflows yet'}
            />
          ) : (
            paginatedWorkflows.map((workflow) => (
              <AdminTableRow key={workflow.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <GitBranch className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{workflow.name}</span>
                      {workflow.description && (
                        <span className="cell-subtitle">{workflow.description}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-with-icon">
                    <Zap className="cell-icon-sm status-pending" />
                    <span>{workflow.trigger}</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell>{workflow.steps} steps</AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(workflow.status)} size="sm">
                    {workflow.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-right">{workflow.runCount}</AdminTableCell>
                <AdminTableCell className="text-right">
                  <span
                    className={
                      workflow.successRate >= 90
                        ? 'text-success'
                        : workflow.successRate >= 70
                        ? 'text-warning'
                        : 'text-danger'
                    }
                  >
                    {workflow.successRate}%
                  </span>
                </AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(workflow.updatedAt)}</AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <button
                      className="icon-btn"
                      title={workflow.status === 'active' ? 'Pause' : 'Activate'}
                      onClick={() => toggleWorkflowStatus(workflow.id, workflow.status)}
                    >
                      {workflow.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal size={18} />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent>
                        <PortalDropdownItem>
                          <Settings className="dropdown-icon" />
                          Configure
                        </PortalDropdownItem>
                        <PortalDropdownItem>
                          <Copy className="dropdown-icon" />
                          Duplicate
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

export default WorkflowsManager;
