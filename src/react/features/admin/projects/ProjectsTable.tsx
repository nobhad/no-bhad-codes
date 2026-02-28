import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox, Download, RefreshCw, Eye, ChevronDown } from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableHead,
  AdminTableRow,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
} from '@react/components/portal/AdminTable';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { PortalButton } from '@react/components/portal/PortalButton';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
} from '@react/components/portal/PortalDropdown';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useProjects } from '@react/hooks/useProjects';
import { useSelection } from '@react/hooks/useSelection';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useFadeIn } from '@react/hooks/useGsap';
import { useExport, PROJECTS_EXPORT_CONFIG } from '@react/hooks/useExport';
import type { Project, ProjectStatus, SortConfig } from '../types';
import { PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '../types';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '../../../../utils/format-utils';
import { PROJECT_STATUS_OPTIONS, PROJECT_TYPE_OPTIONS } from '../shared/filterConfigs';

interface ProjectsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when project is selected for detail view */
  onViewProject?: (projectId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Filter configuration for useTableFilters hook
const FILTER_CONFIG = [
  {
    key: 'status',
    label: 'Status',
    options: PROJECT_STATUS_OPTIONS,
  },
  {
    key: 'type',
    label: 'Type',
    options: PROJECT_TYPE_OPTIONS,
  },
];

// Filter sections for FilterDropdown component
const FILTER_SECTIONS = [
  {
    key: 'status',
    label: 'STATUS',
    options: PROJECT_STATUS_OPTIONS,
  },
  {
    key: 'type',
    label: 'TYPE',
    options: PROJECT_TYPE_OPTIONS,
  },
];

// Filter function
function filterProject(
  project: Project,
  filters: Record<string, string>,
  search: string
): boolean {
  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      project.project_name?.toLowerCase().includes(searchLower) ||
      project.client_name?.toLowerCase().includes(searchLower) ||
      project.contact_name?.toLowerCase().includes(searchLower) ||
      project.company_name?.toLowerCase().includes(searchLower) ||
      project.description?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    if (project.status !== filters.status) return false;
  }

  // Type filter
  if (filters.type && filters.type !== 'all') {
    if (project.project_type !== filters.type) return false;
  }

  return true;
}

// Sort function
function sortProjects(a: Project, b: Project, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
    case 'name':
      return multiplier * (a.project_name || '').localeCompare(b.project_name || '');
    case 'status':
      return multiplier * a.status.localeCompare(b.status);
    case 'type':
      return multiplier * (a.project_type || '').localeCompare(b.project_type || '');
    case 'budget':
      return multiplier * ((a.budget || 0) - (b.budget || 0));
    case 'start_date':
      return (
        multiplier *
        (new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime())
      );
    case 'end_date':
      return (
        multiplier *
        (new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime())
      );
    default:
      return 0;
  }
}

/**
 * ProjectsTable
 * React implementation of the admin projects table
 */
