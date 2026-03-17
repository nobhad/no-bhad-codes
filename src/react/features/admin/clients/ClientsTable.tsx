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
import { getStatusVariant } from '@react/components/portal/StatusBadge';
import { StatusDropdownCell } from '@react/components/portal/StatusDropdownCell';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { ConfirmDialog, useConfirmDialog } from '@react/components/portal/ConfirmDialog';
import { useClients } from '@react/hooks/useClients';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useSelection } from '@react/hooks/useSelection';
import { useExport } from '@react/hooks/useExport';
import { useFadeIn } from '@react/hooks/useGsap';
import { CLIENTS_EXPORT_CONFIG } from '@/utils/table-export';
import type { Client, ClientStatus, SortConfig } from '../types';
import { CLIENT_STATUS_CONFIG, CLIENT_TYPE_LABELS } from '../types';
import { formatDate } from '@react/utils/formatDate';
import { CLIENTS_FILTER_CONFIG } from '../shared/filterConfigs';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { showToast } from '@/utils/toast-notifications';
import { notifyResult, notifyBulkResult } from '@/utils/api-wrappers';

// Status options for bulk actions (derived from constant config, computed once at module level)
const BULK_STATUS_OPTIONS = Object.entries(CLIENT_STATUS_CONFIG).map(([value, config]) => ({
  value,
  label: config.label,
  color: `var(--status-${value})`
}));

interface ClientsTableProps {
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
function filterClient(
  client: Client,
  filters: Record<string, string[]>,
  search: string
): boolean {
  // Search filter
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      client.contact_name?.toLowerCase().includes(searchLower) ||
      client.company_name?.toLowerCase().includes(searchLower) ||
      client.email?.toLowerCase().includes(searchLower) ||
      client.phone?.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;
  }

  // Status filter
  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(client.status)) return false;
  }

  // Type filter
  const typeFilter = filters.type;
  if (typeFilter && typeFilter.length > 0) {
    if (!typeFilter.includes(client.client_type ?? '')) return false;
  }

  return true;
}

// Sort function
function sortClients(a: Client, b: Client, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name': {
    // Sort by display name (company for business, contact for personal)
    const aName = a.client_type === 'business' ? (a.company_name || a.contact_name || '') : (a.contact_name || a.company_name || '');
    const bName = b.client_type === 'business' ? (b.company_name || b.contact_name || '') : (b.contact_name || b.company_name || '');
    return multiplier * aName.localeCompare(bName);
  }
  case 'email':
    return multiplier * a.email.localeCompare(b.email);
  case 'type':
    return multiplier * a.client_type.localeCompare(b.client_type);
  case 'status':
    return multiplier * a.status.localeCompare(b.status);
  case 'projects':
    return multiplier * ((a.project_count || 0) - (b.project_count || 0));
  case 'created_at':
    return (
      multiplier *
        (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    );
  default:
    return 0;
  }
}

// Get display name for client
function getClientDisplayName(client: Client): { primary: string; secondary: string | null } {
  if (client.client_type === 'business') {
    return {
      primary: decodeHtmlEntities(client.company_name) || 'Unknown Company',
      secondary: client.contact_name ? decodeHtmlEntities(client.contact_name) : null
    };
  }
  return {
    primary: decodeHtmlEntities(client.contact_name) || 'Unknown',
    secondary: client.company_name ? decodeHtmlEntities(client.company_name) : null
  };
}

// Get invitation status
function getInvitationStatus(client: Client): 'invited' | 'not-invited' | 'active' {
  if (client.status === 'active') return 'active';
  if (client.invitation_sent_at) return 'invited';
  return 'not-invited';
}

/**
 * ClientsTable
 * React implementation of the admin clients table
 */
