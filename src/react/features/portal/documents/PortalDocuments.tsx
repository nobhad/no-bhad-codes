/**
 * PortalDocuments
 * Unified documents view: contracts, proposals, invoices in one table.
 * Replaces separate PortalContracts, PortalProposals, PortalInvoicesTable tabs.
 */

import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { FileSignature, FileText, Receipt, Inbox } from 'lucide-react';
import { LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { IconButton } from '@react/factories';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
import {
  PortalTable,
  PortalTableHeader,
  PortalTableBody,
  PortalTableRow,
  PortalTableHead,
  PortalTableCell,
  PortalTableEmpty
} from '@react/components/portal/PortalTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { usePortalData } from '@react/hooks/usePortalFetch';
import { formatCardDate, formatCurrency } from '@react/utils/cardFormatters';
import { downloadInvoicePdf } from '@/utils/file-download';
import { API_ENDPOINTS, buildEndpoint } from '@/constants/api-endpoints';
import { createLogger } from '@/utils/logger';
import { CONTRACT_STATUS_CONFIG } from '../contracts/types';
import { PROPOSAL_STATUS_CONFIG } from '../proposals/types';
import { PORTAL_INVOICE_STATUS_CONFIG } from '../types';
import type { PortalViewProps } from '../types';
import type { PortalContract } from '../contracts/types';
import type { PortalProposal } from '../proposals/types';
import type { PortalInvoice } from '../types';

const logger = createLogger('PortalDocuments');

// ============================================================================
// TYPES
// ============================================================================

type DocumentType = 'contract' | 'proposal' | 'invoice';

interface UnifiedDocument {
  id: number;
  type: DocumentType;
  name: string;
  status: string;
  statusLabel: string;
  amount: number | null;
  date: string;
  /** Original entity for type-specific actions */
  source: PortalContract | PortalProposal | PortalInvoice;
}

interface DocumentsData {
  contracts: PortalContract[];
  proposals: PortalProposal[];
  invoices: PortalInvoice[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_ICONS: Record<DocumentType, React.ComponentType<{ className?: string }>> = {
  contract: FileSignature,
  proposal: FileText,
  invoice: Receipt
};

const TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Contract',
  proposal: 'Proposal',
  invoice: 'Invoice'
};

const FILTER_CONFIG = [
  {
    key: 'type',
    label: 'Type',
    options: [
      { value: 'contract', label: 'Contracts' },
      { value: 'proposal', label: 'Proposals' },
      { value: 'invoice', label: 'Invoices' }
    ]
  },
  {
    key: 'status',
    label: 'Status',
    options: [
      { value: 'sent', label: 'Sent' },
      { value: 'signed', label: 'Signed' },
      { value: 'active', label: 'Active' },
      { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'viewed', label: 'Viewed' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'expired', label: 'Expired' },
      { value: 'pending', label: 'Pending' }
    ]
  }
];

// ============================================================================
// HELPERS
// ============================================================================

function getStatusLabel(type: DocumentType, status: string): string {
  switch (type) {
  case 'contract':
    return CONTRACT_STATUS_CONFIG[status]?.label ?? status;
  case 'proposal':
    return PROPOSAL_STATUS_CONFIG[status]?.label ?? status;
  case 'invoice':
    return PORTAL_INVOICE_STATUS_CONFIG[status as keyof typeof PORTAL_INVOICE_STATUS_CONFIG]?.label ?? status;
  default:
    return status;
  }
}

function mergeDocuments(data: DocumentsData): UnifiedDocument[] {
  const docs: UnifiedDocument[] = [];

  for (const contract of data.contracts) {
    docs.push({
      id: contract.id,
      type: 'contract',
      name: contract.projectName ?? `Contract #${contract.id}`,
      status: contract.status,
      statusLabel: getStatusLabel('contract', contract.status),
      amount: null,
      date: contract.createdAt,
      source: contract
    });
  }

  for (const proposal of data.proposals) {
    docs.push({
      id: proposal.id,
      type: 'proposal',
      name: proposal.title,
      status: proposal.status,
      statusLabel: getStatusLabel('proposal', proposal.status),
      amount: proposal.amount,
      date: proposal.sentAt ?? proposal.createdAt,
      source: proposal
    });
  }

  for (const invoice of data.invoices) {
    docs.push({
      id: invoice.id,
      type: 'invoice',
      name: invoice.invoice_number,
      status: invoice.status,
      statusLabel: getStatusLabel('invoice', invoice.status),
      amount: invoice.amount_total,
      date: invoice.created_at,
      source: invoice
    });
  }

  return docs;
}

function filterDocument(
  doc: UnifiedDocument,
  filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const s = search.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(s) ||
      doc.statusLabel.toLowerCase().includes(s) ||
      doc.type.toLowerCase().includes(s);
    if (!matchesSearch) return false;
  }

  const typeFilter = filters.type;
  if (typeFilter && typeFilter.length > 0) {
    if (!typeFilter.includes(doc.type)) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    if (!statusFilter.includes(doc.status)) return false;
  }

  return true;
}

function sortDocuments(
  a: UnifiedDocument,
  b: UnifiedDocument,
  sort: { column: string; direction: 'asc' | 'desc' }
): number {
  const m = sort.direction === 'asc' ? 1 : -1;
  switch (sort.column) {
  case 'type':
    return m * a.type.localeCompare(b.type);
  case 'name':
    return m * a.name.localeCompare(b.name);
  case 'status':
    return m * a.status.localeCompare(b.status);
  case 'amount':
    return m * ((a.amount ?? 0) - (b.amount ?? 0));
  case 'date':
    return m * (new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
  default:
    return 0;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PortalDocuments({ getAuthToken, showNotification }: PortalViewProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  // Fetch all three document types in parallel
  const { data: contractsData, isLoading: contractsLoading, error: contractsError, refetch: refetchContracts } =
    usePortalData<{ contracts: PortalContract[] }>({
      getAuthToken,
      url: API_ENDPOINTS.CONTRACTS_MY,
      transform: (raw) => raw as { contracts: PortalContract[] }
    });

  const { data: proposalsData, isLoading: proposalsLoading, error: proposalsError, refetch: refetchProposals } =
    usePortalData<{ proposals: PortalProposal[] }>({
      getAuthToken,
      url: API_ENDPOINTS.PROPOSALS_MY,
      transform: (raw) => raw as { proposals: PortalProposal[] }
    });

  const { data: invoicesData, isLoading: invoicesLoading, error: invoicesError, refetch: refetchInvoices } =
    usePortalData<{ invoices: PortalInvoice[]; summary?: { totalOutstanding: number; totalPaid: number } }>({
      getAuthToken,
      url: `${API_ENDPOINTS.INVOICES}/me`,
      transform: (raw) => raw as { invoices: PortalInvoice[]; summary?: { totalOutstanding: number; totalPaid: number } }
    });

  const isLoading = contractsLoading || proposalsLoading || invoicesLoading;
  const error = contractsError || proposalsError || invoicesError;

  const refetchAll = useCallback(() => {
    refetchContracts();
    refetchProposals();
    refetchInvoices();
  }, [refetchContracts, refetchProposals, refetchInvoices]);

  // Merge all documents into unified list
  const allDocuments = useMemo(() => {
    return mergeDocuments({
      contracts: contractsData?.contracts ?? [],
      proposals: proposalsData?.proposals ?? [],
      invoices: invoicesData?.invoices ?? []
    });
  }, [contractsData, proposalsData, invoicesData]);

  // Table filters
  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters
  } = useTableFilters<UnifiedDocument>({
    storageKey: 'portal_documents',
    filters: FILTER_CONFIG,
    filterFn: filterDocument,
    sortFn: sortDocuments,
    defaultSort: { column: 'date', direction: 'desc' }
  });

  const filteredDocuments = useMemo(() => applyFilters(allDocuments), [applyFilters, allDocuments]);

  // Action handlers
  const handleViewInvoice = useCallback((invoice: PortalInvoice) => {
    window.open(`${buildEndpoint.invoicePdf(invoice.id)}?preview=true`, '_blank');
  }, []);

  const handleDownloadInvoice = useCallback(async (invoice: PortalInvoice) => {
    try {
      await downloadInvoicePdf(invoice.id, invoice.invoice_number);
    } catch (err) {
      logger.error('Error downloading invoice:', err);
      showNotification?.('Failed to download invoice', 'error');
    }
  }, [showNotification]);

  void 0; // Contract and proposal views are informational (no PDF preview yet)

  // Render actions based on document type
  const renderActions = useCallback((doc: UnifiedDocument) => {
    switch (doc.type) {
    case 'invoice': {
      const invoice = doc.source as PortalInvoice;
      return (
        <div className="table-actions">
          <IconButton action="view" onClick={() => handleViewInvoice(invoice)} title="Preview" />
          <IconButton action="download" onClick={() => handleDownloadInvoice(invoice)} title="Download" />
        </div>
      );
    }
    case 'contract':
    case 'proposal':
      return null;
    default:
      return null;
    }
  }, [handleViewInvoice, handleDownloadInvoice]);

  // Stats
  const stats = useMemo(() => {
    const contracts = contractsData?.contracts?.length ?? 0;
    const proposals = proposalsData?.proposals?.length ?? 0;
    const invoices = invoicesData?.invoices?.length ?? 0;
    return [
      { value: allDocuments.length, label: 'total' },
      { value: contracts, label: 'contracts' },
      { value: proposals, label: 'proposals' },
      { value: invoices, label: 'invoices' }
    ];
  }, [allDocuments.length, contractsData, proposalsData, invoicesData]);

  return (
    <TableLayout
      containerRef={containerRef}
      title="DOCUMENTS"
      stats={<TableStats items={stats} />}
      actions={
        <>
          <SearchFilter value={search} onChange={setSearch} placeholder="Search documents..." />
          <FilterDropdown
            sections={FILTER_CONFIG}
            values={filterValues}
            onChange={(key, value) => setFilter(key, value)}
          />
          <IconButton action="refresh" onClick={refetchAll} title="Refresh" loading={isLoading} />
        </>
      }
    >
      {isLoading ? (
        <LoadingState message="Loading documents..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetchAll} />
      ) : (
        <PortalTable>
          <PortalTableHeader>
            <PortalTableRow>
              <PortalTableHead className="type-col" sortable sortDirection={sort?.column === 'type' ? sort.direction : null} onClick={() => toggleSort('type')}>Type</PortalTableHead>
              <PortalTableHead className="name-col" sortable sortDirection={sort?.column === 'name' ? sort.direction : null} onClick={() => toggleSort('name')}>Name</PortalTableHead>
              <PortalTableHead className="status-col" sortable sortDirection={sort?.column === 'status' ? sort.direction : null} onClick={() => toggleSort('status')}>Status</PortalTableHead>
              <PortalTableHead className="amount-col" sortable sortDirection={sort?.column === 'amount' ? sort.direction : null} onClick={() => toggleSort('amount')}>Amount</PortalTableHead>
              <PortalTableHead className="date-col" sortable sortDirection={sort?.column === 'date' ? sort.direction : null} onClick={() => toggleSort('date')}>Date</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>
          <PortalTableBody animate>
            {filteredDocuments.length === 0 ? (
              <PortalTableEmpty
                colSpan={6}
                icon={<Inbox className="icon-lg" />}
                message={allDocuments.length === 0
                  ? 'No documents yet. Contracts, proposals, and invoices will appear here.'
                  : 'No documents match the current filters.'
                }
              />
            ) : (
              filteredDocuments.map((doc) => {
                const TypeIcon = TYPE_ICONS[doc.type];
                return (
                  <PortalTableRow key={`${doc.type}-${doc.id}`}>
                    <PortalTableCell className="type-cell" label="Type">
                      <span className="document-type-badge">
                        <TypeIcon className="icon-xs" />
                        <span>{TYPE_LABELS[doc.type]}</span>
                      </span>
                    </PortalTableCell>
                    <PortalTableCell className="name-cell" label="Name">
                      <span className="cell-title">{doc.name}</span>
                    </PortalTableCell>
                    <PortalTableCell className="status-cell" label="Status">
                      <StatusBadge status={getStatusVariant(doc.status)}>
                        {doc.statusLabel}
                      </StatusBadge>
                    </PortalTableCell>
                    <PortalTableCell className="amount-cell" label="Amount">
                      {doc.amount != null ? formatCurrency(doc.amount) : '\u2014'}
                    </PortalTableCell>
                    <PortalTableCell className="date-cell" label="Date">
                      {formatCardDate(doc.date)}
                    </PortalTableCell>
                    <PortalTableCell className="col-actions">
                      {renderActions(doc)}
                    </PortalTableCell>
                  </PortalTableRow>
                );
              })
            )}
          </PortalTableBody>
        </PortalTable>
      )}
    </TableLayout>
  );
}
