import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox, ChevronDown } from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableHead,
  PortalTableRow,
  PortalTableCell,
  PortalTableEmpty,
  PortalTableLoading,
  PortalTableError
} from '@react/components/portal/PortalTable';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { AddProjectModal } from '../modals/AddProjectModal';
import type { AddProjectFormData } from '../modals/AddProjectModal';
import type { ModalDropdownOption } from '@react/components/portal/ModalDropdown';
import { useProjects } from '@react/hooks/useProjects';
import { useClients } from '@react/hooks/useClients';
import { useSelection } from '@react/hooks/useSelection';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useFadeIn } from '@react/hooks/useGsap';
import { useExport, PROJECTS_EXPORT_CONFIG } from '@react/hooks/useExport';
import type { Project, ProjectStatus, SortConfig } from '../types';
import { PROJECT_STATUS_CONFIG, PROJECT_TYPE_LABELS } from '../types';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
import { PROJECTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { showToast } from '@/utils/toast-notifications';
import { notifyResult, notifyBulkResult } from '@/utils/api-wrappers';

// Static dropdown options for the Add Project modal
const PROJECT_TYPE_OPTIONS: ModalDropdownOption[] = [
  { value: 'simple-site', label: 'Simple Site' },
  { value: 'business-site', label: 'Business Site' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'web-app', label: 'Web App' },
  { value: 'browser-extension', label: 'Browser Extension' },
  { value: 'other', label: 'Other' }
];

const BUDGET_OPTIONS: ModalDropdownOption[] = [
  { value: 'under-2k', label: 'Under $2,000' },
  { value: '2k-5k', label: '$2,000 – $5,000' },
  { value: '5k-10k', label: '$5,000 – $10,000' },
  { value: '10k-25k', label: '$10,000 – $25,000' },
  { value: '25k+', label: '$25,000+' }
];

const TIMELINE_OPTIONS: ModalDropdownOption[] = [
  { value: 'asap', label: 'ASAP' },
  { value: '1-month', label: 'Within 1 month' },
  { value: '1-3-months', label: '1 – 3 months' },
  { value: '3-6-months', label: '3 – 6 months' },
  { value: 'flexible', label: 'Flexible' }
];

interface ProjectsTableProps {
  /** Navigation callback for detail views */
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}


// Filter function
function filterProject(
  project: Project,
  filters: Record<string, string[]>,
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
  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(project.status)) return false;
  }

  // Type filter
  const typeFilter = filters.type;
  if (typeFilter && typeFilter.length > 0) {
    if (!typeFilter.includes(project.project_type ?? '')) return false;
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
    return multiplier * (a.budget || '').localeCompare(b.budget || '');
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
  onNavigate,
  showNotification: _showNotification,
  defaultPageSize = 25,
  overviewMode = false
}: ProjectsTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const { projects, isLoading, error, stats, refetch, createProject, updateProject, bulkDelete } = useProjects();

  // Client list for the Add Project modal dropdown
  const { clients } = useClients();
  const clientOptions: ModalDropdownOption[] = useMemo(
    () =>
      clients.map((c) => ({
        value: String(c.id),
        label: c.company_name
          ? `${c.contact_name || c.email} (${c.company_name})`
          : (c.contact_name || c.email)
      })),
    [clients]
  );

  // Add Project modal state
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addProjectLoading, setAddProjectLoading] = useState(false);

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
    hasActiveFilters
  } = useTableFilters<Project>({
    storageKey: overviewMode ? undefined : 'admin_projects',
    filters: PROJECTS_FILTER_CONFIG,
    filterFn: filterProject,
    sortFn: sortProjects,
    defaultSort: { column: 'name', direction: 'asc' }
  });

  // Apply filters to get filtered data
  const filteredProjects = useMemo(() => applyFilters(projects), [applyFilters, projects]);

  // Pagination - overview mode disables persistence
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_projects_pagination',
    totalItems: filteredProjects.length,
    defaultPageSize
  });

  // Get paginated data
  const paginatedProjects = useMemo(
    () => pagination.paginate(filteredProjects),
    [pagination, filteredProjects]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (project: Project) => project.id,
    items: paginatedProjects
  });

  // Export functionality
  const { exportCsv, isExporting } = useExport({
    config: PROJECTS_EXPORT_CONFIG,
    data: filteredProjects,
    onExport: (count) => {
      showToast(`Exported ${count} project${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Bulk action loading state
  const [_bulkActionLoading, setBulkActionLoading] = useState(false);

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
      notifyBulkResult({ success: successCount, failed: failCount }, 'project', 'Updated');
      refetch();
    },
    [selection, updateProject, refetch]
  );

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((p) => p.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();
    notifyBulkResult(result, 'project', 'Deleted');
    refetch();
  }, [selection, bulkDelete, refetch]);

  // Handle add project form submission
  const handleAddProjectSubmit = useCallback(
    async (data: AddProjectFormData) => {
      setAddProjectLoading(true);
      try {
        const result = await createProject(data);
        if (result) {
          showToast(`Project "${result.projectName}" created successfully`, 'success');
          setAddProjectOpen(false);
        } else {
          showToast('Failed to create project', 'error');
        }
      } finally {
        setAddProjectLoading(false);
      }
    },
    [createProject]
  );

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(PROJECT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`
      })),
    []
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (projectId: number, newStatus: ProjectStatus) => {
      const success = await updateProject(projectId, { status: newStatus });
      notifyResult(success, {
        success: `Status updated to ${PROJECT_STATUS_CONFIG[newStatus].label}`,
        error: 'Failed to update status'
      });
    },
    [updateProject]
  );


  // Handle view project
  const handleViewProject = useCallback(
    (projectId: number) => {
      onNavigate?.('project-detail', String(projectId));
    },
    [onNavigate]
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
              { value: stats.active, label: 'active', variant: 'active' },
              { value: stats.onHold, label: 'on hold', variant: 'pending' }
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
              sections={PROJECTS_FILTER_CONFIG}
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
            <IconButton
              action="add"
              onClick={() => setAddProjectOpen(true)}
              title="Add New Project"
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
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.allSelected}
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
                Project
              </PortalTableHead>
              <PortalTableHead
                className="type-col"
                sortable
                sortDirection={sort?.column === 'type' ? sort.direction : null}
                onClick={() => toggleSort('type')}
              >
                Type
              </PortalTableHead>
              <PortalTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </PortalTableHead>
              <PortalTableHead
                className="amount-col"
                sortable
                sortDirection={sort?.column === 'budget' ? sort.direction : null}
                onClick={() => toggleSort('budget')}
              >
                Budget
              </PortalTableHead>
              <PortalTableHead
                className="timeline-col"
                sortable
                sortDirection={sort?.column === 'start_date' ? sort.direction : null}
                onClick={() => toggleSort('start_date')}
              >
                Timeline
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={7} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : paginatedProjects.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No projects match your filters' : 'No projects yet'}
              />
            ) : (
              paginatedProjects.map((project) => (
                <PortalTableRow
                  key={project.id}
                  clickable
                  selected={selection.isSelected(project)}
                  onClick={() => handleRowClick(project)}
                >
                  {/* Checkbox */}
                  <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(project)}
                      onCheckedChange={() => selection.toggleSelection(project)}
                      aria-label={`Select ${project.project_name || 'project'}`}
                    />
                  </PortalTableCell>

                  {/* Project Name & Client */}
                  <PortalTableCell className="primary-cell name-col">
                    <div className="cell-content">
                      <span className="cell-title">{decodeHtmlEntities(project.project_name) || 'Untitled Project'}</span>
                      {(() => {
                        const contact = decodeHtmlEntities(project.contact_name || '');
                        const company = project.company_name ? decodeHtmlEntities(project.company_name) : '';

                        let subtitle = '';
                        if (company) {
                          // Avoid duplicating company name when contact already includes it
                          if (contact && contact.toLowerCase() !== company.toLowerCase() && !contact.toLowerCase().includes(company.toLowerCase())) {
                            subtitle = `${contact} \u2014 ${company}`;
                          } else {
                            subtitle = company;
                          }
                        } else {
                          subtitle = contact;
                        }

                        return subtitle ? <span className="cell-subtitle">{subtitle}</span> : null;
                      })()}
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
                  </PortalTableCell>

                  {/* Type */}
                  <PortalTableCell className="type-col">
                    {PROJECT_TYPE_LABELS[project.project_type || ''] || project.project_type}
                  </PortalTableCell>

                  {/* Status */}
                  <PortalTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="status-dropdown-trigger" aria-label="Change project status">
                          <StatusBadge status={getStatusVariant(project.status)}>
                            {PROJECT_STATUS_CONFIG[project.status]?.label || project.status}
                          </StatusBadge>
                          <ChevronDown className="status-dropdown-caret" />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent align="start">
                        {Object.entries(PROJECT_STATUS_CONFIG)
                          .filter(([status]) => status !== project.status)
                          .map(([status, config]) => (
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
                  </PortalTableCell>

                  {/* Budget */}
                  <PortalTableCell className="amount-col">
                    {formatCurrency(project.budget)}
                  </PortalTableCell>

                  {/* Timeline - consolidated dates */}
                  <PortalTableCell className="timeline-cell">
                    <div className="cell-content">
                      {project.timeline && (
                        <span className="cell-title">{project.timeline}</span>
                      )}
                      <span className="cell-subtitle">
                        {formatDate(project.start_date)} → {formatDate(project.end_date)}
                      </span>
                    </div>
                  </PortalTableCell>

                  {/* Actions */}
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <IconButton
                        action="view"
                        onClick={() => handleViewProject(project.id)}
                        title="View project"
                      />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
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

      {/* Add Project Modal */}
      <AddProjectModal
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        onSubmit={handleAddProjectSubmit}
        clientOptions={clientOptions}
        projectTypeOptions={PROJECT_TYPE_OPTIONS}
        budgetOptions={BUDGET_OPTIONS}
        timelineOptions={TIMELINE_OPTIONS}
        loading={addProjectLoading}
      />
    </>
  );
}
