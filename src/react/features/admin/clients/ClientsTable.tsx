import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Inbox, Download, RefreshCw, Eye, Send, Phone } from 'lucide-react';
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
import { useClients } from '@react/hooks/useClients';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePagination } from '@react/hooks/usePagination';
import { useSelection } from '@react/hooks/useSelection';
import { useExport } from '@react/hooks/useExport';
import { useFadeIn } from '@react/hooks/useGsap';
import { CLIENTS_EXPORT_CONFIG } from '../../../../utils/table-export';
import type { Client, ClientStatus, SortConfig } from '../types';
import { CLIENT_STATUS_CONFIG, CLIENT_TYPE_LABELS } from '../types';
import { formatDate } from '@react/utils/formatDate';

interface ClientsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Callback when client is selected for detail view */
  onViewClient?: (clientId: number) => void;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Filter configuration
const FILTER_CONFIG = [
  {
    key: 'status',
    label: 'STATUS',
    options: [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending' }
    ]
  },
  {
    key: 'type',
    label: 'TYPE',
    options: [
      { value: 'all', label: 'All Types' },
      { value: 'personal', label: 'Personal' },
      { value: 'business', label: 'Business' }
    ]
  }
];

// Filter function
function filterClient(
  client: Client,
  filters: Record<string, string>,
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
  if (filters.status && filters.status !== 'all') {
    if (client.status !== filters.status) return false;
  }

  // Type filter
  if (filters.type && filters.type !== 'all') {
    if (client.client_type !== filters.type) return false;
  }

  return true;
}

