import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Mail,
  Eye,
  Edit,
  Copy,
  Trash2,
  MoreHorizontal,
  Inbox,
  Send,
  Tag,
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
import {
  PortalDropdown,
  PortalDropdownTrigger,
  PortalDropdownContent,
  PortalDropdownItem,
} from '@react/components/portal/PortalDropdown';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
  status: 'active' | 'draft' | 'archived';
  usageCount: number;
  lastUsed?: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplateStats {
  total: number;
  active: number;
  draft: number;
  totalSent: number;
  categories: string[];
}

interface EmailTemplatesManagerProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export function EmailTemplatesManager({ onNavigate }: EmailTemplatesManagerProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [stats, setStats] = useState<EmailTemplateStats>({
    total: 0,
    active: 0,
    draft: 0,
    totalSent: 0,
    categories: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/email-templates');
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      setTemplates(data.templates || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }

  // Build category filter options dynamically from stats
  const categoryFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Categories' },
      ...stats.categories.map(cat => ({ value: cat, label: cat })),
    ];
  }, [stats.categories]);

  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.subject.toLowerCase().includes(query)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'usageCount': aVal = a.usageCount; bVal = b.usageCount; break;
          case 'updatedAt': aVal = a.updatedAt; bVal = b.updatedAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [templates, searchQuery, categoryFilter, statusFilter, sort]);

  const pagination = usePagination({ totalItems: filteredTemplates.length });
  const paginatedTemplates = filteredTemplates.slice(
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

  function handleFilterChange(key: string, value: string) {
    if (key === 'category') {
      setCategoryFilter(value);
    } else if (key === 'status') {
      setStatusFilter(value);
    }
  }

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="EMAIL TEMPLATES"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'completed', hideIfZero: true },
            { value: stats.draft, label: 'draft', variant: 'pending', hideIfZero: true },
            { value: stats.totalSent, label: 'sent' },
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.draft} Draft • ${stats.totalSent} Emails Sent`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search templates..."
          />
          <FilterDropdown
            sections={[
              { key: 'category', label: 'CATEGORY', options: categoryFilterOptions },
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ category: categoryFilter, status: statusFilter }}
            onChange={handleFilterChange}
          />
          <IconButton action="export" />
          <IconButton action="add" title="New Template" />
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadTemplates}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && filteredTemplates.length > 0 ? (
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
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Template
            </AdminTableHead>
            <AdminTableHead>Subject</AdminTableHead>
            <AdminTableHead>Category</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'usageCount' ? sort.direction : null}
              onClick={() => toggleSort('usageCount')}
            >
              Used
            </AdminTableHead>
            <AdminTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updatedAt' ? sort.direction : null}
              onClick={() => toggleSort('updatedAt')}
            >
              Updated
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedTemplates.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No templates match your filters' : 'No templates yet'}
            />
          ) : (
            paginatedTemplates.map((template) => (
              <AdminTableRow key={template.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Mail className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{template.name}</span>
                      {template.variables.length > 0 && (
                        <span className="cell-subtitle">
                          {template.variables.length} variables
                        </span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <span className="cell-truncate">{template.subject}</span>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-with-icon">
                    <Tag className="cell-icon-sm" />
                    <span>{template.category}</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(template.status)} size="sm">
                    {template.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-right">{template.usageCount}</AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(template.updatedAt)}</AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <IconButton action="more-horizontal" />
                      </PortalDropdownTrigger>
                      <PortalDropdownContent>
                        <PortalDropdownItem>
                          <Eye className="dropdown-icon" />
                          Preview
                        </PortalDropdownItem>
                        <PortalDropdownItem>
                          <Edit className="dropdown-icon" />
                          Edit
                        </PortalDropdownItem>
                        <PortalDropdownItem>
                          <Send className="dropdown-icon" />
                          Send Test
                        </PortalDropdownItem>
                        <PortalDropdownItem>
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

export default EmailTemplatesManager;
