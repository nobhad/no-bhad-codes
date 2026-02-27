import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  FileText,
  Inbox,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Eye,
  Send,
} from 'lucide-react';
import { IconButton } from '@react/factories';
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
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';

interface Contract {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';
  amount?: number;
  createdAt: string;
  sentAt?: string;
  signedAt?: string;
  expiresAt?: string;
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
  cancelled: { label: 'Cancelled', icon: <XCircle /> },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'signed', label: 'Signed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface ContractsTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

export function ContractsTable({ onNavigate }: ContractsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<ContractStats>({
    total: 0,
    draft: 0,
    pending: 0,
    signed: 0,
    expired: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sorting
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/contracts');
      if (!response.ok) throw new Error('Failed to load contracts');

      const data = await response.json();
      setContracts(data.contracts || []);
      setStats(data.stats || {
        total: 0,
        draft: 0,
        pending: 0,
        signed: 0,
        expired: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setIsLoading(false);
    }
  }

  // Filter and sort contracts
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (contract) =>
          contract.title.toLowerCase().includes(query) ||
          contract.clientName.toLowerCase().includes(query) ||
          contract.projectName?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((contract) => contract.status === statusFilter);
    }

    // Sort
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (sort.column) {
          case 'title':
            aVal = a.title;
            bVal = b.title;
            break;
          case 'client':
            aVal = a.clientName;
            bVal = b.clientName;
            break;
          case 'amount':
            aVal = a.amount || 0;
            bVal = b.amount || 0;
            break;
          case 'createdAt':
            aVal = a.createdAt;
            bVal = b.createdAt;
            break;
        }

        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [contracts, searchQuery, statusFilter, sort]);

  const pagination = usePagination({ totalItems: filteredContracts.length });
  const paginatedContracts = filteredContracts.slice(
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

  async function handleSendContract(contractId: string) {
    try {
      const response = await fetch(`/api/admin/contracts/${contractId}/send`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to send contract');

      setContracts((prev) =>
        prev.map((contract) =>
          contract.id === contractId
            ? { ...contract, status: 'sent', sentAt: new Date().toISOString() }
            : contract
        )
      );
    } catch (err) {
      console.error('Failed to send contract:', err);
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="CONTRACTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.draft, label: 'draft', hideIfZero: true },
            { value: stats.pending, label: 'pending', variant: 'pending', hideIfZero: true },
            { value: stats.signed, label: 'signed', variant: 'completed', hideIfZero: true },
            { value: stats.expired, label: 'expired', variant: 'overdue', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.draft} Draft • ${stats.pending} Pending • ${stats.signed} Signed`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search contracts..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ status: statusFilter }}
            onChange={(key, value) => setStatusFilter(value)}
          />
          <IconButton action="download" title="Export" />
          <IconButton action="add" title="New Contract" />
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadContracts}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
      {!error && (
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Contract
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'client' ? sort.direction : null}
              onClick={() => toggleSort('client')}
            >
              Client
            </AdminTableHead>
            <AdminTableHead>Project</AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'amount' ? sort.direction : null}
              onClick={() => toggleSort('amount')}
            >
              Amount
            </AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
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
          ) : paginatedContracts.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No contracts match your filters' : 'No contracts yet'}
            />
          ) : (
            paginatedContracts.map((contract) => (
              <AdminTableRow key={contract.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileText className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{contract.title}</span>
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate?.('clients', contract.clientId);
                    }}
                    className="table-link"
                  >
                    {contract.clientName}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  {contract.projectName ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('projects', contract.projectId);
                      }}
                      className="table-link"
                    >
                      {contract.projectName}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-right">
                  {contract.amount ? formatCurrency(contract.amount) : '-'}
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(contract.status)} size="sm">
                    {CONTRACT_STATUS_CONFIG[contract.status]?.label || contract.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(contract.createdAt)}</AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export default ContractsTable;
