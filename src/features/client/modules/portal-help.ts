/**
 * ===============================================
 * PORTAL HELP MODULE (Knowledge Base)
 * ===============================================
 * @file src/features/client/modules/portal-help.ts
 *
 * Help tab: featured articles, categories, search, and article view.
 * Uses /api/kb (knowledge base API).
 */

import type { ClientPortalContext } from '../portal-types';

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
// DOM cache
// ---------------------------------------------------------------------------

const cache = new Map<string, HTMLElement | null>();

function el(id: string): HTMLElement | null {
  if (!cache.has(id)) {
    cache.set(id, document.getElementById(id));
  }
  return cache.get(id) ?? null;
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
// Render: featured list
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
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'help-card';
    link.setAttribute('data-category-slug', catSlug);
    link.setAttribute('data-article-slug', a.slug);
    link.textContent = a.title;
    if (a.summary) {
      const p = document.createElement('p');
      p.className = 'help-card-summary';
      p.textContent = a.summary;
      link.appendChild(p);
    }
    list.appendChild(link);
  }
}

// ---------------------------------------------------------------------------
// Render: categories list
// ---------------------------------------------------------------------------

function renderCategories(categories: KBCategory[], _ctx: ClientPortalContext): void {
  const list = el('help-categories-list');
  const empty = el('help-categories-empty');
  if (!list || !empty) return;

  list.innerHTML = '';
  if (!categories.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const c of categories) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-category-btn';
    btn.setAttribute('data-category-slug', c.slug);
    btn.textContent = c.name;
    const count = c.article_count !== null && c.article_count !== undefined ? ` (${c.article_count})` : '';
    btn.appendChild(document.createTextNode(count));
    list.appendChild(btn);
  }
}

// ---------------------------------------------------------------------------
// Render: search results
// ---------------------------------------------------------------------------

function renderSearchResults(articles: KBArticle[], query: string, _ctx: ClientPortalContext): void {
  const wrap = el('help-search-results');
  const titleEl = el('help-search-results-title');
  const listEl = el('help-search-results-list');
  const browse = el('help-browse');
  if (!wrap || !listEl || !browse) return;

  browse.style.display = 'none';
  wrap.style.display = 'block';
  if (titleEl) titleEl.textContent = `Search results for "${query}"`;

  listEl.innerHTML = '';
  if (!articles.length) {
    listEl.innerHTML = '<p class="help-empty">No articles found.</p>';
    return;
  }

  for (const a of articles) {
    const link = document.createElement('a');
    link.href = '#';
    link.className = 'help-result-link';
    link.setAttribute('data-category-slug', a.category_slug || 'general');
    link.setAttribute('data-article-slug', a.slug);
    link.textContent = a.title;
    listEl.appendChild(link);
  }
}

// ---------------------------------------------------------------------------
// Show article view
// ---------------------------------------------------------------------------

function showArticleView(): void {
  const articleView = el('help-article-view');
  const browse = el('help-browse');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'block';
  if (browse) browse.style.display = 'none';
  if (searchResults) searchResults.style.display = 'none';
}

function hideArticleView(): void {
  const articleView = el('help-article-view');
  const browse = el('help-browse');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'none';
  if (browse) browse.style.display = 'block';
  if (searchResults) searchResults.style.display = 'none';
}

