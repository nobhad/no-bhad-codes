import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitBranch,
  Inbox,
  Zap,
  ChevronDown
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
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
import { WORKFLOW_STATUS_OPTIONS } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('WorkflowsTable');

interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  trigger: string;
  status: 'active' | 'inactive';
  lastRun?: string | null;
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

interface WorkflowsTableProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
  overviewMode?: boolean;
}

const WORKFLOWS_FILTER_CONFIG = [
  { key: 'status', label: 'STATUS', options: WORKFLOW_STATUS_OPTIONS }
];

const WORKFLOW_STATUS_CONFIG: Record<string, { label: string }> = {
  active: { label: 'Active' },
  inactive: { label: 'Inactive' }
};

const BULK_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

function filterWorkflow(
  workflow: Workflow,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    const matchesSearch =
      workflow.name.toLowerCase().includes(query) ||
      workflow.description?.toLowerCase().includes(query) ||
      workflow.trigger.toLowerCase().includes(query);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (workflow.status !== filters.status) return false;
  }

  return true;
}

function sortWorkflows(a: Workflow, b: Workflow, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return a.name.localeCompare(b.name) * multiplier;
  case 'runCount':
    return (a.runCount - b.runCount) * multiplier;
  case 'successRate':
    return (a.successRate - b.successRate) * multiplier;
  case 'updatedAt':
    return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * multiplier;
  default:
    return 0;
  }
}

