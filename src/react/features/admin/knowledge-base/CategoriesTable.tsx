import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  Inbox,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter } from '@react/components/portal/TableFilters';
import {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableLoading,
  AdminTableError,
} from '@react/components/portal/AdminTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

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

export function CategoriesTable({ onNavigate, getAuthToken, showNotification, defaultPageSize = 25, overviewMode = false }: CategoriesTableProps) {
  const containerRef = useFadeIn();

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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.KB_CATEGORIES, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load categories');
      const data = await response.json();
      setCategories(data.data?.categories || data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    let result = [...categories];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.slug?.toLowerCase().includes(query)
      );
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'article_count': aVal = a.article_count; bVal = b.article_count; break;
          case 'sort_order': aVal = a.sort_order ?? 0; bVal = b.sort_order ?? 0; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [categories, searchQuery, sort]);

  const pagination = usePagination({
    totalItems: filteredCategories.length,
    storageKey: overviewMode ? undefined : 'admin_kb_categories_pagination',
    defaultPageSize,
  });

  const paginatedCategories = filteredCategories.slice(
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

  const hasActiveFilters = Boolean(searchQuery);
  const activeCount = categories.filter(c => c.is_active !== false).length;

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="CATEGORIES"
      stats={
        <TableStats
          items={[
            { value: categories.length, label: 'categories' },
            { value: activeCount, label: 'active', variant: 'completed', hideIfZero: true },
          ]}
          tooltip={`${categories.length} Categories • ${activeCount} Active`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
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
      <AdminTable>
        <AdminTableHeader>
          <AdminTableRow>
            <AdminTableHead
              sortable
              sortDirection={sort?.column === 'name' ? sort.direction : null}
              onClick={() => toggleSort('name')}
            >
              Name
            </AdminTableHead>
            <AdminTableHead>Slug</AdminTableHead>
            <AdminTableHead
              className="text-center"
              sortable
              sortDirection={sort?.column === 'article_count' ? sort.direction : null}
              onClick={() => toggleSort('article_count')}
            >
              Articles
            </AdminTableHead>
            <AdminTableHead className="text-center">Active</AdminTableHead>
            <AdminTableHead className="actions-col">Actions</AdminTableHead>
          </AdminTableRow>
        </AdminTableHeader>

        <AdminTableBody animate={!isLoading && !error}>
          {error ? (
            <AdminTableError colSpan={5} message={error} onRetry={loadCategories} />
          ) : isLoading ? (
            <AdminTableLoading colSpan={5} rows={5} />
          ) : paginatedCategories.length === 0 ? (
            <AdminTableEmpty
              colSpan={5}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No categories match your search' : 'No categories yet'}
            />
          ) : (
            paginatedCategories.map((category) => (
              <AdminTableRow key={category.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <Folder className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{category.name}</span>
                      {category.description && (
                        <span className="cell-subtitle">{category.description}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <code className="text-mono">{category.slug}</code>
                </AdminTableCell>
                <AdminTableCell className="text-center">{category.article_count}</AdminTableCell>
                <AdminTableCell className="text-center">
                  {category.is_active !== false ? (
                    <CheckCircle className="cell-icon-sm status-completed" />
                  ) : (
                    <XCircle className="cell-icon-sm status-cancelled" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="edit" title="Edit" />
                    <IconButton action="delete" title="Delete" />
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

export default CategoriesTable;
