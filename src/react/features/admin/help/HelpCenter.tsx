/**
 * HelpCenter
 * Client-facing knowledge base / FAQ browser.
 * Fetches from API_ENDPOINTS.KNOWLEDGE_BASE (public-facing articles).
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ChevronUp, BookOpen, RefreshCw } from 'lucide-react';
import { useFadeIn } from '@react/hooks/useGsap';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { formatDate } from '@react/utils/formatDate';
import { createLogger } from '../../../../utils/logger';
import { unwrapApiData } from '../../../../utils/api-client';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';

const logger = createLogger('HelpCenter');

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
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES_VALUE);
  const [expandedArticleId, setExpandedArticleId] = useState<number | null>(null);

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

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.KNOWLEDGE_BASE, {
        headers: getHeaders(),
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load help articles');
      const payload = unwrapApiData<Record<string, unknown>>(await response.json());
      setArticles((payload.articles as HelpArticle[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load articles';
      logger.error('Failed to load help articles:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Derive unique categories from articles
  const categories = useMemo(() => {
    const cats = new Set(articles.map((a) => a.category));
    return Array.from(cats).sort();
  }, [articles]);

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
    return <ErrorState message={error} onRetry={fetchArticles} />;
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="section">
      <div className="perf-header">
        <h2 className="heading perf-heading">Help Center</h2>
        <button className="btn btn-secondary" onClick={fetchArticles}>
          <RefreshCw className="btn-icon-left" />
          Refresh
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="panel">
        <div className="form-row">
          <div className="form-group form-group-grow">
            <div className="input-with-icon">
              <Search className="input-icon" />
              <input
                type="text"
                className="form-input"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <select
              className="form-input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value={ALL_CATEGORIES_VALUE}>All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
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
                      <span className="text-muted help-article-info">
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
                    dangerouslySetInnerHTML={{ __html: article.content }}
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