export function WorkflowsTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: WorkflowsTableProps) {
  const containerRef = useFadeIn();

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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState<WorkflowStats>({
    total: 0,
    active: 0,
    inactive: 0,
    totalRuns: 0,
    avgSuccessRate: 0
  });
  const [bulkLoading, setBulkLoading] = useState(false);

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Workflow>({
    storageKey: overviewMode ? undefined : 'admin_workflows',
    filters: WORKFLOWS_FILTER_CONFIG,
    filterFn: filterWorkflow,
    sortFn: sortWorkflows,
    defaultSort: { column: 'updatedAt', direction: 'desc' }
  });

  const filteredWorkflows = useMemo(() => applyFilters(workflows), [applyFilters, workflows]);

  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_workflows_pagination',
    totalItems: filteredWorkflows.length,
    defaultPageSize
  });

  const paginatedWorkflows = useMemo(
    () => pagination.paginate(filteredWorkflows),
    [pagination, filteredWorkflows]
  );

  const selection = useSelection({
    getId: (workflow: Workflow) => workflow.id,
    items: paginatedWorkflows
  });

  const handleFilterChange = useCallback(
    (key: string, value: string) => setFilter(key, value),
    [setFilter]
  );

  const loadWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.WORKFLOWS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load workflows');
      const payload = unwrapApiData<{ workflows?: Workflow[]; stats?: WorkflowStats }>(await response.json());
      setWorkflows(payload.workflows || []);
      setStats(payload.stats || {
        total: 0,
        active: 0,
        inactive: 0,
        totalRuns: 0,
        avgSuccessRate: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const updateWorkflowStatus = useCallback(async (workflowId: number, newStatus: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.WORKFLOWS_BULK_STATUS, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ workflowIds: [workflowId], status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update workflow status');
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId ? { ...w, status: newStatus as Workflow['status'] } : w
        )
      );
      showNotification?.('Workflow status updated', 'success');
    } catch (err) {
      logger.error('Failed to update workflow status:', err);
      showNotification?.('Failed to update workflow status', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    if (selection.selectedCount === 0) return;

    setBulkLoading(true);
    try {
      const workflowIds = Array.from(selection.selectedIds);
      const response = await fetch(API_ENDPOINTS.ADMIN.WORKFLOWS_BULK_STATUS, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ workflowIds, status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update workflow statuses');
      setWorkflows((prev) =>
        prev.map((w) =>
          selection.selectedIds.has(w.id)
            ? { ...w, status: newStatus as Workflow['status'] }
            : w
        )
      );
      selection.clearSelection();
      showNotification?.(`Updated ${workflowIds.length} workflow${workflowIds.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to bulk update status:', err);
      showNotification?.('Failed to update workflows', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [selection, getHeaders, showNotification]);

  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    if (!confirm(`Are you sure you want to delete ${selection.selectedCount} workflow(s)?`)) {
      return;
    }

    setBulkLoading(true);
    try {
      const workflowIds = Array.from(selection.selectedIds);
      const response = await fetch(API_ENDPOINTS.ADMIN.WORKFLOWS_BULK_DELETE, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ workflowIds })
      });
      if (!response.ok) throw new Error('Failed to delete workflows');
      setWorkflows((prev) => prev.filter((w) => !selection.selectedIds.has(w.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${workflowIds.length} workflow${workflowIds.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to bulk delete:', err);
      showNotification?.('Failed to delete workflows', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [selection, getHeaders, showNotification]);

  const filterSections = WORKFLOWS_FILTER_CONFIG.map((config) => ({
    key: config.key,
    label: config.label,
    options: config.options
  }));

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="WORKFLOWS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'completed' },
            { value: stats.inactive, label: 'inactive', variant: 'cancelled' }
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.inactive} Inactive • ${stats.totalRuns} Runs`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search workflows..."
          />
          <FilterDropdown
            sections={filterSections}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredWorkflows.length === 0}
            title="Export to CSV"
          />
          <IconButton
            action="refresh"
            onClick={loadWorkflows}
            disabled={isLoading}
            title="Refresh"
          />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredWorkflows.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredWorkflows)}
          allSelected={selection.allSelected && selection.selectedCount === filteredWorkflows.length}
          statusOptions={BULK_STATUS_OPTIONS}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
          deleteLoading={bulkLoading}
        />
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
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false}
                onCheckedChange={selection.toggleSelectAll}
                aria-label="Select all"
              />
            </PortalTableHead>
            <PortalTableHead
              className="name-col"
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Workflow
            </PortalTableHead>
            <PortalTableHead className="type-col">Trigger</PortalTableHead>
            <PortalTableHead className="count-col">Steps</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead
              className="count-col"
              sortable
              sortDirection={sort?.column === 'runCount' ? sort.direction : null}
              onClick={() => toggleSort('runCount')}
            >
              Runs
            </PortalTableHead>
            <PortalTableHead
              className="count-col"
              sortable
              sortDirection={sort?.column === 'successRate' ? sort.direction : null}
              onClick={() => toggleSort('successRate')}
            >
              Success
            </PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updatedAt' ? sort.direction : null}
              onClick={() => toggleSort('updatedAt')}
            >
              Updated
            </PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={9} message={error} onRetry={loadWorkflows} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={9} rows={5} />
          ) : paginatedWorkflows.length === 0 ? (
            <PortalTableEmpty
              colSpan={9}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No workflows match your filters' : 'No workflows yet'}
            />
          ) : (
            paginatedWorkflows.map((workflow) => (
              <PortalTableRow
                key={workflow.id}
                clickable
                selected={selection.isSelected(workflow)}
              >
                <PortalTableCell
                  className="bulk-select-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selection.isSelected(workflow)}
                    onCheckedChange={() => selection.toggleSelection(workflow)}
                    aria-label={`Select ${workflow.name}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <GitBranch className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{workflow.name}</span>
                      {workflow.description && (
                        <span className="cell-subtitle">{workflow.description}</span>
                      )}
                      <span className="trigger-stacked">{workflow.trigger}</span>
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="type-cell">
                  <div className="cell-with-icon">
                    <Zap className="cell-icon-sm status-pending" />
                    <span>{workflow.trigger}</span>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="count-cell">{workflow.steps} steps</PortalTableCell>
                <PortalTableCell
                  className="status-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button type="button" className="status-dropdown-trigger">
                        <StatusBadge status={getStatusVariant(workflow.status)} size="sm">
                          {WORKFLOW_STATUS_CONFIG[workflow.status]?.label || workflow.status}
                        </StatusBadge>
                        <ChevronDown className="status-dropdown-caret" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent sideOffset={0} align="start">
                      {Object.entries(WORKFLOW_STATUS_CONFIG)
                        .filter(([value]) => value !== workflow.status)
                        .map(([value, config]) => (
                          <PortalDropdownItem
                            key={value}
                            onClick={() => updateWorkflowStatus(workflow.id, value)}
                          >
                            <StatusBadge status={getStatusVariant(value)} size="sm">
                              {config.label}
                            </StatusBadge>
                          </PortalDropdownItem>
                        ))}
                    </PortalDropdownContent>
                  </PortalDropdown>
                </PortalTableCell>
                <PortalTableCell className="count-cell">{workflow.runCount}</PortalTableCell>
                <PortalTableCell className="count-cell">
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
                </PortalTableCell>
                <PortalTableCell className="date-cell">
                  {formatDate(workflow.updatedAt)}
                </PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton
                      action="edit"
                      title="Configure"
                      onClick={() => onNavigate?.('workflow-editor', String(workflow.id))}
                    />
                    <IconButton
                      action="duplicate"
                      title="Duplicate"
                    />
                    <IconButton
                      action="delete"
                      title="Delete"
                    />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
