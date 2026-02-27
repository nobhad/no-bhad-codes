import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  FileText,
  Download,
  Send,
  Eye,
  Copy,
  Inbox,
  Edit,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
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

interface Proposal {
  id: string;
  title: string;
  clientId: string;
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

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

interface ProposalsTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function ProposalsTable({ onNavigate }: ProposalsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/proposals');
      if (!response.ok) throw new Error('Failed to load proposals');
      const data = await response.json();
      setProposals(data.proposals || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load proposals');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredProposals = useMemo(() => {
    let result = [...proposals];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (proposal) =>
          proposal.title.toLowerCase().includes(query) ||
          proposal.clientName.toLowerCase().includes(query)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((proposal) => proposal.status === statusFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'title': aVal = a.title; bVal = b.title; break;
          case 'client': aVal = a.clientName; bVal = b.clientName; break;
          case 'amount': aVal = a.amount; bVal = b.amount; break;
          case 'createdAt': aVal = a.createdAt; bVal = b.createdAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [proposals, searchQuery, statusFilter, sort]);

  const pagination = usePagination({ totalItems: filteredProposals.length });
  const paginatedProposals = filteredProposals.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  function toggleSort(column: string) {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  }

  async function handleSendProposal(proposalId: string) {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}/send`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to send proposal');
      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: 'sent', sentAt: new Date().toISOString() } : p))
      );
    } catch (err) {
      console.error('Failed to send proposal:', err);
    }
  }

  async function handleDuplicate(proposalId: string) {
    try {
      const response = await fetch(`/api/admin/proposals/${proposalId}/duplicate`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to duplicate proposal');
      loadProposals();
    } catch (err) {
      console.error('Failed to duplicate proposal:', err);
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

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
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search proposals..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <button className="icon-btn" title="Export">
            <Download size={18} />
          </button>
          <PortalButton variant="primary" size="sm">
            <Plus className="btn-icon" />
            New Proposal
          </PortalButton>
        </>
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
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Proposal
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'amount' ? sort.direction : null}
              onClick={() => toggleSort('amount')}
            >
              Amount
            </AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
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
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedProposals.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No proposals match your filters' : 'No proposals yet'}
            />
          ) : (
            paginatedProposals.map((proposal) => (
              <AdminTableRow key={proposal.id} clickable>
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
                      onNavigate?.('clients', proposal.clientId);
                    }}
                  >
                    {proposal.clientName}
                  </button>
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  {formatCurrency(proposal.amount)}
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(proposal.status)} size="sm">
                    {PROPOSAL_STATUS_CONFIG[proposal.status]?.label || proposal.status}
                  </StatusBadge>
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
                    <button className="icon-btn" title="View">
                      <Eye size={18} />
                    </button>
                    {proposal.status === 'draft' && (
                      <button
                        className="icon-btn"
                        title="Send"
                        onClick={() => handleSendProposal(proposal.id)}
                      >
                        <Send size={18} />
                      </button>
                    )}
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal size={18} />
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
    </TableLayout>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default ProposalsTable;
