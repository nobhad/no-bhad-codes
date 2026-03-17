import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
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
import { apiPost, apiFetch } from '@/utils/api-client';
import { CreateEmailTemplateModal } from '../modals/CreateEntityModals';
import { EmailTemplateDetailPanel } from './EmailTemplateDetailPanel';

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
  filters: Record<string, string[]>,
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

  const categoryFilter = filters.category;
  if (categoryFilter && categoryFilter.length > 0) {
    if (!categoryFilter.includes(template.category)) return false;
  }

  const statusFilter = filters.status;
  if (statusFilter && statusFilter.length > 0) {
    const activeValue = template.is_active ? 'active' : 'inactive';
    if (!statusFilter.includes(activeValue)) return false;
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

export function EmailTemplatesManager({ onNavigate, getAuthToken, showNotification, defaultPageSize = 25, overviewMode = false }: EmailTemplatesManagerProps) {
  const containerRef = useFadeIn();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const { data, isLoading, error, refetch } = useListFetch<EmailTemplate, EmailTemplateStats>({
    endpoint: API_ENDPOINTS.ADMIN.EMAIL_TEMPLATES,
    getAuthToken,
    defaultStats: { total: 0, active: 0, categories: [] },
    itemsKey: 'templates'
  });
  const templates = useMemo(() => data?.items ?? [], [data?.items]);
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

  // Single delete handler
  const handleDeleteTemplate = useCallback(async (templateId: number) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      const response = await apiFetch(`${API_ENDPOINTS.ADMIN.EMAIL_TEMPLATES}/${templateId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete template');
      showNotification?.('Template deleted', 'success');
      refetch();
    } catch {
      showNotification?.('Failed to delete template', 'error');
    }
  }, [showNotification, refetch]);

  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const res = await apiPost(API_ENDPOINTS.ADMIN.EMAIL_TEMPLATES, formData);
      if (res.ok) {
        showNotification?.('Template created successfully', 'success');
        setCreateOpen(false);
        refetch();
      } else {
        showNotification?.('Failed to create template', 'error');
      }
    } catch {
      showNotification?.('Failed to create template', 'error');
    } finally {
      setCreateLoading(false);
    }
  }, [showNotification, refetch]);

  // Detail panel state
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  const handleRowClick = useCallback(
    (template: EmailTemplate) => {
      setSelectedTemplate(template);
    },
    []
  );

  const handleClosePanel = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  return (
    <>
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
            <IconButton action="add" onClick={() => setCreateOpen(true)} title="New Template" />
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
              {!overviewMode && <PortalTableHead className="category-col">Category</PortalTableHead>}
              <PortalTableHead className="status-col">Status</PortalTableHead>
              {!overviewMode && (
                <>
                  <PortalTableHead
                    className="date-col"
                    sortable
                    sortDirection={sort?.column === 'updated_at' ? sort.direction : null}
                    onClick={() => toggleSort('updated_at')}
                  >
                  Updated
                  </PortalTableHead>
                  <PortalTableHead className="col-actions">Actions</PortalTableHead>
                </>
              )}
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={overviewMode ? 2 : 5} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={overviewMode ? 2 : 5} rows={5} />
            ) : paginatedTemplates.length === 0 ? (
              <PortalTableEmpty
                colSpan={overviewMode ? 2 : 5}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No templates match your filters' : 'No templates yet'}
              />
            ) : (
              paginatedTemplates.map((template) => (
                <PortalTableRow key={template.id} clickable onClick={() => handleRowClick(template)}>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <Mail className="icon-sm" />
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
                  {!overviewMode && (
                    <PortalTableCell className="category-cell">
                      <div className="cell-with-icon">
                        <Tag className="icon-xs" />
                        <span>{template.category}</span>
                      </div>
                    </PortalTableCell>
                  )}
                  <PortalTableCell className="status-col">
                    <StatusBadge status={template.is_active ? 'completed' : 'pending'} size="sm">
                      {template.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </PortalTableCell>
                  {!overviewMode && (
                    <>
                      <PortalTableCell className="date-col">{formatDate(template.updated_at)}</PortalTableCell>
                      <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="action-group">
                          <IconButton action="edit" title="Edit" onClick={() => onNavigate?.('email-template', String(template.id))} />
                          <IconButton action="delete" title="Delete" onClick={() => handleDeleteTemplate(template.id)} />
                        </div>
                      </PortalTableCell>
                    </>
                  )}
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>
      <CreateEmailTemplateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        loading={createLoading}
      />

      <EmailTemplateDetailPanel
        template={selectedTemplate}
        onClose={handleClosePanel}
        onEdit={(templateId) => onNavigate?.('email-template', String(templateId))}
        showNotification={showNotification}
      />
    </>
  );
}
