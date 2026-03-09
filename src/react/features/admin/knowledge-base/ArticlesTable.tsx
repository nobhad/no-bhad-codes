import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Folder,
  Inbox,
  CheckCircle
} from 'lucide-react';
import { IconButton } from '@react/factories';
import { TablePagination } from '@react/components/portal/TablePagination';
import { TableLayout, TableStats } from '@react/components/portal/TableLayout';
import { SearchFilter, FilterDropdown } from '@react/components/portal/TableFilters';
import { formatDate } from '@react/utils/formatDate';
import { StatusBadge, getStatusVariant } from '@react/components/portal/StatusBadge';
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
import { ARTICLES_FILTER_CONFIG, ARTICLE_STATUS_OPTIONS } from '../shared/filterConfigs';
import type { SortConfig } from '../types';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import { apiFetch } from '@/utils/api-client';

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

function filterArticle(
  article: Article,
  filters: Record<string, string>,
  search: string
): boolean {
  if (search) {
    const query = search.toLowerCase();
    if (
      !article.title.toLowerCase().includes(query) &&
      !article.summary?.toLowerCase().includes(query)
    ) {
      return false;
    }
  }

  if (filters.category && filters.category !== 'all') {
    if (article.category_id !== Number(filters.category)) return false;
  }

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'published' && !article.is_published) return false;
    if (filters.status === 'draft' && article.is_published) return false;
  }

  return true;
}

function sortArticles(a: Article, b: Article, sort: SortConfig): number {
  const { column, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  switch (column) {
  case 'title':
    return multiplier * a.title.localeCompare(b.title);
  case 'view_count':
    return multiplier * (a.view_count - b.view_count);
  case 'updated_at':
    return multiplier * a.updated_at.localeCompare(b.updated_at);
  default:
    return 0;
  }
}

export function ArticlesTable({ onNavigate: _onNavigate, getAuthToken: _getAuthToken, showNotification: _showNotification, defaultPageSize = 25, overviewMode = false }: ArticlesTableProps) {
  const containerRef = useFadeIn();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<ArticleStats>({
    totalArticles: 0,
    totalViews: 0,
    published: 0,
    draft: 0
  });

  const {
    filterValues,
    setFilter,
    search,
    setSearch,
    sort,
    toggleSort,
    applyFilters,
    hasActiveFilters
  } = useTableFilters<Article>({
    storageKey: overviewMode ? undefined : 'admin_kb_articles',
    filters: ARTICLES_FILTER_CONFIG,
    filterFn: filterArticle,
    sortFn: sortArticles
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load categories for filter
      const categoriesRes = await apiFetch(API_ENDPOINTS.ADMIN.KB_CATEGORIES);
      if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        setCategories(catData.data?.categories || catData.categories || []);
      }

      // Load articles
      const articlesRes = await apiFetch(API_ENDPOINTS.ADMIN.KB_ARTICLES);
      if (!articlesRes.ok) throw new Error('Failed to load articles');
      const artData = await articlesRes.json();
      setArticles(artData.data?.articles || artData.articles || []);

      // Load stats
      const statsRes = await apiFetch(API_ENDPOINTS.ADMIN.KB_STATS);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || statsData || { totalArticles: 0, totalViews: 0, published: 0, draft: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dynamic category filter options built from API data
  const categoryFilterOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categories.map((cat) => ({
      value: String(cat.id),
      label: `${cat.name} (${cat.article_count})`
    }))
  ], [categories]);

  const filteredArticles = useMemo(() => applyFilters(articles), [applyFilters, articles]);

  const pagination = usePagination({
    totalItems: filteredArticles.length,
    storageKey: overviewMode ? undefined : 'admin_kb_articles_pagination',
    defaultPageSize
  });

  const paginatedArticles = filteredArticles.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="ARTICLES"
      stats={
        <TableStats
          items={[
            { value: stats.totalArticles, label: 'articles' },
            { value: stats.published, label: 'published', variant: 'completed' },
            { value: stats.draft, label: 'draft', variant: 'pending' }
          ]}
          tooltip={`${stats.totalArticles} Articles • ${stats.published} Published • ${stats.draft} Draft • ${stats.totalViews} Views`}
        />
      }
      actions={
        <>
          <SearchFilter
            value={search}
            onChange={setSearch}
            placeholder="Search articles..."
          />
          <FilterDropdown
            sections={[
              { key: 'category', label: 'CATEGORY', options: categoryFilterOptions },
              { key: 'status', label: 'STATUS', options: ARTICLE_STATUS_OPTIONS }
            ]}
            values={filterValues}
            onChange={setFilter}
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
      <PortalTable>
        <PortalTableHeader>
          <PortalTableRow>
            <PortalTableHead
              sortable
              sortDirection={sort?.column === 'title' ? sort.direction : null}
              onClick={() => toggleSort('title')}
            >
              Article
            </PortalTableHead>
            <PortalTableHead>Category</PortalTableHead>
            <PortalTableHead>Status</PortalTableHead>
            <PortalTableHead className="text-center">Featured</PortalTableHead>
            <PortalTableHead
              className="text-center"
              sortable
              sortDirection={sort?.column === 'view_count' ? sort.direction : null}
              onClick={() => toggleSort('view_count')}
            >
              Views
            </PortalTableHead>
            <PortalTableHead
              className="date-col"
              sortable
              sortDirection={sort?.column === 'updated_at' ? sort.direction : null}
              onClick={() => toggleSort('updated_at')}
            >
              Updated
            </PortalTableHead>
            <PortalTableHead className="col-actions">Actions</PortalTableHead>
          </PortalTableRow>
        </PortalTableHeader>

        <PortalTableBody animate={!isLoading && !error}>
          {error ? (
            <PortalTableError colSpan={7} message={error} onRetry={loadData} />
          ) : isLoading ? (
            <PortalTableLoading colSpan={7} rows={5} />
          ) : paginatedArticles.length === 0 ? (
            <PortalTableEmpty
              colSpan={7}
              icon={<Inbox />}
              message={hasActiveFilters ? 'No articles match your filters' : 'No articles yet'}
            />
          ) : (
            paginatedArticles.map((article) => (
              <PortalTableRow key={article.id} clickable>
                <PortalTableCell className="primary-cell">
                  <div className="cell-with-icon">
                    <FileText className="cell-icon" />
                    <div className="cell-content">
                      <span className="cell-title">{article.title}</span>
                      {article.summary && (
                        <span className="cell-subtitle">{article.summary}</span>
                      )}
                    </div>
                  </div>
                </PortalTableCell>
                <PortalTableCell>
                  <div className="cell-with-icon">
                    <Folder className="cell-icon-sm" />
                    <span>{article.category_name}</span>
                  </div>
                </PortalTableCell>
                <PortalTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(article.is_published ? 'published' : 'draft')} size="sm">
                    {article.is_published ? 'Published' : 'Draft'}
                  </StatusBadge>
                </PortalTableCell>
                <PortalTableCell className="text-center">
                  {article.is_featured && (
                    <CheckCircle className="cell-icon-sm status-completed" />
                  )}
                </PortalTableCell>
                <PortalTableCell className="text-center">{article.view_count}</PortalTableCell>
                <PortalTableCell className="date-cell">{formatDate(article.updated_at)}</PortalTableCell>
                <PortalTableCell className="col-actions" onClick={(e) => e.stopPropagation()}>
                  <div className="table-actions">
                    <IconButton action="view" title="View" />
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
