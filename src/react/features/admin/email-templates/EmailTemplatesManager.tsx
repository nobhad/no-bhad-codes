import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { StatusBadge } from '@react/components/portal/StatusBadge';
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
import { EMAIL_TEMPLATE_STATUS_OPTIONS } from '../shared/filterConfigs';

interface TemplateVariable {
  name: string;
  description: string;
}

interface EmailTemplate {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  variables: TemplateVariable[];
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface EmailTemplateStats {
  total: number;
  active: number;
  categories: CategoryOption[];
}

interface EmailTemplatesManagerProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}


export function EmailTemplatesManager({ onNavigate, getAuthToken, showNotification }: EmailTemplatesManagerProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [stats, setStats] = useState<EmailTemplateStats>({
    total: 0,
    active: 0,
    categories: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // Auth headers helper
  const getHeaders = useCallback(() => {
    const token = getAuthToken?.();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [getAuthToken]);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/email-templates', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load templates');
      const data = await response.json();
      const payload = data.data || data;
      setTemplates(payload.templates || []);
      setStats(payload.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, stats]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Build category filter options dynamically from stats
  const categoryFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Categories' },
      ...stats.categories.map(cat => ({ value: cat.value, label: cat.label })),
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
      const isActive = statusFilter === 'active';
      result = result.filter((t) => t.is_active === isActive);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'updated_at': aVal = a.updated_at; bVal = b.updated_at; break;
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
            { value: stats.total - stats.active, label: 'inactive', variant: 'pending', hideIfZero: true },
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.total - stats.active} Inactive`}
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
              { key: 'status', label: 'STATUS', options: EMAIL_TEMPLATE_STATUS_OPTIONS },
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
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updated_at' ? sort.direction : null}
              onClick={() => toggleSort('updated_at')}
            >
              Updated
            </AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading}>
          {isLoading ? (
            <AdminTableLoading colSpan={6} rows={5} />
          ) : paginatedTemplates.length === 0 ? (
            <AdminTableEmpty
              colSpan={6}
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
                  <StatusBadge status={template.is_active ? 'completed' : 'pending'} size="sm">
                    {template.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(template.updated_at)}</AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <PortalDropdown>
                      <PortalDropdownTrigger asChild>
                        <button className="icon-btn">
                          <MoreHorizontal />
                        </button>
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
