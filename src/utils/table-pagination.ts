/**
 * ===============================================
 * TABLE PAGINATION UTILITY
 * ===============================================
 * @file src/utils/table-pagination.ts
 *
 * Client-side pagination for admin tables.
 * Provides reusable pagination controls and data slicing.
 * Uses the reusable table dropdown for "Per page" (not native select).
 */

import { ICONS } from '../constants/icons';
import { createTableDropdown } from './table-dropdown';

// ===============================================
// TYPES
// ===============================================

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export interface PaginationConfig {
  tableId: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  storageKey?: string;
}

// ===============================================
// DEFAULT STATE
// ===============================================

export function getDefaultPaginationState(config?: PaginationConfig): PaginationState {
  return {
    currentPage: 1,
    pageSize: config?.defaultPageSize || 25,
    totalItems: 0
  };
}

// ===============================================
// LOCALSTORAGE PERSISTENCE
// ===============================================

export function loadPaginationState(storageKey: string): Partial<PaginationState> {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { pageSize: parsed.pageSize || 25 };
    }
  } catch (e) {
    console.warn('[TablePagination] Failed to load pagination state:', e);
  }
  return {};
}

export function savePaginationState(storageKey: string, state: PaginationState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ pageSize: state.pageSize }));
  } catch (e) {
    console.warn('[TablePagination] Failed to save pagination state:', e);
  }
}

// ===============================================
// PAGINATION CALCULATIONS
// ===============================================

/**
 * Calculate total number of pages
 */
export function getTotalPages(state: PaginationState): number {
  return Math.ceil(state.totalItems / state.pageSize) || 1;
}

/**
 * Get slice indices for current page
 */
export function getPageSlice(state: PaginationState): { start: number; end: number } {
  const start = (state.currentPage - 1) * state.pageSize;
  const end = start + state.pageSize;
  return { start, end };
}

/**
 * Apply pagination to data array
 */
export function applyPagination<T>(data: T[], state: PaginationState): T[] {
  const { start, end } = getPageSlice(state);
  return data.slice(start, end);
}

/**
 * Get visible page numbers for pagination controls
 * Returns array of page numbers with -1 representing ellipsis
 */
export function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const delta = 2; // Pages to show on each side of current
  const range: number[] = [];

  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  const pages: number[] = [];

  // Always show first page
  pages.push(1);

  // Add ellipsis if there's a gap after first page
  if (range.length > 0 && range[0] > 2) {
    pages.push(-1); // -1 represents ellipsis
  }

  // Add the middle range
  pages.push(...range);

  // Add ellipsis if there's a gap before last page
  if (range.length > 0 && range[range.length - 1] < totalPages - 1) {
    pages.push(-1); // -1 represents ellipsis
  }

  // Always show last page (if more than 1 page)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

// ===============================================
// UI CREATION
// ===============================================

/**
 * Create pagination controls UI
 */
