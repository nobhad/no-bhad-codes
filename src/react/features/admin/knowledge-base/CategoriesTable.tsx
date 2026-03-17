import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Folder,
  Inbox,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { useListFetch } from '@react/factories/useDataFetch';
import { InlineEdit } from '@react/components/portal/InlineEdit';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter } from '@react/components/portal/TableFilters';
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
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { useTableFilters } from '@react/hooks/useTableFilters';
import type { SortConfig } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiPost, apiFetch } from '@/utils/api-client';
import { createLogger } from '@/utils/logger';
import { CreateKBCategoryModal } from '../modals/CreateEntityModals';

const logger = createLogger('CategoriesTable');

interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  article_count: number;
  is_active?: boolean;
  sort_order?: number;
}

interface CategoriesTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

function filterCategory(
  category: Category,
  _filters: Record<string, string[]>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !category.name.toLowerCase().includes(query) &&
      !category.description?.toLowerCase().includes(query) &&
      !category.slug?.toLowerCase().includes(query)
    ) {
      return false;
    }
  }
  return true;
}

function sortCategories(a: Category, b: Category, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'name':
    return multiplier * a.name.localeCompare(b.name);
  case 'article_count':
    return multiplier * (a.article_count - b.article_count);
  case 'sort_order':
    return multiplier * ((a.sort_order ?? 0) - (b.sort_order ?? 0));
  default:
    return 0;
  }
}

export function CategoriesTable({ onNavigate: _onNavigate, getAuthToken, showNotification, defaultPageSize = 25, overviewMode = false }: CategoriesTableProps) {
  const containerRef = useFadeIn();
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const { data, isLoading, error, refetch, setData } = useListFetch<Category>({
    endpoint: API_ENDPOINTS.ADMIN.KB_CATEGORIES,
    getAuthToken,
    itemsKey: 'categories'
  });
  const categories = useMemo(() => data?.items ?? [], [data]);

  // Generic field update handler for inline editing
  const handleFieldUpdate = useCallback(async (
    categoryId: number,
    updates: Partial<Record<string, unknown>>
  ): Promise<boolean> => {
    try {
      const response = await apiFetch(`${API_ENDPOINTS.ADMIN.KB_CATEGORIES}/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update category');

      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((cat) =>
          cat.id === categoryId
            ? { ...cat, ...updates }
            : cat
        )
      } : prev);
      showNotification?.('Category updated', 'success');
      return true;
    } catch (err) {
      logger.error('Failed to update category:', err);
      showNotification?.('Failed to update category', 'error');
      return false;
    }
  }, [showNotification, setData]);

  const {
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Category>({
    storageKey: overviewMode ? undefined : 'admin_kb_categories',
    filters: [],
    filterFn: filterCategory,
    sortFn: sortCategories
  });

  const filteredCategories = useMemo(() => applyFilters(categories), [applyFilters, categories]);

  const pagination = usePagination({
    totalItems: filteredCategories.length,
    storageKey: overviewMode ? undefined : 'admin_kb_categories_pagination',
    defaultPageSize
  });

  const paginatedCategories = filteredCategories.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  const activeCount = categories.filter(c => c.is_active !== false).length;

  const handleCreate = useCallback(async (formData: Record<string, unknown>) => {
    setCreateLoading(true);
    try {
      const res = await apiPost(API_ENDPOINTS.ADMIN.KB_CATEGORIES, formData);
      if (res.ok) {
        showNotification?.('Category created successfully', 'success');
        setCreateOpen(false);
        refetch();
      } else {
        showNotification?.('Failed to create category', 'error');
      }
    } catch {
      showNotification?.('Failed to create category', 'error');
    } finally {
      setCreateLoading(false);
    }
  }, [showNotification, refetch]);

  return (
    <>
      <TableLayout
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        title="CATEGORIES"
        stats={
          <TableStats
            items={[
              { value: categories.length, label: 'categories' },
              { value: activeCount, label: 'active', variant: 'completed' }
            ]}
            tooltip={`${categories.length} Categories • ${activeCount} Active`}
          />
        }
        actions={
          <>
            <SearchFilter
              value={search}
              onChange={setSearch}
              placeholder="Search categories..."
            />
            <IconButton action="refresh" onClick={refetch} disabled={isLoading} title="Refresh" />
            <IconButton action="add" onClick={() => setCreateOpen(true)} title="New Category" />
          </>
        }
        pagination={
          !isLoading && filteredCategories.length > 0 ? (
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
                sortable
                sortDirection={sort?.column === 'name' ? sort.direction : null}
                onClick={() => toggleSort('name')}
              >
              Name
              </PortalTableHead>
              <PortalTableHead>Slug</PortalTableHead>
              <PortalTableHead
                className="text-center"
                sortable
                sortDirection={sort?.column === 'article_count' ? sort.direction : null}
                onClick={() => toggleSort('article_count')}
              >
              Articles
              </PortalTableHead>
              <PortalTableHead className="text-center">Active</PortalTableHead>
              <PortalTableHead className="col-actions">Actions</PortalTableHead>
            </PortalTableRow>
          </PortalTableHeader>

          <PortalTableBody animate={!isLoading && !error}>
            {error ? (
              <PortalTableError colSpan={5} message={error} onRetry={refetch} />
            ) : isLoading ? (
              <PortalTableLoading colSpan={5} rows={5} />
            ) : paginatedCategories.length === 0 ? (
              <PortalTableEmpty
                colSpan={5}
                icon={<Inbox />}
                message={hasActiveFilters ? 'No categories match your search' : 'No categories yet'}
              />
            ) : (
              paginatedCategories.map((category) => (
                <PortalTableRow key={category.id} clickable>
                  <PortalTableCell className="primary-cell">
                    <div className="cell-with-icon">
                      <Folder className="icon-sm" />
                      <div className="cell-content">
                        <span className="cell-title">
                          <InlineEdit
                            value={category.name}
                            placeholder="Enter name"
                            onSave={async (value) =>
                              handleFieldUpdate(category.id, { name: value.trim() })
                            }
                          />
                        </span>
                        <span className="cell-subtitle">
                          <InlineEdit
                            value={category.description || ''}
                            placeholder="Add description"
                            onSave={async (value) =>
                              handleFieldUpdate(category.id, { description: value.trim() })
                            }
                          />
                        </span>
                      </div>
                    </div>
                  </PortalTableCell>
                  <PortalTableCell>
                    <code>{category.slug}</code>
                  </PortalTableCell>
                  <PortalTableCell className="text-center">{category.article_count}</PortalTableCell>
                  <PortalTableCell className="text-center">
                    {category.is_active !== false ? (
                      <CheckCircle className="icon-xs status-completed" />
                    ) : (
                      <XCircle className="icon-xs status-cancelled" />
                    )}
                  </PortalTableCell>
                  <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="action-group">
                      <IconButton action="delete" title="Delete" />
                    </div>
                  </PortalTableCell>
                </PortalTableRow>
              ))
            )}
          </PortalTableBody>
        </PortalTable>
      </TableLayout>
      <CreateKBCategoryModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        loading={createLoading}
      />
    </>
  );
}
