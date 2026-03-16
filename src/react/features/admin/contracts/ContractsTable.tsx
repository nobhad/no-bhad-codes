import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Inbox,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Send
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { StatusDropdownCell } from '@react/components/portal/StatusDropdownCell';
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
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { useEntityOptions } from '@react/hooks/useEntityOptions';
import { CONTRACTS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { createLogger } from '@/utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost, apiFetch } from '@/utils/api-client';
import { CreateContractModal } from '../modals/CreateEntityModals';

const logger = createLogger('ContractsTable');

interface Contract {
  id: number;
  templateId?: number | null;
  templateName?: string;
  templateType?: string | null;
  projectId: number;
  projectName?: string;
  clientId: number;
  clientName?: string;
  clientEmail?: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';
  content?: string;
  sentAt?: string | null;
  signedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContractStats {
  total: number;
  draft: number;
  pending: number;
  signed: number;
  expired: number;
}

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', icon: <FileText /> },
  sent: { label: 'Sent', icon: <Send /> },
  viewed: { label: 'Viewed', icon: <Eye /> },
  signed: { label: 'Signed', icon: <CheckCircle /> },
  expired: { label: 'Expired', icon: <Clock /> },
  cancelled: { label: 'Cancelled', icon: <XCircle /> }
};

const DEFAULT_CONTRACT_STATS: ContractStats = {
  total: 0,
  draft: 0,
  pending: 0,
  signed: 0,
  expired: 0
};

interface ContractsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  /** Default page size for pagination */
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

// Filter function
function filterContract(
  contract: Contract,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      (contract.templateName?.toLowerCase().includes(searchLower) || false) ||
      (contract.clientName?.toLowerCase().includes(searchLower) || false) ||
      (contract.clientEmail?.toLowerCase().includes(searchLower) || false) ||
      (contract.projectName?.toLowerCase().includes(searchLower) || false);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(contract.status)) return false;
  }

  return true;
}

// Sort function
function sortContracts(a: Contract, b: Contract, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * (a.templateName || '').localeCompare(b.templateName || '');
  case 'client':
    return multiplier * (a.clientName || '').localeCompare(b.clientName || '');
  case 'createdAt':
    return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  default:
    return 0;
  }
}

