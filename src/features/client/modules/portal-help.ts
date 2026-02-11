/**
 * ===============================================
 * PORTAL HELP MODULE (Knowledge Base)
 * ===============================================
 * @file src/features/client/modules/portal-help.ts
 *
 * Redesigned help with:
 * - Search with live suggestions
 * - Collapsible accordion categories
 * - Featured article cards
 */

import type { ClientPortalContext } from '../portal-types';
import { ICONS } from '../../../constants/icons';

const KB_API_BASE = '/api/kb';

// ---------------------------------------------------------------------------
// Types (match API responses)
// ---------------------------------------------------------------------------

interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  article_count?: number;
}

interface KBArticle {
  id: number;
  category_id: number;
  category_name?: string;
  category_slug?: string;
  title: string;
  slug: string;
  summary?: string;
  content: string;
  is_featured?: boolean;
}

// ---------------------------------------------------------------------------
// Category icon mapping
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, string> = {
  'getting-started': ICONS.ROCKET,
  'account-billing': ICONS.FILE_TEXT,
  'account': ICONS.FILE_TEXT,
  'billing': ICONS.FILE_TEXT,
  'projects': ICONS.CLIPBOARD,
  'files': ICONS.FOLDER,
  'files-documents': ICONS.FOLDER,
  'documents': ICONS.DOCUMENT,
  'communication': ICONS.MAIL,
  'messages': ICONS.MAIL,
  'faq': ICONS.SEARCH,
  'general': ICONS.FILE
};

function getCategoryIcon(slug: string): string {
  // Normalize slug and check for matches
  const normalized = slug.toLowerCase().replace(/[_\s]/g, '-');
  if (CATEGORY_ICONS[normalized]) {
    return CATEGORY_ICONS[normalized];
  }
  // Check partial matches
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }
  return ICONS.FILE; // Default icon
}

// ---------------------------------------------------------------------------
// DOM cache
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLElement | null>();

function el(id: string): HTMLElement | null {
  if (!cache.has(id)) {
    cache.set(id, document.getElementById(id));
  }
  return cache.get(id) ?? null;
}

