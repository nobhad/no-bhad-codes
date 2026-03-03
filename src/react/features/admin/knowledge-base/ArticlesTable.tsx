import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Folder,
  Inbox,
  CheckCircle,
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
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
  AdminTableError,
} from '@react/components/portal/AdminTable';
import { useFadeIn } from '@react/hooks/useGsap';
import { usePagination } from '@react/hooks/usePagination';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

interface Article {
  id: number;
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  is_featured: boolean;
  is_published: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  sort_order: number;
  author_email?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

interface Category {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  article_count: number;
}

interface ArticleStats {
  totalArticles: number;
  totalViews: number;
  published: number;
  draft: number;
}

interface ArticlesTableProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  defaultPageSize?: number;
  /** Overview mode - disables pagination persistence */
  overviewMode?: boolean;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

export function ArticlesTable({ onNavigate, getAuthToken, showNotification, defaultPageSize = 25, overviewMode = false }: ArticlesTableProps) {
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
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<ArticleStats>({
    totalArticles: 0,
    totalViews: 0,
    published: 0,
    draft: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load categories for filter
      const categoriesRes = await fetch(API_ENDPOINTS.ADMIN.KB_CATEGORIES, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        setCategories(catData.data?.categories || catData.categories || []);
      }

      // Load articles
      const articlesRes = await fetch(API_ENDPOINTS.ADMIN.KB_ARTICLES, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!articlesRes.ok) throw new Error('Failed to load articles');
      const artData = await articlesRes.json();
      setArticles(artData.data?.articles || artData.articles || []);

      // Load stats
      const statsRes = await fetch(API_ENDPOINTS.ADMIN.KB_STATS, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || statsData || { totalArticles: 0, totalViews: 0, published: 0, draft: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryFilterOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map((cat) => ({
      value: String(cat.id),
      label: `${cat.name} (${cat.article_count})`,
    })),
  ], [categories]);

  const filteredArticles = useMemo(() => {
    let result = [...articles];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.summary?.toLowerCase().includes(query)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((a) => a.category_id === Number(categoryFilter));
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'published') {
        result = result.filter((a) => a.is_published);
      } else if (statusFilter === 'draft') {
        result = result.filter((a) => !a.is_published);
      }
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'title': aVal = a.title; bVal = b.title; break;
          case 'view_count': aVal = a.view_count; bVal = b.view_count; break;
          case 'updated_at': aVal = a.updated_at; bVal = b.updated_at; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [articles, searchQuery, categoryFilter, statusFilter, sort]);

  const pagination = usePagination({
    totalItems: filteredArticles.length,
    storageKey: overviewMode ? undefined : 'admin_kb_articles_pagination',
    defaultPageSize,
  });

  const paginatedArticles = filteredArticles.slice(
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
      title="ARTICLES"
      stats={
        <TableStats
          items={[
            { value: stats.totalArticles, label: 'articles' },
            { value: stats.published, label: 'published', variant: 'completed', hideIfZero: true },
            { value: stats.draft, label: 'draft', variant: 'pending', hideIfZero: true },
          ]}
          tooltip={`${stats.totalArticles} Articles • ${stats.published} Published • ${stats.draft} Draft • ${stats.totalViews} Views`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search articles..."
          />
          <FilterDropdown
            sections={[
              { key: 'category', label: 'CATEGORY', options: categoryFilterOptions },
              { key: 'status', label: 'STATUS', options: STATUS_FILTER_OPTIONS },
            ]}
            values={{ category: categoryFilter, status: statusFilter }}
            onChange={handleFilterChange}
          />
          <IconButton action="download" title="Export" />
          <IconButton action="refresh" onClick={loadData} disabled={isLoading} title="Refresh" />
          <IconButton action="add" title="New Article" />
        </>
      }
      pagination={
        !isLoading && filteredArticles.length > 0 ? (
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
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Article
            </AdminTableHead>
            <AdminTableHead>Category</AdminTableHead>
            <AdminTableHead>Status</AdminTableHead>
            <AdminTableHead className="text-center">Featured</AdminTableHead>
            <AdminTableHead
              className="text-center"
              sortable
              sortDirection={sort?.column === 'view_count' ? sort.direction : null}
              onClick={() => toggleSort('view_count')}
            >
              Views
            </AdminTableHead>
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

        <AdminTableBody animate={!isLoading && !error}>
          {error ? (
            <AdminTableError colSpan={7} message={error} onRetry={loadData} />
          ) : isLoading ? (
            <AdminTableLoading colSpan={7} rows={5} />
          ) : paginatedArticles.length === 0 ? (
            <AdminTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No articles match your filters' : 'No articles yet'}
            />
          ) : (
            paginatedArticles.map((article) => (
              <AdminTableRow key={article.id} clickable>
                <AdminTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileText className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{article.title}</span>
                      {article.summary && (
                        <span className="cell-subtitle">{article.summary}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-with-icon">
                    <Folder className="cell-icon-sm" />
                    <span>{article.category_name}</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(article.is_published ? 'published' : 'draft')} size="sm">
                    {article.is_published ? 'Published' : 'Draft'}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell className="text-center">
                  {article.is_featured && (
                    <CheckCircle className="cell-icon-sm status-completed" />
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-center">{article.view_count}</AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(article.updated_at)}</AdminTableCell>
                <AdminTableCell className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
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

export default ArticlesTable;
