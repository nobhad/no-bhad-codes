import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  FileText,
  Inbox
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '@/utils/format-utils';
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
import { PROPOSALS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { apiPost, apiFetch } from '@/utils/api-client';
import { executeWithToast } from '@/utils/api-wrappers';
import { CreateProposalModal } from '../modals/CreateEntityModals';
import { useExport, PROPOSALS_EXPORT_CONFIG } from '@react/hooks/useExport';
import { ProposalDetailPanel } from './ProposalDetailPanel';

interface Proposal {
  id: number;
  title: string;
  clientId: number;
  clientName: string;
  projectType?: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
  amount: number;
  validUntil?: string;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
}

interface ProposalStats {
  total: number;
  draft: number;
  sent: number;
  accepted: number;
  declined: number;
  totalValue: number;
  acceptanceRate: number;
}

const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--color-text-tertiary)' },
  sent: { label: 'Sent', color: 'var(--status-active)' },
  viewed: { label: 'Viewed', color: 'var(--status-pending)' },
  accepted: { label: 'Accepted', color: 'var(--status-completed)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' },
  expired: { label: 'Expired', color: 'var(--color-text-tertiary)' }
};

const DEFAULT_PROPOSAL_STATS: ProposalStats = {
  total: 0,
  draft: 0,
  sent: 0,
  accepted: 0,
  declined: 0,
  totalValue: 0,
  acceptanceRate: 0
};

interface ProposalsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
  defaultPageSize?: number;
  overviewMode?: boolean;
}

// Filter function
function filterProposal(
  proposal: Proposal,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      proposal.title.toLowerCase().includes(searchLower) ||
      proposal.clientName.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(proposal.status)) return false;
  }

  return true;
}

// Sort function
function sortProposals(a: Proposal, b: Proposal, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'client':
    return multiplier * a.clientName.localeCompare(b.clientName);
  case 'amount':
    return multiplier * (a.amount - b.amount);
  case 'createdAt':
    return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  default:
    return 0;
  }
}

