import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  FileText,
  Inbox,
  Edit,
  MoreHorizontal,
  Trash2,
  Copy,
  Download,
  Eye,
  Send,
  ChevronDown,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { formatDate } from '@react/utils/formatDate';
import { formatCurrency } from '../../../../utils/format-utils';
import { PortalButton } from '@react/components/portal/PortalButton';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
} from '@react/components/portal/AdminTable';
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { PROPOSALS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';

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
  draft: { label: 'Draft', color: 'var(--portal-text-muted)' },
  sent: { label: 'Sent', color: 'var(--status-active)' },
  viewed: { label: 'Viewed', color: 'var(--status-pending)' },
  accepted: { label: 'Accepted', color: 'var(--status-completed)' },
  declined: { label: 'Declined', color: 'var(--status-cancelled)' },
  expired: { label: 'Expired', color: 'var(--portal-text-muted)' },
};

interface ProposalsTableProps {
  /** Auth token getter for API calls */
  getAuthToken?: () => string | null;
  /** Show notification callback */
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

// Filter function
function filterProposal(
  proposal: Proposal,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      proposal.title.toLowerCase().includes(searchLower) ||
      proposal.clientName.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (proposal.status !== filters.status) return false;
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

export function ProposalsTable({ getAuthToken, showNotification, onNavigate }: ProposalsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);

  // Build headers helper with auth token
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
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<ProposalStats>({
    total: 0,
    draft: 0,
    sent: 0,
    accepted: 0,
    declined: 0,
    totalValue: 0,
    acceptanceRate: 0,
  });

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
    storageKey: 'admin_proposals',
    filters: PROPOSALS_FILTER_CONFIG,
    filterFn: filterProposal,
    sortFn: sortProposals,
    defaultSort: { column: 'createdAt', direction: 'desc' }
  });

  // Apply filters
  const filteredProposals = useMemo(() => applyFilters(proposals), [applyFilters, proposals]);

  // Pagination
  const pagination = usePagination({
    storageKey: 'admin_proposals_pagination',
    totalItems: filteredProposals.length,
    defaultPageSize: 25
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

  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/proposals', {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load proposals');
      const data = await response.json();
      const payload = data.data || data;
      setProposals(payload.proposals || []);
      setStats(payload.stats || {
        total: 0,
        draft: 0,
        sent: 0,
        accepted: 0,
        declined: 0,
        totalValue: 0,
        acceptanceRate: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  // Status change handler
  const handleStatusChange = useCallback(async (proposalId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update proposal');

      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? { ...p, status: newStatus as Proposal['status'] }
            : p
        )
      );
      showNotification?.('Proposal status updated', 'success');
    } catch (err) {
      console.error('Failed to update proposal status:', err);
      showNotification?.('Failed to update proposal status', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleSendProposal = useCallback(async (proposalId: number) => {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}/send`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to send proposal');
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: 'sent', sentAt: new Date().toISOString() } : p))
      );
      showNotification?.('Proposal sent', 'success');
    } catch (err) {
      console.error('Failed to send proposal:', err);
      showNotification?.('Failed to send proposal', 'error');
    }
  }, [getHeaders, showNotification]);

  const handleDuplicate = useCallback(async (proposalId: number) => {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}/duplicate`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to duplicate proposal');
      loadProposals();
      showNotification?.('Proposal duplicated', 'success');
    } catch (err) {
      console.error('Failed to duplicate proposal:', err);
      showNotification?.('Failed to duplicate proposal', 'error');
    }
  }, [getHeaders, showNotification, loadProposals]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((p) => p.id);
    try {
      const response = await fetch('/api/admin/proposals/bulk-delete', {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error('Failed to delete proposals');

      setProposals((prev) => prev.filter((p) => !ids.includes(p.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} proposal${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      console.error('Failed to delete proposals:', err);
      showNotification?.('Failed to delete proposals', 'error');
    }
  }, [selection, getHeaders, showNotification]);

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

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="PROPOSALS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.draft, label: 'draft', hideIfZero: true },
            { value: stats.sent, label: 'sent', variant: 'active', hideIfZero: true },
            { value: stats.accepted, label: 'accepted', variant: 'completed', hideIfZero: true },
            { value: stats.declined, label: 'declined', variant: 'cancelled', hideIfZero: true },
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
            disabled={filteredProposals.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" title="New Proposal" />
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
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadProposals}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
      {!error && (
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
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Proposal
            </AdminTableHead>
            <AdminTableHead
              className="client-col"
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </AdminTableHead>
            <AdminTableHead
              className="amount-col"
              sortable
              sortDirection={sort?.column === 'amount' ? sort.direction : null}
              onClick={() => toggleSort('amount')}
            >
              Amount
            </AdminTableHead>
            <AdminTableHead className="status-col">Status</AdminTableHead>
            <AdminTableHead className="date-col">Valid Until</AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'createdAt' ? sort.direction : null}
              onClick={() => toggleSort('createdAt')}
            >
              Created
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={8} rows={5} />
          ) : paginatedProposals.length === 0 ? (
            <AdminTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No proposals match your filters' : 'No proposals yet'}
            />
          ) : (
            paginatedProposals.map((proposal) => (
              <AdminTableRow
                key={proposal.id}
                clickable
                selected={selection.isSelected(proposal)}
              >
                <AdminTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(proposal)}
                    onCheckedChange={() => selection.toggleSelection(proposal)}
                    aria-label={`Select ${proposal.title}`}
                  />
                </AdminTableCell>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileText className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{proposal.title}</span>
                      {proposal.projectType && (
                        <span className="cell-subtitle">{proposal.projectType}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <button
                    className="link-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', String(proposal.clientId));
                    }}
                  >
                    {proposal.clientName}
                  </button>
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  {formatCurrency(proposal.amount)}
                </AdminTableCell>
                <AdminTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button className="status-dropdown-trigger">
                        <StatusBadge status={getStatusVariant(proposal.status)} size="sm">
                          {PROPOSAL_STATUS_CONFIG[proposal.status]?.label || proposal.status}
                        </StatusBadge>
                        <ChevronDown className="status-dropdown-caret" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent sideOffset={0} align="start">
                      {Object.entries(PROPOSAL_STATUS_CONFIG).map(([status, config]) => (
                        <PortalDropdownItem
                          key={status}
                          onClick={() => handleStatusChange(proposal.id, status)}
                        >
                          <StatusBadge status={getStatusVariant(status)} size="sm">
                            {config.label}
                          </StatusBadge>
                        </PortalDropdownItem>
                      ))}
                    </PortalDropdownContent>
                  </PortalDropdown>
                </AdminTableCell>
                <AdminTableCell className="date-cell">
                  {proposal.validUntil ? (
                    <span className={new Date(proposal.validUntil) < new Date() ? 'text-danger' : ''}>
                      {formatDate(proposal.validUntil)}
                    </span>
                  ) : (
                    '-'
                  )}
                </AdminTableCell>
                <AdminTableCell className="date-cell">
                  {formatDate(proposal.createdAt)}
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    {proposal.status === 'draft' && (
                      <IconButton
                        action="send"
                        title="Send"
                        onClick={() => handleSendProposal(proposal.id)}
                      />
                    )}
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal />
                        </button>
                      </PortalDropdownTrigger>
                      <PortalDropdownContent>
                        {proposal.status === 'draft' && (
                          <PortalDropdownItem>
                            <Edit className="dropdown-icon" />
                            Edit
                          </PortalDropdownItem>
                        )}
                        <PortalDropdownItem onClick={() => handleDuplicate(proposal.id)}>
                          <Copy className="dropdown-icon" />
                          Duplicate
                        </PortalDropdownItem>
                        <PortalDropdownItem className="text-danger">
                          <Trash2 className="dropdown-icon" />
                          Delete
                        </PortalDropdownItem>
                      </PortalDropdownContent>
                    </PortalDropdown>
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))
          )}
        </AdminTableBody>
      </AdminTable>
      )}
    </TableLayout>
  );
}

export default ProposalsTable;
