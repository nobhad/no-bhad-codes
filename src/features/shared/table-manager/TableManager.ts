/**
 * ===============================================
 * TABLE MANAGER
 * ===============================================
 * @file src/features/shared/table-manager/TableManager.ts
 *
 * Main orchestrator for EJS hybrid tables.
 * Discovers tables via [data-table-id] attributes, parses config and row data,
 * and initializes sub-modules (sort, filter, paginate, select, export, animate).
 */

import { SELECTORS, CLASSES, DATA_ATTRS } from './constants';
import { TableSorter } from './TableSorter';
import { TableFilter } from './TableFilter';
import { TablePaginator } from './TablePaginator';
import { TableSelector } from './TableSelector';
import { TableExporter } from './TableExporter';
import { TableAnimator } from './TableAnimator';
import type { TableManagerConfig, RowData, TableDef } from './types';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('TableManager');

export class TableManager {
  private config: TableManagerConfig;
  private sorter: TableSorter | null = null;
  private filter: TableFilter | null = null;
  private paginator: TablePaginator | null = null;
  private selector: TableSelector | null = null;
  private exporter: TableExporter | null = null;
  private animator: TableAnimator;
  private abortController: AbortController;

  constructor(config: TableManagerConfig) {
    this.config = config;
    this.animator = new TableAnimator(config.rootEl);
    this.abortController = new AbortController();
  }

  /** Initialize all sub-modules based on table features */
  init(): void {
    const { tableDef, rows, rootEl } = this.config;
    const { features } = tableDef;

    logger.log(`Initializing TableManager for: ${tableDef.id} (${rows.length} rows)`);

    // Sorting
    if (features.sort) {
      this.sorter = new TableSorter(rootEl, rows, tableDef.columns, tableDef.defaultSort);
      this.sorter.init();
      this.sorter.setOnSortChange((_state, sortedRows) => {
        this.onDataChange(sortedRows);
      });
    }

    // Filtering
    if (features.search || features.filter) {
      this.filter = new TableFilter(rootEl, rows, tableDef.columns);
      this.filter.init();
      this.filter.setOnFilterChange((filteredRows) => {
        // After filter, update sort and pagination with new subset
        if (this.sorter) {
          this.sorter.updateRows(filteredRows);
        }
        this.onDataChange(filteredRows);
      });
    }

    // Pagination
    if (features.paginate) {
      this.paginator = new TablePaginator(rootEl, tableDef.id, rows, tableDef.pageSize);
      this.paginator.init();
    }

    // Selection
    if (features.select) {
      this.selector = new TableSelector(rootEl, rows);
      this.selector.init();
    }

    // Export
    if (features.export) {
      this.exporter = new TableExporter(tableDef.columns);
    }

    // Bind action buttons (export, refresh, row clicks, bulk actions)
    this.bindActions();

    // Mark as initialized (reveals JS-only controls via CSS)
    rootEl.setAttribute(CLASSES.INITIALIZED, 'true');

    // Animate initial rows
    this.animator.animateInitialRows();
    this.animator.animateTableIn();
  }

  /** Called when data changes (after sort or filter) */
  private onDataChange(currentRows: RowData[]): void {
    if (this.paginator) {
      this.paginator.updateRows(currentRows);
    }
    if (this.selector) {
      this.selector.updateVisibleRows(currentRows);
    }
  }

