/**
 * ===============================================
 * PORTAL HELP - ARTICLE RENDERING
 * ===============================================
 * @file src/features/client/modules/portal-help-renderer.ts
 *
 * Rendering functions for featured articles, categories accordion, and article views.
 * Extracted from portal-help.ts for maintainability.
 */

import type { ClientPortalContext } from '../portal-types';
import { ICONS } from '../../../constants/icons';
import { getCachedElement } from '../../../utils/dom-helpers';
import { apiFetch } from '../../../utils/api-client';
import { API_ENDPOINTS } from '../../../constants/api-endpoints';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  article_count?: number;
}

export interface KBArticle {
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
  account: ICONS.FILE_TEXT,
  billing: ICONS.FILE_TEXT,
  projects: ICONS.CLIPBOARD,
  files: ICONS.FOLDER,
  'files-documents': ICONS.FOLDER,
  documents: ICONS.DOCUMENT,
  communication: ICONS.MAIL,
  messages: ICONS.MAIL,
  faq: ICONS.SEARCH,
  general: ICONS.FILE
};

export function getCategoryIcon(slug: string): string {
  const normalized = slug.toLowerCase().replace(/[_\s]/g, '-');
  if (CATEGORY_ICONS[normalized]) {
    return CATEGORY_ICONS[normalized];
  }
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }
  return ICONS.FILE;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement | null {
  return getCachedElement(id);
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export async function kbFetch<T>(path: string): Promise<T> {
  const res = await apiFetch(`${API_ENDPOINTS.KNOWLEDGE_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Render: Featured articles grid
// ---------------------------------------------------------------------------

export function renderFeatured(articles: KBArticle[], _ctx: ClientPortalContext): void {
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

export function renderCategoriesAccordion(categories: KBCategory[], _ctx: ClientPortalContext): void {
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
          <div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span class="loading-message">Loading articles...</span></div>
        </div>
      </div>
    `;
    accordion.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Render: Accordion articles list
// ---------------------------------------------------------------------------

export function renderAccordionArticles(
  container: HTMLElement,
  articles: KBArticle[],
  categorySlug: string
): void {
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
// Show/hide views
// ---------------------------------------------------------------------------

export function showArticleView(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'block';
  if (featured) featured.style.display = 'none';
  if (searchResults) searchResults.style.display = 'none';
}

export function hideArticleView(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'none';
  if (featured) featured.style.display = 'block';
  if (searchResults) searchResults.style.display = 'none';
}

export function showSearchResults(): void {
  const articleView = el('help-article-view');
  const featured = el('help-featured-section');
  const searchResults = el('help-search-results');
  if (articleView) articleView.style.display = 'none';
  if (featured) featured.style.display = 'none';
  if (searchResults) searchResults.style.display = 'block';
}

export function showFeatured(): void {
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

export async function openArticle(
  categorySlug: string,
  articleSlug: string,
  ctx: ClientPortalContext
): Promise<void> {
  const titleEl = el('help-article-title');
  const bodyEl = el('help-article-body');
  const categoryBadge = el('help-article-category');
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = 'Loading...';
  bodyEl.innerHTML = '';
  if (categoryBadge) categoryBadge.textContent = '';
  showArticleView();

  try {
    const data = await kbFetch<{ article: KBArticle }>(
      `/articles/${encodeURIComponent(categorySlug)}/${encodeURIComponent(articleSlug)}`
    );
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
