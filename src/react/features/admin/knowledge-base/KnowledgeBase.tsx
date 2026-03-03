import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Folder,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Inbox,
  CheckCircle,
  XCircle,
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

// ============================================
// TYPES
// ============================================

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
  is_active?: boolean;
  sort_order?: number;
}

interface KnowledgeBaseStats {
  totalArticles: number;
  totalCategories: number;
  totalViews: number;
  published: number;
  draft: number;
}

interface KnowledgeBaseProps {
  onNavigate?: (tab: string, entityId?: string) => void;
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

type KBSubtab = 'categories' | 'articles';

// ============================================
// CONSTANTS
// ============================================

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function KnowledgeBase({ onNavigate, getAuthToken, showNotification }: KnowledgeBaseProps) {
  const containerRef = useFadeIn();

  // Subtab state - listen for header subtab changes
  const [currentSubtab, setCurrentSubtab] = useState<KBSubtab>('categories');

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

  // Data states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats>({
    totalArticles: 0,
    totalCategories: 0,
    totalViews: 0,
    published: 0,
    draft: 0,
  });

  // Filter states for articles
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // Filter states for categories
  const [categorySearch, setCategorySearch] = useState('');
  const [categorySort, setCategorySort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  // Listen for subtab change events from header
  useEffect(() => {
    function handleSubtabChange(e: CustomEvent<{ subtab: string }>) {
      const subtab = e.detail.subtab as KBSubtab;
      if (subtab === 'categories' || subtab === 'articles') {
        setCurrentSubtab(subtab);
      }
    }

    document.addEventListener('knowledgeBaseSubtabChange', handleSubtabChange as EventListener);
    return () => {
      document.removeEventListener('knowledgeBaseSubtabChange', handleSubtabChange as EventListener);
    };
  }, []);

  // Load both categories and articles
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load categories
      const categoriesRes = await fetch('/api/kb/admin/categories', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (categoriesRes.ok) {
        const catData = await categoriesRes.json();
        // API wraps response in { success, data: { categories } }
        setCategories(catData.data?.categories || catData.categories || []);
      }

      // Load articles
      const articlesRes = await fetch('/api/kb/admin/articles', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (articlesRes.ok) {
        const artData = await articlesRes.json();
        // API wraps response in { success, data: { articles } }
        setArticles(artData.data?.articles || artData.articles || []);
      }

      // Load stats
      const statsRes = await fetch('/api/kb/admin/stats', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        // API wraps response in { success, data: { ...stats } }
        setStats(statsData.data || statsData || { totalArticles: 0, totalCategories: 0, totalViews: 0, published: 0, draft: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge base');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  // Refresh just articles (for article-specific actions)
  const loadArticles = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/admin/articles', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load articles');
      const data = await response.json();
      // API wraps response in { success, data: { articles } }
      setArticles(data.data?.articles || data.articles || []);

      // Also refresh stats
      const statsRes = await fetch('/api/kb/admin/stats', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data || statsData || { totalArticles: 0, totalCategories: 0, totalViews: 0, published: 0, draft: 0 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    }
  }, [getHeaders]);

  // Refresh just categories (for category-specific actions)
  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/kb/admin/categories', {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load categories');
      const data = await response.json();
      // API wraps response in { success, data: { categories } }
      setCategories(data.data?.categories || data.categories || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    }
  }, [getHeaders]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let result = [...categories];
    if (categorySearch) {
      const query = categorySearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.slug?.toLowerCase().includes(query)
      );
    }
    if (categorySort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (categorySort.column) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'article_count': aVal = a.article_count; bVal = b.article_count; break;
          case 'sort_order': aVal = a.sort_order ?? 0; bVal = b.sort_order ?? 0; break;
        }
        if (aVal < bVal) return categorySort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return categorySort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [categories, categorySearch, categorySort]);

  // Filter and sort articles
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
      // Map status filter to is_published boolean
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

  // Pagination for articles
  const articlesPagination = usePagination({
    totalItems: filteredArticles.length,
    storageKey: 'admin_kb_articles_pagination',
  });
  const paginatedArticles = filteredArticles.slice(
    (articlesPagination.page - 1) * articlesPagination.pageSize,
    articlesPagination.page * articlesPagination.pageSize
  );

  // Pagination for categories
  const categoriesPagination = usePagination({
    totalItems: filteredCategories.length,
    storageKey: 'admin_kb_categories_pagination',
  });
  const paginatedCategories = filteredCategories.slice(
    (categoriesPagination.page - 1) * categoriesPagination.pageSize,
    categoriesPagination.page * categoriesPagination.pageSize
  );

  // Use the appropriate pagination based on current subtab
  const pagination = currentSubtab === 'categories' ? categoriesPagination : articlesPagination;

  function toggleSort(column: string) {
    setSort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  }

  function toggleCategorySort(column: string) {
    setCategorySort((prev) => {
      if (prev?.column === column) {
        return prev.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  }


  // Build category filter options dynamically from loaded categories
  const categoryFilterOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((cat) => ({
      value: String(cat.id),
      label: `${cat.name} (${cat.article_count})`,
    })),
  ];

  const hasActiveArticleFilters = searchQuery || categoryFilter !== 'all' || statusFilter !== 'all';
  const hasActiveCategoryFilters = Boolean(categorySearch);

  // Determine current filters based on subtab
  const hasActiveFilters = currentSubtab === 'categories' ? hasActiveCategoryFilters : hasActiveArticleFilters;
  const currentTotalItems = currentSubtab === 'categories' ? filteredCategories.length : filteredArticles.length;

  // ============================================
  // RENDER
  // ============================================

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title={currentSubtab === 'categories' ? 'CATEGORIES' : 'ARTICLES'}
      stats={
        currentSubtab === 'categories' ? (
          <TableStats
            items={[
              { value: categories.length, label: 'categories' },
              { value: categories.filter(c => c.is_active !== false).length, label: 'active', variant: 'completed', hideIfZero: true },
            ]}
            tooltip={`${categories.length} Categories`}
          />
        ) : (
          <TableStats
            items={[
              { value: stats.totalArticles, label: 'articles' },
              { value: stats.published, label: 'published', variant: 'completed', hideIfZero: true },
              { value: stats.draft, label: 'draft', variant: 'pending', hideIfZero: true },
            ]}
            tooltip={`${stats.totalArticles} Articles • ${stats.published} Published • ${stats.draft} Draft • ${stats.totalViews} Views • ${stats.totalCategories} Categories`}
          />
        )
      }
      actions={
        currentSubtab === 'categories' ? (
          <>
            <SearchFilter
              value={categorySearch}
              onChange={setCategorySearch}
              placeholder="Search categories..."
            />
            <IconButton action="refresh" onClick={loadCategories} disabled={isLoading} title="Refresh" />
            <IconButton action="add" title="New Category" />
          </>
        ) : (
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
              onChange={(key, value) => {
                if (key === 'category') setCategoryFilter(value);
                if (key === 'status') setStatusFilter(value);
              }}
            />
            <IconButton action="download" title="Export" />
            <IconButton action="refresh" onClick={loadArticles} disabled={isLoading} title="Refresh" />
            <IconButton action="add" title="New Article" />
          </>
        )
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadData}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
      }
      pagination={
        !isLoading && currentTotalItems > 0 ? (
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
      {/* CATEGORIES TABLE */}
      {!error && currentSubtab === 'categories' && (
        <AdminTable>
          <AdminTableHeader>
            <AdminTableRow>
              <AdminTableHead
                sortable
                sortDirection={categorySort?.column === 'name' ? categorySort.direction : null}
                onClick={() => toggleCategorySort('name')}
              >
                Name
              </AdminTableHead>
              <AdminTableHead>Slug</AdminTableHead>
              <AdminTableHead
                className="text-right"
                sortable
                sortDirection={categorySort?.column === 'article_count' ? categorySort.direction : null}
                onClick={() => toggleCategorySort('article_count')}
              >
                Articles
              </AdminTableHead>
              <AdminTableHead>Active</AdminTableHead>
              <AdminTableHead className="actions-col">Actions</AdminTableHead>
            </AdminTableRow>
          </AdminTableHeader>

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={5} rows={5} />
            ) : paginatedCategories.length === 0 ? (
              <AdminTableEmpty
                colSpan={5}
                icon={<Inbox />}
                message={hasActiveCategoryFilters ? 'No categories match your search' : 'No categories yet'}
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
                  <AdminTableCell className="text-right">{category.article_count}</AdminTableCell>
                  <AdminTableCell>
                    {category.is_active !== false ? (
                      <CheckCircle className="cell-icon-sm status-completed" />
                    ) : (
                      <XCircle className="cell-icon-sm status-cancelled" />
                    )}
                  </AdminTableCell>
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
                            <Edit className="dropdown-icon" />
                            Edit
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

      {/* ARTICLES TABLE */}
      {!error && currentSubtab === 'articles' && (
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
              <AdminTableHead>Featured</AdminTableHead>
              <AdminTableHead
                className="text-right"
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

          <AdminTableBody animate={!isLoading}>
            {isLoading ? (
              <AdminTableLoading colSpan={7} rows={5} />
            ) : paginatedArticles.length === 0 ? (
              <AdminTableEmpty
                colSpan={7}
                icon={<Inbox />}
                message={hasActiveArticleFilters ? 'No articles match your filters' : 'No articles yet'}
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
                  <AdminTableCell>
                    {article.is_featured ? (
                      <CheckCircle className="cell-icon-sm status-completed" />
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell className="text-right">{article.view_count}</AdminTableCell>
                  <AdminTableCell className="date-cell">{formatDate(article.updated_at)}</AdminTableCell>
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
                            View
                          </PortalDropdownItem>
                          <PortalDropdownItem>
                            <Edit className="dropdown-icon" />
                            Edit
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

export default KnowledgeBase;
