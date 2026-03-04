/**
 * PortalHelp
 * Knowledge base help center for the client portal.
 * Browse featured articles, search, and view article detail.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@react/lib/utils';
import { EmptyState, LoadingState, ErrorState } from '@react/components/portal/EmptyState';
import { getLucideIcon } from '@react/factories';
import { useFadeIn, useStaggerChildren } from '@react/hooks/useGsap';
import { API_ENDPOINTS } from '../../../../constants/api-endpoints';
import { BUSINESS_INFO } from '../../../../constants/business';
import { TIMING } from '../../../../constants/timing';
import { createLogger } from '../../../../utils/logger';
import type { BaseMountOptions } from '@react/factories';

const logger = createLogger('PortalHelp');

// ============================================================================
// ICONS
// ============================================================================

const SearchIcon = getLucideIcon('search');
const ChevronDownIcon = getLucideIcon('chevron-down');
const FileTextIcon = getLucideIcon('file-text');
const ArrowLeftIcon = getLucideIcon('arrow-left');
const XIcon = getLucideIcon('x');
const SendIcon = getLucideIcon('send');
const MailIcon = getLucideIcon('mail');
const BookOpenIcon = getLucideIcon('book-open');

// ============================================================================
// TYPES
// ============================================================================

type HelpViewMode = 'browse' | 'search' | 'article';

interface KBArticle {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content?: string;
  is_featured?: boolean;
  category_slug?: string;
}

interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  article_count: number;
  icon?: string;
}

interface ExpandedCategory extends KBCategory {
  articles: KBArticle[];
  isLoading: boolean;
}

export interface PortalHelpProps extends BaseMountOptions {}

// ============================================================================
// HOOK: usePortalHelp
// ============================================================================

function usePortalHelp(getAuthToken?: () => string | null) {
  const [viewMode, setViewMode] = useState<HelpViewMode>('browse');
  const [featuredArticles, setFeaturedArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<ExpandedCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getAuthTokenRef = useRef(getAuthToken);

  useEffect(() => {
    getAuthTokenRef.current = getAuthToken;
  }, [getAuthToken]);

  /** Build headers with auth token */
  const buildHeaders = useCallback((): HeadersInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = getAuthTokenRef.current?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, []);

  /** Fetch featured articles */
  const fetchFeatured = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_ENDPOINTS.KNOWLEDGE_BASE}/featured?limit=6`,
        { headers: buildHeaders(), credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load featured articles');
      const raw = await response.json();
      const data = raw.data ?? raw;
      setFeaturedArticles(data.articles || []);
    } catch (err) {
      logger.error('Error fetching featured articles:', err);
    }
  }, [buildHeaders]);

  /** Fetch categories */
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_ENDPOINTS.KNOWLEDGE_BASE}/categories`,
        { headers: buildHeaders(), credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load categories');
      const raw = await response.json();
      const data = raw.data ?? raw;
      const expandedCategories: ExpandedCategory[] = (data.categories || []).map(
        (cat: KBCategory) => ({
          ...cat,
          articles: [],
          isLoading: false
        })
      );
      setCategories(expandedCategories);
    } catch (err) {
      logger.error('Error fetching categories:', err);
    }
  }, [buildHeaders]);

  /** Load initial data */
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchFeatured(), fetchCategories()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load help center';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFeatured, fetchCategories]);

  // Fetch on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  /** Toggle category expansion and load articles */
  const toggleCategory = useCallback(async (categorySlug: string) => {
    setCategories(prev => {
      const existing = prev.find(c => c.slug === categorySlug);
      // If already has articles, just toggle (collapse)
      if (existing && existing.articles.length > 0) {
        return prev.map(c =>
          c.slug === categorySlug ? { ...c, articles: [], isLoading: false } : c
        );
      }
      // Mark as loading
      return prev.map(c =>
        c.slug === categorySlug ? { ...c, isLoading: true } : c
      );
    });

    // Fetch articles for this category
    try {
      const response = await fetch(
        `${API_ENDPOINTS.KNOWLEDGE_BASE}/categories/${categorySlug}`,
        { headers: buildHeaders(), credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load category articles');
      const raw = await response.json();
      const data = raw.data ?? raw;
      setCategories(prev =>
        prev.map(c =>
          c.slug === categorySlug
            ? { ...c, articles: data.articles || [], isLoading: false }
            : c
        )
      );
    } catch (err) {
      logger.error('Error fetching category articles:', err);
      setCategories(prev =>
        prev.map(c =>
          c.slug === categorySlug ? { ...c, isLoading: false } : c
        )
      );
    }
  }, [buildHeaders]);

  /** View article detail */
  const viewArticle = useCallback(async (categorySlug: string, articleSlug: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_ENDPOINTS.KNOWLEDGE_BASE}/articles/${categorySlug}/${articleSlug}`,
        { headers: buildHeaders(), credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to load article');
      const raw = await response.json();
      const data = raw.data ?? raw;
      setSelectedArticle(data.article);
      setViewMode('article');
    } catch (err) {
      logger.error('Error fetching article:', err);
      setError('Failed to load article. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [buildHeaders]);

  /** Search articles with debounce */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    // Clear previous timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // If empty, return to browse
    if (!query.trim()) {
      setViewMode('browse');
      setSearchResults([]);
      return;
    }

    // Debounced search
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      setViewMode('search');
      try {
        const response = await fetch(
          `${API_ENDPOINTS.KNOWLEDGE_BASE}/search?q=${encodeURIComponent(query.trim())}`,
          { headers: buildHeaders(), credentials: 'include' }
        );
        if (!response.ok) throw new Error('Search failed');
        const raw = await response.json();
        const data = raw.data ?? raw;
        setSearchResults(data.results || []);
      } catch (err) {
        logger.error('Error searching articles:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, TIMING.SEARCH_DEBOUNCE);
  }, [buildHeaders]);

  /** Clear search and return to browse */
  const clearSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    setSearchQuery('');
    setSearchResults([]);
    setViewMode('browse');
  }, []);

  /** Go back from article view */
  const goBack = useCallback(() => {
    setSelectedArticle(null);
    setViewMode(searchQuery.trim() ? 'search' : 'browse');
  }, [searchQuery]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  return {
    viewMode,
    featuredArticles,
    categories,
    searchQuery,
    searchResults,
    selectedArticle,
    isLoading,
    isSearching,
    error,
    handleSearchChange,
    clearSearch,
    toggleCategory,
    viewArticle,
    goBack,
    loadInitialData
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Search bar with clear button */
interface SearchBarProps {
  query: string;
  onChange: (query: string) => void;
  onClear: () => void;
}

function SearchBar({ query, onChange, onClear }: SearchBarProps) {
  return (
    <div className="help-search-container">
      <div className="help-search-wrapper">
        {SearchIcon && <SearchIcon className="help-search-icon" />}
        <input
          type="text"
          className="help-search-input"
          placeholder="Search help articles..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="help-search-clear"
            onClick={onClear}
            aria-label="Clear search"
          >
            {XIcon && <XIcon className="icon-xs" />}
          </button>
        )}
      </div>
    </div>
  );
}

/** Categories accordion sidebar */
interface CategoriesSidebarProps {
  categories: ExpandedCategory[];
  onToggle: (slug: string) => void;
  onArticleClick: (categorySlug: string, articleSlug: string) => void;
}

function CategoriesSidebar({ categories, onToggle, onArticleClick }: CategoriesSidebarProps) {
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  if (categories.length === 0) return null;

  return (
    <div ref={listRef} className="tw-section">
      <h3 className="section-title">Categories</h3>
      <div className="tw-section">
        {categories.map((category) => {
          const isExpanded = category.articles.length > 0;

          return (
            <div key={category.id} className={cn('help-accordion-item', isExpanded && 'expanded')}>
              <button
                type="button"
                className="help-accordion-header"
                onClick={() => onToggle(category.slug)}
              >
                <div className="help-accordion-icon">
                  {BookOpenIcon && <BookOpenIcon className="icon-xs" />}
                </div>
                <span className="help-accordion-title">{category.name}</span>
                <span className="help-accordion-count">{category.article_count}</span>
                {ChevronDownIcon && <ChevronDownIcon className="help-accordion-chevron" />}
              </button>

              {/* CSS controls display via .help-accordion-item.expanded .help-accordion-content */}
              <div className="help-accordion-content">
                {category.isLoading ? (
                  <span className="loading-spinner loading-spinner--sm" />
                ) : (
                  <div className="help-accordion-articles">
                    {category.articles.map((article) => (
                      <button
                        key={article.id}
                        type="button"
                        className="help-accordion-article"
                        onClick={() => onArticleClick(category.slug, article.slug)}
                      >
                        {FileTextIcon && <FileTextIcon className="icon-xs" />}
                        <span>{article.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Featured articles grid */
interface FeaturedArticlesProps {
  articles: KBArticle[];
  onArticleClick: (categorySlug: string, articleSlug: string) => void;
}

function FeaturedArticles({ articles, onArticleClick }: FeaturedArticlesProps) {
  const gridRef = useStaggerChildren<HTMLDivElement>(0.06);

  if (articles.length === 0) return null;

  return (
    <div className="tw-section">
      <h3 className="section-title">Featured Articles</h3>
      <div ref={gridRef} className="tw-section">
        {articles.map((article) => (
          <button
            key={article.id}
            type="button"
            className="help-featured-card"
            onClick={() => onArticleClick(article.category_slug || '', article.slug)}
          >
            <div className="help-featured-card-icon">
              {FileTextIcon && <FileTextIcon className="icon-xs" />}
            </div>
            <div className="help-featured-card-content">
              <p className="help-featured-card-title">{article.title}</p>
              {article.summary && (
                <p className="help-featured-card-summary">{article.summary}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Search results list */
interface SearchResultsProps {
  results: KBArticle[];
  query: string;
  isSearching: boolean;
  onArticleClick: (categorySlug: string, articleSlug: string) => void;
}

function SearchResults({ results, query, isSearching, onArticleClick }: SearchResultsProps) {
  const listRef = useStaggerChildren<HTMLDivElement>(0.05);

  if (isSearching) {
    return <LoadingState message="Searching..." />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchIcon ? <SearchIcon className="icon-lg" /> : undefined}
        message={`No results found for "${query}"`}
      />
    );
  }

  return (
    <div className="help-search-results">
      <h3 className="section-title">
        {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
      </h3>
      <div ref={listRef} className="tw-section">
        {results.map((article) => (
          <button
            key={article.id}
            type="button"
            className="help-result-item"
            onClick={() => onArticleClick(article.category_slug || '', article.slug)}
          >
            <span className="help-result-icon">
              {FileTextIcon && <FileTextIcon className="icon-xs" />}
            </span>
            <div className="help-result-content">
              <p className="help-result-title">{article.title}</p>
              {article.summary && (
                <p className="help-result-category">{article.summary}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Article detail view */
interface ArticleDetailProps {
  article: KBArticle;
  onBack: () => void;
}

function ArticleDetail({ article, onBack }: ArticleDetailProps) {
  const containerRef = useFadeIn<HTMLDivElement>();

  return (
    <div ref={containerRef} className="help-article-view">
      <button
        type="button"
        className="btn-secondary"
        onClick={onBack}
      >
        {ArrowLeftIcon && <ArrowLeftIcon className="icon-xs" />}
        <span>Back to Help Center</span>
      </button>

      <article>
        <h1>{article.title}</h1>
        {article.summary && (
          <p className="text-muted">{article.summary}</p>
        )}
        {article.content && (
          <div
            className="help-article-body"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        )}
      </article>
    </div>
  );
}

/** Contact section at bottom */
interface ContactSectionProps {
  onNavigate?: (tab: string) => void;
}

function ContactSection({ onNavigate }: ContactSectionProps) {
  return (
    <div className="help-contact-section">
      <div className="help-contact-content">
        <div className="help-contact-text">
          <h3 className="section-title">Still Need Help?</h3>
          <p className="help-contact-description">
            Can&apos;t find what you&apos;re looking for? Reach out and we&apos;ll be happy to help.
          </p>
        </div>
        <div className="help-contact-actions">
          {onNavigate && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => onNavigate('messages')}
            >
              {SendIcon && <SendIcon className="icon-xs" />}
              <span>Send a Message</span>
            </button>
          )}
          <a
            href={`mailto:${BUSINESS_INFO.email}`}
            className="btn-secondary"
          >
            {MailIcon && <MailIcon className="icon-xs" />}
            <span>Email Us</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PortalHelp Component
 * Knowledge base help center with browse, search, and article detail views
 */
export function PortalHelp({
  getAuthToken,
  onNavigate
}: PortalHelpProps) {
  const containerRef = useFadeIn<HTMLDivElement>();
  const {
    viewMode,
    featuredArticles,
    categories,
    searchQuery,
    searchResults,
    selectedArticle,
    isLoading,
    isSearching,
    error,
    handleSearchChange,
    clearSearch,
    toggleCategory,
    viewArticle,
    goBack,
    loadInitialData
  } = usePortalHelp(getAuthToken);

  // Article detail view
  if (viewMode === 'article' && selectedArticle) {
    return (
      <div ref={containerRef} className="tw-section">
        <div className="table-layout">
          <div className="data-table-card">
            <div className="data-table-header">
              <h3>
                <span className="title-full">HELP CENTER</span>
              </h3>
            </div>
            <div className="data-table-container">
              <ArticleDetail article={selectedArticle} onBack={goBack} />
              <ContactSection onNavigate={onNavigate} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="tw-section">
      <div className="table-layout">
        <div className="data-table-card">
          <div className="data-table-header">
            <h3>
              <span className="title-full">HELP CENTER</span>
            </h3>
            <div className="data-table-actions">
              <SearchBar
                query={searchQuery}
                onChange={handleSearchChange}
                onClear={clearSearch}
              />
            </div>
          </div>
          <div className="data-table-container">
            {isLoading ? (
              <LoadingState message="Loading help center..." />
            ) : error ? (
              <ErrorState message={error} onRetry={loadInitialData} />
            ) : (
              <>
                {/* Two-column layout */}
                <div className="help-main-grid">
                  {/* Left: Categories accordion */}
                  <div className="help-left-column">
                    <CategoriesSidebar
                      categories={categories}
                      onToggle={toggleCategory}
                      onArticleClick={viewArticle}
                    />
                  </div>

                  {/* Right: Featured / Search results */}
                  <div className="help-right-column">
                    {viewMode === 'search' ? (
                      <SearchResults
                        results={searchResults}
                        query={searchQuery}
                        isSearching={isSearching}
                        onArticleClick={viewArticle}
                      />
                    ) : (
                      <FeaturedArticles
                        articles={featuredArticles}
                        onArticleClick={viewArticle}
                      />
                    )}
                  </div>
                </div>

                {/* Contact section */}
                <ContactSection onNavigate={onNavigate} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
