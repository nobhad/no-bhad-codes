import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox, Download, RefreshCw, Eye, Mail, ChevronDown } from 'lucide-react';
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
  AdminTableLoading
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
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useLeads } from '@react/hooks/useLeads';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useSelection } from '@react/hooks/useSelection';
import { useFadeIn } from '@react/hooks/useGsap';
import { useExport, LEADS_EXPORT_CONFIG } from '@react/hooks/useExport';
import type { Lead, LeadStatus, SortConfig } from '../types';
import { LEAD_STATUS_CONFIG, LEAD_SOURCE_LABELS, PROJECT_TYPE_LABELS } from '../types';
import { formatDate } from '@react/utils/formatDate';

interface LeadsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when lead is selected for detail view */
  onViewLead?: (leadId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Filter configuration for useTableFilters hook
const FILTER_CONFIG = [
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'all', label: 'All Statuses' },
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'qualified', label: 'Qualified' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'converted', label: 'Converted' },
      { value: 'lost', label: 'Lost' },
      { value: 'on-hold', label: 'On Hold' }
    ]
  },
  {
    key: 'source',
    label: 'Source',
    options: [
      { value: 'all', label: 'All Sources' },
      { value: 'website', label: 'Website' },
      { value: 'referral', label: 'Referral' },
      { value: 'social', label: 'Social Media' },
      { value: 'direct', label: 'Direct' },
      { value: 'ad-campaign', label: 'Ad Campaign' }
    ]
  }
];

// Filter sections for FilterDropdown component
const FILTER_SECTIONS = [
  {
    key: 'status',
    label: 'STATUS',
    options: [
      { value: 'all', label: 'All Statuses' },
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'qualified', label: 'Qualified' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'converted', label: 'Converted' },
      { value: 'lost', label: 'Lost' },
      { value: 'on-hold', label: 'On Hold' }
    ]
  },
  {
    key: 'source',
    label: 'SOURCE',
    options: [
      { value: 'all', label: 'All Sources' },
      { value: 'website', label: 'Website' },
      { value: 'referral', label: 'Referral' },
      { value: 'social', label: 'Social Media' },
      { value: 'direct', label: 'Direct' },
      { value: 'ad-campaign', label: 'Ad Campaign' }
    ]
  }
];

// Filter function
function filterLead(
  lead: Lead,
  filters: Record<string, string>,
  search: string
): boolean {
  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      lead.contact_name?.toLowerCase().includes(searchLower) ||
      lead.company_name?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.project_name?.toLowerCase().includes(searchLower) ||
      lead.description?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    if (lead.status !== filters.status) return false;
  }

  // Source filter
  if (filters.source && filters.source !== 'all') {
    if (lead.source !== filters.source) return false;
  }

  return true;
}

// Sort function
function sortLeads(a: Lead, b: Lead, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
    case 'name':
      return multiplier * (a.contact_name || '').localeCompare(b.contact_name || '');
    case 'company':
      return multiplier * (a.company_name || '').localeCompare(b.company_name || '');
    case 'status':
      return multiplier * a.status.localeCompare(b.status);
    case 'source':
      return multiplier * (a.source || '').localeCompare(b.source || '');
    case 'created_at':
      return (
        multiplier *
        (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      );
    default:
      return 0;
  }
}

/**
 * LeadsTable
 * React implementation of the admin leads table
 */
