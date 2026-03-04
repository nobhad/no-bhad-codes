/**
 * ===============================================
 * TABLE SELECTOR
 * ===============================================
 * @file src/features/shared/table-manager/TableSelector.ts
 *
 * Manages row checkbox selection, select-all, and bulk actions toolbar.
 */

import { SELECTORS, CLASSES, DATA_ATTRS, ANIMATION } from './constants';
import type { RowData } from './types';

export class TableSelector {
  private rootEl: HTMLElement;
  private selectedIds: Set<string> = new Set();
  private visibleRows: RowData[];
  private onSelectionChange: ((selectedIds: Set<string>) => void) | null = null;

  constructor(rootEl: HTMLElement, rows: RowData[]) {
    this.rootEl = rootEl;
    this.visibleRows = rows;
  }

  /** Initialize checkbox event listeners */
  init(): void {
    // Select-all checkbox
    const selectAll = this.rootEl.querySelector<HTMLInputElement>(SELECTORS.SELECT_ALL);
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        this.toggleSelectAll(selectAll.checked);
      });
    }

    // Individual row checkboxes (use delegation on tbody)
    const tbody = this.rootEl.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.matches(SELECTORS.ROW_CHECKBOX)) {
          const rowId = target.getAttribute(DATA_ATTRS.ROW_ID);
          if (rowId) {
            this.toggleRow(rowId, target.checked);
          }
        }
      });
    }
  }

  /** Set callback for selection changes */
  setOnSelectionChange(cb: (selectedIds: Set<string>) => void): void {
    this.onSelectionChange = cb;
  }

  /** Toggle select-all */
  private toggleSelectAll(checked: boolean): void {
    this.selectedIds.clear();

    if (checked) {
      // Select all visible rows
      this.visibleRows.forEach((row) => {
        this.selectedIds.add(String(row.id));
      });
    }

    // Update all visible checkboxes
    this.rootEl.querySelectorAll<HTMLInputElement>(SELECTORS.ROW_CHECKBOX).forEach((cb) => {
      const rowId = cb.getAttribute(DATA_ATTRS.ROW_ID);
      const tr = cb.closest('tr');
      // Only toggle if the row is visible
      if (tr && tr.style.display !== 'none') {
        cb.checked = checked;
        if (rowId) {
          tr.classList.toggle(CLASSES.ROW_SELECTED, checked);
        }
      }
    });

    this.updateBulkToolbar();
    this.notifyChange();
  }

  /** Toggle a single row */
  private toggleRow(rowId: string, checked: boolean): void {
    if (checked) {
      this.selectedIds.add(rowId);
    } else {
      this.selectedIds.delete(rowId);
    }

    // Update row visual state
    const tr = this.rootEl.querySelector<HTMLElement>(`tr[${DATA_ATTRS.ROW_ID}="${rowId}"]`);
    if (tr) {
      tr.classList.toggle(CLASSES.ROW_SELECTED, checked);
    }

    // Update select-all checkbox state
    this.updateSelectAllState();
    this.updateBulkToolbar();
    this.notifyChange();
  }

  /** Update select-all checkbox (checked, indeterminate, or unchecked) */
  private updateSelectAllState(): void {
    const selectAll = this.rootEl.querySelector<HTMLInputElement>(SELECTORS.SELECT_ALL);
    if (!selectAll) return;

    const visibleCount = this.visibleRows.length;
    const selectedCount = this.selectedIds.size;

    if (selectedCount === 0) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    } else if (selectedCount >= visibleCount) {
      selectAll.checked = true;
      selectAll.indeterminate = false;
    } else {
      selectAll.checked = false;
      selectAll.indeterminate = true;
    }
  }

  /** Show/hide bulk actions toolbar */
  private updateBulkToolbar(): void {
    const toolbar = this.rootEl.querySelector<HTMLElement>(SELECTORS.BULK_TOOLBAR);
    if (!toolbar) return;

    const count = this.selectedIds.size;
    const shouldShow = count > 0;
    const isVisible = toolbar.style.display !== 'none';

    if (shouldShow === isVisible) {
      // Just update count
      const countEl = toolbar.querySelector<HTMLElement>(SELECTORS.BULK_COUNT);
      if (countEl) countEl.textContent = `${count} selected`;
      return;
    }

    if (shouldShow) {
      toolbar.style.display = '';
      const countEl = toolbar.querySelector<HTMLElement>(SELECTORS.BULK_COUNT);
      if (countEl) countEl.textContent = `${count} selected`;

      if (typeof gsap !== 'undefined') {
        gsap.fromTo(toolbar,
          { opacity: 0, y: -8 },
          { opacity: 1, y: 0, duration: ANIMATION.TOOLBAR_TOGGLE, ease: 'power2.out' }
        );
      }
    } else {
      if (typeof gsap !== 'undefined') {
        gsap.to(toolbar, {
          opacity: 0,
          y: -8,
          duration: ANIMATION.TOOLBAR_TOGGLE,
          ease: 'power2.in',
          onComplete: () => { toolbar.style.display = 'none'; }
        });
      } else {
        toolbar.style.display = 'none';
      }
    }
  }

  /** Notify listeners of selection change */
  private notifyChange(): void {
    if (this.onSelectionChange) {
      this.onSelectionChange(new Set(this.selectedIds));
    }
  }

  /** Get currently selected IDs */
  getSelectedIds(): Set<string> {
    return new Set(this.selectedIds);
  }

  /** Clear all selections */
  clearSelection(): void {
    this.selectedIds.clear();

    this.rootEl.querySelectorAll<HTMLInputElement>(SELECTORS.ROW_CHECKBOX).forEach((cb) => {
      cb.checked = false;
      cb.closest('tr')?.classList.remove(CLASSES.ROW_SELECTED);
    });

    const selectAll = this.rootEl.querySelector<HTMLInputElement>(SELECTORS.SELECT_ALL);
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }

    this.updateBulkToolbar();
    this.notifyChange();
  }

  /** Update visible rows reference (after filter/sort) */
  updateVisibleRows(rows: RowData[]): void {
    this.visibleRows = rows;
    // Remove selections for rows that are no longer visible
    const visibleIds = new Set(rows.map((r) => String(r.id)));
    for (const id of this.selectedIds) {
      if (!visibleIds.has(id)) {
        this.selectedIds.delete(id);
      }
    }
    this.updateSelectAllState();
    this.updateBulkToolbar();
  }

  /** Clean up */
  destroy(): void {
    this.selectedIds.clear();
    this.onSelectionChange = null;
  }
}
