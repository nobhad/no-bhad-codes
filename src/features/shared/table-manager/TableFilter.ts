/**
 * ===============================================
 * TABLE FILTER
 * ===============================================
 * @file src/features/shared/table-manager/TableFilter.ts
 *
 * Handles search input and filter dropdown changes.
 * Filters in-memory rows and hides non-matching DOM rows.
 */

import { SELECTORS, CLASSES, DATA_ATTRS, SEARCH_DEBOUNCE_MS } from './constants';
import type { RowData, ColumnDef } from './types';

export class TableFilter {
  private rootEl: HTMLElement;
  private allRows: RowData[];
  private columns: ColumnDef[];
  private searchTerm: string = '';
  private activeFilters: Record<string, string> = {};
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private onFilterChange: ((filteredRows: RowData[]) => void) | null = null;

  constructor(rootEl: HTMLElement, rows: RowData[], columns: ColumnDef[]) {
    this.rootEl = rootEl;
    this.allRows = rows;
    this.columns = columns;
  }

  /** Initialize search and filter event listeners */
  init(): void {
    // Search input
    const searchInput = this.rootEl.querySelector<HTMLInputElement>(SELECTORS.SEARCH_INPUT);
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        this.handleSearchInput(target.value);
      });
    }

    // Filter dropdowns
    const filterSelects = this.rootEl.querySelectorAll<HTMLSelectElement>(SELECTORS.FILTER_SELECT);
    filterSelects.forEach((select) => {
      select.addEventListener('change', () => {
        const filterId = select.getAttribute(DATA_ATTRS.FILTER);
        if (filterId) {
          this.setFilter(filterId, select.value);
        }
      });
    });
  }

  /** Set callback for when filtered results change */
  setOnFilterChange(cb: (filteredRows: RowData[]) => void): void {
    this.onFilterChange = cb;
  }

  /** Handle search input with debounce */
  private handleSearchInput(value: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.searchTerm = value.toLowerCase().trim();
      this.applyFilters();
    }, SEARCH_DEBOUNCE_MS);
  }

  /** Set a filter value */
  private setFilter(filterId: string, value: string): void {
    if (value === 'all' || !value) {
      delete this.activeFilters[filterId];
    } else {
      this.activeFilters[filterId] = value;
    }
    this.applyFilters();
  }

  /** Apply all active filters and search to rows */
  private applyFilters(): void {
    const filtered = this.allRows.filter((row) => {
      // Check search term
      if (this.searchTerm && !this.matchesSearch(row)) {
        return false;
      }

      // Check filter dropdowns
      for (const [filterId, filterValue] of Object.entries(this.activeFilters)) {
        const rowValue = String(row[filterId] ?? '').toLowerCase();
        if (rowValue !== filterValue.toLowerCase()) {
          return false;
        }
      }

      return true;
    });

    // Update DOM visibility
    this.updateDomVisibility(filtered);

    // Notify listeners
    if (this.onFilterChange) {
      this.onFilterChange(filtered);
    }
  }

  /** Check if a row matches the current search term */
  private matchesSearch(row: RowData): boolean {
    if (!this.searchTerm) return true;

    // Search across all visible (non-special) columns
    return this.columns.some((col) => {
      if (col.id.startsWith('_')) return false;
      const value = row[col.id];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(this.searchTerm);
    });
  }

  /** Update DOM row visibility based on filtered results */
  private updateDomVisibility(filteredRows: RowData[]): void {
    const filteredIds = new Set(filteredRows.map((r) => String(r.id)));

    this.rootEl.querySelectorAll<HTMLElement>(SELECTORS.ROW).forEach((tr) => {
      const rowId = tr.getAttribute(DATA_ATTRS.ROW_ID);
      if (rowId && !filteredIds.has(rowId)) {
        tr.classList.add(CLASSES.ROW_HIDDEN);
        tr.style.display = 'none';
      } else {
        tr.classList.remove(CLASSES.ROW_HIDDEN);
        tr.style.display = '';
      }
    });
  }

  /** Get currently filtered rows */
  getFilteredRows(): RowData[] {
    return this.allRows.filter((row) => {
      if (this.searchTerm && !this.matchesSearch(row)) return false;
      for (const [filterId, filterValue] of Object.entries(this.activeFilters)) {
        if (String(row[filterId] ?? '').toLowerCase() !== filterValue.toLowerCase()) return false;
      }
      return true;
    });
  }

  /** Update the rows reference (called when data refreshes) */
  updateRows(rows: RowData[]): void {
    this.allRows = rows;
    this.applyFilters();
  }

  /** Reset all filters and search */
  reset(): void {
    this.searchTerm = '';
    this.activeFilters = {};

    const searchInput = this.rootEl.querySelector<HTMLInputElement>(SELECTORS.SEARCH_INPUT);
    if (searchInput) searchInput.value = '';

    const filterSelects = this.rootEl.querySelectorAll<HTMLSelectElement>(SELECTORS.FILTER_SELECT);
    filterSelects.forEach((select) => {
      select.selectedIndex = 0;
    });

    this.applyFilters();
  }

  /** Clean up */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.onFilterChange = null;
  }
}
