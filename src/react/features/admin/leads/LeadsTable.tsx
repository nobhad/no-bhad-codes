import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
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
import { StatusDropdownCell } from '@react/components/portal/StatusDropdownCell';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
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
import { LEADS_FILTER_CONFIG } from '../shared/filterConfigs';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { showToast } from '@/utils/toast-notifications';
import { notifyResult, notifyBulkResult } from '@/utils/api-wrappers';
import { LeadDetailPanel } from './LeadDetailPanel';

interface LeadsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Navigation callback for detail views */
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}


// Filter function
function filterLead(
  lead: Lead,
  filters: Record<string, string[]>,
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
  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(lead.status)) return false;
  }

  // Source filter
  const sourceFilter = filters.source;
  if (sourceFilter && sourceFilter.length > 0) {
    if (!sourceFilter.includes(lead.source ?? '')) return false;
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
  onNavigate,
  showNotification,
  defaultPageSize = 25,
  overviewMode = false
}: LeadsTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const { leads, isLoading, error, stats, refetch, updateLead, bulkUpdateStatus, bulkDelete } = useLeads();

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
    storageKey: overviewMode ? undefined : 'admin_leads',
    filters: LEADS_FILTER_CONFIG,
    filterFn: filterLead,
    sortFn: sortLeads,
    defaultSort: { column: 'created_at', direction: 'desc' }
  });

  // Apply filters to get filtered data
  const filteredLeads = useMemo(() => applyFilters(leads), [applyFilters, leads]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_leads_pagination',
    totalItems: filteredLeads.length,
    defaultPageSize
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
      showToast(`Exported ${count} lead${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Filter change handler
  const handleFilterChange = useCallback(
    (key: string, value: string) => setFilter(key, value),
    [setFilter]
  );

  // Bulk action loading state
  const [_bulkActionLoading, setBulkActionLoading] = useState(false);

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      setBulkActionLoading(true);
      const ids = selection.selectedItems.map((lead) => lead.id);
      const success = await bulkUpdateStatus(ids, newStatus as LeadStatus);

      setBulkActionLoading(false);
      selection.clearSelection();
      notifyResult(success, {
        success: `Updated ${ids.length} lead${ids.length !== 1 ? 's' : ''} to ${LEAD_STATUS_CONFIG[newStatus as LeadStatus]?.label || newStatus}`,
        error: 'Failed to update leads'
      });
      refetch();
    },
    [selection, bulkUpdateStatus, refetch]
  );

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((lead) => lead.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();
    notifyBulkResult(result, 'lead', 'Deleted');
    refetch();
  }, [selection, bulkDelete, refetch]);

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
      notifyResult(success, {
        success: `Status updated to ${LEAD_STATUS_CONFIG[newStatus].label}`,
        error: 'Failed to update status'
      });
    },
    [updateLead]
  );

  // Handle view lead (full-page navigation)
  const handleViewLead = useCallback(
    (leadId: number) => {
      onNavigate?.('lead-detail', String(leadId));
    },
    [onNavigate]
  );

  // Detail panel state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Open detail panel on row click instead of navigating
  const handleRowClick = useCallback(
    (lead: Lead) => {
      setSelectedLead(lead);
    },
    []
  );

  // Close detail panel
  const handleClosePanel = useCallback(() => {
    setSelectedLead(null);
  }, []);

  // Handle status change from panel
  const handlePanelStatusChange = useCallback(
    async (leadId: number, newStatus: LeadStatus) => {
      const success = await updateLead(leadId, { status: newStatus });
      notifyResult(success, {
        success: `Status updated to ${LEAD_STATUS_CONFIG[newStatus].label}`,
        error: 'Failed to update status'
      });
      if (success) {
        // Update the selected lead in panel
        setSelectedLead((prev) =>
          prev && prev.id === leadId ? { ...prev, status: newStatus } : prev
        );
      }
    },
    [updateLead]
  );

  return (
    <div>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="LEADS"
        stats={
          <TableStats
            items={[
              { value: stats.total, label: 'total' },
              { value: stats.new, label: 'new', variant: 'active' },
              { value: stats.qualified, label: 'qualified', variant: 'completed' }
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
              sections={LEADS_FILTER_CONFIG}
              values={filterValues}
              onChange={handleFilterChange}
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
                className="contact-col"
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Contact
              </PortalTableHead>
              <PortalTableHead className="type-col">Project Type</PortalTableHead>
              <PortalTableHead
                className="status-col"
                sortable
                sortDirection={sort?.column === 'status' ? sort.direction : null}
                onClick={() => toggleSort('status')}
              >
                Status
              </PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'created_at' ? sort.direction : null}
                onClick={() => toggleSort('created_at')}
              >
                Created
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={6} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={6} rows={5} />
            ) : paginatedLeads.length === 0 ? (
              <PortalTableEmpty
                colSpan={6}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No leads match your filters' : 'No leads yet'}
              />
            ) : (
              paginatedLeads.map((lead) => (
                <PortalTableRow
                  key={lead.id}
                  clickable
                  selected={selection.isSelected(lead)}
                  onClick={() => handleRowClick(lead)}
                >
                  {/* Checkbox */}
                  <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(lead)}
                      onCheckedChange={() => selection.toggleSelection(lead)}
                      aria-label={`Select ${lead.contact_name || 'lead'}`}
                    />
                  </PortalTableCell>

                  {/* Contact - consolidated name, email, company, phone */}
                  <PortalTableCell className="primary-cell contact-cell">
                    <div className="cell-content">
                      {lead.company_name && (
                        <span className="identity-company">
                          {lead.client_id && onNavigate ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('client-detail', String(lead.client_id));
                              }}
                              className="table-link"
                            >
                              {decodeHtmlEntities(lead.company_name)}
                            </span>
                          ) : (
                            decodeHtmlEntities(lead.company_name)
                          )}
                        </span>
                      )}
                      <span className="cell-title identity-name">{decodeHtmlEntities(lead.contact_name) || 'Unknown'}</span>
                      <span className="cell-subtitle identity-email">{decodeHtmlEntities(lead.email)}</span>
                      {lead.phone && (
                        <span className="cell-subtitle identity-phone">{lead.phone}</span>
                      )}
                      {/* Stacked content for narrow viewports */}
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
                  </PortalTableCell>

                  {/* Project Type */}
                  <PortalTableCell className="type-cell">
                    {PROJECT_TYPE_LABELS[lead.project_type || ''] || lead.project_type}
                  </PortalTableCell>

                  {/* Status */}
                  <StatusDropdownCell
                    status={lead.status}
                    statusConfig={LEAD_STATUS_CONFIG}
                    onStatusChange={(newStatus) => handleStatusChange(lead.id, newStatus as LeadStatus)}
                    ariaLabel="Change lead status"
                  />

                  {/* Created Date */}
                  <PortalTableCell className="date-cell">
                    {formatDate(lead.created_at)}
                  </PortalTableCell>

                  {/* Actions */}
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
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
        title="Delete Leads"
        description={`Are you sure you want to delete ${selection.selectedCount} lead${selection.selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleBulkDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />

      {/* Lead Detail Overlay Panel */}
      <LeadDetailPanel
        lead={selectedLead}
        onClose={handleClosePanel}
        onStatusChange={handlePanelStatusChange}
        onNavigate={onNavigate}
        getAuthToken={getAuthToken}
        showNotification={showNotification}
      />
    </div>
  );
}