function showBrowse(): void {
  const browse = el('help-browse');
  const searchResults = el('help-search-results');
  const articleView = el('help-article-view');
  if (browse) browse.style.display = 'block';
  if (searchResults) searchResults.style.display = 'none';
  if (articleView) articleView.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Load and show single article
// ---------------------------------------------------------------------------

async function openArticle(categorySlug: string, articleSlug: string, ctx: ClientPortalContext): Promise<void> {
  const titleEl = el('help-article-title');
  const bodyEl = el('help-article-body');
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = 'Loading…';
  bodyEl.innerHTML = '';
  showArticleView();

  try {
    const data = await kbFetch<{ article: KBArticle }>(`/articles/${encodeURIComponent(categorySlug)}/${encodeURIComponent(articleSlug)}`);
    const article = data.article;
    titleEl.textContent = article.title;
    bodyEl.innerHTML = article.content || '';
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
    titleEl.textContent = 'Error loading article';
    bodyEl.textContent = (err as Error).message;
  }
}

// ---------------------------------------------------------------------------
// Load category articles and show (inline list; click opens article)
// ---------------------------------------------------------------------------

async function openCategory(slug: string, ctx: ClientPortalContext): Promise<void> {
  try {
    const data = await kbFetch<{ category: KBCategory; articles: KBArticle[] }>(`/categories/${encodeURIComponent(slug)}`);
    const list = el('help-categories-list');
    const empty = el('help-categories-empty');
    if (!list || !empty) return;

    empty.style.display = 'none';
    list.innerHTML = '';
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-outline btn-sm help-category-back';
    backBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>BACK TO CATEGORIES</span>';
    backBtn.addEventListener('click', () => loadHelp(ctx));
    list.appendChild(backBtn);

    const heading = document.createElement('h4');
    heading.className = 'help-category-heading';
    heading.textContent = data.category.name;
    list.appendChild(heading);

    if (!data.articles.length) {
      list.appendChild(document.createTextNode('No articles in this category.'));
      return;
    }
    for (const a of data.articles) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'help-category-article-link';
      link.setAttribute('data-category-slug', data.category.slug);
      link.setAttribute('data-article-slug', a.slug);
      link.textContent = a.title;
      list.appendChild(link);
    }
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
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
  try {
    const data = await kbFetch<{ articles: KBArticle[]; query: string }>(`/search?q=${encodeURIComponent(q)}&limit=20`);
    renderSearchResults(data.articles, data.query, ctx);
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
  }
}

// ---------------------------------------------------------------------------
// One-time setup: delegated listeners
// ---------------------------------------------------------------------------

let listenersSetup = false;

function setupListeners(ctx: ClientPortalContext): void {
  if (listenersSetup) return;
  listenersSetup = true;

  const browse = el('help-browse');
  if (browse) {
    browse.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest('.help-card[data-category-slug][data-article-slug]');
      if (card) {
        e.preventDefault();
        openArticle(card.getAttribute('data-category-slug')!, card.getAttribute('data-article-slug')!, ctx);
        return;
      }
      const catBtn = (e.target as HTMLElement).closest('.help-category-btn[data-category-slug]');
      if (catBtn) {
        openCategory(catBtn.getAttribute('data-category-slug')!, ctx);
        return;
      }
      const artLink = (e.target as HTMLElement).closest('.help-category-article-link[data-category-slug][data-article-slug]');
      if (artLink) {
        openArticle(artLink.getAttribute('data-category-slug')!, artLink.getAttribute('data-article-slug')!, ctx);
      }
    });
  }

  const resultsList = el('help-search-results-list');
  if (resultsList) {
    resultsList.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('.help-result-link[data-category-slug][data-article-slug]');
      if (link) {
        e.preventDefault();
        openArticle(link.getAttribute('data-category-slug')!, link.getAttribute('data-article-slug')!, ctx);
      }
    });
  }

  const backBtn = el('help-article-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      hideArticleView();
      loadHelp(ctx);
    });
  }

  const searchBtn = el('help-search-btn');
  const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => runSearch(searchInput.value, ctx));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch(searchInput.value, ctx);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Main load: featured + categories
// ---------------------------------------------------------------------------

export async function loadHelp(ctx: ClientPortalContext): Promise<void> {
  setupListeners(ctx);

  showBrowse();
  const searchResults = el('help-search-results');
  const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
  if (searchResults) searchResults.style.display = 'none';
  if (searchInput) searchInput.value = '';

  const errEl = el('help-load-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const [featuredRes, categoriesRes] = await Promise.all([
      kbFetch<{ articles: KBArticle[] }>('/featured?limit=5'),
      kbFetch<{ categories: KBCategory[] }>('/categories')
    ]);

    renderFeatured(featuredRes.articles || [], ctx);
    renderCategories(categoriesRes.categories || [], ctx);
  } catch (err) {
    if (errEl) {
      errEl.textContent = (err as Error).message;
      errEl.style.display = 'block';
    }
    renderFeatured([], ctx);
    renderCategories([], ctx);
  }
}