export function ContractsTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: ContractsTableProps) {
  const containerRef = useFadeIn();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const { clientOptions: entityClients, projectOptions: entityProjects } = useEntityOptions(createOpen);

  const { data, isLoading, error, refetch, setData } = useListFetch<Contract, ContractStats>({
    endpoint: API_ENDPOINTS.CONTRACTS,
    getAuthToken,
    defaultStats: DEFAULT_CONTRACT_STATS,
    itemsKey: 'contracts'
  });
  const contracts = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_CONTRACT_STATS, [data]);

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
  } = useTableFilters<Contract>({
    storageKey: overviewMode ? undefined : 'admin_contracts',
    filters: CONTRACTS_FILTER_CONFIG,
    filterFn: filterContract,
    sortFn: sortContracts,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  // Apply filters
  const filteredContracts = useMemo(() => applyFilters(contracts), [applyFilters, contracts]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_contracts_pagination',
    totalItems: filteredContracts.length,
    defaultPageSize
  });

  const paginatedContracts = useMemo(
    () => pagination.paginate(filteredContracts),
    [pagination, filteredContracts]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (contract: Contract) => contract.id,
    items: paginatedContracts
  });

  // Status change handler
  const handleStatusChange = useCallback(async (contractId: number, newStatus: string) => {
    try {
      const response = await apiFetch(buildEndpoint.contract(contractId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update contract');

      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((contract) =>
          contract.id === contractId
            ? { ...contract, status: newStatus as Contract['status'] }
            : contract
        )
      } : prev);
      showNotification?.('Contract status updated', 'success');
    } catch (err) {
      logger.error('Failed to update contract status:', err);
      showNotification?.('Failed to update contract status', 'error');
    }
  }, [showNotification, setData]);

  const handleSendContract = useCallback(async (contractId: number) => {
    try {
      const response = await apiPost(buildEndpoint.contractSend(contractId));

      if (!response.ok) throw new Error('Failed to send contract');

      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((contract) =>
          contract.id === contractId
            ? { ...contract, status: 'sent', sentAt: new Date().toISOString() }
            : contract
        )
      } : prev);
      showNotification?.('Contract sent', 'success');
    } catch (err) {
      logger.error('Failed to send contract:', err);
      showNotification?.('Failed to send contract', 'error');
    }
  }, [showNotification, setData]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((c) => c.id);
    try {
      const response = await apiPost(API_ENDPOINTS.CONTRACTS_BULK_DELETE, { ids });

      if (!response.ok) throw new Error('Failed to delete contracts');

      setData((prev) => prev ? {
        ...prev,
        items: prev.items.filter((c) => !ids.includes(c.id))
      } : prev);
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} contract${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to delete contracts:', err);
      showNotification?.('Failed to delete contracts', 'error');
    }
  }, [selection, showNotification, setData]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(CONTRACT_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: `var(--status-${value})`
      })),
    []
  );

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      for (const contract of selection.selectedItems) {
        await handleStatusChange(contract.id, newStatus);
      }
      selection.clearSelection();
    },
    [selection, handleStatusChange]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      setFilter(key, value);
    },
    [setFilter]
  );

  // Merge entity options (full list) with locally-derived options (dedup by value)
  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    entityClients.forEach((o) => map.set(o.value, o.label));
    contracts.forEach((c) => { if (c.clientId && c.clientName) map.set(String(c.clientId), c.clientName); });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [contracts, entityClients]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    entityProjects.forEach((o) => map.set(o.value, o.label));
    contracts.forEach((c) => { if (c.projectId && c.projectName) map.set(String(c.projectId), c.projectName); });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [contracts, entityProjects]);

  // Create handler
  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const res = await apiPost(API_ENDPOINTS.CONTRACTS, { ...formData, status: 'draft' });
      if (res.ok) {
        showNotification?.('Contract created successfully', 'success');
        setCreateOpen(false);
        refetch();
      } else {
        showNotification?.('Failed to create contract', 'error');
      }
    } catch {
      showNotification?.('Failed to create contract', 'error');
    } finally {
      setCreateLoading(false);
    }
  }, [showNotification, refetch]);

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="CONTRACTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.draft, label: 'draft' },
            { value: stats.pending, label: 'pending', variant: 'pending' },
            { value: stats.signed, label: 'signed', variant: 'completed' },
            { value: stats.expired, label: 'expired', variant: 'overdue' }
          ]}
          tooltip={`${stats.total} Total • ${stats.draft} Draft • ${stats.pending} Pending • ${stats.signed} Signed`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search contracts..."
          />
          <FilterDropdown
            sections={CONTRACTS_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredContracts.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" onClick={() => setCreateOpen(true)} title="New Contract" />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredContracts.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredContracts)}
          allSelected={selection.allSelected && selection.selectedCount === filteredContracts.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
      }
      pagination={
        !isLoading && filteredContracts.length > 0 ? (
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
              className="contract-col"
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Contract
            </PortalTableHead>
            <PortalTableHead
              className="client-col"
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </PortalTableHead>
            <PortalTableHead className="project-col">Project</PortalTableHead>
            <PortalTableHead className="email-col">
              Email
            </PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'createdAt' ? sort.direction : null}
              onClick={() => toggleSort('createdAt')}
            >
              Created
            </PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={8} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={8} rows={5} />
          ) : paginatedContracts.length === 0 ? (
            <PortalTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No contracts match your filters' : 'No contracts yet'}
            />
          ) : (
            paginatedContracts.map((contract) => (
              <PortalTableRow
                key={contract.id}
                clickable
                selected={selection.isSelected(contract)}
              >
                <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(contract)}
                    onCheckedChange={() => selection.toggleSelection(contract)}
                    aria-label={`Select ${contract.templateName || `Contract ${  contract.id}`}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="contract-cell">
                  <div className="cell-with-icon">
                    <FileText className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{contract.templateName || `Contract #${contract.id}`}</span>
                      {contract.templateType && (
                        <span className="cell-subtitle">{contract.templateType}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="client-cell">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', String(contract.clientId));
                    }}
                    className="table-link"
                  >
                    {contract.clientName}
                  </span>
                </PortalTableCell>
                <PortalTableCell className="project-cell">
                  {contract.projectName && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('projects', String(contract.projectId));
                      }}
                      className="table-link"
                    >
                      {contract.projectName}
                    </span>
                  )}
                </PortalTableCell>
                <PortalTableCell className="email-cell">
                  {contract.clientEmail}
                </PortalTableCell>
                <StatusDropdownCell
                  status={contract.status}
                  statusConfig={CONTRACT_STATUS_CONFIG}
                  onStatusChange={(newStatus) => handleStatusChange(contract.id, newStatus)}
                  ariaLabel="Change contract status"
                />
                <PortalTableCell className="date-cell">{formatDate(contract.createdAt)}</PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    {contract.status === 'draft' && (
                      <IconButton
                        action="send"
                        title="Send"
                        onClick={() => handleSendContract(contract.id)}
                      />
                    )}
                    <IconButton action="download" title="Download" />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
      <CreateContractModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        loading={createLoading}
        clientOptions={clientOptions}
        projectOptions={projectOptions}
      />
    </TableLayout>
  );
}
