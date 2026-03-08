import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox,
  Star,
  StarOff,
  ChevronDown
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { Checkbox } from '@react/components/ui/checkbox';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { BulkActionsToolbar } from '@react/components/portal/BulkActionsToolbar';
import { cn } from '@react/lib/utils';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
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
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { useSelection } from '@react/hooks/useSelection';
import { CONTACTS_FILTER_CONFIG } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { createLogger } from '../../../../utils/logger';
import { API_ENDPOINTS, buildEndpoint } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

const logger = createLogger('ContactsTable');

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  clientId?: number;
  clientName?: string;
  isPrimary: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  lastContactedAt?: string;
}

interface ContactStats {
  total: number;
  active: number;
  primary: number;
  withCompany: number;
}

interface ContactsTableProps {
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

const CONTACT_STATUS_CONFIG: Record<string, { label: string }> = {
  active: { label: 'Active' },
  inactive: { label: 'Inactive' }
};

// Filter function
function filterContact(
  contact: Contact,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(searchLower) ||
      contact.email.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower) ||
      contact.phone?.includes(searchLower);
    if (!matchesSearch) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (contact.status !== filters.status) return false;
  }

  return true;
}

// Sort function
function sortContacts(a: Contact, b: Contact, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return multiplier * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  case 'email':
    return multiplier * a.email.localeCompare(b.email);
  case 'company':
    return multiplier * (a.company || '').localeCompare(b.company || '');
  case 'createdAt':
    return multiplier * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  default:
    return 0;
  }
}