export function createPaginationUI(
  config: PaginationConfig,
  state: PaginationState,
  onStateChange: (newState: PaginationState) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'pagination-inner';

  const pageSizeOptions = config.pageSizeOptions || [10, 25, 50, 100];
  const totalPages = getTotalPages(state);

  // Calculate item range for display
  const startItem = state.totalItems === 0 ? 0 : (state.currentPage - 1) * state.pageSize + 1;
  const endItem = Math.min(state.currentPage * state.pageSize, state.totalItems);

  container.innerHTML = `
    <div class="pagination-info">
      <span class="pagination-range">
        Showing <strong>${startItem}</strong>-<strong>${endItem}</strong> of <strong>${state.totalItems}</strong>
      </span>
    </div>
    <div class="pagination-controls">
      <div class="pagination-size">
        <label id="${config.tableId}-page-size-label">Per page:</label>
        <div class="pagination-page-size-dropdown" id="${config.tableId}-page-size" aria-labelledby="${config.tableId}-page-size-label"></div>
      </div>
      <div class="pagination-nav">
        <button type="button" class="pagination-btn pagination-first" ${state.currentPage === 1 ? 'disabled' : ''} title="First page" aria-label="Go to first page">
          ${ICONS.CHEVRONS_LEFT}
        </button>
        <button type="button" class="pagination-btn pagination-prev" ${state.currentPage === 1 ? 'disabled' : ''} title="Previous page" aria-label="Go to previous page">
          ${ICONS.CHEVRON_LEFT}
        </button>
        <div class="pagination-pages">
          ${renderPageButtons(state.currentPage, totalPages)}
        </div>
        <button type="button" class="pagination-btn pagination-next" ${state.currentPage === totalPages ? 'disabled' : ''} title="Next page" aria-label="Go to next page">
          ${ICONS.CHEVRON_RIGHT}
        </button>
        <button type="button" class="pagination-btn pagination-last" ${state.currentPage === totalPages ? 'disabled' : ''} title="Last page" aria-label="Go to last page">
          ${ICONS.CHEVRONS_RIGHT}
        </button>
      </div>
    </div>
  `;

  // Per-page dropdown (reusable table dropdown, no status dot)
  const pageSizeDropdownContainer = container.querySelector(`#${config.tableId}-page-size`) as HTMLElement;
  if (pageSizeDropdownContainer) {
    const pageSizeOptionsForDropdown = pageSizeOptions.map(size => ({
      value: String(size),
      label: String(size)
    }));
    const pageSizeDropdown = createTableDropdown({
      options: pageSizeOptionsForDropdown,
      currentValue: String(state.pageSize),
      showStatusDot: false,
      ariaLabelPrefix: 'Per page',
      onChange: (value: string) => {
        const newPageSize = parseInt(value, 10);
        const newTotalPages = Math.ceil(state.totalItems / newPageSize) || 1;
        const newPage = Math.min(state.currentPage, newTotalPages);

        const newState: PaginationState = {
          ...state,
          pageSize: newPageSize,
          currentPage: newPage
        };

        if (config.storageKey) {
          savePaginationState(config.storageKey, newState);
        }

        onStateChange(newState);
      }
    });
    pageSizeDropdownContainer.appendChild(pageSizeDropdown);
  }

  // Event handlers
  const firstBtn = container.querySelector('.pagination-first') as HTMLButtonElement;
  const prevBtn = container.querySelector('.pagination-prev') as HTMLButtonElement;
  const nextBtn = container.querySelector('.pagination-next') as HTMLButtonElement;
  const lastBtn = container.querySelector('.pagination-last') as HTMLButtonElement;
  const pagesContainer = container.querySelector('.pagination-pages') as HTMLElement;

  // Navigation buttons
  firstBtn?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      onStateChange({ ...state, currentPage: 1 });
    }
  });

  prevBtn?.addEventListener('click', () => {
    if (state.currentPage > 1) {
      onStateChange({ ...state, currentPage: state.currentPage - 1 });
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (state.currentPage < totalPages) {
      onStateChange({ ...state, currentPage: state.currentPage + 1 });
    }
  });

  lastBtn?.addEventListener('click', () => {
    if (state.currentPage < totalPages) {
      onStateChange({ ...state, currentPage: totalPages });
    }
  });

  // Page number clicks
  pagesContainer?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.pagination-page-btn') as HTMLButtonElement;
    if (btn && !btn.disabled) {
      const page = parseInt(btn.dataset.page || '1');
      if (page !== state.currentPage) {
        onStateChange({ ...state, currentPage: page });
      }
    }
  });

  return container;
}

/**
 * Render page number buttons
 */
function renderPageButtons(currentPage: number, totalPages: number): string {
  const pages = getVisiblePages(currentPage, totalPages);

  return pages.map(page => {
    if (page === -1) {
      return '<span class="pagination-ellipsis">...</span>';
    }
    const isCurrent = page === currentPage;
    return `
      <button type="button"
        class="pagination-page-btn ${isCurrent ? 'active' : ''}"
        data-page="${page}"
        ${isCurrent ? 'aria-current="page"' : ''}
        aria-label="Page ${page}">
        ${page}
      </button>
    `;
  }).join('');
}

/**
 * Update existing pagination UI with new state
 */
export function updatePaginationUI(
  containerId: string,
  state: PaginationState
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = getTotalPages(state);

  // Update range display
  const startItem = state.totalItems === 0 ? 0 : (state.currentPage - 1) * state.pageSize + 1;
  const endItem = Math.min(state.currentPage * state.pageSize, state.totalItems);

  const rangeEl = container.querySelector('.pagination-range');
  if (rangeEl) {
    rangeEl.innerHTML = `Showing <strong>${startItem}</strong>-<strong>${endItem}</strong> of <strong>${state.totalItems}</strong>`;
  }

  // Update button states
  const firstBtn = container.querySelector('.pagination-first') as HTMLButtonElement;
  const prevBtn = container.querySelector('.pagination-prev') as HTMLButtonElement;
  const nextBtn = container.querySelector('.pagination-next') as HTMLButtonElement;
  const lastBtn = container.querySelector('.pagination-last') as HTMLButtonElement;

  if (firstBtn) firstBtn.disabled = state.currentPage === 1;
  if (prevBtn) prevBtn.disabled = state.currentPage === 1;
  if (nextBtn) nextBtn.disabled = state.currentPage === totalPages;
  if (lastBtn) lastBtn.disabled = state.currentPage === totalPages;

  // Update page buttons
  const pagesContainer = container.querySelector('.pagination-pages');
  if (pagesContainer) {
    pagesContainer.innerHTML = renderPageButtons(state.currentPage, totalPages);
  }
}
