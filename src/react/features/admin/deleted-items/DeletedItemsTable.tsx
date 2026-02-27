import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  User,
  Briefcase,
  FileText,
  File,
  MessageSquare,
  Inbox,
  Clock,
} from 'lucide-react';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { cn } from '@react/lib/utils';
import { PortalButton } from '@react/components/portal/PortalButton';
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

interface DeletedItem {
  id: string;
  type: 'client' | 'project' | 'invoice' | 'file' | 'message' | 'contact';
  name: string;
  description?: string;
  deletedBy: string;
  deletedAt: string;
  expiresAt: string;
  originalId: string;
}

interface DeletedItemsStats {
  total: number;
  clients: number;
  projects: number;
  invoices: number;
  files: number;
  expiringIn7Days: number;
}

interface DeletedItemsTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  client: <User className="cell-icon" />,
  project: <Briefcase className="cell-icon" />,
  invoice: <FileText className="cell-icon" />,
  file: <File className="cell-icon" />,
  message: <MessageSquare className="cell-icon" />,
  contact: <User className="cell-icon" />,
};

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'client', label: 'Clients' },
  { value: 'project', label: 'Projects' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'file', label: 'Files' },
  { value: 'message', label: 'Messages' },
  { value: 'contact', label: 'Contacts' },
];

export function DeletedItemsTable({ onNavigate }: DeletedItemsTableProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [stats, setStats] = useState<DeletedItemsStats>({
    total: 0,
    clients: 0,
    projects: 0,
    invoices: 0,
    files: 0,
    expiringIn7Days: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>({
    column: 'deletedAt',
    direction: 'desc',
  });

  useEffect(() => {
    loadDeletedItems();
  }, []);

  async function loadDeletedItems() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/deleted-items');
      if (!response.ok) throw new Error('Failed to load deleted items');
      const data = await response.json();
      setItems(data.items || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deleted items');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    let result = [...items];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query)
      );
    }
    if (typeFilter !== 'all') {
      result = result.filter((item) => item.type === typeFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string = '';
        let bVal: string = '';
        switch (sort.column) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'type': aVal = a.type; bVal = b.type; break;
          case 'deletedAt': aVal = a.deletedAt; bVal = b.deletedAt; break;
          case 'expiresAt': aVal = a.expiresAt; bVal = b.expiresAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [items, searchQuery, typeFilter, sort]);

  const pagination = usePagination({ totalItems: filteredItems.length });
  const paginatedItems = filteredItems.slice(
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

  async function handleRestore(itemId: string) {
    try {
      const response = await fetch(`/api/admin/deleted-items/${itemId}/restore`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to restore item');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error('Failed to restore item:', err);
    }
  }

  async function handlePermanentDelete(itemId: string) {
    if (!confirm('Are you sure you want to permanently delete this item? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/deleted-items/${itemId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete item');
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  }

  async function handleEmptyTrash() {
    if (!confirm('Are you sure you want to permanently delete all items? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch('/api/admin/deleted-items/empty', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to empty trash');
      setItems([]);
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  }

  function isExpiringSoon(expiresAt: string): boolean {
    const daysUntilExpiry = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function getDaysUntilExpiry(expiresAt: string): string {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  }

  const hasActiveFilters = searchQuery || typeFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="DELETED ITEMS"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.clients, label: 'clients', hideIfZero: true },
            { value: stats.projects, label: 'projects', hideIfZero: true },
            { value: stats.invoices, label: 'invoices', hideIfZero: true },
            { value: stats.files, label: 'files', hideIfZero: true },
            { value: stats.expiringIn7Days, label: 'expiring', variant: 'overdue', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.clients} Clients • ${stats.projects} Projects • ${stats.invoices} Invoices • ${stats.files} Files`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search deleted items..."
          />
          <FilterDropdown
            sections={[
              { key: 'type', label: 'TYPE', options: TYPE_FILTER_OPTIONS },
            ]}
            values={{ type: typeFilter }}
            onChange={(key, value) => setTypeFilter(value)}
          />
          {items.length > 0 && (
            <PortalButton
              variant="secondary"
              size="sm"
              className="btn-danger"
              onClick={handleEmptyTrash}
            >
              <Trash2 className="btn-icon" />
              Empty Trash
            </PortalButton>
          )}
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadDeletedItems}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      bulkActions={
        stats.expiringIn7Days > 0 ? (
          <div className="table-warning-banner">
            <AlertTriangle className="cell-icon" />
            <span>
              {stats.expiringIn7Days} item(s) will be permanently deleted within the next 7 days.
            </span>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredItems.length > 0 ? (
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
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Item
            </AdminTableHead>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'type' ? sort.direction : null}
              onClick={() => toggleSort('type')}
            >
              Type
            </AdminTableHead>
            <AdminTableHead>Deleted By</AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'deletedAt' ? sort.direction : null}
              onClick={() => toggleSort('deletedAt')}
            >
              Deleted
            </AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'expiresAt' ? sort.direction : null}
              onClick={() => toggleSort('expiresAt')}
            >
              Expires In
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={6} rows={5} />
          ) : paginatedItems.length === 0 ? (
            <AdminTableEmpty
              colSpan={6}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No items match your filters' : 'Trash is empty'}
            />
          ) : (
            paginatedItems.map((item) => (
              <AdminTableRow key={item.id}>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    {TYPE_ICONS[item.type]}
                    <div className="cell-content">
                      <span className="cell-title">{item.name}</span>
                      {item.description && (
                        <span className="cell-subtitle">{item.description}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="type-cell">{item.type}</AdminTableCell>
                <AdminTableCell>{item.deletedBy}</AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(item.deletedAt)}</AdminTableCell>
                <AdminTableCell className="date-cell">
                  <span className={cn(isExpiringSoon(item.expiresAt) && 'text-danger')}>
                    <span className="cell-with-icon">
                      {isExpiringSoon(item.expiresAt) && <Clock className="cell-icon-sm" />}
                      {getDaysUntilExpiry(item.expiresAt)}
                    </span>
                  </span>
                </AdminTableCell>
                <AdminTableCell className="actions-cell">
                  <div className="table-actions">
                    <button
                      className="icon-btn"
                      title="Restore"
                      onClick={() => handleRestore(item.id)}
                    >
                      <RotateCcw />
                    </button>
                    <button
                      className="icon-btn"
                      title="Delete Permanently"
                      onClick={() => handlePermanentDelete(item.id)}
                    >
                      <Trash2 />
                    </button>
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

export default DeletedItemsTable;
