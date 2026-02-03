/**
 * ===============================================
 * ADMIN KNOWLEDGE BASE MODULE
 * ===============================================
 * @file src/features/admin/modules/admin-knowledge-base.ts
 *
 * Categories and articles CRUD for knowledge base.
 * Uses /api/kb/admin/* endpoints.
 */

import type { AdminDashboardContext } from '../admin-types';
import { apiFetch, apiPost, apiPut, apiDelete, parseJsonResponse } from '../../../utils/api-client';
import { showTableLoading, showTableEmpty } from '../../../utils/loading-utils';
import { confirmDanger, alertError, alertSuccess } from '../../../utils/confirm-dialog';
import { manageFocusTrap } from '../../../utils/focus-trap';
import { createFilterSelect, type FilterSelectInstance } from '../../../components/filter-select';
import { createTableDropdown } from '../../../components/table-dropdown';
import { createPortalModal, type PortalModalInstance } from '../../../components/portal-modal';
import { formatDate } from '../../../utils/format-utils';
import { SanitizationUtils } from '../../../utils/sanitization-utils';
import { createSearchBar } from '../../../components/search-bar';
import { exportToCsv, KNOWLEDGE_BASE_EXPORT_CONFIG } from '../../../utils/table-export';

const KB_API = '/api/kb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KBCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
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
  is_featured: boolean;
  is_published: boolean;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// ---------------------------------------------------------------------------
// Load categories
// ---------------------------------------------------------------------------

async function loadCategories(_ctx: AdminDashboardContext): Promise<KBCategory[]> {
  const res = await apiFetch(`${KB_API}/admin/categories`);
  if (!res.ok) return [];
  const data = await parseJsonResponse<{ categories: KBCategory[] }>(res);
  return data.categories || [];
}

async function loadArticles(ctx: AdminDashboardContext, categorySlug?: string): Promise<KBArticle[]> {
  const url = categorySlug ? `${KB_API}/admin/articles?category=${encodeURIComponent(categorySlug)}` : `${KB_API}/admin/articles`;
  const res = await apiFetch(url);
  if (!res.ok) return [];
  const data = await parseJsonResponse<{ articles: KBArticle[] }>(res);
  return data.articles || [];
}

// ---------------------------------------------------------------------------
// Render categories table
// ---------------------------------------------------------------------------

const CATEGORIES_COLSPAN = 5;

