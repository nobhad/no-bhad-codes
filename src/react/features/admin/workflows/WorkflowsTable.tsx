import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  GitBranch,
  Inbox,
  ChevronDown
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
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
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiPost } from '@/utils/api-client';

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

const DEFAULT_STATS: WorkflowStats = {
  total: 0,
  active: 0,
  inactive: 0,
  totalRuns: 0,
  avgSuccessRate: 0
};

export function WorkflowsTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: WorkflowsTableProps) {
  const containerRef = useFadeIn();

  const { data, isLoading, error, refetch, setData } = useListFetch<Workflow, WorkflowStats>({
    endpoint: API_ENDPOINTS.ADMIN.WORKFLOWS,
    getAuthToken,
    defaultStats: DEFAULT_STATS,
    itemsKey: 'workflows'
  });
  const workflows = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_STATS, [data]);

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

  const updateWorkflowStatus = useCallback(async (workflowId: number, newStatus: string) => {
    try {
      const response = await apiPost(API_ENDPOINTS.ADMIN.WORKFLOWS_BULK_STATUS, { workflowIds: [workflowId], status: newStatus });
      if (!response.ok) throw new Error('Failed to update workflow status');
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((w) =>
          w.id === workflowId ? { ...w, status: newStatus as Workflow['status'] } : w
        ) } : prev
      );
      showNotification?.('Workflow status updated', 'success');
    } catch (err) {
      logger.error('Failed to update workflow status:', err);
      showNotification?.('Failed to update workflow status', 'error');
    }
  }, [showNotification, setData]);

  const handleBulkStatusChange = useCallback(async (newStatus: string) => {
    if (selection.selectedCount === 0) return;

    setBulkLoading(true);
    try {
      const workflowIds = Array.from(selection.selectedIds);
      const response = await apiPost(API_ENDPOINTS.ADMIN.WORKFLOWS_BULK_STATUS, { workflowIds, status: newStatus });
      if (!response.ok) throw new Error('Failed to update workflow statuses');
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((w) =>
          selection.selectedIds.has(w.id)
            ? { ...w, status: newStatus as Workflow['status'] }
            : w
        ) } : prev
      );
      selection.clearSelection();
      showNotification?.(`Updated ${workflowIds.length} workflow${workflowIds.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to bulk update status:', err);
      showNotification?.('Failed to update workflows', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [selection, showNotification, setData]);

  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    if (!confirm(`Are you sure you want to delete ${selection.selectedCount} workflow(s)?`)) {
      return;
    }

    setBulkLoading(true);
    try {
      const workflowIds = Array.from(selection.selectedIds);
      const response = await apiPost(API_ENDPOINTS.ADMIN.WORKFLOWS_BULK_DELETE, { workflowIds });
      if (!response.ok) throw new Error('Failed to delete workflows');
      setData((prev) =>
        prev ? { ...prev, items: prev.items.filter((w) => !selection.selectedIds.has(w.id)) } : prev
      );
      selection.clearSelection();
      showNotification?.(`Deleted ${workflowIds.length} workflow${workflowIds.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to bulk delete:', err);
      showNotification?.('Failed to delete workflows', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [selection, showNotification, setData]);

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
            onClick={refetch}
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
            <PortalTableHead className="col-checkbox" onClick={(e) => e.stopPropagation()}>
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
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updatedAt' ? sort.direction : null}
              onClick={() => toggleSort('updatedAt')}
            >
              Updated
            </PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={5} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={5} rows={5} />
          ) : paginatedWorkflows.length === 0 ? (
            <PortalTableEmpty
              colSpan={5}
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
                  className="col-checkbox"
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
                      <span className="cell-subtitle">{workflow.trigger} · {workflow.steps} steps</span>
                      <span className="status-stacked">
                        <StatusBadge status={getStatusVariant(workflow.status)} size="sm">
                          {WORKFLOW_STATUS_CONFIG[workflow.status]?.label || workflow.status}
                        </StatusBadge>
                      </span>
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell
                  className="status-cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button type="button" className="status-dropdown-trigger" aria-label="Change workflow status">
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
                <PortalTableCell className="date-cell">
                  {formatDate(workflow.updatedAt)}
                </PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton
                      action="edit"
                      title="Configure"
                      onClick={() => onNavigate?.('workflow-editor', String(workflow.id))}
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
