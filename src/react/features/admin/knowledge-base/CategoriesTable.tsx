import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  Inbox,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { IconButton } from '@react/factories';
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
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { unwrapApiData } from '../../../../utils/api-client';

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
  _filters: Record<string, string>,
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

export function CategoriesTable({ onNavigate: _onNavigate, getAuthToken, showNotification: _showNotification, defaultPageSize = 25, overviewMode = false }: CategoriesTableProps) {
  const containerRef = useFadeIn();

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
  const [categories, setCategories] = useState<Category[]>([]);

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

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.KB_CATEGORIES, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load categories');
      const data = unwrapApiData<Record<string, unknown>>(await response.json());
      setCategories((data.categories as Category[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="CATEGORIES"
      stats={
        <TableStats
          items={[
            { value: categories.length, label: 'categories' },
            { value: activeCount, label: 'active', variant: 'completed', hideIfZero: true }
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
          <IconButton action="refresh" onClick={loadCategories} disabled={isLoading} title="Refresh" />
          <IconButton action="add" title="New Category" />
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
            <PortalTableHead className="actions-col">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={5} message={error} onRetry={loadCategories} />
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
                    <Folder className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{category.name}</span>
                      {category.description && (
                        <span className="cell-subtitle">{category.description}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  <code className="text-mono">{category.slug}</code>
                </PortalTableCell>
                <PortalTableCell className="text-center">{category.article_count}</PortalTableCell>
                <PortalTableCell className="text-center">
                  {category.is_active !== false ? (
                    <CheckCircle className="cell-icon-sm status-completed" />
                  ) : (
                    <XCircle className="cell-icon-sm status-cancelled" />
                  )}
                </PortalTableCell>
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

export default CategoriesTable;