function renderCategoriesTable(categories: KBCategory[], _ctx: AdminDashboardContext): void {
  const tbody = el('kb-categories-tbody');
  if (!tbody) return;

  if (categories.length === 0) {
    showTableEmpty(tbody, CATEGORIES_COLSPAN, 'No categories yet. Add one to get started.');
    return;
  }

  tbody.innerHTML = categories
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td><code>${escapeHtml(c.slug)}</code></td>
      <td>${c.article_count ?? 0}</td>
      <td>${c.is_active ? 'Yes' : 'No'}</td>
      <td class="actions-cell">
        <button type="button" class="icon-btn kb-edit-category" data-id="${c.id}" title="Edit" aria-label="Edit category">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button type="button" class="icon-btn icon-btn-danger kb-delete-category" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Delete" aria-label="Delete category">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>
  `
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Render articles table
// ---------------------------------------------------------------------------

const ARTICLES_COLSPAN = 7;

function renderArticlesTable(articles: KBArticle[], _ctx: AdminDashboardContext): void {
  const tbody = el('kb-articles-tbody');
  if (!tbody) return;

  if (articles.length === 0) {
    showTableEmpty(tbody, ARTICLES_COLSPAN, 'No articles yet. Add one to get started.');
    return;
  }

  tbody.innerHTML = articles
    .map(
      (a) => `
    <tr>
      <td>${escapeHtml(a.title)}</td>
      <td>${escapeHtml(a.category_name || '-')}</td>
      <td><code>${escapeHtml(a.slug)}</code></td>
      <td>${a.is_featured ? 'Yes' : 'No'}</td>
      <td>${a.is_published ? 'Yes' : 'No'}</td>
      <td>${formatDate(a.updated_at)}</td>
      <td class="actions-cell">
        <button type="button" class="icon-btn kb-edit-article" data-id="${a.id}" title="Edit" aria-label="Edit article">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button type="button" class="icon-btn icon-btn-danger kb-delete-article" data-id="${a.id}" data-title="${escapeHtml(a.title)}" title="Delete" aria-label="Delete article">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>
  `
    )
    .join('');
}

function escapeHtml(text: string): string {
  return SanitizationUtils.escapeHtml(text);
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let categoriesCache: KBCategory[] = [];
let articlesCache: KBArticle[] = [];
let kbListenersSetup = false;
let kbArticlesFilterWrapper: HTMLElement & { setOptions?: (opts: { value: string; label: string }[], selectedValue?: string) => void } | null = null;
let kbArticleCategorySelectInstance: FilterSelectInstance | null = null;
let kbCategoryModalInstance: PortalModalInstance | null = null;
let kbArticleModalInstance: PortalModalInstance | null = null;
let kbCategoryModalFocusCleanup: (() => void) | null = null;
let kbArticleModalFocusCleanup: (() => void) | null = null;
let kbSearchQuery: string = '';
let storedKbContext: AdminDashboardContext | null = null;

// ---------------------------------------------------------------------------
// Category modal
// ---------------------------------------------------------------------------

function openCategoryModal(category?: KBCategory): void {
  if (!kbCategoryModalInstance) return;

  const idInput = document.getElementById('kb-category-id') as HTMLInputElement | null;
  const nameInput = document.getElementById('kb-category-name') as HTMLInputElement | null;
  const slugInput = document.getElementById('kb-category-slug') as HTMLInputElement | null;
  const descInput = document.getElementById('kb-category-description') as HTMLTextAreaElement | null;
  const sortInput = document.getElementById('kb-category-sort') as HTMLInputElement | null;

  if (category) {
    kbCategoryModalInstance.setTitle('Edit Category');
    if (idInput) idInput.value = String(category.id);
    if (nameInput) nameInput.value = category.name;
    if (slugInput) slugInput.value = category.slug;
    if (descInput) descInput.value = category.description || '';
    if (sortInput) sortInput.value = String(category.sort_order ?? 0);
  } else {
    kbCategoryModalInstance.setTitle('Add Category');
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (slugInput) slugInput.value = '';
    if (descInput) descInput.value = '';
    if (sortInput) sortInput.value = '0';
  }

  kbCategoryModalInstance.show();
  kbCategoryModalFocusCleanup = manageFocusTrap(kbCategoryModalInstance.overlay, {});
  nameInput?.focus();
}

function closeCategoryModal(): void {
  if (kbCategoryModalInstance) {
    kbCategoryModalInstance.hide();
    kbCategoryModalFocusCleanup?.();
    kbCategoryModalFocusCleanup = null;
  }
}

// ---------------------------------------------------------------------------
// Article modal
// ---------------------------------------------------------------------------

function openArticleModal(categories: KBCategory[], article?: KBArticle): void {
  if (!kbArticleModalInstance) return;

  const idInput = document.getElementById('kb-article-id') as HTMLInputElement | null;
  const titleInput = document.getElementById('kb-article-title') as HTMLInputElement | null;
  const slugInput = document.getElementById('kb-article-slug') as HTMLInputElement | null;
  const summaryInput = document.getElementById('kb-article-summary') as HTMLTextAreaElement | null;
  const contentInput = document.getElementById('kb-article-content') as HTMLTextAreaElement | null;
  const featuredInput = document.getElementById('kb-article-featured') as HTMLInputElement | null;
  const publishedInput = document.getElementById('kb-article-published') as HTMLInputElement | null;

  if (kbArticleCategorySelectInstance) {
    kbArticleCategorySelectInstance.setOptions(
      categories.map((c) => ({ value: String(c.id), label: c.name })),
      article ? String(article.category_id) : categories[0] ? String(categories[0].id) : ''
    );
  }

  if (article) {
    kbArticleModalInstance.setTitle('Edit Article');
    if (idInput) idInput.value = String(article.id);
    if (titleInput) titleInput.value = article.title;
    if (slugInput) slugInput.value = article.slug;
    if (summaryInput) summaryInput.value = article.summary || '';
    if (contentInput) contentInput.value = article.content || '';
    if (featuredInput) featuredInput.checked = !!article.is_featured;
    if (publishedInput) publishedInput.checked = !!article.is_published;
  } else {
    kbArticleModalInstance.setTitle('Add Article');
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (slugInput) slugInput.value = '';
    if (summaryInput) summaryInput.value = '';
    if (contentInput) contentInput.value = '';
    if (featuredInput) featuredInput.checked = false;
    if (publishedInput) publishedInput.checked = true;
  }

  kbArticleModalInstance.show();
  kbArticleModalFocusCleanup = manageFocusTrap(kbArticleModalInstance.overlay, {});
  titleInput?.focus();
}

function closeArticleModal(): void {
  if (kbArticleModalInstance) {
    kbArticleModalInstance.hide();
    kbArticleModalFocusCleanup?.();
    kbArticleModalFocusCleanup = null;
  }
}

// ---------------------------------------------------------------------------
// Form HTML templates
// ---------------------------------------------------------------------------

const CATEGORY_FORM_HTML = `
<form id="kb-category-form" class="modal-body">
  <input type="hidden" id="kb-category-id" />
  <div class="form-group">
    <label for="kb-category-name">Name</label>
    <input type="text" id="kb-category-name" class="form-input" required />
  </div>
  <div class="form-group">
    <label for="kb-category-slug">Slug</label>
    <input type="text" id="kb-category-slug" class="form-input" required />
  </div>
  <div class="form-group">
    <label for="kb-category-description">Description</label>
    <textarea id="kb-category-description" class="form-input" rows="2"></textarea>
  </div>
  <div class="form-group">
    <label for="kb-category-sort">Sort order</label>
    <input type="number" id="kb-category-sort" class="form-input" value="0" min="0" />
  </div>
</form>`;

const ARTICLE_FORM_HTML = `
<form id="kb-article-form" class="modal-body">
  <input type="hidden" id="kb-article-id" />
  <div class="form-group">
    <label for="kb-article-category">Category</label>
    <div id="kb-article-category-mount"></div>
  </div>
  <div class="form-group">
    <label for="kb-article-title">Title</label>
    <input type="text" id="kb-article-title" class="form-input" required />
  </div>
  <div class="form-group">
    <label for="kb-article-slug">Slug</label>
    <input type="text" id="kb-article-slug" class="form-input" required />
  </div>
  <div class="form-group">
    <label for="kb-article-summary">Summary</label>
    <textarea id="kb-article-summary" class="form-input" rows="2"></textarea>
  </div>
  <div class="form-group">
    <label for="kb-article-content">Content</label>
    <textarea id="kb-article-content" class="form-input" rows="8" required></textarea>
  </div>
  <div class="form-group form-group-inline">
    <label><input type="checkbox" id="kb-article-featured" /> Featured</label>
  </div>
  <div class="form-group form-group-inline">
    <label><input type="checkbox" id="kb-article-published" checked /> Published</label>
  </div>
</form>`;

function setupKBListeners(ctx: AdminDashboardContext): void {
  if (kbListenersSetup) return;
  kbListenersSetup = true;

  // Create modals with reusable portal modal component
  if (!kbCategoryModalInstance) {
    kbCategoryModalInstance = createPortalModal({
      id: 'kb-category-modal',
      titleId: 'kb-category-modal-title',
      title: 'Category',
      onClose: closeCategoryModal
    });
    kbCategoryModalInstance.body.innerHTML = CATEGORY_FORM_HTML;
    kbCategoryModalInstance.footer.innerHTML =
      '<button type="button" class="btn btn-secondary" id="kb-category-cancel">CANCEL</button><button type="submit" form="kb-category-form" class="btn btn-primary">SAVE</button>';
    document.body.appendChild(kbCategoryModalInstance.overlay);
  }

  if (!kbArticleModalInstance) {
    kbArticleModalInstance = createPortalModal({
      id: 'kb-article-modal',
      titleId: 'kb-article-modal-title',
      title: 'Article',
      contentClassName: 'kb-article-modal-content',
      onClose: closeArticleModal
    });
    kbArticleModalInstance.body.innerHTML = ARTICLE_FORM_HTML;
    kbArticleModalInstance.footer.innerHTML =
      '<button type="button" class="btn btn-secondary" id="kb-article-cancel">CANCEL</button><button type="submit" form="kb-article-form" class="btn btn-primary">SAVE</button>';
    document.body.appendChild(kbArticleModalInstance.overlay);
  }

  el('kb-add-category')?.addEventListener('click', () => openCategoryModal());
  el('kb-category-modal-close')?.addEventListener('click', closeCategoryModal);
  el('kb-category-cancel')?.addEventListener('click', closeCategoryModal);

  document.getElementById('kb-category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('kb-category-id') as HTMLInputElement | null;
    const nameInput = document.getElementById('kb-category-name') as HTMLInputElement | null;
    const slugInput = document.getElementById('kb-category-slug') as HTMLInputElement | null;
    const descInput = document.getElementById('kb-category-description') as HTMLTextAreaElement | null;
    const sortInput = document.getElementById('kb-category-sort') as HTMLInputElement | null;
    if (!nameInput?.value.trim() || !slugInput?.value.trim()) return;
    try {
      if (idInput?.value) {
        await apiPut(`${KB_API}/admin/categories/${idInput.value}`, {
          name: nameInput.value.trim(),
          slug: slugInput.value.trim(),
          description: descInput?.value.trim() || undefined,
          sort_order: parseInt(sortInput?.value || '0', 10)
        });
        alertSuccess('Category updated.');
      } else {
        await apiPost(`${KB_API}/admin/categories`, {
          name: nameInput.value.trim(),
          slug: slugInput.value.trim(),
          description: descInput?.value.trim() || undefined,
          sort_order: parseInt(sortInput?.value || '0', 10)
        });
        alertSuccess('Category created.');
      }
      closeCategoryModal();
      await loadKnowledgeBase(ctx);
    } catch (err) {
      alertError((err as Error).message);
    }
  });

  el('kb-categories-tbody')?.addEventListener('click', async (e) => {
    const editBtn = (e.target as HTMLElement).closest('.kb-edit-category');
    const deleteBtn = (e.target as HTMLElement).closest('.kb-delete-category');
    if (editBtn) {
      const id = parseInt(editBtn.getAttribute('data-id')!, 10);
      const cat = categoriesCache.find((c) => c.id === id);
      if (cat) openCategoryModal(cat);
    }
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id')!;
      const name = deleteBtn.getAttribute('data-name') || 'this category';
      const ok = await confirmDanger(`Delete category "${name}"? This cannot be undone.`);
      if (!ok) return;
      try {
        await apiDelete(`${KB_API}/admin/categories/${id}`);
        alertSuccess('Category deleted.');
        await loadKnowledgeBase(ctx);
      } catch (err) {
        alertError((err as Error).message);
      }
    }
  });

  el('kb-refresh-categories')?.addEventListener('click', () => loadKnowledgeBase(ctx));

  el('kb-add-article')?.addEventListener('click', () => openArticleModal(categoriesCache));

  const filterMount = el('kb-articles-filter-mount');
  if (filterMount && !kbArticlesFilterWrapper) {
    kbArticlesFilterWrapper = createTableDropdown({
      options: [{ value: '', label: 'All categories' }],
      currentValue: '',
      showStatusDot: false,
      ariaLabelPrefix: 'Filter by category',
      showAllWithCheckmark: true,
      onChange: () => loadKnowledgeBase(ctx)
    }) as HTMLElement & { setOptions?: (opts: { value: string; label: string }[], selectedValue?: string) => void };
    kbArticlesFilterWrapper.id = 'kb-articles-filter';
    filterMount.appendChild(kbArticlesFilterWrapper);
  }

  // Setup search bar
  const searchMount = el('kb-search-mount');
  if (searchMount && !searchMount.querySelector('.search-bar')) {
    const { wrapper } = createSearchBar({
      placeholder: 'Search articles...',
      ariaLabel: 'Search knowledge base articles',
      onInput: (value) => {
        kbSearchQuery = value.toLowerCase();
        refreshFilteredArticles(ctx);
      }
    });
    searchMount.appendChild(wrapper);
  }

  // Setup export button
  const exportBtn = el('kb-export');
  if (exportBtn && !exportBtn.dataset.listenerAdded) {
    exportBtn.dataset.listenerAdded = 'true';
    exportBtn.addEventListener('click', () => {
      const filtered = getFilteredArticles();
      if (filtered.length === 0) {
        alertError('No articles to export');
        return;
      }
      exportToCsv(filtered as unknown as Record<string, unknown>[], KNOWLEDGE_BASE_EXPORT_CONFIG);
      alertSuccess(`Exported ${filtered.length} articles to CSV`);
    });
  }

  const articleCategoryMount = el('kb-article-category-mount');
  if (articleCategoryMount && !kbArticleCategorySelectInstance) {
    kbArticleCategorySelectInstance = createFilterSelect({
      id: 'kb-article-category',
      ariaLabel: 'Category',
      emptyOption: 'Select category',
      options: [],
      value: '',
      className: 'form-input',
      required: true
    });
    articleCategoryMount.appendChild(kbArticleCategorySelectInstance.element);
  }

  el('kb-refresh-articles')?.addEventListener('click', () => loadKnowledgeBase(ctx));

  el('kb-article-modal-close')?.addEventListener('click', closeArticleModal);
  el('kb-article-cancel')?.addEventListener('click', closeArticleModal);

  document.getElementById('kb-article-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('kb-article-id') as HTMLInputElement | null;
    const catSelect = document.getElementById('kb-article-category') as HTMLSelectElement | null;
    const titleInput = document.getElementById('kb-article-title') as HTMLInputElement | null;
    const slugInput = document.getElementById('kb-article-slug') as HTMLInputElement | null;
    const summaryInput = document.getElementById('kb-article-summary') as HTMLTextAreaElement | null;
    const contentInput = document.getElementById('kb-article-content') as HTMLTextAreaElement | null;
    const featuredInput = document.getElementById('kb-article-featured') as HTMLInputElement | null;
    const publishedInput = document.getElementById('kb-article-published') as HTMLInputElement | null;
    if (!catSelect?.value || !titleInput?.value.trim() || !slugInput?.value.trim() || !contentInput?.value.trim()) return;
    const payload = {
      category_id: parseInt(catSelect.value, 10),
      title: titleInput.value.trim(),
      slug: slugInput.value.trim(),
      summary: summaryInput?.value.trim() || undefined,
      content: contentInput.value.trim(),
      is_featured: featuredInput?.checked ?? false,
      is_published: publishedInput?.checked ?? true
    };
    try {
      if (idInput?.value) {
        await apiPut(`${KB_API}/admin/articles/${idInput.value}`, payload);
        alertSuccess('Article updated.');
      } else {
        await apiPost(`${KB_API}/admin/articles`, payload);
        alertSuccess('Article created.');
      }
      closeArticleModal();
      await loadKnowledgeBase(ctx);
    } catch (err) {
      alertError((err as Error).message);
    }
  });

  el('kb-articles-tbody')?.addEventListener('click', async (e) => {
    const editBtn = (e.target as HTMLElement).closest('.kb-edit-article');
    const deleteBtn = (e.target as HTMLElement).closest('.kb-delete-article');
    if (editBtn) {
      const id = parseInt(editBtn.getAttribute('data-id')!, 10);
      try {
        const res = await apiFetch(`${KB_API}/admin/articles/${id}`);
        if (!res.ok) throw new Error('Failed to load article');
        const data = await parseJsonResponse<{ article: KBArticle }>(res);
        openArticleModal(categoriesCache, data.article);
      } catch (err) {
        ctx.showNotification((err as Error).message, 'error');
      }
    }
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id')!;
      const title = deleteBtn.getAttribute('data-title') || 'this article';
      const ok = await confirmDanger(`Delete article "${title}"? This cannot be undone.`);
      if (!ok) return;
      try {
        await apiDelete(`${KB_API}/admin/articles/${id}`);
        alertSuccess('Article deleted.');
        await loadKnowledgeBase(ctx);
      } catch (err) {
        alertError((err as Error).message);
      }
    }
  });
}

export async function loadKnowledgeBase(ctx: AdminDashboardContext): Promise<void> {
  storedKbContext = ctx;
  setupKBListeners(ctx);

  const categoriesTbody = el('kb-categories-tbody');
  const articlesTbody = el('kb-articles-tbody');
  const filterEl = el('kb-articles-filter');
  const filterValueFromWrapper = (filterEl && 'dataset' in filterEl && filterEl.dataset?.status) ?? '';

  if (categoriesTbody) showTableLoading(categoriesTbody, CATEGORIES_COLSPAN, 'Loading categories...');
  if (articlesTbody) showTableLoading(articlesTbody, ARTICLES_COLSPAN, 'Loading articles...');

  try {
    const categories = await loadCategories(ctx);
    categoriesCache = categories;
    renderCategoriesTable(categories, ctx);

    const filterSlug = filterValueFromWrapper || '';
    const articles = await loadArticles(ctx, filterSlug || undefined);
    articlesCache = articles;
    renderArticlesTable(articles, ctx);

    const options = [{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))];
    kbArticlesFilterWrapper?.setOptions?.(options, filterSlug || '');
  } catch (err) {
    if (categoriesTbody) showTableEmpty(categoriesTbody, CATEGORIES_COLSPAN, 'Failed to load categories.');
    if (articlesTbody) showTableEmpty(articlesTbody, ARTICLES_COLSPAN, 'Failed to load articles.');
    ctx.showNotification((err as Error).message, 'error');
  }
}

/**
 * Get articles filtered by search query
 */
function getFilteredArticles(): KBArticle[] {
  if (!kbSearchQuery) {
    return articlesCache;
  }

  return articlesCache.filter(a => {
    const title = a.title?.toLowerCase() || '';
    const category = a.category_name?.toLowerCase() || '';
    const slug = a.slug?.toLowerCase() || '';
    const summary = a.summary?.toLowerCase() || '';

    return (
      title.includes(kbSearchQuery) ||
      category.includes(kbSearchQuery) ||
      slug.includes(kbSearchQuery) ||
      summary.includes(kbSearchQuery)
    );
  });
}

/**
 * Refresh the articles table with search applied
 */
function refreshFilteredArticles(ctx: AdminDashboardContext): void {
  const filtered = getFilteredArticles();
  renderArticlesTable(filtered, ctx);
}
