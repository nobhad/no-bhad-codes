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
 *
 * Article rendering: ./portal-help-renderer.ts
 * Search logic: ./portal-help-search.ts
 */

import type { ClientPortalContext } from '../portal-types';
import { getCachedElement, clearDOMCache } from '../../../utils/dom-helpers';
import { TIMING } from '../../../constants/timing';
import {
  renderFeatured,
  renderCategoriesAccordion,
  renderAccordionArticles,
  openArticle,
  showFeatured,
  hideArticleView,
  kbFetch,
  type KBCategory,
  type KBArticle
} from './portal-help-renderer';
import {
  showSearchSuggestions,
  navigateSuggestions,
  selectCurrentSuggestion,
  hideSuggestions,
  runSearch
} from './portal-help-search';

// ---------------------------------------------------------------------------
// DOM cache helper
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement | null {
  return getCachedElement(id);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const categoryArticlesCache: Map<string, KBArticle[]> = new Map();
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

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

  if (isExpanded) return;

  // Expand the clicked item
  const header = item.querySelector('.help-accordion-header');
  const articlesContainer = item.querySelector('.help-accordion-articles');

  item.classList.add('expanded');
  if (header) header.setAttribute('aria-expanded', 'true');

  if (articlesContainer && !categoryArticlesCache.has(slug)) {
    try {
      const data = await kbFetch<{ category: KBCategory; articles: KBArticle[] }>(
        `/categories/${encodeURIComponent(slug)}`
      );
      categoryArticlesCache.set(slug, data.articles || []);
      renderAccordionArticles(articlesContainer as HTMLElement, data.articles || [], slug);
    } catch (err) {
      ctx.showNotification((err as Error).message, 'error');
      articlesContainer.innerHTML = '<p class="help-accordion-empty">Failed to load articles.</p>';
    }
  } else if (articlesContainer && categoryArticlesCache.has(slug)) {
    renderAccordionArticles(
      articlesContainer as HTMLElement,
      categoryArticlesCache.get(slug)!,
      slug
    );
  }
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
      const card = (e.target as HTMLElement).closest(
        '.help-featured-card[data-category-slug][data-article-slug]'
      );
      if (card) {
        e.preventDefault();
        openArticle(
          card.getAttribute('data-category-slug')!,
          card.getAttribute('data-article-slug')!,
          ctx
        );
        return;
      }

      const header = (e.target as HTMLElement).closest('.help-accordion-header');
      if (header) {
        const item = header.closest('.help-accordion-item');
        if (item) {
          const slug = item.getAttribute('data-category-slug');
          if (slug) toggleAccordion(slug, ctx);
        }
        return;
      }

      const artLink = (e.target as HTMLElement).closest(
        '.help-accordion-article[data-category-slug][data-article-slug]'
      );
      if (artLink) {
        openArticle(
          artLink.getAttribute('data-category-slug')!,
          artLink.getAttribute('data-article-slug')!,
          ctx
        );
      }
    });
  }

  // Search suggestions click
  const suggestionsEl = el('help-search-suggestions');
  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest(
        '.help-suggestion-item[data-category-slug][data-article-slug]'
      );
      if (item) {
        const categorySlug = item.getAttribute('data-category-slug')!;
        const articleSlug = item.getAttribute('data-article-slug')!;
        openArticle(categorySlug, articleSlug, ctx);
        hideSuggestions();

        const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
        if (searchInput) searchInput.value = '';
      }
    });
  }

  // Search results click
  const resultsList = el('help-search-results-list');
  if (resultsList) {
    resultsList.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest(
        '.help-result-item[data-category-slug][data-article-slug]'
      );
      if (link) {
        e.preventDefault();
        openArticle(
          link.getAttribute('data-category-slug')!,
          link.getAttribute('data-article-slug')!,
          ctx
        );
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
    searchInput.addEventListener('input', () => {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        showSearchSuggestions(searchInput.value, ctx);
      }, 200);
    });

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
          runSearch(searchInput.value, ctx);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        hideSuggestions();
      }
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(hideSuggestions, TIMING.SUGGESTION_HIDE_DELAY);
    });

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
  clearDOMCache();
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