function clearCache(): void {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Fetch helpers (credentials: include for auth cookies)
// ---------------------------------------------------------------------------

async function kbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${KB_API_BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const categoryArticlesCache: Map<string, KBArticle[]> = new Map();
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let selectedSuggestionIndex = -1;

// ---------------------------------------------------------------------------
// Render: Featured articles grid
// ---------------------------------------------------------------------------

function renderFeatured(articles: KBArticle[], _ctx: ClientPortalContext): void {
  const list = el('help-featured-list');
  const empty = el('help-featured-empty');
  if (!list || !empty) return;

  list.innerHTML = '';
  if (!articles.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const a of articles) {
    const catSlug = a.category_slug || 'general';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'help-featured-card';
    card.setAttribute('data-category-slug', catSlug);
    card.setAttribute('data-article-slug', a.slug);
    card.innerHTML = `
      <span class="help-featured-card-icon">${ICONS.FILE_TEXT}</span>
      <div class="help-featured-card-content">
        <h4 class="help-featured-card-title">${escapeHtml(a.title)}</h4>
        ${a.summary ? `<p class="help-featured-card-summary">${escapeHtml(a.summary)}</p>` : ''}
      </div>
    `;
    list.appendChild(card);
  }
}

// ---------------------------------------------------------------------------
// Render: Categories accordion
// ---------------------------------------------------------------------------

function renderCategoriesAccordion(categories: KBCategory[], _ctx: ClientPortalContext): void {
  const accordion = el('help-categories-accordion');
  const empty = el('help-categories-empty');
  if (!accordion || !empty) return;

  accordion.innerHTML = '';
  if (!categories.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const c of categories) {
    const count = c.article_count !== null && c.article_count !== undefined ? c.article_count : 0;
    const icon = getCategoryIcon(c.slug);

    const item = document.createElement('div');
    item.className = 'help-accordion-item';
    item.setAttribute('data-category-slug', c.slug);
    item.innerHTML = `
      <button type="button" class="help-accordion-header" aria-expanded="false" aria-controls="accordion-content-${c.slug}">
        <span class="help-accordion-icon">${icon}</span>
        <span class="help-accordion-title">${escapeHtml(c.name)}</span>
        <span class="help-accordion-count">${count}</span>
        <span class="help-accordion-chevron">${ICONS.CARET_DOWN}</span>
      </button>
      <div class="help-accordion-content" id="accordion-content-${c.slug}">
        <div class="help-accordion-articles">
          <div class="loading-row">Loading articles...</div>
        </div>
      </div>
    `;
    accordion.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Toggle accordion item (only one open at a time)
// ---------------------------------------------------------------------------

async function toggleAccordion(slug: string, ctx: ClientPortalContext): Promise<void> {
  const accordion = el('help-categories-accordion');
  if (!accordion) return;

  const item = accordion.querySelector(`.help-accordion-item[data-category-slug="${slug}"]`);
  if (!item) return;

  const isExpanded = item.classList.contains('expanded');

  // Collapse ALL accordion items first
  const allItems = accordion.querySelectorAll('.help-accordion-item');
  allItems.forEach((accordionItem) => {
    accordionItem.classList.remove('expanded');
    const hdr = accordionItem.querySelector('.help-accordion-header');
    if (hdr) hdr.setAttribute('aria-expanded', 'false');
  });

  // If it was already expanded, we're done (it's now collapsed)
  if (isExpanded) {
    return;
  }

  // Expand the clicked item
  const header = item.querySelector('.help-accordion-header');
  const articlesContainer = item.querySelector('.help-accordion-articles');

  item.classList.add('expanded');
  if (header) header.setAttribute('aria-expanded', 'true');

  // Load articles if not cached
  if (articlesContainer && !categoryArticlesCache.has(slug)) {
    try {
      const data = await kbFetch<{ category: KBCategory; articles: KBArticle[] }>(`/categories/${encodeURIComponent(slug)}`);
      categoryArticlesCache.set(slug, data.articles || []);
      renderAccordionArticles(articlesContainer as HTMLElement, data.articles || [], slug);
    } catch (err) {
      ctx.showNotification((err as Error).message, 'error');
      articlesContainer.innerHTML = '<p class="help-accordion-empty">Failed to load articles.</p>';
    }
  } else if (articlesContainer && categoryArticlesCache.has(slug)) {
    renderAccordionArticles(articlesContainer as HTMLElement, categoryArticlesCache.get(slug)!, slug);
  }
}

function renderAccordionArticles(container: HTMLElement, articles: KBArticle[], categorySlug: string): void {
  container.innerHTML = '';

  if (!articles.length) {
    container.innerHTML = '<p class="help-accordion-empty">No articles in this category.</p>';
    return;
  }

  for (const a of articles) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-accordion-article';
    btn.setAttribute('data-category-slug', categorySlug);
    btn.setAttribute('data-article-slug', a.slug);
    btn.innerHTML = `
      <span class="help-accordion-article-icon">${ICONS.FILE_TEXT}</span>
      <span>${escapeHtml(a.title)}</span>
    `;
    container.appendChild(btn);
  }
}

// ---------------------------------------------------------------------------
// Search suggestions
// ---------------------------------------------------------------------------

async function showSearchSuggestions(query: string, ctx: ClientPortalContext): Promise<void> {
  const suggestionsEl = el('help-search-suggestions');
  const hintEl = el('help-search-hint');
  const clearBtn = el('help-search-clear');

  if (!suggestionsEl) return;

  // Show/hide clear button
  if (clearBtn) {
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
  }

  // Hide hint when typing
  if (hintEl) {
    hintEl.style.display = query.length > 0 ? 'none' : 'block';
  }

  if (query.length < 2) {
    suggestionsEl.style.display = 'none';
    selectedSuggestionIndex = -1;
    return;
  }

  try {
    const data = await kbFetch<{ articles: KBArticle[]; query: string }>(`/search?q=${encodeURIComponent(query)}&limit=5`);
    renderSearchSuggestions(data.articles, suggestionsEl);
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
    suggestionsEl.style.display = 'none';
  }
}

function renderSearchSuggestions(articles: KBArticle[], container: HTMLElement): void {
  container.innerHTML = '';
  selectedSuggestionIndex = -1;

  if (!articles.length) {
    container.innerHTML = '<p class="help-suggestions-empty">No articles found</p>';
    container.style.display = 'block';
    return;
  }

  for (const a of articles) {
    const item = document.createElement('div');
    item.className = 'help-suggestion-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-category-slug', a.category_slug || 'general');
    item.setAttribute('data-article-slug', a.slug);
    item.innerHTML = `
      <span class="help-suggestion-icon">${ICONS.FILE_TEXT}</span>
      <div class="help-suggestion-content">
        <p class="help-suggestion-title">${escapeHtml(a.title)}</p>
        ${a.category_name ? `<p class="help-suggestion-category">${escapeHtml(a.category_name)}</p>` : ''}
      </div>
    `;
    container.appendChild(item);
  }

  container.style.display = 'block';
}

function navigateSuggestions(direction: 'up' | 'down'): void {
  const suggestionsEl = el('help-search-suggestions');
  if (!suggestionsEl || suggestionsEl.style.display === 'none') return;

  const items = suggestionsEl.querySelectorAll('.help-suggestion-item');
  if (!items.length) return;

  // Remove current selection
  if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
    items[selectedSuggestionIndex].setAttribute('aria-selected', 'false');
  }

  // Update index
  if (direction === 'down') {
    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;
  } else {
    selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? items.length - 1 : selectedSuggestionIndex - 1;
  }

  // Apply new selection
  items[selectedSuggestionIndex].setAttribute('aria-selected', 'true');
  (items[selectedSuggestionIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
}

function selectCurrentSuggestion(ctx: ClientPortalContext): boolean {
  const suggestionsEl = el('help-search-suggestions');
  if (!suggestionsEl || suggestionsEl.style.display === 'none') return false;

  const items = suggestionsEl.querySelectorAll('.help-suggestion-item');
  if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
    const item = items[selectedSuggestionIndex] as HTMLElement;
    const categorySlug = item.getAttribute('data-category-slug');
    const articleSlug = item.getAttribute('data-article-slug');
    if (categorySlug && articleSlug) {
      openArticle(categorySlug, articleSlug, ctx);
      hideSuggestions();
      return true;
    }
  }
  return false;
}

function hideSuggestions(): void {
  const suggestionsEl = el('help-search-suggestions');
  if (suggestionsEl) {
    suggestionsEl.style.display = 'none';
  }
  selectedSuggestionIndex = -1;
}

// ---------------------------------------------------------------------------
// Render: Search results (full page)
// ---------------------------------------------------------------------------

function renderSearchResults(articles: KBArticle[], query: string, _ctx: ClientPortalContext): void {
  const titleEl = el('help-search-results-title');
  const listEl = el('help-search-results-list');
  if (!listEl) return;

  showSearchResults();
  if (titleEl) titleEl.textContent = `Results for "${query}"`;

  listEl.innerHTML = '';
  if (!articles.length) {
    listEl.innerHTML = '<p class="help-empty">No articles found. Try a different search term.</p>';
    return;
  }

  for (const a of articles) {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'help-result-item';
    item.setAttribute('data-category-slug', a.category_slug || 'general');
    item.setAttribute('data-article-slug', a.slug);
    item.innerHTML = `
      <span class="help-result-icon">${ICONS.FILE_TEXT}</span>
      <div class="help-result-content">
        <h4 class="help-result-title">${escapeHtml(a.title)}</h4>
        ${a.category_name ? `<p class="help-result-category">${escapeHtml(a.category_name)}</p>` : ''}
      </div>
    `;
    listEl.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Show/hide views (within the right column)
// ---------------------------------------------------------------------------

function showArticleView(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'block';
  if (featured) featured.style.display = 'none';
  if (searchResults) searchResults.style.display = 'none';
}

function hideArticleView(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'none';
  if (featured) featured.style.display = 'block';
  if (searchResults) searchResults.style.display = 'none';
}

function showSearchResults(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'none';
  if (featured) featured.style.display = 'none';
  if (searchResults) searchResults.style.display = 'block';
}

function showFeatured(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'none';
  if (featured) featured.style.display = 'block';
  if (searchResults) searchResults.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Load and show single article
// ---------------------------------------------------------------------------

async function openArticle(categorySlug: string, articleSlug: string, ctx: ClientPortalContext): Promise<void> {
  const titleEl = el('help-article-title');
  const bodyEl = el('help-article-body');
  const categoryBadge = el('help-article-category');
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = 'Loading...';
  bodyEl.innerHTML = '';
  if (categoryBadge) categoryBadge.textContent = '';
  showArticleView();

  try {
    const data = await kbFetch<{ article: KBArticle }>(`/articles/${encodeURIComponent(categorySlug)}/${encodeURIComponent(articleSlug)}`);
    const article = data.article;
    titleEl.textContent = article.title;
    bodyEl.innerHTML = article.content || '';
    if (categoryBadge && article.category_name) {
      categoryBadge.textContent = article.category_name;
    }
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
    titleEl.textContent = 'Error loading article';
    bodyEl.textContent = (err as Error).message;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

async function runSearch(query: string, ctx: ClientPortalContext): Promise<void> {
  const q = query.trim();
  if (q.length < 2) {
    ctx.showNotification('Enter at least 2 characters to search.', 'info');
    return;
  }

  hideSuggestions();

  try {
    const data = await kbFetch<{ articles: KBArticle[]; query: string }>(`/search?q=${encodeURIComponent(q)}&limit=20`);
    renderSearchResults(data.articles, data.query, ctx);
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Escape HTML
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// One-time setup: delegated listeners
// ---------------------------------------------------------------------------

let listenersSetup = false;

function setupListeners(ctx: ClientPortalContext): void {
  if (listenersSetup) return;
  listenersSetup = true;

  // Featured articles + accordion articles click
  const browse = el('help-browse');
  if (browse) {
    browse.addEventListener('click', (e) => {
      // Featured card click
      const card = (e.target as HTMLElement).closest('.help-featured-card[data-category-slug][data-article-slug]');
      if (card) {
        e.preventDefault();
        openArticle(card.getAttribute('data-category-slug')!, card.getAttribute('data-article-slug')!, ctx);
        return;
      }

      // Accordion header click
      const header = (e.target as HTMLElement).closest('.help-accordion-header');
      if (header) {
        const item = header.closest('.help-accordion-item');
        if (item) {
          const slug = item.getAttribute('data-category-slug');
          if (slug) toggleAccordion(slug, ctx);
        }
        return;
      }

      // Accordion article click
      const artLink = (e.target as HTMLElement).closest('.help-accordion-article[data-category-slug][data-article-slug]');
      if (artLink) {
        openArticle(artLink.getAttribute('data-category-slug')!, artLink.getAttribute('data-article-slug')!, ctx);
      }
    });
  }

  // Search suggestions click
  const suggestionsEl = el('help-search-suggestions');
  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.help-suggestion-item[data-category-slug][data-article-slug]');
      if (item) {
        const categorySlug = item.getAttribute('data-category-slug')!;
        const articleSlug = item.getAttribute('data-article-slug')!;
        openArticle(categorySlug, articleSlug, ctx);
        hideSuggestions();

        // Clear search input
        const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
        if (searchInput) searchInput.value = '';
      }
    });
  }

  // Search results click
  const resultsList = el('help-search-results-list');
  if (resultsList) {
    resultsList.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('.help-result-item[data-category-slug][data-article-slug]');
      if (link) {
        e.preventDefault();
        openArticle(link.getAttribute('data-category-slug')!, link.getAttribute('data-article-slug')!, ctx);
      }
    });
  }

  // Search results back button
  const searchResultsBack = el('help-search-results-back');
  if (searchResultsBack) {
    searchResultsBack.addEventListener('click', () => {
      showFeatured();
      const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
      if (searchInput) searchInput.value = '';
    });
  }

  // Article back button
  const backBtn = el('help-article-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      hideArticleView();
    });
  }

  // Search input with suggestions
  const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
  if (searchInput) {
    // Debounced search suggestions
    searchInput.addEventListener('input', () => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        showSearchSuggestions(searchInput.value, ctx);
      }, 200);
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const suggestionsDropdown = el('help-search-suggestions');
      const isOpen = suggestionsDropdown && suggestionsDropdown.style.display !== 'none';

      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault();
        navigateSuggestions('down');
      } else if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault();
        navigateSuggestions('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isOpen && selectCurrentSuggestion(ctx)) {
          // Selected a suggestion
        } else {
          // Run full search
          runSearch(searchInput.value, ctx);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        hideSuggestions();
      }
    });

    // Hide suggestions on blur (with delay for click handling)
    searchInput.addEventListener('blur', () => {
      setTimeout(hideSuggestions, 200);
    });

    // Show suggestions on focus if has value
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.length >= 2) {
        showSearchSuggestions(searchInput.value, ctx);
      }
    });
  }

  // Clear search button
  const clearBtn = el('help-search-clear');
  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      hideSuggestions();
      clearBtn.style.display = 'none';
      const hintEl = el('help-search-hint');
      if (hintEl) hintEl.style.display = 'block';
      searchInput.focus();
    });
  }

  // Contact section message link
  const browse2 = el('help-browse');
  if (browse2) {
    browse2.addEventListener('click', (e) => {
      const msgBtn = (e.target as HTMLElement).closest('[data-action="send-message"]');
      if (msgBtn) {
        // The link will navigate naturally via href="#/messages"
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Main load: featured + categories
// ---------------------------------------------------------------------------

export async function loadHelp(ctx: ClientPortalContext): Promise<void> {
  // Clear cache on load to ensure fresh DOM references
  clearCache();
  categoryArticlesCache.clear();

  setupListeners(ctx);

  showFeatured();
  const searchResults = el('help-search-results');
  const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
  if (searchResults) searchResults.style.display = 'none';
  if (searchInput) searchInput.value = '';

  const errEl = el('help-load-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const [featuredRes, categoriesRes] = await Promise.all([
      kbFetch<{ articles: KBArticle[] }>('/featured?limit=6'),
      kbFetch<{ categories: KBCategory[] }>('/categories')
    ]);

    renderFeatured(featuredRes.articles || [], ctx);
    renderCategoriesAccordion(categoriesRes.categories || [], ctx);
  } catch (err) {
    if (errEl) {
      errEl.textContent = (err as Error).message;
      errEl.style.display = 'block';
    }
    renderFeatured([], ctx);
    renderCategoriesAccordion([], ctx);
  }
}
