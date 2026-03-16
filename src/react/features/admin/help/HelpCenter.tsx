/**
 * HelpCenter
 * Client-facing knowledge base / FAQ browser.
 * Fetches from API_ENDPOINTS.KNOWLEDGE_BASE (public-facing articles).
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, BookOpen, RefreshCw } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { useListFetch } from '@react/factories/useDataFetch';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { FormDropdown } from '@react/components/portal/FormDropdown';
import { formatDate } from '@react/utils/formatDate';
import { API_ENDPOINTS } from '@/constants/api-endpoints';
import DOMPurify from 'dompurify';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_CATEGORIES_VALUE = 'all';
const _SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// TYPES
// ============================================================================

interface HelpArticle {
  id: number;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
}

export interface HelpCenterProps {
  getAuthToken?: () => string | null;
  showNotification?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onNavigate?: (tab: string, entityId?: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HelpCenter({ getAuthToken }: HelpCenterProps) {
  const containerRef = useFadeIn();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES_VALUE);
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useListFetch<HelpArticle>({
    endpoint: API_ENDPOINTS.KNOWLEDGE_BASE,
    getAuthToken,
    itemsKey: 'articles'
  });
  const articles = useMemo(() => data?.items ?? [], [data]);

  // Derive unique categories from articles
  const categories = useMemo(() => {
    const cats = new Set(articles.map((a) => a.category));
    return Array.from(cats).sort();
  }, [articles]);

  const categoryOptions = useMemo(
    () => [
      { value: ALL_CATEGORIES_VALUE, label: 'All Categories' },
      ...categories.map((cat) => ({ value: cat, label: cat }))
    ],
    [categories]
  );

  // Filter articles by search query and category
  const filteredArticles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return articles.filter((article) => {
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES_VALUE || article.category === selectedCategory;
      const matchesSearch =
        !query ||
        article.title.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [articles, searchQuery, selectedCategory]);

  function toggleArticle(articleId: number) {
    setExpandedArticleId((prev) => (prev === articleId ? null : articleId));
  }

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading help articles..." />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <div className="perf-header">
        <h2 className="heading perf-heading">Help Center</h2>
        <button className="btn btn-secondary" onClick={refetch}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="panel">
        <div className="form-row">
          <div className="form-field">
            <div className="input-with-icon">
              <Search className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search articles"
              />
            </div>
          </div>
          <div className="form-field">
            <FormDropdown
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categoryOptions}
              aria-label="Filter by category"
            />
          </div>
        </div>
      </div>

      {/* Article List */}
      {filteredArticles.length === 0 ? (
        <EmptyState
          message={
            searchQuery
              ? 'No articles match your search. Try different keywords.'
              : 'No help articles are available at this time.'
          }
        />
      ) : (
        <div className="help-articles-list">
          {filteredArticles.map((article) => {
            const isExpanded = expandedArticleId === article.id;
            return (
              <div key={article.id} className="portal-card">
                <button
                  className="help-article-header card-clickable"
                  onClick={() => toggleArticle(article.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`article-content-${article.id}`}
                >
                  <div className="help-article-title-row">
                    <BookOpen className="help-article-icon" />
                    <div className="help-article-meta">
                      <span className="help-article-title">{article.title}</span>
                      <span className="help-article-info">
                        {article.category} &middot; Updated {formatDate(article.updatedAt)}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="help-article-chevron" />
                  ) : (
                    <ChevronDown className="help-article-chevron" />
                  )}
                </button>
                {isExpanded && (
                  <div
                    id={`article-content-${article.id}`}
                    className="help-article-content"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HelpCenter;