  /** Bind action button event listeners */
  private bindActions(): void {
    const { rootEl, tableDef } = this.config;
    const signal = this.abortController.signal;

    // Export button
    if (this.exporter) {
      const exportBtn = rootEl.querySelector<HTMLElement>(SELECTORS.EXPORT_BTN);
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const rows = this.getCurrentRows();
          const filename = `${tableDef.title.toLowerCase().replace(/\s+/g, '-')}-export.csv`;
          this.exporter!.exportCsv(rows, filename);
        }, { signal });
      }
    }

    // Refresh button
    const refreshBtn = rootEl.querySelector<HTMLElement>(SELECTORS.REFRESH_BTN);
    if (refreshBtn && this.config.onRefresh) {
      refreshBtn.addEventListener('click', () => {
        this.config.onRefresh?.();
      }, { signal });
    }

    // Row click navigation
    if (tableDef.features.rowClick && tableDef.rowClickTarget) {
      const tbody = rootEl.querySelector('tbody');
      if (tbody) {
        tbody.addEventListener('click', (e: Event) => {
          const target = e.target as HTMLElement;

          // Don't intercept clicks on checkboxes, buttons, links
          if (target.closest('input, button, a, [data-action]')) return;

          const tr = target.closest<HTMLElement>('tr[data-row-id]');
          if (!tr) return;

          const rowId = tr.getAttribute(DATA_ATTRS.ROW_ID);
          if (rowId) {
            const rowData = this.findRow(rowId);
            if (this.config.onRowClick) {
              this.config.onRowClick(rowId, rowData || { id: rowId });
            }
          }
        }, { signal });

        // Keyboard support for row navigation
        tbody.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key !== 'Enter') return;
          const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-row-id]');
          if (!tr) return;

          const rowId = tr.getAttribute(DATA_ATTRS.ROW_ID);
          if (rowId && this.config.onRowClick) {
            const rowData = this.findRow(rowId);
            this.config.onRowClick(rowId, rowData || { id: rowId });
          }
        }, { signal });
      }
    }

    // Row action buttons (view, edit, delete, etc.)
    const tbody = rootEl.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('click', (e: Event) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action][data-row-id]');
        if (!btn) return;

        const action = btn.getAttribute(DATA_ATTRS.ACTION);
        const rowId = btn.getAttribute(DATA_ATTRS.ROW_ID);
        if (action && rowId && this.config.onAction) {
          const rowData = this.findRow(rowId);
          this.config.onAction(action, rowId, rowData || { id: rowId });
        }
      }, { signal });
    }

    // Bulk action buttons
    const bulkToolbar = rootEl.querySelector<HTMLElement>(SELECTORS.BULK_TOOLBAR);
    if (bulkToolbar && this.config.onBulkAction) {
      bulkToolbar.addEventListener('click', (e: Event) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute(DATA_ATTRS.ACTION);
        if (action && action !== 'bulk-toolbar' && this.selector) {
          this.config.onBulkAction!(action, this.selector.getSelectedIds());
        }
      }, { signal });
    }
  }

  /** Get current visible/filtered rows */
  private getCurrentRows(): RowData[] {
    if (this.filter) {
      return this.filter.getFilteredRows();
    }
    return this.config.rows;
  }

  /** Find a row by ID */
  private findRow(rowId: string): RowData | undefined {
    return this.config.rows.find((r) => String(r.id) === rowId);
  }

  /** Clean up all sub-modules and event listeners */
  destroy(): void {
    logger.log(`Destroying TableManager for: ${this.config.tableDef.id}`);
    this.abortController.abort();
    this.sorter?.destroy();
    this.filter?.destroy();
    this.paginator?.destroy();
    this.selector?.destroy();
    this.sorter = null;
    this.filter = null;
    this.paginator = null;
    this.selector = null;
    this.exporter = null;
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a TableManager from a DOM element that has data-table-id,
 * data-table-config, and data-table-rows attributes.
 */
export function createTableManagerFromElement(
  rootEl: HTMLElement,
  callbacks?: {
    onAction?: TableManagerConfig['onAction'];
    onRowClick?: TableManagerConfig['onRowClick'];
    onBulkAction?: TableManagerConfig['onBulkAction'];
    onRefresh?: TableManagerConfig['onRefresh'];
  }
): TableManager | null {
  try {
    const configAttr = rootEl.getAttribute(SELECTORS.TABLE_CONFIG);
    const rowsAttr = rootEl.getAttribute(SELECTORS.TABLE_ROWS);

    if (!configAttr || !rowsAttr) {
      logger.error('Missing data-table-config or data-table-rows attributes');
      return null;
    }

    const tableDef: TableDef = JSON.parse(configAttr);
    const rows: RowData[] = JSON.parse(rowsAttr);

    const manager = new TableManager({
      tableDef,
      rows,
      rootEl,
      ...callbacks
    });

    return manager;
  } catch (error) {
    logger.error('Failed to create TableManager:', error);
    return null;
  }
}