export function LeadsTable({
  getAuthToken,
  onViewLead,
  showNotification
}: LeadsTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const { leads, isLoading, error, stats, refetch, updateLead, bulkUpdateStatus, bulkDelete } = useLeads({
    getAuthToken
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
    hasActiveFilters
  } = useTableFilters<Lead>({
    storageKey: 'admin_leads',
    filters: FILTER_CONFIG,
    filterFn: filterLead,
    sortFn: sortLeads,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  // Apply filters to get filtered data
  const filteredLeads = useMemo(() => applyFilters(leads), [applyFilters, leads]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_leads_pagination',
    totalItems: filteredLeads.length,
    defaultPageSize: 25
  });

  // Get paginated data
  const paginatedLeads = useMemo(
    () => pagination.paginate(filteredLeads),
    [pagination, filteredLeads]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (lead: Lead) => lead.id,
    items: paginatedLeads
  });

  // Export functionality
  const { exportCsv, isExporting } = useExport({
    config: LEADS_EXPORT_CONFIG,
    data: filteredLeads,
    onExport: (count) => {
      showNotification?.(`Exported ${count} lead${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Bulk action loading state
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      setBulkActionLoading(true);
      const ids = selection.selectedItems.map((lead) => lead.id);
      const success = await bulkUpdateStatus(ids, newStatus as LeadStatus);

      setBulkActionLoading(false);
      selection.clearSelection();

      if (success) {
        showNotification?.(
          `Updated ${ids.length} lead${ids.length !== 1 ? 's' : ''} to ${LEAD_STATUS_CONFIG[newStatus as LeadStatus]?.label || newStatus}`,
          'success'
        );
      } else {
        showNotification?.('Failed to update leads', 'error');
      }

      refetch();
    },
    [selection, bulkUpdateStatus, showNotification, refetch]
  );

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((lead) => lead.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Deleted ${result.success} lead${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Deleted ${result.success}, failed ${result.failed} lead${result.failed !== 1 ? 's' : ''}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to delete leads', 'error');
    }

    refetch();
  }, [selection, bulkDelete, showNotification, refetch]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(LEAD_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value === 'new' ? 'pending' : value})`
      })),
    []
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (leadId: number, newStatus: LeadStatus) => {
      const success = await updateLead(leadId, { status: newStatus });
      if (success) {
        showNotification?.(`Status updated to ${LEAD_STATUS_CONFIG[newStatus].label}`, 'success');
      } else {
        showNotification?.('Failed to update status', 'error');
      }
    },
    [updateLead, showNotification]
  );

  // Handle view lead
  const handleViewLead = useCallback(
    (leadId: number) => {
      onViewLead?.(leadId);
    },
    [onViewLead]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (lead: Lead) => {
      handleViewLead(lead.id);
    },
    [handleViewLead]
  );

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="LEADS"
        stats={
          <TableStats
            items={[
              { value: stats.total, label: 'total' },
              { value: stats.new, label: 'new', variant: 'active', hideIfZero: true },
              { value: stats.qualified, label: 'qualified', variant: 'completed', hideIfZero: true }
            ]}
            tooltip={`${stats.total} Total • ${stats.new} New • ${stats.contacted} Contacted • ${stats.qualified} Qualified`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search leads..."
            />
            <FilterDropdown
              sections={FILTER_SECTIONS}
              values={filterValues}
              onChange={setFilter}
            />
            <IconButton
              action="download"
              onClick={exportCsv}
              disabled={isExporting || filteredLeads.length === 0}
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
            totalCount={filteredLeads.length}
            onClearSelection={selection.clearSelection}
            onSelectAll={() => selection.selectMany(filteredLeads)}
            allSelected={selection.allSelected && selection.selectedCount === filteredLeads.length}
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
          !isLoading && filteredLeads.length > 0 ? (
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
              <AdminTableHead className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selection.allSelected}
                  onCheckedChange={selection.toggleSelectAll}
                  aria-label="Select all"
                />
              </AdminTableHead>
              <AdminTableHead
                className="contact-col"
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Contact
              </AdminTableHead>
              <AdminTableHead
                className="company-col"
                sortable
                sortDirection={sort?.column === 'company' ? sort.direction : null}
                onClick={() => toggleSort('company')}
              >
                Company
              </AdminTableHead>
              <AdminTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </AdminTableHead>
              <AdminTableHead className="type-col">Project Type</AdminTableHead>
              <AdminTableHead
                className="source-col"
                sortable
                sortDirection={sort?.column === 'source' ? sort.direction : null}
                onClick={() => toggleSort('source')}
              >
                Source
              </AdminTableHead>
              <AdminTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'created_at' ? sort.direction : null}
                onClick={() => toggleSort('created_at')}
              >
                Created
              </AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={8} rows={5} />
            ) : paginatedLeads.length === 0 ? (
              <AdminTableEmpty
                colSpan={8}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No leads match your filters' : 'No leads yet'}
              />
            ) : (
              paginatedLeads.map((lead) => (
                <AdminTableRow
                  key={lead.id}
                  clickable
                  selected={selection.isSelected(lead)}
                  onClick={() => handleRowClick(lead)}
                >
                  {/* Checkbox */}
                  <AdminTableCell className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(lead)}
                      onCheckedChange={() => selection.toggleSelection(lead)}
                      aria-label={`Select ${lead.contact_name || 'lead'}`}
                    />
                  </AdminTableCell>

                  {/* Contact Name & Email (with stacked content for responsive) */}
                  <AdminTableCell className="primary-cell contact-cell">
                    <div className="cell-content">
                      <span className="cell-title">{lead.contact_name || 'Unknown'}</span>
                      <span className="cell-subtitle">{lead.email}</span>
                      {/* Stacked content - shown when columns hidden */}
                      {lead.company_name && (
                        <span className="company-stacked">{lead.company_name}</span>
                      )}
                      {lead.project_type && (
                        <span className="type-stacked">
                          {PROJECT_TYPE_LABELS[lead.project_type] || lead.project_type}
                        </span>
                      )}
                      {lead.source && (
                        <span className="source-stacked">
                          {LEAD_SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      )}
                    </div>
                  </AdminTableCell>

                  {/* Company (hidden on narrow viewports) */}
                  <AdminTableCell className="company-cell">
                    <div className="cell-content">
                      <span className="cell-title">{lead.company_name || '-'}</span>
                      {lead.phone && (
                        <span className="cell-subtitle">{lead.phone}</span>
                      )}
                    </div>
                  </AdminTableCell>

                  {/* Status */}
                  <AdminTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="status-dropdown-trigger">
                          <StatusBadge status={getStatusVariant(lead.status)}>
                            {LEAD_STATUS_CONFIG[lead.status]?.label || lead.status}
                          </StatusBadge>
                          <ChevronDown className="status-dropdown-caret" />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent sideOffset={0} align="start">
                        {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => (
                          <PortalDropdownItem
                            key={status}
                            onClick={() => handleStatusChange(lead.id, status as LeadStatus)}
                          >
                            <StatusBadge status={getStatusVariant(status)} size="sm">
                              {config.label}
                            </StatusBadge>
                          </PortalDropdownItem>
                        ))}
                      </PortalDropdownContent>
                    </PortalDropdown>
                  </AdminTableCell>

                  {/* Project Type */}
                  <AdminTableCell className="type-cell">
                    {PROJECT_TYPE_LABELS[lead.project_type || ''] || lead.project_type || '-'}
                  </AdminTableCell>

                  {/* Source */}
                  <AdminTableCell className="source-cell">
                    {LEAD_SOURCE_LABELS[lead.source || ''] || lead.source || '-'}
                  </AdminTableCell>

                  {/* Created Date */}
                  <AdminTableCell className="date-cell">
                    {formatDate(lead.created_at)}
                  </AdminTableCell>

                  {/* Actions */}
                  <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <IconButton
                        action="view"
                        onClick={() => handleViewLead(lead.id)}
                        title="View lead"
                      />
                      {lead.email && (
                        <IconButton
                          action="email"
                          onClick={() => window.location.href = `mailto:${lead.email}`}
                          title="Send email"
                        />
                      )}
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
        title="Delete Leads"
        description={`Are you sure you want to delete ${selection.selectedCount} lead${selection.selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleBulkDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />
    </>
  );
}
