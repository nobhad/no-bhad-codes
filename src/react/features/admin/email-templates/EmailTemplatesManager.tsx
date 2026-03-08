import * as React from 'react';
import { useMemo } from 'react';
import {
  Mail,
  Inbox,
  Tag
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
import { decodeHtmlEntities } from '@react/utils/decodeText';
import { StatusBadge } from '@react/components/portal/StatusBadge';
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
import { useListFetch } from '@react/factories/useDataFetch';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import { EMAIL_TEMPLATES_FILTER_CONFIG, EMAIL_TEMPLATE_STATUS_OPTIONS } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';

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
  /** Default page size for pagination (10 for overview, 25 for individual tabs) */
  defaultPageSize?: number;
  overviewMode?: boolean;
}

function filterTemplate(
  template: EmailTemplate,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !template.name.toLowerCase().includes(query) &&
      !template.subject.toLowerCase().includes(query)
    ) {
      return false;
    }
  }

  if (filters.category && filters.category !== 'all') {
    if (template.category !== filters.category) return false;
  }

  if (filters.status && filters.status !== 'all') {
    const isActive = filters.status === 'active';
    if (template.is_active !== isActive) return false;
  }

  return true;
}

function sortTemplates(a: EmailTemplate, b: EmailTemplate, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return multiplier * a.name.localeCompare(b.name);
  case 'updated_at':
    return multiplier * a.updated_at.localeCompare(b.updated_at);
  default:
    return 0;
  }
}

export function EmailTemplatesManager({ onNavigate: _onNavigate, getAuthToken, showNotification: _showNotification, defaultPageSize = 25, overviewMode = false }: EmailTemplatesManagerProps) {
  const containerRef = useFadeIn();
  const { data, isLoading, error, refetch } = useListFetch<EmailTemplate, EmailTemplateStats>({
    endpoint: API_ENDPOINTS.ADMIN.EMAIL_TEMPLATES,
    getAuthToken,
    defaultStats: { total: 0, active: 0, categories: [] },
    itemsKey: 'templates'
  });
  const templates = data?.items ?? [];
  const stats = data?.stats ?? { total: 0, active: 0, categories: [] };

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<EmailTemplate>({
    storageKey: overviewMode ? undefined : 'admin_email_templates',
    filters: EMAIL_TEMPLATES_FILTER_CONFIG,
    filterFn: filterTemplate,
    sortFn: sortTemplates
  });

  // Dynamic category filter options built from stats
  const categoryFilterOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Categories' },
      ...stats.categories.map(cat => ({ value: cat.value, label: cat.label }))
    ];
  }, [stats.categories]);

  const filteredTemplates = useMemo(() => applyFilters(templates), [applyFilters, templates]);

  const pagination = usePagination({ storageKey: overviewMode ? undefined : 'admin_email_templates_pagination', totalItems: filteredTemplates.length, defaultPageSize });
  const paginatedTemplates = filteredTemplates.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="EMAIL TEMPLATES"
      stats={
        <TableStats
          items={[
            { value: stats.total, label: 'total' },
            { value: stats.active, label: 'active', variant: 'completed' },
            { value: stats.total - stats.active, label: 'inactive', variant: 'pending' }
          ]}
          tooltip={`${stats.total} Total • ${stats.active} Active • ${stats.total - stats.active} Inactive`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search templates..."
          />
          <FilterDropdown
            sections={[
              { key: 'category', label: 'CATEGORY', options: categoryFilterOptions },
              { key: 'status', label: 'STATUS', options: EMAIL_TEMPLATE_STATUS_OPTIONS }
            ]}
            values={filterValues}
            onChange={setFilter}
          />
          <IconButton action="export" />
          <IconButton action="add" title="New Template" />
        </>
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
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead
              className="name-col"
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Template
            </PortalTableHead>
            <PortalTableHead className="category-col">Category</PortalTableHead>
            <PortalTableHead className="status-col">Status</PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updated_at' ? sort.direction : null}
              onClick={() => toggleSort('updated_at')}
            >
              Updated
            </PortalTableHead>
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={5} message={error} onRetry={refetch} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={5} rows={5} />
          ) : paginatedTemplates.length === 0 ? (
            <PortalTableEmpty
              colSpan={5}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No templates match your filters' : 'No templates yet'}
            />
          ) : (
            paginatedTemplates.map((template) => (
              <PortalTableRow key={template.id} clickable>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Mail className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{decodeHtmlEntities(template.name)}</span>
                      <span className="cell-subtitle">{decodeHtmlEntities(template.subject)}</span>
                      <span className="category-stacked">{template.category}</span>
                      <span className="status-stacked">
                        <StatusBadge status={template.is_active ? 'completed' : 'pending'} size="sm">
                          {template.is_active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </span>
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="category-cell">
                  <div className="cell-with-icon">
                    <Tag className="cell-icon-sm" />
                    <span>{template.category}</span>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="status-cell">
                  <StatusBadge status={template.is_active ? 'completed' : 'pending'} size="sm">
                    {template.is_active ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className="date-cell">{formatDate(template.updated_at)}</PortalTableCell>
                <PortalTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="edit" title="Edit" />
                    <IconButton action="delete" title="Delete" />
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
