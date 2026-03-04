/**
 * ===============================================
 * TABLE PAGINATOR
 * ===============================================
 * @file src/features/shared/table-manager/TablePaginator.ts
 *
 * Handles pagination: shows/hides rows based on page window,
 * renders page info, persists page size to localStorage.
 */

import { SELECTORS, DEFAULT_PAGE_SIZE, STORAGE_KEY_PREFIX, ANIMATION } from './constants';
import type { PaginationState, RowData } from './types';

export class TablePaginator {
  private rootEl: HTMLElement;
  private tableId: string;
  private state: PaginationState;
  private visibleRows: RowData[];
  private onPageChange: ((state: PaginationState) => void) | null = null;

  constructor(rootEl: HTMLElement, tableId: string, rows: RowData[], configPageSize?: number) {
    this.rootEl = rootEl;
    this.tableId = tableId;
    this.visibleRows = rows;

    const pageSize = this.loadPageSize() || configPageSize || DEFAULT_PAGE_SIZE;
    this.state = {
      currentPage: 1,
      pageSize,
      totalRows: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / pageSize))
    };
  }

  /** Initialize pagination controls */
  init(): void {
    const prevBtn = this.rootEl.querySelector<HTMLButtonElement>(SELECTORS.PAGE_PREV);
    const nextBtn = this.rootEl.querySelector<HTMLButtonElement>(SELECTORS.PAGE_NEXT);

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.goToPage(this.state.currentPage - 1));
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.goToPage(this.state.currentPage + 1));
    }

    // Apply initial page
    this.applyPage();
  }

  /** Set callback for page changes */
  setOnPageChange(cb: (state: PaginationState) => void): void {
    this.onPageChange = cb;
  }

  /** Navigate to a specific page */
  goToPage(page: number): void {
    const clampedPage = Math.max(1, Math.min(page, this.state.totalPages));
    if (clampedPage === this.state.currentPage) return;

    this.state.currentPage = clampedPage;
    this.applyPage();

    if (this.onPageChange) {
      this.onPageChange({ ...this.state });
    }
  }

  /** Apply current page: show/hide rows and update controls */
  private applyPage(): void {
    const { currentPage, pageSize, totalRows, totalPages } = this.state;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalRows);

    // Build set of visible row IDs for this page
    const pageRowIds = new Set<string>();
    for (let i = startIndex; i < endIndex; i++) {
      if (this.visibleRows[i]) {
        pageRowIds.add(String(this.visibleRows[i].id));
      }
    }

    // Show/hide rows
    const tbody = this.rootEl.querySelector('tbody');
    if (tbody) {
      const trs = tbody.querySelectorAll<HTMLElement>('[data-row-id]');
      const animateRows: HTMLElement[] = [];

      trs.forEach((tr) => {
        const rowId = tr.getAttribute('data-row-id');
        if (rowId && pageRowIds.has(rowId)) {
          tr.style.display = '';
          animateRows.push(tr);
        } else {
          tr.style.display = 'none';
        }
      });

      // GSAP crossfade for page transition
      if (typeof gsap !== 'undefined' && animateRows.length > 0) {
        gsap.fromTo(
          animateRows,
          { opacity: 0.5 },
          {
            opacity: 1,
            duration: ANIMATION.PAGE_CROSSFADE,
            ease: 'power1.out',
            overwrite: true
          }
        );
      }
    }

    // Update pagination info text
    this.updatePaginationUI(startIndex + 1, endIndex, totalRows, currentPage, totalPages);
  }

  /** Update pagination control text and button states */
  private updatePaginationUI(
    start: number,
    end: number,
    total: number,
    currentPage: number,
    totalPages: number
  ): void {
    const showingEl = this.rootEl.querySelector<HTMLElement>(SELECTORS.PAGINATION_SHOWING);
    if (showingEl) {
      showingEl.textContent = `Showing ${start}-${end} of ${total}`;
    }

    const pageInfoEl = this.rootEl.querySelector<HTMLElement>(SELECTORS.PAGE_INFO);
    if (pageInfoEl) {
      pageInfoEl.textContent = `Page ${currentPage}`;
    }

    const prevBtn = this.rootEl.querySelector<HTMLButtonElement>(SELECTORS.PAGE_PREV);
    const nextBtn = this.rootEl.querySelector<HTMLButtonElement>(SELECTORS.PAGE_NEXT);

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  /** Update rows after filter/sort changes */
  updateRows(rows: RowData[]): void {
    this.visibleRows = rows;
    this.state.totalRows = rows.length;
    this.state.totalPages = Math.max(1, Math.ceil(rows.length / this.state.pageSize));

    // Reset to page 1 if current page is beyond range
    if (this.state.currentPage > this.state.totalPages) {
      this.state.currentPage = 1;
    }

    this.applyPage();
  }

  /** Get current pagination state */
  getState(): PaginationState {
    return { ...this.state };
  }

  /** Get rows for current page */
  getPageRows(): RowData[] {
    const { currentPage, pageSize } = this.state;
    const start = (currentPage - 1) * pageSize;
    return this.visibleRows.slice(start, start + pageSize);
  }

  /** Load page size from localStorage */
  private loadPageSize(): number | null {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}-${this.tableId}-pageSize`);
      if (stored) {
        const size = parseInt(stored, 10);
        if (!isNaN(size) && size > 0) return size;
      }
    } catch {
      // localStorage unavailable
    }
    return null;
  }

  /** Save page size to localStorage */
  private savePageSize(size: number): void {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}-${this.tableId}-pageSize`, String(size));
    } catch {
      // localStorage unavailable
    }
  }

  /** Change page size */
  setPageSize(size: number): void {
    this.state.pageSize = size;
    this.state.totalPages = Math.max(1, Math.ceil(this.state.totalRows / size));
    this.state.currentPage = 1;
    this.savePageSize(size);
    this.applyPage();
  }

  /** Clean up */
  destroy(): void {
    this.onPageChange = null;
  }
}