// Sort function
function sortClients(a: Client, b: Client, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
    case 'name':
      // Sort by display name (company for business, contact for personal)
      const aName = a.client_type === 'business' ? (a.company_name || a.contact_name || '') : (a.contact_name || a.company_name || '');
      const bName = b.client_type === 'business' ? (b.company_name || b.contact_name || '') : (b.contact_name || b.company_name || '');
      return multiplier * aName.localeCompare(bName);
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
      primary: client.company_name || 'Unknown Company',
      secondary: client.contact_name
    };
  }
  return {
    primary: client.contact_name || 'Unknown',
    secondary: client.company_name
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
  onViewClient,
  showNotification
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
    clearFilters,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Client>({
    storageKey: 'admin_clients',
    filters: FILTER_CONFIG,
    filterFn: filterClient,
    sortFn: sortClients,
    defaultSort: { column: 'name', direction: 'asc' }
  });

  // Apply filters to get filtered data
  const filteredClients = useMemo(() => applyFilters(clients), [applyFilters, clients]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_clients_pagination',
    totalItems: filteredClients.length,
    defaultPageSize: 25
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
      showNotification?.(`Exported ${count} client${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Bulk action loading state
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState<number | null>(null);

  // Handle bulk archive
  const handleBulkArchive = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    setBulkActionLoading(true);
    const ids = selection.selectedItems.map((c) => c.id);
    const result = await bulkArchive(ids);

    setBulkActionLoading(false);
    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Archived ${result.success} client${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Archived ${result.success}, failed ${result.failed} client${result.failed !== 1 ? 's' : ''}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to archive clients', 'error');
    }

    refetch();
  }, [selection, bulkArchive, showNotification, refetch]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((c) => c.id);
    const result = await bulkDelete(ids);

    selection.clearSelection();

    if (result.failed === 0) {
      showNotification?.(
        `Deleted ${result.success} client${result.success !== 1 ? 's' : ''}`,
        'success'
      );
    } else if (result.success > 0) {
      showNotification?.(
        `Deleted ${result.success}, failed ${result.failed} client${result.failed !== 1 ? 's' : ''}`,
        'warning'
      );
    } else {
      showNotification?.('Failed to delete clients', 'error');
    }

    refetch();
  }, [selection, bulkDelete, showNotification, refetch]);

  // Handle send invite
  const handleSendInvite = useCallback(
    async (clientId: number) => {
      setInviteLoading(clientId);
      const success = await sendInvite(clientId);
      setInviteLoading(null);

      if (success) {
        showNotification?.('Invitation sent successfully', 'success');
      } else {
        showNotification?.('Failed to send invitation', 'error');
      }
    },
    [sendInvite, showNotification]
  );

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(CLIENT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`
      })),
    []
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (clientId: number, newStatus: ClientStatus) => {
      const success = await updateClient(clientId, { status: newStatus });
      if (success) {
        showNotification?.(`Status updated to ${CLIENT_STATUS_CONFIG[newStatus].label}`, 'success');
      } else {
        showNotification?.('Failed to update status', 'error');
      }
    },
    [updateClient, showNotification]
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

      if (failCount === 0) {
        showNotification?.(
          `Updated ${successCount} client${successCount !== 1 ? 's' : ''} to ${CLIENT_STATUS_CONFIG[newStatus as ClientStatus]?.label || newStatus}`,
          'success'
        );
      } else {
        showNotification?.(
          `Updated ${successCount}, failed ${failCount} client${failCount !== 1 ? 's' : ''}`,
          'warning'
        );
      }

      refetch();
    },
    [selection, updateClient, showNotification, refetch]
  );

  // Handle view client
  const handleViewClient = useCallback(
    (clientId: number) => {
      onViewClient?.(clientId);
    },
    [onViewClient]
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
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.inactive, label: 'inactive', variant: 'overdue', hideIfZero: true }
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
            sections={FILTER_CONFIG}
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
          onDelete={deleteDialog.open}
          deleteLoading={deleteDialog.isLoading}
        />
      }
      error={
        error ? (
          <div className="error-message">
            {error}
            <button className="btn btn-secondary btn-sm" onClick={refetch}>Retry</button>
          </div>
        ) : undefined
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
      <div className="admin-table-scroll-wrapper">
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
                className="contact-col"
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
                Client
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
                className="projects-col"
                sortable
                sortDirection={sort?.column === 'projects' ? sort.direction : null}
                onClick={() => toggleSort('projects')}
              >
                Projects
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
              <AdminTableLoading colSpan={7} rows={5} />
            ) : paginatedClients.length === 0 ? (
              <AdminTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No clients match your filters' : 'No clients yet'}
              />
            ) : (
              paginatedClients.map((client) => {
                const displayName = getClientDisplayName(client);
                const inviteStatus = getInvitationStatus(client);

                return (
                  <AdminTableRow
                    key={client.id}
                    clickable
                    selected={selection.isSelected(client)}
                    onClick={() => handleRowClick(client)}
                    data-client-id={client.id}
                  >
                    {/* Checkbox */}
                    <AdminTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selection.isSelected(client)}
                        onCheckedChange={() => selection.toggleSelection(client)}
                        aria-label={`Select ${displayName.primary}`}
                      />
                    </AdminTableCell>

                    {/* Client Name & Email */}
                    <AdminTableCell className="primary-cell">
                      <div className="cell-content">
                        <span className="cell-title">{displayName.primary}</span>
                        <span className="cell-subtitle">{client.email}</span>
                        {displayName.secondary && (
                          <span className="cell-subtitle">{displayName.secondary}</span>
                        )}
                      </div>
                    </AdminTableCell>

                    {/* Type */}
                    <AdminTableCell>
                      {CLIENT_TYPE_LABELS[client.client_type]}
                    </AdminTableCell>

                    {/* Status */}
                    <AdminTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                      <PortalDropdown>
                        <PortalDropdownTrigger asChild>
                          <button className="status-badge-btn">
                            <StatusBadge status={inviteStatus === 'not-invited' ? 'not-invited' : getStatusVariant(client.status)}>
                              {inviteStatus === 'not-invited' ? 'Not Invited' :
                               inviteStatus === 'invited' ? 'Invited' :
                               CLIENT_STATUS_CONFIG[client.status]?.label || client.status}
                            </StatusBadge>
                          </button>
                        </PortalDropdownTrigger>
                        <PortalDropdownContent>
                          {Object.entries(CLIENT_STATUS_CONFIG).map(([status, config]) => (
                            <PortalDropdownItem
                              key={status}
                              onClick={() => handleStatusChange(client.id, status as ClientStatus)}
                            >
                              <StatusBadge status={getStatusVariant(status)} size="sm">
                                {config.label}
                              </StatusBadge>
                            </PortalDropdownItem>
                          ))}
                        </PortalDropdownContent>
                      </PortalDropdown>
                    </AdminTableCell>

                    {/* Project Count */}
                    <AdminTableCell>
                      {client.project_count || 0}
                    </AdminTableCell>

                    {/* Created Date */}
                    <AdminTableCell className="date-cell">
                      {formatDate(client.created_at)}
                    </AdminTableCell>

                    {/* Actions */}
                    <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <div className="table-actions">
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
                    </AdminTableCell>
                  </AdminTableRow>
                );
              })
            )}
          </AdminTableBody>
        </AdminTable>
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
