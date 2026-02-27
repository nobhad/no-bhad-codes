import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Book,
  FileText,
  Folder,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Inbox,
  Users,
  Download,
} from 'lucide-react';
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

interface Article {
  id: string;
  title: string;
  excerpt?: string;
  categoryId: string;
  categoryName: string;
  status: 'published' | 'draft' | 'archived';
  visibility: 'public' | 'internal' | 'private';
  author?: string;
  views: number;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  articleCount: number;
}

interface KnowledgeBaseStats {
  totalArticles: number;
  published: number;
  draft: number;
  totalViews: number;
  categories: Category[];
}

interface KnowledgeBaseProps {
  onNavigate?: (tab: string, entityId?: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export function KnowledgeBase({ onNavigate }: KnowledgeBaseProps) {
  const containerRef = useFadeIn();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<KnowledgeBaseStats>({
    totalArticles: 0,
    published: 0,
    draft: 0,
    totalViews: 0,
    categories: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  async function loadArticles() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/knowledge-base');
      if (!response.ok) throw new Error('Failed to load articles');
      const data = await response.json();
      setArticles(data.articles || []);
      setStats(data.stats || stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredArticles = useMemo(() => {
    let result = [...articles];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.excerpt?.toLowerCase().includes(query)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((a) => a.categoryId === categoryFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (sort) {
      result.sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';
        switch (sort.column) {
          case 'title': aVal = a.title; bVal = b.title; break;
          case 'views': aVal = a.views; bVal = b.views; break;
          case 'updatedAt': aVal = a.updatedAt; bVal = b.updatedAt; break;
        }
        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [articles, searchQuery, categoryFilter, statusFilter, sort]);

  const pagination = usePagination({ totalItems: filteredArticles.length });
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

  function getVisibilityIcon(visibility: string) {
    switch (visibility) {
      case 'public': return <Users className="cell-icon-sm" />;
      case 'internal': return <Book className="cell-icon-sm" />;
      default: return <Eye className="cell-icon-sm" />;
    }
  }

  // Build category filter options dynamically
  const categoryFilterOptions = [
    { value: 'all', label: 'All Categories' },
    ...stats.categories.map((cat) => ({
      value: cat.id,
      label: `${cat.name} (${cat.articleCount})`,
    })),
  ];

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || statusFilter !== 'all';

  return (
    <TableLayout
      containerRef={containerRef as React.RefObject<HTMLDivElement>}
      title="KNOWLEDGE BASE"
      stats={
        <TableStats
          items={[
            { value: stats.totalArticles, label: 'articles' },
            { value: stats.published, label: 'published', variant: 'completed', hideIfZero: true },
            { value: stats.draft, label: 'draft', variant: 'pending', hideIfZero: true },
          ]}
          tooltip={`${stats.totalArticles} Articles • ${stats.published} Published • ${stats.draft} Draft • ${stats.totalViews} Views • ${stats.categories.length} Categories`}
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
            onChange={(key, value) => {
              if (key === 'category') setCategoryFilter(value);
              if (key === 'status') setStatusFilter(value);
            }}
          />
          <button className="icon-btn" title="Export">
            <Download />
          </button>
          <PortalButton variant="primary" size="sm">
            <Plus className="btn-icon" />
            New Article
          </PortalButton>
        </>
      }
      error={
        error ? (
          <div className="table-error-banner">
            {error}
            <PortalButton variant="secondary" size="sm" onClick={loadArticles}>
              Retry
            </PortalButton>
          </div>
        ) : undefined
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
            <AdminTableHead>Visibility</AdminTableHead>
            <AdminTableHead
              className="text-right"
              sortable
              sortDirection={sort?.column === 'views' ? sort.direction : null}
              onClick={() => toggleSort('views')}
            >
              Views
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
                      {article.excerpt && (
                        <span className="cell-subtitle">{article.excerpt}</span>
                      )}
                    </div>
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-with-icon">
                    <Folder className="cell-icon-sm" />
                    <span>{article.categoryName}</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="status-cell">
                  <StatusBadge status={getStatusVariant(article.status)} size="sm">
                    {article.status}
                  </StatusBadge>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="cell-with-icon">
                    {getVisibilityIcon(article.visibility)}
                    <span className="text-capitalize">{article.visibility}</span>
                  </div>
                </AdminTableCell>
                <AdminTableCell className="text-right">{article.views}</AdminTableCell>
                <AdminTableCell className="date-cell">{formatDate(article.updatedAt)}</AdminTableCell>
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
    </TableLayout>
  );
}

export default KnowledgeBase;