export function ProposalsTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: ProposalsTableProps) {
  const containerRef = useFadeIn();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const { clientOptions: entityClients, projectOptions: entityProjects } = useEntityOptions(createOpen);

  // Data fetching via useListFetch
  const { data, isLoading, error, refetch, setData } = useListFetch<Proposal, ProposalStats>({
    endpoint: API_ENDPOINTS.ADMIN.PROPOSALS,
    getAuthToken,
    defaultStats: DEFAULT_PROPOSAL_STATS,
    itemsKey: 'proposals'
  });
  const proposals = useMemo(() => data?.items ?? [], [data]);
  const stats = useMemo(() => data?.stats ?? DEFAULT_PROPOSAL_STATS, [data]);

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
  } = useTableFilters<Proposal>({
    storageKey: overviewMode ? undefined : 'admin_proposals',
    filters: PROPOSALS_FILTER_CONFIG,
    filterFn: filterProposal,
    sortFn: sortProposals,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  // Apply filters
  const filteredProposals = useMemo(() => applyFilters(proposals), [applyFilters, proposals]);

  const { exportCsv, isExporting } = useExport({
    config: PROPOSALS_EXPORT_CONFIG,
    data: filteredProposals,
    onExport: (count) => {
      showNotification?.(`Exported ${count} item${count !== 1 ? 's' : ''} to CSV`, 'success');
    }
  });

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_proposals_pagination',
    totalItems: filteredProposals.length,
    defaultPageSize
  });

  const paginatedProposals = useMemo(
    () => pagination.paginate(filteredProposals),
    [pagination, filteredProposals]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (p: Proposal) => p.id,
    items: paginatedProposals
  });

  // Status change handler
  const handleStatusChange = useCallback(async (proposalId: number, newStatus: string) => {
    await executeWithToast(
      () => apiFetch(buildEndpoint.adminProposal(proposalId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }),
      { success: 'Proposal status updated', error: 'Failed to update proposal status' },
      () => {
        setData((prev) => prev ? {
          ...prev,
          items: prev.items.map((p) =>
            p.id === proposalId
              ? { ...p, status: newStatus as Proposal['status'] }
              : p
          )
        } : prev);
      }
    );
  }, [setData]);

  const handleSendProposal = useCallback(async (proposalId: number) => {
    await executeWithToast(
      () => apiPost(buildEndpoint.adminProposalSend(proposalId)),
      { success: 'Proposal sent', error: 'Failed to send proposal' },
      () => {
        setData((prev) => prev ? {
          ...prev,
          items: prev.items.map((p) =>
            p.id === proposalId ? { ...p, status: 'sent' as const, sentAt: new Date().toISOString() } : p
          )
        } : prev);
      }
    );
  }, [setData]);

  const handleDuplicate = useCallback(async (proposalId: number) => {
    await executeWithToast(
      () => apiPost(buildEndpoint.adminProposalDuplicate(proposalId)),
      { success: 'Proposal duplicated', error: 'Failed to duplicate proposal' },
      () => refetch()
    );
  }, [refetch]);

  // Single delete handler
  const handleDeleteProposal = useCallback(async (proposalId: number) => {
    if (!window.confirm('Are you sure you want to delete this proposal?')) return;
    await executeWithToast(
      () => apiFetch(buildEndpoint.adminProposal(proposalId), { method: 'DELETE' }),
      { success: 'Proposal deleted', error: 'Failed to delete proposal' },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((p) => p.id !== proposalId) } : prev);
      }
    );
  }, [setData]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((p) => p.id);
    await executeWithToast(
      () => apiPost(API_ENDPOINTS.ADMIN.PROPOSALS_BULK_DELETE, { proposalIds: ids }),
      {
        success: `Deleted ${ids.length} proposal${ids.length !== 1 ? 's' : ''}`,
        error: 'Failed to delete proposals'
      },
      () => {
        setData((prev) => prev ? { ...prev, items: prev.items.filter((p) => !ids.includes(p.id)) } : prev);
        selection.clearSelection();
      }
    );
  }, [selection, setData]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(PROPOSAL_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
        color: config.color
      })),
    []
  );

  // Handle bulk status change
  const handleBulkStatusChange = useCallback(
    async (newStatus: string) => {
      if (selection.selectedCount === 0) return;

      for (const p of selection.selectedItems) {
        await handleStatusChange(p.id, newStatus);
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
    proposals.forEach((p) => { if (p.clientId && p.clientName) map.set(String(p.clientId), p.clientName); });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [proposals, entityClients]);

  const projectTypeOptions = useMemo(() => {
    const types = new Set<string>();
    proposals.forEach((p) => { if (p.projectType) types.add(p.projectType); });
    return Array.from(types, (t) => ({ value: t, label: t }));
  }, [proposals]);

  // Create handler
  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const res = await apiPost(API_ENDPOINTS.ADMIN.PROPOSALS, formData);
      if (res.ok) {
        showNotification?.('Proposal created successfully', 'success');
        setCreateOpen(false);
        refetch();
      } else {
        showNotification?.('Failed to create proposal', 'error');
      }
    } catch {
      showNotification?.('Failed to create proposal', 'error');
    } finally {
      setCreateLoading(false);
    }
  }, [showNotification, refetch]);

  // Detail panel handlers
  const handleRowClick = useCallback((proposal: Proposal) => {
    setSelectedProposal(proposal);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedProposal(null);
  }, []);

  const handlePanelStatusChange = useCallback(
    async (proposalId: number, newStatus: string) => {
      await handleStatusChange(proposalId, newStatus);
      setSelectedProposal((prev) =>
        prev && prev.id === proposalId ? { ...prev, status: newStatus as Proposal['status'] } : prev
      );
    },
    [handleStatusChange]
  );

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="PROPOSALS"
        stats={
          <TableStats
            items={[
              { value: stats.total, label: 'total' },
              { value: stats.draft, label: 'draft' },
              { value: stats.sent, label: 'sent', variant: 'active' },
              { value: stats.accepted, label: 'accepted', variant: 'completed' },
              { value: stats.declined, label: 'declined', variant: 'cancelled' }
            ]}
            tooltip={`${stats.total} Total | ${formatCurrency(stats.totalValue)} Value | ${stats.acceptanceRate}% Acceptance`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search proposals..."
            />
            <FilterDropdown
              sections={PROPOSALS_FILTER_CONFIG}
              values={filterValues}
              onChange={handleFilterChange}
            />
            <IconButton
              action="download"
              onClick={exportCsv}
              disabled={isExporting || filteredProposals.length === 0}
              title="Export to CSV"
            />
            <IconButton action="add" onClick={() => setCreateOpen(true)} title="New Proposal" />
          </>
        }
        bulkActions={
          <BulkActionsToolbar
            selectedCount={selection.selectedCount}
            totalCount={filteredProposals.length}
            onClearSelection={selection.clearSelection}
            onSelectAll={() => selection.selectMany(filteredProposals)}
            allSelected={selection.allSelected && selection.selectedCount === filteredProposals.length}
            statusOptions={bulkStatusOptions}
            onStatusChange={handleBulkStatusChange}
            onDelete={handleBulkDelete}
          />
        }
        pagination={
          !isLoading && filteredProposals.length > 0 ? (
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
                sortDirection={sort?.column === 'title' ? sort.direction : null}
                onClick={() => toggleSort('title')}
              >
              Proposal
              </PortalTableHead>
              <PortalTableHead
                className="amount-col"
                sortable
                sortDirection={sort?.column === 'amount' ? sort.direction : null}
                onClick={() => toggleSort('amount')}
              >
              Amount
              </PortalTableHead>
              <PortalTableHead className="status-col">Status</PortalTableHead>
              <PortalTableHead
                className="date-col"
                sortable
                sortDirection={sort?.column === 'createdAt' ? sort.direction : null}
                onClick={() => toggleSort('createdAt')}
              >
              Dates
              </PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={6} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={6} rows={5} />
            ) : paginatedProposals.length === 0 ? (
              <PortalTableEmpty
                colSpan={6}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No proposals match your filters' : 'No proposals yet'}
              />
            ) : (
              paginatedProposals.map((proposal) => (
                <PortalTableRow
                  key={proposal.id}
                  clickable
                  selected={selection.isSelected(proposal)}
                  onClick={() => handleRowClick(proposal)}
                >
                  <PortalTableCell className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.isSelected(proposal)}
                      onCheckedChange={() => selection.toggleSelection(proposal)}
                      aria-label={`Select ${proposal.title}`}
                    />
                  </PortalTableCell>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <FileText className="icon-sm" />
                      <div className="cell-content">
                        <span className="cell-title">{proposal.title}</span>
                        {proposal.clientId && onNavigate ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('client-detail', String(proposal.clientId));
                            }}
                            className="table-link cell-subtitle"
                          >
                            {proposal.clientName}
                          </button>
                        ) : (
                          <span className="cell-subtitle">{proposal.clientName}</span>
                        )}
                        {proposal.projectType && (
                          <span className="identity-company">{proposal.projectType}</span>
                        )}
                      </div>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="text-right">
                    {formatCurrency(proposal.amount)}
                  </PortalTableCell>
                  <StatusDropdownCell
                    status={proposal.status}
                    statusConfig={PROPOSAL_STATUS_CONFIG}
                    onStatusChange={(newStatus) => handleStatusChange(proposal.id, newStatus)}
                    ariaLabel="Change proposal status"
                  />
                  <PortalTableCell className="date-col">
                    <div className="cell-content">
                      <span className="cell-title">{formatDate(proposal.createdAt)}</span>
                      {proposal.validUntil && (
                        <span className={`cell-subtitle ${new Date(proposal.validUntil) < new Date() ? 'text-danger' : ''}`}>
                        Valid until {formatDate(proposal.validUntil)}
                        </span>
                      )}
                    </div>
                  </PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      {proposal.status === 'draft' && (
                        <IconButton
                          action="send"
                          title="Send"
                          onClick={() => handleSendProposal(proposal.id)}
                        />
                      )}
                      <IconButton action="view" title="View" onClick={() => onNavigate?.('proposal-detail', String(proposal.id))} />
                      <IconButton action="duplicate" title="Duplicate" onClick={() => handleDuplicate(proposal.id)} />
                      <IconButton action="delete" title="Delete" onClick={() => handleDeleteProposal(proposal.id)} />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
        <CreateProposalModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={handleCreate}
          loading={createLoading}
          clientOptions={clientOptions}
          projectOptions={entityProjects}
          projectTypeOptions={projectTypeOptions}
        />
      </TableLayout>
      <ProposalDetailPanel
        proposal={selectedProposal}
        onClose={handleClosePanel}
        onStatusChange={handlePanelStatusChange}
        onNavigate={onNavigate}
        onSend={(id) => handleSendProposal(id)}
        onDuplicate={(id) => handleDuplicate(id)}
        showNotification={showNotification}
      />
    </>
  );
}