export function ClientsTable({
  getAuthToken,
  onNavigate,
  showNotification: _showNotification,
  defaultPageSize = 25,
  overviewMode = false
}: ClientsTableProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Data fetching
  const { clients, isLoading, error, stats, refetch, updateClient, bulkArchive, bulkDelete, sendInvite } = useClients({
    getAuthToken
  });

  // Delete confirmation dialog
  const deleteDialog = useConfirmDialog();
  const archiveDialog = useConfirmDialog();

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
  } = useTableFilters<Client>({
    storageKey: overviewMode ? undefined : 'admin_clients',
    filters: CLIENTS_FILTER_CONFIG,
    filterFn: filterClient,
    sortFn: sortClients,
    defaultSort: { column: 'name', direction: 'asc' }
  });

  // Apply filters to get filtered data
  const filteredClients = useMemo(() => applyFilters(clients), [applyFilters, clients]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_clients_pagination',
    totalItems: filteredClients.length,
    defaultPageSize
  });

  // Get paginated data
  const paginatedClients = useMemo(
    () => pagination.paginate(filteredClients),
    [pagination, filteredClients]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (client: Client) => client.id,
    items: paginatedClients
  });

  // Export functionality
  const { exportCsv, isExporting } = useExport({
    config: CLIENTS_EXPORT_CONFIG,
    data: filteredClients,
    onExport: (count) => {
      showToast(`Exported ${count} client${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Bulk action loading state
  const [_bulkActionLoading, setBulkActionLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState<number | null>(null);

  // Handle bulk archive
  const handleBulkArchive = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    setBulkActionLoading(true);
    const ids = selection.selectedItems.map((c) => c.id);
    const result = await bulkArchive(ids);

    setBulkActionLoading(false);
    selection.clearSelection();
    notifyBulkResult(result, 'client', 'Archived');
    refetch();
  }, [selection, bulkArchive, refetch]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((c) => c.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();
    notifyBulkResult(result, 'client', 'Deleted');
    refetch();
  }, [selection, bulkDelete, refetch]);

  // Handle send invite
  const handleSendInvite = useCallback(
    async (clientId: number) => {
      setInviteLoading(clientId);
      const success = await sendInvite(clientId);
      setInviteLoading(null);
      notifyResult(success, { success: 'Invitation sent successfully', error: 'Failed to send invitation' });
    },
    [sendInvite]
  );

  const bulkStatusOptions = BULK_STATUS_OPTIONS;

  // Handle status change
  const handleStatusChange = useCallback(
    async (clientId: number, newStatus: ClientStatus) => {
      const success = await updateClient(clientId, { status: newStatus });
      notifyResult(success, {
        success: `Status updated to ${CLIENT_STATUS_CONFIG[newStatus].label}`,
        error: 'Failed to update status'
      });
    },
    [updateClient]
  );

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      setBulkActionLoading(true);
      let successCount = 0;
      let failCount = 0;

      for (const client of selection.selectedItems) {
        const success = await updateClient(client.id, { status: newStatus as ClientStatus });
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      setBulkActionLoading(false);
      selection.clearSelection();
      notifyBulkResult({ success: successCount, failed: failCount }, 'client', 'Updated');
      refetch();
    },
    [selection, updateClient, refetch]
  );

  // Handle view client
  const handleViewClient = useCallback(
    (clientId: number) => {
      onNavigate?.('client-detail', String(clientId));
    },
    [onNavigate]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (client: Client) => {
      handleViewClient(client.id);
    },
    [handleViewClient]
  );

  // Custom bulk actions
  const bulkActions = useMemo(
    () => [
      {
        id: 'archive',
        label: 'Archive',
        onClick: archiveDialog.open
      }
    ],
    [archiveDialog.open]
  );

  // Handle filter change for FilterDropdown
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="CLIENT ACCOUNTS"
      stats={
        <TableStats
          items={[
            { value: stats.total },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.inactive, label: 'inactive', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total / ${stats.active} Active / ${stats.pending} Pending / ${stats.inactive} Inactive`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search clients..."
          />
          <FilterDropdown
            sections={CLIENTS_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            onClick={exportCsv}
            disabled={isExporting || filteredClients.length === 0}
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
          totalCount={filteredClients.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredClients)}
          allSelected={selection.allSelected && selection.selectedCount === filteredClients.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          actions={bulkActions}
          onDelete={
            filterValues.status?.some((s: string) => ['inactive'].includes(s))
              ? deleteDialog.open
              : undefined
          }
          deleteLoading={deleteDialog.isLoading}
        />
      }
      pagination={
        !isLoading && filteredClients.length > 0 ? (
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
      <div className="data-table-scroll-wrapper">
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
                Client
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
                className="projects-col"
                sortable
                sortDirection={sort?.column === 'projects' ? sort.direction : null}
                onClick={() => toggleSort('projects')}
              >
                Projects
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
              <PortalTableError colSpan={7} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={7} rows={5} />
            ) : paginatedClients.length === 0 ? (
              <PortalTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No clients match your filters' : 'No clients yet'}
              />
            ) : (
              paginatedClients.map((client) => {
                const displayName = getClientDisplayName(client);
                const inviteStatus = getInvitationStatus(client);

                return (
                  <PortalTableRow
                    key={client.id}
                    clickable
                    selected={selection.isSelected(client)}
                    onClick={() => handleRowClick(client)}
                    data-client-id={client.id}
                  >
                    {/* Checkbox */}
                    <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.isSelected(client)}
                        onCheckedChange={() => selection.toggleSelection(client)}
                        aria-label={`Select ${displayName.primary}`}
                      />
                    </PortalTableCell>

                    {/* Client Name & Email */}
                    <PortalTableCell className="primary-cell contact-cell">
                      <div className="cell-content">
                        {client.company_name && (
                          <span className="identity-company">{decodeHtmlEntities(client.company_name)}</span>
                        )}
                        <span className="cell-title identity-name">
                          {decodeHtmlEntities(client.contact_name || '') || displayName.primary}
                        </span>
                        <span className="cell-subtitle identity-email">{client.email}</span>
                        {client.phone && (
                          <span className="cell-subtitle identity-phone">{client.phone}</span>
                        )}
                        {/* Stacked content for responsive - hidden on desktop */}
                        <span className="type-stacked">{CLIENT_TYPE_LABELS[client.client_type]}</span>
                        {(client.project_count || 0) > 0 && (
                          <span className="count-stacked">{client.project_count} project{client.project_count !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </PortalTableCell>

                    {/* Type */}
                    <PortalTableCell className="type-cell">
                      {CLIENT_TYPE_LABELS[client.client_type]}
                    </PortalTableCell>

                    {/* Status */}
                    <StatusDropdownCell
                      status={client.status}
                      statusConfig={CLIENT_STATUS_CONFIG}
                      onStatusChange={(newStatus) => handleStatusChange(client.id, newStatus as ClientStatus)}
                      ariaLabel="Change client status"
                      renderTriggerLabel={(s) =>
                        inviteStatus === 'not-invited' ? 'Not Invited' :
                          inviteStatus === 'invited' ? 'Invited' :
                            CLIENT_STATUS_CONFIG[s as ClientStatus]?.label || s
                      }
                      getVariant={(s) =>
                        inviteStatus === 'not-invited' ? 'not-invited' : getStatusVariant(s)
                      }
                    />

                    {/* Project Count */}
                    <PortalTableCell className="projects-cell">
                      {client.project_count || 0}
                    </PortalTableCell>

                    {/* Created Date */}
                    <PortalTableCell className="date-col">
                      {formatDate(client.created_at)}
                    </PortalTableCell>

                    {/* Actions */}
                    <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="action-group">
                        <IconButton
                          action="view"
                          onClick={() => handleViewClient(client.id)}
                          title="View client"
                        />
                        {inviteStatus === 'not-invited' && (
                          <IconButton
                            action="send"
                            onClick={() => handleSendInvite(client.id)}
                            disabled={inviteLoading === client.id}
                            title="Send invitation"
                          />
                        )}
                        {client.phone && (
                          <IconButton
                            action="call"
                            onClick={() => window.location.href = `tel:${client.phone}`}
                            title="Call client"
                          />
                        )}
                      </div>
                    </PortalTableCell>
                  </PortalTableRow>
                );
              })
            )}
          </PortalTableBody>
        </PortalTable>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={deleteDialog.setIsOpen}
        title="Delete Clients"
        description={`Are you sure you want to delete ${selection.selectedCount} client${selection.selectedCount !== 1 ? 's' : ''}? This action cannot be undone and will also delete all associated projects and data.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleBulkDelete}
        variant="danger"
        loading={deleteDialog.isLoading}
      />

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={archiveDialog.isOpen}
        onOpenChange={archiveDialog.setIsOpen}
        title="Archive Clients"
        description={`Are you sure you want to archive ${selection.selectedCount} client${selection.selectedCount !== 1 ? 's' : ''}? Archived clients can be restored later.`}
        confirmText="Archive"
        cancelText="Cancel"
        onConfirm={handleBulkArchive}
        variant="warning"
        loading={archiveDialog.isLoading}
      />
    </TableLayout>
  );
}