export function ProjectsTable({
  getAuthToken,
  onViewProject,
  showNotification,
}: ProjectsTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const { projects, isLoading, error, stats, refetch, updateProject, bulkDelete } = useProjects({
    getAuthToken,
  });

  // Delete confirmation dialog
  const deleteDialog = useConfirmDialog();

  // Filtering and sorting
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters,
  } = useTableFilters<Project>({
    storageKey: 'admin_projects',
    filters: FILTER_CONFIG,
    filterFn: filterProject,
    sortFn: sortProjects,
    defaultSort: { column: 'name', direction: 'asc' },
  });

  // Apply filters to get filtered data
  const filteredProjects = useMemo(() => applyFilters(projects), [applyFilters, projects]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_projects_pagination',
    totalItems: filteredProjects.length,
    defaultPageSize: 25,
  });

  // Get paginated data
  const paginatedProjects = useMemo(
    () => pagination.paginate(filteredProjects),
    [pagination, filteredProjects]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (project: Project) => project.id,
    items: paginatedProjects,
  });

  // Export functionality
  const { exportCsv, isExporting } = useExport({
    config: PROJECTS_EXPORT_CONFIG,
    data: filteredProjects,
    onExport: (count) => {
      showNotification?.(`Exported ${count} project${count !== 1 ? 's' : ''} to CSV`, 'success');
    },
  });

  // Bulk action loading state
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      setBulkActionLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const project of selection.selectedItems) {
        const success = await updateProject(project.id, { status: newStatus as ProjectStatus });
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      setBulkActionLoading(false);
      selection.clearSelection();

      if (failCount === 0) {
        showNotification?.(
          `Updated ${successCount} project${successCount !== 1 ? 's' : ''} to ${PROJECT_STATUS_CONFIG[newStatus as ProjectStatus]?.label || newStatus}`,
          'success'
        );
      } else {
        showNotification?.(
          `Updated ${successCount}, failed ${failCount} project${failCount !== 1 ? 's' : ''}`,
          'warning'
        );
      }

      refetch();
    },
    [selection, updateProject, showNotification, refetch]
  );

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((p) => p.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Deleted ${result.success} project${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Deleted ${result.success}, failed ${result.failed} project${result.failed !== 1 ? 's' : ''}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to delete projects', 'error');
    }

    refetch();
  }, [selection, bulkDelete, showNotification, refetch]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(PROJECT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`,
      })),
    []
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (projectId: number, newStatus: ProjectStatus) => {
      const success = await updateProject(projectId, { status: newStatus });
      if (success) {
        showNotification?.(`Status updated to ${PROJECT_STATUS_CONFIG[newStatus].label}`, 'success');
      } else {
        showNotification?.('Failed to update status', 'error');
      }
    },
    [updateProject, showNotification]
  );


  // Handle view project
  const handleViewProject = useCallback(
    (projectId: number) => {
      onViewProject?.(projectId);
    },
    [onViewProject]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (project: Project) => {
      handleViewProject(project.id);
    },
    [handleViewProject]
  );

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="PROJECTS"
        stats={
          <TableStats
            items={[
              { value: stats.total, label: 'total' },
              { value: stats.active, label: 'active', variant: 'active', hideIfZero: true },
              { value: stats.onHold, label: 'on hold', variant: 'pending', hideIfZero: true },
            ]}
            tooltip={`${stats.total} Total - ${stats.active} Active - ${stats.completed} Completed - ${stats.onHold} On Hold`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search projects..."
            />
            <FilterDropdown
              sections={FILTER_SECTIONS}
              values={filterValues}
              onChange={(key, value) => setFilter(key, value)}
            />
            <IconButton
              action="download"
              onClick={exportCsv}
              disabled={isExporting || filteredProjects.length === 0}
              title="Export to CSV"
            />
            <IconButton
              action="refresh"
              onClick={refetch}
              disabled={isLoading}
              loading={isLoading}
            />
          </>
        }
        bulkActions={
          <BulkActionsToolbar
            selectedCount={selection.selectedCount}
            totalCount={filteredProjects.length}
            onClearSelection={selection.clearSelection}
            onSelectAll={() => selection.selectMany(filteredProjects)}
            allSelected={selection.allSelected && selection.selectedCount === filteredProjects.length}
            statusOptions={bulkStatusOptions}
            onStatusChange={handleBulkStatusChange}
            onDelete={deleteDialog.open}
            deleteLoading={deleteDialog.isLoading}
          />
        }
        error={
          error ? (
            <div className="table-error-banner">
              {error}
              <PortalButton variant="secondary" size="sm" onClick={refetch}>
                Retry
              </PortalButton>
            </div>
          ) : undefined
        }
        pagination={
          !isLoading && filteredProjects.length > 0 ? (
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
              <AdminTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleSelectAll}
                  aria-label="Select all"
                />
              </AdminTableHead>
              <AdminTableHead
                className="name-col"
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Project
              </AdminTableHead>
              <AdminTableHead
                className="type-col"
                sortable
                sortDirection={sort?.column === 'type' ? sort.direction : null}
                onClick={() => toggleSort('type')}
              >
                Type
              </AdminTableHead>
              <AdminTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </AdminTableHead>
              <AdminTableHead
                className="amount-col"
                sortable
                sortDirection={sort?.column === 'budget' ? sort.direction : null}
                onClick={() => toggleSort('budget')}
              >
                Budget
              </AdminTableHead>
              <AdminTableHead className="timeline-col">Timeline</AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'start_date' ? sort.direction : null}
                onClick={() => toggleSort('start_date')}
              >
                Start
              </AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'end_date' ? sort.direction : null}
                onClick={() => toggleSort('end_date')}
              >
                Target
              </AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={9} rows={5} />
            ) : paginatedProjects.length === 0 ? (
              <AdminTableEmpty
                colSpan={9}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No projects match your filters' : 'No projects yet'}
              />
            ) : (
              paginatedProjects.map((project) => (
                <AdminTableRow
                  key={project.id}
                  clickable
                  selected={selection.isSelected(project)}
                  onClick={() => handleRowClick(project)}
                >
                  {/* Checkbox */}
                  <AdminTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(project)}
                      onCheckedChange={() => selection.toggleSelection(project)}
                      aria-label={`Select ${project.project_name || 'project'}`}
                    />
                  </AdminTableCell>

                  {/* Project Name & Client */}
                  <AdminTableCell className="primary-cell name-col">
                    <div className="cell-content">
                      <span className="cell-title">{project.project_name || 'Untitled Project'}</span>
                      <span className="cell-subtitle">
                        {project.contact_name}
                        {project.company_name && ` - ${project.company_name}`}
                      </span>
                      {/* Stacked content for responsive - hidden on desktop */}
                      <span className="type-stacked">
                        {PROJECT_TYPE_LABELS[project.project_type || ''] || project.project_type}
                      </span>
                      {project.budget && (
                        <span className="budget-stacked">{formatCurrency(project.budget)}</span>
                      )}
                      {project.end_date && (
                        <span className="target-stacked">Target: {formatDate(project.end_date)}</span>
                      )}
                    </div>
                  </AdminTableCell>

                  {/* Type */}
                  <AdminTableCell className="type-col">
                    {PROJECT_TYPE_LABELS[project.project_type || ''] || project.project_type || '-'}
                  </AdminTableCell>

                  {/* Status */}
                  <AdminTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="status-dropdown-trigger">
                          <StatusBadge status={getStatusVariant(project.status)}>
                            {PROJECT_STATUS_CONFIG[project.status]?.label || project.status}
                          </StatusBadge>
                          <ChevronDown className="status-dropdown-caret" />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent sideOffset={0} align="start">
                        {Object.entries(PROJECT_STATUS_CONFIG).map(([status, config]) => (
                          <PortalDropdownItem
                            key={status}
                            onClick={() => handleStatusChange(project.id, status as ProjectStatus)}
                          >
                            <StatusBadge status={getStatusVariant(status)} size="sm">
                              {config.label}
                            </StatusBadge>
                          </PortalDropdownItem>
                        ))}
                      </PortalDropdownContent>
                    </PortalDropdown>
                  </AdminTableCell>

                  {/* Budget */}
                  <AdminTableCell className="amount-col">
                    {formatCurrency(project.budget)}
                  </AdminTableCell>

                  {/* Timeline */}
                  <AdminTableCell className="timeline-col">
                    {project.timeline || '-'}
                  </AdminTableCell>

                  {/* Start Date */}
                  <AdminTableCell className="date-cell">
                    {formatDate(project.start_date)}
                  </AdminTableCell>

                  {/* Target Date */}
                  <AdminTableCell className="date-cell">
                    {formatDate(project.end_date)}
                  </AdminTableCell>

                  {/* Actions */}
                  <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <IconButton
                        action="view"
                        onClick={() => handleViewProject(project.id)}
                        title="View project"
                      />
                    </div>
                  </AdminTableCell>
                </AdminTableRow>
              ))
            )}
          </AdminTableBody>
        </AdminTable>
      </TableLayout>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Projects"
        description={`Are you sure you want to delete ${selection.selectedCount} project${selection.selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleBulkDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </>
  );
}
