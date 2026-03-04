/**
 * ===============================================
 * TABLE SORTER
 * ===============================================
 * @file src/features/shared/table-manager/TableSorter.ts
 *
 * Handles column header sorting. Sorts in-memory row array,
 * reorders DOM <tr> elements, and updates sort indicators.
 */

import { SELECTORS, CLASSES, DATA_ATTRS, ANIMATION } from './constants';
import type { SortState, RowData, ColumnDef } from './types';

export class TableSorter {
  private rootEl: HTMLElement;
  private sortState: SortState | null;
  private rows: RowData[];
  private columns: ColumnDef[];
  private onSortChange: ((state: SortState, sortedRows: RowData[]) => void) | null;

  constructor(
    rootEl: HTMLElement,
    rows: RowData[],
    columns: ColumnDef[],
    defaultSort?: { column: string; direction: 'asc' | 'desc' }
  ) {
    this.rootEl = rootEl;
    this.rows = rows;
    this.columns = columns;
    this.sortState = defaultSort ? { ...defaultSort } : null;
    this.onSortChange = null;
  }

  /** Initialize sort header click handlers */
  init(): void {
    const headers = this.rootEl.querySelectorAll<HTMLElement>(SELECTORS.SORT_BUTTON);

    headers.forEach((header) => {
      header.addEventListener('click', () => {
        const key = header.getAttribute(DATA_ATTRS.SORT_KEY);
        if (!key) return;
        this.toggleSort(key);
      });

      // Keyboard support for sort buttons
      header.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const key = header.getAttribute(DATA_ATTRS.SORT_KEY);
          if (!key) return;
          this.toggleSort(key);
        }
      });
    });

    // Apply initial sort indicators (don't reorder — server already sorted)
    if (this.sortState) {
      this.updateSortIndicators(this.sortState.column, this.sortState.direction);
    }
  }

  /** Set callback for sort changes */
  setOnSortChange(cb: (state: SortState, sortedRows: RowData[]) => void): void {
    this.onSortChange = cb;
  }

  /** Toggle sort on a column */
  private toggleSort(column: string): void {
    let direction: 'asc' | 'desc' = 'asc';

    if (this.sortState?.column === column) {
      // Toggle direction if same column
      direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    }

    this.sortState = { column, direction };
    this.sortRows();
    this.updateSortIndicators(column, direction);
    this.reorderDomRows();

    if (this.onSortChange) {
      this.onSortChange(this.sortState, this.rows);
    }
  }

  /** Sort the in-memory row array */
  private sortRows(): void {
    if (!this.sortState) return;

    const { column, direction } = this.sortState;
    const colDef = this.columns.find((c) => c.id === column);
    const multiplier = direction === 'asc' ? 1 : -1;

    this.rows.sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];

      // Null/undefined sort to end
      if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Type-specific comparisons
      if (colDef?.type === 'currency' || colDef?.type === 'count') {
        return multiplier * (Number(aVal) - Number(bVal));
      }

      if (colDef?.type === 'date') {
        const aDate = new Date(String(aVal)).getTime();
        const bDate = new Date(String(bVal)).getTime();
        if (isNaN(aDate) && isNaN(bDate)) return 0;
        if (isNaN(aDate)) return 1;
        if (isNaN(bDate)) return -1;
        return multiplier * (aDate - bDate);
      }

      if (colDef?.type === 'boolean') {
        return multiplier * (Number(aVal) - Number(bVal));
      }

      // Default: string comparison
      return multiplier * String(aVal).localeCompare(String(bVal));
    });
  }

  /** Update sort indicator classes on column headers */
  private updateSortIndicators(activeColumn: string, direction: 'asc' | 'desc'): void {
    const headers = this.rootEl.querySelectorAll<HTMLElement>(SELECTORS.SORT_BUTTON);

    headers.forEach((header) => {
      const key = header.getAttribute(DATA_ATTRS.SORT_KEY);
      header.classList.remove(CLASSES.SORT_ASC, CLASSES.SORT_DESC);

      if (key === activeColumn) {
        header.classList.add(direction === 'asc' ? CLASSES.SORT_ASC : CLASSES.SORT_DESC);
        header.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
      } else {
        header.setAttribute('aria-sort', 'none');
      }
    });
  }

  /** Reorder DOM <tr> elements to match sorted array */
  private reorderDomRows(): void {
    const tbody = this.rootEl.querySelector('tbody');
    if (!tbody) return;

    const trMap = new Map<string, HTMLElement>();
    tbody.querySelectorAll<HTMLElement>(SELECTORS.ROW).forEach((tr) => {
      const rowId = tr.getAttribute(DATA_ATTRS.ROW_ID);
      if (rowId) trMap.set(rowId, tr);
    });

    // Use GSAP Flip if available, otherwise just reorder
    const fragment = document.createDocumentFragment();
    this.rows.forEach((row) => {
      const tr = trMap.get(String(row.id));
      if (tr) fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);

    // Subtle GSAP animation for reorder
    if (typeof gsap !== 'undefined') {
      const trs = tbody.querySelectorAll<HTMLElement>(SELECTORS.ROW);
      gsap.fromTo(
        trs,
        { opacity: 0.7 },
        {
          opacity: 1,
          duration: ANIMATION.SORT_REORDER,
          stagger: ANIMATION.ROW_STAGGER,
          ease: 'power2.out',
          overwrite: true
        }
      );
    }
  }

  /** Get current sort state */
  getSortState(): SortState | null {
    return this.sortState;
  }

  /** Get the sorted rows array */
  getSortedRows(): RowData[] {
    return this.rows;
  }

  /** Update the rows reference (called after filter changes) */
  updateRows(rows: RowData[]): void {
    this.rows = rows;
    if (this.sortState) {
      this.sortRows();
    }
  }

  /** Clean up event listeners */
  destroy(): void {
    // Event listeners are on DOM elements that will be removed when table unmounts
    this.onSortChange = null;
  }
}
