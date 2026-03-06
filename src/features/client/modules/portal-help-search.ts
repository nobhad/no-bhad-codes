/**
 * ===============================================
 * PORTAL HELP - SEARCH LOGIC
 * ===============================================
 * @file src/features/client/modules/portal-help-search.ts
 *
 * Search suggestions, navigation, and full-page search results.
 * Extracted from portal-help.ts for maintainability.
 */

import type { ClientPortalContext } from '../portal-types';
import { ICONS } from '../../../constants/icons';
import { getCachedElement } from '../../../utils/dom-helpers';
import {
  escapeHtml,
  kbFetch,
  openArticle,
  showSearchResults,
  type KBArticle
} from './portal-help-renderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement | null {
  return getCachedElement(id);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let selectedSuggestionIndex = -1;

// ---------------------------------------------------------------------------
// Search suggestions
// ---------------------------------------------------------------------------

export async function showSearchSuggestions(query: string, ctx: ClientPortalContext): Promise<void> {
  const suggestionsEl = el('help-search-suggestions');
  const hintEl = el('help-search-hint');
  const clearBtn = el('help-search-clear');

  if (!suggestionsEl) return;

  if (clearBtn) {
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
  }

  if (hintEl) {
    hintEl.style.display = query.length > 0 ? 'none' : 'block';
  }

  if (query.length < 2) {
    suggestionsEl.style.display = 'none';
    selectedSuggestionIndex = -1;
    return;
  }

  try {
    const data = await kbFetch<{ articles: KBArticle[]; query: string }>(
      `/search?q=${encodeURIComponent(query)}&limit=5`
    );
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

export function navigateSuggestions(direction: 'up' | 'down'): void {
  const suggestionsEl = el('help-search-suggestions');
  if (!suggestionsEl || suggestionsEl.style.display === 'none') return;

  const items = suggestionsEl.querySelectorAll('.help-suggestion-item');
  if (!items.length) return;

  if (selectedSuggestionIndex >= 0 && items[selectedSuggestionIndex]) {
    items[selectedSuggestionIndex].setAttribute('aria-selected', 'false');
  }

  if (direction === 'down') {
    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % items.length;
  } else {
    selectedSuggestionIndex =
      selectedSuggestionIndex <= 0 ? items.length - 1 : selectedSuggestionIndex - 1;
  }

  items[selectedSuggestionIndex].setAttribute('aria-selected', 'true');
  (items[selectedSuggestionIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
}

export function selectCurrentSuggestion(ctx: ClientPortalContext): boolean {
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

export function hideSuggestions(): void {
  const suggestionsEl = el('help-search-suggestions');
  if (suggestionsEl) {
    suggestionsEl.style.display = 'none';
  }
  selectedSuggestionIndex = -1;
}

// ---------------------------------------------------------------------------
// Full-page search results
// ---------------------------------------------------------------------------

export function renderSearchResults(
  articles: KBArticle[],
  query: string,
  _ctx: ClientPortalContext
): void {
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
// Run search
// ---------------------------------------------------------------------------

export async function runSearch(query: string, ctx: ClientPortalContext): Promise<void> {
  const q = query.trim();
  if (q.length < 2) {
    ctx.showNotification('Enter at least 2 characters to search.', 'info');
    return;
  }

  hideSuggestions();

  try {
    const data = await kbFetch<{ articles: KBArticle[]; query: string }>(
      `/search?q=${encodeURIComponent(q)}&limit=20`
    );
    renderSearchResults(data.articles, data.query, ctx);
  } catch (err) {
    ctx.showNotification((err as Error).message, 'error');
  }
}
