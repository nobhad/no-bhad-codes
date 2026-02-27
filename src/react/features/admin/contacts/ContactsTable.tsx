import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Mail,
  Phone,
  Building,
  Inbox,
  Star,
  StarOff,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { cn } from '@react/lib/utils';
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

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  clientId?: string;
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
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function ContactsTable({ onNavigate }: ContactsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    active: 0,
    primary: 0,
    withCompany: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');

  // Sorting
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/contacts');
      if (!response.ok) throw new Error('Failed to load contacts');

      const data = await response.json();
      setContacts(data.contacts || []);
      setStats(data.stats || {
        total: 0,
        active: 0,
        primary: 0,
        withCompany: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  }

  // Get unique companies for filter
  const companies = useMemo(() => {
    const unique = new Set(contacts.map((c) => c.company).filter(Boolean));
    return Array.from(unique).sort();
  }, [contacts]);

  // Build company filter options dynamically
  const companyFilterOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Companies' }];
    companies.forEach((company) => {
      if (company) {
        options.push({ value: company, label: company });
      }
    });
    return options;
  }, [companies]);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let result = [...contacts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (contact) =>
          `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query) ||
          contact.email.toLowerCase().includes(query) ||
          contact.company?.toLowerCase().includes(query) ||
          contact.phone?.includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((contact) => contact.status === statusFilter);
    }

    // Company filter
    if (companyFilter !== 'all') {
      result = result.filter((contact) => contact.company === companyFilter);
    }

    // Sort
    if (sort) {
      result.sort((a, b) => {
        let aVal: string = '';
        let bVal: string = '';

        switch (sort.column) {
          case 'name':
            aVal = `${a.firstName} ${a.lastName}`;
            bVal = `${b.firstName} ${b.lastName}`;
            break;
          case 'email':
            aVal = a.email;
            bVal = b.email;
            break;
          case 'company':
            aVal = a.company || '';
            bVal = b.company || '';
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
  }, [contacts, searchQuery, statusFilter, companyFilter, sort]);

  const pagination = usePagination({ totalItems: filteredContacts.length });
  const paginatedContacts = filteredContacts.slice(
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

  async function togglePrimary(contactId: string, isPrimary: boolean) {
    try {
      const response = await fetch(`/api/admin/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: !isPrimary }),
      });

      if (!response.ok) throw new Error('Failed to update contact');

      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId ? { ...contact, isPrimary: !isPrimary } : contact
        )
      );
    } catch (err) {
      console.error('Failed to update contact:', err);
    }
  }

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || companyFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="CONTACTS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'active', hideIfZero: true },
            { value: stats.primary, label: 'primary', variant: 'pending', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.primary} Primary • ${stats.withCompany} With Company`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search contacts..."
          />
          <FilterDropdown
            sections={[
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
              { key: 'company', label: 'COMPANY', options: companyFilterOptions },
            ]}
            values={{ status: statusFilter, company: companyFilter }}
            onChange={(key, value) => {
              if (key === 'status') setStatusFilter(value);
              if (key === 'company') setCompanyFilter(value);
            }}
          />
          <IconButton action="add" title="Add Contact" />
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadContacts}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
      {!error && (
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead className="star-col"></AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Name
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'email' ? sort.direction : null}
              onClick={() => toggleSort('email')}
            >
              Email
            </AdminTableHead>
            <AdminTableHead>Phone</AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'company' ? sort.direction : null}
              onClick={() => toggleSort('company')}
            >
              Company
            </AdminTableHead>
            <AdminTableHead>Client</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={8} rows={5} />
          ) : paginatedContacts.length === 0 ? (
            <AdminTableEmpty
              colSpan={8}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
            />
          ) : (
            paginatedContacts.map((contact) => (
              <AdminTableRow key={contact.id} clickable>
                <AdminTableCell className="star-cell" onClick={(e) => e.stopPropagation()}>
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
                </AdminTableCell>
                <AdminTableCell className="primary-cell">
                  <div className="cell-content">
                    <span className="cell-title">
                      {contact.firstName} {contact.lastName}
                    </span>
                    {contact.role && (
                      <span className="cell-subtitle">{contact.role}</span>
                    )}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <a
                    href={`mailto:${contact.email}`}
                    className="cell-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Mail className="cell-icon-sm" />
                    {contact.email}
                  </a>
                </AdminTableCell>
                <AdminTableCell>
                  {contact.phone ? (
                    <a
                      href={`tel:${contact.phone}`}
                      className="cell-link cell-link-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="cell-icon-sm" />
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  {contact.company ? (
                    <span className="cell-with-icon">
                      <Building className="cell-icon-sm text-muted" />
                      {contact.company}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  {contact.clientName ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.('clients', contact.clientId);
                      }}
                      className="cell-link-btn"
                    >
                      {contact.clientName}
                    </button>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(contact.status)} size="sm">
                    {contact.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="more-horizontal" />
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

export default ContactsTable;