export function ContactsTable({ getAuthToken, showNotification, onNavigate, defaultPageSize = 25, overviewMode = false }: ContactsTableProps) {
  const containerRef = useFadeIn();

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    active: 0,
    primary: 0,
    withCompany: 0
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
  } = useTableFilters<Contact>({
    storageKey: overviewMode ? undefined : 'admin_contacts',
    filters: CONTACTS_FILTER_CONFIG,
    filterFn: filterContact,
    sortFn: sortContacts,
    defaultSort: { column: 'name', direction: 'asc' }
  });

  // Apply filters
  const filteredContacts = useMemo(() => applyFilters(contacts), [applyFilters, contacts]);

  // Pagination
  const pagination = usePagination({
    storageKey: overviewMode ? undefined : 'admin_contacts_pagination',
    totalItems: filteredContacts.length,
    defaultPageSize
  });

  const paginatedContacts = useMemo(
    () => pagination.paginate(filteredContacts),
    [pagination, filteredContacts]
  );

  // Selection for bulk actions
  const selection = useSelection({
    getId: (contact: Contact) => contact.id,
    items: paginatedContacts
  });

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.CONTACTS, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load contacts');

      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setContacts((payload.contacts as Contact[]) || []);
      setStats((payload.stats as ContactStats) || {
        total: 0,
        active: 0,
        primary: 0,
        withCompany: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Status change handler
  const handleStatusChange = useCallback(async (contactId: number, newStatus: string) => {
    try {
      const response = await fetch(buildEndpoint.adminContact(contactId), {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update contact');

      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId
            ? { ...contact, status: newStatus as Contact['status'] }
            : contact
        )
      );
      showNotification?.('Contact status updated', 'success');
    } catch (err) {
      logger.error('Failed to update contact status:', err);
      showNotification?.('Failed to update contact status', 'error');
    }
  }, [getHeaders, showNotification]);

  const togglePrimary = useCallback(async (contactId: number, isPrimary: boolean) => {
    try {
      const response = await fetch(buildEndpoint.adminContact(contactId), {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ isPrimary: !isPrimary })
      });

      if (!response.ok) throw new Error('Failed to update contact');

      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId ? { ...contact, isPrimary: !isPrimary } : contact
        )
      );
      showNotification?.(isPrimary ? 'Removed primary status' : 'Set as primary contact', 'success');
    } catch (err) {
      logger.error('Failed to update contact:', err);
      showNotification?.('Failed to update contact', 'error');
    }
  }, [getHeaders, showNotification]);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedCount === 0) return;

    const ids = selection.selectedItems.map((c) => c.id);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.CONTACTS_BULK_DELETE, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ ids })
      });

      if (!response.ok) throw new Error('Failed to delete contacts');

      setContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
      selection.clearSelection();
      showNotification?.(`Deleted ${ids.length} contact${ids.length !== 1 ? 's' : ''}`, 'success');
    } catch (err) {
      logger.error('Failed to delete contacts:', err);
      showNotification?.('Failed to delete contacts', 'error');
    }
  }, [selection, getHeaders, showNotification]);

  // Status options for bulk actions
  const bulkStatusOptions = useMemo(
    () =>
      Object.entries(CONTACT_STATUS_CONFIG).map(([value, config]) => ({
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

      for (const contact of selection.selectedItems) {
        await handleStatusChange(contact.id, newStatus);
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
      title="CONTACTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'active' },
            { value: stats.primary, label: 'primary', variant: 'pending' }
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.primary} Primary • ${stats.withCompany} With Company`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search contacts..."
          />
          <FilterDropdown
            sections={CONTACTS_FILTER_CONFIG}
            values={filterValues}
            onChange={handleFilterChange}
          />
          <IconButton
            action="download"
            disabled={filteredContacts.length === 0}
            title="Export to CSV"
          />
          <IconButton action="add" title="Add Contact" />
        </>
      }
      bulkActions={
        <BulkActionsToolbar
          selectedCount={selection.selectedCount}
          totalCount={filteredContacts.length}
          onClearSelection={selection.clearSelection}
          onSelectAll={() => selection.selectMany(filteredContacts)}
          allSelected={selection.allSelected && selection.selectedCount === filteredContacts.length}
          statusOptions={bulkStatusOptions}
          onStatusChange={handleBulkStatusChange}
          onDelete={handleBulkDelete}
        />
      }
      pagination={
        !isLoading && filteredContacts.length > 0 ? (
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
            <PortalTableHead className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selection.allSelected}
                onCheckedChange={selection.toggleSelectAll}
                aria-label="Select all"
              />
            </PortalTableHead>
            <PortalTableHead className="star-col"></PortalTableHead>
            <PortalTableHead
              className="contact-col"
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Contact
            </PortalTableHead>
            <PortalTableHead className="client-col">Client</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={6} message={error} onRetry={loadContacts} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={6} rows={5} />
          ) : paginatedContacts.length === 0 ? (
            <PortalTableEmpty
              colSpan={6}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
            />
          ) : (
            paginatedContacts.map((contact) => (
              <PortalTableRow
                key={contact.id}
                clickable
                selected={selection.isSelected(contact)}
              >
                <PortalTableCell className="bulk-select-cell" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selection.isSelected(contact)}
                    onCheckedChange={() => selection.toggleSelection(contact)}
                    aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                  />
                </PortalTableCell>
                <PortalTableCell className="star-cell" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => togglePrimary(contact.id, contact.isPrimary)}
                    className={cn(
                      'icon-btn icon-btn-star',
                      contact.isPrimary && 'is-primary'
                    )}
                    title={contact.isPrimary ? 'Primary contact' : 'Mark as primary'}
                  >
                    {contact.isPrimary ? (
                      <Star className="icon-sm fill-current" />
                    ) : (
                      <StarOff className="icon-sm" />
                    )}
                  </button>
                </PortalTableCell>
                <PortalTableCell className="primary-cell contact-cell">
                  <div className="cell-content">
                    <span className="cell-title">
                      {contact.firstName} {contact.lastName}
                    </span>
                    <span className="cell-subtitle">{contact.email}</span>
                    {(contact.company || contact.phone) && (
                      <span className="identity-company">
                        {[contact.company, contact.phone].filter(Boolean).join(' • ')}
                      </span>
                    )}
                    {contact.role && (
                      <span className="cell-subtitle">{contact.role}</span>
                    )}
                  </div>
                </PortalTableCell>
                <PortalTableCell className="client-cell">
                  {contact.clientName && contact.clientId != null ? (
                    <Link
                      to={`/clients/${contact.clientId}`}
                      className="cell-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('clients', String(contact.clientId));
                      }}
                    >
                      {contact.clientName}
                    </Link>
                  ) : contact.clientName ? (
                    <span className="cell-text">{contact.clientName}</span>
                  ) : null}
                </PortalTableCell>
                <PortalTableCell className="status-cell" onClick={(e) => e.stopPropagation()}>
                  <PortalDropdown>
                    <PortalDropdownTrigger asChild>
                      <button className="status-dropdown-trigger">
                        <StatusBadge status={getStatusVariant(contact.status)} size="sm">
                          {CONTACT_STATUS_CONFIG[contact.status]?.label || contact.status}
                        </StatusBadge>
                        <ChevronDown className="status-dropdown-caret" />
                      </button>
                    </PortalDropdownTrigger>
                    <PortalDropdownContent sideOffset={0} align="start">
                      {Object.entries(CONTACT_STATUS_CONFIG)
                        .filter(([status]) => status !== contact.status)
                        .map(([status, config]) => (
                          <PortalDropdownItem
                            key={status}
                            onClick={() => handleStatusChange(contact.id, status)}
                          >
                            <StatusBadge status={getStatusVariant(status)} size="sm">
                              {config.label}
                            </StatusBadge>
                          </PortalDropdownItem>
                        ))}
                    </PortalDropdownContent>
                  </PortalDropdown>
                </PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
                    <IconButton action="edit" title="Edit" />
                  </div>
                </PortalTableCell>
              </PortalTableRow>
            ))
          )}
        </PortalTableBody>
      </PortalTable>
    </TableLayout>
  );
}
